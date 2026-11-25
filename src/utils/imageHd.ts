import { smartNetworkService } from '../services/smartNetworkService';

/**
 * Adaptive High-Definition & WebP/AVIF Image Utility for Alpha Mate.
 * - Automatically negotiates WebP/AVIF where supported.
 * - Adapts dimensions and compression quality using SmartNetworkService (real RTT/throughput/packet-loss).
 * - Provides compressed thumbnail generation for cards, avatars, and lists.
 * - Guarantees an empty string ("") is never passed to an <img>, <video>, or <audio> src/poster attribute.
 */

let cachedSupportsWebp: boolean | null = null;

export function supportsWebP(): boolean {
  if (cachedSupportsWebp !== null) return cachedSupportsWebp;
  if (typeof document === 'undefined') {
    cachedSupportsWebp = true;
    return true;
  }
  try {
    const canvas = document.createElement('canvas');
    if (canvas.getContext && canvas.getContext('2d')) {
      cachedSupportsWebp = canvas.toDataURL('image/webp').startsWith('data:image/webp');
      return cachedSupportsWebp;
    }
  } catch {
    // ignore
  }
  cachedSupportsWebp = true;
  return true;
}

export const DEFAULT_AVATAR_URL = '/alpha-mate-logo-emblem.png';

/**
 * Returns a trimmed, non-empty image/media URL or the provided fallback (or undefined).
 */
export function safeImageSrc(url?: string | null, fallback?: string): string | undefined {
  if (typeof url === 'string') {
    const trimmed = url.trim();
    if (trimmed.length > 0) return trimmed;
  }
  if (typeof fallback === 'string') {
    const trimmedFallback = fallback.trim();
    if (trimmedFallback.length > 0) return trimmedFallback;
  }
  return undefined;
}

function rewriteCdnImageUrl(clean: string, targetWidth: number, quality: number): string {
  // 1. Unsplash CDN: inject auto=format (WebP/AVIF), fit=crop, adaptive w & q
  if (clean.includes('images.unsplash.com')) {
    try {
      const parsed = new URL(clean);
      parsed.searchParams.set('auto', 'format');
      parsed.searchParams.set('fit', 'crop');
      parsed.searchParams.set('w', String(targetWidth));
      parsed.searchParams.set('q', String(quality));
      if (supportsWebP() && !parsed.searchParams.has('fm')) {
        parsed.searchParams.set('fm', 'webp');
      }
      return parsed.toString();
    } catch {
      return clean;
    }
  }

  // 2. Cloudinary CDN: inject f_auto,q_auto,w_<n>,c_limit
  if (clean.includes('res.cloudinary.com') && clean.includes('/upload/') && !clean.includes('f_auto')) {
    return clean.replace('/upload/', `/upload/f_auto,q_${quality},w_${targetWidth},c_limit/`);
  }

  // 3. Google user avatars (lh3.googleusercontent.com): cap size parameter (=s<N>-c)
  if (clean.includes('googleusercontent.com') && /=s\d+/i.test(clean)) {
    const avatarCap = Math.min(targetWidth, 256);
    return clean.replace(/=s\d+(-c)?/i, `=s${avatarCap}$1`);
  }

  // 4. Local logo PNGs -> prefer compressed WebP sibling when browser supports WebP
  if (supportsWebP()) {
    if (clean === '/alpha-mate-logo-emblem.png') return '/alpha-mate-logo-emblem.webp';
    if (clean === '/alpha-mate-logo-full.png') return '/alpha-mate-logo-full.webp';
  }

  return clean;
}

export function getHdImageUrl(url?: string | null, fallback?: string): string | undefined {
  const clean = safeImageSrc(url, fallback);
  if (!clean) return undefined;
  const policy = smartNetworkService.getPolicy();
  return rewriteCdnImageUrl(clean, policy.imageMaxWidth, policy.imageQuality);
}

/**
 * Returns a compressed, network-adaptive thumbnail URL for list items, avatars, and grid cards.
 */
export function getThumbnailImageUrl(
  url?: string | null,
  fallback?: string,
  maxWidthOverride?: number
): string | undefined {
  const clean = safeImageSrc(url, fallback);
  if (!clean) return undefined;
  const policy = smartNetworkService.getPolicy();
  const targetWidth = maxWidthOverride
    ? Math.min(maxWidthOverride, policy.thumbnailWidth)
    : policy.thumbnailWidth;
  return rewriteCdnImageUrl(clean, targetWidth, policy.thumbnailQuality);
}
