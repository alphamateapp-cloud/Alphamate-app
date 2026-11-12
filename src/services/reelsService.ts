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

export const WORKER_API_BASE = 'https://alpha-mate-reels-api.alphamateapp.workers.dev';
export const MAX_VIDEO_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB
export const R2_MEDIA_DOMAIN = 'https://media.alphamate.app';

export const SUPPORTED_VIDEO_FORMATS = [
  'video/mp4',
  'video/webm',
  'video/quicktime', // MOV
  'video/x-m4v',
  'video/x-matroska',
];

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

  if (file.size > MAX_VIDEO_SIZE_BYTES) {
    const sizeInMB = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `Video size (${sizeInMB} MB) exceeds maximum allowed limit of 100 MB.`,
    };
  }

  const normalizedMime = mimeType.split(';')[0].trim().toLowerCase();
  const isVideo = normalizedMime.startsWith('video/') || SUPPORTED_VIDEO_FORMATS.includes(normalizedMime);

  if (!isVideo) {
    return {
      valid: false,
      error: `Unsupported video format (${mimeType}). Supported formats: MP4, WebM, MOV.`,
    };
  }

  return { valid: true };
}

/**
 * Upload raw video bytes to Cloudflare R2 via Cloudflare Worker
 * Uses XMLHttpRequest for genuine upload progress tracking
 */
export async function uploadVideoToR2(
  file: Blob | File,
  mimeType: string,
  onProgress?: (percent: number) => void
): Promise<R2UploadResult> {
  // 1. Client-Side Validation
  const validation = validateVideoFile(file, mimeType);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // 2. Retrieve Fresh Firebase ID Token
  const idToken = await getFreshIdToken();

  // 3. Initiate Streamed Raw Upload via XHR
  return new Promise<R2UploadResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${WORKER_API_BASE}/upload`, true);

    xhr.setRequestHeader('Authorization', `Bearer ${idToken}`);
    xhr.setRequestHeader('Content-Type', mimeType);

    // Track real upload progress
    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && event.total > 0) {
          const percent = Math.min(100, Math.round((event.loaded / event.total) * 100));
          onProgress(percent);
        }
      };
    }

    xhr.onload = () => {
      let responseJson: any = null;
      try {
        responseJson = JSON.parse(xhr.responseText);
      } catch {
        // response might not be JSON
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        if (responseJson && responseJson.success && responseJson.videoKey) {
          resolve(responseJson as R2UploadResult);
        } else {
          reject(new Error(responseJson?.error || 'Invalid upload response from Reels API'));
        }
      } else if (xhr.status === 401) {
        reject(new Error('Firebase authentication failed or session expired. Please re-login.'));
      } else if (xhr.status === 413) {
        reject(new Error('Server-side check: Video exceeds the 100 MB file size limit.'));
      } else if (xhr.status === 415) {
        reject(new Error(`Reels API rejected format: ${responseJson?.error || 'Unsupported video format.'}`));
      } else {
        const errorMsg =
          responseJson?.error ||
          `Upload failed with HTTP status ${xhr.status} (${xhr.statusText || 'Worker Error'})`;
        reject(new Error(errorMsg));
      }
    };

    xhr.onerror = () => {
      reject(new Error('Network error during video upload. Please check your internet connection and retry.'));
    };

    xhr.ontimeout = () => {
      reject(new Error('Upload timed out. Video could not be uploaded within time limit.'));
    };

    // Send the raw binary file/blob as body (no FormData wrapper or Base64)
    xhr.send(file);
  });
}

/**
 * Delete a video object from Cloudflare R2 via Worker DELETE endpoint
 */
export async function deleteVideoFromR2(videoKey: string): Promise<boolean> {
  if (!videoKey) return false;

  const idToken = await getFreshIdToken();
  const encodedKey = encodeURIComponent(videoKey);

  const response = await fetch(`${WORKER_API_BASE}/reels/${encodedKey}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData?.error || `Failed to delete video from R2 (HTTP ${response.status})`);
  }

  const result = await response.json();
  return !!result.success;
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

  const path = 'reels';
  const reelDocData = {
    uid: currentUser.uid,
    videoKey: r2Result.videoKey,
    videoUrl: r2Result.videoUrl,
    title: input.title.trim() || 'Alpha Moment',
    caption: input.caption.trim(),
    tags: input.tags || [],
    thumbnailUrl: input.thumbnailUrl || input.creator.avatar,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    likesCount: 0,
    commentsCount: 0,
    viewsCount: 0,
    visibility: input.visibility || 'public',
    status: 'active',
    creator: {
      id: currentUser.uid,
      uniqueId: input.creator.uniqueId || currentUser.uid.slice(0, 8),
      displayName: input.creator.displayName || currentUser.displayName || 'Alpha Creator',
      username: input.creator.username || 'creator',
      avatar: input.creator.avatar || currentUser.photoURL || '',
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
