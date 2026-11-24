import {
  addDoc,
  collection,
  doc,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import {
  auth,
  db,
  handleFirestoreError,
  isFirestoreQuotaExceeded,
  isFirestoreQuotaExceededError,
  notifyFirestoreQuotaExceeded,
  OperationType,
} from './firebase';
import { realtimeSocket } from './realtimeSocket';

export type LiveRoomType = 'live' | 'party';

export interface LiveHeartEvent {
  id: string;
  senderId: string;
  createdAt?: any;
}

function getParentCollection(type: LiveRoomType): string {
  return type === 'live' ? 'liveStreams' : 'partyRooms';
}

const VALID_SESSION_ID_RE = /^[a-zA-Z0-9_-]{1,128}$/;

function resolveHeartRefs(type: LiveRoomType, id: string, sessionId?: string) {
  const parentCol = getParentCollection(type);
  const cleanSession =
    type === 'party' && typeof sessionId === 'string' && VALID_SESSION_ID_RE.test(sessionId.trim())
      ? sessionId.trim()
      : '';
  if (cleanSession) {
    return {
      statsRef: doc(db, parentCol, id, 'sessions', cleanSession, 'stats', 'hearts'),
      statsPath: `${parentCol}/${id}/sessions/${cleanSession}/stats/hearts`,
      eventsColRef: collection(db, parentCol, id, 'sessions', cleanSession, 'heartEvents'),
      eventsPath: `${parentCol}/${id}/sessions/${cleanSession}/heartEvents`,
      cleanSession,
    };
  }
  return {
    statsRef: doc(db, parentCol, id, 'stats', 'hearts'),
    statsPath: `${parentCol}/${id}/stats/hearts`,
    eventsColRef: collection(db, parentCol, id, 'heartEvents'),
    eventsPath: `${parentCol}/${id}/heartEvents`,
    cleanSession: undefined,
  };
}

/**
 * Send a heart reaction to a Solo Live stream or Party Room.
 * Emits immediately over WebSocket for <50ms cross-device delivery AND persists to Firestore when quota permits.
 */
export async function sendLiveHeart(type: LiveRoomType, id: string, sessionId?: string): Promise<void> {
  if (!id) return;
  const uid = auth.currentUser?.uid;
  if (!uid) return;

  const { statsRef, statsPath, eventsColRef, eventsPath, cleanSession } = resolveHeartRefs(type, id, sessionId);

  // 1. Instant WebSocket broadcast for sub-50ms counter & animation sync
  realtimeSocket.sendHeartTap(type, id, cleanSession);

  if (isFirestoreQuotaExceeded()) return;

  // 2. Persistent atomic Firestore counter + event doc matching firestore.rules
  await Promise.all([
    setDoc(
      statsRef,
      {
        count: increment(1),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    ).catch((err: any) => {
      if (isFirestoreQuotaExceededError(err)) {
        notifyFirestoreQuotaExceeded();
        return;
      }
      if (err?.code === 'not-found') return;
      if (err?.code === 'permission-denied') {
        handleFirestoreError(err, OperationType.WRITE, statsPath);
      }
    }),
    addDoc(eventsColRef, {
      senderId: uid,
      createdAt: serverTimestamp(),
    }).catch((err: any) => {
      if (isFirestoreQuotaExceededError(err)) {
        notifyFirestoreQuotaExceeded();
        return;
      }
      if (err?.code === 'not-found') return;
      if (err?.code === 'permission-denied') {
        handleFirestoreError(err, OperationType.CREATE, eventsPath);
      }
    }),
  ]);
}

/**
 * Subscribe to the shared real-time heart count from both WebSocket and Firestore.
 */
export function subscribeToLiveHeartCount(
  type: LiveRoomType,
  id: string,
  onCount: (count: number) => void,
  onError?: (err: Error) => void,
  sessionId?: string
): () => void {
  if (!id) {
    onCount(0);
    return () => {};
  }

  let firestoreCount = 0;
  let wsCount = 0;

  const emitMax = () => {
    onCount(Math.max(firestoreCount, wsCount));
  };

  const { statsRef, cleanSession } = resolveHeartRefs(type, id, sessionId);

  const unsubFirestore = onSnapshot(
    statsRef,
    (snapshot) => {
      firestoreCount = snapshot.exists() ? Number(snapshot.data()?.count) || 0 : 0;
      emitMax();
    },
    (error) => {
      if (isFirestoreQuotaExceededError(error)) {
        notifyFirestoreQuotaExceeded();
        return;
      }
      onError?.(error);
    }
  );

  const unsubWs = realtimeSocket.onRoomEvent(type, id, (event) => {
    if (cleanSession && event.roomSessionId && event.roomSessionId !== cleanSession) return;
    if (event.type === 'room:state_init') {
      wsCount = Number(event.heartCount) || 0;
      emitMax();
    } else if (event.type === 'room:heart') {
      wsCount = Math.max(wsCount + 1, Number(event.heartCount) || 0);
      emitMax();
    }
  });

  return () => {
    unsubFirestore();
    unsubWs();
  };
}

/**
 * Subscribe to incoming heart burst events from remote participants in real time.
 * Combines WebSocket instant bursts and Firestore heartEvents with deduplication.
 */
export function subscribeToLiveHeartEvents(
  type: LiveRoomType,
  id: string,
  onEvent: (event: LiveHeartEvent) => void,
  onError?: (err: Error) => void,
  sessionId?: string
): () => void {
  if (!id) return () => {};

  const { eventsColRef, cleanSession } = resolveHeartRefs(type, id, sessionId);
  const eventsQuery = query(eventsColRef, orderBy('createdAt', 'desc'), limit(15));

  let initialSnapshotHandled = false;
  const seenDocIds = new Set<string>();
  const recentWsTimestamps = new Map<string, number>();

  const unsubWs = realtimeSocket.onRoomEvent(type, id, (event) => {
    if (cleanSession && event.roomSessionId && event.roomSessionId !== cleanSession) return;
    if (event.type === 'room:heart') {
      recentWsTimestamps.set(event.senderId, Date.now());
      onEvent({
        id: event.eventId,
        senderId: event.senderId,
        createdAt: event.createdAtMs,
      });
    }
  });

  const unsubFirestore = onSnapshot(
    eventsQuery,
    (snapshot) => {
      if (!initialSnapshotHandled) {
        initialSnapshotHandled = true;
        snapshot.docs.forEach((d) => seenDocIds.add(d.id));
        return;
      }

      snapshot.docChanges().forEach((change) => {
        if (change.type !== 'added' || seenDocIds.has(change.doc.id)) return;
        seenDocIds.add(change.doc.id);
        const data = change.doc.data() as any;
        const senderId = String(data?.senderId || '');
        if (!senderId) return;

        // Avoid double-spawning floating hearts if WS already delivered this user's tap within 1.5s
        const lastWsAt = recentWsTimestamps.get(senderId) || 0;
        if (Date.now() - lastWsAt < 1500) {
          return;
        }

        onEvent({
          id: change.doc.id,
          senderId,
          createdAt: data?.createdAt,
        });
      });
    },
    (error) => {
      if (isFirestoreQuotaExceededError(error)) {
        notifyFirestoreQuotaExceeded();
        return;
      }
      onError?.(error);
    }
  );

  return () => {
    unsubWs();
    unsubFirestore();
  };
}
