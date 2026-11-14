/**
 * Cloudflare Realtime SFU + Cloudflare TURN WebRTC Engine for Alpha Mate.
 * Implements authentic hardware media capture, Railway-proxied Cloudflare Realtime SFU
 * pub/sub sessions, SDP renegotiation, ICE TURN relay, heartbeat/lifecycle cleanup,
 * and Voice Activity Analysis for Solo Live Streaming and Multi-Seat Party Voice Rooms.
 *
 * STRICT PRODUCTION GUARANTEES:
 * - Zero fake video, zero synthetic audio oscillators, zero empty MediaStream fallbacks.
 * - Viewer local camera & microphone are NEVER captured or used as remote fallback.
 * - Cloudflare SFU & TURN secrets remain strictly server-side on Railway.
 */

import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { realtimeSocket } from './realtimeSocket';
import { User, SfuPublishedTrack } from '../types';

export interface PeerConnectionConfig {
  iceServers?: RTCIceServer[];
}

export interface StreamStats {
  bytesReceived: number;
  bytesSent: number;
  currentJitter: number;
  packetsLost: number;
}

export interface BroadcastState {
  isVideoOn: boolean;
  isMicOn: boolean;
}

export type ConnectionState =
  | 'new'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'failed'
  | 'closed';

export interface SoloLivePublishResult {
  stream: MediaStream;
  sfuSessionId: string;
  publishedTracks: SfuPublishedTrack[];
}

interface HostSfuSession {
  streamId: string;
  hostId: string;
  sfuSessionId: string;
  pc: RTCPeerConnection;
  stream: MediaStream;
  publishedTracks: SfuPublishedTrack[];
  facing: 'user' | 'environment';
  isVideoOn: boolean;
  isMicOn: boolean;
  isClosed?: boolean;
  onConnectionStateChange?: (state: ConnectionState) => void;
  onReconnected?: (result: SoloLivePublishResult) => void;
}

interface ViewerSfuSession {
  streamId: string;
  sfuSessionId: string;
  hostSfuSessionId: string;
  publishedTracks: SfuPublishedTrack[];
  pc: RTCPeerConnection;
  remoteStream: MediaStream;
  subscribedMids: string[];
  isVideoOn: boolean;
  isMicOn: boolean;
  isClosed?: boolean;
  onConnectionStateChange?: (state: ConnectionState) => void;
  onStreamReconnected?: (stream: MediaStream) => void;
}

export interface PartyParticipantProfile {
  userId?: string;
  uniqueId?: string;
  displayName?: string;
  avatar?: string;
  level?: number;
  vipTier?: number;
  countryFlag?: string;
  isHost?: boolean;
}

export interface PartyParticipantPresence {
  userId: string;
  uniqueId: string;
  displayName: string;
  avatar: string;
  level: number;
  vipTier: number;
  countryFlag?: string;
  isHost: boolean;
  joinedAtMs: number;
  sfuSessionId: string;
  trackName: string | null;
  mid: string | null;
  isPublishing: boolean;
  listenOnly: boolean;
  isMuted: boolean;
  isSpeaking: boolean;
  lastSeenAtMs: number;
}

interface PartySubscribedTrack {
  peerId: string;
  publisherSessionId: string;
  trackName: string;
  mid: string;
  stream: MediaStream;
}

interface DesiredPartyPeer {
  peerId: string;
  publisherSessionId: string;
  trackName: string;
}

interface PartySfuRoomSession {
  roomId: string;
  userId: string;
  profile: PartyParticipantProfile;
  joinedAtMs: number;
  subSfuSessionId: string;
  subPc: RTCPeerConnection;
  pubSfuSessionId: string | null;
  pubPc: RTCPeerConnection | null;
  localStream: MediaStream | null;
  localTrackName: string | null;
  localMid: string | null;
  isPublishing: boolean;
  isMuted: boolean;
  isSpeaking: boolean;
  isClosed?: boolean;
  subConnectingSinceMs: number;
  pubConnectingSinceMs: number;
  reconcileFailCount: number;
  unsubscribeParticipants: (() => void) | null;
  heartbeatTimer: ReturnType<typeof setInterval> | null;
  reconcileRetryTimer: ReturnType<typeof setTimeout> | null;
  subscribedByPeerKey: Map<string, PartySubscribedTrack>;
  pendingMidToPeer: Map<string, string>;
  latestDesiredPeers: Map<string, DesiredPartyPeer>;
  activeRemoteStreams: Map<string, MediaStream>;
  onError?: (err: Error) => void;
  onConnectionStateChange?: (state: ConnectionState) => void;
  onParticipantsChange?: (participants: PartyParticipantPresence[]) => void;
}

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export const CLOUDFLARE_TURN_URLS = [
  'turn:turn.cloudflare.com:3478?transport=udp',
  'turn:turn.cloudflare.com:3478?transport=tcp',
  'turns:turn.cloudflare.com:5349?transport=tcp',
];

export const PARTY_PARTICIPANT_STALE_MS = 15_000;
const PARTY_HEARTBEAT_INTERVAL_MS = 4000;
const RECONNECT_GRACE_MS = 2500;
const MAX_RECONNECT_ATTEMPTS = 3;
const LIVE_HEARTBEAT_INTERVAL_MS = 5000;

class RealtimeSfuStreamingEngine {
  private localStream: MediaStream | null = null;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private remoteStreams: Map<string, MediaStream> = new Map();
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private isMuted: boolean = false;
  private isVideoPaused: boolean = false;
  private facingMode: 'user' | 'environment' = 'user';

  // Broadcast state listeners
  private broadcastStates: Map<string, BroadcastState> = new Map();
  private stateListeners: Map<string, Set<(state: BroadcastState) => void>> = new Map();

  // Active Cloudflare SFU sessions
  private hostSfuSessions: Map<string, HostSfuSession> = new Map();
  private viewerSfuSessions: Map<string, ViewerSfuSession> = new Map();
  private partySfuSessions: Map<string, PartySfuRoomSession> = new Map();
  private partyRoomCallbacks: Map<
    string,
    {
      profile?: PartyParticipantProfile;
      onError?: (err: Error) => void;
      onConnectionStateChange?: (state: ConnectionState) => void;
      onParticipantsChange?: (participants: PartyParticipantPresence[]) => void;
    }
  > = new Map();
  private sessionQueues: Map<string, Promise<unknown>> = new Map();

  // Auto-reconnect & heartbeat coordination
  private reconnectTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private reconnectInFlight: Map<string, Promise<boolean>> = new Map();
  private reconnectAttempts: Map<string, number> = new Map();
  private hostHeartbeatTimers: Map<string, ReturnType<typeof setInterval>> = new Map();

  // TURN & ICE state
  private customIceServers: RTCIceServer[] = [...DEFAULT_ICE_SERVERS];
  private cachedTurnServers: RTCIceServer[] = [];
  private turnExpiresAt: number = 0;
  private hasCloudflareTurn: boolean = false;
  private sfuConfiguredUntil: number = 0;
  private sfuConfigCheckInFlight: Promise<void> | null = null;

  constructor() {
    this.fetchCloudflareTurnCredentials().catch(() => {});
    this.ensureSfuBackendConfigured().catch(() => {});
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.autoReconnectAllDisconnected();
      });
    }
  }

  public static readonly PRODUCTION_API_URL = 'https://api.alphamate.app';

  private isValidCustomBackendUrl(rawUrl: string): boolean {
    if (!rawUrl || rawUrl.includes('YOUR-RAILWAY-DOMAIN') || !/^https?:\/\//i.test(rawUrl)) {
      return false;
    }
    try {
      const parsed = new URL(rawUrl);
      const host = parsed.hostname.toLowerCase();
      if (
        host === 'localhost' ||
        host === '127.0.0.1' ||
        host === 'alphamate.app' ||
        host === 'www.alphamate.app'
      ) {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  private hasConfiguredRailwayUrl(): boolean {
    const envUrl = ((import.meta as any).env?.VITE_RAILWAY_API_URL || '').trim();
    return this.isValidCustomBackendUrl(envUrl);
  }

  private getBackendApiBase(): string {
    const envUrl = ((import.meta as any).env?.VITE_RAILWAY_API_URL || '').trim();
    if (this.isValidCustomBackendUrl(envUrl)) {
      return envUrl.replace(/\/$/, '');
    }
    return RealtimeSfuStreamingEngine.PRODUCTION_API_URL;
  }

  public getResolvedBackendApiBase(): string {
    return this.getBackendApiBase();
  }

  private async getFirebaseIdToken(forceRefresh: boolean = false): Promise<string> {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('Please sign in with your account before starting live video or party voice.');
    }
    return user.getIdToken(forceRefresh);
  }

  private formatNetworkFetchError(base: string, cause: unknown): Error {
    const target = base || RealtimeSfuStreamingEngine.PRODUCTION_API_URL;
    let detail = '';
    if (cause instanceof Error) {
      if (cause.name === 'AbortError') {
        detail = ' (request timed out)';
      } else if (cause.message && cause.message !== 'Failed to fetch') {
        detail = ` (${cause.message})`;
      }
    }
    const msg = `Unable to reach the Live SFU backend at ${target}${detail}. Verify your internet connection and that the backend server is online.`;
    const err: any = new Error(msg);
    err.code = 'SFU_BACKEND_UNREACHABLE';
    return err;
  }

  private async fetchWithTimeout(
    url: string,
    init: RequestInit,
    timeoutMs: number
  ): Promise<Response> {
    if (init.keepalive || typeof AbortController === 'undefined' || timeoutMs <= 0) {
      return fetch(url, init);
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  private isRetryableGatewayStatus(status: number, errorCode?: string): boolean {
    if (errorCode === 'SFU_NOT_CONFIGURED' || errorCode === 'TURN_NOT_CONFIGURED') {
      return false;
    }
    return status === 429 || status === 502 || status === 503 || status === 504 || status >= 520;
  }

  private async delayMs(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async sfuFetch<T = any>(
    path: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    body?: any,
    keepalive: boolean = false
  ): Promise<T> {
    const base = this.getBackendApiBase();
    const url = `${base}${path}`;

    const execOnce = async (forceTokenRefresh: boolean) => {
      const idToken = await this.getFirebaseIdToken(forceTokenRefresh);
      const headers: Record<string, string> = {
        Authorization: `Bearer ${idToken}`,
        Accept: 'application/json',
      };
      const init: RequestInit = {
        method,
        headers,
        keepalive,
        mode: 'cors',
        cache: 'no-store',
      };
      if (body !== undefined && method !== 'GET') {
        headers['Content-Type'] = 'application/json';
        init.body = JSON.stringify(body);
      }
      let response: Response;
      try {
        response = await this.fetchWithTimeout(url, init, 14000);
      } catch (networkErr) {
        console.warn(`[WebRTC SFU] Network error calling ${method} ${url}:`, networkErr);
        throw this.formatNetworkFetchError(base, networkErr);
      }
      const contentType = response.headers.get('content-type') || '';
      const rawText = await response.text().catch(() => '');
      let data: any = {};
      if (rawText) {
        try {
          data = JSON.parse(rawText);
        } catch {
          if (!contentType.includes('application/json')) {
            // Cloudflare proxy/gateway HTML error pages (e.g. 502/503/504/520-524) should be retried as transient errors
            if (this.isRetryableGatewayStatus(response.status)) {
              const err: any = new Error(
                `SFU backend gateway at ${base} temporarily unavailable (${response.status}).`
              );
              err.status = response.status;
              err.code = 'SFU_BACKEND_UNREACHABLE';
              throw err;
            }
            const msg = this.hasConfiguredRailwayUrl()
              ? `Backend API at ${base} returned non-JSON (${response.status}) for ${path}. Verify Railway is running the Express API (npm start).`
              : `No Express/SFU API server on this host (${response.status} HTML). Set VITE_RAILWAY_API_URL to your deployed Railway backend.`;
            const err: any = new Error(msg);
            err.status = response.status;
            err.code = 'SFU_NOT_CONFIGURED';
            throw err;
          }
          const err: any = new Error(`Invalid JSON response from SFU backend (${response.status}).`);
          err.status = response.status;
          throw err;
        }
      }
      return { response, data };
    };

    const maxAttempts = keepalive ? 1 : 2;
    let lastError: any = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        let { response, data } = await execOnce(false);
        if (response.status === 401 && !keepalive) {
          ({ response, data } = await execOnce(true));
        }

        if (!response.ok || data?.success === false) {
          const msg = data?.error || `SFU request failed (${response.status})`;
          const err: any = new Error(msg);
          err.status = response.status;
          if (data?.code) err.code = data.code;
          if (
            !keepalive &&
            attempt < maxAttempts - 1 &&
            this.isRetryableGatewayStatus(response.status, data?.code)
          ) {
            lastError = err;
            await this.delayMs(250 * (attempt + 1));
            continue;
          }
          throw err;
        }

        return data as T;
      } catch (err: any) {
        lastError = err;
        const canRetryNetwork =
          !keepalive &&
          attempt < maxAttempts - 1 &&
          (err?.code === 'SFU_BACKEND_UNREACHABLE' ||
            this.isRetryableGatewayStatus(Number(err?.status || 0), err?.code));
        if (canRetryNetwork) {
          await this.delayMs(350 * (attempt + 1));
          continue;
        }
        throw err;
      }
    }

    throw lastError || this.formatNetworkFetchError(base, null);
  }

  public async checkBackendHealth(): Promise<{
    ok: boolean;
    firebaseConfigured: boolean;
    turnConfigured: boolean;
    sfuConfigured: boolean;
  }> {
    const base = this.getBackendApiBase();
    const maxAttempts = 2;
    let lastError: unknown = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      let response: Response;
      try {
        response = await this.fetchWithTimeout(
          `${base}/api/health`,
          {
            method: 'GET',
            headers: { Accept: 'application/json' },
            mode: 'cors',
            cache: 'no-store',
          },
          12000
        );
      } catch (networkErr) {
        lastError = networkErr;
        if (attempt < maxAttempts - 1) {
          await this.delayMs(350 * (attempt + 1));
          continue;
        }
        throw this.formatNetworkFetchError(base, networkErr);
      }

      const contentType = response.headers.get('content-type') || '';
      const rawText = await response.text().catch(() => '');
      let data: any = null;
      if (rawText) {
        try {
          data = JSON.parse(rawText);
        } catch {
          data = null;
        }
      }
      if (!data || !contentType.includes('application/json')) {
        if (this.isRetryableGatewayStatus(response.status) && attempt < maxAttempts - 1) {
          await this.delayMs(350 * (attempt + 1));
          continue;
        }
        const msg = this.hasConfiguredRailwayUrl()
          ? `Backend API at ${base} returned non-JSON (${response.status}) for /api/health. Ensure Railway is running the Express API (npm start).`
          : `This build is serving static frontend files without an SFU API server (${response.status}). Set VITE_RAILWAY_API_URL to your Railway backend URL and rebuild.`;
        const err: any = new Error(msg);
        err.status = response.status;
        err.code = 'SFU_NOT_CONFIGURED';
        throw err;
      }
      if (this.isRetryableGatewayStatus(response.status) && attempt < maxAttempts - 1) {
        await this.delayMs(350 * (attempt + 1));
        continue;
      }
      return {
        ok: Boolean(response.ok && data?.success),
        firebaseConfigured: Boolean(data?.firebaseConfigured),
        turnConfigured: Boolean(data?.turnConfigured),
        sfuConfigured: Boolean(data?.sfuConfigured),
      };
    }

    throw this.formatNetworkFetchError(base, lastError);
  }

  private async ensureSfuBackendConfigured(): Promise<void> {
    if (Date.now() < this.sfuConfiguredUntil) {
      return;
    }
    if (this.sfuConfigCheckInFlight) {
      return this.sfuConfigCheckInFlight;
    }
    this.sfuConfigCheckInFlight = (async () => {
      try {
        const health = await this.checkBackendHealth();
        if (!health.sfuConfigured) {
          const err: any = new Error(
            'Cloudflare Realtime SFU is not configured on the backend server. Set REALTIME_SFU_APP_ID and REALTIME_SFU_BEARER_TOKEN on Railway (or the active backend) and set VITE_RAILWAY_API_URL.'
          );
          err.status = 503;
          err.code = 'SFU_NOT_CONFIGURED';
          throw err;
        }
        this.sfuConfiguredUntil = Date.now() + 5 * 60_000;
      } catch (err: any) {
        if (err?.code === 'SFU_NOT_CONFIGURED') {
          throw err;
        }
        // If /api/health timed out due to a slow upstream probe or transient 4.5G hiccup,
        // proceed directly to /api/sfu/sessions instead of blocking broadcast startup.
        console.warn('[WebRTC SFU] /api/health probe timed out or failed; proceeding to SFU session:', err?.message || err);
      } finally {
        this.sfuConfigCheckInFlight = null;
      }
    })();
    return this.sfuConfigCheckInFlight;
  }

  private enqueueSessionOp<T>(sessionKey: string, task: () => Promise<T>): Promise<T> {
    const prev = this.sessionQueues.get(sessionKey) || Promise.resolve();
    const next = prev.catch(() => undefined).then(task);
    const tail = next
      .catch(() => undefined)
      .finally(() => {
        if (this.sessionQueues.get(sessionKey) === tail) {
          this.sessionQueues.delete(sessionKey);
        }
      });
    this.sessionQueues.set(sessionKey, tail);
    return next;
  }

  // =========================================================================
  // CLOUDFLARE TURN CREDENTIALS & ICE CONFIG
  // =========================================================================

  public async fetchCloudflareTurnCredentials(forceRefresh: boolean = false): Promise<RTCIceServer[]> {
    const now = Date.now();
    if (!forceRefresh && this.cachedTurnServers.length > 0 && now < this.turnExpiresAt) {
      return this.cachedTurnServers;
    }

    if (auth.currentUser) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const base = this.getBackendApiBase();
          const idToken = await auth.currentUser.getIdToken(forceRefresh || attempt > 0);
          const response = await this.fetchWithTimeout(
            `${base}/api/webrtc/turn-credentials`,
            {
              method: 'GET',
              headers: { Authorization: `Bearer ${idToken}`, Accept: 'application/json' },
              mode: 'cors',
              cache: 'no-store',
            },
            5000
          );
          const contentType = response.headers.get('content-type') || '';
          const data = contentType.includes('application/json') ? await response.json().catch(() => ({})) : {};
          if (response.ok && data?.success && Array.isArray(data.iceServers) && data.iceServers.length) {
            const hasTurn = data.iceServers.some((server: RTCIceServer) =>
              (typeof server.urls === 'string' ? [server.urls] : server.urls || []).some(
                (url) => url.startsWith('turn:') || url.startsWith('turns:')
              )
            );
            if (hasTurn) {
              this.cachedTurnServers = data.iceServers;
              this.turnExpiresAt = now + Math.max(300, Number(data.ttl) || 3600) * 1000 - 60000;
              this.customIceServers = data.iceServers;
              this.hasCloudflareTurn = true;
              return data.iceServers;
            }
          }
          break;
        } catch (error) {
          if (attempt === 0) {
            await this.delayMs(250);
            continue;
          }
          console.warn('[WebRTC] Railway TURN credential request failed:', error);
        }
      }
    }

    return this.getIceServers();
  }

  public setIceServers(servers: RTCIceServer[]): void {
    this.customIceServers = servers;
    this.hasCloudflareTurn = servers.some(
      (s) =>
        (typeof s.urls === 'string' && s.urls.includes('turn:')) ||
        (Array.isArray(s.urls) && s.urls.some((u) => u.includes('turn:')))
    );
  }

  public getIceServers(): RTCIceServer[] {
    return this.customIceServers.length > 0 ? this.customIceServers : DEFAULT_ICE_SERVERS;
  }

  public getRtcConfiguration(): RTCConfiguration {
    return {
      iceServers: this.getIceServers(),
      iceTransportPolicy: 'all',
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
      iceCandidatePoolSize: 2,
    };
  }

  public isCloudflareTurnActive(): boolean {
    return this.hasCloudflareTurn;
  }

  private waitForIceGatheringComplete(pc: RTCPeerConnection, maxWaitMs: number = 1200): Promise<void> {
    if (pc.iceGatheringState === 'complete') {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      let settled = false;
      let candidateSettleTimer: ReturnType<typeof setTimeout> | null = null;
      const done = () => {
        if (settled) return;
        settled = true;
        clearTimeout(hardTimer);
        if (candidateSettleTimer) clearTimeout(candidateSettleTimer);
        pc.removeEventListener('icegatheringstatechange', onStateChange);
        pc.removeEventListener('icecandidate', onCandidate);
        resolve();
      };
      const onStateChange = () => {
        if (pc.iceGatheringState === 'complete') {
          done();
        }
      };
      const onCandidate = (e: RTCPeerConnectionIceEvent) => {
        if (!e.candidate) {
          done();
          return;
        }
        const candStr = e.candidate.candidate || '';
        if ((candStr.includes(' typ srflx ') || candStr.includes(' typ relay ')) && !candidateSettleTimer) {
          candidateSettleTimer = setTimeout(done, 180);
        }
      };
      const hardTimer = setTimeout(done, maxWaitMs);
      pc.addEventListener('icegatheringstatechange', onStateChange);
      pc.addEventListener('icecandidate', onCandidate);
    });
  }

  private waitForPeerConnected(pc: RTCPeerConnection, timeoutMs: number = 15000): Promise<void> {
    if (
      pc.connectionState === 'connected' ||
      pc.iceConnectionState === 'connected' ||
      pc.iceConnectionState === 'completed'
    ) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      let settled = false;
      const cleanup = () => {
        clearTimeout(timer);
        pc.removeEventListener('connectionstatechange', check);
        pc.removeEventListener('iceconnectionstatechange', check);
      };

      const fail = (reason: string) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error(reason));
      };

      const succeed = () => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve();
      };

      const check = () => {
        if (
          pc.connectionState === 'connected' ||
          pc.iceConnectionState === 'connected' ||
          pc.iceConnectionState === 'completed'
        ) {
          succeed();
        } else if (
          pc.connectionState === 'failed' ||
          pc.connectionState === 'closed' ||
          pc.iceConnectionState === 'failed'
        ) {
          fail(`WebRTC peer connection failed (${pc.connectionState || pc.iceConnectionState}).`);
        }
      };

      const timer = setTimeout(() => {
        fail('WebRTC SFU connection timed out. Please verify network & Cloudflare TURN/SFU settings.');
      }, timeoutMs);

      pc.addEventListener('connectionstatechange', check);
      pc.addEventListener('iceconnectionstatechange', check);
      check();
    });
  }

  private async createSfuSession(): Promise<string> {
    const res = await this.sfuFetch<{ sessionId: string }>('/api/sfu/sessions', 'POST', {});
    if (!res.sessionId) {
      throw new Error('Cloudflare SFU did not return a sessionId.');
    }
    return res.sessionId;
  }

  private async requestPartyRoomSessionToken(
    roomId: string,
    wantPublish: boolean
  ): Promise<{ sfuSessionId: string; role: string; canPublish: boolean }> {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await this.sfuFetch<{
          sfuSessionId: string;
          role: string;
          canPublish: boolean;
          iceServers?: RTCIceServer[];
          expiresAt?: number;
        }>(`/api/sfu/party/rooms/${encodeURIComponent(roomId)}/token`, 'POST', {
          wantPublish,
        });

        if (Array.isArray(res.iceServers) && res.iceServers.length > 0) {
          const hasTurn = res.iceServers.some((server) =>
            (typeof server.urls === 'string' ? [server.urls] : server.urls || []).some(
              (u) => u.startsWith('turn:') || u.startsWith('turns:')
            )
          );
          if (hasTurn) {
            this.cachedTurnServers = res.iceServers;
            this.turnExpiresAt = (res.expiresAt || Date.now() + 3600_000) - 60_000;
            this.setIceServers(res.iceServers);
          }
        }

        if (res.sfuSessionId) {
          return {
            sfuSessionId: res.sfuSessionId,
            role: res.role || (wantPublish ? 'guest' : 'viewer'),
            canPublish: Boolean(res.canPublish),
          };
        }
        break;
      } catch (err: any) {
        if (err?.status === 401 || err?.status === 403 || err?.code === 'SFU_NOT_CONFIGURED') {
          throw err;
        }
        if (attempt === 0) {
          await this.delayMs(200);
          continue;
        }
        console.warn(
          '[Party SFU] Role token endpoint unavailable, falling back to /api/sfu/sessions:',
          err?.message || err
        );
      }
    }

    const sfuSessionId = await this.createSfuSession();
    return {
      sfuSessionId,
      role: wantPublish ? 'speaker' : 'viewer',
      canPublish: wantPublish,
    };
  }

  private async publishTracksOnSession(
    sessionId: string,
    pc: RTCPeerConnection,
    tracksWithNames: Array<{ track: MediaStreamTrack; trackName: string }>,
    stream: MediaStream
  ): Promise<SfuPublishedTrack[]> {
    return this.enqueueSessionOp(sessionId, async () => {
      const addedTransceivers: Array<{
        transceiver: RTCRtpTransceiver;
        trackName: string;
        kind: 'audio' | 'video';
      }> = [];

      for (const item of tracksWithNames) {
        const transceiver = pc.addTransceiver(item.track, {
          direction: 'sendonly',
          streams: [stream],
        });
        // Prefer Opus for voice and reserve bandwidth for audio on constrained links.
        if (item.track.kind === 'audio') {
          try {
            const audioCodecs = RTCRtpSender.getCapabilities?.('audio')?.codecs || [];
            const opus = audioCodecs.filter((codec) => codec.mimeType.toLowerCase() === 'audio/opus');
            const otherAudio = audioCodecs.filter((codec) => codec.mimeType.toLowerCase() !== 'audio/opus');
            if (opus.length && 'setCodecPreferences' in transceiver) {
              transceiver.setCodecPreferences([...opus, ...otherAudio]);
            }
            const params = transceiver.sender.getParameters();
            params.encodings = params.encodings?.length ? params.encodings : [{}];
            params.encodings[0].maxBitrate = 32_000;
            (params.encodings[0] as any).priority = 'high';
            (params.encodings[0] as any).networkPriority = 'high';
            await transceiver.sender.setParameters(params);
          } catch (codecErr) {
            console.warn('[WebRTC] Audio codec preference/bitrate tuning unavailable; using browser defaults.', codecErr);
          }
        } else if (item.track.kind === 'video') {
          try {
            const params = transceiver.sender.getParameters();
            params.encodings = params.encodings?.length ? params.encodings : [{}];
            params.encodings[0].maxBitrate = 700_000;
            params.encodings[0].maxFramerate = 30;
            (params as any).degradationPreference = 'maintain-framerate';
            await transceiver.sender.setParameters(params);
          } catch (videoTuneErr) {
            console.warn('[WebRTC] Adaptive video tuning unavailable; using browser defaults.', videoTuneErr);
          }
        }
        addedTransceivers.push({
          transceiver,
          trackName: item.trackName,
          kind: item.track.kind === 'audio' ? 'audio' : 'video',
        });
      }

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await this.waitForIceGatheringComplete(pc, 1200);

      const sfuTracksPayload = addedTransceivers.map((entry) => {
        if (!entry.transceiver.mid) {
          throw new Error(`Unable to resolve SDP mid for local track ${entry.trackName}.`);
        }
        return {
          location: 'local' as const,
          mid: entry.transceiver.mid,
          trackName: entry.trackName,
        };
      });

      const trackResp = await this.sfuFetch<{
        requiresImmediateRenegotiation: boolean;
        sessionDescription: RTCSessionDescriptionInit | null;
        tracks: Array<{ mid?: string; trackName?: string; errorCode?: string; errorDescription?: string }>;
      }>(`/api/sfu/sessions/${encodeURIComponent(sessionId)}/tracks`, 'POST', {
        sessionDescription: {
          type: pc.localDescription!.type,
          sdp: pc.localDescription!.sdp,
        },
        tracks: sfuTracksPayload,
      });

      if (trackResp.sessionDescription?.sdp) {
        await pc.setRemoteDescription(new RTCSessionDescription(trackResp.sessionDescription));
        if (trackResp.requiresImmediateRenegotiation && trackResp.sessionDescription.type === 'offer') {
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await this.waitForIceGatheringComplete(pc, 1000);
          await this.sfuFetch(`/api/sfu/sessions/${encodeURIComponent(sessionId)}/renegotiate`, 'PUT', {
            sessionDescription: {
              type: pc.localDescription!.type,
              sdp: pc.localDescription!.sdp,
            },
          });
        }
      }

      return addedTransceivers.map((entry) => ({
        trackName: entry.trackName,
        mid: entry.transceiver.mid || '',
        kind: entry.kind,
      }));
    });
  }

  private extractSdpMids(sdp: string): string[] {
    if (!sdp) return [];
    const mids: string[] = [];
    const sections = sdp.split(/\r?\nm=/).slice(1);
    for (const sec of sections) {
      const match = sec.match(/^[^\r\n]*[\s\S]*?\r?\na=mid:([^\r\n]+)/);
      if (match?.[1]) {
        mids.push(match[1].trim());
      }
    }
    return mids;
  }

  private async subscribeTracksOnSession(
    sessionId: string,
    pc: RTCPeerConnection,
    remoteTracks: Array<{ publisherSessionId: string; trackName: string; peerId?: string }>,
    context?: { contextType: 'live' | 'party'; contextId: string; speakerPeerIds?: string[] },
    onAssignedMids?: (assigned: Array<{ mid: string; trackName: string; publisherSessionId: string; peerId?: string }>) => void
  ): Promise<Array<{ mid: string; trackName: string; publisherSessionId: string }>> {
    return this.enqueueSessionOp(sessionId, async () => {
      const existingMids = new Set(
        pc.getTransceivers().map((t) => t.mid).filter((m): m is string => Boolean(m))
      );

      const resp = await this.sfuFetch<{
        requiresImmediateRenegotiation: boolean;
        sessionDescription: RTCSessionDescriptionInit | null;
        tracks: Array<{
          mid?: string;
          trackName?: string;
          sessionId?: string;
          errorCode?: string;
          errorDescription?: string;
        }>;
      }>(`/api/sfu/sessions/${encodeURIComponent(sessionId)}/tracks`, 'POST', {
        tracks: remoteTracks.map((t) => ({
          location: 'remote',
          sessionId: t.publisherSessionId,
          trackName: t.trackName,
        })),
        ...(context || {}),
      });

      const sdpNewMids = resp.sessionDescription?.sdp
        ? this.extractSdpMids(resp.sessionDescription.sdp).filter((m) => !existingMids.has(m))
        : [];
      let fallbackCursor = 0;

      const assigned = (resp.tracks || []).map((t, idx) => {
        let resolvedMid = t.mid ? String(t.mid).trim() : '';
        if (!resolvedMid && fallbackCursor < sdpNewMids.length) {
          resolvedMid = sdpNewMids[fallbackCursor++];
        }
        return {
          mid: resolvedMid,
          trackName: String(t.trackName || remoteTracks[idx]?.trackName || ''),
          publisherSessionId: String(t.sessionId || remoteTracks[idx]?.publisherSessionId || ''),
          peerId:
            remoteTracks.find(
              (rt) => rt.trackName === t.trackName && (!t.sessionId || rt.publisherSessionId === t.sessionId)
            )?.peerId || remoteTracks[idx]?.peerId,
        };
      });

      if (onAssignedMids) {
        onAssignedMids(assigned);
      }

      if (resp.sessionDescription?.sdp) {
        await pc.setRemoteDescription(new RTCSessionDescription(resp.sessionDescription));
        if (resp.requiresImmediateRenegotiation || resp.sessionDescription.type === 'offer') {
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await this.waitForIceGatheringComplete(pc, 1200);
          await this.sfuFetch(`/api/sfu/sessions/${encodeURIComponent(sessionId)}/renegotiate`, 'PUT', {
            sessionDescription: {
              type: pc.localDescription!.type,
              sdp: pc.localDescription!.sdp,
            },
          });
        }
      }

      return assigned;
    });
  }

  private async closeTracksOnSession(
    sessionId: string,
    pc: RTCPeerConnection,
    mids: string[],
    force: boolean = false
  ): Promise<void> {
    const validMids = mids.filter((m) => typeof m === 'string' && m.trim().length > 0);
    if (!validMids.length) return;

    return this.enqueueSessionOp(sessionId, async () => {
      if (pc.signalingState === 'closed') {
        await this.sfuFetch(`/api/sfu/sessions/${encodeURIComponent(sessionId)}/tracks/close`, 'PUT', {
          tracks: validMids.map((mid) => ({ mid })),
          force: true,
        }).catch(() => {});
        return;
      }

      if (!force) {
        for (const mid of validMids) {
          const transceiver = pc.getTransceivers().find((t) => t.mid === mid);
          if (transceiver) {
            try {
              transceiver.stop();
            } catch {
              // ignore
            }
          }
        }
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await this.waitForIceGatheringComplete(pc, 800);
        const resp = await this.sfuFetch<{
          requiresImmediateRenegotiation?: boolean;
          sessionDescription?: RTCSessionDescriptionInit | null;
        }>(`/api/sfu/sessions/${encodeURIComponent(sessionId)}/tracks/close`, 'PUT', {
          tracks: validMids.map((mid) => ({ mid })),
          sessionDescription: {
            type: pc.localDescription!.type,
            sdp: pc.localDescription!.sdp,
          },
          force: false,
        }).catch(() => null);

        if (resp?.sessionDescription?.sdp) {
          await pc.setRemoteDescription(new RTCSessionDescription(resp.sessionDescription)).catch(() => {});
        }
      } else {
        await this.sfuFetch(`/api/sfu/sessions/${encodeURIComponent(sessionId)}/tracks/close`, 'PUT', {
          tracks: validMids.map((mid) => ({ mid })),
          force: true,
        }).catch(() => {});
      }
    });
  }

  private async deleteSfuSession(sessionId: string, keepalive: boolean = false): Promise<void> {
    if (!sessionId) return;
    await this.sfuFetch(
      `/api/sfu/sessions/${encodeURIComponent(sessionId)}`,
      'DELETE',
      undefined,
      keepalive
    ).catch(() => {});
  }

  // =========================================================================
  // LOCAL HARDWARE CAPTURE (USED BY SOLO HOST & VIDEO UPLOAD PREVIEW)
  // =========================================================================

  private async requestMediaWithTimeout(
    constraints: MediaStreamConstraints,
    timeoutMs: number,
    label: string
  ): Promise<MediaStream> {
    let timedOut = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const request = navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
      if (timedOut) {
        stream.getTracks().forEach((track) => track.stop());
        throw new Error(`${label} request completed after its timeout.`);
      }
      return stream;
    });
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        timedOut = true;
        reject(new Error(`${label} request timed out.`));
      }, timeoutMs);
    });
    try {
      return await Promise.race([request, timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  public async getLocalMediaStream(
    facing: 'user' | 'environment' = 'user',
    withAudio: boolean = true
  ): Promise<MediaStream> {
    this.facingMode = facing;
    this.stopLocalMediaStream();

    const constraints: MediaStreamConstraints = {
      video: {
        facingMode: { ideal: facing },
        width: { ideal: 1280, max: 1920 },
        height: { ideal: 720, max: 1080 },
        frameRate: { ideal: 30, max: 60 },
      },
      audio: withAudio
        ? {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          }
        : false,
    };

    try {
      const stream = await this.requestMediaWithTimeout(constraints, 12000, 'Camera and microphone');
      this.localStream = stream;
      if (this.isVideoPaused) stream.getVideoTracks().forEach((t) => (t.enabled = false));
      if (this.isMuted) stream.getAudioTracks().forEach((t) => (t.enabled = false));
      if (withAudio) this.initAudioAnalyser(stream);
      return stream;
    } catch (err) {
      console.warn('[Media capture] Preferred camera/microphone constraints failed; retrying with device defaults.', err);
      // Keep voice available even when camera capture/rendering fails. Audio is
      // requested independently as a fallback so video-off never implies mic-off.
      if (withAudio) {
        try {
          const audioOnlyStream = await this.requestMediaWithTimeout({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
            video: false,
          }, 8000, 'Microphone');
          this.localStream = audioOnlyStream;
          if (this.isMuted) audioOnlyStream.getAudioTracks().forEach((t) => (t.enabled = false));
          this.initAudioAnalyser(audioOnlyStream);
          return audioOnlyStream;
        } catch (audioErr) {
          console.error('[Media capture] Microphone-only fallback failed.', audioErr);
        }
      }
      // If microphone is not requested/available, retain a camera-only path.
      const videoOnlyStream = await this.requestMediaWithTimeout({ video: true, audio: false }, 8000, 'Camera');
      this.localStream = videoOnlyStream;
      if (this.isVideoPaused) videoOnlyStream.getVideoTracks().forEach((t) => (t.enabled = false));
      return videoOnlyStream;
    }
  }

  /**
   * Flip camera: if an active host SFU session exists, seamlessly replaces the
   * outbound video track via RTCRtpSender.replaceTrack so viewers stay connected.
   */
  public async flipCamera(activeStreamId?: string): Promise<MediaStream> {
    const nextFacing = this.facingMode === 'user' ? 'environment' : 'user';
    const hostSession = activeStreamId ? this.hostSfuSessions.get(activeStreamId) : undefined;

    if (hostSession && hostSession.pc.connectionState !== 'closed') {
      this.facingMode = nextFacing;
      const newCamStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: nextFacing },
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          frameRate: { ideal: 30, max: 60 },
        },
        audio: false,
      });
      const newVideoTrack = newCamStream.getVideoTracks()[0];
      if (!newVideoTrack) {
        throw new Error('Could not capture video track from rotated camera.');
      }
      newVideoTrack.enabled = hostSession.isVideoOn;

      const videoSender = hostSession.pc.getSenders().find((s) => s.track?.kind === 'video');
      if (videoSender) {
        await videoSender.replaceTrack(newVideoTrack);
      }

      const oldVideoTracks = hostSession.stream.getVideoTracks();
      oldVideoTracks.forEach((oldTrack) => {
        hostSession.stream.removeTrack(oldTrack);
        try {
          oldTrack.stop();
        } catch {
          // ignore
        }
      });
      hostSession.stream.addTrack(newVideoTrack);
      this.localStream = hostSession.stream;
      return hostSession.stream;
    }

    return this.getLocalMediaStream(nextFacing, !this.isMuted);
  }

  public getFacingMode(): 'user' | 'environment' {
    return this.facingMode;
  }

  public stopLocalMediaStream(): void {
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      this.localStream = null;
    }
    this.stopAudioAnalyser();
  }

  public toggleMicrophone(enabled?: boolean): boolean {
    const partyAudioTracks = Array.from(this.partySfuSessions.values()).flatMap((s) => [
      ...(s.localStream?.getAudioTracks() || []),
      ...(s.pubPc
        ? s.pubPc
            .getSenders()
            .map((sender) => sender.track)
            .filter((t): t is MediaStreamTrack => Boolean(t && t.kind === 'audio'))
        : []),
    ]);
    const localAudioTracks = this.localStream?.getAudioTracks() || [];
    const allTracks = Array.from(new Set([...localAudioTracks, ...partyAudioTracks]));
    if (!allTracks.length && this.partySfuSessions.size === 0) return false;

    const nextEnabled =
      enabled !== undefined ? enabled : allTracks.length > 0 ? !allTracks.some((t) => t.enabled) : !this.isMuted;
    this.isMuted = !nextEnabled;
    allTracks.forEach((t) => {
      t.enabled = nextEnabled;
    });

    this.partySfuSessions.forEach((session) => {
      session.isMuted = !nextEnabled;
      if (!nextEnabled) {
        session.isSpeaking = false;
      }
      if (session.isPublishing && auth.currentUser?.uid) {
        updateDoc(doc(db, 'partyRooms', session.roomId, 'voiceParticipants', auth.currentUser.uid), {
          isMuted: !nextEnabled,
          ...(nextEnabled ? {} : { isSpeaking: false }),
          lastSeenAt: serverTimestamp(),
          lastSeenAtMs: Date.now(),
        }).catch(() => {});
      }
    });

    return nextEnabled;
  }

  public toggleVideo(enabled?: boolean): boolean {
    if (!this.localStream) return false;
    const videoTrack = this.localStream.getVideoTracks()[0];
    if (videoTrack) {
      this.isVideoPaused = enabled !== undefined ? !enabled : !videoTrack.enabled;
      videoTrack.enabled = !this.isVideoPaused;
      return !this.isVideoPaused;
    }
    return false;
  }

  // =========================================================================
  // AUTO-RECONNECT & SFU SESSION RECOVERY
  // =========================================================================

  private clearReconnectState(sessionKey: string, resetAttempts: boolean = true): void {
    const timer = this.reconnectTimers.get(sessionKey);
    if (timer) {
      clearTimeout(timer);
      this.reconnectTimers.delete(sessionKey);
    }
    if (resetAttempts) {
      this.reconnectAttempts.delete(sessionKey);
    }
  }

  private monitorPeerConnection(
    sessionKey: string,
    pc: RTCPeerConnection,
    opts: {
      isSessionActive: () => boolean;
      onStateChange?: (state: ConnectionState) => void;
      onReconnectNeeded: () => Promise<boolean>;
    }
  ): void {
    const evaluateState = () => {
      if (!opts.isSessionActive()) {
        this.clearReconnectState(sessionKey);
        return;
      }

      const connState = pc.connectionState as ConnectionState;
      const iceState = pc.iceConnectionState;

      if (connState === 'connected' || iceState === 'connected' || iceState === 'completed') {
        this.clearReconnectState(sessionKey, true);
        opts.onStateChange?.('connected');
        return;
      }

      if (connState === 'disconnected' || iceState === 'disconnected') {
        opts.onStateChange?.('disconnected');
        this.scheduleAutoReconnect(sessionKey, pc, RECONNECT_GRACE_MS, opts);
        return;
      }

      if (connState === 'failed' || iceState === 'failed') {
        this.scheduleAutoReconnect(sessionKey, pc, 500, opts);
      }
    };

    pc.onconnectionstatechange = evaluateState;
    pc.oniceconnectionstatechange = evaluateState;
  }

  private scheduleAutoReconnect(
    sessionKey: string,
    pc: RTCPeerConnection,
    delayMs: number,
    opts: {
      isSessionActive: () => boolean;
      onStateChange?: (state: ConnectionState) => void;
      onReconnectNeeded: () => Promise<boolean>;
    }
  ): void {
    if (!opts.isSessionActive()) return;
    if (this.reconnectTimers.has(sessionKey) || this.reconnectInFlight.has(sessionKey)) return;

    const timer = setTimeout(() => {
      this.reconnectTimers.delete(sessionKey);
      if (!opts.isSessionActive()) return;

      // If ICE/Peer recovered naturally during the grace window, cancel reconnect
      if (
        pc.connectionState === 'connected' ||
        pc.iceConnectionState === 'connected' ||
        pc.iceConnectionState === 'completed'
      ) {
        this.clearReconnectState(sessionKey, true);
        opts.onStateChange?.('connected');
        return;
      }

      this.runAutoReconnectWithBackoff(sessionKey, opts).catch(() => {});
    }, delayMs);

    this.reconnectTimers.set(sessionKey, timer);
  }

  private async runAutoReconnectWithBackoff(
    sessionKey: string,
    opts: {
      isSessionActive: () => boolean;
      onStateChange?: (state: ConnectionState) => void;
      onReconnectNeeded: () => Promise<boolean>;
    }
  ): Promise<boolean> {
    const existingFlight = this.reconnectInFlight.get(sessionKey);
    if (existingFlight) return existingFlight;

    const runner = (async () => {
      try {
        const attempt = (this.reconnectAttempts.get(sessionKey) || 0) + 1;
        this.reconnectAttempts.set(sessionKey, attempt);

        if (!opts.isSessionActive()) return false;
        opts.onStateChange?.('connecting');

        try {
          const ok = await opts.onReconnectNeeded();
          if (ok) {
            this.clearReconnectState(sessionKey, true);
            return true;
          }
        } catch (err) {
          console.warn(`[WebRTC SFU] Auto-reconnect attempt ${attempt} failed for ${sessionKey}:`, err);
        }

        if (!opts.isSessionActive()) return false;

        if (attempt < MAX_RECONNECT_ATTEMPTS) {
          const nextDelay = Math.min(8000, RECONNECT_GRACE_MS * attempt);
          const retryTimer = setTimeout(() => {
            this.reconnectTimers.delete(sessionKey);
            if (opts.isSessionActive()) {
              this.runAutoReconnectWithBackoff(sessionKey, opts).catch(() => {});
            }
          }, nextDelay);
          this.reconnectTimers.set(sessionKey, retryTimer);
          return false;
        }

        // Retries exhausted -> surface genuine failed state without faking success
        this.reconnectAttempts.delete(sessionKey);
        opts.onStateChange?.('failed');
        return false;
      } finally {
        this.reconnectInFlight.delete(sessionKey);
      }
    })();

    this.reconnectInFlight.set(sessionKey, runner);
    return runner;
  }

  private autoReconnectAllDisconnected(): void {
    this.hostSfuSessions.forEach((s, streamId) => {
      if (!s.isClosed && (s.pc.connectionState === 'disconnected' || s.pc.connectionState === 'failed' || s.pc.iceConnectionState === 'disconnected' || s.pc.iceConnectionState === 'failed')) {
        this.autoReconnect('host', streamId).catch(() => {});
      }
    });
    this.viewerSfuSessions.forEach((s, streamId) => {
      if (!s.isClosed && (s.pc.connectionState === 'disconnected' || s.pc.connectionState === 'failed' || s.pc.iceConnectionState === 'disconnected' || s.pc.iceConnectionState === 'failed')) {
        this.autoReconnect('viewer', streamId).catch(() => {});
      }
    });
    this.partySfuSessions.forEach((s, roomId) => {
      const subBroken =
        s.subPc.connectionState === 'disconnected' ||
        s.subPc.connectionState === 'failed' ||
        s.subPc.iceConnectionState === 'disconnected' ||
        s.subPc.iceConnectionState === 'failed';
      const pubBroken =
        s.pubPc &&
        (s.pubPc.connectionState === 'disconnected' ||
          s.pubPc.connectionState === 'failed' ||
          s.pubPc.iceConnectionState === 'disconnected' ||
          s.pubPc.iceConnectionState === 'failed');
      if (!s.isClosed && (subBroken || pubBroken)) {
        this.autoReconnect('party', roomId).catch(() => {});
      }
    });
  }

  /**
   * Public auto-reconnect entrypoint that re-establishes an active SFU session
   * (Host, Viewer, or Party Room) after a transient disconnection or network switch.
   */
  public async autoReconnect(
    targetType: 'host' | 'viewer' | 'party',
    id: string
  ): Promise<boolean> {
    if (targetType === 'host') {
      return this.reconnectHostBroadcast(id);
    }
    if (targetType === 'viewer') {
      return this.reconnectViewerBroadcast(id);
    }
    return this.reconnectPartyVoice(id);
  }

  private async reconnectHostBroadcast(streamId: string): Promise<boolean> {
    const existing = this.hostSfuSessions.get(streamId);
    if (!existing || existing.isClosed) return false;

    const sessionKey = `host:${streamId}`;
    console.info(`[Solo Live Host] Re-establishing Cloudflare SFU session for ${streamId}...`);

    try {
      await this.getFirebaseIdToken(true);
      await this.fetchCloudflareTurnCredentials(true).catch(() => {});
    } catch {
      return false;
    }

    if (existing.isClosed || this.hostSfuSessions.get(streamId) !== existing) return false;

    let stream = existing.stream;
    const hasLiveHardwareTrack = stream
      .getTracks()
      .some((t) => t.readyState === 'live');

    if (!hasLiveHardwareTrack) {
      try {
        stream = await this.getLocalMediaStream(existing.facing, true);
      } catch (err) {
        console.error('[Solo Live Host] Failed to re-acquire camera/mic during reconnect:', err);
        return false;
      }
    }

    const videoTrack = stream.getVideoTracks()[0];
    const audioTrack = stream.getAudioTracks()[0];
    if (!videoTrack && !audioTrack) return false;
    if (videoTrack) videoTrack.enabled = existing.isVideoOn;
    if (audioTrack) audioTrack.enabled = existing.isMicOn;

    let newSfuSessionId = '';
    let newPc: RTCPeerConnection | null = null;

    try {
      newSfuSessionId = await this.createSfuSession();
      newPc = new RTCPeerConnection(this.getRtcConfiguration());

      const suffix = Date.now().toString(36);
      const tracksToPublish: Array<{ track: MediaStreamTrack; trackName: string }> = [];
      if (videoTrack) tracksToPublish.push({ track: videoTrack, trackName: `${streamId}-video-${suffix}` });
      if (audioTrack) tracksToPublish.push({ track: audioTrack, trackName: `${streamId}-audio-${suffix}` });

      const publishedTracks = await this.publishTracksOnSession(newSfuSessionId, newPc, tracksToPublish, stream);
      await this.waitForPeerConnected(newPc, 15000);

      if (existing.isClosed || this.hostSfuSessions.get(streamId) !== existing) {
        newPc.close();
        await this.deleteSfuSession(newSfuSessionId);
        return false;
      }

      const oldPc = existing.pc;
      const oldSfuSessionId = existing.sfuSessionId;

      const updatedSession: HostSfuSession = {
        ...existing,
        sfuSessionId: newSfuSessionId,
        pc: newPc,
        stream,
        publishedTracks,
      };
      this.hostSfuSessions.set(streamId, updatedSession);

      this.monitorPeerConnection(sessionKey, newPc, {
        isSessionActive: () =>
          !updatedSession.isClosed && this.hostSfuSessions.get(streamId) === updatedSession,
        onStateChange: updatedSession.onConnectionStateChange,
        onReconnectNeeded: () => this.reconnectHostBroadcast(streamId),
      });

      // Detach old handlers and tear down stale peer & SFU session without stopping live tracks
      oldPc.onconnectionstatechange = null;
      oldPc.oniceconnectionstatechange = null;
      try {
        oldPc.close();
      } catch {
        // ignore
      }
      this.deleteSfuSession(oldSfuSessionId).catch(() => {});

      // Publish updated SFU session metadata + fresh lastHeartbeat to Firestore so viewers resubscribe seamlessly
      const nowMs = Date.now();
      await updateDoc(doc(db, 'liveStreams', streamId), {
        sfuSessionId: newSfuSessionId,
        publishedTracks,
        isVideoOn: updatedSession.isVideoOn,
        isMicOn: updatedSession.isMicOn,
        lastHeartbeat: serverTimestamp(),
        lastHeartbeatMs: nowMs,
        lastSeenAt: serverTimestamp(),
        lastSeenAtMs: nowMs,
        updatedAt: new Date(nowMs).toISOString(),
      }).catch(() => {});

      updatedSession.onReconnected?.({
        stream,
        sfuSessionId: newSfuSessionId,
        publishedTracks,
      });
      updatedSession.onConnectionStateChange?.('connected');
      return true;
    } catch (err) {
      if (newPc) {
        try {
          newPc.close();
        } catch {
          // ignore
        }
      }
      if (newSfuSessionId) {
        await this.deleteSfuSession(newSfuSessionId);
      }
      console.warn('[Solo Live Host] SFU reconnect failed:', err);
      return false;
    }
  }

  private async reconnectViewerBroadcast(streamId: string): Promise<boolean> {
    const existing = this.viewerSfuSessions.get(streamId);
    if (!existing || existing.isClosed) return false;

    const sessionKey = `viewer:${streamId}`;
    console.info(`[Solo Live Viewer] Re-establishing Cloudflare SFU session for ${streamId}...`);

    try {
      await this.getFirebaseIdToken(true);
      await this.fetchCloudflareTurnCredentials(true).catch(() => {});
    } catch {
      return false;
    }

    if (existing.isClosed || this.viewerSfuSessions.get(streamId) !== existing) return false;

    let hostSfuSessionId = existing.hostSfuSessionId;
    let publishedTracks = existing.publishedTracks;
    let isVideoOn = existing.isVideoOn;
    let isMicOn = existing.isMicOn;

    // Fetch freshest host session metadata from Firestore in case host also reconnected
    try {
      const snap = await getDoc(doc(db, 'liveStreams', streamId));
      if (!snap.exists() || snap.data()?.isActive === false) {
        return false;
      }
      const data = snap.data() as any;
      if (typeof data.sfuSessionId === 'string' && data.sfuSessionId) {
        hostSfuSessionId = data.sfuSessionId;
      }
      if (Array.isArray(data.publishedTracks) && data.publishedTracks.length > 0) {
        publishedTracks = data.publishedTracks.filter((t: any) => Boolean(t?.trackName));
      }
      isVideoOn = data.isVideoOn !== false;
      isMicOn = data.isMicOn !== false;
    } catch {
      // Fallback to cached host SFU metadata on transient read errors
    }

    if (!hostSfuSessionId || !publishedTracks.length) return false;

    let newViewerSessionId = '';
    let newPc: RTCPeerConnection | null = null;
    const remoteStream = new MediaStream();

    try {
      newViewerSessionId = await this.createSfuSession();
      newPc = new RTCPeerConnection(this.getRtcConfiguration());

      let tracksReceived = 0;
      let resolveTrackWaiter: (() => void) | null = null;
      const firstTrackPromise = new Promise<void>((resolve) => {
        resolveTrackWaiter = resolve;
      });

      newPc.ontrack = (event) => {
        const track = event.track;
        if (!track) return;
        if (!remoteStream.getTracks().some((t) => t.id === track.id)) {
          remoteStream.addTrack(track);
        }
        tracksReceived += 1;
        resolveTrackWaiter?.();
      };

      const assigned = await this.subscribeTracksOnSession(
        newViewerSessionId,
        newPc,
        publishedTracks.map((t) => ({
          publisherSessionId: hostSfuSessionId,
          trackName: t.trackName,
        })),
        { contextType: 'live', contextId: streamId }
      );

      await Promise.all([
        this.waitForPeerConnected(newPc, 15000),
        Promise.race([
          firstTrackPromise,
          new Promise<void>((_, reject) =>
            setTimeout(() => {
              if (tracksReceived === 0) {
                reject(new Error('No live audio/video tracks arrived after SFU reconnect.'));
              } else {
                resolveTrackWaiter?.();
              }
            }, 12000)
          ),
        ]),
      ]);

      if (existing.isClosed || this.viewerSfuSessions.get(streamId) !== existing) {
        newPc.close();
        await this.deleteSfuSession(newViewerSessionId);
        return false;
      }

      const oldPc = existing.pc;
      const oldSfuSessionId = existing.sfuSessionId;
      const oldStream = existing.remoteStream;

      const updatedSession: ViewerSfuSession = {
        ...existing,
        sfuSessionId: newViewerSessionId,
        hostSfuSessionId,
        publishedTracks,
        pc: newPc,
        remoteStream,
        subscribedMids: assigned.map((a) => a.mid).filter(Boolean),
        isVideoOn,
        isMicOn,
      };
      this.viewerSfuSessions.set(streamId, updatedSession);

      this.monitorPeerConnection(sessionKey, newPc, {
        isSessionActive: () =>
          !updatedSession.isClosed && this.viewerSfuSessions.get(streamId) === updatedSession,
        onStateChange: updatedSession.onConnectionStateChange,
        onReconnectNeeded: () => this.reconnectViewerBroadcast(streamId),
      });

      oldPc.onconnectionstatechange = null;
      oldPc.oniceconnectionstatechange = null;
      try {
        oldPc.close();
      } catch {
        // ignore
      }
      oldStream.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {
          // ignore
        }
      });
      this.deleteSfuSession(oldSfuSessionId).catch(() => {});

      this.setBroadcastState(streamId, { isVideoOn, isMicOn });
      updatedSession.onStreamReconnected?.(remoteStream);
      updatedSession.onConnectionStateChange?.('connected');
      return true;
    } catch (err) {
      if (newPc) {
        try {
          newPc.close();
        } catch {
          // ignore
        }
      }
      if (newViewerSessionId) {
        await this.deleteSfuSession(newViewerSessionId);
      }
      console.warn('[Solo Live Viewer] SFU reconnect failed:', err);
      return false;
    }
  }

  private reconnectPartyVoice(roomId: string): Promise<boolean> {
    return this.enqueueSessionOp(`party-lifecycle:${roomId}`, () =>
      this._reconnectPartyVoiceInternal(roomId)
    );
  }

  private async _reconnectPartyVoiceInternal(roomId: string): Promise<boolean> {
    const existing = this.partySfuSessions.get(roomId);
    if (!existing || existing.isClosed) return false;

    console.info(`[Party SFU] Re-establishing Cloudflare SFU session for room ${roomId}...`);

    try {
      await this.getFirebaseIdToken(true);
      await this.fetchCloudflareTurnCredentials(true).catch(() => {});
    } catch {
      return false;
    }

    if (existing.isClosed || this.partySfuSessions.get(roomId) !== existing) return false;

    const userId = existing.userId;
    const wasPublishing = existing.isPublishing;
    const wasMuted = existing.isMuted;

    let newSubSessionId = '';
    let newSubPc: RTCPeerConnection | null = null;
    let newPubSessionId = '';
    let newPubPc: RTCPeerConnection | null = null;
    let newSession: PartySfuRoomSession | null = null;

    try {
      const subToken = await this.requestPartyRoomSessionToken(roomId, false);
      newSubSessionId = subToken.sfuSessionId;
      newSubPc = new RTCPeerConnection(this.getRtcConfiguration());

      newSession = {
        roomId,
        userId,
        profile: existing.profile,
        joinedAtMs: existing.joinedAtMs,
        subSfuSessionId: newSubSessionId,
        subPc: newSubPc,
        pubSfuSessionId: null,
        pubPc: null,
        localStream: null,
        localTrackName: null,
        localMid: null,
        isPublishing: false,
        isMuted: wasPublishing ? wasMuted : true,
        isSpeaking: false,
        isClosed: false,
        subConnectingSinceMs: Date.now(),
        pubConnectingSinceMs: Date.now(),
        reconcileFailCount: 0,
        unsubscribeParticipants: null,
        heartbeatTimer: null,
        reconcileRetryTimer: null,
        subscribedByPeerKey: new Map(),
        pendingMidToPeer: new Map(),
        latestDesiredPeers: new Map(),
        activeRemoteStreams: new Map(),
        onError: existing.onError,
        onConnectionStateChange: existing.onConnectionStateChange,
        onParticipantsChange: existing.onParticipantsChange,
      };

      this.attachPartyTrackHandlers(newSession, newSubPc);

      if (wasPublishing) {
        const pubToken = await this.requestPartyRoomSessionToken(roomId, true);
        newPubSessionId = pubToken.sfuSessionId;
        newPubPc = new RTCPeerConnection(this.getRtcConfiguration());

        const liveAudioTrack = existing.localStream
          ?.getAudioTracks()
          .find((t) => t.readyState === 'live');

        if (liveAudioTrack && existing.localStream) {
          liveAudioTrack.enabled = !wasMuted;
          const trackName = `party-${roomId}-${userId}-${Date.now().toString(36)}`;
          const published = await this.publishTracksOnSession(
            newPubSessionId,
            newPubPc,
            [{ track: liveAudioTrack, trackName }],
            existing.localStream
          );
          newSession.pubSfuSessionId = newPubSessionId;
          newSession.pubPc = newPubPc;
          newSession.localStream = existing.localStream;
          newSession.localTrackName = trackName;
          newSession.localMid = published[0]?.mid || null;
          newSession.isPublishing = true;
          newSession.isMuted = wasMuted;
          this.isMuted = wasMuted;
          await this.waitForPeerConnected(newPubPc, 15000);
          this.attachPartyPubMonitor(newSession, newPubPc);
        } else {
          newPubPc.close();
          await this.deleteSfuSession(newPubSessionId);
          newPubPc = null;
          newPubSessionId = '';
          await this.publishPartyLocalMic(newSession, wasMuted);
        }
      }

      if (existing.isClosed || this.partySfuSessions.get(roomId) !== existing) {
        if (newSession.localStream && newSession.localStream !== existing.localStream) {
          newSession.localStream.getTracks().forEach((t) => t.stop());
        }
        newSubPc.close();
        await this.deleteSfuSession(newSubSessionId);
        if (newSession.pubPc) {
          newSession.pubPc.close();
        }
        if (newSession.pubSfuSessionId) {
          await this.deleteSfuSession(newSession.pubSfuSessionId);
        }
        return false;
      }

      this.partySfuSessions.set(roomId, newSession);

      this.monitorPeerConnection(`party:${roomId}`, newSubPc, {
        isSessionActive: () =>
          !newSession!.isClosed && this.partySfuSessions.get(roomId) === newSession,
        onStateChange: (state) => {
          if (state === 'connecting') {
            newSession!.subConnectingSinceMs = Date.now();
          }
          newSession?.onConnectionStateChange?.(state);
        },
        onReconnectNeeded: () => this.reconnectPartyVoice(roomId),
      });

      await this.writePartyParticipantPresence(newSession);
      this.startPartyHeartbeat(newSession);
      this.attachPartyParticipantsListener(newSession);

      existing.isClosed = true;
      existing.subPc.onconnectionstatechange = null;
      existing.subPc.oniceconnectionstatechange = null;
      if (existing.pubPc) {
        existing.pubPc.onconnectionstatechange = null;
        existing.pubPc.oniceconnectionstatechange = null;
      }
      if (existing.heartbeatTimer) {
        clearInterval(existing.heartbeatTimer);
        existing.heartbeatTimer = null;
      }
      if (existing.reconcileRetryTimer) {
        clearTimeout(existing.reconcileRetryTimer);
        existing.reconcileRetryTimer = null;
      }
      if (existing.unsubscribeParticipants) {
        existing.unsubscribeParticipants();
        existing.unsubscribeParticipants = null;
      }
      if (existing.localStream && existing.localStream !== newSession.localStream) {
        existing.localStream.getTracks().forEach((t) => {
          try {
            t.stop();
          } catch {
            // ignore
          }
        });
      }
      try {
        existing.subPc.close();
      } catch {
        // ignore
      }
      if (existing.pubPc) {
        try {
          existing.pubPc.close();
        } catch {
          // ignore
        }
      }
      this.deleteSfuSession(existing.subSfuSessionId).catch(() => {});
      if (existing.pubSfuSessionId) {
        this.deleteSfuSession(existing.pubSfuSessionId).catch(() => {});
      }

      if (wasPublishing) {
        newSession.onConnectionStateChange?.('connected');
      } else {
        this.waitForPeerConnected(newSubPc, 15000)
          .then(() => {
            if (!newSession?.isClosed) newSession?.onConnectionStateChange?.('connected');
          })
          .catch(() => {});
      }
      return true;
    } catch (err) {
      if (newSession?.localStream && newSession.localStream !== existing.localStream) {
        newSession.localStream.getTracks().forEach((t) => {
          try {
            t.stop();
          } catch {
            // ignore
          }
        });
      }
      if (newSubPc) {
        try {
          newSubPc.close();
        } catch {
          // ignore
        }
      }
      if (newSubSessionId) {
        await this.deleteSfuSession(newSubSessionId);
      }
      if (newSession?.pubPc && newSession.pubPc !== newPubPc) {
        try {
          newSession.pubPc.close();
        } catch {
          // ignore
        }
      } else if (newPubPc) {
        try {
          newPubPc.close();
        } catch {
          // ignore
        }
      }
      if (newSession?.pubSfuSessionId && newSession.pubSfuSessionId !== newPubSessionId) {
        await this.deleteSfuSession(newSession.pubSfuSessionId);
      } else if (newPubSessionId) {
        await this.deleteSfuSession(newPubSessionId);
      }
      console.warn('[Party SFU] Reconnect failed:', err);
      return false;
    }
  }

  // =========================================================================
  // SOLO LIVE HOST PUBLISHING VIA CLOUDFLARE REALTIME SFU
  // =========================================================================

  public startSoloLiveHost(params: {
    streamId: string;
    hostId: string;
    facing?: 'user' | 'environment';
    isVideoOn?: boolean;
    isMicOn?: boolean;
    onConnectionStateChange?: (state: ConnectionState) => void;
    onReconnected?: (result: SoloLivePublishResult) => void;
    onPublishedEarly?: (result: SoloLivePublishResult) => void;
  }): Promise<SoloLivePublishResult> {
    return this.enqueueSessionOp(`host-lifecycle:${params.streamId}`, () =>
      this._startSoloLiveHostInternal(params)
    );
  }

  private async _startSoloLiveHostInternal(params: {
    streamId: string;
    hostId: string;
    facing?: 'user' | 'environment';
    isVideoOn?: boolean;
    isMicOn?: boolean;
    onConnectionStateChange?: (state: ConnectionState) => void;
    onReconnected?: (result: SoloLivePublishResult) => void;
    onPublishedEarly?: (result: SoloLivePublishResult) => void;
  }): Promise<SoloLivePublishResult> {
    const {
      streamId,
      hostId,
      facing = 'user',
      isVideoOn = true,
      isMicOn = true,
      onConnectionStateChange,
      onReconnected,
      onPublishedEarly,
    } = params;

    await this._stopHostBroadcastInternal(streamId);

    this.isVideoPaused = !isVideoOn;
    this.isMuted = !isMicOn;

    await this.getFirebaseIdToken();
    let stream: MediaStream | null = null;
    let sfuSessionId = '';
    let pc: RTCPeerConnection | null = null;

    try {
      const mediaAndConfig = await Promise.all([
        this.getLocalMediaStream(facing, true),
        this.ensureSfuBackendConfigured(),
        this.fetchCloudflareTurnCredentials().catch(() => [] as RTCIceServer[]),
      ]);
      stream = mediaAndConfig[0];
      const videoTrack = stream.getVideoTracks()[0];
      const audioTrack = stream.getAudioTracks()[0];
      if (!videoTrack && !audioTrack) {
        throw new Error('Camera and microphone tracks were not available.');
      }
      if (videoTrack) videoTrack.enabled = isVideoOn;
      if (audioTrack) audioTrack.enabled = isMicOn;

      let publishedTracks: SfuPublishedTrack[] = [];
      for (let publishAttempt = 0; publishAttempt < 2; publishAttempt++) {
        try {
          sfuSessionId = await this.createSfuSession();
          pc = new RTCPeerConnection(this.getRtcConfiguration());

          const suffix = `${Date.now().toString(36)}${publishAttempt > 0 ? 'r' : ''}`;
          const tracksToPublish: Array<{ track: MediaStreamTrack; trackName: string }> = [];
          if (videoTrack) tracksToPublish.push({ track: videoTrack, trackName: `${streamId}-video-${suffix}` });
          if (audioTrack) tracksToPublish.push({ track: audioTrack, trackName: `${streamId}-audio-${suffix}` });

          publishedTracks = await this.publishTracksOnSession(sfuSessionId, pc, tracksToPublish, stream);
          if (onPublishedEarly) {
            try {
              onPublishedEarly({ stream, sfuSessionId, publishedTracks });
            } catch {
              // ignore callback errors
            }
          }
          await this.waitForPeerConnected(pc, 15000);
          break;
        } catch (attemptErr: any) {
          if (pc) {
            try {
              pc.close();
            } catch {
              // ignore
            }
            pc = null;
          }
          if (sfuSessionId) {
            await this.deleteSfuSession(sfuSessionId);
            sfuSessionId = '';
          }
          const isTransientSfuFailure =
            attemptErr?.code === 'SFU_BACKEND_UNREACHABLE' ||
            this.isRetryableGatewayStatus(Number(attemptErr?.status || 0), attemptErr?.code);
          if (publishAttempt === 0 && isTransientSfuFailure) {
            await this.delayMs(400);
            continue;
          }
          throw attemptErr;
        }
      }

      if (!pc || !sfuSessionId) {
        throw new Error('Unable to establish Live SFU peer connection.');
      }

      const sessionObj: HostSfuSession = {
        streamId,
        hostId,
        sfuSessionId,
        pc,
        stream,
        publishedTracks,
        facing,
        isVideoOn,
        isMicOn,
        isClosed: false,
        onConnectionStateChange,
        onReconnected,
      };
      this.hostSfuSessions.set(streamId, sessionObj);
      this.monitorPeerConnection(`host:${streamId}`, pc, {
        isSessionActive: () =>
          !sessionObj.isClosed && this.hostSfuSessions.get(streamId) === sessionObj,
        onStateChange: onConnectionStateChange,
        onReconnectNeeded: () => this.reconnectHostBroadcast(streamId),
      });
      this.setBroadcastState(streamId, { isVideoOn, isMicOn });
      this.startLiveStreamHeartbeat(streamId);

      return {
        stream,
        sfuSessionId,
        publishedTracks,
      };
    } catch (err) {
      if (pc) {
        try {
          pc.close();
        } catch {
          // ignore
        }
      }
      if (sfuSessionId) {
        await this.deleteSfuSession(sfuSessionId);
      }
      if (stream) {
        stream.getTracks().forEach((t) => {
          try {
            t.stop();
          } catch {
            // ignore
          }
        });
        if (this.localStream === stream) {
          this.localStream = null;
        }
      }
      throw err;
    }
  }

  public startLiveStreamHeartbeat(streamId: string): void {
    if (!streamId) return;
    this.stopLiveStreamHeartbeat(streamId);

    const timer = setInterval(() => {
      const session = this.hostSfuSessions.get(streamId);
      if (!session || session.isClosed) {
        this.stopLiveStreamHeartbeat(streamId);
        return;
      }
      this.sendLiveStreamHeartbeat(streamId).catch(() => {});
    }, LIVE_HEARTBEAT_INTERVAL_MS);

    this.hostHeartbeatTimers.set(streamId, timer);
  }

  public stopLiveStreamHeartbeat(streamId: string): void {
    const timer = this.hostHeartbeatTimers.get(streamId);
    if (timer) {
      clearInterval(timer);
      this.hostHeartbeatTimers.delete(streamId);
    }
  }

  public async sendLiveStreamHeartbeat(streamId: string): Promise<void> {
    if (!streamId || !auth.currentUser) return;
    const session = this.hostSfuSessions.get(streamId);
    if (!session || session.isClosed) return;

    const nowMs = Date.now();
    try {
      await updateDoc(doc(db, 'liveStreams', streamId), {
        lastHeartbeat: serverTimestamp(),
        lastHeartbeatMs: nowMs,
        lastSeenAt: serverTimestamp(),
        lastSeenAtMs: nowMs,
        updatedAt: new Date(nowMs).toISOString(),
      });
    } catch (err: any) {
      if (err?.code === 'not-found') return;
      console.warn(`[WebRTC SFU] Live heartbeat update failed for ${streamId}:`, err);
    }
  }

  public setHostCameraState(streamId: string, isVideoOn: boolean): void {
    this.isVideoPaused = !isVideoOn;
    this.toggleVideo(isVideoOn);
    const hostSession = this.hostSfuSessions.get(streamId);
    if (hostSession) {
      hostSession.isVideoOn = isVideoOn;
      hostSession.stream.getVideoTracks().forEach((t) => (t.enabled = isVideoOn));
    }
    const prev = this.getBroadcastState(streamId);
    this.setBroadcastState(streamId, { isVideoOn, isMicOn: prev.isMicOn });
  }

  public setHostMicState(streamId: string, isMicOn: boolean): void {
    this.isMuted = !isMicOn;
    this.toggleMicrophone(isMicOn);
    const hostSession = this.hostSfuSessions.get(streamId);
    if (hostSession) {
      hostSession.isMicOn = isMicOn;
      hostSession.stream.getAudioTracks().forEach((t) => (t.enabled = isMicOn));
    }
    const prev = this.getBroadcastState(streamId);
    this.setBroadcastState(streamId, { isVideoOn: prev.isVideoOn, isMicOn });
  }

  public stopHostBroadcast(streamId: string, keepalive: boolean = false): Promise<void> {
    if (keepalive) {
      return this._stopHostBroadcastInternal(streamId, true);
    }
    return this.enqueueSessionOp(`host-lifecycle:${streamId}`, () =>
      this._stopHostBroadcastInternal(streamId, false)
    );
  }

  private async _stopHostBroadcastInternal(streamId: string, keepalive: boolean = false): Promise<void> {
    this.stopLiveStreamHeartbeat(streamId);
    this.clearReconnectState(`host:${streamId}`, true);
    const hostSession = this.hostSfuSessions.get(streamId);
    this.hostSfuSessions.delete(streamId);
    this.stopLocalMediaStream();

    if (hostSession) {
      hostSession.isClosed = true;
      hostSession.pc.onconnectionstatechange = null;
      hostSession.pc.oniceconnectionstatechange = null;
      try {
        hostSession.stream.getTracks().forEach((t) => t.stop());
      } catch {
        // ignore
      }
      try {
        hostSession.pc.close();
      } catch {
        // ignore
      }
      await this.deleteSfuSession(hostSession.sfuSessionId, keepalive);
    }
  }

  // =========================================================================
  // SOLO LIVE VIEWER SUBSCRIPTION VIA CLOUDFLARE REALTIME SFU
  // =========================================================================

  /**
   * Subscribe as a remote viewer via Cloudflare Realtime SFU.
   * NEVER captures local camera/mic. NEVER falls back to local host stream.
   * NEVER resolves with an empty placeholder MediaStream.
   */
  public async subscribeToRemoteBroadcast(
    streamId: string,
    _hostUser: User,
    options: {
      sfuSessionId: string;
      publishedTracks: SfuPublishedTrack[];
      isVideoOn?: boolean;
      isMicOn?: boolean;
      onConnectionStateChange?: (state: ConnectionState) => void;
      onStreamReconnected?: (stream: MediaStream) => void;
      onTrackAdded?: (track: MediaStreamTrack, stream: MediaStream) => void;
    },
    onStateUpdate?: (state: BroadcastState) => void
  ): Promise<{ stream: MediaStream; isVideoOn: boolean; isMicOn: boolean; viewerSessionId: string }> {
    this.stopLocalMediaStream();
    await this.unsubscribeFromRemoteBroadcast(streamId);

    if (onStateUpdate) {
      this.onBroadcastStateChange(streamId, onStateUpdate);
    }

    const hostSfuSessionId = options?.sfuSessionId;
    const publishedTracks = Array.isArray(options?.publishedTracks)
      ? options.publishedTracks.filter((t) => Boolean(t?.trackName))
      : [];

    if (!hostSfuSessionId || publishedTracks.length === 0) {
      throw new Error('This broadcast does not have an active Cloudflare SFU media stream.');
    }

    await this.getFirebaseIdToken();
    await Promise.all([
      this.ensureSfuBackendConfigured(),
      this.fetchCloudflareTurnCredentials().catch(() => [] as RTCIceServer[]),
    ]);

    const viewerSessionId = await this.createSfuSession();
    const pc = new RTCPeerConnection(this.getRtcConfiguration());
    const remoteStream = new MediaStream();

    let tracksReceived = 0;
    const expectedTrackCount = Math.min(2, publishedTracks.length);
    let resolveTrackWaiter: (() => void) | null = null;
    let firstTrackSettleTimer: ReturnType<typeof setTimeout> | null = null;
    const firstTrackPromise = new Promise<void>((resolve) => {
      resolveTrackWaiter = resolve;
    });

    pc.ontrack = (event) => {
      const track = event.track;
      if (!track) return;
      track.enabled = true;
      if (!remoteStream.getTracks().some((t) => t.id === track.id)) {
        remoteStream.addTrack(track);
      }
      tracksReceived += 1;
      options.onTrackAdded?.(track, remoteStream);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('alphamate-live-remote-track', {
            detail: { streamId, stream: remoteStream, track },
          })
        );
      }
      if (remoteStream.getTracks().length >= expectedTrackCount) {
        if (firstTrackSettleTimer) {
          clearTimeout(firstTrackSettleTimer);
          firstTrackSettleTimer = null;
        }
        resolveTrackWaiter?.();
      } else if (!firstTrackSettleTimer) {
        firstTrackSettleTimer = setTimeout(() => {
          firstTrackSettleTimer = null;
          resolveTrackWaiter?.();
        }, 1200);
      }
    };

    try {
      const assigned = await this.subscribeTracksOnSession(
        viewerSessionId,
        pc,
        publishedTracks.map((t) => ({
          publisherSessionId: hostSfuSessionId,
          trackName: t.trackName,
        })),
        { contextType: 'live', contextId: streamId }
      );

      await Promise.all([
        this.waitForPeerConnected(pc, 15000),
        Promise.race([
          firstTrackPromise,
          new Promise<void>((_, reject) =>
            setTimeout(() => {
              if (tracksReceived === 0) {
                reject(new Error('No live audio/video tracks arrived from Cloudflare SFU.'));
              } else {
                resolveTrackWaiter?.();
              }
            }, 12000)
          ),
        ]),
      ]);

      if (firstTrackSettleTimer) {
        clearTimeout(firstTrackSettleTimer);
        firstTrackSettleTimer = null;
      }

      if (remoteStream.getTracks().length === 0) {
        throw new Error('Remote media stream contained zero active tracks.');
      }

      const initialState: BroadcastState = {
        isVideoOn: options.isVideoOn !== false,
        isMicOn: options.isMicOn !== false,
      };
      const viewerSessionObj: ViewerSfuSession = {
        streamId,
        sfuSessionId: viewerSessionId,
        hostSfuSessionId,
        publishedTracks,
        pc,
        remoteStream,
        subscribedMids: assigned.map((a) => a.mid).filter(Boolean),
        isVideoOn: initialState.isVideoOn,
        isMicOn: initialState.isMicOn,
        isClosed: false,
        onConnectionStateChange: options.onConnectionStateChange,
        onStreamReconnected: options.onStreamReconnected,
      };
      this.viewerSfuSessions.set(streamId, viewerSessionObj);
      this.monitorPeerConnection(`viewer:${streamId}`, pc, {
        isSessionActive: () =>
          !viewerSessionObj.isClosed && this.viewerSfuSessions.get(streamId) === viewerSessionObj,
        onStateChange: options.onConnectionStateChange,
        onReconnectNeeded: () => this.reconnectViewerBroadcast(streamId),
      });

      this.setBroadcastState(streamId, initialState);

      return {
        stream: remoteStream,
        isVideoOn: initialState.isVideoOn,
        isMicOn: initialState.isMicOn,
        viewerSessionId,
      };
    } catch (err) {
      try {
        pc.close();
      } catch {
        // ignore
      }
      await this.deleteSfuSession(viewerSessionId);
      throw err;
    }
  }

  public async unsubscribeFromRemoteBroadcast(streamId: string, keepalive: boolean = false): Promise<void> {
    this.clearReconnectState(`viewer:${streamId}`, true);
    const session = this.viewerSfuSessions.get(streamId);
    this.viewerSfuSessions.delete(streamId);
    if (session) {
      session.isClosed = true;
      session.pc.onconnectionstatechange = null;
      session.pc.oniceconnectionstatechange = null;
      session.remoteStream.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {
          // ignore
        }
      });
      try {
        session.pc.close();
      } catch {
        // ignore
      }
      await this.deleteSfuSession(session.sfuSessionId, keepalive);
    }
    this.remoteStreams.delete(streamId);
  }

  // =========================================================================
  // BROADCAST STATE PUB/SUB HELPERS
  // =========================================================================

  public getBroadcastState(streamId: string): BroadcastState {
    return this.broadcastStates.get(streamId) || { isVideoOn: true, isMicOn: true };
  }

  public onBroadcastStateChange(streamId: string, listener: (state: BroadcastState) => void): () => void {
    if (!this.stateListeners.has(streamId)) {
      this.stateListeners.set(streamId, new Set());
    }
    this.stateListeners.get(streamId)!.add(listener);
    listener(this.getBroadcastState(streamId));

    return () => {
      const set = this.stateListeners.get(streamId);
      if (set) {
        set.delete(listener);
        if (set.size === 0) this.stateListeners.delete(streamId);
      }
    };
  }

  public setBroadcastState(streamId: string, state: BroadcastState): void {
    this.broadcastStates.set(streamId, state);
    const listeners = this.stateListeners.get(streamId);
    if (listeners) {
      listeners.forEach((fn) => {
        try {
          fn(state);
        } catch {
          // ignore
        }
      });
    }
  }

  // =========================================================================
  // PARTY ROOM VOICE VIA CLOUDFLARE REALTIME SFU
  // =========================================================================

  public hasActivePartySession(roomId: string): boolean {
    const s = this.partySfuSessions.get(roomId);
    return Boolean(
      s &&
        !s.isClosed &&
        s.subPc.connectionState !== 'closed' &&
        s.subPc.connectionState !== 'failed'
    );
  }

  public getActivePartyRemoteStreams(roomId: string): Array<{ peerId: string; stream: MediaStream }> {
    const session = this.partySfuSessions.get(roomId);
    if (!session || session.isClosed) return [];
    return Array.from(session.activeRemoteStreams.entries()).map(([peerId, stream]) => ({
      peerId,
      stream,
    }));
  }

  public async getPartyRemoteAudioActivity(roomId: string): Promise<Set<string>> {
    const speakingPeers = new Set<string>();
    const session = this.partySfuSessions.get(roomId);
    if (!session || session.isClosed || session.subPc.connectionState === 'closed') {
      return speakingPeers;
    }

    try {
      const receivers = session.subPc.getReceivers();
      for (const receiver of receivers) {
        if (!receiver.track || receiver.track.kind !== 'audio' || receiver.track.readyState !== 'live') {
          continue;
        }
        const transceiver = session.subPc.getTransceivers().find((t) => t.receiver === receiver);
        const mid = transceiver?.mid || '';
        const peerId = mid ? session.pendingMidToPeer.get(mid) : undefined;
        if (!peerId) continue;

        if (typeof (receiver as any).getSynchronizationSources === 'function') {
          const sources = (receiver as any).getSynchronizationSources() || [];
          const hasAudioLevel = sources.some((src: any) => typeof src?.audioLevel === 'number' && src.audioLevel > 0.015);
          if (hasAudioLevel) {
            speakingPeers.add(peerId);
            continue;
          }
        }

        const stats = await receiver.getStats().catch(() => null);
        stats?.forEach((report: any) => {
          if (report.type === 'inbound-rtp' && report.kind === 'audio') {
            const level = Number(report.audioLevel || 0);
            if (level > 0.015) {
              speakingPeers.add(peerId);
            }
          }
        });
      }
    } catch {
      // Ignore stats error when connection is transitioning
    }

    return speakingPeers;
  }

  public startPartyVoice(
    roomId: string,
    userId: string,
    isMuted: boolean = false,
    listenOnly: boolean = false,
    callbacks?: {
      profile?: PartyParticipantProfile;
      onError?: (err: Error) => void;
      onConnectionStateChange?: (state: ConnectionState) => void;
      onParticipantsChange?: (participants: PartyParticipantPresence[]) => void;
    }
  ): Promise<MediaStream | null> {
    if (callbacks) {
      this.partyRoomCallbacks.set(roomId, callbacks);
    }
    return this.enqueueSessionOp(`party-lifecycle:${roomId}`, () =>
      this._startPartyVoiceInternal(roomId, userId, isMuted, listenOnly, callbacks)
    );
  }

  private dispatchPartyRemoteStream(roomId: string, peerId: string, stream: MediaStream): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('alphamate-party-remote-stream', {
          detail: { roomId, peerId, stream },
        })
      );
    }
  }

  private resolvePeerIdForTrack(
    session: PartySfuRoomSession,
    pc: RTCPeerConnection,
    mid: string,
    receiver?: RTCRtpReceiver | null
  ): string | undefined {
    if (mid && session.pendingMidToPeer.has(mid)) {
      return session.pendingMidToPeer.get(mid);
    }
    if (receiver) {
      const transceiver = pc.getTransceivers().find((t) => t.receiver === receiver);
      if (transceiver?.mid && session.pendingMidToPeer.has(transceiver.mid)) {
        return session.pendingMidToPeer.get(transceiver.mid);
      }
    }
    // Fallback if only one subscribed remote speaker currently lacks an attached stream
    const unattachedSubs = Array.from(session.subscribedByPeerKey.values()).filter(
      (sub) => sub.stream.getTracks().length === 0
    );
    if (unattachedSubs.length === 1) {
      return unattachedSubs[0].peerId;
    }
    return undefined;
  }

  private ensureCanonicalRemoteAudioStream(
    session: PartySfuRoomSession,
    peerId: string,
    track: MediaStreamTrack,
    mid: string
  ): MediaStream | null {
    // Strictly block any self-loopback audio
    const currentUid = auth.currentUser?.uid;
    if (!peerId || peerId === session.userId || (currentUid && peerId === currentUid)) {
      return null;
    }

    track.enabled = true;
    const existingStream = session.activeRemoteStreams.get(peerId);
    if (existingStream) {
      const hasThisTrack = existingStream.getAudioTracks().some((t) => t.id === track.id);
      if (hasThisTrack) {
        for (const [, sub] of session.subscribedByPeerKey.entries()) {
          if (sub.peerId === peerId && (sub.mid === mid || !sub.mid)) {
            sub.mid = mid || sub.mid;
            sub.stream = existingStream;
          }
        }
        return existingStream;
      }
      existingStream.getAudioTracks().forEach((oldTrack) => {
        if (oldTrack.readyState === 'ended') {
          try {
            existingStream.removeTrack(oldTrack);
          } catch {
            // ignore
          }
        }
      });
      existingStream.addTrack(track);
      for (const [, sub] of session.subscribedByPeerKey.entries()) {
        if (sub.peerId === peerId && (sub.mid === mid || !sub.mid)) {
          sub.mid = mid || sub.mid;
          sub.stream = existingStream;
        }
      }
      this.dispatchPartyRemoteStream(session.roomId, peerId, existingStream);
      return existingStream;
    }

    const stream = new MediaStream([track]);
    session.activeRemoteStreams.set(peerId, stream);
    for (const [, sub] of session.subscribedByPeerKey.entries()) {
      if (sub.peerId === peerId && (sub.mid === mid || !sub.mid || sub.stream.getTracks().length === 0)) {
        sub.mid = mid || sub.mid;
        sub.stream = stream;
      }
    }
    this.dispatchPartyRemoteStream(session.roomId, peerId, stream);
    return stream;
  }

  private attachPartyTrackHandlers(session: PartySfuRoomSession, subPc: RTCPeerConnection): void {
    subPc.ontrack = (event) => {
      if (session.isClosed || !event.track) return;

      const resolvedMid =
        event.transceiver?.mid ||
        subPc.getTransceivers().find((t) => t.receiver === event.receiver)?.mid ||
        '';
      const peerId = this.resolvePeerIdForTrack(session, subPc, resolvedMid, event.receiver);
      if (!peerId) {
        console.warn('[Party SFU] Received track before mid->peer mapping was ready:', {
          roomId: session.roomId,
          mid: resolvedMid,
          kind: event.track.kind,
        });
        return;
      }

      this.ensureCanonicalRemoteAudioStream(session, peerId, event.track, resolvedMid);
      console.info('[Party SFU] Remote audio track attached:', {
        roomId: session.roomId,
        peerId,
        mid: resolvedMid,
        readyState: event.track.readyState,
        muted: event.track.muted,
        iceConnectionState: subPc.iceConnectionState,
      });

      event.track.onunmute = () => {
        if (session.isClosed) return;
        this.ensureCanonicalRemoteAudioStream(session, peerId, event.track, resolvedMid);
      };
    };
  }

  private attachPartyPubMonitor(session: PartySfuRoomSession, pubPc: RTCPeerConnection): void {
    this.monitorPeerConnection(`party-pub:${session.roomId}`, pubPc, {
      isSessionActive: () =>
        !session.isClosed &&
        this.partySfuSessions.get(session.roomId) === session &&
        session.pubPc === pubPc,
      onStateChange: (state) => {
        if (state === 'connecting') {
          session.pubConnectingSinceMs = Date.now();
        }
        if (state === 'connected') {
          session.onConnectionStateChange?.('connected');
        } else if (state === 'disconnected' || state === 'failed') {
          session.onConnectionStateChange?.(state);
        }
      },
      onReconnectNeeded: () => this.reconnectPartyPublisher(session.roomId),
    });
  }

  private reconnectPartyPublisher(roomId: string): Promise<boolean> {
    return this.enqueueSessionOp(`party-lifecycle:${roomId}`, async () => {
      const session = this.partySfuSessions.get(roomId);
      if (!session || session.isClosed || !session.isPublishing) return false;
      try {
        await this.getFirebaseIdToken(true);
        await this.fetchCloudflareTurnCredentials(true).catch(() => {});
        await this.publishPartyLocalMic(session, session.isMuted);
        await this.writePartyParticipantPresence(session);
        return true;
      } catch (err) {
        console.warn('[Party SFU] Publisher reconnect failed:', err);
        return false;
      }
    });
  }

  private startPartyHeartbeat(session: PartySfuRoomSession): void {
    if (session.heartbeatTimer) {
      clearInterval(session.heartbeatTimer);
    }
    session.heartbeatTimer = setInterval(() => {
      if (session.isClosed) return;
      this.writePartyParticipantPresence(session).catch(() => {});

      // Periodically ensure no subscribed remote speakers were missed after transient errors
      if (session.latestDesiredPeers.size > 0) {
        const hasPendingOrMissing = Array.from(session.latestDesiredPeers.keys()).some(
          (k) => !session.subscribedByPeerKey.has(k)
        );
        if (hasPendingOrMissing) {
          this.reconcilePartySubscriptions(session).catch(() => {});
        }
      }

      // Recover stalled subscriber WebRTC connections
      const hasSubIntent = session.subscribedByPeerKey.size > 0;
      if (
        hasSubIntent &&
        (session.subPc.connectionState === 'failed' ||
          session.subPc.iceConnectionState === 'failed' ||
          (session.subPc.connectionState === 'connecting' &&
            Date.now() - session.subConnectingSinceMs > 18_000))
      ) {
        session.subConnectingSinceMs = Date.now();
        this.reconnectPartyVoice(session.roomId).catch(() => {});
      }

      // Recover stalled publisher WebRTC connections independently
      if (
        session.isPublishing &&
        session.pubPc &&
        (session.pubPc.connectionState === 'failed' ||
          session.pubPc.iceConnectionState === 'failed' ||
          (session.pubPc.connectionState === 'connecting' &&
            Date.now() - session.pubConnectingSinceMs > 18_000))
      ) {
        session.pubConnectingSinceMs = Date.now();
        this.reconnectPartyPublisher(session.roomId).catch(() => {});
      }
    }, PARTY_HEARTBEAT_INTERVAL_MS);
  }

  private attachPartyParticipantsListener(session: PartySfuRoomSession): void {
    if (session.unsubscribeParticipants) {
      session.unsubscribeParticipants();
      session.unsubscribeParticipants = null;
    }

    const participantsRef = collection(db, 'partyRooms', session.roomId, 'voiceParticipants');
    const unsubSnapshot = onSnapshot(
      participantsRef,
      (snapshot) => {
        if (session.isClosed) return;
        const desiredPeers = new Map<string, DesiredPartyPeer>();
        const activeParticipantsByUid = new Map<string, PartyParticipantPresence>();
        const now = Date.now();
        const currentUid = auth.currentUser?.uid;

        snapshot.docs.forEach((docSnap) => {
          const peerId = docSnap.id;
          const data = docSnap.data() as any;
          const lastSeenMs =
            typeof data?.lastSeenAt?.toMillis === 'function'
              ? data.lastSeenAt.toMillis()
              : typeof data?.lastSeenAtMs === 'number'
                ? data.lastSeenAtMs
                : now;

          const isFresh = now - lastSeenMs <= PARTY_PARTICIPANT_STALE_MS;
          if (!isFresh && peerId !== session.userId) {
            return;
          }

          activeParticipantsByUid.set(peerId, {
            userId: peerId,
            uniqueId: String(data?.uniqueId || peerId),
            displayName: String(data?.displayName || 'Guest'),
            avatar: String(data?.avatar || ''),
            level: Number(data?.level) || 1,
            vipTier: Number(data?.vipTier) || 0,
            countryFlag: data?.countryFlag ? String(data.countryFlag) : undefined,
            isHost: Boolean(data?.isHost),
            joinedAtMs: Number(data?.joinedAtMs) || lastSeenMs,
            sfuSessionId: String(data?.sfuSessionId || ''),
            trackName: typeof data?.trackName === 'string' ? data.trackName : null,
            mid: typeof data?.mid === 'string' ? data.mid : null,
            isPublishing: Boolean(data?.isPublishing),
            listenOnly: Boolean(data?.listenOnly),
            isMuted: data?.isMuted !== false,
            isSpeaking: Boolean(data?.isSpeaking) && data?.isMuted === false,
            lastSeenAtMs: lastSeenMs,
          });

          if (peerId === session.userId || (currentUid && peerId === currentUid)) return; // Never subscribe to own track
          if (
            data?.isPublishing === true &&
            !data?.listenOnly &&
            typeof data?.sfuSessionId === 'string' &&
            data.sfuSessionId &&
            data.sfuSessionId !== session.pubSfuSessionId &&
            data.sfuSessionId !== session.subSfuSessionId &&
            typeof data?.trackName === 'string' &&
            data.trackName
          ) {
            const peerKey = `${peerId}::${data.sfuSessionId}::${data.trackName}`;
            desiredPeers.set(peerKey, {
              peerId,
              publisherSessionId: data.sfuSessionId,
              trackName: data.trackName,
            });
          }
        });

        session.latestDesiredPeers = desiredPeers;
        session.onParticipantsChange?.(Array.from(activeParticipantsByUid.values()));

        this.reconcilePartySubscriptions(session).catch((err: any) => {
          console.warn('[Party SFU] Subscription reconciliation error:', err);
          if (err?.status === 403 || session.reconcileFailCount >= 2) {
            session.onError?.(err instanceof Error ? err : new Error(String(err)));
          }
        });
      },
      (error) => {
        console.error('[Party SFU] Participants listener error:', error);
        session.onError?.(error);
      }
    );

    const unsubSignal = realtimeSocket.onRoomEvent('party', session.roomId, (event) => {
      if (session.isClosed) return;
      if (event.type === 'room:signal' && event.signal?.type === 'voice_updated') {
        const { peerId, sfuSessionId, trackName, isPublishing } = event.signal;
        if (peerId && peerId !== session.userId && peerId !== auth.currentUser?.uid) {
          if (isPublishing && sfuSessionId && trackName) {
            const peerKey = `${peerId}::${sfuSessionId}::${trackName}`;
            if (!session.latestDesiredPeers.has(peerKey)) {
              session.latestDesiredPeers.set(peerKey, {
                peerId,
                publisherSessionId: sfuSessionId,
                trackName,
              });
            }
          }
          this.reconcilePartySubscriptions(session).catch(() => {});
        }
      }
    });

    session.unsubscribeParticipants = () => {
      unsubSnapshot();
      unsubSignal();
    };
  }

  private async _startPartyVoiceInternal(
    roomId: string,
    userId: string,
    isMuted: boolean = false,
    listenOnly: boolean = false,
    callbacks?: {
      profile?: PartyParticipantProfile;
      onError?: (err: Error) => void;
      onConnectionStateChange?: (state: ConnectionState) => void;
      onParticipantsChange?: (participants: PartyParticipantPresence[]) => void;
    }
  ): Promise<MediaStream | null> {
    const resolvedCallbacks = callbacks || this.partyRoomCallbacks.get(roomId);
    const existing = this.partySfuSessions.get(roomId);
    if (
      existing &&
      !existing.isClosed &&
      existing.userId === userId &&
      existing.subPc.connectionState !== 'closed' &&
      existing.subPc.connectionState !== 'failed'
    ) {
      if (resolvedCallbacks?.profile) {
        existing.profile = { ...existing.profile, ...resolvedCallbacks.profile };
      }
      if (resolvedCallbacks?.onError) existing.onError = resolvedCallbacks.onError;
      if (resolvedCallbacks?.onConnectionStateChange) {
        existing.onConnectionStateChange = resolvedCallbacks.onConnectionStateChange;
      }
      if (resolvedCallbacks?.onParticipantsChange) {
        existing.onParticipantsChange = resolvedCallbacks.onParticipantsChange;
      }
      return this._setPartySpeakingModeInternal(roomId, userId, !listenOnly, isMuted);
    }

    await this._stopPartyVoiceInternal(roomId, false, false);
    await this.getFirebaseIdToken();
    await Promise.all([
      this.ensureSfuBackendConfigured(),
      this.fetchCloudflareTurnCredentials().catch(() => [] as RTCIceServer[]),
    ]);

    const subToken = await this.requestPartyRoomSessionToken(roomId, false);
    const subSfuSessionId = subToken.sfuSessionId;
    const subPc = new RTCPeerConnection(this.getRtcConfiguration());

    const session: PartySfuRoomSession = {
      roomId,
      userId,
      profile: resolvedCallbacks?.profile || {},
      joinedAtMs: Date.now(),
      subSfuSessionId,
      subPc,
      pubSfuSessionId: null,
      pubPc: null,
      localStream: null,
      localTrackName: null,
      localMid: null,
      isPublishing: false,
      isMuted: listenOnly ? true : isMuted,
      isSpeaking: false,
      isClosed: false,
      subConnectingSinceMs: Date.now(),
      pubConnectingSinceMs: Date.now(),
      reconcileFailCount: 0,
      unsubscribeParticipants: null,
      heartbeatTimer: null,
      reconcileRetryTimer: null,
      subscribedByPeerKey: new Map(),
      pendingMidToPeer: new Map(),
      latestDesiredPeers: new Map(),
      activeRemoteStreams: new Map(),
      onError: resolvedCallbacks?.onError,
      onConnectionStateChange: resolvedCallbacks?.onConnectionStateChange,
      onParticipantsChange: resolvedCallbacks?.onParticipantsChange,
    };
    this.partySfuSessions.set(roomId, session);

    this.attachPartyTrackHandlers(session, subPc);

    this.monitorPeerConnection(`party:${roomId}`, subPc, {
      isSessionActive: () =>
        !session.isClosed && this.partySfuSessions.get(roomId) === session,
      onStateChange: (state) => {
        if (state === 'connecting') {
          session.subConnectingSinceMs = Date.now();
        }
        session.onConnectionStateChange?.(state);
      },
      onReconnectNeeded: () => this.reconnectPartyVoice(roomId),
    });

    try {
      if (!listenOnly) {
        await this.publishPartyLocalMic(session, isMuted);
      }

      await this.writePartyParticipantPresence(session);
      this.startPartyHeartbeat(session);
      this.attachPartyParticipantsListener(session);

      return session.localStream;
    } catch (err) {
      await this._stopPartyVoiceInternal(roomId, false, false);
      throw err;
    }
  }

  public updatePartySpeakingIndicator(roomId: string, isSpeaking: boolean): void {
    const session = this.partySfuSessions.get(roomId);
    if (!session || session.isClosed) return;
    const effectiveSpeaking = Boolean(isSpeaking && session.isPublishing && !session.isMuted);
    if (session.isSpeaking === effectiveSpeaking) return;
    session.isSpeaking = effectiveSpeaking;

    const uid = auth.currentUser?.uid || session.userId;
    if (!uid) return;
    updateDoc(doc(db, 'partyRooms', roomId, 'voiceParticipants', uid), {
      isSpeaking: effectiveSpeaking,
      lastSeenAt: serverTimestamp(),
      lastSeenAtMs: Date.now(),
    }).catch(() => {});
  }

  public setPartySpeakingMode(
    roomId: string,
    userId: string,
    canSpeak: boolean,
    isMuted: boolean,
    profile?: PartyParticipantProfile
  ): Promise<MediaStream | null> {
    if (profile) {
      const prev = this.partyRoomCallbacks.get(roomId) || {};
      this.partyRoomCallbacks.set(roomId, { ...prev, profile });
    }
    return this.enqueueSessionOp(`party-lifecycle:${roomId}`, () =>
      this._setPartySpeakingModeInternal(roomId, userId, canSpeak, isMuted, profile)
    );
  }

  private async _setPartySpeakingModeInternal(
    roomId: string,
    userId: string,
    canSpeak: boolean,
    isMuted: boolean,
    profile?: PartyParticipantProfile
  ): Promise<MediaStream | null> {
    const session = this.partySfuSessions.get(roomId);
    if (!session || session.isClosed || session.userId !== userId) {
      const savedCallbacks = this.partyRoomCallbacks.get(roomId) || {};
      return this._startPartyVoiceInternal(roomId, userId, isMuted, !canSpeak, {
        ...savedCallbacks,
        ...(profile ? { profile } : {}),
      });
    }

    if (profile) {
      session.profile = { ...session.profile, ...profile };
    }

    if (canSpeak && !session.isPublishing) {
      await this.publishPartyLocalMic(session, isMuted);
      await this.writePartyParticipantPresence(session);
      return session.localStream;
    }

    if (!canSpeak && session.isPublishing) {
      session.isSpeaking = false;
      await this.unpublishPartyLocalMic(session);
      await this.writePartyParticipantPresence(session);
      return null;
    }

    if (canSpeak && session.isPublishing) {
      const hasLiveTrack = Boolean(
        session.localStream?.getAudioTracks().some((t) => t.readyState === 'live')
      );
      if (!hasLiveTrack && session.pubPc) {
        // Re-acquire hardware mic seamlessly if OS/Android reclaimed it
        try {
          const newStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
              channelCount: 1,
            },
            video: false,
          });
          const newTrack = newStream.getAudioTracks()[0];
          if (newTrack) {
            newTrack.enabled = !isMuted;
            const audioSender = session.pubPc
              .getSenders()
              .find((s) => s.track?.kind === 'audio' || !s.track);
            if (audioSender) {
              await audioSender.replaceTrack(newTrack);
            }
            session.localStream?.getTracks().forEach((t) => {
              try {
                t.stop();
              } catch {
                // ignore
              }
            });
            session.localStream = newStream;
            this.initAudioAnalyser(newStream);
          }
        } catch (err) {
          console.warn('[Party SFU] Failed to re-acquire ended mic track:', err);
        }
      }

      this.isMuted = isMuted;
      session.isMuted = isMuted;
      if (isMuted) session.isSpeaking = false;
      session.localStream?.getAudioTracks().forEach((t) => {
        t.enabled = !isMuted;
      });
      session.pubPc?.getSenders().forEach((sender) => {
        if (sender.track?.kind === 'audio') {
          sender.track.enabled = !isMuted;
        }
      });
      await this.writePartyParticipantPresence(session);
    }

    return session.localStream;
  }

  private async cleanupPartyPublisher(session: PartySfuRoomSession, keepalive: boolean = false): Promise<void> {
    this.clearReconnectState(`party-pub:${session.roomId}`, true);
    const oldPubPc = session.pubPc;
    const oldPubSessionId = session.pubSfuSessionId;
    session.pubPc = null;
    session.pubSfuSessionId = null;

    if (oldPubPc) {
      oldPubPc.onconnectionstatechange = null;
      oldPubPc.oniceconnectionstatechange = null;
      try {
        oldPubPc.close();
      } catch {
        // ignore
      }
    }
    if (oldPubSessionId) {
      await this.deleteSfuSession(oldPubSessionId, keepalive);
    }
  }

  private async publishPartyLocalMic(session: PartySfuRoomSession, isMuted: boolean): Promise<void> {
    await this.cleanupPartyPublisher(session);

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
      },
      video: false,
    });
    stream.getAudioTracks().forEach((t) => {
      t.enabled = !isMuted;
    });

    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) {
      stream.getTracks().forEach((t) => t.stop());
      throw new Error('Microphone track unavailable.');
    }

    let pubSfuSessionId = '';
    let pubPc: RTCPeerConnection | null = null;
    const trackName = `party-${session.roomId}-${session.userId}-${Date.now().toString(36)}`;

    try {
      const pubToken = await this.requestPartyRoomSessionToken(session.roomId, true);
      pubSfuSessionId = pubToken.sfuSessionId;
      pubPc = new RTCPeerConnection(this.getRtcConfiguration());

      session.pubConnectingSinceMs = Date.now();
      const published = await this.publishTracksOnSession(
        pubSfuSessionId,
        pubPc,
        [{ track: audioTrack, trackName }],
        stream
      );

      session.pubSfuSessionId = pubSfuSessionId;
      session.pubPc = pubPc;
      session.localStream = stream;
      session.localTrackName = trackName;
      session.localMid = published[0]?.mid || null;
      session.isPublishing = true;
      session.isMuted = isMuted;
      session.isSpeaking = false;
      this.isMuted = isMuted;
      this.initAudioAnalyser(stream);

      this.attachPartyPubMonitor(session, pubPc);

      // Broadcast via WebSocket immediately AND write Firestore presence so remote peers pull track in <50ms
      realtimeSocket.sendRoomSignal('party', session.roomId, {
        type: 'voice_updated',
        peerId: session.userId,
        sfuSessionId: pubSfuSessionId,
        trackName,
        isPublishing: true,
      });
      await this.writePartyParticipantPresence(session);
      await this.waitForPeerConnected(pubPc, 15000);

      console.info('[Party SFU] Local mic published & ICE connected to Cloudflare SFU:', {
        roomId: session.roomId,
        pubSfuSessionId,
        trackName,
        mid: session.localMid,
        muted: isMuted,
        readyState: audioTrack.readyState,
        iceConnectionState: pubPc.iceConnectionState,
      });
    } catch (err) {
      stream.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {
          // ignore
        }
      });
      if (session.localStream === stream) {
        session.localStream = null;
      }
      session.localTrackName = null;
      session.localMid = null;
      session.isPublishing = false;
      this.stopAudioAnalyser();
      if (pubPc) {
        pubPc.onconnectionstatechange = null;
        pubPc.oniceconnectionstatechange = null;
        try {
          pubPc.close();
        } catch {
          // ignore
        }
      }
      if (session.pubPc === pubPc) {
        session.pubPc = null;
      }
      if (pubSfuSessionId) {
        await this.deleteSfuSession(pubSfuSessionId);
      }
      if (session.pubSfuSessionId === pubSfuSessionId) {
        session.pubSfuSessionId = null;
      }
      throw err;
    }
  }

  private async unpublishPartyLocalMic(session: PartySfuRoomSession): Promise<void> {
    if (session.localStream) {
      session.localStream.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {
          // ignore
        }
      });
    }
    session.localStream = null;
    session.localTrackName = null;
    session.localMid = null;
    session.isPublishing = false;
    session.isMuted = true;
    session.isSpeaking = false;
    this.stopAudioAnalyser();

    await this.cleanupPartyPublisher(session);
  }

  private async writePartyParticipantPresence(session: PartySfuRoomSession): Promise<void> {
    if (session.isClosed) return;
    const uid = auth.currentUser?.uid || session.userId;
    if (!uid) return;
    const profile = session.profile || {};
    const activeSfuSessionId =
      session.isPublishing && session.pubSfuSessionId
        ? session.pubSfuSessionId
        : session.subSfuSessionId;
    const payload: Record<string, any> = {
      userId: uid,
      uniqueId: profile.uniqueId || uid,
      displayName: profile.displayName || 'Alpha User',
      avatar: profile.avatar || '',
      level: Number(profile.level) || 1,
      vipTier: Number(profile.vipTier) || 0,
      ...(profile.countryFlag ? { countryFlag: profile.countryFlag } : {}),
      isHost: Boolean(profile.isHost),
      joinedAtMs: session.joinedAtMs,
      sfuSessionId: activeSfuSessionId,
      trackName: session.isPublishing ? session.localTrackName : null,
      mid: session.isPublishing ? session.localMid : null,
      isPublishing: session.isPublishing,
      listenOnly: !session.isPublishing,
      isMuted: session.isPublishing ? session.isMuted : true,
      isSpeaking: session.isPublishing && !session.isMuted ? session.isSpeaking : false,
      lastSeenAt: serverTimestamp(),
      lastSeenAtMs: Date.now(),
    };
    await setDoc(doc(db, 'partyRooms', session.roomId, 'voiceParticipants', uid), payload, {
      merge: true,
    });
  }

  private reconcilePartySubscriptions(session: PartySfuRoomSession): Promise<void> {
    return this.enqueueSessionOp(`party-reconcile:${session.subSfuSessionId}`, async () => {
      if (session.isClosed || session.subPc.signalingState === 'closed') return;
      const desiredPeers = session.latestDesiredPeers;

      // 1. Close tracks that left or stopped publishing
      const removedKeys: string[] = [];
      const midsToClose: string[] = [];
      const activePeersAfterCleanup = new Set<string>();

      for (const [, info] of desiredPeers.entries()) {
        activePeersAfterCleanup.add(info.peerId);
      }

      for (const [peerKey, existing] of session.subscribedByPeerKey.entries()) {
        if (!desiredPeers.has(peerKey)) {
          removedKeys.push(peerKey);
          if (existing.mid) {
            midsToClose.push(existing.mid);
            session.pendingMidToPeer.delete(existing.mid);
          }
          if (!activePeersAfterCleanup.has(existing.peerId)) {
            session.activeRemoteStreams.delete(existing.peerId);
            if (typeof window !== 'undefined') {
              window.dispatchEvent(
                new CustomEvent('alphamate-party-remote-stream-removed', {
                  detail: { roomId: session.roomId, peerId: existing.peerId },
                })
              );
            }
          }
        }
      }
      removedKeys.forEach((k) => session.subscribedByPeerKey.delete(k));
      if (midsToClose.length > 0) {
        await this.closeTracksOnSession(session.subSfuSessionId, session.subPc, midsToClose, false);
      }

      // 2. Subscribe to newly added remote speaker tracks
      const toSubscribe: Array<DesiredPartyPeer & { peerKey: string }> = [];
      for (const [peerKey, info] of desiredPeers.entries()) {
        if (!session.subscribedByPeerKey.has(peerKey)) {
          toSubscribe.push({ peerKey, ...info });
        }
      }
      if (toSubscribe.length === 0) {
        session.reconcileFailCount = 0;
        return;
      }

      session.subConnectingSinceMs = Date.now();

      try {
        const assigned = await this.subscribeTracksOnSession(
          session.subSfuSessionId,
          session.subPc,
          toSubscribe.map((item) => ({
            publisherSessionId: item.publisherSessionId,
            trackName: item.trackName,
            peerId: item.peerId,
          })),
          {
            contextType: 'party',
            contextId: session.roomId,
            speakerPeerIds: Array.from(new Set(toSubscribe.map((i) => i.peerId))),
          },
          (mappedTracks) => {
            for (const mt of mappedTracks) {
              if (mt.mid && mt.peerId) {
                session.pendingMidToPeer.set(mt.mid, mt.peerId);
              }
            }
          }
        );

        toSubscribe.forEach((item, idx) => {
          const matched =
            assigned.find((a) => a.trackName === item.trackName && a.publisherSessionId === item.publisherSessionId) ||
            assigned[idx];
          const mid = matched?.mid || '';
          if (mid) {
            session.pendingMidToPeer.set(mid, item.peerId);
          }
          const existingCanonical = session.activeRemoteStreams.get(item.peerId);
          session.subscribedByPeerKey.set(item.peerKey, {
            peerId: item.peerId,
            publisherSessionId: item.publisherSessionId,
            trackName: item.trackName,
            mid,
            stream: existingCanonical || new MediaStream(),
          });
        });

        // Attach tracks immediately from WebRTC receivers if not already mapped via ontrack
        session.subPc.getReceivers().forEach((receiver) => {
          const transceiver = session.subPc.getTransceivers().find((t) => t.receiver === receiver);
          const mid = transceiver?.mid;
          if (!mid || !receiver.track || receiver.track.readyState !== 'live') return;
          const peerId = session.pendingMidToPeer.get(mid);
          if (!peerId) return;
          this.ensureCanonicalRemoteAudioStream(session, peerId, receiver.track, mid);
        });

        session.reconcileFailCount = 0;
        this.waitForPeerConnected(session.subPc, 15000)
          .then(() => {
            if (!session.isClosed) {
              session.onConnectionStateChange?.('connected');
            }
          })
          .catch((iceErr) => {
            console.warn('[Party SFU] Subscriber ICE confirmation failed:', iceErr?.message || iceErr);
          });
      } catch (err) {
        session.reconcileFailCount += 1;
        if (!session.isClosed && !session.reconcileRetryTimer) {
          session.reconcileRetryTimer = setTimeout(() => {
            session.reconcileRetryTimer = null;
            if (!session.isClosed) {
              this.reconcilePartySubscriptions(session).catch(() => {});
            }
          }, 2200);
        }
        throw err;
      }
    });
  }

  public stopPartyVoice(roomId: string, keepalive: boolean = false): Promise<void> {
    if (keepalive) {
      return this._stopPartyVoiceInternal(roomId, true, true);
    }
    return this.enqueueSessionOp(`party-lifecycle:${roomId}`, () =>
      this._stopPartyVoiceInternal(roomId, false, true)
    );
  }

  private async _stopPartyVoiceInternal(
    roomId: string,
    keepalive: boolean = false,
    clearCallbacks: boolean = true
  ): Promise<void> {
    this.clearReconnectState(`party:${roomId}`, true);
    this.clearReconnectState(`party-pub:${roomId}`, true);
    if (clearCallbacks) {
      this.partyRoomCallbacks.delete(roomId);
    }
    const session = this.partySfuSessions.get(roomId);
    this.partySfuSessions.delete(roomId);

    if (session) {
      session.isClosed = true;
      session.subPc.onconnectionstatechange = null;
      session.subPc.oniceconnectionstatechange = null;
      if (session.pubPc) {
        session.pubPc.onconnectionstatechange = null;
        session.pubPc.oniceconnectionstatechange = null;
      }
      if (session.heartbeatTimer) {
        clearInterval(session.heartbeatTimer);
        session.heartbeatTimer = null;
      }
      if (session.reconcileRetryTimer) {
        clearTimeout(session.reconcileRetryTimer);
        session.reconcileRetryTimer = null;
      }
      if (session.unsubscribeParticipants) {
        session.unsubscribeParticipants();
        session.unsubscribeParticipants = null;
      }
      session.activeRemoteStreams.clear();
      if (session.localStream) {
        session.localStream.getTracks().forEach((t) => {
          try {
            t.stop();
          } catch {
            // ignore
          }
        });
      }
      this.stopAudioAnalyser();
      try {
        session.subPc.close();
      } catch {
        // ignore
      }
      if (session.pubPc) {
        try {
          session.pubPc.close();
        } catch {
          // ignore
        }
      }
      await Promise.all([
        this.deleteSfuSession(session.subSfuSessionId, keepalive),
        session.pubSfuSessionId ? this.deleteSfuSession(session.pubSfuSessionId, keepalive) : Promise.resolve(),
      ]);
    }

    const uid = auth.currentUser?.uid;
    if (uid) {
      await deleteDoc(doc(db, 'partyRooms', roomId, 'voiceParticipants', uid)).catch(() => {});
    }
  }

  // =========================================================================
  // AUDIO ANALYSIS (REAL VOICE DETECTION VIA WEBAUDIO ANALYSER)
  // =========================================================================

  private initAudioAnalyser(stream: MediaStream): void {
    this.stopAudioAnalyser();
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      this.audioContext = new AudioCtx();
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume().catch(() => {});
      }

      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.4;
      source.connect(this.analyser);
    } catch {
      // AudioContext may require user gesture on mobile
    }
  }

  private stopAudioAnalyser(): void {
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        this.audioContext.close().catch(() => {});
      } catch {
        // ignore
      }
    }
    this.audioContext = null;
    this.analyser = null;
  }

  public getSpeakingVolume(): number {
    if (!this.analyser || this.isMuted) return 0;
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    const average = sum / dataArray.length;
    return Math.min(100, Math.round((average / 128) * 100));
  }

  public closePeerConnection(peerId: string): void {
    const pc = this.peerConnections.get(peerId);
    if (pc) {
      try {
        pc.close();
      } catch {
        // ignore
      }
      this.peerConnections.delete(peerId);
    }
    this.remoteStreams.delete(peerId);
  }
}

export const p2pStreamingEngine = new RealtimeSfuStreamingEngine();
export const realtimeSfuEngine = p2pStreamingEngine;
