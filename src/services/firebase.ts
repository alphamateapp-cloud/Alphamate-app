import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  updateDoc,
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
  runTransaction,
  addDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { sanitizeAvatarString } from '../utils/imageCompressor';

// Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// CRITICAL: The app will break without passing firestoreDatabaseId
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

// =========================================================================
// ERROR HANDLER CONFORMING TO FirestoreErrorInfo
// =========================================================================
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// =========================================================================
// CONNECTION TEST ON APP BOOT
// =========================================================================
export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log('Firebase Firestore connection verified.');
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration: client is offline.');
    } else {
      console.log('Firestore initialized:', (error as Error)?.message || error);
    }
    return false;
  }
}

// Trigger initial verification
testConnection().catch(() => {});

// =========================================================================
// AUTHENTICATION HELPER METHODS
// =========================================================================

/**
 * Sign In with Google Popup
 */
export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    console.error('Google Sign-In Error:', error);
    throw error;
  }
}

/**
 * Sign In with Email & Password
 */
export async function signInWithEmail(email: string, pass: string) {
  try {
    const result = await signInWithEmailAndPassword(auth, email, pass);
    return result.user;
  } catch (error: any) {
    console.error('Email Sign-In Error:', error);
    throw error;
  }
}

/**
 * Register with Email & Password
 */
export async function registerWithEmail(email: string, pass: string) {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, pass);
    return result.user;
  } catch (error: any) {
    console.error('Email Registration Error:', error);
    throw error;
  }
}

/**
 * Log Out
 */
export async function logoutUser() {
  try {
    await signOut(auth);
  } catch (error: any) {
    console.error('Sign-Out Error:', error);
    throw error;
  }
}

export { onAuthStateChanged };
export type { FirebaseUser };

// =========================================================================
// FIRESTORE REAL-TIME DATA HELPERS
// =========================================================================

/**
 * Save / Update User Profile in Firestore
 */
export async function syncUserProfileToFirestore(userData: any) {
  if (!userData?.id) return;
  const path = `users/${userData.id}`;
  try {
    const sanitizedProfile = {
      ...userData,
      avatar: sanitizeAvatarString(userData.avatar),
      // Prevent oversized base64 cover images from exceeding 1MB limit
      coverImage:
        typeof userData.coverImage === 'string' && userData.coverImage.length > 80000
          ? undefined
          : userData.coverImage,
      updatedAt: new Date().toISOString(),
    };

    await setDoc(doc(db, 'users', userData.id), sanitizedProfile, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Fetch User Profile from Firestore
 */
export async function getUserProfileFromFirestore(userId: string) {
  const path = `users/${userId}`;
  try {
    const snap = await getDoc(doc(db, 'users', userId));
    return snap.exists() ? snap.data() : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

/**
 * Real-time Listener for User Profile
 */
export function subscribeToUserProfile(userId: string, onUpdate: (data: any) => void) {
  const path = `users/${userId}`;
  return onSnapshot(
    doc(db, 'users', userId),
    (snap) => {
      if (snap.exists()) {
        onUpdate(snap.data());
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

/**
 * Save Party Room to Firestore with Payload Sanitization
 * Strips unbounded sub-objects, large base64 photos, and cover images to stay well below 1MB.
 */
export async function syncPartyRoomToFirestore(room: any) {
  if (!room?.id) return;
  const path = `partyRooms/${room.id}`;
  try {
    const sanitizedRoom = {
      id: room.id,
      title: (room.title || '').slice(0, 100),
      category: room.category || 'Chat',
      announcement: (room.announcement || '').slice(0, 200),
      activeViewers: Number(room.activeViewers) || 1,
      level: Number(room.level) || 1,
      totalGiftCoins: Number(room.totalGiftCoins) || 0,
      coverImageUrl: typeof room.coverImageUrl === 'string' && room.coverImageUrl.startsWith('https://') ? room.coverImageUrl : '',
      backgroundTheme: room.backgroundTheme || 'from-[#1E103A] to-[#0A0614]',
      nowPlaying: room.nowPlaying || '',
      moderatorIds: (room.moderatorIds || []).slice(0, 10),
      kickedUserIds: (room.kickedUserIds || []).slice(0, 100),
      blockedUserIds: (room.blockedUserIds || []).slice(0, 100),
      host: {
        id: room.host?.id || '',
        uniqueId: room.host?.uniqueId || room.host?.id || '',
        displayName: room.host?.displayName || 'Host',
        username: room.host?.username || '',
        avatar: sanitizeAvatarString(room.host?.avatar),
        level: Number(room.host?.level) || 1,
        vipTier: Number(room.host?.vipTier) || 0,
        isVerified: !!room.host?.isVerified,
      },
      seats: (room.seats || []).map((s: any) => ({
        seatIndex: Number(s.seatIndex),
        isMuted: !!s.isMuted,
        isHostMuted: !!s.isHostMuted,
        isSpeaking: !!s.isSpeaking,
        receivedCoins: Number(s.receivedCoins) || 0,
        user: s.user
          ? {
              id: s.user.id,
              uniqueId: s.user.uniqueId || s.user.id,
              displayName: s.user.displayName,
              avatar: sanitizeAvatarString(s.user.avatar),
              level: Number(s.user.level) || 1,
              vipTier: Number(s.user.vipTier) || 0,
              isVerified: !!s.user.isVerified,
            }
          : null,
      })),
      updatedAt: new Date().toISOString(),
    };

    await setDoc(doc(db, 'partyRooms', room.id), sanitizedRoom, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Real-time Listener for Party Rooms
 */
export function subscribeToPartyRooms(onUpdate: (rooms: any[]) => void) {
  const path = 'partyRooms';
  return onSnapshot(
    collection(db, 'partyRooms'),
    (snapshot) => {
      const list = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      onUpdate(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

/**
 * Atomically claim or release a party seat.
 * A user may occupy only one guest seat in a room. The host seat is never claimable.
 * Firestore transaction prevents two clients from successfully claiming the same seat.
 */
export async function updatePartyRoomSeat(
  roomId: string,
  seatIndex: number,
  user: any | null,
  currentUserId?: string
): Promise<{ success: boolean; seats?: any[]; reason?: string }> {
  const roomRef = doc(db, 'partyRooms', roomId);
  const effectiveUserId = user?.id || currentUserId || auth.currentUser?.uid || 'guest_user';
  try {
    return await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(roomRef);
      if (!snapshot.exists()) return { success: false, reason: 'ROOM_NOT_FOUND' };

      const room = snapshot.data() as any;
      const totalCapacity = room.level === 3 ? 15 : room.level === 1 ? 4 : 8;
      let seats = Array.isArray(room.seats) ? room.seats.map((seat: any) => ({ ...seat })) : [];

      // Ensure all seat slots exist up to max capacity
      while (seats.length < totalCapacity) {
        seats.push({
          seatIndex: seats.length,
          user: null,
          isMuted: false,
          isSpeaking: false,
          receivedCoins: 0,
        });
      }

      let target = seats.findIndex((seat: any) => Number(seat.seatIndex) === seatIndex);
      if (target < 0) {
        seats.push({
          seatIndex,
          user: null,
          isMuted: false,
          isSpeaking: false,
          receivedCoins: 0,
        });
        target = seats.length - 1;
      }

      const targetSeat = seats[target];

      if (!user) {
        // Leaving seat: clear any seat occupied by this user or this target seat
        seats = seats.map((s: any) => {
          if (s.seatIndex === seatIndex || (s.user && s.user.id === effectiveUserId)) {
            return { ...s, user: null, isSpeaking: false, isMuted: true };
          }
          return s;
        });
      } else {
        // Moving or taking seat: if seat is occupied by someone else, return error
        if (targetSeat.user && targetSeat.user.id !== user.id) {
          return { success: false, reason: 'SEAT_OCCUPIED' };
        }

        // Vacate previous seat occupied by this user
        seats = seats.map((s: any) => {
          if (s.user && s.user.id === user.id && s.seatIndex !== seatIndex) {
            return { ...s, user: null, isSpeaking: false, isMuted: true };
          }
          return s;
        });

        // Claim target seat
        seats[target] = {
          ...targetSeat,
          seatIndex,
          user: {
            id: user.id,
            uniqueId: user.uniqueId || user.id,
            displayName: user.displayName || user.username || 'User',
            avatar: sanitizeAvatarString(user.avatar),
            level: Number(user.level) || 1,
            vipTier: Number(user.vipTier) || 0,
            isVerified: !!user.isVerified,
          },
          isSpeaking: false,
          isMuted: false,
        };
      }

      transaction.update(roomRef, {
        seats,
        updatedAt: new Date().toISOString(),
      });
      return { success: true, seats };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `partyRooms/${roomId}/seats`);
    return { success: false, reason: 'FIRESTORE_ERROR' };
  }
}

// =========================================================================
// REAL-TIME LIVE STREAMS (SOLO & PK BROADCASTS)
// =========================================================================

/**
 * Sync active Live Stream to Firestore so all devices discover it in real time
 */
export async function syncLiveStreamToFirestore(stream: any) {
  if (!stream?.id) return;
  const path = `liveStreams/${stream.id}`;
  try {
    const sanitizedStream = {
      id: stream.id,
      title: (stream.title || 'Live Stream').slice(0, 100),
      category: stream.category || 'Live',
      tag: stream.tag || 'Live',
      viewerCount: Number(stream.viewerCount) || 1,
      thumbnail: sanitizeAvatarString(stream.thumbnail || stream.host?.avatar),
      coverImageUrl: typeof stream.coverImageUrl === 'string' && stream.coverImageUrl.startsWith('https://') ? stream.coverImageUrl : '',
      isPK: !!stream.isPK,
      isActive: true,
      durationMinutes: Number(stream.durationMinutes) || 0,
      host: {
        id: stream.host?.id || '',
        uniqueId: stream.host?.uniqueId || stream.host?.id || '',
        displayName: stream.host?.displayName || 'Host',
        username: stream.host?.username || '',
        avatar: sanitizeAvatarString(stream.host?.avatar),
        level: Number(stream.host?.level) || 1,
        vipTier: Number(stream.host?.vipTier) || 0,
        isVerified: !!stream.host?.isVerified,
      },
      updatedAt: new Date().toISOString(),
      createdAt: stream.createdAt || new Date().toISOString(),
    };

    await setDoc(doc(db, 'liveStreams', stream.id), sanitizedStream, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Remove Live Stream from Firestore when host finishes broadcast
 */
export async function deleteLiveStreamFromFirestore(streamId: string) {
  if (!streamId) return;
  const path = `liveStreams/${streamId}`;
  try {
    await deleteDoc(doc(db, 'liveStreams', streamId));
  } catch (error) {
    console.warn('Error deleting live stream from Firestore:', error);
  }
}

/**
 * Subscribe to real-time Live Streams list across all users/devices
 */
export function subscribeToLiveStreams(onUpdate: (streams: any[]) => void) {
  const path = 'liveStreams';
  return onSnapshot(
    collection(db, 'liveStreams'),
    (snapshot) => {
      const activeStreams = snapshot.docs
        .map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }))
        .filter((s: any) => s.isActive !== false);
      onUpdate(activeStreams);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

/**
 * Live Stream Comments Real-time Subscription
 */
export function subscribeToLiveStreamMessages(
  streamId: string,
  onUpdate: (msgs: any[]) => void
) {
  const messagesQuery = query(
    collection(db, 'liveStreams', streamId, 'messages'),
    orderBy('createdAt', 'asc'),
    limit(100)
  );
  return onSnapshot(
    messagesQuery,
    (snapshot) => {
      const list = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      }));
      onUpdate(list);
    },
    (error) => {
      console.warn('Live stream comments listener error:', error);
    }
  );
}

/**
 * Send comment to real-time Live Stream
 */
export async function sendLiveStreamMessage(streamId: string, message: any) {
  if (!streamId) return;
  try {
    await addDoc(collection(db, 'liveStreams', streamId, 'messages'), {
      ...message,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.warn('Failed to send live stream message:', error);
  }
}


