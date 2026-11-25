import { auth } from './firebase';

const PRODUCTION_API_URL = 'https://api.alphamate.app';
const RECONNECT_BASE_MS = 800;
const RECONNECT_MAX_MS = 12000;
const HEARTBEAT_MS = 15000;
const ZOMBIE_SOCKET_TIMEOUT_MS = 38000;
const CONNECT_HANDSHAKE_TIMEOUT_MS = 12000;
const OUTBOX_TTL_MS = 60000;

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
      roomSessionId?: string;
      seq?: number;
      heartCount: number;
      viewers: RealtimeViewerProfile[];
      count: number;
      replayEvents?: RoomSocketEvent[];
    }
  | {
      type: 'room:viewers';
      roomType: 'live' | 'party';
      roomId: string;
      roomSessionId?: string;
      seq?: number;
      viewers: RealtimeViewerProfile[];
      count: number;
    }
  | {
      type: 'room:heart';
      roomType: 'live' | 'party';
      roomId: string;
      roomSessionId?: string;
      seq?: number;
      senderId: string;
      heartCount: number;
      count?: number;
      eventId: string;
      createdAtMs: number;
    }
  | {
      type: 'room:signal';
      roomType: 'live' | 'party';
      roomId: string;
      roomSessionId?: string;
      seq?: number;
      senderId: string;
      signal: Record<string, any>;
      ts: number;
    }
  | {
      type: 'room:ack';
      roomType: 'live' | 'party';
      roomId: string;
      roomSessionId?: string;
      seq: number;
    }
  | {
      type: 'room:sync_response';
      roomType: 'live' | 'party';
      roomId: string;
      roomSessionId?: string;
      fromSeq: number;
      toSeq: number;
      currentSeq: number;
      snapshotRequired: boolean;
      heartCount?: number;
      viewers?: RealtimeViewerProfile[];
      count?: number;
      events: RoomSocketEvent[];
    };

export interface RoomBatchSocketEvent {
  type: 'room:batch';
  roomType: 'live' | 'party';
  roomId: string;
  events: RoomSocketEvent[];
}

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
  return `${wsBase}/ws?token=${encodeURIComponent(idToken)}&batch=1&seq=1`;
}

class RealtimeSocketService {
  private ws: WebSocket | null = null;
  private isAuthed = false;
  private supportsServerBatching = false;
  private supportsServerSequencing = false;
  private maxServerBatchSize = 40;
  private isConnecting = false;
  private manuallyDisconnected = false;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private connectTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private lastServerActivityAt = 0;
  private networkListenersBound = false;

  private activeJoinedRoom: {
    roomType: 'live' | 'party';
    roomId: string;
    profile: RealtimeViewerProfile;
    initialHeartCount?: number;
    roomSessionId?: string;
  } | null = null;

  private lastRoomSeqByKey = new Map<string, number>();
  private pendingOutbox: Array<{ payload: Record<string, any>; queuedAtMs: number }> = [];
  private discoveryListeners = new Set<(event: DiscoveryEvent) => void>();
  private roomListeners = new Map<string, Set<(event: RoomSocketEvent) => void>>();
  private roomBatchListeners = new Map<string, Set<(events: RoomSocketEvent[]) => void>>();

  constructor() {
    this.bindNetworkRecoveryListeners();
  }

  public isServerBatchingSupported(): boolean {
    return this.supportsServerBatching;
  }

  public isServerSequencingSupported(): boolean {
    return this.supportsServerSequencing;
  }

  public updateRoomLastSeq(roomType: 'live' | 'party', roomId: string, seq: number): void {
    if (!roomId || !Number.isFinite(seq) || seq < 0) return;
    this.lastRoomSeqByKey.set(`${roomType}:${roomId}`, Math.floor(seq));
  }

  private bindNetworkRecoveryListeners(): void {
    if (this.networkListenersBound || typeof window === 'undefined') return;
    this.networkListenersBound = true;

    const recoverNow = () => {
      if (this.manuallyDisconnected || !auth.currentUser) return;
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
      const isZombie =
        this.ws &&
        this.ws.readyState === WebSocket.OPEN &&
        this.lastServerActivityAt > 0 &&
        Date.now() - this.lastServerActivityAt > ZOMBIE_SOCKET_TIMEOUT_MS;
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.isAuthed || isZombie) {
        void this.forceReconnect();
      } else {
        this.sendRaw({ type: 'ping' });
      }
    };

    window.addEventListener('online', recoverNow);
    window.addEventListener('pageshow', recoverNow);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          recoverNow();
        }
      });
    }
  }

  public ensureConnected(): void {
    if (typeof window === 'undefined' || typeof WebSocket === 'undefined') return;
    if (!auth.currentUser) return;
    this.bindNetworkRecoveryListeners();
    this.manuallyDisconnected = false;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    this.connectInternal().catch(() => {});
  }

  public disconnect(): void {
    this.manuallyDisconnected = true;
    this.activeJoinedRoom = null;
    this.lastRoomSeqByKey.clear();
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
    this.supportsServerBatching = false;
    this.supportsServerSequencing = false;
    this.isConnecting = false;
  }

  public async forceReconnect(): Promise<void> {
    if (typeof window === 'undefined' || typeof WebSocket === 'undefined') return;
    if (!auth.currentUser) return;
    this.manuallyDisconnected = false;
    this.reconnectAttempts = 0;
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
    this.supportsServerBatching = false;
    this.supportsServerSequencing = false;
    this.isConnecting = false;
    await this.connectInternal().catch(() => {});
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
    if (this.connectTimeoutTimer) {
      clearTimeout(this.connectTimeoutTimer);
      this.connectTimeoutTimer = null;
    }
  }

  private async connectInternal(): Promise<void> {
    if (this.isConnecting || this.manuallyDisconnected) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      this.scheduleReconnect();
      return;
    }
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
      this.supportsServerBatching = false;
      this.supportsServerSequencing = false;

      if (this.connectTimeoutTimer) clearTimeout(this.connectTimeoutTimer);
      this.connectTimeoutTimer = setTimeout(() => {
        this.connectTimeoutTimer = null;
        if (this.ws === socket && socket.readyState === WebSocket.CONNECTING) {
          this.isConnecting = false;
          try {
            socket.close();
          } catch {
            // ignore
          }
          if (!this.manuallyDisconnected && auth.currentUser) {
            this.scheduleReconnect();
          }
        }
      }, CONNECT_HANDSHAKE_TIMEOUT_MS);

      socket.onopen = () => {
        if (this.connectTimeoutTimer) {
          clearTimeout(this.connectTimeoutTimer);
          this.connectTimeoutTimer = null;
        }
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.lastServerActivityAt = Date.now();
        this.startPingLoop();
      };

      socket.onmessage = (event) => {
        this.lastServerActivityAt = Date.now();
        this.handleIncomingMessage(event.data);
      };

      socket.onerror = () => {
        // Handled cleanly by onclose reconnect backoff
      };

      socket.onclose = () => {
        if (this.connectTimeoutTimer) {
          clearTimeout(this.connectTimeoutTimer);
          this.connectTimeoutTimer = null;
        }
        this.isConnecting = false;
        this.isAuthed = false;
        this.supportsServerBatching = false;
        this.supportsServerSequencing = false;
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
    const baseDelay = Math.min(
      RECONNECT_MAX_MS,
      RECONNECT_BASE_MS * Math.pow(1.6, Math.min(this.reconnectAttempts, 6))
    );
    const delay = Math.round(baseDelay + Math.random() * 450);
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
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
      // Detect zombie half-open cellular TCP sockets where readyState stays OPEN but server is unreachable
      if (
        this.lastServerActivityAt > 0 &&
        Date.now() - this.lastServerActivityAt > ZOMBIE_SOCKET_TIMEOUT_MS
      ) {
        void this.forceReconnect();
        return;
      }
      this.sendRaw({ type: 'ping' });
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
    const now = Date.now();
    this.pendingOutbox = this.pendingOutbox.filter((item) => now - item.queuedAtMs < OUTBOX_TTL_MS);
    if (this.pendingOutbox.length < 80) {
      this.pendingOutbox.push({ payload, queuedAtMs: now });
    }
  }

  /**
   * Sends multiple real-time socket events grouped into a single `ws:batch` WebSocket packet
   * when supported by the server, falling back transparently to individual frames on older servers.
   */
  public sendBatch(events: Array<Record<string, any>>): { packetCount: number; eventCount: number; batched: boolean } {
    if (!auth.currentUser || !Array.isArray(events) || events.length === 0) {
      return { packetCount: 0, eventCount: 0, batched: false };
    }
    const validEvents = events.filter((ev) => ev && typeof ev.type === 'string');
    if (validEvents.length === 0) {
      return { packetCount: 0, eventCount: 0, batched: false };
    }
    if (validEvents.length === 1) {
      this.sendAuthed(validEvents[0]);
      return { packetCount: 1, eventCount: 1, batched: false };
    }

    this.ensureConnected();
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.isAuthed) {
      if (this.supportsServerBatching) {
        const chunkSize = Math.max(10, Math.min(50, this.maxServerBatchSize));
        let packets = 0;
        for (let i = 0; i < validEvents.length; i += chunkSize) {
          const slice = validEvents.slice(i, i + chunkSize);
          if (slice.length === 1) {
            this.sendRaw(slice[0]);
          } else {
            this.sendRaw({ type: 'ws:batch', events: slice });
          }
          packets += 1;
        }
        return { packetCount: packets, eventCount: validEvents.length, batched: true };
      }
      // Graceful fallback when connected to an older server without ws:batch support
      for (const ev of validEvents) {
        this.sendRaw(ev);
      }
      return { packetCount: validEvents.length, eventCount: validEvents.length, batched: false };
    }

    // Queue while reconnecting — will flush as a single ws:batch packet once auth:ok completes
    const now = Date.now();
    this.pendingOutbox = this.pendingOutbox.filter((item) => now - item.queuedAtMs < OUTBOX_TTL_MS);
    for (const ev of validEvents) {
      if (this.pendingOutbox.length < 80) {
        this.pendingOutbox.push({ payload: ev, queuedAtMs: now });
      }
    }
    return { packetCount: 0, eventCount: validEvents.length, batched: false };
  }

  /**
   * Requests missing sequenced packets `[fromSeq..toSeq]` from the server's room replay buffer.
   */
  public requestRoomSync(
    roomType: 'live' | 'party',
    roomId: string,
    fromSeq: number,
    toSeq: number,
    lastSeq?: number,
    roomSessionId?: string
  ): boolean {
    if (!roomId || !this.ws || this.ws.readyState !== WebSocket.OPEN || !this.isAuthed) {
      return false;
    }
    this.sendRaw({
      type: 'room:sync_request',
      roomType,
      roomId,
      fromSeq: Math.max(1, Math.floor(fromSeq)),
      toSeq: Math.max(1, Math.floor(toSeq)),
      ...(typeof lastSeq === 'number' && Number.isFinite(lastSeq) ? { lastSeq: Math.floor(lastSeq) } : {}),
      ...(roomSessionId ? { roomSessionId } : {}),
    });
    return true;
  }

  private flushOutbox(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.isAuthed) return;
    const outbound: Array<Record<string, any>> = [];
    if (this.activeJoinedRoom) {
      const roomKey = `${this.activeJoinedRoom.roomType}:${this.activeJoinedRoom.roomId}`;
      const knownSeq = this.lastRoomSeqByKey.get(roomKey);
      outbound.push({
        type: 'room:join',
        roomType: this.activeJoinedRoom.roomType,
        roomId: this.activeJoinedRoom.roomId,
        profile: this.activeJoinedRoom.profile,
        ...(typeof this.activeJoinedRoom.initialHeartCount === 'number'
          ? { initialHeartCount: this.activeJoinedRoom.initialHeartCount }
          : {}),
        ...(this.activeJoinedRoom.roomSessionId
          ? { roomSessionId: this.activeJoinedRoom.roomSessionId }
          : {}),
        ...(typeof knownSeq === 'number' && knownSeq >= 0 ? { lastSeq: knownSeq } : {}),
      });
    }
    const now = Date.now();
    const queue = this.pendingOutbox.splice(0, this.pendingOutbox.length);
    for (const item of queue) {
      if (now - item.queuedAtMs < OUTBOX_TTL_MS) {
        outbound.push(item.payload);
      }
    }
    if (outbound.length === 0) return;
    if (outbound.length === 1 || !this.supportsServerBatching) {
      for (const payload of outbound) {
        this.sendRaw(payload);
      }
      return;
    }
    const chunkSize = Math.max(10, Math.min(50, this.maxServerBatchSize));
    for (let i = 0; i < outbound.length; i += chunkSize) {
      const slice = outbound.slice(i, i + chunkSize);
      if (slice.length === 1) {
        this.sendRaw(slice[0]);
      } else {
        this.sendRaw({ type: 'ws:batch', events: slice });
      }
    }
  }

  private dispatchRoomEvents(roomType: 'live' | 'party', roomId: string, events: RoomSocketEvent[]): void {
    if (!roomId || events.length === 0) return;
    const key = `${roomType}:${roomId}`;

    const batchListeners = this.roomBatchListeners.get(key);
    if (batchListeners && batchListeners.size > 0) {
      batchListeners.forEach((cb) => {
        try {
          cb(events);
        } catch {
          // ignore
        }
      });
    }

    const singleListeners = this.roomListeners.get(key);
    if (singleListeners && singleListeners.size > 0) {
      for (const ev of events) {
        if (ev.type === 'room:ack') continue;
        if (ev.type === 'room:sync_response') {
          // Fan out recovered state & heart events to single-event listeners (e.g. liveHeartService)
          if (ev.snapshotRequired && typeof ev.heartCount === 'number') {
            const synthInit: RoomSocketEvent = {
              type: 'room:state_init',
              roomType,
              roomId,
              roomSessionId: ev.roomSessionId,
              seq: ev.currentSeq,
              heartCount: ev.heartCount,
              viewers: Array.isArray(ev.viewers) ? ev.viewers : [],
              count: Number(ev.count) || (Array.isArray(ev.viewers) ? ev.viewers.length : 0),
            };
            singleListeners.forEach((cb) => {
              try {
                cb(synthInit);
              } catch {
                // ignore
              }
            });
          }
          if (Array.isArray(ev.events)) {
            for (const recovered of ev.events) {
              if (!recovered || recovered.type === 'room:ack' || recovered.type === 'room:sync_response') continue;
              singleListeners.forEach((cb) => {
                try {
                  cb(recovered);
                } catch {
                  // ignore
                }
              });
            }
          }
          continue;
        }
        singleListeners.forEach((cb) => {
          try {
            cb(ev);
          } catch {
            // ignore
          }
        });
      }
    }
  }

  private isDispatchableRoomEvent(item: any): boolean {
    return Boolean(
      item &&
        (item.type === 'room:state_init' ||
          item.type === 'room:viewers' ||
          item.type === 'room:heart' ||
          item.type === 'room:signal' ||
          item.type === 'room:ack' ||
          item.type === 'room:sync_response')
    );
  }

  private processParsedMessage(msg: any): void {
    if (!msg || typeof msg.type !== 'string') return;
    if (msg.type === 'pong') return;

    if (msg.type === 'auth:ok') {
      this.isAuthed = true;
      this.supportsServerBatching = Boolean(msg.capabilities?.batching);
      this.supportsServerSequencing = Boolean(msg.capabilities?.sequencing);
      const serverMax = Number(msg.capabilities?.maxBatchSize);
      if (Number.isFinite(serverMax) && serverMax >= 10) {
        this.maxServerBatchSize = Math.min(50, Math.floor(serverMax));
      }
      this.emitDiscovery({
        type: 'discovery:snapshot',
        liveStreams: Array.isArray(msg.liveStreams) ? msg.liveStreams : [],
        partyRooms: Array.isArray(msg.partyRooms) ? msg.partyRooms : [],
      });
      this.flushOutbox();
      return;
    }

    if (msg.type === 'ws:batch' && Array.isArray(msg.events)) {
      for (const sub of msg.events) {
        if (sub && typeof sub === 'object' && sub.type !== 'ws:batch') {
          this.processParsedMessage(sub);
        }
      }
      return;
    }

    if (msg.type === 'room:batch' && Array.isArray(msg.events)) {
      const roomType = msg.roomType === 'live' || msg.roomType === 'party' ? msg.roomType : null;
      const roomId = typeof msg.roomId === 'string' ? msg.roomId : '';
      if (!roomType || !roomId) return;
      const normalizedEvents: RoomSocketEvent[] = [];
      for (const item of msg.events) {
        if (this.isDispatchableRoomEvent(item)) {
          normalizedEvents.push(item as RoomSocketEvent);
        }
      }
      if (normalizedEvents.length > 0) {
        this.dispatchRoomEvents(roomType, roomId, normalizedEvents);
      }
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

    if (this.isDispatchableRoomEvent(msg)) {
      const roomType = msg.roomType === 'live' || msg.roomType === 'party' ? msg.roomType : null;
      const roomId = typeof msg.roomId === 'string' ? msg.roomId : '';
      if (!roomType || !roomId) return;
      this.dispatchRoomEvents(roomType, roomId, [msg as RoomSocketEvent]);
    }
  }

  private handleIncomingMessage(rawData: any): void {
    let msg: any;
    try {
      msg = JSON.parse(String(rawData));
    } catch {
      return;
    }
    this.processParsedMessage(msg);
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
    initialHeartCount?: number,
    roomSessionId?: string
  ): void {
    if (!roomId) return;
    this.activeJoinedRoom = { roomType, roomId, profile, initialHeartCount, roomSessionId };
    this.lastRoomSeqByKey.delete(`${roomType}:${roomId}`);
    this.sendAuthed({
      type: 'room:join',
      roomType,
      roomId,
      profile,
      ...(typeof initialHeartCount === 'number' ? { initialHeartCount } : {}),
      ...(roomSessionId ? { roomSessionId } : {}),
    });
  }

  public leaveRoom(roomType: 'live' | 'party', roomId: string): void {
    if (!roomId) return;
    this.lastRoomSeqByKey.delete(`${roomType}:${roomId}`);
    if (this.activeJoinedRoom?.roomType === roomType && this.activeJoinedRoom?.roomId === roomId) {
      this.activeJoinedRoom = null;
    }
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.isAuthed) {
      this.sendRaw({ type: 'room:leave', roomType, roomId });
    }
  }

  public sendHeartTap(roomType: 'live' | 'party', roomId: string, roomSessionId?: string, count = 1): void {
    if (!roomId) return;
    const safeCount = Number.isFinite(count) && count > 1 ? Math.min(25, Math.floor(count)) : 1;
    this.sendAuthed({
      type: 'room:heart',
      roomType,
      roomId,
      ...(roomSessionId ? { roomSessionId } : {}),
      ...(safeCount > 1 ? { count: safeCount } : {}),
    });
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

  public onRoomBatch(
    roomType: 'live' | 'party',
    roomId: string,
    cb: (events: RoomSocketEvent[]) => void
  ): () => void {
    const key = `${roomType}:${roomId}`;
    let set = this.roomBatchListeners.get(key);
    if (!set) {
      set = new Set();
      this.roomBatchListeners.set(key, set);
    }
    set.add(cb);
    return () => {
      const current = this.roomBatchListeners.get(key);
      if (current) {
        current.delete(cb);
        if (current.size === 0) {
          this.roomBatchListeners.delete(key);
        }
      }
    };
  }
}

export const realtimeSocket = new RealtimeSocketService();
