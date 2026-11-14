/**
 * Alpha Mate Reels Service
 * Integrates Cloudflare R2 video storage via Worker API and Cloud Firestore
 */

import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  increment,
  getDocs,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './firebase';

const ENV_WORKER_URL = ((import.meta as any).env?.VITE_CLOUDFLARE_WORKER_URL || '').trim().replace(/\/$/, '');
const ENV_RAILWAY_URL = ((import.meta as any).env?.VITE_RAILWAY_API_URL || '').trim().replace(/\/$/, '');
export const WORKER_API_BASE = ENV_WORKER_URL || 'https://alpha-mate-reels-api.alphamateapp.workers.dev';
export const MAX_VIDEO_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB
export const R2_MEDIA_DOMAIN =
  ((import.meta as any).env?.VITE_R2_MEDIA_DOMAIN || '').trim().replace(/\/$/, '') || 'https://media.alphamate.app';

export const SUPPORTED_VIDEO_FORMATS = [
  'video/mp4',
  'video/webm',
  'video/quicktime', // MOV
  'video/x-m4v',
  'video/x-matroska',
];

function isNativeCapacitorRuntime(): boolean {
  if (typeof window === 'undefined') return false;
  const cap = (window as any).Capacitor;
  if (cap?.isNativePlatform?.()) return true;
  return window.location.protocol === 'capacitor:' || window.location.protocol === 'file:';
}

function getReelUploadEndpoints(): string[] {
  const directWorkerUrl = `${WORKER_API_BASE}/upload`;
  const railwayProxyUrl =
    ENV_RAILWAY_URL && /^https?:\/\//i.test(ENV_RAILWAY_URL) ? `${ENV_RAILWAY_URL}/api/reels/upload` : null;

  if (isNativeCapacitorRuntime()) {
    return [directWorkerUrl, ...(railwayProxyUrl ? [railwayProxyUrl] : [])];
  }

  const host = typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : '';
  const isCustomDirectDomain = host === 'alphamate.app' || host === 'www.alphamate.app';
  const sameOriginProxyUrl = '/api/reels/upload';

  if (isCustomDirectDomain) {
    return [directWorkerUrl, sameOriginProxyUrl];
  }

  // On AI Studio preview, localhost, or Capacitor web hosts, prefer the same-origin
  // Express streaming proxy first so browser CORS preflight never blocks the upload.
  return [sameOriginProxyUrl, directWorkerUrl, ...(railwayProxyUrl && railwayProxyUrl !== `${window?.location?.origin}/api/reels/upload` ? [railwayProxyUrl] : [])];
}

function getReelDeleteEndpoints(videoKey: string): string[] {
  const encodedKey = encodeURIComponent(videoKey);
  const directWorkerUrl = `${WORKER_API_BASE}/reels/${encodedKey}`;
  const sameOriginProxyUrl = `/api/reels/${encodedKey}`;
  const railwayProxyUrl =
    ENV_RAILWAY_URL && /^https?:\/\//i.test(ENV_RAILWAY_URL) ? `${ENV_RAILWAY_URL}/api/reels/${encodedKey}` : null;

  if (isNativeCapacitorRuntime()) {
    return [directWorkerUrl, ...(railwayProxyUrl ? [railwayProxyUrl] : [])];
  }

  const host = typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : '';
  if (host === 'alphamate.app' || host === 'www.alphamate.app') {
    return [directWorkerUrl, sameOriginProxyUrl];
  }

  return [sameOriginProxyUrl, directWorkerUrl];
}

function normalizeVideoMimeType(file: Blob | File, mimeType: string): string {
  const baseMime = (mimeType || (file as File)?.type || '').split(';')[0].trim().toLowerCase();
  if (SUPPORTED_VIDEO_FORMATS.includes(baseMime)) {
    return mimeType && mimeType.toLowerCase().startsWith(baseMime) ? mimeType : baseMime;
  }

  const fileName = ((file as File)?.name || '').toLowerCase();
  if (fileName.endsWith('.webm')) return 'video/webm';
  if (fileName.endsWith('.mov')) return 'video/quicktime';
  if (fileName.endsWith('.m4v')) return 'video/x-m4v';
  if (fileName.endsWith('.mkv')) return 'video/x-matroska';
  if (baseMime.startsWith('video/') || baseMime === '' || baseMime === 'application/octet-stream') {
    return 'video/mp4';
  }
  return baseMime;
}

export interface Reel {
  id: string;
  uid: string;
  videoKey: string;
  videoUrl: string;
  caption: string;
  title?: string;
  tags?: string[];
  thumbnailUrl?: string;
  createdAt?: any;
  updatedAt?: any;
  likesCount: number;
  commentsCount: number;
  viewsCount: number;
  visibility: 'public' | 'private' | 'friends';
  status: 'active' | 'archived' | 'deleted';
  creator: {
    id: string;
    uniqueId?: string;
    displayName: string;
    username: string;
    avatar: string;
    level?: number;
    vipTier?: number;
    isVerified?: boolean;
  };
  isLiked?: boolean;
}

export interface UploadReelInput {
  videoFile: Blob | File;
  mimeType: string;
  title: string;
  caption: string;
  tags: string[];
  thumbnailUrl?: string;
  visibility?: 'public' | 'private' | 'friends';
  creator: {
    id: string;
    uniqueId?: string;
    displayName: string;
    username: string;
    avatar: string;
    level?: number;
    vipTier?: number;
    isVerified?: boolean;
  };
  onProgress?: (percent: number) => void;
}

export interface R2UploadResult {
  success: boolean;
  videoKey: string;
  videoUrl: string;
  size: number;
  contentType: string;
  uid: string;
  createdAt: string;
}

/**
 * Get a fresh Firebase ID token for authenticated API requests
 */
export async function getFreshIdToken(): Promise<string> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('You must be signed in with Firebase to perform this action.');
  }
  // Force token refresh if expired
  return await currentUser.getIdToken(true);
}

/**
 * Validate video file size and format before initiating upload
 */
export function validateVideoFile(file: Blob | File, mimeType: string): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: 'No video file provided.' };
  }

  if (file.size === 0) {
    return { valid: false, error: 'Selected video file is empty.' };
  }

  if (file.size > MAX_VIDEO_SIZE_BYTES) {
    const sizeInMB = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `Video size (${sizeInMB} MB) exceeds maximum allowed limit of 100 MB.`,
    };
  }

  const normalizedMime = normalizeVideoMimeType(file, mimeType).split(';')[0].trim().toLowerCase();
  const isVideo = normalizedMime.startsWith('video/') || SUPPORTED_VIDEO_FORMATS.includes(normalizedMime);

  if (!isVideo) {
    return {
      valid: false,
      error: `Unsupported video format (${mimeType}). Supported formats: MP4, WebM, MOV.`,
    };
  }

  return { valid: true };
}

class RetryableUploadEndpointError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RetryableUploadEndpointError';
  }
}

const CHUNK_UPLOAD_THRESHOLD_BYTES = 2 * 1024 * 1024; // Use chunked upload above 2 MB on proxy endpoints
const UPLOAD_CHUNK_SIZE_BYTES = 4 * 1024 * 1024; // 4 MB chunks (safely under proxy 32 MB limits)

function sendSingleXhrRequest(
  uploadUrl: string,
  payload: Blob | File,
  extraHeaders: Record<string, string>,
  idToken: string,
  timeoutMs: number,
  onLoadedBytes?: (loaded: number, total: number) => void
): Promise<{ status: number; responseText: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', uploadUrl, true);
    xhr.timeout = timeoutMs;

    xhr.setRequestHeader('Authorization', `Bearer ${idToken}`);
    for (const [k, v] of Object.entries(extraHeaders)) {
      xhr.setRequestHeader(k, v);
    }

    if (xhr.upload && onLoadedBytes) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && event.total > 0) {
          onLoadedBytes(event.loaded, event.total);
        }
      };
    }

    xhr.onload = () => {
      resolve({ status: xhr.status, responseText: xhr.responseText });
    };

    xhr.onerror = () => {
      reject(
        new RetryableUploadEndpointError(
          'Network or CORS error while reaching video upload endpoint.'
        )
      );
    };

    xhr.ontimeout = () => {
      reject(new Error('Upload timed out. Video could not be uploaded within time limit.'));
    };

    xhr.send(payload);
  });
}

function parseUploadResponse(status: number, responseText: string): R2UploadResult {
  let responseJson: any = null;
  try {
    responseJson = JSON.parse(responseText);
  } catch {
    // response might not be JSON
  }

  if (status >= 200 && status < 300) {
    if (responseJson && responseJson.success && responseJson.videoKey) {
      return responseJson as R2UploadResult;
    }
    throw new Error(responseJson?.error || 'Invalid upload response from Reels API');
  }

  if (status === 404 || status === 405 || status === 502 || status === 503) {
    throw new RetryableUploadEndpointError(
      responseJson?.error || `Upload endpoint unavailable (${status})`
    );
  }
  if (status === 401) {
    throw new Error('Firebase authentication failed or session expired. Please re-login.');
  }
  if (status === 413) {
    throw new Error('Server-side check: Video exceeds the 100 MB file size limit.');
  }
  if (status === 415) {
    throw new Error(`Reels API rejected format: ${responseJson?.error || 'Unsupported video format.'}`);
  }
  if (status === 504) {
    throw new Error('Server timed out while transferring video to Cloudflare R2. Please retry.');
  }

  throw new Error(responseJson?.error || `Upload failed with HTTP status ${status}`);
}

async function sendVideoViaXhr(
  uploadUrl: string,
  file: Blob | File,
  contentType: string,
  idToken: string,
  onProgress?: (percent: number) => void
): Promise<R2UploadResult> {
  const { status, responseText } = await sendSingleXhrRequest(
    uploadUrl,
    file,
    { 'Content-Type': contentType },
    idToken,
    300_000,
    (loaded, total) => {
      const percent = Math.min(99, Math.round((loaded / total) * 100));
      onProgress?.(percent);
    }
  );
  const result = parseUploadResponse(status, responseText);
  onProgress?.(100);
  return result;
}

async function uploadViaChunkedProxy(
  proxyUploadUrl: string,
  file: Blob | File,
  contentType: string,
  idToken: string,
  onProgress?: (percent: number) => void
): Promise<R2UploadResult> {
  const basePrefix = proxyUploadUrl.replace(/\/upload$/, '');
  const chunkUrl = `${basePrefix}/upload-chunk`;
  const completeUrl = `${basePrefix}/upload-complete`;
  const uploadId = `reel_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
  const totalChunks = Math.ceil(file.size / UPLOAD_CHUNK_SIZE_BYTES);

  let uploadedBaseBytes = 0;
  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
    const start = chunkIndex * UPLOAD_CHUNK_SIZE_BYTES;
    const end = Math.min(file.size, start + UPLOAD_CHUNK_SIZE_BYTES);
    const chunkBlob = file.slice(start, end);

    let attempt = 0;
    while (true) {
      attempt += 1;
      try {
        const { status, responseText } = await sendSingleXhrRequest(
          chunkUrl,
          chunkBlob,
          {
            'Content-Type': 'application/octet-stream',
            'X-Upload-Id': uploadId,
            'X-Chunk-Index': String(chunkIndex),
          },
          idToken,
          120_000,
          (loaded) => {
            const overall = uploadedBaseBytes + loaded;
            const pct = Math.min(88, Math.round((overall / file.size) * 88));
            onProgress?.(pct);
          }
        );

        if (status === 404 || status === 405) {
          throw new RetryableUploadEndpointError('Chunked upload route not supported on this endpoint');
        }
        if (status === 401) {
          throw new Error('Firebase authentication failed or session expired. Please re-login.');
        }
        if (status === 413) {
          throw new Error('Server-side check: Video exceeds the 100 MB file size limit.');
        }
        if (status < 200 || status >= 300) {
          const parsed = (() => {
            try { return JSON.parse(responseText); } catch { return null; }
          })();
          throw new Error(parsed?.error || `Chunk ${chunkIndex + 1} failed (${status})`);
        }
        break;
      } catch (err: any) {
        if (err instanceof RetryableUploadEndpointError && attempt === 1) {
          throw err;
        }
        const isTerminal =
          err?.message?.includes('authentication failed') ||
          err?.message?.includes('exceeds the 100 MB');
        if (isTerminal || attempt >= 3) {
          throw err;
        }
        await new Promise((r) => setTimeout(r, 700 * attempt));
      }
    }

    uploadedBaseBytes += chunkBlob.size;
    onProgress?.(Math.min(89, Math.round((uploadedBaseBytes / file.size) * 88)));
  }

  onProgress?.(90);
  const completeUrlPayload = JSON.stringify({
    uploadId,
    totalChunks,
    contentType,
  });

  let completeRes: Response | null = null;
  let completeErr: any = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      completeRes = await fetch(completeUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: completeUrlPayload,
      });
      completeErr = null;
      break;
    } catch (err) {
      completeErr = err;
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 800 * attempt));
      }
    }
  }

  if (!completeRes) {
    throw new RetryableUploadEndpointError(
      completeErr?.message || 'Unable to trigger upload completion on server.'
    );
  }

  const completeText = await completeRes.text();
  let completeJson: any = null;
  try {
    completeJson = JSON.parse(completeText);
  } catch {
    completeJson = null;
  }

  // Synchronous 200/201 response (e.g., direct external server)
  if (completeRes.status !== 202 && !completeJson?.asyncJob) {
    const result = parseUploadResponse(completeRes.status, completeText);
    onProgress?.(100);
    return result;
  }

  // Async 202 job: poll /upload-status/:jobId every 1.2s so HTTP connections never idle-timeout
  const jobId = String(completeJson?.jobId || uploadId);
  const statusUrl = `${basePrefix}/upload-status/${encodeURIComponent(jobId)}`;
  const pollDeadline = Date.now() + 330_000;
  let consecutivePollFailures = 0;

  while (Date.now() < pollDeadline) {
    await new Promise((r) => setTimeout(r, 1200));

    let statusRes: Response;
    try {
      statusRes = await fetch(statusUrl, {
        method: 'GET',
        headers: { Authorization: `Bearer ${idToken}` },
      });
      consecutivePollFailures = 0;
    } catch (pollErr: any) {
      consecutivePollFailures += 1;
      if (consecutivePollFailures >= 8) {
        throw new Error(pollErr?.message || 'Lost connection while finalizing video upload.');
      }
      continue;
    }

    const statusJson: any = await statusRes.json().catch(() => null);
    if (!statusRes.ok && statusRes.status === 404) {
      throw new Error('Upload session expired while transferring to Cloudflare R2. Please retry.');
    }

    if (statusJson?.status === 'uploading') {
      const total = Number(statusJson.totalBytes) || file.size;
      const sent = Number(statusJson.bytesTransferred) || 0;
      const ratio = total > 0 ? Math.min(1, sent / total) : 0;
      onProgress?.(Math.min(99, 90 + Math.round(ratio * 9)));
      continue;
    }

    if (statusJson?.status === 'completed' && statusJson?.result?.videoKey) {
      onProgress?.(100);
      return statusJson.result as R2UploadResult;
    }

    if (statusJson?.status === 'failed') {
      return parseUploadResponse(
        Number(statusJson.statusCode) || 502,
        JSON.stringify({ error: statusJson.error || 'Cloudflare R2 upload failed.' })
      );
    }
  }

  throw new Error('Video finalization timed out while transferring to Cloudflare R2. Please retry.');
}

/**
 * Upload raw video bytes to Cloudflare R2 (via same-origin proxy or Cloudflare Worker)
 * Uses XMLHttpRequest for genuine upload progress tracking with chunked proxy & CORS-safe fallback.
 */
export async function uploadVideoToR2(
  file: Blob | File,
  mimeType: string,
  onProgress?: (percent: number) => void
): Promise<R2UploadResult> {
  // 1. Client-Side Validation & MIME normalization
  const validation = validateVideoFile(file, mimeType);
  if (!validation.valid) {
    throw new Error(validation.error);
  }
  const safeContentType = normalizeVideoMimeType(file, mimeType);

  // 2. Retrieve Fresh Firebase ID Token
  const idToken = await getFreshIdToken();

  // 3. Try prioritized upload endpoints (chunked proxy for >2MB -> direct Worker -> Railway fallback)
  const endpoints = getReelUploadEndpoints();
  let lastError: Error | null = null;

  for (const endpoint of endpoints) {
    const isProxyEndpoint = endpoint.endsWith('/api/reels/upload');
    try {
      if (isProxyEndpoint && file.size > CHUNK_UPLOAD_THRESHOLD_BYTES) {
        try {
          return await uploadViaChunkedProxy(endpoint, file, safeContentType, idToken, onProgress);
        } catch (chunkErr: any) {
          if (chunkErr instanceof RetryableUploadEndpointError) {
            // Endpoint doesn't support chunking; fall back to single-request XHR
            return await sendVideoViaXhr(endpoint, file, safeContentType, idToken, onProgress);
          }
          throw chunkErr;
        }
      }
      return await sendVideoViaXhr(endpoint, file, safeContentType, idToken, onProgress);
    } catch (err: any) {
      if (err instanceof RetryableUploadEndpointError) {
        lastError = err;
        continue;
      }
      throw err;
    }
  }

  throw new Error(
    lastError?.message ||
      'Unable to upload video to Cloudflare R2 right now. Please check your connection and retry.'
  );
}

/**
 * Delete a video object from Cloudflare R2 via Worker DELETE endpoint or proxy
 */
export async function deleteVideoFromR2(videoKey: string): Promise<boolean> {
  if (!videoKey) return false;

  const idToken = await getFreshIdToken();
  const endpoints = getReelDeleteEndpoints(videoKey);
  let lastError: Error | null = null;

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (response.status === 404 || response.status === 405 || response.status === 502) {
        lastError = new Error(`Delete endpoint unavailable (${response.status})`);
        continue;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error || `Failed to delete video from R2 (HTTP ${response.status})`);
      }

      const result = await response.json().catch(() => ({ success: true }));
      return !!result.success;
    } catch (err: any) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  if (lastError) {
    throw lastError;
  }
  return false;
}

/**
 * Save Reel metadata to Cloud Firestore with Orphan Cleanup Guarantee
 */
export async function saveReelMetadataToFirestore(
  r2Result: R2UploadResult,
  input: UploadReelInput
): Promise<string> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('User is not authenticated');
  }

  const rawThumb = (input.thumbnailUrl || input.creator.avatar || currentUser.photoURL || '').trim();
  const safeThumbnailUrl =
    rawThumb && rawThumb.length <= 2048
      ? rawThumb
      : currentUser.photoURL && currentUser.photoURL.length <= 2048
      ? currentUser.photoURL
      : '';

  const safeCreatorAvatar =
    input.creator.avatar && input.creator.avatar.length <= 2048
      ? input.creator.avatar
      : currentUser.photoURL && currentUser.photoURL.length <= 2048
      ? currentUser.photoURL
      : '';

  const normalizedVisibility =
    input.visibility === 'private' || input.visibility === 'friends' ? input.visibility : 'public';

  const path = 'reels';
  const reelDocData: Record<string, any> = {
    uid: currentUser.uid,
    videoKey: String(r2Result.videoKey).slice(0, 256),
    videoUrl: String(r2Result.videoUrl).slice(0, 1024),
    title: (input.title.trim() || 'Alpha Moment').slice(0, 256),
    caption: input.caption.trim().slice(0, 2000),
    tags: (input.tags || []).slice(0, 15),
    ...(safeThumbnailUrl ? { thumbnailUrl: safeThumbnailUrl } : {}),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    likesCount: 0,
    commentsCount: 0,
    viewsCount: 0,
    visibility: normalizedVisibility,
    status: 'active',
    creator: {
      id: currentUser.uid,
      uniqueId: input.creator.uniqueId || currentUser.uid.slice(0, 8),
      displayName: input.creator.displayName || currentUser.displayName || 'Alpha Creator',
      username: input.creator.username || 'creator',
      avatar: safeCreatorAvatar,
      level: Number(input.creator.level) || 1,
      vipTier: Number(input.creator.vipTier) || 0,
      isVerified: !!input.creator.isVerified,
    },
  };

  try {
    const docRef = await addDoc(collection(db, 'reels'), reelDocData);
    return docRef.id;
  } catch (error) {
    console.error('Firestore reel save failed, initiating orphan cleanup in R2...', error);
    // ORPHAN CLEANUP: Delete the uploaded file from R2 so storage is not wasted on unindexed files
    await deleteVideoFromR2(r2Result.videoKey).catch((cleanupErr) => {
      console.warn('Failed to cleanup orphaned R2 video:', cleanupErr);
    });
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

/**
 * Complete Reel Publish Pipeline:
 * 1. Validates inputs
 * 2. Uploads raw video to Cloudflare R2
 * 3. Saves verified metadata in Firestore
 * 4. Cleans up orphaned R2 object if Firestore write fails
 */
export async function publishReel(input: UploadReelInput): Promise<{ reelId: string; videoUrl: string }> {
  // Step 1: Upload to Cloudflare R2
  const r2Result = await uploadVideoToR2(input.videoFile, input.mimeType, input.onProgress);

  // Step 2: Index in Cloud Firestore
  const reelId = await saveReelMetadataToFirestore(r2Result, input);

  return {
    reelId,
    videoUrl: r2Result.videoUrl,
  };
}

/**
 * Permanently Delete a Reel:
 * Deletes both the R2 video object and the Firestore document
 */
export async function deleteReel(reelId: string, videoKey: string): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('User is not authenticated');
  }

  // 1. Delete video from R2 Bucket via Worker
  if (videoKey) {
    try {
      await deleteVideoFromR2(videoKey);
    } catch (r2Err) {
      console.warn('R2 deletion warning:', r2Err);
      // Continue to remove or mark document so UI remains in sync
    }
  }

  // 2. Delete document from Firestore
  const path = `reels/${reelId}`;
  try {
    await deleteDoc(doc(db, 'reels', reelId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Real-time subscription to active public reels from Firestore
 */
export function subscribeToActiveReels(
  onUpdate: (reels: Reel[]) => void,
  limitCount = 50
) {
  const path = 'reels';
  const reelsQuery = query(
    collection(db, 'reels'),
    where('status', '==', 'active'),
    where('visibility', '==', 'public'),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );

  return onSnapshot(
    reelsQuery,
    (snapshot) => {
      const reels: Reel[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          uid: data.uid || '',
          videoKey: data.videoKey || '',
          videoUrl: data.videoUrl || '',
          caption: data.caption || '',
          title: data.title || '',
          tags: data.tags || [],
          thumbnailUrl: data.thumbnailUrl || '',
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt || '',
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt || '',
          likesCount: Number(data.likesCount) || 0,
          commentsCount: Number(data.commentsCount) || 0,
          viewsCount: Number(data.viewsCount) || 0,
          visibility: data.visibility || 'public',
          status: data.status || 'active',
          creator: data.creator || {
            id: data.uid,
            displayName: 'Alpha Creator',
            username: 'creator',
            avatar: '',
          },
        };
      });
      onUpdate(reels);
    },
    (error) => {
      console.warn('Reels real-time listener error:', error);
      // If index is building or permissions error occurs
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

/**
 * Increment views count on reel playback
 */
export async function incrementReelViews(reelId: string) {
  if (!reelId) return;
  try {
    await updateDoc(doc(db, 'reels', reelId), {
      viewsCount: increment(1),
    });
  } catch {
    // Non-critical, ignore silent failures on view counts
  }
}

/**
 * Like / Unlike a Reel in Firestore
 */
export async function toggleReelLike(reelId: string, isLiked: boolean) {
  if (!reelId) return;
  try {
    await updateDoc(doc(db, 'reels', reelId), {
      likesCount: increment(isLiked ? -1 : 1),
    });
  } catch (error) {
    console.warn('Failed to toggle reel like in Firestore:', error);
  }
}

/**
 * Post comment on a Reel
 */
export async function addReelComment(
  reelId: string,
  text: string,
  user: { id: string; displayName: string; avatar: string }
) {
  if (!reelId || !text.trim()) return;

  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Must be signed in to comment');

  const commentData = {
    uid: currentUser.uid,
    user: user.displayName,
    avatar: user.avatar,
    text: text.trim(),
    createdAt: serverTimestamp(),
  };

  await addDoc(collection(db, 'reels', reelId, 'comments'), commentData);
  await updateDoc(doc(db, 'reels', reelId), {
    commentsCount: increment(1),
  }).catch(() => {});
}

/**
 * Subscribe to comments for a specific Reel
 */
export function subscribeToReelComments(
  reelId: string,
  onUpdate: (comments: Array<{ id: string; user: string; text: string; time: string; avatar?: string }>) => void
) {
  const commentsQuery = query(
    collection(db, 'reels', reelId, 'comments'),
    orderBy('createdAt', 'desc'),
    limit(50)
  );

  return onSnapshot(
    commentsQuery,
    (snapshot) => {
      const comments = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        let timeStr = 'Just now';
        if (d.createdAt?.toDate) {
          const diffMs = Date.now() - d.createdAt.toDate().getTime();
          const mins = Math.floor(diffMs / 60000);
          if (mins < 1) timeStr = 'Just now';
          else if (mins < 60) timeStr = `${mins}m ago`;
          else timeStr = `${Math.floor(mins / 60)}h ago`;
        }
        return {
          id: docSnap.id,
          user: d.user || 'User',
          avatar: d.avatar,
          text: d.text || '',
          time: timeStr,
        };
      });
      onUpdate(comments);
    },
    (err) => {
      console.warn('Comments listener error:', err);
    }
  );
}
