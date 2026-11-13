import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function readFirebaseConfigFallback() {
  try {
    const configPath = path.join(__dirname, 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  } catch {
    // ignore fallback read errors
  }
  return {};
}

export function createApiApp() {
  const app = express();
  const firebaseFallback = readFirebaseConfigFallback();

  // FIREBASE_API_KEY is a public Web API key used for Identity Toolkit ID-token lookup.
  // Cloudflare TURN & SFU credentials MUST remain strictly server-side environment variables.
  const FIREBASE_API_KEY =
    process.env.FIREBASE_API_KEY ||
    process.env.VITE_FIREBASE_API_KEY ||
    firebaseFallback.apiKey ||
    '';
  const FIREBASE_PROJECT_ID =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.VITE_FIREBASE_PROJECT_ID ||
    firebaseFallback.projectId ||
    'gen-lang-client-0468444352';
  const FIREBASE_DATABASE_ID =
    process.env.FIREBASE_DATABASE_ID ||
    process.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID ||
    firebaseFallback.firestoreDatabaseId ||
    'ai-studio-alphamatelivepar-88a3637b-56a3-47f2-a3ab-b67bf1702cff';

  const CLOUDFLARE_TURN_TOKEN_ID = (
    process.env.CLOUDFLARE_TURN_TOKEN_ID ||
    process.env.CLOUDFLARE_TURN_KEY_ID ||
    ''
  ).trim();
  const CLOUDFLARE_TURN_API_TOKEN = (process.env.CLOUDFLARE_TURN_API_TOKEN || '').trim();
  const TURN_CREDENTIAL_TTL = Math.min(Math.max(Number(process.env.TURN_CREDENTIAL_TTL || 3600), 300), 86400);

  const REALTIME_SFU_APP_ID = (process.env.REALTIME_SFU_APP_ID || '').trim();
  const REALTIME_SFU_BEARER_TOKEN = (process.env.REALTIME_SFU_BEARER_TOKEN || '').trim();
  const CLOUDFLARE_SFU_BASE = 'https://rtc.live.cloudflare.com/v1';

  const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '*')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

  app.use(express.json({ limit: '1mb' }));

  app.use((req, res, next) => {
    const origin = req.headers.origin || '';
    const allowed = ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.includes(origin);
    if (allowed) res.header('Access-Control-Allow-Origin', ALLOWED_ORIGINS.includes('*') ? '*' : origin);
    res.header('Vary', 'Origin');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } catch (err) {
      if (err?.name === 'AbortError') {
        const timeoutErr = new Error(`Upstream request timed out after ${timeoutMs}ms.`);
        timeoutErr.statusCode = 504;
        timeoutErr.code = 'UPSTREAM_TIMEOUT';
        throw timeoutErr;
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  async function generateTurnIceServers(ttlSeconds = TURN_CREDENTIAL_TTL) {
    if (!CLOUDFLARE_TURN_TOKEN_ID || !CLOUDFLARE_TURN_API_TOKEN) {
      const err = new Error(
        'TURN backend is not configured. Set CLOUDFLARE_TURN_TOKEN_ID and CLOUDFLARE_TURN_API_TOKEN on the backend server.'
      );
      err.statusCode = 503;
      err.code = 'TURN_NOT_CONFIGURED';
      throw err;
    }

    const ttl = Math.min(Math.max(Number(ttlSeconds) || TURN_CREDENTIAL_TTL, 300), 86400);
    const turnResponse = await fetchWithTimeout(
      `${CLOUDFLARE_SFU_BASE}/turn/keys/${encodeURIComponent(CLOUDFLARE_TURN_TOKEN_ID)}/credentials/generate-ice-servers`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${CLOUDFLARE_TURN_API_TOKEN}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ ttl }),
      },
      8000
    );

    const turnData = await turnResponse.json().catch(() => ({}));
    const rawServers = Array.isArray(turnData?.iceServers)
      ? turnData.iceServers
      : turnData?.iceServers
      ? [turnData.iceServers]
      : [];

    const hasValidTurnCreds = rawServers.some((server) => {
      const urls = Array.isArray(server?.urls) ? server.urls : server?.urls ? [server.urls] : [];
      return (
        urls.some((u) => typeof u === 'string' && (u.startsWith('turn:') || u.startsWith('turns:'))) &&
        typeof server?.username === 'string' &&
        server.username.length > 0 &&
        typeof server?.credential === 'string' &&
        server.credential.length > 0
      );
    });

    if (!turnResponse.ok || !hasValidTurnCreds) {
      const err = new Error(
        turnData?.errorDescription ||
          turnData?.error ||
          `Cloudflare TURN credential generation failed (${turnResponse.status}).`
      );
      err.statusCode = turnResponse.status === 401 || turnResponse.status === 403 ? 502 : 502;
      throw err;
    }

    return {
      iceServers: rawServers,
      ttl,
      expiresAt: Date.now() + ttl * 1000,
    };
  }

  let healthCache = null;
  let healthCacheExpiresAt = 0;

  async function validateSystemHealth(forceFresh = false) {
    const now = Date.now();
    if (!forceFresh && healthCache && now < healthCacheExpiresAt) {
      return healthCache;
    }

    const firebaseEnvPresent = Boolean(FIREBASE_API_KEY && FIREBASE_PROJECT_ID && FIREBASE_DATABASE_ID);
    const sfuEnvPresent = Boolean(REALTIME_SFU_APP_ID && REALTIME_SFU_BEARER_TOKEN);
    const turnEnvPresent = Boolean(CLOUDFLARE_TURN_TOKEN_ID && CLOUDFLARE_TURN_API_TOKEN);

    const [firebaseCheck, sfuCheck, turnCheck] = await Promise.all([
      (async () => {
        if (!firebaseEnvPresent) {
          return { configured: false, valid: false, reason: 'Firebase API key or project config missing' };
        }
        try {
          const resp = await fetchWithTimeout(
            `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(FIREBASE_API_KEY)}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ idToken: 'health-probe' }),
            },
            6000
          );
          const payload = await resp.json().catch(() => ({}));
          const msg = payload?.error?.message || '';
          const keyRejected = msg.includes('API_KEY_INVALID') || resp.status === 403;
          return {
            configured: !keyRejected,
            valid: !keyRejected,
            projectId: FIREBASE_PROJECT_ID,
            ...(keyRejected ? { reason: 'Firebase API key rejected by Identity Toolkit' } : {}),
          };
        } catch {
          return { configured: false, valid: false, reason: 'Identity Toolkit unreachable' };
        }
      })(),
      (async () => {
        if (!sfuEnvPresent) {
          return { configured: false, valid: false, reason: 'REALTIME_SFU_APP_ID or REALTIME_SFU_BEARER_TOKEN missing' };
        }
        try {
          const resp = await fetchWithTimeout(
            `${CLOUDFLARE_SFU_BASE}/apps/${encodeURIComponent(REALTIME_SFU_APP_ID)}/sessions/health-probe`,
            {
              method: 'GET',
              headers: {
                Authorization: `Bearer ${REALTIME_SFU_BEARER_TOKEN}`,
                Accept: 'application/json',
              },
            },
            6000
          );
          // 401/403 means invalid App ID / Bearer token; 404/400/200 means credentials authenticated against Cloudflare SFU
          const authOk = resp.status !== 401 && resp.status !== 403 && resp.status < 500;
          return {
            configured: authOk,
            valid: authOk,
            ...(!authOk ? { reason: `Cloudflare SFU auth check returned HTTP ${resp.status}` } : {}),
          };
        } catch {
          return { configured: false, valid: false, reason: 'Cloudflare SFU API unreachable' };
        }
      })(),
      (async () => {
        if (!turnEnvPresent) {
          return { configured: false, valid: false, reason: 'CLOUDFLARE_TURN_TOKEN_ID or CLOUDFLARE_TURN_API_TOKEN missing' };
        }
        try {
          await generateTurnIceServers(300);
          return { configured: true, valid: true };
        } catch (err) {
          return {
            configured: false,
            valid: false,
            reason: err instanceof Error ? err.message : 'TURN credential generation failed',
          };
        }
      })(),
    ]);

    const result = {
      success: true,
      service: 'alpha-mate-backend',
      status: 'online',
      firebaseConfigured: firebaseCheck.valid,
      turnConfigured: Boolean(firebaseCheck.valid && turnCheck.valid),
      sfuConfigured: Boolean(firebaseCheck.valid && sfuCheck.valid),
      checks: {
        firebase: firebaseCheck,
        sfu: sfuCheck,
        turn: turnCheck,
      },
      checkedAt: new Date(now).toISOString(),
    };

    healthCache = result;
    healthCacheExpiresAt = now + 60_000;
    return result;
  }

  app.get('/api/health', async (req, res) => {
    try {
      const forceFresh = req.query?.fresh === '1' || req.query?.fresh === 'true';
      const report = await validateSystemHealth(forceFresh);
      return res.json(report);
    } catch (error) {
      console.error('[Health] Probe failed:', error);
      return res.status(500).json({
        success: false,
        service: 'alpha-mate-backend',
        status: 'degraded',
        firebaseConfigured: false,
        turnConfigured: false,
        sfuConfigured: false,
      });
    }
  });

  async function verifyFirebaseIdToken(idToken) {
    if (!FIREBASE_API_KEY) throw new Error('FIREBASE_API_KEY is not configured on the backend server.');
    const response = await fetchWithTimeout(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(FIREBASE_API_KEY)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      },
      6000
    );
    if (!response.ok) return null;
    const data = await response.json();
    const user = data.users?.[0];
    return user?.localId ? { uid: user.localId, email: user.email || null, emailVerified: !!user.emailVerified } : null;
  }

  async function requireFirebaseAuth(req, res, next) {
    try {
      const authHeader = req.headers.authorization || '';
      const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
      if (!idToken) {
        return res.status(401).json({ success: false, error: 'Firebase Bearer token required.' });
      }
      if (!FIREBASE_API_KEY) {
        return res.status(503).json({
          success: false,
          error: 'FIREBASE_API_KEY is not configured on the backend server.',
        });
      }
      const authenticatedUser = await verifyFirebaseIdToken(idToken);
      if (!authenticatedUser) {
        return res.status(401).json({ success: false, error: 'Firebase ID token is invalid or expired.' });
      }
      req.firebaseUser = authenticatedUser;
      req.firebaseIdToken = idToken;
      next();
    } catch (error) {
      console.error('[Auth] Middleware verification failed:', error);
      return res.status(503).json({ success: false, error: 'Firebase token verification failed.' });
    }
  }

  function parseFirestoreValue(val) {
    if (!val || typeof val !== 'object') return undefined;
    if ('stringValue' in val) return val.stringValue;
    if ('integerValue' in val) return Number(val.integerValue);
    if ('doubleValue' in val) return Number(val.doubleValue);
    if ('booleanValue' in val) return Boolean(val.booleanValue);
    if ('nullValue' in val) return null;
    if ('timestampValue' in val) return val.timestampValue;
    if ('arrayValue' in val) {
      return Array.isArray(val.arrayValue?.values) ? val.arrayValue.values.map(parseFirestoreValue) : [];
    }
    if ('mapValue' in val) {
      const out = {};
      const fields = val.mapValue?.fields || {};
      for (const [k, v] of Object.entries(fields)) {
        out[k] = parseFirestoreValue(v);
      }
      return out;
    }
    return undefined;
  }

  async function fetchFirestoreDocument(documentPath, idToken) {
    const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      FIREBASE_PROJECT_ID
    )}/databases/${encodeURIComponent(FIREBASE_DATABASE_ID)}/documents/${documentPath}`;
    const response = await fetchWithTimeout(
      url,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${idToken}`, Accept: 'application/json' },
      },
      6000
    );
    if (response.status === 404) return null;
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Firestore lookup failed (${response.status}): ${text.slice(0, 150)}`);
    }
    const json = await response.json();
    const parsed = {};
    for (const [k, v] of Object.entries(json.fields || {})) {
      parsed[k] = parseFirestoreValue(v);
    }
    return parsed;
  }

  function isValidResourceId(value) {
    return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
  }

  async function authorizeRemoteTrackSubscriptions(req, tracks) {
    const remoteTracks = tracks.filter((t) => t.location === 'remote');
    if (!remoteTracks.length) return { ok: true };

    const contextType = req.body?.contextType;
    const contextId = req.body?.contextId;
    if (!contextType || !contextId) {
      return { ok: true };
    }

    if (!isValidResourceId(contextId)) {
      return { ok: false, status: 400, error: 'Invalid room or stream contextId.' };
    }

    const uid = req.firebaseUser.uid;
    const idToken = req.firebaseIdToken;

    if (contextType === 'live') {
      const streamDoc = await fetchFirestoreDocument(`liveStreams/${encodeURIComponent(contextId)}`, idToken);
      if (!streamDoc || streamDoc.isActive === false) {
        return { ok: false, status: 404, error: 'Live stream is not active or no longer exists.' };
      }
      const blocked = Array.isArray(streamDoc.blockedUserIds) ? streamDoc.blockedUserIds : [];
      const kicked = Array.isArray(streamDoc.kickedUserIds) ? streamDoc.kickedUserIds : [];
      if (blocked.includes(uid) || kicked.includes(uid)) {
        return { ok: false, status: 403, error: 'Access to this live stream is restricted.' };
      }
      if (streamDoc.sfuSessionId) {
        const invalidSession = remoteTracks.some((t) => t.sessionId !== streamDoc.sfuSessionId);
        if (invalidSession) {
          return { ok: false, status: 403, error: 'Requested track session does not match active host session.' };
        }
      }
      return { ok: true };
    }

    if (contextType === 'party') {
      const roomDoc = await fetchFirestoreDocument(`partyRooms/${encodeURIComponent(contextId)}`, idToken);
      if (!roomDoc || roomDoc.isActive === false) {
        return { ok: false, status: 404, error: 'Party room is closed or no longer exists.' };
      }
      const blocked = Array.isArray(roomDoc.blockedUserIds) ? roomDoc.blockedUserIds : [];
      const kicked = Array.isArray(roomDoc.kickedUserIds) ? roomDoc.kickedUserIds : [];
      if (blocked.includes(uid) || kicked.includes(uid)) {
        return { ok: false, status: 403, error: 'You are restricted from this party room.' };
      }
      const targetSessionIds = Array.from(new Set(remoteTracks.map((t) => t.sessionId)));
      const peerIds = Array.isArray(req.body?.speakerPeerIds) ? req.body.speakerPeerIds.filter(isValidResourceId) : [];
      if (peerIds.length > 0) {
        const checks = await Promise.all(
          peerIds.map((peerId) =>
            fetchFirestoreDocument(
              `partyRooms/${encodeURIComponent(contextId)}/voiceParticipants/${encodeURIComponent(peerId)}`,
              idToken
            ).catch(() => null)
          )
        );
        const seats = Array.isArray(roomDoc.seats) ? roomDoc.seats : [];
        const authorizedPeerIds = new Set([
          ...(roomDoc.host?.id ? [roomDoc.host.id] : []),
          ...(Array.isArray(roomDoc.moderatorIds) ? roomDoc.moderatorIds : []),
          ...seats.map((s) => s?.user?.id).filter(Boolean),
        ]);
        const blockedSet = new Set([...blocked, ...kicked]);
        const inactiveSessions = new Set(
          checks
            .filter((docData) => docData && docData.isPublishing === false && docData.sfuSessionId)
            .map((docData) => docData.sfuSessionId)
        );
        const publishedSessions = new Set(
          checks
            .filter((docData) => docData && docData.isPublishing === true && docData.sfuSessionId)
            .map((docData) => docData.sfuSessionId)
        );

        const anyBlockedPeer = peerIds.some((pid) => blockedSet.has(pid));
        if (anyBlockedPeer) {
          return { ok: false, status: 403, error: 'Requested speaker is restricted from this party room.' };
        }
        const hasInactiveRequestedSession = targetSessionIds.some(
          (sid) => inactiveSessions.has(sid) && !publishedSessions.has(sid)
        );
        const hasUnseatedPeer =
          publishedSessions.size === 0 &&
          peerIds.some((pid) => !authorizedPeerIds.has(pid));
        if (hasInactiveRequestedSession || hasUnseatedPeer) {
          return { ok: false, status: 403, error: 'Target party speaker is not actively publishing.' };
        }
      }
      return { ok: true };
    }

    return { ok: false, status: 400, error: 'Unsupported contextType. Expected "live" or "party".' };
  }

  async function callCloudflareSfu(subPath, method, body) {
    if (!REALTIME_SFU_APP_ID || !REALTIME_SFU_BEARER_TOKEN) {
      const err = new Error(
        'Cloudflare Realtime SFU is not configured. Set REALTIME_SFU_APP_ID and REALTIME_SFU_BEARER_TOKEN on the backend server.'
      );
      err.statusCode = 503;
      err.code = 'SFU_NOT_CONFIGURED';
      throw err;
    }

    const targetUrl = `${CLOUDFLARE_SFU_BASE}/apps/${encodeURIComponent(REALTIME_SFU_APP_ID)}${subPath}`;
    const fetchOptions = {
      method,
      headers: {
        Authorization: `Bearer ${REALTIME_SFU_BEARER_TOKEN}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    };
    if (body !== undefined && method !== 'GET') {
      fetchOptions.body = JSON.stringify(body);
    }

    const response = await fetchWithTimeout(targetUrl, fetchOptions, 10000);
    const data = await response.json().catch(() => ({}));

    if (!response.ok || data?.errorCode) {
      const description = data?.errorDescription || data?.error || `Cloudflare SFU error (${response.status})`;
      const err = new Error(description);
      err.statusCode = response.status === 404 || response.status === 410 ? 404 : 502;
      err.sfuErrorCode = data?.errorCode || null;
      throw err;
    }

    return data;
  }

  app.get('/api/auth/verify', async (req, res) => {
    try {
      const header = req.headers.authorization || '';
      const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
      if (!token) return res.status(401).json({ success: false, error: 'Firebase Bearer token required.' });
      const user = await verifyFirebaseIdToken(token);
      if (!user) return res.status(401).json({ success: false, error: 'Firebase ID token invalid or expired.' });
      return res.json({ success: true, user });
    } catch (error) {
      console.error('[Auth] Token verification failed:', error);
      return res.status(503).json({ success: false, error: 'Firebase token verification is not configured.' });
    }
  });

  app.get('/api/webrtc/turn-credentials', requireFirebaseAuth, async (_req, res) => {
    try {
      const generated = await generateTurnIceServers(TURN_CREDENTIAL_TTL);
      const hasStun = generated.iceServers.some((s) => {
        const urls = Array.isArray(s?.urls) ? s.urls : s?.urls ? [s.urls] : [];
        return urls.some((u) => typeof u === 'string' && u.startsWith('stun:'));
      });
      const iceServers = hasStun
        ? generated.iceServers
        : [{ urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'] }, ...generated.iceServers];

      return res.json({
        success: true,
        source: 'railway-cloudflare-realtime-turn',
        iceServers,
        ttl: generated.ttl,
        expiresAt: generated.expiresAt,
      });
    } catch (error) {
      const status = error.statusCode || 500;
      if (status === 503) {
        console.warn('[TURN] Credential endpoint unavailable (503):', error.message);
      } else {
        console.error('[TURN] Credential endpoint error:', error.message);
      }
      return res.status(status).json({
        success: false,
        code: error.code || undefined,
        error: error.message || 'Unable to issue TURN credentials.',
      });
    }
  });

  // 1. Create a new Cloudflare Realtime SFU Session
  app.post('/api/sfu/sessions', requireFirebaseAuth, async (req, res) => {
    try {
      const payload = {};
      if (req.body?.sessionDescription?.sdp && req.body?.sessionDescription?.type) {
        payload.sessionDescription = {
          type: req.body.sessionDescription.type,
          sdp: req.body.sessionDescription.sdp,
        };
      }
      const queryParams = new URLSearchParams();
      if (typeof req.body?.thirdparty === 'boolean') {
        queryParams.set('thirdparty', String(req.body.thirdparty));
      }
      if (typeof req.body?.correlationId === 'string' && req.body.correlationId.trim()) {
        queryParams.set('correlationId', req.body.correlationId.trim().slice(0, 128));
      }
      const qs = queryParams.toString();
      const sfuPath = qs ? `/sessions/new?${qs}` : '/sessions/new';

      const sfuData = await callCloudflareSfu(
        sfuPath,
        'POST',
        Object.keys(payload).length > 0 ? payload : undefined
      );
      if (!sfuData?.sessionId) {
        return res.status(502).json({ success: false, error: 'Cloudflare SFU did not return a sessionId.' });
      }

      return res.json({
        success: true,
        sessionId: sfuData.sessionId,
        sessionDescription: sfuData.sessionDescription || null,
      });
    } catch (error) {
      const status = error.statusCode || 500;
      if (status === 503) {
        console.warn('[SFU] Create session unavailable (503):', error.message);
      } else {
        console.error('[SFU] Create session failed:', error.message);
      }
      return res.status(status).json({
        success: false,
        code: error.code || undefined,
        error: error.message || 'Failed to create SFU session.',
      });
    }
  });

  // 2. Publish local tracks OR subscribe to remote tracks in an SFU Session
  app.post('/api/sfu/sessions/:sessionId/tracks', requireFirebaseAuth, async (req, res) => {
    try {
      const { sessionId } = req.params;
      if (!sessionId || sessionId.length > 256) {
        return res.status(400).json({ success: false, error: 'Valid SFU sessionId is required.' });
      }

      const rawTracks = req.body?.tracks;
      if (!Array.isArray(rawTracks) || rawTracks.length === 0) {
        return res.status(400).json({ success: false, error: 'Non-empty tracks array is required.' });
      }

      const tracks = [];
      for (const item of rawTracks) {
        if (
          !item ||
          (item.location !== 'local' && item.location !== 'remote') ||
          typeof item.trackName !== 'string' ||
          !item.trackName.trim()
        ) {
          return res
            .status(400)
            .json({ success: false, error: 'Each track must include valid location ("local" | "remote") and trackName.' });
        }
        if (item.location === 'local') {
          if (typeof item.mid !== 'string' || !item.mid.trim()) {
            return res.status(400).json({ success: false, error: 'Local track publication requires transceiver mid.' });
          }
          tracks.push({
            location: 'local',
            mid: item.mid.trim(),
            trackName: item.trackName.trim(),
          });
        } else {
          if (typeof item.sessionId !== 'string' || !item.sessionId.trim()) {
            return res.status(400).json({ success: false, error: 'Remote track subscription requires publisher sessionId.' });
          }
          if (item.sessionId.trim() === sessionId) {
            return res.status(400).json({ success: false, error: 'Session cannot subscribe to its own local tracks.' });
          }
          tracks.push({
            location: 'remote',
            sessionId: item.sessionId.trim(),
            trackName: item.trackName.trim(),
          });
        }
      }

      const authz = await authorizeRemoteTrackSubscriptions(req, tracks);
      if (!authz.ok) {
        return res.status(authz.status || 403).json({ success: false, error: authz.error || 'Subscription not authorized.' });
      }

      const payload = { tracks };
      if (req.body?.sessionDescription?.sdp && req.body?.sessionDescription?.type) {
        payload.sessionDescription = {
          type: req.body.sessionDescription.type,
          sdp: req.body.sessionDescription.sdp,
        };
      }

      const sfuData = await callCloudflareSfu(`/sessions/${encodeURIComponent(sessionId)}/tracks/new`, 'POST', payload);
      const returnedTracks = Array.isArray(sfuData.tracks) ? sfuData.tracks : [];
      const failedTracks = returnedTracks.filter((t) => t?.errorCode);
      if (failedTracks.length > 0) {
        const msg = failedTracks.map((t) => `${t.trackName || 'track'}: ${t.errorDescription || t.errorCode}`).join('; ');
        return res.status(422).json({
          success: false,
          error: `Cloudflare SFU rejected track operation: ${msg}`,
          tracks: returnedTracks,
        });
      }

      return res.json({
        success: true,
        sessionId,
        requiresImmediateRenegotiation: Boolean(sfuData.requiresImmediateRenegotiation),
        sessionDescription: sfuData.sessionDescription || null,
        tracks: returnedTracks,
      });
    } catch (error) {
      const status = error.statusCode || 500;
      if (status === 503) {
        console.warn('[SFU] Tracks new unavailable (503):', error.message);
      } else {
        console.error('[SFU] Tracks new failed:', error.message);
      }
      return res.status(status).json({
        success: false,
        code: error.code || undefined,
        error: error.message || 'SFU track negotiation failed.',
      });
    }
  });

  // 3. Complete SDP Renegotiation on an SFU Session
  app.put('/api/sfu/sessions/:sessionId/renegotiate', requireFirebaseAuth, async (req, res) => {
    try {
      const { sessionId } = req.params;
      const sd = req.body?.sessionDescription;
      if (!sessionId || !sd?.sdp || !sd?.type) {
        return res.status(400).json({ success: false, error: 'sessionId and sessionDescription { type, sdp } are required.' });
      }

      const sfuData = await callCloudflareSfu(`/sessions/${encodeURIComponent(sessionId)}/renegotiate`, 'PUT', {
        sessionDescription: { type: sd.type, sdp: sd.sdp },
      });

      return res.json({
        success: true,
        sessionId,
        sessionDescription: sfuData.sessionDescription || null,
      });
    } catch (error) {
      const status = error.statusCode || 500;
      if (status === 503) {
        console.warn('[SFU] Renegotiate unavailable (503):', error.message);
      } else {
        console.error('[SFU] Renegotiate failed:', error.message);
      }
      return res.status(status).json({
        success: false,
        code: error.code || undefined,
        error: error.message || 'SFU renegotiation failed.',
      });
    }
  });

  // 4. Close specific SFU tracks
  app.put('/api/sfu/sessions/:sessionId/tracks/close', requireFirebaseAuth, async (req, res) => {
    try {
      const { sessionId } = req.params;
      const rawTracks = req.body?.tracks;
      if (!sessionId || !Array.isArray(rawTracks) || rawTracks.length === 0) {
        return res.status(400).json({ success: false, error: 'sessionId and non-empty tracks array are required.' });
      }

      const tracks = rawTracks
        .filter((t) => t && typeof t.mid === 'string' && t.mid.trim())
        .map((t) => ({ mid: t.mid.trim() }));
      if (tracks.length === 0) {
        return res.status(400).json({ success: false, error: 'Each track to close must include a valid mid.' });
      }

      const payload = {
        tracks,
        force: Boolean(req.body?.force),
      };
      if (req.body?.sessionDescription?.sdp && req.body?.sessionDescription?.type) {
        payload.sessionDescription = {
          type: req.body.sessionDescription.type,
          sdp: req.body.sessionDescription.sdp,
        };
      }

      const sfuData = await callCloudflareSfu(`/sessions/${encodeURIComponent(sessionId)}/tracks/close`, 'PUT', payload);
      return res.json({
        success: true,
        sessionId,
        requiresImmediateRenegotiation: Boolean(sfuData.requiresImmediateRenegotiation),
        sessionDescription: sfuData.sessionDescription || null,
        tracks: Array.isArray(sfuData.tracks) ? sfuData.tracks : [],
      });
    } catch (error) {
      const status = error.statusCode || 500;
      if (status === 503) {
        console.warn('[SFU] Close tracks unavailable (503):', error.message);
      } else {
        console.error('[SFU] Close tracks failed:', error.message);
      }
      return res.status(status).json({
        success: false,
        code: error.code || undefined,
        error: error.message || 'Failed to close SFU tracks.',
      });
    }
  });

  // 5. Inspect SFU session & active tracks
  app.get('/api/sfu/sessions/:sessionId', requireFirebaseAuth, async (req, res) => {
    try {
      const { sessionId } = req.params;
      if (!sessionId) {
        return res.status(400).json({ success: false, error: 'sessionId is required.' });
      }
      const sfuData = await callCloudflareSfu(`/sessions/${encodeURIComponent(sessionId)}`, 'GET');
      return res.json({
        success: true,
        sessionId,
        tracks: Array.isArray(sfuData.tracks) ? sfuData.tracks : [],
      });
    } catch (error) {
      const status = error.statusCode || 500;
      if (status === 503) {
        console.warn('[SFU] Get session status unavailable (503):', error.message);
      } else {
        console.error('[SFU] Get session status failed:', error.message);
      }
      return res.status(status).json({
        success: false,
        code: error.code || undefined,
        error: error.message || 'Failed to inspect SFU session.',
      });
    }
  });

  async function closeSfuSessionById(sessionId) {
    let sessionState;
    try {
      sessionState = await callCloudflareSfu(`/sessions/${encodeURIComponent(sessionId)}`, 'GET');
    } catch (err) {
      if (err.statusCode === 404) {
        return 0;
      }
      throw err;
    }

    const activeMids = (Array.isArray(sessionState.tracks) ? sessionState.tracks : [])
      .map((t) => t?.mid)
      .filter((mid) => typeof mid === 'string' && mid.trim());

    if (activeMids.length === 0) {
      return 0;
    }

    await callCloudflareSfu(`/sessions/${encodeURIComponent(sessionId)}/tracks/close`, 'PUT', {
      tracks: activeMids.map((mid) => ({ mid })),
      force: true,
    });

    return activeMids.length;
  }

  // 6. Force-close all tracks for an SFU session (cleanup on stream end / page unload)
  app.delete('/api/sfu/sessions/:sessionId', requireFirebaseAuth, async (req, res) => {
    try {
      const { sessionId } = req.params;
      if (!sessionId) {
        return res.status(400).json({ success: false, error: 'sessionId is required.' });
      }
      const closedCount = await closeSfuSessionById(sessionId);
      return res.json({
        success: true,
        sessionId,
        closedCount,
      });
    } catch (error) {
      const status = error.statusCode || 500;
      if (status === 503) {
        console.warn('[SFU] Close session unavailable (503):', error.message);
      } else {
        console.error('[SFU] Close session failed:', error.message);
      }
      return res.status(status).json({
        success: false,
        code: error.code || undefined,
        error: error.message || 'Failed to close SFU session.',
      });
    }
  });

  // 7. Party Room SFU Provisioning & Host Session Token
  app.post('/api/sfu/party/rooms', requireFirebaseAuth, async (req, res) => {
    try {
      const uid = req.firebaseUser.uid;
      const roomId = typeof req.body?.roomId === 'string' && isValidResourceId(req.body.roomId)
        ? req.body.roomId
        : `party_${uid.slice(0, 8)}_${Date.now().toString(36)}`;
      const title = typeof req.body?.title === 'string' ? req.body.title.trim().slice(0, 120) : 'Alpha Mate Party Room';

      const [sfuSession, turnCreds] = await Promise.all([
        callCloudflareSfu('/sessions/new', 'POST'),
        generateTurnIceServers(TURN_CREDENTIAL_TTL).catch(() => null),
      ]);

      if (!sfuSession?.sessionId) {
        return res.status(502).json({ success: false, error: 'Cloudflare SFU did not return a sessionId.' });
      }

      return res.json({
        success: true,
        roomId,
        title,
        userId: uid,
        role: 'host',
        canPublish: true,
        canSubscribe: true,
        sfuSessionId: sfuSession.sessionId,
        iceServers: turnCreds?.iceServers || [
          { urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'] },
        ],
        turnConfigured: Boolean(turnCreds),
        expiresAt: turnCreds?.expiresAt || Date.now() + 3600_000,
      });
    } catch (error) {
      const status = error.statusCode || 500;
      if (status === 503) {
        console.warn('[Party SFU] Create room session unavailable (503):', error.message);
      } else {
        console.error('[Party SFU] Create room failed:', error.message);
      }
      return res.status(status).json({
        success: false,
        code: error.code || undefined,
        error: error.message || 'Unable to provision Party Room SFU session.',
      });
    }
  });

  // 8. Party Room Role-Aware SFU Session & Ephemeral ICE Token (Host / Moderator / Guest / Viewer)
  app.post('/api/sfu/party/rooms/:roomId/token', requireFirebaseAuth, async (req, res) => {
    try {
      const { roomId } = req.params;
      if (!isValidResourceId(roomId)) {
        return res.status(400).json({ success: false, error: 'Valid roomId is required.' });
      }

      const uid = req.firebaseUser.uid;
      const idToken = req.firebaseIdToken;
      const roomDoc = await fetchFirestoreDocument(`partyRooms/${encodeURIComponent(roomId)}`, idToken);

      if (!roomDoc || roomDoc.isActive === false) {
        return res.status(404).json({ success: false, error: 'Party room is closed or does not exist.' });
      }

      const blocked = Array.isArray(roomDoc.blockedUserIds) ? roomDoc.blockedUserIds : [];
      const kicked = Array.isArray(roomDoc.kickedUserIds) ? roomDoc.kickedUserIds : [];
      if (blocked.includes(uid) || kicked.includes(uid)) {
        return res.status(403).json({ success: false, error: 'You are restricted from joining this party room.' });
      }

      const hostId = roomDoc.host?.id || '';
      const moderators = Array.isArray(roomDoc.moderatorIds) ? roomDoc.moderatorIds : [];
      const seats = Array.isArray(roomDoc.seats) ? roomDoc.seats : [];
      const isHostUser = hostId === uid;
      const isModUser = moderators.includes(uid);
      const isSeatedSpeaker = seats.some((s) => s?.user?.id === uid);

      let role = 'viewer';
      if (isHostUser) role = 'host';
      else if (isModUser) role = 'moderator';
      else if (isSeatedSpeaker) role = 'guest';

      const canPublish = isHostUser || isSeatedSpeaker || Boolean(req.body?.wantPublish && isModUser);

      const [sfuSession, turnCreds] = await Promise.all([
        callCloudflareSfu('/sessions/new', 'POST'),
        generateTurnIceServers(TURN_CREDENTIAL_TTL).catch(() => null),
      ]);

      if (!sfuSession?.sessionId) {
        return res.status(502).json({ success: false, error: 'Cloudflare SFU did not return a sessionId.' });
      }

      return res.json({
        success: true,
        roomId,
        userId: uid,
        role,
        canPublish,
        canSubscribe: true,
        sfuSessionId: sfuSession.sessionId,
        iceServers: turnCreds?.iceServers || [
          { urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'] },
        ],
        turnConfigured: Boolean(turnCreds),
        expiresAt: turnCreds?.expiresAt || Date.now() + 3600_000,
      });
    } catch (error) {
      const status = error.statusCode || 500;
      if (status === 503) {
        console.warn('[Party SFU] Join token unavailable (503):', error.message);
      } else {
        console.error('[Party SFU] Join token failed:', error.message);
      }
      return res.status(status).json({
        success: false,
        code: error.code || undefined,
        error: error.message || 'Unable to generate Party Room SFU token.',
      });
    }
  });

  // 9. Clean Party Room Leave & SFU Session Cleanup
  app.post('/api/sfu/party/rooms/:roomId/leave', requireFirebaseAuth, async (req, res) => {
    try {
      const { roomId } = req.params;
      const sessionId = typeof req.body?.sfuSessionId === 'string' ? req.body.sfuSessionId.trim() : '';
      let closedCount = 0;
      if (sessionId) {
        closedCount = await closeSfuSessionById(sessionId);
      }
      return res.json({ success: true, roomId, closedCount });
    } catch (error) {
      const status = error.statusCode || 500;
      return res.status(status).json({
        success: false,
        error: error.message || 'Unable to clean up Party Room SFU session.',
      });
    }
  });

  // Ensure unmatched /api/* endpoints return JSON 404 instead of falling through to SPA HTML
  app.use('/api', (_req, res) => {
    res.status(404).json({ success: false, error: 'API endpoint not found.' });
  });

  return app;
}
