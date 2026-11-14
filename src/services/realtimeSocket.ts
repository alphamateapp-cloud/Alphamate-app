import { auth } from './firebase';

const PRODUCTION_API_URL = 'https://api.alphamate.app';
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 25000;
const HEARTBEAT_MS = 20000;

export interface RealtimeViewerProfile {
  id: string;
  uniqueId?: string;
  username?: string;
  displayName: string;
  avatar: string;
  level?: number;
  vipTier?: number;
  countryFlag?: string;
  isVerified?: boolean;
  isHost?: boolean;
  joinedAtMs?: number;
}

export type DiscoveryEvent =
  | { type: 'discovery:snapshot'; liveStreams: any[]; partyRooms: any[] }
  | { type: 'live:upsert'; stream: any }
  | { type: 'live:remove'; streamId: string }
  | { type: 'party:upsert'; room: any }
  | { type: 'party:remove'; roomId: string };

export type RoomSocketEvent =
  | {
      type: 'room:state_init';
      roomType: 'live' | 'party';
      roomId: string;
      heartCount: number;
      viewers: RealtimeViewerProfile[];
      count: number;
    }
  | {
      type: 'room:viewers';
      roomType: 'live' | 'party';
      roomId: string;
      viewers: RealtimeViewerProfile[];
      count: number;
    }
  | {
      type: 'room:heart';
      roomType: 'live' | 'party';
      roomId: string;
      senderId: string;
      heartCount: number;
      eventId: string;
      createdAtMs: number;
    }
  | {
      type: 'room:signal';
      roomType: 'live' | 'party';
      roomId: string;
      senderId: string;
      signal: Record<string, any>;
      ts: number;
    };

function resolveBackendHttpBase(): string {
  const envUrl = ((import.meta as any).env?.VITE_RAILWAY_API_URL || '').trim();
  if (envUrl && !envUrl.includes('YOUR-RAILWAY-DOMAIN') && /^https?:\/\//i.test(envUrl)) {
    try {
      const parsed = new URL(envUrl);
      const host = parsed.hostname.toLowerCase();
      if (host !== 'localhost' && host !== '127.0.0.1' && host !== 'alphamate.app' && host !== 'www.alphamate.app') {
        return envUrl.replace(/\/$/, '');
      }
    } catch {
      // fall through
    }
  }
  return PRODUCTION_API_URL;
}

function buildWebSocketUrl(idToken: string): string {
  const httpBase = resolveBackendHttpBase();
  const wsBase = httpBase.replace(/^https:\/\//i, 'wss://').replace(/^http:\/\//i, 'ws://');
  return `${wsBase}/ws?token=${encodeURIComponent(idToken)}`;
}

class RealtimeSocketService {
  private ws: WebSocket | null = null;
  private isAuthed = false;
  private isConnecting = false;
  private manuallyDisconnected = false;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;

  private activeJoinedRoom: {
    roomType: 'live' | 'party';
    roomId: string;
    profile: RealtimeViewerProfile;
    initialHeartCount?: number;
  } | null = null;

  private pendingOutbox: Array<Record<string, any>> = [];
  private discoveryListeners = new Set<(event: DiscoveryEvent) => void>();
  private roomListeners = new Map<string, Set<(event: RoomSocketEvent) => void>>();

  public ensureConnected(): void {
    if (typeof window === 'undefined' || typeof WebSocket === 'undefined') return;
    if (!auth.currentUser) return;
    this.manuallyDisconnected = false;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    this.connectInternal().catch(() => {});
  }

  public disconnect(): void {
    this.manuallyDisconnected = true;
    this.activeJoinedRoom = null;
    this.pendingOutbox = [];
    this.clearTimers();
    if (this.ws) {
      try {
        this.ws.onopen = null;
        this.ws.onmessage = null;
        this.ws.onerror = null;
        this.ws.onclose = null;
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }
    this.isAuthed = false;
    this.isConnecting = false;
  }

  private clearTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private async connectInternal(): Promise<void> {
    if (this.isConnecting || this.manuallyDisconnected) return;
    const user = auth.currentUser;
    if (!user) return;

    this.isConnecting = true;
    try {
      const idToken = await user.getIdToken();
      if (this.manuallyDisconnected || !auth.currentUser) {
        this.isConnecting = false;
        return;
      }

      const url = buildWebSocketUrl(idToken);
      const socket = new WebSocket(url);
      this.ws = socket;
      this.isAuthed = false;

      socket.onopen = () => {
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.startPingLoop();
      };

      socket.onmessage = (event) => {
        this.handleIncomingMessage(event.data);
      };

      socket.onerror = () => {
        // Handled cleanly by onclose reconnect backoff
      };

      socket.onclose = () => {
        this.isConnecting = false;
        this.isAuthed = false;
        if (this.ws === socket) {
          this.ws = null;
        }
        if (this.pingTimer) {
          clearInterval(this.pingTimer);
          this.pingTimer = null;
        }
        if (!this.manuallyDisconnected && auth.currentUser) {
          this.scheduleReconnect();
        }
      };
    } catch {
      this.isConnecting = false;
      if (!this.manuallyDisconnected && auth.currentUser) {
        this.scheduleReconnect();
      }
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer || this.manuallyDisconnected) return;
    const delay = Math.min(
      RECONNECT_MAX_MS,
      RECONNECT_BASE_MS * Math.pow(1.7, Math.min(this.reconnectAttempts, 6))
    );
    this.reconnectAttempts += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.manuallyDisconnected && auth.currentUser) {
        this.connectInternal().catch(() => {});
      }
    }, delay);
  }

  private startPingLoop(): void {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.sendRaw({ type: 'ping' });
      }
    }, HEARTBEAT_MS);
  }

  private sendRaw(payload: Record<string, any>): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    try {
      this.ws.send(JSON.stringify(payload));
    } catch {
      // ignore
    }
  }

  private sendAuthed(payload: Record<string, any>): void {
    if (!auth.currentUser) return;
    this.ensureConnected();
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.isAuthed) {
      this.sendRaw(payload);
      return;
    }
    if (this.pendingOutbox.length < 40) {
      this.pendingOutbox.push(payload);
    }
  }

  private flushOutbox(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.isAuthed) return;
    if (this.activeJoinedRoom) {
      this.sendRaw({
        type: 'room:join',
        roomType: this.activeJoinedRoom.roomType,
        roomId: this.activeJoinedRoom.roomId,
        profile: this.activeJoinedRoom.profile,
        ...(typeof this.activeJoinedRoom.initialHeartCount === 'number'
          ? { initialHeartCount: this.activeJoinedRoom.initialHeartCount }
          : {}),
      });
    }
    const queue = this.pendingOutbox.splice(0, this.pendingOutbox.length);
    for (const msg of queue) {
      this.sendRaw(msg);
    }
  }

  private handleIncomingMessage(rawData: any): void {
    let msg: any;
    try {
      msg = JSON.parse(String(rawData));
    } catch {
      return;
    }
    if (!msg || typeof msg.type !== 'string') return;

    if (msg.type === 'auth:ok') {
      this.isAuthed = true;
      this.emitDiscovery({
        type: 'discovery:snapshot',
        liveStreams: Array.isArray(msg.liveStreams) ? msg.liveStreams : [],
        partyRooms: Array.isArray(msg.partyRooms) ? msg.partyRooms : [],
      });
      this.flushOutbox();
      return;
    }

    if (
      msg.type === 'discovery:snapshot' ||
      msg.type === 'live:upsert' ||
      msg.type === 'live:remove' ||
      msg.type === 'party:upsert' ||
      msg.type === 'party:remove'
    ) {
      this.emitDiscovery(msg as DiscoveryEvent);
      return;
    }

    if (
      msg.type === 'room:state_init' ||
      msg.type === 'room:viewers' ||
      msg.type === 'room:heart' ||
      msg.type === 'room:signal'
    ) {
      const key = `${msg.roomType}:${msg.roomId}`;
      const listeners = this.roomListeners.get(key);
      if (listeners) {
        listeners.forEach((cb) => {
          try {
            cb(msg as RoomSocketEvent);
          } catch {
            // ignore
          }
        });
      }
    }
  }

  private emitDiscovery(event: DiscoveryEvent): void {
    this.discoveryListeners.forEach((cb) => {
      try {
        cb(event);
      } catch {
        // ignore
      }
    });
  }

  public onDiscoveryUpdate(cb: (event: DiscoveryEvent) => void): () => void {
    this.discoveryListeners.add(cb);
    this.ensureConnected();
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.isAuthed) {
      this.sendRaw({ type: 'discovery:get' });
    }
    return () => {
      this.discoveryListeners.delete(cb);
    };
  }

  public announceLiveStream(stream: any): void {
    if (!stream?.id) return;
    this.sendAuthed({ type: 'live:upsert', stream });
  }

  public removeLiveStream(streamId: string): void {
    if (!streamId) return;
    this.sendAuthed({ type: 'live:remove', streamId });
  }

  public announcePartyRoom(room: any): void {
    if (!room?.id) return;
    this.sendAuthed({ type: 'party:upsert', room });
  }

  public removePartyRoom(roomId: string): void {
    if (!roomId) return;
    this.sendAuthed({ type: 'party:remove', roomId });
  }

  public joinRoom(
    roomType: 'live' | 'party',
    roomId: string,
    profile: RealtimeViewerProfile,
    initialHeartCount?: number
  ): void {
    if (!roomId) return;
    this.activeJoinedRoom = { roomType, roomId, profile, initialHeartCount };
    this.sendAuthed({
      type: 'room:join',
      roomType,
      roomId,
      profile,
      ...(typeof initialHeartCount === 'number' ? { initialHeartCount } : {}),
    });
  }

  public leaveRoom(roomType: 'live' | 'party', roomId: string): void {
    if (!roomId) return;
    if (this.activeJoinedRoom?.roomType === roomType && this.activeJoinedRoom?.roomId === roomId) {
      this.activeJoinedRoom = null;
    }
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.isAuthed) {
      this.sendRaw({ type: 'room:leave', roomType, roomId });
    }
  }

  public sendHeartTap(roomType: 'live' | 'party', roomId: string): void {
    if (!roomId) return;
    this.sendAuthed({ type: 'room:heart', roomType, roomId });
  }

  public sendRoomSignal(roomType: 'live' | 'party', roomId: string, signal: Record<string, any>): void {
    if (!roomId) return;
    this.sendAuthed({ type: 'room:signal', roomType, roomId, signal });
  }

  public onRoomEvent(
    roomType: 'live' | 'party',
    roomId: string,
    cb: (event: RoomSocketEvent) => void
  ): () => void {
    const key = `${roomType}:${roomId}`;
    let set = this.roomListeners.get(key);
    if (!set) {
      set = new Set();
      this.roomListeners.set(key, set);
    }
    set.add(cb);
    return () => {
      const current = this.roomListeners.get(key);
      if (current) {
        current.delete(cb);
        if (current.size === 0) {
          this.roomListeners.delete(key);
        }
      }
    };
  }
}

export const realtimeSocket = new RealtimeSocketService();
