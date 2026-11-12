/**
 * High-Definition (HD) Image Utility for Alpha Mate.
 * Ensures avatars, party lounge covers, and backgrounds
 * are loaded in crisp, full-resolution HD quality without blur or compression artifacts.
 */

export function getHdImageUrl(url?: string): string {
  if (!url || typeof url !== 'string') return '';

  // If Unsplash image, upgrade to 1080p high quality with high sharpness
  if (url.includes('images.unsplash.com')) {
    let cleanUrl = url;
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

  return url;
}
