import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { TopBar } from '../components/navigation/TopBar';
import { PartyRoom, PartySeat, User, Gift } from '../types';
import { p2pStreamingEngine } from '../services/webrtcService';
import { PartyRoomAtmosphere } from '../components/party/PartyRoomAtmosphere';
import { VipAvatarFrame } from '../components/brand/VipAvatarFrame';
import { VIRTUAL_GIFTS, MOCK_HOSTS } from '../data/mockData';
import { copyToClipboard } from '../utils/clipboard';
import {
  Radio,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Users,
  Plus,
  Crown,
  Share2,
  X,
  Music,
  Heart,
  Send,
  Sparkles,
  Gift as GiftIcon,
  MoreHorizontal,
  Settings,
  Check,
  Disc3,
  Play,
  Pause,
  Flame,
  ShieldCheck,
  ChevronRight,
  Info,
  Lock,
  Unlock,
  Zap,
  ArrowUpRight,
  Shield,
  ShieldAlert,
  Trash2,
  Eye,
  UserX,
  Ban,
} from 'lucide-react';
import { UserActionSheetModal } from '../components/live/UserActionSheetModal';
import { RoomViewersModal } from '../components/live/RoomViewersModal';
import { MOCK_ROOM_VIEWERS } from '../data/mockData';

interface FloatingHeart {
  id: number;
  x: number;
  y: number;
  color: string;
}

interface ChatItem {
  id: string;
  sender: {
    displayName: string;
    avatar: string;
    vipTier?: number;
    level?: number;
    isHost?: boolean;
  };
  text: string;
  type: 'room' | 'host' | 'system' | 'gift';
  giftName?: string;
  giftIcon?: string;
  giftCoins?: number;
  timestamp?: string;
}

const PLAYLIST_TRACKS = [
  { id: '1', title: 'Alpha Mate Club Anthem (VIP Mix)', artist: 'DJ Kairo', duration: '3:45' },
  { id: '2', title: 'Midnight Neon Beats & Chill', artist: 'Luna Star', duration: '4:12' },
  { id: '3', title: 'Cyberwave Royal Bass Drop', artist: 'Electro_9', duration: '3:20' },
  { id: '4', title: 'Late Night Acoustic Lounge', artist: 'Zainab Live', duration: '3:50' },
];

export interface PartyTierSetting {
  level: 1 | 2 | 3;
  name: string;
  urduName: string;
  hostCount: number;
  guestCount: number;
  totalSeats: number;
  requiredLevel: number;
  badge: string;
  tagline: string;
  icon: string;
  accentColor: string;
}

export const PARTY_TIER_SETTINGS: PartyTierSetting[] = [
  {
    level: 1,
    name: '1 Host + 4 Seats',
    urduName: '1 ہوسٹ اور 4 سیٹیں',
    hostCount: 1,
    guestCount: 4,
    totalSeats: 5,
    requiredLevel: 0,
    badge: 'FREE (Lv. 0)',
    tagline: 'All Users Free • Acoustic & Casual Chill Lounge',
    icon: '🎙️',
    accentColor: '#A855F7',
  },
  {
    level: 2,
    name: '1 Host + 8 Seats',
    urduName: '1 ہوسٹ اور 8 سیٹیں',
    hostCount: 1,
    guestCount: 8,
    totalSeats: 9,
    requiredLevel: 10,
    badge: 'Unlocks at Lv. 10',
    tagline: 'Popular Audio Club • 8 Live Guest Seats',
    icon: '🔥',
    accentColor: '#EC4899',
  },
  {
    level: 3,
    name: '1 Host + 15 Seats',
    urduName: '1 ہوسٹ اور 15 سیٹیں',
    hostCount: 1,
    guestCount: 15,
    totalSeats: 16,
    requiredLevel: 25,
    badge: 'Unlocks at Lv. 25',
    tagline: 'Grand Royal Festival Stage • 15 Live Guest Seats',
    icon: '👑',
    accentColor: '#F59E0B',
  },
];

export const PartyRoomsScreen: React.FC = () => {
  const {
    partyRooms,
    activePartyRoom,
    openPartyRoom,
    closePartyRoom,
    createPartyRoom,
    updateActivePartyRoomLevel,
    toggleSeat,
    userSeatIndex,
    isMicMuted,
    setIsMicMuted,
    currentUser,
    sendLiveGift,
    coins,
    setCurrentScreen,
    activeGiftBanner,
    startDirectMessage,
  } = useApp();

  // Party Level: 1 = Basic (4 guest seats), 2 = Advanced (8 guest seats), 3 = Premium (15 guest seats)
  const [partyLevel, setPartyLevel] = useState<1 | 2 | 3>(
    (activePartyRoom?.level as 1 | 2 | 3) || 2
  );

  // Active Chat Filter Tab: ALL | ROOM | HOST | SYSTEM
  const [chatTab, setChatTab] = useState<'ALL' | 'ROOM' | 'HOST' | 'SYSTEM'>('ALL');
  const [inputChat, setInputChat] = useState('');
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isFollowingHost, setIsFollowingHost] = useState(false);
  const [isHostMicMuted, setIsHostMicMuted] = useState(false);
  const [isHostSpeaking, setIsHostSpeaking] = useState(true);

  // Music Player State
  const [isMusicPlaying, setIsMusicPlaying] = useState(true);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [showMusicModal, setShowMusicModal] = useState(false);

  // Modals & Drawers
  const [showGiftDrawer, setShowGiftDrawer] = useState(false);
  const [selectedGift, setSelectedGift] = useState<Gift>(VIRTUAL_GIFTS[0]);
  const [giftRecipientUser, setGiftRecipientUser] = useState<User | null>(null);
  const [showMoreModal, setShowMoreModal] = useState(false);
  const [showSeatActionModal, setShowSeatActionModal] = useState<number | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Moderation & Audience state (Moderator limit: 10)
  const [moderatorIds, setModeratorIds] = useState<string[]>(
    activePartyRoom?.moderatorIds || ['viewer_01']
  );
  const [kickedUserIds, setKickedUserIds] = useState<string[]>(
    activePartyRoom?.kickedUserIds || []
  );
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>(
    activePartyRoom?.blockedUserIds || []
  );
  const [selectedUserForActionSheet, setSelectedUserForActionSheet] = useState<User | null>(null);
  const [selectedUserSeatIndex, setSelectedUserSeatIndex] = useState<number | null>(null);
  const [showUserActionSheet, setShowUserActionSheet] = useState(false);
  const [showViewersModal, setShowViewersModal] = useState(false);
  const [followingUserIds, setFollowingUserIds] = useState<Set<string>>(new Set(['host_01', 'viewer_03']));

  // Floating hearts & live audience
  const [hearts, setHearts] = useState<FloatingHeart[]>([]);
  const [activeViewers, setActiveViewers] = useState(activePartyRoom?.activeViewers || 142);
  const [speakingGuestIndex, setSpeakingGuestIndex] = useState<number>(0);

  // Discovery / Hub state (when not in a room)
  const [activeCategory, setActiveCategory] = useState<'All' | 'Trending' | 'Music' | 'Singing' | 'Dating'>('All');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoomTitle, setNewRoomTitle] = useState('Chill & Acoustic Lounge 💜');
  const [createRoomLevel, setCreateRoomLevel] = useState<1 | 2 | 3>(
    currentUser.level >= 25 ? 3 : currentUser.level >= 10 ? 2 : 1
  );
  const [createCategory, setCreateCategory] = useState<'Music' | 'Chat' | 'Singing' | 'Gaming' | 'Dating'>('Music');

  // Keep partyLevel synchronized with activePartyRoom
  useEffect(() => {
    if (activePartyRoom?.level) {
      setPartyLevel(activePartyRoom.level as 1 | 2 | 3);
    }
  }, [activePartyRoom?.id, activePartyRoom?.level]);

  const commentsEndRef = useRef<HTMLDivElement>(null);
  const lastTapRef = useRef<number>(0);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const isHost = activePartyRoom ? activePartyRoom.host.id === currentUser.id : false;
  const isModerator = moderatorIds.includes(currentUser.id);
  const canModerate = isHost || isModerator;
  const hostLevel = activePartyRoom?.host.level ?? currentUser.level;

  // Check if current user is blocked or kicked
  useEffect(() => {
    if (!activePartyRoom) return;
    if (blockedUserIds.includes(currentUser.id)) {
      showToast('You are blocked from this room by the host! ⛔');
      closePartyRoom();
    } else if (kickedUserIds.includes(currentUser.id)) {
      showToast('You have been kicked from this session! 🚫');
      closePartyRoom();
    }
  }, [activePartyRoom?.id, blockedUserIds, kickedUserIds, currentUser.id]);

  // Moderation Action Handlers
  const handleToggleModerator = (targetUserId: string) => {
    if (!isHost) {
      showToast('Only the room Host can assign moderators! 👑');
      return;
    }
    if (moderatorIds.includes(targetUserId)) {
      setModeratorIds((prev) => prev.filter((id) => id !== targetUserId));
      showToast('Removed as Moderator 🛡️');
    } else {
      if (moderatorIds.length >= 10) {
        showToast('Maximum 10 moderators limit reached! ⚠️');
        return;
      }
      setModeratorIds((prev) => [...prev, targetUserId]);
      showToast('Assigned as Room Moderator! 🛡️ (Permanent until removed)');
    }
  };

  const handleKickUser = (targetUserId: string, targetDisplayName: string) => {
    if (!canModerate) return;
    if (activePartyRoom && (targetUserId === activePartyRoom.host.id || targetDisplayName === activePartyRoom.host.displayName)) {
      showToast('Cannot kick the room Host! 👑');
      return;
    }
    setKickedUserIds((prev) => [...prev, targetUserId]);
    if (activePartyRoom) {
      const seatIdx = activePartyRoom.seats.findIndex((s) => s.user?.id === targetUserId || s.user?.displayName === targetDisplayName);
      if (seatIdx !== -1) {
        const updatedSeats = [...activePartyRoom.seats];
        updatedSeats[seatIdx] = { ...updatedSeats[seatIdx], user: null, isSpeaking: false, isMuted: false, isHostMuted: false };
        activePartyRoom.seats = updatedSeats;
      }
    }
    showToast(`Kicked ${targetDisplayName} from this live session! 🚫`);
    setChatItems((prev) => [
      ...prev,
      {
        id: `sys_kick_${Date.now()}`,
        sender: { displayName: 'System', avatar: '', isHost: false },
        text: `🛡️ ${targetDisplayName} was kicked from the room by ${isHost ? 'Host' : 'Moderator'}.`,
        type: 'system',
      },
    ]);
  };

  const handleBlockUser = (targetUserId: string, targetDisplayName: string) => {
    if (!canModerate) return;
    if (activePartyRoom && (targetUserId === activePartyRoom.host.id || targetDisplayName === activePartyRoom.host.displayName)) {
      showToast('Cannot block the room Host! 👑');
      return;
    }
    setBlockedUserIds((prev) => [...prev, targetUserId]);
    setKickedUserIds((prev) => [...prev, targetUserId]);
    if (activePartyRoom) {
      const seatIdx = activePartyRoom.seats.findIndex((s) => s.user?.id === targetUserId || s.user?.displayName === targetDisplayName);
      if (seatIdx !== -1) {
        const updatedSeats = [...activePartyRoom.seats];
        updatedSeats[seatIdx] = { ...updatedSeats[seatIdx], user: null, isSpeaking: false, isMuted: false, isHostMuted: false };
        activePartyRoom.seats = updatedSeats;
      }
    }
    showToast(`Permanently blocked ${targetDisplayName}! ⛔`);
    setChatItems((prev) => [
      ...prev,
      {
        id: `sys_block_${Date.now()}`,
        sender: { displayName: 'System', avatar: '', isHost: false },
        text: `⛔ ${targetDisplayName} was permanently blocked from future streams.`,
        type: 'system',
      },
    ]);
  };

  const handleToggleSeatMicByHostOrMod = (seatIndex: number) => {
    if (!canModerate || !activePartyRoom) return;
    const seat = activePartyRoom.seats[seatIndex];
    if (!seat || !seat.user) return;
    if (seat.user.id === activePartyRoom.host.id) {
      showToast('Cannot mute the room Host! 👑');
      return;
    }
    const nextMuted = !seat.isMuted;
    const updatedSeats = [...activePartyRoom.seats];
    updatedSeats[seatIndex] = {
      ...seat,
      isMuted: nextMuted,
      isHostMuted: nextMuted,
      isSpeaking: nextMuted ? false : seat.isSpeaking,
    };
    activePartyRoom.seats = updatedSeats;
    showToast(
      nextMuted
        ? `Muted & locked ${seat.user.displayName}'s mic! 🔒🔇`
        : `Unmuted ${seat.user.displayName}'s mic! 🎙️`
    );
  };

  const handleMuteAllGuests = () => {
    if (!canModerate || !activePartyRoom) return;
    const updatedSeats = activePartyRoom.seats.map((s) => {
      if (s.user && s.user.id !== activePartyRoom.host.id) {
        return { ...s, isMuted: true, isHostMuted: true, isSpeaking: false };
      }
      return s;
    });
    activePartyRoom.seats = updatedSeats;
    showToast('All guest microphones muted & locked! 🔇🔒');
    setChatItems((prev) => [
      ...prev,
      {
        id: `sys_muteall_${Date.now()}`,
        sender: { displayName: 'System', avatar: '', isHost: false },
        text: `🔇 All guest microphones were muted by ${isHost ? 'Host' : 'Moderator'}.`,
        type: 'system',
      },
    ]);
  };

  const handleUnmuteAllGuests = () => {
    if (!canModerate || !activePartyRoom) return;
    const updatedSeats = activePartyRoom.seats.map((s) => {
      if (s.user && s.user.id !== activePartyRoom.host.id) {
        return { ...s, isMuted: false, isHostMuted: false };
      }
      return s;
    });
    activePartyRoom.seats = updatedSeats;
    showToast('All guest microphones unmuted! 🎙️');
  };

  const handleClearChat = () => {
    if (!canModerate) {
      showToast('Only Host and Moderators can clear chat history! 🛡️');
      return;
    }
    setChatItems([
      {
        id: `clear_${Date.now()}`,
        sender: { displayName: 'System', avatar: '', isHost: false },
        text: `🧹 Comment history was cleared by ${isHost ? 'Host' : 'Moderator'}.`,
        type: 'system',
        timestamp: 'Just now',
      },
    ]);
    showToast('Comment history cleared! 🧹');
  };

  const handleToggleFollowUser = (targetUser: User) => {
    const isNowFollowing = !followingUserIds.has(targetUser.id);
    setFollowingUserIds((prev) => {
      const next = new Set(prev);
      if (isNowFollowing) {
        next.add(targetUser.id);
      } else {
        next.delete(targetUser.id);
      }
      return next;
    });
    showToast(isNowFollowing ? `Following ${targetUser.displayName}! 💜` : `Unfollowed ${targetUser.displayName}`);
  };

  const handleInviteViewerToSeat = (viewer: User) => {
    if (!activePartyRoom) return;
    const emptySeatIndex = activePartyRoom.seats.findIndex((s) => s.user === null);
    if (emptySeatIndex === -1) {
      showToast('No empty seats available! Upgrade party level to add more seats.');
      return;
    }
    const updatedSeats = [...activePartyRoom.seats];
    updatedSeats[emptySeatIndex] = {
      seatIndex: emptySeatIndex,
      user: viewer,
      isMuted: false,
      isHostMuted: false,
      isSpeaking: false,
    };
    activePartyRoom.seats = updatedSeats;
    setShowViewersModal(false);
    showToast(`Invited ${viewer.displayName} to Seat ${emptySeatIndex + 1}! 🎙️`);
    setChatItems((prev) => [
      ...prev,
      {
        id: `sys_invite_${Date.now()}`,
        sender: { displayName: 'System', avatar: '', isHost: false },
        text: `🎙️ ${viewer.displayName} joined Seat ${emptySeatIndex + 1}!`,
        type: 'system',
      },
    ]);
  };

  const handleCommentUserClick = (sender: ChatItem['sender']) => {
    const isTargetHost = sender.isHost || (activePartyRoom && sender.displayName === activePartyRoom.host.displayName);
    const targetUser: User = isTargetHost && activePartyRoom
      ? activePartyRoom.host
      : {
          id: `user_${sender.displayName.replace(/[^a-zA-Z0-9]/g, '_')}`,
          uniqueId: `AM_${Math.floor(100000 + Math.random() * 900000)}`,
          username: sender.displayName.replace(/[^a-zA-Z0-9]/g, ''),
          displayName: sender.displayName,
          avatar: sender.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80',
          bio: 'Alpha Mate live party member 💜',
          followersCount: 4200,
          followingCount: 190,
          likesCount: 32000,
          level: sender.level || 20,
          xp: 8000,
          nextLevelXp: 12000,
          vipTier: sender.vipTier || 0,
          coins: 1200,
          diamonds: 450,
          isVerified: isTargetHost || false,
          isHost: isTargetHost || false,
        };

    const seatIdx = activePartyRoom?.seats.findIndex((s) => s.user?.displayName === sender.displayName) ?? -1;
    setSelectedUserForActionSheet(targetUser);
    setSelectedUserSeatIndex(seatIdx !== -1 ? seatIdx : null);
    setShowUserActionSheet(true);
  };

  // Convert or Upgrade Party Room Seat Capacity (Level 1: 4 seats, Level 2: 8 seats, Level 3: 15 seats)
  const handleConvertRoomLevel = (targetLvl: 1 | 2 | 3) => {
    if (!isHost) {
      showToast('Only the room Host can change seat capacity! 👑');
      return;
    }

    const tierConfig = PARTY_TIER_SETTINGS.find((t) => t.level === targetLvl);
    if (!tierConfig) return;

    if (currentUser.level < tierConfig.requiredLevel) {
      showToast(`🔒 Level ${tierConfig.requiredLevel} required for ${tierConfig.name}! (Your Level: Lv.${currentUser.level})`);
      return;
    }

    if (partyLevel === targetLvl) {
      showToast(`Room is already set to ${tierConfig.name}!`);
      return;
    }

    setPartyLevel(targetLvl);
    updateActivePartyRoomLevel(targetLvl);

    // Announce upgrade to live room chat
    const upgradeMsg: ChatItem = {
      id: `sys_upgrade_${Date.now()}`,
      sender: {
        displayName: 'Alpha System',
        avatar: '/alpha-mate-logo-emblem.png',
        vipTier: 8,
      },
      text: `🚀 Host ${currentUser.displayName} converted Party Room to ${tierConfig.name} (${tierConfig.urduName})!`,
      type: 'system',
      timestamp: 'Just now',
    };
    setChatItems((prev) => [...prev, upgradeMsg]);
    showToast(`🎉 Room converted to ${tierConfig.name}! 🚀`);
  };

  // Chat Feed with system, host, room and gift messages
  const [chatItems, setChatItems] = useState<ChatItem[]>([
    {
      id: 'sys_0',
      sender: {
        displayName: 'Alpha System',
        avatar: '/alpha-mate-logo-emblem.png',
        vipTier: 8,
      },
      text: '🎉 Welcome to the Alpha Mate VIP Party Room! Be respectful, send gifts, and tap any empty seat to talk.',
      type: 'system',
      timestamp: 'Just now',
    },
    {
      id: 'host_0',
      sender: {
        displayName: activePartyRoom?.host.displayName || 'Saif Ali ★',
        avatar: activePartyRoom?.host.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
        vipTier: 6,
        isHost: true,
      },
      text: 'Hey everyone! Welcome to tonight’s royal session! Turn up your volume 🎶💜',
      type: 'host',
      timestamp: '1m ago',
    },
    {
      id: 'msg_1',
      sender: {
        displayName: 'Luna Star 🌙',
        avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80',
        vipTier: 5,
        level: 45,
      },
      text: 'The audio stage sounds incredible tonight! Requesting track 2 next! ✨',
      type: 'room',
      timestamp: '1m ago',
    },
    {
      id: 'gift_1',
      sender: {
        displayName: 'DJ Kairo 🔥',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
        vipTier: 4,
      },
      text: 'sent Royal Crown to Host',
      type: 'gift',
      giftName: 'Royal Crown',
      giftIcon: '👑',
      giftCoins: 500,
      timestamp: '30s ago',
    },
    {
      id: 'msg_2',
      sender: {
        displayName: 'QueenBee',
        avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
        vipTier: 6,
      },
      text: 'Double tap the screen to send neon hearts to the host! ❤️🔥',
      type: 'room',
      timestamp: '10s ago',
    },
  ]);

  // Comprehensive 15-Seat Roster with realistic Alpha Mate community members
  const defaultGuestSeats: PartySeat[] = useMemo(() => {
    return [
      {
        seatIndex: 0,
        user: MOCK_HOSTS[0], // Luna Star
        isMuted: false,
        isSpeaking: true,
        isCoHost: true,
        receivedCoins: 1450,
      },
      {
        seatIndex: 1,
        user: MOCK_HOSTS[1], // DJ Kairo
        isMuted: false,
        isSpeaking: false,
        receivedCoins: 920,
      },
      {
        seatIndex: 2,
        user: MOCK_HOSTS[2], // Electro
        isMuted: false,
        isSpeaking: false,
        receivedCoins: 650,
      },
      {
        seatIndex: 3,
        user: null, // Empty for User
        isMuted: false,
        isSpeaking: false,
        receivedCoins: 0,
      },
      {
        seatIndex: 4,
        user: MOCK_HOSTS[3], // CyberWolf
        isMuted: true,
        isSpeaking: false,
        receivedCoins: 420,
      },
      {
        seatIndex: 5,
        user: {
          id: 'guest_queen',
          uniqueId: 'AM_488102',
          username: 'QueenBee',
          displayName: 'QueenBee 👑',
          avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
          bio: 'Alpha Mate VIP Member',
          followersCount: 12000,
          followingCount: 300,
          likesCount: 95000,
          level: 32,
          xp: 12000,
          nextLevelXp: 15000,
          vipTier: 6,
          coins: 5400,
          diamonds: 2100,
          isVerified: true,
        },
        isMuted: false,
        isSpeaking: false,
        receivedCoins: 2100,
      },
      {
        seatIndex: 6,
        user: {
          id: 'guest_mateclub',
          uniqueId: 'AM_992102',
          username: 'MateClub',
          displayName: 'MateClub ★',
          avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80',
          bio: 'Music & Vibes',
          followersCount: 8400,
          followingCount: 210,
          likesCount: 42000,
          level: 19,
          xp: 8000,
          nextLevelXp: 10000,
          vipTier: 2,
          coins: 2100,
          diamonds: 890,
          isVerified: false,
        },
        isMuted: false,
        isSpeaking: false,
        receivedCoins: 380,
      },
      {
        seatIndex: 7,
        user: null, // Empty
        isMuted: false,
        isSpeaking: false,
        receivedCoins: 0,
      },
      {
        seatIndex: 8,
        user: {
          id: 'guest_royalstar',
          uniqueId: 'AM_662891',
          username: 'RoyalStar',
          displayName: 'RoyalStar 🌟',
          avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80',
          bio: 'Night Singer',
          followersCount: 22000,
          followingCount: 410,
          likesCount: 140000,
          level: 28,
          xp: 14000,
          nextLevelXp: 20000,
          vipTier: 4,
          coins: 7800,
          diamonds: 3200,
          isVerified: true,
        },
        isMuted: false,
        isSpeaking: false,
        receivedCoins: 880,
      },
      {
        seatIndex: 9,
        user: MOCK_HOSTS[4], // Zainab Live
        isMuted: true,
        isSpeaking: false,
        receivedCoins: 510,
      },
      {
        seatIndex: 10,
        user: {
          id: 'guest_neonrider',
          uniqueId: 'AM_118940',
          username: 'NeonRider',
          displayName: 'NeonRider ⚡',
          avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
          bio: 'EDM Party Enthusiast',
          followersCount: 6800,
          followingCount: 180,
          likesCount: 31000,
          level: 21,
          xp: 9500,
          nextLevelXp: 12000,
          vipTier: 3,
          coins: 1900,
          diamonds: 650,
          isVerified: false,
        },
        isMuted: false,
        isSpeaking: false,
        receivedCoins: 340,
      },
      {
        seatIndex: 11,
        user: {
          id: 'guest_stargazer',
          uniqueId: 'AM_771920',
          username: 'StarGazer',
          displayName: 'StarGazer 💫',
          avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=400&q=80',
          bio: 'Acoustic vibes',
          followersCount: 9200,
          followingCount: 240,
          likesCount: 58000,
          level: 24,
          xp: 11000,
          nextLevelXp: 14000,
          vipTier: 2,
          coins: 3100,
          diamonds: 1200,
          isVerified: true,
        },
        isMuted: false,
        isSpeaking: false,
        receivedCoins: 260,
      },
      {
        seatIndex: 12,
        user: null, // Empty
        isMuted: false,
        isSpeaking: false,
        receivedCoins: 0,
      },
      {
        seatIndex: 13,
        user: {
          id: 'guest_alphaking',
          uniqueId: 'AM_999001',
          username: 'AlphaKing_99',
          displayName: 'AlphaKing 👑',
          avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=400&q=80',
          bio: 'Top VIP Contributor',
          followersCount: 45000,
          followingCount: 520,
          likesCount: 380000,
          level: 48,
          xp: 42000,
          nextLevelXp: 50000,
          vipTier: 7,
          coins: 18000,
          diamonds: 8900,
          isVerified: true,
        },
        isMuted: false,
        isSpeaking: false,
        receivedCoins: 1800,
      },
      {
        seatIndex: 14,
        user: null, // Empty
        isMuted: false,
        isSpeaking: false,
        receivedCoins: 0,
      },
    ];
  }, []);

  // Compute Active Seats array based on current Party Level
  const activeGuestSeats = useMemo(() => {
    const targetSeatCount = partyLevel === 1 ? 4 : partyLevel === 2 ? 8 : 15;
    const seats: PartySeat[] = [];

    for (let i = 0; i < targetSeatCount; i++) {
      if (userSeatIndex === i) {
        // Current user is in this seat
        seats.push({
          seatIndex: i,
          user: currentUser,
          isMuted: isMicMuted,
          isSpeaking: !isMicMuted,
          receivedCoins: 350,
        });
      } else {
        const fallbackSeat = defaultGuestSeats[i];
        seats.push(
          fallbackSeat || {
            seatIndex: i,
            user: null,
            isMuted: false,
            isSpeaking: false,
            receivedCoins: 0,
          }
        );
      }
    }

    return seats;
  }, [partyLevel, userSeatIndex, isMicMuted, currentUser, defaultGuestSeats]);

  // Guest seats occupancy and dynamic upgrade eligibility
  const occupiedGuestSeatsCount = useMemo(() => {
    return activeGuestSeats.filter((s) => s.user !== null).length;
  }, [activeGuestSeats]);

  const maxGuestSeats = partyLevel === 1 ? 4 : partyLevel === 2 ? 8 : 15;
  const isRoomFull = occupiedGuestSeatsCount >= maxGuestSeats;
  const nextTargetTier = partyLevel === 1 ? PARTY_TIER_SETTINGS[1] : partyLevel === 2 ? PARTY_TIER_SETTINGS[2] : null;
  const canHostUpgrade = Boolean(isHost && nextTargetTier && currentUser.level >= nextTargetTier.requiredLevel);

  // Audio Pipeline & Speaking Volume Detection
  useEffect(() => {
    let animFrame: any;

    if (activePartyRoom && userSeatIndex !== null && !isMicMuted) {
      p2pStreamingEngine.getLocalMediaStream('user', true).catch(() => {});
      p2pStreamingEngine.createPeerConnection(activePartyRoom.id).catch(() => {});

      const checkVolume = () => {
        const vol = p2pStreamingEngine.getSpeakingVolume();
        setIsHostSpeaking(vol > 15);
        animFrame = requestAnimationFrame(checkVolume);
      };
      animFrame = requestAnimationFrame(checkVolume);
    } else {
      p2pStreamingEngine.toggleMicrophone(false);
    }

    return () => {
      if (animFrame) cancelAnimationFrame(animFrame);
    };
  }, [activePartyRoom, userSeatIndex, isMicMuted]);

  // Periodic random speaking simulation across guest seats
  useEffect(() => {
    const interval = setInterval(() => {
      const targetCount = partyLevel === 1 ? 4 : partyLevel === 2 ? 8 : 15;
      const randomIdx = Math.floor(Math.random() * targetCount);
      setSpeakingGuestIndex(randomIdx);
      setIsHostSpeaking(Math.random() > 0.4);
    }, 2800);

    const viewerInterval = setInterval(() => {
      setActiveViewers((v) => Math.max(20, v + Math.floor(Math.random() * 7) - 3));
    }, 4500);

    return () => {
      clearInterval(interval);
      clearInterval(viewerInterval);
    };
  }, [partyLevel]);

  // Auto-scroll chat feed
  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatItems, chatTab]);

  // Spawn floating heart
  const spawnHeart = (clientX?: number, clientY?: number) => {
    const colors = ['#EC4899', '#A855F7', '#F43F5E', '#C084FC', '#F59E0B', '#38BDF8'];
    const newHeart: FloatingHeart = {
      id: Date.now() + Math.random(),
      x: clientX ? clientX - 20 + (Math.random() * 30 - 15) : Math.floor(Math.random() * 60) - 30,
      y: clientY ? clientY - 40 : 0,
      color: colors[Math.floor(Math.random() * colors.length)],
    };
    setHearts((prev) => [...prev, newHeart]);

    setTimeout(() => {
      setHearts((prev) => prev.filter((h) => h.id !== newHeart.id));
    }, 1800);
  };

  // Screen Double Tap handler
  const handleScreenTouchOrClick = (e: React.MouseEvent | React.TouchEvent) => {
    const now = Date.now();
    const timeDiff = now - lastTapRef.current;
    if (timeDiff < 320) {
      const clientX = 'touches' in e && e.touches[0] ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
      const clientY = 'touches' in e && e.touches[0] ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
      spawnHeart(clientX, clientY);
      spawnHeart(clientX ? clientX + 15 : undefined, clientY ? clientY - 15 : undefined);
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
  };

  // Send Chat Comment
  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputChat.trim()) return;

    const isHost = activePartyRoom?.host.id === currentUser.id;

    const newMsg: ChatItem = {
      id: `chat_${Date.now()}`,
      sender: {
        displayName: currentUser.displayName,
        avatar: currentUser.avatar,
        vipTier: currentUser.vipTier,
        level: currentUser.level,
        isHost,
      },
      text: inputChat.trim(),
      type: isHost ? 'host' : 'room',
      timestamp: 'Just now',
    };

    setChatItems((prev) => [...prev, newMsg]);
    setInputChat('');
  };

  // Send Virtual Gift
  const handleSendSelectedGift = () => {
    sendLiveGift(selectedGift);
    spawnHeart();

    const recipient = giftRecipientUser ? giftRecipientUser.displayName : (activePartyRoom?.host.displayName || 'Host');

    const giftMsg: ChatItem = {
      id: `gift_${Date.now()}`,
      sender: {
        displayName: currentUser.displayName,
        avatar: currentUser.avatar,
        vipTier: currentUser.vipTier,
      },
      text: `sent ${selectedGift.name} to ${recipient}`,
      type: 'gift',
      giftName: selectedGift.name,
      giftIcon: selectedGift.icon,
      giftCoins: selectedGift.coins,
      timestamp: 'Just now',
    };

    setChatItems((prev) => [...prev, giftMsg]);
    setShowGiftDrawer(false);
    setGiftRecipientUser(null);
    showToast(`Sent ${selectedGift.name} to ${recipient}! 🎁`);
  };

  // Seat Click handler (take empty seat / interact with occupied seat)
  const handleSeatClick = (seat: PartySeat) => {
    if (seat.user === null) {
      if (kickedUserIds.includes(currentUser.id)) {
        showToast('You cannot take a seat because you were kicked from this session! 🚫');
        return;
      }
      toggleSeat(seat.seatIndex);
      showToast(`Joined Seat ${seat.seatIndex + 1}! 🎙️`);
    } else {
      setSelectedUserForActionSheet(seat.user);
      setSelectedUserSeatIndex(seat.seatIndex);
      setShowUserActionSheet(true);
    }
  };

  const handleCopyHostId = async (id: string) => {
    const copied = await copyToClipboard(id);
    if (copied) {
      showToast(`Host ID ${id} copied! 📋`);
    }
  };

  // Filter chat feed by tab
  const filteredChatItems = useMemo(() => {
    if (chatTab === 'ALL') return chatItems;
    if (chatTab === 'ROOM') return chatItems.filter((c) => c.type === 'room');
    if (chatTab === 'HOST') return chatItems.filter((c) => c.type === 'host');
    if (chatTab === 'SYSTEM') return chatItems.filter((c) => c.type === 'system' || c.type === 'gift');
    return chatItems;
  }, [chatItems, chatTab]);

  // =========================================================================
  // IF INSIDE AN ACTIVE PARTY ROOM -> RENDER MASTER PARTY ROOM UI
  // =========================================================================
  if (activePartyRoom) {
    const currentTrack = PLAYLIST_TRACKS[currentTrackIndex];
    const isHost = activePartyRoom.host.id === currentUser.id;

    return (
      <div
        onDoubleClick={(e) => {
          spawnHeart(e.clientX, e.clientY);
          spawnHeart(e.clientX + 10, e.clientY - 20);
        }}
        onTouchStart={handleScreenTouchOrClick}
        className="relative w-full h-full min-h-screen bg-[#080313] text-white flex flex-col justify-between overflow-hidden select-none"
      >
        {/* =====================================================================
            1. COMPLETE NIGHTCLUB PARTY ROOM BACKGROUND (Full screen top-to-bottom)
           ===================================================================== */}
        <PartyRoomAtmosphere isMusicPlaying={isMusicPlaying} />

        {/* Toast Alert Feedback */}
        {toastMessage && (
          <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-[#180E2C]/95 border border-[#A855F7]/40 text-white text-xs font-bold shadow-2xl backdrop-blur-md flex items-center gap-2 animate-bounce pointer-events-none">
            <Sparkles className="w-3.5 h-3.5 text-[#EC4899]" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Floating Animated Hearts Area */}
        <div className="absolute right-6 bottom-32 z-20 pointer-events-none w-20 h-56 flex flex-col items-center justify-end">
          {hearts.map((heart) => (
            <div
              key={heart.id}
              className="absolute animate-float-heart"
              style={{
                transform: `translateX(${heart.x}px)`,
                color: heart.color,
              }}
            >
              <Heart className="w-7 h-7 fill-current drop-shadow-[0_0_8px_currentColor]" />
            </div>
          ))}
        </div>

        {/* Spectacular Screen Takeover Gift Banner */}
        {activeGiftBanner && (
          <div className="absolute top-16 left-4 right-4 z-40 pointer-events-none animate-bounce">
            <div className="relative rounded-2xl bg-gradient-to-r from-[#7928CA] via-[#EC4899] to-[#F59E0B] p-[2px] shadow-[0_0_35px_rgba(236,72,153,0.7)]">
              <div className="rounded-[14px] bg-[#140A28]/95 backdrop-blur-xl px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-3xl animate-spin-slow">{activeGiftBanner.gift.icon}</span>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black text-amber-300">{activeGiftBanner.sender}</span>
                      <span className="text-[11px] text-zinc-300">sent</span>
                    </div>
                    <div className="text-sm font-extrabold text-white tracking-wide">
                      {activeGiftBanner.gift.name}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-black text-[#F43F5E] px-2 py-1 rounded-full bg-[#EC4899]/20 border border-[#EC4899]/40">
                    +{activeGiftBanner.gift.coins} Coins
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            2. ROOM HEADER & LEVEL SWITCHER (Top Bar)
           ===================================================================== */}
        <div className="relative z-20 pt-2 px-3 pb-2 flex items-center justify-between border-b border-[#A855F7]/15 bg-black/45 backdrop-blur-md">
          {/* Left: Back/Leave Button & Room Info */}
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={closePartyRoom}
              className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-zinc-300 hover:text-white cursor-pointer"
              title="Leave Room"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-[#EC4899] animate-pulse shrink-0" />
                <h2 className="text-xs sm:text-sm font-extrabold text-white truncate max-w-[120px] sm:max-w-[170px]">
                  {activePartyRoom.title || `${activePartyRoom.host.displayName}'s Party Room`}
                </h2>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                <button
                  onClick={() => setShowViewersModal(true)}
                  className="flex items-center gap-1 text-[#C084FC] hover:text-white font-semibold cursor-pointer px-1.5 py-0.5 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
                  title="View All Audience & Live Viewers"
                >
                  <Eye className="w-3 h-3 text-cyan-400" />
                  <span>{activeViewers.toLocaleString()}</span>
                </button>
                <span>•</span>
                <span className="px-1 py-0.2 rounded bg-[#7928CA]/30 text-[#C084FC] text-[8.5px] font-bold">
                  {activePartyRoom.category}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Party Level Switcher (Lv 1 / Lv 2 / Lv 3) + Speaker + Share */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {/* Dynamic Level Switcher Capsule (1 Host + 4, 1 Host + 8, 1 Host + 15) */}
            <div
              className="flex items-center p-0.5 rounded-full bg-[#180C2E]/90 border border-[#A855F7]/40 shadow-inner"
              title="Party Room Seat Capacity: 4, 8, or 15 Seats"
            >
              {PARTY_TIER_SETTINGS.map((tier) => {
                const isActive = partyLevel === tier.level;
                const isUnlocked = isHost
                  ? currentUser.level >= tier.requiredLevel
                  : (activePartyRoom?.host.level ?? 45) >= tier.requiredLevel;

                return (
                  <button
                    key={tier.level}
                    onClick={() => handleConvertRoomLevel(tier.level)}
                    className={`px-2 py-0.5 rounded-full text-[9px] font-black transition-all cursor-pointer flex items-center gap-0.5 ${
                      isActive
                        ? 'bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white shadow-sm'
                        : isUnlocked
                        ? 'text-zinc-400 hover:text-white'
                        : 'text-zinc-600 hover:text-zinc-400'
                    }`}
                    title={`${tier.name} (${tier.urduName}) - ${isUnlocked ? 'Unlocked' : `Requires Lv.${tier.requiredLevel}`}`}
                  >
                    {!isUnlocked && <Lock className="w-2 h-2 text-zinc-500" />}
                    <span>Lv.{tier.level}</span>
                  </button>
                );
              })}
            </div>

            {/* Speaker Mute/Unmute */}
            <button
              onClick={() => {
                setIsSpeakerOn(!isSpeakerOn);
                showToast(isSpeakerOn ? 'Room Audio Muted 🔇' : 'Room Audio Playing 🔊');
              }}
              className="w-8 h-8 rounded-full bg-[#180C2E] border border-white/10 flex items-center justify-center text-zinc-300 hover:text-white cursor-pointer"
              title="Speaker Audio"
            >
              {isSpeakerOn ? <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> : <VolumeX className="w-3.5 h-3.5 text-rose-400" />}
            </button>

            {/* Share Broadcast Button */}
            <button
              onClick={() => setShowShareModal(true)}
              className="w-8 h-8 rounded-full bg-[#180C2E] border border-white/10 flex items-center justify-center text-zinc-300 hover:text-white cursor-pointer"
              title="Share Room"
            >
              <Share2 className="w-3.5 h-3.5 text-amber-300" />
            </button>
          </div>
        </div>

        {/* Ambient Now Playing Track Ribbon (with Live Equalizer) */}
        {isMusicPlaying && (
          <div className="relative z-10 px-3 py-1 bg-gradient-to-r from-[#7928CA]/30 via-[#EC4899]/25 to-[#7928CA]/30 border-b border-[#A855F7]/25 flex items-center justify-between text-xs text-purple-200 backdrop-blur-sm">
            <div
              onClick={() => setShowMusicModal(true)}
              className="flex items-center gap-2 truncate cursor-pointer group hover:text-white"
            >
              <Music className="w-3.5 h-3.5 text-[#EC4899] animate-spin-slow shrink-0" />
              <span className="text-[10px] font-bold truncate">
                Now Playing: <span className="text-white">{currentTrack.title}</span> — {currentTrack.artist}
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="flex items-end gap-0.5 h-3">
                <span className="w-0.5 h-3 bg-[#EC4899] animate-pulse" />
                <span className="w-0.5 h-2 bg-[#A855F7] animate-pulse" style={{ animationDelay: '0.2s' }} />
                <span className="w-0.5 h-3.5 bg-[#38BDF8] animate-pulse" style={{ animationDelay: '0.4s' }} />
              </span>
              <button
                onClick={() => setShowMusicModal(true)}
                className="text-[9px] font-black text-[#C084FC] hover:text-white underline cursor-pointer ml-1"
              >
                Change
              </button>
            </div>
          </div>
        )}

        {/* =====================================================================
            3. HOST AREA – PROMINENT TOP SECTION
           ===================================================================== */}
        <div className="relative z-10 flex flex-col items-center pt-1.5 pb-1 px-4">
          {/* Royal Crown Emblem atop Host Avatar */}
          <div className="relative -mb-2 z-10">
            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-400 via-amber-300 to-yellow-500 flex items-center justify-center shadow-[0_0_15px_rgba(251,191,36,0.8)] border border-amber-200">
              <Crown className="w-4 h-4 text-black fill-black" />
            </div>
          </div>

          {/* Host Profile Picture with Multi-Layered Glowing Circular Frame */}
          <div
            className="relative cursor-pointer group"
            onClick={() => {
              if (isHost) {
                const nextState = !isHostMicMuted;
                setIsHostMicMuted(nextState);
                showToast(nextState ? 'Host Mic Muted 🔇' : 'Host Mic Live 🎙️');
              } else {
                setSelectedUserForActionSheet(activePartyRoom.host);
                setSelectedUserSeatIndex(null);
                setShowUserActionSheet(true);
              }
            }}
          >
            {/* Host Speaking Soundwave Waves */}
            {(isHostSpeaking || isMusicPlaying) && (
              <>
                <div className="absolute -inset-2 rounded-full border border-[#EC4899]/70 animate-ping opacity-75" />
                <div className="absolute -inset-3.5 rounded-full border border-[#A855F7]/40 animate-pulse" />
              </>
            )}

            {/* Glowing Host Profile Frame */}
            <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-full p-[2.5px] bg-gradient-to-tr from-amber-400 via-[#EC4899] to-[#7928CA] shadow-[0_0_25px_rgba(236,72,153,0.6)] flex items-center justify-center">
              <img
                src={activePartyRoom.host.avatar}
                alt={activePartyRoom.host.displayName}
                className="w-full h-full rounded-full object-cover border-2 border-white/20"
              />
            </div>

            {/* Host Microphone Status Badge */}
            <div
              className={`absolute bottom-0 right-0 w-5 h-5 rounded-full flex items-center justify-center border border-white/30 shadow-md ${
                isHostMicMuted ? 'bg-rose-600 text-white' : 'bg-emerald-500 text-black'
              }`}
            >
              {isHostMicMuted ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
            </div>
          </div>

          {/* Host Display Name & Host ID */}
          <div className="mt-1 flex items-center gap-1.5">
            <span className="text-xs sm:text-sm font-black text-white tracking-wide">
              {activePartyRoom.host.displayName}
            </span>
            <span className="w-3.5 h-3.5 rounded-full bg-[#EC4899] text-white text-[8px] font-black flex items-center justify-center shadow-sm">
              ✓
            </span>
            <button
              onClick={() => handleCopyHostId(activePartyRoom.host.uniqueId || 'AM_772091')}
              className="text-[9px] font-mono text-zinc-400 hover:text-white px-1.5 py-0.2 rounded bg-black/40 border border-white/10 cursor-pointer"
              title="Click to copy Host ID"
            >
              ID: {activePartyRoom.host.uniqueId || 'AM_772091'}
            </button>
          </div>

          {/* Host Badges: Level Badge + VIP Badge + Received Gift Coins + Follow Button */}
          <div className="mt-1 flex items-center gap-1.5 flex-wrap justify-center">
            <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[8.5px] font-black border border-amber-500/40 shadow-sm">
              Lv.{activePartyRoom.host.level || 45}
            </span>
            <span className="px-1.5 py-0.2 rounded bg-[#7928CA]/30 text-[#C084FC] text-[8.5px] font-black border border-[#A855F7]/30">
              VIP {activePartyRoom.host.vipTier || 6}
            </span>
            <span className="px-2 py-0.2 rounded-full bg-gradient-to-r from-amber-500/20 to-yellow-500/10 text-amber-300 text-[8.5px] font-bold border border-amber-400/30 flex items-center gap-1">
              💰 {(activePartyRoom.totalGiftCoins || 48500).toLocaleString()} Coins
            </span>
            <button
              onClick={() => {
                setIsFollowingHost(!isFollowingHost);
                showToast(isFollowingHost ? 'Unfollowed Host' : 'Following Host! 💜');
              }}
              className={`px-2.5 py-0.5 rounded-full text-[9px] font-black transition-all cursor-pointer ${
                isFollowingHost
                  ? 'bg-zinc-800 text-zinc-300 border border-white/10'
                  : 'bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white shadow-md shadow-[#7928CA]/30'
              }`}
            >
              {isFollowingHost ? 'Following' : '+ Follow'}
            </button>
          </div>
        </div>

        {/* =====================================================================
            4. DYNAMIC GUEST SEATS SYSTEM (Levels 1, 2, and 3)
           ===================================================================== */}
        {/* Host / Moderator Quick Controls Ribbon (Mute All Guests) */}
        {canModerate && (
          <div className="relative z-10 px-3 py-1 flex items-center justify-between max-w-sm mx-auto w-full bg-black/45 rounded-full border border-purple-500/20 text-[10px] my-0.5">
            <div className="flex items-center gap-1.5 text-amber-300 font-bold">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
              <span>{isHost ? '👑 Host' : '🛡️ MOD'}: Manage Room</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleMuteAllGuests}
                className="px-2.5 py-0.5 rounded-full bg-rose-600/30 hover:bg-rose-600 border border-rose-500/40 text-rose-200 hover:text-white text-[9px] font-bold cursor-pointer transition-colors"
                title="Mute all guest microphones"
              >
                Mute All (سب میوٹ)
              </button>
              <button
                onClick={handleUnmuteAllGuests}
                className="px-2.5 py-0.5 rounded-full bg-emerald-600/30 hover:bg-emerald-600 border border-emerald-500/40 text-emerald-200 hover:text-white text-[9px] font-bold cursor-pointer transition-colors"
                title="Unmute all guest microphones"
              >
                Unmute All
              </button>
            </div>
          </div>
        )}

        <div className="relative z-10 px-3 py-1 flex-1 flex flex-col justify-center">
          {partyLevel === 1 && (
            /* PARTY LEVEL 1: 1 Host + 4 Guest Seats (1 Row of 4) */
            <div className="grid grid-cols-4 gap-2.5 max-w-xs mx-auto w-full">
              {activeGuestSeats.map((seat) => renderGuestSeat(seat, 'lg'))}
            </div>
          )}

          {partyLevel === 2 && (
            /* PARTY LEVEL 2: 1 Host + 8 Guest Seats (2 Rows of 4) */
            <div className="grid grid-cols-4 gap-x-2.5 gap-y-2 max-w-xs mx-auto w-full">
              {activeGuestSeats.map((seat) => renderGuestSeat(seat, 'md'))}
            </div>
          )}

          {partyLevel === 3 && (
            /* PARTY LEVEL 3: 1 Host + 15 Guest Seats (3 Rows of 5) */
            <div className="grid grid-cols-5 gap-x-1.5 gap-y-1.5 max-w-sm mx-auto w-full">
              {activeGuestSeats.map((seat) => renderGuestSeat(seat, 'sm'))}
            </div>
          )}

          {/* Dynamic Seat Expansion / Upgrade Prompt when seats fill up */}
          {isRoomFull && nextTargetTier && isHost && (
            <div className="mt-2 p-2.5 rounded-2xl bg-gradient-to-r from-[#7928CA]/90 via-[#EC4899]/90 to-[#7928CA]/90 border border-white/30 shadow-xl backdrop-blur-md flex items-center justify-between gap-2 animate-bounce">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base">🔥</span>
                <div className="min-w-0">
                  <p className="text-xs font-black text-white truncate">
                    All {maxGuestSeats} Seats Occupied!
                  </p>
                  <p className="text-[10px] text-pink-100 truncate">
                    {canHostUpgrade
                      ? `Expand to ${nextTargetTier.name} now!`
                      : `Reach Lv.${nextTargetTier.requiredLevel} to unlock ${nextTargetTier.guestCount} seats.`}
                  </p>
                </div>
              </div>

              {canHostUpgrade ? (
                <button
                  onClick={() => handleConvertRoomLevel(nextTargetTier.level)}
                  className="px-3 py-1.5 rounded-xl bg-white text-black text-[11px] font-black hover:bg-zinc-200 active:scale-95 transition-all shadow-md shrink-0 cursor-pointer flex items-center gap-1"
                >
                  <Zap className="w-3 h-3 text-amber-500 fill-amber-500" />
                  <span>Expand Now</span>
                </button>
              ) : (
                <span className="px-2 py-1 rounded-xl bg-black/50 text-amber-300 text-[10px] font-bold border border-amber-400/40 shrink-0 flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" />
                  <span>Req Lv.{nextTargetTier.requiredLevel}</span>
                </span>
              )}
            </div>
          )}

          {/* Seat Status Hint Pill */}
          <div className="flex items-center justify-center gap-2 mt-1.5 flex-wrap">
            <span className="text-[10px] text-zinc-300 font-medium px-3 py-0.5 rounded-full bg-black/40 backdrop-blur-md border border-white/5">
              {userSeatIndex !== null
                ? `You are seated on Seat ${userSeatIndex + 1}. Tap your seat to manage mic.`
                : 'Tap any empty seat (+) to take the mic and talk!'}
            </span>

            {/* Capacity Indicator Pill */}
            <span className="text-[9.5px] font-bold text-[#C084FC] px-2.5 py-0.5 rounded-full bg-[#7928CA]/20 border border-[#A855F7]/30">
              {occupiedGuestSeatsCount}/{maxGuestSeats} Seats Filled
            </span>
          </div>
        </div>

        {/* =====================================================================
            5. LOWER SECTION – CHAT AND COMMENTS (Lower ~40% Glass Panel)
           ===================================================================== */}
        <div className="relative z-20 flex flex-col h-[40vh] max-h-[300px] bg-[#0A0416]/80 backdrop-blur-xl border-t border-[#A855F7]/25 shadow-2xl">
          {/* Chat Tabs Bar: ALL | ROOM | HOST | SYSTEM */}
          <div className="px-3 pt-2 pb-1.5 flex items-center justify-between border-b border-white/5">
            <div className="flex items-center gap-1.5">
              {(['ALL', 'ROOM', 'HOST', 'SYSTEM'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setChatTab(tab)}
                  className={`px-2.5 py-0.5 rounded-full text-[9px] font-black transition-all cursor-pointer ${
                    chatTab === tab
                      ? 'bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white shadow-sm'
                      : 'text-zinc-400 hover:text-white bg-white/5'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              {canModerate && (
                <button
                  onClick={handleClearChat}
                  className="flex items-center gap-1 text-[8.5px] font-bold text-rose-300 hover:text-white px-2 py-0.5 rounded-full bg-rose-950/40 border border-rose-500/30 cursor-pointer transition-colors"
                  title="Clear Comment History"
                >
                  <Trash2 className="w-2.5 h-2.5 text-rose-400" />
                  <span>Clear Chat (کمنٹ صاف)</span>
                </button>
              )}
              <span className="text-[9px] text-[#C084FC] font-semibold">
                Party Lv.{partyLevel} Room
              </span>
            </div>
          </div>

          {/* Chat Messages Feed */}
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 scrollbar-none">
            {filteredChatItems.map((item) => (
              <div
                key={item.id}
                onClick={() => handleCommentUserClick(item.sender)}
                className="flex items-start gap-1.5 text-xs text-zinc-200 leading-snug animate-fadeIn cursor-pointer hover:bg-white/5 p-1 rounded-xl transition-colors group"
                title="Tap to view profile & actions"
              >
                {/* User Avatar */}
                <img
                  src={item.sender.avatar}
                  alt={item.sender.displayName}
                  className="w-5 h-5 rounded-full object-cover shrink-0 mt-0.5 border border-white/10 group-hover:border-[#EC4899] transition-colors"
                />

                <div className="min-w-0 flex-1">
                  <div className="inline-flex items-center gap-1 flex-wrap">
                    {/* Host badge */}
                    {item.sender.isHost && (
                      <span className="px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[8px] font-black border border-amber-500/30">
                        HOST
                      </span>
                    )}

                    {/* VIP badge */}
                    {item.sender.vipTier && item.sender.vipTier > 0 && (
                      <span className="px-1 py-0.2 rounded bg-[#7928CA]/30 text-[#C084FC] text-[8px] font-black border border-[#A855F7]/30">
                        VIP {item.sender.vipTier}
                      </span>
                    )}

                    {/* User display name */}
                    <span className="font-bold text-[#C084FC] text-[11px] shrink-0">
                      {item.sender.displayName}:
                    </span>

                    {/* Gift Notification Message */}
                    {item.type === 'gift' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-gradient-to-r from-[#7928CA]/30 to-[#EC4899]/30 border border-[#EC4899]/40 text-amber-300 font-bold text-[10.5px]">
                        <span>{item.giftIcon}</span>
                        <span>{item.text}</span>
                        <span className="text-white text-[9px]">({item.giftCoins} 💰)</span>
                      </span>
                    ) : item.type === 'system' ? (
                      <span className="text-purple-300 font-medium text-[11px] bg-purple-950/40 px-2 py-0.5 rounded-lg border border-purple-500/20">
                        {item.text}
                      </span>
                    ) : item.type === 'host' ? (
                      <span className="text-amber-200 font-semibold text-[11px]">
                        {item.text}
                      </span>
                    ) : (
                      <span className="text-zinc-200 text-[11px] break-words">
                        {item.text}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div ref={commentsEndRef} />
          </div>

          {/* =====================================================================
              6. BOTTOM CONTROL BAR (Comment + Send + Music + Mic + Audio + Gift + More)
             ===================================================================== */}
          <div className="p-2.5 bg-black/60 border-t border-white/10 flex flex-col gap-2">
            {/* Upper row: Comment input field + Send button */}
            <form onSubmit={handleSendChat} className="w-full flex items-center relative">
              <input
                type="text"
                placeholder="Chat with party room..."
                value={inputChat}
                onChange={(e) => setInputChat(e.target.value)}
                className="w-full h-9 pl-3.5 pr-10 rounded-full bg-[#160B2C] border border-[#A855F7]/30 text-white placeholder-zinc-400 text-xs focus:outline-none focus:border-[#EC4899]"
              />
              <button
                type="submit"
                className="absolute right-1 w-7 h-7 rounded-full bg-gradient-to-r from-[#7928CA] to-[#EC4899] flex items-center justify-center text-white hover:brightness-110 transition-all cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>

            {/* Bottom Row: 5 Action Buttons with Equal Sizing & Spacing */}
            <div className="grid grid-cols-5 gap-2 w-full">
              {/* 1. Music Button */}
              <button
                onClick={() => setShowMusicModal(true)}
                className={`h-10 rounded-xl border flex flex-col items-center justify-center p-1 transition-all cursor-pointer ${
                  isMusicPlaying
                    ? 'bg-gradient-to-tr from-[#7928CA] to-[#EC4899] border-[#EC4899] text-white shadow-md'
                    : 'bg-[#180E2E] border-white/10 text-zinc-400 hover:text-white'
                }`}
                title="Music Player & Playlist"
              >
                <Music className={`w-3.5 h-3.5 ${isMusicPlaying ? 'animate-bounce text-white' : 'text-[#EC4899]'}`} />
                <span className="text-[8.5px] font-black truncate max-w-full mt-0.5">
                  {isMusicPlaying ? 'Music On' : 'Music'}
                </span>
              </button>

              {/* 2. Microphone ON / OFF Toggle Button */}
              <button
                onClick={() => {
                  if (userSeatIndex !== null) {
                    const mySeat = activePartyRoom.seats[userSeatIndex];
                    if (mySeat?.isHostMuted && isMicMuted) {
                      showToast('Your mic was locked by Host/Moderator and cannot be unmuted by you! 🔒');
                      return;
                    }
                    setIsMicMuted(!isMicMuted);
                    showToast(isMicMuted ? 'Mic Live 🎙️' : 'Mic Muted 🔇');
                  } else if (isHost) {
                    setIsHostMicMuted(!isHostMicMuted);
                    showToast(isHostMicMuted ? 'Host Mic Live 🎙️' : 'Host Mic Muted 🔇');
                  } else {
                    showToast('Take a seat (+) to turn on your mic! 🎙️');
                  }
                }}
                className={`h-10 rounded-xl border flex flex-col items-center justify-center p-1 transition-all cursor-pointer ${
                  userSeatIndex !== null || isHost
                    ? (isHost ? !isHostMicMuted : !isMicMuted)
                      ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300 shadow-md'
                      : 'bg-rose-950/80 border-rose-500/60 text-rose-300'
                    : 'bg-[#180E2E] border-white/10 text-zinc-500'
                }`}
                title="Toggle Microphone"
              >
                {(userSeatIndex !== null && !isMicMuted) || (isHost && !isHostMicMuted) ? (
                  <Mic className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <MicOff className="w-3.5 h-3.5 text-rose-400" />
                )}
                <span className="text-[8.5px] font-black truncate max-w-full mt-0.5">
                  {(userSeatIndex !== null && !isMicMuted) || (isHost && !isHostMicMuted)
                    ? 'Mic On'
                    : 'Mic Off'}
                </span>
              </button>

              {/* 3. Speaker / Audio Control Button */}
              <button
                onClick={() => {
                  setIsSpeakerOn(!isSpeakerOn);
                  showToast(isSpeakerOn ? 'Speaker Muted 🔇' : 'Speaker Active 🔊');
                }}
                className={`h-10 rounded-xl border flex flex-col items-center justify-center p-1 transition-all cursor-pointer ${
                  isSpeakerOn
                    ? 'bg-[#180E2E] border-white/10 text-zinc-200 hover:text-white'
                    : 'bg-rose-950/80 border-rose-500/50 text-rose-300'
                }`}
                title="Room Audio"
              >
                {isSpeakerOn ? (
                  <Volume2 className="w-3.5 h-3.5 text-[#C084FC]" />
                ) : (
                  <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                )}
                <span className="text-[8.5px] font-black truncate max-w-full mt-0.5">
                  {isSpeakerOn ? 'Audio On' : 'Muted'}
                </span>
              </button>

              {/* 4. Gift Button */}
              <button
                onClick={() => setShowGiftDrawer(true)}
                className="h-10 rounded-xl bg-gradient-to-tr from-[#7928CA] via-[#EC4899] to-[#F59E0B] p-[1.5px] shadow-lg shadow-[#EC4899]/30 active:scale-95 transition-transform cursor-pointer"
                title="Send Virtual Gift"
              >
                <div className="w-full h-full rounded-[10px] bg-[#160B2C] flex flex-col items-center justify-center p-1">
                  <GiftIcon className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                  <span className="text-[8.5px] font-black text-amber-300 truncate max-w-full mt-0.5">
                    Gifts
                  </span>
                </div>
              </button>

              {/* 5. More Options Button */}
              <button
                onClick={() => setShowMoreModal(true)}
                className="h-10 rounded-xl bg-[#180E2E] border border-white/10 flex flex-col items-center justify-center p-1 text-zinc-300 hover:text-white active:scale-95 transition-all cursor-pointer"
                title="Party Room Settings & Options"
              >
                <MoreHorizontal className="w-3.5 h-3.5 text-[#C084FC]" />
                <span className="text-[8.5px] font-black truncate max-w-full mt-0.5">More</span>
              </button>
            </div>
          </div>
        </div>

        {/* =====================================================================
            MODALS: Music Player, Virtual Gifts Drawer, Seat Actions, More
           ===================================================================== */}

        {/* Music Player & Playlist Modal */}
        {showMusicModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="w-full max-w-sm rounded-3xl bg-[#170E2C] border border-[#A855F7]/30 p-5 shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-[#A855F7]/20">
                <div className="flex items-center gap-2">
                  <Disc3 className={`w-5 h-5 text-[#EC4899] ${isMusicPlaying ? 'animate-spin-slow' : ''}`} />
                  <span className="text-sm font-bold text-white">Party Room Music Hub</span>
                </div>
                <button onClick={() => setShowMusicModal(false)} className="text-zinc-400 hover:text-white cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Master Play/Pause */}
              <div className="mt-4 p-3.5 rounded-2xl bg-gradient-to-r from-[#7928CA]/30 via-[#EC4899]/20 to-[#7928CA]/30 border border-[#A855F7]/30 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-white">{currentTrack.title}</div>
                  <div className="text-[10px] text-zinc-400">{currentTrack.artist}</div>
                </div>
                <button
                  onClick={() => setIsMusicPlaying(!isMusicPlaying)}
                  className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#7928CA] to-[#EC4899] flex items-center justify-center text-white shadow-md cursor-pointer hover:scale-105 transition-transform"
                >
                  {isMusicPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white ml-0.5" />}
                </button>
              </div>

              {/* Playlist Tracks */}
              <div className="mt-4 space-y-2 max-h-48 overflow-y-auto">
                <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                  Playlist
                </div>
                {PLAYLIST_TRACKS.map((t, idx) => {
                  const isCurrent = idx === currentTrackIndex;
                  return (
                    <div
                      key={t.id}
                      onClick={() => {
                        setCurrentTrackIndex(idx);
                        setIsMusicPlaying(true);
                        showToast(`Playing: ${t.title} 🎶`);
                      }}
                      className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                        isCurrent
                          ? 'bg-[#7928CA]/30 border-[#EC4899] text-white'
                          : 'bg-[#120824] border-white/5 text-zinc-300 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-xs font-mono text-[#C084FC]">0{idx + 1}</span>
                        <div className="min-w-0">
                          <div className="text-xs font-bold truncate">{t.title}</div>
                          <div className="text-[10px] text-zinc-400">{t.artist}</div>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-zinc-400">{t.duration}</span>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={() => setShowMusicModal(false)}
                className="mt-4 w-full h-10 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold hover:text-white cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Virtual Gifts Drawer Modal */}
        {showGiftDrawer && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex flex-col justify-end">
            <div className="w-full max-w-md mx-auto rounded-t-3xl bg-[#160E2C] border-t border-[#A855F7]/30 p-4 shadow-2xl animate-slide-up">
              <div className="flex items-center justify-between pb-3 border-b border-[#A855F7]/15">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">Party Room Virtual Gifts</span>
                  <span className="text-xs text-amber-400 font-bold">💰 {coins.toLocaleString()} Coins</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentScreen('wallet')}
                    className="px-2.5 py-0.5 rounded-full bg-[#7928CA] text-white text-[10px] font-bold hover:bg-[#A855F7]"
                  >
                    + Recharge
                  </button>
                  <button onClick={() => setShowGiftDrawer(false)} className="text-zinc-400 hover:text-white cursor-pointer">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Gift Grid */}
              <div className="grid grid-cols-4 gap-2.5 py-4 max-h-60 overflow-y-auto">
                {VIRTUAL_GIFTS.map((g) => {
                  const isSelected = selectedGift.id === g.id;
                  return (
                    <div
                      key={g.id}
                      onClick={() => setSelectedGift(g)}
                      className={`relative rounded-2xl p-2.5 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-gradient-to-b from-[#7928CA]/40 to-[#EC4899]/30 border-2 border-[#EC4899] shadow-lg shadow-[#EC4899]/20 scale-105'
                          : 'bg-[#1D1438] border border-white/5 hover:border-white/20'
                      }`}
                    >
                      <span className="text-2xl mb-1">{g.icon}</span>
                      <span className="text-[10px] font-bold text-white truncate max-w-full">{g.name}</span>
                      <span className="text-[10px] text-amber-400 font-semibold mt-0.5">{g.coins}</span>
                    </div>
                  );
                })}
              </div>

              {/* Selected Gift Footer */}
              <div className="flex items-center justify-between pt-2 border-t border-[#A855F7]/15">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{selectedGift.icon}</span>
                  <div>
                    <div className="text-xs font-bold text-white">{selectedGift.name}</div>
                    <div className="text-[10px] text-zinc-400">{selectedGift.description}</div>
                  </div>
                </div>

                <button
                  onClick={handleSendSelectedGift}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#7928CA] via-[#9333EA] to-[#EC4899] text-white font-bold text-xs shadow-lg shadow-[#7928CA]/50 hover:brightness-110 active:scale-95 transition-all cursor-pointer"
                >
                  Send ({selectedGift.coins} 💰)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* User Action Sheet Modal for Guest Seats, Host, Viewers & Comments */}
        {selectedUserForActionSheet && (
          <UserActionSheetModal
            isOpen={showUserActionSheet}
            onClose={() => {
              setShowUserActionSheet(false);
              setSelectedUserForActionSheet(null);
              setSelectedUserSeatIndex(null);
            }}
            user={selectedUserForActionSheet}
            isViewerHost={isHost}
            isViewerModerator={isModerator}
            hostUser={activePartyRoom.host}
            moderatorIds={moderatorIds}
            onToggleModerator={handleToggleModerator}
            onKickUser={handleKickUser}
            onBlockUser={handleBlockUser}
            isSeated={selectedUserSeatIndex !== null}
            seatIndex={selectedUserSeatIndex}
            isSeatMuted={
              selectedUserSeatIndex !== null
                ? activePartyRoom.seats[selectedUserSeatIndex]?.isMuted ?? false
                : false
            }
            isSeatHostMuted={
              selectedUserSeatIndex !== null
                ? activePartyRoom.seats[selectedUserSeatIndex]?.isHostMuted ?? false
                : false
            }
            onToggleSeatMic={handleToggleSeatMicByHostOrMod}
            onSendGift={(target) => {
              setGiftRecipientUser(target);
              setShowGiftDrawer(true);
            }}
            onDirectMessage={(target) => {
              startDirectMessage(target);
            }}
            onVisitProfile={(target) => {
              showToast(`Visiting ${target.displayName}'s profile... 🌟`);
              setCurrentScreen('profile');
            }}
            isFollowing={followingUserIds.has(selectedUserForActionSheet.id)}
            onToggleFollow={handleToggleFollowUser}
            currentUserId={currentUser.id}
          />
        )}

        {/* Room Viewers & Audience List Modal */}
        <RoomViewersModal
          isOpen={showViewersModal}
          onClose={() => setShowViewersModal(false)}
          viewers={MOCK_ROOM_VIEWERS}
          hostUser={activePartyRoom.host}
          moderatorIds={moderatorIds}
          totalViewerCount={activeViewers}
          isPartyRoom={true}
          canInviteToSeat={canModerate}
          onInviteToSeat={handleInviteViewerToSeat}
          onSelectUser={(viewer) => {
            setShowViewersModal(false);
            const seatIdx = activePartyRoom.seats.findIndex((s) => s.user?.id === viewer.id);
            setSelectedUserForActionSheet(viewer);
            setSelectedUserSeatIndex(seatIdx !== -1 ? seatIdx : null);
            setShowUserActionSheet(true);
          }}
        />

        {/* More Options Modal */}
        {showMoreModal && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-sm rounded-3xl bg-[#171030] border border-[#A855F7]/30 p-5 shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-[#A855F7]/20">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Settings className="w-4 h-4 text-[#A855F7]" />
                  <span>Party Room Options</span>
                </h3>
                <button onClick={() => setShowMoreModal(false)} className="text-zinc-400 hover:text-white cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Party Level Switcher */}
              <div className="my-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-zinc-300">Convert Party Room Size</label>
                  <span className="text-[10px] text-zinc-400">
                    Host: Lv.{isHost ? currentUser.level : (activePartyRoom?.host.level ?? 45)}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {PARTY_TIER_SETTINGS.map((item) => {
                    const isUnlocked = isHost
                      ? currentUser.level >= item.requiredLevel
                      : (activePartyRoom?.host.level ?? 45) >= item.requiredLevel;
                    const isCurrent = partyLevel === item.level;

                    return (
                      <button
                        key={item.level}
                        onClick={() => {
                          handleConvertRoomLevel(item.level);
                          if (isHost && currentUser.level >= item.requiredLevel) {
                            setShowMoreModal(false);
                          }
                        }}
                        className={`p-2.5 rounded-2xl border text-center cursor-pointer transition-all relative ${
                          isCurrent
                            ? 'bg-gradient-to-tr from-[#7928CA]/50 to-[#EC4899]/40 border-[#EC4899] text-white shadow-md'
                            : isUnlocked
                            ? 'bg-[#120824] border-white/10 text-zinc-300 hover:border-white/30'
                            : 'bg-black/40 border-white/5 text-zinc-500 opacity-60'
                        }`}
                      >
                        {!isUnlocked && (
                          <div className="absolute top-1.5 right-1.5">
                            <Lock className="w-2.5 h-2.5 text-zinc-400" />
                          </div>
                        )}
                        <div className="text-base mb-0.5">{item.icon}</div>
                        <div className="text-[11px] font-black truncate">{item.name}</div>
                        <div className="text-[9px] text-[#C084FC] mt-0.5 font-bold">
                          {item.requiredLevel === 0 ? 'FREE (Lv.0)' : `Req Lv.${item.requiredLevel}`}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Quick links */}
              <div className="space-y-2 mb-4">
                <button
                  onClick={() => {
                    copyToClipboard(window.location.href);
                    showToast('Party room link copied! 🔗');
                    setShowMoreModal(false);
                  }}
                  className="w-full p-3 rounded-xl bg-[#110A22] border border-white/5 text-xs text-white flex items-center justify-between hover:border-[#A855F7]/30 cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Share2 className="w-4 h-4 text-amber-400" />
                    <span>Copy Room Invitation Link</span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-zinc-500" />
                </button>

                <button
                  onClick={() => {
                    showToast('Room rules & announcement: Level 20+ to host!');
                    setShowMoreModal(false);
                  }}
                  className="w-full p-3 rounded-xl bg-[#110A22] border border-white/5 text-xs text-white flex items-center justify-between hover:border-[#A855F7]/30 cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#A855F7]" />
                    <span>Room Announcement & Rules</span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-zinc-500" />
                </button>
              </div>

              <button
                onClick={() => setShowMoreModal(false)}
                className="w-full h-10 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold hover:text-white cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Share Broadcast Modal */}
        {showShareModal && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-sm rounded-3xl bg-[#171030] border border-[#A855F7]/30 p-5 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Share2 className="w-4 h-4 text-amber-400" />
                  <span>Share Party Room</span>
                </h3>
                <button onClick={() => setShowShareModal(false)} className="text-zinc-400 hover:text-white cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs text-zinc-300 mb-4">
                Invite friends to join <span className="font-bold text-white">{activePartyRoom.title}</span>!
              </p>

              <div className="grid grid-cols-4 gap-3 mb-4">
                {[
                  { name: 'Copy Link', icon: '🔗', action: () => { copyToClipboard(window.location.href); showToast('Link copied! 📋'); } },
                  { name: 'WhatsApp', icon: '💬', action: () => { window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(`Join ${activePartyRoom.title} on Alpha Mate!`)}`, '_blank'); } },
                  { name: 'Telegram', icon: '✈️', action: () => { window.open(`https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent('Live Voice Party on Alpha Mate!')}`, '_blank'); } },
                  { name: 'Twitter/X', icon: '🐦', action: () => { window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent('Live Voice Party on Alpha Mate!')}&url=${encodeURIComponent(window.location.href)}`, '_blank'); } },
                ].map((item) => (
                  <button
                    key={item.name}
                    onClick={item.action}
                    className="flex flex-col items-center justify-center p-3 rounded-2xl bg-[#120924] border border-white/5 hover:border-[#A855F7]/40 transition-all cursor-pointer"
                  >
                    <span className="text-2xl mb-1">{item.icon}</span>
                    <span className="text-[10px] font-semibold text-zinc-300">{item.name}</span>
                  </button>
                ))}
              </div>

              <button
                onClick={() => setShowShareModal(false)}
                className="w-full h-10 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold hover:text-white cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // GUEST SEAT RENDER FUNCTION (Responsive for Levels 1, 2, and 3)
  // =========================================================================
  function renderGuestSeat(seat: PartySeat, sizeVariant: 'lg' | 'md' | 'sm') {
    const isOccupied = seat.user !== null;
    const isMe = userSeatIndex === seat.seatIndex;
    const isSpeaking = seat.isSpeaking || speakingGuestIndex === seat.seatIndex;

    const sizeClasses = {
      lg: 'w-13 h-13 sm:w-14 sm:h-14',
      md: 'w-11 h-11 sm:w-12 sm:h-12',
      sm: 'w-9 h-9 sm:w-10 sm:h-10',
    }[sizeVariant];

    const labelMaxWidth = {
      lg: 'max-w-[62px]',
      md: 'max-w-[56px]',
      sm: 'max-w-[48px]',
    }[sizeVariant];

    return (
      <div
        key={seat.seatIndex}
        onClick={() => handleSeatClick(seat)}
        className="flex flex-col items-center gap-1 cursor-pointer group transition-transform active:scale-95"
      >
        <div className="relative">
          {/* Speaking Soundwave Pulsing Waves */}
          {isOccupied && isSpeaking && !seat.isMuted && (
            <>
              <div className="absolute -inset-1 rounded-full border border-emerald-400 animate-ping opacity-75" />
              <div className="absolute -inset-2 rounded-full border border-emerald-400/40 animate-pulse" />
            </>
          )}

          {/* Seat Avatar Container with Neon Glowing Border */}
          <div
            className={`rounded-full transition-all flex items-center justify-center ${sizeClasses} ${
              isOccupied
                ? 'p-[2px] bg-gradient-to-tr from-[#7928CA] via-[#EC4899] to-[#38BDF8] shadow-[0_0_12px_rgba(168,85,247,0.5)]'
                : 'border-2 border-dashed border-[#A855F7]/40 bg-[#160A2C]/60 hover:border-[#EC4899] hover:bg-[#1E0D3A]'
            }`}
          >
            {isOccupied ? (
              <div className="relative w-full h-full rounded-full overflow-hidden">
                <img
                  src={seat.user!.avatar}
                  alt={seat.user!.displayName}
                  className="w-full h-full rounded-full object-cover"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-zinc-400 group-hover:text-[#EC4899] transition-colors">
                <Plus className="w-3.5 h-3.5" />
                <span className="text-[7.5px] font-bold">{seat.seatIndex + 1}</span>
              </div>
            )}
          </div>

          {/* Moderator Badge on Seat */}
          {isOccupied && seat.user && moderatorIds.includes(seat.user.id) && (
            <div className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-cyan-600 border border-white flex items-center justify-center shadow-sm" title="Room Moderator">
              <ShieldCheck className="w-2.5 h-2.5 text-white" />
            </div>
          )}

          {/* Microphone Status Indicator on Seat */}
          {isOccupied && (
            <div
              className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full flex items-center justify-center border border-white/20 shadow-md ${
                seat.isMuted
                  ? seat.isHostMuted
                    ? 'bg-rose-700 text-white ring-1 ring-amber-400'
                    : 'bg-rose-600 text-white'
                  : 'bg-emerald-500 text-black'
              }`}
              title={seat.isHostMuted ? 'Muted & Locked by Host/Mod' : (seat.isMuted ? 'Mic Muted' : 'Mic Live')}
            >
              {seat.isHostMuted ? (
                <Lock className="w-2 h-2 text-amber-300" />
              ) : seat.isMuted ? (
                <MicOff className="w-2 h-2 sm:w-2.5 sm:h-2.5" />
              ) : (
                <Mic className="w-2 h-2 sm:w-2.5 sm:h-2.5" />
              )}
            </div>
          )}
        </div>

        {/* Username Label */}
        <span
          className={`text-[8.5px] sm:text-[9.5px] font-bold text-zinc-200 truncate text-center ${labelMaxWidth}`}
        >
          {isOccupied ? (isMe ? 'You' : seat.user!.displayName.split(' ')[0]) : `Seat ${seat.seatIndex + 1}`}
        </span>

        {/* Gift Coin Value Pill */}
        <div className="flex items-center gap-0.5 px-1 py-0.2 rounded-full bg-black/50 border border-white/10 text-amber-300 text-[7.5px] font-bold shadow-xs">
          <span>🎁</span>
          <span>{seat.receivedCoins ? (seat.receivedCoins > 999 ? `${(seat.receivedCoins / 1000).toFixed(1)}k` : seat.receivedCoins) : '0'}</span>
        </div>
      </div>
    );
  }

  // =========================================================================
  // IF NO ACTIVE PARTY ROOM -> RENDER AUDIO PARTY DISCOVERY HUB
  // =========================================================================
  const filteredRooms = partyRooms.filter((room) => {
    if (activeCategory === 'All') return true;
    return room.category === activeCategory;
  });

  return (
    <div className="relative w-full h-full min-h-screen pb-32 bg-[#09070F] text-white overflow-y-auto">
      <TopBar />

      {/* Hero Party Discovery Banner */}
      <div className="px-4 pt-3 pb-2">
        <div className="relative rounded-3xl p-5 overflow-hidden bg-gradient-to-r from-[#1E0F38] via-[#2A144E] to-[#160B2A] border border-[#A855F7]/30 shadow-xl">
          <div className="relative z-10 max-w-[200px]">
            <span className="px-2 py-0.5 rounded-full bg-[#EC4899] text-[9px] font-black uppercase tracking-wider text-white">
              AUDIO LOUNGES
            </span>
            <h1 className="text-lg font-black text-white mt-1.5 leading-snug">
              Drop into Live Voice Parties
            </h1>
            <p className="text-[11px] text-zinc-300 mt-1">
              Music, banter, debate, or just chill with international friends across 4, 8 & 15-seat lounges.
            </p>
          </div>

          {/* Create Party Action */}
          <button
            onClick={() => setShowCreateModal(true)}
            className="relative z-10 mt-3.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white text-xs font-bold shadow-md hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Party Room</span>
          </button>

          {/* Ambient visual badge in background */}
          <div className="absolute -right-4 -bottom-4 w-32 h-32 rounded-full bg-[#7928CA]/30 blur-2xl pointer-events-none" />
          <Radio className="absolute right-4 bottom-4 w-24 h-24 text-white/5 pointer-events-none" />
        </div>
      </div>

      {/* Category Filter Chips */}
      <div className="px-4 py-2 flex items-center gap-2 overflow-x-auto scrollbar-none">
        {(['All', 'Trending', 'Music', 'Singing', 'Dating'] as const).map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-all ${
              activeCategory === cat
                ? 'bg-gradient-to-r from-[#7928CA] to-[#A855F7] text-white shadow-md'
                : 'bg-[#160E2A] text-zinc-400 hover:text-white border border-[#A855F7]/15'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Party Rooms List */}
      <div className="px-4 py-2 space-y-3">
        {filteredRooms.map((room) => {
          const filledSeats = room.seats.filter((s) => s.user !== null).length;

          return (
            <div
              key={room.id}
              onClick={() => openPartyRoom(room)}
              className="p-4 rounded-2xl bg-[#140C26] border border-[#A855F7]/20 hover:border-[#A855F7]/50 shadow-lg cursor-pointer transform hover:-translate-y-0.5 transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <img
                      src={room.host.avatar}
                      alt={room.host.displayName}
                      className="w-12 h-12 rounded-2xl object-cover border border-[#A855F7]"
                    />
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#EC4899] flex items-center justify-center">
                      <Mic className="w-2.5 h-2.5 text-white" />
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-white max-w-[200px] truncate">{room.title}</h3>
                    <p className="text-[11px] text-zinc-400 mt-0.5">Host: {room.host.displayName}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#1F1238] border border-white/5 text-[10px] text-zinc-300 font-semibold">
                  <Users className="w-3 h-3 text-[#A855F7]" />
                  <span>{room.activeViewers} in room</span>
                </div>
              </div>

              {/* Seats preview bar & Level Badge */}
              <div className="flex items-center justify-between pt-2 border-t border-white/5">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[9px] font-black ${
                      room.level === 3
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : room.level === 2
                        ? 'bg-pink-500/20 text-pink-300 border border-pink-500/30'
                        : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                    }`}
                  >
                    {room.level === 3 ? '1+15 Seats' : room.level === 1 ? '1+4 Seats' : '1+8 Seats'}
                  </span>

                  <div className="flex items-center -space-x-2">
                    {room.seats
                      .filter((s) => s.user !== null)
                      .slice(0, 5)
                      .map((seat, i) => (
                        <img
                          key={i}
                          src={seat.user!.avatar}
                          alt="Guest"
                          className="w-6 h-6 rounded-full object-cover border-2 border-[#140C26]"
                        />
                      ))}
                    {filledSeats > 5 && (
                      <div className="w-6 h-6 rounded-full bg-zinc-800 text-[9px] font-bold text-white flex items-center justify-center border-2 border-[#140C26]">
                        +{filledSeats - 5}
                      </div>
                    )}
                  </div>
                </div>

                <span className="text-[10px] text-[#C084FC] font-semibold">
                  {Math.max(0, (room.level === 1 ? 4 : room.level === 3 ? 15 : 8) - filledSeats)} open seats left →
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* =========================================================================
          CREATE PARTY MODAL (3 Tiers: 1+4 Free, 1+8 Lv.10, 1+15 Lv.25)
         ========================================================================= */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-md rounded-3xl bg-[#150D2B] border border-[#A855F7]/40 p-5 sm:p-6 shadow-2xl my-auto animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-3 border-b border-white/10 mb-4">
              <div>
                <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                  <Radio className="w-5 h-5 text-[#EC4899]" />
                  <span>Create Party Room</span>
                </h3>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Host an audio & music lounge for friends
                </p>
              </div>

              {/* User Current Level Pill */}
              <div className="flex flex-col items-end">
                <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider">Your Level</span>
                <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white text-[11px] font-black shadow-sm">
                  Lv.{currentUser.level}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              {/* Room Title */}
              <div>
                <label className="text-xs text-zinc-300 font-bold block mb-1">Room Title</label>
                <input
                  type="text"
                  value={newRoomTitle}
                  onChange={(e) => setNewRoomTitle(e.target.value)}
                  placeholder="e.g. Acoustic & Late Night Jam 💜"
                  className="w-full h-10 px-3.5 rounded-xl bg-[#0C061A] border border-[#A855F7]/30 text-white text-xs sm:text-sm focus:border-[#EC4899] focus:outline-none"
                />
              </div>

              {/* Room Category */}
              <div>
                <label className="text-xs text-zinc-300 font-bold block mb-1.5">Category</label>
                <div className="grid grid-cols-5 gap-1.5">
                  {(['Music', 'Chat', 'Singing', 'Gaming', 'Dating'] as const).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCreateCategory(cat)}
                      className={`py-1.5 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${
                        createCategory === cat
                          ? 'bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white shadow-md'
                          : 'bg-[#0E071F] text-zinc-400 border border-white/5 hover:text-white'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Room Capacity Tier Options (1 Host + 4, 1 Host + 8, 1 Host + 15) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-zinc-300 font-bold">Select Room Size & Capacity</label>
                  <span className="text-[10px] text-[#C084FC]">3 Capacity Tiers</span>
                </div>

                <div className="space-y-2.5">
                  {PARTY_TIER_SETTINGS.map((tier) => {
                    const isUnlocked = currentUser.level >= tier.requiredLevel;
                    const isSelected = createRoomLevel === tier.level;

                    return (
                      <div
                        key={tier.level}
                        onClick={() => {
                          if (!isUnlocked) {
                            showToast(
                              `🔒 ${tier.name} requires Level ${tier.requiredLevel}! Your current level is Lv.${currentUser.level}.`
                            );
                            return;
                          }
                          setCreateRoomLevel(tier.level);
                        }}
                        className={`relative p-3 rounded-2xl border transition-all cursor-pointer ${
                          isSelected && isUnlocked
                            ? 'bg-gradient-to-r from-[#2A124D] to-[#1E0E38] border-[#EC4899] shadow-lg shadow-[#EC4899]/20 ring-1 ring-[#EC4899]'
                            : isUnlocked
                            ? 'bg-[#0F0721] border-white/10 hover:border-white/30'
                            : 'bg-black/40 border-white/5 opacity-65 cursor-not-allowed'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          {/* Left: Icon & Title */}
                          <div className="flex items-center gap-2.5">
                            <span className="text-xl sm:text-2xl">{tier.icon}</span>
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h4 className="text-xs sm:text-sm font-black text-white">
                                  {tier.name}
                                </h4>
                                <span className="text-[10px] text-zinc-400 font-medium">
                                  ({tier.urduName})
                                </span>
                              </div>
                              <p className="text-[10px] text-zinc-400 mt-0.5">
                                {tier.tagline}
                              </p>
                            </div>
                          </div>

                          {/* Right: Status Badge & Radio */}
                          <div className="flex flex-col items-end gap-1 shrink-0 ml-2">
                            {isUnlocked ? (
                              <span
                                className={`px-2 py-0.5 rounded-full text-[9px] font-black ${
                                  tier.level === 1
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                    : 'bg-[#7928CA]/30 text-[#C084FC] border border-[#A855F7]/30'
                                }`}
                              >
                                {tier.level === 1 ? 'FREE (Lv. 0)' : `UNLOCKED (Lv.${tier.requiredLevel}+)`}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 text-[9px] font-bold border border-zinc-700 flex items-center gap-1">
                                <Lock className="w-2.5 h-2.5 text-amber-400" />
                                <span>Req Lv.{tier.requiredLevel}</span>
                              </span>
                            )}

                            {/* Selection Radio / Lock Icon */}
                            <div className="mt-0.5">
                              {isUnlocked ? (
                                <div
                                  className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                                    isSelected
                                      ? 'border-[#EC4899] bg-[#EC4899]'
                                      : 'border-zinc-500 bg-transparent'
                                  }`}
                                >
                                  {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                                </div>
                              ) : (
                                <span className="text-[9.5px] text-amber-300/80 font-semibold">
                                  Lv.{currentUser.level}/{tier.requiredLevel}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Lock Explanation bar if locked */}
                        {!isUnlocked && (
                          <div className="mt-2 pt-1.5 border-t border-white/5 flex items-center justify-between text-[9.5px] text-zinc-400">
                            <span className="flex items-center gap-1 text-amber-300/90 font-medium">
                              <Lock className="w-2.5 h-2.5" />
                              <span>Locked for your current level</span>
                            </span>
                            <span>Need +{tier.requiredLevel - currentUser.level} Levels to Unlock</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 h-11 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-semibold cursor-pointer hover:bg-zinc-700 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    // Double check unlock requirement
                    const selectedTier = PARTY_TIER_SETTINGS.find((t) => t.level === createRoomLevel) || PARTY_TIER_SETTINGS[0];
                    if (currentUser.level < selectedTier.requiredLevel) {
                      showToast(`🔒 ${selectedTier.name} is locked! Launching with 1 Host + 4 Seats.`);
                      setCreateRoomLevel(1);
                    }

                    const finalLevel = currentUser.level >= selectedTier.requiredLevel ? createRoomLevel : 1;
                    const finalTier = PARTY_TIER_SETTINGS.find((t) => t.level === finalLevel)!;

                    // Build initial seats matching chosen tier
                    const initialSeats: PartySeat[] = [
                      {
                        seatIndex: 0,
                        user: currentUser,
                        isMuted: false,
                        isSpeaking: true,
                        isHost: true,
                        receivedCoins: 500,
                      },
                    ];

                    for (let i = 1; i < finalTier.guestCount; i++) {
                      initialSeats.push({
                        seatIndex: i,
                        user: null,
                        isMuted: false,
                        isSpeaking: false,
                        receivedCoins: 0,
                      });
                    }

                    const newParty: PartyRoom = {
                      id: `party_${Date.now()}`,
                      title: newRoomTitle || `${currentUser.displayName}'s Lounge 💜`,
                      host: currentUser,
                      announcement: `Welcome to our ${finalTier.name} Audio Lounge! Tap an open seat to talk.`,
                      category: createCategory,
                      activeViewers: 1,
                      backgroundTheme: 'from-[#1E103A] to-[#0A0614]',
                      level: finalLevel,
                      totalGiftCoins: 1250,
                      seats: initialSeats,
                    };

                    setShowCreateModal(false);
                    createPartyRoom(newParty);
                    showToast(`🎉 ${finalTier.name} Created Successfully! 🚀`);
                  }}
                  className="flex-1 h-11 rounded-xl bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white text-xs font-bold shadow-lg shadow-[#7928CA]/30 hover:brightness-110 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Launch Room</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
