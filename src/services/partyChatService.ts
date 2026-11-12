import { auth, db } from './firebase';
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

export function subscribeToPartyRoomMessages(roomId: string, callback: (messages: PartyRoomMessage[]) => void, onError?: (error: Error) => void) {
  const messagesQuery = query(collection(db, 'partyRooms', roomId, 'messages'), orderBy('createdAt', 'asc'), limit(150));
  return onSnapshot(messagesQuery, (snapshot) => {
    callback(snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<PartyRoomMessage, 'id'>) })));
  }, (error) => onError?.(error));
}

export async function sendPartyRoomMessage(roomId: string, message: Omit<PartyRoomMessage, 'id' | 'createdAt'>) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Please sign in to send a party message.');
  await addDoc(collection(db, 'partyRooms', roomId, 'messages'), {
    ...message,
    senderId: uid,
    createdAt: serverTimestamp(),
  });
}
