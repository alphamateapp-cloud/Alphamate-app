import { Gift } from '../types';
import { realtimeSocket, RealtimeViewerProfile, RoomSocketEvent } from './realtimeSocket';

const BASE_BATCH_WINDOW_MS = 60;
const CASCADE_BATCH_WINDOW_MS = 85;
const CASCADE_BURST_THRESHOLD = 5;
const MAX_BATCH_EVENTS = 20;
const MAX_COALESCED_HEARTS_PER_FRAME = 25;
const MAX_UNMERGED_IDENTICAL_GIFTS = 2;
const MAX_SOCKET_STRING_URL_LEN = 512;

const MAX_REORDER_BUFFER_SIZE = 80;
const SYNC_REQUEST_COOLDOWN_MS = 250;
const SYNC_RETRY_DELAY_MS = 650;
const SYNC_FALLBACK_DRAIN_MS = 1650;

export interface PartyGiftSignalPayload {
  eventId: string;
  gift: Gift;
  senderName: string;
  senderAvatar?: string;
  senderVipTier: number;
  recipientName: string;
  comboCount: number;
  quantity: number;
  timestamp: number;
}

export interface PartyVipEntrySignalPayload {
  userId: string;
  displayName: string;
  avatar: string;
  vipTier: number;
  level: number;
  isHost: boolean;
  timestamp: number;
}

export interface PartyRoomBatchMetrics {
  enqueuedEvents: number;
  coalescedEvents: number;
  flushedBatches: number;
  transmittedPackets: number;
  serverBatchingActive: boolean;
  serverSequencingActive: boolean;
  gapsDetected: number;
  syncRequestsSent: number;
  recoveredPackets: number;
  duplicatePacketsDropped: number;
  snapshotResyncs: number;
  fallbackDrains: number;
}

type OutboundEvent = Record<string, any>;

interface RoomBatchQueue {
  roomId: string;
  events: OutboundEvent[];
  timer: ReturnType<typeof setTimeout> | null;
  lastFlushSize: number;
}

interface PendingSequenceGap {
  fromSeq: number;
  toSeq: number;
  requestedAtMs: number;
  retryCount: number;
}

interface RoomSequenceTracker {
  roomId: string;
  roomSessionId?: string;
  lastAppliedSeq: number | null;
  outOfOrderBuffer: Map<number, RoomSocketEvent>;
  pendingGap: PendingSequenceGap | null;
  retryTimer: ReturnType<typeof setTimeout> | null;
  drainFallbackTimer: ReturnType<typeof setTimeout> | null;
  lastSyncRequestAtMs: number;
  listeners: Set<(events: RoomSocketEvent[]) => void>;
  unsubscribeSocket: (() => void) | null;
}

function sanitizeSocketMediaUrl(value?: string): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  // Never flood WebSocket signal packets with huge inline base64 data URIs
  if (trimmed.startsWith('data:') && trimmed.length > MAX_SOCKET_STRING_URL_LEN) {
    return undefined;
  }
  return trimmed.slice(0, 1024);
}

/**
 * Compacts a Gift object before transmitting over WebSocket so high-traffic gift cascades
 * do not repeatedly serialize heavy inline thumbnails or unused catalog descriptions.
 * Receivers enrich the full Gift object from their local catalog by `id` / `name`.
 */
function compactGiftForSocket(gift: Gift): Record<string, any> {
  const safeIcon =
    typeof gift.icon === 'string' && (!gift.icon.startsWith('data:') || gift.icon.length <= MAX_SOCKET_STRING_URL_LEN)
      ? gift.icon
      : '🎁';
  const compact: Record<string, any> = {
    id: gift.id,
    name: gift.name,
    icon: safeIcon,
    coins: gift.coins,
    costInCoins: gift.costInCoins ?? gift.coins,
    animationType: gift.animationType,
    description: '',
  };
  if (gift.animationClassName) compact.animationClassName = gift.animationClassName;
  if (gift.tier) compact.tier = gift.tier;
  if (typeof gift.durationMs === 'number') compact.durationMs = gift.durationMs;
  if (typeof gift.priority === 'number') compact.priority = gift.priority;
  const safeThumb = sanitizeSocketMediaUrl(gift.thumbnailUrl);
  if (safeThumb) compact.thumbnailUrl = safeThumb;

  if (gift.advancedConfig) {
    const cfg = gift.advancedConfig as Record<string, any>;
    const compactCfg: Record<string, any> = {};
    const scalarKeys = [
      'id',
      'name',
      'giftKind',
      'format',
      'animationFormat',
      'durationMs',
      'loop',
      'placement',
      'scale',
      'opacity',
      'priority',
      'tier',
      'category',
      'rarity',
      'playbackMode',
      'blendMode',
      'chromaKey',
    ];
    for (const k of scalarKeys) {
      if (cfg[k] !== undefined) compactCfg[k] = cfg[k];
    }
    const urlKeys = ['assetUrl', 'animationUrl', 'mediaUrl', 'videoUrl', 'svgaUrl', 'lottieUrl', 'thumbnailUrl', 'soundUrl'];
    for (const k of urlKeys) {
      const cleaned = sanitizeSocketMediaUrl(cfg[k]);
      if (cleaned) compactCfg[k] = cleaned;
    }
    if (Object.keys(compactCfg).length > 0) {
      compact.advancedConfig = compactCfg;
    }
  }
  return compact;
}

class PartyRoomDataService {
  private queues = new Map<string, RoomBatchQueue>();
  private sequenceTrackers = new Map<string, RoomSequenceTracker>();
  private lifecycleBound = false;
  private metrics = {
    enqueuedEvents: 0,
    coalescedEvents: 0,
    flushedBatches: 0,
    transmittedPackets: 0,
    gapsDetected: 0,
    syncRequestsSent: 0,
    recoveredPackets: 0,
    duplicatePacketsDropped: 0,
    snapshotResyncs: 0,
    fallbackDrains: 0,
  };

  constructor() {
    this.bindLifecycleFlush();
  }

  private bindLifecycleFlush(): void {
    if (this.lifecycleBound || typeof window === 'undefined') return;
    this.lifecycleBound = true;

    const flushAll = () => {
      this.flushAll();
    };

    window.addEventListener('pagehide', flushAll);
    window.addEventListener('beforeunload', flushAll);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          flushAll();
        }
      });
    }
  }

  private getOrCreateQueue(roomId: string): RoomBatchQueue {
    let queue = this.queues.get(roomId);
    if (!queue) {
      queue = {
        roomId,
        events: [],
        timer: null,
        lastFlushSize: 0,
      };
      this.queues.set(roomId, queue);
    }
    return queue;
  }

  private clearSequenceTimers(tracker: RoomSequenceTracker): void {
    if (tracker.retryTimer) {
      clearTimeout(tracker.retryTimer);
      tracker.retryTimer = null;
    }
    if (tracker.drainFallbackTimer) {
      clearTimeout(tracker.drainFallbackTimer);
      tracker.drainFallbackTimer = null;
    }
  }

  private resetSequenceState(tracker: RoomSequenceTracker, roomSessionId?: string): void {
    this.clearSequenceTimers(tracker);
    tracker.lastAppliedSeq = null;
    tracker.outOfOrderBuffer.clear();
    tracker.pendingGap = null;
    tracker.lastSyncRequestAtMs = 0;
    if (roomSessionId !== undefined) {
      tracker.roomSessionId = roomSessionId;
    }
  }

  private getOrCreateSequenceTracker(roomId: string): RoomSequenceTracker {
    let tracker = this.sequenceTrackers.get(roomId);
    if (!tracker) {
      tracker = {
        roomId,
        roomSessionId: undefined,
        lastAppliedSeq: null,
        outOfOrderBuffer: new Map(),
        pendingGap: null,
        retryTimer: null,
        drainFallbackTimer: null,
        lastSyncRequestAtMs: 0,
        listeners: new Set(),
        unsubscribeSocket: null,
      };
      this.sequenceTrackers.set(roomId, tracker);
    }
    return tracker;
  }

  private disposeSequenceTracker(roomId: string): void {
    const tracker = this.sequenceTrackers.get(roomId);
    if (!tracker) return;
    this.clearSequenceTimers(tracker);
    if (tracker.unsubscribeSocket) {
      tracker.unsubscribeSocket();
      tracker.unsubscribeSocket = null;
    }
    tracker.outOfOrderBuffer.clear();
    tracker.listeners.clear();
    this.sequenceTrackers.delete(roomId);
  }

  private dispatchValidatedEvents(tracker: RoomSequenceTracker, events: RoomSocketEvent[]): void {
    if (events.length === 0 || tracker.listeners.size === 0) return;
    tracker.listeners.forEach((cb) => {
      try {
        cb(events);
      } catch {
        // ignore
      }
    });
  }

  private setLastAppliedSeq(tracker: RoomSequenceTracker, seq: number): void {
    tracker.lastAppliedSeq = seq;
    realtimeSocket.updateRoomLastSeq('party', tracker.roomId, seq);
  }

  private drainContiguousBuffer(tracker: RoomSequenceTracker, output: RoomSocketEvent[]): void {
    while (
      tracker.lastAppliedSeq !== null &&
      tracker.outOfOrderBuffer.has(tracker.lastAppliedSeq + 1)
    ) {
      const nextSeq = tracker.lastAppliedSeq + 1;
      const bufferedEvent = tracker.outOfOrderBuffer.get(nextSeq)!;
      tracker.outOfOrderBuffer.delete(nextSeq);
      this.setLastAppliedSeq(tracker, nextSeq);
      if (bufferedEvent.type !== 'room:ack' && bufferedEvent.type !== 'room:sync_response') {
        output.push(bufferedEvent);
      }
    }

    if (tracker.outOfOrderBuffer.size === 0) {
      tracker.pendingGap = null;
      this.clearSequenceTimers(tracker);
      return;
    }

    if (tracker.lastAppliedSeq !== null) {
      let minBufferedSeq = Infinity;
      for (const seq of tracker.outOfOrderBuffer.keys()) {
        if (seq < minBufferedSeq) minBufferedSeq = seq;
      }
      if (Number.isFinite(minBufferedSeq) && minBufferedSeq > tracker.lastAppliedSeq + 1) {
        this.requestMissingSequenceRange(tracker, tracker.lastAppliedSeq + 1, minBufferedSeq - 1);
      }
    }
  }

  private forceDrainReorderBuffer(tracker: RoomSequenceTracker): void {
    this.clearSequenceTimers(tracker);
    tracker.pendingGap = null;
    if (tracker.outOfOrderBuffer.size === 0) return;

    const sortedSeqs = Array.from(tracker.outOfOrderBuffer.keys()).sort((a, b) => a - b);
    const output: RoomSocketEvent[] = [];
    for (const seq of sortedSeqs) {
      const ev = tracker.outOfOrderBuffer.get(seq);
      tracker.outOfOrderBuffer.delete(seq);
      if (!ev) continue;
      if (tracker.lastAppliedSeq === null || seq > tracker.lastAppliedSeq) {
        this.setLastAppliedSeq(tracker, seq);
        if (ev.type !== 'room:ack' && ev.type !== 'room:sync_response') {
          output.push(ev);
        }
      }
    }
    this.metrics.fallbackDrains += 1;
    this.dispatchValidatedEvents(tracker, output);
  }

  private requestMissingSequenceRange(
    tracker: RoomSequenceTracker,
    fromSeq: number,
    toSeq: number,
    isRetry = false
  ): void {
    if (fromSeq > toSeq) return;
    const now = Date.now();
    const existing = tracker.pendingGap;

    if (!isRetry) {
      if (existing) {
        const mergedFrom = Math.min(existing.fromSeq, fromSeq);
        const mergedTo = Math.max(existing.toSeq, toSeq);
        const rangeExpanded = mergedFrom < existing.fromSeq || mergedTo > existing.toSeq;
        existing.fromSeq = mergedFrom;
        existing.toSeq = mergedTo;
        if (!rangeExpanded && now - tracker.lastSyncRequestAtMs < SYNC_REQUEST_COOLDOWN_MS) {
          return;
        }
      } else {
        tracker.pendingGap = {
          fromSeq,
          toSeq,
          requestedAtMs: now,
          retryCount: 0,
        };
      }
    }

    const gap = tracker.pendingGap;
    if (!gap) return;

    if (!isRetry && now - tracker.lastSyncRequestAtMs < SYNC_REQUEST_COOLDOWN_MS) {
      return;
    }

    const sent = realtimeSocket.requestRoomSync(
      'party',
      tracker.roomId,
      gap.fromSeq,
      gap.toSeq,
      tracker.lastAppliedSeq ?? undefined,
      tracker.roomSessionId
    );
    if (sent) {
      tracker.lastSyncRequestAtMs = now;
      this.metrics.syncRequestsSent += 1;
    }

    if (!tracker.retryTimer && gap.retryCount < 1) {
      tracker.retryTimer = setTimeout(() => {
        tracker.retryTimer = null;
        const activeGap = tracker.pendingGap;
        if (!activeGap) return;
        activeGap.retryCount += 1;
        this.requestMissingSequenceRange(tracker, activeGap.fromSeq, activeGap.toSeq, true);
      }, SYNC_RETRY_DELAY_MS);
    }

    if (!tracker.drainFallbackTimer) {
      tracker.drainFallbackTimer = setTimeout(() => {
        tracker.drainFallbackTimer = null;
        if (tracker.outOfOrderBuffer.size > 0) {
          this.forceDrainReorderBuffer(tracker);
        } else {
          tracker.pendingGap = null;
        }
      }, SYNC_FALLBACK_DRAIN_MS);
    }
  }

  /**
   * Validates incoming Party Room socket events against the room's monotonic sequence number,
   * buffers out-of-order packets, requests missing ranges from the server, and reconciles
   * full snapshots when gaps exceed the server replay buffer.
   */
  public processIncomingRoomEvents(roomId: string, incomingEvents: RoomSocketEvent[]): RoomSocketEvent[] {
    const tracker = this.getOrCreateSequenceTracker(roomId);
    const validated: RoomSocketEvent[] = [];

    for (const ev of incomingEvents) {
      if (!ev || typeof ev.type !== 'string') continue;

      if (ev.type === 'room:state_init') {
        const sessionChanged = Boolean(
          ev.roomSessionId && tracker.roomSessionId && ev.roomSessionId !== tracker.roomSessionId
        );
        if (sessionChanged) {
          this.resetSequenceState(tracker, ev.roomSessionId);
        } else if (ev.roomSessionId) {
          tracker.roomSessionId = ev.roomSessionId;
        }

        const prevLastSeq = tracker.lastAppliedSeq;
        validated.push(ev);

        if (Array.isArray(ev.replayEvents) && ev.replayEvents.length > 0) {
          const sortedReplay = [...ev.replayEvents].sort(
            (a, b) => (Number((a as any).seq) || 0) - (Number((b as any).seq) || 0)
          );
          for (const rec of sortedReplay) {
            if (!rec || rec.type === 'room:ack' || rec.type === 'room:sync_response') continue;
            const recSeq = Number((rec as any).seq);
            if (prevLastSeq !== null && Number.isFinite(recSeq) && recSeq <= prevLastSeq) {
              this.metrics.duplicatePacketsDropped += 1;
              continue;
            }
            validated.push(rec);
            this.metrics.recoveredPackets += 1;
          }
        }

        if (typeof ev.seq === 'number' && Number.isFinite(ev.seq)) {
          const initSeq = Math.floor(ev.seq);
          this.setLastAppliedSeq(tracker, initSeq);
          for (const bufferedSeq of Array.from(tracker.outOfOrderBuffer.keys())) {
            if (bufferedSeq <= initSeq) {
              tracker.outOfOrderBuffer.delete(bufferedSeq);
            }
          }
          tracker.pendingGap = null;
          this.clearSequenceTimers(tracker);
          this.drainContiguousBuffer(tracker, validated);
        }
        continue;
      }

      if (ev.type === 'room:sync_response') {
        this.clearSequenceTimers(tracker);
        tracker.pendingGap = null;

        if (ev.roomSessionId) {
          tracker.roomSessionId = ev.roomSessionId;
        }

        if (ev.snapshotRequired) {
          this.metrics.snapshotResyncs += 1;
          validated.push({
            type: 'room:state_init',
            roomType: 'party',
            roomId: ev.roomId,
            ...(ev.roomSessionId ? { roomSessionId: ev.roomSessionId } : {}),
            seq: ev.currentSeq,
            heartCount: Number(ev.heartCount) || 0,
            viewers: Array.isArray(ev.viewers) ? ev.viewers : [],
            count: Number(ev.count) || (Array.isArray(ev.viewers) ? ev.viewers.length : 0),
          });
        }

        const recovered = Array.isArray(ev.events)
          ? [...ev.events].sort(
              (a, b) => (Number((a as any).seq) || 0) - (Number((b as any).seq) || 0)
            )
          : [];

        for (const rec of recovered) {
          if (!rec) continue;
          const recSeq = Number((rec as any).seq);
          if (Number.isFinite(recSeq)) {
            if (tracker.lastAppliedSeq !== null && recSeq <= tracker.lastAppliedSeq) {
              this.metrics.duplicatePacketsDropped += 1;
              continue;
            }
            tracker.outOfOrderBuffer.delete(recSeq);
            if (rec.type !== 'room:ack' && rec.type !== 'room:sync_response') {
              validated.push(rec);
              this.metrics.recoveredPackets += 1;
            }
            if (tracker.lastAppliedSeq === null || recSeq > tracker.lastAppliedSeq) {
              this.setLastAppliedSeq(tracker, Math.floor(recSeq));
            }
          } else if (rec.type !== 'room:ack' && rec.type !== 'room:sync_response') {
            validated.push(rec);
          }
        }

        // Advance baseline to recovered window end (or full snapshot seq) so empty/evicted seq slots never loop
        const targetSeq = ev.snapshotRequired
          ? Math.max(tracker.lastAppliedSeq ?? 0, Math.floor(ev.currentSeq))
          : Math.max(tracker.lastAppliedSeq ?? 0, Math.min(Math.floor(ev.toSeq), Math.floor(ev.currentSeq)));
        if (Number.isFinite(targetSeq) && targetSeq >= 0) {
          this.setLastAppliedSeq(tracker, targetSeq);
          for (const bufferedSeq of Array.from(tracker.outOfOrderBuffer.keys())) {
            if (bufferedSeq <= targetSeq) {
              tracker.outOfOrderBuffer.delete(bufferedSeq);
            }
          }
        }

        this.drainContiguousBuffer(tracker, validated);
        continue;
      }

      // Standard room events: room:viewers, room:heart, room:signal, room:ack
      const rawSeq = (ev as any).seq;
      if (typeof rawSeq !== 'number' || !Number.isFinite(rawSeq)) {
        // Legacy unsequenced server packet — pass straight through
        if (ev.type !== 'room:ack') {
          validated.push(ev);
        }
        continue;
      }

      const seq = Math.floor(rawSeq);
      if (ev.roomSessionId && tracker.roomSessionId && ev.roomSessionId !== tracker.roomSessionId) {
        this.resetSequenceState(tracker, ev.roomSessionId);
      } else if (ev.roomSessionId && !tracker.roomSessionId) {
        tracker.roomSessionId = ev.roomSessionId;
      }

      if (tracker.lastAppliedSeq === null) {
        this.setLastAppliedSeq(tracker, seq);
        if (ev.type !== 'room:ack') {
          validated.push(ev);
        }
        continue;
      }

      if (seq <= tracker.lastAppliedSeq) {
        this.metrics.duplicatePacketsDropped += 1;
        continue;
      }

      if (seq === tracker.lastAppliedSeq + 1) {
        this.setLastAppliedSeq(tracker, seq);
        if (ev.type !== 'room:ack') {
          validated.push(ev);
        }
        this.drainContiguousBuffer(tracker, validated);
        continue;
      }

      // Sequence gap detected: seq > tracker.lastAppliedSeq + 1
      this.metrics.gapsDetected += 1;
      if (tracker.outOfOrderBuffer.size >= MAX_REORDER_BUFFER_SIZE) {
        // Drop oldest buffered entry if severely flooded, and request fresh resync
        const oldestKey = tracker.outOfOrderBuffer.keys().next().value;
        if (typeof oldestKey === 'number') {
          tracker.outOfOrderBuffer.delete(oldestKey);
        }
      }
      tracker.outOfOrderBuffer.set(seq, ev);
      this.requestMissingSequenceRange(tracker, tracker.lastAppliedSeq + 1, seq - 1);
    }

    return validated;
  }

  private scheduleFlush(queue: RoomBatchQueue): void {
    if (queue.events.length >= MAX_BATCH_EVENTS) {
      this.flushRoom(queue.roomId);
      return;
    }
    if (queue.timer) return;
    const windowMs =
      queue.lastFlushSize >= CASCADE_BURST_THRESHOLD
        ? CASCADE_BATCH_WINDOW_MS
        : BASE_BATCH_WINDOW_MS;
    queue.timer = setTimeout(() => {
      this.flushRoom(queue.roomId);
    }, windowMs);
  }

  public joinPartyRoom(
    roomId: string,
    profile: RealtimeViewerProfile,
    initialHeartCount?: number,
    roomSessionId?: string
  ): void {
    if (!roomId) return;
    const tracker = this.getOrCreateSequenceTracker(roomId);
    this.resetSequenceState(tracker, roomSessionId);
    // Join immediately so room subscription is established before any queued signals flush
    realtimeSocket.joinRoom('party', roomId, profile, initialHeartCount, roomSessionId);
  }

  public leavePartyRoom(roomId: string): void {
    if (!roomId) return;
    this.flushRoom(roomId);
    const queue = this.queues.get(roomId);
    if (queue?.timer) {
      clearTimeout(queue.timer);
      queue.timer = null;
    }
    this.queues.delete(roomId);
    this.disposeSequenceTracker(roomId);
    realtimeSocket.leaveRoom('party', roomId);
  }

  /**
   * Queues a Party Room gift cascade signal for batched transmission.
   * Compacts payload size and coalesces extreme rapid bursts while preserving all eventIds for deduplication.
   */
  public enqueueGiftSignal(roomId: string, payload: PartyGiftSignalPayload): void {
    if (!roomId || !payload?.gift) return;
    const queue = this.getOrCreateQueue(roomId);
    this.metrics.enqueuedEvents += 1;

    const compactGift = compactGiftForSocket(payload.gift);
    const compactAvatar = sanitizeSocketMediaUrl(payload.senderAvatar);
    const signal: Record<string, any> = {
      type: 'gift_combo',
      eventId: payload.eventId,
      roomId,
      gift: compactGift,
      senderName: payload.senderName,
      ...(compactAvatar ? { senderAvatar: compactAvatar } : {}),
      senderVipTier: payload.senderVipTier,
      recipientName: payload.recipientName,
      comboCount: Math.max(1, Number(payload.comboCount) || 1),
      quantity: Math.max(1, Number(payload.quantity) || 1),
      timestamp: payload.timestamp,
    };

    // During extreme rapid gift cascades from the same sender for the same gift & recipient within one window,
    // coalesce excess identical signals beyond MAX_UNMERGED_IDENTICAL_GIFTS into the latest entry.
    let matchingCount = 0;
    let lastMatchIndex = -1;
    for (let i = 0; i < queue.events.length; i += 1) {
      const ev = queue.events[i];
      if (
        ev.type === 'room:signal' &&
        ev.signal?.type === 'gift_combo' &&
        ev.signal?.gift?.id === compactGift.id &&
        ev.signal?.recipientName === signal.recipientName &&
        ev.signal?.senderName === signal.senderName
      ) {
        matchingCount += 1;
        lastMatchIndex = i;
      }
    }

    if (matchingCount >= MAX_UNMERGED_IDENTICAL_GIFTS && lastMatchIndex !== -1) {
      const target = queue.events[lastMatchIndex].signal;
      target.quantity = Math.max(1, Number(target.quantity) || 1) + signal.quantity;
      target.comboCount = Math.max(1, Number(target.comboCount) || 1) + signal.comboCount;
      target.timestamp = signal.timestamp;
      if (!Array.isArray(target.mergedEventIds)) {
        target.mergedEventIds = [target.eventId];
      }
      target.mergedEventIds.push(signal.eventId);
      this.metrics.coalescedEvents += 1;
    } else {
      queue.events.push({
        type: 'room:signal',
        roomType: 'party',
        roomId,
        signal,
      });
    }

    this.scheduleFlush(queue);
  }

  public enqueueVipEntrySignal(roomId: string, payload: PartyVipEntrySignalPayload): void {
    if (!roomId || !payload?.userId) return;
    const queue = this.getOrCreateQueue(roomId);
    this.metrics.enqueuedEvents += 1;

    const compactAvatar = sanitizeSocketMediaUrl(payload.avatar) || '';
    const nextEvent: OutboundEvent = {
      type: 'room:signal',
      roomType: 'party',
      roomId,
      signal: {
        type: 'vip_entry',
        userId: payload.userId,
        displayName: payload.displayName,
        avatar: compactAvatar,
        vipTier: payload.vipTier,
        level: payload.level,
        isHost: payload.isHost,
        timestamp: payload.timestamp,
      },
    };

    const existingIdx = queue.events.findIndex(
      (ev) =>
        ev.type === 'room:signal' &&
        ev.signal?.type === 'vip_entry' &&
        ev.signal?.userId === payload.userId
    );
    if (existingIdx !== -1) {
      queue.events[existingIdx] = nextEvent;
      this.metrics.coalescedEvents += 1;
    } else {
      queue.events.push(nextEvent);
    }

    this.scheduleFlush(queue);
  }

  /**
   * Queues a Party Room heart tap and coalesces consecutive taps within the batch window
   * into a single packet carrying the summed `count`.
   */
  public enqueueHeartTap(roomId: string, roomSessionId?: string): void {
    if (!roomId) return;
    const queue = this.getOrCreateQueue(roomId);
    this.metrics.enqueuedEvents += 1;

    const existingIdx = queue.events.findIndex(
      (ev) =>
        ev.type === 'room:heart' &&
        ev.roomId === roomId &&
        ev.roomSessionId === roomSessionId
    );

    if (existingIdx !== -1) {
      const prev = queue.events[existingIdx];
      const nextCount = Math.min(
        MAX_COALESCED_HEARTS_PER_FRAME,
        Math.max(1, Number(prev.count) || 1) + 1
      );
      queue.events[existingIdx] = {
        ...prev,
        count: nextCount,
      };
      this.metrics.coalescedEvents += 1;
    } else {
      queue.events.push({
        type: 'room:heart',
        roomType: 'party',
        roomId,
        ...(roomSessionId ? { roomSessionId } : {}),
        count: 1,
      });
    }

    this.scheduleFlush(queue);
  }

  /**
   * Queues a Party Room presence / discovery metadata patch and deduplicates repeated updates
   * within the active batch window into a single merged `party:upsert` event.
   */
  public enqueueRoomAnnounce(roomPatch: Record<string, any> & { id: string }): void {
    const roomId = roomPatch?.id;
    if (!roomId) return;
    const queue = this.getOrCreateQueue(roomId);
    this.metrics.enqueuedEvents += 1;

    const existingIdx = queue.events.findIndex(
      (ev) => ev.type === 'party:upsert' && ev.room?.id === roomId
    );
    if (existingIdx !== -1) {
      queue.events[existingIdx] = {
        type: 'party:upsert',
        room: {
          ...queue.events[existingIdx].room,
          ...roomPatch,
        },
      };
      this.metrics.coalescedEvents += 1;
    } else {
      queue.events.push({
        type: 'party:upsert',
        room: roomPatch,
      });
    }

    this.scheduleFlush(queue);
  }

  public flushRoom(roomId: string): void {
    const queue = this.queues.get(roomId);
    if (!queue) return;
    if (queue.timer) {
      clearTimeout(queue.timer);
      queue.timer = null;
    }
    if (queue.events.length === 0) return;

    const batch = queue.events.splice(0, queue.events.length);
    queue.lastFlushSize = batch.length;
    const result = realtimeSocket.sendBatch(batch);
    this.metrics.flushedBatches += 1;
    this.metrics.transmittedPackets += result.packetCount;
  }

  public flushAll(): void {
    for (const roomId of Array.from(this.queues.keys())) {
      this.flushRoom(roomId);
    }
  }

  /**
   * Subscribes to sequence-validated, server-batched Party Room socket events.
   * Automatically detects missing sequence numbers, buffers out-of-order packets,
   * requests missing ranges from the server, and delivers ordered batches to the UI.
   */
  public subscribeRoomBatch(
    roomId: string,
    onBatch: (events: RoomSocketEvent[]) => void
  ): () => void {
    if (!roomId) return () => {};
    const tracker = this.getOrCreateSequenceTracker(roomId);
    tracker.listeners.add(onBatch);

    if (!tracker.unsubscribeSocket) {
      tracker.unsubscribeSocket = realtimeSocket.onRoomBatch('party', roomId, (rawEvents) => {
        const validated = this.processIncomingRoomEvents(roomId, rawEvents);
        this.dispatchValidatedEvents(tracker, validated);
      });
    }

    return () => {
      const current = this.sequenceTrackers.get(roomId);
      if (!current) return;
      current.listeners.delete(onBatch);
      if (current.listeners.size === 0) {
        this.disposeSequenceTracker(roomId);
      }
    };
  }

  public getRoomLastAppliedSeq(roomId: string): number | null {
    return this.sequenceTrackers.get(roomId)?.lastAppliedSeq ?? null;
  }

  public getBatchMetrics(): PartyRoomBatchMetrics {
    return {
      ...this.metrics,
      serverBatchingActive: realtimeSocket.isServerBatchingSupported(),
      serverSequencingActive: realtimeSocket.isServerSequencingSupported(),
    };
  }
}

export const partyRoomDataService = new PartyRoomDataService();
