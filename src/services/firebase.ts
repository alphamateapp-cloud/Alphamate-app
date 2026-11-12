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
  hostId?: string
): Promise<{ success: boolean; seats?: any[]; reason?: string }> {
  const roomRef = doc(db, 'partyRooms', roomId);
  try {
    return await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(roomRef);
      if (!snapshot.exists()) return { success: false, reason: 'ROOM_NOT_FOUND' };

      const room = snapshot.data() as any;
      const seats = Array.isArray(room.seats) ? room.seats.map((seat: any) => ({ ...seat })) : [];
      const target = seats.findIndex((seat: any) => Number(seat.seatIndex) === seatIndex);
      if (target < 0) return { success: false, reason: 'SEAT_NOT_FOUND' };

      const targetSeat = seats[target];
      if (hostId && room.host?.id === user?.id) {
        return { success: false, reason: 'HOST_CANNOT_TAKE_GUEST_SEAT' };
      }

      if (!user) {
        // Release only the seat owned by this user (never clear another member).
        const owned = seats.findIndex((seat: any) => seat.user?.id === hostId);
        if (owned < 0) return { success: true, seats };
        seats[owned] = { ...seats[owned], user: null, isSpeaking: false, isMuted: true };
      } else {
        if (targetSeat.user && targetSeat.user.id !== user.id) {
          return { success: false, reason: 'SEAT_OCCUPIED' };
        }
        const previous = seats.findIndex((seat: any) => seat.user?.id === user.id);
        if (previous >= 0 && previous !== target) {
          seats[previous] = { ...seats[previous], user: null, isSpeaking: false, isMuted: true };
        }
        seats[target] = {
          ...targetSeat,
          user: {
            id: user.id,
            uniqueId: user.uniqueId || user.id,
            displayName: user.displayName || user.username || 'Guest',
            avatar: sanitizeAvatarString(user.avatar),
            level: Number(user.level) || 1,
            vipTier: Number(user.vipTier) || 0,
            isVerified: !!user.isVerified,
          },
          isSpeaking: false,
          isMuted: true,
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

