import { WebSocketServer } from 'ws';

const LIVE_TTL_MS = 120_000;
const PARTY_TTL_MS = 12 * 60 * 60_000;
const HEARTBEAT_INTERVAL_MS = 25_000;
const HOST_DISCONNECT_LIVE_GRACE_MS = 6_000;

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
  const wss = new WebSocketServer({ noServer: true, maxPayload: 128 * 1024 });

  // Server-authoritative state stores
  const activeLiveStreams = new Map(); // streamId -> { data, updatedAtMs }
  const activePartyRooms = new Map(); // roomId -> { data, updatedAtMs }
  const rooms = new Map(); // `${roomType}:${roomId}` -> { viewers: Map<uid, { profile, sockets: Set<ws> }>, heartCount: number }
  const authenticatedClients = new Set();
  const pendingLiveHostDisconnectTimers = new Map(); // streamId -> Timeout

  function clearHostDisconnectTimer(streamId) {
    const t = pendingLiveHostDisconnectTimers.get(streamId);
    if (t) {
      clearTimeout(t);
      pendingLiveHostDisconnectTimers.delete(streamId);
    }
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
        broadcastAll({ type: 'live:remove', streamId: existingId });
      }
    }
  }

  function removeOtherPartyRoomsForHost(hostUid, keepRoomId) {
    if (!hostUid) return;
    for (const [existingId, entry] of Array.from(activePartyRooms.entries())) {
      if (existingId !== keepRoomId && entry.data?.host?.id === hostUid) {
        activePartyRooms.delete(existingId);
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
      };
      rooms.set(roomKey, room);
    }
    return room;
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

  function syncPartyDiscoveryPresence(roomId, viewers, departedUid = null) {
    const entry = activePartyRooms.get(roomId);
    if (!entry || !entry.data) return;
    const now = Date.now();
    const hostId = entry.data.host?.id || '';
    const isHostPresent = Boolean(hostId && viewers.some((v) => v.id === hostId));
    let nextSeats = Array.isArray(entry.data.seats) ? entry.data.seats : [];
    if (departedUid && nextSeats.some((s) => s?.user?.id === departedUid)) {
      nextSeats = nextSeats.map((s) =>
        s?.user?.id === departedUid
          ? { ...s, user: null, isSpeaking: false, isMuted: false, isHostMuted: false }
          : s
      );
    }
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
        broadcastToRoom(roomKey, {
          type: 'room:viewers',
          roomType,
          roomId,
          count,
          viewers,
        });

        if (roomType === 'party') {
          syncPartyDiscoveryPresence(roomId, viewers, uid);
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
        liveStreams: snap.liveStreams,
        partyRooms: snap.partyRooms,
      });
      return true;
    } catch {
      return false;
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
        broadcastAll({ type: 'live:remove', streamId });
        break;
      }

      case 'party:upsert': {
        const room = msg.room;
        if (!room || !isValidId(room.id) || isLegacyErrorId(room.id) || room.isActive === false) return;
        const existing = activePartyRooms.get(room.id)?.data;
        const now = Date.now();
        const liveViewers = getRoomViewerList(`party:${room.id}`);
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
        broadcastAll({ type: 'party:remove', roomId });
        break;
      }

      case 'room:join': {
        const roomType = msg.roomType === 'live' || msg.roomType === 'party' ? msg.roomType : null;
        const roomId = msg.roomId;
        if (!roomType || !isValidId(roomId)) return;
        const roomKey = `${roomType}:${roomId}`;
        const room = getOrCreateRoom(roomKey);
        if (typeof msg.initialHeartCount === 'number' && msg.initialHeartCount > room.heartCount) {
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

        safeJsonSend(ws, {
          type: 'room:state_init',
          roomType,
          roomId,
          heartCount: room.heartCount,
          viewers,
          count,
        });

        broadcastToRoom(roomKey, {
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
        room.heartCount += 1;
        const eventPayload = {
          type: 'room:heart',
          roomType,
          roomId,
          senderId: uid,
          heartCount: room.heartCount,
          eventId: `ws_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          createdAtMs: Date.now(),
        };
        broadcastToRoom(roomKey, eventPayload);
        break;
      }

      case 'room:signal': {
        const roomType = msg.roomType === 'live' || msg.roomType === 'party' ? msg.roomType : null;
        const roomId = msg.roomId;
        if (!roomType || !isValidId(roomId) || !msg.signal || typeof msg.signal !== 'object') return;
        const roomKey = `${roomType}:${roomId}`;
        broadcastToRoom(
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

  wss.on('connection', (ws, _req, initialToken) => {
    ws.isAlive = true;
    ws.isAuthed = false;
    ws.uid = null;
    ws.joinedRooms = new Set();

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
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request, token);
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

  wss.on('close', () => clearInterval(pingInterval));

  return { wss, registry };
}
