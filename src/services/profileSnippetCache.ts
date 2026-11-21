import { User, UserBadgeId } from '../types';

export const PROFILE_SNIPPET_CACHE_NAME = 'alphamate-profile-snippets-v1';
export const PROFILE_AVATAR_CACHE_NAME = 'alphamate-profile-avatars-v1';
const SNIPPET_URL_PREFIX = '/__sw_cache__/profile-snippets';
const MAX_DIRECTORY_SNIPPETS = 100;
const SNIPPET_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Lightweight, non-sensitive profile snippet safe for Service Worker Cache Storage.
 * Deliberately omits authentication tokens, private emails, or payment/financial secrets.
 */
export interface UserProfileSnippet {
  id: string;
  uniqueId: string;
  username: string;
  displayName: string;
  avatar: string;
  bio: string;
  level: number;
  vipTier: number;
  followersCount: number;
  followingCount: number;
  likesCount: number;
  isVerified: boolean;
  isAccountVerified?: boolean;
  isHost: boolean;
  country?: string;
  countryFlag?: string;
  activeFrame?: string;
  activeHonorTitle?: string;
  familyCrew?: string;
  equippedBadgeIds?: UserBadgeId[];
  cachedAt: number;
}

const memorySnippetMap = new Map<string, UserProfileSnippet>();
let memoryCurrentSnippet: UserProfileSnippet | null = null;
let memoryDirectorySnippets: UserProfileSnippet[] | null = null;

function isCacheStorageAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.caches !== 'undefined';
}

function buildSnippetUrl(key: string): string {
  const origin = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '';
  return `${origin}${SNIPPET_URL_PREFIX}/${key}`;
}

export function toProfileSnippet(user: Partial<User> & { id?: string }): UserProfileSnippet | null {
  const id = String(user?.id || '').trim();
  if (!id) return null;

  const displayName = String(user.displayName || 'Alpha Mate User').trim().slice(0, 128);
  const username = String(
    user.username || displayName.toLowerCase().replace(/[^a-z0-9_]/g, '') || 'alphamate'
  )
    .trim()
    .slice(0, 64);

  return {
    id,
    uniqueId: String(user.uniqueId || id).trim().slice(0, 64),
    username,
    displayName,
    avatar: typeof user.avatar === 'string' ? user.avatar.slice(0, 65000) : '',
    bio: typeof user.bio === 'string' ? user.bio.slice(0, 300) : '',
    level: Math.max(0, Number(user.level ?? 0)),
    vipTier: Math.max(0, Number(user.vipTier ?? 0)),
    followersCount: Math.max(0, Number(user.followersCount ?? 0)),
    followingCount: Math.max(0, Number(user.followingCount ?? 0)),
    likesCount: Math.max(0, Number(user.likesCount ?? 0)),
    isVerified: Boolean(user.isVerified),
    isAccountVerified: Boolean(
      user.isAccountVerified || user.greenTick || user.emailOtpVerified || user.emailVerified
    ),
    isHost: Boolean(user.isHost),
    ...(typeof user.country === 'string' && user.country ? { country: user.country.slice(0, 64) } : {}),
    ...(typeof user.countryFlag === 'string' && user.countryFlag
      ? { countryFlag: user.countryFlag.slice(0, 16) }
      : {}),
    ...(typeof user.activeFrame === 'string' && user.activeFrame
      ? { activeFrame: user.activeFrame.slice(0, 64) }
      : {}),
    ...(typeof user.activeHonorTitle === 'string' && user.activeHonorTitle
      ? { activeHonorTitle: user.activeHonorTitle.slice(0, 64) }
      : {}),
    ...(typeof user.familyCrew === 'string' && user.familyCrew
      ? { familyCrew: user.familyCrew.slice(0, 64) }
      : {}),
    ...(Array.isArray(user.equippedBadgeIds)
      ? { equippedBadgeIds: user.equippedBadgeIds.slice(0, 8) as UserBadgeId[] }
      : {}),
    cachedAt: Date.now(),
  };
}

export function snippetToUser(snippet: UserProfileSnippet): User {
  return {
    id: snippet.id,
    uniqueId: snippet.uniqueId,
    username: snippet.username,
    displayName: snippet.displayName,
    avatar:
      snippet.avatar ||
      'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80',
    bio: snippet.bio || 'Alpha Mate Member',
    followersCount: snippet.followersCount,
    followingCount: snippet.followingCount,
    likesCount: snippet.likesCount,
    level: snippet.level,
    xp: 0,
    nextLevelXp: 50000,
    vipTier: snippet.vipTier,
    coins: 0,
    diamonds: 0,
    isVerified: snippet.isVerified,
    isAccountVerified: Boolean(snippet.isAccountVerified),
    greenTick: Boolean(snippet.isAccountVerified),
    isHost: snippet.isHost,
    country: snippet.country,
    countryFlag: snippet.countryFlag,
    activeFrame: snippet.activeFrame,
    activeHonorTitle: snippet.activeHonorTitle,
    familyCrew: snippet.familyCrew,
    equippedBadgeIds: snippet.equippedBadgeIds || [],
    accountStatus: 'active',
  };
}

function createJsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=604800',
      'X-AlphaMate-Cache': 'profile-snippet',
    },
  });
}

function isCacheableHttpAvatar(url?: string): boolean {
  if (!url || typeof url !== 'string') return false;
  if (!url.startsWith('https://') && !url.startsWith('/')) return false;
  return url.length <= 1024;
}

/**
 * Best-effort background pre-warm of profile avatar image into Service Worker avatar cache
 * so avatars appear instantaneously and remain visible offline.
 */
async function warmAvatarInCache(avatarUrl?: string): Promise<void> {
  if (!isCacheStorageAvailable() || !isCacheableHttpAvatar(avatarUrl)) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  try {
    const cache = await window.caches.open(PROFILE_AVATAR_CACHE_NAME);
    const existing = await cache.match(avatarUrl as string);
    if (existing) return;
    const req = new Request(avatarUrl as string, { mode: 'no-cors' });
    const res = await fetch(req);
    if (res && (res.ok || res.type === 'opaque')) {
      await cache.put(avatarUrl as string, res);
    }
  } catch {
    // Non-critical: ignore CORS/offline failures when pre-warming avatars
  }
}

/**
 * Store an individual user profile snippet inside Service Worker Cache Storage.
 */
export async function cacheUserProfileSnippet(user: Partial<User> & { id?: string }): Promise<void> {
  const snippet = toProfileSnippet(user);
  if (!snippet) return;

  memorySnippetMap.set(snippet.id, snippet);

  if (!isCacheStorageAvailable()) return;
  try {
    const cache = await window.caches.open(PROFILE_SNIPPET_CACHE_NAME);
    await cache.put(buildSnippetUrl(`user/${encodeURIComponent(snippet.id)}`), createJsonResponse(snippet));
    void warmAvatarInCache(snippet.avatar);
  } catch {
    // Ignore storage quota or private-mode Cache API restrictions
  }
}

/**
 * Read a cached user profile snippet from memory or Service Worker Cache Storage.
 */
export async function getCachedUserProfileSnippet(userId: string): Promise<UserProfileSnippet | null> {
  const id = String(userId || '').trim();
  if (!id) return null;

  const fromMem = memorySnippetMap.get(id);
  if (fromMem && Date.now() - fromMem.cachedAt < SNIPPET_TTL_MS) {
    return fromMem;
  }

  if (!isCacheStorageAvailable()) return fromMem || null;
  try {
    const cache = await window.caches.open(PROFILE_SNIPPET_CACHE_NAME);
    const res = await cache.match(buildSnippetUrl(`user/${encodeURIComponent(id)}`));
    if (!res) return fromMem || null;
    const data = (await res.json()) as UserProfileSnippet;
    if (!data?.id) return null;
    memorySnippetMap.set(data.id, data);
    return data;
  } catch {
    return fromMem || null;
  }
}

/**
 * Store the currently signed-in user's profile snippet for fast cold-boot and offline hydration.
 */
export async function cacheCurrentUserSnippet(user: Partial<User> & { id?: string }): Promise<void> {
  const snippet = toProfileSnippet(user);
  if (!snippet) return;

  memoryCurrentSnippet = snippet;
  memorySnippetMap.set(snippet.id, snippet);

  if (!isCacheStorageAvailable()) return;
  try {
    const cache = await window.caches.open(PROFILE_SNIPPET_CACHE_NAME);
    await Promise.all([
      cache.put(buildSnippetUrl('current'), createJsonResponse(snippet)),
      cache.put(buildSnippetUrl(`user/${encodeURIComponent(snippet.id)}`), createJsonResponse(snippet)),
    ]);
    void warmAvatarInCache(snippet.avatar);
  } catch {
    // Ignore Cache API errors
  }
}

/**
 * Retrieve the cached current user snippet (used on offline startup fallback).
 */
export async function getCachedCurrentUserSnippet(): Promise<UserProfileSnippet | null> {
  if (memoryCurrentSnippet) return memoryCurrentSnippet;
  if (!isCacheStorageAvailable()) return null;
  try {
    const cache = await window.caches.open(PROFILE_SNIPPET_CACHE_NAME);
    const res = await cache.match(buildSnippetUrl('current'));
    if (!res) return null;
    const data = (await res.json()) as UserProfileSnippet;
    if (!data?.id) return null;
    memoryCurrentSnippet = data;
    memorySnippetMap.set(data.id, data);
    return data;
  } catch {
    return null;
  }
}

/**
 * Clear only the cached current user pointer (e.g., on explicit sign-out).
 */
export async function clearCurrentUserSnippet(): Promise<void> {
  memoryCurrentSnippet = null;
  if (!isCacheStorageAvailable()) return;
  try {
    const cache = await window.caches.open(PROFILE_SNIPPET_CACHE_NAME);
    await cache.delete(buildSnippetUrl('current'));
  } catch {
    // ignore
  }
}

/**
 * Cache a batch of user profile snippets (e.g., real user directory) into Service Worker Cache Storage.
 */
export async function cacheProfileSnippetsBatch(users: Array<Partial<User> & { id?: string }>): Promise<void> {
  if (!Array.isArray(users) || users.length === 0) return;

  const snippets: UserProfileSnippet[] = [];
  for (const u of users.slice(0, MAX_DIRECTORY_SNIPPETS)) {
    const snippet = toProfileSnippet(u);
    if (snippet) {
      snippets.push(snippet);
      memorySnippetMap.set(snippet.id, snippet);
    }
  }
  if (snippets.length === 0) return;

  memoryDirectorySnippets = snippets;

  if (!isCacheStorageAvailable()) return;
  try {
    const cache = await window.caches.open(PROFILE_SNIPPET_CACHE_NAME);
    await cache.put(
      buildSnippetUrl('directory'),
      createJsonResponse({ cachedAt: Date.now(), snippets })
    );
    // Also index top 30 snippets individually for direct O(1) lookup by userId
    await Promise.all(
      snippets.slice(0, 30).map((snippet) =>
        cache.put(buildSnippetUrl(`user/${encodeURIComponent(snippet.id)}`), createJsonResponse(snippet))
      )
    );
    // Warm up to 12 avatars gently without saturating bandwidth
    snippets.slice(0, 12).forEach((snippet) => {
      void warmAvatarInCache(snippet.avatar);
    });
  } catch {
    // ignore
  }
}

/**
 * Read cached directory profile snippets from memory or Service Worker Cache Storage.
 */
export async function getCachedProfileDirectory(): Promise<UserProfileSnippet[]> {
  if (memoryDirectorySnippets && memoryDirectorySnippets.length > 0) {
    return memoryDirectorySnippets;
  }
  if (!isCacheStorageAvailable()) return [];
  try {
    const cache = await window.caches.open(PROFILE_SNIPPET_CACHE_NAME);
    const res = await cache.match(buildSnippetUrl('directory'));
    if (!res) return [];
    const data = (await res.json()) as { cachedAt?: number; snippets?: UserProfileSnippet[] };
    if (!Array.isArray(data?.snippets)) return [];
    memoryDirectorySnippets = data.snippets;
    data.snippets.forEach((s) => {
      if (s?.id) memorySnippetMap.set(s.id, s);
    });
    return data.snippets;
  } catch {
    return [];
  }
}

/**
 * Clear all cached profile snippets and cached profile avatars from Service Worker Cache Storage.
 */
export async function clearProfileSnippetCache(): Promise<void> {
  memorySnippetMap.clear();
  memoryCurrentSnippet = null;
  memoryDirectorySnippets = null;

  if (!isCacheStorageAvailable()) return;
  try {
    await Promise.all([
      window.caches.delete(PROFILE_SNIPPET_CACHE_NAME),
      window.caches.delete(PROFILE_AVATAR_CACHE_NAME),
    ]);
  } catch {
    // ignore
  }
}

/**
 * Return a compact summary of Service Worker cached profile snippets & avatars for Settings UI.
 */
export async function getOfflineCacheSummary(): Promise<{
  snippetCount: number;
  avatarCount: number;
  swActive: boolean;
}> {
  const swActive =
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    Boolean(navigator.serviceWorker.controller);

  if (!isCacheStorageAvailable()) {
    return { snippetCount: memorySnippetMap.size, avatarCount: 0, swActive };
  }

  try {
    const [snippetKeys, avatarKeys] = await Promise.all([
      window.caches
        .open(PROFILE_SNIPPET_CACHE_NAME)
        .then((c) => c.keys())
        .catch(() => [] as readonly Request[]),
      window.caches
        .open(PROFILE_AVATAR_CACHE_NAME)
        .then((c) => c.keys())
        .catch(() => [] as readonly Request[]),
    ]);
    return {
      snippetCount: snippetKeys.length,
      avatarCount: avatarKeys.length,
      swActive,
    };
  } catch {
    return { snippetCount: memorySnippetMap.size, avatarCount: 0, swActive };
  }
}
