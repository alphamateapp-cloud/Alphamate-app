import { Capacitor } from '@capacitor/core';
import type { PartyMusicTrack } from '../types';

export type PartyMusicSearchMode = 'all' | 'full' | 'popular';
export type PartyMusicCategory = 'all' | 'urdu' | 'bollywood' | 'punjabi' | 'lofi' | 'pop' | 'full';

const PRODUCTION_API_URL = 'https://api.alphamate.app';
const AUDIUS_PUBLIC_API = 'https://api.audius.co/v1';
const AUDIUS_APP_NAME = 'AlphaMateLive';
const ITUNES_PUBLIC_API = 'https://itunes.apple.com';

const clientSearchCache = new Map<string, { tracks: PartyMusicTrack[]; expiresAt: number }>();
const CLIENT_CACHE_TTL_MS = 3 * 60 * 1000;

export function getMusicApiBase(): string {
  const envUrl = ((import.meta as any).env?.VITE_RAILWAY_API_URL || '').trim().replace(/\/$/, '');
  if (typeof window !== 'undefined') {
    const isNative = Capacitor.isNativePlatform();
    if (isNative) {
      return envUrl || PRODUCTION_API_URL;
    }
    const host = window.location.hostname.toLowerCase();
    // On web preview / local Vite Express server / production web host, prefer same-origin /api/music/*
    if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.run.app') || host.endsWith('alphamate.app')) {
      return '';
    }
  }
  return envUrl || '';
}

export function resolvePlayableStreamUrls(track: PartyMusicTrack): {
  primaryUrl: string;
  fallbackUrl: string | null;
} {
  const apiBase = getMusicApiBase();
  const rawStream = String(track.streamUrl || '').trim();
  const rawDirect = String(track.directStreamUrl || '').trim();

  let primaryUrl = rawStream;
  if (primaryUrl.startsWith('/api/')) {
    primaryUrl = `${apiBase}${primaryUrl}`;
  } else if (!primaryUrl && rawDirect) {
    primaryUrl = rawDirect;
  }

  // Always compute a clean direct HTTPS fallback for Audius / iTunes / Deezer
  let fallbackUrl: string | null = rawDirect || null;
  if (!fallbackUrl && track.source === 'audius' && track.sourceTrackId) {
    fallbackUrl = `${AUDIUS_PUBLIC_API}/tracks/${encodeURIComponent(track.sourceTrackId)}/stream?app_name=${AUDIUS_APP_NAME}`;
  }

  if (fallbackUrl === primaryUrl) {
    fallbackUrl = null;
  }

  return { primaryUrl, fallbackUrl };
}

export function formatMusicDuration(seconds?: number): string {
  const safe = Math.max(0, Math.floor(Number(seconds) || 0));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export function sanitizePartyMusicTrackForFirestore(
  track: PartyMusicTrack | null | undefined,
  requestedBy?: string
): PartyMusicTrack | null {
  if (!track || !track.id || !track.title) return null;
  const clean: PartyMusicTrack = {
    id: String(track.id).slice(0, 96),
    sourceTrackId: track.sourceTrackId ? String(track.sourceTrackId).slice(0, 64) : undefined,
    title: String(track.title).slice(0, 110),
    artist: String(track.artist || 'Unknown Artist').slice(0, 80),
    album: track.album ? String(track.album).slice(0, 80) : undefined,
    artworkUrl:
      typeof track.artworkUrl === 'string' && track.artworkUrl.startsWith('https://')
        ? track.artworkUrl.slice(0, 1024)
        : undefined,
    durationSec: Math.max(10, Math.min(7200, Math.round(Number(track.durationSec) || 30))),
    fullDurationSec: track.fullDurationSec
      ? Math.max(10, Math.min(7200, Math.round(Number(track.fullDurationSec))))
      : undefined,
    streamUrl: String(track.streamUrl || '').slice(0, 1400),
    directStreamUrl:
      typeof track.directStreamUrl === 'string' && track.directStreamUrl.startsWith('https://')
        ? track.directStreamUrl.slice(0, 1400)
        : undefined,
    source:
      track.source === 'audius' ||
      track.source === 'deezer' ||
      track.source === 'itunes' ||
      track.source === 'jamendo'
        ? track.source
        : 'audius',
    isFullTrack: Boolean(track.isFullTrack),
    requestedBy: (requestedBy || track.requestedBy || '').slice(0, 64) || undefined,
  };
  return clean;
}

async function fetchJsonWithTimeout(url: string, timeoutMs = 7000): Promise<any> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return await res.json();
  } finally {
    window.clearTimeout(timer);
  }
}

async function fallbackClientAudiusSearch(query: string, limit: number): Promise<PartyMusicTrack[]> {
  try {
    const url = query
      ? `${AUDIUS_PUBLIC_API}/tracks/search?query=${encodeURIComponent(query)}&app_name=${AUDIUS_APP_NAME}`
      : `${AUDIUS_PUBLIC_API}/tracks/trending?app_name=${AUDIUS_APP_NAME}&time=week`;
    const json = await fetchJsonWithTimeout(url, 6500);
    const list = Array.isArray(json?.data) ? json.data : [];
    return list
      .filter((t: any) => t && t.id && t.is_streamable !== false)
      .slice(0, limit)
      .map((t: any): PartyMusicTrack => {
        const trackId = String(t.id);
        const directUrl = `${AUDIUS_PUBLIC_API}/tracks/${encodeURIComponent(trackId)}/stream?app_name=${AUDIUS_APP_NAME}`;
        const dur = Math.max(15, Math.min(7200, Math.round(Number(t.duration) || 180)));
        return {
          id: `audius:${trackId}`,
          sourceTrackId: trackId,
          title: String(t.title || 'Untitled Track').slice(0, 110),
          artist: String(t.user?.name || t.user?.handle || 'Artist').slice(0, 80),
          album: t.genre ? String(t.genre).slice(0, 60) : undefined,
          artworkUrl: t.artwork?.['480x480'] || t.artwork?.['150x150'] || '',
          durationSec: dur,
          fullDurationSec: dur,
          streamUrl: directUrl,
          directStreamUrl: directUrl,
          source: 'audius',
          isFullTrack: true,
        };
      });
  } catch {
    return [];
  }
}

async function fallbackClientItunesSearch(query: string, limit: number): Promise<PartyMusicTrack[]> {
  try {
    const url = `${ITUNES_PUBLIC_API}/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=${limit}`;
    const json = await fetchJsonWithTimeout(url, 6000);
    const list = Array.isArray(json?.results) ? json.results : [];
    return list
      .filter((t: any) => t && t.trackId && typeof t.previewUrl === 'string' && t.previewUrl.startsWith('https://'))
      .slice(0, limit)
      .map((t: any): PartyMusicTrack => ({
        id: `itunes:${t.trackId}`,
        sourceTrackId: String(t.trackId),
        title: String(t.trackName || 'Untitled Track').slice(0, 110),
        artist: String(t.artistName || 'Unknown Artist').slice(0, 80),
        album: t.collectionName ? String(t.collectionName).slice(0, 80) : undefined,
        artworkUrl: String(t.artworkUrl100 || '').replace(/100x100bb/i, '300x300bb'),
        durationSec: 30,
        fullDurationSec: Math.max(30, Math.round((Number(t.trackTimeMillis) || 210000) / 1000)),
        streamUrl: String(t.previewUrl),
        directStreamUrl: String(t.previewUrl),
        source: 'itunes',
        isFullTrack: false,
      }));
  } catch {
    return [];
  }
}

export async function searchPartyMusic(
  query: string,
  mode: PartyMusicSearchMode = 'all',
  limit = 20
): Promise<PartyMusicTrack[]> {
  const cleanQuery = query.trim();
  if (!cleanQuery) return [];

  const cacheKey = `search:${mode}:${limit}:${cleanQuery.toLowerCase()}`;
  const cached = clientSearchCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.tracks;
  }

  const apiBase = getMusicApiBase();
  try {
    const url = `${apiBase}/api/music/search?q=${encodeURIComponent(cleanQuery)}&mode=${encodeURIComponent(mode)}&limit=${limit}`;
    const json = await fetchJsonWithTimeout(url, 7500);
    if (json?.success && Array.isArray(json.tracks)) {
      const tracks = json.tracks as PartyMusicTrack[];
      clientSearchCache.set(cacheKey, { tracks, expiresAt: Date.now() + CLIENT_CACHE_TTL_MS });
      return tracks;
    }
  } catch {
    // Fall through to direct public keyless Audius + iTunes fallback
  }

  const [audius, itunes] = await Promise.all([
    mode === 'popular' ? Promise.resolve([]) : fallbackClientAudiusSearch(cleanQuery, Math.ceil(limit * 0.6)),
    mode === 'full' ? Promise.resolve([]) : fallbackClientItunesSearch(cleanQuery, Math.ceil(limit * 0.6)),
  ]);
  const merged: PartyMusicTrack[] = [];
  const maxLen = Math.max(audius.length, itunes.length);
  for (let i = 0; i < maxLen && merged.length < limit; i++) {
    if (audius[i]) merged.push(audius[i]);
    if (itunes[i] && merged.length < limit) merged.push(itunes[i]);
  }
  if (merged.length > 0) {
    clientSearchCache.set(cacheKey, { tracks: merged, expiresAt: Date.now() + CLIENT_CACHE_TTL_MS });
  }
  return merged;
}

const FALLBACK_CATEGORY_QUERIES: Record<PartyMusicCategory, string> = {
  all: 'Atif Aslam Arijit Singh',
  urdu: 'Atif Aslam Coke Studio Pakistan',
  bollywood: 'Arijit Singh Bollywood',
  punjabi: 'AP Dhillon Diljit Dosanjh',
  lofi: 'lofi chill beats',
  pop: 'The Weeknd Dua Lipa',
  full: 'bollywood remix lofi',
};

export async function fetchTrendingPartyMusic(
  category: PartyMusicCategory = 'all',
  limit = 18
): Promise<PartyMusicTrack[]> {
  const cacheKey = `trending:${category}:${limit}`;
  const cached = clientSearchCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.tracks;
  }

  const apiBase = getMusicApiBase();
  try {
    const url = `${apiBase}/api/music/trending?category=${encodeURIComponent(category)}&limit=${limit}`;
    const json = await fetchJsonWithTimeout(url, 7500);
    if (json?.success && Array.isArray(json.tracks) && json.tracks.length > 0) {
      const tracks = json.tracks as PartyMusicTrack[];
      clientSearchCache.set(cacheKey, { tracks, expiresAt: Date.now() + CLIENT_CACHE_TTL_MS });
      return tracks;
    }
  } catch {
    // Fall through to direct public keyless Audius + iTunes fallback
  }

  const q = FALLBACK_CATEGORY_QUERIES[category] || 'Atif Aslam';
  const [audius, itunes] = await Promise.all([
    fallbackClientAudiusSearch(category === 'all' || category === 'full' ? '' : q, Math.ceil(limit * 0.55)),
    category === 'full' ? Promise.resolve([]) : fallbackClientItunesSearch(q, Math.ceil(limit * 0.55)),
  ]);
  const merged: PartyMusicTrack[] = [];
  const maxLen = Math.max(audius.length, itunes.length);
  for (let i = 0; i < maxLen && merged.length < limit; i++) {
    if (audius[i]) merged.push(audius[i]);
    if (itunes[i] && merged.length < limit) merged.push(itunes[i]);
  }
  if (merged.length > 0) {
    clientSearchCache.set(cacheKey, { tracks: merged, expiresAt: Date.now() + CLIENT_CACHE_TTL_MS });
  }
  return merged;
}
