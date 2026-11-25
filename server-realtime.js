import { WebSocketServer } from 'ws';

const LIVE_TTL_MS = 120_000;
const PARTY_TTL_MS = 12 * 60 * 60_000;
const HEARTBEAT_INTERVAL_MS = 25_000;
const HOST_DISCONNECT_LIVE_GRACE_MS = 6_000;
const ROOM_BATCH_WINDOW_MS = 55;
const ROOM_BATCH_MAX_EVENTS = 24;
const MAX_INCOMING_BATCH_EVENTS = 50;
const MAX_HEART_BATCH_COUNT = 25;
const ROOM_REPLAY_BUFFER_SIZE = 120;
const ROOM_REPLAY_MAX_AGE_MS = 60_000;
const ROOM_RECONNECT_REPLAY_AGE_MS = 20_000;
const MAX_SYNC_RESPONSE_EVENTS = 60;

function isValidId(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
}

function isLegacyErrorId(value) {
  return typeof value === 'string' && (/^party_\d+$/.test(value) || /^live_my_\d+$/.test(value));
}

function safeJsonSend(ws, payload) {
  if (!ws || ws.readyState !== 1) return;
  try {
    ws.send(JSON.stringify(payload));
  } catch {
    // ignore closed socket race
  }
}

function sanitizeViewerProfile(uid, profile = {}) {
  return {
    id: uid,
    uniqueId: String(profile.uniqueId || uid).slice(0, 64),
    username: String(profile.username || profile.displayName || 'user')
      .replace(/\s+/g, '_')
      .slice(0, 64),
    displayName: String(profile.displayName || 'Alpha User').slice(0, 64),
    avatar: typeof profile.avatar === 'string' ? profile.avatar.slice(0, 1024) : '',
    level: Number(profile.level) || 1,
    vipTier: Number(profile.vipTier) || 0,
    countryFlag: typeof profile.countryFlag === 'string' ? profile.countryFlag.slice(0, 16) : undefined,
    isVerified: Boolean(profile.isVerified),
    isHost: Boolean(profile.isHost),
    joinedAtMs: Number(profile.joinedAtMs) || Date.now(),
  };
}

export function attachRealtimeWebSocketServer(httpServer, { app, verifyFirebaseIdToken }) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 256 * 1024 });

  // Server-authoritative state stores
  const activeLiveStreams = new Map(); // streamId -> { data, updatedAtMs }
  const activePartyRooms = new Map(); // roomId -> { data, updatedAtMs }
  const rooms = new Map(); // `${roomType}:${roomId}` -> { viewers, heartCount, sessionId, seq, eventLog }
  const authenticatedClients = new Set();
  const pendingLiveHostDisconnectTimers = new Map(); // streamId -> Timeout
  // Per-room broadcast batching queues: roomKey -> { timer: Timeout | null, items: Array<{ event, excludeWs }> }
  const roomBroadcastQueues = new Map();

  function clearHostDisconnectTimer(streamId) {
    const t = pendingLiveHostDisconnectTimers.get(streamId);
    if (t) {
      clearTimeout(t);
      pendingLiveHostDisconnectTimers.delete(streamId);
    }
  }

  function clearRoomBroadcastQueue(roomKey) {
    const q = roomBroadcastQueues.get(roomKey);
    if (!q) return;
    if (q.timer) {
      clearTimeout(q.timer);
      q.timer = null;
    }
    roomBroadcastQueues.delete(roomKey);
  }

  function hasAnyOpenSocketForUid(uid) {
    if (!uid) return false;
    for (const client of authenticatedClients) {
      if (client.readyState === 1 && client.uid === uid) {
        return true;
      }
    }
    return false;
  }

  function removeOtherLiveStreamsForHost(hostUid, keepStreamId) {
    if (!hostUid) return;
    for (const [existingId, entry] of Array.from(activeLiveStreams.entries())) {
      if (existingId !== keepStreamId && entry.data?.host?.id === hostUid) {
        clearHostDisconnectTimer(existingId);
        activeLiveStreams.delete(existingId);
        clearRoomBroadcastQueue(`live:${existingId}`);
        rooms.delete(`live:${existingId}`);
        broadcastAll({ type: 'live:remove', streamId: existingId });
      }
    }
  }

  function removeOtherPartyRoomsForHost(hostUid, keepRoomId) {
    if (!hostUid) return;
    for (const [existingId, entry] of Array.from(activePartyRooms.entries())) {
      if (existingId !== keepRoomId && entry.data?.host?.id === hostUid) {
        activePartyRooms.delete(existingId);
        clearRoomBroadcastQueue(`party:${existingId}`);
        rooms.delete(`party:${existingId}`);
        broadcastAll({ type: 'party:remove', roomId: existingId });
      }
    }
  }

  function getOrCreateRoom(roomKey) {
    let room = rooms.get(roomKey);
    if (!room) {
      room = {
        viewers: new Map(),
        heartCount: 0,
        sessionId: undefined,
        seq: 0,
        eventLog: [], // Array<{ seq: number, event: object, excludeUid: string | null, recordedAtMs: number }>
      };
      rooms.set(roomKey, room);
    }
    return room;
  }

  function appendRoomEventLog(room, seq, event, excludeUid = null) {
    const now = Date.now();
    room.eventLog.push({
      seq,
      event,
      excludeUid: excludeUid || null,
      recordedAtMs: now,
    });
    if (room.eventLog.length > ROOM_REPLAY_BUFFER_SIZE) {
      room.eventLog.splice(0, room.eventLog.length - ROOM_REPLAY_BUFFER_SIZE);
    }
    while (room.eventLog.length > 0 && now - room.eventLog[0].recordedAtMs > ROOM_REPLAY_MAX_AGE_MS) {
      room.eventLog.shift();
    }
  }

  function getRoomViewerList(roomKey) {
    const room = rooms.get(roomKey);
    if (!room) return [];
    return Array.from(room.viewers.values()).map((entry) => entry.profile);
  }

  function broadcastAll(payload) {
    const raw = JSON.stringify(payload);
    for (const client of authenticatedClients) {
      if (client.readyState === 1) {
        try {
          client.send(raw);
        } catch {
          // ignore
        }
      }
    }
  }

  function broadcastToRoom(roomKey, payload, excludeWs = null) {
    const raw = JSON.stringify(payload);
    for (const client of authenticatedClients) {
      if (client === excludeWs) continue;
      if (client.readyState === 1 && client.joinedRooms?.has(roomKey)) {
        try {
          client.send(raw);
        } catch {
          // ignore
        }
      }
    }
  }

  function flushRoomBroadcastQueue(roomKey) {
    const queue = roomBroadcastQueues.get(roomKey);
    if (!queue) return;
    if (queue.timer) {
      clearTimeout(queue.timer);
      queue.timer = null;
    }
    roomBroadcastQueues.delete(roomKey);
    if (!queue.items.length) return;

    const sepIdx = roomKey.indexOf(':');
    const roomType = sepIdx > 0 ? roomKey.slice(0, sepIdx) : 'party';
    const roomId = sepIdx > 0 ? roomKey.slice(sepIdx + 1) : roomKey;
    const room = getOrCreateRoom(roomKey);

    // Assign contiguous monotonic sequence numbers AFTER batch coalescing is finalized
    const sequencedItems = queue.items.map((item) => {
      room.seq += 1;
      const seq = room.seq;
      const sequencedEvent = {
        ...item.event,
        ...(room.sessionId && !item.event.roomSessionId ? { roomSessionId: room.sessionId } : {}),
        seq,
      };
      appendRoomEventLog(room, seq, sequencedEvent, item.excludeWs?.uid || null);
      return {
        event: sequencedEvent,
        excludeWs: item.excludeWs || null,
      };
    });

    // Fast-path when only 1 event is queued: avoid unnecessary room:batch wrapper overhead
    if (sequencedItems.length === 1) {
      const only = sequencedItems[0];
      broadcastToRoom(roomKey, only.event, only.excludeWs);
      // Send lightweight sequence ack to excluded sender so their sequence tracker stays contiguous
      if (
        only.excludeWs &&
        only.excludeWs.supportsSequencing &&
        only.excludeWs.readyState === 1 &&
        only.excludeWs.joinedRooms?.has(roomKey)
      ) {
        safeJsonSend(only.excludeWs, {
          type: 'room:ack',
          roomType,
          roomId,
          ...(room.sessionId ? { roomSessionId: room.sessionId } : {}),
          seq: only.event.seq,
        });
      }
      return;
    }

    // Pre-serialize common full-batch packet for clients with no excluded items
    let sharedBatchRaw = null;
    const allExcludedSet = new Set();
    for (const item of sequencedItems) {
      if (item.excludeWs) allExcludedSet.add(item.excludeWs);
    }

    for (const client of authenticatedClients) {
      if (client.readyState !== 1 || !client.joinedRooms?.has(roomKey)) continue;

      if (client.supportsBatching) {
        if (!allExcludedSet.has(client)) {
          if (!sharedBatchRaw) {
            sharedBatchRaw = JSON.stringify({
              type: 'room:batch',
              roomType,
              roomId,
              events: sequencedItems.map((item) => item.event),
            });
          }
          try {
            client.send(sharedBatchRaw);
          } catch {
            // ignore
          }
        } else {
          const filtered = [];
          for (const item of sequencedItems) {
            if (item.excludeWs !== client) {
              filtered.push(item.event);
            } else if (client.supportsSequencing) {
              // Lightweight sequence ack keeps the sender's sequence window contiguous without echoing full payload
              filtered.push({
                type: 'room:ack',
                roomType,
                roomId,
                ...(room.sessionId ? { roomSessionId: room.sessionId } : {}),
                seq: item.event.seq,
              });
            }
          }
          if (filtered.length === 1) {
            safeJsonSend(client, filtered[0]);
          } else if (filtered.length > 1) {
            safeJsonSend(client, {
              type: 'room:batch',
              roomType,
              roomId,
              events: filtered,
            });
          }
        }
      } else {
        // Legacy client fallback: send each event individually
        for (const item of sequencedItems) {
          if (item.excludeWs === client) continue;
          safeJsonSend(client, item.event);
        }
      }
    }
  }

  function enqueueRoomBroadcast(roomKey, event, excludeWs = null) {
    let queue = roomBroadcastQueues.get(roomKey);
    if (!queue) {
      queue = { timer: null, items: [] };
      roomBroadcastQueues.set(roomKey, queue);
    }

    // Coalesce redundant viewer snapshots within the same batch window
    if (event.type === 'room:viewers') {
      const existingViewerIdx = queue.items.findIndex(
        (item) => item.event.type === 'room:viewers' && item.excludeWs === excludeWs
      );
      if (existingViewerIdx !== -1) {
        queue.items[existingViewerIdx] = { event, excludeWs };
      } else {
        queue.items.push({ event, excludeWs });
      }
    } else if (event.type === 'room:heart') {
      // Coalesce consecutive heart taps from the same sender in the same batch window
      const existingHeartIdx = queue.items.findIndex(
        (item) =>
          item.event.type === 'room:heart' &&
          item.event.senderId === event.senderId &&
          item.event.roomSessionId === event.roomSessionId &&
          item.excludeWs === excludeWs
      );
      if (existingHeartIdx !== -1) {
        const prev = queue.items[existingHeartIdx].event;
        const prevCount = Math.max(1, Number(prev.count) || 1);
        const nextCount = Math.max(1, Number(event.count) || 1);
        queue.items[existingHeartIdx] = {
          event: {
            ...event,
            count: Math.min(MAX_HEART_BATCH_COUNT, prevCount + nextCount),
          },
          excludeWs,
        };
      } else {
        queue.items.push({ event, excludeWs });
      }
    } else {
      queue.items.push({ event, excludeWs });
    }

    if (queue.items.length >= ROOM_BATCH_MAX_EVENTS) {
      flushRoomBroadcastQueue(roomKey);
      return;
    }

    if (!queue.timer) {
      queue.timer = setTimeout(() => {
        flushRoomBroadcastQueue(roomKey);
      }, ROOM_BATCH_WINDOW_MS);
    }
  }

  function syncPartyDiscoveryPresence(roomId, viewers) {
    const entry = activePartyRooms.get(roomId);
    if (!entry || !entry.data) return;
    const now = Date.now();
    const hostId = entry.data.host?.id || '';
    const isHostPresent = Boolean(hostId && viewers.some((v) => v.id === hostId));
    const nextSeats = Array.isArray(entry.data.seats) ? entry.data.seats : [];
    const updated = {
      ...entry.data,
      seats: nextSeats,
      activeViewers: viewers.length,
      isHostPresent,
      lastSeenAtMs: now,
    };
    activePartyRooms.set(roomId, { data: updated, updatedAtMs: now });
    broadcastAll({ type: 'party:upsert', room: updated });
  }

  function pruneExpiredDiscovery() {
    const now = Date.now();
    for (const [streamId, entry] of activeLiveStreams.entries()) {
      if (isLegacyErrorId(streamId) || now - entry.updatedAtMs > LIVE_TTL_MS) {
        clearHostDisconnectTimer(streamId);
        activeLiveStreams.delete(streamId);
        broadcastAll({ type: 'live:remove', streamId });
      }
    }
    for (const [roomId, entry] of activePartyRooms.entries()) {
      if (isLegacyErrorId(roomId) || now - entry.updatedAtMs > PARTY_TTL_MS) {
        activePartyRooms.delete(roomId);
        broadcastAll({ type: 'party:remove', roomId });
      }
    }
  }

  function getSnapshot() {
    pruneExpiredDiscovery();
    return {
      liveStreams: Array.from(activeLiveStreams.values()).map((e) => e.data),
      partyRooms: Array.from(activePartyRooms.values()).map((e) => e.data),
    };
  }

  function removeSocketFromRoom(ws, roomKey, isExplicitLeave = false) {
    if (!ws.joinedRooms?.has(roomKey)) return;
    ws.joinedRooms.delete(roomKey);
    const room = rooms.get(roomKey);
    if (!room) return;

    const uid = ws.uid;
    const entry = room.viewers.get(uid);
    if (entry) {
      entry.sockets.delete(ws);
      if (entry.sockets.size === 0) {
        room.viewers.delete(uid);
        const [roomType, roomId] = roomKey.split(':');
        const viewers = getRoomViewerList(roomKey);
        const count = viewers.length;
        enqueueRoomBroadcast(roomKey, {
          type: 'room:viewers',
          roomType,
          roomId,
          count,
          viewers,
        });

        if (roomType === 'party') {
          syncPartyDiscoveryPresence(roomId, viewers);
        } else if (roomType === 'live') {
          const liveEntry = activeLiveStreams.get(roomId);
          if (liveEntry && liveEntry.data?.host?.id === uid) {
            if (isExplicitLeave) {
              clearHostDisconnectTimer(roomId);
              activeLiveStreams.delete(roomId);
              broadcastAll({ type: 'live:remove', streamId: roomId });
            } else {
              clearHostDisconnectTimer(roomId);
              const timer = setTimeout(() => {
                pendingLiveHostDisconnectTimers.delete(roomId);
                const currentRoom = rooms.get(roomKey);
                const hostRejoined = Boolean(currentRoom?.viewers?.has(uid)) || hasAnyOpenSocketForUid(uid);
                if (!hostRejoined && activeLiveStreams.has(roomId)) {
                  activeLiveStreams.delete(roomId);
                  broadcastAll({ type: 'live:remove', streamId: roomId });
                }
              }, HOST_DISCONNECT_LIVE_GRACE_MS);
              pendingLiveHostDisconnectTimers.set(roomId, timer);
            }
          }
        }
      }
    }

    if (room.viewers.size === 0 && room.heartCount === 0) {
      clearRoomBroadcastQueue(roomKey);
      rooms.delete(roomKey);
    }
  }

  const registry = {
    getSnapshot,
    getLiveStream(streamId) {
      pruneExpiredDiscovery();
      return activeLiveStreams.get(streamId)?.data || null;
    },
    getPartyRoom(roomId) {
      pruneExpiredDiscovery();
      return activePartyRooms.get(roomId)?.data || null;
    },
    upsertPartyRoom(room) {
      if (!room || !isValidId(room.id) || isLegacyErrorId(room.id)) return;
      const now = Date.now();
      const hostId = room.host?.id || activePartyRooms.get(room.id)?.data?.host?.id;
      if (hostId) {
        removeOtherPartyRoomsForHost(hostId, room.id);
      }
      const existing = activePartyRooms.get(room.id)?.data;
      const merged = existing
        ? { ...existing, ...room, seats: Array.isArray(room.seats) ? room.seats : existing.seats || [], lastSeenAtMs: now }
        : { ...room, seats: Array.isArray(room.seats) ? room.seats : [], lastSeenAtMs: now };
      activePartyRooms.set(room.id, { data: merged, updatedAtMs: now });
      broadcastAll({ type: 'party:upsert', room: merged });
    },
    removePartyRoom(roomId) {
      if (!isValidId(roomId)) return;
      clearRoomBroadcastQueue(`party:${roomId}`);
      rooms.delete(`party:${roomId}`);
      if (activePartyRooms.delete(roomId)) {
        broadcastAll({ type: 'party:remove', roomId });
      }
    },
  };

  if (app) {
    app.locals.realtimeRegistry = registry;
  }

  async function authenticateSocket(ws, token) {
    if (!token || typeof token !== 'string') return false;
    try {
      const user = await verifyFirebaseIdToken(token);
      if (!user?.uid) return false;
      ws.uid = user.uid;
      ws.isAuthed = true;
      authenticatedClients.add(ws);
      const snap = getSnapshot();
      safeJsonSend(ws, {
        type: 'auth:ok',
        uid: user.uid,
        capabilities: {
          batching: true,
          sequencing: true,
          maxBatchSize: MAX_INCOMING_BATCH_EVENTS,
          replayBufferSize: ROOM_REPLAY_BUFFER_SIZE,
        },
        liveStreams: snap.liveStreams,
        partyRooms: snap.partyRooms,
      });
      return true;
    } catch {
      return false;
    }
  }

  function handleAuthedMessage(ws, msg) {
    if (!msg || typeof msg.type !== 'string') return;
    const uid = ws.uid;

    switch (msg.type) {
      case 'discovery:get': {
        const snap = getSnapshot();
        safeJsonSend(ws, {
          type: 'discovery:snapshot',
          liveStreams: snap.liveStreams,
          partyRooms: snap.partyRooms,
        });
        break;
      }

      case 'live:upsert': {
        const stream = msg.stream;
        if (!stream || !isValidId(stream.id) || isLegacyErrorId(stream.id)) return;
        const existing = activeLiveStreams.get(stream.id)?.data;
        const hostId = stream.host?.id || existing?.host?.id;
        if (hostId !== uid) return;
        if (!stream.sfuSessionId || stream.isActive === false) return;
        clearHostDisconnectTimer(stream.id);
        removeOtherLiveStreamsForHost(uid, stream.id);
        const now = Date.now();
        const normalized = {
          ...(existing || {}),
          ...stream,
          isActive: true,
          host: { ...(existing?.host || {}), ...(stream.host || {}), id: uid },
          lastHeartbeatMs: now,
          lastSeenAtMs: now,
        };
        activeLiveStreams.set(stream.id, { data: normalized, updatedAtMs: now });
        broadcastAll({ type: 'live:upsert', stream: normalized });
        break;
      }

      case 'live:remove': {
        const streamId = msg.streamId;
        if (!isValidId(streamId)) return;
        const existing = activeLiveStreams.get(streamId)?.data;
        if (existing && existing.host?.id && existing.host.id !== uid) return;
        clearHostDisconnectTimer(streamId);
        activeLiveStreams.delete(streamId);
        clearRoomBroadcastQueue(`live:${streamId}`);
        rooms.delete(`live:${streamId}`);
        broadcastAll({ type: 'live:remove', streamId });
        break;
      }

      case 'party:upsert': {
        const room = msg.room;
        if (!room || !isValidId(room.id) || isLegacyErrorId(room.id) || room.isActive === false) return;
        const existing = activePartyRooms.get(room.id)?.data;
        const now = Date.now();
        const liveViewers = getRoomViewerList(`party:${room.id}`);
        const incomingSessionId = typeof room.sessionId === 'string' && isValidId(room.sessionId) ? room.sessionId : undefined;
        if (incomingSessionId) {
          const roomState = getOrCreateRoom(`party:${room.id}`);
          if (roomState.sessionId && roomState.sessionId !== incomingSessionId) {
            roomState.heartCount = 0;
            roomState.seq = 0;
            roomState.eventLog = [];
          }
          roomState.sessionId = incomingSessionId;
        }
        if (!existing) {
          if (room.host?.id !== uid) return;
          removeOtherPartyRoomsForHost(uid, room.id);
          const normalized = {
            ...room,
            seats: Array.isArray(room.seats) ? room.seats : [],
            isActive: true,
            isHostPresent: room.isHostPresent !== false,
            activeViewers:
              typeof room.activeViewers === 'number'
                ? Math.max(0, Math.floor(room.activeViewers))
                : liveViewers.length,
            lastSeenAtMs: now,
          };
          activePartyRooms.set(room.id, { data: normalized, updatedAtMs: now });
          broadcastAll({ type: 'party:upsert', room: normalized });
        } else if (existing.host?.id === uid) {
          removeOtherPartyRoomsForHost(uid, room.id);
          const normalized = {
            ...existing,
            ...room,
            seats: Array.isArray(room.seats) ? room.seats : existing.seats || [],
            isActive: true,
            isHostPresent:
              typeof room.isHostPresent === 'boolean' ? room.isHostPresent : existing.isHostPresent !== false,
            activeViewers:
              typeof room.activeViewers === 'number'
                ? Math.max(0, Math.floor(room.activeViewers))
                : liveViewers.length,
            lastSeenAtMs: now,
          };
          activePartyRooms.set(room.id, { data: normalized, updatedAtMs: now });
          broadcastAll({ type: 'party:upsert', room: normalized });
        } else {
          // Non-host seated participant or viewer may sync bounded live fields (seats / activeViewers)
          const partial = { ...existing, lastSeenAtMs: now };
          if (Array.isArray(room.seats)) partial.seats = room.seats;
          if (typeof room.activeViewers === 'number') {
            partial.activeViewers = Math.max(0, Math.floor(room.activeViewers));
          }
          activePartyRooms.set(room.id, { data: partial, updatedAtMs: now });
          broadcastAll({ type: 'party:upsert', room: partial });
        }
        break;
      }

      case 'party:remove': {
        const roomId = msg.roomId;
        if (!isValidId(roomId)) return;
        const existing = activePartyRooms.get(roomId)?.data;
        if (existing && existing.host?.id && existing.host.id !== uid) return;
        activePartyRooms.delete(roomId);
        clearRoomBroadcastQueue(`party:${roomId}`);
        rooms.delete(`party:${roomId}`);
        broadcastAll({ type: 'party:remove', roomId });
        break;
      }

      case 'room:join': {
        const roomType = msg.roomType === 'live' || msg.roomType === 'party' ? msg.roomType : null;
        const roomId = msg.roomId;
        if (!roomType || !isValidId(roomId)) return;
        const roomKey = `${roomType}:${roomId}`;
        const room = getOrCreateRoom(roomKey);
        const incomingSessionId =
          roomType === 'party' && typeof msg.roomSessionId === 'string' && isValidId(msg.roomSessionId)
            ? msg.roomSessionId
            : undefined;
        let sessionWasReset = false;
        if (incomingSessionId && room.sessionId !== incomingSessionId) {
          room.heartCount = 0;
          room.seq = 0;
          room.eventLog = [];
          room.sessionId = incomingSessionId;
          sessionWasReset = true;
        }
        if (!sessionWasReset && typeof msg.initialHeartCount === 'number' && msg.initialHeartCount > room.heartCount) {
          room.heartCount = Math.floor(msg.initialHeartCount);
        }

        ws.joinedRooms.add(roomKey);
        const profile = sanitizeViewerProfile(uid, msg.profile || {});
        let viewerEntry = room.viewers.get(uid);
        if (!viewerEntry) {
          viewerEntry = { profile, sockets: new Set([ws]) };
          room.viewers.set(uid, viewerEntry);
        } else {
          viewerEntry.profile = { ...viewerEntry.profile, ...profile };
          viewerEntry.sockets.add(ws);
        }

        if (roomType === 'live') {
          clearHostDisconnectTimer(roomId);
        }

        const viewers = getRoomViewerList(roomKey);
        const count = viewers.length;

        // If reconnecting with a known lastSeq in the same session, include recent missed events
        const clientLastSeq = Number(msg.lastSeq);
        let replayEvents;
        if (
          !sessionWasReset &&
          Number.isFinite(clientLastSeq) &&
          clientLastSeq >= 0 &&
          clientLastSeq < room.seq &&
          room.eventLog.length > 0
        ) {
          const now = Date.now();
          const missed = [];
          for (const entry of room.eventLog) {
            if (entry.seq <= clientLastSeq) continue;
            if (now - entry.recordedAtMs > ROOM_RECONNECT_REPLAY_AGE_MS) continue;
            if (entry.excludeUid && entry.excludeUid === uid) continue;
            if (entry.event.type === 'room:viewers') continue; // latest viewers already in room:state_init
            missed.push(entry.event);
            if (missed.length >= MAX_SYNC_RESPONSE_EVENTS) break;
          }
          if (missed.length > 0) {
            replayEvents = missed;
          }
        }

        safeJsonSend(ws, {
          type: 'room:state_init',
          roomType,
          roomId,
          ...(room.sessionId ? { roomSessionId: room.sessionId } : {}),
          seq: room.seq,
          heartCount: room.heartCount,
          viewers,
          count,
          ...(replayEvents ? { replayEvents } : {}),
        });

        enqueueRoomBroadcast(roomKey, {
          type: 'room:viewers',
          roomType,
          roomId,
          count,
          viewers,
        });

        if (roomType === 'party') {
          syncPartyDiscoveryPresence(roomId, viewers);
        }
        break;
      }

      case 'room:sync_request': {
        const roomType = msg.roomType === 'live' || msg.roomType === 'party' ? msg.roomType : null;
        const roomId = msg.roomId;
        if (!roomType || !isValidId(roomId)) return;
        const roomKey = `${roomType}:${roomId}`;
        if (!ws.joinedRooms?.has(roomKey)) return;

        // Flush any currently buffered items so replay range reflects latest server state
        flushRoomBroadcastQueue(roomKey);

        const room = rooms.get(roomKey);
        if (!room) return;

        const incomingSessionId =
          roomType === 'party' && typeof msg.roomSessionId === 'string' && isValidId(msg.roomSessionId)
            ? msg.roomSessionId
            : undefined;
        const sessionMismatch = Boolean(incomingSessionId && room.sessionId && incomingSessionId !== room.sessionId);

        const fromSeq = Math.max(1, Math.floor(Number(msg.fromSeq) || 1));
        const rawToSeq = Number(msg.toSeq);
        const toSeq = Number.isFinite(rawToSeq) && rawToSeq >= fromSeq ? Math.min(room.seq, Math.floor(rawToSeq)) : room.seq;

        const now = Date.now();
        while (room.eventLog.length > 0 && now - room.eventLog[0].recordedAtMs > ROOM_REPLAY_MAX_AGE_MS) {
          room.eventLog.shift();
        }

        const earliestBufferedSeq = room.eventLog.length > 0 ? room.eventLog[0].seq : room.seq + 1;
        const snapshotRequired =
          sessionMismatch ||
          fromSeq > room.seq ||
          (toSeq >= fromSeq && fromSeq < earliestBufferedSeq) ||
          toSeq - fromSeq + 1 > MAX_SYNC_RESPONSE_EVENTS;

        const recoveredEvents = [];
        if (!sessionMismatch) {
          for (const entry of room.eventLog) {
            if (entry.seq < fromSeq || entry.seq > toSeq) continue;
            if (entry.excludeUid && entry.excludeUid === uid) {
              recoveredEvents.push({
                type: 'room:ack',
                roomType,
                roomId,
                ...(room.sessionId ? { roomSessionId: room.sessionId } : {}),
                seq: entry.seq,
              });
            } else {
              recoveredEvents.push(entry.event);
            }
            if (recoveredEvents.length >= MAX_SYNC_RESPONSE_EVENTS) break;
          }
        }

        const viewers = snapshotRequired ? getRoomViewerList(roomKey) : undefined;
        safeJsonSend(ws, {
          type: 'room:sync_response',
          roomType,
          roomId,
          ...(room.sessionId ? { roomSessionId: room.sessionId } : {}),
          fromSeq,
          toSeq,
          currentSeq: room.seq,
          snapshotRequired,
          ...(snapshotRequired
            ? {
                heartCount: room.heartCount,
                viewers,
                count: viewers ? viewers.length : 0,
              }
            : {}),
          events: recoveredEvents,
        });
        break;
      }

      case 'room:leave': {
        const roomType = msg.roomType === 'live' || msg.roomType === 'party' ? msg.roomType : null;
        const roomId = msg.roomId;
        if (!roomType || !isValidId(roomId)) return;
        removeSocketFromRoom(ws, `${roomType}:${roomId}`, true);
        break;
      }

      case 'room:heart': {
        const roomType = msg.roomType === 'live' || msg.roomType === 'party' ? msg.roomType : null;
        const roomId = msg.roomId;
        if (!roomType || !isValidId(roomId)) return;
        const roomKey = `${roomType}:${roomId}`;
        const room = getOrCreateRoom(roomKey);
        const incomingSessionId =
          roomType === 'party' && typeof msg.roomSessionId === 'string' && isValidId(msg.roomSessionId)
            ? msg.roomSessionId
            : undefined;
        if (incomingSessionId && room.sessionId && incomingSessionId !== room.sessionId) {
          break;
        }
        const rawCount = Number(msg.count);
        const delta =
          Number.isFinite(rawCount) && rawCount > 1
            ? Math.min(MAX_HEART_BATCH_COUNT, Math.floor(rawCount))
            : 1;
        room.heartCount += delta;
        const eventPayload = {
          type: 'room:heart',
          roomType,
          roomId,
          ...(room.sessionId ? { roomSessionId: room.sessionId } : {}),
          senderId: uid,
          heartCount: room.heartCount,
          count: delta,
          eventId: `ws_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          createdAtMs: Date.now(),
        };
        enqueueRoomBroadcast(roomKey, eventPayload);
        break;
      }

      case 'room:signal': {
        const roomType = msg.roomType === 'live' || msg.roomType === 'party' ? msg.roomType : null;
        const roomId = msg.roomId;
        if (!roomType || !isValidId(roomId) || !msg.signal || typeof msg.signal !== 'object') return;
        const roomKey = `${roomType}:${roomId}`;
        enqueueRoomBroadcast(
          roomKey,
          {
            type: 'room:signal',
            roomType,
            roomId,
            senderId: uid,
            signal: msg.signal,
            ts: Date.now(),
          },
          ws
        );
        break;
      }

      default:
        break;
    }
  }

  function handleMessage(ws, raw) {
    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }
    if (!msg || typeof msg.type !== 'string') return;

    if (msg.type === 'ping') {
      safeJsonSend(ws, { type: 'pong', ts: Date.now() });
      return;
    }

    if (!ws.isAuthed) {
      if (msg.type === 'auth' && typeof msg.token === 'string') {
        authenticateSocket(ws, msg.token).then((ok) => {
          if (!ok) {
            try {
              ws.close(4001, 'Unauthorized');
            } catch {
              // ignore
            }
          }
        });
      }
      return;
    }

    if (msg.type === 'ws:batch' && Array.isArray(msg.events)) {
      const limit = Math.min(msg.events.length, MAX_INCOMING_BATCH_EVENTS);
      for (let i = 0; i < limit; i += 1) {
        const subEvent = msg.events[i];
        if (subEvent && typeof subEvent === 'object' && subEvent.type !== 'ws:batch') {
          handleAuthedMessage(ws, subEvent);
        }
      }
      return;
    }

    handleAuthedMessage(ws, msg);
  }

  wss.on('connection', (ws, _req, initialToken, supportsBatching = false, supportsSequencing = false) => {
    ws.isAlive = true;
    ws.isAuthed = false;
    ws.uid = null;
    ws.joinedRooms = new Set();
    ws.supportsBatching = Boolean(supportsBatching);
    ws.supportsSequencing = Boolean(supportsSequencing);

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', (data) => handleMessage(ws, data));

    ws.on('close', () => {
      authenticatedClients.delete(ws);
      const joined = Array.from(ws.joinedRooms || []);
      for (const roomKey of joined) {
        removeSocketFromRoom(ws, roomKey, false);
      }
    });

    if (initialToken) {
      authenticateSocket(ws, initialToken).then((ok) => {
        if (!ok) {
          try {
            ws.close(4001, 'Unauthorized');
          } catch {
            // ignore
          }
        }
      });
    } else {
      const authTimeout = setTimeout(() => {
        if (!ws.isAuthed) {
          try {
            ws.close(4001, 'Auth timeout');
          } catch {
            // ignore
          }
        }
      }, 10_000);
      ws.once('close', () => clearTimeout(authTimeout));
    }
  });

  httpServer.on('upgrade', (request, socket, head) => {
    try {
      const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
      if (url.pathname !== '/ws') {
        return; // Let other handlers (if any) ignore or handle
      }
      const token = url.searchParams.get('token') || '';
      const supportsBatching = url.searchParams.get('batch') === '1';
      const supportsSequencing = url.searchParams.get('seq') === '1';
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request, token, supportsBatching, supportsSequencing);
      });
    } catch {
      socket.destroy();
    }
  });

  const pingInterval = setInterval(() => {
    pruneExpiredDiscovery();
    for (const ws of wss.clients) {
      if (ws.isAlive === false) {
        try {
          ws.terminate();
        } catch {
          // ignore
        }
        continue;
      }
      ws.isAlive = false;
      try {
        ws.ping();
      } catch {
        // ignore
      }
    }
  }, HEARTBEAT_INTERVAL_MS);

  wss.on('close', () => {
    clearInterval(pingInterval);
    for (const roomKey of Array.from(roomBroadcastQueues.keys())) {
      clearRoomBroadcastQueue(roomKey);
    }
  });

  return { wss, registry };
}
