import { auth } from './firebase';
import { agoraPartyNative } from './agoraPartyNative';

type PartyProfile = { userId: string; uniqueId?: string; displayName?: string; avatar?: string; level?: number; vipTier?: number; countryFlag?: string; isHost?: boolean };
type PartyPresence = { userId: string; uniqueId: string; displayName: string; avatar: string; level: number; vipTier: number; countryFlag?: string; isHost: boolean; joinedAtMs: number; sfuSessionId: string; trackName: string | null; mid: string | null; isPublishing: boolean; listenOnly: boolean; isMuted: boolean; isSpeaking: boolean; lastSeenAtMs: number };
type PartyCallbacks = { onError?: (e: any) => void; onConnectionStateChange?: (s: string) => void; onParticipantJoined?: (p: any) => void; onParticipantLeft?: (p: any) => void; onParticipantsChange?: (p: PartyPresence[]) => void };

/** Party-only Agora transport. WebRTC remains reserved for Solo Live. */
class AgoraPartyEngine {
  private roomId: string | null = null;
  private muted = true;
  private volume = 0;
  private localVolume = 0;
  private listeners: Array<{ remove: () => Promise<void> }> = [];
  private callbacks: PartyCallbacks = {};
  private initialized = false;

  async startPartyVoice(roomId: string, userId: string, isMuted: boolean, listenOnly: boolean, options: { profile?: PartyProfile; roomParticipants?: PartyProfile[]; onError?: (e: any) => void; onConnectionStateChange?: (s: string) => void; onParticipantJoined?: (p: any) => void; onParticipantLeft?: (p: any) => void; onParticipantsChange?: (p: PartyPresence[]) => void } = {}) {
    if (!agoraPartyNative.isAvailable()) throw Object.assign(new Error('Native Agora Party voice is available in the Android app only.'), { code: 'AGORA_ANDROID_REQUIRED' });
    // A reconnect must leave the previous channel and detach old listeners before joining again.
    await this.stopPartyVoice(undefined, true);
    const user = auth.currentUser;
    if (!user) throw new Error('Sign in is required before joining Party voice.');
    this.callbacks = options;
    const configuredBase = String((import.meta as any).env?.VITE_RAILWAY_API_URL || '').trim();
    const base = (/^https?:\/\//i.test(configuredBase) ? configuredBase : 'https://api.alphamate.app').replace(/\/$/, '');
    const idToken = await user.getIdToken();
    const response = await fetch(`${base}/api/agora/party/rooms/${encodeURIComponent(roomId)}/token`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ wantPublish: !listenOnly, mode: listenOnly ? 'pk_listen' : 'party' }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.success) throw Object.assign(new Error(payload?.error || 'Unable to obtain Agora Party token.'), { code: payload?.code || 'AGORA_TOKEN_FAILED', status: response.status });
    await agoraPartyNative.initialize(payload.appId);
    this.initialized = true;
    this.listeners.forEach(x => x.remove().catch(() => {}));
    const remoteUsers = new Map<number, PartyPresence>();
    const profileByAgoraUid = new Map<number, PartyProfile>();
    for (const profile of options.roomParticipants || []) profileByAgoraUid.set(this.toAgoraUid(profile.userId), profile);
    if (options.profile?.userId) profileByAgoraUid.set(this.toAgoraUid(options.profile.userId), options.profile);
    this.listeners = [
      await agoraPartyNative.addListener('joined', () => this.callbacks.onConnectionStateChange?.('connected')),
      await agoraPartyNative.addListener('connectionState', e => this.callbacks.onConnectionStateChange?.(e.state === 3 ? 'connected' : e.state === 5 ? 'disconnected' : e.state === 1 ? 'connecting' : 'failed')),
      await agoraPartyNative.addListener('userJoined', e => { const now = Date.now(); const numericUid = Number(e.uid); const profile = profileByAgoraUid.get(numericUid); const id = profile?.userId || String(e.uid); remoteUsers.set(numericUid, { userId: id, uniqueId: profile?.uniqueId || id, displayName: profile?.displayName || 'Party Member', avatar: profile?.avatar || '', level: profile?.level || 1, vipTier: profile?.vipTier || 1, countryFlag: profile?.countryFlag, isHost: Boolean(profile?.isHost), joinedAtMs: now, sfuSessionId: `agora:${roomId}`, trackName: 'audio', mid: null, isPublishing: true, listenOnly: false, isMuted: false, isSpeaking: false, lastSeenAtMs: now }); this.callbacks.onParticipantsChange?.(Array.from(remoteUsers.values())); this.callbacks.onParticipantJoined?.({ uid: id }); }),
      await agoraPartyNative.addListener('userOffline', e => { remoteUsers.delete(Number(e.uid)); this.callbacks.onParticipantsChange?.(Array.from(remoteUsers.values())); this.callbacks.onParticipantLeft?.({ uid: String(e.uid) }); }),
      await agoraPartyNative.addListener('audioVolume', e => { const allSpeakers = (e.speakers || []); const local = allSpeakers.find((x: any) => Number(x.uid) === 0); this.localVolume = Number(local?.volume) || 0; const speakers = allSpeakers.filter((x: any) => Number(x.uid) > 0); const active = new Set(speakers.filter((x: any) => Number(x.volume) > 12).map((x: any) => Number(x.uid))); let changed = false; remoteUsers.forEach((presence, uid) => { const speaking = active.has(uid); if (presence.isSpeaking !== speaking) { presence.isSpeaking = speaking; presence.lastSeenAtMs = Date.now(); changed = true; } }); if (changed) this.callbacks.onParticipantsChange?.(Array.from(remoteUsers.values())); }),
      await agoraPartyNative.addListener('error', e => this.callbacks.onError?.(e)),
    ];
    this.roomId = roomId;
    this.callbacks.onParticipantsChange?.([]);
    this.muted = isMuted || listenOnly || !payload.canPublish;
    await agoraPartyNative.join(payload.channelName, payload.token, Number(payload.uid), Boolean(payload.canPublish));
    if (this.muted) await agoraPartyNative.setMuted(true);
  }

  private toAgoraUid(firebaseUid: string): number {
    let hash = 2166136261;
    for (let i = 0; i < firebaseUid.length; i++) { hash ^= firebaseUid.charCodeAt(i); hash = Math.imul(hash, 16777619); }
    return (hash & 0x7fffffff) || 1;
  }

  async setPartySpeakingMode(roomId: string, userId: string, canSpeak: boolean, muted: boolean, _profile?: PartyProfile) {
    if (this.roomId !== roomId) return;
    // Refresh the server-issued token whenever the user's publish privilege changes.
    const user = auth.currentUser;
    if (!user) throw new Error('Sign in is required to update Party microphone permissions.');
    const configuredBase = String((import.meta as any).env?.VITE_RAILWAY_API_URL || '').trim();
    const base = (/^https?:\/\//i.test(configuredBase) ? configuredBase : 'https://api.alphamate.app').replace(/\/$/, '');
    const idToken = await user.getIdToken();
    const response = await fetch(`${base}/api/agora/party/rooms/${encodeURIComponent(roomId)}/token`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` }, body: JSON.stringify({ wantPublish: canSpeak, mode: 'party' }) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.success) throw Object.assign(new Error(payload?.error || 'Unable to refresh Agora Party permissions.'), { code: payload?.code || 'AGORA_TOKEN_REFRESH_FAILED', status: response.status });
    await agoraPartyNative.setCanPublish(canSpeak);
    await agoraPartyNative.renewToken(payload.token);
    await agoraPartyNative.setMuted(!canSpeak || muted); this.muted = !canSpeak || muted;
  }
  async stopPartyVoice(roomId?: string, _force = false) { if (roomId && this.roomId && roomId !== this.roomId) return; try { await agoraPartyNative.leave(); } finally { this.roomId = null; this.volume = 0; this.localVolume = 0; this.listeners.forEach(x => x.remove().catch(() => {})); this.listeners = []; this.callbacks = {}; } }
  setSpeaker(enabled: boolean) { return agoraPartyNative.setSpeaker(enabled); }
  toggleMicrophone(enabled: boolean) { this.muted = !enabled; return agoraPartyNative.setMuted(!enabled).catch(() => ({ muted: !enabled })); }
  updatePartySpeakingIndicator(_roomId: string, _speaking: boolean) { /* Presence is synchronized through the existing room data/socket layer. */ }
  getSpeakingVolume() { return this.localVolume; }
  getActivePartyRemoteStreams(_roomId: string): Array<{ peerId: string; stream: MediaStream }> { return []; }
  async getPartyRemoteAudioActivity(_roomId: string) { return new Set<string>(); }
  async setPartyVoiceFilter(_roomId: string, _preset: string): Promise<any> { return 'normal'; }
}

export const agoraPartyEngine = new AgoraPartyEngine();
