import {
  addDoc,
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
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

/**
 * Send a heart reaction to a Solo Live stream or Party Room.
 * Emits immediately over WebSocket for <50ms cross-device delivery AND persists to Firestore.
 */
export async function sendLiveHeart(type: LiveRoomType, id: string): Promise<void> {
  if (!id) return;
  const uid = auth.currentUser?.uid;
  if (!uid) return;

  // 1. Instant WebSocket broadcast for sub-50ms counter & animation sync
  realtimeSocket.sendHeartTap(type, id);

  const parentCol = getParentCollection(type);
  const statsRef = doc(db, parentCol, id, 'stats', 'hearts');
  const eventsColRef = collection(db, parentCol, id, 'heartEvents');

  // 2. Persistent Firestore counter + event doc matching firestore.rules
  await Promise.all([
    runTransaction(db, async (tx) => {
      const snap = await tx.get(statsRef);
      if (!snap.exists()) {
        tx.set(statsRef, {
          count: 1,
          updatedAt: serverTimestamp(),
        });
      } else {
        const currentCount = Number(snap.data()?.count) || 0;
        tx.update(statsRef, {
          count: currentCount + 1,
          updatedAt: serverTimestamp(),
        });
      }
    }).catch((err: any) => {
      if (err?.code === 'permission-denied') {
        handleFirestoreError(err, OperationType.WRITE, `${parentCol}/${id}/stats/hearts`);
      }
    }),
    addDoc(eventsColRef, {
      senderId: uid,
      createdAt: serverTimestamp(),
    }).catch((err: any) => {
      if (err?.code === 'permission-denied') {
        handleFirestoreError(err, OperationType.CREATE, `${parentCol}/${id}/heartEvents`);
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
  onError?: (err: Error) => void
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

  const parentCol = getParentCollection(type);
  const statsRef = doc(db, parentCol, id, 'stats', 'hearts');

  const unsubFirestore = onSnapshot(
    statsRef,
    (snapshot) => {
      firestoreCount = snapshot.exists() ? Number(snapshot.data()?.count) || 0 : 0;
      emitMax();
    },
    (error) => {
      onError?.(error);
    }
  );

  const unsubWs = realtimeSocket.onRoomEvent(type, id, (event) => {
    if (event.type === 'room:state_init') {
      wsCount = Math.max(wsCount, Number(event.heartCount) || 0);
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
  onError?: (err: Error) => void
): () => void {
  if (!id) return () => {};

  const parentCol = getParentCollection(type);
  const eventsQuery = query(
    collection(db, parentCol, id, 'heartEvents'),
    orderBy('createdAt', 'desc'),
    limit(15)
  );

  let initialSnapshotHandled = false;
  const seenDocIds = new Set<string>();
  const recentWsTimestamps = new Map<string, number>();

  const unsubWs = realtimeSocket.onRoomEvent(type, id, (event) => {
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
      onError?.(error);
    }
  );

  return () => {
    unsubWs();
    unsubFirestore();
  };
}
