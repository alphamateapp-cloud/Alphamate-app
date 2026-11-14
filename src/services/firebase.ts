import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  reload,
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
  where,
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

export function isFirebaseUserVerified(fbUser: FirebaseUser | null | undefined): boolean {
  if (!fbUser) return false;
  const isGoogle = fbUser.providerData?.some((p) => p.providerId === 'google.com');
  return Boolean(fbUser.emailVerified || isGoogle);
}

/**
 * Sign In with Google Popup (with automatic Redirect fallback if popups are blocked)
 */
export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    const code = error?.code || '';
    if (
      code === 'auth/popup-blocked' ||
      code === 'auth/operation-not-supported-in-this-environment'
    ) {
      try {
        sessionStorage.setItem('alphamate_google_redirect_pending', '1');
      } catch {}
      await signInWithRedirect(auth, googleProvider);
      return null;
    }
    console.error('Google Sign-In Error:', error);
    throw error;
  }
}

/**
 * Resolve any pending Google redirect sign-in on boot
 */
export async function consumeGoogleRedirectResult(): Promise<FirebaseUser | null> {
  try {
    const result = await getRedirectResult(auth);
    try {
      sessionStorage.removeItem('alphamate_google_redirect_pending');
    } catch {}
    return result?.user || null;
  } catch (error) {
    try {
      sessionStorage.removeItem('alphamate_google_redirect_pending');
    } catch {}
    console.warn('Google Redirect Result Error:', error);
    return null;
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
 * Register with Email & Password and send verification email
 */
export async function registerWithEmail(email: string, pass: string) {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, pass);
    if (result.user && !result.user.emailVerified) {
      await sendEmailVerification(result.user).catch((err) => {
        console.warn('Could not send verification email:', err);
      });
    }
    return result.user;
  } catch (error: any) {
    console.error('Email Registration Error:', error);
    throw error;
  }
}

export async function resendVerificationEmail() {
  if (!auth.currentUser) {
    throw new Error('No active account found to verify.');
  }
  await sendEmailVerification(auth.currentUser);
}

export async function reloadCurrentFirebaseUser(): Promise<FirebaseUser | null> {
  if (!auth.currentUser) return null;
  await reload(auth.currentUser);
  return auth.currentUser;
}

export async function sendPasswordReset(email: string) {
  await sendPasswordResetEmail(auth, email.trim());
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

function stripUndefinedFields<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => stripUndefinedFields(item)) as unknown as T;
  }
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value as Record<string, any>)) {
      if (v !== undefined) {
        out[k] = stripUndefinedFields(v);
      }
    }
    return out as T;
  }
  return value;
}

/**
 * Save / Update User Profile in Firestore
 */
export async function syncUserProfileToFirestore(userData: any) {
  if (!userData?.id) return;
  const path = `users/${userData.id}`;
  try {
    const { password: _omitPassword, coverImage, ...restUser } = userData;
    const rawProfile: Record<string, any> = {
      ...restUser,
      usernameLower: String(userData.username || '').trim().toLowerCase(),
      displayNameLower: String(userData.displayName || '').trim().toLowerCase(),
      uniqueIdLower: String(userData.uniqueId || '').trim().toLowerCase(),
      avatar: sanitizeAvatarString(userData.avatar),
      updatedAt: new Date().toISOString(),
    };

    // Prevent oversized base64 cover images (>80KB) or undefined values from breaking setDoc
    if (typeof coverImage === 'string' && coverImage.length > 0 && coverImage.length <= 80000) {
      rawProfile.coverImage = coverImage;
    }

    const sanitizedProfile = stripUndefinedFields(rawProfile);
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
      isActive: room.isActive !== false,
      roomStatus: room.isActive !== false ? 'ready' : 'ended',
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
        isLocked: !!s.isLocked,
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
      lastSeenAtMs: Date.now(),
      updatedAt: new Date().toISOString(),
    };

    await setDoc(doc(db, 'partyRooms', room.id), stripUndefinedFields(sanitizedRoom), { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    // Do not swallow persistence failures: callers must not open a room locally
    // when the room was never committed for discovery by other devices.
    throw error;
  }
}

/**
 * Update specific Party Room fields (moderation, seat mute/lock, metadata)
 */
export async function updatePartyRoomFields(roomId: string, fields: Record<string, any>) {
  if (!roomId) return;
  const path = `partyRooms/${roomId}`;
  try {
    await updateDoc(doc(db, 'partyRooms', roomId), stripUndefinedFields({
      ...fields,
      updatedAt: new Date().toISOString(),
    }));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Permanently delete Party Room from Firestore when host chooses Close Room
 */
export async function deletePartyRoomFromFirestore(roomId: string) {
  if (!roomId) return;
  try {
    await updateDoc(doc(db, 'partyRooms', roomId), {
      isActive: false,
      endedAt: new Date().toISOString(),
    }).catch(() => {});
    await deleteDoc(doc(db, 'partyRooms', roomId));
  } catch (error) {
    console.warn('Error deleting party room from Firestore:', error);
  }
}

/**
 * Real-time Listener for Party Rooms
 */
export function subscribeToPartyRooms(onUpdate: (rooms: any[]) => void) {
  const path = 'partyRooms';
  const activeRoomsQuery = query(
    collection(db, 'partyRooms'),
    where('isActive', '==', true)
  );
  return onSnapshot(
    activeRoomsQuery,
    (snapshot) => {
      const list = snapshot.docs
        .map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }))
        .filter((r: any) => r.isActive === true);
      onUpdate(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
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
  currentUserId?: string,
  initialMuted: boolean = false
): Promise<{ success: boolean; seats?: any[]; reason?: string }> {
  const roomRef = doc(db, 'partyRooms', roomId);
  const effectiveUserId = user?.id || currentUserId || auth.currentUser?.uid || 'guest_user';
  try {
    return await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(roomRef);
      if (!snapshot.exists()) return { success: false, reason: 'ROOM_NOT_FOUND' };

      const room = snapshot.data() as any;
      if (room.isActive === false) return { success: false, reason: 'ROOM_CLOSED' };
      const kickedIds = Array.isArray(room.kickedUserIds) ? room.kickedUserIds : [];
      const blockedIds = Array.isArray(room.blockedUserIds) ? room.blockedUserIds : [];
      if (user && (kickedIds.includes(effectiveUserId) || blockedIds.includes(effectiveUserId))) {
        return { success: false, reason: 'USER_RESTRICTED' };
      }

      const totalCapacity = room.level === 3 ? 15 : room.level === 1 ? 4 : 8;
      let seats = Array.isArray(room.seats) ? room.seats.map((seat: any) => ({ ...seat })) : [];

      while (seats.length < totalCapacity) {
        seats.push({
          seatIndex: seats.length,
          user: null,
          isMuted: false,
          isHostMuted: false,
          isLocked: false,
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
          isHostMuted: false,
          isLocked: false,
          isSpeaking: false,
          receivedCoins: 0,
        });
        target = seats.length - 1;
      }

      const targetSeat = seats[target];

      if (!user) {
        // Leaving seat: clear any seat occupied by this user or this target seat
        seats = seats.map((s: any) => {
          if (Number(s.seatIndex) === seatIndex || (s.user && s.user.id === effectiveUserId)) {
            return { ...s, user: null, isSpeaking: false, isMuted: false, isHostMuted: false };
          }
          return s;
        });
      } else {
        if (targetSeat.isLocked) {
          return { success: false, reason: 'SEAT_LOCKED' };
        }
        if (targetSeat.user && targetSeat.user.id !== user.id) {
          return { success: false, reason: 'SEAT_OCCUPIED' };
        }

        // Vacate previous seat occupied by this user
        seats = seats.map((s: any) => {
          if (s.user && s.user.id === user.id && Number(s.seatIndex) !== seatIndex) {
            return { ...s, user: null, isSpeaking: false, isMuted: false, isHostMuted: false };
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
          isMuted: Boolean(initialMuted || targetSeat.isHostMuted),
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

/**
 * Toggle lock state on a specific guest seat (Host / Moderator action)
 */
export async function togglePartySeatLockInFirestore(
  roomId: string,
  seatIndex: number,
  isLocked: boolean
): Promise<{ success: boolean; seats?: any[] }> {
  const roomRef = doc(db, 'partyRooms', roomId);
  try {
    return await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(roomRef);
      if (!snapshot.exists()) return { success: false };
      const room = snapshot.data() as any;
      const seats = Array.isArray(room.seats) ? room.seats.map((s: any) => ({ ...s })) : [];
      const target = seats.findIndex((s: any) => Number(s.seatIndex) === seatIndex);
      if (target < 0) return { success: false };
      seats[target] = {
        ...seats[target],
        isLocked,
        ...(isLocked ? { user: null, isSpeaking: false, isMuted: false, isHostMuted: false } : {}),
      };
      transaction.update(roomRef, { seats, updatedAt: new Date().toISOString() });
      return { success: true, seats };
    });
  } catch (error) {
    console.warn('Failed to toggle seat lock:', error);
    return { success: false };
  }
}

// =========================================================================
// REAL-TIME LIVE STREAMS (SOLO & PK BROADCASTS)
// =========================================================================

export const LIVE_STREAM_STALE_MS = 30_000;

/**
 * Sync active Live Stream to Firestore ONLY with verified SFU session metadata
 */
export async function syncLiveStreamToFirestore(stream: any) {
  if (!stream?.id) return;
  const path = `liveStreams/${stream.id}`;
  try {
    const nowMs = Date.now();
    const sanitizedStream = {
      id: stream.id,
      title: (stream.title || 'Live Stream').slice(0, 100),
      category: stream.category || 'Live',
      tag: stream.tag || 'Live',
      viewerCount: Number(stream.viewerCount) || 1,
      thumbnail: sanitizeAvatarString(stream.thumbnail || stream.host?.avatar),
      coverImageUrl: typeof stream.coverImageUrl === 'string' && stream.coverImageUrl.startsWith('https://') ? stream.coverImageUrl : '',
      isPK: !!stream.isPK,
      isActive: stream.isActive !== false && Boolean(stream.sfuSessionId),
      sfuSessionId: typeof stream.sfuSessionId === 'string' ? stream.sfuSessionId : '',
      publishedTracks: Array.isArray(stream.publishedTracks)
        ? stream.publishedTracks.map((t: any) => ({
            trackName: String(t.trackName || ''),
            mid: t.mid ? String(t.mid) : '',
            kind: t.kind === 'audio' ? 'audio' : 'video',
          }))
        : [],
      isVideoOn: stream.isVideoOn !== false,
      isMicOn: stream.isMicOn !== false,
      durationMinutes: Number(stream.durationMinutes) || 0,
      moderatorIds: Array.isArray(stream.moderatorIds) ? stream.moderatorIds.slice(0, 10) : [],
      kickedUserIds: Array.isArray(stream.kickedUserIds) ? stream.kickedUserIds.slice(0, 100) : [],
      blockedUserIds: Array.isArray(stream.blockedUserIds) ? stream.blockedUserIds.slice(0, 100) : [],
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
      lastHeartbeat: serverTimestamp(),
      lastHeartbeatMs: stream.lastHeartbeatMs || nowMs,
      lastSeenAt: serverTimestamp(),
      lastSeenAtMs: stream.lastSeenAtMs || nowMs,
      updatedAt: new Date(nowMs).toISOString(),
      createdAt: stream.createdAt || new Date(nowMs).toISOString(),
    };

    await setDoc(doc(db, 'liveStreams', stream.id), stripUndefinedFields(sanitizedStream), { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    // A Live card is discoverable only after its Firestore record is committed.
    throw error;
  }
}

/**
 * Update Live Stream fields (camera/mic state, moderation, viewerCount)
 */
export async function updateLiveStreamFields(streamId: string, fields: Record<string, any>) {
  if (!streamId) return;
  try {
    await updateDoc(doc(db, 'liveStreams', streamId), stripUndefinedFields({
      ...fields,
      updatedAt: new Date().toISOString(),
    }));
  } catch (error) {
    console.warn('Failed to update live stream fields:', error);
  }
}

/**
 * Heartbeat update so stale/crashed streams do not leave ghost cards
 */
export async function updateLiveStreamHeartbeat(streamId: string) {
  if (!streamId) return;
  const path = `liveStreams/${streamId}`;
  try {
    const nowMs = Date.now();
    await updateDoc(doc(db, 'liveStreams', streamId), {
      lastHeartbeat: serverTimestamp(),
      lastHeartbeatMs: nowMs,
      lastSeenAt: serverTimestamp(),
      lastSeenAtMs: nowMs,
      updatedAt: new Date(nowMs).toISOString(),
    });
  } catch (error: any) {
    if (error?.code === 'not-found') return;
    if (error?.code === 'permission-denied') {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
    console.warn('Failed to send live stream heartbeat:', error);
  }
}

/**
 * Remove Live Stream from Firestore when host finishes broadcast
 */
export async function deleteLiveStreamFromFirestore(streamId: string) {
  if (!streamId) return;
  try {
    // Notify all active viewers immediately
    await updateDoc(doc(db, 'liveStreams', streamId), {
      isActive: false,
      endedAt: new Date().toISOString(),
    }).catch(() => {});
    // Delete document from active collection
    await deleteDoc(doc(db, 'liveStreams', streamId));
  } catch (error) {
    console.warn('Error deleting live stream from Firestore:', error);
  }
}

/**
 * Subscribe to real-time Live Streams list across all users/devices.
 * Strictly exposes only active broadcasts that have a published SFU session and fresh heartbeat.
 */
export function subscribeToLiveStreams(onUpdate: (streams: any[]) => void) {
  const path = 'liveStreams';
  const activeStreamsQuery = query(
    collection(db, 'liveStreams'),
    where('isActive', '==', true)
  );
  return onSnapshot(
    activeStreamsQuery,
    (snapshot) => {
      const now = Date.now();
      const activeStreams = snapshot.docs
        .map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }))
        .filter((s: any) => {
          if (s.isActive !== true) return false;
          if (!s.sfuSessionId || typeof s.sfuSessionId !== 'string') return false;
          const heartbeatMs =
            typeof s.lastHeartbeat?.toMillis === 'function'
              ? s.lastHeartbeat.toMillis()
              : typeof s.lastHeartbeatMs === 'number'
                ? s.lastHeartbeatMs
                : typeof s.lastSeenAt?.toMillis === 'function'
                  ? s.lastSeenAt.toMillis()
                  : s.lastSeenAtMs;
          if (typeof heartbeatMs === 'number' && now - heartbeatMs > LIVE_STREAM_STALE_MS) {
            return false;
          }
          return true;
        });
      onUpdate(activeStreams);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
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


