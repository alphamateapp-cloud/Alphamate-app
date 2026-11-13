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
  setDoc,
  updateDoc,
  onSnapshot,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from './firebase';
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
  isVideoOn: boolean;
  isMicOn: boolean;
}

interface ViewerSfuSession {
  streamId: string;
  sfuSessionId: string;
  pc: RTCPeerConnection;
  remoteStream: MediaStream;
  subscribedMids: string[];
}

interface PartySubscribedTrack {
  peerId: string;
  publisherSessionId: string;
  trackName: string;
  mid: string;
  stream: MediaStream;
}

interface PartySfuRoomSession {
  roomId: string;
  userId: string;
  sfuSessionId: string;
  pc: RTCPeerConnection;
  localStream: MediaStream | null;
  localTrackName: string | null;
  localMid: string | null;
  isPublishing: boolean;
  isMuted: boolean;
  unsubscribeParticipants: (() => void) | null;
  heartbeatTimer: ReturnType<typeof setInterval> | null;
  subscribedByPeerKey: Map<string, PartySubscribedTrack>;
  pendingMidToPeer: Map<string, string>;
  onError?: (err: Error) => void;
  onConnectionStateChange?: (state: ConnectionState) => void;
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

const PARTY_PARTICIPANT_STALE_MS = 55_000;

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
  private sessionQueues: Map<string, Promise<unknown>> = new Map();

  // TURN & ICE state
  private customIceServers: RTCIceServer[] = [...DEFAULT_ICE_SERVERS];
  private cachedTurnServers: RTCIceServer[] = [];
  private turnExpiresAt: number = 0;
  private hasCloudflareTurn: boolean = false;

  constructor() {
    this.fetchCloudflareTurnCredentials().catch(() => {});
  }

  private getBackendApiBase(): string {
    const envUrl = ((import.meta as any).env?.VITE_RAILWAY_API_URL || '').trim();
    if (envUrl && !envUrl.includes('YOUR-RAILWAY-DOMAIN')) {
      return envUrl.replace(/\/$/, '');
    }
    if (
      typeof window !== 'undefined' &&
      (window.location.protocol === 'http:' || window.location.protocol === 'https:')
    ) {
      return '';
    }
    throw new Error('VITE_RAILWAY_API_URL is not configured for backend SFU/TURN requests.');
  }

  private async getFirebaseIdToken(forceRefresh: boolean = false): Promise<string> {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('Please sign in with your account before starting live video or party voice.');
    }
    return user.getIdToken(forceRefresh);
  }

  private async sfuFetch<T = any>(
    path: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    body?: any,
    keepalive: boolean = false
  ): Promise<T> {
    const base = this.getBackendApiBase();
    const url = `${base}${path}`;

    const exec = async (forceTokenRefresh: boolean) => {
      const idToken = await this.getFirebaseIdToken(forceTokenRefresh);
      const headers: Record<string, string> = {
        Authorization: `Bearer ${idToken}`,
        Accept: 'application/json',
      };
      const init: RequestInit = {
        method,
        headers,
        keepalive,
      };
      if (body !== undefined && method !== 'GET') {
        headers['Content-Type'] = 'application/json';
        init.body = JSON.stringify(body);
      }
      const response = await fetch(url, init);
      const data = await response.json().catch(() => ({}));
      return { response, data };
    };

    let { response, data } = await exec(false);
    if (response.status === 401 && !keepalive) {
      ({ response, data } = await exec(true));
    }

    if (!response.ok || data?.success === false) {
      const msg = data?.error || `SFU request failed (${response.status})`;
      const err: any = new Error(msg);
      err.status = response.status;
      throw err;
    }

    return data as T;
  }

  private enqueueSessionOp<T>(sessionKey: string, task: () => Promise<T>): Promise<T> {
    const prev = this.sessionQueues.get(sessionKey) || Promise.resolve();
    const next = prev.catch(() => undefined).then(task);
    this.sessionQueues.set(
      sessionKey,
      next.finally(() => {
        if (this.sessionQueues.get(sessionKey) === next) {
          this.sessionQueues.delete(sessionKey);
        }
      })
    );
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
      try {
        const base = this.getBackendApiBase();
        const idToken = await auth.currentUser.getIdToken(forceRefresh);
        const response = await fetch(`${base}/api/webrtc/turn-credentials`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${idToken}`, Accept: 'application/json' },
        });
        const data = await response.json().catch(() => ({}));
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
      } catch (error) {
        console.warn('[WebRTC] Railway TURN credential request failed:', error);
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
        addedTransceivers.push({
          transceiver,
          trackName: item.trackName,
          kind: item.track.kind === 'audio' ? 'audio' : 'video',
        });
      }

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

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

  private async subscribeTracksOnSession(
    sessionId: string,
    pc: RTCPeerConnection,
    remoteTracks: Array<{ publisherSessionId: string; trackName: string; peerId?: string }>,
    context?: { contextType: 'live' | 'party'; contextId: string; speakerPeerIds?: string[] },
    onAssignedMids?: (assigned: Array<{ mid: string; trackName: string; publisherSessionId: string; peerId?: string }>) => void
  ): Promise<Array<{ mid: string; trackName: string; publisherSessionId: string }>> {
    return this.enqueueSessionOp(sessionId, async () => {
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

      const assigned = (resp.tracks || []).map((t, idx) => ({
        mid: String(t.mid || ''),
        trackName: String(t.trackName || remoteTracks[idx]?.trackName || ''),
        publisherSessionId: String(t.sessionId || remoteTracks[idx]?.publisherSessionId || ''),
        peerId: remoteTracks.find(
          (rt) => rt.trackName === t.trackName && (!t.sessionId || rt.publisherSessionId === t.sessionId)
        )?.peerId,
      }));

      if (onAssignedMids) {
        onAssignedMids(assigned);
      }

      if (resp.sessionDescription?.sdp) {
        await pc.setRemoteDescription(new RTCSessionDescription(resp.sessionDescription));
        if (resp.requiresImmediateRenegotiation || resp.sessionDescription.type === 'offer') {
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
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
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.localStream = stream;
      if (this.isVideoPaused) stream.getVideoTracks().forEach((t) => (t.enabled = false));
      if (this.isMuted) stream.getAudioTracks().forEach((t) => (t.enabled = false));
      if (withAudio) this.initAudioAnalyser(stream);
      return stream;
    } catch (err) {
      console.error('Camera/Microphone access error:', err);
      const fallbackStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: withAudio
          ? { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
          : false,
      });
      this.localStream = fallbackStream;
      if (this.isVideoPaused) fallbackStream.getVideoTracks().forEach((t) => (t.enabled = false));
      if (this.isMuted) fallbackStream.getAudioTracks().forEach((t) => (t.enabled = false));
      if (withAudio) this.initAudioAnalyser(fallbackStream);
      return fallbackStream;
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
    const partyAudioTracks = Array.from(this.partySfuSessions.values())
      .flatMap((s) => s.localStream?.getAudioTracks() || []);
    const localAudioTracks = this.localStream?.getAudioTracks() || [];
    const allTracks = [...localAudioTracks, ...partyAudioTracks];
    if (!allTracks.length) return false;

    const nextEnabled = enabled !== undefined ? enabled : !allTracks.some((t) => t.enabled);
    this.isMuted = !nextEnabled;
    allTracks.forEach((t) => {
      t.enabled = nextEnabled;
    });

    this.partySfuSessions.forEach((session) => {
      session.isMuted = !nextEnabled;
      if (session.isPublishing && auth.currentUser?.uid) {
        updateDoc(doc(db, 'partyRooms', session.roomId, 'voiceParticipants', auth.currentUser.uid), {
          isMuted: !nextEnabled,
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
  // SOLO LIVE HOST PUBLISHING VIA CLOUDFLARE REALTIME SFU
  // =========================================================================

  public async startSoloLiveHost(params: {
    streamId: string;
    hostId: string;
    facing?: 'user' | 'environment';
    isVideoOn?: boolean;
    isMicOn?: boolean;
    onConnectionStateChange?: (state: ConnectionState) => void;
  }): Promise<SoloLivePublishResult> {
    const {
      streamId,
      hostId,
      facing = 'user',
      isVideoOn = true,
      isMicOn = true,
      onConnectionStateChange,
    } = params;

    await this.stopHostBroadcast(streamId);

    this.isVideoPaused = !isVideoOn;
    this.isMuted = !isMicOn;

    await this.getFirebaseIdToken();
    await this.fetchCloudflareTurnCredentials().catch(() => {});

    let stream: MediaStream | null = null;
    let sfuSessionId = '';
    let pc: RTCPeerConnection | null = null;

    try {
      stream = await this.getLocalMediaStream(facing, true);
      const videoTrack = stream.getVideoTracks()[0];
      const audioTrack = stream.getAudioTracks()[0];
      if (!videoTrack && !audioTrack) {
        throw new Error('Camera and microphone tracks were not available.');
      }
      if (videoTrack) videoTrack.enabled = isVideoOn;
      if (audioTrack) audioTrack.enabled = isMicOn;

      sfuSessionId = await this.createSfuSession();
      pc = new RTCPeerConnection(this.getRtcConfiguration());

      pc.onconnectionstatechange = () => {
        if (!pc) return;
        const st = pc.connectionState as ConnectionState;
        onConnectionStateChange?.(st);
        if (st === 'failed') {
          try {
            pc.restartIce?.();
          } catch {
            // ignore
          }
        }
      };
      pc.oniceconnectionstatechange = () => {
        if (pc?.iceConnectionState === 'failed') {
          try {
            pc.restartIce?.();
          } catch {
            // ignore
          }
        }
      };

      const suffix = Date.now().toString(36);
      const tracksToPublish: Array<{ track: MediaStreamTrack; trackName: string }> = [];
      if (videoTrack) tracksToPublish.push({ track: videoTrack, trackName: `${streamId}-video-${suffix}` });
      if (audioTrack) tracksToPublish.push({ track: audioTrack, trackName: `${streamId}-audio-${suffix}` });

      const publishedTracks = await this.publishTracksOnSession(sfuSessionId, pc, tracksToPublish, stream);
      await this.waitForPeerConnected(pc, 15000);

      const sessionObj: HostSfuSession = {
        streamId,
        hostId,
        sfuSessionId,
        pc,
        stream,
        publishedTracks,
        isVideoOn,
        isMicOn,
      };
      this.hostSfuSessions.set(streamId, sessionObj);
      this.setBroadcastState(streamId, { isVideoOn, isMicOn });

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

  public async stopHostBroadcast(streamId: string, keepalive: boolean = false): Promise<void> {
    const hostSession = this.hostSfuSessions.get(streamId);
    this.hostSfuSessions.delete(streamId);
    this.stopLocalMediaStream();

    if (hostSession) {
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
    await this.fetchCloudflareTurnCredentials().catch(() => {});

    const viewerSessionId = await this.createSfuSession();
    const pc = new RTCPeerConnection(this.getRtcConfiguration());
    const remoteStream = new MediaStream();

    let tracksReceived = 0;
    let resolveTrackWaiter: (() => void) | null = null;
    const firstTrackPromise = new Promise<void>((resolve) => {
      resolveTrackWaiter = resolve;
    });

    pc.ontrack = (event) => {
      const track = event.track;
      if (!track) return;
      if (!remoteStream.getTracks().some((t) => t.id === track.id)) {
        remoteStream.addTrack(track);
      }
      tracksReceived += 1;
      resolveTrackWaiter?.();
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed') {
        try {
          pc.restartIce?.();
        } catch {
          // ignore
        }
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

      if (remoteStream.getTracks().length === 0) {
        throw new Error('Remote media stream contained zero active tracks.');
      }

      this.viewerSfuSessions.set(streamId, {
        streamId,
        sfuSessionId: viewerSessionId,
        pc,
        remoteStream,
        subscribedMids: assigned.map((a) => a.mid).filter(Boolean),
      });

      const initialState: BroadcastState = {
        isVideoOn: options.isVideoOn !== false,
        isMicOn: options.isMicOn !== false,
      };
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
    const session = this.viewerSfuSessions.get(streamId);
    this.viewerSfuSessions.delete(streamId);
    if (session) {
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

  public async startPartyVoice(
    roomId: string,
    userId: string,
    isMuted: boolean = false,
    listenOnly: boolean = false,
    callbacks?: {
      onError?: (err: Error) => void;
      onConnectionStateChange?: (state: ConnectionState) => void;
    }
  ): Promise<MediaStream | null> {
    const existing = this.partySfuSessions.get(roomId);
    if (
      existing &&
      existing.userId === userId &&
      existing.pc.connectionState !== 'closed' &&
      existing.pc.connectionState !== 'failed'
    ) {
      existing.onError = callbacks?.onError;
      existing.onConnectionStateChange = callbacks?.onConnectionStateChange;
      return this.setPartySpeakingMode(roomId, userId, !listenOnly, isMuted);
    }

    await this.stopPartyVoice(roomId);
    await this.getFirebaseIdToken();
    await this.fetchCloudflareTurnCredentials().catch(() => {});

    const sfuSessionId = await this.createSfuSession();
    const pc = new RTCPeerConnection(this.getRtcConfiguration());

    const session: PartySfuRoomSession = {
      roomId,
      userId,
      sfuSessionId,
      pc,
      localStream: null,
      localTrackName: null,
      localMid: null,
      isPublishing: false,
      isMuted: listenOnly ? true : isMuted,
      unsubscribeParticipants: null,
      heartbeatTimer: null,
      subscribedByPeerKey: new Map(),
      pendingMidToPeer: new Map(),
      onError: callbacks?.onError,
      onConnectionStateChange: callbacks?.onConnectionStateChange,
    };
    this.partySfuSessions.set(roomId, session);

    pc.ontrack = (event) => {
      const mid = event.transceiver?.mid || '';
      const peerId = session.pendingMidToPeer.get(mid);
      if (!peerId || !event.track) return;

      const stream = event.streams?.[0] || new MediaStream([event.track]);
      for (const [, sub] of session.subscribedByPeerKey.entries()) {
        if (sub.peerId === peerId && (sub.mid === mid || !sub.mid)) {
          sub.mid = mid;
          sub.stream = stream;
        }
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('alphamate-party-remote-stream', {
            detail: { roomId, peerId, stream },
          })
        );
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState as ConnectionState;
      session.onConnectionStateChange?.(state);
      if (state === 'failed') {
        try {
          pc.restartIce?.();
        } catch {
          // ignore
        }
      }
    };

    try {
      if (!listenOnly) {
        await this.publishPartyLocalMic(session, isMuted);
      }

      await this.writePartyParticipantPresence(session);

      session.heartbeatTimer = setInterval(() => {
        this.writePartyParticipantPresence(session).catch(() => {});
      }, 15000);

      const participantsRef = collection(db, 'partyRooms', roomId, 'voiceParticipants');
      session.unsubscribeParticipants = onSnapshot(
        participantsRef,
        (snapshot) => {
          const desiredPeers = new Map<
            string,
            { peerId: string; publisherSessionId: string; trackName: string }
          >();
          const now = Date.now();

          snapshot.docs.forEach((docSnap) => {
            const peerId = docSnap.id;
            if (peerId === userId) return; // Never subscribe to own track
            const data = docSnap.data() as any;
            if (
              data?.isPublishing === true &&
              !data?.listenOnly &&
              typeof data?.sfuSessionId === 'string' &&
              data.sfuSessionId &&
              data.sfuSessionId !== sfuSessionId &&
              typeof data?.trackName === 'string' &&
              data.trackName &&
              (!data?.lastSeenAtMs || now - Number(data.lastSeenAtMs) <= PARTY_PARTICIPANT_STALE_MS)
            ) {
              const peerKey = `${peerId}::${data.sfuSessionId}::${data.trackName}`;
              desiredPeers.set(peerKey, {
                peerId,
                publisherSessionId: data.sfuSessionId,
                trackName: data.trackName,
              });
            }
          });

          this.reconcilePartySubscriptions(session, desiredPeers).catch((err) => {
            console.warn('[Party SFU] Subscription reconciliation error:', err);
            session.onError?.(err instanceof Error ? err : new Error(String(err)));
          });
        },
        (error) => {
          console.error('[Party SFU] Participants listener error:', error);
          session.onError?.(error);
        }
      );

      return session.localStream;
    } catch (err) {
      await this.stopPartyVoice(roomId);
      throw err;
    }
  }

  public async setPartySpeakingMode(
    roomId: string,
    userId: string,
    canSpeak: boolean,
    isMuted: boolean
  ): Promise<MediaStream | null> {
    const session = this.partySfuSessions.get(roomId);
    if (!session || session.userId !== userId) {
      return this.startPartyVoice(roomId, userId, isMuted, !canSpeak);
    }

    if (canSpeak && !session.isPublishing) {
      await this.publishPartyLocalMic(session, isMuted);
      await this.writePartyParticipantPresence(session);
      return session.localStream;
    }

    if (!canSpeak && session.isPublishing) {
      await this.unpublishPartyLocalMic(session);
      await this.writePartyParticipantPresence(session);
      return null;
    }

    if (canSpeak && session.isPublishing) {
      this.isMuted = isMuted;
      session.isMuted = isMuted;
      session.localStream?.getAudioTracks().forEach((t) => {
        t.enabled = !isMuted;
      });
      await this.writePartyParticipantPresence(session);
    }

    return session.localStream;
  }

  private async publishPartyLocalMic(session: PartySfuRoomSession, isMuted: boolean): Promise<void> {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
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

    const trackName = `party-${session.roomId}-${session.userId}-${Date.now().toString(36)}`;
    try {
      const published = await this.publishTracksOnSession(
        session.sfuSessionId,
        session.pc,
        [{ track: audioTrack, trackName }],
        stream
      );
      session.localStream = stream;
      session.localTrackName = trackName;
      session.localMid = published[0]?.mid || null;
      session.isPublishing = true;
      session.isMuted = isMuted;
      this.isMuted = isMuted;
      this.initAudioAnalyser(stream);
    } catch (err) {
      stream.getTracks().forEach((t) => t.stop());
      throw err;
    }
  }

  private async unpublishPartyLocalMic(session: PartySfuRoomSession): Promise<void> {
    const midToClose = session.localMid;
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
    this.stopAudioAnalyser();

    if (midToClose) {
      await this.closeTracksOnSession(session.sfuSessionId, session.pc, [midToClose], false);
    }
  }

  private async writePartyParticipantPresence(session: PartySfuRoomSession): Promise<void> {
    const uid = auth.currentUser?.uid || session.userId;
    if (!uid) return;
    await setDoc(
      doc(db, 'partyRooms', session.roomId, 'voiceParticipants', uid),
      {
        userId: uid,
        sfuSessionId: session.sfuSessionId,
        trackName: session.isPublishing ? session.localTrackName : null,
        mid: session.isPublishing ? session.localMid : null,
        isPublishing: session.isPublishing,
        listenOnly: !session.isPublishing,
        isMuted: session.isPublishing ? session.isMuted : true,
        lastSeenAt: serverTimestamp(),
        lastSeenAtMs: Date.now(),
      },
      { merge: true }
    );
  }

  private async reconcilePartySubscriptions(
    session: PartySfuRoomSession,
    desiredPeers: Map<string, { peerId: string; publisherSessionId: string; trackName: string }>
  ): Promise<void> {
    // 1. Close tracks that left or stopped publishing
    const removedKeys: string[] = [];
    const midsToClose: string[] = [];
    for (const [peerKey, existing] of session.subscribedByPeerKey.entries()) {
      if (!desiredPeers.has(peerKey)) {
        removedKeys.push(peerKey);
        if (existing.mid) {
          midsToClose.push(existing.mid);
          session.pendingMidToPeer.delete(existing.mid);
        }
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('alphamate-party-remote-stream-removed', {
              detail: { roomId: session.roomId, peerId: existing.peerId },
            })
          );
        }
      }
    }
    removedKeys.forEach((k) => session.subscribedByPeerKey.delete(k));
    if (midsToClose.length > 0) {
      await this.closeTracksOnSession(session.sfuSessionId, session.pc, midsToClose, false);
    }

    // 2. Subscribe to newly added remote speaker tracks
    const toSubscribe: Array<{ peerKey: string; peerId: string; publisherSessionId: string; trackName: string }> = [];
    for (const [peerKey, info] of desiredPeers.entries()) {
      if (!session.subscribedByPeerKey.has(peerKey)) {
        toSubscribe.push({ peerKey, ...info });
      }
    }
    if (toSubscribe.length === 0) return;

    const assigned = await this.subscribeTracksOnSession(
      session.sfuSessionId,
      session.pc,
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
      session.subscribedByPeerKey.set(item.peerKey, {
        peerId: item.peerId,
        publisherSessionId: item.publisherSessionId,
        trackName: item.trackName,
        mid,
        stream: new MediaStream(),
      });
    });

    // Attach tracks if pc.ontrack already fired before map population
    session.pc.getReceivers().forEach((receiver) => {
      const transceiver = session.pc.getTransceivers().find((t) => t.receiver === receiver);
      const mid = transceiver?.mid;
      if (!mid || !receiver.track || receiver.track.readyState !== 'live') return;
      const peerId = session.pendingMidToPeer.get(mid);
      if (!peerId) return;
      const stream = new MediaStream([receiver.track]);
      for (const [, sub] of session.subscribedByPeerKey.entries()) {
        if (sub.peerId === peerId && sub.mid === mid && sub.stream.getTracks().length === 0) {
          sub.stream = stream;
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('alphamate-party-remote-stream', {
                detail: { roomId: session.roomId, peerId, stream },
              })
            );
          }
        }
      }
    });
  }

  public async stopPartyVoice(roomId: string, keepalive: boolean = false): Promise<void> {
    const session = this.partySfuSessions.get(roomId);
    this.partySfuSessions.delete(roomId);

    if (session) {
      if (session.heartbeatTimer) {
        clearInterval(session.heartbeatTimer);
        session.heartbeatTimer = null;
      }
      if (session.unsubscribeParticipants) {
        session.unsubscribeParticipants();
        session.unsubscribeParticipants = null;
      }
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
        session.pc.close();
      } catch {
        // ignore
      }
      await this.deleteSfuSession(session.sfuSessionId, keepalive);
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
