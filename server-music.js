import http from 'http';
import https from 'https';
import net from 'net';
import {
  sendCachedJson,
  serverCache,
  sharedHttpAgent,
  sharedHttpsAgent,
} from './server-cache.js';

const AUDIUS_API_BASE = 'https://api.audius.co/v1';
const AUDIUS_APP_NAME = 'AlphaMateLive';
const DEEZER_API_BASE = 'https://api.deezer.com';
const ITUNES_API_BASE = 'https://itunes.apple.com';
const JAMENDO_API_BASE = 'https://api.jamendo.com/v3.0';

const CACHE_TTL_MS = 5 * 60 * 1000;
const DEEZER_TRACK_TTL_MS = 8 * 60 * 1000;
const MAX_CACHE_ENTRIES = 240;

const searchCache = new Map();
const deezerUrlCache = new Map();

// Simple per-IP sliding window rate limiter for /api/music/*
const rateLimitBuckets = new Map();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_SEARCH = 45;
const RATE_MAX_STREAM = 120;

const ALLOWED_PROXY_HOST_PATTERNS = [
  /^audio-ssl\.itunes\.apple\.com$/i,
  /^is\d-ssl\.mzstatic\.com$/i,
  /^[a-z0-9-]+\.mzstatic\.com$/i,
  /^cdns-preview-[a-z0-9-]+\.dzcdn\.net$/i,
  /^cdnt-preview\.dzcdn\.net$/i,
  /^[a-z0-9-]+\.dzcdn\.net$/i,
  /^mp3d\.jamendo\.com$/i,
  /^prod-[a-z0-9-]+\.storage\.googleapis\.com$/i,
];

function isPrivateOrLocalHost(hostname) {
  const host = String(hostname || '').trim().toLowerCase().replace(/^\[|\]$/g, '');
  if (!host) return true;
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host === 'metadata.google.internal'
  ) {
    return true;
  }
  const ipVersion = net.isIP(host);
  if (ipVersion === 4) {
    const parts = host.split('.').map(Number);
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
  }
  if (ipVersion === 6) {
    if (host === '::1' || host === '::' || host.startsWith('fe80:') || host.startsWith('fc') || host.startsWith('fd')) {
      return true;
    }
    return false;
  }
  return false;
}

function isAllowedProxyUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:') return false;
    if (isPrivateOrLocalHost(parsed.hostname)) return false;
    return ALLOWED_PROXY_HOST_PATTERNS.some((pattern) => pattern.test(parsed.hostname));
  } catch {
    return false;
  }
}

function isSafeHttpsStreamRedirect(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:') return false;
    if (isPrivateOrLocalHost(parsed.hostname)) return false;
    if (parsed.port && parsed.port !== '443') return false;
    return true;
  } catch {
    return false;
  }
}

function checkRateLimit(req, bucketName, maxPerMinute) {
  const ip =
    String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown')
      .split(',')[0]
      .trim()
      .slice(0, 64) || 'unknown';
  const key = `${bucketName}:${ip}`;
  const now = Date.now();
  let entry = rateLimitBuckets.get(key);
  if (!entry || now - entry.windowStart > RATE_WINDOW_MS) {
    entry = { count: 0, windowStart: now };
  }
  entry.count += 1;
  rateLimitBuckets.set(key, entry);

  if (rateLimitBuckets.size > 1000) {
    for (const [k, v] of rateLimitBuckets.entries()) {
      if (now - v.windowStart > RATE_WINDOW_MS) rateLimitBuckets.delete(k);
    }
  }
  return entry.count <= maxPerMinute;
}

function setBoundedCache(map, key, value, ttlMs) {
  if (map.size >= MAX_CACHE_ENTRIES) {
    const firstKey = map.keys().next().value;
    if (firstKey !== undefined) map.delete(firstKey);
  }
  map.set(key, { value, expiresAt: Date.now() + ttlMs });
}

function getBoundedCache(map, key) {
  const entry = map.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    map.delete(key);
    return null;
  }
  return entry.value;
}

function sanitizeSearchQuery(raw) {
  return String(raw || '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

function sanitizeText(raw, maxLen = 120) {
  return String(raw || '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLen);
}

function sanitizeImageUrl(raw) {
  const val = String(raw || '').trim();
  if (!val) return '';
  try {
    const parsed = new URL(val);
    if (parsed.protocol === 'https:' && !isPrivateOrLocalHost(parsed.hostname)) {
      return parsed.toString().slice(0, 1024);
    }
  } catch {
    return '';
  }
  return '';
}

async function fetchJsonWithTimeout(url, timeoutMs = 6500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'AlphaMateLive/1.0',
      },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function normalizeAudiusTrack(item) {
  if (!item || !item.id || item.is_streamable === false) return null;
  const trackId = String(item.id).trim();
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(trackId)) return null;
  const durationSec = Math.max(15, Math.min(7200, Math.round(Number(item.duration) || 180)));
  const artworkRaw =
    item.artwork?.['480x480'] ||
    item.artwork?.['150x150'] ||
    item.artwork?.['1000x1000'] ||
    '';
  const directStreamUrl = `${AUDIUS_API_BASE}/tracks/${encodeURIComponent(trackId)}/stream?app_name=${AUDIUS_APP_NAME}`;
  return {
    id: `audius:${trackId}`,
    sourceTrackId: trackId,
    title: sanitizeText(item.title, 110) || 'Untitled Track',
    artist: sanitizeText(item.user?.name || item.user?.handle, 80) || 'Independent Artist',
    album: sanitizeText(item.genre || item.mood || '', 60) || undefined,
    artworkUrl: sanitizeImageUrl(artworkRaw),
    durationSec,
    fullDurationSec: durationSec,
    streamUrl: `/api/music/audius/${encodeURIComponent(trackId)}`,
    directStreamUrl,
    source: 'audius',
    isFullTrack: true,
  };
}

function normalizeDeezerTrack(item) {
  if (!item || !item.id || !item.preview) return null;
  const trackId = String(item.id).trim();
  if (!/^\d{1,20}$/.test(trackId)) return null;
  const previewUrl = String(item.preview || '').trim();
  if (!isAllowedProxyUrl(previewUrl)) return null;
  const fullDurationSec = Math.max(30, Math.min(7200, Math.round(Number(item.duration) || 210)));
  const artworkRaw =
    item.album?.cover_medium ||
    item.album?.cover_big ||
    item.album?.cover ||
    item.artist?.picture_medium ||
    '';
  setBoundedCache(deezerUrlCache, trackId, previewUrl, DEEZER_TRACK_TTL_MS);
  return {
    id: `deezer:${trackId}`,
    sourceTrackId: trackId,
    title: sanitizeText(item.title_short || item.title, 110) || 'Untitled Track',
    artist: sanitizeText(item.artist?.name, 80) || 'Unknown Artist',
    album: sanitizeText(item.album?.title, 80) || undefined,
    artworkUrl: sanitizeImageUrl(artworkRaw),
    durationSec: 30,
    fullDurationSec,
    streamUrl: `/api/music/deezer/${encodeURIComponent(trackId)}`,
    directStreamUrl: previewUrl,
    source: 'deezer',
    isFullTrack: false,
  };
}

function normalizeItunesTrack(item) {
  if (!item || !item.trackId || !item.previewUrl) return null;
  const trackId = String(item.trackId).trim();
  const previewUrl = String(item.previewUrl || '').trim();
  if (!isAllowedProxyUrl(previewUrl)) return null;
  const fullDurationSec = Math.max(30, Math.min(7200, Math.round((Number(item.trackTimeMillis) || 210000) / 1000)));
  const artworkRaw = String(item.artworkUrl100 || item.artworkUrl60 || '').replace(/100x100bb/i, '300x300bb');
  return {
    id: `itunes:${trackId}`,
    sourceTrackId: trackId,
    title: sanitizeText(item.trackName, 110) || 'Untitled Track',
    artist: sanitizeText(item.artistName, 80) || 'Unknown Artist',
    album: sanitizeText(item.collectionName, 80) || undefined,
    artworkUrl: sanitizeImageUrl(artworkRaw),
    durationSec: 30,
    fullDurationSec,
    streamUrl: `/api/music/proxy?url=${encodeURIComponent(previewUrl)}`,
    directStreamUrl: previewUrl,
    source: 'itunes',
    isFullTrack: false,
  };
}

function normalizeJamendoTrack(item) {
  if (!item || !item.id || !item.audio) return null;
  const audioUrl = String(item.audio || '').trim();
  if (!isAllowedProxyUrl(audioUrl)) return null;
  const durationSec = Math.max(20, Math.min(7200, Math.round(Number(item.duration) || 180)));
  return {
    id: `jamendo:${String(item.id).trim()}`,
    sourceTrackId: String(item.id).trim(),
    title: sanitizeText(item.name, 110) || 'Untitled Track',
    artist: sanitizeText(item.artist_name, 80) || 'Jamendo Artist',
    album: sanitizeText(item.album_name, 80) || undefined,
    artworkUrl: sanitizeImageUrl(item.album_image || item.image || ''),
    durationSec,
    fullDurationSec: durationSec,
    streamUrl: `/api/music/proxy?url=${encodeURIComponent(audioUrl)}`,
    directStreamUrl: audioUrl,
    source: 'jamendo',
    isFullTrack: true,
  };
}

async function searchAudius(query, limit = 12) {
  try {
    const url = `${AUDIUS_API_BASE}/tracks/search?query=${encodeURIComponent(query)}&app_name=${AUDIUS_APP_NAME}`;
    const json = await fetchJsonWithTimeout(url, 6500);
    const list = Array.isArray(json?.data) ? json.data : [];
    return list.map(normalizeAudiusTrack).filter(Boolean).slice(0, limit);
  } catch {
    return [];
  }
}

async function fetchAudiusTrending(genre = '', limit = 14) {
  try {
    const params = new URLSearchParams({ app_name: AUDIUS_APP_NAME, time: 'week' });
    if (genre) params.set('genre', genre);
    const url = `${AUDIUS_API_BASE}/tracks/trending?${params.toString()}`;
    const json = await fetchJsonWithTimeout(url, 6500);
    const list = Array.isArray(json?.data) ? json.data : [];
    return list.map(normalizeAudiusTrack).filter(Boolean).slice(0, limit);
  } catch {
    return [];
  }
}

async function searchDeezer(query, limit = 12) {
  try {
    const url = `${DEEZER_API_BASE}/search?q=${encodeURIComponent(query)}&limit=${Math.min(25, Math.max(5, limit))}`;
    const json = await fetchJsonWithTimeout(url, 5500);
    const list = Array.isArray(json?.data) ? json.data : [];
    return list.map(normalizeDeezerTrack).filter(Boolean).slice(0, limit);
  } catch {
    return [];
  }
}

async function searchItunes(query, limit = 12) {
  try {
    const url = `${ITUNES_API_BASE}/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=${Math.min(25, Math.max(5, limit))}`;
    const json = await fetchJsonWithTimeout(url, 5500);
    const list = Array.isArray(json?.results) ? json.results : [];
    return list.map(normalizeItunesTrack).filter(Boolean).slice(0, limit);
  } catch {
    return [];
  }
}

async function searchJamendo(query, limit = 8) {
  const clientId = (process.env.JAMENDO_CLIENT_ID || '').trim();
  if (!clientId) return [];
  try {
    const url = `${JAMENDO_API_BASE}/tracks/?client_id=${encodeURIComponent(clientId)}&format=json&limit=${limit}&namesearch=${encodeURIComponent(query)}&audioformat=mp32`;
    const json = await fetchJsonWithTimeout(url, 5500);
    const list = Array.isArray(json?.results) ? json.results : [];
    return list.map(normalizeJamendoTrack).filter(Boolean).slice(0, limit);
  } catch {
    return [];
  }
}

function deduplicateTracks(tracks, limit) {
  const seen = new Set();
  const out = [];
  for (const track of tracks) {
    if (!track || !track.id) continue;
    const dedupeKey = `${track.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 26)}::${track.artist
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 20)}::${track.isFullTrack ? 'full' : 'prev'}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    out.push(track);
    if (out.length >= limit) break;
  }
  return out;
}

function interleaveResults(primaryFull, popularA, popularB, limit) {
  const merged = [];
  const maxLen = Math.max(primaryFull.length, popularA.length, popularB.length);
  for (let i = 0; i < maxLen; i++) {
    if (primaryFull[i]) merged.push(primaryFull[i]);
    if (popularA[i]) merged.push(popularA[i]);
    if (popularB[i]) merged.push(popularB[i]);
  }
  return deduplicateTracks(merged, limit);
}

/**
 * Stream an allowlisted HTTPS audio URL to the Express response with HTTP Range support
 * so HTML5 <audio> and Web Audio synced seeking work seamlessly across web & Android WebView.
 */
function pipeRemoteAudio(targetUrl, req, res, redirectDepth = 0) {
  if (redirectDepth > 4) {
    if (!res.headersSent) {
      res.status(502).json({ success: false, error: 'Too many upstream redirects.' });
    }
    return;
  }

  let parsed;
  try {
    parsed = new URL(targetUrl);
  } catch {
    if (!res.headersSent) {
      res.status(400).json({ success: false, error: 'Invalid audio URL.' });
    }
    return;
  }

  if (parsed.protocol !== 'https:' || isPrivateOrLocalHost(parsed.hostname)) {
    if (!res.headersSent) {
      res.status(403).json({ success: false, error: 'Upstream host is not permitted.' });
    }
    return;
  }

  const headers = {
    'User-Agent': 'AlphaMateLive/1.0',
    Accept: 'audio/*, application/octet-stream;q=0.9, */*;q=0.1',
  };

  const rawRange = typeof req.headers.range === 'string' ? req.headers.range.trim() : '';
  if (rawRange && /^bytes=\d*-\d*$/i.test(rawRange)) {
    headers.Range = rawRange;
  }

  const client = parsed.protocol === 'https:' ? https : http;
  const upstreamReq = client.request(
    parsed,
    {
      method: req.method === 'HEAD' ? 'HEAD' : 'GET',
      headers,
      agent: parsed.protocol === 'https:' ? sharedHttpsAgent : sharedHttpAgent,
      timeout: 12000,
    },
    (upstreamRes) => {
      const status = upstreamRes.statusCode || 502;
      const location = upstreamRes.headers.location;

      if ((status === 301 || status === 302 || status === 303 || status === 307 || status === 308) && location) {
        upstreamRes.resume();
        let nextUrl;
        try {
          nextUrl = new URL(location, parsed).toString();
        } catch {
          if (!res.headersSent) {
            res.status(502).json({ success: false, error: 'Invalid upstream redirect.' });
          }
          return;
        }
        if (!isSafeHttpsStreamRedirect(nextUrl)) {
          if (!res.headersSent) {
            res.status(403).json({ success: false, error: 'Blocked unsafe redirect target.' });
          }
          return;
        }
        pipeRemoteAudio(nextUrl, req, res, redirectDepth + 1);
        return;
      }

      if (status >= 400) {
        upstreamRes.resume();
        if (!res.headersSent) {
          res.status(status === 404 ? 404 : 502).json({
            success: false,
            error: `Audio stream unavailable (${status}).`,
          });
        }
        return;
      }

      const contentType = String(upstreamRes.headers['content-type'] || 'audio/mpeg').toLowerCase();
      if (
        !contentType.startsWith('audio/') &&
        !contentType.startsWith('application/octet-stream') &&
        !contentType.startsWith('video/mp4')
      ) {
        upstreamRes.resume();
        if (!res.headersSent) {
          res.status(415).json({ success: false, error: 'Upstream response is not audio.' });
        }
        return;
      }

      res.status(status);
      res.setHeader('Content-Type', upstreamRes.headers['content-type'] || 'audio/mpeg');
      res.setHeader('Accept-Ranges', upstreamRes.headers['accept-ranges'] || 'bytes');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'public, max-age=300');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      if (upstreamRes.headers['content-length']) {
        res.setHeader('Content-Length', upstreamRes.headers['content-length']);
      }
      if (upstreamRes.headers['content-range']) {
        res.setHeader('Content-Range', upstreamRes.headers['content-range']);
      }

      if (req.method === 'HEAD') {
        upstreamRes.resume();
        res.end();
        return;
      }

      upstreamRes.pipe(res);
      res.on('close', () => {
        upstreamReq.destroy();
      });
    }
  );

  upstreamReq.on('timeout', () => {
    upstreamReq.destroy();
    if (!res.headersSent) {
      res.status(504).json({ success: false, error: 'Audio stream timed out.' });
    }
  });

  upstreamReq.on('error', () => {
    if (!res.headersSent) {
      res.status(502).json({ success: false, error: 'Could not connect to audio stream.' });
    }
  });

  upstreamReq.end();
}

const TRENDING_CATEGORY_MAP = {
  all: { audiusGenre: '', query: 'Atif Aslam Arijit Singh Bollywood hits' },
  urdu: { audiusGenre: '', query: 'Atif Aslam Coke Studio Pakistan Rahat Fateh Ali Khan' },
  bollywood: { audiusGenre: '', query: 'Arijit Singh Bollywood romantic hits' },
  punjabi: { audiusGenre: '', query: 'AP Dhillon Diljit Dosanjh Punjabi hits' },
  lofi: { audiusGenre: 'Lo-Fi', query: 'lofi chill beats party lounge' },
  pop: { audiusGenre: 'Pop', query: 'The Weeknd Dua Lipa pop hits' },
  full: { audiusGenre: '', query: 'bollywood remix lofi chill house' },
};

export function registerMusicRoutes(app) {
  // 1. Live Music Search (Audius Full Tracks + Deezer + iTunes + optional Jamendo)
  app.get('/api/music/search', async (req, res) => {
    if (!checkRateLimit(req, 'music-search', RATE_MAX_SEARCH)) {
      return res.status(429).json({ success: false, error: 'Too many music search requests. Please wait a moment.' });
    }

    const q = sanitizeSearchQuery(req.query.q);
    if (!q) {
      return res.status(400).json({ success: false, error: 'Search query "q" is required.' });
    }

    const rawMode = String(req.query.mode || 'all').toLowerCase();
    const mode = rawMode === 'full' || rawMode === 'popular' ? rawMode : 'all';
    const limit = Math.min(30, Math.max(4, Number.parseInt(String(req.query.limit || '20'), 10) || 20));

    const cacheKey = `music:search:${mode}:${limit}:${q.toLowerCase()}`;
    try {
      const { value: tracks, cached } = await serverCache.getOrSet(cacheKey, CACHE_TTL_MS, async () => {
        if (mode === 'full') {
          const [audiusTracks, jamendoTracks] = await Promise.all([
            searchAudius(q, limit),
            searchJamendo(q, Math.min(8, limit)),
          ]);
          return deduplicateTracks([...audiusTracks, ...jamendoTracks], limit);
        }
        if (mode === 'popular') {
          const [deezerTracks, itunesTracks] = await Promise.all([
            searchDeezer(q, limit),
            searchItunes(q, limit),
          ]);
          return interleaveResults([], deezerTracks, itunesTracks, limit);
        }
        const [audiusTracks, deezerTracks, itunesTracks, jamendoTracks] = await Promise.all([
          searchAudius(q, Math.ceil(limit * 0.6)),
          searchDeezer(q, Math.ceil(limit * 0.6)),
          searchItunes(q, Math.ceil(limit * 0.45)),
          searchJamendo(q, 4),
        ]);
        return interleaveResults([...audiusTracks, ...jamendoTracks], deezerTracks, itunesTracks, limit);
      });

      return sendCachedJson(
        req,
        res,
        {
          success: true,
          query: q,
          mode,
          cached,
          tracks,
        },
        { maxAgeSeconds: 180, staleWhileRevalidateSeconds: 600 }
      );
    } catch (error) {
      console.error('[Music Search] Error:', error?.message || error);
      return res.status(502).json({
        success: false,
        error: 'Unable to search music right now. Please try again.',
        tracks: [],
      });
    }
  });

  // 2. Instant Trending & Category Discovery (opens fast with zero typing)
  app.get('/api/music/trending', async (req, res) => {
    if (!checkRateLimit(req, 'music-search', RATE_MAX_SEARCH)) {
      return res.status(429).json({ success: false, error: 'Too many requests.' });
    }

    const rawCat = String(req.query.category || 'all').toLowerCase();
    const category = Object.prototype.hasOwnProperty.call(TRENDING_CATEGORY_MAP, rawCat) ? rawCat : 'all';
    const limit = Math.min(24, Math.max(6, Number.parseInt(String(req.query.limit || '18'), 10) || 18));

    const cacheKey = `music:trending:${category}:${limit}`;
    try {
      const cfg = TRENDING_CATEGORY_MAP[category];
      const { value: tracks, cached } = await serverCache.getOrSet(cacheKey, CACHE_TTL_MS, async () => {
        if (category === 'full') {
          const [trendingAudius, lofiAudius] = await Promise.all([
            fetchAudiusTrending('', Math.ceil(limit * 0.65)),
            searchAudius(cfg.query, Math.ceil(limit * 0.5)),
          ]);
          return deduplicateTracks([...trendingAudius, ...lofiAudius], limit);
        }
        if (category === 'lofi' || category === 'pop') {
          const [audiusTrending, deezerHits, itunesHits] = await Promise.all([
            fetchAudiusTrending(cfg.audiusGenre, Math.ceil(limit * 0.65)),
            searchDeezer(cfg.query, Math.ceil(limit * 0.45)),
            searchItunes(cfg.query, Math.ceil(limit * 0.35)),
          ]);
          return interleaveResults(audiusTrending, deezerHits, itunesHits, limit);
        }
        if (category === 'urdu' || category === 'bollywood' || category === 'punjabi') {
          const [audiusMatches, deezerHits, itunesHits] = await Promise.all([
            searchAudius(cfg.query.split(' ').slice(0, 2).join(' '), Math.ceil(limit * 0.45)),
            searchDeezer(cfg.query, Math.ceil(limit * 0.6)),
            searchItunes(cfg.query, Math.ceil(limit * 0.45)),
          ]);
          return interleaveResults(audiusMatches, deezerHits, itunesHits, limit);
        }
        const [audiusTrending, deezerDesi, itunesDesi] = await Promise.all([
          fetchAudiusTrending('', Math.ceil(limit * 0.55)),
          searchDeezer('Atif Aslam Arijit Singh', Math.ceil(limit * 0.45)),
          searchItunes('Coke Studio Bollywood hits', Math.ceil(limit * 0.35)),
        ]);
        return interleaveResults(audiusTrending, deezerDesi, itunesDesi, limit);
      });

      return sendCachedJson(
        req,
        res,
        { success: true, category, cached, tracks },
        { maxAgeSeconds: 180, staleWhileRevalidateSeconds: 600 }
      );
    } catch (error) {
      console.error('[Music Trending] Error:', error?.message || error);
      return res.status(502).json({ success: false, error: 'Unable to load trending music.', tracks: [] });
    }
  });

  // 3. Audius Fresh Full-Track Stream Proxy (never expires, CORS-clean, supports Range seeking)
  app.get('/api/music/audius/:trackId', (req, res) => {
    if (!checkRateLimit(req, 'music-stream', RATE_MAX_STREAM)) {
      return res.status(429).json({ success: false, error: 'Too many stream requests.' });
    }
    const trackId = String(req.params.trackId || '').trim();
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(trackId)) {
      return res.status(400).json({ success: false, error: 'Invalid Audius track ID.' });
    }
    const targetUrl = `${AUDIUS_API_BASE}/tracks/${encodeURIComponent(trackId)}/stream?app_name=${AUDIUS_APP_NAME}`;
    pipeRemoteAudio(targetUrl, req, res, 0);
  });

  // 4. Deezer Fresh Preview Stream Proxy (auto-refreshes expired signed HMAC URLs)
  app.get('/api/music/deezer/:trackId', async (req, res) => {
    if (!checkRateLimit(req, 'music-stream', RATE_MAX_STREAM)) {
      return res.status(429).json({ success: false, error: 'Too many stream requests.' });
    }
    const trackId = String(req.params.trackId || '').trim();
    if (!/^\d{1,20}$/.test(trackId)) {
      return res.status(400).json({ success: false, error: 'Invalid Deezer track ID.' });
    }

    let previewUrl = getBoundedCache(deezerUrlCache, trackId);
    if (!previewUrl) {
      try {
        const trackJson = await fetchJsonWithTimeout(`${DEEZER_API_BASE}/track/${encodeURIComponent(trackId)}`, 5500);
        const freshUrl = String(trackJson?.preview || '').trim();
        if (freshUrl && isAllowedProxyUrl(freshUrl)) {
          previewUrl = freshUrl;
          setBoundedCache(deezerUrlCache, trackId, freshUrl, DEEZER_TRACK_TTL_MS);
        }
      } catch {
        previewUrl = null;
      }
    }

    if (!previewUrl) {
      return res.status(404).json({ success: false, error: 'Deezer audio preview unavailable.' });
    }
    pipeRemoteAudio(previewUrl, req, res, 0);
  });

  // 5. Strict Allowlist Audio Stream Proxy (for iTunes & Jamendo HTTPS audio streams)
  app.get('/api/music/proxy', (req, res) => {
    if (!checkRateLimit(req, 'music-stream', RATE_MAX_STREAM)) {
      return res.status(429).json({ success: false, error: 'Too many stream requests.' });
    }
    const rawUrl = String(req.query.url || '').trim();
    if (!rawUrl || rawUrl.length > 1500 || !isAllowedProxyUrl(rawUrl)) {
      return res.status(403).json({ success: false, error: 'Audio URL is not on the approved music CDN allowlist.' });
    }
    pipeRemoteAudio(rawUrl, req, res, 0);
  });
}
