import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { PullToRefresh, RefreshScopeButton } from '../components/common/PullToRefresh';
import {
  acceptChatRequest,
  rejectOrBlockChatRequest,
  subscribeToMyChatRequests,
  subscribeToMySentChatRequests,
  subscribeToMyChats,
  subscribeToChatMessages,
  createGroupChat,
  sendChatMessage,
  sendChatRequest,
  setChatPresence,
  uploadChatMedia,
  markChatMessageRead,
  markChatAsRead,
  deleteChatMessage,
  editChatMessage,
  subscribeToMyGroupInvites,
  respondToGroupInvite,
  searchFirebaseUsers,
  buildDirectChatId,
  getFriendlyChatErrorMessage,
  PendingRequestMessage,
} from '../services/chatService';
import { auth } from '../services/firebase';
import { Conversation, User, ChatMessage } from '../types';
import {
  Search,
  Users,
  ArrowLeft,
  Send,
  Image as ImageIcon,
  Mic,
  Smile,
  CheckCheck,
  Clock,
  Phone,
  Video,
  MoreVertical,
  Camera,
  X,
  Plus,
  MessageCircle,
  ShieldCheck,
  Ban,
  Trash2,
  Pencil,
  Reply,
  Check,
  FileVideo,
  Link as LinkIcon,
  PhoneCall,
  UserPlus,
  UserCheck,
  Eye,
  RotateCcw,
} from 'lucide-react';
import {
  GEMINI_ASSISTANT_AVATAR,
  GEMINI_ASSISTANT_CONVERSATION_ID,
  GEMINI_ASSISTANT_HANDLE,
  GEMINI_ASSISTANT_NAME,
  GEMINI_ASSISTANT_PUBLIC_ID,
  GEMINI_ASSISTANT_USER_ID,
  GeminiInboxMessage,
  clearInboxBotHistory,
  loadInboxBotHistory,
  requestGeminiChat,
  requestGeminiWelcome,
  saveInboxBotHistory,
} from '../services/geminiChatService';

type LocalMessage = ChatMessage & {
  replyTo?: string;
  deletedForEveryone?: boolean;
  edited?: boolean;
  pendingApproval?: boolean;
  kind?: 'text' | 'image' | 'video' | 'audio' | 'link';
};

type RequestItem = {
  id: string;
  senderId: string;
  recipientId: string;
  user: User;
  message: string;
  time: string;
  messages: LocalMessage[];
};

const EMOJIS = ['💜', '❤️', '😂', '😍', '🔥', '👑', '🎉', '🥰', '👏', '✨', '🌹', '👍'];

const FALLBACK_AVATAR =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#7928CA"/><stop offset="100%" stop-color="#EC4899"/></linearGradient></defs><rect width="96" height="96" rx="48" fill="url(#g)"/><circle cx="48" cy="36" r="16" fill="rgba(255,255,255,0.9)"/><path d="M20 82c4-15 16-24 28-24s24 9 28 24" fill="rgba(255,255,255,0.9)"/></svg>`
  );

function mapPendingMessagesToLocal(
  rawPending: PendingRequestMessage[] | undefined,
  fallbackText: string,
  senderId: string,
  senderName: string,
  senderAvatar: string,
  isMe: boolean
): LocalMessage[] {
  if (Array.isArray(rawPending) && rawPending.length > 0) {
    return rawPending.map((pm, idx) => ({
      id: pm.id || `pending_${idx}`,
      senderId: pm.senderId || senderId,
      senderName,
      senderAvatar: senderAvatar || FALLBACK_AVATAR,
      text: pm.text || '',
      imageUrl: pm.mediaUrl || undefined,
      timestamp: pm.createdAtMs
        ? new Date(pm.createdAtMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : 'Just now',
      isRead: false,
      isMe,
      pendingApproval: true,
    }));
  }
  if (!fallbackText) return [];
  return [
    {
      id: `pending_first_${senderId}`,
      senderId,
      senderName,
      senderAvatar: senderAvatar || FALLBACK_AVATAR,
      text: fallbackText,
      timestamp: 'Just now',
      isRead: false,
      isMe,
      pendingApproval: true,
    },
  ];
}

export const ChatScreen: React.FC = () => {
  const {
    conversations,
    activeConversation,
    openConversation,
    sendMessage,
    currentUser,
    realUsers,
    registeredUsers,
    followingUserIds,
    followerUserIds,
    toggleFollowUser,
    openPublicUserProfile,
    sendNotificationToUser,
    refreshScope,
    chatRefreshEpoch,
    userSyncRefreshEpoch,
  } = useApp();

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => setToastMsg((curr) => (curr === msg ? null : curr)), 3200);
  };

  const [tab, setTab] = useState<'chats' | 'requests'>('chats');
  const [filter, setFilter] = useState<'all' | 'direct' | 'groups'>('all');
  const [query, setQuery] = useState('');
  const [newModalQuery, setNewModalQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [sentRequests, setSentRequests] = useState<RequestItem[]>([]);
  const [optimisticSentByPartner, setOptimisticSentByPartner] = useState<Record<string, LocalMessage[]>>({});
  const [sendingRequest, setSendingRequest] = useState(false);
  const [approvingRequestId, setApprovingRequestId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [showGroup, setShowGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [menuMessage, setMenuMessage] = useState<LocalMessage | null>(null);
  const [replyTo, setReplyTo] = useState<LocalMessage | null>(null);
  const [editMessage, setEditMessage] = useState<LocalMessage | null>(null);
  const [showAttach, setShowAttach] = useState(false);
  const [callState, setCallState] = useState<'idle' | 'voice' | 'video'>('idle');
  const [localGroups, setLocalGroups] = useState<Conversation[]>([]);
  const [firebaseChats, setFirebaseChats] = useState<Conversation[]>([]);
  const [firebaseMessages, setFirebaseMessages] = useState<LocalMessage[]>([]);
  const [foundUsers, setFoundUsers] = useState<User[]>([]);
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const [groupInvites, setGroupInvites] = useState<any[]>([]);
  const [geminiInboxMessages, setGeminiInboxMessages] = useState<GeminiInboxMessage[]>(() =>
    loadInboxBotHistory(currentUser.id)
  );
  const [geminiReplying, setGeminiReplying] = useState(false);
  const [geminiWelcoming, setGeminiWelcoming] = useState(false);
  const [geminiError, setGeminiError] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const messagesScrollRef = useRef<HTMLElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const geminiWelcomedUserRef = useRef<string | null>(null);
  const geminiLastFailedPromptRef = useRef<string | null>(null);

  // Sync per-user persisted Gemini Inbox history when signed-in user switches
  useEffect(() => {
    const stored = loadInboxBotHistory(currentUser.id);
    setGeminiInboxMessages(stored);
    setGeminiError(null);
  }, [currentUser.id]);

  // Automatically welcome every user in their Inbox when their Alpha AI thread is empty
  useEffect(() => {
    if (!currentUser.id) return;
    if (geminiInboxMessages.length > 0) {
      geminiWelcomedUserRef.current = currentUser.id;
      return;
    }
    if (geminiWelcomedUserRef.current === currentUser.id) return;
    geminiWelcomedUserRef.current = currentUser.id;

    let cancelled = false;
    setGeminiWelcoming(true);
    requestGeminiWelcome({
      userName: currentUser.displayName || 'Friend',
      roomType: 'inbox',
      isSelf: true,
      vipTier: currentUser.vipTier ?? 0,
    })
      .then(({ text, model }) => {
        if (cancelled) return;
        const welcomeEntry: GeminiInboxMessage = {
          id: `gemini_welcome_${Date.now()}`,
          role: 'model',
          text,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          createdAtMs: Date.now(),
          model,
          isWelcome: true,
        };
        setGeminiInboxMessages((prev) => {
          if (prev.length > 0) return prev;
          const next = [welcomeEntry];
          saveInboxBotHistory(currentUser.id, next);
          return next;
        });
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn('[Gemini Inbox Welcome]', err?.message || err);
      })
      .finally(() => {
        if (!cancelled) setGeminiWelcoming(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentUser.id, currentUser.displayName, currentUser.vipTier, geminiInboxMessages.length]);

  const directoryUsers = useMemo(
    () => (realUsers.length > 0 ? realUsers : registeredUsers).filter((u) => u.id && u.id !== currentUser.id),
    [realUsers, registeredUsers, currentUser.id]
  );

  // Real-time Firestore Chat Requests (incoming & outgoing), Conversations, Group Invites & Presence
  useEffect(() => {
    if (!auth.currentUser?.uid || auth.currentUser.uid !== currentUser.id) return;
    let unsubscribeRequests: (() => void) | undefined;
    let unsubscribeSentRequests: (() => void) | undefined;
    let unsubscribeChats: (() => void) | undefined;
    let unsubscribeGroupInvites: (() => void) | undefined;
    try {
      unsubscribeRequests = subscribeToMyChatRequests((items) =>
        setRequests(
          items.map((item: any) => {
            const senderId = item.sender?.id || item.senderId || '';
            const senderName = item.sender?.displayName || 'Alpha Mate User';
            const senderAvatar = item.sender?.avatar || FALLBACK_AVATAR;
            const latestMsg = item.lastMessage || item.firstMessage || '';
            return {
              id: item.id,
              senderId,
              recipientId: item.recipientId || currentUser.id,
              user: {
                id: senderId,
                uniqueId: item.sender?.uniqueId || '',
                displayName: senderName,
                username: item.sender?.username || '',
                avatar: senderAvatar,
                followersCount: 0,
                followingCount: 0,
                likesCount: 0,
                level: 1,
                xp: 0,
                nextLevelXp: 1000,
                vipTier: 0,
                coins: 0,
                diamonds: 0,
              } as User,
              message: latestMsg,
              time: item.updatedAt?.toDate?.()?.toLocaleTimeString?.([], { hour: '2-digit', minute: '2-digit' }) ||
                item.createdAt?.toDate?.()?.toLocaleTimeString?.([], { hour: '2-digit', minute: '2-digit' }) ||
                'Just now',
              messages: mapPendingMessagesToLocal(
                item.pendingMessages,
                item.firstMessage || '',
                senderId,
                senderName,
                senderAvatar,
                false
              ),
            };
          })
        )
      );

      unsubscribeSentRequests = subscribeToMySentChatRequests((items) =>
        setSentRequests(
          items.map((item: any) => {
            const recipientId = item.recipient?.id || item.recipientId || '';
            const recipientName = item.recipient?.displayName || 'Alpha Mate User';
            const recipientAvatar = item.recipient?.avatar || FALLBACK_AVATAR;
            const latestMsg = item.lastMessage || item.firstMessage || '';
            return {
              id: item.id,
              senderId: currentUser.id,
              recipientId,
              user: {
                id: recipientId,
                uniqueId: item.recipient?.uniqueId || '',
                displayName: recipientName,
                username: item.recipient?.username || '',
                avatar: recipientAvatar,
                followersCount: 0,
                followingCount: 0,
                likesCount: 0,
                level: 1,
                xp: 0,
                nextLevelXp: 1000,
                vipTier: 0,
                coins: 0,
                diamonds: 0,
              } as User,
              message: latestMsg,
              time: item.updatedAt?.toDate?.()?.toLocaleTimeString?.([], { hour: '2-digit', minute: '2-digit' }) ||
                item.createdAt?.toDate?.()?.toLocaleTimeString?.([], { hour: '2-digit', minute: '2-digit' }) ||
                'Just now',
              messages: mapPendingMessagesToLocal(
                item.pendingMessages,
                item.firstMessage || '',
                currentUser.id,
                currentUser.displayName,
                currentUser.avatar,
                true
              ),
            };
          })
        )
      );

      unsubscribeChats = subscribeToMyChats((items) =>
        setFirebaseChats(
          items.map((item: any) => {
            const otherId = (item.participantIds || []).find((id: string) => id !== currentUser.id);
            const profile = item.participantProfiles?.[otherId] || {};
            const directoryFallback = directoryUsers.find((u) => u.id === otherId);
            const isGroup = item.type === 'group';
            return {
              id: item.id,
              inviteStatus: item.memberStatus?.[currentUser.id],
              requestStatus: 'connected',
              user: {
                id: otherId || currentUser.id,
                uniqueId: profile.uniqueId || directoryFallback?.uniqueId || '',
                displayName: profile.displayName || directoryFallback?.displayName || 'Alpha Mate User',
                username: profile.username || directoryFallback?.username || '',
                avatar: profile.avatar || directoryFallback?.avatar || FALLBACK_AVATAR,
                followersCount: directoryFallback?.followersCount || 0,
                followingCount: directoryFallback?.followingCount || 0,
                likesCount: directoryFallback?.likesCount || 0,
                level: directoryFallback?.level || 1,
                xp: 0,
                nextLevelXp: 1000,
                vipTier: directoryFallback?.vipTier || 0,
                coins: 0,
                diamonds: 0,
              } as User,
              groupName: item.groupName,
              isGroup,
              groupMembers: Object.entries(item.participantProfiles || {}).map(
                ([id, value]: any) => ({ id, ...value } as User)
              ),
              lastMessage: item.lastMessage || '',
              lastTimestamp:
                item.updatedAt?.toDate?.()?.toLocaleTimeString?.([], { hour: '2-digit', minute: '2-digit' }) ||
                'Just now',
              unreadCount: Number(item.unreadBy?.[currentUser.id] || 0),
              messages: [],
            } as Conversation;
          })
        )
      );
      unsubscribeGroupInvites = subscribeToMyGroupInvites(setGroupInvites);
      setChatPresence(true).catch(() => {});
    } catch (error) {
      console.warn('Chat listener unavailable:', error);
    }

    const handleOffline = () => setChatPresence(false).catch(() => {});
    window.addEventListener('pagehide', handleOffline);
    return () => {
      unsubscribeRequests?.();
      unsubscribeSentRequests?.();
      unsubscribeChats?.();
      unsubscribeGroupInvites?.();
      window.removeEventListener('pagehide', handleOffline);
      setChatPresence(false).catch(() => {});
    };
  }, [currentUser.id, chatRefreshEpoch]);

  // Clear optimistic pending request bubbles once real-time Firestore chat or sentRequest catches up
  useEffect(() => {
    setOptimisticSentByPartner((prev) => {
      const next = { ...prev };
      let changed = false;
      Object.keys(next).forEach((partnerId) => {
        const isNowConnected = firebaseChats.some((c) => !c.isGroup && c.user?.id === partnerId);
        const remotePending = sentRequests.find((r) => r.recipientId === partnerId);
        if (isNowConnected || (remotePending && remotePending.messages.length >= next[partnerId].length)) {
          delete next[partnerId];
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [firebaseChats, sentRequests]);

  const isGeminiConversation = activeConversation?.id === GEMINI_ASSISTANT_CONVERSATION_ID;

  // Resolve whether activeConversation is an approved Firestore chat, an incoming pending request, or a new/outgoing request
  const approvedActiveChat = useMemo(() => {
    if (!activeConversation || isGeminiConversation) return undefined;
    if (activeConversation.isGroup) {
      return firebaseChats.find((c) => c.id === activeConversation.id);
    }
    const partnerId = activeConversation.user?.id;
    return firebaseChats.find(
      (c) => c.id === activeConversation.id || (!c.isGroup && partnerId && c.user?.id === partnerId)
    );
  }, [activeConversation, isGeminiConversation, firebaseChats]);

  const effectiveApprovedChatId = approvedActiveChat?.id || null;
  const isApprovedFirestoreChat = Boolean(effectiveApprovedChatId);

  const activeIncomingRequest = useMemo(() => {
    if (!activeConversation || activeConversation.isGroup || isApprovedFirestoreChat || isGeminiConversation) return undefined;
    const partnerId = activeConversation.user?.id;
    if (!partnerId) return undefined;
    return requests.find((r) => r.user.id === partnerId || r.senderId === partnerId);
  }, [activeConversation, isApprovedFirestoreChat, isGeminiConversation, requests]);

  const activeOutgoingRequest = useMemo(() => {
    if (!activeConversation || activeConversation.isGroup || isApprovedFirestoreChat || isGeminiConversation) return undefined;
    const partnerId = activeConversation.user?.id;
    if (!partnerId) return undefined;
    return sentRequests.find((r) => r.recipientId === partnerId || r.user.id === partnerId);
  }, [activeConversation, isApprovedFirestoreChat, isGeminiConversation, sentRequests]);

  // Real-time Firestore messages listener ONLY when the chat is actually approved/created in `chats`
  useEffect(() => {
    if (!effectiveApprovedChatId || !auth.currentUser || auth.currentUser.uid !== currentUser.id) {
      setFirebaseMessages([]);
      return;
    }

    markChatAsRead(effectiveApprovedChatId).catch(() => {});

    return subscribeToChatMessages(effectiveApprovedChatId, (items) => {
      items.forEach((m: any) => {
        if (m.senderId !== currentUser.id && !(m.readBy || []).includes(currentUser.id)) {
          markChatMessageRead(effectiveApprovedChatId, m.id).catch(() => {});
        }
      });
      setFirebaseMessages(
        items
          .filter((m: any) => !(m.deletedFor || []).includes(currentUser.id))
          .map(
            (m: any) =>
              ({
                id: m.id,
                senderId: m.senderId,
                senderName:
                  m.senderId === currentUser.id
                    ? currentUser.displayName
                    : activeConversation?.user?.displayName || 'Member',
                senderAvatar:
                  m.senderId === currentUser.id
                    ? currentUser.avatar || FALLBACK_AVATAR
                    : activeConversation?.user?.avatar || FALLBACK_AVATAR,
                text: m.deletedForEveryone ? 'This message was deleted' : m.text || '',
                imageUrl: m.mediaUrl || undefined,
                timestamp:
                  m.createdAt?.toDate?.()?.toLocaleTimeString?.([], { hour: '2-digit', minute: '2-digit' }) ||
                  'Just now',
                isRead: (m.readBy || []).length > 1,
                isMe: m.senderId === currentUser.id,
                edited: !!m.edited,
                replyTo: m.replyTo,
              } as LocalMessage)
          )
      );
    });
  }, [effectiveApprovedChatId, activeConversation?.user?.displayName, activeConversation?.user?.avatar, currentUser.id, chatRefreshEpoch]);

  // Auto-focus typing input when a conversation opens so mobile keypad / cursor is ready immediately
  useEffect(() => {
    if (!activeConversation?.id) return;
    const focusTimer = window.setTimeout(() => {
      messageInputRef.current?.focus();
    }, 80);
    return () => window.clearTimeout(focusTimer);
  }, [activeConversation?.id]);

  // Compute displayed messages for active conversation
  const activeDisplayedMessages = useMemo<LocalMessage[]>(() => {
    if (!activeConversation) return [];
    if (isGeminiConversation) {
      return geminiInboxMessages.map((m) => ({
        id: m.id,
        senderId: m.role === 'user' ? currentUser.id : GEMINI_ASSISTANT_USER_ID,
        senderName: m.role === 'user' ? currentUser.displayName : GEMINI_ASSISTANT_NAME,
        senderAvatar: m.role === 'user' ? currentUser.avatar || FALLBACK_AVATAR : GEMINI_ASSISTANT_AVATAR,
        text: m.text,
        timestamp: m.timestamp,
        isRead: true,
        isMe: m.role === 'user',
      }));
    }
    if (isApprovedFirestoreChat) {
      return firebaseMessages;
    }
    const partnerId = activeConversation.user?.id || '';
    if (activeIncomingRequest) {
      return activeIncomingRequest.messages;
    }
    const remoteOutgoing = activeOutgoingRequest?.messages || [];
    const localOptimistic = partnerId ? optimisticSentByPartner[partnerId] || [] : [];
    if (remoteOutgoing.length > 0 || localOptimistic.length > 0) {
      const seenTexts = new Set(remoteOutgoing.map((m) => `${m.text}_${m.imageUrl || ''}`));
      const unsyncedOptimistic = localOptimistic.filter((m) => !seenTexts.has(`${m.text}_${m.imageUrl || ''}`));
      return [...remoteOutgoing, ...unsyncedOptimistic];
    }
    return (activeConversation.messages || []) as LocalMessage[];
  }, [
    activeConversation,
    isGeminiConversation,
    geminiInboxMessages,
    currentUser.id,
    currentUser.displayName,
    currentUser.avatar,
    isApprovedFirestoreChat,
    firebaseMessages,
    activeIncomingRequest,
    activeOutgoingRequest,
    optimisticSentByPartner,
  ]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeDisplayedMessages.length, activeConversation?.id, geminiReplying]);

  // Pinned Gemini Assistant conversation present in every user's Inbox
  const geminiAssistantConversation = useMemo<Conversation>(() => {
    const latest = geminiInboxMessages[geminiInboxMessages.length - 1];
    return {
      id: GEMINI_ASSISTANT_CONVERSATION_ID,
      user: {
        id: GEMINI_ASSISTANT_USER_ID,
        uniqueId: GEMINI_ASSISTANT_PUBLIC_ID,
        username: GEMINI_ASSISTANT_HANDLE,
        displayName: GEMINI_ASSISTANT_NAME,
        avatar: GEMINI_ASSISTANT_AVATAR,
        bio: 'Built-in Alpha Mate Gemini Assistant',
        followersCount: 0,
        followingCount: 0,
        likesCount: 0,
        level: 99,
        xp: 0,
        nextLevelXp: 1000,
        vipTier: 0,
        coins: 0,
        diamonds: 0,
        isVerified: true,
      },
      lastMessage: latest?.text || (geminiWelcoming ? 'Preparing your welcome...' : 'Ask anything · Multi-turn Gemini chat'),
      lastTimestamp: latest?.timestamp || 'Now',
      unreadCount: 0,
      isGroup: false,
      requestStatus: 'connected',
      messages: [],
    };
  }, [geminiInboxMessages, geminiWelcoming]);

  // Outgoing pending requests converted to Conversation items for the sender's Chats tab
  const outgoingPendingConversations = useMemo<Conversation[]>(() => {
    return sentRequests
      .filter((req) => !firebaseChats.some((c) => !c.isGroup && c.user?.id === req.recipientId))
      .map((req) => ({
        id: buildDirectChatId(currentUser.id, req.recipientId),
        user: req.user,
        lastMessage: `⏳ Request sent: ${req.message}`,
        lastTimestamp: req.time,
        unreadCount: 0,
        isGroup: false,
        requestStatus: 'outgoing_pending',
        requestId: req.id,
        messages: req.messages,
      }));
  }, [sentRequests, firebaseChats, currentUser.id]);

  const allConversations = useMemo(
    () => [
      geminiAssistantConversation,
      ...firebaseChats,
      ...outgoingPendingConversations,
      ...localGroups.filter((g) => !firebaseChats.some((f) => f.id === g.id)),
      ...conversations.filter(
        (c) =>
          c.id !== GEMINI_ASSISTANT_CONVERSATION_ID &&
          !firebaseChats.some((f) => f.id === c.id || (!f.isGroup && !c.isGroup && f.user?.id === c.user?.id)) &&
          !outgoingPendingConversations.some((p) => p.user?.id === c.user?.id)
      ),
    ],
    [geminiAssistantConversation, firebaseChats, outgoingPendingConversations, localGroups, conversations]
  );

  const filtered = allConversations.filter((c) => {
    if (filter === 'direct' && c.isGroup) return false;
    if (filter === 'groups' && !c.isGroup) return false;
    const name = c.isGroup ? c.groupName : c.user?.displayName;
    const uname = c.user?.username || '';
    const uid = c.user?.uniqueId || '';
    const q = query.trim().toLowerCase();
    return (
      !q ||
      (name || '').toLowerCase().includes(q) ||
      uname.toLowerCase().includes(q) ||
      uid.toLowerCase().includes(q)
    );
  });

  const activeUserSearchTerm = showNew ? newModalQuery : query;
  const shouldRunUserSearch = showSearch || showNew;

  // Real-time Firebase user search in Chat (works in both Search bar & "+" New Chat modal)
  useEffect(() => {
    let cancelled = false;
    if (!shouldRunUserSearch || !auth.currentUser?.uid || auth.currentUser.uid !== currentUser.id) {
      setFoundUsers([]);
      setUserSearchLoading(false);
      return;
    }

    const term = activeUserSearchTerm.trim().toLowerCase().replace(/^@/, '');
    const localHits = directoryUsers.filter(
      (u) =>
        !term ||
        u.displayName.toLowerCase().includes(term) ||
        (u.username || '').toLowerCase().includes(term) ||
        (u.uniqueId || '').toLowerCase().includes(term) ||
        u.id.toLowerCase().includes(term)
    );
    setFoundUsers(localHits.slice(0, 30));

    if (!term && directoryUsers.length > 0 && userSyncRefreshEpoch === 0) {
      setUserSearchLoading(false);
      return;
    }

    setUserSearchLoading(true);
    const timer = window.setTimeout(() => {
      searchFirebaseUsers(activeUserSearchTerm, currentUser.id, 30)
        .then((items) => {
          if (!cancelled) {
            const mapped = items.map((item) => ({
              ...item,
              uniqueId: item.uniqueId || '',
              username: item.username || '',
              avatar: item.avatar || FALLBACK_AVATAR,
              level: item.level || 1,
              vipTier: item.vipTier || 0,
            })) as User[];
            setFoundUsers(mapped.length > 0 ? mapped : localHits.slice(0, 30));
          }
        })
        .catch(() => {
          if (!cancelled) setFoundUsers(localHits.slice(0, 30));
        })
        .finally(() => {
          if (!cancelled) setUserSearchLoading(false);
        });
    }, term ? 200 : 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [activeUserSearchTerm, shouldRunUserSearch, currentUser.id, directoryUsers, userSyncRefreshEpoch]);

  // Immediately select any user's ID and open the message composer — never blocks or fails with permission errors
  const openUser = (user: User) => {
    if (!user?.id || user.id === currentUser.id) return;
    const normalizedUser: User = {
      ...user,
      displayName: user.displayName || 'Alpha Mate User',
      username: user.username || '',
      uniqueId: user.uniqueId || '',
      avatar: user.avatar || FALLBACK_AVATAR,
    };

    const existingApprovedOrPending = allConversations.find((c) => !c.isGroup && c.user?.id === normalizedUser.id);
    if (existingApprovedOrPending) {
      openConversation({
        ...existingApprovedOrPending,
        user: {
          ...existingApprovedOrPending.user,
          displayName: normalizedUser.displayName || existingApprovedOrPending.user.displayName,
          username: normalizedUser.username || existingApprovedOrPending.user.username,
          uniqueId: normalizedUser.uniqueId || existingApprovedOrPending.user.uniqueId,
          avatar: normalizedUser.avatar || existingApprovedOrPending.user.avatar,
        },
      });
    } else {
      const incoming = requests.find((r) => r.user.id === normalizedUser.id || r.senderId === normalizedUser.id);
      const dmId =
        auth.currentUser?.uid === currentUser.id
          ? buildDirectChatId(currentUser.id, normalizedUser.id)
          : `conv_${normalizedUser.id}`;
      const conv: Conversation = {
        id: dmId,
        user: normalizedUser,
        lastMessage: incoming ? incoming.message : 'Selected for chat',
        lastTimestamp: incoming ? incoming.time : 'Just now',
        unreadCount: 0,
        isGroup: false,
        requestStatus: incoming ? 'incoming_pending' : 'new_request',
        requestId: incoming?.id,
        messages: incoming ? incoming.messages : [],
      };
      openConversation(conv);
    }

    setShowNew(false);
    setShowSearch(false);
    setQuery('');
    setNewModalQuery('');
  };

  const acceptRequest = async (r: RequestItem) => {
    if (approvingRequestId === r.id) return;
    setApprovingRequestId(r.id);
    try {
      if (auth.currentUser?.uid === currentUser.id) {
        const chatId = await acceptChatRequest(r.id);
        sendNotificationToUser({
          recipientId: r.user.id,
          type: 'friend_request',
          category: 'friendRequests',
          title: `✅ ${currentUser.displayName} approved your chat request`,
          message: `You are now connected! Tap to chat in real time.`,
          screen: 'chat',
          chatId,
        }).catch(() => {});
        const conv: Conversation = {
          id: chatId,
          user: r.user,
          lastMessage: r.message,
          lastTimestamp: 'Just now',
          unreadCount: 0,
          isGroup: false,
          requestStatus: 'connected',
          messages: [],
        };
        setRequests((prev) => prev.filter((x) => x.id !== r.id));
        openConversation(conv);
        showToast(`Chat approved with ${r.user.displayName}!`);
      }
    } catch (error) {
      showToast(getFriendlyChatErrorMessage(error, 'Could not approve request.'));
    } finally {
      setApprovingRequestId(null);
    }
  };

  const handleDeclineOrBlockRequest = async (r: RequestItem, block: boolean) => {
    try {
      if (auth.currentUser?.uid === currentUser.id) {
        await rejectOrBlockChatRequest(r.id, block);
      }
      setRequests((prev) => prev.filter((x) => x.id !== r.id));
      if (activeConversation?.user?.id === r.user.id) {
        openConversation(null);
      }
      showToast(block ? 'User blocked.' : 'Chat request declined.');
    } catch (error) {
      showToast(getFriendlyChatErrorMessage(error, 'Unable to update request.'));
    }
  };

  const dispatchMessageNotifications = (messagePreview: string, targetChatId?: string, isRequest = false) => {
    if (!activeConversation) return;
    if (activeConversation.isGroup && activeConversation.groupMembers?.length) {
      activeConversation.groupMembers.forEach((member) => {
        if (member.id && member.id !== currentUser.id) {
          sendNotificationToUser({
            recipientId: member.id,
            type: 'message',
            category: 'messages',
            title: `💬 ${activeConversation.groupName || 'Group Chat'}: ${currentUser.displayName}`,
            message: messagePreview.slice(0, 140),
            screen: 'chat',
            chatId: targetChatId || activeConversation.id,
          }).catch(() => {});
        }
      });
    } else if (activeConversation.user?.id && activeConversation.user.id !== currentUser.id) {
      sendNotificationToUser({
        recipientId: activeConversation.user.id,
        type: isRequest ? 'friend_request' : 'message',
        category: isRequest ? 'friendRequests' : 'messages',
        title: isRequest
          ? `💌 New message request from ${currentUser.displayName}`
          : `💬 New message from ${currentUser.displayName}`,
        message: messagePreview.slice(0, 140),
        screen: 'chat',
        chatId: targetChatId || activeConversation.id,
      }).catch(() => {});
    }
  };

  const sendToGeminiInbox = async (promptText: string, skipAppendUser = false) => {
    const cleanPrompt = promptText.trim();
    if (!cleanPrompt || geminiReplying) return;

    const nowMs = Date.now();
    const timeLabel = new Date(nowMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const historySnapshot = geminiInboxMessages.map((m) => ({
      role: m.role,
      text: m.text,
    }));

    if (!skipAppendUser) {
      const userEntry: GeminiInboxMessage = {
        id: `gemini_user_${nowMs}`,
        role: 'user',
        text: cleanPrompt,
        timestamp: timeLabel,
        createdAtMs: nowMs,
      };
      setGeminiInboxMessages((prev) => {
        const next = [...prev, userEntry];
        saveInboxBotHistory(currentUser.id, next);
        return next;
      });
    }

    setGeminiReplying(true);
    setGeminiError(null);
    geminiLastFailedPromptRef.current = null;

    try {
      const { reply, model } = await requestGeminiChat({
        message: cleanPrompt,
        history: historySnapshot,
        mode: 'inbox',
        context: {
          userName: currentUser.displayName || 'Friend',
        },
      });
      const replyMs = Date.now();
      const botEntry: GeminiInboxMessage = {
        id: `gemini_bot_${replyMs}`,
        role: 'model',
        text: reply,
        timestamp: new Date(replyMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        createdAtMs: replyMs,
        model,
      };
      setGeminiInboxMessages((prev) => {
        const next = [...prev, botEntry];
        saveInboxBotHistory(currentUser.id, next);
        return next;
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unable to get a reply from Alpha AI.';
      setGeminiError(msg);
      geminiLastFailedPromptRef.current = cleanPrompt;
    } finally {
      setGeminiReplying(false);
    }
  };

  const handleResetGeminiInbox = () => {
    clearInboxBotHistory(currentUser.id);
    setGeminiInboxMessages([]);
    setGeminiError(null);
    geminiLastFailedPromptRef.current = null;
    geminiWelcomedUserRef.current = null;
    showToast('Alpha AI chat history cleared.');
  };

  const send = async (text = draft, mediaUrl?: string, kind: LocalMessage['kind'] = 'text') => {
    if (!activeConversation || (!text.trim() && !mediaUrl) || sendingRequest) return;

    if (isGeminiConversation) {
      const promptText = text.trim();
      if (!promptText || geminiReplying) return;
      setDraft('');
      setReplyTo(null);
      setShowEmoji(false);
      await sendToGeminiInbox(promptText, false);
      return;
    }

    if (editMessage) {
      if (auth.currentUser?.uid === currentUser.id && effectiveApprovedChatId) {
        editChatMessage(effectiveApprovedChatId, editMessage.id, text).catch((e) =>
          showToast(getFriendlyChatErrorMessage(e, 'Could not edit message.'))
        );
      }
      setEditMessage(null);
      setDraft('');
      return;
    }

    const messageText =
      text.trim() ||
      (kind === 'image' ? 'Photo' : kind === 'video' ? 'Video' : kind === 'audio' ? 'Voice message' : 'Shared link');

    setDraft('');
    setReplyTo(null);
    setShowEmoji(false);

    const isFirebaseSignedIn = auth.currentUser?.uid === currentUser.id;
    const partner = activeConversation.user;

    // 1. Approved Firestore chat (1:1 or Group) -> real-time two-way message
    if (isFirebaseSignedIn && effectiveApprovedChatId) {
      const otherIds = activeConversation.isGroup
        ? (activeConversation.groupMembers || []).map((m) => m.id).filter((id) => id !== currentUser.id)
        : [partner?.id].filter(Boolean);
      sendChatMessage(
        effectiveApprovedChatId,
        {
          text: messageText,
          mediaUrl,
          mediaType: kind === 'text' || kind === 'link' ? undefined : kind,
          replyTo: replyTo?.id,
        },
        otherIds
      )
        .then(() => {
          dispatchMessageNotifications(messageText, effectiveApprovedChatId, false);
        })
        .catch((error) => {
          showToast(getFriendlyChatErrorMessage(error));
        });
      return;
    }

    // 2. Recipient is replying directly to an incoming pending request -> auto-approve & send reply!
    if (isFirebaseSignedIn && !activeConversation.isGroup && activeIncomingRequest && partner?.id) {
      setSendingRequest(true);
      try {
        const chatId = await acceptChatRequest(activeIncomingRequest.id);
        setRequests((prev) => prev.filter((x) => x.id !== activeIncomingRequest.id));
        await sendChatMessage(
          chatId,
          {
            text: messageText,
            mediaUrl,
            mediaType: kind === 'text' || kind === 'link' ? undefined : kind,
          },
          [partner.id]
        );
        openConversation({
          ...activeConversation,
          id: chatId,
          requestStatus: 'connected',
          lastMessage: messageText,
          lastTimestamp: 'Just now',
        });
        dispatchMessageNotifications(messageText, chatId, false);
      } catch (error) {
        showToast(getFriendlyChatErrorMessage(error));
      } finally {
        setSendingRequest(false);
      }
      return;
    }

    // 3. New or Outgoing Pending 1:1 Chat Request -> store in `chatRequests` (stays in recipient's Requests until approved!)
    if (isFirebaseSignedIn && !activeConversation.isGroup && partner?.id && partner.id !== currentUser.id) {
      const optimisticBubble: LocalMessage = {
        id: `opt_req_${Date.now()}`,
        senderId: currentUser.id,
        senderName: currentUser.displayName,
        senderAvatar: currentUser.avatar || FALLBACK_AVATAR,
        text: messageText,
        imageUrl: mediaUrl,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isRead: false,
        isMe: true,
        pendingApproval: true,
        kind,
      };
      setOptimisticSentByPartner((prev) => ({
        ...prev,
        [partner.id]: [...(prev[partner.id] || []), optimisticBubble],
      }));

      setSendingRequest(true);
      try {
        const wasFirstRequestMessage = !activeOutgoingRequest;
        const { requestId } = await sendChatRequest(
          {
            id: partner.id,
            displayName: partner.displayName || 'Alpha Mate User',
            username: partner.username || '',
            uniqueId: partner.uniqueId || '',
            avatar: partner.avatar || '',
          },
          messageText,
          {
            id: currentUser.id,
            displayName: currentUser.displayName,
            username: currentUser.username,
            uniqueId: currentUser.uniqueId,
            avatar: currentUser.avatar,
          },
          mediaUrl,
          kind === 'text' || kind === 'link' ? undefined : kind
        );
        dispatchMessageNotifications(messageText, requestId, true);
        if (wasFirstRequestMessage) {
          showToast(`Message sent to ${partner.displayName}'s Requests!`);
        }
      } catch (error) {
        setOptimisticSentByPartner((prev) => ({
          ...prev,
          [partner.id]: (prev[partner.id] || []).filter((m) => m.id !== optimisticBubble.id),
        }));
        showToast(getFriendlyChatErrorMessage(error));
      } finally {
        setSendingRequest(false);
      }
      return;
    }

    // 4. Local group or offline fallback
    if (localGroups.some((group) => group.id === activeConversation.id)) {
      const newMessage: LocalMessage = {
        id: `group_msg_${Date.now()}`,
        senderId: currentUser.id,
        senderName: currentUser.displayName,
        senderAvatar: currentUser.avatar || FALLBACK_AVATAR,
        text: messageText,
        imageUrl: mediaUrl,
        timestamp: 'Just now',
        isRead: false,
        isMe: true,
        kind,
      };
      const updated = {
        ...activeConversation,
        lastMessage: messageText,
        lastTimestamp: 'Just now',
        messages: [...activeConversation.messages, newMessage],
      };
      setLocalGroups((prev) => prev.map((group) => (group.id === updated.id ? updated : group)));
      openConversation(updated);
    } else {
      sendMessage(activeConversation.id, messageText, mediaUrl);
    }
  };

  const handleFile = async (file?: File) => {
    if (!file || !activeConversation) return;
    const kind = file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'audio' : 'image';
    try {
      if (auth.currentUser?.uid === currentUser.id && !activeConversation.isGroup) {
        const uploadBucketId = effectiveApprovedChatId || buildDirectChatId(currentUser.id, activeConversation.user.id);
        const url = await uploadChatMedia(uploadBucketId, file);
        await send(file.name, url, kind);
      } else if (auth.currentUser?.uid === currentUser.id && effectiveApprovedChatId) {
        const url = await uploadChatMedia(effectiveApprovedChatId, file);
        await send(file.name, url, kind);
      } else {
        const reader = new FileReader();
        reader.onload = () => {
          void send(file.name, String(reader.result), kind);
        };
        reader.readAsDataURL(file);
      }
    } catch (error) {
      showToast(getFriendlyChatErrorMessage(error, 'Upload failed.'));
    }
    setShowAttach(false);
  };

  const createGroup = () => {
    if (!groupName.trim() || selectedMembers.length < 1) return;
    const members = directoryUsers.filter((u) => selectedMembers.includes(u.id));
    const makeGroup = async () => {
      let groupId = `group_${Date.now()}`;
      if (auth.currentUser?.uid === currentUser.id) {
        try {
          groupId = await createGroupChat(
            groupName.trim(),
            members.map((m) => ({
              id: m.id,
              displayName: m.displayName,
              username: m.username,
              avatar: m.avatar,
            }))
          );
        } catch (error) {
          console.error('Firebase group creation failed:', error);
        }
      }
      members.forEach((m) => {
        if (m.id && m.id !== currentUser.id) {
          sendNotificationToUser({
            recipientId: m.id,
            type: 'message',
            category: 'messages',
            title: `👥 Invited to group "${groupName.trim()}"`,
            message: `${currentUser.displayName} invited you to join a group chat.`,
            screen: 'chat',
            chatId: groupId,
          }).catch(() => {});
        }
      });
      const group: Conversation = {
        id: groupId,
        user: currentUser,
        lastMessage: 'Group created · invitations sent',
        lastTimestamp: 'Just now',
        unreadCount: 0,
        isGroup: true,
        groupName: groupName.trim(),
        groupMembers: [currentUser, ...members],
        messages: [],
      };
      setLocalGroups((prev) => [group, ...prev]);
      setGroupName('');
      setSelectedMembers([]);
      setShowGroup(false);
      setShowNew(false);
      openConversation(group);
    };
    void makeGroup();
  };

  if (activeConversation) {
    const partner = approvedActiveChat?.user || activeConversation.user;
    const messages = activeDisplayedMessages;
    const partnerHandle = partner?.username ? `@${partner.username.replace(/^@/, '')}` : '';
    const partnerPublicId = partner?.uniqueId || (partner?.id ? partner.id.slice(0, 10) : '');
    const isDirectFirebase =
      !activeConversation.isGroup && !isGeminiConversation && auth.currentUser?.uid === currentUser.id && Boolean(partner?.id);

    return (
      <div className="relative flex h-full flex-1 min-h-0 w-full flex-col overflow-hidden bg-[#090510] text-white">
        <header className="shrink-0 border-b border-purple-500/20 bg-[#130922]/95 px-3 py-2.5">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => openConversation(null)}
              aria-label="Back to chats"
              className="rounded-full p-2 text-zinc-300 hover:bg-white/10 cursor-pointer shrink-0"
            >
              <ArrowLeft size={21} />
            </button>
            <div
              onClick={() => {
                if (!activeConversation.isGroup && !isGeminiConversation && partner?.id) {
                  openPublicUserProfile(partner);
                }
              }}
              className={`relative shrink-0 ${isGeminiConversation ? '' : 'cursor-pointer'}`}
            >
              <img
                src={
                  (activeConversation.isGroup
                    ? activeConversation.groupMembers?.[0]?.avatar || partner?.avatar
                    : partner?.avatar) || FALLBACK_AVATAR
                }
                alt={activeConversation.isGroup ? activeConversation.groupName : partner?.displayName}
                referrerPolicy="no-referrer"
                className="h-10 w-10 rounded-full border border-fuchsia-400/60 object-cover bg-[#1F1235]"
              />
              {!activeConversation.isGroup && !isGeminiConversation && (
                <i
                  className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[#130922] ${
                    isApprovedFirestoreChat ? 'bg-emerald-400' : 'bg-amber-400'
                  }`}
                />
              )}
            </div>
            <div
              onClick={() => {
                if (!activeConversation.isGroup && !isGeminiConversation && partner?.id) {
                  openPublicUserProfile(partner);
                }
              }}
              className={`min-w-0 flex-1 ${isGeminiConversation ? '' : 'cursor-pointer'}`}
            >
              <div className="flex items-center gap-1.5">
                <span className="truncate text-[15px] font-bold">
                  {activeConversation.isGroup ? activeConversation.groupName : partner?.displayName || 'Alpha Mate User'}
                </span>
              </div>
              <div className="truncate text-[11px] text-zinc-300">
                {isGeminiConversation ? (
                  <span className="text-purple-200">Gemini Assistant · Multi-turn Inbox Chat</span>
                ) : activeConversation.isGroup ? (
                  <span className="text-emerald-400">{`${activeConversation.groupMembers?.length || 1} members`}</span>
                ) : (
                  <>
                    {partnerHandle && <span className="text-purple-300">{partnerHandle}</span>}
                    {partnerHandle && partnerPublicId && <span className="mx-1 text-zinc-500">·</span>}
                    {partnerPublicId && <span className="font-mono text-[10px] text-zinc-400">ID: {partnerPublicId}</span>}
                    <span className="mx-1 text-zinc-500">·</span>
                    {isApprovedFirestoreChat ? (
                      <span className="text-emerald-400 font-semibold">Connected</span>
                    ) : activeIncomingRequest ? (
                      <span className="text-pink-400 font-semibold">Needs Approval</span>
                    ) : activeOutgoingRequest ? (
                      <span className="text-amber-300 font-semibold">In Requests</span>
                    ) : (
                      <span className="text-cyan-300 font-semibold">Selected</span>
                    )}
                  </>
                )}
              </div>
            </div>
            {isGeminiConversation ? (
              <button
                type="button"
                onClick={handleResetGeminiInbox}
                disabled={geminiReplying}
                className="flex items-center gap-1.5 rounded-xl border border-purple-400/25 bg-white/5 px-3 py-2 text-xs font-semibold text-purple-200 hover:bg-white/10 cursor-pointer disabled:opacity-50 shrink-0"
                title="Reset conversation history"
              >
                <RotateCcw size={14} />
                <span>Clear</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setCallState('voice')}
                  className="rounded-full p-2 text-emerald-300 hover:bg-emerald-400/10 cursor-pointer shrink-0"
                  title="Voice call"
                >
                  <Phone size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => setCallState('video')}
                  className="rounded-full p-2 text-fuchsia-300 hover:bg-fuchsia-400/10 cursor-pointer shrink-0"
                  title="Video call"
                >
                  <Video size={19} />
                </button>
                <RefreshScopeButton scope="chat" compact className="w-8 h-8 shrink-0" title="Refresh chat messages" />
                <button
                  type="button"
                  onClick={() => setShowAttach((v) => !v)}
                  className="rounded-full p-1.5 text-zinc-300 cursor-pointer shrink-0"
                >
                  <MoreVertical size={19} />
                </button>
              </>
            )}
          </div>
        </header>

        {callState !== 'idle' && (
          <div className="mx-3 mt-2 shrink-0 flex items-center justify-between rounded-2xl border border-purple-400/30 bg-purple-950/70 p-3">
            <div className="flex items-center gap-2">
              <PhoneCall size={17} className="text-emerald-300" />
              <div>
                <p className="text-sm font-semibold">{callState === 'voice' ? 'Voice call' : 'Video call'}</p>
                <p className="text-[10px] text-zinc-400">Connecting call channel...</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setCallState('idle')}
              className="rounded-full bg-rose-500/20 p-2 text-rose-300 cursor-pointer"
            >
              <X size={17} />
            </button>
          </div>
        )}

        <main
          ref={messagesScrollRef}
          className="flex-1 min-h-0 space-y-3 overflow-y-auto bg-[radial-gradient(ellipse_at_top,_#291044_0%,_#10091c_42%,_#090510_100%)] px-3 py-4"
        >
          <PullToRefresh
            scrollContainerRef={messagesScrollRef}
            label="Refreshing messages..."
            onRefresh={() => refreshScope('chat')}
          />

          {!isGeminiConversation && (
            <div className="mx-auto w-fit rounded-full border border-white/10 bg-black/25 px-3 py-1 text-[10px] text-zinc-300">
              {isApprovedFirestoreChat
                ? 'Connected · Real-Time Chat Active'
                : activeIncomingRequest
                ? 'Chat Request · Approve to connect'
                : activeOutgoingRequest
                ? 'Request Pending · Stored in Recipient Requests'
                : 'Direct Message · Send a message request'}
            </div>
          )}

          {/* Status Banner for Unapproved Direct Chats */}
          {isDirectFirebase && !isApprovedFirestoreChat && !activeIncomingRequest && (
            <div className="mx-auto max-w-sm rounded-2xl border border-purple-400/25 bg-[#180d2c]/90 px-3.5 py-2.5 text-center text-[11px] leading-relaxed text-purple-100">
              {activeOutgoingRequest || messages.length > 0 ? (
                <>
                  <ShieldCheck size={14} className="mr-1.5 inline text-amber-300" />
                  Your message is in <b>{partner?.displayName}</b>&apos;s <b>Requests</b> inbox. As soon as they approve,
                  live two-way chat will start automatically.
                </>
              ) : (
                <>
                  Selected <b>{partner?.displayName}</b>{' '}
                  {partnerPublicId ? <span className="text-purple-300">({partnerPublicId})</span> : null}. Write a
                  message below — it will stay in their <b>Requests</b> until they approve.
                </>
              )}
            </div>
          )}

          {messages.length === 0 && !geminiWelcoming && (
            <div className="text-center py-8 text-xs text-zinc-400">
              {isGeminiConversation
                ? 'Say hello or ask Alpha AI anything in Hindi, Urdu, or English.'
                : 'Type your message below and tap Send to start chatting!'}
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[82%] ${msg.isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                {msg.replyTo && (
                  <div className="mb-1 rounded-lg bg-black/30 px-3 py-1 text-[10px] text-purple-200">
                    Replying to a message
                  </div>
                )}
                <button
                  type="button"
                  onContextMenu={(e) => {
                    e.preventDefault();
                    if (!msg.pendingApproval && !isGeminiConversation) setMenuMessage(msg);
                  }}
                  onClick={() => {
                    if (!msg.pendingApproval && !isGeminiConversation) setMenuMessage(msg);
                  }}
                  className={`rounded-2xl px-3.5 py-2.5 text-left text-[13px] leading-relaxed shadow-lg ${
                    msg.isMe
                      ? 'rounded-br-sm bg-gradient-to-br from-[#8B27D8] to-[#D52DAB]'
                      : 'rounded-bl-sm border border-purple-400/15 bg-[#211332]'
                  }`}
                >
                  {msg.imageUrl &&
                    (msg.imageUrl.startsWith('data:video') ? (
                      <video src={msg.imageUrl} controls className="mb-2 max-h-48 rounded-xl" />
                    ) : (
                      <img
                        src={msg.imageUrl}
                        alt="Attachment"
                        referrerPolicy="no-referrer"
                        className="mb-2 max-h-52 rounded-xl object-cover"
                      />
                    ))}
                  {msg.text && <span className="break-words whitespace-pre-wrap">{msg.text}</span>}
                  {msg.edited && <span className="ml-2 text-[9px] opacity-70">edited</span>}
                </button>
                <div className="mt-1 flex items-center gap-1 px-1 text-[10px] text-zinc-500">
                  <span>{msg.timestamp}</span>
                  {msg.isMe &&
                    (msg.pendingApproval ? (
                      <span className="inline-flex items-center gap-1 text-amber-300">
                        <Clock size={11} /> Request sent
                      </span>
                    ) : (
                      <CheckCheck size={13} className={msg.isRead ? 'text-cyan-300' : 'text-zinc-400'} />
                    ))}
                </div>
              </div>
            </div>
          ))}

          {isGeminiConversation && (geminiReplying || geminiWelcoming) && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-sm border border-purple-400/20 bg-[#211332] px-4 py-2.5 text-xs text-purple-200">
                {geminiWelcoming ? 'Alpha AI is welcoming you...' : 'Alpha AI is typing...'}
              </div>
            </div>
          )}

          {isGeminiConversation && geminiError && (
            <div className="mx-auto max-w-sm rounded-2xl border border-rose-400/30 bg-rose-950/40 px-3.5 py-2.5 text-xs text-rose-200 flex items-center justify-between gap-3">
              <span className="leading-snug">{geminiError}</span>
              {geminiLastFailedPromptRef.current && (
                <button
                  type="button"
                  onClick={() => {
                    const lastPrompt = geminiLastFailedPromptRef.current;
                    if (lastPrompt) void sendToGeminiInbox(lastPrompt, true);
                  }}
                  className="shrink-0 rounded-lg bg-rose-500/25 border border-rose-400/40 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-rose-500/40 cursor-pointer"
                >
                  Retry
                </button>
              )}
            </div>
          )}

          {isGeminiConversation && messages.length <= 1 && !geminiReplying && (
            <div className="flex flex-wrap gap-2 pt-2">
              {[
                'Party Room kaise join karein?',
                'Live stream me audience kaise badhayein?',
                'Ek pyari si welcome shayari sunao',
              ].map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => void sendToGeminiInbox(prompt, false)}
                  className="rounded-xl border border-purple-400/25 bg-[#1b102c] px-3 py-2 text-left text-xs text-purple-100 hover:bg-purple-500/20 cursor-pointer transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}
          <div ref={chatEndRef} />
        </main>

        {/* Inline Approval Banner when viewing an Incoming Pending Chat Request */}
        {activeIncomingRequest && (
          <div className="shrink-0 border-t border-pink-500/30 bg-[#1B0E2E] px-3 py-2.5">
            <p className="mb-2 text-[11px] text-purple-100">
              <b>{partner?.displayName}</b> sent you a chat request. Approve to start chatting, or reply below to approve
              automatically.
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                disabled={approvingRequestId === activeIncomingRequest.id}
                onClick={() => void acceptRequest(activeIncomingRequest)}
                className="col-span-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 py-2 text-xs font-bold text-white cursor-pointer disabled:opacity-50"
              >
                {approvingRequestId === activeIncomingRequest.id ? 'Approving…' : 'Approve & Start Chat'}
              </button>
              <button
                type="button"
                onClick={() => void handleDeclineOrBlockRequest(activeIncomingRequest, true)}
                className="rounded-xl border border-rose-400/35 bg-rose-500/10 py-2 text-xs font-bold text-rose-300 cursor-pointer"
              >
                Block
              </button>
            </div>
          </div>
        )}

        {menuMessage && (
          <div
            className="absolute inset-0 z-30 flex items-end bg-black/55 p-3"
            onClick={() => setMenuMessage(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full rounded-3xl border border-purple-400/30 bg-[#1b102b] p-3 shadow-2xl"
            >
              <div className="mb-2 flex justify-around border-b border-white/10 pb-3">
                {['👍', '❤️', '😂', '😮', '😢', '🔥'].map((e) => (
                  <button key={e} type="button" onClick={() => setMenuMessage(null)} className="text-2xl cursor-pointer">
                    {e}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  setReplyTo(menuMessage);
                  setMenuMessage(null);
                  messageInputRef.current?.focus();
                }}
                className="flex w-full items-center gap-3 rounded-xl p-3 text-sm hover:bg-white/5 cursor-pointer"
              >
                <Reply size={17} /> Reply
              </button>
              {menuMessage.isMe && (
                <button
                  type="button"
                  onClick={() => {
                    setEditMessage(menuMessage);
                    setDraft(menuMessage.text || '');
                    setMenuMessage(null);
                    messageInputRef.current?.focus();
                  }}
                  className="flex w-full items-center gap-3 rounded-xl p-3 text-sm hover:bg-white/5 cursor-pointer"
                >
                  <Pencil size={17} /> Edit message
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (auth.currentUser?.uid === currentUser.id && effectiveApprovedChatId) {
                    deleteChatMessage(effectiveApprovedChatId, menuMessage.id, false).catch((e) => console.error(e));
                  }
                  setMenuMessage(null);
                }}
                className="flex w-full items-center gap-3 rounded-xl p-3 text-sm hover:bg-white/5 cursor-pointer"
              >
                <Trash2 size={17} /> Delete for me
              </button>
              {menuMessage.isMe && (
                <button
                  type="button"
                  onClick={() => {
                    if (auth.currentUser?.uid === currentUser.id && effectiveApprovedChatId) {
                      deleteChatMessage(effectiveApprovedChatId, menuMessage.id, true).catch((e) => console.error(e));
                    }
                    setMenuMessage(null);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl p-3 text-sm text-rose-300 hover:bg-white/5 cursor-pointer"
                >
                  <Trash2 size={17} /> Delete for everyone
                </button>
              )}
            </div>
          </div>
        )}

        {showEmoji && (
          <div className="shrink-0 grid grid-cols-6 gap-2 border-t border-purple-400/20 bg-[#160d25] p-3">
            {EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => {
                  setDraft((v) => v + e);
                  messageInputRef.current?.focus();
                }}
                className="text-2xl cursor-pointer"
              >
                {e}
              </button>
            ))}
          </div>
        )}

        {showAttach && (
          <div className="shrink-0 grid grid-cols-4 gap-2 border-t border-purple-400/20 bg-[#160d25] p-3">
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              className="flex flex-col items-center gap-1 text-xs text-purple-200 cursor-pointer"
            >
              <Camera className="text-fuchsia-300" />
              Camera
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex flex-col items-center gap-1 text-xs text-purple-200 cursor-pointer"
            >
              <ImageIcon className="text-cyan-300" />
              Gallery
            </button>
            <button
              type="button"
              onClick={() => videoRef.current?.click()}
              className="flex flex-col items-center gap-1 text-xs text-purple-200 cursor-pointer"
            >
              <FileVideo className="text-pink-300" />
              Video
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft((v) => v + ' https://');
                setShowAttach(false);
                messageInputRef.current?.focus();
              }}
              className="flex flex-col items-center gap-1 text-xs text-purple-200 cursor-pointer"
            >
              <LinkIcon className="text-amber-300" />
              Link
            </button>
          </div>
        )}

        {replyTo && (
          <div className="shrink-0 flex items-center justify-between border-t border-purple-400/20 bg-[#190f2b] px-4 py-2 text-xs">
            <span className="truncate text-purple-200">
              Replying to: {replyTo.text?.slice(0, 50) || 'attachment'}
            </span>
            <button type="button" onClick={() => setReplyTo(null)} className="cursor-pointer">
              <X size={15} />
            </button>
          </div>
        )}

        {editMessage && (
          <div className="shrink-0 flex items-center justify-between border-t border-purple-400/20 bg-[#190f2b] px-4 py-2 text-xs text-amber-200">
            <span>Editing message</span>
            <button
              type="button"
              onClick={() => {
                setEditMessage(null);
                setDraft('');
              }}
              className="cursor-pointer"
            >
              <X size={15} />
            </button>
          </div>
        )}

        {/* Bottom Message Input Bar & Mobile Keypad Trigger */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
          onClick={() => messageInputRef.current?.focus()}
          className="flex shrink-0 items-center gap-2 border-t border-purple-400/25 bg-[#10091d] px-3 py-2.5 pb-3"
        >
          {!isGeminiConversation && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowAttach((v) => !v);
              }}
              className="rounded-full bg-purple-500/15 p-2.5 text-purple-200 cursor-pointer shrink-0"
              title="Attach media"
            >
              <Plus size={19} />
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowEmoji((v) => !v);
            }}
            className="text-zinc-400 hover:text-purple-200 cursor-pointer shrink-0"
            title="Emoji"
          >
            <Smile size={20} />
          </button>
          <input
            ref={messageInputRef}
            type="text"
            inputMode="text"
            enterKeyHint="send"
            autoComplete="off"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={
              isGeminiConversation
                ? 'Ask Alpha AI anything...'
                : isApprovedFirestoreChat
                ? `Message ${activeConversation.isGroup ? activeConversation.groupName : partner?.displayName || ''}...`
                : activeIncomingRequest
                ? 'Write a reply to approve & chat...'
                : `Send message to ${partner?.displayName || 'user'}...`
            }
            className="h-11 min-w-0 flex-1 rounded-full border border-purple-400/30 bg-[#21152f] px-4 text-sm text-white outline-none placeholder:text-zinc-400 focus:border-fuchsia-400"
          />
          {!draft.trim() && isApprovedFirestoreChat && !isGeminiConversation && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void send('🎙️ Voice message (0:08)');
              }}
              className="rounded-full bg-white/10 p-2.5 text-purple-200 hover:bg-white/15 cursor-pointer shrink-0"
              title="Send voice note"
            >
              <Mic size={18} />
            </button>
          )}
          <button
            type="submit"
            disabled={!draft.trim() || sendingRequest || (isGeminiConversation && geminiReplying)}
            aria-label="Send message"
            className="rounded-full bg-gradient-to-r from-purple-600 to-pink-500 p-3 text-white shadow-md cursor-pointer disabled:opacity-45 shrink-0"
          >
            <Send size={17} />
          </button>
        </form>

        {toastMsg && (
          <div className="fixed bottom-20 inset-x-4 z-50 mx-auto max-w-sm rounded-2xl border border-purple-400/40 bg-[#1c1033]/95 px-4 py-2.5 text-center text-xs font-bold text-white shadow-2xl">
            {toastMsg}
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
        <input ref={videoRef} type="file" accept="video/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#090510] pb-28 text-white">
      <header className="sticky top-0 z-10 border-b border-purple-500/15 bg-[#10091d]/95 px-4 pb-3 pt-3.5 backdrop-blur-xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight">Chats</h1>
            <p className="mt-0.5 text-[11px] text-zinc-500">Select any user ID to message · Requests &amp; Live Chat</p>
          </div>
          <div className="flex items-center gap-2">
            <RefreshScopeButton
              scope="chat"
              compact
              className="h-11 w-11 border-purple-400/20 bg-purple-500/10 text-purple-200"
              title="Refresh chats"
            />
            <button
              type="button"
              onClick={() => {
                setShowSearch((prev) => !prev);
                setQuery('');
              }}
              className="rounded-full border border-purple-400/20 bg-purple-500/10 p-3 text-purple-200 cursor-pointer"
              title="Search users and chats"
            >
              <Search size={19} />
            </button>
            <button
              type="button"
              onClick={() => {
                setNewModalQuery('');
                setShowNew(true);
              }}
              className="rounded-full bg-gradient-to-r from-purple-600 to-pink-500 p-3 text-white shadow-lg shadow-purple-900/30 cursor-pointer"
              title="New conversation"
            >
              <Plus size={19} />
            </button>
          </div>
        </div>

        {showSearch && (
          <div className="mb-3 flex items-center gap-2 rounded-2xl border border-purple-400/30 bg-[#21152f] px-3">
            <Search size={17} className="text-purple-300" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, @username or AM ID..."
              className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-500"
            />
            <button
              type="button"
              onClick={() => {
                setShowSearch(false);
                setQuery('');
              }}
              className="cursor-pointer"
            >
              <X size={17} />
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 rounded-2xl border border-purple-400/20 bg-[#1a1028] p-1">
          <button
            type="button"
            onClick={() => setTab('chats')}
            className={`rounded-xl py-2.5 text-sm font-bold cursor-pointer ${
              tab === 'chats' ? 'bg-gradient-to-r from-purple-600 to-fuchsia-500 text-white' : 'text-zinc-400'
            }`}
          >
            Chats <span className="ml-1 text-[10px]">{allConversations.length}</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('requests')}
            className={`rounded-xl py-2.5 text-sm font-bold cursor-pointer ${
              tab === 'requests' ? 'bg-gradient-to-r from-purple-600 to-fuchsia-500 text-white' : 'text-zinc-400'
            }`}
          >
            Requests{' '}
            {requests.length + groupInvites.length > 0 && (
              <span className="ml-1 rounded-full bg-pink-500 px-1.5 py-0.5 text-[10px] text-white">
                {requests.length + groupInvites.length}
              </span>
            )}
          </button>
        </div>

        {tab === 'chats' && (
          <div className="mt-3 flex gap-2">
            {(['all', 'direct', 'groups'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`rounded-full px-4 py-1.5 text-xs font-semibold capitalize cursor-pointer ${
                  filter === f
                    ? 'bg-purple-600 text-white'
                    : 'border border-purple-400/15 bg-[#1b1129] text-zinc-400'
                }`}
              >
                {f === 'all' ? 'All chats' : f === 'direct' ? 'Private' : 'Groups'}
              </button>
            ))}
          </div>
        )}
      </header>

      {tab === 'requests' ? (
        <section className="space-y-3 p-4">
          <div className="mb-4 rounded-2xl border border-amber-400/20 bg-amber-500/5 p-3 text-xs leading-relaxed text-amber-100">
            <ShieldCheck size={16} className="mr-2 inline" />
            Messages from users you haven&apos;t approved yet stay here in Requests. Approve to start chatting in real
            time.
          </div>

          {groupInvites.map((invite) => (
            <div key={invite.id} className="rounded-2xl border border-fuchsia-400/25 bg-[#1b102b] p-3">
              <p className="text-sm font-bold">{invite.groupName || 'Group invitation'}</p>
              <p className="mt-1 text-xs text-zinc-400">You have been invited to join this group.</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    respondToGroupInvite(invite.chatId, true)
                      .then(() => setGroupInvites((v) => v.filter((x) => x.id !== invite.id)))
                      .catch((e) => showToast(getFriendlyChatErrorMessage(e)))
                  }
                  className="rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 py-2 text-xs font-bold cursor-pointer"
                >
                  Accept Group
                </button>
                <button
                  type="button"
                  onClick={() =>
                    respondToGroupInvite(invite.chatId, false)
                      .then(() => setGroupInvites((v) => v.filter((x) => x.id !== invite.id)))
                      .catch((e) => showToast(getFriendlyChatErrorMessage(e)))
                  }
                  className="rounded-xl border border-rose-400/30 py-2 text-xs font-bold text-rose-300 cursor-pointer"
                >
                  Decline
                </button>
              </div>
            </div>
          ))}

          {requests.length === 0 && groupInvites.length === 0 ? (
            <EmptyState
              title="No message requests"
              subtitle="When someone sends you a message before connecting, it stays here until you approve."
            />
          ) : (
            requests.map((r) => (
              <div key={r.id} className="rounded-2xl border border-purple-400/25 bg-[#160d25] p-3.5">
                <button
                  type="button"
                  onClick={() => openUser(r.user)}
                  className="flex w-full items-center gap-3 text-left cursor-pointer"
                >
                  <img
                    src={r.user.avatar || FALLBACK_AVATAR}
                    alt={r.user.displayName}
                    referrerPolicy="no-referrer"
                    className="h-12 w-12 rounded-full object-cover border border-purple-400/30 bg-[#1F1235] shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-bold text-sm text-white">{r.user.displayName}</p>
                      <span className="shrink-0 text-[10px] text-zinc-500">{r.time}</span>
                    </div>
                    <p className="text-[11px] text-purple-300 truncate">
                      {r.user.username ? `@${r.user.username.replace(/^@/, '')}` : 'Alpha Mate User'}
                      {r.user.uniqueId ? ` · ID: ${r.user.uniqueId}` : ''}
                    </p>
                    <p className="mt-1.5 rounded-xl bg-black/25 px-2.5 py-1.5 text-xs text-zinc-200 line-clamp-2">
                      {r.message}
                    </p>
                  </div>
                </button>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    disabled={approvingRequestId === r.id}
                    onClick={() => void acceptRequest(r)}
                    className="col-span-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 py-2 text-xs font-bold text-white cursor-pointer disabled:opacity-50"
                  >
                    {approvingRequestId === r.id ? 'Approving…' : 'Approve & Chat'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDeclineOrBlockRequest(r, true)}
                    className="rounded-xl border border-rose-400/30 py-2 text-xs font-bold text-rose-300 cursor-pointer"
                  >
                    <Ban size={13} className="mr-1 inline" />
                    Block
                  </button>
                </div>
              </div>
            ))
          )}
        </section>
      ) : (
        <section className="p-3">
          {/* Real-Time Registered Users Search Results inside Chat */}
          {showSearch && (
            <div className="mb-4 rounded-2xl border border-purple-400/25 bg-[#130B23] p-2.5">
              <div className="flex items-center justify-between px-2 pb-2">
                <p className="text-xs font-bold text-purple-200">
                  Tap a user to select ID &amp; message ({foundUsers.length})
                </p>
                {userSearchLoading && <span className="text-[10px] text-fuchsia-300">Searching…</span>}
              </div>

              {!userSearchLoading && foundUsers.length === 0 ? (
                <p className="px-3 py-3 text-xs text-zinc-500">No registered users matched.</p>
              ) : (
                <div className="max-h-72 overflow-y-auto space-y-1">
                  {foundUsers.map((u) => {
                    const isFollowing = followingUserIds.includes(u.id);
                    const followsMe = followerUserIds.includes(u.id);
                    return (
                      <div
                        key={u.id}
                        className="flex w-full items-center gap-2 rounded-xl p-2 hover:bg-white/5 transition-colors"
                      >
                        <button
                          type="button"
                          onClick={() => openUser(u)}
                          className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer"
                        >
                          <img
                            src={u.avatar || FALLBACK_AVATAR}
                            alt={u.displayName}
                            referrerPolicy="no-referrer"
                            className="h-10 w-10 rounded-full object-cover border border-purple-400/30 bg-[#1F1235] shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <b className="block text-xs sm:text-sm text-white truncate">{u.displayName}</b>
                            <small className="text-[10.5px] text-zinc-400 block truncate">
                              {u.username ? `@${u.username.replace(/^@/, '')}` : 'User'}{' '}
                              {u.uniqueId ? `· ID: ${u.uniqueId}` : ''}
                            </small>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => toggleFollowUser(u)}
                          className={`px-2.5 py-1.5 rounded-xl text-[10px] font-bold flex items-center gap-1 cursor-pointer shrink-0 ${
                            isFollowing
                              ? 'bg-white/10 text-zinc-300'
                              : followsMe
                              ? 'bg-emerald-500/20 border border-emerald-400/40 text-emerald-300'
                              : 'bg-purple-600/30 border border-purple-400/40 text-purple-200'
                          }`}
                        >
                          {isFollowing ? <UserCheck size={12} /> : <UserPlus size={12} />}
                          <span>{isFollowing ? 'Following' : followsMe ? 'Follow Back' : 'Follow'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => openUser(u)}
                          title="Select ID & send message"
                          className="px-2.5 h-8 rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 flex items-center gap-1 text-[11px] font-bold text-white cursor-pointer shrink-0"
                        >
                          <MessageCircle size={13} />
                          <span>Chat</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => openPublicUserProfile(u)}
                          title="Visit Profile"
                          className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-zinc-300 hover:text-white cursor-pointer shrink-0"
                        >
                          <Eye size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {filtered.length === 0 ? (
            <EmptyState
              title="No chats yet"
              subtitle="Tap + or the search icon above to select any user ID and send a message."
            />
          ) : (
            filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => openConversation(c)}
                className="flex w-full items-center gap-3 border-b border-purple-400/10 px-2 py-3.5 text-left hover:bg-white/[0.03] cursor-pointer"
              >
                <div className="relative shrink-0">
                  <img
                    src={(c.isGroup ? c.groupMembers?.[0]?.avatar || c.user.avatar : c.user.avatar) || FALLBACK_AVATAR}
                    alt={c.isGroup ? c.groupName : c.user.displayName}
                    referrerPolicy="no-referrer"
                    className="h-13 w-13 rounded-full border border-purple-400/30 object-cover bg-[#1F1235]"
                  />
                  {!c.isGroup && (
                    <i
                      className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#090510] ${
                        c.requestStatus === 'outgoing_pending' ? 'bg-amber-400' : 'bg-emerald-400'
                      }`}
                    />
                  )}
                  {c.isGroup && (
                    <span className="absolute -bottom-1 -right-1 rounded-full bg-purple-600 p-1">
                      <Users size={11} />
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <b className="truncate text-sm">{c.isGroup ? c.groupName : c.user.displayName}</b>
                      {c.requestStatus === 'outgoing_pending' && (
                        <span className="shrink-0 rounded-md border border-amber-400/30 bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">
                          Pending
                        </span>
                      )}
                    </div>
                    <span className="shrink-0 text-[10px] text-zinc-500">{c.lastTimestamp}</span>
                  </div>
                  {!c.isGroup && (c.user.username || c.user.uniqueId) && (
                    <p className="truncate text-[10.5px] text-purple-300/80">
                      {c.user.username ? `@${c.user.username.replace(/^@/, '')}` : ''}
                      {c.user.username && c.user.uniqueId ? ' · ' : ''}
                      {c.user.uniqueId ? `ID: ${c.user.uniqueId}` : ''}
                    </p>
                  )}
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <p className="truncate text-xs text-zinc-400">{c.lastMessage}</p>
                    {c.unreadCount > 0 && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-fuchsia-500 px-1 text-[10px] font-bold">
                        {c.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </section>
      )}

      {toastMsg && (
        <div className="fixed bottom-20 inset-x-4 z-50 mx-auto max-w-sm rounded-2xl border border-purple-400/40 bg-[#1c1033]/95 px-4 py-2.5 text-center text-xs font-bold text-white shadow-2xl">
          {toastMsg}
        </div>
      )}

      {/* "+" Start a Conversation Modal — Direct User Picker + Search + Group Option */}
      {showNew && (
        <div className="fixed inset-0 z-30 flex items-end bg-black/70" onClick={() => setShowNew(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[82dvh] w-full flex-col rounded-t-3xl border border-purple-400/30 bg-[#170d26] p-5 pb-[max(24px,var(--app-safe-bottom,0px))]"
          >
            <div className="mb-3 flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-lg font-black">Select User to Chat</h2>
                <p className="text-[11px] text-zinc-400">Tap any user ID to open chat &amp; send a message</p>
              </div>
              <button type="button" onClick={() => setShowNew(false)} className="rounded-full p-1.5 hover:bg-white/10 cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <div className="mb-3 flex items-center gap-2 rounded-2xl border border-purple-400/30 bg-[#241436] px-3 shrink-0">
              <Search size={16} className="text-fuchsia-300 shrink-0" />
              <input
                autoFocus
                value={newModalQuery}
                onChange={(e) => setNewModalQuery(e.target.value)}
                placeholder="Search name, @username or AM ID..."
                className="h-11 min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-zinc-400"
              />
              {newModalQuery && (
                <button type="button" onClick={() => setNewModalQuery('')} className="cursor-pointer text-zinc-400">
                  <X size={15} />
                </button>
              )}
            </div>

            <div className="mb-3 flex-1 min-h-0 overflow-y-auto rounded-2xl border border-purple-400/15 bg-[#120920] p-2 space-y-1">
              {userSearchLoading && foundUsers.length === 0 ? (
                <p className="py-6 text-center text-xs text-purple-300">Loading users…</p>
              ) : foundUsers.length === 0 ? (
                <p className="py-6 text-center text-xs text-zinc-500">No users found for this search.</p>
              ) : (
                foundUsers.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => openUser(u)}
                    className="flex w-full items-center gap-3 rounded-xl p-2.5 text-left hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    <img
                      src={u.avatar || FALLBACK_AVATAR}
                      alt={u.displayName}
                      referrerPolicy="no-referrer"
                      className="h-10 w-10 rounded-full object-cover border border-purple-400/30 bg-[#1F1235] shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <b className="block truncate text-sm text-white">{u.displayName}</b>
                      <small className="block truncate text-[11px] text-zinc-400">
                        {u.username ? `@${u.username.replace(/^@/, '')}` : 'User'}{' '}
                        {u.uniqueId ? `· ID: ${u.uniqueId}` : ''}
                      </small>
                    </div>
                    <span className="rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 px-3 py-1.5 text-xs font-bold text-white shrink-0">
                      Select
                    </span>
                  </button>
                ))
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setShowGroup(true);
                setShowNew(false);
              }}
              className="flex shrink-0 w-full items-center gap-3 rounded-2xl border border-purple-400/20 bg-[#241436] p-3.5 text-left cursor-pointer"
            >
              <Users className="text-purple-300 shrink-0" />
              <span>
                <b className="block text-sm">Create a group chat</b>
                <small className="text-zinc-400">Invite multiple members and chat together</small>
              </span>
            </button>
          </div>
        </div>
      )}

      {showGroup && (
        <div className="fixed inset-0 z-40 flex items-end bg-black/70" onClick={() => setShowGroup(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85dvh] w-full overflow-y-auto rounded-t-3xl border border-purple-400/30 bg-[#170d26] p-5 pb-[max(24px,var(--app-safe-bottom,0px))]"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-black">Create group</h2>
              <button type="button" onClick={() => setShowGroup(false)} className="cursor-pointer">
                <X />
              </button>
            </div>
            <input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Group name"
              className="mb-4 h-12 w-full rounded-xl border border-purple-400/25 bg-[#241436] px-4 text-sm outline-none"
            />
            <p className="mb-2 text-xs font-bold text-purple-200">
              Add members ({directoryUsers.length} registered users)
            </p>
            {directoryUsers.length === 0 ? (
              <p className="py-4 text-xs text-zinc-400">No other registered users found yet.</p>
            ) : (
              directoryUsers.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() =>
                    setSelectedMembers((prev) =>
                      prev.includes(u.id) ? prev.filter((x) => x !== u.id) : [...prev, u.id]
                    )
                  }
                  className="flex w-full items-center gap-3 rounded-xl p-2 text-left cursor-pointer hover:bg-white/5"
                >
                  <img
                    src={u.avatar || FALLBACK_AVATAR}
                    alt={u.displayName}
                    referrerPolicy="no-referrer"
                    className="h-10 w-10 rounded-full object-cover bg-[#1F1235]"
                  />
                  <span className="flex-1 text-sm">
                    {u.displayName}
                    <small className="block text-zinc-500">
                      @{u.username} {u.uniqueId ? `· ${u.uniqueId}` : ''}
                    </small>
                  </span>
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                      selectedMembers.includes(u.id)
                        ? 'border-purple-400 bg-purple-600'
                        : 'border-zinc-600'
                    }`}
                  >
                    {selectedMembers.includes(u.id) && <Check size={13} />}
                  </span>
                </button>
              ))
            )}
            <button
              type="button"
              onClick={createGroup}
              disabled={!groupName.trim() || selectedMembers.length === 0}
              className="mt-4 w-full rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 py-3 text-sm font-bold disabled:opacity-40 cursor-pointer"
            >
              Create group · {selectedMembers.length} selected
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const EmptyState: React.FC<{ title: string; subtitle: string }> = ({ title, subtitle }) => (
  <div className="flex flex-col items-center px-8 py-16 text-center">
    <div className="mb-4 rounded-full border border-purple-400/20 bg-purple-500/10 p-5 text-purple-300">
      <MessageCircle size={30} />
    </div>
    <h3 className="font-bold">{title}</h3>
    <p className="mt-1 text-xs text-zinc-500">{subtitle}</p>
  </div>
);
