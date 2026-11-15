import { auth, db } from './firebase';
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

/** Firestore-backed chat primitives. All operations require a Firebase-authenticated user. */
const storage = getStorage();
const uid = () => {
  const value = auth.currentUser?.uid;
  if (!value) throw new Error('Please sign in with your Firebase account to use chat.');
  return value;
};
const safeId = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);

export async function uploadPartyRoomCover(file: File): Promise<string> {
  const me = uid();
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.');
  if (file.size > 5 * 1024 * 1024) throw new Error('Room cover must be 5 MB or smaller.');
  const path = `partyRoomCovers/${me}/${Date.now()}_${safeId(file.name)}`;
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
  const term = searchTerm.trim().toLowerCase().replace(/^@/, '');
  const usersRef = collection(db, 'users');
  const byId = new Map<string, ChatProfile>();

  if (term.length >= 1) {
    const end = `${term}\uf8ff`;
    const fields = ['usernameLower', 'displayNameLower', 'uniqueIdLower'];
    const snapshots = await Promise.all(
      fields.map((field) =>
        getDocs(query(usersRef, where(field, '>=', term), where(field, '<=', end), limit(maxResults))).catch(() => null)
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

  // Fallback / broad directory scan so 1-letter queries, substring matches, and older accounts always appear
  if (byId.size < maxResults) {
    const broadSnap = await getDocs(query(usersRef, limit(180))).catch(() => null);
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
  const q = query(collection(db, 'chats'), where('participantIds', 'array-contains', me), orderBy('updatedAt', 'desc'), limit(100));
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), (e) => onError?.(e));
}

export function subscribeToChatMessages(chatId: string, callback: (items: any[]) => void, onError?: (error: Error) => void) {
  uid();
  const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'asc'), limit(300));
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), (e) => onError?.(e));
}

export function subscribeToMyChatRequests(callback: (items: any[]) => void, onError?: (error: Error) => void) {
  const me = uid();
  const q = query(collection(db, 'chatRequests'), where('recipientId', '==', me), where('status', '==', 'pending'), orderBy('createdAt', 'desc'), limit(100));
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), (e) => onError?.(e));
}

/**
 * Create or return an existing 1:1 direct Firestore chat thread immediately.
 */
export async function getOrCreateDirectChat(meProfile: ChatProfile, targetProfile: ChatProfile): Promise<string> {
  const me = uid();
  if (!targetProfile.id || targetProfile.id === me) {
    throw new Error('Cannot start chat with yourself.');
  }
  const participants = [me, targetProfile.id].sort();
  const chatId = `dm_${participants.map(safeId).join('_')}`;
  const chatRef = doc(db, 'chats', chatId);
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
      lastMessage: 'Connected on Alpha Mate',
      lastSenderId: me,
      unreadBy: { [me]: 0, [targetProfile.id]: 0 },
    });
  }
  return chatId;
}

export async function markChatAsRead(chatId: string) {
  const me = uid();
  await updateDoc(doc(db, 'chats', chatId), {
    [`unreadBy.${me}`]: 0,
  }).catch(() => {});
}

export async function sendChatRequest(recipient: ChatProfile, firstMessage: string) {
  const me = uid();
  if (!firstMessage.trim()) throw new Error('Write a message first.');
  if (recipient.id === me) throw new Error('You cannot message yourself.');
  const requestId = `${safeId(recipient.id)}_${safeId(me)}`;
  const requestRef = doc(db, 'chatRequests', requestId);
  await setDoc(
    requestRef,
    {
      senderId: me,
      recipientId: recipient.id,
      sender: { id: me, displayName: auth.currentUser?.displayName || 'Alpha Mate User', avatar: auth.currentUser?.photoURL || '' },
      recipient: {
        id: recipient.id,
        displayName: recipient.displayName || 'Alpha Mate User',
        username: recipient.username || '',
        avatar: recipient.avatar || '',
      },
      firstMessage: firstMessage.trim().slice(0, 4000),
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
  return requestId;
}

export async function acceptChatRequest(requestId: string) {
  const me = uid();
  const requestRef = doc(db, 'chatRequests', requestId);
  const snap = await getDoc(requestRef);
  if (!snap.exists() || snap.data().recipientId !== me || snap.data().status !== 'pending') {
    throw new Error('This request is no longer available.');
  }
  const data = snap.data();
  const participants = [data.senderId, data.recipientId].sort();
  const chatId = `dm_${participants.map(safeId).join('_')}`;
  const batch = writeBatch(db);
  batch.set(
    doc(db, 'chats', chatId),
    {
      type: 'direct',
      participantIds: participants,
      participantProfiles: { [data.senderId]: data.sender, [data.recipientId]: data.recipient },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastMessage: data.firstMessage,
      lastSenderId: data.senderId,
      unreadBy: { [me]: 1, [data.senderId]: 0 },
    },
    { merge: true }
  );
  batch.set(doc(collection(db, 'chats', chatId, 'messages')), {
    senderId: data.senderId,
    text: data.firstMessage,
    type: 'text',
    createdAt: serverTimestamp(),
    readBy: [data.senderId],
    deliveredTo: [data.recipientId],
    deletedFor: [],
    edited: false,
  });
  batch.update(requestRef, { status: 'accepted', chatId, updatedAt: serverTimestamp() });
  await batch.commit();
  return chatId;
}

export async function rejectOrBlockChatRequest(requestId: string, block = false) {
  const me = uid();
  const requestRef = doc(db, 'chatRequests', requestId);
  const snap = await getDoc(requestRef);
  if (!snap.exists() || snap.data().recipientId !== me) throw new Error('Request not found.');
  const batch = writeBatch(db);
  batch.update(requestRef, { status: block ? 'blocked' : 'rejected', updatedAt: serverTimestamp() });
  if (block) {
    batch.set(doc(db, 'users', me, 'blockedUsers', snap.data().senderId), {
      userId: snap.data().senderId,
      createdAt: serverTimestamp(),
    });
  }
  await batch.commit();
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
  batch.set(chatRef, {
    type: 'group',
    groupName: name.trim().slice(0, 60),
    ownerId: me,
    participantIds: unique.map((m) => m.id),
    participantProfiles: Object.fromEntries(unique.map((m) => [m.id, m])),
    memberStatus: Object.fromEntries(unique.map((m) => [m.id, m.id === me ? 'joined' : 'invited'])),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastMessage: 'Group invitation sent',
  });
  unique
    .filter((m) => m.id !== me)
    .forEach((member) =>
      batch.set(doc(db, 'groupInvites', `${chatRef.id}_${safeId(member.id)}`), {
        chatId: chatRef.id,
        groupName: name.trim().slice(0, 60),
        inviterId: me,
        inviteeId: member.id,
        status: 'pending',
        createdAt: serverTimestamp(),
      })
    );
  await batch.commit();
  return chatRef.id;
}

export function subscribeToMyGroupInvites(callback: (items: any[]) => void, onError?: (error: Error) => void) {
  const me = uid();
  const q = query(collection(db, 'groupInvites'), where('inviteeId', '==', me), where('status', '==', 'pending'), orderBy('createdAt', 'desc'), limit(100));
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), (e) => onError?.(e));
}

export async function respondToGroupInvite(chatId: string, accept: boolean) {
  const me = uid();
  const batch = writeBatch(db);
  batch.update(doc(db, 'groupInvites', `${chatId}_${safeId(me)}`), {
    status: accept ? 'accepted' : 'declined',
    respondedAt: serverTimestamp(),
  });
  batch.update(doc(db, 'chats', chatId), {
    [`memberStatus.${me}`]: accept ? 'joined' : 'declined',
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}

export async function sendChatMessage(chatId: string, payload: ChatPayload, otherParticipantIds: string[] = []) {
  const me = uid();
  if (!payload.text?.trim() && !payload.mediaUrl && !payload.linkUrl) throw new Error('Message is empty.');
  const chatRef = doc(db, 'chats', chatId);
  const msgRef = doc(collection(db, 'chats', chatId, 'messages'));
  const text = (payload.text || '').trim().slice(0, 4000);
  const batch = writeBatch(db);
  batch.set(msgRef, {
    senderId: me,
    text,
    mediaUrl: payload.mediaUrl || null,
    mediaType: payload.mediaType || null,
    linkUrl: payload.linkUrl || null,
    replyTo: payload.replyTo || null,
    createdAt: serverTimestamp(),
    readBy: [me],
    deliveredTo: [],
    deletedFor: [],
    edited: false,
  });

  const chatUpdate: Record<string, any> = {
    lastMessage: text || payload.mediaType || 'Attachment',
    lastSenderId: me,
    updatedAt: serverTimestamp(),
  };
  otherParticipantIds.forEach((otherId) => {
    if (otherId && otherId !== me) {
      chatUpdate[`unreadBy.${otherId}`] = increment(1);
    }
  });
  batch.update(chatRef, chatUpdate);
  await batch.commit();
  return msgRef.id;
}

export async function uploadChatMedia(chatId: string, file: File) {
  uid();
  const max = file.type.startsWith('video/') ? 50 * 1024 * 1024 : 20 * 1024 * 1024;
  if (file.size > max) throw new Error(`File is too large. Maximum ${max / 1024 / 1024} MB.`);
  const path = `chatMedia/${chatId}/${uid()}/${Date.now()}_${safeId(file.name)}`;
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
  const me = uid();
  await setDoc(doc(db, 'presence', me), { userId: me, online: isOnline, lastSeen: serverTimestamp() }, { merge: true });
}

export function subscribeToChatPresence(userId: string, callback: (online: boolean, lastSeen?: any) => void) {
  return onSnapshot(doc(db, 'presence', userId), (snap) => callback(!!snap.data()?.online, snap.data()?.lastSeen));
}
