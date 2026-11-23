import { Capacitor } from '@capacitor/core';
import { auth } from './firebase';
import { agoraPartyNative } from './agoraPartyNative';
import { audioFilter, VoiceFilterPresetId } from './audioFilter';
import type { PartyParticipantPresence } from './webrtcService';

export type PartyProfile = {
  userId: string;
  uniqueId?: string;
  displayName?: string;
  avatar?: string;
  level?: number;
  vipTier?: number;
  countryFlag?: string;
  isHost?: boolean;
};

export type PartyCallbacks = {
  onError?: (e: any) => void;
  onConnectionStateChange?: (state: string, meta?: { attempt?: number; maxAttempts?: number; reason?: string }) => void;
  onParticipantJoined?: (p: any) => void;
  onParticipantLeft?: (p: any) => void;
  onParticipantsChange?: (p: PartyParticipantPresence[]) => void;
  onSpeakingChange?: (localSpeaking: boolean, remoteSpeakingIds: Set<string>) => void;
};

type StartOptions = PartyCallbacks & {
  profile?: PartyProfile;
  roomParticipants?: PartyProfile[];
};

const MAX_RECONNECT_ATTEMPTS = 5;
const TOKEN_FETCH_TIMEOUT_MS = 10_000;
const SPEAKING_HOLD_MS = 450;
const NATIVE_SPEAKING_VOLUME_THRESHOLD = 28; // 0..255 Agora Android scale (filters ambient room hum)
const WEB_SPEAKING_VOLUME_THRESHOLD = 8; // 0..100 Agora Web SDK scale

/**
 * Dedicated Party-Room-only Agora RTC transport engine.
 * - Android native APK runs on `AgoraPartyPlugin` (`io.agora.rtc:full-sdk:4.7.0`).
 * - Web browsers/preview fallback dynamically to `agora-rtc-sdk-ng` on the same channel & UID.
 * - Solo Live & Solo PK remain exclusively on WebRTC (`webrtcService.ts`).
 */
class AgoraPartyEngine {
  private roomId: string | null = null;
  private userId: string | null = null;
  private muted = true;
  private canPublish = false;
  private listenOnly = true;
  private speakerEnabled = true;
  private localVolume = 0;
  private localSpeakingUntilMs = 0;

  private listeners: Array<{ remove: () => Promise<void> }> = [];
  private callbacks: PartyCallbacks = {};
  private currentOptions: StartOptions = {};

  private profileByAgoraUid = new Map<number, PartyProfile>();
  private remoteUsers = new Map<number, PartyPresenceRecord>();
  private remoteMutedByUid = new Map<number, boolean>();
  private remoteSpeakingUntilMs = new Map<number, number>();
  private lastEmittedLocalSpeaking = false;
  private speakingSweepTimer: ReturnType<typeof setInterval> | null = null;

  private manualStop = false;
  private opQueue: Promise<void> = Promise.resolve();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private inflightTokenRefresh: Promise<string | null> | null = null;
  private activeVoicePreset: VoiceFilterPresetId = 'normal';
  private networkStats = {
    txQuality: 0,
    rxQuality: 0,
    rttMs: null as number | null,
    connectionState: 'idle',
    updatedAtMs: 0,
  };

  // Web Agora fallback state (used only when NOT running in native Android Capacitor)
  private webClient: any = null;
  private webLocalAudioTrack: any = null;
  private webRawMicStream: MediaStream | null = null;
  private webJoined = false;
  private webRemoteAudioTracks = new Map<number, any>();

  private enqueueOp<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.opQueue.then(fn, fn);
    this.opQueue = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }

  public getResolvedApiBase(): string {
    const configuredBase = String((import.meta as any).env?.VITE_RAILWAY_API_URL || '').trim();
    if (/^https?:\/\//i.test(configuredBase)) {
      return configuredBase.replace(/\/$/, '');
    }
    if (Capacitor.isNativePlatform()) {
      return 'https://api.alphamate.app';
    }
    if (typeof window !== 'undefined') {
      const host = window.location.hostname || '';
      if (
        host === 'localhost' ||
        host === '127.0.0.1' ||
        host.endsWith('.run.app') ||
        host.endsWith('.alphamate.app')
      ) {
        return window.location.origin.replace(/\/$/, '');
      }
    }
    return 'https://api.alphamate.app';
  }

  private toAgoraUid(firebaseUid: string): number {
    const raw = String(firebaseUid || 'anon');
    let hash = 2166136261;
    for (let i = 0; i < raw.length; i++) {
      hash ^= raw.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash & 0x7fffffff) || 1;
  }

  private async fetchPartyToken(roomId: string, wantPublish: boolean, forceRefreshIdToken = false) {
    const user = auth.currentUser;
    if (!user) {
      throw Object.assign(new Error('Sign in is required before joining Party voice.'), {
        code: 'AUTH_REQUIRED',
        nonRetryable: true,
      });
    }

    const base = this.getResolvedApiBase();
    const idToken = await user.getIdToken(forceRefreshIdToken);
    let response: Response;
    const abortController = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutHandle = abortController
      ? setTimeout(() => abortController.abort(), TOKEN_FETCH_TIMEOUT_MS)
      : null;
    try {
      response = await fetch(`${base}/api/agora/party/rooms/${encodeURIComponent(roomId)}/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          wantPublish,
          mode: !wantPublish ? 'pk_listen' : 'party',
        }),
        signal: abortController?.signal,
      });
    } catch (networkErr: any) {
      const isTimeout = networkErr?.name === 'AbortError';
      throw Object.assign(
        new Error(
          isTimeout
            ? 'Party Voice server timed out. Retrying connection…'
            : `Unable to reach Party Voice server (${networkErr?.message || 'network offline'}).`
        ),
        { code: 'AGORA_BACKEND_UNREACHABLE' }
      );
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    }

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.success) {
      const code = payload?.code || 'AGORA_TOKEN_FAILED';
      const nonRetryable =
        response.status === 401 ||
        response.status === 403 ||
        response.status === 404 ||
        code === 'AGORA_NOT_CONFIGURED' ||
        code === 'USER_RESTRICTED' ||
        code === 'ROOM_NOT_FOUND';
      throw Object.assign(
        new Error(payload?.error || 'Unable to obtain Agora Party token.'),
        { code, status: response.status, nonRetryable }
      );
    }

    return payload as {
      appId: string;
      channelName: string;
      uid: number;
      token: string;
      canPublish: boolean;
    };
  }

  public syncRoomParticipants(roomId: string, profiles: PartyProfile[]) {
    if (!roomId || this.roomId !== roomId) return;
    let changed = false;
    for (const profile of profiles || []) {
      if (!profile?.userId) continue;
      const numericUid = this.toAgoraUid(profile.userId);
      this.profileByAgoraUid.set(numericUid, profile);

      const existing = this.remoteUsers.get(numericUid);
      if (existing) {
        const nextDisplayName = profile.displayName || existing.displayName;
        const nextAvatar = profile.avatar || existing.avatar;
        const nextIsHost = Boolean(profile.isHost);
        if (
          existing.userId !== profile.userId ||
          existing.displayName !== nextDisplayName ||
          existing.avatar !== nextAvatar ||
          existing.isHost !== nextIsHost
        ) {
          existing.userId = profile.userId;
          existing.uniqueId = profile.uniqueId || profile.userId;
          existing.displayName = nextDisplayName;
          existing.avatar = nextAvatar;
          existing.level = Number(profile.level ?? existing.level ?? 1);
          existing.vipTier = Number(profile.vipTier ?? existing.vipTier ?? 1);
          existing.countryFlag = profile.countryFlag || existing.countryFlag;
          existing.isHost = nextIsHost;
          changed = true;
        }
      }
    }
    if (changed) {
      this.emitParticipants();
    }
  }

  private emitParticipants() {
    this.callbacks.onParticipantsChange?.(Array.from(this.remoteUsers.values()));
    this.emitSpeakingSnapshot();
  }

  private emitSpeakingSnapshot() {
    const now = Date.now();
    const localSpeaking = this.isLocalSpeaking(now);
    this.lastEmittedLocalSpeaking = localSpeaking;
    const remoteSpeakingIds = new Set<string>();
    this.remoteUsers.forEach((presence) => {
      if (presence.isSpeaking && !presence.isMuted && presence.userId) {
        remoteSpeakingIds.add(presence.userId);
      }
    });
    this.callbacks.onSpeakingChange?.(localSpeaking, remoteSpeakingIds);
  }

  private buildRemotePresence(numericUid: number, roomId: string): PartyPresenceRecord {
    const now = Date.now();
    const profile = this.profileByAgoraUid.get(numericUid);
    const id = profile?.userId || String(numericUid);
    const isKnownMuted = this.remoteMutedByUid.get(numericUid) ?? false;
    return {
      userId: id,
      uniqueId: profile?.uniqueId || id,
      displayName: profile?.displayName || 'Party Member',
      avatar: profile?.avatar || '',
      level: Number(profile?.level ?? 1),
      vipTier: Number(profile?.vipTier ?? 1),
      countryFlag: profile?.countryFlag,
      isHost: Boolean(profile?.isHost),
      joinedAtMs: now,
      sfuSessionId: `agora:${roomId}`,
      trackName: 'audio',
      mid: null,
      isPublishing: true,
      listenOnly: false,
      isMuted: isKnownMuted,
      isSpeaking: false,
      lastSeenAtMs: now,
    };
  }

  private clearSpeakingTimersAndState() {
    if (this.speakingSweepTimer) {
      clearInterval(this.speakingSweepTimer);
      this.speakingSweepTimer = null;
    }
    this.localVolume = 0;
    this.localSpeakingUntilMs = 0;
    this.lastEmittedLocalSpeaking = false;
    this.remoteSpeakingUntilMs.clear();
  }

  private startSpeakingSweep() {
    if (this.speakingSweepTimer) clearInterval(this.speakingSweepTimer);
    this.speakingSweepTimer = setInterval(() => {
      const now = Date.now();
      let remoteChanged = false;
      this.remoteUsers.forEach((presence, uid) => {
        const holdUntil = this.remoteSpeakingUntilMs.get(uid) || 0;
        const shouldSpeak = !presence.isMuted && holdUntil > now;
        if (presence.isSpeaking !== shouldSpeak) {
          presence.isSpeaking = shouldSpeak;
          presence.lastSeenAtMs = now;
          remoteChanged = true;
        }
      });
      const currentLocalSpeaking = this.isLocalSpeaking(now);
      const localChanged = currentLocalSpeaking !== this.lastEmittedLocalSpeaking;
      if (remoteChanged) {
        this.emitParticipants();
      } else if (localChanged) {
        this.emitSpeakingSnapshot();
      }
    }, 180);
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private async renewSessionToken(roomId: string, forceJoinFallback = false) {
    if (this.manualStop || this.roomId !== roomId) return;
    if (!this.inflightTokenRefresh) {
      this.inflightTokenRefresh = (async () => {
        try {
          const payload = await this.fetchPartyToken(roomId, this.canPublish && !this.listenOnly, true);
          if (this.manualStop || this.roomId !== roomId) return null;
          if (agoraPartyNative.isAvailable()) {
            await agoraPartyNative.renewToken(payload.token);
          } else if (this.webClient && this.webJoined) {
            await this.webClient.renewToken(payload.token);
          }
          return payload.token;
        } catch (err) {
          if (forceJoinFallback && !this.manualStop && this.roomId === roomId) {
            this.scheduleReconnect('Token expired and renewal failed');
          }
          return null;
        } finally {
          this.inflightTokenRefresh = null;
        }
      })();
    }
    return this.inflightTokenRefresh;
  }

  private scheduleReconnect(reason: string) {
    if (this.manualStop || !this.roomId || !this.userId) return;
    if (this.reconnectTimer) return;

    const nextAttempt = this.reconnectAttempt + 1;
    if (nextAttempt > MAX_RECONNECT_ATTEMPTS) {
      this.callbacks.onConnectionStateChange?.('failed', {
        attempt: this.reconnectAttempt,
        maxAttempts: MAX_RECONNECT_ATTEMPTS,
        reason,
      });
      return;
    }

    this.reconnectAttempt = nextAttempt;
    const baseDelayMs = Math.min(20000, 1500 * Math.pow(2, nextAttempt - 1));
    const delayMs = baseDelayMs + Math.floor(Math.random() * 450);
    this.callbacks.onConnectionStateChange?.('reconnecting', {
      attempt: nextAttempt,
      maxAttempts: MAX_RECONNECT_ATTEMPTS,
      reason,
    });

    const targetRoomId = this.roomId;
    const targetUserId = this.userId;
    const targetMuted = this.muted;
    const targetListenOnly = this.listenOnly;
    const targetOptions = { ...this.currentOptions };

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.manualStop || this.roomId !== targetRoomId) return;
      this.startPartyVoiceInternal(
        targetRoomId,
        targetUserId,
        targetMuted,
        targetListenOnly,
        targetOptions,
        true
      ).catch((err: any) => {
        if (this.manualStop || this.roomId !== targetRoomId) return;
        if (err?.nonRetryable) {
          this.callbacks.onError?.(err);
          this.callbacks.onConnectionStateChange?.('failed', {
            attempt: this.reconnectAttempt,
            maxAttempts: MAX_RECONNECT_ATTEMPTS,
            reason: err?.message || reason,
          });
          return;
        }
        this.scheduleReconnect(err?.message || 'Reconnect attempt failed');
      });
    }, delayMs);
  }

  public startPartyVoice(
    roomId: string,
    userId: string,
    isMuted: boolean,
    listenOnly: boolean,
    options: StartOptions = {}
  ): Promise<void> {
    this.manualStop = false;
    this.clearReconnectTimer();
    this.reconnectAttempt = 0;
    return this.enqueueOp(() =>
      this.startPartyVoiceInternal(roomId, userId, isMuted, listenOnly, options, false)
    );
  }

  private async startPartyVoiceInternal(
    roomId: string,
    userId: string,
    isMuted: boolean,
    listenOnly: boolean,
    options: StartOptions,
    isReconnect: boolean
  ): Promise<void> {
    await this.stopPartyVoiceInternal(undefined, true, false);
    if (this.manualStop) return;

    this.callbacks = options;
    this.currentOptions = options;
    this.roomId = roomId;
    this.userId = userId;
    this.listenOnly = listenOnly;
    this.canPublish = !listenOnly;
    this.muted = isMuted || listenOnly;

    this.profileByAgoraUid.clear();
    for (const profile of options.roomParticipants || []) {
      if (profile?.userId) {
        this.profileByAgoraUid.set(this.toAgoraUid(profile.userId), profile);
      }
    }
    if (options.profile?.userId) {
      this.profileByAgoraUid.set(this.toAgoraUid(options.profile.userId), options.profile);
    }

    const payload = await this.fetchPartyToken(roomId, !listenOnly, isReconnect);
    if (this.manualStop || this.roomId !== roomId) return;

    this.canPublish = Boolean(payload.canPublish) && !listenOnly;
    this.muted = isMuted || !this.canPublish;

    if (agoraPartyNative.isAvailable()) {
      await this.startNativeAndroidAgora(roomId, payload);
    } else {
      await this.startWebAgoraFallback(roomId, payload);
    }

    if (this.activeVoicePreset !== 'normal') {
      await this.setPartyVoiceFilter(roomId, this.activeVoicePreset).catch(() => {});
    }
    this.startSpeakingSweep();
    this.callbacks.onParticipantsChange?.([]);
  }

  private async startNativeAndroidAgora(
    roomId: string,
    payload: { appId: string; channelName: string; uid: number; token: string; canPublish: boolean }
  ) {
    await agoraPartyNative.initialize(payload.appId);
    if (this.manualStop || this.roomId !== roomId) return;

    this.listeners.forEach((x) => x.remove().catch(() => {}));
    this.listeners = [
      await agoraPartyNative.addListener('joined', () => {
        if (this.manualStop || this.roomId !== roomId) return;
        this.reconnectAttempt = 0;
        this.clearReconnectTimer();
        agoraPartyNative.setSpeaker(this.speakerEnabled).catch(() => {});
        agoraPartyNative.setMuted(this.muted).catch(() => {});
        this.callbacks.onConnectionStateChange?.('connected');
      }),
      await agoraPartyNative.addListener('connectionState', (e) => {
        if (this.manualStop || this.roomId !== roomId) return;
        const state = Number(e?.state);
        const reason = Number(e?.reason);
        // Agora Constants: 1=DISCONNECTED, 2=CONNECTING, 3=CONNECTED, 4=RECONNECTING, 5=FAILED
        if (state === 3) {
          this.reconnectAttempt = 0;
          this.clearReconnectTimer();
          this.networkStats.connectionState = 'connected';
          this.callbacks.onConnectionStateChange?.('connected');
          return;
        }
        if (state === 2) {
          this.networkStats.connectionState = 'connecting';
          this.callbacks.onConnectionStateChange?.('connecting');
          return;
        }
        if (state === 4) {
          this.networkStats.connectionState = 'reconnecting';
          this.callbacks.onConnectionStateChange?.('reconnecting');
          return;
        }
        // Token expired / invalid token reasons (8 or 9) -> renew or rejoin
        if (reason === 8 || reason === 9) {
          void this.renewSessionToken(roomId, true);
          return;
        }
        // 5 = CONNECTION_CHANGED_LEAVE_CHANNEL (expected on stop/leave)
        if (state === 1 && reason === 5) {
          return;
        }
        if (state === 1 || state === 5) {
          this.networkStats.connectionState = 'disconnected';
          this.scheduleReconnect(`Agora connection state ${state} (reason ${reason})`);
        }
      }),
      await agoraPartyNative.addListener('networkQuality', (e) => {
        if (this.manualStop || this.roomId !== roomId) return;
        const tx = Number(e?.txQuality ?? 0);
        const rx = Number(e?.rxQuality ?? 0);
        const rtt = typeof e?.rttMs === 'number' && e.rttMs >= 0 ? Math.round(e.rttMs) : null;
        this.networkStats = {
          txQuality: Number.isFinite(tx) ? tx : 0,
          rxQuality: Number.isFinite(rx) ? rx : 0,
          rttMs: rtt ?? this.networkStats.rttMs,
          connectionState: this.networkStats.connectionState === 'idle' ? 'connected' : this.networkStats.connectionState,
          updatedAtMs: Date.now(),
        };
      }),
      await agoraPartyNative.addListener('tokenWillExpire', () => {
        void this.renewSessionToken(roomId, true);
      }),
      await agoraPartyNative.addListener('requestToken', () => {
        void this.renewSessionToken(roomId, true);
      }),
      await agoraPartyNative.addListener('userJoined', (e) => {
        if (this.roomId !== roomId) return;
        const numericUid = Number(e.uid);
        if (!numericUid) return;
        const presence = this.buildRemotePresence(numericUid, roomId);
        this.remoteUsers.set(numericUid, presence);
        this.emitParticipants();
        this.callbacks.onParticipantJoined?.({ uid: presence.userId });
      }),
      await agoraPartyNative.addListener('userOffline', (e) => {
        if (this.roomId !== roomId) return;
        const numericUid = Number(e.uid);
        const existing = this.remoteUsers.get(numericUid);
        this.remoteUsers.delete(numericUid);
        this.remoteMutedByUid.delete(numericUid);
        this.remoteSpeakingUntilMs.delete(numericUid);
        this.emitParticipants();
        this.callbacks.onParticipantLeft?.({ uid: existing?.userId || String(e.uid) });
      }),
      await agoraPartyNative.addListener('userMuteAudio', (e) => {
        if (this.roomId !== roomId) return;
        const numericUid = Number(e.uid);
        const isPeerMuted = Boolean(e.muted);
        this.remoteMutedByUid.set(numericUid, isPeerMuted);
        const presence = this.remoteUsers.get(numericUid);
        if (presence) {
          let dirty = false;
          if (presence.isMuted !== isPeerMuted) {
            presence.isMuted = isPeerMuted;
            dirty = true;
          }
          if (isPeerMuted && presence.isSpeaking) {
            presence.isSpeaking = false;
            this.remoteSpeakingUntilMs.delete(numericUid);
            dirty = true;
          }
          if (dirty) {
            presence.lastSeenAtMs = Date.now();
            this.emitParticipants();
          }
        }
      }),
      await agoraPartyNative.addListener('audioVolume', (e) => {
        if (this.roomId !== roomId) return;
        const now = Date.now();
        const allSpeakers: Array<{ uid: number; volume: number; vad?: number }> = Array.isArray(e?.speakers)
          ? e.speakers
          : [];

        const localEntry = allSpeakers.find((x) => Number(x.uid) === 0);
        const localVol = Number(localEntry?.volume) || 0;
        const localVad = localEntry?.vad;
        this.localVolume = this.muted || !this.canPublish ? 0 : localVol;
        if (
          !this.muted &&
          this.canPublish &&
          (localVol >= NATIVE_SPEAKING_VOLUME_THRESHOLD || (localVad === 1 && localVol >= 16))
        ) {
          this.localSpeakingUntilMs = now + SPEAKING_HOLD_MS;
        } else if (this.muted || !this.canPublish) {
          this.localSpeakingUntilMs = 0;
        }

        let changed = false;
        for (const s of allSpeakers) {
          const uid = Number(s.uid);
          if (uid <= 0) continue;
          const vol = Number(s.volume) || 0;
          if (!this.remoteUsers.has(uid)) {
            this.remoteUsers.set(uid, this.buildRemotePresence(uid, roomId));
            changed = true;
          }
          const presence = this.remoteUsers.get(uid)!;
          if (!presence.isMuted && vol >= NATIVE_SPEAKING_VOLUME_THRESHOLD) {
            this.remoteSpeakingUntilMs.set(uid, now + SPEAKING_HOLD_MS);
            if (!presence.isSpeaking) {
              presence.isSpeaking = true;
              presence.lastSeenAtMs = now;
              changed = true;
            }
          }
        }

        if (changed) {
          this.emitParticipants();
        } else {
          this.emitSpeakingSnapshot();
        }
      }),
      await agoraPartyNative.addListener('error', (e) => {
        if (this.manualStop || this.roomId !== roomId) return;
        const code = Number(e?.code);
        if (code === 109 || code === 110 || code === 119) {
          void this.renewSessionToken(roomId, true);
          return;
        }
        // Ignore non-fatal audio warnings; trigger reconnect only on fatal/connection errors
        if (code === 17 || code === 101 || code === 102) {
          this.scheduleReconnect(`Agora native error code ${code}`);
        } else {
          this.callbacks.onError?.(e);
        }
      }),
    ];

    try {
      await agoraPartyNative.join(
        payload.channelName,
        payload.token,
        Number(payload.uid),
        Boolean(payload.canPublish)
      );
      await agoraPartyNative.setSpeaker(this.speakerEnabled);
      if (this.muted) {
        await agoraPartyNative.setMuted(true);
      }
    } catch (err: any) {
      if (err?.code === 'MIC_PERMISSION_REQUIRED') {
        // Fallback: stay inside room as listen-only subscriber if mic permission was denied
        this.canPublish = false;
        this.muted = true;
        await agoraPartyNative.join(payload.channelName, payload.token, Number(payload.uid), false);
        await agoraPartyNative.setMuted(true);
        throw err;
      }
      throw err;
    }
  }

  private async startWebAgoraFallback(
    roomId: string,
    payload: { appId: string; channelName: string; uid: number; token: string; canPublish: boolean }
  ) {
    const mod = await import('agora-rtc-sdk-ng');
    const AgoraRTC = mod.default || mod;
    if (this.manualStop || this.roomId !== roomId) return;

    try {
      AgoraRTC.setLogLevel?.(3);
    } catch {
      // ignore
    }

    const client = AgoraRTC.createClient({ mode: 'live', codec: 'vp8' });
    this.webClient = client;

    client.on('connection-state-change', (curState: string, _revState: string, reason?: string) => {
      if (this.manualStop || this.roomId !== roomId) return;
      if (curState === 'CONNECTED') {
        this.reconnectAttempt = 0;
        this.clearReconnectTimer();
        this.networkStats.connectionState = 'connected';
        this.callbacks.onConnectionStateChange?.('connected');
      } else if (curState === 'CONNECTING') {
        this.networkStats.connectionState = 'connecting';
        this.callbacks.onConnectionStateChange?.('connecting');
      } else if (curState === 'RECONNECTING') {
        this.networkStats.connectionState = 'reconnecting';
        this.callbacks.onConnectionStateChange?.('reconnecting');
      } else if (curState === 'DISCONNECTED') {
        this.networkStats.connectionState = 'disconnected';
        if (reason !== 'LEAVE') {
          this.scheduleReconnect(`Web Agora disconnected (${reason || 'network'})`);
        }
      }
    });

    client.on('network-quality', (stats: { uplinkNetworkQuality?: number; downlinkNetworkQuality?: number }) => {
      if (this.manualStop || this.roomId !== roomId) return;
      let measuredRtt: number | null = null;
      try {
        const rtcStats = client.getRTCStats?.();
        if (typeof rtcStats?.RTT === 'number' && Number.isFinite(rtcStats.RTT) && rtcStats.RTT >= 0) {
          measuredRtt = Math.round(rtcStats.RTT);
        }
      } catch {
        // ignore
      }
      this.networkStats = {
        txQuality: Number(stats?.uplinkNetworkQuality ?? 0),
        rxQuality: Number(stats?.downlinkNetworkQuality ?? 0),
        rttMs: measuredRtt ?? this.networkStats.rttMs,
        connectionState: this.networkStats.connectionState === 'idle' ? 'connected' : this.networkStats.connectionState,
        updatedAtMs: Date.now(),
      };
    });

    client.on('token-privilege-will-expire', () => {
      void this.renewSessionToken(roomId, true);
    });
    client.on('token-privilege-did-expire', () => {
      void this.renewSessionToken(roomId, true);
    });

    client.on('user-joined', (user: any) => {
      if (this.roomId !== roomId) return;
      const numericUid = Number(user.uid);
      if (!numericUid) return;
      const presence = this.buildRemotePresence(numericUid, roomId);
      this.remoteUsers.set(numericUid, presence);
      this.emitParticipants();
      this.callbacks.onParticipantJoined?.({ uid: presence.userId });
    });

    client.on('user-left', (user: any) => {
      if (this.roomId !== roomId) return;
      const numericUid = Number(user.uid);
      const existing = this.remoteUsers.get(numericUid);
      this.remoteUsers.delete(numericUid);
      this.remoteMutedByUid.delete(numericUid);
      this.remoteSpeakingUntilMs.delete(numericUid);
      this.webRemoteAudioTracks.delete(numericUid);
      this.emitParticipants();
      this.callbacks.onParticipantLeft?.({ uid: existing?.userId || String(user.uid) });
    });

    client.on('user-published', async (user: any, mediaType: string) => {
      if (mediaType !== 'audio' || this.roomId !== roomId) return;
      await client.subscribe(user, 'audio').catch(() => {});
      const numericUid = Number(user.uid);
      this.remoteMutedByUid.set(numericUid, false);
      const track = user.audioTrack;
      if (track) {
        this.webRemoteAudioTracks.set(numericUid, track);
        try {
          track.setVolume(this.speakerEnabled ? 100 : 0);
          track.play();
        } catch {
          // autoplay may need gesture
        }
      }
      const presence = this.remoteUsers.get(numericUid) || this.buildRemotePresence(numericUid, roomId);
      presence.isMuted = false;
      presence.isPublishing = true;
      this.remoteUsers.set(numericUid, presence);
      this.emitParticipants();
    });

    client.on('user-unpublished', (user: any, mediaType: string) => {
      if (mediaType !== 'audio' || this.roomId !== roomId) return;
      const numericUid = Number(user.uid);
      this.remoteMutedByUid.set(numericUid, true);
      this.remoteSpeakingUntilMs.delete(numericUid);
      this.webRemoteAudioTracks.delete(numericUid);
      const presence = this.remoteUsers.get(numericUid);
      if (presence) {
        presence.isMuted = true;
        presence.isSpeaking = false;
        this.emitParticipants();
      }
    });

    client.enableAudioVolumeIndicator?.();
    client.on('volume-indicator', (volumes: Array<{ uid: number; level: number }>) => {
      if (this.roomId !== roomId) return;
      const now = Date.now();
      let changed = false;
      for (const v of volumes || []) {
        const uid = Number(v.uid);
        const level = Number(v.level) || 0;
        if (uid === 0 || uid === Number(payload.uid)) {
          this.localVolume = this.muted || !this.canPublish ? 0 : Math.min(255, Math.round(level * 2.55));
          if (!this.muted && this.canPublish && level >= WEB_SPEAKING_VOLUME_THRESHOLD) {
            this.localSpeakingUntilMs = now + SPEAKING_HOLD_MS;
          }
          continue;
        }
        const presence = this.remoteUsers.get(uid);
        if (presence && !presence.isMuted && level >= WEB_SPEAKING_VOLUME_THRESHOLD) {
          this.remoteSpeakingUntilMs.set(uid, now + SPEAKING_HOLD_MS);
          if (!presence.isSpeaking) {
            presence.isSpeaking = true;
            presence.lastSeenAtMs = now;
            changed = true;
          }
        }
      }
      if (changed) {
        this.emitParticipants();
      } else {
        this.emitSpeakingSnapshot();
      }
    });

    await client.setClientRole(payload.canPublish ? 'host' : 'audience');
    await client.join(payload.appId, payload.channelName, payload.token, Number(payload.uid));
    this.webJoined = true;

    if (payload.canPublish) {
      try {
        const micTrack = await this.createWebPublishedAudioTrack(AgoraRTC, this.activeVoicePreset);
        if (this.manualStop || this.roomId !== roomId || !this.canPublish) {
          try {
            micTrack.stop();
            micTrack.close();
          } catch {
            // ignore
          }
          this.releaseWebRawMicStream();
          await this.switchWebClientToAudience(roomId, payload).catch(() => {});
          return;
        }
        this.webLocalAudioTrack = micTrack;
        await micTrack.setMuted(this.muted);
        await client.publish([micTrack]);
      } catch (micErr: any) {
        this.canPublish = false;
        this.muted = true;
        await this.unpublishAndCloseWebLocalAudioTrack();
        await client.setClientRole('audience').catch(() => {});
        throw Object.assign(new Error(micErr?.message || 'Microphone access denied.'), {
          code: 'MIC_PERMISSION_REQUIRED',
          name: micErr?.name || 'NotAllowedError',
          nonRetryable: true,
        });
      }
    }

    this.callbacks.onConnectionStateChange?.('connected');
  }

  public resumeAudioPlayback() {
    if (agoraPartyNative.isAvailable()) return;
    this.webRemoteAudioTracks.forEach((track) => {
      try {
        track.setVolume(this.speakerEnabled ? 100 : 0);
        track.play();
      } catch {
        // ignore autoplay errors until next gesture
      }
    });
  }

  /**
   * Called when the device regains network connectivity or returns to foreground.
   * Resumes remote audio playback and heals disconnected voice sessions without
   * disturbing healthy active calls.
   */
  public recoverConnectionIfNeeded(roomId: string, reason = 'Network recovery') {
    if (this.manualStop || !roomId || this.roomId !== roomId || !this.userId) return;
    this.resumeAudioPlayback();

    const connState = this.networkStats.connectionState;
    const isDisconnected =
      connState === 'disconnected' ||
      connState === 'failed' ||
      (!agoraPartyNative.isAvailable() && this.webClient !== null && !this.webJoined);

    if (isDisconnected && !this.reconnectTimer) {
      this.reconnectAttempt = 0;
      this.scheduleReconnect(reason);
    }
  }

  public setPartySpeakingMode(
    roomId: string,
    userId: string,
    canSpeak: boolean,
    muted: boolean,
    profile?: PartyProfile
  ): Promise<void> {
    return this.enqueueOp(() =>
      this.setPartySpeakingModeInternal(roomId, userId, canSpeak, muted, profile)
    );
  }

  private async setPartySpeakingModeInternal(
    roomId: string,
    _userId: string,
    canSpeak: boolean,
    muted: boolean,
    _profile?: PartyProfile
  ) {
    if (this.roomId !== roomId || this.manualStop) return;
    this.listenOnly = !canSpeak;
    this.canPublish = canSpeak;
    this.muted = !canSpeak || muted;
    if (this.muted) {
      this.localVolume = 0;
      this.localSpeakingUntilMs = 0;
    }

    let payload = await this.fetchPartyToken(roomId, canSpeak, false);
    if (canSpeak && !payload.canPublish && this.roomId === roomId && !this.manualStop) {
      for (let retry = 1; retry <= 2; retry += 1) {
        await new Promise((resolve) => setTimeout(resolve, 250 * retry));
        if (this.roomId !== roomId || this.manualStop) return;
        payload = await this.fetchPartyToken(roomId, true, false);
        if (payload.canPublish) break;
      }
    }
    if (this.roomId !== roomId || this.manualStop) return;

    const effectiveCanSpeak = canSpeak && Boolean(payload.canPublish);
    this.canPublish = effectiveCanSpeak;
    this.listenOnly = !effectiveCanSpeak;
    this.muted = !effectiveCanSpeak || muted;

    if (agoraPartyNative.isAvailable()) {
      await agoraPartyNative.setCanPublish(effectiveCanSpeak);
      await agoraPartyNative.renewToken(payload.token);
      await agoraPartyNative.setMuted(this.muted);
    } else if (this.webClient && this.webJoined) {
      const mod = await import('agora-rtc-sdk-ng');
      const AgoraRTC = mod.default || mod;

      if (effectiveCanSpeak) {
        await this.webClient.renewToken(payload.token).catch(() => {});
        await this.webClient.setClientRole('host');
        if (this.roomId !== roomId || this.manualStop) return;

        if (!this.webLocalAudioTrack) {
          try {
            this.webLocalAudioTrack = await this.createWebPublishedAudioTrack(
              AgoraRTC,
              this.activeVoicePreset
            );
          } catch (micErr: any) {
            this.canPublish = false;
            this.muted = true;
            await this.unpublishAndCloseWebLocalAudioTrack();
            await this.webClient.setClientRole('audience').catch(() => {});
            throw Object.assign(new Error(micErr?.message || 'Microphone permission denied.'), {
              code: 'MIC_PERMISSION_REQUIRED',
              name: micErr?.name || 'NotAllowedError',
              nonRetryable: true,
            });
          }
        }
        await this.webLocalAudioTrack.setMuted(this.muted);
        const alreadyPublished =
          Array.isArray(this.webClient.localTracks) &&
          this.webClient.localTracks.includes(this.webLocalAudioTrack);
        if (!alreadyPublished) {
          await this.webClient.publish([this.webLocalAudioTrack]);
        }
      } else {
        // CRITICAL: Agora Web SDK forbids setClientRole('audience') while any stream is still published.
        await this.switchWebClientToAudience(roomId, payload);
      }
    }
    this.emitSpeakingSnapshot();
  }

  private async switchWebClientToAudience(
    roomId: string,
    payload: { appId: string; channelName: string; uid: number; token: string }
  ) {
    if (!this.webClient) return;

    await this.unpublishAndCloseWebLocalAudioTrack();
    if (this.roomId !== roomId || this.manualStop || !this.webClient) return;

    try {
      await this.webClient.setClientRole('audience');
      await this.webClient.renewToken(payload.token).catch(() => {});
      return;
    } catch (err: any) {
      const msg = String(err?.message || err?.code || '');
      if (!/publishing stream|audience|INVALID_OPERATION/i.test(msg)) {
        throw err;
      }
    }

    // Retry once after letting any in-flight publish/unpublish mutex settle
    await new Promise((resolve) => setTimeout(resolve, 160));
    if (this.roomId !== roomId || this.manualStop || !this.webClient) return;
    await this.unpublishAndCloseWebLocalAudioTrack();
    if (this.roomId !== roomId || this.manualStop || !this.webClient) return;

    try {
      await this.webClient.setClientRole('audience');
      await this.webClient.renewToken(payload.token).catch(() => {});
      return;
    } catch {
      // Fallback: if Agora Web SDK _p2pChannel still holds a stale localTrackMap entry
      // (e.g. unpublish happened while reconnecting), cleanly rejoin as audience.
      if (this.roomId !== roomId || this.manualStop || !this.webClient) return;
      await this.webClient.leave().catch(() => {});
      this.webJoined = false;
      if (this.roomId !== roomId || this.manualStop || !this.webClient) return;
      await this.webClient.setClientRole('audience');
      await this.webClient.join(
        payload.appId,
        payload.channelName,
        payload.token,
        Number(payload.uid)
      );
      this.webJoined = true;
    }
  }

  private releaseWebRawMicStream() {
    if (this.webRawMicStream) {
      this.webRawMicStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      this.webRawMicStream = null;
    }
    audioFilter.dispose(false);
  }

  private async createWebPublishedAudioTrack(
    AgoraRTC: any,
    preset: VoiceFilterPresetId
  ): Promise<any> {
    if (preset === 'normal') {
      this.releaseWebRawMicStream();
      return AgoraRTC.createMicrophoneAudioTrack({
        encoderConfig: 'speech_standard',
        AEC: true,
        ANS: true,
        AGC: true,
      });
    }

    const hasLiveRawTrack = Boolean(
      this.webRawMicStream &&
        this.webRawMicStream.getAudioTracks().some((track) => track.readyState === 'live')
    );

    if (!hasLiveRawTrack) {
      if (this.webRawMicStream) {
        this.webRawMicStream.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch {
            // ignore
          }
        });
      }
      this.webRawMicStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    }

    const processedStream = await audioFilter.attachInputStream(this.webRawMicStream!, {
      preset,
      isMuted: this.muted,
    });
    const processedTrack = processedStream.getAudioTracks()[0];

    if (processedTrack && typeof AgoraRTC.createCustomAudioTrack === 'function') {
      return AgoraRTC.createCustomAudioTrack({
        mediaStreamTrack: processedTrack,
        encoderConfig: 'speech_standard',
      });
    }

    return AgoraRTC.createMicrophoneAudioTrack({
      encoderConfig: 'speech_standard',
      AEC: true,
      ANS: true,
      AGC: true,
    });
  }

  private async unpublishAndCloseWebLocalAudioTrack(keepRawMicStream = false) {
    const trackedLocal = this.webLocalAudioTrack;
    const clientTracks =
      this.webClient && Array.isArray(this.webClient.localTracks)
        ? [...this.webClient.localTracks]
        : [];

    if (this.webClient && this.webJoined) {
      // Calling unpublish() with no arguments instructs Agora SDK to unpublish ALL
      // tracks in _p2pChannel.getAllTracks(true), avoiding stale reference mismatches.
      await this.webClient.unpublish().catch(() => {});
      if (Array.isArray(this.webClient.localTracks) && this.webClient.localTracks.length > 0) {
        await this.webClient.unpublish([...this.webClient.localTracks]).catch(() => {});
      }
    }

    const toClose = new Set<any>(clientTracks);
    if (trackedLocal) toClose.add(trackedLocal);
    toClose.forEach((track) => {
      try {
        track?.stop?.();
        track?.close?.();
      } catch {
        // ignore
      }
    });
    this.webLocalAudioTrack = null;
    if (!keepRawMicStream) {
      this.releaseWebRawMicStream();
    }
  }

  public stopPartyVoice(roomId?: string, force = false): Promise<void> {
    if (roomId && this.roomId && roomId !== this.roomId && !force) {
      return Promise.resolve();
    }
    this.manualStop = true;
    this.clearReconnectTimer();
    return this.enqueueOp(() => this.stopPartyVoiceInternal(roomId, force, true));
  }

  private async stopPartyVoiceInternal(
    roomId?: string,
    force = false,
    resetCallbacks = true
  ): Promise<void> {
    if (roomId && this.roomId && roomId !== this.roomId && !force) return;
    const prevRoomId = this.roomId;

    this.clearSpeakingTimersAndState();
    this.listeners.forEach((x) => x.remove().catch(() => {}));
    this.listeners = [];
    this.remoteUsers.clear();
    this.remoteMutedByUid.clear();

    try {
      if (agoraPartyNative.isAvailable()) {
        await agoraPartyNative.leave().catch(() => {});
      } else {
        if (this.webLocalAudioTrack) {
          try {
            this.webLocalAudioTrack.stop();
            this.webLocalAudioTrack.close();
          } catch {
            // ignore
          }
          this.webLocalAudioTrack = null;
        }
        this.releaseWebRawMicStream();
        this.webRemoteAudioTracks.forEach((track) => {
          try {
            track.stop();
          } catch {
            // ignore
          }
        });
        this.webRemoteAudioTracks.clear();
        if (this.webClient) {
          try {
            if (this.webJoined) await this.webClient.leave();
            this.webClient.removeAllListeners?.();
          } catch {
            // ignore
          }
          this.webClient = null;
          this.webJoined = false;
        }
      }

      if (resetCallbacks && prevRoomId && auth.currentUser) {
        const base = this.getResolvedApiBase();
        auth.currentUser
          .getIdToken()
          .then((idToken) =>
            fetch(`${base}/api/agora/party/rooms/${encodeURIComponent(prevRoomId)}/leave`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${idToken}`,
              },
            })
          )
          .catch(() => {});
      }
    } finally {
      this.roomId = null;
      this.userId = null;
      this.canPublish = false;
      this.muted = true;
      this.networkStats = {
        txQuality: 0,
        rxQuality: 0,
        rttMs: null,
        connectionState: 'idle',
        updatedAtMs: 0,
      };
      if (resetCallbacks) {
        this.callbacks = {};
        this.currentOptions = {};
        this.profileByAgoraUid.clear();
      }
    }
  }

  public setSpeaker(enabled: boolean) {
    this.speakerEnabled = Boolean(enabled);
    if (agoraPartyNative.isAvailable()) {
      return agoraPartyNative.setSpeaker(this.speakerEnabled).catch(() => ({ enabled: this.speakerEnabled }));
    }
    this.webRemoteAudioTracks.forEach((track) => {
      try {
        track.setVolume(this.speakerEnabled ? 100 : 0);
      } catch {
        // ignore
      }
    });
    return Promise.resolve({ enabled: this.speakerEnabled });
  }

  public toggleMicrophone(enabled: boolean) {
    this.muted = !enabled || !this.canPublish;
    audioFilter.setMuted(this.muted);
    if (this.webRawMicStream) {
      this.webRawMicStream.getAudioTracks().forEach((track) => {
        track.enabled = !this.muted;
      });
    }
    if (this.muted) {
      this.localVolume = 0;
      this.localSpeakingUntilMs = 0;
      this.emitSpeakingSnapshot();
    }
    if (agoraPartyNative.isAvailable()) {
      return agoraPartyNative.setMuted(this.muted).catch(() => ({ muted: this.muted }));
    }
    if (this.webLocalAudioTrack) {
      return this.webLocalAudioTrack
        .setMuted(this.muted)
        .then(() => ({ muted: this.muted }))
        .catch(() => ({ muted: this.muted }));
    }
    return Promise.resolve({ muted: this.muted });
  }

  public updatePartySpeakingIndicator(_roomId: string, _speaking: boolean) {
    // Speaking indicators are driven strictly from real Agora audio volume callbacks.
  }

  public isLocalSpeaking(now = Date.now()): boolean {
    if (this.muted || !this.canPublish) return false;
    return this.localSpeakingUntilMs > now;
  }

  public getSpeakingVolume() {
    return this.muted || !this.canPublish ? 0 : this.localVolume;
  }

  public getActivePartyRemoteStreams(_roomId: string): Array<{ peerId: string; stream: MediaStream }> {
    return [];
  }

  public async getPartyRemoteAudioActivity(roomId: string): Promise<Set<string>> {
    const active = new Set<string>();
    if (!roomId || this.roomId !== roomId) return active;
    const now = Date.now();
    this.remoteUsers.forEach((presence, uid) => {
      const holdUntil = this.remoteSpeakingUntilMs.get(uid) || 0;
      if (!presence.isMuted && (presence.isSpeaking || holdUntil > now) && presence.userId) {
        active.add(presence.userId);
      }
    });
    return active;
  }

  public getNetworkLatencyStats(roomId: string): {
    rttMs: number | null;
    txQuality: number;
    rxQuality: number;
    connectionState: string;
    updatedAtMs: number;
  } {
    if (!roomId || this.roomId !== roomId) {
      return { rttMs: null, txQuality: 0, rxQuality: 0, connectionState: 'idle', updatedAtMs: 0 };
    }
    if (!agoraPartyNative.isAvailable() && this.webClient && this.webJoined) {
      try {
        const rtcStats = this.webClient.getRTCStats?.();
        if (typeof rtcStats?.RTT === 'number' && Number.isFinite(rtcStats.RTT) && rtcStats.RTT >= 0) {
          this.networkStats.rttMs = Math.round(rtcStats.RTT);
        }
      } catch {
        // ignore
      }
    }
    return { ...this.networkStats };
  }

  public async setPartyVoiceFilter(
    roomId: string,
    preset: VoiceFilterPresetId
  ): Promise<VoiceFilterPresetId> {
    const applied = audioFilter.setPreset(preset);
    this.activeVoicePreset = applied;

    if (agoraPartyNative.isAvailable()) {
      await agoraPartyNative.setVoiceEffect(applied).catch(() => {});
      return applied;
    }

    // If user is previewing locally while not yet publishing, update the live preview DSP chain
    if (
      !this.webClient ||
      !this.webJoined ||
      !this.canPublish ||
      this.listenOnly ||
      this.roomId !== roomId
    ) {
      if (audioFilter.isLocalMonitorActive()) {
        await audioFilter.updateStreamPreset(applied, undefined, { isMuted: false }).catch(() => {});
      }
      return applied;
    }

    // Hot-swap the live published Agora Web audio track with the real-time modulated audio stream
    await this.enqueueOp(async () => {
      if (
        this.manualStop ||
        this.roomId !== roomId ||
        !this.webClient ||
        !this.webJoined ||
        !this.canPublish ||
        this.listenOnly
      ) {
        return;
      }

      try {
        const mod = await import('agora-rtc-sdk-ng');
        const AgoraRTC = mod.default || mod;
        const keepRawMic = applied !== 'normal';

        await this.unpublishAndCloseWebLocalAudioTrack(keepRawMic);
        if (this.manualStop || this.roomId !== roomId || !this.webClient || !this.webJoined) {
          return;
        }

        const nextTrack = await this.createWebPublishedAudioTrack(AgoraRTC, applied);
        if (this.manualStop || this.roomId !== roomId || !this.webClient || !this.webJoined) {
          try {
            nextTrack?.stop?.();
            nextTrack?.close?.();
          } catch {
            // ignore
          }
          return;
        }

        this.webLocalAudioTrack = nextTrack;
        await nextTrack.setMuted(this.muted);
        await this.webClient.publish([nextTrack]);
      } catch (err) {
        console.warn('[AgoraPartyEngine] Voice filter hot-swap fallback:', err);
      }
    });

    return applied;
  }
}

type PartyPresenceRecord = PartyParticipantPresence;

export const agoraPartyEngine = new AgoraPartyEngine();
