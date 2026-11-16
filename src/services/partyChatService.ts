import {
  auth,
  db,
  handleBackgroundWriteError,
  handleSnapshotListenerError,
  isFirestoreQuotaExceeded,
  isFirestoreQuotaExceededError,
  notifyFirestoreQuotaExceeded,
  OperationType,
} from './firebase';
import { addDoc, collection, limit, onSnapshot, orderBy, query, serverTimestamp } from 'firebase/firestore';

export type PartyRoomMessage = {
  id: string;
  sender: { id: string; displayName: string; avatar: string; vipTier?: number; level?: number; isHost?: boolean };
  text: string;
  type: 'room' | 'host' | 'gift' | 'system';
  giftName?: string;
  giftIcon?: string;
  giftCoins?: number;
  createdAt?: any;
};

function sanitizeObject<T extends Record<string, any>>(input: T): T {
  const result: Record<string, any> = {};
  for (const [key, val] of Object.entries(input)) {
    if (val === undefined) continue;
    if (val !== null && typeof val === 'object' && !Array.isArray(val) && typeof val.toDate !== 'function') {
      result[key] = sanitizeObject(val);
    } else {
      result[key] = val;
    }
  }
  return result as T;
}

export function subscribeToPartyRoomMessages(
  roomId: string,
  callback: (messages: PartyRoomMessage[]) => void,
  onError?: (error: Error) => void
) {
  if (!roomId) {
    callback([]);
    return () => {};
  }
  const path = `partyRooms/${roomId}/messages`;
  const messagesQuery = query(collection(db, 'partyRooms', roomId, 'messages'), orderBy('createdAt', 'asc'), limit(150));
  return onSnapshot(
    messagesQuery,
    (snapshot) => {
      callback(snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<PartyRoomMessage, 'id'>) })));
    },
    (error) => {
      if (isFirestoreQuotaExceededError(error)) {
        notifyFirestoreQuotaExceeded();
        return;
      }
      if ((error as any)?.code === 'permission-denied') {
        handleSnapshotListenerError(error, OperationType.LIST, path);
        return;
      }
      onError?.(error);
    }
  );
}

export async function sendPartyRoomMessage(roomId: string, message: Omit<PartyRoomMessage, 'id' | 'createdAt'>) {
  const uid = auth.currentUser?.uid;
  if (!roomId || !uid || isFirestoreQuotaExceeded()) return;

  const path = `partyRooms/${roomId}/messages`;
  const payload = sanitizeObject({
    ...message,
    senderId: uid,
    sender: {
      ...message.sender,
      id: uid,
      displayName: String(message.sender?.displayName || auth.currentUser?.displayName || 'Alpha Mate User').slice(0, 100),
      avatar: String(message.sender?.avatar || auth.currentUser?.photoURL || ''),
    },
    text: String(message.text || '').slice(0, 500),
    createdAt: serverTimestamp(),
  });

  try {
    await addDoc(collection(db, 'partyRooms', roomId, 'messages'), payload);
  } catch (error) {
    handleBackgroundWriteError(error, OperationType.CREATE, path);
  }
}
