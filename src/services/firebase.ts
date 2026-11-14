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
  enableNetwork,
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
  writeBatch,
  getDocs,
  increment,
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
async function withFirestoreTimeout<T>(promise: Promise<T>, timeoutMs: number = 9000, label: string = 'Firestore operation'): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${Math.round(timeoutMs / 1000)}s. Please check your internet connection.`));
    }, timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

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

    await withFirestoreTimeout(
      setDoc(doc(db, 'partyRooms', room.id), stripUndefinedFields(sanitizedRoom), { merge: true }),
      9000,
      'Party Room sync'
    );
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

export const LIVE_STREAM_STALE_MS = 65_000;

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

    await withFirestoreTimeout(
      setDoc(doc(db, 'liveStreams', stream.id), stripUndefinedFields(sanitizedStream), { merge: true }),
      9000,
      'Live Stream sync'
    );
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

export async function joinLiveStreamViewer(streamId: string, viewer: any) {
  if (!streamId || !auth.currentUser?.uid) return;
  const uid = auth.currentUser.uid;
  const path = `liveStreams/${streamId}/viewers/${uid}`;
  try {
    const nowMs = Date.now();
    await setDoc(
      doc(db, 'liveStreams', streamId, 'viewers', uid),
      stripUndefinedFields({
        id: uid,
        uniqueId: viewer?.uniqueId || uid,
        username: viewer?.username || viewer?.displayName || 'viewer',
        displayName: viewer?.displayName || 'Viewer',
        avatar: sanitizeAvatarString(viewer?.avatar),
        level: Number(viewer?.level) || 1,
        vipTier: Number(viewer?.vipTier) || 0,
        countryFlag: viewer?.countryFlag,
        isVerified: !!viewer?.isVerified,
        isHost: !!viewer?.isHost,
        joinedAtMs: viewer?.joinedAtMs || nowMs,
        lastSeenAt: serverTimestamp(),
        lastSeenAtMs: nowMs,
      }),
      { merge: true }
    );
  } catch (error: any) {
    if (error?.code === 'permission-denied') {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }
}

export async function leaveLiveStreamViewer(streamId: string, userId?: string) {
  const uid = userId || auth.currentUser?.uid;
  if (!streamId || !uid) return;
  try {
    await deleteDoc(doc(db, 'liveStreams', streamId, 'viewers', uid));
  } catch {
    // ignore cleanup errors
  }
}

export function subscribeToLiveStreamViewers(
  streamId: string,
  onUpdate: (viewers: any[]) => void
) {
  if (!streamId) return () => {};
  const viewersRef = collection(db, 'liveStreams', streamId, 'viewers');
  return onSnapshot(
    viewersRef,
    (snapshot) => {
      const now = Date.now();
      const active = snapshot.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) }))
        .filter((v) => {
          const seenMs =
            typeof v.lastSeenAt?.toMillis === 'function'
              ? v.lastSeenAt.toMillis()
              : typeof v.lastSeenAtMs === 'number'
                ? v.lastSeenAtMs
                : now;
          return now - seenMs <= 75_000;
        });
      onUpdate(active);
    },
    (error) => {
      console.warn('Live viewers subscription warning:', error);
    }
  );
}

// =========================================================================
// ACCOUNT DEACTIVATION, 15-DAY PERMANENT DELETION & RECOVERY HELPERS
// =========================================================================

export const FIFTEEN_DAYS_MS = 15 * 24 * 60 * 60 * 1000;

function sanitizeDeletionReason(reason?: string): string {
  return String(reason || '').trim().slice(0, 500);
}

/**
 * Temporarily deactivate user account (never deleted, unlimited recovery window).
 */
export async function submitAccountDeactivationFirestore(
  user: {
    id: string;
    uniqueId?: string;
    username?: string;
    displayName?: string;
    email?: string;
    avatar?: string;
  },
  reason?: string
): Promise<{ deactivatedAt: string }> {
  const uid = auth.currentUser?.uid || user.id;
  if (!uid) throw new Error('Authenticated user required to deactivate account.');

  const nowIso = new Date().toISOString();
  const cleanReason = sanitizeDeletionReason(reason);
  const userPath = `users/${uid}`;
  const reqPath = `accountDeletionRequests/${uid}`;

  try {
    await setDoc(
      doc(db, 'users', uid),
      stripUndefinedFields({
        accountStatus: 'deactivated',
        deactivatedAt: nowIso,
        deletionRequestedAt: null,
        scheduledPermanentDeletionAt: null,
        deletionOtpVerifiedAt: null,
        deletionReason: cleanReason,
        updatedAt: nowIso,
      }),
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }

  try {
    const reqDoc = stripUndefinedFields({
      uid,
      uniqueId: String(user.uniqueId || uid).slice(0, 64),
      username: String(user.username || 'user').slice(0, 64),
      displayName: String(user.displayName || 'Alpha Mate User').slice(0, 128),
      email: String(auth.currentUser?.email || user.email || '').toLowerCase().slice(0, 128),
      avatar: sanitizeAvatarString(user.avatar),
      type: 'deactivation',
      status: 'deactivated',
      otpVerified: false,
      requestedAt: nowIso,
      reason: cleanReason,
      updatedAt: nowIso,
    });
    await setDoc(doc(db, 'accountDeletionRequests', uid), reqDoc);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, reqPath);
  }

  return { deactivatedAt: nowIso };
}

/**
 * Submit OTP-verified Permanent Account Deletion request into Official 15-Day Pending Queue.
 */
export async function submitPermanentDeletionRequestFirestore(
  user: {
    id: string;
    uniqueId?: string;
    username?: string;
    displayName?: string;
    email?: string;
    avatar?: string;
  },
  otpVerifiedAt: string,
  reason?: string
): Promise<{ requestedAt: string; scheduledPermanentDeletionAt: string }> {
  const uid = auth.currentUser?.uid || user.id;
  if (!uid) throw new Error('Authenticated user required to request permanent account deletion.');
  if (!otpVerifiedAt) throw new Error('Email OTP verification is required before requesting permanent deletion.');

  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const scheduledIso = new Date(nowMs + FIFTEEN_DAYS_MS).toISOString();
  const cleanReason = sanitizeDeletionReason(reason);
  const userPath = `users/${uid}`;
  const reqPath = `accountDeletionRequests/${uid}`;

  try {
    await setDoc(
      doc(db, 'users', uid),
      stripUndefinedFields({
        accountStatus: 'pending_deletion',
        deletionRequestedAt: nowIso,
        scheduledPermanentDeletionAt: scheduledIso,
        deletionOtpVerifiedAt: otpVerifiedAt,
        deletionReason: cleanReason,
        updatedAt: nowIso,
      }),
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }

  try {
    const reqDoc = stripUndefinedFields({
      uid,
      uniqueId: String(user.uniqueId || uid).slice(0, 64),
      username: String(user.username || 'user').slice(0, 64),
      displayName: String(user.displayName || 'Alpha Mate User').slice(0, 128),
      email: String(auth.currentUser?.email || user.email || '').toLowerCase().slice(0, 128),
      avatar: sanitizeAvatarString(user.avatar),
      type: 'permanent_delete',
      status: 'pending_official_deletion',
      otpVerified: true,
      otpVerifiedAt,
      requestedAt: nowIso,
      scheduledPermanentDeletionAt: scheduledIso,
      reason: cleanReason,
      updatedAt: nowIso,
    });
    await setDoc(doc(db, 'accountDeletionRequests', uid), reqDoc);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, reqPath);
  }

  return {
    requestedAt: nowIso,
    scheduledPermanentDeletionAt: scheduledIso,
  };
}

/**
 * Fetch a user's current deactivation/deletion request document.
 */
export async function getAccountDeletionRequestFirestore(uid: string) {
  if (!uid) return null;
  const path = `accountDeletionRequests/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'accountDeletionRequests', uid));
    return snap.exists() ? snap.data() : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

/**
 * Recover a deactivated account (any time) or a pending permanent deletion account (within 15 days).
 */
export async function recoverAccountLifecycleFirestore(user: {
  id: string;
  uniqueId?: string | null;
  username?: string | null;
  displayName?: string | null;
  email?: string | null;
  avatar?: string | null;
  accountStatus?: string | null;
  deletionRequestedAt?: string | null;
  scheduledPermanentDeletionAt?: string | null;
}): Promise<{ reactivatedAt: string }> {
  const uid = auth.currentUser?.uid || user.id;
  if (!uid) throw new Error('Authenticated user required to recover account.');

  const existingReq = await getAccountDeletionRequestFirestore(uid).catch(() => null);
  const scheduledIso = existingReq?.scheduledPermanentDeletionAt || user.scheduledPermanentDeletionAt;
  const effectiveStatus = existingReq?.status || user.accountStatus;

  if (effectiveStatus === 'permanently_deleted') {
    throw new Error('This account has already been permanently deleted and can no longer be recovered.');
  }

  if (
    (effectiveStatus === 'pending_official_deletion' || user.accountStatus === 'pending_deletion') &&
    scheduledIso
  ) {
    const deadlineMs = Date.parse(scheduledIso);
    if (Number.isFinite(deadlineMs) && Date.now() >= deadlineMs) {
      throw new Error(
        'The 15-day recovery window has expired. This account is queued for final permanent removal and cannot be recovered.'
      );
    }
  }

  const nowIso = new Date().toISOString();
  const userPath = `users/${uid}`;
  const reqPath = `accountDeletionRequests/${uid}`;

  try {
    await setDoc(
      doc(db, 'users', uid),
      stripUndefinedFields({
        accountStatus: 'active',
        reactivatedAt: nowIso,
        deactivatedAt: null,
        deletionRequestedAt: null,
        scheduledPermanentDeletionAt: null,
        deletionOtpVerifiedAt: null,
        updatedAt: nowIso,
      }),
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }

  try {
    const reqDoc = stripUndefinedFields({
      uid,
      uniqueId: String(existingReq?.uniqueId || user.uniqueId || uid).slice(0, 64),
      username: String(existingReq?.username || user.username || 'user').slice(0, 64),
      displayName: String(existingReq?.displayName || user.displayName || 'Alpha Mate User').slice(0, 128),
      email: String(existingReq?.email || auth.currentUser?.email || user.email || '').toLowerCase().slice(0, 128),
      avatar: sanitizeAvatarString(existingReq?.avatar || user.avatar),
      type: existingReq?.type === 'permanent_delete' ? 'permanent_delete' : 'deactivation',
      status: 'recovered',
      otpVerified: Boolean(existingReq?.otpVerified),
      ...(existingReq?.otpVerifiedAt ? { otpVerifiedAt: existingReq.otpVerifiedAt } : {}),
      requestedAt: existingReq?.requestedAt || user.deletionRequestedAt || nowIso,
      recoveredAt: nowIso,
      processedBy: 'user_self_recovery',
      updatedAt: nowIso,
    });
    await setDoc(doc(db, 'accountDeletionRequests', uid), reqDoc);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, reqPath);
  }

  return { reactivatedAt: nowIso };
}

/**
 * Real-time subscription for Official Admin Dashboard deletion queue.
 */
export function subscribeToAccountDeletionRequests(onUpdate: (items: any[]) => void) {
  const path = 'accountDeletionRequests';
  const q = query(collection(db, 'accountDeletionRequests'), orderBy('updatedAt', 'desc'), limit(200));
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      onUpdate(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

/**
 * Official Admin action: restore a user account or mark an expired request as permanently deleted.
 */
export async function adminProcessAccountDeletionRequest(
  reqItem: {
    uid: string;
    uniqueId?: string | null;
    username?: string | null;
    displayName: string;
    email: string;
    avatar?: string | null;
    type: 'deactivation' | 'permanent_delete';
    otpVerified?: boolean | null;
    otpVerifiedAt?: string | null;
    requestedAt: string;
    scheduledPermanentDeletionAt?: string | null;
  },
  action: 'restore' | 'finalize'
): Promise<void> {
  const uid = reqItem.uid;
  const nowIso = new Date().toISOString();
  const adminEmail = auth.currentUser?.email || 'official_admin';

  if (action === 'restore') {
    await setDoc(
      doc(db, 'users', uid),
      stripUndefinedFields({
        accountStatus: 'active',
        reactivatedAt: nowIso,
        deactivatedAt: null,
        deletionRequestedAt: null,
        scheduledPermanentDeletionAt: null,
        deletionOtpVerifiedAt: null,
        updatedAt: nowIso,
      }),
      { merge: true }
    );
    await setDoc(
      doc(db, 'accountDeletionRequests', uid),
      stripUndefinedFields({
        uid,
        uniqueId: reqItem.uniqueId || uid,
        username: reqItem.username || 'user',
        displayName: String(reqItem.displayName || 'Alpha Mate User').slice(0, 128),
        email: String(reqItem.email || '').toLowerCase().slice(0, 128),
        avatar: sanitizeAvatarString(reqItem.avatar || undefined),
        type: reqItem.type,
        status: 'recovered',
        otpVerified: Boolean(reqItem.otpVerified),
        ...(reqItem.otpVerifiedAt ? { otpVerifiedAt: reqItem.otpVerifiedAt } : {}),
        requestedAt: reqItem.requestedAt || nowIso,
        recoveredAt: nowIso,
        processedBy: adminEmail,
        updatedAt: nowIso,
      })
    );
    return;
  }

  await setDoc(
    doc(db, 'users', uid),
    stripUndefinedFields({
      accountStatus: 'permanently_deleted',
      updatedAt: nowIso,
    }),
    { merge: true }
  );
  await setDoc(
    doc(db, 'accountDeletionRequests', uid),
    stripUndefinedFields({
      uid,
      uniqueId: reqItem.uniqueId || uid,
      username: reqItem.username || 'user',
      displayName: String(reqItem.displayName || 'Alpha Mate User').slice(0, 128),
      email: String(reqItem.email || '').toLowerCase().slice(0, 128),
      avatar: sanitizeAvatarString(reqItem.avatar || undefined),
      type: 'permanent_delete',
      status: 'permanently_deleted',
      otpVerified: Boolean(reqItem.otpVerified),
      ...(reqItem.otpVerifiedAt ? { otpVerifiedAt: reqItem.otpVerifiedAt } : {}),
      requestedAt: reqItem.requestedAt || nowIso,
      ...(reqItem.scheduledPermanentDeletionAt
        ? { scheduledPermanentDeletionAt: reqItem.scheduledPermanentDeletionAt }
        : {}),
      permanentlyDeletedAt: nowIso,
      processedBy: adminEmail,
      updatedAt: nowIso,
    })
  );
}

// =========================================================================
// REAL-TIME USER NOTIFICATIONS & PREFERENCES
// =========================================================================

const FIRESTORE_VALID_ID_RE = /^[a-zA-Z0-9_-]{1,128}$/;

function formatNotificationTimestamp(ms?: number): string {
  if (!ms || !Number.isFinite(ms)) return 'Just now';
  const diff = Date.now() - ms;
  if (diff < 60_000) return 'Just now';
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(ms).toLocaleDateString();
}

export async function updateUserNotificationPreferencesFirestore(
  userId: string,
  preferences: { enabled: boolean; categories: Record<string, boolean>; updatedAt?: string }
): Promise<void> {
  if (!userId || !FIRESTORE_VALID_ID_RE.test(userId)) return;
  const path = `users/${userId}`;
  try {
    await setDoc(
      doc(db, 'users', userId),
      {
        notificationPreferences: {
          enabled: Boolean(preferences.enabled),
          categories: { ...preferences.categories },
          updatedAt: preferences.updatedAt || new Date().toISOString(),
        },
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export interface SendNotificationParams {
  recipientId: string;
  type:
    | 'live_on'
    | 'live_invite'
    | 'party_invite'
    | 'friend_request'
    | 'follow'
    | 'gift'
    | 'comment'
    | 'message'
    | 'like'
    | 'pk_invite'
    | 'wallet'
    | 'agency'
    | 'system';
  category?: string;
  title: string;
  message: string;
  senderName?: string;
  senderAvatar?: string;
  screen?: string;
  tab?: string;
  roomId?: string;
  streamId?: string;
  reelId?: string;
  chatId?: string;
}

export async function sendFirestoreNotification(
  params: SendNotificationParams
): Promise<string | null> {
  const senderUid = auth.currentUser?.uid;
  const recipientId = String(params.recipientId || '').trim();
  if (!senderUid || !recipientId || !FIRESTORE_VALID_ID_RE.test(recipientId)) {
    return null;
  }

  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const notifId = `n_${nowMs}_${Math.random().toString(36).slice(2, 8)}`;
  const path = `users/${recipientId}/notifications/${notifId}`;

  const payload = stripUndefinedFields({
    recipientId,
    senderId: senderUid,
    senderName: String(params.senderName || auth.currentUser?.displayName || 'Alpha Mate User').slice(0, 128),
    senderAvatar: sanitizeAvatarString(params.senderAvatar || auth.currentUser?.photoURL || undefined),
    type: params.type,
    category: params.category || undefined,
    title: String(params.title || 'Alpha Mate').slice(0, 160),
    message: String(params.message || '').slice(0, 600),
    screen: params.screen ? String(params.screen).slice(0, 64) : undefined,
    tab: params.tab ? String(params.tab).slice(0, 64) : undefined,
    roomId: params.roomId ? String(params.roomId).slice(0, 128) : undefined,
    streamId: params.streamId ? String(params.streamId).slice(0, 128) : undefined,
    reelId: params.reelId ? String(params.reelId).slice(0, 128) : undefined,
    chatId: params.chatId ? String(params.chatId).slice(0, 128) : undefined,
    isRead: false,
    createdAt: nowIso,
    createdAtMs: nowMs,
  });

  try {
    await setDoc(doc(db, 'users', recipientId, 'notifications', notifId), payload);
    return notifId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function subscribeToUserNotifications(
  userId: string,
  onUpdate: (items: any[]) => void
) {
  const path = `users/${userId}/notifications`;
  const q = query(
    collection(db, 'users', userId, 'notifications'),
    orderBy('createdAtMs', 'desc'),
    limit(100)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs.map((docSnap) => {
        const d = docSnap.data() as Record<string, any>;
        return {
          id: docSnap.id,
          type: d.type || 'system',
          category: d.category,
          title: d.title || 'Alpha Mate',
          message: d.message || '',
          senderId: d.senderId,
          senderName: d.senderName,
          senderAvatar: d.senderAvatar,
          recipientId: d.recipientId,
          screen: d.screen,
          tab: d.tab,
          roomId: d.roomId,
          streamId: d.streamId,
          reelId: d.reelId,
          chatId: d.chatId,
          isRead: Boolean(d.isRead),
          createdAtMs: Number(d.createdAtMs) || Date.now(),
          timestamp: formatNotificationTimestamp(Number(d.createdAtMs)),
          user: d.senderId
            ? {
                id: d.senderId,
                displayName: d.senderName || 'Alpha Mate User',
                avatar: d.senderAvatar || '',
              }
            : undefined,
        };
      });
      onUpdate(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function markFirestoreNotificationRead(
  userId: string,
  notificationId: string
): Promise<void> {
  if (!userId || !notificationId) return;
  const path = `users/${userId}/notifications/${notificationId}`;
  try {
    await updateDoc(doc(db, 'users', userId, 'notifications', notificationId), {
      isRead: true,
      readAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function markAllFirestoreNotificationsRead(
  userId: string,
  notificationIds: string[]
): Promise<void> {
  if (!userId || notificationIds.length === 0) return;
  const readAt = new Date().toISOString();
  const batch = writeBatch(db);
  notificationIds.slice(0, 100).forEach((id) => {
    if (FIRESTORE_VALID_ID_RE.test(id)) {
      batch.update(doc(db, 'users', userId, 'notifications', id), {
        isRead: true,
        readAt,
      });
    }
  });
  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${userId}/notifications`);
  }
}

export async function fetchBroadcastRecipientIds(
  excludeUid: string,
  maxUsers: number = 30
): Promise<string[]> {
  if (!auth.currentUser?.uid) return [];
  try {
    const snap = await getDocs(query(collection(db, 'users'), limit(maxUsers + 5)));
    return snap.docs
      .map((d) => d.id)
      .filter((id) => id !== excludeUid && FIRESTORE_VALID_ID_RE.test(id))
      .slice(0, maxUsers);
  } catch (err) {
    console.warn('Could not query broadcast notification recipients:', err);
    return [];
  }
}

// =========================================================================
// 60/40 GIFTING ECONOMY (60% HOST DIAMONDS + 40% APP REVENUE SHARE)
// =========================================================================

export interface SixtyFortyGiftInput {
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  recipientId: string;
  recipientName: string;
  giftId: string;
  giftName: string;
  giftIcon: string;
  unitCoins: number;
  quantity: number;
  context: 'live' | 'party' | 'moments' | 'pk' | 'demo';
  roomId?: string;
  streamId?: string;
  reelId?: string;
}

export interface SixtyFortyGiftResult {
  txId: string;
  totalCoins: number;
  hostDiamonds: number;
  appShareCoins: number;
  creditedHostFirestore: boolean;
  senderNextCoins?: number;
  senderNextDiamonds?: number;
}

export async function executeSixtyFortyGiftTransaction(
  input: SixtyFortyGiftInput
): Promise<SixtyFortyGiftResult> {
  const qty = Math.max(1, Math.floor(Number(input.quantity) || 1));
  const unitCoins = Math.max(1, Math.floor(Number(input.unitCoins) || 1));
  const totalCoins = unitCoins * qty;
  const hostDiamonds = Math.round(totalCoins * 0.6);
  const appShareCoins = totalCoins - hostDiamonds;

  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const txId = `gift_${nowMs}_${Math.random().toString(36).slice(2, 8)}`;

  const authUid = auth.currentUser?.uid;
  if (!authUid) {
    return {
      txId,
      totalCoins,
      hostDiamonds,
      appShareCoins,
      creditedHostFirestore: false,
    };
  }

  const recipientId = String(input.recipientId || authUid).trim();
  const isSelfRecipient = recipientId === authUid;
  const canQueryRecipientDoc = FIRESTORE_VALID_ID_RE.test(recipientId);

  let creditedHostFirestore = false;
  let senderNextCoins: number | undefined;
  let senderNextDiamonds: number | undefined;

  try {
    await runTransaction(db, async (transaction) => {
      const senderRef = doc(db, 'users', authUid);
      const senderSnap = await transaction.get(senderRef);

      let recipientSnap: any = null;
      const recipientRef = canQueryRecipientDoc && !isSelfRecipient ? doc(db, 'users', recipientId) : null;
      if (recipientRef) {
        recipientSnap = await transaction.get(recipientRef);
      }

      if (senderSnap.exists()) {
        const senderData = senderSnap.data() as Record<string, any>;
        const currentCoins = Number(senderData.coins ?? 0);
        const currentDiamonds = Number(senderData.diamonds ?? 0);
        senderNextCoins = Math.max(0, currentCoins - totalCoins);

        if (isSelfRecipient) {
          senderNextDiamonds = currentDiamonds + hostDiamonds;
          transaction.update(senderRef, {
            coins: senderNextCoins,
            diamonds: senderNextDiamonds,
            updatedAt: nowIso,
          });
          creditedHostFirestore = true;
        } else {
          transaction.update(senderRef, {
            coins: senderNextCoins,
            updatedAt: nowIso,
          });
        }
      }

      if (recipientRef && recipientSnap && recipientSnap.exists()) {
        const rData = recipientSnap.data() as Record<string, any>;
        const currentRecipientDiamonds = Number(rData.diamonds ?? 0);
        transaction.update(recipientRef, {
          diamonds: currentRecipientDiamonds + hostDiamonds,
          updatedAt: nowIso,
        });
        creditedHostFirestore = true;
      }

      const ledgerPayload = stripUndefinedFields({
        senderId: authUid,
        senderName: String(input.senderName || 'Alpha Mate User').slice(0, 128),
        recipientId: canQueryRecipientDoc ? recipientId : authUid,
        recipientName: String(input.recipientName || 'Host').slice(0, 128),
        giftId: String(input.giftId || 'gift').slice(0, 64),
        giftName: String(input.giftName || 'Gift').slice(0, 80),
        giftIcon: String(input.giftIcon || '🎁').slice(0, 32),
        quantity: qty,
        totalCoins,
        hostDiamonds,
        appShareCoins,
        context: input.context,
        roomId: input.roomId ? String(input.roomId).slice(0, 128) : undefined,
        streamId: input.streamId ? String(input.streamId).slice(0, 128) : undefined,
        reelId: input.reelId ? String(input.reelId).slice(0, 128) : undefined,
        status: 'completed',
        createdAt: nowIso,
        createdAtMs: nowMs,
      });

      transaction.set(doc(db, 'giftTransactions', txId), ledgerPayload);
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `giftTransactions/${txId}`);
  }

  if (input.context === 'live' && input.streamId) {
    updateDoc(doc(db, 'liveStreams', input.streamId), {
      totalGiftCoins: increment(totalCoins),
      updatedAt: nowIso,
    }).catch(() => {});
  } else if (input.context === 'party' && input.roomId) {
    updateDoc(doc(db, 'partyRooms', input.roomId), {
      totalGiftCoins: increment(totalCoins),
      updatedAt: nowIso,
    }).catch(() => {});
  }

  if (canQueryRecipientDoc) {
    sendFirestoreNotification({
      recipientId,
      type: 'gift',
      category: 'gifts',
      title: `${input.giftIcon} Gift Received (+${hostDiamonds.toLocaleString()} 💎)`,
      message: `${input.senderName} sent ${qty > 1 ? `${qty}x ` : ''}${input.giftName} (${totalCoins.toLocaleString()} Coins). Your 60% host share (+${hostDiamonds.toLocaleString()} Diamonds) is in your wallet!`,
      senderName: input.senderName,
      senderAvatar: input.senderAvatar,
      screen: 'wallet',
      roomId: input.roomId,
      streamId: input.streamId,
      reelId: input.reelId,
    }).catch((err) => console.warn('Gift notification dispatch warning:', err));

    import('./leaderboardService')
      .then((m) =>
        m.recordLeaderboardGiftReceived({
          recipientId,
          recipientName: input.recipientName,
          giftCoins: totalCoins,
          hostDiamonds,
        })
      )
      .catch((err) => console.warn('Leaderboard gift update warning:', err));
  }

  return {
    txId,
    totalCoins,
    hostDiamonds,
    appShareCoins,
    creditedHostFirestore,
    senderNextCoins,
    senderNextDiamonds,
  };
}

export function subscribeToGiftTransactions(
  options: { userId?: string; isAdmin?: boolean },
  onUpdate: (items: any[]) => void
) {
  const path = 'giftTransactions';
  if (options.isAdmin) {
    const q = query(
      collection(db, 'giftTransactions'),
      orderBy('createdAtMs', 'desc'),
      limit(200)
    );
    return onSnapshot(
      q,
      (snap) => onUpdate(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => handleFirestoreError(err, OperationType.LIST, path)
    );
  }
  const uid = options.userId;
  if (!uid) return () => {};

  let sentDocs: any[] = [];
  let receivedDocs: any[] = [];
  const mergeAndEmit = () => {
    const byId = new Map<string, any>();
    [...sentDocs, ...receivedDocs].forEach((item) => byId.set(item.id, item));
    const merged = Array.from(byId.values()).sort(
      (a, b) => (Number(b.createdAtMs) || 0) - (Number(a.createdAtMs) || 0)
    );
    onUpdate(merged);
  };

  const qSent = query(
    collection(db, 'giftTransactions'),
    where('senderId', '==', uid),
    limit(100)
  );
  const qReceived = query(
    collection(db, 'giftTransactions'),
    where('recipientId', '==', uid),
    limit(100)
  );

  const unsubSent = onSnapshot(
    qSent,
    (snap) => {
      sentDocs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      mergeAndEmit();
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
  const unsubReceived = onSnapshot(
    qReceived,
    (snap) => {
      receivedDocs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      mergeAndEmit();
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );

  return () => {
    unsubSent();
    unsubReceived();
  };
}

// =========================================================================
// SCOPED NETWORK RECOVERY & SERVER SNAPSHOT HELPERS
// =========================================================================
export async function recoverFirestoreNetwork(): Promise<{ online: boolean; error?: string }> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { online: false, error: 'You appear to be offline. Please check your internet connection.' };
  }
  try {
    await enableNetwork(db).catch(() => {});
    await withFirestoreTimeout(getDocFromServer(doc(db, 'test', 'connection')), 5500, 'Network connection check');
    return { online: true };
  } catch (err: any) {
    const msg = String(err?.message || err || '').toLowerCase();
    // If Firestore responded with permission-denied, the network connection to Firestore is genuinely alive!
    if (msg.includes('permission') || msg.includes('missing or insufficient')) {
      return { online: true };
    }
    if (msg.includes('offline') || msg.includes('timed out') || msg.includes('network') || msg.includes('unavailable')) {
      return { online: false, error: 'Network unavailable. Please check your connection and pull again.' };
    }
    return { online: true };
  }
}

export async function fetchLiveStreamFromServer(streamId: string): Promise<any | null> {
  if (!streamId) return null;
  try {
    const snap = await withFirestoreTimeout(
      getDocFromServer(doc(db, 'liveStreams', streamId)),
      6000,
      'Refresh live broadcast'
    );
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() };
  } catch {
    return null;
  }
}

export async function fetchPartyRoomFromServer(roomId: string): Promise<any | null> {
  if (!roomId) return null;
  try {
    const snap = await withFirestoreTimeout(
      getDocFromServer(doc(db, 'partyRooms', roomId)),
      6000,
      'Refresh party room'
    );
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() };
  } catch {
    return null;
  }
}

