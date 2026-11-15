import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { PullToRefresh, RefreshScopeButton } from '../components/common/PullToRefresh';
import {
  acceptChatRequest,
  rejectOrBlockChatRequest,
  subscribeToMyChatRequests,
  subscribeToMyChats,
  subscribeToChatMessages,
  fetchOlderChatMessages,
  createGroupChat,
  sendChatMessage,
  setChatPresence,
  subscribeToChatPresence,
  uploadChatMedia,
  markChatMessageRead,
  markChatMessagesDelivered,
  markChatAsRead,
  deleteChatMessage,
  subscribeToMyGroupInvites,
  respondToGroupInvite,
  searchFirebaseUsers,
  getOrCreateDirectChat,
  ChatPayload,
} from '../services/chatService';
import { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
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
  Clock,
  AlertCircle,
  WifiOff,
  ChevronUp,
  Loader2,
  RefreshCw,
} from 'lucide-react';

type RequestItem = { id: string; user: User; message: string; time: string };
type DeliveryState = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
type LocalMessage = ChatMessage & {
  replyTo?: string;
  deletedForEveryone?: boolean;
  edited?: boolean;
  kind?: 'text' | 'image' | 'video' | 'audio' | 'link';
  deliveryState?: DeliveryState;
  errorText?: string;
  resolvedServerId?: string;
  retryPayload?: ChatPayload;
  retryOtherIds?: string[];
};

const EMOJIS = ['💜', '❤️', '😂', '😍', '🔥', '👑', '🎉', '🥰', '👏', '✨', '🌹', '👍'];

const buildAvatarFallback = (name?: string) => {
  const initial = (name || 'A').trim().charAt(0).toUpperCase() || 'A';
  return `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#7928CA"/><stop offset="100%" stop-color="#EC4899"/></linearGradient></defs><rect width="64" height="64" rx="32" fill="url(#g)"/><text x="32" y="41" text-anchor="middle" font-family="Arial,sans-serif" font-size="26" font-weight="bold" fill="#fff">${initial}</text></svg>`
  )}`;
};

const applyAvatarFallback = (e: React.SyntheticEvent<HTMLImageElement>, name?: string) => {
  const target = e.currentTarget;
  if (target.dataset.fallbackApplied) return;
  target.dataset.fallbackApplied = '1';
  target.src = buildAvatarFallback(name);
};

const formatLastSeenLabel = (lastSeen?: any): string => {
  if (!lastSeen) return '';
  const date: Date | null =
    typeof lastSeen?.toDate === 'function'
      ? lastSeen.toDate()
      : typeof lastSeen === 'string' || typeof lastSeen === 'number'
      ? new Date(lastSeen)
      : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 60_000) return 'Last seen just now';
  if (diffMs < 3_600_000) return `Last seen ${Math.max(1, Math.floor(diffMs / 60_000))}m ago`;
  if (diffMs < 86_400_000) {
    return `Last seen ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  return `Last seen ${date.toLocaleDateString()}`;
};

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
  const [showSearch, setShowSearch] = useState(false);
  const [requests, setRequests] = useState<RequestItem[]>([]);
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
  const [olderMessages, setOlderMessages] = useState<LocalMessage[]>([]);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [oldestMessageDoc, setOldestMessageDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [pendingMessages, setPendingMessages] = useState<LocalMessage[]>([]);
  const [chatLoadError, setChatLoadError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [partnerPresence, setPartnerPresence] = useState<{ online: boolean; lastSeen?: any }>({
    online: false,
  });
  const [foundUsers, setFoundUsers] = useState<User[]>([]);
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const [groupInvites, setGroupInvites] = useState<any[]>([]);

  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const messagesScrollRef = useRef<HTMLElement>(null);
  const hasLoadedOlderRef = useRef(false);

  const directoryUsers = useMemo(
    () => (realUsers.length > 0 ? realUsers : registeredUsers).filter((u) => u.id !== currentUser.id),
    [realUsers, registeredUsers, currentUser.id]
  );

  // Track device network online/offline status for honest chat state feedback
  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // Real-time Firestore Chat Requests, Conversations, Group Invites & Presence
  useEffect(() => {
    if (!auth.currentUser?.uid || auth.currentUser.uid !== currentUser.id) return;
    let unsubscribeRequests: (() => void) | undefined;
    let unsubscribeChats: (() => void) | undefined;
    let unsubscribeGroupInvites: (() => void) | undefined;
    setChatLoadError(null);
    try {
      unsubscribeRequests = subscribeToMyChatRequests((items) =>
        setRequests(
          items.map((item: any) => ({
            id: item.id,
            user: {
              id: item.sender?.id || item.senderId,
              uniqueId: item.sender?.uniqueId || 'AM_USER',
              displayName: item.sender?.displayName || 'Alpha Mate User',
              username: item.sender?.username || '',
              avatar: item.sender?.avatar || '',
            } as User,
            message: item.firstMessage || '',
            time: item.createdAt?.toDate?.()?.toLocaleString?.() || 'Just now',
          }))
        )
      );
      unsubscribeChats = subscribeToMyChats(
        (items) => {
          setChatLoadError(null);
          setFirebaseChats(
            items.map((item: any) => {
              const otherId = (item.participantIds || []).find((id: string) => id !== currentUser.id);
              const profile = item.participantProfiles?.[otherId] || {};
              const isGroup = item.type === 'group';
              return {
                id: item.id,
                inviteStatus: item.memberStatus?.[currentUser.id],
                user: {
                  id: otherId || currentUser.id,
                  uniqueId: profile.uniqueId || '',
                  displayName: profile.displayName || 'Alpha Mate User',
                  username: profile.username || '',
                  avatar: profile.avatar || '',
                } as User,
                groupName: item.groupName,
                isGroup,
                groupMembers: Object.entries(item.participantProfiles || {}).map(
                  ([id, value]: any) => ({ id, ...value } as User)
                ),
                lastMessage: item.lastMessage || '',
                lastTimestamp: item.updatedAt?.toDate?.()?.toLocaleString?.() || 'Just now',
                unreadCount: Number(item.unreadBy?.[currentUser.id] || 0),
                messages: [],
              } as Conversation;
            })
          );
        },
        (err) => {
          setChatLoadError(err?.message || 'Unable to sync conversations. Tap Retry.');
        }
      );
      unsubscribeGroupInvites = subscribeToMyGroupInvites(setGroupInvites);
      setChatPresence(true).catch(() => {});
    } catch (error: any) {
      console.warn('Chat listener unavailable:', error);
      setChatLoadError(error?.message || 'Chat listener unavailable.');
    }

    const handleOffline = () => setChatPresence(false).catch(() => {});
    window.addEventListener('pagehide', handleOffline);
    return () => {
      unsubscribeRequests?.();
      unsubscribeChats?.();
      unsubscribeGroupInvites?.();
      window.removeEventListener('pagehide', handleOffline);
      setChatPresence(false).catch(() => {});
    };
  }, [currentUser.id, chatRefreshEpoch]);

  // Reset pagination & optimistic buffers when switching active conversation
  useEffect(() => {
    hasLoadedOlderRef.current = false;
    setOlderMessages([]);
    setHasMoreMessages(false);
    setOldestMessageDoc(null);
    setPendingMessages([]);
    setChatLoadError(null);
  }, [activeConversation?.id]);

  // Subscribe to real partner presence for direct chats
  useEffect(() => {
    const partnerId = activeConversation?.user?.id;
    if (
      !activeConversation ||
      activeConversation.isGroup ||
      !partnerId ||
      partnerId === currentUser.id ||
      auth.currentUser?.uid !== currentUser.id
    ) {
      setPartnerPresence({ online: false });
      return;
    }

    return subscribeToChatPresence(
      partnerId,
      (online, lastSeen) => setPartnerPresence({ online, lastSeen }),
      () => setPartnerPresence({ online: false })
    );
  }, [activeConversation?.id, activeConversation?.isGroup, activeConversation?.user?.id, currentUser.id]);

  // Real-time Firestore messages listener for active conversation (paginated latest 40)
  useEffect(() => {
    if (!activeConversation?.id || !auth.currentUser || auth.currentUser.uid !== currentUser.id) {
      setFirebaseMessages([]);
      return;
    }
    const isFsChat =
      firebaseChats.some((c) => c.id === activeConversation.id) ||
      activeConversation.id.startsWith('dm_');
    if (!isFsChat) {
      setFirebaseMessages([]);
      return;
    }

    markChatAsRead(activeConversation.id).catch(() => {});

    return subscribeToChatMessages(
      activeConversation.id,
      (items, meta) => {
        setChatLoadError(null);
        const undeliveredIds: string[] = [];
        items.forEach((m: any) => {
          if (m.senderId !== currentUser.id) {
            if (!(m.deliveredTo || []).includes(currentUser.id)) {
              undeliveredIds.push(m.id);
            }
            if (!(m.readBy || []).includes(currentUser.id)) {
              markChatMessageRead(activeConversation.id, m.id).catch(() => {});
            }
          }
        });
        if (undeliveredIds.length > 0) {
          markChatMessagesDelivered(activeConversation.id, undeliveredIds).catch(() => {});
        }

        if (!hasLoadedOlderRef.current && meta) {
          setHasMoreMessages(meta.hasMore);
          setOldestMessageDoc(meta.oldestDoc);
        }

        const mapped: LocalMessage[] = items.map((m: any) => {
          const isMe = m.senderId === currentUser.id;
          const readOthers = Array.isArray(m.readBy)
            ? m.readBy.some((id: string) => id && id !== currentUser.id)
            : false;
          const deliveredOthers = Array.isArray(m.deliveredTo)
            ? m.deliveredTo.some((id: string) => id && id !== currentUser.id)
            : false;
          const deliveryState: DeliveryState = readOthers
            ? 'read'
            : deliveredOthers
            ? 'delivered'
            : 'sent';

          return {
            id: m.id,
            senderId: m.senderId,
            senderName:
              isMe
                ? currentUser.displayName
                : activeConversation.user?.displayName || 'Member',
            senderAvatar:
              isMe
                ? currentUser.avatar
                : activeConversation.user?.avatar || '',
            text: m.deletedForEveryone ? 'This message was deleted' : m.text || '',
            imageUrl: m.mediaUrl || undefined,
            timestamp:
              m.createdAt?.toDate?.()?.toLocaleTimeString?.([], { hour: '2-digit', minute: '2-digit' }) ||
              'Just now',
            isRead: readOthers,
            isMe,
            edited: !!m.edited,
            replyTo: m.replyTo,
            deliveryState,
          };
        });

        setFirebaseMessages(mapped);
        const liveIds = new Set(mapped.map((m) => m.id));
        setPendingMessages((prev) =>
          prev.filter((p) => !p.resolvedServerId || !liveIds.has(p.resolvedServerId))
        );
      },
      (err) => {
        setChatLoadError(err?.message || 'Unable to load conversation messages.');
      },
      40
    );
  }, [activeConversation?.id, firebaseChats.length, currentUser.id, chatRefreshEpoch]);

  const handleLoadOlderMessages = async () => {
    if (!activeConversation?.id || !oldestMessageDoc || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const res = await fetchOlderChatMessages(activeConversation.id, oldestMessageDoc, 40);
      hasLoadedOlderRef.current = true;
      setHasMoreMessages(res.hasMore);
      if (res.oldestDoc) {
        setOldestMessageDoc(res.oldestDoc);
      }
      const mappedOlder: LocalMessage[] = res.items.map((m: any) => {
        const isMe = m.senderId === currentUser.id;
        const readOthers = Array.isArray(m.readBy)
          ? m.readBy.some((id: string) => id && id !== currentUser.id)
          : false;
        const deliveredOthers = Array.isArray(m.deliveredTo)
          ? m.deliveredTo.some((id: string) => id && id !== currentUser.id)
          : false;
        return {
          id: m.id,
          senderId: m.senderId,
          senderName: isMe ? currentUser.displayName : activeConversation.user?.displayName || 'Member',
          senderAvatar: isMe ? currentUser.avatar : activeConversation.user?.avatar || '',
          text: m.deletedForEveryone ? 'This message was deleted' : m.text || '',
          imageUrl: m.mediaUrl || undefined,
          timestamp:
            m.createdAt?.toDate?.()?.toLocaleTimeString?.([], { hour: '2-digit', minute: '2-digit' }) ||
            'Earlier',
          isRead: readOthers,
          isMe,
          edited: !!m.edited,
          replyTo: m.replyTo,
          deliveryState: readOthers ? 'read' : deliveredOthers ? 'delivered' : 'sent',
        };
      });
      setOlderMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        return [...mappedOlder.filter((m) => !seen.has(m.id)), ...prev];
      });
    } catch (err: any) {
      showToast(err?.message || 'Failed to load older messages.');
    } finally {
      setLoadingOlder(false);
    }
  };

  // Scroll to bottom when latest live/pending messages grow (do NOT snap when prepending older history)
  const latestStreamCount = activeConversation
    ? firebaseChats.some((c) => c.id === activeConversation.id) || activeConversation.id.startsWith('dm_')
      ? firebaseMessages.length + pendingMessages.length
      : activeConversation.messages.length
    : 0;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [latestStreamCount, activeConversation?.id]);

  const allConversations = useMemo(
    () => [
      ...firebaseChats,
      ...localGroups.filter((g) => !firebaseChats.some((f) => f.id === g.id)),
      ...conversations.filter((c) => !firebaseChats.some((f) => f.id === c.id)),
    ],
    [firebaseChats, localGroups, conversations]
  );

  const filtered = allConversations.filter((c) => {
    if (filter === 'direct' && c.isGroup) return false;
    if (filter === 'groups' && !c.isGroup) return false;
    const name = c.isGroup ? c.groupName : c.user?.displayName;
    const uname = c.user?.username || '';
    const uid = c.user?.uniqueId || '';
    const q = query.trim().toLowerCase();
    return !q || (name || '').toLowerCase().includes(q) || uname.toLowerCase().includes(q) || uid.toLowerCase().includes(q);
  });

  // Real-time Firebase user search in Chat (works from 1+ characters & shows real directory when search opens)
  useEffect(() => {
    let cancelled = false;
    if (!showSearch || !auth.currentUser?.uid || auth.currentUser.uid !== currentUser.id) {
      setFoundUsers([]);
      setUserSearchLoading(false);
      return;
    }

    const term = query.trim().toLowerCase().replace(/^@/, '');
    // Immediate local match from subscribed realUsers
    const localHits = directoryUsers.filter(
      (u) =>
        !term ||
        u.displayName.toLowerCase().includes(term) ||
        (u.username || '').toLowerCase().includes(term) ||
        (u.uniqueId || '').toLowerCase().includes(term)
    );
    setFoundUsers(localHits.slice(0, 30));

    setUserSearchLoading(true);
    const timer = window.setTimeout(() => {
      searchFirebaseUsers(query, currentUser.id, 30)
        .then((items) => {
          if (!cancelled) {
            const mapped = items.map((item) => ({
              ...item,
              uniqueId: item.uniqueId || '',
              username: item.username || '',
              avatar: item.avatar || '',
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
    }, term ? 180 : 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, showSearch, currentUser.id, directoryUsers, userSyncRefreshEpoch]);

  // Open or create a real-time Firestore chat with any registered user
  const openUser = async (user: User) => {
    const existing = allConversations.find((c) => !c.isGroup && c.user?.id === user.id);
    if (existing) {
      openConversation(existing);
    } else if (auth.currentUser?.uid === currentUser.id) {
      try {
        const chatId = await getOrCreateDirectChat(
          {
            id: currentUser.id,
            displayName: currentUser.displayName,
            username: currentUser.username,
            uniqueId: currentUser.uniqueId,
            avatar: currentUser.avatar,
          },
          {
            id: user.id,
            displayName: user.displayName,
            username: user.username,
            uniqueId: user.uniqueId,
            avatar: user.avatar,
          }
        );
        const conv: Conversation = {
          id: chatId,
          user,
          lastMessage: 'Connected on Alpha Mate',
          lastTimestamp: 'Just now',
          unreadCount: 0,
          isGroup: false,
          messages: [],
        };
        openConversation(conv);
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Unable to open chat.');
      }
    }
    setShowNew(false);
    setShowSearch(false);
    setQuery('');
  };

  const acceptRequest = async (r: RequestItem) => {
    try {
      if (auth.currentUser?.uid === currentUser.id) {
        const chatId = await acceptChatRequest(r.id);
        sendNotificationToUser({
          recipientId: r.user.id,
          type: 'friend_request',
          category: 'friendRequests',
          title: `✅ ${currentUser.displayName} accepted your request`,
          message: `You are now connected! Tap to start chatting.`,
          screen: 'chat',
          chatId,
        }).catch(() => {});
        const conv: Conversation = {
          id: chatId,
          user: r.user,
          lastMessage: r.message,
          lastTimestamp: r.time,
          unreadCount: 0,
          isGroup: false,
          messages: [],
        };
        setRequests((prev) => prev.filter((x) => x.id !== r.id));
        openConversation(conv);
        return;
      }
    } catch (error) {
      console.error('Accept chat request failed:', error);
    }
  };

  const dispatchMessageNotifications = (messagePreview: string) => {
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
            chatId: activeConversation.id,
          }).catch(() => {});
        }
      });
    } else if (activeConversation.user?.id && activeConversation.user.id !== currentUser.id) {
      sendNotificationToUser({
        recipientId: activeConversation.user.id,
        type: 'message',
        category: 'messages',
        title: `💬 New message from ${currentUser.displayName}`,
        message: messagePreview.slice(0, 140),
        screen: 'chat',
        chatId: activeConversation.id,
      }).catch(() => {});
    }
  };

  const isFirestoreActiveChat = Boolean(
    activeConversation &&
      (firebaseChats.some((c) => c.id === activeConversation.id) ||
        activeConversation.id.startsWith('dm_'))
  );

  const sendOptimisticFirestoreMessage = async (
    chatId: string,
    payload: ChatPayload,
    otherIds: string[],
    kind: LocalMessage['kind'] = 'text',
    existingLocalId?: string
  ) => {
    const localId = existingLocalId || `pending_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const optimisticMsg: LocalMessage = {
      id: localId,
      senderId: currentUser.id,
      senderName: currentUser.displayName,
      senderAvatar: currentUser.avatar,
      text: payload.text || '',
      imageUrl: payload.mediaUrl,
      timestamp: 'Sending...',
      isRead: false,
      isMe: true,
      kind,
      replyTo: payload.replyTo,
      deliveryState: 'sending',
      errorText: undefined,
      retryPayload: payload,
      retryOtherIds: otherIds,
    };

    setPendingMessages((prev) =>
      existingLocalId
        ? prev.map((m) => (m.id === existingLocalId ? { ...m, deliveryState: 'sending', errorText: undefined } : m))
        : [...prev, optimisticMsg]
    );

    try {
      const serverMsgId = await sendChatMessage(chatId, payload, otherIds);
      setPendingMessages((prev) =>
        prev.map((m) => (m.id === localId ? { ...m, resolvedServerId: serverMsgId, deliveryState: 'sent' } : m))
      );
    } catch (error: any) {
      console.error('Firebase chat send failed:', error);
      const errText = !isOnline
        ? 'Offline — tap to retry'
        : error?.message || 'Failed to send — tap to retry';
      setPendingMessages((prev) =>
        prev.map((m) =>
          m.id === localId
            ? { ...m, deliveryState: 'failed', timestamp: 'Failed', errorText: errText }
            : m
        )
      );
      showToast(errText);
    }
  };

  const send = (text = draft, mediaUrl?: string, kind: LocalMessage['kind'] = 'text') => {
    if (!activeConversation || (!text.trim() && !mediaUrl)) return;
    if (editMessage) {
      if (auth.currentUser?.uid === currentUser.id && isFirestoreActiveChat) {
        import('../services/chatService')
          .then((m) => m.editChatMessage(activeConversation.id, editMessage.id, text))
          .catch((e) => showToast(e?.message || 'Unable to edit message.'));
      }
      setEditMessage(null);
      setDraft('');
      return;
    }

    const messageText =
      text.trim() ||
      (kind === 'image' ? 'Photo' : kind === 'video' ? 'Video' : kind === 'audio' ? 'Voice message' : 'Shared link');

    if (auth.currentUser?.uid === currentUser.id && isFirestoreActiveChat) {
      const otherIds = activeConversation.isGroup
        ? (activeConversation.groupMembers || []).map((m) => m.id).filter((id) => id !== currentUser.id)
        : [activeConversation.user?.id].filter((id): id is string => Boolean(id));
      void sendOptimisticFirestoreMessage(
        activeConversation.id,
        {
          text: messageText,
          mediaUrl,
          mediaType: kind === 'text' || kind === 'link' ? undefined : kind,
          replyTo: replyTo?.id,
        },
        otherIds,
        kind
      );
    } else if (localGroups.some((group) => group.id === activeConversation.id)) {
      const newMessage: LocalMessage = {
        id: `group_msg_${Date.now()}`,
        senderId: currentUser.id,
        senderName: currentUser.displayName,
        senderAvatar: currentUser.avatar,
        text: messageText,
        imageUrl: mediaUrl,
        timestamp: 'Just now',
        isRead: false,
        isMe: true,
        kind,
        deliveryState: 'sent',
      };
      const updated = {
        ...activeConversation,
        lastMessage: messageText,
        lastTimestamp: 'Just now',
        messages: [...activeConversation.messages, newMessage],
      };
      setLocalGroups((prev) => prev.map((group) => (group.id === updated.id ? updated : group)));
      openConversation(updated);
      dispatchMessageNotifications(messageText);
    } else {
      sendMessage(activeConversation.id, messageText, mediaUrl);
      dispatchMessageNotifications(messageText);
    }

    setDraft('');
    setReplyTo(null);
    setShowEmoji(false);
  };

  const handleFile = async (file?: File) => {
    if (!file || !activeConversation) return;
    const kind = file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'audio' : 'image';
    try {
      if (auth.currentUser?.uid === currentUser.id && isFirestoreActiveChat) {
        const url = await uploadChatMedia(activeConversation.id, file);
        const otherIds = activeConversation.isGroup
          ? (activeConversation.groupMembers || []).map((m) => m.id).filter((id) => id !== currentUser.id)
          : [activeConversation.user?.id].filter((id): id is string => Boolean(id));
        await sendOptimisticFirestoreMessage(
          activeConversation.id,
          { text: file.name, mediaUrl: url, mediaType: kind },
          otherIds,
          kind
        );
      } else {
        const reader = new FileReader();
        reader.onload = () => send(file.name, String(reader.result), kind);
        reader.readAsDataURL(file);
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Upload failed.');
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
    const partner = activeConversation.user;
    const mergedFirestoreMessages: LocalMessage[] = (() => {
      const byId = new Map<string, LocalMessage>();
      olderMessages.forEach((m) => byId.set(m.id, m));
      firebaseMessages.forEach((m) => byId.set(m.id, m));
      const base = Array.from(byId.values());
      const remainingPending = pendingMessages.filter(
        (p) => !p.resolvedServerId || !byId.has(p.resolvedServerId)
      );
      return [...base, ...remainingPending];
    })();
    const messages = (isFirestoreActiveChat ? mergedFirestoreMessages : activeConversation.messages) as LocalMessage[];
    const headerAvatarSrc = activeConversation.isGroup
      ? activeConversation.groupMembers?.[0]?.avatar || partner?.avatar || buildAvatarFallback(activeConversation.groupName)
      : partner?.avatar || buildAvatarFallback(partner?.displayName);
    const headerTitle = activeConversation.isGroup ? activeConversation.groupName : partner?.displayName;
    const lastSeenLabel = !activeConversation.isGroup ? formatLastSeenLabel(partnerPresence.lastSeen) : '';

    return (
      <div className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-[#090510] text-white">
        <header className="shrink-0 border-b border-purple-500/20 bg-[#130922]/95 px-3 pb-3 pt-[max(14px,env(safe-area-inset-top))]">
          <div className="flex items-center gap-3">
            <button
              onClick={() => openConversation(null as any)}
              className="rounded-full p-2 text-zinc-300 hover:bg-white/10 cursor-pointer"
            >
              <ArrowLeft size={21} />
            </button>
            <div
              onClick={() => {
                if (!activeConversation.isGroup && partner?.id) {
                  openPublicUserProfile(partner);
                }
              }}
              className="relative cursor-pointer"
            >
              <img
                src={headerAvatarSrc}
                alt={headerTitle}
                referrerPolicy="no-referrer"
                onError={(e) => applyAvatarFallback(e, headerTitle)}
                className="h-11 w-11 rounded-full border border-fuchsia-400/60 object-cover bg-[#1F153B]"
              />
              {!activeConversation.isGroup && partnerPresence.online && (
                <i className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#130922] bg-emerald-400" />
              )}
            </div>
            <div
              onClick={() => {
                if (!activeConversation.isGroup && partner?.id) {
                  openPublicUserProfile(partner);
                }
              }}
              className="min-w-0 flex-1 cursor-pointer"
            >
              <div className="truncate text-[15px] font-bold">{headerTitle}</div>
              <div
                className={`text-[11px] ${
                  !activeConversation.isGroup && partnerPresence.online
                    ? 'text-emerald-400'
                    : 'text-zinc-400'
                }`}
              >
                {activeConversation.isGroup
                  ? `${activeConversation.groupMembers?.length || 1} members`
                  : partnerPresence.online
                  ? 'Online'
                  : lastSeenLabel || (partner?.username ? `@${partner.username}` : 'Offline')}
              </div>
            </div>
            <button
              onClick={() => setCallState('voice')}
              className="rounded-full p-2.5 text-emerald-300 hover:bg-emerald-400/10 cursor-pointer"
              title="Voice call"
            >
              <Phone size={19} />
            </button>
            <button
              onClick={() => setCallState('video')}
              className="rounded-full p-2.5 text-fuchsia-300 hover:bg-fuchsia-400/10 cursor-pointer"
              title="Video call"
            >
              <Video size={20} />
            </button>
            <RefreshScopeButton scope="chat" compact className="w-9 h-9" title="Refresh chat messages" />
            <button
              onClick={() => setShowAttach((v) => !v)}
              className="rounded-full p-2 text-zinc-300 cursor-pointer"
            >
              <MoreVertical size={20} />
            </button>
          </div>
        </header>

        {!isOnline && (
          <div className="mx-3 mt-2 flex items-center gap-2 rounded-xl border border-amber-400/35 bg-amber-500/15 px-3 py-2 text-[11px] font-semibold text-amber-200">
            <WifiOff size={14} className="shrink-0" />
            <span>You are offline. Messages sent now may fail and can be tapped to retry.</span>
          </div>
        )}

        {chatLoadError && (
          <div className="mx-3 mt-2 flex items-center justify-between gap-2 rounded-xl border border-rose-400/35 bg-rose-500/15 px-3 py-2 text-[11px] font-semibold text-rose-200">
            <span className="truncate">{chatLoadError}</span>
            <button
              type="button"
              onClick={() => refreshScope('chat')}
              className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-white/20 shrink-0 cursor-pointer"
            >
              <RefreshCw size={11} /> Retry
            </button>
          </div>
        )}

        {callState !== 'idle' && (
          <div className="mx-3 mt-3 flex items-center justify-between rounded-2xl border border-purple-400/30 bg-purple-950/70 p-3">
            <div className="flex items-center gap-2">
              <PhoneCall size={17} className="text-emerald-300" />
              <div>
                <p className="text-sm font-semibold">{callState === 'voice' ? 'Voice call' : 'Video call'}</p>
                <p className="text-[10px] text-zinc-400">Connecting call channel...</p>
              </div>
            </div>
            <button
              onClick={() => setCallState('idle')}
              className="rounded-full bg-rose-500/20 p-2 text-rose-300 cursor-pointer"
            >
              <X size={17} />
            </button>
          </div>
        )}

        <main
          ref={messagesScrollRef}
          className="flex-1 space-y-3 overflow-y-auto bg-[radial-gradient(ellipse_at_top,_#291044_0%,_#10091c_42%,_#090510_100%)] px-3 py-4"
        >
          <PullToRefresh
            scrollContainerRef={messagesScrollRef}
            label="Refreshing messages..."
            onRefresh={() => refreshScope('chat')}
          />

          {isFirestoreActiveChat && hasMoreMessages && (
            <div className="flex justify-center pb-1">
              <button
                type="button"
                disabled={loadingOlder}
                onClick={handleLoadOlderMessages}
                className="inline-flex items-center gap-1.5 rounded-full border border-purple-400/30 bg-purple-950/70 px-3.5 py-1.5 text-[11px] font-bold text-purple-200 hover:bg-purple-900/80 disabled:opacity-60 cursor-pointer"
              >
                {loadingOlder ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <ChevronUp size={13} />
                )}
                <span>{loadingOlder ? 'Loading history...' : 'Load older messages'}</span>
              </button>
            </div>
          )}

          <div className="mx-auto w-fit rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[10px] text-zinc-400">
            Today · Alpha Mate Real-Time Chat
          </div>
          {messages.length === 0 && (
            <div className="text-center py-10 text-xs text-zinc-400">
              Say hello to start chatting in real time! 👋
            </div>
          )}
          {messages.map((msg) => {
            const isPendingOrFailed = msg.deliveryState === 'sending' || msg.deliveryState === 'failed';
            return (
              <div key={msg.id} className={`flex ${msg.isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[82%] ${msg.isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                  {msg.replyTo && (
                    <div className="mb-1 rounded-lg bg-black/30 px-3 py-1 text-[10px] text-purple-200">
                      Replying to a message
                    </div>
                  )}
                  <button
                    onContextMenu={(e) => {
                      e.preventDefault();
                      if (!isPendingOrFailed) setMenuMessage(msg);
                    }}
                    onClick={() => {
                      if (msg.deliveryState === 'failed' && msg.retryPayload && activeConversation?.id) {
                        void sendOptimisticFirestoreMessage(
                          activeConversation.id,
                          msg.retryPayload,
                          msg.retryOtherIds || [],
                          msg.kind || 'text',
                          msg.id
                        );
                        return;
                      }
                      if (!isPendingOrFailed) setMenuMessage(msg);
                    }}
                    className={`rounded-2xl px-3.5 py-2.5 text-left text-[13px] leading-relaxed shadow-lg transition-opacity ${
                      msg.deliveryState === 'sending' ? 'opacity-75' : ''
                    } ${
                      msg.deliveryState === 'failed'
                        ? 'rounded-br-sm border border-rose-400/60 bg-rose-950/75'
                        : msg.isMe
                        ? 'rounded-br-sm bg-gradient-to-br from-[#8B27D8] to-[#D52DAB]'
                        : 'rounded-bl-sm border border-purple-400/15 bg-[#211332]'
                    }`}
                  >
                    {msg.imageUrl &&
                      (msg.imageUrl.startsWith('data:video') ? (
                        <video src={msg.imageUrl} controls className="mb-2 max-h-48 rounded-xl" />
                      ) : (
                        <img src={msg.imageUrl} className="mb-2 max-h-52 rounded-xl object-cover" />
                      ))}
                    {msg.text && <span>{msg.text}</span>}
                    {msg.edited && <span className="ml-2 text-[9px] opacity-70">edited</span>}
                  </button>
                  <div className="mt-1 flex items-center gap-1 px-1 text-[10px] text-zinc-500">
                    <span>{msg.deliveryState === 'failed' ? msg.errorText || 'Tap to retry' : msg.timestamp}</span>
                    {msg.isMe && (
                      <>
                        {msg.deliveryState === 'sending' ? (
                          <Clock size={12} className="text-zinc-400" />
                        ) : msg.deliveryState === 'failed' ? (
                          <AlertCircle size={12} className="text-rose-400" />
                        ) : msg.deliveryState === 'read' ? (
                          <CheckCheck size={13} className="text-cyan-300" />
                        ) : msg.deliveryState === 'delivered' ? (
                          <CheckCheck size={13} className="text-zinc-400" />
                        ) : (
                          <Check size={12} className="text-zinc-400" />
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={chatEndRef} />
        </main>

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
                  <button key={e} onClick={() => setMenuMessage(null)} className="text-2xl">
                    {e}
                  </button>
                ))}
              </div>
              <button
                onClick={() => {
                  setReplyTo(menuMessage);
                  setMenuMessage(null);
                }}
                className="flex w-full items-center gap-3 rounded-xl p-3 text-sm hover:bg-white/5"
              >
                <Reply size={17} /> Reply
              </button>
              {menuMessage.isMe && (
                <button
                  onClick={() => {
                    setEditMessage(menuMessage);
                    setDraft(menuMessage.text || '');
                    setMenuMessage(null);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl p-3 text-sm hover:bg-white/5"
                >
                  <Pencil size={17} /> Edit message
                </button>
              )}
              <button
                onClick={() => {
                  if (auth.currentUser?.uid === currentUser.id && isFirestoreActiveChat) {
                    deleteChatMessage(activeConversation.id, menuMessage.id, false).catch((e) => console.error(e));
                  }
                  setMenuMessage(null);
                }}
                className="flex w-full items-center gap-3 rounded-xl p-3 text-sm hover:bg-white/5"
              >
                <Trash2 size={17} /> Delete for me
              </button>
              {menuMessage.isMe && (
                <button
                  onClick={() => {
                    if (auth.currentUser?.uid === currentUser.id && isFirestoreActiveChat) {
                      deleteChatMessage(activeConversation.id, menuMessage.id, true).catch((e) => console.error(e));
                    }
                    setMenuMessage(null);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl p-3 text-sm text-rose-300 hover:bg-white/5"
                >
                  <Trash2 size={17} /> Delete for everyone
                </button>
              )}
            </div>
          </div>
        )}

        {showEmoji && (
          <div className="grid grid-cols-6 gap-2 border-t border-purple-400/20 bg-[#160d25] p-3">
            {EMOJIS.map((e) => (
              <button key={e} onClick={() => setDraft((v) => v + e)} className="text-2xl">
                {e}
              </button>
            ))}
          </div>
        )}
        {showAttach && (
          <div className="grid grid-cols-4 gap-2 border-t border-purple-400/20 bg-[#160d25] p-3">
            <button onClick={() => cameraRef.current?.click()} className="flex flex-col items-center gap-1 text-xs text-purple-200">
              <Camera className="text-fuchsia-300" />
              Camera
            </button>
            <button onClick={() => fileRef.current?.click()} className="flex flex-col items-center gap-1 text-xs text-purple-200">
              <ImageIcon className="text-cyan-300" />
              Gallery
            </button>
            <button onClick={() => videoRef.current?.click()} className="flex flex-col items-center gap-1 text-xs text-purple-200">
              <FileVideo className="text-pink-300" />
              Video
            </button>
            <button
              onClick={() => {
                setDraft((v) => v + ' https://');
                setShowAttach(false);
              }}
              className="flex flex-col items-center gap-1 text-xs text-purple-200"
            >
              <LinkIcon className="text-amber-300" />
              Link
            </button>
          </div>
        )}
        {replyTo && (
          <div className="flex items-center justify-between border-t border-purple-400/20 bg-[#190f2b] px-4 py-2 text-xs">
            <span className="text-purple-200">Replying to: {replyTo.text?.slice(0, 50) || 'attachment'}</span>
            <button onClick={() => setReplyTo(null)}>
              <X size={15} />
            </button>
          </div>
        )}
        {editMessage && (
          <div className="flex items-center justify-between border-t border-purple-400/20 bg-[#190f2b] px-4 py-2 text-xs text-amber-200">
            <span>Editing message</span>
            <button
              onClick={() => {
                setEditMessage(null);
                setDraft('');
              }}
            >
              <X size={15} />
            </button>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="flex shrink-0 items-center gap-2 border-t border-purple-400/20 bg-[#10091d] px-3 py-3 pb-[max(12px,env(safe-area-inset-bottom))]"
        >
          <button
            type="button"
            onClick={() => setShowAttach((v) => !v)}
            className="rounded-full bg-purple-500/15 p-2.5 text-purple-200 cursor-pointer"
          >
            <Plus size={21} />
          </button>
          <button
            type="button"
            onClick={() => setShowEmoji((v) => !v)}
            className="text-zinc-400 cursor-pointer"
          >
            <Smile size={21} />
          </button>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Message..."
            className="h-11 min-w-0 flex-1 rounded-full border border-purple-400/25 bg-[#21152f] px-4 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-fuchsia-400"
          />
          {draft.trim() ? (
            <button className="rounded-full bg-gradient-to-r from-purple-600 to-pink-500 p-3 text-white cursor-pointer">
              <Send size={17} />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => send('🎙️ Voice message (0:08)')}
              className="rounded-full bg-gradient-to-r from-purple-600 to-pink-500 p-3 text-white cursor-pointer"
            >
              <Mic size={18} />
            </button>
          )}
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
      <header className="sticky top-0 z-10 border-b border-purple-500/15 bg-[#10091d]/95 px-4 pb-3 pt-[max(16px,env(safe-area-inset-top))] backdrop-blur-xl">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-black tracking-tight">Chats</h1>
              <p className="mt-0.5 text-[11px] text-zinc-500">Real-time conversations &amp; user search</p>
            </div>
            <div className="flex items-center gap-2">
              <RefreshScopeButton
                scope="chat"
                compact
                className="h-11 w-11 border-purple-400/20 bg-purple-500/10 text-purple-200"
                title="Refresh chats"
              />
              <button
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
                onClick={() => setShowNew(true)}
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
            onClick={() => setTab('chats')}
            className={`rounded-xl py-2.5 text-sm font-bold cursor-pointer ${
              tab === 'chats' ? 'bg-gradient-to-r from-purple-600 to-fuchsia-500 text-white' : 'text-zinc-400'
            }`}
          >
            Chats <span className="ml-1 text-[10px]">{allConversations.length}</span>
          </button>
          <button
            onClick={() => setTab('requests')}
            className={`rounded-xl py-2.5 text-sm font-bold cursor-pointer ${
              tab === 'requests' ? 'bg-gradient-to-r from-purple-600 to-fuchsia-500 text-white' : 'text-zinc-400'
            }`}
          >
            Requests{' '}
            {requests.length + groupInvites.length > 0 && (
              <span className="ml-1 rounded-full bg-pink-500 px-1.5 py-0.5 text-[10px]">
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

      {!isOnline && (
        <div className="mx-3 mt-3 flex items-center gap-2 rounded-xl border border-amber-400/35 bg-amber-500/15 px-3 py-2 text-[11px] font-semibold text-amber-200">
          <WifiOff size={14} className="shrink-0" />
          <span>Offline mode — check your internet connection to sync new messages.</span>
        </div>
      )}

      {chatLoadError && (
        <div className="mx-3 mt-3 flex items-center justify-between gap-2 rounded-xl border border-rose-400/35 bg-rose-500/15 px-3 py-2 text-[11px] font-semibold text-rose-200">
          <span className="truncate">{chatLoadError}</span>
          <button
            type="button"
            onClick={() => refreshScope('chat')}
            className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-white/20 shrink-0 cursor-pointer"
          >
            <RefreshCw size={11} /> Retry
          </button>
        </div>
      )}

      {tab === 'requests' ? (
        <section className="space-y-3 p-4">
          <div className="mb-4 rounded-2xl border border-amber-400/20 bg-amber-500/5 p-3 text-xs leading-relaxed text-amber-100">
            <ShieldCheck size={16} className="mr-2 inline" />
            Messages or group invites from new users appear here. Accept to connect in real time.
          </div>
          {groupInvites.map((invite) => (
            <div key={invite.id} className="rounded-2xl border border-fuchsia-400/25 bg-[#1b102b] p-3">
              <p className="text-sm font-bold">{invite.groupName || 'Group invitation'}</p>
              <p className="mt-1 text-xs text-zinc-400">You have been invited to join this group.</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  onClick={() =>
                    respondToGroupInvite(invite.chatId, true)
                      .then(() => setGroupInvites((v) => v.filter((x) => x.id !== invite.id)))
                      .catch((e) => showToast(e.message))
                  }
                  className="rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 py-2 text-xs font-bold cursor-pointer"
                >
                  Accept Group
                </button>
                <button
                  onClick={() =>
                    respondToGroupInvite(invite.chatId, false)
                      .then(() => setGroupInvites((v) => v.filter((x) => x.id !== invite.id)))
                      .catch((e) => showToast(e.message))
                  }
                  className="rounded-xl border border-rose-400/30 py-2 text-xs font-bold text-rose-300 cursor-pointer"
                >
                  Decline
                </button>
              </div>
            </div>
          ))}

          {requests.length === 0 && groupInvites.length === 0 ? (
            <EmptyState title="No message requests" subtitle="New requests from users will appear here." />
          ) : (
            requests.map((r) => (
              <div key={r.id} className="rounded-2xl border border-purple-400/20 bg-[#160d25] p-3">
                <div className="flex items-center gap-3">
                  <img
                    src={r.user.avatar || buildAvatarFallback(r.user.displayName)}
                    referrerPolicy="no-referrer"
                    onError={(e) => applyAvatarFallback(e, r.user.displayName)}
                    className="h-12 w-12 rounded-full object-cover bg-[#1F153B]"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{r.user.displayName}</p>
                    <p className="text-[11px] text-zinc-500">
                      @{r.user.username} · {r.time}
                    </p>
                    <p className="mt-1 truncate text-xs text-zinc-300">{r.message}</p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => acceptRequest(r)}
                    className="rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 py-2 text-xs font-bold cursor-pointer"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => {
                      if (auth.currentUser?.uid === currentUser.id) {
                        rejectOrBlockChatRequest(r.id, true).catch((e) => console.error(e));
                      }
                      setRequests((prev) => prev.filter((x) => x.id !== r.id));
                    }}
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
            <div className="mb-4 rounded-2xl border border-purple-400/20 bg-[#130B23] p-2">
              <div className="flex items-center justify-between px-2 pb-2">
                <p className="text-xs font-bold text-purple-200">
                  Real-Time Alpha Mate Users ({foundUsers.length})
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
                        className="flex w-full items-center gap-2.5 rounded-xl p-2 hover:bg-white/5 transition-colors"
                      >
                        <button
                          type="button"
                          onClick={() => openPublicUserProfile(u)}
                          className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer"
                        >
                          <img
                            src={u.avatar || buildAvatarFallback(u.displayName)}
                            referrerPolicy="no-referrer"
                            onError={(e) => applyAvatarFallback(e, u.displayName)}
                            className="h-10 w-10 rounded-full object-cover border border-purple-400/30 shrink-0 bg-[#1F153B]"
                          />
                          <div className="min-w-0 flex-1">
                            <b className="block text-xs sm:text-sm text-white truncate">{u.displayName}</b>
                            <small className="text-[10.5px] text-zinc-400 block truncate">
                              @{u.username} {u.uniqueId ? `· ${u.uniqueId}` : ''}
                            </small>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => toggleFollowUser(u)}
                          className={`px-2.5 py-1.5 rounded-xl text-[10.5px] font-bold flex items-center gap-1 cursor-pointer shrink-0 ${
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
                          title="Start real-time chat"
                          className="w-8 h-8 rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 flex items-center justify-center text-white cursor-pointer shrink-0"
                        >
                          <MessageCircle size={15} />
                        </button>

                        <button
                          type="button"
                          onClick={() => openPublicUserProfile(u)}
                          title="Visit Profile"
                          className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-zinc-300 hover:text-white cursor-pointer shrink-0 hidden sm:flex"
                        >
                          <Eye size={15} />
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
              subtitle="Tap the search icon above to find any registered user and start chatting in real time."
            />
          ) : (
            filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => openConversation(c)}
                className="flex w-full items-center gap-3 border-b border-purple-400/10 px-2 py-3.5 text-left hover:bg-white/[0.03] cursor-pointer"
              >
                <div className="relative shrink-0">
                  <img
                    src={
                      c.isGroup
                        ? c.groupMembers?.[0]?.avatar || c.user.avatar || buildAvatarFallback(c.groupName)
                        : c.user.avatar || buildAvatarFallback(c.user.displayName)
                    }
                    referrerPolicy="no-referrer"
                    onError={(e) => applyAvatarFallback(e, c.isGroup ? c.groupName : c.user.displayName)}
                    className="h-14 w-14 rounded-full border border-purple-400/30 object-cover bg-[#1F153B]"
                  />
                  {c.isGroup && (
                    <span className="absolute -bottom-1 -right-1 rounded-full bg-purple-600 p-1">
                      <Users size={11} />
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <b className="truncate text-sm">{c.isGroup ? c.groupName : c.user.displayName}</b>
                    <span className="shrink-0 text-[10px] text-zinc-500">{c.lastTimestamp}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2">
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

      {showNew && (
        <div className="fixed inset-0 z-30 flex items-end bg-black/65" onClick={() => setShowNew(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full rounded-t-3xl border border-purple-400/30 bg-[#170d26] p-5 pb-[max(24px,env(safe-area-inset-bottom))]"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-black">Start a conversation</h2>
              <button onClick={() => setShowNew(false)} className="cursor-pointer">
                <X />
              </button>
            </div>
            <button
              onClick={() => {
                setShowNew(false);
                setShowSearch(true);
                setTab('chats');
              }}
              className="mb-3 flex w-full items-center gap-3 rounded-2xl border border-purple-400/20 bg-[#241436] p-4 text-left cursor-pointer"
            >
              <Search className="text-fuchsia-300" />
              <span>
                <b className="block text-sm">Find a user</b>
                <small className="text-zinc-400">Search real users by name, @username or AM ID</small>
              </span>
            </button>
            <button
              onClick={() => {
                setShowGroup(true);
                setShowNew(false);
              }}
              className="flex w-full items-center gap-3 rounded-2xl border border-purple-400/20 bg-[#241436] p-4 text-left cursor-pointer"
            >
              <Users className="text-purple-300" />
              <span>
                <b className="block text-sm">Create a group</b>
                <small className="text-zinc-400">Add real members and chat together</small>
              </span>
            </button>
          </div>
        </div>
      )}

      {showGroup && (
        <div className="fixed inset-0 z-40 flex items-end bg-black/70" onClick={() => setShowGroup(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85dvh] w-full overflow-y-auto rounded-t-3xl border border-purple-400/30 bg-[#170d26] p-5 pb-[max(24px,env(safe-area-inset-bottom))]"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-black">Create group</h2>
              <button onClick={() => setShowGroup(false)} className="cursor-pointer">
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
                  onClick={() =>
                    setSelectedMembers((prev) =>
                      prev.includes(u.id) ? prev.filter((x) => x !== u.id) : [...prev, u.id]
                    )
                  }
                  className="flex w-full items-center gap-3 rounded-xl p-2 text-left cursor-pointer hover:bg-white/5"
                >
                  <img
                    src={u.avatar || buildAvatarFallback(u.displayName)}
                    referrerPolicy="no-referrer"
                    onError={(e) => applyAvatarFallback(e, u.displayName)}
                    className="h-10 w-10 rounded-full object-cover bg-[#1F153B]"
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
