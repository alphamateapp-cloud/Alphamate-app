/**
 * High-Definition (HD) Image Utility for Alpha Mate.
 * Ensures avatars, party lounge covers, and backgrounds
 * are loaded in crisp, full-resolution HD quality without blur or compression artifacts.
 */

export const DEFAULT_AVATAR_URL = '/alpha-mate-logo-emblem.png';

/**
 * Returns a trimmed, non-empty image/media URL or the provided fallback (or undefined).
 * Guarantees an empty string ("") is never passed to an <img>, <video>, or <audio> src/poster attribute.
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

export function getHdImageUrl(url?: string | null, fallback?: string): string | undefined {
  const clean = safeImageSrc(url, fallback);
  if (!clean) return undefined;

  // If Unsplash image, upgrade to 1080p high quality with high sharpness
  if (clean.includes('images.unsplash.com')) {
    let cleanUrl = clean;
    if (cleanUrl.includes('w=')) {
      cleanUrl = cleanUrl.replace(/w=\d+/, 'w=1080');
    } else {
      cleanUrl += '&w=1080';
    }
    if (cleanUrl.includes('q=')) {
      cleanUrl = cleanUrl.replace(/q=\d+/, 'q=90');
    } else {
      cleanUrl += '&q=90';
    }
    return cleanUrl;
  }

  return clean;
}
