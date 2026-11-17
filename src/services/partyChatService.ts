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
import { sanitizeAvatarString } from '../utils/imageCompressor';
import { addDoc, collection, doc, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc } from 'firebase/firestore';

export type PartyRoomMessage = {
  id: string;
  sender: { id: string; displayName: string; avatar: string; vipTier?: number; level?: number; isHost?: boolean };
  text: string;
  type: 'room' | 'host' | 'gift' | 'system';
  giftId?: string;
  giftName?: string;
  giftIcon?: string;
  giftCoins?: number;
  quantity?: number;
  recipientId?: string;
  recipientName?: string;
  createdAt?: any;
};

const VALID_MSG_ID_RE = /^[a-zA-Z0-9_-]{1,128}$/;
const VALID_MSG_TYPES = new Set(['room', 'host', 'gift', 'system']);

function sanitizeObject<T extends Record<string, any>>(input: T): T {
  const result: Record<string, any> = {};
  for (const [key, val] of Object.entries(input)) {
    if (val === undefined) continue;
    if (val !== null && typeof val === 'object' && Object.getPrototypeOf(val) === Object.prototype) {
      result[key] = sanitizeObject(val);
    } else {
      result[key] = val;
    }
  }
  return result as T;
}

function getMessagesCollectionRef(roomId: string, sessionId?: string) {
  const cleanSession = typeof sessionId === 'string' && VALID_MSG_ID_RE.test(sessionId.trim()) ? sessionId.trim() : '';
  if (cleanSession) {
    return {
      colRef: collection(db, 'partyRooms', roomId, 'sessions', cleanSession, 'messages'),
      path: `partyRooms/${roomId}/sessions/${cleanSession}/messages`,
    };
  }
  return {
    colRef: collection(db, 'partyRooms', roomId, 'messages'),
    path: `partyRooms/${roomId}/messages`,
  };
}

export function subscribeToPartyRoomMessages(
  roomId: string,
  callback: (messages: PartyRoomMessage[]) => void,
  onError?: (error: Error) => void,
  sessionId?: string
) {
  if (!roomId) {
    callback([]);
    return () => {};
  }
  const { colRef, path } = getMessagesCollectionRef(roomId, sessionId);
  const messagesQuery = query(colRef, orderBy('createdAt', 'asc'), limit(150));
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

export async function sendPartyRoomMessage(
  roomId: string,
  message: Omit<PartyRoomMessage, 'id' | 'createdAt'> & { id?: string },
  sessionId?: string
) {
  const uid = auth.currentUser?.uid;
  if (!roomId || !uid || isFirestoreQuotaExceeded()) return;

  const { colRef, path } = getMessagesCollectionRef(roomId, sessionId);
  const { id: customId } = message;
  const rawAvatar = sanitizeAvatarString(message.sender?.avatar || auth.currentUser?.photoURL || undefined);
  const safeAvatar =
    rawAvatar.length <= 65000
      ? rawAvatar
      : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80';
  const safeType = VALID_MSG_TYPES.has(message.type) ? message.type : 'room';

  const senderPayload = sanitizeObject({
    id: uid,
    displayName:
      String(message.sender?.displayName || auth.currentUser?.displayName || 'Alpha Mate User')
        .trim()
        .slice(0, 100) || 'Alpha Mate User',
    avatar: safeAvatar,
    vipTier: typeof message.sender?.vipTier === 'number' ? message.sender.vipTier : undefined,
    level: typeof message.sender?.level === 'number' ? message.sender.level : undefined,
    isHost: typeof message.sender?.isHost === 'boolean' ? message.sender.isHost : undefined,
  });

  const basePayload = sanitizeObject({
    senderId: uid,
    sender: senderPayload,
    text: String(message.text || '').slice(0, 1500),
    type: safeType,
    giftId: typeof message.giftId === 'string' && message.giftId.trim() ? message.giftId.trim().slice(0, 64) : undefined,
    giftName: typeof message.giftName === 'string' && message.giftName.trim() ? message.giftName.trim().slice(0, 128) : undefined,
    giftIcon: typeof message.giftIcon === 'string' && message.giftIcon.trim() ? message.giftIcon.trim().slice(0, 512) : undefined,
    giftCoins:
      typeof message.giftCoins === 'number' && Number.isFinite(message.giftCoins)
        ? Math.max(0, Math.min(50000000, Math.floor(message.giftCoins)))
        : undefined,
    quantity:
      typeof message.quantity === 'number' && Number.isFinite(message.quantity)
        ? Math.max(1, Math.min(9999, Math.floor(message.quantity)))
        : undefined,
    recipientId:
      typeof message.recipientId === 'string' && message.recipientId.trim()
        ? message.recipientId.trim().slice(0, 128)
        : undefined,
    recipientName:
      typeof message.recipientName === 'string' && message.recipientName.trim()
        ? message.recipientName.trim().slice(0, 128)
        : undefined,
  });

  const payload = {
    ...basePayload,
    createdAt: serverTimestamp(),
  };

  const hasCustomId = Boolean(customId && VALID_MSG_ID_RE.test(customId));
  const docPath = hasCustomId ? `${path}/${customId}` : path;

  try {
    if (hasCustomId && customId) {
      await setDoc(doc(colRef, customId), payload);
    } else {
      await addDoc(colRef, payload);
    }
  } catch (error: any) {
    if (error?.code === 'not-found') return;
    handleBackgroundWriteError(error, OperationType.CREATE, docPath);
  }
}
