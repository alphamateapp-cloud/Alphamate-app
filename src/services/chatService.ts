import {
  auth,
  db,
  isFirestoreQuotaExceeded,
  isFirestoreQuotaExceededError,
  notifyFirestoreQuotaExceeded,
} from './firebase';
import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

enum FirestoreOperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: FirestoreOperationType;
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

function logAndWrapFirestoreError(
  error: unknown,
  operationType: FirestoreOperationType,
  path: string | null
): never {
  if (isFirestoreQuotaExceededError(error)) {
    notifyFirestoreQuotaExceeded();
  }
  const message = error instanceof Error ? error.message : String(error);
  if (message.toLowerCase().includes('missing or insufficient permissions') || message.includes('PERMISSION_DENIED')) {
    const errInfo: FirestoreErrorInfo = {
      error: message,
      operationType,
      path,
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
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    throw new Error(JSON.stringify(errInfo));
  }
  throw error instanceof Error ? error : new Error(message);
}

export function getFriendlyChatErrorMessage(error: unknown, fallback = 'Unable to send message right now.'): string {
  if (!(error instanceof Error)) return fallback;
  const raw = error.message || '';
  if (raw.startsWith('{')) {
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed?.error === 'string') {
        if (parsed.error.toLowerCase().includes('missing or insufficient permissions')) {
          return 'Unable to access this chat right now. Please refresh and try again.';
        }
        return parsed.error;
      }
    } catch {
      // fall through
    }
  }
  if (raw.toLowerCase().includes('missing or insufficient permissions')) {
    return 'Unable to access this chat right now. Please refresh and try again.';
  }
  return raw || fallback;
}

/** Firestore-backed chat primitives. All operations require a Firebase-authenticated user. */
const storage = getStorage();
const uid = () => {
  const value = auth.currentUser?.uid;
  if (!value) throw new Error('Please sign in with your account to use chat.');
  return value;
};
export const safeChatIdSegment = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 58);

export function buildDirectChatId(uidA: string, uidB: string): string {
  const sorted = [uidA, uidB].sort();
  return `dm_${sorted.map(safeChatIdSegment).join('_')}`;
}

export function buildChatRequestId(recipientUid: string, senderUid: string): string {
  return `${safeChatIdSegment(recipientUid)}_${safeChatIdSegment(senderUid)}`;
}

function getTimestampMillis(val: any): number {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (val && typeof val.toMillis === 'function') return val.toMillis();
  if (val && typeof val.seconds === 'number') return val.seconds * 1000;
  if (typeof val === 'string') {
    const parsed = Date.parse(val);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return 0;
}

export async function uploadPartyRoomCover(file: File): Promise<string> {
  const me = uid();
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.');
  if (file.size > 5 * 1024 * 1024) throw new Error('Room cover must be 5 MB or smaller.');
  const path = `partyRoomCovers/${me}/${Date.now()}_${safeChatIdSegment(file.name)}`;
  const objectRef = ref(storage, path);
  await uploadBytes(objectRef, file, { contentType: file.type });
  return getDownloadURL(objectRef);
}

export type ChatProfile = {
  id: string;
  displayName: string;
  username?: string;
  uniqueId?: string;
  avatar?: string;
  level?: number;
  vipTier?: number;
  countryFlag?: string;
  bio?: string;
  isVerified?: boolean;
};

export interface PendingRequestMessage {
  id: string;
  senderId: string;
  text: string;
  mediaUrl?: string | null;
  mediaType?: 'image' | 'video' | 'audio' | 'file' | null;
  createdAtMs: number;
}

function mapDocToChatProfile(id: string, data: Record<string, any>): ChatProfile {
  return {
    id,
    displayName: String(data.displayName || data.name || 'Alpha Mate User'),
    username: String(data.username || ''),
    uniqueId: String(data.uniqueId || ''),
    avatar: String(data.avatar || data.photoURL || ''),
    level: Number(data.level || 1),
    vipTier: Number(data.vipTier || 0),
    countryFlag: typeof data.countryFlag === 'string' ? data.countryFlag : undefined,
    bio: typeof data.bio === 'string' ? data.bio : undefined,
    isVerified: Boolean(data.isVerified),
  };
}

export async function searchFirebaseUsers(
  searchTerm: string,
  excludeUserId: string,
  maxResults = 30
): Promise<ChatProfile[]> {
  uid();
  if (isFirestoreQuotaExceeded()) {
    return [];
  }
  const term = searchTerm.trim().toLowerCase().replace(/^@/, '');
  const usersRef = collection(db, 'users');
  const byId = new Map<string, ChatProfile>();
  const handleSearchErr = (err: unknown) => {
    if (isFirestoreQuotaExceededError(err)) {
      notifyFirestoreQuotaExceeded();
    }
    return null;
  };

  if (term.length >= 1) {
    const end = `${term}\uf8ff`;
    const fields = ['usernameLower', 'displayNameLower', 'uniqueIdLower'];
    const snapshots = await Promise.all(
      fields.map((field) =>
        getDocs(query(usersRef, where(field, '>=', term), where(field, '<=', end), limit(maxResults))).catch(handleSearchErr)
      )
    );
    snapshots.forEach((snap) =>
      snap?.docs.forEach((item) => {
        if (item.id === excludeUserId) return;
        const data = item.data() as any;
        if (data.accountStatus === 'permanently_deleted') return;
        byId.set(item.id, mapDocToChatProfile(item.id, data));
      })
    );
  }

  // Fallback scan only when prefix matches returned few results or empty query needs initial list
  if (!isFirestoreQuotaExceeded() && ((term && byId.size < 10) || (!term && byId.size === 0))) {
    const broadSnap = await getDocs(query(usersRef, limit(60))).catch(handleSearchErr);
    broadSnap?.docs.forEach((item) => {
      if (item.id === excludeUserId || byId.has(item.id)) return;
      const data = item.data() as any;
      if (data.accountStatus === 'permanently_deleted') return;
      const profile = mapDocToChatProfile(item.id, data);
      if (
        !term ||
        profile.displayName.toLowerCase().includes(term) ||
        (profile.username || '').toLowerCase().includes(term) ||
        (profile.uniqueId || '').toLowerCase().includes(term) ||
        item.id.toLowerCase().includes(term)
      ) {
        byId.set(item.id, profile);
      }
    });
  }

  return Array.from(byId.values()).slice(0, maxResults);
}

export type ChatPayload = {
  text?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'audio' | 'file';
  replyTo?: string;
  linkUrl?: string;
};

export function subscribeToMyChats(callback: (items: any[]) => void, onError?: (error: Error) => void) {
  const me = uid();
  const q = query(collection(db, 'chats'), where('participantIds', 'array-contains', me), limit(100));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a: any, b: any) => {
          const timeB = getTimestampMillis(b.updatedAtMs) || getTimestampMillis(b.updatedAt) || getTimestampMillis(b.createdAt);
          const timeA = getTimestampMillis(a.updatedAtMs) || getTimestampMillis(a.updatedAt) || getTimestampMillis(a.createdAt);
          return timeB - timeA;
        });
      callback(items);
    },
    (e) => {
      if (isFirestoreQuotaExceededError(e)) notifyFirestoreQuotaExceeded();
      console.error('subscribeToMyChats error:', e);
      onError?.(e);
    }
  );
}

export function subscribeToChatMessages(chatId: string, callback: (items: any[]) => void, onError?: (error: Error) => void) {
  uid();
  const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'asc'), limit(300));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a: any, b: any) => {
          const timeA = getTimestampMillis(a.createdAt) || getTimestampMillis(a.createdAtMs);
          const timeB = getTimestampMillis(b.createdAt) || getTimestampMillis(b.createdAtMs);
          return timeA - timeB;
        });
      callback(items);
    },
    (e) => {
      if (isFirestoreQuotaExceededError(e)) notifyFirestoreQuotaExceeded();
      onError?.(e);
    }
  );
}

export function subscribeToMyChatRequests(callback: (items: any[]) => void, onError?: (error: Error) => void) {
  const me = uid();
  const q = query(collection(db, 'chatRequests'), where('recipientId', '==', me), limit(100));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((item: any) => item.status === 'pending')
        .sort((a: any, b: any) => {
          const timeB = getTimestampMillis(b.updatedAtMs) || getTimestampMillis(b.updatedAt) || getTimestampMillis(b.createdAtMs) || getTimestampMillis(b.createdAt);
          const timeA = getTimestampMillis(a.updatedAtMs) || getTimestampMillis(a.updatedAt) || getTimestampMillis(a.createdAtMs) || getTimestampMillis(a.createdAt);
          return timeB - timeA;
        });
      callback(items);
    },
    (e) => {
      if (isFirestoreQuotaExceededError(e)) notifyFirestoreQuotaExceeded();
      console.error('subscribeToMyChatRequests error:', e);
      onError?.(e);
    }
  );
}

export function subscribeToMySentChatRequests(callback: (items: any[]) => void, onError?: (error: Error) => void) {
  const me = uid();
  const q = query(collection(db, 'chatRequests'), where('senderId', '==', me), limit(100));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((item: any) => item.status === 'pending')
        .sort((a: any, b: any) => {
          const timeB = getTimestampMillis(b.updatedAtMs) || getTimestampMillis(b.updatedAt) || getTimestampMillis(b.createdAtMs) || getTimestampMillis(b.createdAt);
          const timeA = getTimestampMillis(a.updatedAtMs) || getTimestampMillis(a.updatedAt) || getTimestampMillis(a.createdAtMs) || getTimestampMillis(a.createdAt);
          return timeB - timeA;
        });
      callback(items);
    },
    (e) => {
      if (isFirestoreQuotaExceededError(e)) notifyFirestoreQuotaExceeded();
      console.error('subscribeToMySentChatRequests error:', e);
      onError?.(e);
    }
  );
}

/**
 * Create or return an existing 1:1 direct Firestore chat thread when explicitly needed.
 */
export async function getOrCreateDirectChat(meProfile: ChatProfile, targetProfile: ChatProfile): Promise<string> {
  const me = uid();
  if (!targetProfile.id || targetProfile.id === me) {
    throw new Error('Cannot start chat with yourself.');
  }
  const participants = [me, targetProfile.id].sort();
  const chatId = buildDirectChatId(me, targetProfile.id);
  const chatRef = doc(db, 'chats', chatId);
  try {
    const existing = await getDoc(chatRef);
    if (!existing.exists()) {
      await setDoc(chatRef, {
        type: 'direct',
        participantIds: participants,
        participantProfiles: {
          [me]: {
            id: me,
            displayName: meProfile.displayName || auth.currentUser?.displayName || 'Alpha Mate User',
            username: meProfile.username || '',
            uniqueId: meProfile.uniqueId || '',
            avatar: meProfile.avatar || auth.currentUser?.photoURL || '',
          },
          [targetProfile.id]: {
            id: targetProfile.id,
            displayName: targetProfile.displayName || 'Alpha Mate User',
            username: targetProfile.username || '',
            uniqueId: targetProfile.uniqueId || '',
            avatar: targetProfile.avatar || '',
          },
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedAtMs: Date.now(),
        lastMessage: 'Connected on Alpha Mate',
        lastSenderId: me,
        unreadBy: { [me]: 0, [targetProfile.id]: 0 },
      });
    }
    return chatId;
  } catch (error) {
    logAndWrapFirestoreError(error, FirestoreOperationType.WRITE, `chats/${chatId}`);
  }
}

export async function markChatAsRead(chatId: string) {
  const me = uid();
  await updateDoc(doc(db, 'chats', chatId), {
    [`unreadBy.${me}`]: 0,
  }).catch(() => {});
}

/**
 * Send or update a 1:1 pending Chat Request.
 * Until the recipient approves, messages stay in `chatRequests/{recipient}_{sender}` (the recipient's Requests inbox).
 */
export async function sendChatRequest(
  recipient: ChatProfile,
  messageText: string,
  senderProfile?: Partial<ChatProfile>,
  mediaUrl?: string,
  mediaType?: ChatPayload['mediaType']
) {
  const me = uid();
  const trimmed = messageText.trim().slice(0, 4000);
  if (!trimmed && !mediaUrl) throw new Error('Write a message first.');
  if (!recipient.id || recipient.id === me) throw new Error('You cannot message yourself.');

  const displayText =
    trimmed ||
    (mediaType === 'image'
      ? 'Photo'
      : mediaType === 'video'
      ? 'Video'
      : mediaType === 'audio'
      ? 'Voice message'
      : 'Attachment');

  const requestId = buildChatRequestId(recipient.id, me);
  const requestRef = doc(db, 'chatRequests', requestId);
  const nowMs = Date.now();

  try {
    const existingSnap = await getDoc(requestRef);
    const existingData = existingSnap.exists() ? existingSnap.data() : null;

    if (existingData?.status === 'blocked') {
      throw new Error('This user is not accepting messages from your account.');
    }

    const previousPending: PendingRequestMessage[] =
      existingData?.status === 'pending' && Array.isArray(existingData.pendingMessages)
        ? existingData.pendingMessages
        : existingData?.status === 'pending' && typeof existingData.firstMessage === 'string' && existingData.firstMessage
        ? [
            {
              id: `req_initial_${existingData.createdAtMs || nowMs - 1000}`,
              senderId: me,
              text: existingData.firstMessage,
              mediaUrl: null,
              mediaType: null,
              createdAtMs: Number(existingData.createdAtMs || nowMs - 1000),
            },
          ]
        : [];

    const nextMsg: PendingRequestMessage = {
      id: `req_${nowMs}_${Math.random().toString(36).slice(2, 6)}`,
      senderId: me,
      text: displayText,
      mediaUrl: mediaUrl || null,
      mediaType: mediaType || null,
      createdAtMs: nowMs,
    };

    const pendingMessages = [...previousPending, nextMsg].slice(-20);
    const firstMessage = pendingMessages[0]?.text || displayText;

    const payload: Record<string, any> = {
      senderId: me,
      recipientId: recipient.id,
      sender: {
        id: me,
        displayName: (senderProfile?.displayName || auth.currentUser?.displayName || 'Alpha Mate User').slice(0, 120),
        username: (senderProfile?.username || '').slice(0, 64),
        uniqueId: (senderProfile?.uniqueId || '').slice(0, 64),
        avatar: (senderProfile?.avatar || auth.currentUser?.photoURL || '').slice(0, 1024),
      },
      recipient: {
        id: recipient.id,
        displayName: (recipient.displayName || 'Alpha Mate User').slice(0, 120),
        username: (recipient.username || '').slice(0, 64),
        uniqueId: (recipient.uniqueId || '').slice(0, 64),
        avatar: (recipient.avatar || '').slice(0, 1024),
      },
      firstMessage: firstMessage.slice(0, 4000),
      lastMessage: displayText.slice(0, 4000),
      pendingMessages,
      status: 'pending',
      createdAt: existingData?.status === 'pending' && existingData.createdAt ? existingData.createdAt : serverTimestamp(),
      createdAtMs:
        existingData?.status === 'pending' && typeof existingData.createdAtMs === 'number'
          ? existingData.createdAtMs
          : nowMs,
      updatedAt: serverTimestamp(),
      updatedAtMs: nowMs,
    };

    await setDoc(requestRef, payload);
    return { requestId, pendingMessages };
  } catch (error) {
    logAndWrapFirestoreError(error, FirestoreOperationType.WRITE, `chatRequests/${requestId}`);
  }
}

export async function acceptChatRequest(requestId: string) {
  const me = uid();
  const requestRef = doc(db, 'chatRequests', requestId);
  try {
    const snap = await getDoc(requestRef);
    if (!snap.exists() || snap.data().recipientId !== me || snap.data().status !== 'pending') {
      throw new Error('This request is no longer available.');
    }
    const data = snap.data();
    const participants = [data.senderId, data.recipientId].sort();
    const chatId = buildDirectChatId(data.senderId, data.recipientId);
    const chatRef = doc(db, 'chats', chatId);
    const existingChatSnap = await getDoc(chatRef);
    const nowMs = Date.now();

    const rawPending: PendingRequestMessage[] =
      Array.isArray(data.pendingMessages) && data.pendingMessages.length > 0
        ? data.pendingMessages
        : [
            {
              id: `req_initial_${nowMs}`,
              senderId: data.senderId,
              text: String(data.firstMessage || 'Hello!').slice(0, 4000),
              mediaUrl: null,
              mediaType: null,
              createdAtMs: Number(data.createdAtMs || nowMs),
            },
          ];

    const latestMessageText = String(
      rawPending[rawPending.length - 1]?.text || data.lastMessage || data.firstMessage || 'Connected on Alpha Mate'
    ).slice(0, 4000);

    const participantProfiles = {
      [data.senderId]: {
        id: data.senderId,
        displayName: data.sender?.displayName || 'Alpha Mate User',
        username: data.sender?.username || '',
        uniqueId: data.sender?.uniqueId || '',
        avatar: data.sender?.avatar || '',
      },
      [data.recipientId]: {
        id: data.recipientId,
        displayName: data.recipient?.displayName || auth.currentUser?.displayName || 'Alpha Mate User',
        username: data.recipient?.username || '',
        uniqueId: data.recipient?.uniqueId || '',
        avatar: data.recipient?.avatar || auth.currentUser?.photoURL || '',
      },
    };

    const batch = writeBatch(db);
    if (existingChatSnap.exists()) {
      batch.update(chatRef, {
        participantProfiles,
        lastMessage: latestMessageText,
        lastSenderId: data.senderId,
        updatedAt: serverTimestamp(),
        updatedAtMs: nowMs,
        [`unreadBy.${me}`]: 0,
      });
    } else {
      batch.set(chatRef, {
        type: 'direct',
        participantIds: participants,
        participantProfiles,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedAtMs: nowMs,
        lastMessage: latestMessageText,
        lastSenderId: data.senderId,
        unreadBy: { [me]: 0, [data.senderId]: 0 },
      });
    }

    rawPending.slice(0, 20).forEach((item, index) => {
      batch.set(doc(collection(db, 'chats', chatId, 'messages')), {
        senderId: data.senderId,
        text: String(item.text || data.firstMessage || 'Message').slice(0, 4000),
        mediaUrl: item.mediaUrl || null,
        mediaType: item.mediaType || null,
        fromAcceptedRequestId: requestId,
        createdAt: serverTimestamp(),
        createdAtMs: Number(item.createdAtMs || nowMs + index),
        readBy: [data.senderId, me],
        deliveredTo: [me],
        deletedFor: [],
        edited: false,
      });
    });

    batch.update(requestRef, {
      status: 'accepted',
      chatId,
      updatedAt: serverTimestamp(),
      updatedAtMs: nowMs,
    });
    await batch.commit();
    return chatId;
  } catch (error) {
    logAndWrapFirestoreError(error, FirestoreOperationType.WRITE, `chatRequests/${requestId}`);
  }
}

export async function rejectOrBlockChatRequest(requestId: string, block = false) {
  const me = uid();
  const requestRef = doc(db, 'chatRequests', requestId);
  try {
    const snap = await getDoc(requestRef);
    if (!snap.exists() || snap.data().recipientId !== me) throw new Error('Request not found.');
    const batch = writeBatch(db);
    batch.update(requestRef, {
      status: block ? 'blocked' : 'rejected',
      updatedAt: serverTimestamp(),
      updatedAtMs: Date.now(),
    });
    if (block) {
      batch.set(doc(db, 'users', me, 'blockedUsers', snap.data().senderId), {
        userId: snap.data().senderId,
        createdAt: serverTimestamp(),
      });
    }
    await batch.commit();
  } catch (error) {
    logAndWrapFirestoreError(error, FirestoreOperationType.UPDATE, `chatRequests/${requestId}`);
  }
}

export async function createGroupChat(name: string, members: ChatProfile[]) {
  const me = uid();
  if (!name.trim() || !members.length) throw new Error('A group name and at least one member are required.');
  const unique = Array.from(
    new Map(
      [
        {
          id: me,
          displayName: auth.currentUser?.displayName || 'Alpha Mate User',
          avatar: auth.currentUser?.photoURL || '',
        },
        ...members,
      ].map((m) => [
        m.id,
        {
          id: m.id,
          displayName: m.displayName || 'Alpha Mate User',
          username: m.username || '',
          avatar: m.avatar || '',
        },
      ])
    ).values()
  );
  const chatRef = doc(collection(db, 'chats'));
  const batch = writeBatch(db);
  const nowMs = Date.now();
  batch.set(chatRef, {
    type: 'group',
    groupName: name.trim().slice(0, 60),
    ownerId: me,
    participantIds: unique.map((m) => m.id),
    participantProfiles: Object.fromEntries(unique.map((m) => [m.id, m])),
    memberStatus: Object.fromEntries(unique.map((m) => [m.id, m.id === me ? 'joined' : 'invited'])),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedAtMs: nowMs,
    lastMessage: 'Group invitation sent',
  });
  unique
    .filter((m) => m.id !== me)
    .forEach((member) =>
      batch.set(doc(db, 'groupInvites', `${chatRef.id}_${safeChatIdSegment(member.id)}`), {
        chatId: chatRef.id,
        groupName: name.trim().slice(0, 60),
        inviterId: me,
        inviteeId: member.id,
        status: 'pending',
        createdAt: serverTimestamp(),
      })
    );
  try {
    await batch.commit();
    return chatRef.id;
  } catch (error) {
    logAndWrapFirestoreError(error, FirestoreOperationType.CREATE, `chats/${chatRef.id}`);
  }
}

export function subscribeToMyGroupInvites(callback: (items: any[]) => void, onError?: (error: Error) => void) {
  const me = uid();
  const q = query(collection(db, 'groupInvites'), where('inviteeId', '==', me), limit(100));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((item: any) => item.status === 'pending')
        .sort((a: any, b: any) => getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt));
      callback(items);
    },
    (e) => {
      if (isFirestoreQuotaExceededError(e)) notifyFirestoreQuotaExceeded();
      console.error('subscribeToMyGroupInvites error:', e);
      onError?.(e);
    }
  );
}

export async function respondToGroupInvite(chatId: string, accept: boolean) {
  const me = uid();
  const batch = writeBatch(db);
  batch.update(doc(db, 'groupInvites', `${chatId}_${safeChatIdSegment(me)}`), {
    status: accept ? 'accepted' : 'declined',
    respondedAt: serverTimestamp(),
  });
  batch.update(doc(db, 'chats', chatId), {
    [`memberStatus.${me}`]: accept ? 'joined' : 'declined',
    updatedAt: serverTimestamp(),
    updatedAtMs: Date.now(),
  });
  try {
    await batch.commit();
  } catch (error) {
    logAndWrapFirestoreError(error, FirestoreOperationType.UPDATE, `chats/${chatId}`);
  }
}

export async function sendChatMessage(chatId: string, payload: ChatPayload, otherParticipantIds: string[] = []) {
  const me = uid();
  if (!payload.text?.trim() && !payload.mediaUrl && !payload.linkUrl) throw new Error('Message is empty.');
  const chatRef = doc(db, 'chats', chatId);
  const msgRef = doc(collection(db, 'chats', chatId, 'messages'));
  const text = (payload.text || '').trim().slice(0, 4000);
  const nowMs = Date.now();
  const batch = writeBatch(db);
  batch.set(msgRef, {
    senderId: me,
    text,
    mediaUrl: payload.mediaUrl || null,
    mediaType: payload.mediaType || null,
    linkUrl: payload.linkUrl || null,
    replyTo: payload.replyTo || null,
    createdAt: serverTimestamp(),
    createdAtMs: nowMs,
    readBy: [me],
    deliveredTo: [],
    deletedFor: [],
    edited: false,
  });

  const chatUpdate: Record<string, any> = {
    lastMessage: text || payload.mediaType || 'Attachment',
    lastSenderId: me,
    updatedAt: serverTimestamp(),
    updatedAtMs: nowMs,
  };
  otherParticipantIds.forEach((otherId) => {
    if (otherId && otherId !== me) {
      chatUpdate[`unreadBy.${otherId}`] = increment(1);
    }
  });
  batch.update(chatRef, chatUpdate);
  try {
    await batch.commit();
    return msgRef.id;
  } catch (error) {
    logAndWrapFirestoreError(error, FirestoreOperationType.WRITE, `chats/${chatId}/messages/${msgRef.id}`);
  }
}

export async function uploadChatMedia(chatId: string, file: File) {
  uid();
  const max = file.type.startsWith('video/') ? 50 * 1024 * 1024 : 20 * 1024 * 1024;
  if (file.size > max) throw new Error(`File is too large. Maximum ${max / 1024 / 1024} MB.`);
  const path = `chatMedia/${safeChatIdSegment(chatId)}/${uid()}/${Date.now()}_${safeChatIdSegment(file.name)}`;
  const objectRef = ref(storage, path);
  await uploadBytes(objectRef, file, { contentType: file.type });
  return getDownloadURL(objectRef);
}

export async function markChatMessageRead(chatId: string, messageId: string) {
  const me = uid();
  await updateDoc(doc(db, 'chats', chatId, 'messages', messageId), { readBy: arrayUnion(me) });
}

export async function editChatMessage(chatId: string, messageId: string, text: string) {
  const me = uid();
  const messageRef = doc(db, 'chats', chatId, 'messages', messageId);
  const snap = await getDoc(messageRef);
  if (!snap.exists() || snap.data().senderId !== me) throw new Error('Only your own messages can be edited.');
  await updateDoc(messageRef, { text: text.trim().slice(0, 4000), edited: true, editedAt: serverTimestamp() });
}

export async function deleteChatMessage(chatId: string, messageId: string, everyone = false) {
  const me = uid();
  const messageRef = doc(db, 'chats', chatId, 'messages', messageId);
  const snap = await getDoc(messageRef);
  if (!snap.exists()) return;
  if (everyone) {
    if (snap.data().senderId !== me) throw new Error('Only the sender can delete for everyone.');
    await updateDoc(messageRef, {
      text: '',
      mediaUrl: null,
      linkUrl: null,
      deletedForEveryone: true,
      deletedAt: serverTimestamp(),
    });
  } else {
    await updateDoc(messageRef, { deletedFor: arrayUnion(me) });
  }
}

export async function setChatPresence(isOnline: boolean) {
  if (isFirestoreQuotaExceeded()) return;
  const me = uid();
  try {
    await setDoc(doc(db, 'presence', me), { userId: me, online: isOnline, lastSeen: serverTimestamp() }, { merge: true });
  } catch (err) {
    if (isFirestoreQuotaExceededError(err)) {
      notifyFirestoreQuotaExceeded();
      return;
    }
    throw err;
  }
}

export function subscribeToChatPresence(userId: string, callback: (online: boolean, lastSeen?: any) => void) {
  return onSnapshot(
    doc(db, 'presence', userId),
    (snap) => callback(!!snap.data()?.online, snap.data()?.lastSeen),
    (err) => {
      if (isFirestoreQuotaExceededError(err)) notifyFirestoreQuotaExceeded();
    }
  );
}
