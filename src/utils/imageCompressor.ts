/**
 * Image compression utility to ensure uploaded user photos
 * (avatars, cover images, party room visuals) are lightweight (< 50KB)
 * and strictly conform to Firestore's 1MB document size limit.
 */

export async function compressImage(
  file: File,
  maxWidth = 400,
  maxHeight = 400,
  quality = 0.75
): Promise<string> {
  return new Promise((resolve, reject) => {
    // If SVG or non-image, fallback to reader
    if (!file.type.startsWith('image/') || file.type.includes('svg')) {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(width, 1);
        canvas.height = Math.max(height, 1);

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Convert to compact JPEG
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedDataUrl);
      };

      img.onerror = () => {
        resolve(e.target?.result as string);
      };

      img.src = e.target?.result as string;
    };

    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Truncates or replaces oversized data URLs (> 50KB)
 * with a reliable standard avatar or placeholder to guard Firestore writes
 */
export function sanitizeAvatarString(
  avatarStr?: string,
  fallback = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80'
): string {
  if (!avatarStr || typeof avatarStr !== 'string') return fallback;
  // If string length exceeds 60,000 characters (~45KB base64), do not write raw data to Firestore document
  if (avatarStr.startsWith('data:') && avatarStr.length > 60000) {
    return fallback;
  }
  return avatarStr;
}
