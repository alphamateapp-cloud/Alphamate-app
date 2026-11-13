import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from './firebase';

export type HeartSurface = 'live' | 'party';

function surfacePath(surface: HeartSurface, roomId: string) {
  return surface === 'live' ? ['liveStreams', roomId] : ['partyRooms', roomId];
}

/** Broadcast one double-tap reaction and atomically increment the persistent room counter. */
export async function sendLiveHeart(surface: HeartSurface, roomId: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in is required to send hearts.');
  const base = surfacePath(surface, roomId);
  const statsRef = doc(db, ...base, 'stats', 'hearts');
  const eventsRef = collection(db, ...base, 'heartEvents');

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(statsRef);
    const current = Number(snap.data()?.count || 0);
    tx.set(statsRef, { count: current + 1, updatedAt: serverTimestamp() }, { merge: true });
  });

  await addDoc(eventsRef, {
    senderId: user.uid,
    senderName: user.displayName || 'Alpha Mate User',
    createdAt: serverTimestamp(),
  });
}

export function subscribeToLiveHeartCount(
  surface: HeartSurface,
  roomId: string,
  callback: (count: number) => void,
  onError?: (error: Error) => void,
): () => void {
  const base = surfacePath(surface, roomId);
  return onSnapshot(
    doc(db, ...base, 'stats', 'hearts'),
    (snap) => callback(Number(snap.data()?.count || 0)),
    (error) => onError?.(error),
  );
}

export function subscribeToLiveHeartEvents(
  surface: HeartSurface,
  roomId: string,
  callback: (event: { id: string; senderId: string }) => void,
  onError?: (error: Error) => void,
): () => void {
  const base = surfacePath(surface, roomId);
  let seen = new Set<string>();
  let initialized = false;
  return onSnapshot(
    collection(db, ...base, 'heartEvents'),
    (snapshot) => {
      if (!initialized) {
        snapshot.docs.forEach((item) => seen.add(item.id));
        initialized = true;
        return;
      }
      snapshot.docChanges().forEach((change) => {
        if (change.type !== 'added' || seen.has(change.doc.id)) return;
        seen.add(change.doc.id);
        const data = change.doc.data();
        callback({ id: change.doc.id, senderId: String(data.senderId || '') });
      });
      // Bound client memory; Firestore remains the durable counter source.
      if (seen.size > 500) seen = new Set(Array.from(seen).slice(-250));
    },
    (error) => onError?.(error),
  );
}
