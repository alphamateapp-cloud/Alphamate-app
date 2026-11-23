import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { PullToRefresh, RefreshScopeButton } from '../components/common/PullToRefresh';
import { NetworkLatencyMonitor } from '../components/common/NetworkLatencyMonitor';
import { PartyRoom, PartySeat, User, Gift } from '../types';
import { agoraPartyEngine } from '../services/agoraPartyEngine';
import type { PartyParticipantPresence } from '../services/webrtcService';
import {
  auth,
  db,
  updatePartyRoomFields,
  togglePartySeatLockInFirestore,
  getCanonicalPartyRoomId,
} from '../services/firebase';
import { deleteDoc, doc, updateDoc } from 'firebase/firestore';
import {
  PartyRoomAtmosphere,
  PartyBackgroundTheme,
  PARTY_BACKGROUND_CATALOG,
  isValidPartyBackgroundTheme,
} from '../components/party/PartyRoomAtmosphere';
import {
  AnimatedSeatThemeFrame,
  AnimatedEmptySeatSofa,
  PartySeatThemeStarSelector,
  PartySeatThemeId,
  PARTY_SEAT_THEMES,
  isValidPartySeatTheme,
} from '../components/party/AnimatedSeatThemeFrame';
import { PartyRemoteAudioPlayer } from '../components/party/PartyRemoteAudioPlayer';
import { PartyMusicVinylWidget } from '../components/party/PartyMusicVinylWidget';
import { SharePartyModal } from '../components/party/SharePartyModal';
import { VoiceModulationModal } from '../components/party/VoiceModulationModal';
import { buildPartyRoomDeepLink } from '../utils/partyDeepLink';
import { sendLiveHeart, subscribeToLiveHeartCount, subscribeToLiveHeartEvents } from '../services/liveHeartService';
import { VipAvatarFrame } from '../components/brand/VipAvatarFrame';
import { LevelBadgeIcon } from '../components/brand/LevelBadgeIcon';
import { VIRTUAL_GIFTS } from '../data/mockData';
import { copyToClipboard } from '../utils/clipboard';
import { uploadPartyRoomCover } from '../services/chatService';
import { sendPartyRoomMessage, subscribeToPartyRoomMessages } from '../services/partyChatService';
import { realtimeSocket, RealtimeViewerProfile } from '../services/realtimeSocket';
import { DEFAULT_AVATAR_URL, getHdImageUrl, safeImageSrc } from '../utils/imageHd';
import { audioManager } from '../services/audioManager';
import {
  audioFilter,
  VoiceFilterPresetId,
} from '../services/audioFilter';
import { GiftAnimationOverlay, ActiveGiftEvent } from '../components/live/GiftAnimationOverlay';
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
  LogOut,
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
  Wand2,
} from 'lucide-react';
import { UserActionSheetModal } from '../components/live/UserActionSheetModal';
import { RoomViewersModal } from '../components/live/RoomViewersModal';
import { PartyLeaderboardModal, PartyLeaderboardEntry } from '../components/party/PartyLeaderboardModal';
import { PartyHostAnalyticsCard, PartySessionSample } from '../components/party/PartyHostAnalyticsCard';
import {
  VipEntryBannerOverlay,
  VipEntryEvent,
  VIP_ENTRY_MIN_TIER,
} from '../components/party/VipEntryBannerOverlay';
import { RoomPKInviteModal, OpponentRoomCandidate } from '../components/party/RoomPKInviteModal';
import { RoomPKIncomingModal } from '../components/party/RoomPKIncomingModal';
import { RoomPKSplitStage } from '../components/party/RoomPKSplitStage';
import { RoomPKVictoryModal } from '../components/party/RoomPKVictoryModal';
import { enqueueByPriority } from '../services/giftAnimationEngine';

interface FloatingHeart {
  id: number;
  x: number;
  y: number;
  color: string;
}

interface ChatItem {
  id: string;
  sender: {
    id?: string;
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

export const VIP_GUEST_SEAT_INDEX = 100;

export function getNormalSeatCountForLevel(level: number): number {
  if (level === 1) return 4;
  if (level === 2) return 8;
  if (level === 3) return 12;
  return 16;
}

export interface PartyTierSetting {
  level: 1 | 2 | 3 | 4;
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
    name: 'Level 1 • 4 Seats',
    subLabel: 'Host + VIP 1 + 4 Seats',
    hostCount: 1,
    guestCount: 4,
    totalSeats: 6,
    requiredLevel: 0,
    badge: 'FREE (Lv. 0)',
    tagline: 'All Users Free • Acoustic & Casual Chill Lounge',
    icon: '🎙️',
    accentColor: '#A855F7',
  },
  {
    level: 2,
    name: 'Level 2 • 8 Seats',
    subLabel: 'Host + VIP 1 + 8 Seats',
    hostCount: 1,
    guestCount: 8,
    totalSeats: 10,
    requiredLevel: 10,
    badge: 'Unlocks at Lv. 10',
    tagline: 'Popular Audio Club • 8 Live Guest Seats',
    icon: '🔥',
    accentColor: '#EC4899',
  },
  {
    level: 3,
    name: 'Level 3 • 12 Seats',
    subLabel: 'Host + VIP 1 + 12 Seats',
    hostCount: 1,
    guestCount: 12,
    totalSeats: 14,
    requiredLevel: 20,
    badge: 'Unlocks at Lv. 20',
    tagline: 'Premium Party Stage • 12 Live Guest Seats',
    icon: '💎',
    accentColor: '#38BDF8',
  },
  {
    level: 4,
    name: 'Level 4 • 16 Seats',
    subLabel: 'Host + VIP 1 + 16 Seats',
    hostCount: 1,
    guestCount: 16,
    totalSeats: 18,
    requiredLevel: 25,
    badge: 'Unlocks at Lv. 25',
    tagline: 'Grand Royal Festival Stage • 16 Live Guest Seats',
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
    setUserSeatIndex,
    isMicMuted,
    setIsMicMuted,
    currentUser,
    firebaseUser,
    loginWithFirebaseGoogle,
    sendLiveGift,
    publishedCatalogGifts,
    coins,
    setCurrentScreen,
    activeGiftBanner,
    clearActiveGiftBanner,
    startDirectMessage,
    openPublicUserProfile,
    sendNotificationToUser,
    refreshScope,
    partyRefreshTick,
    adminModerationState,
    setActiveFeatureRestrictionModal,
  } = useApp();

  // Party Level: 1 = 4 normal seats, 2 = 8 normal seats, 3 = 12 normal seats, 4 = 16 normal seats
  const [partyLevel, setPartyLevel] = useState<1 | 2 | 3 | 4>(
    (activePartyRoom?.level as 1 | 2 | 3 | 4) || 2
  );

  // Active Chat Filter Tab: ALL | ROOM | HOST | SYSTEM
  const [chatTab, setChatTab] = useState<'ALL' | 'ROOM' | 'HOST' | 'SYSTEM'>('ALL');
  const [inputChat, setInputChat] = useState('');
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isFollowingHost, setIsFollowingHost] = useState(false);
  const [isHostMicMuted, setIsHostMicMuted] = useState(false);
  const [isHostSpeaking, setIsHostSpeaking] = useState(false);
  const [isSelfSpeaking, setIsSelfSpeaking] = useState(false);
  const [partyAudioAutoplayBlocked, setPartyAudioAutoplayBlocked] = useState(false);
  const [partyVoiceError, setPartyVoiceError] = useState<string | null>(null);
  const [partyVoiceReconnecting, setPartyVoiceReconnecting] = useState<string | null>(null);
  const [partyVoiceRetryToken, setPartyVoiceRetryToken] = useState(0);
  const [remotePartyStreams, setRemotePartyStreams] = useState<Array<{ peerId: string; stream: MediaStream }>>([]);
  const [activeVoiceParticipants, setActiveVoiceParticipants] = useState<PartyParticipantPresence[]>([]);
  const [wsPartyViewers, setWsPartyViewers] = useState<RealtimeViewerProfile[]>([]);
  const [remoteSpeakingPeerIds, setRemoteSpeakingPeerIds] = useState<Set<string>>(new Set());
  const [joinNotification, setJoinNotification] = useState<{ id: string; name: string } | null>(null);
  const partyAudioElsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const roomSeenInListRef = useRef<boolean>(false);
  const isSpeakerOnRef = useRef<boolean>(isSpeakerOn);
  const isHostMicMutedRef = useRef<boolean>(isHostMicMuted);
  const isMicMutedRef = useRef<boolean>(isMicMuted);
  const userSeatIndexRef = useRef<number | null>(userSeatIndex);
  const wasHostMutedRef = useRef<boolean>(false);
  const voiceHasConnectedRef = useRef<boolean>(false);
  const voiceParticipantsLoadedRef = useRef<boolean>(false);
  const startupAutoRetryKeyRef = useRef<string>('');
  const startupAutoRetryCountRef = useRef<number>(0);
  const startupRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voiceReconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voiceReconnectAttemptRef = useRef<number>(0);
  const initialParticipantsSeededRef = useRef<boolean>(false);
  const notifiedJoinTimestampsRef = useRef<Map<string, number>>(new Map());
  const joinNotificationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSyncedViewerCountRef = useRef<number>(-1);
  const lastSelfSpeakingSyncedRef = useRef<boolean>(false);
  const partyRoomRootRef = useRef<HTMLDivElement>(null);
  const lastHandledPartyRefreshTickRef = useRef<number>(partyRefreshTick);
  const lastVoiceRoomIdRef = useRef<string | null>(null);

  // Music Player State
  const [isMusicPlaying, setIsMusicPlaying] = useState(true);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [showMusicModal, setShowMusicModal] = useState(false);

  // Modals & Drawers
  const [showGiftDrawer, setShowGiftDrawer] = useState(false);
  const [selectedGift, setSelectedGift] = useState<Gift>(() => publishedCatalogGifts[0] || VIRTUAL_GIFTS[0]);
  const [giftRecipientUser, setGiftRecipientUser] = useState<User | null>(null);
  const [showMoreModal, setShowMoreModal] = useState(false);
  const [showSeatActionModal, setShowSeatActionModal] = useState<number | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showExitConfirmModal, setShowExitConfirmModal] = useState(false);
  const [showGuestExitModal, setShowGuestExitModal] = useState(false);
  const [roomBackground, setRoomBackground] = useState<PartyBackgroundTheme>(() => {
    try {
      const saved = window.localStorage.getItem('alphamate_party_bg_theme');
      if (isValidPartyBackgroundTheme(saved)) {
        return saved;
      }
    } catch {
      // Ignore storage access failures in restricted environments
    }
    return 'royal_castle';
  });
  const [seatTheme, setSeatTheme] = useState<PartySeatThemeId>(() => {
    try {
      const saved = window.localStorage.getItem('alphamate_party_seat_theme');
      if (isValidPartySeatTheme(saved)) {
        return saved;
      }
    } catch {
      // Ignore storage access failures in restricted environments
    }
    return 'royal_gold_diya';
  });
  const [showBackgroundModal, setShowBackgroundModal] = useState(false);
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
  const [showHostAnalyticsCard, setShowHostAnalyticsCard] = useState(false);
  const [sessionPeakViewers, setSessionPeakViewers] = useState(0);
  const [sessionAnalyticsSamples, setSessionAnalyticsSamples] = useState<PartySessionSample[]>([]);
  const sessionMetricsRef = useRef({
    viewers: 0,
    peakViewers: 0,
    giftCoins: 0,
    hearts: 0,
  });
  const lastSampleRecordedAtRef = useRef<number>(0);
  const [showVoiceFilterModal, setShowVoiceFilterModal] = useState(false);
  const [activeVoiceFilter, setActiveVoiceFilter] = useState<VoiceFilterPresetId>(() =>
    audioFilter.getPreset()
  );
  const [partyGivers, setPartyGivers] = useState<PartyLeaderboardEntry[]>([]);
  const [activePartyGiftAnimation, setActivePartyGiftAnimation] = useState<ActiveGiftEvent | null>(null);
  const partyGiftQueueRef = useRef<ActiveGiftEvent[]>([]);
  const [activeVipEntry, setActiveVipEntry] = useState<VipEntryEvent | null>(null);
  const vipEntryQueueRef = useRef<VipEntryEvent[]>([]);
  const vipEntryNotifiedRef = useRef<Map<string, number>>(new Map());
  const wsViewersSeededRef = useRef<boolean>(false);
  const partyJoinedAtRef = useRef<number>(Date.now());
  const seenPartyBannerIdsRef = useRef<Set<string>>(new Set());

  const enqueueVipEntry = useCallback(
    (incoming: VipEntryEvent, options?: { bypassCooldown?: boolean }) => {
      if (Number(incoming.vipTier || 0) < VIP_ENTRY_MIN_TIER) return;
      const now = Date.now();
      if (!options?.bypassCooldown) {
        const lastSeen = vipEntryNotifiedRef.current.get(incoming.userId);
        if (lastSeen && now - lastSeen < 25_000) {
          return;
        }
        vipEntryNotifiedRef.current.set(incoming.userId, now);
      }

      setActiveVipEntry((current) => {
        if (!current) return incoming;
        if (current.userId === incoming.userId && !options?.bypassCooldown) {
          return current;
        }
        const alreadyQueued =
          !options?.bypassCooldown &&
          vipEntryQueueRef.current.some((item) => item.userId === incoming.userId);
        if (alreadyQueued) return current;

        const nextQueue = [...vipEntryQueueRef.current, incoming].sort(
          (a, b) => b.vipTier - a.vipTier || a.timestamp - b.timestamp
        );
        vipEntryQueueRef.current = nextQueue.slice(0, 10);
        return current;
      });
    },
    []
  );

  const handleVipEntryComplete = useCallback((completedId: string) => {
    setActiveVipEntry((current) => {
      if (current && current.id !== completedId) return current;
      return vipEntryQueueRef.current.shift() || null;
    });
  }, []);

  const enqueuePartyGiftAnimation = useCallback((incoming: ActiveGiftEvent) => {
    setActivePartyGiftAnimation((current) => {
      if (!current) return incoming;
      partyGiftQueueRef.current = enqueueByPriority(partyGiftQueueRef.current, incoming);
      return current;
    });
  }, []);

  const handlePartyGiftOverlayComplete = useCallback(() => {
    const nextQueued = partyGiftQueueRef.current.shift() || null;
    setActivePartyGiftAnimation(nextQueued);
  }, []);

  useEffect(() => {
    return audioFilter.subscribe(setActiveVoiceFilter);
  }, []);

  // Parent-side wall-clock fail-safe: ensures Android WebView timer throttling never leaves a gift stuck
  // while NEVER cutting off a full-duration advanced gift video (e.g. 10s WebM/MOV/MP4) early.
  useEffect(() => {
    if (!activePartyGiftAnimation) return;
    const coins = Number(
      activePartyGiftAnimation.gift?.costInCoins ?? activePartyGiftAnimation.gift?.coins ?? 0
    );
    const advConfig = activePartyGiftAnimation.gift?.advancedConfig;
    const advDurationMs = advConfig?.durationMs || 0;
    const analysisDurationMs =
      advConfig?.analysis?.durationSec && Number.isFinite(advConfig.analysis.durationSec)
        ? Math.ceil(advConfig.analysis.durationSec * 1000)
        : 0;
    const playbackSpeed = Math.min(2, Math.max(0.5, advConfig?.playbackSpeed ?? 1));
    const effectiveAdvMs = Math.max(advDurationMs, analysisDurationMs);
    const maxMs = effectiveAdvMs > 0
      ? Math.min(72_000, Math.ceil(effectiveAdvMs / playbackSpeed) + 7000)
      : coins <= 100
      ? 3000
      : 8000;
    const startedAt = Date.now();
    const eventId = activePartyGiftAnimation.id;
    let cleared = false;

    const clearIfExpired = (force = false) => {
      if (cleared) return;
      if (force || Date.now() - startedAt >= maxMs) {
        cleared = true;
        const nextQueued = partyGiftQueueRef.current.shift() || null;
        setActivePartyGiftAnimation((prev) => (prev?.id === eventId ? nextQueued : prev));
      }
    };

    const failSafeTimeout = setTimeout(() => clearIfExpired(true), maxMs);
    const failSafePoll = setInterval(() => clearIfExpired(false), 500);
    const onResume = () => clearIfExpired(false);

    window.addEventListener('focus', onResume);
    window.addEventListener('pageshow', onResume);
    document.addEventListener('visibilitychange', onResume);

    return () => {
      cleared = true;
      clearTimeout(failSafeTimeout);
      clearInterval(failSafePoll);
      window.removeEventListener('focus', onResume);
      window.removeEventListener('pageshow', onResume);
      document.removeEventListener('visibilitychange', onResume);
    };
  }, [activePartyGiftAnimation?.id]);

  // Reset party gift overlay, chat, hearts, PK & givers whenever entering, switching sessions, or leaving a Party Room
  useEffect(() => {
    partyJoinedAtRef.current = Date.now();
    seenPartyBannerIdsRef.current.clear();
    lastSyncedViewerCountRef.current = -1;
    setActivePartyGiftAnimation(null);
    setActiveVipEntry(null);
    vipEntryQueueRef.current = [];
    vipEntryNotifiedRef.current.clear();
    wsViewersSeededRef.current = false;
    clearActiveGiftBanner();
    setChatItems([]);
    setPartyGivers([]);
    setShowHostAnalyticsCard(false);
    setSessionPeakViewers(0);
    setSessionAnalyticsSamples([]);
    sessionMetricsRef.current = { viewers: 0, peakViewers: 0, giftCoins: 0, hearts: 0 };
    lastSampleRecordedAtRef.current = 0;
    setTotalHeartCount(0);
    setHearts([]);
    setIsRoomPKActive(false);
    setShowRoomPKVictoryModal(false);
    setShowRoomPKInviteModal(false);
    setShowRoomPKIncomingModal(false);
    setActivePKChallenger(null);
    setRoomPKTimeLeft(300);
    setLeftRoomPKScore(0);
    setRightRoomPKScore(0);
    audioManager.stopAll();
    return () => {
      setActivePartyGiftAnimation(null);
      clearActiveGiftBanner();
      audioManager.stopAll();
    };
  }, [activePartyRoom?.id, activePartyRoom?.sessionId, clearActiveGiftBanner]);

  // Consume external party gift banners ONLY if strictly scoped to this activePartyRoom.id
  useEffect(() => {
    if (!activeGiftBanner) return;
    const now = Date.now();
    const isCurrentRoomBanner =
      activeGiftBanner.context === 'party' &&
      Boolean(activePartyRoom?.id) &&
      activeGiftBanner.roomId === activePartyRoom?.id &&
      activeGiftBanner.createdAtMs >= partyJoinedAtRef.current - 500 &&
      now - activeGiftBanner.createdAtMs < 3500 &&
      !seenPartyBannerIdsRef.current.has(activeGiftBanner.id);

    if (isCurrentRoomBanner && activePartyRoom?.id) {
      seenPartyBannerIdsRef.current.add(activeGiftBanner.id);
      enqueuePartyGiftAnimation({
        id: `party_ext_gift_${activeGiftBanner.id}`,
        gift: activeGiftBanner.gift,
        senderName: activeGiftBanner.sender,
        senderAvatar: activeGiftBanner.senderAvatar,
        senderVipTier: activeGiftBanner.senderVipTier || 1,
        recipientName: activeGiftBanner.recipient,
        comboCount: 1,
        quantity: activeGiftBanner.quantity || 1,
        timestamp: activeGiftBanner.createdAtMs,
        roomId: activePartyRoom.id,
      });
    }
    clearActiveGiftBanner();
  }, [activeGiftBanner, activePartyRoom?.id, clearActiveGiftBanner]);

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
  const [totalHeartCount, setTotalHeartCount] = useState(0);
  const [activeViewers, setActiveViewers] = useState(activePartyRoom?.activeViewers || 0);
  const [speakingGuestIndex, setSpeakingGuestIndex] = useState<number>(0);

  // Discovery / Hub state (when not in a room)
  const [activeCategory, setActiveCategory] = useState<'All' | 'Trending' | 'Global' | 'Pakistan' | 'UAE' | 'Saudi Arabia'>('Trending');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoomTitle, setNewRoomTitle] = useState('Chill & Acoustic Lounge 💜');
  const [newRoomCover, setNewRoomCover] = useState<string>('');
  const [isUploadingRoomCover, setIsUploadingRoomCover] = useState(false);
  const roomCoverInputRef = useRef<HTMLInputElement>(null);
  const [createRoomLevel, setCreateRoomLevel] = useState<1 | 2 | 3 | 4>(
    currentUser.level >= 25 ? 4 : currentUser.level >= 20 ? 3 : currentUser.level >= 10 ? 2 : 1
  );
  const [createCategory, setCreateCategory] = useState<'Music' | 'Chat' | 'Singing' | 'Gaming' | 'Dating'>('Music');
  const [createRoomError, setCreateRoomError] = useState<string | null>(null);
  const [isLaunchingRoom, setIsLaunchingRoom] = useState<boolean>(false);
  const [isSigningInToHost, setIsSigningInToHost] = useState<boolean>(false);
  const lastVoiceModeRef = useRef<{ key: string; canSpeak: boolean; muted: boolean } | null>(null);

  // Keep partyLevel synchronized with activePartyRoom and auto-reset launch modal when room opens
  useEffect(() => {
    if (activePartyRoom?.level) {
      setPartyLevel(activePartyRoom.level as 1 | 2 | 3 | 4);
    }
    if (activePartyRoom?.id) {
      setIsLaunchingRoom(false);
      setShowCreateModal(false);
      setCreateRoomError(null);
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

    return () => {
      clearInterval(timer);
    };
  }, [isRoomPKActive]);

  const commentsEndRef = useRef<HTMLDivElement>(null);
  const lastTapRef = useRef<number>(0);
  const lastHeartSentAtRef = useRef<number>(0);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleOpenRoomPK = () => {
    if (!canModerate) {
      showToast('Only Host & Moderators can start Room PK 🔒');
      return;
    }
    if (partyLevel >= 3) {
      showToast('Room PK is only allowed in 4-Seat and 8-Seat rooms! (12/16-Seat not supported) ⚠️');
      return;
    }
    if (isRoomPKActive) {
      showToast('Room PK is already in progress! ⚔️');
      return;
    }
    setShowRoomPKInviteModal(true);
  };

  const effectiveUserId = auth.currentUser?.uid || currentUser.id;
  const isHost = activePartyRoom ? activePartyRoom.host.id === effectiveUserId : false;
  const isModerator = moderatorIds.includes(effectiveUserId);
  const canModerate = isHost || isModerator;
  const canUseSpeakerMic = isHost || userSeatIndex !== null;
  const hostLevel = activePartyRoom?.host.level ?? currentUser.level;

  // Hydrate room-wide synced Seat Theme, Background Theme, and Music state from Firestore
  // so viewers & guests always see the Host/Moderator's live selections.
  useEffect(() => {
    if (!activePartyRoom?.id) return;
    if (isValidPartySeatTheme(activePartyRoom.seatTheme)) {
      setSeatTheme(activePartyRoom.seatTheme);
    } else {
      setSeatTheme('royal_gold_diya');
    }
    if (isValidPartyBackgroundTheme(activePartyRoom.backgroundTheme)) {
      setRoomBackground(activePartyRoom.backgroundTheme);
    } else {
      setRoomBackground('royal_castle');
    }
    if (typeof activePartyRoom.isMusicPlaying === 'boolean') {
      setIsMusicPlaying(activePartyRoom.isMusicPlaying);
    }
    if (
      typeof activePartyRoom.musicTrackIndex === 'number' &&
      Number.isFinite(activePartyRoom.musicTrackIndex) &&
      activePartyRoom.musicTrackIndex >= 0 &&
      activePartyRoom.musicTrackIndex < PLAYLIST_TRACKS.length
    ) {
      setCurrentTrackIndex(Math.floor(activePartyRoom.musicTrackIndex));
    }
  }, [
    activePartyRoom?.id,
    activePartyRoom?.seatTheme,
    activePartyRoom?.backgroundTheme,
    activePartyRoom?.isMusicPlaying,
    activePartyRoom?.musicTrackIndex,
  ]);

  // Immediately close privileged modals if user is demoted or steps off a seat
  useEffect(() => {
    if (!canModerate) {
      setShowMusicModal(false);
      setShowBackgroundModal(false);
      setShowMoreModal(false);
      setShowHostAnalyticsCard(false);
    }
  }, [canModerate]);

  useEffect(() => {
    if (!canUseSpeakerMic) {
      setShowVoiceFilterModal(false);
    }
  }, [canUseSpeakerMic]);

  const handleSelectSeatTheme = useCallback(
    (nextTheme: PartySeatThemeId) => {
      if (!canModerate || !activePartyRoom?.id) {
        showToast('Only Host & Moderators can change seat themes 🔒');
        return;
      }
      setSeatTheme(nextTheme);
      try {
        window.localStorage.setItem('alphamate_party_seat_theme', nextTheme);
      } catch {
        // Ignore storage access failures
      }
      updatePartyRoomFields(activePartyRoom.id, { seatTheme: nextTheme }).catch(() => {});
      const meta = PARTY_SEAT_THEMES.find((t) => t.id === nextTheme);
      if (meta) {
        showToast(`Seat Theme: ${meta.name} ⭐`);
      }
    },
    [canModerate, activePartyRoom?.id]
  );

  const handleSelectBackgroundTheme = useCallback(
    (bgId: PartyBackgroundTheme, bgName: string) => {
      if (!canModerate || !activePartyRoom?.id) {
        showToast('Only Host & Moderators can change room themes 🔒');
        return;
      }
      setRoomBackground(bgId);
      try {
        window.localStorage.setItem('alphamate_party_bg_theme', bgId);
      } catch {
        // Ignore storage errors
      }
      updatePartyRoomFields(activePartyRoom.id, { backgroundTheme: bgId }).catch(() => {});
      showToast(`Theme applied: ${bgName}`);
      setShowBackgroundModal(false);
    },
    [canModerate, activePartyRoom?.id]
  );

  const handleToggleRoomMusic = useCallback(() => {
    if (!canModerate || !activePartyRoom?.id) {
      showToast('Only Host & Moderators can control room music 🔒');
      return;
    }
    const nextPlaying = !isMusicPlaying;
    const track = PLAYLIST_TRACKS[currentTrackIndex] || PLAYLIST_TRACKS[0];
    setIsMusicPlaying(nextPlaying);
    updatePartyRoomFields(activePartyRoom.id, {
      isMusicPlaying: nextPlaying,
      musicTrackIndex: currentTrackIndex,
      nowPlaying: nextPlaying && track ? `${track.title} — ${track.artist}` : '',
    }).catch(() => {});
  }, [canModerate, activePartyRoom?.id, isMusicPlaying, currentTrackIndex]);

  const handleSelectMusicTrack = useCallback(
    (idx: number) => {
      if (!canModerate || !activePartyRoom?.id) {
        showToast('Only Host & Moderators can change room music 🔒');
        return;
      }
      const track = PLAYLIST_TRACKS[idx];
      if (!track) return;
      setCurrentTrackIndex(idx);
      setIsMusicPlaying(true);
      updatePartyRoomFields(activePartyRoom.id, {
        isMusicPlaying: true,
        musicTrackIndex: idx,
        nowPlaying: `${track.title} — ${track.artist}`,
      }).catch(() => {});
      showToast(`Playing: ${track.title} 🎶`);
    },
    [canModerate, activePartyRoom?.id]
  );

  useEffect(() => {
    isSpeakerOnRef.current = isSpeakerOn;
  }, [isSpeakerOn]);

  useEffect(() => {
    isHostMicMutedRef.current = isHostMicMuted;
  }, [isHostMicMuted]);

  useEffect(() => {
    isMicMutedRef.current = isMicMuted;
  }, [isMicMuted]);

  useEffect(() => {
    userSeatIndexRef.current = userSeatIndex;
  }, [userSeatIndex]);

  // Track live session peak viewers and record calm analytics samples on meaningful metric changes
  useEffect(() => {
    if (!activePartyRoom?.id) return;
    const viewers = Math.max(0, Number(activeViewers) || 0);
    const giftCoins = Math.max(0, Number(activePartyRoom.totalGiftCoins) || 0);
    const heartsCount = Math.max(0, Number(totalHeartCount) || 0);
    const nextPeak = Math.max(sessionMetricsRef.current.peakViewers, viewers);

    const viewersChanged = viewers !== sessionMetricsRef.current.viewers;
    const giftsChanged = giftCoins !== sessionMetricsRef.current.giftCoins;

    sessionMetricsRef.current = {
      viewers,
      peakViewers: nextPeak,
      giftCoins,
      hearts: heartsCount,
    };

    setSessionPeakViewers((prev) => (nextPeak > prev ? nextPeak : prev));

    const now = Date.now();
    const retentionPct =
      nextPeak > 0 ? Math.min(100, Math.round((viewers / nextPeak) * 100)) : viewers > 0 ? 100 : 0;

    if (
      lastSampleRecordedAtRef.current === 0 ||
      ((viewersChanged || giftsChanged) && now - lastSampleRecordedAtRef.current >= 3000)
    ) {
      lastSampleRecordedAtRef.current = now;
      setSessionAnalyticsSamples((prev) => {
        const next: PartySessionSample[] = [
          ...prev,
          {
            timestampMs: now,
            viewers,
            retentionPct,
            giftCoins,
            hearts: heartsCount,
          },
        ];
        return next.length > 24 ? next.slice(next.length - 24) : next;
      });
    }
  }, [activePartyRoom?.id, activePartyRoom?.sessionId, activePartyRoom?.totalGiftCoins, activeViewers, totalHeartCount]);

  // Periodic 15-second trend sampler for Host Session Insights (calm updates, no 1s flicker)
  useEffect(() => {
    if (!activePartyRoom?.id || !isHost) return;
    const interval = window.setInterval(() => {
      const now = Date.now();
      const { viewers, peakViewers, giftCoins, hearts: heartsCount } = sessionMetricsRef.current;
      const safePeak = Math.max(peakViewers, viewers);
      const retentionPct =
        safePeak > 0 ? Math.min(100, Math.round((viewers / safePeak) * 100)) : viewers > 0 ? 100 : 0;
      lastSampleRecordedAtRef.current = now;
      setSessionAnalyticsSamples((prev) => {
        const next: PartySessionSample[] = [
          ...prev,
          {
            timestampMs: now,
            viewers,
            retentionPct,
            giftCoins,
            hearts: heartsCount,
          },
        ];
        return next.length > 24 ? next.slice(next.length - 24) : next;
      });
    }, 15000);
    return () => window.clearInterval(interval);
  }, [activePartyRoom?.id, activePartyRoom?.sessionId, isHost]);

  // Keep moderation lists synchronized from Firestore snapshot in real time
  useEffect(() => {
    if (!activePartyRoom) {
      setModeratorIds([]);
      setKickedUserIds([]);
      setBlockedUserIds([]);
      return;
    }
    setModeratorIds(Array.isArray(activePartyRoom.moderatorIds) ? activePartyRoom.moderatorIds : []);
    setKickedUserIds(Array.isArray(activePartyRoom.kickedUserIds) ? activePartyRoom.kickedUserIds : []);
    setBlockedUserIds(Array.isArray(activePartyRoom.blockedUserIds) ? activePartyRoom.blockedUserIds : []);
  }, [
    activePartyRoom?.id,
    activePartyRoom?.moderatorIds,
    activePartyRoom?.kickedUserIds,
    activePartyRoom?.blockedUserIds,
  ]);

  // Check if current user is blocked or kicked
  useEffect(() => {
    if (!activePartyRoom) return;
    if (blockedUserIds.includes(effectiveUserId)) {
      showToast('You are blocked from this room by the host! ⛔');
      closePartyRoom(false);
    } else if (kickedUserIds.includes(effectiveUserId)) {
      showToast('You have been kicked from this session! 🚫');
      closePartyRoom(false);
    }
  }, [activePartyRoom?.id, blockedUserIds, kickedUserIds, effectiveUserId]);

  // Auto-exit remote guests if Host permanently closes this lounge
  useEffect(() => {
    if (!activePartyRoom?.id) {
      roomSeenInListRef.current = false;
      return;
    }
    const roomStillExists = partyRooms.some((r) => r.id === activePartyRoom.id);
    if (roomStillExists) {
      roomSeenInListRef.current = true;
      return;
    }
    const isCurrentHost = activePartyRoom.host?.id === effectiveUserId;
    if (!isCurrentHost && roomSeenInListRef.current) {
      showToast('The Host has closed this lounge! 🚪');
      closePartyRoom(false);
    }
  }, [partyRooms, activePartyRoom?.id, effectiveUserId]);

  const handleTryCreatePartyRoom = () => {
    if (adminModerationState.isPartyRestricted && adminModerationState.partyRestriction) {
      setActiveFeatureRestrictionModal({
        scope: 'party',
        detail: adminModerationState.partyRestriction,
      });
      return;
    }
    const uid = auth.currentUser?.uid || currentUser.id;
    const existingMyRoom = partyRooms.find(
      (r) => r.isActive !== false && r.host?.id === uid
    );
    if (existingMyRoom) {
      showToast('آپ کا پارٹی روم پہلے سے چل رہا ہے! آپ کو اسی روم میں لے جایا جا رہا ہے 🎙️');
      openPartyRoom(existingMyRoom);
      return;
    }
    setCreateRoomError(null);
    setShowCreateModal(true);
  };

  const handleExitClick = async () => {
    const isRoomHost = activePartyRoom?.host?.id === effectiveUserId;
    if (isRoomHost) {
      setShowExitConfirmModal(true);
    } else if (userSeatIndex !== null) {
      setShowGuestExitModal(true);
    } else {
      const remainingCount = Math.max(
        0,
        realViewersList.filter((u) => u.id !== effectiveUserId).length
      );
      closePartyRoom(false, { remainingViewers: remainingCount });
    }
  };

  // Moderation Action Handlers (persisted to Firestore for real-time enforcement across devices)
  const handleToggleModerator = async (targetUserId: string) => {
    if (!isHost || !activePartyRoom) {
      showToast('Only the room Host can assign moderators! 👑');
      return;
    }
    let nextMods: string[];
    const removing = moderatorIds.includes(targetUserId);
    if (removing) {
      nextMods = moderatorIds.filter((id) => id !== targetUserId);
    } else {
      if (moderatorIds.length >= 10) {
        showToast('Maximum 10 moderators limit reached! ⚠️');
        return;
      }
      nextMods = [...moderatorIds, targetUserId];
    }
    setModeratorIds(nextMods);
    await updatePartyRoomFields(activePartyRoom.id, { moderatorIds: nextMods }).catch(() => {});
    showToast(removing ? 'Removed as Moderator 🛡️' : 'Assigned as Room Moderator! 🛡️');
  };

  const handleKickUser = async (targetUserId: string, targetDisplayName: string) => {
    if (!canModerate || !activePartyRoom) return;
    if (targetUserId === activePartyRoom.host.id || targetDisplayName === activePartyRoom.host.displayName) {
      showToast('Cannot kick the room Host! 👑');
      return;
    }
    const nextKicked = Array.from(new Set([...kickedUserIds, targetUserId]));
    setKickedUserIds(nextKicked);

    const updatedSeats = (activePartyRoom.seats || []).map((s) =>
      s.user?.id === targetUserId || s.user?.displayName === targetDisplayName
        ? { ...s, user: null, isSpeaking: false, isMuted: false, isHostMuted: false }
        : s
    );

    await updatePartyRoomFields(activePartyRoom.id, {
      kickedUserIds: nextKicked,
      seats: updatedSeats,
    }).catch(() => {});
    await deleteDoc(doc(db, 'partyRooms', activePartyRoom.id, 'voiceParticipants', targetUserId)).catch(() => {});

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

  const handleBlockUser = async (targetUserId: string, targetDisplayName: string) => {
    if (!canModerate || !activePartyRoom) return;
    if (targetUserId === activePartyRoom.host.id || targetDisplayName === activePartyRoom.host.displayName) {
      showToast('Cannot block the room Host! 👑');
      return;
    }
    const nextBlocked = Array.from(new Set([...blockedUserIds, targetUserId]));
    const nextKicked = Array.from(new Set([...kickedUserIds, targetUserId]));
    setBlockedUserIds(nextBlocked);
    setKickedUserIds(nextKicked);

    const updatedSeats = (activePartyRoom.seats || []).map((s) =>
      s.user?.id === targetUserId || s.user?.displayName === targetDisplayName
        ? { ...s, user: null, isSpeaking: false, isMuted: false, isHostMuted: false }
        : s
    );

    await updatePartyRoomFields(activePartyRoom.id, {
      blockedUserIds: nextBlocked,
      kickedUserIds: nextKicked,
      seats: updatedSeats,
    }).catch(() => {});
    await deleteDoc(doc(db, 'partyRooms', activePartyRoom.id, 'voiceParticipants', targetUserId)).catch(() => {});

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

  const handleToggleSeatMicByHostOrMod = async (seatIndex: number) => {
    if (!canModerate || !activePartyRoom) return;
    const targetIdx = activePartyRoom.seats.findIndex((s) => Number(s.seatIndex) === seatIndex);
    if (targetIdx === -1) return;
    const seat = activePartyRoom.seats[targetIdx];
    if (!seat || !seat.user) return;
    if (seat.user.id === activePartyRoom.host.id) {
      showToast('Cannot mute the room Host! 👑');
      return;
    }
    const nextMuted = !seat.isMuted;
    const updatedSeats = activePartyRoom.seats.map((s) =>
      Number(s.seatIndex) === seatIndex
        ? {
            ...s,
            isMuted: nextMuted,
            isHostMuted: nextMuted,
            isSpeaking: nextMuted ? false : s.isSpeaking,
          }
        : s
    );
    await updatePartyRoomFields(activePartyRoom.id, { seats: updatedSeats }).catch(() => {});
    await updateDoc(doc(db, 'partyRooms', activePartyRoom.id, 'voiceParticipants', seat.user.id), {
      isMuted: nextMuted,
    }).catch(() => {});

    showToast(
      nextMuted
        ? `Muted & locked ${seat.user.displayName}'s mic! 🔒🔇`
        : `Unmuted ${seat.user.displayName}'s mic! 🎙️`
    );
  };

  const handleRemoveGuestFromSeat = async (seatIndex: number, targetUser: User) => {
    if (!canModerate || !activePartyRoom) return;
    if (
      targetUser.id === activePartyRoom.host.id ||
      targetUser.displayName === activePartyRoom.host.displayName
    ) {
      showToast('Cannot remove the room Host! 👑');
      return;
    }
    const updatedSeats = (activePartyRoom.seats || []).map((s) =>
      Number(s.seatIndex) === seatIndex || s.user?.id === targetUser.id
        ? { ...s, user: null, isSpeaking: false, isMuted: false, isHostMuted: false }
        : s
    );
    await updatePartyRoomFields(activePartyRoom.id, { seats: updatedSeats }).catch(() => {});
    await deleteDoc(
      doc(db, 'partyRooms', activePartyRoom.id, 'voiceParticipants', targetUser.id)
    ).catch(() => {});

    const seatLabel = seatIndex === VIP_GUEST_SEAT_INDEX ? 'VIP 1' : `Seat #${seatIndex + 1}`;
    showToast(`Removed ${targetUser.displayName} from ${seatLabel}!`);
    setChatItems((prev) => [
      ...prev,
      {
        id: `sys_remseat_${Date.now()}`,
        sender: { displayName: 'System', avatar: '', isHost: false },
        text: `🪑 ${targetUser.displayName} was removed from ${seatLabel} by ${isHost ? 'Host' : 'Moderator'}.`,
        type: 'system',
      },
    ]);
  };

  const handleMuteAllGuests = async () => {
    if (!canModerate || !activePartyRoom) return;
    const guestIdsToMute = activePartyRoom.seats
      .filter((s) => s.user && s.user.id !== activePartyRoom.host.id)
      .map((s) => s.user!.id);
    const updatedSeats = activePartyRoom.seats.map((s) => {
      if (s.user && s.user.id !== activePartyRoom.host.id) {
        return { ...s, isMuted: true, isHostMuted: true, isSpeaking: false };
      }
      return s;
    });
    await updatePartyRoomFields(activePartyRoom.id, { seats: updatedSeats }).catch(() => {});
    await Promise.all(
      guestIdsToMute.map((uid) =>
        updateDoc(doc(db, 'partyRooms', activePartyRoom.id, 'voiceParticipants', uid), {
          isMuted: true,
          isSpeaking: false,
        }).catch(() => {})
      )
    );
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

  const handleUnmuteAllGuests = async () => {
    if (!canModerate || !activePartyRoom) return;
    const guestIdsToUnmute = activePartyRoom.seats
      .filter((s) => s.user && s.user.id !== activePartyRoom.host.id)
      .map((s) => s.user!.id);
    const updatedSeats = activePartyRoom.seats.map((s) => {
      if (s.user && s.user.id !== activePartyRoom.host.id) {
        return { ...s, isMuted: false, isHostMuted: false };
      }
      return s;
    });
    await updatePartyRoomFields(activePartyRoom.id, { seats: updatedSeats }).catch(() => {});
    await Promise.all(
      guestIdsToUnmute.map((uid) =>
        updateDoc(doc(db, 'partyRooms', activePartyRoom.id, 'voiceParticipants', uid), {
          isMuted: false,
        }).catch(() => {})
      )
    );
    showToast('All guest microphones unmuted! 🎙️');
  };

  const handleToggleSeatLock = async (seatIndex: number, shouldLock: boolean) => {
    if (!activePartyRoom) return;
    if (seatIndex === VIP_GUEST_SEAT_INDEX) {
      if (!isHost) {
        showToast('Only the Host can unlock or lock the VIP 1 seat! 👑');
        return;
      }
    } else if (!canModerate) {
      return;
    }
    const res = await togglePartySeatLockInFirestore(activePartyRoom.id, seatIndex, shouldLock);
    if (res.success) {
      const seatLabel = seatIndex === VIP_GUEST_SEAT_INDEX ? 'VIP 1 seat' : `Seat ${seatIndex + 1}`;
      showToast(shouldLock ? `${seatLabel} locked 🔒` : `${seatLabel} unlocked 🔓`);
    } else {
      showToast('Unable to update seat lock state.');
    }
  };

  // Host-only VIP 1 Guest assignment handler
  const handleAssignGuestToVipSeat = async (viewer: User) => {
    if (!activePartyRoom || !isHost) {
      showToast('Only the Host can assign a VIP Guest to VIP 1 👑');
      return;
    }
    if (viewer.id === activePartyRoom.host.id) {
      showToast('Host already occupies the Host throne! 👑');
      return;
    }
    const maxSeats = getNormalSeatCountForLevel(partyLevel);
    const existingSeats = Array.isArray(activePartyRoom.seats) ? activePartyRoom.seats : [];
    const normalizedSeats: PartySeat[] = Array.from({ length: maxSeats }, (_, idx) => {
      const found = existingSeats.find((s) => Number(s.seatIndex) === idx);
      const base: PartySeat = found
        ? { ...found }
        : {
            seatIndex: idx,
            user: null,
            isMuted: false,
            isHostMuted: false,
            isLocked: false,
            isSpeaking: false,
            receivedCoins: 0,
          };
      // Vacate any normal seat currently held by this viewer
      if (base.user?.id === viewer.id) {
        return { ...base, user: null, isMuted: false, isHostMuted: false, isSpeaking: false };
      }
      return base;
    });

    const existingVip = existingSeats.find((s) => Number(s.seatIndex) === VIP_GUEST_SEAT_INDEX);
    const assignedVipSeat: PartySeat = {
      seatIndex: VIP_GUEST_SEAT_INDEX,
      user: viewer,
      isMuted: false,
      isHostMuted: false,
      isLocked: false,
      isVipGuest: true,
      isSpeaking: false,
      receivedCoins: Number(existingVip?.receivedCoins) || 0,
    };

    const updatedSeats = [...normalizedSeats, assignedVipSeat];
    await updatePartyRoomFields(activePartyRoom.id, { seats: updatedSeats }).catch(() => {});
    if (viewer.id && viewer.id !== currentUser.id) {
      sendNotificationToUser({
        recipientId: viewer.id,
        type: 'party_invite',
        category: 'partyInvites',
        title: `👑 You were assigned to VIP 1 Seat!`,
        message: `${currentUser.displayName} invited you to the VIP 1 Guest Seat in "${activePartyRoom.title || 'Party Room'}".`,
        screen: 'party_room',
        roomId: activePartyRoom.id,
      }).catch(() => {});
    }
    setShowSeatActionModal(null);
    showToast(`Assigned ${viewer.displayName} to VIP 1! 👑`);
    setChatItems((prev) => [
      ...prev,
      {
        id: `sys_vipassign_${Date.now()}`,
        sender: { displayName: 'System', avatar: '', isHost: false },
        text: `👑 Host assigned ${viewer.displayName} to the VIP 1 Guest Seat!`,
        type: 'system',
      },
    ]);
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
    if (isNowFollowing && targetUser.id && targetUser.id !== currentUser.id) {
      sendNotificationToUser({
        recipientId: targetUser.id,
        type: 'follow',
        category: 'friendRequests',
        title: `⭐ ${currentUser.displayName} followed you!`,
        message: `${currentUser.displayName} followed you in Party Room.`,
        screen: 'party_room',
        roomId: activePartyRoom?.id,
      }).catch(() => {});
    }
    showToast(isNowFollowing ? `Following ${targetUser.displayName}! 💜` : `Unfollowed ${targetUser.displayName}`);
  };

  const handleInviteViewerToSeat = async (viewer: User) => {
    if (!activePartyRoom || !canModerate) return;
    const maxSeats = getNormalSeatCountForLevel(partyLevel);
    const seatPool = Array.from({ length: maxSeats }, (_, idx) => {
      const found = activePartyRoom.seats.find((s) => Number(s.seatIndex) === idx);
      return (
        found || {
          seatIndex: idx,
          user: null,
          isMuted: false,
          isHostMuted: false,
          isLocked: false,
          isSpeaking: false,
          receivedCoins: 0,
        }
      );
    });
    const emptySeatIndex = seatPool.findIndex((s) => s.user === null && !s.isLocked);
    if (emptySeatIndex === -1) {
      showToast('No open unlocked seats available!');
      return;
    }
    const existingVipSeat = activePartyRoom.seats.find(
      (s) => Number(s.seatIndex) === VIP_GUEST_SEAT_INDEX
    );
    const updatedNormalSeats = seatPool.map((s) => {
      if (Number(s.seatIndex) === emptySeatIndex) {
        return {
          ...s,
          seatIndex: emptySeatIndex,
          user: viewer,
          isMuted: false,
          isHostMuted: false,
          isSpeaking: false,
        };
      }
      if (s.user?.id === viewer.id) {
        return { ...s, user: null, isMuted: false, isHostMuted: false, isSpeaking: false };
      }
      return s;
    });
    const preservedVipSeat = existingVipSeat
      ? existingVipSeat.user?.id === viewer.id
        ? { ...existingVipSeat, user: null, isMuted: false, isHostMuted: false, isSpeaking: false }
        : existingVipSeat
      : null;
    const updatedSeats = preservedVipSeat
      ? [...updatedNormalSeats, preservedVipSeat]
      : updatedNormalSeats;
    await updatePartyRoomFields(activePartyRoom.id, { seats: updatedSeats }).catch(() => {});
    if (viewer.id && viewer.id !== currentUser.id) {
      sendNotificationToUser({
        recipientId: viewer.id,
        type: 'party_invite',
        category: 'partyInvites',
        title: `🎙️ You were invited to Seat ${emptySeatIndex + 1}!`,
        message: `${currentUser.displayName} invited you to speak in "${activePartyRoom.title || 'Party Room'}".`,
        screen: 'party_room',
        roomId: activePartyRoom.id,
      }).catch(() => {});
    }
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
    const isTargetHost =
      sender.isHost ||
      (activePartyRoom &&
        ((sender.id && sender.id === activePartyRoom.host.id) ||
          sender.displayName === activePartyRoom.host.displayName));
    const matchedSeatUser = activePartyRoom?.seats.find(
      (s) => s.user && ((sender.id && s.user.id === sender.id) || s.user.displayName === sender.displayName)
    )?.user;
    const matchedViewer = realViewersList.find(
      (v) => (sender.id && v.id === sender.id) || v.displayName === sender.displayName
    );
    const resolvedBase = matchedSeatUser || matchedViewer;

    const targetUser: User =
      isTargetHost && activePartyRoom
        ? activePartyRoom.host
        : resolvedBase
        ? {
            ...resolvedBase,
            avatar: resolvedBase.avatar || sender.avatar,
            level: Number(sender.level ?? resolvedBase.level ?? 0),
            vipTier: Number(sender.vipTier ?? resolvedBase.vipTier ?? 0),
          }
        : {
            id: sender.id || `user_${sender.displayName.replace(/[^a-zA-Z0-9]/g, '_')}`,
            uniqueId: sender.id || `user_${sender.displayName.replace(/[^a-zA-Z0-9]/g, '_')}`,
            username: sender.displayName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'user',
            displayName: sender.displayName,
            avatar:
              sender.avatar ||
              'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80',
            bio: 'Alpha Mate Member',
            followersCount: 0,
            followingCount: 0,
            likesCount: 0,
            level: Number(sender.level ?? 0),
            xp: 0,
            nextLevelXp: 50000,
            vipTier: Number(sender.vipTier ?? 0),
            coins: 0,
            diamonds: 0,
            isVerified: false,
            isHost: false,
          };

    const seatIdx =
      activePartyRoom?.seats.findIndex(
        (s) => s.user && (s.user.id === targetUser.id || s.user.displayName === sender.displayName)
      ) ?? -1;
    setSelectedUserForActionSheet(targetUser);
    setSelectedUserSeatIndex(seatIdx !== -1 ? seatIdx : null);
    setShowUserActionSheet(true);
  };

  // Convert or Upgrade Party Room Seat Capacity (Level 1: 4, Level 2: 8, Level 3: 12, Level 4: 16 normal seats)
  const handleConvertRoomLevel = (targetLvl: 1 | 2 | 3 | 4) => {
    if (!canModerate) {
      showToast('Only Host & Moderators can change seat capacity! 👑');
      return;
    }

    const tierConfig = PARTY_TIER_SETTINGS.find((t) => t.level === targetLvl);
    if (!tierConfig) return;

    const effectiveHostLevel = isHost ? currentUser.level : (activePartyRoom?.host.level ?? 0);
    if (effectiveHostLevel < tierConfig.requiredLevel) {
      showToast(`🔒 Level ${tierConfig.requiredLevel} required for ${tierConfig.name}! (Host Level: Lv.${effectiveHostLevel})`);
      return;
    }

    if (partyLevel === targetLvl) {
      showToast(`Room is already set to ${tierConfig.name}!`);
      return;
    }

    if (targetLvl >= 3 && isRoomPKActive) {
      setIsRoomPKActive(false);
      showToast('Room PK concluded (12/16-Seat rooms do not support Room PK) ⚔️');
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
      text: `🚀 ${isHost ? 'Host' : 'Moderator'} ${currentUser.displayName} converted Party Room to ${tierConfig.name} (${tierConfig.subLabel})!`,
      type: 'system',
      timestamp: 'Just now',
    };
    setChatItems((prev) => [...prev, upgradeMsg]);
    showToast(`🎉 Room converted to ${tierConfig.name}! 🚀`);
  };

  // Chat Feed with system, host, room and gift messages
  const [chatItems, setChatItems] = useState<ChatItem[]>([]);

  // 16-Seat Normal Guest Roster ready for real users
  const defaultGuestSeats: PartySeat[] = useMemo(() => {
    return Array.from({ length: 16 }, (_, i) => ({
      seatIndex: i,
      user: null,
      isMuted: false,
      isSpeaking: false,
      receivedCoins: 0,
    }));
  }, []);

  const voiceParticipantsById = useMemo(() => {
    const map = new Map<string, PartyParticipantPresence>();
    activeVoiceParticipants.forEach((p) => {
      map.set(p.userId, p);
    });
    return map;
  }, [activeVoiceParticipants]);

  // Compute Active Normal Seats array based on current Party Level (4 / 8 / 12 / 16) and real-time Firestore seats + audio presence
  const activeGuestSeats = useMemo(() => {
    const targetSeatCount = getNormalSeatCountForLevel(partyLevel);
    const roomSeats = activePartyRoom?.seats || [];
    const seats: PartySeat[] = [];

    for (let i = 0; i < targetSeatCount; i++) {
      const serverSeat = roomSeats.find((s: any) => Number(s.seatIndex) === i);
      if (userSeatIndex === i) {
        seats.push({
          seatIndex: i,
          user: { ...currentUser, id: effectiveUserId },
          isMuted: isMicMuted,
          isHostMuted: !!serverSeat?.isHostMuted,
          isLocked: !!serverSeat?.isLocked,
          isSpeaking: !isMicMuted && isSelfSpeaking,
          receivedCoins: Number(serverSeat?.receivedCoins) || 0,
        });
      } else if (serverSeat && serverSeat.user) {
        const peerPresence = voiceParticipantsById.get(serverSeat.user.id);
        const peerMuted = Boolean(serverSeat.isMuted || serverSeat.isHostMuted || peerPresence?.isMuted);
        const peerSpeaking =
          !peerMuted &&
          Boolean(
            peerPresence?.isSpeaking ||
              remoteSpeakingPeerIds.has(serverSeat.user.id)
          );
        seats.push({
          seatIndex: i,
          user: serverSeat.user,
          isMuted: peerMuted,
          isHostMuted: !!serverSeat.isHostMuted,
          isLocked: !!serverSeat.isLocked,
          isSpeaking: peerSpeaking,
          receivedCoins: Number(serverSeat.receivedCoins) || 0,
        });
      } else {
        seats.push({
          seatIndex: i,
          user: null,
          isMuted: false,
          isHostMuted: false,
          isLocked: !!serverSeat?.isLocked,
          isSpeaking: false,
          receivedCoins: 0,
        });
      }
    }

    return seats;
  }, [
    partyLevel,
    userSeatIndex,
    isMicMuted,
    isSelfSpeaking,
    currentUser,
    effectiveUserId,
    activePartyRoom?.seats,
    voiceParticipantsById,
    remoteSpeakingPeerIds,
  ]);

  // Dedicated VIP 1 (VIP Guest) seat beside Host — LOCKED by default, Host-only unlock & guest assignment
  const vipGuestSeat: PartySeat = useMemo(() => {
    const roomSeats = activePartyRoom?.seats || [];
    const serverVip = roomSeats.find((s: any) => Number(s.seatIndex) === VIP_GUEST_SEAT_INDEX);
    const isVipLocked = serverVip ? serverVip.isLocked !== false : true;

    if (userSeatIndex === VIP_GUEST_SEAT_INDEX) {
      return {
        seatIndex: VIP_GUEST_SEAT_INDEX,
        user: { ...currentUser, id: effectiveUserId },
        isMuted: isMicMuted,
        isHostMuted: !!serverVip?.isHostMuted,
        isLocked: false,
        isVipGuest: true,
        isSpeaking: !isMicMuted && isSelfSpeaking,
        receivedCoins: Number(serverVip?.receivedCoins) || 0,
      };
    }

    if (serverVip && serverVip.user) {
      const peerPresence = voiceParticipantsById.get(serverVip.user.id);
      const peerMuted = Boolean(serverVip.isMuted || serverVip.isHostMuted || peerPresence?.isMuted);
      const peerSpeaking =
        !peerMuted &&
        Boolean(
          peerPresence?.isSpeaking ||
            remoteSpeakingPeerIds.has(serverVip.user.id)
        );
      return {
        seatIndex: VIP_GUEST_SEAT_INDEX,
        user: serverVip.user,
        isMuted: peerMuted,
        isHostMuted: !!serverVip.isHostMuted,
        isLocked: false,
        isVipGuest: true,
        isSpeaking: peerSpeaking,
        receivedCoins: Number(serverVip.receivedCoins) || 0,
      };
    }

    return {
      seatIndex: VIP_GUEST_SEAT_INDEX,
      user: null,
      isMuted: false,
      isHostMuted: false,
      isLocked: isVipLocked,
      isVipGuest: true,
      isSpeaking: false,
      receivedCoins: Number(serverVip?.receivedCoins) || 0,
    };
  }, [
    activePartyRoom?.seats,
    userSeatIndex,
    currentUser,
    effectiveUserId,
    isMicMuted,
    isSelfSpeaking,
    voiceParticipantsById,
    remoteSpeakingPeerIds,
  ]);

  // Keep userSeatIndex and host-locked mute/unmute state in sync with Firestore snapshot
  useEffect(() => {
    if (!activePartyRoom?.seats) {
      setUserSeatIndex(null);
      wasHostMutedRef.current = false;
      return;
    }
    const mySeat = activePartyRoom.seats.find((s: any) => s.user?.id === effectiveUserId);
    setUserSeatIndex(mySeat ? Number(mySeat.seatIndex) : null);

    const nowHostMuted = Boolean(mySeat?.isHostMuted);
    if (nowHostMuted && !isMicMuted) {
      setIsMicMuted(true);
      agoraPartyEngine.toggleMicrophone(false);
    } else if (wasHostMutedRef.current && !nowHostMuted && mySeat) {
      const nextMuted = Boolean(mySeat.isMuted);
      setIsMicMuted(nextMuted);
      agoraPartyEngine.toggleMicrophone(!nextMuted);
    }
    wasHostMutedRef.current = nowHostMuted;
  }, [activePartyRoom?.seats, effectiveUserId]);

  // Guest seats occupancy and dynamic upgrade eligibility
  const occupiedGuestSeatsCount = useMemo(() => {
    return activeGuestSeats.filter((s) => s.user !== null).length;
  }, [activeGuestSeats]);

  const maxGuestSeats = getNormalSeatCountForLevel(partyLevel);
  const isRoomFull = occupiedGuestSeatsCount >= maxGuestSeats;
  const nextTargetTier = PARTY_TIER_SETTINGS.find((t) => t.level === partyLevel + 1) || null;
  const canHostUpgrade = Boolean(
    canModerate && nextTargetTier && (isHost ? currentUser.level : hostLevel) >= nextTargetTier.requiredLevel
  );

  const registerPartyAudioEl = useCallback((peerId: string, el: HTMLAudioElement | null) => {
    if (!el) {
      partyAudioElsRef.current.delete(peerId);
    } else {
      partyAudioElsRef.current.set(peerId, el);
    }
  }, []);

  const handleAutoplayStateChange = useCallback((blocked: boolean) => {
    setPartyAudioAutoplayBlocked(blocked);
  }, []);

  const unlockAllRemoteAudioPlayback = useCallback(async () => {
    agoraPartyEngine.resumeAudioPlayback();
    const targets: HTMLAudioElement[] = [];
    partyAudioElsRef.current.forEach((audioEl) => {
      if (!audioEl || !audioEl.srcObject) return;
      audioEl.muted = !isSpeakerOnRef.current;
      audioEl.volume = 1;
      targets.push(audioEl);
    });
    if (targets.length === 0) {
      setPartyAudioAutoplayBlocked(false);
      return;
    }
    const results = await Promise.allSettled(targets.map((el) => el.play()));
    const anyRejected = results.some((r) => r.status === 'rejected');
    setPartyAudioAutoplayBlocked(anyRejected);
  }, []);

  // 1. Single SFU Session Lifecycle per Room Join / Leave (never torn down on seat changes)
  useEffect(() => {
    const roomId = activePartyRoom?.id;
    if (startupRetryTimerRef.current) {
      clearTimeout(startupRetryTimerRef.current);
      startupRetryTimerRef.current = null;
    }

    if (!roomId) {
      lastVoiceModeRef.current = null;
      startupAutoRetryKeyRef.current = '';
      startupAutoRetryCountRef.current = 0;
      voiceReconnectAttemptRef.current = 0;
      voiceHasConnectedRef.current = false;
      voiceParticipantsLoadedRef.current = false;
      setPartyVoiceError(null);
      setPartyVoiceReconnecting(null);
      setPartyAudioAutoplayBlocked(false);
      setIsHostMicMuted(false);
      setIsHostSpeaking(false);
      setIsSelfSpeaking(false);
      setRemotePartyStreams([]);
      setActiveVoiceParticipants([]);
      setWsPartyViewers([]);
      setRemoteSpeakingPeerIds(new Set());
      setJoinNotification(null);
      initialParticipantsSeededRef.current = false;
      notifiedJoinTimestampsRef.current.clear();
      lastSyncedViewerCountRef.current = -1;
      lastSelfSpeakingSyncedRef.current = false;
      wasHostMutedRef.current = false;
      return;
    }

    const sessionIdentityKey = `${roomId}:${effectiveUserId}`;
    if (startupAutoRetryKeyRef.current !== sessionIdentityKey) {
      startupAutoRetryKeyRef.current = sessionIdentityKey;
      startupAutoRetryCountRef.current = 0;
    }

    const isNewRoom = lastVoiceRoomIdRef.current !== roomId;
    lastVoiceRoomIdRef.current = roomId;
    const isUserHost = activePartyRoom.host?.id === effectiveUserId;
    const myInitialSeat = activePartyRoom.seats?.find((s: any) => s.user?.id === effectiveUserId);
    const isSeatedNow = Boolean(myInitialSeat);
    const initialCanSpeak = isUserHost || isSeatedNow;
    const initialMuted = isUserHost
      ? (isNewRoom ? false : isHostMicMuted)
      : myInitialSeat
        ? Boolean(myInitialSeat.isMuted || myInitialSeat.isHostMuted)
        : false;

    let cancelled = false;
    if (voiceReconnectTimerRef.current) {
      clearTimeout(voiceReconnectTimerRef.current);
      voiceReconnectTimerRef.current = null;
    }
    if (isNewRoom) {
      setIsHostMicMuted(false);
    }
    voiceHasConnectedRef.current = false;
    voiceParticipantsLoadedRef.current = false;
    initialParticipantsSeededRef.current = false;
    notifiedJoinTimestampsRef.current.clear();
    lastSyncedViewerCountRef.current = -1;
    lastSelfSpeakingSyncedRef.current = false;
    setJoinNotification(null);

    // Record initial voice state so Effect #2 does not redundantly re-trigger startup
    lastVoiceModeRef.current = {
      key: sessionIdentityKey,
      canSpeak: initialCanSpeak,
      muted: initialMuted,
    };

    setPartyVoiceError(null);
    setPartyVoiceReconnecting('Connecting Party Voice…');
    agoraPartyEngine
      .startPartyVoice(roomId, effectiveUserId, initialMuted, !initialCanSpeak, {
        profile: {
          userId: effectiveUserId,
          uniqueId: currentUser.uniqueId || effectiveUserId,
          displayName: currentUser.displayName,
          avatar: currentUser.avatar,
          level: currentUser.level,
          vipTier: currentUser.vipTier,
          countryFlag: currentUser.countryFlag,
          isHost: isUserHost,
        },
        roomParticipants: [
          ...(activePartyRoom.host?.id ? [{ userId: activePartyRoom.host.id, uniqueId: activePartyRoom.host.uniqueId || activePartyRoom.host.id, displayName: activePartyRoom.host.displayName, avatar: activePartyRoom.host.avatar, level: activePartyRoom.host.level, vipTier: activePartyRoom.host.vipTier, isHost: true }] : []),
          ...((activePartyRoom.seats || []).filter((seat: any) => seat?.user?.id).map((seat: any) => ({ userId: seat.user.id, uniqueId: seat.user.uniqueId || seat.user.id, displayName: seat.user.displayName, avatar: seat.user.avatar, level: seat.user.level, vipTier: seat.user.vipTier, isHost: false }))),
        ],
        onError: (err) => {
          if (cancelled) return;
          if (err?.code === 'USER_RESTRICTED' || err?.code === 'ROOM_NOT_FOUND') {
            setPartyVoiceReconnecting(null);
            showToast(err?.message || 'Unable to access this Party Room.');
            closePartyRoom(false);
            return;
          }
          if (err?.code === 'AGORA_NOT_CONFIGURED') {
            setPartyVoiceReconnecting(null);
            setPartyVoiceError(err?.message || 'Party voice server is not configured.');
            return;
          }
          console.warn('[Party Voice] Agora event notice:', err);
        },
        onConnectionStateChange: (connState, meta) => {
          if (cancelled) return;
          if (connState === 'connected') {
            voiceHasConnectedRef.current = true;
            voiceReconnectAttemptRef.current = 0;
            setPartyVoiceReconnecting(null);
            setPartyVoiceError(null);
          } else if (connState === 'connecting') {
            setPartyVoiceReconnecting('Connecting Party Voice…');
            setPartyVoiceError(null);
          } else if (connState === 'reconnecting') {
            const attemptSuffix = meta?.attempt ? ` (${meta.attempt}/${meta.maxAttempts || 5})` : '';
            setPartyVoiceReconnecting(`Reconnecting Party Voice…${attemptSuffix}`);
            setPartyVoiceError(null);
          } else if (connState === 'failed' || connState === 'disconnected') {
            setPartyVoiceReconnecting(null);
            setPartyVoiceError(
              meta?.reason
                ? `Party voice disconnected (${meta.reason}). Tap Retry to reconnect.`
                : 'Party voice connection interrupted. Tap Retry to reconnect.'
            );
          }
        },
        onSpeakingChange: (localSpeakingNow, remoteSpeakingSet) => {
          if (cancelled) return;
          if (isUserHost) {
            setIsHostSpeaking(!isHostMicMutedRef.current && localSpeakingNow);
            setIsSelfSpeaking(false);
          } else {
            setIsSelfSpeaking(userSeatIndexRef.current !== null && !isMicMutedRef.current && localSpeakingNow);
            setIsHostSpeaking(false);
          }
          setRemoteSpeakingPeerIds((prev) => {
            if (prev.size === remoteSpeakingSet.size && Array.from(remoteSpeakingSet).every((id) => prev.has(id))) {
              return prev;
            }
            return new Set(remoteSpeakingSet);
          });
        },
        onParticipantsChange: (participants) => {
          if (cancelled) return;
          voiceParticipantsLoadedRef.current = true;
          setActiveVoiceParticipants(participants);

          const now = Date.now();
          if (!initialParticipantsSeededRef.current) {
            initialParticipantsSeededRef.current = true;
            participants.forEach((p) => {
              notifiedJoinTimestampsRef.current.set(p.userId, now);
            });
            return;
          }

          for (const p of participants) {
            if (p.userId === effectiveUserId) continue;
            const lastNotified = notifiedJoinTimestampsRef.current.get(p.userId);
            if (!lastNotified || now - lastNotified > 25_000) {
              notifiedJoinTimestampsRef.current.set(p.userId, now);
              const peerVipTier = Number(p.vipTier || 0);
              if (peerVipTier >= VIP_ENTRY_MIN_TIER) {
                enqueueVipEntry({
                  id: `vip_voice_${roomId}_${p.userId}_${now}`,
                  roomId,
                  userId: p.userId,
                  displayName: p.displayName || 'VIP Guest',
                  avatar: safeImageSrc(p.avatar, DEFAULT_AVATAR_URL) || DEFAULT_AVATAR_URL,
                  vipTier: peerVipTier,
                  level: Number(p.level || 0),
                  isHost: Boolean(p.isHost),
                  timestamp: now,
                });
              } else {
                if (joinNotificationTimerRef.current) {
                  clearTimeout(joinNotificationTimerRef.current);
                }
                setJoinNotification({
                  id: `${p.userId}_${now}`,
                  name: p.displayName || 'New Guest',
                });
                joinNotificationTimerRef.current = setTimeout(() => {
                  setJoinNotification(null);
                  joinNotificationTimerRef.current = null;
                }, 3500);
              }
            } else {
              // Refresh timestamp while peer stays active so reconnects do not re-notify
              notifiedJoinTimestampsRef.current.set(p.userId, now);
            }
          }
        },
      })
      .then(() => {
        if (cancelled) return;
        setPartyVoiceReconnecting(null);
        setPartyVoiceError(null);
      })
      .catch((error: any) => {
        if (cancelled) return;
        setPartyVoiceReconnecting(null);
        if (error?.code === 'MIC_PERMISSION_REQUIRED' || error?.name === 'NotAllowedError') {
          if (isUserHost) {
            setIsHostMicMuted(true);
          } else if (isSeatedNow) {
            setIsMicMuted(true);
          }
          showToast('Microphone permission denied — listening safely with mic muted 🔇');
          setPartyVoiceError('Microphone permission is disabled. Enable Microphone in Settings to speak.');
          return;
        }
        if (error?.code === 'USER_RESTRICTED' || error?.code === 'ROOM_NOT_FOUND') {
          showToast(error?.message || 'Unable to access this Party Room.');
          closePartyRoom(false);
          return;
        }
        if (error?.code === 'AGORA_NOT_CONFIGURED' || error?.status === 503) {
          console.warn('[Party Voice] Agora backend unavailable:', error?.message || error);
          setPartyVoiceError(error?.message || 'Party Voice service is temporarily unavailable.');
          return;
        }
        console.error('[Party Voice] Unable to start Agora session:', error);

        if (
          (error?.code === 'AGORA_BACKEND_UNREACHABLE' || error?.code === 'SFU_BACKEND_UNREACHABLE') &&
          startupAutoRetryCountRef.current < 2
        ) {
          startupAutoRetryCountRef.current += 1;
          setPartyVoiceReconnecting(`Reconnecting Party Voice… (${startupAutoRetryCountRef.current}/2)`);
          startupRetryTimerRef.current = setTimeout(() => {
            startupRetryTimerRef.current = null;
            if (!cancelled) {
              setPartyVoiceRetryToken((prev) => prev + 1);
            }
          }, 1800 * startupAutoRetryCountRef.current);
          return;
        }

        setPartyVoiceError(error?.message || 'Unable to connect Party Voice. Tap Retry.');
      });

    const roomSessionId = activePartyRoom?.sessionId || undefined;
    const wsJoinProfile: RealtimeViewerProfile = {
      id: effectiveUserId,
      uniqueId: currentUser.uniqueId || effectiveUserId,
      username: currentUser.username || currentUser.displayName,
      displayName: currentUser.displayName,
      avatar: currentUser.avatar,
      level: currentUser.level,
      vipTier: currentUser.vipTier,
      countryFlag: currentUser.countryFlag,
      isVerified: currentUser.isVerified,
      isHost: isUserHost,
      joinedAtMs: Date.now(),
    };
    realtimeSocket.joinRoom('party', roomId, wsJoinProfile, 0, roomSessionId);
    wsViewersSeededRef.current = false;

    // Announce high-tier self arrival locally and to peers inside the room
    const selfVipTier = Number(currentUser.vipTier || 0);
    if (selfVipTier >= VIP_ENTRY_MIN_TIER) {
      const joinTs = Date.now();
      enqueueVipEntry({
        id: `vip_self_${roomId}_${effectiveUserId}_${joinTs}`,
        roomId,
        userId: effectiveUserId,
        displayName: currentUser.displayName || 'VIP Member',
        avatar: safeImageSrc(currentUser.avatar, DEFAULT_AVATAR_URL) || DEFAULT_AVATAR_URL,
        vipTier: selfVipTier,
        level: Number(currentUser.level || 0),
        isHost: isUserHost,
        timestamp: joinTs,
      });
      realtimeSocket.sendRoomSignal('party', roomId, {
        type: 'vip_entry',
        userId: effectiveUserId,
        displayName: currentUser.displayName || 'VIP Member',
        avatar: safeImageSrc(currentUser.avatar, DEFAULT_AVATAR_URL) || DEFAULT_AVATAR_URL,
        vipTier: selfVipTier,
        level: Number(currentUser.level || 0),
        isHost: isUserHost,
        timestamp: joinTs,
      });
    }

    const unsubWsPartyRoom = realtimeSocket.onRoomEvent('party', roomId, (ev) => {
      if (cancelled) return;
      if (roomSessionId && ev.roomSessionId && ev.roomSessionId !== roomSessionId) return;
      if (ev.type === 'room:state_init' || ev.type === 'room:viewers') {
        const viewers = Array.isArray(ev.viewers) ? ev.viewers : [];
        setWsPartyViewers(viewers);
        const now = Date.now();
        if (ev.type === 'room:state_init' || !wsViewersSeededRef.current) {
          wsViewersSeededRef.current = true;
          viewers.forEach((v) => {
            if (v?.id) {
              vipEntryNotifiedRef.current.set(v.id, now);
            }
          });
        } else {
          viewers.forEach((v) => {
            if (!v?.id || v.id === effectiveUserId) return;
            const viewerVipTier = Number(v.vipTier || 0);
            if (viewerVipTier >= VIP_ENTRY_MIN_TIER) {
              enqueueVipEntry({
                id: `vip_ws_viewer_${roomId}_${v.id}_${now}`,
                roomId,
                userId: v.id,
                displayName: v.displayName || 'VIP Guest',
                avatar: safeImageSrc(v.avatar, DEFAULT_AVATAR_URL) || DEFAULT_AVATAR_URL,
                vipTier: viewerVipTier,
                level: Number(v.level || 0),
                isHost: Boolean(v.isHost),
                timestamp: now,
              });
            }
          });
        }
      } else if (
        ev.type === 'room:signal' &&
        ev.roomId === roomId &&
        ev.signal?.type === 'vip_entry' &&
        ev.senderId !== effectiveUserId
      ) {
        const sig = ev.signal;
        const sigTs = Number(sig.timestamp || ev.ts || Date.now());
        const sigVipTier = Number(sig.vipTier || 0);
        const sigUserId = String(sig.userId || ev.senderId || '');
        if (
          sigUserId &&
          sigVipTier >= VIP_ENTRY_MIN_TIER &&
          Math.abs(Date.now() - sigTs) < 12_000
        ) {
          enqueueVipEntry({
            id: `vip_sig_${roomId}_${sigUserId}_${sigTs}`,
            roomId,
            userId: sigUserId,
            displayName: String(sig.displayName || 'VIP Guest'),
            avatar: safeImageSrc(sig.avatar, DEFAULT_AVATAR_URL) || DEFAULT_AVATAR_URL,
            vipTier: sigVipTier,
            level: Number(sig.level || 0),
            isHost: Boolean(sig.isHost),
            timestamp: sigTs,
          });
        }
      } else if (
        ev.type === 'room:signal' &&
        ev.roomId === roomId &&
        ev.signal?.type === 'gift_combo' &&
        ev.senderId !== effectiveUserId
      ) {
        const sig = ev.signal;
        const sigTs = Number(sig.timestamp || ev.ts || Date.now());
        const now = Date.now();
        if (
          sig.gift &&
          sigTs >= partyJoinedAtRef.current - 1500 &&
          Math.abs(now - sigTs) < 8000
        ) {
          enqueuePartyGiftAnimation({
            id: `party_ws_gift_${roomId}_${sigTs}_${Math.random().toString(36).slice(2, 7)}`,
            gift: sig.gift as Gift,
            senderName: String(sig.senderName || 'Guest'),
            senderAvatar: sig.senderAvatar ? String(sig.senderAvatar) : undefined,
            senderVipTier: Number(sig.senderVipTier || 1),
            recipientName: String(sig.recipientName || activePartyRoom.host.displayName || 'Host'),
            comboCount: Number(sig.comboCount || 1),
            quantity: Number(sig.quantity || 1),
            timestamp: sigTs,
            roomId,
          });
        }
      }
    });

    const handlePageHide = () => {
      realtimeSocket.leaveRoom('party', roomId);
      agoraPartyEngine.stopPartyVoice(roomId, true).catch(() => {});
    };
    const handleNetworkOnline = () => {
      if (cancelled) return;
      agoraPartyEngine.recoverConnectionIfNeeded(roomId, 'Network restored');
      unlockAllRemoteAudioPlayback().catch(() => {});
    };
    const handleVisibilityChange = () => {
      if (cancelled || document.visibilityState !== 'visible') return;
      agoraPartyEngine.recoverConnectionIfNeeded(roomId, 'Returned to foreground');
      unlockAllRemoteAudioPlayback().catch(() => {});
    };
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handlePageHide);
    window.addEventListener('online', handleNetworkOnline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      unsubWsPartyRoom();
      realtimeSocket.leaveRoom('party', roomId);
      if (startupRetryTimerRef.current) {
        clearTimeout(startupRetryTimerRef.current);
        startupRetryTimerRef.current = null;
      }
      if (voiceReconnectTimerRef.current) {
        clearTimeout(voiceReconnectTimerRef.current);
        voiceReconnectTimerRef.current = null;
      }
      if (joinNotificationTimerRef.current) {
        clearTimeout(joinNotificationTimerRef.current);
        joinNotificationTimerRef.current = null;
      }
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handlePageHide);
      window.removeEventListener('online', handleNetworkOnline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      agoraPartyEngine.stopPartyVoice(roomId).catch(() => {});
    };
  }, [activePartyRoom?.id, activePartyRoom?.sessionId, effectiveUserId, partyVoiceRetryToken]);

  // 2. Sync speaking / mic publish state inside the SAME Agora session when sitting, leaving seat, or muting.
  //    CRITICAL OPTIMIZATION: When only mute/unmute changes (canSpeak unchanged), toggle the mic track
  //    locally with zero HTTP token fetch or role-switch audio hiccup.
  useEffect(() => {
    const roomId = activePartyRoom?.id;
    if (!roomId) {
      setIsHostSpeaking(false);
      setIsSelfSpeaking(false);
      return;
    }

    const isUserHost = activePartyRoom.host?.id === effectiveUserId;
    const canSpeak = isUserHost || userSeatIndex !== null;
    const muted = isUserHost ? isHostMicMuted : isMicMuted;
    const modeKey = `${roomId}:${effectiveUserId}`;
    const prevMode = lastVoiceModeRef.current;

    const didRoleChange =
      prevMode !== null &&
      prevMode.key === modeKey &&
      prevMode.canSpeak !== canSpeak;
    const didMuteChangeOnly =
      prevMode !== null &&
      prevMode.key === modeKey &&
      prevMode.canSpeak === canSpeak &&
      prevMode.muted !== muted;

    if (didMuteChangeOnly) {
      lastVoiceModeRef.current = { key: modeKey, canSpeak, muted };
      agoraPartyEngine.toggleMicrophone(canSpeak && !muted);
    } else if (didRoleChange) {
      lastVoiceModeRef.current = { key: modeKey, canSpeak, muted };
      agoraPartyEngine
        .setPartySpeakingMode(roomId, effectiveUserId, canSpeak, muted, {
          userId: effectiveUserId,
          uniqueId: currentUser.uniqueId || effectiveUserId,
          displayName: currentUser.displayName,
          avatar: currentUser.avatar,
          level: currentUser.level,
          vipTier: currentUser.vipTier,
          countryFlag: currentUser.countryFlag,
          isHost: isUserHost,
        })
        .catch((err: any) => {
          const isMicHardwareError =
            err?.code === 'MIC_PERMISSION_REQUIRED' ||
            err?.name === 'NotAllowedError' ||
            err?.name === 'NotFoundError' ||
            err?.name === 'NotReadableError' ||
            /microphone|permission|device/i.test(String(err?.message || ''));

          if (isMicHardwareError) {
            if (!isUserHost && userSeatIndex !== null) {
              setIsMicMuted(true);
              const mutedSeats = (activePartyRoom.seats || []).map((s) =>
                Number(s.seatIndex) === userSeatIndex ? { ...s, isMuted: true, isSpeaking: false } : s
              );
              updatePartyRoomFields(roomId, { seats: mutedSeats }).catch(() => {});
              showToast('Microphone permission required — seated with mic muted 🔇');
            } else {
              setIsHostMicMuted(true);
              showToast('Please enable Microphone permission in Android Settings to speak 🔇');
            }
            return;
          }

          if (err?.code === 'AGORA_NOT_CONFIGURED' || err?.status === 503) {
            console.warn('[Party Voice] Mic publish/mode switch unavailable:', err?.message || err);
          } else {
            console.error('[Party Voice] Mic publish/mode switch failed:', err);
          }
          const msg = err?.message || 'Unable to switch Party microphone mode. Tap Retry.';
          setPartyVoiceError(msg);
          showToast(msg);
        });
    }

    if (!canSpeak || muted) {
      setIsHostSpeaking(false);
      setIsSelfSpeaking(false);
      if (lastSelfSpeakingSyncedRef.current) {
        lastSelfSpeakingSyncedRef.current = false;
        agoraPartyEngine.updatePartySpeakingIndicator(roomId, false);
      }
    }
  }, [activePartyRoom?.id, effectiveUserId, isHost, userSeatIndex, isMicMuted, isHostMicMuted]);

  // 2a. Keep Agora numeric UID -> Firebase userId profile mapping fresh for late joiners & seat takers
  useEffect(() => {
    const roomId = activePartyRoom?.id;
    if (!roomId) return;
    agoraPartyEngine.syncRoomParticipants(roomId, [
      ...(activePartyRoom.host?.id
        ? [{
            userId: activePartyRoom.host.id,
            uniqueId: activePartyRoom.host.uniqueId || activePartyRoom.host.id,
            displayName: activePartyRoom.host.displayName,
            avatar: activePartyRoom.host.avatar,
            level: activePartyRoom.host.level,
            vipTier: activePartyRoom.host.vipTier,
            countryFlag: activePartyRoom.host.countryFlag,
            isHost: true,
          }]
        : []),
      ...((activePartyRoom.seats || [])
        .filter((seat: any) => seat?.user?.id)
        .map((seat: any) => ({
          userId: seat.user.id,
          uniqueId: seat.user.uniqueId || seat.user.id,
          displayName: seat.user.displayName,
          avatar: seat.user.avatar,
          level: seat.user.level,
          vipTier: seat.user.vipTier,
          countryFlag: seat.user.countryFlag,
          isHost: false,
        }))),
      ...(wsPartyViewers || []).map((v) => ({
        userId: v.id,
        uniqueId: v.uniqueId || v.id,
        displayName: v.displayName,
        avatar: v.avatar,
        level: v.level,
        vipTier: v.vipTier,
        countryFlag: v.countryFlag,
        isHost: Boolean(v.isHost),
      })),
    ]);
  }, [activePartyRoom?.id, activePartyRoom?.host, activePartyRoom?.seats, wsPartyViewers]);

  // Reset remote speaking indicator cleanly when exiting a room (live updates are pushed via onSpeakingChange)
  useEffect(() => {
    if (!activePartyRoom?.id) {
      setRemoteSpeakingPeerIds((prev) => (prev.size === 0 ? prev : new Set()));
    }
  }, [activePartyRoom?.id]);

  // 3. Subscribe to real SFU party remote microphone streams and bind to mounted DOM <audio> elements
  useEffect(() => {
    const roomId = activePartyRoom?.id;
    if (!roomId) {
      setRemotePartyStreams([]);
      return;
    }

    // Hydrate any streams already received before effect mount
    setRemotePartyStreams(agoraPartyEngine.getActivePartyRemoteStreams(roomId));

    const handleRemotePartyStream = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (!detail || detail.roomId !== roomId || !detail.stream || !detail.peerId) return;
      setRemotePartyStreams((prev) => {
        const existing = prev.find((item) => item.peerId === detail.peerId);
        if (existing && existing.stream === detail.stream) {
          return prev;
        }
        const filtered = prev.filter((item) => item.peerId !== detail.peerId);
        return [...filtered, { peerId: detail.peerId, stream: detail.stream }];
      });
    };

    const handleRemotePartyStreamRemoved = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (!detail || detail.roomId !== roomId || !detail.peerId) return;
      setRemotePartyStreams((prev) => prev.filter((item) => item.peerId !== detail.peerId));
      partyAudioElsRef.current.delete(detail.peerId);
    };

    window.addEventListener('alphamate-party-remote-stream', handleRemotePartyStream);
    window.addEventListener('alphamate-party-remote-stream-removed', handleRemotePartyStreamRemoved);
    return () => {
      window.removeEventListener('alphamate-party-remote-stream', handleRemotePartyStream);
      window.removeEventListener('alphamate-party-remote-stream-removed', handleRemotePartyStreamRemoved);
      partyAudioElsRef.current.clear();
    };
  }, [activePartyRoom?.id]);

  useEffect(() => {
    if (!activePartyRoom?.id || !partyAudioAutoplayBlocked) return;
    const handleGestureUnlock = () => {
      unlockAllRemoteAudioPlayback().catch(() => {});
    };
    window.addEventListener('pointerdown', handleGestureUnlock, { passive: true });
    window.addEventListener('touchstart', handleGestureUnlock, { passive: true });
    window.addEventListener('click', handleGestureUnlock, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', handleGestureUnlock);
      window.removeEventListener('touchstart', handleGestureUnlock);
      window.removeEventListener('click', handleGestureUnlock);
    };
  }, [activePartyRoom?.id, partyAudioAutoplayBlocked, unlockAllRemoteAudioPlayback]);

  // Scoped recovery when user pulls down or taps Refresh inside the active Party Room
  useEffect(() => {
    if (partyRefreshTick <= 0 || partyRefreshTick === lastHandledPartyRefreshTickRef.current) return;
    lastHandledPartyRefreshTickRef.current = partyRefreshTick;
    if (!activePartyRoom?.id) return;

    setPartyVoiceError(null);
    setPartyVoiceRetryToken((prev) => prev + 1);
    unlockAllRemoteAudioPlayback().catch(() => {});
    showToast('Party Room & audio refreshed');
  }, [partyRefreshTick, activePartyRoom?.id, unlockAllRemoteAudioPlayback]);

  // Build deduplicated active audience list strictly from real live voiceParticipants + self
  const realViewersList: User[] = useMemo(() => {
    if (!activePartyRoom) return [];
    const byId = new Map<string, User>();
    const seenUniqueIds = new Set<string>();

    const addUniqueViewer = (u: User) => {
      if (!u.id || byId.has(u.id)) return;
      const normUnique = u.uniqueId && u.uniqueId !== u.id ? String(u.uniqueId).trim() : '';
      if (normUnique && seenUniqueIds.has(normUnique)) return;
      if (normUnique) seenUniqueIds.add(normUnique);
      byId.set(u.id, u);
    };

    if (voiceParticipantsLoadedRef.current) {
      activeVoiceParticipants.forEach((p) => {
        const isHostPeer = p.isHost || p.userId === activePartyRoom.host?.id;
        const baseHost = isHostPeer ? activePartyRoom.host : undefined;
        addUniqueViewer({
          id: p.userId,
          uniqueId: p.uniqueId || baseHost?.uniqueId || p.userId,
          username: (p.displayName || baseHost?.username || 'user').replace(/\s+/g, ''),
          displayName: p.displayName || baseHost?.displayName || 'Alpha User',
          avatar: safeImageSrc(p.avatar || baseHost?.avatar, DEFAULT_AVATAR_URL) || DEFAULT_AVATAR_URL,
          bio: baseHost?.bio || 'Alpha Mate live party member',
          followersCount: baseHost?.followersCount || 0,
          followingCount: baseHost?.followingCount || 0,
          likesCount: baseHost?.likesCount || 0,
          level: Number(p.level ?? baseHost?.level ?? 0),
          xp: baseHost?.xp || 0,
          nextLevelXp: baseHost?.nextLevelXp || 50000,
          vipTier: p.vipTier ?? baseHost?.vipTier ?? 0,
          countryFlag: p.countryFlag || baseHost?.countryFlag,
          coins: baseHost?.coins || 0,
          diamonds: baseHost?.diamonds || 0,
          isVerified: baseHost?.isVerified || false,
          isHost: isHostPeer,
        });
      });

      wsPartyViewers.forEach((v) => {
        const isHostPeer = v.isHost || v.id === activePartyRoom.host?.id;
        const baseHost = isHostPeer ? activePartyRoom.host : undefined;
        addUniqueViewer({
          id: v.id,
          uniqueId: v.uniqueId || baseHost?.uniqueId || v.id,
          username: (v.displayName || baseHost?.username || 'user').replace(/\s+/g, ''),
          displayName: v.displayName || baseHost?.displayName || 'Alpha User',
          avatar: safeImageSrc(v.avatar || baseHost?.avatar, DEFAULT_AVATAR_URL) || DEFAULT_AVATAR_URL,
          bio: baseHost?.bio || 'Alpha Mate live party member',
          followersCount: baseHost?.followersCount || 0,
          followingCount: baseHost?.followingCount || 0,
          likesCount: baseHost?.likesCount || 0,
          level: Number(v.level ?? baseHost?.level ?? 0),
          xp: baseHost?.xp || 0,
          nextLevelXp: baseHost?.nextLevelXp || 50000,
          vipTier: v.vipTier ?? baseHost?.vipTier ?? 0,
          countryFlag: v.countryFlag || baseHost?.countryFlag,
          coins: baseHost?.coins || 0,
          diamonds: baseHost?.diamonds || 0,
          isVerified: baseHost?.isVerified || false,
          isHost: isHostPeer,
        });
      });

      if (effectiveUserId) {
        addUniqueViewer({
          ...currentUser,
          id: effectiveUserId,
          isHost: effectiveUserId === activePartyRoom.host?.id,
        });
      }
    } else {
      wsPartyViewers.forEach((v) => {
        const isHostPeer = v.isHost || v.id === activePartyRoom.host?.id;
        addUniqueViewer({
          ...currentUser,
          id: v.id,
          uniqueId: v.uniqueId || v.id,
          displayName: v.displayName || 'Alpha User',
          avatar: safeImageSrc(v.avatar, DEFAULT_AVATAR_URL) || DEFAULT_AVATAR_URL,
          level: Number(v.level ?? 0),
          vipTier: Number(v.vipTier ?? 0),
          isHost: isHostPeer,
        });
      });
      if (effectiveUserId) {
        addUniqueViewer({
          ...currentUser,
          id: effectiveUserId,
          isHost: effectiveUserId === activePartyRoom.host?.id,
        });
      }
    }

    return Array.from(byId.values());
  }, [activePartyRoom, activeVoiceParticipants, wsPartyViewers, effectiveUserId, currentUser]);

  // Synchronize live activeViewers count strictly from deduplicated real active participants (0 when empty)
  useEffect(() => {
    if (!activePartyRoom?.id) {
      setActiveViewers(0);
      return;
    }
    const realCount = realViewersList.length;
    setActiveViewers(realCount);

    if (lastSyncedViewerCountRef.current !== realCount) {
      lastSyncedViewerCountRef.current = realCount;
      const patch: Record<string, unknown> = {
        activeViewers: realCount,
        lastSeenAtMs: Date.now(),
        ...(isHost ? { isHostPresent: true } : {}),
      };
      updatePartyRoomFields(activePartyRoom.id, patch).catch(() => {});
      // Announce ONLY presence/viewer count fields (never spread stale seats)
      realtimeSocket.announcePartyRoom({
        id: activePartyRoom.id,
        activeViewers: realCount,
        ...(isHost ? { isHostPresent: true } : {}),
        lastSeenAtMs: Date.now(),
      });
    }
  }, [activePartyRoom?.id, realViewersList.length, isHost]);

  // Subscribe to real Firestore party-room comments & gift events, and hydrate session Top Givers when open.
  useEffect(() => {
    if (!activePartyRoom?.id) return;
    const roomSessionId = activePartyRoom.sessionId;
    let unsubscribed = false;
    const unsubscribe = subscribeToPartyRoomMessages(
      activePartyRoom.id,
      (messages) => {
        if (unsubscribed) return;
        const mapped: ChatItem[] = messages.map((message: any) => ({
          id: message.id,
          sender: {
            ...message.sender,
            id: message.sender?.id || message.senderId,
          },
          text: message.text,
          type: message.type,
          giftName: message.giftName,
          giftIcon: message.giftIcon,
          giftCoins: message.giftCoins,
          timestamp: message.createdAt?.toDate
            ? message.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : 'Just now',
        }));
        setChatItems(mapped);

        // Reconstruct accurate session leaderboard from persisted session gift messages
        const giverMap = new Map<string, PartyLeaderboardEntry>();
        messages.forEach((message: any) => {
          if (message.type !== 'gift') return;
          const giftCoins = Math.max(0, Number(message.giftCoins) || 0);
          if (giftCoins <= 0) return;
          const sid = String(message.sender?.id || message.senderId || message.sender?.displayName || '').trim();
          if (!sid) return;
          const qty = Math.max(1, Number(message.quantity) || 1);
          const existing = giverMap.get(sid);
          if (existing) {
            existing.totalCoins += giftCoins;
            existing.giftCount = (existing.giftCount || 0) + qty;
            if (message.giftName) existing.lastGiftName = message.giftName;
            if (message.giftIcon) existing.lastGiftIcon = message.giftIcon;
          } else {
            const matchedSeatUser = activePartyRoom.seats?.find((s) => s.user?.id === sid)?.user;
            const resolvedUser: User =
              sid === currentUser.id || sid === auth.currentUser?.uid
                ? { ...currentUser, id: sid }
                : sid === activePartyRoom.host?.id
                ? activePartyRoom.host
                : matchedSeatUser || {
                    id: sid,
                    uniqueId: sid,
                    username: String(message.sender?.displayName || 'user').replace(/\s+/g, '').toLowerCase() || 'user',
                    displayName: String(message.sender?.displayName || 'Supporter'),
                    avatar: safeImageSrc(message.sender?.avatar, DEFAULT_AVATAR_URL) || DEFAULT_AVATAR_URL,
                    bio: 'Alpha Mate Member',
                    followersCount: 0,
                    followingCount: 0,
                    likesCount: 0,
                    level: Number(message.sender?.level ?? 0),
                    xp: 0,
                    nextLevelXp: 50000,
                    vipTier: Number(message.sender?.vipTier ?? 0),
                    coins: 0,
                    diamonds: 0,
                    isVerified: false,
                    isHost: Boolean(message.sender?.isHost),
                  };
            giverMap.set(sid, {
              user: resolvedUser,
              totalCoins: giftCoins,
              giftCount: qty,
              lastGiftName: message.giftName,
              lastGiftIcon: message.giftIcon,
            });
          }
        });
        setPartyGivers(Array.from(giverMap.values()).sort((a, b) => b.totalCoins - a.totalCoins));
      },
      (error) => {
        if (!unsubscribed) {
          showToast(`Room chat connection error: ${error.message}`);
        }
      },
      roomSessionId
    );
    return () => {
      unsubscribed = true;
      unsubscribe();
    };
  }, [activePartyRoom?.id, activePartyRoom?.sessionId, partyRefreshTick]);

  // Shared real-time room heart count and incoming double-tap events scoped to session.
  useEffect(() => {
    const roomId = activePartyRoom?.id;
    const roomSessionId = activePartyRoom?.sessionId;
    if (!roomId) { setTotalHeartCount(0); return; }
    const offCount = subscribeToLiveHeartCount('party', roomId, setTotalHeartCount, (e) => console.warn('[Party hearts]', e), roomSessionId);
    const offEvents = subscribeToLiveHeartEvents('party', roomId, (event) => {
      if (event.senderId !== auth.currentUser?.uid) { spawnHeart(); spawnHeart(); }
    }, (e) => console.warn('[Party heart events]', e), roomSessionId);
    return () => { offCount(); offEvents(); };
  }, [activePartyRoom?.id, activePartyRoom?.sessionId, partyRefreshTick]);

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
    // A real user gesture is required by mobile browsers to unlock remote audio playback.
    unlockAllRemoteAudioPlayback().catch(() => {});
    const now = Date.now();
    const timeDiff = now - lastTapRef.current;
    if (timeDiff < 320) {
      const clientX = 'touches' in e && e.touches[0] ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
      const clientY = 'touches' in e && e.touches[0] ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
      spawnHeart(clientX, clientY);
      spawnHeart(clientX ? clientX + 15 : undefined, clientY ? clientY - 15 : undefined);
      lastHeartSentAtRef.current = Date.now();
      if (activePartyRoom?.id) sendLiveHeart('party', activePartyRoom.id, activePartyRoom.sessionId).catch((err) => console.warn('[Party heart send]', err));
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
  };

  // Send Chat Comment
  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePartyRoom || !inputChat.trim()) return;

    const isHost = activePartyRoom.host?.id === currentUser.id;
    const msgId = `chat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const newMsg: ChatItem = {
      id: msgId,
      sender: {
        id: auth.currentUser?.uid || currentUser.id,
        displayName: currentUser.displayName,
        avatar: currentUser.avatar,
        vipTier: currentUser.vipTier ?? 0,
        level: currentUser.level ?? 0,
        isHost,
      },
      text: inputChat.trim(),
      type: isHost ? 'host' : 'room',
      timestamp: 'Just now',
    };

    setChatItems((prev) => [...prev.slice(-149), newMsg]);
    setInputChat('');
    sendPartyRoomMessage(
      activePartyRoom.id,
      {
        id: msgId,
        sender: { id: currentUser.id, displayName: currentUser.displayName, avatar: currentUser.avatar, vipTier: currentUser.vipTier, level: currentUser.level, isHost },
        text: newMsg.text,
        type: isHost ? 'host' : 'room',
      },
      activePartyRoom.sessionId
    ).catch((error) => showToast(error instanceof Error ? error.message : 'Message could not be sent.'));
  };

  // Send Virtual Gift (strictly validated and scoped to this activePartyRoom.id)
  const handleSendSelectedGift = () => {
    if (!activePartyRoom?.id) return;
    const giftCost = selectedGift.costInCoins ?? selectedGift.coins;
    if (coins < giftCost) {
      showToast(
        `Insufficient coins! You need ${giftCost.toLocaleString()} coins for ${selectedGift.name}. Recharge in Wallet 💰`
      );
      return;
    }

    const recipient = giftRecipientUser
      ? giftRecipientUser.displayName
      : activePartyRoom.host.displayName || 'Host';
    const recipientId = giftRecipientUser
      ? giftRecipientUser.id
      : activePartyRoom.host.id || currentUser.id;

    const sentOk = sendLiveGift(selectedGift, recipientId, 1, recipient, {
      context: 'party',
      roomId: activePartyRoom.id,
    });
    if (!sentOk) return;
    clearActiveGiftBanner();

    const now = Date.now();
    spawnHeart();

    // Broadcast gift animation signal ONLY to participants inside this Party Room
    realtimeSocket.sendRoomSignal('party', activePartyRoom.id, {
      type: 'gift_combo',
      roomId: activePartyRoom.id,
      gift: selectedGift,
      senderName: currentUser.displayName,
      senderAvatar: currentUser.avatar,
      senderVipTier: currentUser.vipTier ?? 0,
      recipientName: recipient,
      comboCount: 1,
      quantity: 1,
      timestamp: now,
    });

    // Trigger scoped banner / animation via priority queue
    enqueuePartyGiftAnimation({
      id: `party_gift_${activePartyRoom.id}_${now}_${Math.random().toString(36).slice(2, 7)}`,
      gift: selectedGift,
      senderName: currentUser.displayName,
      senderAvatar: currentUser.avatar,
      senderVipTier: currentUser.vipTier ?? 0,
      recipientName: recipient,
      comboCount: 1,
      quantity: 1,
      timestamp: now,
      roomId: activePartyRoom.id,
    });

    const giftMsgId = `gift_${now}_${Math.random().toString(36).slice(2, 7)}`;
    const giftMsg: ChatItem = {
      id: giftMsgId,
      sender: {
        id: auth.currentUser?.uid || currentUser.id,
        displayName: currentUser.displayName,
        avatar: currentUser.avatar,
        vipTier: currentUser.vipTier ?? 0,
        level: currentUser.level ?? 0,
      },
      text: `sent ${selectedGift.name} to ${recipient}`,
      type: 'gift',
      giftName: selectedGift.name,
      giftIcon: selectedGift.icon,
      giftCoins: giftCost,
      timestamp: 'Just now',
    };

    setChatItems((prev) => [...prev.slice(-149), giftMsg]);

    sendPartyRoomMessage(
      activePartyRoom.id,
      {
        id: giftMsgId,
        sender: {
          id: auth.currentUser?.uid || currentUser.id,
          displayName: currentUser.displayName,
          avatar: currentUser.avatar,
          vipTier: currentUser.vipTier ?? 0,
          level: currentUser.level ?? 0,
        },
        text: giftMsg.text,
        type: 'gift',
        giftId: selectedGift.id,
        giftName: selectedGift.name,
        giftIcon: selectedGift.icon,
        giftCoins: giftCost,
        quantity: 1,
        recipientId,
        recipientName: recipient,
      },
      activePartyRoom.sessionId
    ).catch(() => {});

    // Increment receivedCoins on targeted seated guest if recipient occupies a seat
    const targetSeatIdx = (activePartyRoom.seats || []).findIndex(
      (s) => s.user && s.user.id === recipientId
    );
    if (targetSeatIdx !== -1) {
      const updatedSeats = activePartyRoom.seats.map((s, idx) =>
        idx === targetSeatIdx
          ? { ...s, receivedCoins: (Number(s.receivedCoins) || 0) + giftCost }
          : s
      );
      updatePartyRoomFields(activePartyRoom.id, { seats: updatedSeats }).catch(() => {});
    }

    // Dynamically update Party Room Leaderboard
    setPartyGivers((prev) => {
      const mySenderId = auth.currentUser?.uid || currentUser.id;
      const existingIdx = prev.findIndex((g) => g.user.id === mySenderId || g.user.id === currentUser.id);
      let updated: PartyLeaderboardEntry[];
      if (existingIdx !== -1) {
        updated = prev.map((g, idx) =>
          idx === existingIdx
            ? {
                ...g,
                totalCoins: g.totalCoins + giftCost,
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
            user: { ...currentUser, id: mySenderId },
            totalCoins: giftCost,
            giftCount: 1,
            lastGiftName: selectedGift.name,
            lastGiftIcon: selectedGift.icon,
          },
        ];
      }
      return updated.sort((a, b) => b.totalCoins - a.totalCoins);
    });

    if (isRoomPKActive) {
      setLeftRoomPKScore((prev) => prev + giftCost);
    }

    setShowGiftDrawer(false);
    setGiftRecipientUser(null);
    showToast(`Sent ${selectedGift.name} to ${recipient}! 🎁`);
  };

  // Seat Click handler (take empty seat / step down / lock / interact with occupied seat / VIP 1 Host-only controls)
  const handleSeatClick = async (seat: PartySeat) => {
    if (!activePartyRoom) return;

    const isVipSeat = seat.seatIndex === VIP_GUEST_SEAT_INDEX;

    if (seat.user === null) {
      // VIP 1 Guest Seat permission rule: locked by default; ONLY the Host can unlock and assign a guest.
      if (isVipSeat) {
        if (isHost) {
          setShowSeatActionModal(VIP_GUEST_SEAT_INDEX);
        } else {
          showToast(
            seat.isLocked
              ? 'VIP 1 is locked — only the Host can unlock & assign a VIP Guest 👑'
              : 'Only the Host can assign a VIP Guest to VIP 1 👑'
          );
        }
        return;
      }

      if (seat.isLocked) {
        if (canModerate) {
          setShowSeatActionModal(seat.seatIndex);
        } else {
          showToast('This seat is locked by the Host 🔒');
        }
        return;
      }

      if (kickedUserIds.includes(effectiveUserId) || blockedUserIds.includes(effectiveUserId)) {
        showToast('You cannot take a seat in this room! 🚫');
        return;
      }

      if (canModerate) {
        setShowSeatActionModal(seat.seatIndex);
        return;
      }

      const res = await toggleSeat(seat.seatIndex);
      if (res.success) {
        showToast(`Joined Seat ${seat.seatIndex + 1}! 🎙️`);
      } else if (res.reason === 'IN_PROGRESS') {
        return;
      } else if (res.reason === 'SEAT_LOCKED') {
        showToast('This seat is locked by the Host 🔒');
      } else if (res.reason === 'SEAT_OCCUPIED') {
        showToast('That seat was just taken by someone else.');
      } else if (res.reason === 'USER_RESTRICTED') {
        showToast('You are restricted from taking a seat here. 🚫');
      } else {
        showToast('Unable to join seat right now.');
      }
      return;
    }

    if (seat.user.id === effectiveUserId || seat.user.id === currentUser.id) {
      setShowSeatActionModal(seat.seatIndex);
      return;
    }

    setSelectedUserForActionSheet(seat.user);
    setSelectedUserSeatIndex(seat.seatIndex);
    setShowUserActionSheet(true);
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
  // Keep all React hooks above the conditional room/lobby returns.
  // Calling this memo below the activePartyRoom early-return changes hook order
  // when a user enters a room and causes React to crash into a blank screen.
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

  // IF INSIDE AN ACTIVE PARTY ROOM -> RENDER MASTER PARTY ROOM UI
  // =========================================================================
  if (activePartyRoom) {
    const currentTrack = PLAYLIST_TRACKS[currentTrackIndex];
    const remoteHostPresence = voiceParticipantsById.get(activePartyRoom.host.id);
    const isHostSeatedOnThrone =
      isHost ||
      wsPartyViewers.some((v) => v.id === activePartyRoom.host.id) ||
      activePartyRoom.isHostPresent !== false;
    const effectiveHostMicMuted = isHost
      ? isHostMicMuted
      : Boolean(remoteHostPresence ? remoteHostPresence.isMuted : false);
    const effectiveHostSpeaking =
      isHostSeatedOnThrone &&
      !effectiveHostMicMuted &&
      (isHost
        ? isHostSpeaking
        : Boolean(
            remoteHostPresence?.isSpeaking || remoteSpeakingPeerIds.has(activePartyRoom.host.id)
          ));

    return (
      <div
        ref={partyRoomRootRef}
        onDoubleClick={(e) => {
          spawnHeart(e.clientX, e.clientY);
          spawnHeart(e.clientX + 10, e.clientY - 20);
          if (Date.now() - lastHeartSentAtRef.current > 180) {
            lastHeartSentAtRef.current = Date.now();
            if (activePartyRoom?.id) sendLiveHeart('party', activePartyRoom.id, activePartyRoom.sessionId).catch((err) => console.warn('[Party heart send]', err));
          }
        }}
        onTouchStart={handleScreenTouchOrClick}
        className="relative w-full h-full bg-[#080313] text-white flex flex-col overflow-hidden select-none z-40"
      >
        <PullToRefresh
          scrollContainerRef={partyRoomRootRef}
          label="Refreshing Party Room..."
          onRefresh={() => refreshScope('party_room')}
        />
        {/* Mounted DOM Audio Outputs for Two-Way Cloudflare SFU Party Voice (strict self-echo filter) */}
        <div className="fixed left-0 bottom-0 w-2 h-2 opacity-0 pointer-events-none overflow-hidden">
          {remotePartyStreams
            .filter(({ peerId }) => peerId !== effectiveUserId && peerId !== auth.currentUser?.uid)
            .map(({ peerId, stream }) => (
              <PartyRemoteAudioPlayer
                key={peerId}
                peerId={peerId}
                stream={stream}
                isSpeakerOn={isSpeakerOn}
                onRegisterAudioEl={registerPartyAudioEl}
                onAutoplayStateChange={handleAutoplayStateChange}
              />
            ))}
        </div>

        {/* =====================================================================
            1. COMPLETE NIGHTCLUB PARTY ROOM BACKGROUND (5 Custom Themes)
           ===================================================================== */}
        <PartyRoomAtmosphere
          isMusicPlaying={isMusicPlaying}
          theme={roomBackground}
          hostAvatar={getHdImageUrl(activePartyRoom.coverImageUrl || activePartyRoom.host.avatar)}
        />

        {/* LAYER 2 (z-[5]): Background Gift Animation Layer for Mode 3 (Overlay/Background behind Host & Seats) */}
        <GiftAnimationOverlay
          layer="background"
          currentEvent={
            activePartyGiftAnimation && activePartyGiftAnimation.roomId === activePartyRoom.id
              ? activePartyGiftAnimation
              : null
          }
          onComplete={handlePartyGiftOverlayComplete}
        />

        {/* Toast Alert Feedback */}
        {toastMessage && (
          <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-[#180E2C]/95 border border-[#A855F7]/40 text-white text-xs font-bold shadow-2xl backdrop-blur-md flex items-center gap-2 animate-bounce pointer-events-none max-w-[calc(100%-2rem)]">
            <Sparkles className="w-3.5 h-3.5 text-[#EC4899]" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Floating Animated Hearts Area (positioned cleanly above corner vinyl turntable) */}
        <div className="absolute right-5 bottom-44 z-20 pointer-events-none w-20 h-48 flex flex-col items-center justify-end">
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

        {/* LAYER 5 (z-[35]): Foreground Gift Animation Layer for Mode 1 (Transparent) & Mode 2 (Semi-Transparent) */}
        <GiftAnimationOverlay
          layer="foreground"
          currentEvent={
            activePartyGiftAnimation && activePartyGiftAnimation.roomId === activePartyRoom.id
              ? activePartyGiftAnimation
              : null
          }
          onComplete={handlePartyGiftOverlayComplete}
        />

        {/* =====================================================================
            2. ROOM HEADER & LEVEL SWITCHER (Layer 7 z-[45] — Always Above Animations)
           ===================================================================== */}
        <div className="relative z-[45] pt-1.5 px-2.5 pb-1.5 flex flex-col gap-1.5 border-b border-[#A855F7]/15 bg-black/45 backdrop-blur-md shrink-0">
          {/* Room identity on the left; exit action on the opposite/right edge */}
          <div className="flex items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <img src={getHdImageUrl(activePartyRoom.coverImageUrl || activePartyRoom.host.avatar, DEFAULT_AVATAR_URL)} alt="Room cover" className="w-7 h-7 rounded-lg object-cover border border-[#EC4899]/50 shrink-0 shadow-sm" />
                <Radio className="w-3.5 h-3.5 text-[#EC4899] animate-pulse shrink-0" />
                <h2 className="text-xs sm:text-sm font-extrabold text-white truncate max-w-[120px] sm:max-w-[170px]">
                  {activePartyRoom.title || `${activePartyRoom.host.displayName}'s Party Room`}
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[10px] text-zinc-400">
                <button
                  onClick={() => setShowViewersModal(true)}
                  className="flex items-center gap-1 text-[#C084FC] hover:text-white font-semibold cursor-pointer px-1.5 py-0.5 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
                  title="View All Audience & Live Viewers"
                >
                  <Eye className="w-3 h-3 text-cyan-400" />
                  <span>{activeViewers.toLocaleString()}</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    spawnHeart();
                    if (activePartyRoom?.id) {
                      sendLiveHeart('party', activePartyRoom.id, activePartyRoom.sessionId).catch((err) => console.warn('[Party hearts]', err));
                    }
                  }}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-pink-500/15 border border-pink-400/40 text-pink-200 hover:bg-pink-500/25 active:scale-95 transition-all cursor-pointer shrink-0"
                  title="Send a heart to this Party"
                  aria-label="Send heart"
                >
                  <Heart className="w-3.5 h-3.5 fill-pink-500 text-pink-300" />
                  <span className="text-[10px] font-black tabular-nums">{totalHeartCount.toLocaleString()}</span>
                </button>
                <span className="text-[9px] font-extrabold text-white truncate max-w-[92px]">{activePartyRoom.host.displayName}</span>
                <span className="text-[7px] text-emerald-300 font-bold shrink-0">HOST</span>
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
                      src={safeImageSrc(partyGivers[0].user.avatar, DEFAULT_AVATAR_URL)}
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
            <button
              onClick={handleExitClick}
              className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-zinc-300 hover:text-white cursor-pointer shrink-0 active:scale-90 transition-transform"
              title="Exit Lounge"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Right: Host & Moderator Room Controls + Share & Refresh */}
          <div className="flex flex-wrap items-center justify-end gap-1 sm:gap-1.5 w-full min-w-0">
            {/* Dynamic Level Switcher Capsule (4 / 8 / 12 / 16 Seats) — Host & Moderator only */}
            {canModerate && <div
              className="flex items-center p-0.5 rounded-full bg-[#180C2E]/90 border border-[#A855F7]/40 shadow-inner"
              title="Party Room Seat Capacity: 4, 8, 12, or 16 Seats"
            >
              {PARTY_TIER_SETTINGS.map((tier) => {
                const isActive = partyLevel === tier.level;
                const isUnlocked = isHost
                  ? currentUser.level >= tier.requiredLevel
                  : (activePartyRoom?.host.level ?? 0) >= tier.requiredLevel;

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
            </div>}

            {/* Room PK management action — Host & Moderator only */}
            {canModerate && (
            <button
              onClick={handleOpenRoomPK}
              className={`px-2.5 py-1 rounded-full text-[9px] font-black transition-all cursor-pointer flex items-center gap-1 shadow-sm ${
                isRoomPKActive
                  ? 'bg-gradient-to-r from-[#EC4899] to-[#F43F5E] text-white animate-pulse border border-pink-400'
                  : partyLevel >= 3
                  ? 'bg-[#180C2E] text-zinc-500 border border-white/5 opacity-70 cursor-pointer'
                  : 'bg-gradient-to-r from-[#EC4899] to-[#7928CA] text-white hover:opacity-95 border border-[#EC4899]/50 shadow-md shadow-[#EC4899]/30'
              }`}
              title={
                partyLevel >= 3
                  ? 'Room PK: Only available in 4-Seat & 8-Seat rooms (Not supported in 12/16-Seat)'
                  : isRoomPKActive
                  ? 'Room PK in Progress (5 Mins)'
                  : 'Invite Another Room for 5-Min PK Battle'
              }
            >
              <Swords className="w-3 h-3 text-white" />
              <span>{isRoomPKActive ? 'PK LIVE' : 'ROOM PK'}</span>
            </button>
            )}

            {/* Host/moderator-only leaderboard */}
            {canModerate && <button
              onClick={() => setShowLeaderboardModal(true)}
              className="w-8 h-8 rounded-full bg-[#180C2E] border border-amber-400/40 flex items-center justify-center text-amber-400 hover:text-amber-200 cursor-pointer shadow-sm hover:border-amber-400 transition-colors"
              title="Party Room Leaderboard"
            >
              <Trophy className="w-3.5 h-3.5 fill-current" />
            </button>}

            {/* Host & Moderator Session Insights dashboard button */}
            {canModerate && (
              <button
                type="button"
                onClick={() => setShowHostAnalyticsCard(true)}
                className="w-8 h-8 rounded-full bg-[#180C2E] border border-sky-400/35 hover:border-sky-300 flex items-center justify-center text-sky-300 hover:text-sky-200 cursor-pointer shadow-sm transition-colors"
                title="Session Insights"
                aria-label="Session Insights"
              >
                <TrendingUp className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Active Voice Modulation Indicator (Only for seated speakers / Host when filter is live) */}
            {canUseSpeakerMic && activeVoiceFilter !== 'normal' && (
              <button
                type="button"
                onClick={() => setShowVoiceFilterModal(true)}
                className="h-8 px-2.5 rounded-full bg-gradient-to-r from-[#7928CA] to-[#EC4899] border border-white/25 flex items-center gap-1 text-[10px] font-extrabold text-white shadow-md hover:brightness-110 cursor-pointer shrink-0 transition-all"
                title="Active Voice Filter — tap to switch or reset"
              >
                <Wand2 className="w-3 h-3 text-amber-200 animate-pulse" />
                <span>{audioFilter.getPresetMeta(activeVoiceFilter).shortLabel}</span>
              </button>
            )}

            {/* Room background theme picker — Host & Moderator only */}
            {canModerate && (
              <button
                type="button"
                onClick={() => setShowBackgroundModal(true)}
                className="w-8 h-8 rounded-full bg-[#180C2E] border border-[#EC4899]/35 hover:border-[#EC4899] flex items-center justify-center text-zinc-200 hover:text-white cursor-pointer transition-colors"
                title="Party Room Background Themes"
                aria-label="Party Room Background Themes"
              >
                <Palette className="w-3.5 h-3.5 text-[#EC4899]" />
              </button>
            )}

            {/* Real-Time Network Latency Monitor (Host & Moderator Only, Party Agora RTC) */}
            {canModerate && activePartyRoom?.id && (
              <NetworkLatencyMonitor
                mode="party_room"
                sessionId={activePartyRoom.id}
                enabled={canModerate}
              />
            )}

            {/* Refresh Party Room & Voice */}
            <RefreshScopeButton
              scope="party_room"
              compact
              className="w-8 h-8 bg-[#180C2E]"
              title="Refresh Party Room & Voice"
            />

            {/* Quick Share Party Header Button */}
            <button
              type="button"
              onClick={() => setShowShareModal(true)}
              className="w-8 h-8 rounded-full bg-[#180C2E] border border-amber-400/35 hover:border-amber-300 flex items-center justify-center text-amber-300 hover:text-amber-200 cursor-pointer transition-colors"
              title="Share Party"
              aria-label="Share Party"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Dedicated non-blocking VIP Entry Animation lane (directly below header) */}
        <div className="relative z-[42] h-0 overflow-visible pointer-events-none">
          <VipEntryBannerOverlay
            currentEvent={
              activeVipEntry && activeVipEntry.roomId === activePartyRoom.id
                ? activeVipEntry
                : null
            }
            onComplete={handleVipEntryComplete}
          />
        </div>

        {/* Autoplay Recovery Banner for Remote Party Voice */}
        {partyAudioAutoplayBlocked && (
          <div className="relative z-30 px-3 py-1.5 flex justify-center">
            <button
              onClick={() => {
                setIsSpeakerOn(true);
                isSpeakerOnRef.current = true;
                unlockAllRemoteAudioPlayback();
              }}
              className="px-4 py-1.5 rounded-full bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white text-[11px] font-black shadow-lg border border-white/25 cursor-pointer flex items-center gap-1.5"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>Tap to Unmute Room Audio</span>
            </button>
          </div>
        )}

        {/* Non-blocking Party Voice Reconnecting Status */}
        {partyVoiceReconnecting && !partyVoiceError && (
          <div className="relative z-30 mx-3 mt-1 px-3 py-1.5 rounded-xl bg-amber-950/85 border border-amber-500/35 text-amber-200 text-[10px] flex items-center justify-between gap-2">
            <span className="truncate">{partyVoiceReconnecting}</span>
          </div>
        )}

        {/* Party Voice Error Notice (only shown after automatic reconnect exhausts or permanent error) */}
        {partyVoiceError && (
          <div className="relative z-30 mx-3 mt-1 px-3 py-2 rounded-xl bg-rose-950/90 border border-rose-500/40 text-rose-200 text-[10px] flex items-start justify-between gap-2">
            <span className="leading-snug break-words">{partyVoiceError}</span>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => {
                  setPartyVoiceError(null);
                  setPartyVoiceRetryToken((prev) => prev + 1);
                }}
                className="text-amber-300 hover:text-white font-bold cursor-pointer"
              >
                Retry
              </button>
              <button
                onClick={() => setPartyVoiceError(null)}
                className="text-rose-300 hover:text-white font-bold cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* =====================================================================
            AVAILABLE PARTY ROOM CONTENT AREA (Below Header)
            Dynamic Split:
            - Up to 12 seats (Levels 1, 2, 3): Seats <= 50% height, Lower Area >= 50%
            - 16 seats (Level 4): Seats <= 60% height, Lower Area >= 40%
           ===================================================================== */}
        <div className="relative z-10 flex-1 min-h-0 flex flex-col w-full overflow-hidden">
        {isRoomPKActive && activePKChallenger ? (
          <div className="shrink-0 w-full">
            <RoomPKSplitStage
              myRoom={activePartyRoom}
              opponentRoom={activePKChallenger}
              mySeats={activeGuestSeats}
              myPartyLevel={partyLevel}
              myRoomScore={leftRoomPKScore}
              opponentRoomScore={rightRoomPKScore}
              timeLeft={roomPKTimeLeft}
              isHost={isHost}
              isHostSpeaking={effectiveHostSpeaking}
              onEndPK={() => {
                setIsRoomPKActive(false);
                setShowRoomPKVictoryModal(true);
              }}
              onHostMicToggle={() => {
                if (isHost) {
                  const nextState = !isHostMicMuted;
                  setIsHostMicMuted(nextState);
                  agoraPartyEngine.toggleMicrophone(!nextState);
                  showToast(nextState ? 'Host Mic Muted 🔇' : 'Host Mic Live 🎙️');
                }
              }}
              isHostMicMuted={effectiveHostMicMuted}
              onSeatClick={handleSeatClick}
            />
          </div>
        ) : (
          <div
            className={`relative z-10 w-full shrink-0 flex flex-col items-center px-2.5 pt-1 pb-0.5 overflow-y-auto scrollbar-none transition-[height,max-height] duration-300 ${
              partyLevel === 4 ? 'h-[62%] max-h-[62%]' : 'h-[50%] max-h-[50%]'
            }`}
          >
            {/* Floating Three-Star Seat Theme Selector — Host & Moderator only */}
            {canModerate && (
              <div className="absolute right-2 top-1 z-30">
                <PartySeatThemeStarSelector
                  selectedTheme={seatTheme}
                  onSelectTheme={handleSelectSeatTheme}
                  orientation="vertical"
                />
              </div>
            )}

            {/* UPPER PROMINENCE ROW: Large Circular HOST Seat + VIP 1 (VIP GUEST) Seat Beside Host */}
            <div className="flex items-start justify-center gap-7 sm:gap-10 w-full max-w-sm mx-auto shrink-0 pt-0.5">
              {/* 1. HOST SEAT (Large Circular Frame with Synchronized Animated Seat Theme) */}
              <div className="flex flex-col items-center shrink-0">
                <div className="relative">
                  {isHostSeatedOnThrone ? (
                    <div
                      className="relative cursor-pointer group"
                      onClick={() => {
                        if (isHost) {
                          const nextState = !isHostMicMuted;
                          setIsHostMicMuted(nextState);
                          agoraPartyEngine.toggleMicrophone(!nextState);
                          showToast(nextState ? 'Host Mic Muted 🔇' : 'Host Mic Live 🎙️');
                        } else {
                          setSelectedUserForActionSheet(activePartyRoom.host);
                          setSelectedUserSeatIndex(null);
                          setShowUserActionSheet(true);
                        }
                      }}
                    >
                      {/* Host Speaking Soundwave Waves (strictly live audio, never shown when muted) */}
                      {effectiveHostSpeaking && (
                        <>
                          <div className="absolute -inset-2 rounded-full border-2 border-[#EC4899]/75 animate-ping opacity-75 pointer-events-none" />
                          <div className="absolute -inset-3.5 rounded-full border border-[#A855F7]/45 animate-pulse pointer-events-none" />
                        </>
                      )}

                      <AnimatedSeatThemeFrame
                        theme={seatTheme}
                        role="host"
                        compact={partyLevel === 4}
                        sizeClass={
                          partyLevel === 4
                            ? 'w-[58px] h-[58px] sm:w-[66px] sm:h-[66px]'
                            : 'w-[68px] h-[68px] sm:w-[76px] sm:h-[76px]'
                        }
                      >
                        <div className="w-full h-full rounded-full overflow-hidden bg-[#120826] transition-transform group-hover:scale-[1.03]">
                          <img
                            src={safeImageSrc(activePartyRoom.host.avatar, DEFAULT_AVATAR_URL)}
                            alt={activePartyRoom.host.displayName}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </AnimatedSeatThemeFrame>

                      {/* Host Microphone Status Badge */}
                      <div
                        className={`absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center border border-white/40 shadow-md z-30 ${
                          effectiveHostMicMuted ? 'bg-rose-600 text-white' : 'bg-emerald-500 text-black'
                        }`}
                      >
                        {effectiveHostMicMuted ? (
                          <MicOff className="w-3 h-3" />
                        ) : (
                          <Mic className="w-3 h-3" />
                        )}
                      </div>
                    </div>
                  ) : (
                    <AnimatedSeatThemeFrame
                      theme={seatTheme}
                      role="host"
                      compact={partyLevel === 4}
                      sizeClass={
                        partyLevel === 4
                          ? 'w-[58px] h-[58px] sm:w-[66px] sm:h-[66px]'
                          : 'w-[68px] h-[68px] sm:w-[76px] sm:h-[76px]'
                      }
                    >
                      <div
                        className="relative w-full h-full rounded-full overflow-hidden"
                        title="Host Seat Empty — Host is currently away"
                      >
                        <AnimatedEmptySeatSofa
                          theme={seatTheme}
                          isVip
                          compact={partyLevel === 4}
                        />
                      </div>
                    </AnimatedSeatThemeFrame>
                  )}
                </div>

                {/* HOST Label & Name Underneath */}
                <div className="mt-1.5 flex items-center gap-1 justify-center">
                  <span className="px-1.5 py-[1px] rounded-full bg-gradient-to-r from-amber-400 to-amber-500 text-black text-[8px] font-black tracking-wider uppercase shadow-sm">
                    HOST
                  </span>
                  <span className="text-[10px] font-bold text-white truncate max-w-[78px]">
                    {activePartyRoom.host.displayName.split(' ')[0]}
                  </span>
                </div>
              </div>

              {/* 2. VIP 1 – VIP GUEST SEAT (Separate Premium Circular Seat Beside Host, Locked by Default) */}
              <div
                onClick={() => handleSeatClick(vipGuestSeat)}
                className="flex flex-col items-center shrink-0 cursor-pointer group transition-transform active:scale-95 pt-0.5"
                title={
                  vipGuestSeat.user
                    ? `VIP 1 • ${vipGuestSeat.user.displayName}`
                    : vipGuestSeat.isLocked
                    ? 'VIP 1 (Locked — Host only can unlock & assign)'
                    : 'VIP 1 (Unlocked — Host can assign a VIP Guest)'
                }
              >
                <div className="relative">
                  {/* Speaking Wave for Assigned VIP Guest */}
                  {vipGuestSeat.user && vipGuestSeat.isSpeaking && !vipGuestSeat.isMuted && (
                    <>
                      <div className="absolute -inset-2 rounded-full border-2 border-amber-400/80 animate-ping opacity-75 pointer-events-none" />
                      <div className="absolute -inset-3 rounded-full border border-[#A855F7]/50 animate-pulse pointer-events-none" />
                    </>
                  )}

                  {/* Animated Theme Frame around VIP 1 Seat */}
                  <AnimatedSeatThemeFrame
                    theme={seatTheme}
                    role="vip"
                    compact={partyLevel === 4}
                    sizeClass={
                      partyLevel === 4
                        ? 'w-[48px] h-[48px] sm:w-[56px] sm:h-[56px]'
                        : 'w-[58px] h-[58px] sm:w-[66px] sm:h-[66px]'
                    }
                  >
                    {vipGuestSeat.user ? (
                      <div className="w-full h-full rounded-full overflow-hidden bg-[#120826] transition-transform group-hover:scale-[1.03]">
                        <img
                          src={safeImageSrc(vipGuestSeat.user.avatar, DEFAULT_AVATAR_URL)}
                          alt={vipGuestSeat.user.displayName}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <AnimatedEmptySeatSofa
                        theme={seatTheme}
                        isLocked={vipGuestSeat.isLocked}
                        isVip
                        compact={partyLevel === 4}
                      />
                    )}
                  </AnimatedSeatThemeFrame>

                  {/* Lock / Mic Status Badge on VIP 1 */}
                  {vipGuestSeat.user ? (
                    <div
                      className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center border border-white/30 shadow-md z-30 ${
                        vipGuestSeat.isMuted
                          ? vipGuestSeat.isHostMuted
                            ? 'bg-rose-700 text-white ring-1 ring-amber-400'
                            : 'bg-rose-600 text-white'
                          : 'bg-emerald-500 text-black'
                      }`}
                    >
                      {vipGuestSeat.isHostMuted ? (
                        <Lock className="w-2.5 h-2.5 text-amber-300" />
                      ) : vipGuestSeat.isMuted ? (
                        <MicOff className="w-2.5 h-2.5" />
                      ) : (
                        <Mic className="w-2.5 h-2.5" />
                      )}
                    </div>
                  ) : (
                    <div
                      className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center border border-amber-300/60 shadow-md z-30 ${
                        vipGuestSeat.isLocked
                          ? 'bg-[#1D0F38] text-amber-300'
                          : 'bg-gradient-to-tr from-amber-400 to-purple-600 text-white'
                      }`}
                    >
                      {vipGuestSeat.isLocked ? (
                        <Lock className="w-2.5 h-2.5" />
                      ) : (
                        <Unlock className="w-2.5 h-2.5" />
                      )}
                    </div>
                  )}
                </div>

                {/* VIP 1 Label + VIP GUEST Subtitle */}
                <div className="mt-1.5 flex flex-col items-center leading-tight">
                  <span className="text-[9.5px] font-black text-amber-300 tracking-wide truncate max-w-[78px]">
                    {vipGuestSeat.user
                      ? `${vipGuestSeat.user.displayName.split(' ')[0]}`
                      : 'VIP 1'}
                  </span>
                  <span className="text-[7.5px] font-extrabold uppercase tracking-wider text-purple-200/90">
                    {vipGuestSeat.user ? 'VIP 1 • VIP GUEST' : 'VIP GUEST'}
                  </span>
                </div>
              </div>
            </div>

            {/* Existing Host Badges + Quick Moderation Controls (Preserved Compactly) */}
            <div className="mt-1 flex items-center gap-1 flex-wrap justify-center shrink-0">
              {!isHostSeatedOnThrone && (
                <span className="px-2 py-0.2 rounded-full bg-zinc-900/90 text-zinc-300 text-[8px] font-bold border border-white/15">
                  Host Seat Empty
                </span>
              )}
              <LevelBadgeIcon level={activePartyRoom.host.level ?? 0} size="xs" />
              {(activePartyRoom.host.vipTier ?? 0) > 0 && (
                <span className="px-1.5 py-0.2 rounded bg-[#7928CA]/30 text-[#C084FC] text-[8px] font-black border border-[#A855F7]/30">
                  VIP {activePartyRoom.host.vipTier}
                </span>
              )}
              <button
                onClick={() => setShowLeaderboardModal(true)}
                className="px-2 py-0.2 rounded-full bg-gradient-to-r from-amber-500/20 to-yellow-500/10 text-amber-300 text-[8px] font-bold border border-amber-400/30 flex items-center gap-1 cursor-pointer hover:border-amber-400 transition-colors"
                title="Party Room Top Contributors Leaderboard"
              >
                <span>💰 {(activePartyRoom.totalGiftCoins || 0).toLocaleString()}</span>
                <span className="text-[7.5px] font-black text-amber-400">🏆 Top</span>
              </button>
              <button
                onClick={() => {
                  const nextFollow = !isFollowingHost;
                  setIsFollowingHost(nextFollow);
                  if (nextFollow && activePartyRoom?.host?.id && activePartyRoom.host.id !== currentUser.id) {
                    sendNotificationToUser({
                      recipientId: activePartyRoom.host.id,
                      type: 'follow',
                      category: 'friendRequests',
                      title: `⭐ ${currentUser.displayName} followed your Party Room!`,
                      message: `${currentUser.displayName} started following you.`,
                      screen: 'party_room',
                      roomId: activePartyRoom.id,
                    }).catch(() => {});
                  }
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
              <div className="flex items-center justify-between max-w-xs mx-auto w-full bg-black/45 rounded-full border border-purple-500/20 px-2.5 py-0.5 text-[9px] mt-1 shrink-0">
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
                NORMAL CIRCULAR GUEST SEATS GRID (Progressive 4 / 8 / 12 / 16)
               =================================================================== */}
            <div className="w-full mt-1.5 flex-1 flex flex-col justify-start">
              {partyLevel === 1 && (
                /* LEVEL 1: 4 normal circular seats (1 Row x 4) */
                <div className="grid grid-cols-4 gap-x-3 gap-y-2.5 max-w-sm mx-auto w-full px-1">
                  {activeGuestSeats.map((seat) => renderGuestSeat(seat, 'lg'))}
                </div>
              )}

              {partyLevel === 2 && (
                /* LEVEL 2: 8 normal circular seats (2 Rows x 4) */
                <div className="grid grid-cols-4 gap-x-3 gap-y-2 max-w-sm mx-auto w-full px-1">
                  {activeGuestSeats.map((seat) => renderGuestSeat(seat, 'md'))}
                </div>
              )}

              {partyLevel === 3 && (
                /* LEVEL 3: 12 normal circular seats (3 Rows x 4) */
                <div className="grid grid-cols-4 gap-x-2.5 gap-y-1.5 max-w-sm mx-auto w-full px-1">
                  {activeGuestSeats.map((seat) => renderGuestSeat(seat, 'sm'))}
                </div>
              )}

              {partyLevel === 4 && (
                /* LEVEL 4: 16 normal circular seats (4 Rows x 4) */
                <div className="grid grid-cols-4 gap-x-2.5 gap-y-1 max-w-sm mx-auto w-full px-1">
                  {activeGuestSeats.map((seat) => renderGuestSeat(seat, 'xs'))}
                </div>
              )}
            </div>

            {/* Seat Status & Capacity Indicator */}
            <div className="flex items-center justify-center gap-2 mt-1 shrink-0">
              <span className="text-[9px] text-zinc-300 font-medium px-2 py-0.2 rounded-full bg-black/40 backdrop-blur-md border border-white/5">
                {userSeatIndex === VIP_GUEST_SEAT_INDEX
                  ? 'Seated on VIP 1'
                  : userSeatIndex !== null
                  ? `Seated on #${userSeatIndex + 1}`
                  : 'Tap (+) to take seat'}
              </span>
              <span className="text-[9px] font-bold text-[#C084FC] px-2 py-0.2 rounded-full bg-[#7928CA]/20 border border-[#A855F7]/30">
                {occupiedGuestSeatsCount}/{maxGuestSeats} Seats
              </span>
            </div>

            {/* Dynamic Seat Expansion prompt if room is full — Host & Moderator */}
            {isRoomFull && nextTargetTier && canModerate && (
              <div className="mt-1 p-1.5 rounded-xl bg-gradient-to-r from-[#7928CA]/90 via-[#EC4899]/90 to-[#7928CA]/90 border border-white/30 shadow-lg backdrop-blur-md flex items-center justify-between gap-2 max-w-xs mx-auto w-full shrink-0">
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
            4. LOWER AREA (50% for <=12 seats, 38% for 16 seats)
            COMMENTS STREAM, CORNER VINYL TURNTABLE & BOTTOM CONTROLS
           ===================================================================== */}
        <div className="relative z-40 flex-1 min-h-0 flex flex-col justify-end w-full px-3 pb-2 pt-0.5">
          {/* Vintage Spinning Vinyl Turntable + Woofer + Rising Music Notes (Lower-Right Corner Above Comments Bar) */}
          <div className="absolute right-2.5 bottom-[92px] sm:bottom-[100px] z-30">
            <PartyMusicVinylWidget
              isPlaying={isMusicPlaying}
              trackTitle={currentTrack.title}
              canModerate={canModerate}
              onOpenMusicModal={() => setShowMusicModal(true)}
            />
          </div>

          {/* Subtle Real-Time User Join Notification (deduplicated) */}
          {joinNotification && (
            <div
              key={joinNotification.id}
              className="mb-1.5 inline-flex items-center gap-1.5 w-fit max-w-[78%] px-3 py-1 rounded-full bg-gradient-to-r from-[#7928CA]/80 via-[#EC4899]/75 to-[#7928CA]/80 border border-white/20 text-white text-[11px] font-bold shadow-lg backdrop-blur-md animate-fadeIn pointer-events-none shrink-0"
            >
              <span className="truncate">👋 {joinNotification.name} joined the room</span>
            </div>
          )}

          {/* Transparent Floating Comments Stream (Dynamically Fills Remaining Lower Area, leaving right lane clear for Vinyl Turntable) */}
          <div className="flex-1 min-h-[72px] overflow-y-auto space-y-1.5 scrollbar-none pr-[76px] mb-2 [mask-image:linear-gradient(to_bottom,transparent_0%,black_15%,black_100%)]">
            {chatItems.map((item) => (
              <div
                key={item.id}
                onClick={() => handleCommentUserClick(item.sender)}
                className="flex items-start gap-1.5 text-xs text-zinc-200 leading-snug animate-fadeIn cursor-pointer hover:bg-white/10 px-2 py-1 rounded-2xl bg-black/40 backdrop-blur-md border border-white/5 transition-all w-fit max-w-full"
                title="Tap to view profile & actions"
              >
                {/* User Avatar */}
                <img
                  src={safeImageSrc(item.sender.avatar, DEFAULT_AVATAR_URL)}
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
                    <LevelBadgeIcon level={item.sender.level ?? 0} size="xs" />

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

            {/* Bottom Row: Strict Role-Scoped Action Buttons
                - Empty Viewer: Gifts + Share Party (plus Comment input above)
                - Seated Guest: Mic On/Off + Voice FX + Gifts + Share Party
                - Host & Moderator: Full room controls (Music, Mic when seated/Host, Audio, Voice FX when seated/Host, Gifts, Share Party, More) */}
            <div
              className="grid gap-1.5 w-full"
              style={{
                gridTemplateColumns: `repeat(${
                  (canModerate ? 1 : 0) +
                  (canUseSpeakerMic ? 1 : 0) +
                  (canModerate ? 1 : 0) +
                  (canUseSpeakerMic ? 1 : 0) +
                  1 +
                  1 +
                  (canModerate ? 1 : 0)
                }, minmax(0, 1fr))`,
              }}
            >
              {/* 1. Room Music Management — Host & Moderator only */}
              {canModerate && <button
                type="button"
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
              </button>}

              {/* 2. Microphone ON / OFF Toggle — Host & Seated Users only */}
              {canUseSpeakerMic && <button
                type="button"
                onClick={() => {
                  if (userSeatIndex !== null) {
                    const mySeat = activePartyRoom.seats.find((s) => Number(s.seatIndex) === userSeatIndex);
                    if (mySeat?.isHostMuted && isMicMuted) {
                      showToast('Your mic was locked by Host/Moderator! 🔒');
                      return;
                    }
                    const nextMuted = !isMicMuted;
                    setIsMicMuted(nextMuted);
                    agoraPartyEngine.toggleMicrophone(!nextMuted);
                    const updatedSeats = (activePartyRoom.seats || []).map((s) =>
                      Number(s.seatIndex) === userSeatIndex ? { ...s, isMuted: nextMuted } : s
                    );
                    updatePartyRoomFields(activePartyRoom.id, { seats: updatedSeats }).catch(() => {});
                    showToast(nextMuted ? 'Mic Muted 🔇' : 'Mic Live 🎙️');
                  } else if (isHost) {
                    const nextMuted = !isHostMicMuted;
                    setIsHostMicMuted(nextMuted);
                    agoraPartyEngine.toggleMicrophone(!nextMuted);
                    showToast(nextMuted ? 'Host Mic Muted 🔇' : 'Host Mic Live 🎙️');
                  }
                }}
                className={`h-9 sm:h-10 rounded-xl border flex flex-col items-center justify-center p-1 transition-all cursor-pointer backdrop-blur-md ${
                  (isHost ? !isHostMicMuted : !isMicMuted)
                    ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300 shadow-md'
                    : 'bg-rose-950/80 border-rose-500/60 text-rose-300'
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
              </button>}

              {/* 3. Room Speaker Audio Control — Host & Moderator only */}
              {canModerate && <button
                type="button"
                onClick={() => {
                  const nextSpeakerOn = !isSpeakerOn;
                  isSpeakerOnRef.current = nextSpeakerOn;
                  setIsSpeakerOn(nextSpeakerOn);
                  agoraPartyEngine.setSpeaker(nextSpeakerOn).catch(() => {});
                  if (nextSpeakerOn) {
                    unlockAllRemoteAudioPlayback().catch(() => {});
                  }
                  showToast(nextSpeakerOn ? 'Speaker Active 🔊' : 'Speaker Muted 🔇');
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
              </button>}

              {/* 4. Voice Modulation Filter Button — Seated Guests & Host only */}
              {canUseSpeakerMic && <button
                type="button"
                onClick={() => setShowVoiceFilterModal(true)}
                className={`h-9 sm:h-10 rounded-xl border flex flex-col items-center justify-center p-1 transition-all cursor-pointer backdrop-blur-md active:scale-95 ${
                  activeVoiceFilter !== 'normal'
                    ? 'bg-gradient-to-tr from-[#7928CA]/85 to-[#EC4899]/80 border-[#EC4899] text-white shadow-md shadow-[#EC4899]/30'
                    : 'bg-black/50 border-white/10 text-zinc-300 hover:text-white'
                }`}
                title="Voice Modulation (Robot, Chipmunk, Deep Echo)"
                aria-label="Voice Modulation"
              >
                <Wand2
                  className={`w-3.5 h-3.5 ${
                    activeVoiceFilter !== 'normal' ? 'text-amber-300 animate-pulse' : 'text-[#C084FC]'
                  }`}
                />
                <span className="text-[8px] font-black truncate max-w-full mt-0.5">
                  {activeVoiceFilter === 'normal'
                    ? 'Voice FX'
                    : audioFilter.getPresetMeta(activeVoiceFilter).shortLabel}
                </span>
              </button>}

              {/* 5. Gift Button — Available to All Users */}
              <button
                type="button"
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

              {/* 6. Share Party Button — Available to All Users */}
              <button
                type="button"
                onClick={() => setShowShareModal(true)}
                className="h-9 sm:h-10 rounded-xl bg-black/50 backdrop-blur-md border border-amber-400/30 hover:border-amber-300/70 flex flex-col items-center justify-center p-1 text-amber-200 hover:text-white active:scale-95 transition-all cursor-pointer"
                title="Share Party Deep Link"
                aria-label="Share Party"
              >
                <Share2 className="w-3.5 h-3.5 text-amber-300" />
                <span className="text-[8px] font-black truncate max-w-full mt-0.5">
                  Share Party
                </span>
              </button>

              {/* 7. More Options — Host & Moderators only */}
              {canModerate && <button
                type="button"
                onClick={() => setShowMoreModal(true)}
                className="h-9 sm:h-10 rounded-xl bg-black/50 backdrop-blur-md border border-white/10 flex flex-col items-center justify-center p-1 text-zinc-300 hover:text-white active:scale-95 transition-all cursor-pointer"
                title="Party Room Settings & Options"
              >
                <MoreHorizontal className="w-3.5 h-3.5 text-[#C084FC]" />
                <span className="text-[8px] font-black truncate max-w-full mt-0.5">More</span>
              </button>}
            </div>
          </div>
        </div>
        </div>

        {/* =====================================================================
            MODALS: Music Player, Virtual Gifts Drawer, Seat Actions, More
           ===================================================================== */}

        {/* Music Player & Playlist Modal — Host & Moderator only */}
        {showMusicModal && canModerate && (
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
                  type="button"
                  onClick={handleToggleRoomMusic}
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
                      onClick={() => handleSelectMusicTrack(idx)}
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

              {/* Gift Grid (Published Multi-Format Advanced Gifts + Standard Virtual Gifts) */}
              <div className="grid grid-cols-4 gap-2.5 py-4 max-h-60 overflow-y-auto">
                {publishedCatalogGifts.map((g) => {
                  const isSelected = selectedGift.id === g.id;
                  const isTestGift = Boolean(g.isTestGift || g.advancedConfig?.isTestGift);
                  const isAdvanced = Boolean(g.advancedConfig);
                  return (
                    <div
                      key={g.id}
                      onClick={() => setSelectedGift(g)}
                      className={`relative rounded-2xl p-2.5 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-gradient-to-b from-[#7928CA]/40 to-[#EC4899]/30 border-2 border-[#EC4899] shadow-lg shadow-[#EC4899]/20 scale-105'
                          : isTestGift
                          ? 'bg-gradient-to-b from-cyan-950/70 to-[#1D1438] border border-cyan-400/45 hover:border-cyan-300'
                          : 'bg-[#1D1438] border border-white/5 hover:border-white/20'
                      }`}
                    >
                      {isTestGift && (
                        <span className="absolute -top-1.5 -right-1 px-1.5 rounded bg-gradient-to-r from-cyan-500 to-blue-600 text-[7px] font-black text-white shadow">
                          TEST
                        </span>
                      )}
                      {!isTestGift && isAdvanced && (
                        <span className="absolute -top-1.5 -left-1 px-1 rounded bg-emerald-600/90 text-[6.5px] font-black text-white uppercase shadow">
                          {g.advancedConfig?.format}
                        </span>
                      )}
                      {g.thumbnailUrl ? (
                        <img
                          src={g.thumbnailUrl}
                          alt={g.name}
                          className="w-9 h-9 object-contain mb-1 drop-shadow"
                        />
                      ) : (
                        <span className="text-2xl mb-1">{g.icon}</span>
                      )}
                      <span className="text-[10px] font-bold text-white truncate max-w-full">{g.name}</span>
                      <span className="text-[10px] text-amber-400 font-semibold mt-0.5">
                        {(g.costInCoins ?? g.coins).toLocaleString()}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Selected Gift Footer */}
              <div className="flex items-center justify-between pt-2 border-t border-[#A855F7]/15">
                <div className="flex items-center gap-2">
                  {selectedGift.thumbnailUrl ? (
                    <img
                      src={selectedGift.thumbnailUrl}
                      alt={selectedGift.name}
                      className="w-8 h-8 object-contain rounded-lg"
                    />
                  ) : (
                    <span className="text-xl">{selectedGift.icon}</span>
                  )}
                  <div>
                    <div className="text-xs font-bold text-white">{selectedGift.name}</div>
                    <div className="text-[10px] text-zinc-400">{selectedGift.description}</div>
                  </div>
                </div>

                <button
                  onClick={handleSendSelectedGift}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#7928CA] via-[#9333EA] to-[#EC4899] text-white font-bold text-xs shadow-lg shadow-[#7928CA]/50 hover:brightness-110 active:scale-95 transition-all cursor-pointer"
                >
                  Send ({(selectedGift.costInCoins ?? selectedGift.coins).toLocaleString()} 💰)
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
                ? activePartyRoom.seats.find((s) => Number(s.seatIndex) === selectedUserSeatIndex)?.isMuted ?? false
                : false
            }
            isSeatHostMuted={
              selectedUserSeatIndex !== null
                ? activePartyRoom.seats.find((s) => Number(s.seatIndex) === selectedUserSeatIndex)?.isHostMuted ?? false
                : false
            }
            onToggleSeatMic={handleToggleSeatMicByHostOrMod}
            onRemoveFromSeat={handleRemoveGuestFromSeat}
            onSendGift={(target) => {
              setGiftRecipientUser(target);
              setShowGiftDrawer(true);
            }}
            onDirectMessage={(target) => {
              startDirectMessage(target);
            }}
            onVisitProfile={(target) => {
              if (target.id === currentUser.id || target.id === effectiveUserId) {
                setCurrentScreen('profile');
              } else {
                openPublicUserProfile(target);
              }
            }}
            isFollowing={followingUserIds.has(selectedUserForActionSheet.id)}
            onToggleFollow={handleToggleFollowUser}
            currentUserId={effectiveUserId}
          />
        )}

        {/* Seat Action Modal (Step Down / Mic Mute for own seat; Lock / Unlock / VIP 1 Guest Assign for Host/Mod) */}
        {showSeatActionModal !== null && (() => {
          const isVipModal = showSeatActionModal === VIP_GUEST_SEAT_INDEX;
          const targetSeat = isVipModal
            ? vipGuestSeat
            : activeGuestSeats.find((s) => s.seatIndex === showSeatActionModal);
          if (!targetSeat) return null;
          const isMyOwnSeat = targetSeat.user?.id === effectiveUserId;
          const assignableGuests = isVipModal
            ? realViewersList.filter(
                (v) =>
                  v.id !== activePartyRoom.host.id &&
                  !blockedUserIds.includes(v.id) &&
                  !kickedUserIds.includes(v.id)
              )
            : [];

          return (
            <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="w-full max-w-xs rounded-3xl bg-[#171030] border border-[#A855F7]/30 p-5 shadow-2xl">
                <div className="flex items-center justify-between pb-3 border-b border-[#A855F7]/20">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                      {isVipModal && <Crown className="w-4 h-4 text-amber-300" />}
                      <span>{isVipModal ? 'VIP 1 — VIP Guest Seat' : `Seat #${targetSeat.seatIndex + 1}`}</span>
                    </h3>
                    {isVipModal && (
                      <p className="text-[10px] text-amber-200/80 mt-0.5">
                        Host-only reserved circular VIP seat
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setShowSeatActionModal(null)}
                    className="text-zinc-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="mt-4 space-y-2.5">
                  {isMyOwnSeat && (
                    <>
                      <button
                        onClick={() => {
                          if (targetSeat.isHostMuted && isMicMuted) {
                            showToast('Your mic was locked by Host/Moderator! 🔒');
                            return;
                          }
                          const nextMuted = !isMicMuted;
                          setIsMicMuted(nextMuted);
                          agoraPartyEngine.toggleMicrophone(!nextMuted);
                          const updatedSeats = (activePartyRoom.seats || []).map((s) =>
                            Number(s.seatIndex) === targetSeat.seatIndex ? { ...s, isMuted: nextMuted } : s
                          );
                          updatePartyRoomFields(activePartyRoom.id, { seats: updatedSeats }).catch(() => {});
                          setShowSeatActionModal(null);
                          showToast(nextMuted ? 'Mic Muted 🔇' : 'Mic Live 🎙️');
                        }}
                        className="w-full h-10 rounded-xl bg-[#1F153B] border border-white/10 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer hover:border-[#A855F7]"
                      >
                        {isMicMuted ? <Mic className="w-4 h-4 text-emerald-400" /> : <MicOff className="w-4 h-4 text-rose-400" />}
                        <span>{isMicMuted ? 'Unmute My Mic' : 'Mute My Mic'}</span>
                      </button>

                      <button
                        onClick={() => {
                          setShowSeatActionModal(null);
                          setSelectedUserForActionSheet(currentUser);
                          setSelectedUserSeatIndex(targetSeat.seatIndex);
                          setShowUserActionSheet(true);
                        }}
                        className="w-full h-10 rounded-xl bg-[#1F153B] border border-white/10 text-zinc-200 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer hover:border-[#A855F7]"
                      >
                        <Users className="w-4 h-4 text-[#C084FC]" />
                        <span>View My Profile</span>
                      </button>

                      <p className="text-[10px] text-center text-zinc-400 pt-1">
                        Use the top-right <span className="font-bold text-white">✕</span> button when you want to Leave Seat or Leave Broad.
                      </p>
                    </>
                  )}

                  {/* Host-only VIP 1 Unlock / Lock & Assign Guest Controls */}
                  {isVipModal && !isMyOwnSeat && targetSeat.user === null && isHost && (
                    <>
                      <button
                        onClick={async () => {
                          const nextLocked = !targetSeat.isLocked;
                          await handleToggleSeatLock(VIP_GUEST_SEAT_INDEX, nextLocked);
                          if (nextLocked) {
                            setShowSeatActionModal(null);
                          }
                        }}
                        className={`w-full h-10 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                          targetSeat.isLocked
                            ? 'bg-gradient-to-r from-amber-500 to-amber-400 border-amber-200 text-black'
                            : 'bg-[#1F153B] border-amber-400/35 text-amber-200 hover:border-amber-400'
                        }`}
                      >
                        {targetSeat.isLocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                        <span>{targetSeat.isLocked ? 'Unlock VIP 1 Seat' : 'Lock VIP 1 Seat'}</span>
                      </button>

                      {!targetSeat.isLocked && (
                        <div className="pt-1">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-2">
                            Assign a Guest to VIP 1
                          </p>
                          {assignableGuests.length === 0 ? (
                            <p className="text-[11px] text-zinc-400 text-center py-3 rounded-xl bg-black/30 border border-white/5">
                              No guests in room yet. Once listeners join, select one here to assign VIP 1.
                            </p>
                          ) : (
                            <div className="max-h-44 overflow-y-auto space-y-1.5 pr-0.5">
                              {assignableGuests.map((guest) => (
                                <button
                                  key={guest.id}
                                  type="button"
                                  onClick={() => handleAssignGuestToVipSeat(guest)}
                                  className="w-full p-2 rounded-xl bg-[#1F153B] hover:bg-[#2A1B52] border border-white/10 hover:border-amber-400/50 flex items-center justify-between gap-2 cursor-pointer transition-colors"
                                >
                                  <span className="flex items-center gap-2 min-w-0">
                                    <img
                                      src={safeImageSrc(guest.avatar, DEFAULT_AVATAR_URL)}
                                      alt={guest.displayName}
                                      className="w-7 h-7 rounded-full object-cover border border-amber-400/40 shrink-0"
                                    />
                                    <span className="text-xs font-bold text-white truncate">
                                      {guest.displayName}
                                    </span>
                                  </span>
                                  <span className="px-2 py-0.5 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-200 text-[10px] font-bold shrink-0">
                                    Assign
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  {!isVipModal && !isMyOwnSeat && targetSeat.user === null && canModerate && (
                    <>
                      {!isHost && !targetSeat.isLocked && (
                        <button
                          onClick={async () => {
                            const seatIdx = targetSeat.seatIndex;
                            setShowSeatActionModal(null);
                            const res = await toggleSeat(seatIdx);
                            if (res.success) {
                              showToast(`Joined Seat ${seatIdx + 1}! 🎙️`);
                            } else {
                              showToast('Seat is unavailable right now.');
                            }
                          }}
                          className="w-full h-10 rounded-xl bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <Mic className="w-4 h-4" />
                          <span>Take Seat #{targetSeat.seatIndex + 1}</span>
                        </button>
                      )}

                      <button
                        onClick={async () => {
                          const seatIdx = targetSeat.seatIndex;
                          const nextLocked = !targetSeat.isLocked;
                          setShowSeatActionModal(null);
                          await handleToggleSeatLock(seatIdx, nextLocked);
                        }}
                        className="w-full h-10 rounded-xl bg-[#1F153B] border border-amber-400/30 text-amber-200 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer hover:border-amber-400"
                      >
                        {targetSeat.isLocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                        <span>{targetSeat.isLocked ? 'Unlock Seat' : 'Lock Seat'}</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Room Viewers & Audience List Modal */}
        <RoomViewersModal
          isOpen={showViewersModal}
          onClose={() => setShowViewersModal(false)}
          viewers={realViewersList}
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
            if (opp.host?.id && opp.host.id !== currentUser.id) {
              sendNotificationToUser({
                recipientId: opp.host.id,
                type: 'pk_invite',
                category: 'pkBattles',
                title: `⚔️ PK Challenge from ${activePartyRoom.host.displayName}!`,
                message: `5-Minute Room PK Battle started against "${activePartyRoom.title}"!`,
                screen: 'party_room',
                roomId: opp.id,
              }).catch(() => {});
            }
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

        {/* Real-Time Voice Modulation Studio Modal — Seated Users & Host only */}
        <VoiceModulationModal
          isOpen={showVoiceFilterModal && canUseSpeakerMic}
          activeFilter={activeVoiceFilter}
          isOnMic={canUseSpeakerMic}
          isMicMuted={isHost ? isHostMicMuted : isMicMuted}
          onSelectFilter={async (presetId) => {
            if (!activePartyRoom?.id || !canUseSpeakerMic) return;
            const applied = await agoraPartyEngine.setPartyVoiceFilter(
              activePartyRoom.id,
              presetId
            );
            setActiveVoiceFilter(applied);
            const meta = audioFilter.getPresetMeta(applied);
            showToast(
              applied === 'normal'
                ? 'Voice Filter Off (Original Voice)'
                : `Voice FX Active: ${meta.label}`
            );
          }}
          onClose={() => setShowVoiceFilterModal(false)}
          onToast={showToast}
        />

        {/* More Options Modal — Host & Moderator only */}
        {showMoreModal && canModerate && (
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
                    Host: Lv.{isHost ? currentUser.level : (activePartyRoom?.host.level ?? 0)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {PARTY_TIER_SETTINGS.map((item) => {
                    const isUnlocked = isHost
                      ? currentUser.level >= item.requiredLevel
                      : (activePartyRoom?.host.level ?? 0) >= item.requiredLevel;
                    const isCurrent = partyLevel === item.level;

                    return (
                      <button
                        key={item.level}
                        onClick={() => {
                          handleConvertRoomLevel(item.level);
                          if (canModerate && isUnlocked) {
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
                    partyLevel >= 3
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
                {canModerate && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowMoreModal(false);
                      setShowHostAnalyticsCard(true);
                    }}
                    className="w-full p-3 rounded-xl bg-[#110A22] border border-sky-400/30 text-xs text-white flex items-center justify-between hover:border-sky-400 cursor-pointer shadow-sm"
                  >
                    <span className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-sky-300" />
                      <span className="font-bold text-sky-200">Session Insights</span>
                    </span>
                    <ChevronRight className="w-4 h-4 text-zinc-500" />
                  </button>
                )}

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
                  type="button"
                  onClick={() => {
                    const previewTier =
                      Number(currentUser.vipTier || 0) >= VIP_ENTRY_MIN_TIER
                        ? Number(currentUser.vipTier)
                        : 10;
                    const now = Date.now();
                    setShowMoreModal(false);
                    enqueueVipEntry(
                      {
                        id: `vip_preview_${activePartyRoom.id}_${now}`,
                        roomId: activePartyRoom.id,
                        userId: effectiveUserId || currentUser.id,
                        displayName: currentUser.displayName || 'VIP Member',
                        avatar:
                          safeImageSrc(currentUser.avatar, DEFAULT_AVATAR_URL) ||
                          DEFAULT_AVATAR_URL,
                        vipTier: previewTier,
                        level: Number(currentUser.level || 0),
                        isHost,
                        timestamp: now,
                        isPreview: true,
                      },
                      { bypassCooldown: true }
                    );
                  }}
                  className="w-full p-3 rounded-xl bg-[#110A22] border border-amber-300/25 text-xs text-white flex items-center justify-between hover:border-amber-300/60 cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Crown className="w-4 h-4 text-amber-300" />
                    <span className="font-bold text-amber-100">Preview VIP Entry Effect</span>
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
                  type="button"
                  onClick={() => {
                    const deepLink = buildPartyRoomDeepLink(activePartyRoom, {
                      displayName: currentUser.displayName,
                      username: currentUser.username,
                    });
                    copyToClipboard(deepLink.webUrl);
                    showToast('Party deep link copied!');
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

        {/* Host & Moderator Session Insights Dashboard Card */}
        <PartyHostAnalyticsCard
          isOpen={canModerate && showHostAnalyticsCard}
          roomTitle={activePartyRoom.title || `${activePartyRoom.host.displayName}'s Party Room`}
          sessionStartMs={partyJoinedAtRef.current}
          activeViewers={activeViewers}
          peakViewers={Math.max(sessionPeakViewers, activeViewers)}
          totalGiftCoins={activePartyRoom.totalGiftCoins || 0}
          totalHeartCount={totalHeartCount}
          sessionGivers={partyGivers}
          samples={sessionAnalyticsSamples}
          onClose={() => setShowHostAnalyticsCard(false)}
        />

        {/* Share Party Deep-Link & Social Invite Modal */}
        <SharePartyModal
          isOpen={showShareModal}
          room={activePartyRoom}
          activeViewers={activeViewers}
          onClose={() => setShowShareModal(false)}
          onToast={showToast}
        />

        {/* Background Theme Selector Modal — Host & Moderator only */}
        {showBackgroundModal && canModerate && (
          <div
            data-keep-dark="true"
            onClick={() => setShowBackgroundModal(false)}
            className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-[#120A24]/95 border-t sm:border border-white/15 p-5 shadow-2xl animate-scale-up flex flex-col max-h-[84vh]"
            >
              {/* Drag indicator on mobile */}
              <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-3 sm:hidden" />

              <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[#7928CA] to-[#EC4899] flex items-center justify-center shrink-0 shadow-md">
                    <Palette className="w-4 h-4 text-white" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-white leading-tight">Party Room Themes</h3>
                    <p className="text-[11px] text-zinc-400 truncate">
                      Instant backdrop behind live seats
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowBackgroundModal(false)}
                  aria-label="Close room themes"
                  className="w-11 h-11 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-zinc-300 hover:text-white cursor-pointer shrink-0 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="overflow-y-auto pr-0.5 pt-4 pb-2 space-y-5 flex-1">
                {/* Section 1: 7 New Featured Scenic Themes */}
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-300">
                      Featured Scenic Themes
                    </span>
                    <span className="text-[11px] font-medium text-zinc-400">7 HD Scenes</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {PARTY_BACKGROUND_CATALOG.filter((bg) => bg.category === 'featured').map((bg) => {
                      const isSelected = roomBackground === bg.id;
                      return (
                        <button
                          key={bg.id}
                          type="button"
                          onClick={() => handleSelectBackgroundTheme(bg.id, bg.name)}
                          className={`group relative h-36 rounded-2xl overflow-hidden text-left border transition-all active:scale-[0.98] cursor-pointer ${
                            isSelected
                              ? 'border-[#EC4899] ring-2 ring-[#EC4899]/50 shadow-lg shadow-[#EC4899]/25'
                              : 'border-white/10 hover:border-white/30'
                          }`}
                        >
                          {/* Fallback gradient + portrait artwork */}
                          <div className={`absolute inset-0 bg-gradient-to-b ${bg.fallbackGradient}`} />
                          {bg.imageUrl && (
                            <img
                              src={bg.imageUrl}
                              alt={bg.name}
                              referrerPolicy="no-referrer"
                              className="absolute inset-0 w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                            />
                          )}

                          {/* Bottom readability scrim */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/10" />

                          {/* Selection indicator */}
                          {isSelected && (
                            <div className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-gradient-to-r from-[#7928CA] to-[#EC4899] flex items-center justify-center shadow-md border border-white/30">
                              <Check className="w-3.5 h-3.5 text-white" />
                            </div>
                          )}

                          {/* Theme label */}
                          <div className="absolute inset-x-0 bottom-0 p-2.5">
                            <p className="text-xs font-bold text-white leading-snug truncate">
                              {bg.name}
                            </p>
                            <p className="text-[10px] text-zinc-300 leading-tight truncate mt-0.5">
                              {bg.subtitle}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Section 2: Classic Room Backdrops */}
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                      Classic Backdrops
                    </span>
                    <span className="text-[11px] font-medium text-zinc-500">5 Styles</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    {PARTY_BACKGROUND_CATALOG.filter((bg) => bg.category === 'classic').map((bg) => {
                      const isSelected = roomBackground === bg.id;
                      const previewSrc =
                        bg.id === 'dp'
                          ? getHdImageUrl(activePartyRoom.coverImageUrl || activePartyRoom.host.avatar)
                          : bg.imageUrl;

                      return (
                        <button
                          key={bg.id}
                          type="button"
                          onClick={() => handleSelectBackgroundTheme(bg.id, bg.name)}
                          className={`group relative h-24 rounded-2xl overflow-hidden text-left border transition-all active:scale-[0.98] cursor-pointer ${
                            isSelected
                              ? 'border-[#EC4899] ring-2 ring-[#EC4899]/50 shadow-md shadow-[#EC4899]/20'
                              : 'border-white/10 hover:border-white/25'
                          }`}
                        >
                          <div className={`absolute inset-0 bg-gradient-to-b ${bg.fallbackGradient}`} />
                          {previewSrc && (
                            <img
                              src={previewSrc}
                              alt={bg.name}
                              referrerPolicy="no-referrer"
                              className={`absolute inset-0 w-full h-full ${
                                bg.isThumbLogo
                                  ? 'object-contain p-3 opacity-85'
                                  : 'object-cover group-hover:scale-105 transition-transform duration-500'
                              }`}
                            />
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent" />

                          {isSelected && (
                            <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-gradient-to-r from-[#7928CA] to-[#EC4899] flex items-center justify-center shadow-sm">
                              <Check className="w-3 h-3 text-white" />
                            </div>
                          )}

                          <div className="absolute inset-x-0 bottom-0 p-2">
                            <p className="text-[11px] font-bold text-white leading-tight truncate">
                              {bg.name}
                            </p>
                            <p className="text-[9.5px] text-zinc-300 leading-tight truncate mt-0.5">
                              {bg.subtitle}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowBackgroundModal(false)}
                className="mt-3 w-full min-h-[44px] rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 text-zinc-200 text-xs font-bold hover:text-white cursor-pointer transition-colors shrink-0"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* Host Exit Options Confirmation Modal: Leave Room vs Close Room */}
        {showExitConfirmModal && (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <div className="w-full max-w-sm rounded-3xl bg-[#140826] border border-[#A855F7]/30 p-6 shadow-2xl animate-scale-up text-white">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#7928CA] to-[#EC4899] flex items-center justify-center shadow-md">
                    <Crown className="w-5 h-5 text-amber-300" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Exit Party Lounge</h3>
                    <p className="text-[10px] text-zinc-400">You are the Host of this lounge</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowExitConfirmModal(false)}
                  className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-zinc-300 mb-4 leading-relaxed">
                Choose how you want to leave. You can keep the room open for guests or close it completely:
              </p>

              <div className="space-y-3 mb-5">
                {/* 1. Leave Room (Lounge stays open, Host Seat becomes empty) */}
                <button
                  onClick={() => {
                    setShowExitConfirmModal(false);
                    const remainingCount = Math.max(
                      0,
                      realViewersList.filter((u) => u.id !== effectiveUserId).length
                    );
                    closePartyRoom(false, { remainingViewers: remainingCount });
                    showToast('روم کھلا ہے اور ہوسٹ سیٹ خالی ہو گئی ہے — واپسی پر آپ ڈائریکٹ ہوسٹ سیٹ پر آئیں گے 🎙️');
                  }}
                  className="w-full p-3.5 rounded-2xl bg-[#1C1033] border border-[#A855F7]/30 hover:border-[#A855F7] flex items-start gap-3 text-left transition-all cursor-pointer group hover:bg-[#231540]"
                >
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                    <Users className="w-5 h-5 text-purple-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">Leave Room</span>
                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold uppercase tracking-wider">Keep Open</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-1 leading-normal">
                      Your Host Seat becomes empty and viewer count drops to actual remaining guests (0 if empty). Re-entering puts you directly back on your Host Seat.
                    </p>
                  </div>
                </button>

                {/* 2. Close Room (Destroys room) */}
                <button
                  onClick={() => {
                    setShowExitConfirmModal(false);
                    closePartyRoom(true);
                    showToast('Party lounge closed permanently 🚪');
                  }}
                  className="w-full p-3.5 rounded-2xl bg-rose-950/25 border border-rose-500/30 hover:border-rose-500 flex items-start gap-3 text-left transition-all cursor-pointer group hover:bg-rose-950/40"
                >
                  <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                    <Trash2 className="w-5 h-5 text-rose-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-rose-200">Close Room</span>
                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-bold uppercase tracking-wider">End Session</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-1 leading-normal">
                      Permanently terminates this party lounge and removes its card from the discovery feed.
                    </p>
                  </div>
                </button>
              </div>

              <button
                onClick={() => setShowExitConfirmModal(false)}
                className="w-full h-11 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold hover:bg-zinc-700 cursor-pointer transition-colors"
              >
                Cancel (Stay in Room)
              </button>
            </div>
          </div>
        )}

        {/* Guest Exit Options Modal when seated user taps top X: Leave Seat vs Leave Broad */}
        {showGuestExitModal && userSeatIndex !== null && (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <div className="w-full max-w-sm rounded-3xl bg-[#140826] border border-[#A855F7]/30 p-6 shadow-2xl animate-scale-up text-white">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#7928CA] to-[#EC4899] flex items-center justify-center shadow-md">
                    <Mic className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Seat #{userSeatIndex + 1}</h3>
                    <p className="text-[10px] text-zinc-400">Choose how you want to exit</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowGuestExitModal(false)}
                  className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 mb-5">
                {/* 1. Leave Seat (Stay in broadcast as viewer) */}
                <button
                  onClick={async () => {
                    const seatToLeave = userSeatIndex;
                    setShowGuestExitModal(false);
                    if (seatToLeave !== null) {
                      await toggleSeat(seatToLeave).catch(() => {});
                      showToast(`Left Seat #${seatToLeave + 1} — staying in broadcast 🎧`);
                    }
                  }}
                  className="w-full p-3.5 rounded-2xl bg-[#1C1033] border border-[#A855F7]/30 hover:border-[#A855F7] flex items-start gap-3 text-left transition-all cursor-pointer group hover:bg-[#231540]"
                >
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                    <UserX className="w-5 h-5 text-amber-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">Leave Seat</span>
                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold uppercase tracking-wider">Stay in Broad</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-1 leading-normal">
                      Step down from Seat #{userSeatIndex + 1} and remain inside this Party Room as a viewer.
                    </p>
                  </div>
                </button>

                {/* 2. Leave Broad (Exit party room completely) */}
                <button
                  onClick={async () => {
                    const seatToLeave = userSeatIndex;
                    setShowGuestExitModal(false);
                    if (seatToLeave !== null) {
                      await toggleSeat(seatToLeave).catch(() => {});
                    }
                    const remainingCount = Math.max(
                      0,
                      realViewersList.filter((u) => u.id !== effectiveUserId).length
                    );
                    closePartyRoom(false, { remainingViewers: remainingCount });
                  }}
                  className="w-full p-3.5 rounded-2xl bg-rose-950/25 border border-rose-500/30 hover:border-rose-500 flex items-start gap-3 text-left transition-all cursor-pointer group hover:bg-rose-950/40"
                >
                  <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                    <LogOut className="w-5 h-5 text-rose-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-rose-200">Leave Broad</span>
                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-bold uppercase tracking-wider">Exit Party</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-1 leading-normal">
                      Step off your seat and leave this Party Room broadcast completely.
                    </p>
                  </div>
                </button>
              </div>

              <button
                onClick={() => setShowGuestExitModal(false)}
                className="w-full h-11 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold hover:bg-zinc-700 cursor-pointer transition-colors"
              >
                Cancel (Stay Seated)
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
            const seatIdx = activePartyRoom.seats.findIndex((s) => s.user?.id === targetUser.id);
            setSelectedUserForActionSheet(targetUser);
            setSelectedUserSeatIndex(seatIdx !== -1 ? seatIdx : null);
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
  // CIRCULAR NORMAL GUEST SEAT RENDER FUNCTION (Responsive for Levels 1, 2, 3, and 4)
  // =========================================================================
  function renderGuestSeat(seat: PartySeat, sizeVariant: 'lg' | 'md' | 'sm' | 'xs') {
    const isOccupied = seat.user !== null;
    const isMe = userSeatIndex === seat.seatIndex;
    const isSpeaking = Boolean(seat.isSpeaking);

    const circleSize = {
      lg: 'w-[48px] h-[48px] sm:w-[56px] sm:h-[56px]',
      md: 'w-[42px] h-[42px] sm:w-[48px] sm:h-[48px]',
      sm: 'w-[36px] h-[36px] sm:w-[42px] sm:h-[42px]',
      xs: 'w-[32px] h-[32px] sm:w-[38px] sm:h-[38px]',
    }[sizeVariant];

    const labelMaxWidth = {
      lg: 'max-w-[66px]',
      md: 'max-w-[60px]',
      sm: 'max-w-[54px]',
      xs: 'max-w-[50px]',
    }[sizeVariant];

    const isCompact = sizeVariant === 'xs' || sizeVariant === 'sm';

    return (
      <div
        key={seat.seatIndex}
        onClick={() => handleSeatClick(seat)}
        className="flex flex-col items-center gap-0.5 cursor-pointer group transition-transform active:scale-95 pt-1"
      >
        <div className="relative">
          {/* Speaking Soundwave Pulsing Waves */}
          {isOccupied && isSpeaking && !seat.isMuted && (
            <>
              <div className="absolute -inset-1.5 rounded-full border border-emerald-400 animate-ping opacity-75 pointer-events-none" />
              <div className="absolute -inset-2.5 rounded-full border border-emerald-400/40 animate-pulse pointer-events-none" />
            </>
          )}

          {/* Synchronized Animated Seat Theme Frame around Unobstructed Circular Seat Aperture */}
          <AnimatedSeatThemeFrame
            theme={seatTheme}
            sizeClass={circleSize}
            role="guest"
            compact={isCompact}
          >
            {isOccupied ? (
              <div className="w-full h-full rounded-full overflow-hidden bg-[#120826] transition-transform group-hover:scale-105">
                <img
                  src={safeImageSrc(seat.user!.avatar, DEFAULT_AVATAR_URL)}
                  alt={seat.user!.displayName}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <AnimatedEmptySeatSofa
                theme={seatTheme}
                isLocked={seat.isLocked}
                compact={isCompact}
              />
            )}
          </AnimatedSeatThemeFrame>

          {/* Moderator Badge on Seat */}
          {isOccupied && seat.user && moderatorIds.includes(seat.user.id) && (
            <div className="absolute -top-1 -left-1 w-3.5 h-3.5 rounded-full bg-cyan-600 border border-white flex items-center justify-center shadow-sm z-30" title="Room Moderator">
              <ShieldCheck className="w-2 h-2 text-white" />
            </div>
          )}

          {/* Microphone Status Indicator on Seat */}
          {isOccupied && (
            <div
              className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full flex items-center justify-center border border-white/30 shadow-md z-30 ${
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

        {/* Username / Placeholder Label */}
        <span
          className={`${isCompact ? 'text-[7.5px]' : 'text-[8.5px] sm:text-[9.5px]'} font-bold text-zinc-200 truncate text-center leading-tight mt-2 ${labelMaxWidth}`}
        >
          {isOccupied ? (isMe ? 'You' : seat.user!.displayName.split(' ')[0]) : seat.isLocked ? 'Locked' : `Seat ${seat.seatIndex + 1}`}
        </span>

        {/* Gift Coin Value Pill */}
        {(!isCompact || (seat.receivedCoins || 0) > 0 || isOccupied) && (
          <div className="flex items-center gap-0.5 px-1 py-0 rounded-full bg-black/45 border border-white/10 text-amber-300 text-[7px] font-bold leading-tight">
            <span>🎁</span>
            <span>{seat.receivedCoins ? (seat.receivedCoins > 999 ? `${(seat.receivedCoins / 1000).toFixed(1)}k` : seat.receivedCoins) : '0'}</span>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // IF NO ACTIVE PARTY ROOM -> RENDER AUDIO PARTY DISCOVERY HUB
  // =========================================================================


  return (
    <div className="relative w-full h-full pb-24 bg-[#09070F] text-white overflow-y-auto overscroll-contain">
      {/* Global Lobby Toast Alert Feedback (rendered above modals at z-[70]) */}
      {toastMessage && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-[70] px-4 py-2 rounded-full bg-[#180E2C]/95 border border-[#A855F7]/40 text-white text-xs font-bold shadow-2xl backdrop-blur-md flex items-center gap-2 pointer-events-none">
          <Sparkles className="w-3.5 h-3.5 text-[#EC4899]" />
          <span>{toastMessage}</span>
        </div>
      )}

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
                onClick={handleTryCreatePartyRoom}
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
                const roomSeats = Array.isArray(room.seats) ? room.seats : [];
                const filledSeats = roomSeats.filter((s) => s.user !== null).length;
                const displayViewers = Math.max(0, Number(room.activeViewers) || 0);
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
                            src={getHdImageUrl(room.coverImageUrl || room.host.avatar, DEFAULT_AVATAR_URL)}
                            alt={room.host.displayName}
                            className={`w-13 h-13 sm:w-14 sm:h-14 rounded-2xl object-cover shadow-md ${
                              isTop1 ? 'border-2 border-amber-400 shadow-amber-400/20' : 'border-2 border-[#EC4899] shadow-pink-500/20'
                            }`}
                          />
                          <span className="absolute -top-1 -left-1 px-1 py-0.2 rounded bg-black/80 border border-white/20 text-[7.5px] font-black text-amber-300">
                            HD
                          </span>
                          <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#EC4899] flex items-center justify-center shadow-sm">
                            <Mic className="w-2.5 h-2.5 text-white" />
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center gap-1.5">
                            <h3 className="text-sm font-bold text-white max-w-[150px] truncate">{room.title}</h3>
                            {room.countryFlag && <span className="text-xs">{room.countryFlag}</span>}
                          </div>
                          <p className="text-[11px] text-zinc-300 mt-0.5">
                            Host: {room.host.displayName}
                            {room.isHostPresent === false ? ' • Seat Empty' : ''}
                          </p>
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
                          <span>{displayViewers}</span>
                        </div>
                      </div>

                      {/* Guest avatars preview */}
                      <div className="flex items-center -space-x-1.5">
                        {roomSeats
                          .filter((s) => s.user !== null)
                          .slice(0, 4)
                          .map((seat, i) => (
                            <img
                              key={i}
                              src={safeImageSrc(seat.user!.avatar, DEFAULT_AVATAR_URL)}
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
              const roomSeats = Array.isArray(room.seats) ? room.seats : [];
              const filledSeats = roomSeats.filter((s) => s.user !== null).length;
              const displayViewers = Math.max(0, Number(room.activeViewers) || 0);

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
                          src={getHdImageUrl(room.coverImageUrl || room.host.avatar, DEFAULT_AVATAR_URL)}
                          alt={room.host.displayName}
                          className="w-11 h-11 rounded-2xl object-cover border border-[#A855F7]"
                        />
                        <span className="absolute -top-1 -left-1 px-1 py-0.2 rounded bg-black/80 border border-white/20 text-[7.5px] font-black text-amber-300">
                          HD
                        </span>
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#EC4899] flex items-center justify-center">
                          <Mic className="w-2.5 h-2.5 text-white" />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-sm font-bold text-white max-w-[170px] truncate">{room.title}</h3>
                          {room.countryFlag && <span className="text-xs">{room.countryFlag}</span>}
                        </div>
                        <p className="text-[11px] text-zinc-400 mt-0.5">
                          Host: {room.host.displayName}
                          {room.isHostPresent === false ? ' • Seat Empty' : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#1F1238] border border-white/5 text-[10px] text-zinc-300 font-semibold">
                      <Users className="w-3 h-3 text-[#A855F7]" />
                      <span>{displayViewers}</span>
                    </div>
                  </div>

                  {/* Seats preview bar & Level Badge */}
                  <div className="flex items-center justify-between pt-2 border-t border-white/5">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[9px] font-black ${
                          room.level === 4
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : room.level === 3
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : room.level === 2
                            ? 'bg-pink-500/20 text-pink-300 border border-pink-500/30'
                            : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                        }`}
                      >
                        {room.level === 4
                          ? '16 Seats'
                          : room.level === 3
                          ? '12 Seats'
                          : room.level === 2
                          ? '8 Seats'
                          : '4 Seats'}
                      </span>

                      {/* Gift Coin stats pill */}
                      {room.totalGiftCoins ? (
                        <div className="flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-amber-400/10 text-amber-300 text-[8.5px] font-bold">
                          <span>🎁</span>
                          <span>{room.totalGiftCoins > 999 ? `${(room.totalGiftCoins / 1000).toFixed(1)}k` : room.totalGiftCoins}</span>
                        </div>
                      ) : null}

                      <div className="flex items-center -space-x-2">
                        {roomSeats
                          .filter((s) => s.user !== null)
                          .slice(0, 4)
                          .map((seat, i) => (
                            <img
                              key={i}
                              src={safeImageSrc(seat.user!.avatar, DEFAULT_AVATAR_URL)}
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

          {filteredRooms.length === 0 && (
            <div className="mt-3 p-6 rounded-2xl bg-[#140C26]/80 border border-[#A855F7]/20 text-center space-y-2.5">
              <div className="w-11 h-11 rounded-2xl bg-[#7928CA]/20 border border-[#A855F7]/30 flex items-center justify-center mx-auto">
                <Mic className="w-5 h-5 text-[#EC4899]" />
              </div>
              <p className="text-xs font-bold text-white">No live audio party rooms right now</p>
              <p className="text-[11px] text-zinc-400">
                Start your own 4, 8, or 15-seat voice lounge and invite friends.
              </p>
              <button
                type="button"
                onClick={handleTryCreatePartyRoom}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white text-xs font-bold shadow-md cursor-pointer"
              >
                + Create Party Room
              </button>
            </div>
          )}
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

              {/* Permanent room cover image (defaults to host DP when omitted) */}
              <div>
                <label className="text-xs text-zinc-300 font-bold block mb-1.5">Room Cover Photo</label>
                <input ref={roomCoverInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (!file.type.startsWith('image/')) { showToast('Please select an image file.'); return; }
                  if (file.size > 5 * 1024 * 1024) { showToast('Cover image must be 5 MB or smaller.'); return; }
                  setIsUploadingRoomCover(true);
                  uploadPartyRoomCover(file)
                    .then((url) => { setNewRoomCover(url); showToast('Room cover uploaded successfully.'); })
                    .catch((error) => showToast(error instanceof Error ? error.message : 'Cover upload failed.'))
                    .finally(() => setIsUploadingRoomCover(false));
                }} />
                <button type="button" onClick={() => roomCoverInputRef.current?.click()} disabled={isUploadingRoomCover} className="w-full h-20 rounded-xl overflow-hidden border border-[#A855F7]/35 bg-[#0C061A] flex items-center gap-3 text-left">
                  <img src={safeImageSrc(newRoomCover || currentUser.avatar, DEFAULT_AVATAR_URL)} alt="Selected room cover" className="w-28 h-20 object-cover" />
                  <span className="min-w-0"><span className="block text-xs font-bold text-white">{isUploadingRoomCover ? 'Uploading cover…' : newRoomCover ? 'Cover selected' : 'Use a room cover'}</span><span className="block text-[10px] text-zinc-400 mt-1">{newRoomCover ? 'Tap to change image' : 'Optional • Defaults to your profile photo'}</span></span>
                </button>
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

              {/* Room Capacity Tier Options (4, 8, 12, 16 Normal Seats + Host + VIP 1) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-zinc-300 font-bold">Select Room Size & Capacity</label>
                  <span className="text-[10px] text-[#C084FC]">4 Capacity Levels</span>
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

              {/* Auth Warning if not signed in to Firebase */}
              {!(firebaseUser || auth.currentUser) && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-400/35 space-y-2">
                  <p className="text-[11px] text-amber-200 font-semibold leading-snug">
                    {createRoomError || 'Sign in with Google or Email first to host a live Party Room.'}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isSigningInToHost}
                      onClick={async () => {
                        setIsSigningInToHost(true);
                        setCreateRoomError(null);
                        const res = await loginWithFirebaseGoogle({ skipRedirect: true });
                        setIsSigningInToHost(false);
                        if (!res.success) {
                          setCreateRoomError(
                            res.error || 'Google sign-in did not complete. Please allow popups or sign in with Email.'
                          );
                        } else {
                          showToast('Signed in! Tap Launch Room to go live.');
                        }
                      }}
                      className="flex-1 h-8 rounded-lg bg-white text-zinc-900 text-[11px] font-bold hover:bg-zinc-100 disabled:opacity-60 cursor-pointer"
                    >
                      {isSigningInToHost ? 'Signing in...' : 'Continue with Google'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateModal(false);
                        setCreateRoomError(null);
                        setCurrentScreen('signin');
                      }}
                      className="h-8 px-3 rounded-lg bg-purple-600/30 border border-purple-400/40 text-purple-100 text-[11px] font-bold hover:bg-purple-600/50 cursor-pointer"
                    >
                      Email Sign In
                    </button>
                  </div>
                </div>
              )}

              {createRoomError && (firebaseUser || auth.currentUser) && (
                <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-[11px] font-semibold">
                  {createRoomError}
                </div>
              )}

              {/* Modal Buttons */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setCreateRoomError(null);
                    setShowCreateModal(false);
                  }}
                  className="flex-1 h-11 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-semibold cursor-pointer hover:bg-zinc-700 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isLaunchingRoom}
                  onClick={async () => {
                    const fbUser = auth.currentUser;
                    if (!fbUser) {
                      const msg = 'Please sign in first to host a Party Room.';
                      setCreateRoomError(msg);
                      showToast(msg);
                      return;
                    }
                    if (isUploadingRoomCover) {
                      showToast('Please wait for the room cover upload to finish.');
                      return;
                    }

                    const selectedTier =
                      PARTY_TIER_SETTINGS.find((t) => t.level === createRoomLevel) || PARTY_TIER_SETTINGS[0];
                    if (currentUser.level < selectedTier.requiredLevel) {
                      showToast(`🔒 ${selectedTier.name} is locked! Launching with 1 Host + 4 Seats.`);
                      setCreateRoomLevel(1);
                    }

                    const finalLevel = currentUser.level >= selectedTier.requiredLevel ? createRoomLevel : 1;
                    const finalTier = PARTY_TIER_SETTINGS.find((t) => t.level === finalLevel)!;

                    const initialSeats: PartySeat[] = [
                      ...Array.from({ length: finalTier.guestCount }, (_, i) => ({
                        seatIndex: i,
                        user: null,
                        isMuted: false,
                        isHostMuted: false,
                        isLocked: false,
                        isSpeaking: false,
                        receivedCoins: 0,
                      })),
                      {
                        seatIndex: VIP_GUEST_SEAT_INDEX,
                        user: null,
                        isMuted: false,
                        isHostMuted: false,
                        isLocked: true,
                        isVipGuest: true,
                        isSpeaking: false,
                        receivedCoins: 0,
                      },
                    ];

                    const normalizedHost = { ...currentUser, id: fbUser.uid };
                    const newParty: PartyRoom = {
                      id: getCanonicalPartyRoomId(fbUser.uid),
                      title: newRoomTitle || `${normalizedHost.displayName}'s Lounge 💜`,
                      host: normalizedHost,
                      announcement: `Welcome to our ${finalTier.name} Audio Lounge! Tap an open seat to talk.`,
                      category: createCategory,
                      activeViewers: 1,
                      isHostPresent: true,
                      backgroundTheme: isValidPartyBackgroundTheme(roomBackground) ? roomBackground : 'royal_castle',
                      seatTheme: isValidPartySeatTheme(seatTheme) ? seatTheme : 'royal_gold_diya',
                      isMusicPlaying: true,
                      musicTrackIndex: 0,
                      level: finalLevel,
                      isActive: true,
                      totalGiftCoins: 0,
                      coverImageUrl: newRoomCover || normalizedHost.avatar,
                      seats: initialSeats,
                    };

                    setIsLaunchingRoom(true);
                    setCreateRoomError(null);
                    try {
                      const res = await createPartyRoom(newParty);
                      if (!res.success) {
                        const errMsg = res.error || 'Could not launch Party Room.';
                        setCreateRoomError(errMsg);
                        showToast(errMsg);
                        return;
                      }

                      setShowCreateModal(false);
                      if (res.alreadyExists) {
                        showToast('آپ کا پارٹی روم پہلے سے چل رہا ہے! آپ کو اسی روم میں لے جایا جا رہا ہے 🎙️');
                      } else {
                        showToast(`🎉 ${finalTier.name} Created Successfully! 🚀`);
                      }
                    } catch (launchErr: any) {
                      const errMsg = launchErr?.message || 'Could not launch Party Room. Please try again.';
                      setCreateRoomError(errMsg);
                      showToast(errMsg);
                    } finally {
                      setIsLaunchingRoom(false);
                    }
                  }}
                  className="flex-1 h-11 rounded-xl bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white text-xs font-bold shadow-lg shadow-[#7928CA]/30 hover:brightness-110 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-60"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>{isLaunchingRoom ? 'Launching...' : 'Launch Room'}</span>
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
