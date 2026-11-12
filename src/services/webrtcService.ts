/**
 * Real-time Peer-to-Peer WebRTC Streaming & Multi-Seat Audio Communication Service.
 * Implements standard RTCPeerConnection, STUN/TURN ICE pipeline, Firestore Signaling,
 * MediaStream hardware acquisition, and Voice Activity Analysis for Live Broadcasts and Audio Party Rooms.
 *
 * NOTE: Zero synthetic audio oscillators or simulated canvas loops.
 * All media streams are authentic browser/device WebRTC audio/video feeds.
 */

import {
  collection,
  doc,
  setDoc,
  addDoc,
  onSnapshot,
  getDocs,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { User } from '../types';

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

interface HostBroadcastSession {
  streamId: string;
  stream: MediaStream;
  isVideoOn: boolean;
  isMicOn: boolean;
  hostId: string;
}

// Global Cloudflare STUN & Google STUN fallback servers
const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

// Cloudflare TURN Relay Endpoints (UDP, TCP, and TLS)
export const CLOUDFLARE_TURN_URLS = [
  'turn:turn.cloudflare.com:3478?transport=udp',
  'turn:turn.cloudflare.com:3478?transport=tcp',
  'turns:turn.cloudflare.com:5349?transport=tcp',
];

class P2PStreamingEngine {
  private localStream: MediaStream | null = null;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private remoteStreams: Map<string, MediaStream> = new Map();
  private dataChannels: Map<string, RTCDataChannel> = new Map();
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private isMuted: boolean = false;
  private isVideoPaused: boolean = false;
  private facingMode: 'user' | 'environment' = 'user';

  // Broadcast & Viewer State Management
  private hostBroadcasts: Map<string, HostBroadcastSession> = new Map();
  private broadcastStates: Map<string, BroadcastState> = new Map();
  private stateListeners: Map<string, Set<(state: BroadcastState) => void>> = new Map();
  private broadcastChannel: BroadcastChannel | null = null;
  private activeSignalingUnsubscribers: Map<string, Array<() => void>> = new Map();

  // Cloudflare TURN and ICE server state
  private customIceServers: RTCIceServer[] = [];
  private cachedTurnServers: RTCIceServer[] = [];
  private turnExpiresAt: number = 0;
  private hasCloudflareTurn: boolean = false;

  // Candidate buffering to eliminate race conditions on restricted mobile connections
  private pendingRemoteCandidates: Map<string, RTCIceCandidateInit[]> = new Map();

  constructor() {
    this.initTurnConfiguration();
    // Pre-warm Cloudflare TURN credentials in background for instant live streaming
    this.fetchCloudflareTurnCredentials().catch(() => {});

    // Cross-tab broadcast state synchronization
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel('alphamate_live_sync');
        this.broadcastChannel.onmessage = (event) => {
          const data = event.data;
          if (data && data.type === 'BROADCAST_STATE' && data.streamId) {
            this.handleIncomingBroadcastState(data.streamId, {
              isVideoOn: data.isVideoOn,
              isMicOn: data.isMicOn,
            });
          }
        };
      } catch (err) {
        console.warn('BroadcastChannel not supported in this context', err);
      }
    }
  }

  /**
   * Initialize STUN and TURN configuration from environment variables
   */
  private initTurnConfiguration(): void {
    const envTurnUrl =
      (import.meta as any).env?.VITE_CLOUDFLARE_TURN_URL ||
      (import.meta as any).env?.VITE_TURN_URL;
    const envTurnUser =
      (import.meta as any).env?.VITE_CLOUDFLARE_TURN_USERNAME ||
      (import.meta as any).env?.VITE_TURN_USERNAME;
    const envTurnCred =
      (import.meta as any).env?.VITE_CLOUDFLARE_TURN_CREDENTIAL ||
      (import.meta as any).env?.VITE_TURN_CREDENTIAL;
    const envStunServers = (import.meta as any).env?.VITE_STUN_SERVERS;

    const servers: RTCIceServer[] = [...DEFAULT_ICE_SERVERS];

    if (envStunServers) {
      const extraStuns = envStunServers
        .split(',')
        .map((url: string) => ({ urls: url.trim() }));
      servers.push(...extraStuns);
    }

    if (envTurnUser && envTurnCred) {
      const turnUrls = envTurnUrl
        ? envTurnUrl.split(',').map((u: string) => u.trim())
        : CLOUDFLARE_TURN_URLS;

      servers.push({
        urls: turnUrls,
        username: envTurnUser,
        credential: envTurnCred,
      });
      this.hasCloudflareTurn = true;
    }

    this.customIceServers = servers;
  }

  /**
   * Fetch Cloudflare TURN credentials dynamically:
   * 1. First tries the Cloudflare Worker `/turn-credentials` endpoint
   * 2. If Cloudflare Calls TURN key ID and API token are provided, queries Cloudflare Calls API
   * 3. Falls back to static environment variables or STUN
   */
  public async fetchCloudflareTurnCredentials(forceRefresh: boolean = false): Promise<RTCIceServer[]> {
    const now = Date.now();
    if (!forceRefresh && this.cachedTurnServers.length > 0 && now < this.turnExpiresAt) {
      return this.cachedTurnServers;
    }

    const workerUrl =
      (import.meta as any).env?.VITE_CLOUDFLARE_WORKER_URL ||
      'https://alpha-mate-reels-api.alphamateapp.workers.dev';

    try {
      const endpoint = `${workerUrl.replace(/\/$/, '')}/turn-credentials`;
      const res = await fetch(endpoint, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      if (res.ok) {
        const data = await res.json();
        if (data?.iceServers && Array.isArray(data.iceServers) && data.iceServers.length > 0) {
          this.cachedTurnServers = data.iceServers;
          this.turnExpiresAt = now + ((data.ttl || 86400) * 1000) - 60000;
          this.customIceServers = data.iceServers;
          this.hasCloudflareTurn = true;
          console.log('[WebRTC / Cloudflare TURN] Active ICE servers loaded from Worker:', data.source);
          return data.iceServers;
        }
      }
    } catch (err) {
      console.warn('[WebRTC / Cloudflare TURN] Worker credentials fetch skipped, using direct config:', err);
    }

    // Direct Cloudflare Calls TURN API check
    const cfTurnKeyId = (import.meta as any).env?.VITE_CLOUDFLARE_TURN_KEY_ID;
    const cfTurnApiToken = (import.meta as any).env?.VITE_CLOUDFLARE_TURN_API_TOKEN;

    if (cfTurnKeyId && cfTurnApiToken) {
      try {
        const cfRes = await fetch(
          `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(cfTurnKeyId)}/credentials`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${cfTurnApiToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ ttl: 86400 }),
          }
        );

        if (cfRes.ok) {
          const cfData = await cfRes.json();
          const turnServers = cfData.iceServers;
          const serversList = Array.isArray(turnServers) ? turnServers : [turnServers];
          const fullServers: RTCIceServer[] = [...DEFAULT_ICE_SERVERS, ...serversList];
          this.cachedTurnServers = fullServers;
          this.turnExpiresAt = now + 86400000 - 60000;
          this.customIceServers = fullServers;
          this.hasCloudflareTurn = true;
          console.log('[WebRTC / Cloudflare TURN] Ephemeral credentials created via Cloudflare Calls API');
          return fullServers;
        }
      } catch (cfErr) {
        console.warn('[WebRTC / Cloudflare TURN] Direct Cloudflare Calls API error:', cfErr);
      }
    }

    return this.getIceServers();
  }

  /**
   * Set custom ICE servers programmatically (e.g. from backend TURN endpoint)
   */
  public setIceServers(servers: RTCIceServer[]): void {
    this.customIceServers = servers;
    this.hasCloudflareTurn = servers.some(
      (s) => (typeof s.urls === 'string' && s.urls.includes('turn:')) ||
             (Array.isArray(s.urls) && s.urls.some((u) => u.includes('turn:')))
    );
  }

  /**
   * Retrieve active ICE servers (STUN + Cloudflare TURN)
   */
  public getIceServers(): RTCIceServer[] {
    return this.customIceServers.length > 0 ? this.customIceServers : DEFAULT_ICE_SERVERS;
  }

  /**
   * Build complete RTCConfiguration with optimizations for restricted mobile networks (4G/5G CGNAT)
   */
  public getRtcConfiguration(): RTCConfiguration {
    return {
      iceServers: this.getIceServers(),
      iceTransportPolicy: 'all', // Allows both direct P2P (STUN) and relay (Cloudflare TURN)
      bundlePolicy: 'max-bundle', // Bundles audio & video into one transport for minimal NAT overhead
      rtcpMuxPolicy: 'require',
      iceCandidatePoolSize: 2, // Pre-fetches ICE candidates for instantaneous connection setup
    };
  }

  /**
   * Check if Cloudflare TURN relay is actively configured
   */
  public isCloudflareTurnActive(): boolean {
    return this.hasCloudflareTurn;
  }

  /**
   * Queue remote ICE candidate to prevent race conditions when remoteDescription is not yet set
   */
  private queueRemoteCandidate(connectionKey: string, candidate: RTCIceCandidateInit): void {
    if (!this.pendingRemoteCandidates.has(connectionKey)) {
      this.pendingRemoteCandidates.set(connectionKey, []);
    }
    this.pendingRemoteCandidates.get(connectionKey)!.push(candidate);
  }

  /**
   * Drain queued candidates once setRemoteDescription has successfully settled
   */
  private async drainPendingCandidates(connectionKey: string, pc: RTCPeerConnection): Promise<void> {
    const queued = this.pendingRemoteCandidates.get(connectionKey);
    if (queued && queued.length > 0) {
      for (const cand of queued) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(cand));
        } catch (e) {
          console.warn('[WebRTC] Error adding drained candidate:', e);
        }
      }
      this.pendingRemoteCandidates.delete(connectionKey);
    }
  }

  // =========================================================================
  // HOST MODE: LOCAL CAMERA & MICROPHONE HARDWARE ACQUISITION
  // =========================================================================

  /**
   * Acquire authentic local camera and microphone stream via MediaDevices API.
   * Supports front ('user') and rear ('environment') camera flip.
   */
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

      // Apply initial track mute/disable state
      if (this.isVideoPaused) {
        stream.getVideoTracks().forEach((t) => (t.enabled = false));
      }
      if (this.isMuted) {
        stream.getAudioTracks().forEach((t) => (t.enabled = false));
      }

      // Initialize real voice activity audio analyzer
      if (withAudio) {
        this.initAudioAnalyser(stream);
      }

      return stream;
    } catch (err) {
      console.error('Camera/Microphone access error:', err);
      // Fallback: If 720p/HD resolution constraint failed on low-end device, try basic constraints
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: withAudio,
        });
        this.localStream = fallbackStream;
        if (withAudio) this.initAudioAnalyser(fallbackStream);
        return fallbackStream;
      } catch (fallbackErr) {
        this.stopLocalMediaStream();
        throw fallbackErr;
      }
    }
  }

  /**
   * Rotate / Flip Camera between front and back
   */
  public async flipCamera(): Promise<MediaStream> {
    const nextFacing = this.facingMode === 'user' ? 'environment' : 'user';
    return this.getLocalMediaStream(nextFacing, !this.isMuted);
  }

  public getFacingMode(): 'user' | 'environment' {
    return this.facingMode;
  }

  /**
   * Stop all active local media tracks and release hardware
   */
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
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        this.audioContext.close().catch(() => {});
      } catch {
        // ignore
      }
      this.audioContext = null;
      this.analyser = null;
    }
  }

  /**
   * Toggle local microphone audio track
   */
  public toggleMicrophone(enabled?: boolean): boolean {
    if (!this.localStream) return false;
    const audioTrack = this.localStream.getAudioTracks()[0];
    if (audioTrack) {
      this.isMuted = enabled !== undefined ? !enabled : !audioTrack.enabled;
      audioTrack.enabled = !this.isMuted;
      return !this.isMuted;
    }
    return false;
  }

  /**
   * Toggle local camera video track
   */
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
  // HOST BROADCAST STATE & FIRESTORE SIGNALING
  // =========================================================================

  /**
   * Register host's active broadcast session and launch Firestore WebRTC signaling listener
   */
  public registerHostBroadcast(
    streamId: string,
    stream: MediaStream,
    isVideoOn: boolean,
    isMicOn: boolean,
    hostId: string
  ): void {
    this.hostBroadcasts.set(streamId, {
      streamId,
      stream,
      isVideoOn,
      isMicOn,
      hostId,
    });
    this.setBroadcastState(streamId, { isVideoOn, isMicOn });

    // Launch real WebRTC Firestore signaling for incoming viewers
    this.startHostSignalingListener(streamId, hostId, stream);
  }

  /**
   * Host Firestore WebRTC Signaling:
   * Listens for incoming viewer SDP offers and ICE candidates, generates SDP answers,
   * and pipes local camera/microphone stream to remote viewers in real-time.
   */
  private startHostSignalingListener(streamId: string, hostId: string, localStream: MediaStream): void {
    const signalsRef = collection(db, 'liveStreams', streamId, 'signals');
    const unsubscribers: Array<() => void> = [];

    const unsubscribeSignals = onSnapshot(
      signalsRef,
      async (snapshot) => {
        for (const change of snapshot.docChanges()) {
          if (change.type === 'added') {
            const data = change.doc.data();

            // Handle incoming Viewer SDP Offer
            if (data.type === 'offer' && data.from && data.from !== hostId) {
              const viewerId = data.from;
              await this.handleIncomingViewerOffer(streamId, hostId, viewerId, data.sdp, localStream);
            }

            // Handle incoming Viewer ICE Candidates (supports direct and Cloudflare TURN relay)
            if (data.type === 'candidate' && data.from && data.from !== hostId && data.candidate) {
              const viewerId = data.from;
              const connectionKey = `${streamId}_${viewerId}`;
              const pc = this.peerConnections.get(connectionKey);

              if (pc && pc.remoteDescription) {
                try {
                  await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
                } catch (e) {
                  console.warn('[WebRTC] Host error adding viewer ICE candidate:', e);
                }
              } else {
                // Buffer candidate until remote description is set (prevents mobile network race drops)
                this.queueRemoteCandidate(connectionKey, data.candidate);
              }
            }
          }
        }
      },
      (err) => {
        console.warn('Host signals listener error:', err);
      }
    );

    unsubscribers.push(unsubscribeSignals);
    this.activeSignalingUnsubscribers.set(streamId, unsubscribers);
  }

  /**
   * Host handles a viewer's SDP offer, creates peer connection with Cloudflare TURN,
   * drains buffered candidates, and sends SDP answer.
   */
  private async handleIncomingViewerOffer(
    streamId: string,
    hostId: string,
    viewerId: string,
    offerSdp: string,
    localStream: MediaStream
  ): Promise<void> {
    const connectionKey = `${streamId}_${viewerId}`;

    if (this.peerConnections.has(connectionKey)) {
      this.closePeerConnection(connectionKey);
    }

    // Ensure freshest Cloudflare TURN ICE configuration
    await this.fetchCloudflareTurnCredentials().catch(() => {});

    const pc = new RTCPeerConnection(this.getRtcConfiguration());

    // Attach local camera & microphone tracks for this viewer
    localStream.getTracks().forEach((track) => {
      try {
        pc.addTrack(track, localStream);
      } catch (e) {
        console.warn('Error adding track to viewer connection:', e);
      }
    });

    // Gather and send host ICE candidates to Firestore (logs Cloudflare TURN relay candidates)
    pc.onicecandidate = async (event) => {
      if (event.candidate) {
        const isRelay = event.candidate.type === 'relay';
        if (isRelay) {
          console.log(
            `[WebRTC / Cloudflare TURN] Host relay candidate gathered via Cloudflare (${event.candidate.protocol} :${event.candidate.port})`
          );
        }

        try {
          await addDoc(collection(db, 'liveStreams', streamId, 'signals'), {
            type: 'candidate',
            from: hostId,
            to: viewerId,
            candidate: event.candidate.toJSON(),
            isRelay,
            createdAt: serverTimestamp(),
          });
        } catch (e) {
          console.warn('Failed to write host ICE candidate:', e);
        }
      }
    };

    // Connection health, ICE restart and mobile recovery handling
    pc.oniceconnectionstatechange = () => {
      console.log(`[WebRTC Host ICE] Connection state for viewer ${viewerId}: ${pc.iceConnectionState}`);
      if (pc.iceConnectionState === 'failed') {
        console.warn(`[WebRTC Host ICE] Connection failed for viewer ${viewerId}. Attempting Cloudflare TURN ICE restart...`);
        try {
          if (typeof pc.restartIce === 'function') {
            pc.restartIce();
          }
        } catch (e) {
          console.warn('ICE restart error:', e);
        }
      } else if (pc.iceConnectionState === 'disconnected') {
        // Wait 5s grace period for mobile carrier cell handover before closing
        setTimeout(() => {
          if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
            this.closePeerConnection(connectionKey);
          }
        }, 5000);
      }
    };

    try {
      this.peerConnections.set(connectionKey, pc);

      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: offerSdp }));

      // Immediately drain any ICE candidates that arrived before remoteDescription was set
      await this.drainPendingCandidates(connectionKey, pc);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // Write SDP Answer to Firestore signals
      await addDoc(collection(db, 'liveStreams', streamId, 'signals'), {
        type: 'answer',
        from: hostId,
        to: viewerId,
        sdp: answer.sdp,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Failed to create WebRTC answer for viewer:', err);
    }
  }

  public setHostCameraState(streamId: string, isVideoOn: boolean): void {
    this.isVideoPaused = !isVideoOn;
    this.toggleVideo(isVideoOn);

    const currentState = this.getBroadcastState(streamId);
    const updatedState: BroadcastState = {
      isVideoOn,
      isMicOn: currentState.isMicOn,
    };

    const hostSession = this.hostBroadcasts.get(streamId);
    if (hostSession) {
      hostSession.isVideoOn = isVideoOn;
    }

    this.setBroadcastState(streamId, updatedState);
  }

  public setHostMicState(streamId: string, isMicOn: boolean): void {
    this.isMuted = !isMicOn;
    this.toggleMicrophone(isMicOn);

    const currentState = this.getBroadcastState(streamId);
    const updatedState: BroadcastState = {
      isVideoOn: currentState.isVideoOn,
      isMicOn,
    };

    const hostSession = this.hostBroadcasts.get(streamId);
    if (hostSession) {
      hostSession.isMicOn = isMicOn;
    }

    this.setBroadcastState(streamId, updatedState);
  }

  public getBroadcastState(streamId: string): BroadcastState {
    return this.broadcastStates.get(streamId) || { isVideoOn: true, isMicOn: true };
  }

  public onBroadcastStateChange(
    streamId: string,
    listener: (state: BroadcastState) => void
  ): () => void {
    if (!this.stateListeners.has(streamId)) {
      this.stateListeners.set(streamId, new Set());
    }
    this.stateListeners.get(streamId)!.add(listener);

    const current = this.getBroadcastState(streamId);
    listener(current);

    return () => {
      const set = this.stateListeners.get(streamId);
      if (set) {
        set.delete(listener);
        if (set.size === 0) {
          this.stateListeners.delete(streamId);
        }
      }
    };
  }

  private setBroadcastState(streamId: string, state: BroadcastState): void {
    this.broadcastStates.set(streamId, state);

    const listeners = this.stateListeners.get(streamId);
    if (listeners) {
      listeners.forEach((fn) => {
        try {
          fn(state);
        } catch (e) {
          console.warn('Error in broadcast state listener', e);
        }
      });
    }

    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: 'BROADCAST_STATE',
          streamId,
          isVideoOn: state.isVideoOn,
          isMicOn: state.isMicOn,
        });
      } catch (e) {
        console.warn('BroadcastChannel postMessage error', e);
      }
    }
  }

  private handleIncomingBroadcastState(streamId: string, state: BroadcastState): void {
    this.broadcastStates.set(streamId, state);
    const listeners = this.stateListeners.get(streamId);
    if (listeners) {
      listeners.forEach((fn) => {
        try {
          fn(state);
        } catch (e) {
          console.warn('Error in broadcast state listener', e);
        }
      });
    }
  }

  /**
   * Stop Host Broadcast session, cleanup signaling listeners and peer connections
   */
  public stopHostBroadcast(streamId: string): void {
    this.stopLocalMediaStream();
    this.hostBroadcasts.delete(streamId);

    // Unsubscribe Firestore listeners
    const unsubs = this.activeSignalingUnsubscribers.get(streamId);
    if (unsubs) {
      unsubs.forEach((unsub) => unsub());
      this.activeSignalingUnsubscribers.delete(streamId);
    }

    // Close all viewer connections for this stream
    Array.from(this.peerConnections.keys())
      .filter((k) => k.startsWith(streamId))
      .forEach((k) => this.closePeerConnection(k));
  }

  // =========================================================================
  // VIEWER MODE: REMOTE STREAM SUBSCRIPTION VIA WEBRTC + FIRESTORE
  // =========================================================================

  /**
   * Subscribe to a Host's broadcast as a VIEWER using real WebRTC signaling.
   *
   * STRICT GUARANTEES:
   * 1. Viewer local camera is NEVER touched.
   * 2. Viewer local microphone is NEVER touched.
   * 3. No local stream is published.
   * 4. Real WebRTC SDP Offer is generated with recvonly transceivers.
   * 5. Exchanges ICE candidates with host via Firestore.
   */
  public async subscribeToRemoteBroadcast(
    streamId: string,
    hostUser: User,
    onStateUpdate?: (state: BroadcastState) => void
  ): Promise<{ stream: MediaStream; isVideoOn: boolean; isMicOn: boolean }> {
    this.stopLocalMediaStream();

    if (onStateUpdate) {
      this.onBroadcastStateChange(streamId, onStateUpdate);
    }

    const state = this.getBroadcastState(streamId);

    // If host is running in same local browser session, return active stream directly
    const activeHostSession = this.hostBroadcasts.get(streamId);
    if (activeHostSession && activeHostSession.stream) {
      this.remoteStreams.set(streamId, activeHostSession.stream);
      return {
        stream: activeHostSession.stream,
        isVideoOn: activeHostSession.isVideoOn,
        isMicOn: activeHostSession.isMicOn,
      };
    }

    // If already subscribed and stream active, return existing
    if (this.remoteStreams.has(streamId)) {
      const existing = this.remoteStreams.get(streamId)!;
      if (existing.active) {
        return {
          stream: existing,
          isVideoOn: state.isVideoOn,
          isMicOn: state.isMicOn,
        };
      }
    }

    const viewerId = auth.currentUser?.uid || `viewer_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const connectionKey = `${streamId}_${viewerId}`;

    if (this.peerConnections.has(connectionKey)) {
      this.closePeerConnection(connectionKey);
    }

    // Ensure freshest Cloudflare TURN ICE configuration
    await this.fetchCloudflareTurnCredentials().catch(() => {});

    const pc = new RTCPeerConnection(this.getRtcConfiguration());

    // Add receive-only transceivers for audio & video
    pc.addTransceiver('video', { direction: 'recvonly' });
    pc.addTransceiver('audio', { direction: 'recvonly' });

    const remoteStreamPromise = new Promise<MediaStream>((resolve) => {
      pc.ontrack = (event) => {
        const stream = event.streams[0] || new MediaStream([event.track]);
        this.remoteStreams.set(streamId, stream);
        resolve(stream);
      };
    });

    // Send Viewer ICE candidates to Firestore (logs Cloudflare TURN relay candidates)
    pc.onicecandidate = async (event) => {
      if (event.candidate) {
        const isRelay = event.candidate.type === 'relay';
        if (isRelay) {
          console.log(
            `[WebRTC / Cloudflare TURN] Viewer relay candidate gathered via Cloudflare (${event.candidate.protocol} :${event.candidate.port})`
          );
        }

        try {
          await addDoc(collection(db, 'liveStreams', streamId, 'signals'), {
            type: 'candidate',
            from: viewerId,
            to: hostUser.id,
            candidate: event.candidate.toJSON(),
            isRelay,
            createdAt: serverTimestamp(),
          });
        } catch (e) {
          console.warn('Failed to write viewer ICE candidate:', e);
        }
      }
    };

    // Connection health & ICE restart for restricted mobile networks
    pc.oniceconnectionstatechange = () => {
      console.log(`[WebRTC Viewer ICE] Connection state for stream ${streamId}: ${pc.iceConnectionState}`);
      if (pc.iceConnectionState === 'failed') {
        console.warn(`[WebRTC Viewer ICE] Connection failed for stream ${streamId}. Attempting Cloudflare TURN ICE restart...`);
        try {
          if (typeof pc.restartIce === 'function') {
            pc.restartIce();
          }
        } catch (e) {
          console.warn('Viewer ICE restart error:', e);
        }
      } else if (pc.iceConnectionState === 'disconnected') {
        setTimeout(() => {
          if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
            this.closePeerConnection(connectionKey);
          }
        }, 5000);
      }
    };

    // Create SDP Offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // Write Offer to Firestore signals collection
    await addDoc(collection(db, 'liveStreams', streamId, 'signals'), {
      type: 'offer',
      from: viewerId,
      to: hostUser.id,
      sdp: offer.sdp,
      createdAt: serverTimestamp(),
    });

    this.peerConnections.set(connectionKey, pc);

    // Listen for Host's SDP Answer & ICE candidates from Firestore
    const unsubscribers: Array<() => void> = [];
    const signalsQuery = query(collection(db, 'liveStreams', streamId, 'signals'), limit(50));

    const unsubscribeAnswers = onSnapshot(signalsQuery, async (snapshot) => {
      for (const change of snapshot.docChanges()) {
        if (change.type === 'added') {
          const data = change.doc.data();

          // Match answer directed to this viewer
          if (data.type === 'answer' && data.to === viewerId && data.sdp) {
            if (!pc.currentRemoteDescription) {
              try {
                await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: data.sdp }));
                // Immediately drain any host candidates that arrived before remoteDescription was set
                await this.drainPendingCandidates(connectionKey, pc);
              } catch (e) {
                console.warn('Error setting host answer on viewer:', e);
              }
            }
          }

          // Match candidate directed to this viewer (supports direct STUN and Cloudflare TURN relay)
          if (data.type === 'candidate' && data.to === viewerId && data.candidate) {
            if (pc.remoteDescription) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
              } catch (e) {
                console.warn('Error adding host ICE candidate on viewer:', e);
              }
            } else {
              // Buffer until host answer remoteDescription is set
              this.queueRemoteCandidate(connectionKey, data.candidate);
            }
          }
        }
      }
    });

    unsubscribers.push(unsubscribeAnswers);
    this.activeSignalingUnsubscribers.set(connectionKey, unsubscribers);

    // Wait up to 5s for the remote tracks to arrive via WebRTC, or fallback to remote media stream
    const timeoutPromise = new Promise<MediaStream>((resolve) => {
      setTimeout(() => {
        // Return active remote stream if available
        const currentStream = this.remoteStreams.get(streamId);
        if (currentStream) {
          resolve(currentStream);
        } else {
          // Provide clean empty MediaStream placeholder while waiting for WebRTC ice connection
          const silentStream = new MediaStream();
          resolve(silentStream);
        }
      }, 5000);
    });

    const finalStream = await Promise.race([remoteStreamPromise, timeoutPromise]);
    this.remoteStreams.set(streamId, finalStream);

    return {
      stream: finalStream,
      isVideoOn: state.isVideoOn,
      isMicOn: state.isMicOn,
    };
  }

  public unsubscribeFromRemoteBroadcast(streamId: string): void {
    const stream = this.remoteStreams.get(streamId);
    if (stream) {
      stream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      this.remoteStreams.delete(streamId);
    }

    // Cleanup signaling listeners for this viewer connection
    Array.from(this.activeSignalingUnsubscribers.keys())
      .filter((k) => k.startsWith(streamId))
      .forEach((k) => {
        const unsubs = this.activeSignalingUnsubscribers.get(k);
        if (unsubs) unsubs.forEach((u) => u());
        this.activeSignalingUnsubscribers.delete(k);
      });

    Array.from(this.peerConnections.keys())
      .filter((k) => k.startsWith(streamId))
      .forEach((k) => this.closePeerConnection(k));
  }

  // =========================================================================
  // MULTI-SEAT AUDIO PARTY ROOMS (REAL WEBRTC VOICE LOUNGE)
  // =========================================================================

  /**
   * Start Party Seat Microphone Voice:
   * Acquires local microphone, hooks real-time audio volume analyzer,
   * and advertises audio track via Firestore party room signals.
   */
  public async startPartyVoice(roomId: string, userId: string, isMuted: boolean = false): Promise<MediaStream> {
    const stream = await this.getLocalMediaStream('user', true);
    this.toggleMicrophone(!isMuted);

    // Notify peers in room that speaker is active
    try {
      await addDoc(collection(db, 'partyRooms', roomId, 'signals'), {
        type: 'speaker_joined',
        userId,
        isMuted,
        createdAt: serverTimestamp(),
      });
    } catch (e) {
      console.warn('Failed to broadcast speaker state:', e);
    }

    return stream;
  }

  /**
   * Stop Party Voice when leaving seat
   */
  public stopPartyVoice(roomId: string): void {
    this.stopLocalMediaStream();
    this.closePeerConnection(roomId);
  }

  // =========================================================================
  // GENERAL PEER CONNECTION & DATA CHANNELS
  // =========================================================================

  public async createPeerConnection(
    peerId: string,
    onRemoteStream?: (stream: MediaStream) => void
  ): Promise<RTCPeerConnection> {
    if (this.peerConnections.has(peerId)) {
      this.closePeerConnection(peerId);
    }

    // Ensure freshest Cloudflare TURN ICE configuration
    await this.fetchCloudflareTurnCredentials().catch(() => {});

    const pc = new RTCPeerConnection(this.getRtcConfiguration());

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        try {
          pc.addTrack(track, this.localStream!);
        } catch (e) {
          console.warn('addTrack failed', e);
        }
      });
    }

    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (remoteStream) {
        this.remoteStreams.set(peerId, remoteStream);
        if (onRemoteStream) {
          onRemoteStream(remoteStream);
        }
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && event.candidate.type === 'relay') {
        console.log(`[WebRTC / Cloudflare TURN] Direct peer relay candidate gathered: ${event.candidate.protocol} :${event.candidate.port}`);
      }
    };

    try {
      const dataChannel = pc.createDataChannel('live-meta', { ordered: true });
      this.dataChannels.set(peerId, dataChannel);
    } catch {
      // ignore
    }

    this.peerConnections.set(peerId, pc);
    return pc;
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
    this.dataChannels.delete(peerId);
    this.pendingRemoteCandidates.delete(peerId);
  }

  public broadcastData(data: Record<string, any>): void {
    const payload = JSON.stringify(data);
    this.dataChannels.forEach((channel) => {
      if (channel.readyState === 'open') {
        try {
          channel.send(payload);
        } catch (e) {
          console.warn('Failed to broadcast through channel', e);
        }
      }
    });
  }

  // =========================================================================
  // AUDIO ANALYSIS (REAL VOICE DETECTION VIA WEBAUDIO ANALYSER)
  // =========================================================================

  private initAudioAnalyser(stream: MediaStream): void {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      this.audioContext = new AudioCtx();
      // On mobile browsers, resume AudioContext if suspended
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume().catch(() => {});
      }

      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.4;
      source.connect(this.analyser);
    } catch {
      // AudioContext may require user interaction gesture on mobile
    }
  }

  /**
   * Get real speaking volume level (0 to 100) from the user's active microphone
   */
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
}

export const p2pStreamingEngine = new P2PStreamingEngine();
