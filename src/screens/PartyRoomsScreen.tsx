import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { PartyRoom, PartySeat, User, Gift } from '../types';
import { p2pStreamingEngine } from '../services/webrtcService';
import { PartyRoomAtmosphere } from '../components/party/PartyRoomAtmosphere';
import { VipAvatarFrame } from '../components/brand/VipAvatarFrame';
import { LevelBadgeIcon } from '../components/brand/LevelBadgeIcon';
import { VIRTUAL_GIFTS } from '../data/mockData';
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
  Palette,
  Trophy,
  Medal,
  TrendingUp,
  Swords,
} from 'lucide-react';
import { UserActionSheetModal } from '../components/live/UserActionSheetModal';
import { RoomViewersModal } from '../components/live/RoomViewersModal';
import { PartyLeaderboardModal, PartyLeaderboardEntry } from '../components/party/PartyLeaderboardModal';
import { RoomPKInviteModal, OpponentRoomCandidate } from '../components/party/RoomPKInviteModal';
import { RoomPKIncomingModal } from '../components/party/RoomPKIncomingModal';
import { RoomPKSplitStage } from '../components/party/RoomPKSplitStage';
import { RoomPKVictoryModal } from '../components/party/RoomPKVictoryModal';
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
  subLabel: string;
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
    subLabel: '1 Host & 4 Guest Seats',
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
    subLabel: '1 Host & 8 Guest Seats',
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
    subLabel: '1 Host & 15 Guest Seats',
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
  const [roomBackground, setRoomBackground] = useState<'logo' | 'dp' | 'sunrise' | 'sunset' | 'mosque'>('logo');
  const [showBackgroundModal, setShowBackgroundModal] = useState(false);
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
  const [partyGivers, setPartyGivers] = useState<PartyLeaderboardEntry[]>([]);

  // Daily Top Platform Contributors (real-time givers)
  const dailyTopGivers: PartyLeaderboardEntry[] = useMemo(() => {
    return partyGivers.slice(0, 5);
  }, [partyGivers]);

  // Top Party Hosts
  const topPartyHosts: PartyLeaderboardEntry[] = useMemo(() => {
    if (!activePartyRoom) return [];
    return [
      {
        user: activePartyRoom.host,
        totalCoins: activePartyRoom.totalGiftCoins || 0,
        roomTitle: activePartyRoom.title,
      },
    ];
  }, [activePartyRoom]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Room vs Room PK Battle States
  const [isRoomPKActive, setIsRoomPKActive] = useState<boolean>(false);
  const [showRoomPKInviteModal, setShowRoomPKInviteModal] = useState<boolean>(false);
  const [showRoomPKIncomingModal, setShowRoomPKIncomingModal] = useState<boolean>(false);
  const [showRoomPKVictoryModal, setShowRoomPKVictoryModal] = useState<boolean>(false);
  const [activePKChallenger, setActivePKChallenger] = useState<OpponentRoomCandidate | null>(null);
  const [roomPKTimeLeft, setRoomPKTimeLeft] = useState<number>(300); // 5 mins (300 secs)
  const [leftRoomPKScore, setLeftRoomPKScore] = useState<number>(0);
  const [rightRoomPKScore, setRightRoomPKScore] = useState<number>(0);

  // Moderation & Audience state (Moderator limit: 10)
  const [moderatorIds, setModeratorIds] = useState<string[]>(
    activePartyRoom?.moderatorIds || []
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
  const [followingUserIds, setFollowingUserIds] = useState<Set<string>>(new Set());

  // Floating hearts & live audience
  const [hearts, setHearts] = useState<FloatingHeart[]>([]);
  const [activeViewers, setActiveViewers] = useState(activePartyRoom?.activeViewers || 0);
  const [speakingGuestIndex, setSpeakingGuestIndex] = useState<number>(0);

  // Discovery / Hub state (when not in a room)
  const [activeCategory, setActiveCategory] = useState<'All' | 'Trending' | 'Global' | 'Pakistan' | 'UAE' | 'Saudi Arabia'>('Trending');
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

  // Room vs Room PK 5-minute countdown timer & live battle scoring
  useEffect(() => {
    if (!isRoomPKActive) return;

    const timer = setInterval(() => {
      setRoomPKTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setIsRoomPKActive(false);
          setShowRoomPKVictoryModal(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Dynamic opponent room gifting simulator to create responsive tug-of-war
    const oppGiftingInterval = setInterval(() => {
      const amounts = [100, 250, 500, 800, 1200];
      const randomAmount = amounts[Math.floor(Math.random() * amounts.length)];
      setRightRoomPKScore((s) => s + randomAmount);
    }, 4500);

    return () => {
      clearInterval(timer);
      clearInterval(oppGiftingInterval);
    };
  }, [isRoomPKActive]);

  const commentsEndRef = useRef<HTMLDivElement>(null);
  const lastTapRef = useRef<number>(0);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleOpenRoomPK = () => {
    if (partyLevel === 3) {
      showToast('Room PK is only allowed in 4-Seat and 8-Seat rooms! (16-Seat not supported) ⚠️');
      return;
    }
    if (isRoomPKActive) {
      showToast('Room PK is already in progress! ⚔️');
      return;
    }
    setShowRoomPKInviteModal(true);
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

    if (targetLvl === 3 && isRoomPKActive) {
      setIsRoomPKActive(false);
      showToast('Room PK concluded (16-Seat rooms do not support Room PK) ⚔️');
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
      text: `🚀 Host ${currentUser.displayName} converted Party Room to ${tierConfig.name} (${tierConfig.subLabel})!`,
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

  // 15-Seat Guest Roster ready for real users
  const defaultGuestSeats: PartySeat[] = useMemo(() => {
    return Array.from({ length: 15 }, (_, i) => ({
      seatIndex: i,
      user: null,
      isMuted: false,
      isSpeaking: false,
      receivedCoins: 0,
    }));
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

    // Dynamically update Party Room Leaderboard
    setPartyGivers((prev) => {
      const existingIdx = prev.findIndex((g) => g.user.id === currentUser.id);
      let updated: PartyLeaderboardEntry[];
      if (existingIdx !== -1) {
        updated = prev.map((g, idx) =>
          idx === existingIdx
            ? {
                ...g,
                totalCoins: g.totalCoins + selectedGift.coins,
                giftCount: (g.giftCount || 0) + 1,
                lastGiftName: selectedGift.name,
                lastGiftIcon: selectedGift.icon,
              }
            : g
        );
      } else {
        updated = [
          ...prev,
          {
            user: currentUser,
            totalCoins: selectedGift.coins,
            giftCount: 1,
            lastGiftName: selectedGift.name,
            lastGiftIcon: selectedGift.icon,
          },
        ];
      }
      return updated.sort((a, b) => b.totalCoins - a.totalCoins);
    });

    if (isRoomPKActive) {
      setLeftRoomPKScore((prev) => prev + selectedGift.coins);
    }

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
        className="fixed inset-0 w-full h-[100dvh] max-h-[100dvh] bg-[#080313] text-white flex flex-col justify-between overflow-hidden select-none z-40"
      >
        {/* =====================================================================
            1. COMPLETE NIGHTCLUB PARTY ROOM BACKGROUND (5 Custom Themes)
           ===================================================================== */}
        <PartyRoomAtmosphere
          isMusicPlaying={isMusicPlaying}
          theme={roomBackground}
          hostAvatar={activePartyRoom.host.avatar}
        />

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
              <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                <button
                  onClick={() => setShowViewersModal(true)}
                  className="flex items-center gap-1 text-[#C084FC] hover:text-white font-semibold cursor-pointer px-1.5 py-0.5 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
                  title="View All Audience & Live Viewers"
                >
                  <Eye className="w-3 h-3 text-cyan-400" />
                  <span>{activeViewers.toLocaleString()}</span>
                </button>
                <span>•</span>
                {/* Party Room Leaderboard Capsule */}
                <button
                  onClick={() => setShowLeaderboardModal(true)}
                  className="flex items-center gap-1 text-amber-300 hover:text-white font-black cursor-pointer px-1.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500/25 to-yellow-500/15 border border-amber-400/40 hover:border-amber-400 transition-all shadow-xs"
                  title="View Party Room Top Givers & Leaderboard"
                >
                  <Trophy className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />
                  <span className="text-[8.5px] font-black uppercase text-amber-300">Top</span>
                  {partyGivers[0] && (
                    <img
                      src={partyGivers[0].user.avatar}
                      alt="Top Giver"
                      className="w-3.5 h-3.5 rounded-full object-cover border border-amber-400/80 -mr-0.5"
                    />
                  )}
                  <span className="text-[8.5px] text-white font-extrabold">
                    {partyGivers.reduce((acc, g) => acc + g.totalCoins, 0) >= 1000
                      ? `${(partyGivers.reduce((acc, g) => acc + g.totalCoins, 0) / 1000).toFixed(0)}k`
                      : partyGivers.reduce((acc, g) => acc + g.totalCoins, 0)}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Right: Party Level Switcher (Lv 1 / Lv 2 / Lv 3) + Leaderboard + Background + Speaker + Share */}
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
                    title={`${tier.name} (${tier.subLabel}) - ${isUnlocked ? 'Unlocked' : `Requires Lv.${tier.requiredLevel}`}`}
                  >
                    {!isUnlocked && <Lock className="w-2 h-2 text-zinc-500" />}
                    <span>Lv.{tier.level}</span>
                  </button>
                );
              })}
            </div>

            {/* Room PK Battle Button (4-Seat & 8-Seat Only) */}
            <button
              onClick={handleOpenRoomPK}
              className={`px-2.5 py-1 rounded-full text-[9px] font-black transition-all cursor-pointer flex items-center gap-1 shadow-sm ${
                isRoomPKActive
                  ? 'bg-gradient-to-r from-[#EC4899] to-[#F43F5E] text-white animate-pulse border border-pink-400'
                  : partyLevel === 3
                  ? 'bg-[#180C2E] text-zinc-500 border border-white/5 opacity-70 cursor-pointer'
                  : 'bg-gradient-to-r from-[#EC4899] to-[#7928CA] text-white hover:opacity-95 border border-[#EC4899]/50 shadow-md shadow-[#EC4899]/30'
              }`}
              title={
                partyLevel === 3
                  ? 'Room PK: Only available in 4-Seat & 8-Seat rooms (Not supported in 16-Seat)'
                  : isRoomPKActive
                  ? 'Room PK in Progress (5 Mins)'
                  : 'Invite Another Room for 5-Min PK Battle'
              }
            >
              <Swords className="w-3 h-3 text-white" />
              <span>{isRoomPKActive ? 'PK LIVE' : 'ROOM PK'}</span>
            </button>

            {/* Party Leaderboard Button */}
            <button
              onClick={() => setShowLeaderboardModal(true)}
              className="w-8 h-8 rounded-full bg-[#180C2E] border border-amber-400/40 flex items-center justify-center text-amber-400 hover:text-amber-200 cursor-pointer shadow-sm hover:border-amber-400 transition-colors"
              title="Party Room Leaderboard"
            >
              <Trophy className="w-3.5 h-3.5 fill-current" />
            </button>

            {/* Room Background Theme Switcher Button */}
            <button
              onClick={() => setShowBackgroundModal(true)}
              className="w-8 h-8 rounded-full bg-[#180C2E] border border-white/10 flex items-center justify-center text-zinc-300 hover:text-white cursor-pointer"
              title="Change Room Background"
            >
              <Palette className="w-3.5 h-3.5 text-[#EC4899]" />
            </button>

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
            3. PARTY ROOM STAGE (UPPER 50% - 55%)
            If Room vs Room PK is Active: Render 50/50 Split Stage Arena
            Otherwise: Render Normal Single Room Stage & Seated Guests
           ===================================================================== */}
        {isRoomPKActive && activePKChallenger ? (
          <RoomPKSplitStage
            myRoom={activePartyRoom}
            opponentRoom={activePKChallenger}
            mySeats={activeGuestSeats}
            myPartyLevel={partyLevel}
            myRoomScore={leftRoomPKScore}
            opponentRoomScore={rightRoomPKScore}
            timeLeft={roomPKTimeLeft}
            isHost={isHost}
            onEndPK={() => {
              setIsRoomPKActive(false);
              setShowRoomPKVictoryModal(true);
            }}
            onHostMicToggle={() => {
              if (isHost) {
                const nextState = !isHostMicMuted;
                setIsHostMicMuted(nextState);
                showToast(nextState ? 'Host Mic Muted 🔇' : 'Host Mic Live 🎙️');
              }
            }}
            isHostMicMuted={isHostMicMuted}
            onSeatClick={handleSeatClick}
          />
        ) : (
          <div className="relative z-10 flex flex-col items-center px-2 pt-1 pb-1 shrink-0 w-full">
          {/* Royal Crown Emblem atop Host Avatar */}
          <div className="relative -mb-1.5 z-10">
            <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-amber-400 via-amber-300 to-yellow-500 flex items-center justify-center shadow-[0_0_12px_rgba(251,191,36,0.8)] border border-amber-200">
              <Crown className="w-3.5 h-3.5 text-black fill-black" />
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
                <div className="absolute -inset-1.5 rounded-full border border-[#EC4899]/70 animate-ping opacity-75" />
                <div className="absolute -inset-3 rounded-full border border-[#A855F7]/40 animate-pulse" />
              </>
            )}

            {/* Glowing Host Profile Frame with Animated Breathing VIP Frame */}
            <VipAvatarFrame
              avatarUrl={activePartyRoom.host.avatar}
              vipTier={activePartyRoom.host.vipTier || 3}
              size="md"
              showCrownBadge={true}
            />

            {/* Host Microphone Status Badge */}
            <div
              className={`absolute bottom-0 right-0 w-4 h-4 rounded-full flex items-center justify-center border border-white/30 shadow-md ${
                isHostMicMuted ? 'bg-rose-600 text-white' : 'bg-emerald-500 text-black'
              }`}
            >
              {isHostMicMuted ? <MicOff className="w-2.5 h-2.5" /> : <Mic className="w-2.5 h-2.5" />}
            </div>
          </div>

          {/* Host Display Name & Host ID */}
          <div className="mt-0.5 flex items-center gap-1.5">
            <span className="text-xs font-black text-white tracking-wide truncate max-w-[140px]">
              {activePartyRoom.host.displayName}
            </span>
            <span className="w-3 h-3 rounded-full bg-[#EC4899] text-white text-[7.5px] font-black flex items-center justify-center shadow-sm">
              ✓
            </span>
            <button
              onClick={() => handleCopyHostId(activePartyRoom.host.uniqueId || 'AM_772091')}
              className="text-[8.5px] font-mono text-zinc-400 hover:text-white px-1.5 py-0.2 rounded bg-black/40 border border-white/10 cursor-pointer"
              title="Click to copy Host ID"
            >
              ID: {activePartyRoom.host.uniqueId || 'AM_772091'}
            </button>
          </div>

          {/* Host Badges: Level Badge + VIP Badge + Received Coins + Follow Button */}
          <div className="mt-0.5 flex items-center gap-1 flex-wrap justify-center">
            <LevelBadgeIcon level={activePartyRoom.host.level || 45} size="xs" />
            <span className="px-1.5 py-0.2 rounded bg-[#7928CA]/30 text-[#C084FC] text-[8px] font-black border border-[#A855F7]/30">
              VIP {activePartyRoom.host.vipTier || 6}
            </span>
            <button
              onClick={() => setShowLeaderboardModal(true)}
              className="px-2 py-0.2 rounded-full bg-gradient-to-r from-amber-500/20 to-yellow-500/10 text-amber-300 text-[8px] font-bold border border-amber-400/30 flex items-center gap-1 cursor-pointer hover:border-amber-400 transition-colors"
              title="Party Room Top Contributors Leaderboard"
            >
              <span>💰 {(activePartyRoom.totalGiftCoins || 48500).toLocaleString()}</span>
              <span className="text-[7.5px] font-black text-amber-400">🏆 Top</span>
            </button>
            <button
              onClick={() => {
                setIsFollowingHost(!isFollowingHost);
                showToast(isFollowingHost ? 'Unfollowed Host' : 'Following Host! 💜');
              }}
              className={`px-2 py-0.5 rounded-full text-[8.5px] font-black transition-all cursor-pointer ${
                isFollowingHost
                  ? 'bg-zinc-800 text-zinc-300 border border-white/10'
                  : 'bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white shadow-sm'
              }`}
            >
              {isFollowingHost ? 'Following' : '+ Follow'}
            </button>
          </div>

          {/* Quick moderation bar if Host or Mod */}
          {canModerate && (
            <div className="flex items-center justify-between max-w-xs mx-auto w-full bg-black/50 rounded-full border border-purple-500/20 px-2.5 py-0.5 text-[9px] mt-1 mb-0.5">
              <div className="flex items-center gap-1 text-amber-300 font-bold">
                <ShieldCheck className="w-3 h-3 text-cyan-400" />
                <span>{isHost ? '👑 Host' : '🛡️ MOD'}</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleMuteAllGuests}
                  className="px-2 py-0.2 rounded-full bg-rose-600/30 hover:bg-rose-600 border border-rose-500/40 text-rose-200 hover:text-white text-[8px] font-bold cursor-pointer transition-colors"
                >
                  Mute All
                </button>
                <button
                  onClick={handleUnmuteAllGuests}
                  className="px-2 py-0.2 rounded-full bg-emerald-600/30 hover:bg-emerald-600 border border-emerald-500/40 text-emerald-200 hover:text-white text-[8px] font-bold cursor-pointer transition-colors"
                >
                  Unmute All
                </button>
              </div>
            </div>
          )}

          {/* ===================================================================
              GUEST SEATS GRID – POSITIONED IMMEDIATELY UNDER HOST!
             =================================================================== */}
          <div className="w-full mt-1.5">
            {partyLevel === 1 && (
              /* PARTY LEVEL 1: 1 Host + 4 Guest Seats (1 Row of 4 right below Host) */
              <div className="grid grid-cols-4 gap-2 max-w-xs mx-auto w-full">
                {activeGuestSeats.map((seat) => renderGuestSeat(seat, 'lg'))}
              </div>
            )}

            {partyLevel === 2 && (
              /* PARTY LEVEL 2: 1 Host + 8 Guest Seats (2 Rows of 4 right below Host) */
              <div className="grid grid-cols-4 gap-x-2 gap-y-1.5 max-w-xs mx-auto w-full">
                {activeGuestSeats.map((seat) => renderGuestSeat(seat, 'md'))}
              </div>
            )}

            {partyLevel === 3 && (
              /* PARTY LEVEL 3: 1 Host + 15 Guest Seats (3 Rows of 5 right below Host) */
              <div className="grid grid-cols-5 gap-x-1 gap-y-1 max-w-sm mx-auto w-full">
                {activeGuestSeats.map((seat) => renderGuestSeat(seat, 'sm'))}
              </div>
            )}
          </div>

          {/* Seat Status & Capacity Indicator Pill */}
          <div className="flex items-center justify-center gap-2 mt-1">
            <span className="text-[9px] text-zinc-300 font-medium px-2 py-0.2 rounded-full bg-black/40 backdrop-blur-md border border-white/5">
              {userSeatIndex !== null
                ? `Seated on #${userSeatIndex + 1}`
                : 'Tap (+) to take seat'}
            </span>
            <span className="text-[9px] font-bold text-[#C084FC] px-2 py-0.2 rounded-full bg-[#7928CA]/20 border border-[#A855F7]/30">
              {occupiedGuestSeatsCount}/{maxGuestSeats} Seats
            </span>
          </div>

          {/* Dynamic Seat Expansion prompt if room is full */}
          {isRoomFull && nextTargetTier && isHost && (
            <div className="mt-1 p-2 rounded-xl bg-gradient-to-r from-[#7928CA]/90 via-[#EC4899]/90 to-[#7928CA]/90 border border-white/30 shadow-lg backdrop-blur-md flex items-center justify-between gap-2 max-w-xs mx-auto w-full">
              <div className="min-w-0">
                <p className="text-[10px] font-black text-white truncate">
                  All {maxGuestSeats} Seats Occupied!
                </p>
                <p className="text-[8.5px] text-pink-100 truncate">
                  {canHostUpgrade ? `Expand to ${nextTargetTier.name}` : `Req Lv.${nextTargetTier.requiredLevel}`}
                </p>
              </div>
              {canHostUpgrade && (
                <button
                  onClick={() => handleConvertRoomLevel(nextTargetTier.level)}
                  className="px-2.5 py-1 rounded-lg bg-white text-black text-[9.5px] font-black hover:bg-zinc-200 active:scale-95 transition-all shadow-md shrink-0 cursor-pointer flex items-center gap-1"
                >
                  <Zap className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />
                  <span>Expand</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

        {/* =====================================================================
            4. LOWER SECTION – COMMENTS STREAM & CONTROLS (SEAMLESSLY MERGED INTO ROOM UI)
           ===================================================================== */}
        <div className="relative z-20 flex flex-col justify-end w-full px-3 pb-2 pt-1">
          {/* Transparent Floating Comments Stream (No Tabs, No Upper Divider Line) */}
          <div className="h-44 sm:h-52 overflow-y-auto space-y-1.5 scrollbar-none pr-1 mb-2 [mask-image:linear-gradient(to_bottom,transparent_0%,black_15%,black_100%)]">
            {chatItems.map((item) => (
              <div
                key={item.id}
                onClick={() => handleCommentUserClick(item.sender)}
                className="flex items-start gap-1.5 text-xs text-zinc-200 leading-snug animate-fadeIn cursor-pointer hover:bg-white/10 px-2 py-1 rounded-2xl bg-black/40 backdrop-blur-md border border-white/5 transition-all w-fit max-w-[92%]"
                title="Tap to view profile & actions"
              >
                {/* User Avatar */}
                <img
                  src={item.sender.avatar}
                  alt={item.sender.displayName}
                  className="w-5 h-5 rounded-full object-cover shrink-0 mt-0.5 border border-white/15"
                />

                <div className="min-w-0 flex-1">
                  <div className="inline-flex items-center gap-1 flex-wrap">
                    {/* Host badge */}
                    {item.sender.isHost && (
                      <span className="px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[7.5px] font-black border border-amber-500/30">
                        HOST
                      </span>
                    )}

                    {/* VIP badge */}
                    {item.sender.vipTier && item.sender.vipTier > 0 && (
                      <span className="px-1 py-0.2 rounded bg-[#7928CA]/30 text-[#C084FC] text-[7.5px] font-black border border-[#A855F7]/30">
                        VIP {item.sender.vipTier}
                      </span>
                    )}

                    {/* Level Badge */}
                    <LevelBadgeIcon level={item.sender.level || 1} size="xs" />

                    {/* User display name */}
                    <span className="font-bold text-[#C084FC] text-[10.5px] shrink-0">
                      {item.sender.displayName}:
                    </span>

                    {/* Message content */}
                    {item.type === 'gift' ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-lg bg-gradient-to-r from-[#7928CA]/40 to-[#EC4899]/40 border border-[#EC4899]/40 text-amber-300 font-bold text-[10px]">
                        <span>{item.giftIcon}</span>
                        <span>{item.text}</span>
                        <span className="text-white text-[8.5px]">({item.giftCoins} 💰)</span>
                      </span>
                    ) : item.type === 'system' ? (
                      <span className="text-purple-300 font-medium text-[10.5px] bg-purple-950/40 px-1.5 py-0.2 rounded-lg border border-purple-500/20">
                        {item.text}
                      </span>
                    ) : item.type === 'host' ? (
                      <span className="text-amber-200 font-semibold text-[10.5px]">
                        {item.text}
                      </span>
                    ) : (
                      <span className="text-zinc-200 text-[10.5px] break-words">
                        {item.text}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div ref={commentsEndRef} />
          </div>

          {/* Unified Bottom Controls Bar (No Hard Divider Lines) */}
          <div className="flex flex-col gap-2">
            {/* Upper row: Comment input field + Send button */}
            <form onSubmit={handleSendChat} className="w-full flex items-center relative">
              <input
                type="text"
                placeholder="Say something nice..."
                value={inputChat}
                onChange={(e) => setInputChat(e.target.value)}
                className="w-full h-8 sm:h-9 pl-3.5 pr-9 rounded-full bg-black/55 backdrop-blur-md border border-white/15 text-white placeholder-zinc-400 text-xs focus:outline-none focus:border-[#EC4899]"
              />
              <button
                type="submit"
                className="absolute right-1 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-gradient-to-r from-[#7928CA] to-[#EC4899] flex items-center justify-center text-white hover:brightness-110 transition-all cursor-pointer shadow-sm"
              >
                <Send className="w-3 h-3" />
              </button>
            </form>

            {/* Bottom Row: 5 Action Buttons with Equal Sizing & Spacing */}
            <div className="grid grid-cols-5 gap-1.5 w-full">
              {/* 1. Music Button */}
              <button
                onClick={() => setShowMusicModal(true)}
                className={`h-9 sm:h-10 rounded-xl border flex flex-col items-center justify-center p-1 transition-all cursor-pointer backdrop-blur-md ${
                  isMusicPlaying
                    ? 'bg-gradient-to-tr from-[#7928CA]/80 to-[#EC4899]/80 border-[#EC4899] text-white shadow-md'
                    : 'bg-black/50 border-white/10 text-zinc-400 hover:text-white'
                }`}
                title="Music Player & Playlist"
              >
                <Music className={`w-3.5 h-3.5 ${isMusicPlaying ? 'animate-bounce text-white' : 'text-[#EC4899]'}`} />
                <span className="text-[8px] font-black truncate max-w-full mt-0.5">
                  {isMusicPlaying ? 'Music On' : 'Music'}
                </span>
              </button>

              {/* 2. Microphone ON / OFF Toggle Button */}
              <button
                onClick={() => {
                  if (userSeatIndex !== null) {
                    const mySeat = activePartyRoom.seats[userSeatIndex];
                    if (mySeat?.isHostMuted && isMicMuted) {
                      showToast('Your mic was locked by Host/Moderator! 🔒');
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
                className={`h-9 sm:h-10 rounded-xl border flex flex-col items-center justify-center p-1 transition-all cursor-pointer backdrop-blur-md ${
                  userSeatIndex !== null || isHost
                    ? (isHost ? !isHostMicMuted : !isMicMuted)
                      ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300 shadow-md'
                      : 'bg-rose-950/80 border-rose-500/60 text-rose-300'
                    : 'bg-black/50 border-white/10 text-zinc-500'
                }`}
                title="Toggle Microphone"
              >
                {(userSeatIndex !== null && !isMicMuted) || (isHost && !isHostMicMuted) ? (
                  <Mic className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <MicOff className="w-3.5 h-3.5 text-rose-400" />
                )}
                <span className="text-[8px] font-black truncate max-w-full mt-0.5">
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
                className={`h-9 sm:h-10 rounded-xl border flex flex-col items-center justify-center p-1 transition-all cursor-pointer backdrop-blur-md ${
                  isSpeakerOn
                    ? 'bg-black/50 border-white/10 text-zinc-200 hover:text-white'
                    : 'bg-rose-950/80 border-rose-500/50 text-rose-300'
                }`}
                title="Room Audio"
              >
                {isSpeakerOn ? (
                  <Volume2 className="w-3.5 h-3.5 text-[#C084FC]" />
                ) : (
                  <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                )}
                <span className="text-[8px] font-black truncate max-w-full mt-0.5">
                  {isSpeakerOn ? 'Audio On' : 'Muted'}
                </span>
              </button>

              {/* 4. Gift Button */}
              <button
                onClick={() => setShowGiftDrawer(true)}
                className="h-9 sm:h-10 rounded-xl bg-gradient-to-tr from-[#7928CA] via-[#EC4899] to-[#F59E0B] p-[1.5px] shadow-lg shadow-[#EC4899]/30 active:scale-95 transition-transform cursor-pointer"
                title="Send Virtual Gift"
              >
                <div className="w-full h-full rounded-[10px] bg-black/60 backdrop-blur-md flex flex-col items-center justify-center p-1">
                  <GiftIcon className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                  <span className="text-[8px] font-black text-amber-300 truncate max-w-full mt-0.5">
                    Gifts
                  </span>
                </div>
              </button>

              {/* 5. More Options Button */}
              <button
                onClick={() => setShowMoreModal(true)}
                className="h-9 sm:h-10 rounded-xl bg-black/50 backdrop-blur-md border border-white/10 flex flex-col items-center justify-center p-1 text-zinc-300 hover:text-white active:scale-95 transition-all cursor-pointer"
                title="Party Room Settings & Options"
              >
                <MoreHorizontal className="w-3.5 h-3.5 text-[#C084FC]" />
                <span className="text-[8px] font-black truncate max-w-full mt-0.5">More</span>
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

        {/* Room PK Invite Modal */}
        <RoomPKInviteModal
          isOpen={showRoomPKInviteModal}
          onClose={() => setShowRoomPKInviteModal(false)}
          currentRoom={activePartyRoom}
          activePartyRooms={partyRooms}
          onSendChallenge={(opp) => {
            setActivePKChallenger(opp);
            setIsRoomPKActive(true);
            setRoomPKTimeLeft(300);
            setLeftRoomPKScore(0);
            setRightRoomPKScore(0);
            showToast(`⚔️ Room PK Battle Started vs ${opp.title}! (5 Mins)`);
            setChatItems((prev) => [
              ...prev,
              {
                id: `sys_pk_${Date.now()}`,
                sender: {
                  displayName: 'Alpha System',
                  avatar: '/alpha-mate-logo-emblem.png',
                  vipTier: 8,
                },
                text: `⚔️ 5-Minute Room vs Room PK Battle has begun against "${opp.title}"! Drop gifts to help our room win!`,
                type: 'system',
                timestamp: 'Just now',
              },
            ]);
          }}
          onSimulateIncoming={() => {
            const candidate: OpponentRoomCandidate = {
              id: 'opp_simulated_01',
              title: 'Neon Night Lounge ⚡',
              level: partyLevel === 1 ? 1 : 2,
              activeViewers: 72,
              totalGiftCoins: 12500,
              host: {
                id: 'opp_host_cyberwolf',
                uniqueId: 'AM_339182',
                username: 'CyberWolf',
                displayName: 'CyberWolf 🐺',
                avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=400&q=80',
                bio: 'Night Owl EDM host',
                followersCount: 34000,
                followingCount: 210,
                likesCount: 280000,
                level: 48,
                xp: 52000,
                nextLevelXp: 65000,
                vipTier: 6,
                coins: 24000,
                diamonds: 9800,
                isVerified: true,
              },
              seats: [
                { seatIndex: 0, user: null, isMuted: false, isSpeaking: true, receivedCoins: 500 },
                { seatIndex: 1, user: null, isMuted: false, isSpeaking: false, receivedCoins: 300 },
                { seatIndex: 2, user: null, isMuted: false, isSpeaking: false, receivedCoins: 0 },
                { seatIndex: 3, user: null, isMuted: false, isSpeaking: false, receivedCoins: 0 },
              ],
            };
            setActivePKChallenger(candidate);
            setShowRoomPKIncomingModal(true);
          }}
        />

        {/* Room PK Incoming Challenge Proposal Modal */}
        {activePKChallenger && (
          <RoomPKIncomingModal
            isOpen={showRoomPKIncomingModal}
            challengerRoom={activePKChallenger}
            onAccept={() => {
              setShowRoomPKIncomingModal(false);
              setIsRoomPKActive(true);
              setRoomPKTimeLeft(300);
              setLeftRoomPKScore(0);
              setRightRoomPKScore(0);
              showToast(`⚔️ Accepted PK Challenge! Battle Started! (5 Mins)`);
              setChatItems((prev) => [
                ...prev,
                {
                  id: `sys_pk_acc_${Date.now()}`,
                  sender: {
                    displayName: 'Alpha System',
                    avatar: '/alpha-mate-logo-emblem.png',
                    vipTier: 8,
                  },
                  text: `⚔️ Room vs Room PK Battle with "${activePKChallenger.title}" is NOW LIVE! Every gift counts!`,
                  type: 'system',
                  timestamp: 'Just now',
                },
              ]);
            }}
            onDecline={() => {
              setShowRoomPKIncomingModal(false);
              showToast('Declined PK Challenge.');
            }}
          />
        )}

        {/* Room PK Match End / Victory Celebration Modal */}
        {activePKChallenger && (
          <RoomPKVictoryModal
            isOpen={showRoomPKVictoryModal}
            myRoomTitle={activePartyRoom.title || `${activePartyRoom.host.displayName}'s Room`}
            opponentRoomTitle={activePKChallenger.title}
            myScore={leftRoomPKScore}
            opponentScore={rightRoomPKScore}
            onRematch={() => {
              setShowRoomPKVictoryModal(false);
              setIsRoomPKActive(true);
              setRoomPKTimeLeft(300);
              setLeftRoomPKScore(0);
              setRightRoomPKScore(0);
              showToast(`⚔️ Rematch started! 5-Minute battle!`);
            }}
            onClose={() => {
              setShowRoomPKVictoryModal(false);
              setActivePKChallenger(null);
              setIsRoomPKActive(false);
            }}
          />
        )}

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
                    setShowMoreModal(false);
                    handleOpenRoomPK();
                  }}
                  className={`w-full p-3 rounded-xl border text-xs flex items-center justify-between cursor-pointer shadow-sm transition-all ${
                    partyLevel === 3
                      ? 'bg-[#110A22] border-white/5 text-zinc-500 opacity-60'
                      : 'bg-gradient-to-r from-[#EC4899]/20 via-[#9333EA]/20 to-[#7928CA]/20 border-[#EC4899]/40 text-white hover:border-[#EC4899]'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Swords className="w-4 h-4 text-[#EC4899]" />
                    <span className="font-bold text-pink-200">Room vs Room PK Battle</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#EC4899]/30 text-[#EC4899] font-black uppercase">
                      5 Mins
                    </span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-zinc-500" />
                </button>
                <button
                  onClick={() => {
                    setShowMoreModal(false);
                    setShowLeaderboardModal(true);
                  }}
                  className="w-full p-3 rounded-xl bg-[#110A22] border border-amber-400/30 text-xs text-white flex items-center justify-between hover:border-amber-400 cursor-pointer shadow-sm"
                >
                  <span className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-400 fill-amber-400" />
                    <span className="font-bold text-amber-200">Party Leaderboard</span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-zinc-500" />
                </button>

                <button
                  onClick={() => {
                    setShowMoreModal(false);
                    setShowBackgroundModal(true);
                  }}
                  className="w-full p-3 rounded-xl bg-[#110A22] border border-white/5 text-xs text-white flex items-center justify-between hover:border-[#A855F7]/30 cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Palette className="w-4 h-4 text-[#EC4899]" />
                    <span>Change Background</span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-zinc-500" />
                </button>

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

        {/* Background Theme Selector Modal (5 High-Definition Themes) */}
        {showBackgroundModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="w-full max-w-sm rounded-3xl bg-[#160E2C] border border-[#A855F7]/40 p-5 shadow-2xl animate-scale-up">
              <div className="flex items-center justify-between pb-3 border-b border-[#A855F7]/20">
                <div className="flex items-center gap-2">
                  <Palette className="w-4 h-4 text-[#EC4899]" />
                  <span className="text-sm font-bold text-white">Room Background</span>
                </div>
                <button
                  onClick={() => setShowBackgroundModal(false)}
                  className="text-zinc-400 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-[11px] text-zinc-300 mt-2 mb-3">
                Select high-definition theme for your live party room:
              </p>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {[
                  {
                    id: 'logo' as const,
                    name: 'Alpha Mate Emblem',
                    desc: 'Official emblem with royal party glow',
                    thumb: '/alpha-mate-logo-emblem.png',
                    isThumbLogo: true,
                  },
                  {
                    id: 'dp' as const,
                    name: 'Host Profile Picture',
                    desc: "Host's profile backdrop with dark ambiance",
                    thumb: activePartyRoom.host.avatar,
                    isThumbLogo: false,
                  },
                  {
                    id: 'sunrise' as const,
                    name: 'Sunrise Morning Glow',
                    desc: 'Golden dawn rays over mountain peaks',
                    thumb: '/assets/backgrounds/sunrise.jpg',
                    isThumbLogo: false,
                  },
                  {
                    id: 'sunset' as const,
                    name: 'Sunset Evening Twilight',
                    desc: 'Romantic twilight sky over gentle sea',
                    thumb: '/assets/backgrounds/sunset.jpg',
                    isThumbLogo: false,
                  },
                  {
                    id: 'mosque' as const,
                    name: 'Grand Imperial Palace',
                    desc: 'Illuminated imperial domes & starry night',
                    thumb: '/assets/backgrounds/mosque.jpg',
                    isThumbLogo: false,
                  },
                ].map((bg) => {
                  const isSelected = roomBackground === bg.id;
                  return (
                    <div
                      key={bg.id}
                      onClick={() => {
                        setRoomBackground(bg.id);
                        showToast(`Background: ${bg.name}! 🎨`);
                        setShowBackgroundModal(false);
                      }}
                      className={`p-2.5 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-gradient-to-r from-[#7928CA]/40 to-[#EC4899]/30 border-[#EC4899] shadow-md shadow-[#EC4899]/20'
                          : 'bg-[#110822] border-white/5 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-12 h-12 rounded-xl overflow-hidden bg-black/60 shrink-0 border border-white/10 flex items-center justify-center">
                          <img
                            src={bg.thumb}
                            alt={bg.name}
                            className={`w-full h-full object-cover ${bg.isThumbLogo ? 'p-1 object-contain' : ''}`}
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-white truncate">{bg.name}</span>
                          </div>
                          <p className="text-[10px] text-zinc-400 truncate">{bg.desc}</p>
                        </div>
                      </div>

                      {isSelected ? (
                        <div className="w-5 h-5 rounded-full bg-gradient-to-r from-[#7928CA] to-[#EC4899] flex items-center justify-center shrink-0 ml-2 shadow-sm">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      ) : (
                        <span className="text-[10px] font-bold text-zinc-500 hover:text-white px-2 py-0.5 rounded-full bg-white/5 shrink-0 ml-2">
                          Use
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              <button
                onClick={() => setShowBackgroundModal(false)}
                className="mt-4 w-full h-10 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold hover:text-white cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Party Leaderboard Modal (Active Room) */}
        <PartyLeaderboardModal
          isOpen={showLeaderboardModal}
          onClose={() => setShowLeaderboardModal(false)}
          currentUser={currentUser}
          sessionGivers={partyGivers}
          dailyTopGivers={dailyTopGivers}
          topHosts={topPartyHosts}
          activeRoomTitle={activePartyRoom.title || 'Party Room'}
          onSelectUser={(targetUser) => {
            setShowLeaderboardModal(false);
            setSelectedUserForActionSheet(targetUser);
            setShowUserActionSheet(true);
          }}
          onOpenGiftDrawer={() => {
            setShowLeaderboardModal(false);
            setShowGiftDrawer(true);
          }}
        />
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

          {/* Seat Avatar Container */}
          {isOccupied ? (
            <VipAvatarFrame
              avatarUrl={seat.user!.avatar}
              vipTier={seat.user!.vipTier || 0}
              size={sizeVariant === 'sm' ? 'sm' : 'md'}
              showCrownBadge={false}
            />
          ) : (
            <div
              className={`rounded-full transition-all flex items-center justify-center border-2 border-dashed border-[#A855F7]/40 bg-[#160A2C]/60 hover:border-[#EC4899] hover:bg-[#1E0D3A] ${sizeClasses}`}
            >
              <div className="flex flex-col items-center justify-center text-zinc-400 group-hover:text-[#EC4899] transition-colors">
                <Plus className="w-3.5 h-3.5" />
                <span className="text-[7.5px] font-bold">{seat.seatIndex + 1}</span>
              </div>
            </div>
          )}

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
  const filteredRooms = useMemo(() => {
    let list = [...partyRooms];

    if (activeCategory === 'Global') {
      return list.filter((r) => r.country === 'Global' || !r.country);
    }
    if (activeCategory === 'Pakistan') {
      return list.filter((r) => r.country === 'Pakistan');
    }
    if (activeCategory === 'UAE') {
      return list.filter((r) => r.country === 'UAE');
    }
    if (activeCategory === 'Saudi Arabia') {
      return list.filter((r) => r.country === 'Saudi Arabia');
    }

    // Trending & All: Sorted by dynamic ranking algorithm (Gifting & Viewers)
    // Formula: totalGiftCoins * 1.5 + activeViewers * 50
    return list.sort((a, b) => {
      const scoreA = (a.totalGiftCoins || 0) * 1.5 + (a.activeViewers || 0) * 50;
      const scoreB = (b.totalGiftCoins || 0) * 1.5 + (b.activeViewers || 0) * 50;
      return scoreB - scoreA;
    });
  }, [partyRooms, activeCategory]);

  return (
    <div className="relative w-full h-full pb-24 bg-[#09070F] text-white overflow-y-auto overscroll-contain">
      {/* Hero Party Discovery Animated Musical Banner */}
      <div className="px-4 pt-3 pb-2">
        <div className="relative rounded-3xl p-4.5 overflow-hidden bg-gradient-to-r from-[#200A45] via-[#35105E] to-[#160B2A] border border-[#EC4899]/30 shadow-2xl shadow-purple-950/60">
          {/* Animated Background Glow & Disc Rotation */}
          <div className="absolute -right-8 -top-8 w-44 h-44 rounded-full bg-gradient-to-br from-[#EC4899]/30 via-[#A855F7]/25 to-transparent blur-2xl pointer-events-none animate-pulse" />
          <div className="absolute -left-10 -bottom-10 w-36 h-36 rounded-full bg-[#3B82F6]/20 blur-2xl pointer-events-none" />

          {/* Floating animated musical notes */}
          <div className="absolute top-2 right-24 text-lg animate-bounce duration-1000 opacity-60 pointer-events-none">🎵</div>
          <div className="absolute bottom-12 right-28 text-sm animate-bounce duration-700 opacity-70 pointer-events-none">🎶</div>
          <div className="absolute top-8 right-12 text-xs text-amber-300 animate-pulse pointer-events-none">✨</div>

          {/* Right Disc & DJ Party Singer Avatar Card */}
          <div className="absolute right-3 bottom-3 flex items-center pointer-events-none">
            <div className="relative w-20 h-20 sm:w-22 sm:h-22">
              {/* Spinning Vinyl Record behind */}
              <div className="absolute inset-0 rounded-full border-4 border-dashed border-[#EC4899]/50 animate-spin-slow opacity-80 flex items-center justify-center">
                <Disc3 className="w-full h-full text-zinc-900/40" />
              </div>
              {/* Party Singer Image Avatar */}
              <div className="absolute inset-2 rounded-full p-[2px] bg-gradient-to-tr from-[#EC4899] via-amber-400 to-[#7928CA] shadow-xl">
                <img
                  src="https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=400&q=80"
                  alt="Party Singer"
                  className="w-full h-full rounded-full object-cover"
                />
              </div>
              {/* Singing Mic / Wave badge */}
              <div className="absolute -bottom-1 -left-1 w-6 h-6 rounded-full bg-gradient-to-r from-[#EC4899] to-[#7928CA] border-2 border-[#160B2A] flex items-center justify-center shadow-lg">
                <Mic className="w-3.5 h-3.5 text-white animate-pulse" />
              </div>
            </div>
          </div>

          <div className="relative z-10 max-w-[210px]">
            <div className="flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-[#EC4899] to-[#7928CA] text-[9px] font-black uppercase tracking-wider text-white shadow-xs flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5 text-yellow-300" />
                <span>VOICE & SINGING LOUNGE</span>
              </span>
            </div>

            <h1 className="text-base sm:text-lg font-black text-white mt-1.5 leading-snug tracking-tight">
              Drop into Live Voice Parties 🎤
            </h1>
            <p className="text-[10.5px] text-zinc-300 mt-1 leading-relaxed">
              Live singing, DJ beats & fun banter across 4, 8 & 15-seat lounges!
            </p>

            {/* Create Party & Leaderboard Action */}
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#7928CA] via-[#9333EA] to-[#EC4899] text-white text-[11px] font-black shadow-lg shadow-[#7928CA]/40 hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                <span>Create</span>
              </button>

              <button
                onClick={() => setShowLeaderboardModal(true)}
                className="px-3.5 py-1.5 rounded-xl bg-[#1C0D36]/80 hover:bg-[#2A144E] text-amber-300 border border-amber-400/40 text-[11px] font-black shadow-md hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Trophy className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                <span>Leaderboard</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs: Trending, All, and Countries (Global, Pakistan, UAE, Saudi Arabia) */}
      <div className="px-4 py-2 flex items-center gap-2 overflow-x-auto scrollbar-none">
        {([
          { id: 'Trending', label: '🔥 Trending', isSpecial: true },
          { id: 'All', label: '🌟 All Parties', isSpecial: true },
          { id: 'Global', label: '🌐 Global', isCountry: true },
          { id: 'Pakistan', label: '🇵🇰 Pakistan', isCountry: true },
          { id: 'UAE', label: '🇦🇪 UAE', isCountry: true },
          { id: 'Saudi Arabia', label: '🇸🇦 Saudi', isCountry: true },
        ] as const).map((tab) => {
          const isSelected = activeCategory === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveCategory(tab.id as any)}
              className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap cursor-pointer transition-all flex items-center gap-1.5 ${
                isSelected
                  ? 'bg-gradient-to-r from-[#7928CA] to-[#A855F7] text-white shadow-md shadow-[#7928CA]/40 scale-102'
                  : 'bg-[#160E2A] text-zinc-400 hover:text-white border border-[#A855F7]/15'
              }`}
            >
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Party Rooms List */}
      <div className="px-4 py-2 space-y-4">
        {/* Top Trending Section if on Trending or All tab */}
        {(activeCategory === 'Trending' || activeCategory === 'All') && filteredRooms.length > 0 && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black tracking-wider uppercase text-amber-300 flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                <span>TOP TRENDING PARTIES</span>
              </span>
              <span className="text-[10px] text-zinc-400 font-semibold">
                By Gifts & Viewers
              </span>
            </div>

            {/* Top 2 Trending Highlight Cards */}
            <div className="space-y-2.5">
              {filteredRooms.slice(0, 2).map((room, rankIdx) => {
                const filledSeats = room.seats.filter((s) => s.user !== null).length;
                const isTop1 = rankIdx === 0;

                return (
                  <div
                    key={room.id}
                    onClick={() => openPartyRoom(room)}
                    className={`relative p-3.5 sm:p-4 rounded-2xl cursor-pointer transform hover:-translate-y-0.5 transition-all shadow-xl overflow-hidden ${
                      isTop1
                        ? 'bg-gradient-to-r from-[#2B104A] via-[#1F0C3B] to-[#140A28] border-2 border-amber-400/60 shadow-amber-500/10'
                        : 'bg-gradient-to-r from-[#20103A] to-[#120824] border border-[#EC4899]/50 shadow-pink-500/10'
                    }`}
                  >
                    {/* Top Rank Trophy Ribbon */}
                    <div className="absolute top-0 right-0">
                      <div
                        className={`px-3 py-1 rounded-bl-2xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-md ${
                          isTop1
                            ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-amber-950 font-black'
                            : 'bg-gradient-to-r from-[#EC4899] to-[#7928CA] text-white font-bold'
                        }`}
                      >
                        <span>{isTop1 ? '👑 TOP 1' : '🥈 TOP 2'}</span>
                      </div>
                    </div>

                    <div className="flex items-start justify-between mb-2.5 pr-20">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <img
                            src={room.host.avatar}
                            alt={room.host.displayName}
                            className={`w-12 h-12 rounded-2xl object-cover ${
                              isTop1 ? 'border-2 border-amber-400' : 'border-2 border-[#EC4899]'
                            }`}
                          />
                          <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#EC4899] flex items-center justify-center">
                            <Mic className="w-2.5 h-2.5 text-white" />
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center gap-1.5">
                            <h3 className="text-sm font-bold text-white max-w-[150px] truncate">{room.title}</h3>
                            {room.countryFlag && <span className="text-xs">{room.countryFlag}</span>}
                          </div>
                          <p className="text-[11px] text-zinc-300 mt-0.5">Host: {room.host.displayName}</p>
                        </div>
                      </div>
                    </div>

                    {/* Stats bar: Gifts & Viewers */}
                    <div className="flex items-center justify-between pt-2 border-t border-white/10">
                      <div className="flex items-center gap-2">
                        {/* Live Total Gifts Badge */}
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400/15 border border-amber-400/30 text-amber-300 text-[10px] font-bold">
                          <span>🎁</span>
                          <span>{((room.totalGiftCoins || 0) > 999 ? `${((room.totalGiftCoins || 0) / 1000).toFixed(1)}k` : room.totalGiftCoins || 0)} Coins</span>
                        </div>

                        {/* Viewers */}
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/10 text-zinc-300 text-[10px] font-semibold">
                          <Users className="w-3 h-3 text-[#A855F7]" />
                          <span>{room.activeViewers}</span>
                        </div>
                      </div>

                      {/* Guest avatars preview */}
                      <div className="flex items-center -space-x-1.5">
                        {room.seats
                          .filter((s) => s.user !== null)
                          .slice(0, 4)
                          .map((seat, i) => (
                            <img
                              key={i}
                              src={seat.user!.avatar}
                              alt="Guest"
                              className="w-5 h-5 rounded-full object-cover border border-[#140C26]"
                            />
                          ))}
                        <span className="text-[9.5px] text-[#C084FC] font-semibold ml-2">
                          {Math.max(0, (room.level === 1 ? 4 : room.level === 3 ? 15 : 8) - filledSeats)} seats left
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* All Parties / Regional List Divider */}
        <div>
          <div className="flex items-center justify-between mb-2 pt-1">
            <span className="text-[11px] font-bold tracking-wider uppercase text-zinc-400">
              {activeCategory === 'Trending'
                ? 'More Live Parties'
                : activeCategory === 'All'
                ? 'All Party Rooms'
                : `${activeCategory} Voice Parties`}
            </span>
            <span className="text-[10px] text-[#C084FC] font-semibold">
              {(activeCategory === 'Trending' ? filteredRooms.slice(2) : filteredRooms).length} active
            </span>
          </div>

          <div className="space-y-2.5">
            {(activeCategory === 'Trending' ? filteredRooms.slice(2) : filteredRooms).map((room) => {
              const filledSeats = room.seats.filter((s) => s.user !== null).length;

              return (
                <div
                  key={room.id}
                  onClick={() => openPartyRoom(room)}
                  className="p-3.5 rounded-2xl bg-[#140C26] border border-[#A855F7]/20 hover:border-[#A855F7]/50 shadow-lg cursor-pointer transform hover:-translate-y-0.5 transition-all"
                >
                  <div className="flex items-start justify-between mb-2.5">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <img
                          src={room.host.avatar}
                          alt={room.host.displayName}
                          className="w-11 h-11 rounded-2xl object-cover border border-[#A855F7]"
                        />
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#EC4899] flex items-center justify-center">
                          <Mic className="w-2.5 h-2.5 text-white" />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-sm font-bold text-white max-w-[170px] truncate">{room.title}</h3>
                          {room.countryFlag && <span className="text-xs">{room.countryFlag}</span>}
                        </div>
                        <p className="text-[11px] text-zinc-400 mt-0.5">Host: {room.host.displayName}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#1F1238] border border-white/5 text-[10px] text-zinc-300 font-semibold">
                      <Users className="w-3 h-3 text-[#A855F7]" />
                      <span>{room.activeViewers}</span>
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

                      {/* Gift Coin stats pill */}
                      {room.totalGiftCoins ? (
                        <div className="flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-amber-400/10 text-amber-300 text-[8.5px] font-bold">
                          <span>🎁</span>
                          <span>{room.totalGiftCoins > 999 ? `${(room.totalGiftCoins / 1000).toFixed(1)}k` : room.totalGiftCoins}</span>
                        </div>
                      ) : null}

                      <div className="flex items-center -space-x-2">
                        {room.seats
                          .filter((s) => s.user !== null)
                          .slice(0, 4)
                          .map((seat, i) => (
                            <img
                              key={i}
                              src={seat.user!.avatar}
                              alt="Guest"
                              className="w-5 h-5 rounded-full object-cover border-2 border-[#140C26]"
                            />
                          ))}
                        {filledSeats > 4 && (
                          <div className="w-5 h-5 rounded-full bg-zinc-800 text-[8.5px] font-bold text-white flex items-center justify-center border-2 border-[#140C26]">
                            +{filledSeats - 4}
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
        </div>
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
                                {tier.subLabel && (
                                  <span className="text-[10px] text-zinc-400 font-medium">
                                    ({tier.subLabel})
                                  </span>
                                )}
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

      {/* Party Leaderboard Modal (Discovery Hub) */}
      <PartyLeaderboardModal
        isOpen={showLeaderboardModal}
        onClose={() => setShowLeaderboardModal(false)}
        currentUser={currentUser}
        sessionGivers={partyGivers}
        dailyTopGivers={dailyTopGivers}
        topHosts={topPartyHosts}
        activeRoomTitle="Global Voice Parties"
        onSelectUser={(targetUser) => {
          setShowLeaderboardModal(false);
          setSelectedUserForActionSheet(targetUser);
          setShowUserActionSheet(true);
        }}
        onOpenGiftDrawer={() => {
          setShowLeaderboardModal(false);
          if (filteredRooms[0]) {
            openPartyRoom(filteredRooms[0]);
            setShowGiftDrawer(true);
          }
        }}
      />
    </div>
  );
};
