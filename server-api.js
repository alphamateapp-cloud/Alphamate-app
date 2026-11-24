import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import http from 'http';
import https from 'https';
import os from 'os';
import nodemailer from 'nodemailer';
import { fileURLToPath } from 'url';
import agoraTokenPkg from 'agora-token';
import { registerGiftMediaRoutes } from './server-gift-media.js';

const { RtcTokenBuilder, RtcRole } = agoraTokenPkg;

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

  // Agora RTC credentials (for Party Rooms ONLY) MUST remain strictly server-side environment variables.
  const AGORA_APP_ID = (process.env.AGORA_APP_ID || '').trim();
  const AGORA_APP_CERTIFICATE = (process.env.AGORA_APP_CERTIFICATE || '').trim();
  const AGORA_TOKEN_TTL_SECONDS = Math.min(
    Math.max(Number(process.env.AGORA_TOKEN_TTL_SECONDS || 3600), 300),
    86400
  );

  const ALWAYS_ALLOWED_ORIGINS = new Set([
    'https://localhost',
    'http://localhost',
    'capacitor://localhost',
    'ionic://localhost',
    'https://127.0.0.1',
    'http://127.0.0.1',
    'https://alphamate.app',
    'https://www.alphamate.app',
    'https://api.alphamate.app',
  ]);

  const UPSTREAM_RAILWAY_API_URL = (
    process.env.UPSTREAM_RAILWAY_API_URL || 'https://api.alphamate.app'
  )
    .trim()
    .replace(/\/$/, '');
  const IS_RAILWAY_RUNTIME = Boolean(
    process.env.RAILWAY_ENVIRONMENT ||
      process.env.RAILWAY_PROJECT_ID ||
      process.env.RAILWAY_SERVICE_ID ||
      process.env.RAILWAY_PUBLIC_DOMAIN
  );

  function isAllowedDynamicOrigin(origin) {
    if (!origin) return false;
    return (
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin) ||
      /^https:\/\/([a-z0-9-]+\.)?alphamate\.app$/i.test(origin) ||
      /^https:\/\/ais-(dev|pre)-[a-z0-9-]+(?:\.[a-z0-9-]+)?\.run\.app$/i.test(origin)
    );
  }

  const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '*')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

  app.use(express.json({ limit: '1mb' }));

  app.use((req, res, next) => {
    const origin = (req.headers.origin || '').trim();
    const isWildcard = ALLOWED_ORIGINS.includes('*');
    const isExplicitlyAllowed =
      isWildcard ||
      ALLOWED_ORIGINS.includes(origin) ||
      ALWAYS_ALLOWED_ORIGINS.has(origin) ||
      isAllowedDynamicOrigin(origin);

    if (isWildcard && !origin) {
      res.header('Access-Control-Allow-Origin', '*');
    } else if (isExplicitlyAllowed) {
      res.header('Access-Control-Allow-Origin', origin || '*');
    }
    res.header('Vary', 'Origin');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Content-Length, Accept, Authorization, X-Upload-Id, X-Chunk-Index');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  function shouldProxyWebRtcUpstream(req, hasLocalConfig) {
    if (hasLocalConfig || IS_RAILWAY_RUNTIME) return false;
    if (!UPSTREAM_RAILWAY_API_URL) return false;
    if (req.headers['x-alphamate-upstream-proxy'] === '1') return false;
    const host = String(req.headers.host || '').toLowerCase().split(':')[0];
    try {
      const upstreamHost = new URL(UPSTREAM_RAILWAY_API_URL).hostname.toLowerCase();
      if (host && host === upstreamHost) return false;
    } catch {
      return false;
    }
    return true;
  }

  async function forwardWebRtcRequestUpstream(req, res) {
    const targetUrl = `${UPSTREAM_RAILWAY_API_URL}${req.originalUrl}`;
    const headers = {
      Accept: req.headers.accept || 'application/json',
      'x-alphamate-upstream-proxy': '1',
    };
    if (req.headers.authorization) {
      headers.Authorization = req.headers.authorization;
    }
    const init = {
      method: req.method,
      headers,
    };
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(req.body);
    }

    let upstreamRes = null;
    let rawText = '';
    let lastErr = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        upstreamRes = await fetchWithTimeout(targetUrl, init, 12000);
        rawText = await upstreamRes.text();
        const isTransientGateway =
          upstreamRes.status === 502 ||
          upstreamRes.status === 503 ||
          upstreamRes.status === 504 ||
          (upstreamRes.status >= 520 && upstreamRes.status <= 526);
        if (!isTransientGateway || attempt === 1) {
          break;
        }
      } catch (err) {
        lastErr = err;
        if (attempt === 1) throw err;
      }
      await new Promise((r) => setTimeout(r, 500));
    }

    if (!upstreamRes) {
      throw lastErr || new Error('Upstream backend did not respond.');
    }

    const contentType = upstreamRes.headers.get('content-type') || 'application/json';
    const looksJson = contentType.toLowerCase().includes('application/json');
    let parsedJson = null;
    if (rawText) {
      try {
        parsedJson = JSON.parse(rawText);
      } catch {
        parsedJson = null;
      }
    }

    if (!upstreamRes.ok && (!looksJson || !parsedJson || typeof parsedJson !== 'object')) {
      const code =
        upstreamRes.status >= 500 ? 'AGORA_BACKEND_UNREACHABLE' : 'UPSTREAM_ERROR';
      return res.status(upstreamRes.status).json({
        success: false,
        code,
        error: `Upstream voice backend returned HTTP ${upstreamRes.status}. Please retry.`,
      });
    }

    res.status(upstreamRes.status).type(contentType).send(rawText);
  }

  app.use('/api/sfu', async (req, res, next) => {
    const hasLocalSfu = Boolean(REALTIME_SFU_APP_ID && REALTIME_SFU_BEARER_TOKEN);
    if (!shouldProxyWebRtcUpstream(req, hasLocalSfu)) {
      return next();
    }
    try {
      await forwardWebRtcRequestUpstream(req, res);
    } catch (error) {
      const status = error?.statusCode || 502;
      console.warn('[SFU Proxy] Upstream forward failed:', error?.message || error);
      return res.status(status).json({
        success: false,
        code: error?.code || 'SFU_BACKEND_UNREACHABLE',
        error: error?.message || 'Unable to reach upstream Live SFU backend.',
      });
    }
  });

  app.use('/api/webrtc', async (req, res, next) => {
    const hasLocalTurn = Boolean(CLOUDFLARE_TURN_TOKEN_ID && CLOUDFLARE_TURN_API_TOKEN);
    if (!shouldProxyWebRtcUpstream(req, hasLocalTurn)) {
      return next();
    }
    try {
      await forwardWebRtcRequestUpstream(req, res);
    } catch (error) {
      const status = error?.statusCode || 502;
      console.warn('[TURN Proxy] Upstream forward failed:', error?.message || error);
      return res.status(status).json({
        success: false,
        code: error?.code || 'TURN_BACKEND_UNREACHABLE',
        error: error?.message || 'Unable to reach upstream TURN backend.',
      });
    }
  });

  app.use('/api/agora', async (req, res, next) => {
    const hasLocalAgora = Boolean(AGORA_APP_ID && AGORA_APP_CERTIFICATE);
    if (!shouldProxyWebRtcUpstream(req, hasLocalAgora)) {
      return next();
    }
    try {
      await forwardWebRtcRequestUpstream(req, res);
    } catch (error) {
      const status = error?.statusCode || 502;
      console.warn('[Agora Proxy] Upstream forward failed:', error?.message || error);
      return res.status(status).json({
        success: false,
        code: error?.code || 'AGORA_BACKEND_UNREACHABLE',
        error: error?.message || 'Unable to reach upstream Agora token backend.',
      });
    }
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
  let healthRefreshInFlight = null;

  async function runHealthChecks() {
    const now = Date.now();
    const firebaseEnvPresent = Boolean(FIREBASE_API_KEY && FIREBASE_PROJECT_ID && FIREBASE_DATABASE_ID);
    const sfuEnvPresent = Boolean(REALTIME_SFU_APP_ID && REALTIME_SFU_BEARER_TOKEN);
    const turnEnvPresent = Boolean(CLOUDFLARE_TURN_TOKEN_ID && CLOUDFLARE_TURN_API_TOKEN);
    const agoraEnvPresent = Boolean(AGORA_APP_ID && AGORA_APP_CERTIFICATE);

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
            2500
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
            5000
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
          await Promise.race([
            generateTurnIceServers(300),
            new Promise((_, reject) => setTimeout(() => reject(new Error('TURN health probe timed out')), 2500)),
          ]);
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
      // "configured" means the required server-side credentials are present.
      // Credential validity is reported separately: transient Cloudflare probe
      // failures must not be misreported to the client as missing Railway vars.
      sfuConfigured: Boolean(sfuEnvPresent),
      sfuValid: Boolean(firebaseCheck.valid && sfuCheck.valid),
      agoraConfigured: Boolean(agoraEnvPresent),
      agoraValid: Boolean(firebaseCheck.valid && agoraEnvPresent),
      emailOtpConfigured: Boolean(
        (process.env.RESEND_API_KEY || '').trim() &&
          (process.env.RESEND_API_KEY || '').trim() !== 'YOUR_RESEND_API_KEY' &&
          (process.env.RESEND_API_KEY || '').trim() !== 'MY_RESEND_API_KEY'
      ),
      emailOtpSender: (
        process.env.RESEND_FROM_EMAIL ||
        process.env.RESEND_FROM ||
        'Alpha Mate <no-reply@alphamate.app>'
      ).trim(),
      checks: {
        firebase: firebaseCheck,
        sfu: sfuCheck,
        turn: turnCheck,
        agora: {
          configured: Boolean(agoraEnvPresent),
          valid: Boolean(agoraEnvPresent),
          ...(!agoraEnvPresent ? { reason: 'AGORA_APP_ID or AGORA_APP_CERTIFICATE missing' } : {}),
        },
      },
      checkedAt: new Date(now).toISOString(),
    };

    healthCache = result;
    healthCacheExpiresAt = now + 60_000;
    return result;
  }

  async function validateSystemHealth(forceFresh = false) {
    const now = Date.now();
    if (!forceFresh && healthCache && now < healthCacheExpiresAt) {
      return healthCache;
    }
    if (!forceFresh && healthCache) {
      if (!healthRefreshInFlight) {
        healthRefreshInFlight = runHealthChecks().finally(() => {
          healthRefreshInFlight = null;
        });
      }
      return healthCache;
    }
    if (!healthRefreshInFlight) {
      healthRefreshInFlight = runHealthChecks().finally(() => {
        healthRefreshInFlight = null;
      });
    }
    return healthRefreshInFlight;
  }

  app.get('/api/health', async (req, res) => {
    try {
      const hasLocalWebRtc = Boolean(
        REALTIME_SFU_APP_ID &&
          REALTIME_SFU_BEARER_TOKEN &&
          CLOUDFLARE_TURN_TOKEN_ID &&
          CLOUDFLARE_TURN_API_TOKEN &&
          AGORA_APP_ID &&
          AGORA_APP_CERTIFICATE
      );
      if (shouldProxyWebRtcUpstream(req, hasLocalWebRtc)) {
        try {
          await forwardWebRtcRequestUpstream(req, res);
          return;
        } catch {
          // Fall back to local health status if upstream is unreachable
        }
      }
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
      const streamDoc =
        (await fetchFirestoreDocument(`liveStreams/${encodeURIComponent(contextId)}`, idToken).catch(() => null)) ||
        app.locals.realtimeRegistry?.getLiveStream?.(contextId) ||
        null;
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
      const roomDoc =
        (await fetchFirestoreDocument(`partyRooms/${encodeURIComponent(contextId)}`, idToken).catch(() => null)) ||
        app.locals.realtimeRegistry?.getPartyRoom?.(contextId) ||
        null;
      if (!roomDoc || roomDoc.isActive === false) {
        return { ok: false, status: 404, error: 'Party room is closed or no longer exists.' };
      }
      const blocked = Array.isArray(roomDoc.blockedUserIds) ? roomDoc.blockedUserIds : [];
      const kicked = Array.isArray(roomDoc.kickedUserIds) ? roomDoc.kickedUserIds : [];
      if (blocked.includes(uid) || kicked.includes(uid)) {
        return { ok: false, status: 403, error: 'You are restricted from this party room.' };
      }
      const peerIds = Array.isArray(req.body?.speakerPeerIds) ? req.body.speakerPeerIds.filter(isValidResourceId) : [];
      if (peerIds.length > 0) {
        const blockedSet = new Set([...blocked, ...kicked]);
        const anyBlockedPeer = peerIds.some((pid) => blockedSet.has(pid));
        if (anyBlockedPeer) {
          return { ok: false, status: 403, error: 'Requested speaker is restricted from this party room.' };
        }
      }
      return { ok: true };
    }

    return { ok: false, status: 400, error: 'Unsupported contextType. Expected "live" or "party".' };
  }

  app.locals.verifyFirebaseIdToken = verifyFirebaseIdToken;

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


  // ---------------------------------------------------------------------------
  // Alpha Mate Admin API (read-only)
  // Uses the same Firebase project + named Firestore database as the app.
  // Configure FIREBASE_SERVICE_ACCOUNT_JSON and ADMIN_EMAILS in Railway.
  // ---------------------------------------------------------------------------
  const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'alphamateapp@gmail.com')
    .split(',').map((value) => value.trim().toLowerCase()).filter(Boolean);
  const FIREBASE_SERVICE_ACCOUNT_JSON = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '';
  const ADMIN_READABLE_COLLECTIONS = new Set([
    'users',
    'partyRooms',
    'liveStreams',
    'reels',
    'presence',
    'accountDeletionRequests',
  ]);
  let adminAccessTokenCache = null;
  let adminAccessTokenExpiresAt = 0;

  function base64UrlJson(value) {
    return Buffer.from(JSON.stringify(value)).toString('base64url');
  }

  function readServiceAccount() {
    if (!FIREBASE_SERVICE_ACCOUNT_JSON) {
      const error = new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not configured on Railway.');
      error.statusCode = 503;
      throw error;
    }
    let account;
    try { account = JSON.parse(FIREBASE_SERVICE_ACCOUNT_JSON); }
    catch {
      const error = new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.');
      error.statusCode = 503;
      throw error;
    }
    if (!account.client_email || !account.private_key || !account.project_id) {
      const error = new Error('Firebase service account is missing required fields.');
      error.statusCode = 503;
      throw error;
    }
    if (account.project_id !== FIREBASE_PROJECT_ID) {
      const error = new Error('Firebase service account project does not match FIREBASE_PROJECT_ID.');
      error.statusCode = 503;
      throw error;
    }
    return account;
  }

  async function getFirestoreAdminAccessToken() {
    if (adminAccessTokenCache && Date.now() < adminAccessTokenExpiresAt - 60000) return adminAccessTokenCache;
    const account = readServiceAccount();
    const now = Math.floor(Date.now() / 1000);
    const unsigned = `${base64UrlJson({ alg: 'RS256', typ: 'JWT' })}.${base64UrlJson({
      iss: account.client_email,
      scope: 'https://www.googleapis.com/auth/datastore',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    })}`;
    const { createSign } = await import('node:crypto');
    const signer = createSign('RSA-SHA256');
    signer.update(unsigned);
    signer.end();
    const assertion = `${unsigned}.${signer.sign(account.private_key, 'base64url')}`;
    const response = await fetchWithTimeout('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion,
      }).toString(),
    }, 8000);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.access_token) {
      const error = new Error('Could not obtain a Google access token for Firestore Admin API.');
      error.statusCode = 502;
      throw error;
    }
    adminAccessTokenCache = payload.access_token;
    adminAccessTokenExpiresAt = Date.now() + Number(payload.expires_in || 3600) * 1000;
    return adminAccessTokenCache;
  }

  async function firestoreAdminRequest(resourcePath, options = {}) {
    const token = await getFirestoreAdminAccessToken();
    const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(FIREBASE_PROJECT_ID)}/databases/${encodeURIComponent(FIREBASE_DATABASE_ID)}/documents/${resourcePath}`;
    const response = await fetchWithTimeout(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {}),
      },
    }, 12000);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error?.message || `Firestore Admin API failed (${response.status}).`);
      error.statusCode = response.status === 403 ? 403 : response.status === 404 ? 404 : 502;
      throw error;
    }
    return payload;
  }

  function decodeFirestoreDocument(document) {
    const fields = {};
    for (const [key, value] of Object.entries(document.fields || {})) fields[key] = parseFirestoreValue(value);
    // Never expose credential-like fields through the Admin read API.
    for (const key of Object.keys(fields)) {
      if (/password|private.?key|refresh.?token|access.?token|secret|fcm.?token/i.test(key)) delete fields[key];
    }
    const nameParts = String(document.name || '').split('/');
    return {
      id: nameParts[nameParts.length - 1] || '',
      ...fields,
      _createdTime: document.createTime || null,
      _updatedTime: document.updateTime || null,
    };
  }

  async function requireAdmin(req, res, next) {
    const email = String(req.firebaseUser?.email || '').trim().toLowerCase();
    if (!email || req.firebaseUser?.emailVerified !== true || !ADMIN_EMAILS.includes(email)) {
      return res.status(403).json({ success: false, error: 'Admin access denied.' });
    }
    next();
  }

  function sendAdminError(res, error, operation) {
    const status = error.statusCode || 500;
    console.error(`[Admin API] ${operation} failed:`, error.message || error);
    return res.status(status).json({
      success: false,
      error: status === 503 ? 'admin_firestore_not_configured' : 'admin_firestore_request_failed',
      message: error.message || 'Unable to read Alpha Mate data.',
    });
  }

  app.get('/api/admin/status', requireFirebaseAuth, requireAdmin, async (_req, res) => {
    try {
      const account = readServiceAccount();
      await getFirestoreAdminAccessToken();
      return res.json({ success: true, connected: true, projectId: FIREBASE_PROJECT_ID,
        databaseId: FIREBASE_DATABASE_ID, serviceAccountProjectMatches: account.project_id === FIREBASE_PROJECT_ID,
        mode: 'read_only', collections: Array.from(ADMIN_READABLE_COLLECTIONS) });
    } catch (error) { return sendAdminError(res, error, 'status'); }
  });

  app.get('/api/admin/collections/:collectionName', requireFirebaseAuth, requireAdmin, async (req, res) => {
    try {
      const collectionName = String(req.params.collectionName || '');
      if (!ADMIN_READABLE_COLLECTIONS.has(collectionName)) {
        return res.status(400).json({ success: false, error: 'unsupported_collection',
          allowedCollections: Array.from(ADMIN_READABLE_COLLECTIONS) });
      }
      const pageSize = Math.min(Math.max(Number.parseInt(req.query.pageSize, 10) || 50, 1), 100);
      const query = new URLSearchParams({ pageSize: String(pageSize) });
      if (typeof req.query.pageToken === 'string' && req.query.pageToken.length < 4096) query.set('pageToken', req.query.pageToken);
      const result = await firestoreAdminRequest(`${encodeURIComponent(collectionName)}?${query.toString()}`);
      return res.json({ success: true, collection: collectionName,
        documents: (result.documents || []).map(decodeFirestoreDocument),
        nextPageToken: result.nextPageToken || null, pageSize, readOnly: true });
    } catch (error) { return sendAdminError(res, error, `list ${req.params.collectionName}`); }
  });

  app.get('/api/admin/dashboard', requireFirebaseAuth, requireAdmin, async (_req, res) => {
    try {
      const token = await getFirestoreAdminAccessToken();
      const parent = `projects/${encodeURIComponent(FIREBASE_PROJECT_ID)}/databases/${encodeURIComponent(FIREBASE_DATABASE_ID)}/documents`;
      const names = ['users', 'partyRooms', 'liveStreams', 'reels'];
      const totals = await Promise.all(names.map(async (name) => {
        try {
          const response = await fetchWithTimeout(`https://firestore.googleapis.com/v1/${parent}:runAggregationQuery`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ structuredAggregationQuery: {
              structuredQuery: { from: [{ collectionId: name }] },
              aggregations: [{ count: {}, alias: 'total' }],
            } }),
          }, 12000);
          const result = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(result.error?.message || `Count query failed (${response.status}).`);
          const count = result[0]?.aggregateFields?.total?.integerValue;
          return [name, count === undefined ? null : Number(count)];
        } catch (error) {
          console.warn(`[Admin API] Count unavailable for ${name}:`, error.message);
          return [name, null];
        }
      }));
      return res.json({ success: true, counts: Object.fromEntries(totals), generatedAt: new Date().toISOString(),
        readOnly: true, note: 'Counts are read from the Alpha Mate Firestore database. Null means this collection count could not be read; it is not a fabricated zero.' });
    } catch (error) { return sendAdminError(res, error, 'dashboard'); }
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
      const roomDoc =
        (await fetchFirestoreDocument(`partyRooms/${encodeURIComponent(roomId)}`, idToken).catch(() => null)) ||
        app.locals.realtimeRegistry?.getPartyRoom?.(roomId) ||
        null;

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

  // ---------------------------------------------------------------------------
  // Agora RTC Party Room Endpoints (PARTY ROOMS ONLY — never used by Solo Live)
  // ---------------------------------------------------------------------------
  function deriveAgoraNumericUid(firebaseUid) {
    const raw = String(firebaseUid || 'anon');
    let hash = 2166136261;
    for (let i = 0; i < raw.length; i++) {
      hash ^= raw.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    // Positive 31-bit integer [1..2147483647] matching Web uint32 and Android signed int
    return (hash & 0x7fffffff) || 1;
  }

  function getAgoraPartyChannelName(roomId) {
    const sanitized = String(roomId || '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 54);
    return `am_party_${sanitized}`;
  }

  app.post('/api/agora/party/rooms/:roomId/token', requireFirebaseAuth, async (req, res) => {
    try {
      const { roomId } = req.params;
      if (!isValidResourceId(roomId)) {
        return res.status(400).json({ success: false, error: 'Valid roomId is required.' });
      }

      if (!AGORA_APP_ID || !AGORA_APP_CERTIFICATE) {
        return res.status(503).json({
          success: false,
          code: 'AGORA_NOT_CONFIGURED',
          error: 'Agora RTC is not configured on the backend server. Set AGORA_APP_ID and AGORA_APP_CERTIFICATE on Railway.',
        });
      }

      const uid = req.firebaseUser.uid;
      const idToken = req.firebaseIdToken;
      let roomDoc =
        (await fetchFirestoreDocument(`partyRooms/${encodeURIComponent(roomId)}`, idToken).catch(() => null)) ||
        app.locals.realtimeRegistry?.getPartyRoom?.(roomId) ||
        null;

      if (!roomDoc) {
        // Brief retry to tolerate Firestore write propagation right after room creation
        await new Promise((r) => setTimeout(r, 400));
        roomDoc =
          (await fetchFirestoreDocument(`partyRooms/${encodeURIComponent(roomId)}`, idToken).catch(() => null)) ||
          app.locals.realtimeRegistry?.getPartyRoom?.(roomId) ||
          null;
      }

      if (!roomDoc || roomDoc.isActive === false) {
        return res.status(404).json({
          success: false,
          code: 'ROOM_NOT_FOUND',
          error: 'Party room is closed or does not exist.',
        });
      }

      const blocked = Array.isArray(roomDoc.blockedUserIds) ? roomDoc.blockedUserIds : [];
      const kicked = Array.isArray(roomDoc.kickedUserIds) ? roomDoc.kickedUserIds : [];
      if (blocked.includes(uid) || kicked.includes(uid)) {
        return res.status(403).json({
          success: false,
          code: 'USER_RESTRICTED',
          error: 'You are restricted from joining this party room.',
        });
      }

      const hostId = roomDoc.host?.id || '';
      const moderators = Array.isArray(roomDoc.moderatorIds) ? roomDoc.moderatorIds : [];
      const seats = Array.isArray(roomDoc.seats) ? roomDoc.seats : [];
      const isHostUser = hostId === uid;
      const isModUser = moderators.includes(uid);
      const isSeatedSpeaker = seats.some((s) => s?.user?.id === uid);
      const isPkListenOnly = req.body?.mode === 'pk_listen';

      let role = 'viewer';
      if (isHostUser) role = 'host';
      else if (isModUser) role = 'moderator';
      else if (isSeatedSpeaker) role = 'guest';

      const canPublish =
        !isPkListenOnly &&
        (isHostUser || isSeatedSpeaker || Boolean(req.body?.wantPublish && isModUser));

      const agoraRole = canPublish ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;
      const agoraUid = deriveAgoraNumericUid(uid);
      const channelName = getAgoraPartyChannelName(roomId);

      const token = RtcTokenBuilder.buildTokenWithUid(
        AGORA_APP_ID,
        AGORA_APP_CERTIFICATE,
        channelName,
        agoraUid,
        agoraRole,
        AGORA_TOKEN_TTL_SECONDS,
        AGORA_TOKEN_TTL_SECONDS
      );

      return res.json({
        success: true,
        appId: AGORA_APP_ID,
        roomId,
        userId: uid,
        channelName,
        uid: agoraUid,
        token,
        role,
        agoraRole: canPublish ? 'broadcaster' : 'audience',
        canPublish,
        canSubscribe: true,
        ttlSeconds: AGORA_TOKEN_TTL_SECONDS,
        expiresAt: Date.now() + AGORA_TOKEN_TTL_SECONDS * 1000,
      });
    } catch (error) {
      const status = error.statusCode || 500;
      console.error('[Agora Party Token] Generation failed:', error?.message || error);
      return res.status(status).json({
        success: false,
        code: error?.code || 'AGORA_TOKEN_ERROR',
        error: error?.message || 'Unable to generate Agora Party Room token.',
      });
    }
  });

  app.post('/api/agora/party/rooms/:roomId/leave', requireFirebaseAuth, async (req, res) => {
    const { roomId } = req.params;
    return res.json({
      success: true,
      roomId: isValidResourceId(roomId) ? roomId : null,
      userId: req.firebaseUser.uid,
    });
  });

  // 10. Realtime discovery HTTP fallback snapshot
  app.get('/api/realtime/rooms', requireFirebaseAuth, (_req, res) => {
    const snap = app.locals.realtimeRegistry?.getSnapshot?.() || { liveStreams: [], partyRooms: [] };
    return res.json({ success: true, ...snap });
  });

  // 11. Email OTP Delivery & Verification (Registration + Login + Account Deletion)
  function getResendApiKey() {
    const raw = (process.env.RESEND_API_KEY || '').trim();
    if (!raw || raw === 'YOUR_RESEND_API_KEY' || raw === 'MY_RESEND_API_KEY') return '';
    return raw;
  }
  const SMTP_USER = (process.env.SMTP_USER || '').trim();
  const SMTP_PASS = (process.env.SMTP_PASS || '').trim();
  const SMTP_HOST = (process.env.SMTP_HOST || (SMTP_USER ? 'smtp.gmail.com' : '')).trim();
  const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
  const SMTP_SECURE =
    process.env.SMTP_SECURE !== undefined
      ? String(process.env.SMTP_SECURE).toLowerCase() === 'true'
      : SMTP_PORT === 465;
  const SMTP_FROM = (
    process.env.SMTP_FROM ||
    (SMTP_USER ? `Alpha Mate <${SMTP_USER}>` : 'Alpha Mate <no-reply@alphamate.app>')
  ).trim();
  const RESEND_FROM = (
    process.env.RESEND_FROM_EMAIL ||
    process.env.RESEND_FROM ||
    'Alpha Mate <no-reply@alphamate.app>'
  ).trim();
  const OTP_HMAC_SECRET = (
    process.env.OTP_HMAC_SECRET ||
    crypto
      .createHash('sha256')
      .update(
        `${FIREBASE_PROJECT_ID}:${FIREBASE_DATABASE_ID}:${REALTIME_SFU_BEARER_TOKEN || FIREBASE_SERVICE_ACCOUNT_JSON || 'alphamate-otp-secret'}`
      )
      .digest('hex')
  ).trim();

  const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
  const OTP_COOLDOWN_MS = 60 * 1000; // 60 seconds
  const OTP_MAX_ATTEMPTS = 5; // Maximum 5 verification attempts
  const DEVICE_SWITCH_TTL_MS = 90 * 24 * 60 * 60 * 1000;
  const otpCooldownMap = new Map(); // scopeKey -> lastSentMs
  const otpAttemptMap = new Map(); // nonce -> { count, exp }
  const otpActiveNonceMap = new Map(); // scopeKey -> { nonce, exp }
  const otpConsumedNonceMap = new Map(); // nonce -> exp

  function escapeHtmlText(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function maskEmailAddress(email) {
    const [local, domain] = String(email || '').split('@');
    if (!local || !domain) return email || '';
    const visible = local.slice(0, Math.min(2, local.length));
    return `${visible}${'*'.repeat(Math.max(2, local.length - visible.length))}@${domain}`;
  }

  function signOtpPayload(payload) {
    const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    const sig = crypto.createHmac('sha256', OTP_HMAC_SECRET).update(encoded).digest('base64url');
    return `${encoded}.${sig}`;
  }

  function verifySignedOtpPayload(token) {
    if (typeof token !== 'string' || !token.includes('.')) return null;
    const [encoded, sig] = token.split('.');
    if (!encoded || !sig) return null;
    const expectedSig = crypto.createHmac('sha256', OTP_HMAC_SECRET).update(encoded).digest('base64url');
    const a = Buffer.from(sig, 'utf8');
    const b = Buffer.from(expectedSig, 'utf8');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    try {
      return JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    } catch {
      return null;
    }
  }

  function hashOtpCode(scopeId, nonce, otp) {
    return crypto
      .createHmac('sha256', OTP_HMAC_SECRET)
      .update(`${scopeId}:${nonce}:${String(otp).trim()}`)
      .digest('hex');
  }

  function pruneOtpMaps() {
    const now = Date.now();
    for (const [key, ts] of otpCooldownMap.entries()) {
      if (now - ts > OTP_TTL_MS) otpCooldownMap.delete(key);
    }
    for (const [nonce, rec] of otpAttemptMap.entries()) {
      if (now > rec.exp) otpAttemptMap.delete(nonce);
    }
    for (const [scopeKey, rec] of otpActiveNonceMap.entries()) {
      if (now > rec.exp) otpActiveNonceMap.delete(scopeKey);
    }
    for (const [nonce, exp] of otpConsumedNonceMap.entries()) {
      if (now > exp) otpConsumedNonceMap.delete(nonce);
    }
  }

  function hasEmailOtpProviderConfigured() {
    return Boolean(getResendApiKey() || (SMTP_HOST && SMTP_USER && SMTP_PASS));
  }

  function toFirestoreFieldValue(val) {
    if (val === null || val === undefined) return { nullValue: null };
    if (typeof val === 'boolean') return { booleanValue: val };
    if (typeof val === 'number') {
      return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
    }
    if (typeof val === 'string') return { stringValue: val };
    if (Array.isArray(val)) {
      return { arrayValue: { values: val.map((item) => toFirestoreFieldValue(item)) } };
    }
    if (typeof val === 'object') {
      const fields = {};
      for (const [k, v] of Object.entries(val)) {
        if (v !== undefined) fields[k] = toFirestoreFieldValue(v);
      }
      return { mapValue: { fields } };
    }
    return { stringValue: String(val) };
  }

  async function patchFirestoreAdminDoc(collectionName, docId, dataObj) {
    if (!FIREBASE_SERVICE_ACCOUNT_JSON || !docId) return false;
    try {
      const keys = Object.keys(dataObj).filter((k) => dataObj[k] !== undefined);
      if (keys.length === 0) return true;
      const maskParams = keys.map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
      const fields = {};
      for (const k of keys) {
        fields[k] = toFirestoreFieldValue(dataObj[k]);
      }
      await firestoreAdminRequest(
        `${encodeURIComponent(collectionName)}/${encodeURIComponent(docId)}?${maskParams}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ fields }),
        }
      );
      return true;
    } catch (err) {
      console.warn(`[Firestore Admin] Patch skipped (${collectionName}/${docId}):`, err?.message || err);
      return false;
    }
  }

  async function getFirestoreAdminDoc(collectionName, docId) {
    if (!FIREBASE_SERVICE_ACCOUNT_JSON || !docId) return null;
    try {
      const doc = await firestoreAdminRequest(
        `${encodeURIComponent(collectionName)}/${encodeURIComponent(docId)}`,
        { method: 'GET' }
      );
      return decodeFirestoreDocument(doc);
    } catch (err) {
      if (err?.statusCode === 404) return null;
      return null;
    }
  }

  async function deleteFirestoreAdminDoc(collectionName, docId) {
    if (!FIREBASE_SERVICE_ACCOUNT_JSON || !docId) return false;
    try {
      await firestoreAdminRequest(
        `${encodeURIComponent(collectionName)}/${encodeURIComponent(docId)}`,
        { method: 'DELETE' }
      );
      return true;
    } catch {
      return false;
    }
  }

  function scopeKeyToDocId(scopeKey) {
    return `otp_${crypto.createHash('sha256').update(String(scopeKey)).digest('hex').slice(0, 40)}`;
  }

  async function issueServerOtpChallenge({ scopeKey, purpose, email, uid }) {
    pruneOtpMaps();
    const now = Date.now();
    const docId = scopeKeyToDocId(scopeKey);
    const persisted = await getFirestoreAdminDoc('emailOtpChallenges', docId);
    const lastSentMs = Math.max(otpCooldownMap.get(scopeKey) || 0, Number(persisted?.lastSentAtMs || 0));
    const remainingMs = OTP_COOLDOWN_MS - (now - lastSentMs);
    if (remainingMs > 0) {
      const waitSeconds = Math.ceil(remainingMs / 1000);
      return {
        cooldownBlocked: true,
        retryAfterSeconds: waitSeconds,
      };
    }

    const otpCode = String(crypto.randomInt(100000, 1000000));
    const nonce = crypto.randomBytes(16).toString('hex');
    const expiresAt = now + OTP_TTL_MS;
    const otpHash = hashOtpCode(scopeKey, nonce, otpCode);
    const challengeToken = signOtpPayload({
      purpose,
      scopeKey,
      uid: uid || undefined,
      email,
      nonce,
      otpHash,
      exp: expiresAt,
    });

    return {
      cooldownBlocked: false,
      otpCode,
      nonce,
      expiresAt,
      otpHash,
      challengeToken,
      async commitAfterSend() {
        otpCooldownMap.set(scopeKey, now);
        otpAttemptMap.set(nonce, { count: 0, exp: expiresAt });
        otpActiveNonceMap.set(scopeKey, { nonce, exp: expiresAt });
        await patchFirestoreAdminDoc('emailOtpChallenges', docId, {
          scopeKey,
          purpose,
          email,
          uid: uid || null,
          nonce,
          otpHash,
          attempts: 0,
          consumed: false,
          lastSentAtMs: now,
          expiresAtMs: expiresAt,
          updatedAt: new Date(now).toISOString(),
        });
      },
    };
  }

  async function validateServerOtpChallenge({ challengeToken, expectedPurpose, expectedScopeKey, otpInput }) {
    pruneOtpMaps();
    const cleanOtp = String(otpInput || '').replace(/\s+/g, '');
    if (!challengeToken || !/^\d{6}$/.test(cleanOtp)) {
      return {
        ok: false,
        status: 400,
        code: 'OTP_MALFORMED',
        error: 'Please enter the exact 6-digit OTP sent to your email.',
      };
    }

    const payload = verifySignedOtpPayload(challengeToken);
    if (!payload || payload.purpose !== expectedPurpose || payload.scopeKey !== expectedScopeKey) {
      return {
        ok: false,
        status: 400,
        code: 'OTP_SESSION_INVALID',
        error: 'Invalid or expired OTP session. Please request a new code.',
      };
    }

    const now = Date.now();
    const docId = scopeKeyToDocId(expectedScopeKey);
    const persisted = await getFirestoreAdminDoc('emailOtpChallenges', docId);

    const activeMem = otpActiveNonceMap.get(expectedScopeKey);
    const activeNonce = persisted?.nonce || activeMem?.nonce || payload.nonce;
    if (activeNonce && activeNonce !== payload.nonce) {
      return {
        ok: false,
        status: 400,
        code: 'OTP_SUPERSEDED',
        error: 'This code was replaced by a newer OTP. Please enter the latest 6-digit code sent to your email.',
      };
    }

    if (otpConsumedNonceMap.has(payload.nonce) || (persisted && persisted.nonce === payload.nonce && persisted.consumed === true)) {
      return {
        ok: false,
        status: 400,
        code: 'OTP_ALREADY_USED',
        error: 'This verification code has already been used. Please request a new code if needed.',
      };
    }

    const expMs = Number(persisted?.nonce === payload.nonce ? persisted.expiresAtMs : payload.exp);
    if (!expMs || now > expMs) {
      return {
        ok: false,
        status: 400,
        code: 'OTP_EXPIRED',
        error: 'Verification OTP has expired (10-minute limit). Please request a new 6-digit code.',
      };
    }

    const memAttempts = otpAttemptMap.get(payload.nonce) || { count: 0, exp: expMs };
    const currentAttempts = Math.max(
      memAttempts.count,
      persisted?.nonce === payload.nonce ? Number(persisted.attempts || 0) : 0
    );
    if (currentAttempts >= OTP_MAX_ATTEMPTS) {
      return {
        ok: false,
        status: 429,
        code: 'OTP_MAX_ATTEMPTS',
        remainingAttempts: 0,
        error: 'Too many incorrect OTP attempts (maximum 5). Please request a fresh verification code.',
      };
    }

    const computedHash = hashOtpCode(expectedScopeKey, payload.nonce, cleanOtp);
    const targetHash = String(
      persisted?.nonce === payload.nonce && persisted?.otpHash ? persisted.otpHash : payload.otpHash || ''
    );
    const a = Buffer.from(computedHash, 'hex');
    const b = Buffer.from(targetHash, 'hex');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      const nextAttempts = currentAttempts + 1;
      otpAttemptMap.set(payload.nonce, { count: nextAttempts, exp: expMs });
      if (persisted?.nonce === payload.nonce) {
        await patchFirestoreAdminDoc('emailOtpChallenges', docId, {
          attempts: nextAttempts,
          updatedAt: new Date(now).toISOString(),
        });
      }
      const remainingAttempts = Math.max(0, OTP_MAX_ATTEMPTS - nextAttempts);
      return {
        ok: false,
        status: nextAttempts >= OTP_MAX_ATTEMPTS ? 429 : 400,
        code: nextAttempts >= OTP_MAX_ATTEMPTS ? 'OTP_MAX_ATTEMPTS' : 'OTP_INVALID',
        remainingAttempts,
        error:
          remainingAttempts > 0
            ? `Incorrect OTP code. ${remainingAttempts} attempt${remainingAttempts === 1 ? '' : 's'} remaining.`
            : 'Too many incorrect OTP attempts (maximum 5). Please request a fresh verification code.',
      };
    }

    otpAttemptMap.delete(payload.nonce);
    otpConsumedNonceMap.set(payload.nonce, expMs);
    if (persisted?.nonce === payload.nonce) {
      await patchFirestoreAdminDoc('emailOtpChallenges', docId, {
        consumed: true,
        consumedAt: new Date(now).toISOString(),
        updatedAt: new Date(now).toISOString(),
      });
    }

    return { ok: true, payload };
  }

  async function sendTransactionalOtpEmail({ toEmail, subject, text, html }) {
    const activeResendKey = getResendApiKey();
    if (activeResendKey) {
      const resendRes = await fetchWithTimeout(
        'https://api.resend.com/emails',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${activeResendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: RESEND_FROM,
            to: [toEmail],
            subject,
            text,
            html,
          }),
        },
        10000
      );
      if (!resendRes.ok) {
        const errPayload = await resendRes.json().catch(() => null);
        const errText = errPayload?.message || errPayload?.error || (await resendRes.text().catch(() => ''));
        const err = new Error(`Resend email delivery failed (${resendRes.status}): ${String(errText).slice(0, 180)}`);
        err.statusCode = 502;
        throw err;
      }
      const resendData = await resendRes.json().catch(() => ({}));
      return { provider: 'resend', messageId: resendData?.id || null };
    }

    if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
      const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_SECURE,
        auth: {
          user: SMTP_USER,
          pass: SMTP_PASS,
        },
      });
      await transporter.sendMail({
        from: SMTP_FROM,
        to: toEmail,
        subject,
        text,
        html,
      });
      return { provider: 'smtp', messageId: null };
    }

    const err = new Error(
      'Resend Email OTP is not configured yet. Please provide RESEND_API_KEY in your backend secret configuration.'
    );
    err.statusCode = 503;
    err.code = 'EMAIL_OTP_NOT_CONFIGURED';
    throw err;
  }

  async function sendSignupOtpEmail({ toEmail, otpCode, displayName }) {
    const safeName = escapeHtmlText(displayName || 'Alpha Mate');
    const subject = `Your Alpha Mate Sign-Up Verification Code: ${otpCode}`;
    const text = [
      `Welcome to Alpha Mate${displayName ? `, ${displayName}` : ''}!`,
      '',
      `Your 6-digit email verification code is: ${otpCode}`,
      '',
      'Enter this code in the Alpha Mate app to verify your email address and activate your account.',
      'This code expires in 10 minutes. Never share this code with anyone.',
      '',
      'If you did not create an Alpha Mate account, you can safely ignore this email.',
    ].join('\n');
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background:#09070F; color:#F4F4F5; padding:28px; border-radius:16px; max-width:520px; margin:0 auto; border:1px solid #2E1A47;">
        <div style="font-size:11px; font-weight:800; letter-spacing:2px; text-transform:uppercase; color:#C084FC; margin-bottom:8px;">ALPHA MATE</div>
        <h2 style="margin:0 0 8px; color:#FFFFFF; font-size:20px;">Verify Your Email Address</h2>
        <p style="margin:0 0 18px; color:#A1A1AA; font-size:14px; line-height:1.5;">
          Hi <strong style="color:#FFFFFF;">${safeName}</strong>, use the 6-digit verification code below to finish setting up your Alpha Mate account. This code expires in <strong>10 minutes</strong>.
        </p>
        <div style="background:#160D2B; border:1px solid #A855F7; border-radius:12px; padding:18px; text-align:center; margin-bottom:18px;">
          <span style="font-family:monospace; font-size:32px; font-weight:800; letter-spacing:8px; color:#F9A8D4;">${otpCode}</span>
        </div>
        <p style="margin:0; color:#71717A; font-size:12px; line-height:1.5;">
          Never share this verification code with anyone. If you did not sign up for Alpha Mate, you can safely ignore this email.
        </p>
      </div>
    `;
    return sendTransactionalOtpEmail({ toEmail, subject, text, html });
  }

  async function sendLoginOtpEmail({ toEmail, otpCode, displayName }) {
    const safeName = escapeHtmlText(displayName || 'Alpha Mate Member');
    const subject = `Your Alpha Mate Sign-In Code: ${otpCode}`;
    const text = [
      `Hi ${displayName || 'Alpha Mate Member'},`,
      '',
      `Your 6-digit Alpha Mate sign-in OTP code is: ${otpCode}`,
      '',
      'This code expires in 10 minutes. Never share this code with anyone.',
      'If you did not try to sign in, you can safely ignore this email.',
    ].join('\n');
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background:#09070F; color:#F4F4F5; padding:28px; border-radius:16px; max-width:520px; margin:0 auto; border:1px solid #2E1A47;">
        <div style="font-size:11px; font-weight:800; letter-spacing:2px; text-transform:uppercase; color:#C084FC; margin-bottom:8px;">ALPHA MATE</div>
        <h2 style="margin:0 0 8px; color:#FFFFFF; font-size:20px;">Sign-In Verification Code</h2>
        <p style="margin:0 0 18px; color:#A1A1AA; font-size:14px; line-height:1.5;">
          Hi <strong style="color:#FFFFFF;">${safeName}</strong>, enter the 6-digit code below to sign in to your Alpha Mate account. Valid for <strong>10 minutes</strong>.
        </p>
        <div style="background:#160D2B; border:1px solid #EC4899; border-radius:12px; padding:18px; text-align:center; margin-bottom:18px;">
          <span style="font-family:monospace; font-size:32px; font-weight:800; letter-spacing:8px; color:#F9A8D4;">${otpCode}</span>
        </div>
        <p style="margin:0; color:#71717A; font-size:12px; line-height:1.5;">
          Never share this code with anyone. If you did not request a sign-in code, ignore this email.
        </p>
      </div>
    `;
    return sendTransactionalOtpEmail({ toEmail, subject, text, html });
  }

  async function sendDeletionOtpEmail({ toEmail, otpCode }) {
    const subject = `Alpha Mate Account Deletion Verification Code: ${otpCode}`;
    const text = [
      'Alpha Mate Security Verification',
      '',
      `Your 6-digit verification code to request permanent deletion of your Alpha Mate account is: ${otpCode}`,
      '',
      'This code expires in 10 minutes. Never share this code with anyone.',
      'Once verified, your account will enter a 15-day official pending deletion window during which you may sign back in to recover your account.',
      '',
      'If you did not request this, ignore this email and secure your account at support@alphamate.app.',
    ].join('\n');
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background:#09070F; color:#F4F4F5; padding:28px; border-radius:16px; max-width:520px; margin:0 auto; border:1px solid #2E1A47;">
        <h2 style="margin:0 0 8px; color:#FFFFFF; font-size:20px;">Alpha Mate Account Deletion OTP</h2>
        <p style="margin:0 0 18px; color:#A1A1AA; font-size:14px; line-height:1.5;">
          Use the 6-digit verification code below to confirm your permanent account deletion request. This code expires in <strong>10 minutes</strong>.
        </p>
        <div style="background:#160D2B; border:1px solid #A855F7; border-radius:12px; padding:18px; text-align:center; margin-bottom:18px;">
          <span style="font-family:monospace; font-size:32px; font-weight:800; letter-spacing:8px; color:#F9A8D4;">${otpCode}</span>
        </div>
        <p style="margin:0 0 10px; color:#D4D4D8; font-size:13px; line-height:1.5;">
          After verifying this code, your account will remain in a <strong>15-day official pending deletion queue</strong> before permanent removal. You can recover your account at any time within those 15 days by signing back in.
        </p>
        <p style="margin:0; color:#71717A; font-size:12px;">
          If you did not initiate this request, you can safely ignore this message or contact support@alphamate.app.
        </p>
      </div>
    `;
    return sendTransactionalOtpEmail({ toEmail, subject, text, html });
  }

  let identityToolkitTokenCache = null;
  let identityToolkitTokenExpiresAt = 0;

  async function getIdentityToolkitAdminAccessToken() {
    if (!FIREBASE_SERVICE_ACCOUNT_JSON) return null;
    if (identityToolkitTokenCache && Date.now() < identityToolkitTokenExpiresAt - 60_000) {
      return identityToolkitTokenCache;
    }
    const account = readServiceAccount();
    const now = Math.floor(Date.now() / 1000);
    const unsigned = `${base64UrlJson({ alg: 'RS256', typ: 'JWT' })}.${base64UrlJson({
      iss: account.client_email,
      scope: 'https://www.googleapis.com/auth/identitytoolkit',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    })}`;
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(unsigned);
    signer.end();
    const assertion = `${unsigned}.${signer.sign(account.private_key, 'base64url')}`;
    const tokenResp = await fetchWithTimeout(
      'https://oauth2.googleapis.com/token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion,
        }).toString(),
      },
      6000
    );
    const tokenPayload = await tokenResp.json().catch(() => ({}));
    if (!tokenResp.ok || !tokenPayload.access_token) return null;
    identityToolkitTokenCache = tokenPayload.access_token;
    identityToolkitTokenExpiresAt = Date.now() + Number(tokenPayload.expires_in || 3600) * 1000;
    return identityToolkitTokenCache;
  }

  function mintFirebaseCustomToken(uid, claims = { emailOtpVerified: true }) {
    const account = readServiceAccount();
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'RS256', typ: 'JWT' };
    const payload = {
      iss: account.client_email,
      sub: account.client_email,
      aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
      iat: now,
      exp: now + 3600,
      uid,
      claims,
    };
    const unsigned = `${base64UrlJson(header)}.${base64UrlJson(payload)}`;
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(unsigned);
    signer.end();
    return `${unsigned}.${signer.sign(account.private_key, 'base64url')}`;
  }

  async function lookupFirebaseUserByEmailAdmin(email) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail) return null;
    const accessToken = await getIdentityToolkitAdminAccessToken().catch(() => null);
    if (accessToken) {
      const resp = await fetchWithTimeout(
        `https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(FIREBASE_PROJECT_ID)}/accounts:lookup`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: [cleanEmail] }),
        },
        6000
      );
      const data = await resp.json().catch(() => ({}));
      const user = data?.users?.[0];
      if (!user?.localId) return null;
      return {
        uid: user.localId,
        email: (user.email || cleanEmail).toLowerCase(),
        displayName: user.displayName || '',
        emailVerified: Boolean(user.emailVerified),
        disabled: Boolean(user.disabled),
      };
    }

    if (FIREBASE_API_KEY) {
      const resp = await fetchWithTimeout(
        `https://identitytoolkit.googleapis.com/v1/accounts:createAuthUri?key=${encodeURIComponent(FIREBASE_API_KEY)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            identifier: cleanEmail,
            continueUri: 'https://alphamate.app',
          }),
        },
        6000
      );
      const data = await resp.json().catch(() => ({}));
      if (data?.registered || (Array.isArray(data?.signinMethods) && data.signinMethods.length > 0)) {
        return {
          uid: null,
          email: cleanEmail,
          displayName: '',
          emailVerified: false,
          disabled: false,
        };
      }
    }
    return null;
  }

  async function markFirebaseAuthEmailVerified(uid, email, verifiedAtIso = new Date().toISOString()) {
    if (!FIREBASE_SERVICE_ACCOUNT_JSON || !uid) return false;
    try {
      const accessToken = await getIdentityToolkitAdminAccessToken();
      if (!accessToken) return false;
      const updateResp = await fetchWithTimeout(
        `https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(FIREBASE_PROJECT_ID)}/accounts:update`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            localId: uid,
            emailVerified: true,
          }),
        },
        6000
      );
      await patchFirestoreAdminDoc('users', uid, {
        id: uid,
        ...(email ? { email: email.toLowerCase() } : {}),
        isVerified: true,
        emailOtpVerified: true,
        emailOtpVerifiedAt: verifiedAtIso,
        updatedAt: verifiedAtIso,
      });
      return updateResp.ok;
    } catch (err) {
      console.warn('[Email OTP] Identity Toolkit emailVerified sync warning:', err?.message || err);
      return false;
    }
  }

  async function upsertVerifiedPasswordUserOnBackend(email, password, verifiedAtIso) {
    if (!FIREBASE_SERVICE_ACCOUNT_JSON) return null;
    const accessToken = await getIdentityToolkitAdminAccessToken();
    if (!accessToken) return null;

    const cleanEmail = email.trim().toLowerCase();
    const existing = await lookupFirebaseUserByEmailAdmin(cleanEmail);
    let uid = existing?.uid || '';

    if (uid) {
      const updateResp = await fetchWithTimeout(
        `https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(FIREBASE_PROJECT_ID)}/accounts:update`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            localId: uid,
            password,
            emailVerified: true,
          }),
        },
        6000
      );
      if (!updateResp.ok) {
        const errPayload = await updateResp.json().catch(() => ({}));
        throw new Error(errPayload?.error?.message || 'Failed updating password on existing Firebase user.');
      }
    } else {
      const createResp = await fetchWithTimeout(
        `https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(FIREBASE_PROJECT_ID)}/accounts`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: cleanEmail,
            password,
            emailVerified: true,
          }),
        },
        6000
      );
      const createPayload = await createResp.json().catch(() => ({}));
      if (!createResp.ok || !createPayload?.localId) {
        throw new Error(createPayload?.error?.message || 'Failed creating verified Firebase user.');
      }
      uid = createPayload.localId;
    }

    const existingProfile = await getFirestoreAdminDoc('users', uid);
    const alreadyCompleted = Boolean(existingProfile?.profileCompleted);
    await patchFirestoreAdminDoc('users', uid, {
      id: uid,
      email: cleanEmail,
      isVerified: true,
      hasPassword: true,
      profileCompleted: alreadyCompleted,
      emailOtpVerified: true,
      emailOtpVerifiedAt: verifiedAtIso,
      updatedAt: verifiedAtIso,
    });

    const customToken = mintFirebaseCustomToken(uid, { emailOtpVerified: true });
    return { uid, email: cleanEmail, customToken };
  }

  // Safe OTP readiness probe (never returns secret values)
  app.get('/api/auth/otp/status', (_req, res) => {
    const resendConfigured = Boolean(getResendApiKey());
    const smtpConfigured = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);
    return res.json({
      success: true,
      configured: resendConfigured || smtpConfigured,
      provider: resendConfigured ? 'resend' : smtpConfigured ? 'smtp' : 'unconfigured',
      sender: RESEND_FROM,
      firebaseAdminConfigured: Boolean(FIREBASE_SERVICE_ACCOUNT_JSON),
      otpPolicy: {
        digits: 6,
        expirySeconds: Math.floor(OTP_TTL_MS / 1000),
        resendCooldownSeconds: Math.floor(OTP_COOLDOWN_MS / 1000),
        maxAttempts: OTP_MAX_ATTEMPTS,
      },
    });
  });

  app.post('/api/auth/signup-otp/send', requireFirebaseAuth, async (req, res) => {
    try {
      const uid = req.firebaseUser.uid;
      const registeredEmail = (req.firebaseUser.email || '').trim().toLowerCase();
      if (!registeredEmail) {
        return res.status(400).json({
          success: false,
          error: 'No email address was found on this Firebase account.',
        });
      }

      const requestedEmail = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      if (requestedEmail && requestedEmail !== registeredEmail) {
        return res.status(403).json({
          success: false,
          error: 'OTP can only be sent to your registered sign-up email address.',
        });
      }

      if (req.firebaseUser.emailVerified === true) {
        return res.json({
          success: true,
          alreadyVerified: true,
          emailMasked: maskEmailAddress(registeredEmail),
        });
      }

      if (!hasEmailOtpProviderConfigured()) {
        return res.status(503).json({
          success: false,
          code: 'EMAIL_OTP_NOT_CONFIGURED',
          error:
            'Resend Email OTP delivery is not configured on the backend server yet. Set RESEND_API_KEY securely in your backend secrets.',
        });
      }

      const scopeKey = `signup:${uid}`;
      const issued = await issueServerOtpChallenge({
        scopeKey,
        purpose: 'signup_email_verification',
        email: registeredEmail,
        uid,
      });

      if (issued.cooldownBlocked) {
        return res.status(429).json({
          success: false,
          code: 'OTP_COOLDOWN',
          retryAfterSeconds: issued.retryAfterSeconds,
          error: `Please wait ${issued.retryAfterSeconds}s before requesting a new verification code.`,
        });
      }

      const displayName =
        typeof req.body?.displayName === 'string' ? req.body.displayName.trim().slice(0, 80) : '';
      const delivery = await sendSignupOtpEmail({
        toEmail: registeredEmail,
        otpCode: issued.otpCode,
        displayName,
      });
      await issued.commitAfterSend();

      return res.json({
        success: true,
        emailMasked: maskEmailAddress(registeredEmail),
        challengeToken: issued.challengeToken,
        expiresAt: issued.expiresAt,
        expiresInSeconds: Math.floor(OTP_TTL_MS / 1000),
        cooldownSeconds: Math.floor(OTP_COOLDOWN_MS / 1000),
        provider: delivery.provider,
      });
    } catch (error) {
      const status = error.statusCode || 500;
      console.error('[Signup OTP] Send failed:', error.message);
      return res.status(status).json({
        success: false,
        code: error.code || undefined,
        error: error.message || 'Failed to send sign-up verification OTP email.',
      });
    }
  });

  app.post('/api/auth/signup-otp/verify', requireFirebaseAuth, async (req, res) => {
    try {
      const uid = req.firebaseUser.uid;
      const challengeToken = typeof req.body?.challengeToken === 'string' ? req.body.challengeToken.trim() : '';
      const otpInput = req.body?.otp;

      const check = await validateServerOtpChallenge({
        challengeToken,
        expectedPurpose: 'signup_email_verification',
        expectedScopeKey: `signup:${uid}`,
        otpInput,
      });
      if (!check.ok) {
        return res.status(check.status).json({
          success: false,
          code: check.code,
          remainingAttempts: check.remainingAttempts,
          error: check.error,
        });
      }

      const verifiedAtIso = new Date().toISOString();
      const firebaseAuthSynced = await markFirebaseAuthEmailVerified(uid, check.payload.email, verifiedAtIso);
      const signupVerificationToken = signOtpPayload({
        purpose: 'signup_email_verified',
        uid,
        email: check.payload.email,
        verifiedAt: verifiedAtIso,
        exp: Date.now() + OTP_TTL_MS,
      });

      return res.json({
        success: true,
        uid,
        email: check.payload.email,
        emailVerifiedAt: verifiedAtIso,
        firebaseAuthSynced,
        signupVerificationToken,
      });
    } catch (error) {
      console.error('[Signup OTP] Verify failed:', error.message);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to verify sign-up OTP code.',
      });
    }
  });

  // Pre-Signup Email OTP Flow (Step 1: Email -> Step 2: Verify 6-Digit OTP -> Step 3: Set Password)
  const consumedPreSignupTickets = new Set();

  app.post('/api/auth/pre-signup-otp/send', async (req, res) => {
    try {
      const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_EMAIL',
          error: 'Please enter a valid email address.',
        });
      }

      if (!hasEmailOtpProviderConfigured()) {
        return res.status(503).json({
          success: false,
          code: 'EMAIL_OTP_NOT_CONFIGURED',
          error:
            'Resend Email OTP delivery is not configured on the backend server yet. Set RESEND_API_KEY securely in your backend secrets.',
        });
      }

      const scopeKey = `pre_signup:${email}`;
      const issued = await issueServerOtpChallenge({
        scopeKey,
        purpose: 'pre_signup_email_verification',
        email,
      });

      if (issued.cooldownBlocked) {
        return res.status(429).json({
          success: false,
          code: 'OTP_COOLDOWN',
          retryAfterSeconds: issued.retryAfterSeconds,
          error: `Please wait ${issued.retryAfterSeconds}s before requesting a new verification code.`,
        });
      }

      const delivery = await sendSignupOtpEmail({
        toEmail: email,
        otpCode: issued.otpCode,
        displayName: email.split('@')[0],
      });
      await issued.commitAfterSend();

      return res.json({
        success: true,
        emailMasked: maskEmailAddress(email),
        challengeToken: issued.challengeToken,
        expiresAt: issued.expiresAt,
        expiresInSeconds: Math.floor(OTP_TTL_MS / 1000),
        cooldownSeconds: Math.floor(OTP_COOLDOWN_MS / 1000),
        provider: delivery.provider,
      });
    } catch (error) {
      const status = error.statusCode || 500;
      console.error('[Pre-Signup OTP] Send failed:', error.message);
      return res.status(status).json({
        success: false,
        code: error.code || undefined,
        error: error.message || 'Failed to send sign-up verification OTP email.',
      });
    }
  });

  app.post('/api/auth/pre-signup-otp/verify', async (req, res) => {
    try {
      const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      const challengeToken = typeof req.body?.challengeToken === 'string' ? req.body.challengeToken.trim() : '';
      const otpInput = req.body?.otp;

      if (!email) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_EMAIL',
          error: 'Please enter a valid email address.',
        });
      }

      const check = await validateServerOtpChallenge({
        challengeToken,
        expectedPurpose: 'pre_signup_email_verification',
        expectedScopeKey: `pre_signup:${email}`,
        otpInput,
      });
      if (!check.ok) {
        return res.status(check.status).json({
          success: false,
          code: check.code,
          remainingAttempts: check.remainingAttempts,
          error: check.error,
        });
      }

      const verifiedAtIso = new Date().toISOString();
      const ticketNonce = crypto.randomBytes(16).toString('hex');
      const registrationTicket = signOtpPayload({
        purpose: 'pre_signup_email_verified_ticket',
        email,
        ticketNonce,
        verifiedAt: verifiedAtIso,
        exp: Date.now() + 15 * 60 * 1000,
      });

      return res.json({
        success: true,
        email,
        emailVerifiedAt: verifiedAtIso,
        registrationTicket,
      });
    } catch (error) {
      console.error('[Pre-Signup OTP] Verify failed:', error.message);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to verify sign-up OTP code.',
      });
    }
  });

  app.post('/api/auth/pre-signup-otp/complete', async (req, res) => {
    try {
      const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      const password = typeof req.body?.password === 'string' ? req.body.password : '';
      const registrationTicket =
        typeof req.body?.registrationTicket === 'string' ? req.body.registrationTicket.trim() : '';

      if (!email || password.length < 6) {
        return res.status(400).json({
          success: false,
          code: 'WEAK_PASSWORD',
          error: 'Valid email and password (minimum 6 characters) are required.',
        });
      }

      const payload = verifySignedOtpPayload(registrationTicket);
      if (
        !payload ||
        payload.purpose !== 'pre_signup_email_verified_ticket' ||
        payload.email !== email ||
        !payload.exp ||
        Date.now() > Number(payload.exp)
      ) {
        return res.status(400).json({
          success: false,
          code: 'TICKET_EXPIRED',
          error: 'Your email verification session expired. Please verify your 6-digit OTP again.',
        });
      }

      if (consumedPreSignupTickets.has(payload.ticketNonce)) {
        return res.status(400).json({
          success: false,
          code: 'TICKET_CONSUMED',
          error: 'This email verification ticket has already been used.',
        });
      }
      consumedPreSignupTickets.add(payload.ticketNonce);

      const verifiedAtIso = payload.verifiedAt || new Date().toISOString();
      if (FIREBASE_SERVICE_ACCOUNT_JSON) {
        const provisioned = await upsertVerifiedPasswordUserOnBackend(email, password, verifiedAtIso);
        if (provisioned?.uid) {
          return res.json({
            success: true,
            uid: provisioned.uid,
            email: provisioned.email,
            emailVerifiedAt: verifiedAtIso,
            customToken: provisioned.customToken,
          });
        }
      }

      return res.json({
        success: true,
        email,
        emailVerifiedAt: verifiedAtIso,
        clientCompleteFallback: true,
      });
    } catch (error) {
      console.error('[Pre-Signup OTP] Complete failed:', error.message);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to complete password setup.',
      });
    }
  });

  // Login Email OTP Flow (6-digit passwordless login -> Firebase Auth customToken + Firestore user sync)
  app.post('/api/auth/login-otp/send', async (req, res) => {
    try {
      const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_EMAIL',
          error: 'Please enter your registered email address.',
        });
      }

      if (!hasEmailOtpProviderConfigured()) {
        return res.status(503).json({
          success: false,
          code: 'EMAIL_OTP_NOT_CONFIGURED',
          error:
            'Resend Email OTP delivery is not configured on the backend server yet. Set RESEND_API_KEY securely in your backend secrets.',
        });
      }

      const existingUser = await lookupFirebaseUserByEmailAdmin(email);
      if (!existingUser) {
        return res.status(404).json({
          success: false,
          code: 'ACCOUNT_NOT_FOUND',
          error: 'No Alpha Mate account was found with this email. Please tap Create Account to sign up first.',
        });
      }
      if (existingUser.disabled) {
        return res.status(403).json({
          success: false,
          code: 'ACCOUNT_DISABLED',
          error: 'This account has been disabled. Please contact support@alphamate.app.',
        });
      }

      const scopeKey = `login:${email}`;
      const issued = await issueServerOtpChallenge({
        scopeKey,
        purpose: 'login_email_otp',
        email,
        uid: existingUser.uid || undefined,
      });

      if (issued.cooldownBlocked) {
        return res.status(429).json({
          success: false,
          code: 'OTP_COOLDOWN',
          retryAfterSeconds: issued.retryAfterSeconds,
          error: `Please wait ${issued.retryAfterSeconds}s before requesting a new sign-in code.`,
        });
      }

      const delivery = await sendLoginOtpEmail({
        toEmail: email,
        otpCode: issued.otpCode,
        displayName: existingUser.displayName || email.split('@')[0],
      });
      await issued.commitAfterSend();

      return res.json({
        success: true,
        emailMasked: maskEmailAddress(email),
        challengeToken: issued.challengeToken,
        expiresAt: issued.expiresAt,
        expiresInSeconds: Math.floor(OTP_TTL_MS / 1000),
        cooldownSeconds: Math.floor(OTP_COOLDOWN_MS / 1000),
        provider: delivery.provider,
      });
    } catch (error) {
      const status = error.statusCode || 500;
      console.error('[Login OTP] Send failed:', error.message);
      return res.status(status).json({
        success: false,
        code: error.code || undefined,
        error: error.message || 'Failed to send sign-in OTP email.',
      });
    }
  });

  app.post('/api/auth/login-otp/verify', async (req, res) => {
    try {
      const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      const challengeToken = typeof req.body?.challengeToken === 'string' ? req.body.challengeToken.trim() : '';
      const otpInput = req.body?.otp;

      if (!email) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_EMAIL',
          error: 'Please enter your registered email address.',
        });
      }

      const check = await validateServerOtpChallenge({
        challengeToken,
        expectedPurpose: 'login_email_otp',
        expectedScopeKey: `login:${email}`,
        otpInput,
      });
      if (!check.ok) {
        return res.status(check.status).json({
          success: false,
          code: check.code,
          remainingAttempts: check.remainingAttempts,
          error: check.error,
        });
      }

      if (!FIREBASE_SERVICE_ACCOUNT_JSON) {
        return res.status(503).json({
          success: false,
          code: 'FIREBASE_SERVICE_ACCOUNT_REQUIRED',
          error:
            'OTP code matched, but FIREBASE_SERVICE_ACCOUNT_JSON is required on the backend to mint a passwordless custom token. Please sign in with Password or Continue with Google.',
        });
      }

      let uid = check.payload.uid || '';
      if (!uid) {
        const lookedUp = await lookupFirebaseUserByEmailAdmin(email);
        uid = lookedUp?.uid || '';
      }
      if (!uid) {
        return res.status(404).json({
          success: false,
          code: 'ACCOUNT_NOT_FOUND',
          error: 'Account record could not be located in Firebase Authentication.',
        });
      }

      const verifiedAtIso = new Date().toISOString();
      await markFirebaseAuthEmailVerified(uid, email, verifiedAtIso);
      const customToken = mintFirebaseCustomToken(uid, { emailOtpVerified: true });

      return res.json({
        success: true,
        uid,
        email,
        emailVerifiedAt: verifiedAtIso,
        customToken,
      });
    } catch (error) {
      console.error('[Login OTP] Verify failed:', error.message);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to verify sign-in OTP code.',
      });
    }
  });

  // Server-side password attach for Google-authenticated accounts (same UID)
  app.post('/api/auth/set-password', requireFirebaseAuth, async (req, res) => {
    try {
      const uid = req.firebaseUser.uid;
      const password = typeof req.body?.password === 'string' ? req.body.password : '';
      if (password.length < 6 || password.length > 128) {
        return res.status(400).json({
          success: false,
          code: 'WEAK_PASSWORD',
          error: 'Password must be between 6 and 128 characters.',
        });
      }
      if (!FIREBASE_SERVICE_ACCOUNT_JSON) {
        return res.status(503).json({
          success: false,
          code: 'FIREBASE_SERVICE_ACCOUNT_REQUIRED',
          error: 'FIREBASE_SERVICE_ACCOUNT_JSON is not configured on this backend.',
        });
      }
      const accessToken = await getIdentityToolkitAdminAccessToken();
      if (!accessToken) {
        return res.status(502).json({ success: false, error: 'Could not authenticate with Firebase Identity Toolkit.' });
      }
      const updateResp = await fetchWithTimeout(
        `https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(FIREBASE_PROJECT_ID)}/accounts:update`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            localId: uid,
            password,
            emailVerified: true,
          }),
        },
        6000
      );
      if (!updateResp.ok) {
        const errData = await updateResp.json().catch(() => ({}));
        return res.status(400).json({
          success: false,
          error: errData?.error?.message || 'Unable to set password on Firebase account.',
        });
      }
      const nowIso = new Date().toISOString();
      await patchFirestoreAdminDoc('users', uid, {
        id: uid,
        hasPassword: true,
        isVerified: true,
        updatedAt: nowIso,
      });
      return res.json({ success: true, uid });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message || 'Failed to set account password.' });
    }
  });

  // Server-side 90-day multi-account device switch endpoints on Railway
  app.post('/api/auth/device-switch/register', requireFirebaseAuth, async (req, res) => {
    try {
      if (!FIREBASE_SERVICE_ACCOUNT_JSON) {
        return res.status(503).json({ success: false, code: 'FIREBASE_SERVICE_ACCOUNT_REQUIRED' });
      }
      const uid = req.firebaseUser.uid;
      const deviceFingerprint = typeof req.body?.deviceFingerprint === 'string' ? req.body.deviceFingerprint.trim() : '';
      const nowMs = Date.now();
      const nowIso = new Date(nowMs).toISOString();
      const sessionId = `dsw_${crypto.randomBytes(16).toString('hex')}`;
      const switchTicket = crypto.randomBytes(24).toString('hex');
      const salt = crypto.randomBytes(16).toString('hex');
      const tokenHash = crypto
        .createHmac('sha256', salt)
        .update(`${sessionId}:${uid}:${deviceFingerprint}:${switchTicket}`)
        .digest('hex');

      const saved = await patchFirestoreAdminDoc('deviceSwitchSessions', sessionId, {
        sessionId,
        uid,
        salt,
        tokenHash,
        deviceFingerprintHash: crypto.createHash('sha256').update(deviceFingerprint || 'default').digest('hex'),
        createdAtMs: nowMs,
        expiresAtMs: nowMs + DEVICE_SWITCH_TTL_MS,
        lastUsedAtMs: nowMs,
        updatedAt: nowIso,
      });
      if (!saved) {
        return res.status(502).json({ success: false, error: 'Unable to persist device switch session.' });
      }
      return res.json({
        success: true,
        uid,
        sessionId,
        switchTicket,
        switchToken: switchTicket,
      });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message || 'Failed registering device switch session.' });
    }
  });

  app.post('/api/auth/device-switch/redeem', async (req, res) => {
    try {
      if (!FIREBASE_SERVICE_ACCOUNT_JSON) {
        return res.status(503).json({ success: false, code: 'FIREBASE_SERVICE_ACCOUNT_REQUIRED' });
      }
      const sessionId = typeof req.body?.sessionId === 'string' ? req.body.sessionId.trim() : '';
      const switchTicket =
        typeof req.body?.switchTicket === 'string'
          ? req.body.switchTicket.trim()
          : typeof req.body?.switchToken === 'string'
          ? req.body.switchToken.trim()
          : '';
      const deviceFingerprint = typeof req.body?.deviceFingerprint === 'string' ? req.body.deviceFingerprint.trim() : '';

      if (!sessionId || !switchTicket || !/^dsw_[a-f0-9]{32}$/.test(sessionId)) {
        return res.status(400).json({ success: false, error: 'Invalid account switch session.' });
      }

      const record = await getFirestoreAdminDoc('deviceSwitchSessions', sessionId);
      if (!record || !record.uid || !record.salt || !record.tokenHash) {
        return res.status(404).json({ success: false, error: 'Saved session expired. Please sign in once again.' });
      }

      const nowMs = Date.now();
      if (nowMs > Number(record.expiresAtMs || 0)) {
        await deleteFirestoreAdminDoc('deviceSwitchSessions', sessionId);
        return res.status(401).json({ success: false, error: 'Saved session expired. Please sign in once again.' });
      }

      const candidateHash = crypto
        .createHmac('sha256', record.salt)
        .update(`${sessionId}:${record.uid}:${deviceFingerprint}:${switchTicket}`)
        .digest('hex');
      const a = Buffer.from(candidateHash, 'hex');
      const b = Buffer.from(String(record.tokenHash), 'hex');
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        return res.status(401).json({ success: false, error: 'Invalid switch credentials.' });
      }

      await patchFirestoreAdminDoc('deviceSwitchSessions', sessionId, {
        lastUsedAtMs: nowMs,
        expiresAtMs: nowMs + DEVICE_SWITCH_TTL_MS,
        updatedAt: new Date(nowMs).toISOString(),
      });

      const customToken = mintFirebaseCustomToken(record.uid, { emailOtpVerified: true });
      return res.json({ success: true, uid: record.uid, customToken });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message || 'Could not switch account.' });
    }
  });

  app.post('/api/account/deletion-otp/send', requireFirebaseAuth, async (req, res) => {
    try {
      const uid = req.firebaseUser.uid;
      const registeredEmail = (req.firebaseUser.email || '').trim().toLowerCase();
      if (!registeredEmail) {
        return res.status(400).json({
          success: false,
          error: 'No registered email address was found on your Firebase account.',
        });
      }

      const requestedEmail = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      if (requestedEmail && requestedEmail !== registeredEmail) {
        return res.status(403).json({
          success: false,
          error: 'OTP can only be sent to your signed-in account email address.',
        });
      }

      if (!hasEmailOtpProviderConfigured()) {
        return res.status(503).json({
          success: false,
          code: 'EMAIL_OTP_NOT_CONFIGURED',
          error:
            'Resend Email OTP delivery is not configured on the backend server yet. Set RESEND_API_KEY securely in your backend secrets.',
        });
      }

      const scopeKey = `deletion:${uid}`;
      const issued = await issueServerOtpChallenge({
        scopeKey,
        purpose: 'account_permanent_deletion',
        email: registeredEmail,
        uid,
      });

      if (issued.cooldownBlocked) {
        return res.status(429).json({
          success: false,
          code: 'OTP_COOLDOWN',
          retryAfterSeconds: issued.retryAfterSeconds,
          error: `Please wait ${issued.retryAfterSeconds}s before requesting a new verification code.`,
        });
      }

      const delivery = await sendDeletionOtpEmail({ toEmail: registeredEmail, otpCode: issued.otpCode });
      await issued.commitAfterSend();

      return res.json({
        success: true,
        emailMasked: maskEmailAddress(registeredEmail),
        challengeToken: issued.challengeToken,
        expiresAt: issued.expiresAt,
        expiresInSeconds: Math.floor(OTP_TTL_MS / 1000),
        cooldownSeconds: Math.floor(OTP_COOLDOWN_MS / 1000),
        provider: delivery.provider,
      });
    } catch (error) {
      const status = error.statusCode || 500;
      console.error('[Account OTP] Send failed:', error.message);
      return res.status(status).json({
        success: false,
        code: error.code || undefined,
        error: error.message || 'Failed to send verification OTP email.',
      });
    }
  });

  app.post('/api/account/deletion-otp/verify', requireFirebaseAuth, async (req, res) => {
    try {
      const uid = req.firebaseUser.uid;
      const challengeToken = typeof req.body?.challengeToken === 'string' ? req.body.challengeToken.trim() : '';
      const otpInput = req.body?.otp;

      const check = await validateServerOtpChallenge({
        challengeToken,
        expectedPurpose: 'account_permanent_deletion',
        expectedScopeKey: `deletion:${uid}`,
        otpInput,
      });
      if (!check.ok) {
        return res.status(check.status).json({
          success: false,
          code: check.code,
          remainingAttempts: check.remainingAttempts,
          error: check.error,
        });
      }

      const verifiedAtIso = new Date().toISOString();
      const deletionVerificationToken = signOtpPayload({
        purpose: 'account_deletion_verified',
        uid,
        email: check.payload.email,
        verifiedAt: verifiedAtIso,
        exp: Date.now() + OTP_TTL_MS,
      });

      return res.json({
        success: true,
        uid,
        email: check.payload.email,
        otpVerifiedAt: verifiedAtIso,
        deletionVerificationToken,
      });
    } catch (error) {
      console.error('[Account OTP] Verify failed:', error.message);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to verify OTP code.',
      });
    }
  });

  // =========================================================================
  // CLOUDFLARE R2 REELS PROXY (/api/reels/upload & /api/reels/*)
  // Proxies raw video streams server-side so browser/preview origins bypass
  // third-party Worker CORS preflight blocks while keeping R2 credentials in Worker.
  // =========================================================================
  const R2_WORKER_API_BASE = (
    process.env.CLOUDFLARE_WORKER_URL ||
    process.env.VITE_CLOUDFLARE_WORKER_URL ||
    'https://alpha-mate-reels-api.alphamateapp.workers.dev'
  ).replace(/\/$/, '');
  const MAX_REEL_UPLOAD_BYTES = 100 * 1024 * 1024; // 100 MB
  const REELS_TMP_DIR = path.join(os.tmpdir(), 'alpha-reels-uploads');

  function ensureReelsTmpDir() {
    if (!fs.existsSync(REELS_TMP_DIR)) {
      fs.mkdirSync(REELS_TMP_DIR, { recursive: true });
    }
  }

  function cleanupStaleReelsTmp() {
    try {
      if (!fs.existsSync(REELS_TMP_DIR)) return;
      const now = Date.now();
      for (const entry of fs.readdirSync(REELS_TMP_DIR)) {
        const fullPath = path.join(REELS_TMP_DIR, entry);
        try {
          const stat = fs.statSync(fullPath);
          if (now - stat.mtimeMs > 30 * 60 * 1000) {
            fs.rmSync(fullPath, { recursive: true, force: true });
          }
        } catch {
          // ignore cleanup race
        }
      }
    } catch {
      // ignore cleanup errors
    }
  }

  function writeRequestToTempFile(req, destPath, maxBytes) {
    return new Promise((resolve, reject) => {
      let totalBytes = 0;
      let settled = false;
      const out = fs.createWriteStream(destPath);

      const fail = (err) => {
        if (settled) return;
        settled = true;
        try { out.destroy(); } catch {}
        fs.rm(destPath, { force: true }, () => {});
        reject(err);
      };

      req.on('data', (chunk) => {
        if (settled) return;
        totalBytes += chunk.length;
        if (totalBytes > maxBytes) {
          const err = new Error('Video size exceeds maximum allowed limit of 100 MB.');
          err.statusCode = 413;
          req.destroy();
          fail(err);
          return;
        }
        if (!out.write(chunk)) {
          req.pause();
        }
      });

      out.on('drain', () => {
        if (!settled) req.resume();
      });

      req.on('end', () => {
        if (settled) return;
        out.end(() => {
          if (settled) return;
          settled = true;
          resolve(totalBytes);
        });
      });

      req.on('aborted', () => {
        const err = new Error('Upload stream was aborted by client.');
        err.statusCode = 499;
        fail(err);
      });

      req.on('error', (err) => fail(err));
      out.on('error', (err) => fail(err));
    });
  }

  const reelUploadJobs = new Map();

  function pruneReelUploadJobs() {
    const cutoff = Date.now() - 30 * 60 * 1000;
    for (const [id, job] of reelUploadJobs.entries()) {
      if ((job?.updatedAt || 0) < cutoff) {
        reelUploadJobs.delete(id);
      }
    }
  }

  function stripHtmlErrorText(rawText, status) {
    if (!rawText) return `Cloudflare R2 API returned HTTP ${status}`;
    const trimmed = String(rawText).trim();
    if (trimmed.startsWith('<!') || trimmed.toLowerCase().startsWith('<html')) {
      return `Cloudflare R2 API returned HTTP ${status}`;
    }
    return trimmed.slice(0, 300);
  }

  function normalizeWorkerUploadPayload(rawPayload) {
    if (!rawPayload || typeof rawPayload !== 'object') return null;
    const candidate =
      rawPayload.result && typeof rawPayload.result === 'object'
        ? rawPayload.result
        : rawPayload.data && typeof rawPayload.data === 'object'
        ? rawPayload.data
        : rawPayload;

    let videoUrl = String(candidate.videoUrl || candidate.url || rawPayload.videoUrl || rawPayload.url || '').trim();
    let videoKey = String(
      candidate.videoKey ||
        candidate.key ||
        candidate.objectKey ||
        candidate.video_key ||
        rawPayload.videoKey ||
        rawPayload.key ||
        rawPayload.objectKey ||
        ''
    ).trim();

    if (!videoKey && videoUrl) {
      try {
        videoKey = new URL(videoUrl).pathname.replace(/^\/+/, '');
      } catch {
        // ignore
      }
    }
    if (!videoKey) return null;
    if (!videoUrl) {
      videoUrl = `https://media.alphamate.app/${videoKey.replace(/^\/+/, '')}`;
    }
    return {
      ...candidate,
      success: true,
      videoKey,
      videoUrl,
    };
  }

  function forwardFilesToR2Worker({ filePaths, totalBytes, authHeader, contentType, timeoutMs = 300_000, onBytesSent }) {
    return new Promise((resolve, reject) => {
      const targetUrl = new URL(`${R2_WORKER_API_BASE}/upload`);
      const transport = targetUrl.protocol === 'http:' ? http : https;

      let settled = false;
      let bytesSent = 0;
      const upstreamReq = transport.request(
        targetUrl,
        {
          method: 'POST',
          headers: {
            Authorization: authHeader,
            'Content-Type': contentType,
            'Content-Length': String(totalBytes),
            Origin: 'https://alphamate.app',
          },
          timeout: timeoutMs,
        },
        (upstreamRes) => {
          const chunks = [];
          upstreamRes.on('data', (c) => chunks.push(c));
          upstreamRes.on('end', () => {
            if (settled) return;
            settled = true;
            const rawText = Buffer.concat(chunks).toString('utf8');
            let payload = null;
            try {
              payload = rawText ? JSON.parse(rawText) : null;
            } catch {
              payload = null;
            }
            resolve({
              status: upstreamRes.statusCode || 502,
              ok: (upstreamRes.statusCode || 500) >= 200 && (upstreamRes.statusCode || 500) < 300,
              payload,
              rawText,
            });
          });
        }
      );

      upstreamReq.on('timeout', () => {
        if (settled) return;
        settled = true;
        const err = new Error('Timed out transferring video to Cloudflare R2.');
        err.statusCode = 504;
        upstreamReq.destroy(err);
        reject(err);
      });

      upstreamReq.on('error', (err) => {
        if (settled) return;
        settled = true;
        reject(err);
      });

      (async () => {
        try {
          for (const filePath of filePaths) {
            if (settled) return;
            const rs = fs.createReadStream(filePath, { highWaterMark: 256 * 1024 });
            try {
              for await (const chunk of rs) {
                if (settled) {
                  rs.destroy();
                  return;
                }
                if (!upstreamReq.write(chunk)) {
                  await new Promise((resDrain, rejDrain) => {
                    const onDrain = () => { cleanup(); resDrain(); };
                    const onErr = (e) => { cleanup(); rejDrain(e); };
                    const onClose = () => { cleanup(); resDrain(); };
                    const cleanup = () => {
                      upstreamReq.off('drain', onDrain);
                      upstreamReq.off('error', onErr);
                      upstreamReq.off('close', onClose);
                    };
                    upstreamReq.once('drain', onDrain);
                    upstreamReq.once('error', onErr);
                    upstreamReq.once('close', onClose);
                  });
                }
                bytesSent += chunk.length;
                if (onBytesSent) onBytesSent(bytesSent);
              }
            } finally {
              rs.destroy();
            }
          }
          if (!settled) {
            upstreamReq.end();
          }
        } catch (err) {
          if (!settled) {
            settled = true;
            upstreamReq.destroy(err);
            reject(err);
          }
        }
      })();
    });
  }

  app.post('/api/reels/upload', async (req, res) => {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Missing or malformed Authorization header. Expected Bearer token.',
      });
    }

    const rawLength = req.headers['content-length'];
    if (rawLength) {
      const parsedLength = Number(rawLength);
      if (Number.isFinite(parsedLength) && parsedLength > MAX_REEL_UPLOAD_BYTES) {
        return res.status(413).json({
          success: false,
          error: 'Video size exceeds maximum allowed limit of 100 MB.',
        });
      }
    }

    const rawContentType = typeof req.headers['content-type'] === 'string' ? req.headers['content-type'] : 'video/mp4';
    ensureReelsTmpDir();
    cleanupStaleReelsTmp();
    const tmpFilePath = path.join(REELS_TMP_DIR, `single_${Date.now()}_${crypto.randomBytes(6).toString('hex')}.bin`);

    try {
      const totalBytes = await writeRequestToTempFile(req, tmpFilePath, MAX_REEL_UPLOAD_BYTES);
      if (totalBytes <= 0) {
        return res.status(400).json({ success: false, error: 'Empty video file received.' });
      }

      const upstream = await forwardFilesToR2Worker({
        filePaths: [tmpFilePath],
        totalBytes,
        authHeader,
        contentType: rawContentType,
        timeoutMs: 300_000,
      });

      if (upstream.ok) {
        const normalized = normalizeWorkerUploadPayload(upstream.payload);
        if (normalized) {
          return res.status(upstream.status).json(normalized);
        }
        return res.status(502).json({
          success: false,
          error: 'Upstream Reels worker returned an incomplete upload payload.',
        });
      }
      if (upstream.payload && typeof upstream.payload === 'object') {
        return res.status(upstream.status).json(upstream.payload);
      }
      return res.status(upstream.status).json({
        success: false,
        error: stripHtmlErrorText(upstream.rawText, upstream.status),
      });
    } catch (error) {
      const status = error?.statusCode || (error?.name === 'AbortError' ? 504 : 502);
      console.error('[Reels Proxy] Single upload failed:', error?.message || error);
      return res.status(status).json({
        success: false,
        error: error?.message || 'Unable to upload video to Cloudflare R2.',
      });
    } finally {
      fs.rm(tmpFilePath, { force: true }, () => {});
    }
  });

  app.post('/api/reels/upload-chunk', async (req, res) => {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Missing or malformed Authorization header. Expected Bearer token.',
      });
    }

    const uploadId = String(req.headers['x-upload-id'] || '').trim();
    const chunkIndex = Number(req.headers['x-chunk-index']);
    if (!/^[a-zA-Z0-9_-]{8,64}$/.test(uploadId) || !Number.isInteger(chunkIndex) || chunkIndex < 0 || chunkIndex > 200) {
      return res.status(400).json({
        success: false,
        error: 'Invalid X-Upload-Id or X-Chunk-Index header.',
      });
    }

    ensureReelsTmpDir();
    cleanupStaleReelsTmp();
    const sessionDir = path.join(REELS_TMP_DIR, `session_${uploadId}`);
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }
    const chunkPath = path.join(sessionDir, `chunk_${chunkIndex}.part`);

    try {
      const chunkBytes = await writeRequestToTempFile(req, chunkPath, 20 * 1024 * 1024);
      let cumulativeBytes = 0;
      for (const file of fs.readdirSync(sessionDir)) {
        if (file.startsWith('chunk_') && file.endsWith('.part')) {
          cumulativeBytes += fs.statSync(path.join(sessionDir, file)).size;
        }
      }
      if (cumulativeBytes > MAX_REEL_UPLOAD_BYTES) {
        fs.rmSync(sessionDir, { recursive: true, force: true });
        return res.status(413).json({
          success: false,
          error: 'Total uploaded video size exceeds 100 MB limit.',
        });
      }
      return res.json({
        success: true,
        uploadId,
        chunkIndex,
        chunkBytes,
        cumulativeBytes,
      });
    } catch (error) {
      const status = error?.statusCode || 500;
      console.error('[Reels Proxy] Chunk upload failed:', error?.message || error);
      return res.status(status).json({
        success: false,
        error: error?.message || 'Failed to store video upload chunk.',
      });
    }
  });

  app.post('/api/reels/upload-complete', async (req, res) => {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Missing or malformed Authorization header. Expected Bearer token.',
      });
    }

    const uploadId = String(req.body?.uploadId || '').trim();
    const totalChunks = Number(req.body?.totalChunks);
    const contentType = typeof req.body?.contentType === 'string' && req.body.contentType.trim()
      ? req.body.contentType.trim()
      : 'video/mp4';

    if (!/^[a-zA-Z0-9_-]{8,64}$/.test(uploadId) || !Number.isInteger(totalChunks) || totalChunks < 1 || totalChunks > 200) {
      return res.status(400).json({
        success: false,
        error: 'Invalid uploadId or totalChunks for reel completion.',
      });
    }

    pruneReelUploadJobs();
    const existingJob = reelUploadJobs.get(uploadId);
    if (existingJob) {
      return res.status(202).json({
        success: true,
        asyncJob: true,
        jobId: uploadId,
        status: existingJob.status,
        totalBytes: existingJob.totalBytes,
      });
    }

    const sessionDir = path.join(REELS_TMP_DIR, `session_${uploadId}`);
    if (!fs.existsSync(sessionDir)) {
      return res.status(404).json({
        success: false,
        error: 'Upload session expired or not found. Please retry uploading.',
      });
    }

    const filePaths = [];
    let totalBytes = 0;
    for (let i = 0; i < totalChunks; i += 1) {
      const chunkPath = path.join(sessionDir, `chunk_${i}.part`);
      if (!fs.existsSync(chunkPath)) {
        return res.status(400).json({
          success: false,
          error: `Missing video chunk ${i + 1} of ${totalChunks}. Please retry.`,
        });
      }
      const stat = fs.statSync(chunkPath);
      totalBytes += stat.size;
      filePaths.push(chunkPath);
    }

    if (totalBytes <= 0 || totalBytes > MAX_REEL_UPLOAD_BYTES) {
      fs.rm(sessionDir, { recursive: true, force: true }, () => {});
      return res.status(totalBytes <= 0 ? 400 : 413).json({
        success: false,
        error: totalBytes <= 0 ? 'Uploaded video is empty.' : 'Video exceeds 100 MB limit.',
      });
    }

    const job = {
      status: 'uploading',
      bytesTransferred: 0,
      totalBytes,
      statusCode: 202,
      result: null,
      error: null,
      updatedAt: Date.now(),
    };
    reelUploadJobs.set(uploadId, job);

    // Run R2 Worker upload asynchronously so browser HTTP requests never idle-disconnect.
    (async () => {
      try {
        const upstream = await forwardFilesToR2Worker({
          filePaths,
          totalBytes,
          authHeader,
          contentType,
          timeoutMs: 300_000,
          onBytesSent: (sent) => {
            job.bytesTransferred = sent;
            job.updatedAt = Date.now();
          },
        });

        job.statusCode = upstream.status;
        job.updatedAt = Date.now();
        const normalized = upstream.ok ? normalizeWorkerUploadPayload(upstream.payload) : null;
        if (upstream.ok && normalized) {
          job.status = 'completed';
          job.bytesTransferred = totalBytes;
          job.result = normalized;
        } else {
          job.status = 'failed';
          job.statusCode = upstream.ok ? 502 : upstream.status;
          job.error =
            upstream.payload?.error ||
            (upstream.ok
              ? 'Upstream Reels worker returned an incomplete upload payload.'
              : stripHtmlErrorText(upstream.rawText, upstream.status));
          console.error('[Reels Proxy] R2 Worker rejected upload:', job.statusCode, job.error);
        }
      } catch (error) {
        job.status = 'failed';
        job.statusCode = error?.statusCode || 502;
        job.error = error?.message || 'Unable to finalize video upload to Cloudflare R2.';
        job.updatedAt = Date.now();
        console.error('[Reels Proxy] Chunked completion failed:', job.error);
      } finally {
        fs.rm(sessionDir, { recursive: true, force: true }, () => {});
      }
    })();

    return res.status(202).json({
      success: true,
      asyncJob: true,
      jobId: uploadId,
      status: 'uploading',
      totalBytes,
    });
  });

  app.get('/api/reels/upload-status/:uploadId', (req, res) => {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Missing or malformed Authorization header. Expected Bearer token.',
      });
    }

    const uploadId = String(req.params.uploadId || '').trim();
    if (!/^[a-zA-Z0-9_-]{8,64}$/.test(uploadId)) {
      return res.status(400).json({ success: false, error: 'Invalid uploadId.' });
    }

    const job = reelUploadJobs.get(uploadId);
    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Upload job not found or expired.',
      });
    }

    return res.json({
      success: job.status !== 'failed',
      jobId: uploadId,
      status: job.status,
      bytesTransferred: job.bytesTransferred,
      totalBytes: job.totalBytes,
      statusCode: job.statusCode,
      result: job.result,
      error: job.error,
    });
  });

  app.delete('/api/reels/*', async (req, res) => {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Missing or malformed Authorization header. Expected Bearer token.',
      });
    }

    const rawParam = typeof req.params?.[0] === 'string' ? req.params[0] : '';
    let decodedKey = rawParam;
    try {
      decodedKey = decodeURIComponent(rawParam);
    } catch {
      decodedKey = rawParam;
    }

    if (!decodedKey) {
      return res.status(400).json({ success: false, error: 'Missing reel videoKey.' });
    }

    try {
      const upstreamRes = await fetchWithTimeout(
        `${R2_WORKER_API_BASE}/reels/${encodeURIComponent(decodedKey)}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: authHeader,
            Origin: 'https://alphamate.app',
            Accept: 'application/json',
          },
        },
        15_000
      );

      const data = await upstreamRes.json().catch(() => ({}));
      return res.status(upstreamRes.status).json(data);
    } catch (error) {
      const isTimeout = error?.code === 'UPSTREAM_TIMEOUT';
      console.error('[Reels Proxy] Delete failed:', error?.message || error);
      return res.status(isTimeout ? 504 : 502).json({
        success: false,
        error: error?.message || 'Unable to delete reel from Cloudflare R2.',
      });
    }
  });

  // Advanced Gift Animation Engine (Admin Upload, FFprobe Analysis, FFmpeg WebM Conversion & Validation)
  registerGiftMediaRoutes(app, { requireFirebaseAuth, requireAdmin });

  // Ensure unmatched /api/* endpoints return JSON 404 instead of falling through to SPA HTML
  app.use('/api', (_req, res) => {
    res.status(404).json({ success: false, error: 'API endpoint not found.' });
  });

  return app;
}
