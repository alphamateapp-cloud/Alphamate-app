import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  ScreenType,
  MainTabType,
  User,
  LiveStream,
  PartyRoom,
  Gift,
  Conversation,
  VideoPost,
  WalletTransaction,
  NotificationItem,
  NotificationPreferences,
  GiftTransactionRecord,
  StoryItem,
  FriendStory,
  AgencyOrder,
  AgencyTransaction,
  CoinSellerAgencyProfile,
  HostAgencyProfile,
  HostMember,
  HostJoinRequest,
  AgencyApplication,
  LeaderboardEntry,
  LeaderboardScope,
  UserBadgeId,
  UserHistoricalStats,
} from '../types';
import {
  CURRENT_USER,
  MOCK_CONVERSATIONS,
  MOCK_VIDEOS,
  MOCK_NOTIFICATIONS,
  MOCK_TRANSACTIONS,
  VIRTUAL_GIFTS,
  MOCK_FRIEND_STORIES,
} from '../data/mockData';
import {
  auth,
  db,
  signInWithGoogle,
  consumeGoogleRedirectResult,
  signInWithEmail,
  registerWithEmail,
  resendVerificationEmail,
  reloadCurrentFirebaseUser,
  isFirebaseUserVerified,
  logoutUser,
  onAuthStateChanged,
  syncUserProfileToFirestore,
  getUserProfileFromFirestore,
  subscribeToUserProfile,
  syncPartyRoomToFirestore,
  deletePartyRoomFromFirestore,
  subscribeToPartyRooms,
  updatePartyRoomSeat,
  syncLiveStreamToFirestore,
  deleteLiveStreamFromFirestore,
  subscribeToLiveStreams,
  submitAccountDeactivationFirestore,
  submitPermanentDeletionRequestFirestore,
  recoverAccountLifecycleFirestore,
  updateUserNotificationPreferencesFirestore,
  sendFirestoreNotification,
  subscribeToUserNotifications,
  markFirestoreNotificationRead,
  markAllFirestoreNotificationsRead,
  fetchBroadcastRecipientIds,
  executeSixtyFortyGiftTransaction,
  subscribeToGiftTransactions,
  SendNotificationParams,
  FirebaseUser,
} from '../services/firebase';
import {
  subscribeToActiveReels,
  deleteReel,
  toggleReelLike,
  Reel,
} from '../services/reelsService';
import { p2pStreamingEngine } from '../services/webrtcService';
import { realtimeSocket } from '../services/realtimeSocket';
import { pushService, DEFAULT_NOTIFICATION_PREFERENCES } from '../services/pushNotificationService';
import {
  getCurrentMonthKey,
  getPreviousMonthKey,
  getCurrentWeekKey,
  pruneExpiredLocalLeaderboardMonths,
  loadLocalLeaderboardOverrides,
  applyLocalLeaderboardGift,
  applyLocalLeaderboardTime,
  subscribeToMonthlyLeaderboard,
  fetchMonthlyLeaderboardOnce,
  syncUserTimeSpentToLeaderboard,
  buildMergedLeaderboardList,
} from '../services/leaderboardService';
import {
  BADGE_BY_ID,
  EvaluatedUserBadge,
  MAX_EQUIPPED_BADGES,
  evaluateHistoricalBadges,
  loadLocalUserBadgeStats,
  saveLocalUserBadgeStats,
  subscribeToUserBadgeStats,
  syncUserBadgeStatsToFirestore,
} from '../services/badgeService';
import {
  subscribeToRealUsers,
  subscribeToMyFollowEdges,
  setUserFollowStateFirestore,
} from '../services/userDirectoryService';
import { getOrCreateDirectChat } from '../services/chatService';

interface AppContextType {
  // Navigation & Screen state
  currentScreen: ScreenType;
  setCurrentScreen: (screen: ScreenType) => void;
  activeTab: MainTabType;
  setActiveTab: (tab: MainTabType) => void;
  navigateBack: () => void;
  screenHistory: ScreenType[];
  legalConsent: { terms: boolean; privacy: boolean };
  setLegalConsent: React.Dispatch<React.SetStateAction<{ terms: boolean; privacy: boolean }>>;

  // Auth state
  isAuthenticated: boolean;
  currentUser: User;
  setCurrentUser: React.Dispatch<React.SetStateAction<User>>;
  updateUserProfile: (data: Partial<User>) => void;
  login: (userData?: Partial<User>) => void;
  logout: () => void;
  register: (name: string, emailOrPhone: string) => void;
  registeredUsers: User[];
  loginWithGoogle: (email: string) => { isRegistered: boolean; user?: User };
  registerWithFullDetails: (data: {
    displayName: string;
    username: string;
    email: string;
    dob: string;
    password: string;
    authProvider: 'google' | 'email';
    avatar?: string;
  }) => { success: boolean; message?: string; user?: User };
  loginWithCredentials: (
    identifier: string,
    password: string
  ) => { success: boolean; message?: string; user?: User };

  // Firebase Real-time Auth & Cloud Firestore
  firebaseUser: FirebaseUser | null;
  firebaseAuthLoading: boolean;
  isEmailVerified: boolean;
  loginWithFirebaseGoogle: (options?: {
    skipRedirect?: boolean;
  }) => Promise<{ success: boolean; user?: User; error?: string; redirectPending?: boolean }>;
  loginWithFirebaseEmail: (
    email: string,
    pass: string
  ) => Promise<{ success: boolean; user?: User; error?: string; needsVerification?: boolean }>;
  registerWithFirebaseEmail: (data: {
    email: string;
    pass: string;
    displayName: string;
    username: string;
  }) => Promise<{ success: boolean; user?: User; error?: string; needsVerification?: boolean }>;
  refreshFirebaseVerification: () => Promise<boolean>;
  resendEmailVerificationLink: () => Promise<void>;
  logoutFirebase: () => Promise<void>;
  sendAccountDeletionOtp: () => Promise<{
    success: boolean;
    emailMasked?: string;
    challengeToken?: string;
    expiresAt?: number;
    cooldownSeconds?: number;
    code?: string;
    error?: string;
  }>;
  verifyAccountDeletionOtp: (
    challengeToken: string,
    otp: string
  ) => Promise<{
    success: boolean;
    otpVerifiedAt?: string;
    deletionVerificationToken?: string;
    code?: string;
    remainingAttempts?: number;
    error?: string;
  }>;
  deactivateCurrentAccount: (reason?: string) => Promise<{ success: boolean; deactivatedAt?: string; error?: string }>;
  requestPermanentAccountDeletion: (
    otpVerifiedAt: string,
    reason?: string
  ) => Promise<{ success: boolean; scheduledPermanentDeletionAt?: string; error?: string }>;
  recoverCurrentAccount: () => Promise<{ success: boolean; error?: string }>;

  // Live Stream state
  liveStreams: LiveStream[];
  activeStream: LiveStream | null;
  openLiveStream: (stream: LiveStream) => void;
  publishLiveStream: (stream: LiveStream) => Promise<void>;
  closeLiveStream: () => void;
  sendLiveGift: (
    gift: Gift,
    recipientHostId?: string,
    quantity?: number,
    recipientDisplayName?: string,
    meta?: { context?: 'live' | 'party' | 'moments' | 'pk' | 'demo'; roomId?: string; streamId?: string; reelId?: string }
  ) => void;
  activeGiftBanner: { gift: Gift; sender: string; recipient: string } | null;
  clearActiveGiftBanner: () => void;
  giftTransactions: GiftTransactionRecord[];
  simulateDemoHostGift: (
    coinsAmount?: number,
    giftName?: string
  ) => { success: boolean; message: string; hostDiamonds: number; appShareCoins: number };

  // PK Battle state
  activePKBattle: LiveStream | null;
  openPKBattle: (stream: LiveStream) => void;
  pkScores: { left: number; right: number };
  supportPKHost: (side: 'left' | 'right', amount: number) => void;

  // Party Room state
  partyRooms: PartyRoom[];
  activePartyRoom: PartyRoom | null;
  openPartyRoom: (room: PartyRoom) => void;
  closePartyRoom: (shouldDelete?: boolean) => void;
  createPartyRoom: (room: PartyRoom) => Promise<{ success: boolean; error?: string }>;
  updateActivePartyRoomLevel: (level: 1 | 2 | 3) => void;
  toggleSeat: (seatIndex: number) => Promise<{ success: boolean; reason?: string }>;
  userSeatIndex: number | null;
  setUserSeatIndex: React.Dispatch<React.SetStateAction<number | null>>;
  isMicMuted: boolean;
  setIsMicMuted: (muted: boolean) => void;

  // Chat & Messaging
  conversations: Conversation[];
  activeConversation: Conversation | null;
  openConversation: (conv: Conversation) => void;
  startDirectMessage: (user: User) => Promise<void>;
  sendMessage: (convId: string, text: string, imageUrl?: string) => void;

  // Video feed & Upload
  videos: VideoPost[];
  uploadInitialMode: 'record' | 'photo' | 'gallery' | 'post';
  openUploadScreen: (mode?: 'record' | 'photo' | 'gallery' | 'post') => void;
  addVideoPost: (video: Omit<VideoPost, 'id' | 'likes' | 'commentsCount' | 'sharesCount' | 'timestamp'>) => void;
  toggleLikeVideo: (videoId: string) => void;
  deleteVideoPost: (postId: string, videoKey?: string) => Promise<void>;

  // Stories & Friends System
  friendStories: FriendStory[];
  myStories: StoryItem[];
  addMyStory: (story: {
    mediaUrl: string;
    caption?: string;
    musicTitle?: string;
    backgroundColor?: string;
    stickers?: string[];
  }) => void;
  toggleLikeStory: (friendId: string, storyId: string) => void;
  reactToStory: (friendId: string, storyId: string, emoji: string) => void;
  markStorySeen: (friendId: string) => void;

  // Wallet & Economy
  coins: number;
  diamonds: number;
  heldDiamonds: number;
  transactions: WalletTransaction[];
  addCoins: (amount: number, reason: string) => void;
  addDiamonds: (amount: number, reason: string) => void;
  rechargeCoins: (amount: number, priceUSD: number, paymentMethod: string) => Promise<boolean>;
  withdrawDiamonds: (
    amountUSD: number,
    method: string,
    accountDetails: { title: string; number: string; bankName?: string }
  ) => { success: boolean; message: string };
  exchangeDiamondsToCoins: (
    diamondsAmount: number
  ) => { success: boolean; message: string };
  purchaseStoreItem: (cost: number, currency: 'coins' | 'diamonds', itemTitle: string) => boolean;
  equipFrame: (frameId: string) => void;
  equipHonorTitle: (title: string) => void;

  // Daily Check-In & Rewards
  dailyCheckInState: {
    streak: number;
    lastCheckInDate: string | null;
    isClaimedToday: boolean;
    history: string[];
  };
  claimDailyReward: () => { success: boolean; coinsAwarded: number; day: number; message: string };
  showDailyCheckInModal: boolean;
  setShowDailyCheckInModal: (show: boolean) => void;

  // Notifications & Push Preferences
  notifications: NotificationItem[];
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  unreadNotificationsCount: number;
  notificationPreferences: NotificationPreferences;
  updateNotificationPreferences: (prefs: NotificationPreferences) => Promise<void>;
  toggleMasterNotifications: (enabled: boolean) => Promise<void>;
  showPushSettingsModal: boolean;
  setShowPushSettingsModal: (show: boolean) => void;
  sendNotificationToUser: (params: SendNotificationParams) => Promise<void>;

  // Global & Weekly Leaderboard (Monthly-refreshing, >=100 users, up to 1 month archive)
  leaderboardMonthKey: string;
  leaderboardPreviousMonthKey: string;
  leaderboardWeekKey: string;
  firestoreLeaderboardEntries: LeaderboardEntry[];
  previousMonthLeaderboardEntries: LeaderboardEntry[];
  localLeaderboardOverrides: Record<string, LeaderboardEntry>;
  previousMonthLocalOverrides: Record<string, LeaderboardEntry>;
  showLeaderboardModal: boolean;
  setShowLeaderboardModal: (show: boolean) => void;
  leaderboardInitialScope: LeaderboardScope;
  setLeaderboardInitialScope: (scope: LeaderboardScope) => void;
  openLeaderboard: (scope?: LeaderboardScope) => void;
  loadPreviousMonthLeaderboard: () => Promise<void>;

  // Historical User Badges
  userHistoricalStats: UserHistoricalStats;
  evaluatedBadges: EvaluatedUserBadge[];
  showBadgesModal: boolean;
  setShowBadgesModal: (show: boolean) => void;
  openBadgesModal: () => void;
  toggleEquipUserBadge: (badgeId: UserBadgeId) => { success: boolean; message: string };

  // Real-Time User Directory, Follow Graph & Global Search
  realUsers: User[];
  followingUserIds: string[];
  followerUserIds: string[];
  toggleFollowUser: (targetUser: User) => Promise<boolean>;
  viewingPublicUser: User | null;
  openPublicUserProfile: (user: User) => void;
  closePublicUserProfile: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;

  // Device & Admin View
  deviceMode: 'mobile' | 'responsive' | 'admin';
  setDeviceMode: (mode: 'mobile' | 'responsive' | 'admin') => void;

  // Original Logo Asset
  customLogoUrl: string | null;
  setCustomLogoUrl: (url: string | null) => void;

  // Agency Center & Coin Seller Agency Management
  agencyProfile: CoinSellerAgencyProfile;
  agencyOrders: AgencyOrder[];
  agencyTransactions: AgencyTransaction[];
  sendAgencyCoins: (
    recipientQuery: string,
    amount: number,
    pin: string
  ) => { success: boolean; message: string; tx?: AgencyTransaction };
  deliverAgencyOrder: (
    orderId: string,
    pin: string
  ) => { success: boolean; message: string };
  rejectAgencyOrder: (
    orderId: string,
    reason?: string
  ) => { success: boolean; message: string };
  updateAgencyProfile: (updates: Partial<CoinSellerAgencyProfile>) => void;
  setAgencySecurityPin: (
    oldPin: string,
    newPin: string
  ) => { success: boolean; message: string };
  createBuyerCoinOrder: (
    order: Omit<AgencyOrder, 'id' | 'orderNo' | 'createdAt' | 'status'>
  ) => AgencyOrder;
  findUserByIdOrUsername: (query: string) => User | null;

  // Host Agency Management
  hostAgencyProfile: HostAgencyProfile;
  agencyHosts: HostMember[];
  hostJoinRequests: HostJoinRequest[];
  agencyApplications: AgencyApplication[];
  allHostAgencies: HostAgencyProfile[];
  updateHostAgencyProfile: (updates: Partial<HostAgencyProfile>) => void;
  setHostWeeklyTarget: (
    hostId: string,
    targetDiamonds: number,
    targetHours?: number
  ) => void;
  updateHostCommission: (hostId: string, commissionRate: number) => void;
  toggleHostLiveStatus: (hostId: string) => void;
  approveHostJoinRequest: (
    requestId: string,
    targetDiamonds?: number,
    commissionRate?: number,
    targetHours?: number
  ) => { success: boolean; message: string };
  updateHostContract: (
    hostId: string,
    targetDiamonds: number,
    targetHours: number,
    commissionRate: number
  ) => void;
  rejectHostJoinRequest: (requestId: string) => { success: boolean; message: string };
  removeHostFromAgency: (
    hostId: string,
    reason?: string
  ) => { success: boolean; message: string };
  requestHostResignation: (reason: string) => { success: boolean; message: string };
  submitHostJoinRequest: (
    agencyId: string,
    whatsapp: string,
    experience: string,
    expectedHours: number
  ) => { success: boolean; message: string };
  submitAgencyApplication: (
    data: Omit<AgencyApplication, 'id' | 'status' | 'submittedAt'>
  ) => { success: boolean; message: string };
  reviewAgencyApplication: (
    applicationId: string,
    action: 'approve' | 'reject'
  ) => { success: boolean; message: string };
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [registeredUsers, setRegisteredUsers] = useState<User[]>(() => {
    try {
      const saved = localStorage.getItem('alphamate_registered_users');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((u: User) => u?.id && !String(u.id).endsWith('_demo'));
        }
      }
    } catch {
      // ignore
    }
    return [];
  });
  const [realUsers, setRealUsers] = useState<User[]>([]);
  const [followingUserIds, setFollowingUserIds] = useState<string[]>([]);
  const [followerUserIds, setFollowerUserIds] = useState<string[]>([]);
  const [viewingPublicUser, setViewingPublicUser] = useState<User | null>(null);
  const [uploadInitialMode, setUploadInitialMode] = useState<'record' | 'photo' | 'gallery' | 'post'>('post');

  const isAccountRestrictedStatus = (status?: string | null): boolean =>
    status === 'deactivated' || status === 'pending_deletion' || status === 'permanently_deleted';

  const getLegalScreenFromPath = (pathname?: string): ScreenType | null => {
    if (typeof window === 'undefined') return null;
    const normalized = (pathname ?? window.location.pathname).replace(/\/+$/, '').toLowerCase();
    if (normalized === '/privacy' || normalized === '/privacy-policy') return 'privacy_policy';
    if (normalized === '/terms' || normalized === '/terms-and-conditions' || normalized === '/terms-of-service') {
      return 'terms_conditions';
    }
    if (normalized === '/delete-account' || normalized === '/account-deletion') {
      return 'delete_account';
    }
    return null;
  };

  const syncBrowserUrlForScreen = (screen: ScreenType) => {
    if (typeof window === 'undefined') return;
    try {
      const protocol = window.location.protocol;
      if (protocol !== 'http:' && protocol !== 'https:') return;
      const targetPath =
        screen === 'privacy_policy'
          ? '/privacy'
          : screen === 'terms_conditions'
          ? '/terms'
          : screen === 'delete_account'
          ? '/delete-account'
          : null;
      const currentPath = window.location.pathname.replace(/\/+$/, '').toLowerCase();
      if (targetPath && currentPath !== targetPath) {
        window.history.pushState({ screen }, '', targetPath);
      } else if (
        !targetPath &&
        (currentPath === '/privacy' ||
          currentPath === '/privacy-policy' ||
          currentPath === '/terms' ||
          currentPath === '/terms-and-conditions' ||
          currentPath === '/terms-of-service' ||
          currentPath === '/delete-account' ||
          currentPath === '/account-deletion')
      ) {
        window.history.pushState({ screen }, '', '/');
      }
    } catch {
      // ignore history errors in restricted webviews
    }
  };

  const initialLegalScreen = getLegalScreenFromPath();
  const [currentScreen, setCurrentScreenState] = useState<ScreenType>(initialLegalScreen || 'splash');
  const [screenHistory, setScreenHistory] = useState<ScreenType[]>(
    initialLegalScreen ? ['welcome', initialLegalScreen] : ['splash']
  );
  const currentScreenRef = React.useRef<ScreenType>(initialLegalScreen || 'splash');
  React.useEffect(() => {
    currentScreenRef.current = currentScreen;
  }, [currentScreen]);
  const [activeTab, setActiveTabState] = useState<MainTabType>('home');
  const [legalConsent, setLegalConsent] = useState<{ terms: boolean; privacy: boolean }>({
    terms: false,
    privacy: false,
  });
  // Never default to authenticated without an active, verified Firebase session on the device.
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<User>(() => {
    try {
      const saved = localStorage.getItem('alphamate_current_user');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return CURRENT_USER;
  });

  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [firebaseAuthLoading, setFirebaseAuthLoading] = useState<boolean>(true);
  const [isEmailVerified, setIsEmailVerified] = useState<boolean>(false);

  const saveUserSession = (user: User, authenticated = true) => {
    setCurrentUser(user);
    setCoins(typeof user.coins === 'number' ? user.coins : CURRENT_USER.coins);
    setDiamonds(typeof user.diamonds === 'number' ? user.diamonds : CURRENT_USER.diamonds);
    setHeldDiamonds(typeof user.heldDiamonds === 'number' ? user.heldDiamonds : 0);
    setIsAuthenticated(authenticated);
    try {
      if (authenticated) {
        localStorage.setItem('alphamate_current_user', JSON.stringify(user));
        localStorage.setItem('alphamate_is_authenticated', 'true');
      } else {
        localStorage.removeItem('alphamate_current_user');
        localStorage.setItem('alphamate_is_authenticated', 'false');
      }
    } catch {
      // ignore
    }
  };

  const buildNewUserFromFirebase = (fbUser: FirebaseUser, overrides?: Partial<User>): User => {
    const cleanEmail = (fbUser.email || '').trim().toLowerCase();
    const emailPrefix = cleanEmail.split('@')[0] || `user_${fbUser.uid.slice(0, 6)}`;
    const suggestedName = fbUser.displayName || emailPrefix || 'Alpha Mate';
    const suggestedUsername = emailPrefix.toLowerCase().replace(/[^a-z0-9_]/g, '_') || `user_${fbUser.uid.slice(0, 6)}`;
    const verified = isFirebaseUserVerified(fbUser);
    const isGoogle = fbUser.providerData?.some((p) => p.providerId === 'google.com');

    return {
      id: fbUser.uid,
      uniqueId: `AM_${Math.floor(100000 + Math.random() * 900000)}`,
      username: suggestedUsername,
      displayName: suggestedName,
      email: cleanEmail,
      avatar:
        fbUser.photoURL ||
        'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80',
      bio: '🌟 Alpha Mate VIP Member | LIVE • PARTY • SOCIAL 💜',
      followersCount: 1,
      followingCount: 4,
      likesCount: 12,
      level: 1,
      xp: 150,
      nextLevelXp: 500,
      vipTier: 1,
      coins: 1000,
      diamonds: 100,
      isVerified: verified,
      familyCrew: 'Alpha Champions 👑',
      isHost: false,
      authProvider: isGoogle ? 'google' : 'email',
      ...overrides,
    };
  };

  // Sync Firebase auth state (runs on boot & restores persisted device session automatically)
  useEffect(() => {
    let active = true;
    consumeGoogleRedirectResult().catch(() => null);

    const unsubscribeAuth = onAuthStateChanged(auth, async (fbUser) => {
      if (!active) return;
      setFirebaseUser(fbUser);

      if (fbUser) {
        const verified = isFirebaseUserVerified(fbUser);
        setIsEmailVerified(verified);

        try {
          const remoteProfile = await getUserProfileFromFirestore(fbUser.uid);
          if (!active) return;

          const mergedUser: User = remoteProfile
            ? {
                ...buildNewUserFromFirebase(fbUser),
                ...remoteProfile,
                id: fbUser.uid,
                email: fbUser.email || remoteProfile.email || '',
                displayName: remoteProfile.displayName || fbUser.displayName || 'Alpha Mate',
                avatar: remoteProfile.avatar || fbUser.photoURL || CURRENT_USER.avatar,
                isVerified: verified || Boolean(remoteProfile.isVerified),
              }
            : buildNewUserFromFirebase(fbUser);

          if (!remoteProfile) {
            await syncUserProfileToFirestore(mergedUser).catch(() => {});
          }
          if (remoteProfile?.notificationPreferences) {
            const hydratedPrefs = pushService.setLocalPreferences({
              ...DEFAULT_NOTIFICATION_PREFERENCES,
              ...remoteProfile.notificationPreferences,
              categories: {
                ...DEFAULT_NOTIFICATION_PREFERENCES.categories,
                ...(remoteProfile.notificationPreferences.categories || {}),
              },
            });
            setNotificationPreferences(hydratedPrefs);
          }
          const restricted = isAccountRestrictedStatus(mergedUser.accountStatus);
          saveUserSession(mergedUser, verified && !restricted);

          // Restore an existing Firebase session directly into the app after
          // refresh/reopen. Preserve direct visits to /privacy, /terms, or /delete-account.
          if (verified) {
            const activeLegal =
              currentScreenRef.current === 'privacy_policy' ||
              currentScreenRef.current === 'terms_conditions' ||
              currentScreenRef.current === 'delete_account'
                ? currentScreenRef.current
                : getLegalScreenFromPath();
            if (activeLegal) {
              setScreenHistory([restricted ? 'welcome' : 'home', activeLegal]);
              setCurrentScreenState(activeLegal);
            } else if (restricted) {
              setScreenHistory(['welcome', 'account_recovery']);
              setCurrentScreenState('account_recovery');
            } else {
              setScreenHistory(['home']);
              setCurrentScreenState('home');
            }
          }
        } catch (e) {
          console.warn('Firestore profile sync error:', e);
          const fallbackUser = buildNewUserFromFirebase(fbUser);
          saveUserSession(fallbackUser, verified);
          if (verified) {
            const activeLegal =
              currentScreenRef.current === 'privacy_policy' ||
              currentScreenRef.current === 'terms_conditions' ||
              currentScreenRef.current === 'delete_account'
                ? currentScreenRef.current
                : getLegalScreenFromPath();
            if (activeLegal) {
              setScreenHistory(['home', activeLegal]);
              setCurrentScreenState(activeLegal);
            } else {
              setScreenHistory(['home']);
              setCurrentScreenState('home');
            }
          }
        } finally {
          if (active) setFirebaseAuthLoading(false);
        }
      } else {
        setIsEmailVerified(false);
        setIsAuthenticated(false);
        setCurrentUser(CURRENT_USER);
        try {
          localStorage.removeItem('alphamate_current_user');
          localStorage.setItem('alphamate_is_authenticated', 'false');
        } catch {
          // ignore
        }
        setFirebaseAuthLoading(false);
      }
    });

    return () => {
      active = false;
      unsubscribeAuth();
    };
  }, []);

  // Real-time Firestore + WebSocket discovery listeners (rebinds automatically on auth transitions)
  useEffect(() => {
    let firestoreRooms: PartyRoom[] = [];
    let firestoreStreams: LiveStream[] = [];
    const wsPartyMap = new Map<string, PartyRoom>();
    const wsLiveMap = new Map<string, LiveStream>();
    const removedPartyUntil = new Map<string, number>();
    const removedLiveUntil = new Map<string, number>();

    const mergeAndPublishRooms = () => {
      const now = Date.now();
      const merged = new Map<string, PartyRoom>();
      firestoreRooms.forEach((r) => {
        if (!r?.id) return;
        const removedAt = removedPartyUntil.get(r.id);
        if (removedAt && now - removedAt < 15_000) return;
        merged.set(r.id, r);
      });
      wsPartyMap.forEach((r, id) => {
        const removedAt = removedPartyUntil.get(id);
        if (removedAt && now - removedAt < 15_000) return;
        const existing = merged.get(id);
        merged.set(id, existing ? { ...existing, ...r } : r);
      });
      const nextRooms = Array.from(merged.values());
      setPartyRooms(nextRooms);
      setActivePartyRoom((currentActive) => {
        if (!currentActive) return null;
        const fresh = nextRooms.find((r) => r.id === currentActive.id);
        return fresh ? { ...currentActive, ...fresh } : currentActive;
      });
    };

    const mergeAndPublishStreams = () => {
      const now = Date.now();
      const merged = new Map<string, LiveStream>();
      firestoreStreams.forEach((s) => {
        if (!s?.id) return;
        const removedAt = removedLiveUntil.get(s.id);
        if (removedAt && now - removedAt < 15_000) return;
        merged.set(s.id, s);
      });
      wsLiveMap.forEach((s, id) => {
        const removedAt = removedLiveUntil.get(id);
        if (removedAt && now - removedAt < 15_000) return;
        const existing = merged.get(id);
        merged.set(id, existing ? { ...existing, ...s } : s);
      });
      setLiveStreams(Array.from(merged.values()));
    };

    if (firebaseUser?.uid) {
      realtimeSocket.ensureConnected();
    } else {
      realtimeSocket.disconnect();
    }

    const unsubscribeWs = realtimeSocket.onDiscoveryUpdate((event) => {
      if (event.type === 'discovery:snapshot') {
        wsLiveMap.clear();
        wsPartyMap.clear();
        event.liveStreams.forEach((s) => {
          if (s?.id && s.isActive !== false && s.sfuSessionId) wsLiveMap.set(s.id, s);
        });
        event.partyRooms.forEach((r) => {
          if (r?.id && r.isActive !== false) wsPartyMap.set(r.id, r);
        });
        mergeAndPublishStreams();
        mergeAndPublishRooms();
      } else if (event.type === 'live:upsert' && event.stream?.id) {
        removedLiveUntil.delete(event.stream.id);
        wsLiveMap.set(event.stream.id, event.stream);
        mergeAndPublishStreams();
      } else if (event.type === 'live:remove' && event.streamId) {
        wsLiveMap.delete(event.streamId);
        removedLiveUntil.set(event.streamId, Date.now());
        mergeAndPublishStreams();
      } else if (event.type === 'party:upsert' && event.room?.id) {
        removedPartyUntil.delete(event.room.id);
        wsPartyMap.set(event.room.id, event.room);
        mergeAndPublishRooms();
      } else if (event.type === 'party:remove' && event.roomId) {
        wsPartyMap.delete(event.roomId);
        removedPartyUntil.set(event.roomId, Date.now());
        mergeAndPublishRooms();
      }
    });

    const unsubscribeRooms = subscribeToPartyRooms((remoteRooms) => {
      firestoreRooms = Array.isArray(remoteRooms) ? remoteRooms : [];
      const activeIds = new Set(firestoreRooms.map((r) => r.id));
      for (const id of Array.from(wsPartyMap.keys())) {
        if (!activeIds.has(id)) {
          const item = wsPartyMap.get(id) as any;
          if (item?.lastSeenAtMs && Date.now() - item.lastSeenAtMs > 20_000) {
            wsPartyMap.delete(id);
          }
        }
      }
      mergeAndPublishRooms();
    });

    const unsubscribeLiveStreams = subscribeToLiveStreams((remoteStreams) => {
      firestoreStreams = Array.isArray(remoteStreams) ? remoteStreams : [];
      const activeIds = new Set(firestoreStreams.map((s) => s.id));
      for (const id of Array.from(wsLiveMap.keys())) {
        if (!activeIds.has(id)) {
          const item = wsLiveMap.get(id) as any;
          if (item?.lastSeenAtMs && Date.now() - item.lastSeenAtMs > 20_000) {
            wsLiveMap.delete(id);
          }
        }
      }
      mergeAndPublishStreams();
    });

    // Real-time Firestore Reels & Cloudflare R2 Feed Subscription
    const unsubscribeReels = subscribeToActiveReels((remoteReels: Reel[]) => {
      if (remoteReels && remoteReels.length > 0) {
        setVideos((prevLocal) => {
          const remotePosts: VideoPost[] = remoteReels.map((reel) => ({
            id: reel.id,
            user: {
              id: reel.creator?.id || reel.uid,
              uniqueId: reel.creator?.uniqueId || reel.uid.slice(0, 8),
              username: reel.creator?.username || 'creator',
              displayName: reel.creator?.displayName || 'Alpha Creator',
              avatar: reel.creator?.avatar || '',
              bio: '',
              followersCount: 120,
              followingCount: 45,
              likesCount: reel.likesCount || 0,
              level: reel.creator?.level || 1,
              xp: 100,
              nextLevelXp: 500,
              vipTier: reel.creator?.vipTier || 0,
              coins: 500,
              diamonds: 50,
              isVerified: !!reel.creator?.isVerified,
            },
            videoUrl: reel.videoUrl,
            videoKey: reel.videoKey,
            thumbnail: reel.thumbnailUrl || reel.creator?.avatar || '',
            title: reel.title || reel.caption || 'Alpha Moment',
            description: reel.caption || '',
            tags: reel.tags || ['#AlphaMoments'],
            likes: reel.likesCount || 0,
            commentsCount: reel.commentsCount || 0,
            sharesCount: 0,
            viewsCount: reel.viewsCount || 0,
            isLiked: false,
            feedCategory: 'For You',
            timestamp: reel.createdAt ? new Date(reel.createdAt).toLocaleDateString() : 'Just now',
            postType: 'video',
          }));

          const remoteIds = new Set(remotePosts.map((r) => r.id));
          const localOnly = prevLocal.filter((p) => !remoteIds.has(p.id) && !p.videoKey);
          return [...remotePosts, ...localOnly];
        });
      }
    });

    return () => {
      unsubscribeWs();
      unsubscribeRooms();
      unsubscribeLiveStreams();
      unsubscribeReels();
    };
  }, [firebaseUser?.uid]);

  // =========================================================================
  // GLOBAL & WEEKLY LEADERBOARD (MONTHLY REFRESH + 1-MONTH RETENTION)
  // =========================================================================
  const [leaderboardMonthKey, setLeaderboardMonthKey] = useState<string>(() => getCurrentMonthKey());
  const [leaderboardPreviousMonthKey, setLeaderboardPreviousMonthKey] = useState<string>(() =>
    getPreviousMonthKey()
  );
  const [leaderboardWeekKey, setLeaderboardWeekKey] = useState<string>(() => getCurrentWeekKey());
  const [firestoreLeaderboardEntries, setFirestoreLeaderboardEntries] = useState<LeaderboardEntry[]>([]);
  const [previousMonthLeaderboardEntries, setPreviousMonthLeaderboardEntries] = useState<
    LeaderboardEntry[]
  >([]);
  const [localLeaderboardOverrides, setLocalLeaderboardOverrides] = useState<
    Record<string, LeaderboardEntry>
  >(() => loadLocalLeaderboardOverrides(getCurrentMonthKey()));
  const [previousMonthLocalOverrides, setPreviousMonthLocalOverrides] = useState<
    Record<string, LeaderboardEntry>
  >(() => loadLocalLeaderboardOverrides(getPreviousMonthKey()));
  const [showLeaderboardModal, setShowLeaderboardModal] = useState<boolean>(false);
  const [leaderboardInitialScope, setLeaderboardInitialScope] = useState<LeaderboardScope>('global');

  const pendingTimeSyncMinsRef = React.useRef<number>(0);
  const currentUserRef = React.useRef<User>(currentUser);
  React.useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  const openLeaderboard = (scope: LeaderboardScope = 'global') => {
    setLeaderboardInitialScope(scope);
    setShowLeaderboardModal(true);
  };

  const loadPreviousMonthLeaderboard = async () => {
    const prevKey = getPreviousMonthKey();
    setLeaderboardPreviousMonthKey(prevKey);
    setPreviousMonthLocalOverrides(loadLocalLeaderboardOverrides(prevKey));
    const entries = await fetchMonthlyLeaderboardOnce(prevKey, 200);
    setPreviousMonthLeaderboardEntries(entries);
  };

  // Prune leaderboard records older than 1 previous month & subscribe to current month Firestore feed
  useEffect(() => {
    pruneExpiredLocalLeaderboardMonths(leaderboardMonthKey, leaderboardPreviousMonthKey);
    setLocalLeaderboardOverrides(loadLocalLeaderboardOverrides(leaderboardMonthKey));

    if (!firebaseUser?.uid || !isEmailVerified) {
      setFirestoreLeaderboardEntries([]);
      return;
    }

    const unsub = subscribeToMonthlyLeaderboard(
      leaderboardMonthKey,
      (entries) => {
        setFirestoreLeaderboardEntries(entries);
      },
      200
    );
    return () => {
      unsub();
    };
  }, [firebaseUser?.uid, isEmailVerified, leaderboardMonthKey, leaderboardPreviousMonthKey]);

  // Active time-spent heartbeat (counts active minutes & handles automatic monthly/weekly resets)
  useEffect(() => {
    if (!isAuthenticated || !firebaseUser?.uid || !isEmailVerified) return;

    const initialUser = currentUserRef.current;
    const initLocal = applyLocalLeaderboardTime(
      initialUser,
      0,
      leaderboardMonthKey,
      leaderboardWeekKey
    );
    setLocalLeaderboardOverrides(initLocal);
    syncUserTimeSpentToLeaderboard(initialUser, 0).catch(() => {});

    const flushPendingTime = () => {
      const pending = pendingTimeSyncMinsRef.current;
      if (pending <= 0) return;
      pendingTimeSyncMinsRef.current = 0;
      syncUserTimeSpentToLeaderboard(currentUserRef.current, pending).catch(() => {});
    };

    const interval = setInterval(() => {
      const latestMonth = getCurrentMonthKey();
      const latestPrevMonth = getPreviousMonthKey();
      const latestWeek = getCurrentWeekKey();

      if (latestMonth !== leaderboardMonthKey) {
        setLeaderboardMonthKey(latestMonth);
        setLeaderboardPreviousMonthKey(latestPrevMonth);
        pendingTimeSyncMinsRef.current = 0;
      }
      if (latestWeek !== leaderboardWeekKey) {
        setLeaderboardWeekKey(latestWeek);
      }

      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
      }

      const nextLocal = applyLocalLeaderboardTime(
        currentUserRef.current,
        1,
        latestMonth,
        latestWeek
      );
      setLocalLeaderboardOverrides(nextLocal);
      pendingTimeSyncMinsRef.current += 1;

      if (pendingTimeSyncMinsRef.current >= 2) {
        flushPendingTime();
      }
    }, 60_000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushPendingTime();
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      clearInterval(interval);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
      flushPendingTime();
    };
  }, [isAuthenticated, firebaseUser?.uid, isEmailVerified, leaderboardMonthKey, leaderboardWeekKey]);

  // Live Streams & PK
  const [liveStreams, setLiveStreams] = useState<LiveStream[]>([]);
  const [activeStream, setActiveStream] = useState<LiveStream | null>(null);
  const [activePKBattle, setActivePKBattle] = useState<LiveStream | null>(null);
  const [pkScores, setPkScores] = useState<{ left: number; right: number }>({ left: 3420, right: 2890 });
  const [activeGiftBanner, setActiveGiftBanner] = useState<{ gift: Gift; sender: string; recipient: string } | null>(null);

  // Audio Party Rooms
  const [partyRooms, setPartyRooms] = useState<PartyRoom[]>([]);
  const [activePartyRoom, setActivePartyRoom] = useState<PartyRoom | null>(null);
  const [userSeatIndex, setUserSeatIndex] = useState<number | null>(null);
  const [isMicMuted, setIsMicMuted] = useState<boolean>(false);

  // Chat
  const [conversations, setConversations] = useState<Conversation[]>(MOCK_CONVERSATIONS);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);

  // Videos
  const [videos, setVideos] = useState<VideoPost[]>(MOCK_VIDEOS);

  // Stories & Friends
  const [friendStories, setFriendStories] = useState<FriendStory[]>(MOCK_FRIEND_STORIES);
  const [myStories, setMyStories] = useState<StoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('alphamate_my_stories');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((s: StoryItem) => s?.id !== 'story_me_default');
        }
      }
    } catch {
      // ignore
    }
    return [];
  });

  // Economy
  const [coins, setCoins] = useState<number>(CURRENT_USER.coins);
  const [diamonds, setDiamonds] = useState<number>(CURRENT_USER.diamonds);
  const [heldDiamonds, setHeldDiamonds] = useState<number>(CURRENT_USER.heldDiamonds || 0);
  const [transactions, setTransactions] = useState<WalletTransaction[]>(MOCK_TRANSACTIONS);

  // Daily Check-In & Rewards System
  const DAILY_CHECKIN_REWARDS = [
    { day: 1, coins: 50, bonus: null },
    { day: 2, coins: 100, bonus: null },
    { day: 3, coins: 150, bonus: 'Silver Badge' },
    { day: 4, coins: 250, bonus: '2x XP Booster' },
    { day: 5, coins: 400, bonus: null },
    { day: 6, coins: 600, bonus: 'Exclusive Audio Wave' },
    { day: 7, coins: 1500, bonus: '👑 Royal VIP Box', isSpecial: true },
  ];

  const getTodayDateString = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const getYesterdayDateString = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const [showDailyCheckInModal, setShowDailyCheckInModal] = useState<boolean>(false);
  const [dailyCheckInState, setDailyCheckInState] = useState<{
    streak: number;
    lastCheckInDate: string | null;
    isClaimedToday: boolean;
    history: string[];
  }>(() => {
    const today = getTodayDateString();
    try {
      const saved = localStorage.getItem('alphamate_daily_checkin');
      if (saved) {
        const parsed = JSON.parse(saved);
        const isClaimedToday = parsed.lastCheckInDate === today;
        return {
          ...parsed,
          isClaimedToday,
        };
      }
    } catch {
      // ignore
    }
    return {
      streak: 0,
      lastCheckInDate: null,
      isClaimedToday: false,
      history: [],
    };
  });

  const claimDailyReward = () => {
    const today = getTodayDateString();
    const yesterday = getYesterdayDateString();

    if (dailyCheckInState.lastCheckInDate === today) {
      return {
        success: false,
        coinsAwarded: 0,
        day: dailyCheckInState.streak,
        message: 'You have already claimed today’s reward! Come back tomorrow.',
      };
    }

    // If checked in yesterday, increment streak up to 7; otherwise restart at Day 1
    let nextStreak = 1;
    if (dailyCheckInState.lastCheckInDate === yesterday) {
      nextStreak = (dailyCheckInState.streak % 7) + 1;
    } else if (dailyCheckInState.lastCheckInDate === null) {
      nextStreak = 1;
    } else {
      nextStreak = 1;
    }

    const reward = DAILY_CHECKIN_REWARDS.find((r) => r.day === nextStreak) || DAILY_CHECKIN_REWARDS[0];
    const coinsAwarded = reward.coins;

    // 1. Add coins to user
    setCoins((prev) => prev + coinsAwarded);

    // 2. Update currentUser object
    setCurrentUser((prev) => {
      const updated = {
        ...prev,
        coins: prev.coins + coinsAwarded,
      };
      saveUserSession(updated);
      return updated;
    });

    // 3. Add wallet transaction
    const newTx: WalletTransaction = {
      id: `tx_checkin_${Date.now()}`,
      type: 'reward',
      amount: coinsAwarded,
      currency: 'coins',
      title: `Day ${nextStreak} Daily Check-In Bonus`,
      date: 'Just now',
      status: 'completed',
    };
    setTransactions((prev) => [newTx, ...prev]);

    // 4. Add system notification
    const newNotif: NotificationItem = {
      id: `notif_checkin_${Date.now()}`,
      type: 'system',
      title: `🎉 Day ${nextStreak} Reward Claimed! (+${coinsAwarded} Coins)`,
      message: `You earned ${coinsAwarded} Alpha Coins! Keep your streak alive tomorrow for even bigger prizes.`,
      timestamp: 'Just now',
      isRead: false,
    };
    setNotifications((prev) => [newNotif, ...prev]);

    // 5. Update and persist daily check-in state
    const newState = {
      streak: nextStreak,
      lastCheckInDate: today,
      isClaimedToday: true,
      history: [...dailyCheckInState.history, today],
    };
    setDailyCheckInState(newState);
    try {
      localStorage.setItem('alphamate_daily_checkin', JSON.stringify(newState));
    } catch {
      // ignore
    }

    return {
      success: true,
      coinsAwarded,
      day: nextStreak,
      message: `Successfully claimed ${coinsAwarded} Coins for Day ${nextStreak}!`,
    };
  };

  // Notifications & 60/40 Gift Ledger
  const [notifications, setNotifications] = useState<NotificationItem[]>(MOCK_NOTIFICATIONS);
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>(() =>
    pushService.getPreferences()
  );
  const [showPushSettingsModal, setShowPushSettingsModal] = useState<boolean>(false);
  const [giftTransactions, setGiftTransactions] = useState<GiftTransactionRecord[]>(() => {
    try {
      const saved = localStorage.getItem('alphamate_gift_transactions');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return [];
  });
  const announcedLiveIdsRef = React.useRef<Set<string>>(new Set());
  const seenNotificationIdsRef = React.useRef<Set<string>>(new Set());
  const notificationBootedRef = React.useRef<boolean>(false);

  // =========================================================================
  // HISTORICAL USER BADGE SYSTEM (Top Contributor, Gift King, Party Legend)
  // =========================================================================
  const [showBadgesModal, setShowBadgesModal] = useState<boolean>(false);
  const openBadgesModal = () => setShowBadgesModal(true);
  const activeBadgeUid = firebaseUser?.uid || currentUser.id || 'user_me';

  const [rawBadgeStats, setRawBadgeStats] = useState<UserHistoricalStats>(() =>
    loadLocalUserBadgeStats(activeBadgeUid)
  );
  const activePartySessionMinsRef = React.useRef<number>(0);
  const lastSyncedBadgeSigRef = React.useRef<string>('');
  const notifiedBadgeUnlocksRef = React.useRef<Set<string>>(new Set());
  const activePartyRoomRef = React.useRef<PartyRoom | null>(activePartyRoom);
  const activeStreamRef = React.useRef<LiveStream | null>(activeStream);

  React.useEffect(() => {
    activePartyRoomRef.current = activePartyRoom;
    if (!activePartyRoom) {
      activePartySessionMinsRef.current = 0;
    }
  }, [activePartyRoom]);

  React.useEffect(() => {
    activeStreamRef.current = activeStream;
  }, [activeStream]);

  // Reload local badge history and subscribe to Firestore badgeStats on account change
  useEffect(() => {
    notifiedBadgeUnlocksRef.current.clear();
    lastSyncedBadgeSigRef.current = '';
    setRawBadgeStats(loadLocalUserBadgeStats(activeBadgeUid));

    if (!firebaseUser?.uid || !isEmailVerified) return;

    const unsubBadges = subscribeToUserBadgeStats(firebaseUser.uid, (remote) => {
      if (!remote) return;
      setRawBadgeStats((prev) => {
        const mergedEarned: UserHistoricalStats['earnedBadges'] = { ...prev.earnedBadges };
        Object.entries(remote.earnedBadges || {}).forEach(([id, rec]) => {
          const localRec = mergedEarned[id];
          if (!localRec) {
            mergedEarned[id] = rec;
          } else {
            const tierRank = { bronze: 1, silver: 2, gold: 3, mythic: 4 } as const;
            mergedEarned[id] = {
              ...localRec,
              tier: tierRank[rec.tier] > tierRank[localRec.tier] ? rec.tier : localRec.tier,
              metricValue: Math.max(localRec.metricValue || 0, rec.metricValue || 0),
              unlockedAtMs: Math.min(localRec.unlockedAtMs || Date.now(), rec.unlockedAtMs || Date.now()),
            };
          }
        });

        const mergedEquipped =
          remote.updatedAtMs >= prev.updatedAtMs && remote.equippedBadgeIds.length > 0
            ? remote.equippedBadgeIds
            : prev.equippedBadgeIds.length > 0
            ? prev.equippedBadgeIds
            : remote.equippedBadgeIds;

        return {
          uid: firebaseUser.uid,
          totalGiftCoinsSent: Math.max(prev.totalGiftCoinsSent, remote.totalGiftCoinsSent),
          totalGiftsSentCount: Math.max(prev.totalGiftsSentCount, remote.totalGiftsSentCount),
          totalGiftCoinsReceived: Math.max(prev.totalGiftCoinsReceived, remote.totalGiftCoinsReceived),
          totalDiamondsEarned: Math.max(prev.totalDiamondsEarned, remote.totalDiamondsEarned),
          totalActiveMinutes: Math.max(prev.totalActiveMinutes, remote.totalActiveMinutes),
          partyRoomMinutes: Math.max(prev.partyRoomMinutes, remote.partyRoomMinutes),
          liveStreamMinutes: Math.max(prev.liveStreamMinutes, remote.liveStreamMinutes),
          longestPartySessionMinutes: Math.max(
            prev.longestPartySessionMinutes,
            remote.longestPartySessionMinutes
          ),
          bestLeaderboardRank:
            prev.bestLeaderboardRank && remote.bestLeaderboardRank
              ? Math.min(prev.bestLeaderboardRank, remote.bestLeaderboardRank)
              : prev.bestLeaderboardRank || remote.bestLeaderboardRank || null,
          checkInDaysCount: Math.max(prev.checkInDaysCount, remote.checkInDaysCount),
          maxDailyStreak: Math.max(prev.maxDailyStreak, remote.maxDailyStreak),
          postsCreatedCount: Math.max(prev.postsCreatedCount, remote.postsCreatedCount),
          equippedBadgeIds: mergedEquipped.slice(0, MAX_EQUIPPED_BADGES),
          earnedBadges: mergedEarned,
          updatedAt: remote.updatedAt || prev.updatedAt,
          updatedAtMs: Math.max(prev.updatedAtMs || 0, remote.updatedAtMs || 0),
        };
      });
    });

    return () => {
      unsubBadges();
    };
  }, [activeBadgeUid, firebaseUser?.uid, isEmailVerified]);

  // 60-second active engagement, Party Room attendance & Live Stream attendance tracker
  useEffect(() => {
    if (!isAuthenticated) return;
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
      }
      const inParty = Boolean(activePartyRoomRef.current);
      const inLive = Boolean(activeStreamRef.current);
      if (inParty) {
        activePartySessionMinsRef.current += 1;
      }
      setRawBadgeStats((prev) => ({
        ...prev,
        uid: activeBadgeUid,
        totalActiveMinutes: prev.totalActiveMinutes + 1,
        partyRoomMinutes: prev.partyRoomMinutes + (inParty ? 1 : 0),
        liveStreamMinutes: prev.liveStreamMinutes + (inLive ? 1 : 0),
        longestPartySessionMinutes: Math.max(
          prev.longestPartySessionMinutes,
          activePartySessionMinsRef.current
        ),
        updatedAt: new Date().toISOString(),
        updatedAtMs: Date.now(),
      }));
    }, 60_000);

    return () => clearInterval(interval);
  }, [isAuthenticated, activeBadgeUid]);

  // Resolve current & previous month leaderboard entries for badge evaluation
  const badgeLeaderboardSnapshot = useMemo(() => {
    const currentMerged = buildMergedLeaderboardList({
      firestoreEntries: firestoreLeaderboardEntries,
      localOverrides: localLeaderboardOverrides,
      currentUser,
      activeUid: activeBadgeUid,
      monthKey: leaderboardMonthKey,
      currentWeekKey: leaderboardWeekKey,
      scope: 'global',
      metric: 'overall',
      isCurrentMonth: true,
    });
    const prevEntry =
      previousMonthLeaderboardEntries.find(
        (e) => e.uid === activeBadgeUid || e.uid === currentUser.id
      ) ||
      previousMonthLocalOverrides[activeBadgeUid] ||
      previousMonthLocalOverrides[currentUser.id] ||
      null;

    return {
      currentEntry: currentMerged.myEntry,
      currentRank: currentMerged.myRank,
      prevEntry,
    };
  }, [
    firestoreLeaderboardEntries,
    localLeaderboardOverrides,
    previousMonthLeaderboardEntries,
    previousMonthLocalOverrides,
    currentUser,
    activeBadgeUid,
    leaderboardMonthKey,
    leaderboardWeekKey,
  ]);

  const evaluatedBadgeResult = useMemo(
    () =>
      evaluateHistoricalBadges({
        uid: activeBadgeUid,
        storedStats: rawBadgeStats,
        currentUser,
        giftTransactions,
        walletTransactions: transactions,
        videos,
        dailyCheckInState,
        currentLeaderboardEntry: badgeLeaderboardSnapshot.currentEntry,
        previousLeaderboardEntry: badgeLeaderboardSnapshot.prevEntry,
        currentLeaderboardRank: badgeLeaderboardSnapshot.currentRank,
      }),
    [
      activeBadgeUid,
      rawBadgeStats,
      currentUser,
      giftTransactions,
      transactions,
      videos,
      dailyCheckInState,
      badgeLeaderboardSnapshot,
    ]
  );

  // Persist badge evaluations, sync to Firestore/Profile (write-guarded), and notify on unlocks
  useEffect(() => {
    const nextStats = evaluatedBadgeResult.nextStats;
    saveLocalUserBadgeStats(nextStats);

    const earnedSignature = Object.entries(nextStats.earnedBadges)
      .map(([k, v]) => `${k}:${v.tier}`)
      .sort()
      .join(',');
    const sig = [
      nextStats.uid,
      nextStats.totalGiftCoinsSent,
      nextStats.totalGiftsSentCount,
      nextStats.totalGiftCoinsReceived,
      nextStats.totalDiamondsEarned,
      nextStats.totalActiveMinutes,
      nextStats.partyRoomMinutes,
      nextStats.liveStreamMinutes,
      nextStats.longestPartySessionMinutes,
      nextStats.bestLeaderboardRank || 0,
      nextStats.checkInDaysCount,
      nextStats.maxDailyStreak,
      nextStats.postsCreatedCount,
      nextStats.equippedBadgeIds.join(','),
      earnedSignature,
    ].join('|');

    const prevEquippedJoined = (currentUserRef.current.equippedBadgeIds || []).join(',');
    const nextEquippedJoined = nextStats.equippedBadgeIds.join(',');
    if (isAuthenticated && prevEquippedJoined !== nextEquippedJoined) {
      setCurrentUser((prev) => {
        const updated = { ...prev, equippedBadgeIds: nextStats.equippedBadgeIds };
        try {
          localStorage.setItem('alphamate_current_user', JSON.stringify(updated));
        } catch {}
        return updated;
      });
    }

    if (
      isAuthenticated &&
      firebaseUser?.uid === nextStats.uid &&
      isEmailVerified &&
      sig !== lastSyncedBadgeSigRef.current
    ) {
      lastSyncedBadgeSigRef.current = sig;
      syncUserBadgeStatsToFirestore(nextStats).catch(() => {});
      if (prevEquippedJoined !== nextEquippedJoined) {
        syncUserProfileToFirestore({
          ...currentUserRef.current,
          id: firebaseUser.uid,
          equippedBadgeIds: nextStats.equippedBadgeIds,
        }).catch(() => {});
        syncUserTimeSpentToLeaderboard(
          { ...currentUserRef.current, equippedBadgeIds: nextStats.equippedBadgeIds },
          0
        ).catch(() => {});
      }
    }

    if (isAuthenticated && !firebaseAuthLoading && evaluatedBadgeResult.newlyUnlockedIds.length > 0) {
      evaluatedBadgeResult.newlyUnlockedIds.forEach((badgeId) => {
        const tier = nextStats.earnedBadges[badgeId]?.tier || 'bronze';
        const key = `${nextStats.uid}:${badgeId}:${tier}`;
        if (notifiedBadgeUnlocksRef.current.has(key)) return;
        notifiedBadgeUnlocksRef.current.add(key);

        const def = BADGE_BY_ID[badgeId];
        if (!def) return;
        const notifId = `local_notif_badge_${badgeId}_${Date.now()}`;
        const badgeNotif: NotificationItem = {
          id: notifId,
          type: 'system',
          category: 'walletAndSystem',
          title: `🏅 Badge Unlocked: ${def.name}`,
          message: `You earned the ${tier.toUpperCase()} tier "${def.name}" icon based on your Alpha Mate history!`,
          timestamp: 'Just now',
          createdAtMs: Date.now(),
          isRead: false,
          screen: 'profile',
        };
        setNotifications((prev) => [badgeNotif, ...prev]);
        pushService.notifyForeground({
          id: notifId,
          title: badgeNotif.title,
          body: badgeNotif.message,
          data: { type: 'system', screen: 'profile' },
        });
      });
    }
  }, [
    evaluatedBadgeResult,
    isAuthenticated,
    firebaseAuthLoading,
    firebaseUser?.uid,
    isEmailVerified,
  ]);

  const toggleEquipUserBadge = (
    badgeId: UserBadgeId
  ): { success: boolean; message: string } => {
    const nextStats = evaluatedBadgeResult.nextStats;
    const isEarned = Boolean(nextStats.earnedBadges[badgeId]);
    if (!isEarned) {
      return {
        success: false,
        message: 'Earn at least the Bronze tier of this badge before equipping it.',
      };
    }

    const currentlyEquipped = nextStats.equippedBadgeIds || [];
    const isEquipped = currentlyEquipped.includes(badgeId);
    let updatedEquipped: UserBadgeId[];

    if (isEquipped) {
      updatedEquipped = currentlyEquipped.filter((id) => id !== badgeId);
    } else {
      if (currentlyEquipped.length >= MAX_EQUIPPED_BADGES) {
        return {
          success: false,
          message: `You can display up to ${MAX_EQUIPPED_BADGES} badges on your profile. Unequip one first.`,
        };
      }
      updatedEquipped = [...currentlyEquipped, badgeId];
    }

    const updatedStats: UserHistoricalStats = {
      ...nextStats,
      equippedBadgeIds: updatedEquipped,
      updatedAt: new Date().toISOString(),
      updatedAtMs: Date.now(),
    };

    setRawBadgeStats(updatedStats);
    saveLocalUserBadgeStats(updatedStats);

    setCurrentUser((prev) => {
      const updated = { ...prev, equippedBadgeIds: updatedEquipped };
      try {
        localStorage.setItem('alphamate_current_user', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    if (firebaseUser?.uid && isEmailVerified) {
      syncUserBadgeStatsToFirestore(updatedStats).catch(() => {});
      syncUserProfileToFirestore({
        ...currentUserRef.current,
        id: firebaseUser.uid,
        equippedBadgeIds: updatedEquipped,
      }).catch(() => {});
      syncUserTimeSpentToLeaderboard(
        { ...currentUserRef.current, equippedBadgeIds: updatedEquipped },
        0
      ).catch(() => {});
    }

    const def = BADGE_BY_ID[badgeId];
    return {
      success: true,
      message: isEquipped
        ? `Removed "${def?.name || badgeId}" from your profile display.`
        : `Equipped "${def?.name || badgeId}" icon on your profile!`,
    };
  };

  // Real-time User Profile, Notifications & 60/40 Gift Ledger Subscriptions
  useEffect(() => {
    if (!firebaseUser?.uid || !isEmailVerified) {
      seenNotificationIdsRef.current.clear();
      notificationBootedRef.current = false;
      return;
    }

    const uid = firebaseUser.uid;
    const isAdmin = firebaseUser.email?.toLowerCase() === 'alphamateapp@gmail.com';
    const sessionStartedAt = Date.now();

    const unsubProfile = subscribeToUserProfile(uid, (remoteProfile) => {
      if (!remoteProfile) return;
      if (typeof remoteProfile.coins === 'number') {
        setCoins(remoteProfile.coins);
      }
      if (typeof remoteProfile.diamonds === 'number') {
        setDiamonds(remoteProfile.diamonds);
      }
      if (typeof remoteProfile.heldDiamonds === 'number') {
        setHeldDiamonds(remoteProfile.heldDiamonds);
      }
      if (remoteProfile.notificationPreferences) {
        const syncedPrefs = pushService.setLocalPreferences({
          ...DEFAULT_NOTIFICATION_PREFERENCES,
          ...remoteProfile.notificationPreferences,
          categories: {
            ...DEFAULT_NOTIFICATION_PREFERENCES.categories,
            ...(remoteProfile.notificationPreferences.categories || {}),
          },
        });
        setNotificationPreferences(syncedPrefs);
      }
      setCurrentUser((prev) => ({
        ...prev,
        coins: typeof remoteProfile.coins === 'number' ? remoteProfile.coins : prev.coins,
        diamonds: typeof remoteProfile.diamonds === 'number' ? remoteProfile.diamonds : prev.diamonds,
        heldDiamonds: typeof remoteProfile.heldDiamonds === 'number' ? remoteProfile.heldDiamonds : prev.heldDiamonds,
        notificationPreferences: remoteProfile.notificationPreferences || prev.notificationPreferences,
        equippedBadgeIds: Array.isArray(remoteProfile.equippedBadgeIds)
          ? remoteProfile.equippedBadgeIds
          : prev.equippedBadgeIds,
      }));
    });

    const unsubNotifs = subscribeToUserNotifications(uid, (remoteItems) => {
      const typedItems = remoteItems as NotificationItem[];
      setNotifications((prev) => {
        const remoteIds = new Set(typedItems.map((i) => i.id));
        const localOnly = prev.filter((p) => !remoteIds.has(p.id) && p.id.startsWith('local_notif_'));
        return [...typedItems, ...localOnly];
      });

      if (!notificationBootedRef.current) {
        typedItems.forEach((n) => seenNotificationIdsRef.current.add(n.id));
        notificationBootedRef.current = true;
        return;
      }

      typedItems.forEach((n) => {
        if (!seenNotificationIdsRef.current.has(n.id)) {
          seenNotificationIdsRef.current.add(n.id);
          const createdMs = n.createdAtMs || 0;
          if (!n.isRead && createdMs >= sessionStartedAt - 15000) {
            pushService.notifyForeground({
              id: n.id,
              title: n.title,
              body: n.message,
              data: {
                type: n.type,
                category: n.category,
                screen: n.screen,
                tab: n.tab,
                roomId: n.roomId,
                streamId: n.streamId,
                reelId: n.reelId,
                chatId: n.chatId,
                senderId: n.senderId,
              },
            });
          }
        }
      });
    });

    const unsubGifts = subscribeToGiftTransactions({ userId: uid, isAdmin }, (remoteGifts) => {
      const normalized = remoteGifts as GiftTransactionRecord[];
      setGiftTransactions((prev) => {
        const remoteIds = new Set(normalized.map((g) => g.id));
        const localDemoOnly = prev.filter((g) => !remoteIds.has(g.id) && g.id.startsWith('local_gift_'));
        const merged = [...normalized, ...localDemoOnly];
        try {
          localStorage.setItem('alphamate_gift_transactions', JSON.stringify(merged.slice(0, 100)));
        } catch {}
        return merged;
      });
    });

    const unsubUsers = subscribeToRealUsers((usersList) => {
      setRealUsers(usersList);
      setRegisteredUsers(usersList);
    });

    const unsubFollows = subscribeToMyFollowEdges(uid, (edges) => {
      setFollowingUserIds(edges.followingIds);
      setFollowerUserIds(edges.followerIds);
    });

    return () => {
      unsubProfile();
      unsubNotifs();
      unsubGifts();
      unsubUsers();
      unsubFollows();
    };
  }, [firebaseUser?.uid, firebaseUser?.email, isEmailVerified]);

  const updateNotificationPreferences = async (prefs: NotificationPreferences) => {
    const uid =
      firebaseUser?.uid ||
      (currentUser?.id && !currentUser.id.startsWith('user_') ? currentUser.id : null);
    const normalized = await pushService.saveAndSyncPreferences(uid, prefs);
    setNotificationPreferences(normalized);
    setCurrentUser((prev) => {
      const updated = { ...prev, notificationPreferences: normalized };
      saveUserSession(updated, isAuthenticated);
      return updated;
    });
    if (firebaseUser?.uid) {
      updateUserNotificationPreferencesFirestore(firebaseUser.uid, normalized).catch(() => {});
    }
  };

  const toggleMasterNotifications = async (enabled: boolean) => {
    if (enabled) {
      await pushService.requestPermissions().catch(() => {});
      if (firebaseUser?.uid) {
        await pushService.syncTokenToUserDoc(firebaseUser.uid).catch(() => {});
      }
    }
    await updateNotificationPreferences({
      ...notificationPreferences,
      enabled,
      updatedAt: new Date().toISOString(),
    });
  };

  const sendNotificationToUser = async (params: SendNotificationParams) => {
    const targetId = String(params.recipientId || '').trim();
    if (!targetId) return;

    if (firebaseUser?.uid && /^[a-zA-Z0-9_-]{1,128}$/.test(targetId) && !targetId.startsWith('user_demo_')) {
      sendFirestoreNotification({
        ...params,
        senderName: params.senderName || currentUser.displayName,
        senderAvatar: params.senderAvatar || currentUser.avatar,
      }).catch(() => {});
    }

    if (targetId === currentUser.id && !firebaseUser?.uid) {
      const localId = `local_notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const item: NotificationItem = {
        id: localId,
        type: params.type,
        category: params.category as any,
        title: params.title,
        message: params.message,
        senderId: currentUser.id,
        senderName: params.senderName || currentUser.displayName,
        senderAvatar: params.senderAvatar || currentUser.avatar,
        recipientId: targetId,
        screen: params.screen,
        tab: params.tab,
        roomId: params.roomId,
        streamId: params.streamId,
        reelId: params.reelId,
        chatId: params.chatId,
        timestamp: 'Just now',
        createdAtMs: Date.now(),
        isRead: false,
      };
      setNotifications((prev) => [item, ...prev]);
      pushService.notifyForeground({
        id: localId,
        title: params.title,
        body: params.message,
        data: {
          type: params.type,
          screen: params.screen,
          tab: params.tab,
          roomId: params.roomId,
          streamId: params.streamId,
          reelId: params.reelId,
          chatId: params.chatId,
        },
      });
    }
  };

  // Search
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Device preview mode
  const [deviceMode, setDeviceMode] = useState<'mobile' | 'responsive' | 'admin'>('mobile');

  // Custom logo from localStorage if available
  const [customLogoUrl, setCustomLogoUrlState] = useState<string | null>(() => {
    try {
      return localStorage.getItem('alphamate_custom_logo') || null;
    } catch {
      return null;
    }
  });

  const setCustomLogoUrl = (url: string | null) => {
    setCustomLogoUrlState(url);
    try {
      if (url) {
        localStorage.setItem('alphamate_custom_logo', url);
      } else {
        localStorage.removeItem('alphamate_custom_logo');
      }
    } catch {
      // ignore storage error
    }
  };

  // =========================================================================
  // AGENCY MANAGEMENT (COIN SELLER AGENCY & HOST AGENCY)
  // =========================================================================
  const INITIAL_AGENCY_PROFILE: CoinSellerAgencyProfile = {
    agencyId: 'agency_alpha_official',
    agencyName: 'Alpha Mate Official Exchange',
    agencyCode: 'AM-EX-001',
    badge: 'Diamond Certified Official',
    ownerUserId: currentUser?.id || 'current_user',
    agencyBalance: 2500000, // 2,500,000 Coins initial agency balance
    pin: '1234', // Default 4-digit security PIN
    isPinSet: true,
    whatsappNumber: '+923001234567',
    whatsappDisplay: '+92 300 1234567',
    isOfficial: true,
    slogan: 'Get coins from official agency direct with instant verified delivery.',
  };

  const [agencyProfile, setAgencyProfile] = useState<CoinSellerAgencyProfile>(() => {
    try {
      const saved = localStorage.getItem('alphamate_agency_profile');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return INITIAL_AGENCY_PROFILE;
  });

  const [agencyOrders, setAgencyOrders] = useState<AgencyOrder[]>(() => {
    try {
      const saved = localStorage.getItem('alphamate_agency_orders');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((o: AgencyOrder) => !String(o?.buyerId || '').endsWith('_demo'));
        }
      }
    } catch {
      // ignore
    }
    return [];
  });

  const [agencyTransactions, setAgencyTransactions] = useState<AgencyTransaction[]>(() => {
    try {
      const saved = localStorage.getItem('alphamate_agency_transactions');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((t: AgencyTransaction) => !String(t?.recipientId || '').endsWith('_demo'));
        }
      }
    } catch {
      // ignore
    }
    return [];
  });

  const saveAgencyProfile = (profile: CoinSellerAgencyProfile) => {
    setAgencyProfile(profile);
    try {
      localStorage.setItem('alphamate_agency_profile', JSON.stringify(profile));
    } catch {
      // ignore
    }
  };

  const saveAgencyOrders = (orders: AgencyOrder[]) => {
    setAgencyOrders(orders);
    try {
      localStorage.setItem('alphamate_agency_orders', JSON.stringify(orders));
    } catch {
      // ignore
    }
  };

  const saveAgencyTransactions = (txs: AgencyTransaction[]) => {
    setAgencyTransactions(txs);
    try {
      localStorage.setItem('alphamate_agency_transactions', JSON.stringify(txs));
    } catch {
      // ignore
    }
  };

  const findUserByIdOrUsername = (query: string): User | null => {
    if (!query || !query.trim()) return null;
    const clean = query.trim().toLowerCase();

    // Check registered users
    const matched = registeredUsers.find(
      (u) =>
        u.uniqueId.toLowerCase() === clean ||
        u.username.toLowerCase() === clean ||
        u.displayName.toLowerCase() === clean ||
        u.id.toLowerCase() === clean
    );
    if (matched) return matched;

    // Check current user
    if (
      currentUser.uniqueId.toLowerCase() === clean ||
      currentUser.username.toLowerCase() === clean ||
      currentUser.displayName.toLowerCase() === clean
    ) {
      return currentUser;
    }

    // If matches format AM_XXXXXX or alphanumeric, generate dynamic verified preview
    if (clean.length >= 3) {
      const cleanId = clean.toUpperCase().startsWith('AM_') ? clean.toUpperCase() : `AM_${Math.floor(100000 + Math.random() * 900000)}`;
      return {
        id: `user_${clean}`,
        uniqueId: cleanId,
        username: clean.replace(/[^a-z0-9_]/gi, '').toLowerCase() || 'user',
        displayName: query.trim(),
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80',
        bio: 'Alpha Mate Active Member',
        followersCount: 520,
        followingCount: 88,
        likesCount: 1400,
        level: 12,
        xp: 3200,
        nextLevelXp: 5000,
        vipTier: 1,
        coins: 1200,
        diamonds: 150,
        isVerified: true,
      };
    }

    return null;
  };

  const sendAgencyCoins = (
    recipientQuery: string,
    amount: number,
    pin: string
  ): { success: boolean; message: string; tx?: AgencyTransaction } => {
    // 1. PIN Check
    if (pin !== agencyProfile.pin) {
      return { success: false, message: 'Invalid 4-digit security PIN. Please try again.' };
    }

    // 2. Validate Amount
    if (!amount || amount <= 0) {
      return { success: false, message: 'Please enter a valid coin amount.' };
    }

    // 3. Balance Check
    if (amount > agencyProfile.agencyBalance) {
      return {
        success: false,
        message: `Insufficient agency balance. You currently have ${agencyProfile.agencyBalance.toLocaleString()} Coins.`,
      };
    }

    // 4. Resolve recipient
    const recipient = findUserByIdOrUsername(recipientQuery);
    if (!recipient) {
      return { success: false, message: 'Recipient not found. Please check User ID or username.' };
    }

    // 5. Deduct agency balance
    const newAgencyBalance = agencyProfile.agencyBalance - amount;
    const updatedProfile = {
      ...agencyProfile,
      agencyBalance: newAgencyBalance,
    };
    saveAgencyProfile(updatedProfile);

    // 6. Credit recipient if current user
    if (recipient.id === currentUser.id || recipient.uniqueId === currentUser.uniqueId) {
      setCoins((c) => c + amount);
      setCurrentUser((prev) => {
        const updated = { ...prev, coins: prev.coins + amount };
        saveUserSession(updated);
        return updated;
      });
    }

    // 7. Record transaction
    const newTx: AgencyTransaction = {
      id: `atx_${Date.now()}`,
      type: 'direct_send',
      recipientId: recipient.id,
      recipientUniqueId: recipient.uniqueId,
      recipientName: recipient.displayName,
      recipientAvatar: recipient.avatar,
      coins: amount,
      remainingBalance: newAgencyBalance,
      timestamp: 'Just now',
      referenceId: `TX-DIR-${Math.floor(1000 + Math.random() * 9000)}`,
    };
    const updatedTxs = [newTx, ...agencyTransactions];
    saveAgencyTransactions(updatedTxs);

    // 8. Push notification to inbox
    const newNotif: NotificationItem = {
      id: `notif_agency_${Date.now()}`,
      type: 'system',
      title: `💎 ${amount.toLocaleString()} Coins Received from ${agencyProfile.agencyName}`,
      message: `Official Agency transfer confirmed! ${amount.toLocaleString()} coins have been delivered to ID ${recipient.uniqueId}.`,
      timestamp: 'Just now',
      isRead: false,
    };
    setNotifications((prev) => [newNotif, ...prev]);

    return {
      success: true,
      message: `Successfully sent ${amount.toLocaleString()} Coins to ${recipient.displayName} (${recipient.uniqueId})!`,
      tx: newTx,
    };
  };

  const deliverAgencyOrder = (orderId: string, pin: string): { success: boolean; message: string } => {
    // 1. PIN Check
    if (pin !== agencyProfile.pin) {
      return { success: false, message: 'Invalid 4-digit security PIN. Please try again.' };
    }

    const order = agencyOrders.find((o) => o.id === orderId);
    if (!order) {
      return { success: false, message: 'Order not found.' };
    }

    if (order.status === 'delivered') {
      return { success: false, message: 'This order has already been delivered.' };
    }

    const totalCoinsToCredit = order.coins + (order.bonusCoins || 0);

    // Balance check
    if (totalCoinsToCredit > agencyProfile.agencyBalance) {
      return {
        success: false,
        message: `Insufficient agency balance to fulfill order. You need ${totalCoinsToCredit.toLocaleString()} Coins.`,
      };
    }

    // Deduct agency balance
    const newAgencyBalance = agencyProfile.agencyBalance - totalCoinsToCredit;
    const updatedProfile = {
      ...agencyProfile,
      agencyBalance: newAgencyBalance,
    };
    saveAgencyProfile(updatedProfile);

    // If order was for current user, credit current user
    if (order.buyerId === currentUser.id || order.buyerUniqueId === currentUser.uniqueId) {
      setCoins((c) => c + totalCoinsToCredit);
      setCurrentUser((prev) => {
        const updated = { ...prev, coins: prev.coins + totalCoinsToCredit };
        saveUserSession(updated);
        return updated;
      });
    }

    // Update order status
    const updatedOrders = agencyOrders.map((o) =>
      o.id === orderId
        ? {
            ...o,
            status: 'delivered' as const,
            deliveredAt: 'Just now',
          }
        : o
    );
    saveAgencyOrders(updatedOrders);

    // Record transaction
    const newTx: AgencyTransaction = {
      id: `atx_${Date.now()}`,
      type: 'order_delivery',
      recipientId: order.buyerId,
      recipientUniqueId: order.buyerUniqueId,
      recipientName: order.buyerName,
      recipientAvatar: order.buyerAvatar,
      coins: totalCoinsToCredit,
      remainingBalance: newAgencyBalance,
      timestamp: 'Just now',
      referenceId: order.orderNo,
    };
    saveAgencyTransactions([newTx, ...agencyTransactions]);

    // Send Buyer confirmation notification
    const buyerNotif: NotificationItem = {
      id: `notif_order_${Date.now()}`,
      type: 'system',
      title: `🎉 Coins Delivered! Order ${order.orderNo}`,
      message: `Your payment was verified. ${totalCoinsToCredit.toLocaleString()} Coins have been credited to your Alpha Mate account by ${agencyProfile.agencyName}.`,
      timestamp: 'Just now',
      isRead: false,
    };
    setNotifications((prev) => [buyerNotif, ...prev]);

    return {
      success: true,
      message: `Order ${order.orderNo} fulfilled! ${totalCoinsToCredit.toLocaleString()} Coins delivered to ${order.buyerName}.`,
    };
  };

  const rejectAgencyOrder = (orderId: string, reason?: string): { success: boolean; message: string } => {
    const updatedOrders = agencyOrders.map((o) =>
      o.id === orderId ? { ...o, status: 'rejected' as const, note: reason || 'Receipt verification rejected' } : o
    );
    saveAgencyOrders(updatedOrders);
    return { success: true, message: 'Order has been marked as rejected.' };
  };

  const updateAgencyProfile = (updates: Partial<CoinSellerAgencyProfile>) => {
    const updated = { ...agencyProfile, ...updates };
    saveAgencyProfile(updated);
  };

  const setAgencySecurityPin = (oldPin: string, newPin: string): { success: boolean; message: string } => {
    if (agencyProfile.isPinSet && oldPin !== agencyProfile.pin) {
      return { success: false, message: 'Current PIN is incorrect.' };
    }
    if (!/^\d{4}$/.test(newPin)) {
      return { success: false, message: 'New PIN must be exactly 4 digits (0-9).' };
    }
    const updated = { ...agencyProfile, pin: newPin, isPinSet: true };
    saveAgencyProfile(updated);
    return { success: true, message: '4-digit Security PIN updated successfully.' };
  };

  const createBuyerCoinOrder = (
    orderData: Omit<AgencyOrder, 'id' | 'orderNo' | 'createdAt' | 'status'>
  ): AgencyOrder => {
    const newOrder: AgencyOrder = {
      ...orderData,
      id: `order_${Date.now()}`,
      orderNo: `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
      status: 'pending',
      createdAt: 'Just now',
    };
    const updated = [newOrder, ...agencyOrders];
    saveAgencyOrders(updated);

    // Notification for agency
    const agencyNotif: NotificationItem = {
      id: `notif_new_order_${Date.now()}`,
      type: 'system',
      title: `📬 New Coin Order from ${newOrder.buyerName}`,
      message: `Order #${newOrder.orderNo} for ${newOrder.coins.toLocaleString()} Coins (${newOrder.price}) has been placed. Review receipt to deliver.`,
      timestamp: 'Just now',
      isRead: false,
    };
    setNotifications((prev) => [agencyNotif, ...prev]);

    return newOrder;
  };

  // =========================================================================
  // HOST AGENCY STATE & MANAGEMENT
  // =========================================================================
  const ALL_HOST_AGENCIES: HostAgencyProfile[] = [
    {
      agencyId: 'agency_royal_talent',
      agencyName: 'Alpha Royal Talent Agency',
      agencyCode: 'AM-HT-001',
      agencyTag: 'ROYAL',
      tagColor: '#F59E0B',
      badge: 'Diamond Certified Host Agency',
      ownerUserId: currentUser?.id || 'current_user',
      whatsappNumber: '+923008899111',
      whatsappDisplay: '+92 300 8899111',
      defaultCommissionRate: 15,
      minWeeklyHours: 15,
      slogan: 'Elite live streaming, party room hosting & VIP creator development.',
      isOfficial: true,
      activeHostsCount: 3,
    },
    {
      agencyId: 'agency_star_hosts',
      agencyName: 'Star Nova Agency',
      agencyCode: 'AM-HT-002',
      agencyTag: 'NOVA',
      tagColor: '#EC4899',
      badge: 'Crown Partner Agency',
      ownerUserId: 'user_nova_admin',
      whatsappNumber: '+923017766555',
      whatsappDisplay: '+92 301 7766555',
      defaultCommissionRate: 12,
      minWeeklyHours: 20,
      slogan: 'Top gaming streamers and party entertainment hosts worldwide.',
      isOfficial: true,
      activeHostsCount: 12,
    },
    {
      agencyId: 'agency_phoenix_crew',
      agencyName: 'Phoenix Live Crew',
      agencyCode: 'AM-HT-003',
      agencyTag: 'PHOENIX',
      tagColor: '#38BDF8',
      badge: 'Gold Official Agency',
      ownerUserId: 'user_phoenix_admin',
      whatsappNumber: '+971508822334',
      whatsappDisplay: '+971 50 8822334',
      defaultCommissionRate: 18,
      minWeeklyHours: 12,
      slogan: 'International PK battle champions and live concert broadcasters.',
      isOfficial: true,
      activeHostsCount: 8,
    },
  ];

  const [allHostAgencies, setAllHostAgencies] = useState<HostAgencyProfile[]>(() => {
    try {
      const saved = localStorage.getItem('alphamate_all_host_agencies');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return ALL_HOST_AGENCIES;
  });

  const [hostAgencyProfile, setHostAgencyProfile] = useState<HostAgencyProfile>(() => {
    try {
      const saved = localStorage.getItem('alphamate_host_agency_profile');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return ALL_HOST_AGENCIES[0];
  });

  const [agencyHosts, setAgencyHosts] = useState<HostMember[]>(() => {
    try {
      const saved = localStorage.getItem('alphamate_agency_hosts');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((h: HostMember) => !String(h?.userId || '').endsWith('_demo'));
        }
      }
    } catch {
      // ignore
    }
    return [];
  });

  const [hostJoinRequests, setHostJoinRequests] = useState<HostJoinRequest[]>(() => {
    try {
      const saved = localStorage.getItem('alphamate_host_join_requests');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((r: HostJoinRequest) => !String(r?.userId || '').endsWith('_demo'));
        }
      }
    } catch {
      // ignore
    }
    return [];
  });

  const [agencyApplications, setAgencyApplications] = useState<AgencyApplication[]>(() => {
    try {
      const saved = localStorage.getItem('alphamate_agency_applications');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((a: AgencyApplication) => !String(a?.applicantUserId || '').endsWith('_demo'));
        }
      }
    } catch {
      // ignore
    }
    return [];
  });

  const saveAgencyHosts = (hosts: HostMember[]) => {
    setAgencyHosts(hosts);
    try {
      localStorage.setItem('alphamate_agency_hosts', JSON.stringify(hosts));
    } catch {
      // ignore
    }
  };

  const saveHostJoinRequests = (reqs: HostJoinRequest[]) => {
    setHostJoinRequests(reqs);
    try {
      localStorage.setItem('alphamate_host_join_requests', JSON.stringify(reqs));
    } catch {
      // ignore
    }
  };

  const saveAgencyApplications = (apps: AgencyApplication[]) => {
    setAgencyApplications(apps);
    try {
      localStorage.setItem('alphamate_agency_applications', JSON.stringify(apps));
    } catch {
      // ignore
    }
  };

  const updateHostAgencyProfile = (updates: Partial<HostAgencyProfile>) => {
    const updated = { ...hostAgencyProfile, ...updates };
    setHostAgencyProfile(updated);
    try {
      localStorage.setItem('alphamate_host_agency_profile', JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  const setHostWeeklyTarget = (hostId: string, targetDiamonds: number, targetHours?: number) => {
    const updated = agencyHosts.map((h) => {
      if (h.id === hostId || h.userId === hostId) {
        const nextStatus: 'achieved' | 'pending' | 'expired' =
          h.currentProgressDiamonds >= targetDiamonds ? 'achieved' : 'pending';
        return {
          ...h,
          weeklyTargetDiamonds: targetDiamonds,
          weeklyTargetHours: targetHours || h.weeklyTargetHours,
          targetStatus: nextStatus,
        };
      }
      return h;
    });
    saveAgencyHosts(updated);

    const targetHost = agencyHosts.find((h) => h.id === hostId || h.userId === hostId);
    if (targetHost) {
      const newNotif: NotificationItem = {
        id: `notif_target_${Date.now()}`,
        type: 'system',
        title: `🎯 Weekly Target Set by ${hostAgencyProfile.agencyName}`,
        message: `Your new weekly target is ${targetDiamonds.toLocaleString()} Diamonds. Stream live and achieve bonus rewards!`,
        timestamp: 'Just now',
        isRead: false,
      };
      setNotifications((prev) => [newNotif, ...prev]);
    }
  };

  const updateHostCommission = (hostId: string, commissionRate: number) => {
    const updated = agencyHosts.map((h) =>
      h.id === hostId || h.userId === hostId ? { ...h, commissionRate } : h
    );
    saveAgencyHosts(updated);
  };

  const updateHostContract = (
    hostId: string,
    targetDiamonds: number,
    targetHours: number,
    commissionRate: number
  ) => {
    const updated = agencyHosts.map((h) => {
      if (h.id === hostId || h.userId === hostId) {
        const nextStatus =
          h.currentProgressDiamonds >= targetDiamonds
            ? ('achieved' as const)
            : ('pending' as const);
        return {
          ...h,
          weeklyTargetDiamonds: targetDiamonds,
          weeklyTargetHours: targetHours,
          commissionRate,
          targetStatus: nextStatus,
        };
      }
      return h;
    });
    saveAgencyHosts(updated);

    const targetHost = agencyHosts.find((h) => h.id === hostId || h.userId === hostId);
    if (targetHost) {
      const updateNotif: NotificationItem = {
        id: `notif_contract_${Date.now()}`,
        type: 'system',
        title: `📝 Contract Terms Updated by ${hostAgencyProfile.agencyName}`,
        message: `Your contract has been updated: Target ${targetDiamonds.toLocaleString()} Diamonds, ${targetHours} hrs/week, Commission ${commissionRate}%.`,
        timestamp: 'Just now',
        isRead: false,
      };
      setNotifications((prev) => [updateNotif, ...prev]);
    }
  };

  const toggleHostLiveStatus = (hostId: string) => {
    const updated = agencyHosts.map((h) => {
      if (h.id === hostId || h.userId === hostId) {
        const nextLive = !h.isLive;
        return {
          ...h,
          isLive: nextLive,
        };
      }
      return h;
    });
    saveAgencyHosts(updated);
  };

  const approveHostJoinRequest = (
    requestId: string,
    targetDiamonds = 500000,
    commissionRate = 15,
    targetHours?: number
  ): { success: boolean; message: string } => {
    const req = hostJoinRequests.find((r) => r.id === requestId);
    if (!req) return { success: false, message: 'Request not found' };

    // Prevent duplicate joining
    const alreadyBound = agencyHosts.some((h) => h.userId === req.userId);
    if (alreadyBound) {
      return { success: false, message: 'This host is already bound to an agency!' };
    }

    const newHost: HostMember = {
      id: `host_member_${Date.now()}`,
      userId: req.userId,
      uniqueId: req.uniqueId,
      displayName: req.displayName,
      username: req.username,
      avatar: req.avatar,
      level: req.level,
      agencyId: hostAgencyProfile.agencyId,
      agencyName: hostAgencyProfile.agencyName,
      agencyTag: hostAgencyProfile.agencyTag,
      weeklyTargetDiamonds: targetDiamonds,
      currentProgressDiamonds: 0,
      targetStatus: 'pending',
      weeklyHoursStreamed: 0,
      weeklyTargetHours: targetHours || req.expectedHours || hostAgencyProfile.minWeeklyHours,
      weeklyEarnings: 0,
      commissionRate,
      isLive: false,
      joinedDate: 'Joined just now',
    };

    const updatedHosts = [newHost, ...agencyHosts];
    saveAgencyHosts(updatedHosts);

    // Update candidate's user profile with official agency tag
    if (currentUser.id === req.userId || currentUser.uniqueId === req.uniqueId) {
      updateUserProfile({
        agencyId: hostAgencyProfile.agencyId,
        agencyName: hostAgencyProfile.agencyName,
        agencyTag: hostAgencyProfile.agencyTag,
        isAgencyHost: true,
      });
    }

    setRegisteredUsers((prev) =>
      prev.map((u) =>
        u.id === req.userId || u.uniqueId === req.uniqueId
          ? {
              ...u,
              agencyId: hostAgencyProfile.agencyId,
              agencyName: hostAgencyProfile.agencyName,
              agencyTag: hostAgencyProfile.agencyTag,
              isAgencyHost: true,
            }
          : u
      )
    );

    // Update request status
    const updatedReqs = hostJoinRequests.map((r) =>
      r.id === requestId ? { ...r, status: 'approved' as const } : r
    );
    saveHostJoinRequests(updatedReqs);

    // Notification to host
    const joinNotif: NotificationItem = {
      id: `notif_host_joined_${Date.now()}`,
      type: 'system',
      title: `🎉 Welcome to ${hostAgencyProfile.agencyName}!`,
      message: `Your host application was approved! Official Agency Tag [${hostAgencyProfile.agencyTag}] is now assigned to your profile.`,
      timestamp: 'Just now',
      isRead: false,
    };
    setNotifications((prev) => [joinNotif, ...prev]);

    return {
      success: true,
      message: `${req.displayName} approved and bound to [${hostAgencyProfile.agencyTag}] successfully!`,
    };
  };

  const rejectHostJoinRequest = (requestId: string): { success: boolean; message: string } => {
    const updatedReqs = hostJoinRequests.map((r) =>
      r.id === requestId ? { ...r, status: 'rejected' as const } : r
    );
    saveHostJoinRequests(updatedReqs);
    return { success: true, message: 'Host application has been rejected.' };
  };

  const removeHostFromAgency = (
    hostId: string,
    reason?: string
  ): { success: boolean; message: string } => {
    const target = agencyHosts.find((h) => h.id === hostId || h.userId === hostId);
    if (!target) return { success: false, message: 'Host not found' };

    const updatedHosts = agencyHosts.filter((h) => h.id !== hostId && h.userId !== hostId);
    saveAgencyHosts(updatedHosts);

    // Remove agency tag from user
    if (currentUser.id === target.userId || currentUser.uniqueId === target.uniqueId) {
      updateUserProfile({
        agencyId: undefined,
        agencyName: undefined,
        agencyTag: undefined,
        isAgencyHost: false,
      });
    }

    setRegisteredUsers((prev) =>
      prev.map((u) =>
        u.id === target.userId || u.uniqueId === target.uniqueId
          ? {
              ...u,
              agencyId: undefined,
              agencyName: undefined,
              agencyTag: undefined,
              isAgencyHost: false,
            }
          : u
      )
    );

    const removalNotif: NotificationItem = {
      id: `notif_host_released_${Date.now()}`,
      type: 'system',
      title: `Agency Release Notice`,
      message: `You have been released from ${target.agencyName}. ${reason ? `Reason: ${reason}` : ''}`,
      timestamp: 'Just now',
      isRead: false,
    };
    setNotifications((prev) => [removalNotif, ...prev]);

    return { success: true, message: `${target.displayName} has been released from the agency.` };
  };

  const requestHostResignation = (reason: string): { success: boolean; message: string } => {
    const updatedHosts = agencyHosts.map((h) =>
      h.userId === currentUser.id || h.uniqueId === currentUser.uniqueId
        ? {
            ...h,
            resignationRequested: true,
            resignationReason: reason,
          }
        : h
    );
    saveAgencyHosts(updatedHosts);

    const agencyNotif: NotificationItem = {
      id: `notif_resign_${Date.now()}`,
      type: 'system',
      title: `⚠️ Resignation Request from ${currentUser.displayName}`,
      message: `Host ${currentUser.displayName} (${currentUser.uniqueId}) has requested resignation. Reason: ${reason}`,
      timestamp: 'Just now',
      isRead: false,
    };
    setNotifications((prev) => [agencyNotif, ...prev]);

    return {
      success: true,
      message: 'Your resignation request has been submitted to your agency admin for review.',
    };
  };

  const submitHostJoinRequest = (
    agencyId: string,
    whatsapp: string,
    experience: string,
    expectedHours: number
  ): { success: boolean; message: string } => {
    // 1. Check if user already bound to an agency
    if (currentUser.agencyId || currentUser.agencyTag) {
      return {
        success: false,
        message: `You are already bound to ${currentUser.agencyName || 'an agency'} [${currentUser.agencyTag}]. A host cannot join multiple agencies. Please submit resignation first.`,
      };
    }

    const targetAgency = allHostAgencies.find((a) => a.agencyId === agencyId) || hostAgencyProfile;

    const newReq: HostJoinRequest = {
      id: `hreq_${Date.now()}`,
      userId: currentUser.id,
      uniqueId: currentUser.uniqueId,
      displayName: currentUser.displayName,
      username: currentUser.username,
      avatar: currentUser.avatar,
      level: currentUser.level,
      agencyId: targetAgency.agencyId,
      whatsapp,
      experience,
      expectedHours,
      appliedDate: 'Just now',
      status: 'pending',
    };

    const updated = [newReq, ...hostJoinRequests];
    saveHostJoinRequests(updated);

    const notif: NotificationItem = {
      id: `notif_new_host_req_${Date.now()}`,
      type: 'system',
      title: `📬 New Host Application: ${currentUser.displayName}`,
      message: `${currentUser.displayName} applied to join ${targetAgency.agencyName}. WhatsApp: ${whatsapp}`,
      timestamp: 'Just now',
      isRead: false,
    };
    setNotifications((prev) => [notif, ...prev]);

    return {
      success: true,
      message: `Application submitted to ${targetAgency.agencyName}! The agency owner will review and contact you on WhatsApp.`,
    };
  };

  const submitAgencyApplication = (
    data: Omit<AgencyApplication, 'id' | 'status' | 'submittedAt'>
  ): { success: boolean; message: string } => {
    const newApp: AgencyApplication = {
      ...data,
      id: `app_${Date.now()}`,
      status: 'pending',
      submittedAt: 'Just now',
    };
    const updated = [newApp, ...agencyApplications];
    saveAgencyApplications(updated);

    const notif: NotificationItem = {
      id: `notif_agency_app_${Date.now()}`,
      type: 'system',
      title: `🏢 Agency Application Received`,
      message: `Your application to launch "${data.agencyName}" as an official ${data.type === 'coin_seller' ? 'Coin Seller' : 'Host'} Agency has been submitted for official review.`,
      timestamp: 'Just now',
      isRead: false,
    };
    setNotifications((prev) => [notif, ...prev]);

    return {
      success: true,
      message: 'Agency application submitted successfully! Our official team will review your credentials and contact you.',
    };
  };

  const reviewAgencyApplication = (
    applicationId: string,
    action: 'approve' | 'reject'
  ): { success: boolean; message: string } => {
    const app = agencyApplications.find((a) => a.id === applicationId);
    if (!app) return { success: false, message: 'Application not found' };

    const updated = agencyApplications.map((a) =>
      a.id === applicationId ? { ...a, status: action === 'approve' ? ('approved' as const) : ('rejected' as const) } : a
    );
    saveAgencyApplications(updated);

    if (action === 'approve') {
      if (app.type === 'host_agency') {
        const newAgency: HostAgencyProfile = {
          agencyId: `agency_${Date.now()}`,
          agencyName: app.agencyName,
          agencyCode: `AM-HT-${Math.floor(100 + Math.random() * 900)}`,
          agencyTag: app.agencyTag || 'VIP',
          badge: 'Diamond Certified Host Agency',
          ownerUserId: app.applicantUserId,
          whatsappNumber: app.whatsapp,
          whatsappDisplay: app.whatsapp,
          defaultCommissionRate: 15,
          minWeeklyHours: 15,
          slogan: 'Official livestreaming agency.',
          isOfficial: true,
          activeHostsCount: 0,
        };
        setAllHostAgencies((prev) => [newAgency, ...prev]);
        setHostAgencyProfile(newAgency);
      }
    }

    return {
      success: true,
      message: `Agency application #${applicationId} ${action === 'approve' ? 'approved' : 'rejected'}.`,
    };
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handlePopState = () => {
      const legal = getLegalScreenFromPath();
      if (legal) {
        setCurrentScreenState(legal);
        return;
      }
      if (
        currentScreenRef.current === 'privacy_policy' ||
        currentScreenRef.current === 'terms_conditions' ||
        currentScreenRef.current === 'delete_account'
      ) {
        if (firebaseUser && isEmailVerified && isAccountRestrictedStatus(currentUser?.accountStatus)) {
          setCurrentScreenState('account_recovery');
        } else {
          setCurrentScreenState(isAuthenticated && firebaseUser && isEmailVerified ? 'home' : 'welcome');
        }
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isAuthenticated, firebaseUser, isEmailVerified]);

  const setCurrentScreen = (screen: ScreenType) => {
    setScreenHistory((prev) => (prev[prev.length - 1] === screen ? prev : [...prev, screen]));
    setCurrentScreenState(screen);
    syncBrowserUrlForScreen(screen);
  };

  const navigateBack = () => {
    if (screenHistory.length > 1) {
      const newHistory = [...screenHistory];
      newHistory.pop();
      const prevScreen = newHistory[newHistory.length - 1];
      setScreenHistory(newHistory);
      setCurrentScreenState(prevScreen);
      syncBrowserUrlForScreen(prevScreen);
    } else {
      const fallbackScreen: ScreenType = isAuthenticated && firebaseUser ? 'home' : 'welcome';
      setCurrentScreenState(fallbackScreen);
      syncBrowserUrlForScreen(fallbackScreen);
    }
  };

  const setActiveTab = (tab: MainTabType) => {
    setActiveTabState(tab);
    if (tab === 'home') setCurrentScreen('home');
    else if (tab === 'party') setCurrentScreen('party');
    else if (tab === 'moments') setCurrentScreen('moments');
    else if (tab === 'store') setCurrentScreen('store');
    else if (tab === 'chat') setCurrentScreen('chat');
    else if (tab === 'me') setCurrentScreen('profile');
  };

  const loginWithGoogle = (email: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const existing = registeredUsers.find(
      (u) => u.email?.trim().toLowerCase() === cleanEmail
    );
    if (existing) {
      saveUserSession(existing);
      setCurrentScreen('home');
      return { isRegistered: true, user: existing };
    }
    return { isRegistered: false };
  };

  const registerWithFullDetails = (data: {
    displayName: string;
    username: string;
    email: string;
    dob: string;
    password: string;
    authProvider: 'google' | 'email';
    avatar?: string;
  }) => {
    const cleanEmail = data.email.trim().toLowerCase();
    const cleanUsername = data.username.trim().toLowerCase();

    // Check uniqueness
    const existsUsername = registeredUsers.some(
      (u) => u.username.toLowerCase() === cleanUsername
    );
    if (existsUsername) {
      return { success: false, message: 'This username is already taken. Please choose another.' };
    }

    const existsEmail = registeredUsers.some(
      (u) => u.email?.trim().toLowerCase() === cleanEmail
    );
    if (existsEmail) {
      return { success: false, message: 'An account with this email already exists. Please Sign In.' };
    }

    const newUser: User = {
      id: `user_${Date.now()}`,
      uniqueId: `AM_${Math.floor(100000 + Math.random() * 900000)}`,
      username: data.username.trim(),
      displayName: data.displayName.trim() || data.username.trim(),
      email: cleanEmail,
      dob: data.dob,
      password: data.password,
      authProvider: data.authProvider,
      avatar:
        data.avatar ||
        'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80',
      bio: '🌟 Alpha Mate VIP Member | LIVE • PARTY • SOCIAL 💜',
      followersCount: 1,
      followingCount: 4,
      likesCount: 12,
      level: 1,
      xp: 150,
      nextLevelXp: 500,
      vipTier: 1,
      coins: 1000,
      diamonds: 100,
      isVerified: data.authProvider === 'google',
      familyCrew: 'Alpha Champions 👑',
      isHost: false,
    };

    const updated = [...registeredUsers, newUser];
    setRegisteredUsers(updated);
    try {
      localStorage.setItem('alphamate_registered_users', JSON.stringify(updated));
    } catch {
      // ignore
    }

    saveUserSession(newUser);
    setCurrentScreen('home');
    return { success: true, user: newUser };
  };

  const loginWithCredentials = (identifier: string, password: string) => {
    const cleanId = identifier.trim().toLowerCase();
    const user = registeredUsers.find(
      (u) =>
        u.username.toLowerCase() === cleanId ||
        (u.email && u.email.toLowerCase() === cleanId)
    );

    if (!user) {
      return {
        success: false,
        message: 'No account found with this username or email. Please check or register.',
      };
    }

    if (user.password && user.password !== password) {
      return { success: false, message: 'Incorrect password. Please try again.' };
    }

    saveUserSession(user);
    setCurrentScreen('home');
    return { success: true, user };
  };

  const login = (userData?: Partial<User>) => {
    setIsAuthenticated(true);
    if (userData) {
      setCurrentUser((prev) => {
        const updated = { ...prev, ...userData };
        saveUserSession(updated);
        return updated;
      });
    }
    setCurrentScreen('home');
  };

  const loginWithFirebaseGoogle = async (options?: { skipRedirect?: boolean }) => {
    try {
      const fbUser = await signInWithGoogle();
      if (!fbUser) {
        const redirectPending = (() => {
          try {
            return sessionStorage.getItem('alphamate_google_redirect_pending') === '1';
          } catch {
            return false;
          }
        })();
        return {
          success: false,
          redirectPending,
          error: redirectPending ? 'Redirecting to Google Sign-In...' : 'Sign-in cancelled',
        };
      }

      const existingProfile = await getUserProfileFromFirestore(fbUser.uid);
      const userObj: User = existingProfile
        ? {
            ...buildNewUserFromFirebase(fbUser),
            ...existingProfile,
            id: fbUser.uid,
            displayName: existingProfile.displayName || fbUser.displayName || 'Alpha Mate',
            email: (fbUser.email || existingProfile.email || '').toLowerCase(),
            avatar: existingProfile.avatar || fbUser.photoURL || CURRENT_USER.avatar,
            isVerified: true,
          }
        : buildNewUserFromFirebase(fbUser, { isVerified: true });

      await syncUserProfileToFirestore(userObj);
      setFirebaseUser(fbUser);
      setIsEmailVerified(true);
      const restricted = isAccountRestrictedStatus(userObj.accountStatus);
      saveUserSession(userObj, !restricted);
      if (!options?.skipRedirect) {
        if (restricted) {
          setScreenHistory(['welcome', 'account_recovery']);
          setCurrentScreenState('account_recovery');
        } else {
          setScreenHistory(['home']);
          setCurrentScreenState('home');
        }
      }
      return { success: true, user: userObj };
    } catch (error: any) {
      console.error('Firebase Google Auth error:', error);
      return { success: false, error: error.message || 'Google sign-in failed' };
    }
  };

  const loginWithFirebaseEmail = async (email: string, pass: string) => {
    try {
      const fbUser = await signInWithEmail(email, pass);
      const verified = isFirebaseUserVerified(fbUser);
      setFirebaseUser(fbUser);
      setIsEmailVerified(verified);

      const remoteProfile = await getUserProfileFromFirestore(fbUser.uid);
      const userObj: User = remoteProfile
        ? {
            ...buildNewUserFromFirebase(fbUser),
            ...remoteProfile,
            id: fbUser.uid,
            isVerified: verified,
          }
        : buildNewUserFromFirebase(fbUser, { isVerified: verified });

      if (!verified) {
        saveUserSession(userObj, false);
        return {
          success: false,
          needsVerification: true,
          user: userObj,
          error: 'Please verify your email address using the link sent to your inbox.',
        };
      }

      const restricted = isAccountRestrictedStatus(userObj.accountStatus);
      await syncUserProfileToFirestore(userObj).catch(() => {});
      saveUserSession(userObj, !restricted);
      if (restricted) {
        setScreenHistory(['welcome', 'account_recovery']);
        setCurrentScreenState('account_recovery');
      } else {
        setScreenHistory(['home']);
        setCurrentScreenState('home');
      }
      return { success: true, user: userObj };
    } catch (error: any) {
      console.error('Firebase Email Login error:', error);
      return { success: false, error: error.message || 'Invalid email or password' };
    }
  };

  const registerWithFirebaseEmail = async (data: {
    email: string;
    pass: string;
    displayName: string;
    username: string;
  }) => {
    try {
      const fbUser = await registerWithEmail(data.email, data.pass);
      const verified = isFirebaseUserVerified(fbUser);
      setFirebaseUser(fbUser);
      setIsEmailVerified(verified);

      const newUser = buildNewUserFromFirebase(fbUser, {
        username: data.username.trim().toLowerCase(),
        displayName: data.displayName.trim() || data.username.trim(),
        email: data.email.trim().toLowerCase(),
        isVerified: verified,
        authProvider: 'email',
      });

      await syncUserProfileToFirestore(newUser);
      saveUserSession(newUser, verified);

      if (!verified) {
        return { success: true, needsVerification: true, user: newUser };
      }

      setScreenHistory(['home']);
      setCurrentScreenState('home');
      return { success: true, user: newUser };
    } catch (error: any) {
      console.error('Firebase Email Registration error:', error);
      return { success: false, error: error.message || 'Email registration failed' };
    }
  };

  const refreshFirebaseVerification = async (): Promise<boolean> => {
    const refreshed = await reloadCurrentFirebaseUser();
    if (!refreshed) return false;
    const verified = isFirebaseUserVerified(refreshed);
    setFirebaseUser(refreshed);
    setIsEmailVerified(verified);
    if (verified) {
      const remoteProfile = await getUserProfileFromFirestore(refreshed.uid).catch(() => null);
      const userObj: User = remoteProfile
        ? { ...buildNewUserFromFirebase(refreshed), ...remoteProfile, id: refreshed.uid, isVerified: true }
        : buildNewUserFromFirebase(refreshed, { isVerified: true });
      const restricted = isAccountRestrictedStatus(userObj.accountStatus);
      await syncUserProfileToFirestore(userObj).catch(() => {});
      saveUserSession(userObj, !restricted);
      if (restricted) {
        setScreenHistory(['welcome', 'account_recovery']);
        setCurrentScreenState('account_recovery');
      } else {
        setScreenHistory(['home']);
        setCurrentScreenState('home');
      }
    }
    return verified;
  };

  const resendEmailVerificationLink = async () => {
    await resendVerificationEmail();
  };

  const performCleanLogout = async () => {
    if (activePartyRoom) {
      p2pStreamingEngine.stopPartyVoice(activePartyRoom.id).catch(() => {});
    }
    if (activeStream) {
      p2pStreamingEngine.stopHostBroadcast(activeStream.id).catch(() => {});
      p2pStreamingEngine.unsubscribeFromRemoteBroadcast(activeStream.id).catch(() => {});
    }
    setActivePartyRoom(null);
    setUserSeatIndex(null);
    setIsMicMuted(false);
    setActiveStream(null);
    setActiveConversation(null);

    try {
      await logoutUser();
    } catch (e) {
      console.warn('Firebase logout warning:', e);
    }

    setFirebaseUser(null);
    setIsEmailVerified(false);
    setIsAuthenticated(false);
    setLegalConsent({ terms: false, privacy: false });
    setCurrentUser(CURRENT_USER);
    try {
      localStorage.setItem('alphamate_is_authenticated', 'false');
      localStorage.removeItem('alphamate_current_user');
    } catch {
      // ignore
    }
    setActiveTabState('home');
    setScreenHistory(['welcome']);
    setCurrentScreenState('welcome');
  };

  const logoutFirebase = async () => {
    await performCleanLogout();
  };

  const callAccountOtpEndpoint = async (subPath: string, body: Record<string, unknown>) => {
    const activeFbUser = auth.currentUser || firebaseUser;
    if (!activeFbUser) {
      return { success: false, status: 401, error: 'Please sign in first to verify your account.' };
    }
    const idToken = await activeFbUser.getIdToken(true);
    const railwayBase = p2pStreamingEngine.getResolvedBackendApiBase();
    const isLocalPreview =
      typeof window !== 'undefined' &&
      !Capacitor.isNativePlatform() &&
      (window.location.hostname.endsWith('.run.app') ||
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1');

    const endpoints = isLocalPreview ? [subPath, `${railwayBase}${subPath}`] : [`${railwayBase}${subPath}`];
    let lastError = 'Unable to reach OTP verification service.';

    for (const url of endpoints) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${idToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(body),
        });
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          lastError = `Unexpected non-JSON response (${res.status}) from ${url}.`;
          continue;
        }
        const data = await res.json();
        return { ...data, status: res.status };
      } catch (err: any) {
        lastError = err?.message || lastError;
      }
    }
    return { success: false, status: 503, error: lastError };
  };

  const sendAccountDeletionOtp = async () => {
    const email = (auth.currentUser?.email || firebaseUser?.email || currentUser?.email || '').trim().toLowerCase();
    const res = await callAccountOtpEndpoint('/api/account/deletion-otp/send', { email });
    return {
      success: Boolean(res?.success),
      emailMasked: res?.emailMasked,
      challengeToken: res?.challengeToken,
      expiresAt: res?.expiresAt,
      cooldownSeconds: res?.cooldownSeconds,
      code: res?.code,
      error: res?.error,
    };
  };

  const verifyAccountDeletionOtp = async (challengeToken: string, otp: string) => {
    const res = await callAccountOtpEndpoint('/api/account/deletion-otp/verify', { challengeToken, otp });
    return {
      success: Boolean(res?.success),
      otpVerifiedAt: res?.otpVerifiedAt,
      deletionVerificationToken: res?.deletionVerificationToken,
      code: res?.code,
      remainingAttempts: res?.remainingAttempts,
      error: res?.error,
    };
  };

  const deactivateCurrentAccount = async (reason?: string) => {
    try {
      const targetUser = {
        ...currentUser,
        id: auth.currentUser?.uid || firebaseUser?.uid || currentUser.id,
        email: auth.currentUser?.email || firebaseUser?.email || currentUser.email,
      };
      const { deactivatedAt } = await submitAccountDeactivationFirestore(targetUser, reason);
      await performCleanLogout();
      return { success: true, deactivatedAt };
    } catch (error: any) {
      console.error('Account deactivation error:', error);
      return { success: false, error: error?.message || 'Failed to deactivate account.' };
    }
  };

  const requestPermanentAccountDeletion = async (otpVerifiedAt: string, reason?: string) => {
    try {
      const targetUser = {
        ...currentUser,
        id: auth.currentUser?.uid || firebaseUser?.uid || currentUser.id,
        email: auth.currentUser?.email || firebaseUser?.email || currentUser.email,
      };
      const { scheduledPermanentDeletionAt } = await submitPermanentDeletionRequestFirestore(
        targetUser,
        otpVerifiedAt,
        reason
      );
      await performCleanLogout();
      return { success: true, scheduledPermanentDeletionAt };
    } catch (error: any) {
      console.error('Permanent account deletion request error:', error);
      return { success: false, error: error?.message || 'Failed to submit permanent deletion request.' };
    }
  };

  const recoverCurrentAccount = async () => {
    try {
      const targetUser = {
        ...currentUser,
        id: auth.currentUser?.uid || firebaseUser?.uid || currentUser.id,
        email: auth.currentUser?.email || firebaseUser?.email || currentUser.email,
      };
      const { reactivatedAt } = await recoverAccountLifecycleFirestore(targetUser);
      const restoredUser: User = {
        ...currentUser,
        accountStatus: 'active',
        reactivatedAt,
        deactivatedAt: undefined,
        deletionRequestedAt: undefined,
        scheduledPermanentDeletionAt: undefined,
        deletionOtpVerifiedAt: undefined,
      };
      saveUserSession(restoredUser, true);
      setScreenHistory(['home']);
      setCurrentScreenState('home');
      syncBrowserUrlForScreen('home');
      return { success: true };
    } catch (error: any) {
      console.error('Account recovery error:', error);
      return { success: false, error: error?.message || 'Unable to recover account.' };
    }
  };

  const updateUserProfile = (data: Partial<User>) => {
    setCurrentUser((prev) => {
      const updated = { ...prev, ...data };
      saveUserSession(updated, isAuthenticated);
      syncUserProfileToFirestore(updated).catch(() => {});

      setRegisteredUsers((users) => {
        const newUsers = users.map((u) => (u.id === prev.id ? { ...u, ...data } : u));
        try {
          localStorage.setItem('alphamate_registered_users', JSON.stringify(newUsers));
        } catch {
          // ignore
        }
        return newUsers;
      });

      return updated;
    });
  };

  const logout = () => {
    performCleanLogout().catch(() => {});
  };

  const register = (name: string, emailOrPhone: string) => {
    const cleanEmail = emailOrPhone.includes('@') ? emailOrPhone.trim().toLowerCase() : `${name.toLowerCase()}@alphamate.com`;
    const newUser: User = {
      ...CURRENT_USER,
      id: `user_${Date.now()}`,
      uniqueId: `AM_${Math.floor(100000 + Math.random() * 900000)}`,
      displayName: name,
      username: name.toLowerCase().replace(/\s+/g, '_'),
      email: cleanEmail,
      authProvider: 'email',
    };
    const updated = [...registeredUsers, newUser];
    setRegisteredUsers(updated);
    try {
      localStorage.setItem('alphamate_registered_users', JSON.stringify(updated));
    } catch {
      // ignore
    }
    saveUserSession(newUser);
    setCurrentScreen('home');
  };

  const openLiveStream = (stream: LiveStream) => {
    if (stream.isPK) {
      openPKBattle(stream);
    } else {
      setActiveStream(stream);
      setCurrentScreen('live_stream');
    }
  };

  const publishLiveStream = async (publishedStream: LiveStream) => {
    realtimeSocket.announceLiveStream(publishedStream);
    setActiveStream((prev) => (prev && prev.id === publishedStream.id ? publishedStream : prev));
    setLiveStreams((prev) => {
      const withoutCurrent = prev.filter((s) => s.id !== publishedStream.id);
      return [publishedStream, ...withoutCurrent];
    });
    try {
      await syncLiveStreamToFirestore(publishedStream);
      if (
        firebaseUser?.uid &&
        publishedStream.isActive !== false &&
        publishedStream.sfuSessionId &&
        !announcedLiveIdsRef.current.has(publishedStream.id)
      ) {
        announcedLiveIdsRef.current.add(publishedStream.id);
        fetchBroadcastRecipientIds(firebaseUser.uid, 25)
          .then((uids) => {
            uids.forEach((recipientId) => {
              sendFirestoreNotification({
                recipientId,
                type: 'live_on',
                category: 'liveOn',
                title: `🔴 ${publishedStream.host.displayName} is LIVE now!`,
                message: publishedStream.title || 'Tap to join the live stream now!',
                senderName: publishedStream.host.displayName,
                senderAvatar: publishedStream.host.avatar,
                screen: 'live_stream',
                streamId: publishedStream.id,
              }).catch(() => {});
            });
          })
          .catch(() => {});
      }
    } catch (err) {
      realtimeSocket.removeLiveStream(publishedStream.id);
      throw err;
    }
  };

  const closeLiveStream = () => {
    if (activeStream) {
      const isOwnerHost =
        activeStream.host.id === currentUser.id ||
        (auth.currentUser?.uid && activeStream.host.id === auth.currentUser.uid) ||
        activeStream.id.startsWith('live_my_');
      realtimeSocket.leaveRoom('live', activeStream.id);
      if (isOwnerHost) {
        realtimeSocket.removeLiveStream(activeStream.id);
        p2pStreamingEngine.stopHostBroadcast(activeStream.id).catch(() => {});
        deleteLiveStreamFromFirestore(activeStream.id).catch(() => {});
        setLiveStreams((prev) => prev.filter((s) => s.id !== activeStream.id));
      } else {
        p2pStreamingEngine.unsubscribeFromRemoteBroadcast(activeStream.id).catch(() => {});
      }
    }
    setActiveStream(null);
    navigateBack();
  };

  const openPKBattle = (stream: LiveStream) => {
    setActivePKBattle(stream);
    setPkScores({ left: 3420, right: 2890 });
    setCurrentScreen('pk_battle');
  };

  const executeGiftEconomy = (
    gift: Gift,
    recipientHostId?: string,
    quantity = 1,
    recipientDisplayName?: string,
    meta?: { context?: 'live' | 'party' | 'moments' | 'pk' | 'demo'; roomId?: string; streamId?: string; reelId?: string }
  ): { success: boolean; hostDiamonds: number; appShareCoins: number; totalCoins: number } => {
    const qty = Math.max(1, Math.floor(quantity || 1));
    const totalCoins = gift.coins * qty;
    const hostDiamonds = Math.round(totalCoins * 0.6);
    const appShareCoins = totalCoins - hostDiamonds;

    if (coins < totalCoins) {
      return { success: false, hostDiamonds, appShareCoins, totalCoins };
    }

    const context = meta?.context || 'live';
    const effectiveRecipientId = recipientHostId || activeStream?.host.id || activePartyRoom?.host.id || currentUser.id;
    const resolvedRecipientName =
      recipientDisplayName ||
      activeStream?.host.displayName ||
      activePartyRoom?.host.displayName ||
      'Host';
    const isSelfHost =
      effectiveRecipientId === currentUser.id ||
      (Boolean(firebaseUser?.uid) && effectiveRecipientId === firebaseUser?.uid);

    const nextCoins = Math.max(0, coins - totalCoins);
    const nextDiamonds = isSelfHost ? diamonds + hostDiamonds : diamonds;
    setCoins(nextCoins);
    if (isSelfHost) {
      setDiamonds(nextDiamonds);
    }

    const updatedUser: User = {
      ...currentUser,
      coins: nextCoins,
      diamonds: nextDiamonds,
    };
    saveUserSession(updatedUser, isAuthenticated);

    if (!isSelfHost) {
      setRegisteredUsers((users) => {
        const nextUsers = users.map((u) =>
          u.id === effectiveRecipientId
            ? { ...u, diamonds: (u.diamonds || 0) + hostDiamonds }
            : u
        );
        try {
          localStorage.setItem('alphamate_registered_users', JSON.stringify(nextUsers));
        } catch {}
        return nextUsers;
      });
    }

    const sentTx: WalletTransaction = {
      id: `tx_gift_${Date.now()}`,
      type: 'gift_sent',
      amount: totalCoins,
      currency: 'coins',
      title: `Sent ${qty > 1 ? `${qty}x ` : ''}${gift.name} (${gift.icon}) → ${resolvedRecipientName} [Host: +${hostDiamonds.toLocaleString()} 💎 (60%) | App: ${appShareCoins.toLocaleString()} Coins (40%)]`,
      date: 'Just now',
      status: 'completed',
    };
    const newTxs: WalletTransaction[] = [sentTx];
    if (isSelfHost) {
      newTxs.unshift({
        id: `tx_earn_${Date.now() + 1}`,
        type: 'gift_received',
        amount: hostDiamonds,
        currency: 'diamonds',
        title: `60% Host Share: ${qty > 1 ? `${qty}x ` : ''}${gift.name} ${gift.icon} (${totalCoins.toLocaleString()} Coins)`,
        date: 'Just now',
        status: 'completed',
      });
    }
    setTransactions((prev) => [...newTxs, ...prev]);

    const localLedgerId = firebaseUser?.uid ? `pending_${Date.now()}` : `local_gift_${Date.now()}`;
    const ledgerItem: GiftTransactionRecord = {
      id: localLedgerId,
      senderId: firebaseUser?.uid || currentUser.id,
      senderName: currentUser.displayName,
      recipientId: effectiveRecipientId,
      recipientName: resolvedRecipientName,
      giftId: gift.id,
      giftName: gift.name,
      giftIcon: gift.icon,
      quantity: qty,
      totalCoins,
      hostDiamonds,
      appShareCoins,
      context,
      roomId: meta?.roomId,
      streamId: meta?.streamId,
      reelId: meta?.reelId,
      status: 'completed',
      createdAt: new Date().toISOString(),
      createdAtMs: Date.now(),
    };
    setGiftTransactions((prev) => {
      const updated = [ledgerItem, ...prev.filter((x) => !x.id.startsWith('pending_'))];
      try {
        localStorage.setItem('alphamate_gift_transactions', JSON.stringify(updated.slice(0, 100)));
      } catch {}
      return updated;
    });

    if (firebaseUser?.uid) {
      executeSixtyFortyGiftTransaction({
        senderId: firebaseUser.uid,
        senderName: currentUser.displayName,
        senderAvatar: currentUser.avatar,
        recipientId: effectiveRecipientId,
        recipientName: resolvedRecipientName,
        giftId: gift.id,
        giftName: gift.name,
        giftIcon: gift.icon,
        unitCoins: gift.coins,
        quantity: qty,
        context,
        roomId: meta?.roomId,
        streamId: meta?.streamId,
        reelId: meta?.reelId,
      })
        .then((res) => {
          setGiftTransactions((prev) =>
            prev.map((g) => (g.id === localLedgerId ? { ...g, id: res.txId } : g))
          );
        })
        .catch((err) => console.warn('60/40 Firestore gift transaction warning:', err));
    } else if (isSelfHost) {
      const localNotifId = `local_notif_${Date.now()}`;
      const giftNotif: NotificationItem = {
        id: localNotifId,
        type: 'gift',
        category: 'gifts',
        title: `${gift.icon} Gift Received (+${hostDiamonds.toLocaleString()} 💎)`,
        message: `${currentUser.displayName} sent ${qty > 1 ? `${qty}x ` : ''}${gift.name} (${totalCoins.toLocaleString()} Coins). Your 60% host share (+${hostDiamonds.toLocaleString()} Diamonds) is in your wallet!`,
        timestamp: 'Just now',
        createdAtMs: Date.now(),
        isRead: false,
        screen: 'wallet',
      };
      setNotifications((prev) => [giftNotif, ...prev]);
      pushService.notifyForeground({
        id: localNotifId,
        title: giftNotif.title,
        body: giftNotif.message,
        data: { type: 'gift', screen: 'wallet' },
      });
    }

    // Update local monthly/weekly leaderboard immediately on every gift sent
    const updatedLbMap = applyLocalLeaderboardGift({
      recipientId: effectiveRecipientId,
      recipientName: resolvedRecipientName,
      giftCoins: totalCoins,
      hostDiamonds,
      monthKey: leaderboardMonthKey,
      weekKey: leaderboardWeekKey,
    });
    setLocalLeaderboardOverrides(updatedLbMap);

    // Update historical badge counters immediately on gift transaction
    setRawBadgeStats((prev) => ({
      ...prev,
      uid: activeBadgeUid,
      totalGiftCoinsSent: prev.totalGiftCoinsSent + totalCoins,
      totalGiftsSentCount: prev.totalGiftsSentCount + qty,
      totalGiftCoinsReceived: prev.totalGiftCoinsReceived + (isSelfHost ? totalCoins : 0),
      totalDiamondsEarned: prev.totalDiamondsEarned + (isSelfHost ? hostDiamonds : 0),
      updatedAt: new Date().toISOString(),
      updatedAtMs: Date.now(),
    }));

    return { success: true, hostDiamonds, appShareCoins, totalCoins };
  };

  const supportPKHost = (side: 'left' | 'right', amount: number) => {
    if (coins < amount) return;
    const pkGift: Gift = {
      id: `pk_${amount}`,
      name: 'PK Battle Support',
      icon: VIRTUAL_GIFTS[1]?.icon || '🔥',
      coins: amount,
      animationType: 'sparkle',
      description: 'PK battle gift with 60% host diamond split',
    };
    const hostRecipientId = side === 'left' ? (activePKBattle?.host.id || 'pk_left_host') : 'pk_right_host';
    const hostRecipientName = side === 'left' ? (activePKBattle?.host.displayName || 'Host Left') : 'Host Right';
    executeGiftEconomy(pkGift, hostRecipientId, 1, hostRecipientName, {
      context: 'pk',
      streamId: activePKBattle?.id,
    });
    setPkScores((prev) => ({
      ...prev,
      [side]: prev[side] + amount,
    }));
    setActiveGiftBanner({
      gift: pkGift,
      sender: currentUser.displayName,
      recipient: hostRecipientName,
    });
  };

  const sendLiveGift = (
    gift: Gift,
    recipientHostId?: string,
    quantity = 1,
    recipientDisplayName?: string,
    meta?: { context?: 'live' | 'party' | 'moments' | 'pk' | 'demo'; roomId?: string; streamId?: string; reelId?: string }
  ) => {
    const resolvedRecipientName =
      recipientDisplayName ||
      activeStream?.host.displayName ||
      activePartyRoom?.host.displayName ||
      'Host';
    const res = executeGiftEconomy(gift, recipientHostId, quantity, resolvedRecipientName, meta);
    if (!res.success) return;

    setActiveGiftBanner({
      gift,
      sender: currentUser.displayName,
      recipient: resolvedRecipientName,
    });
  };

  const simulateDemoHostGift = (coinsAmount = 1000, giftName = 'Demo Royal Gift') => {
    const matchedGift: Gift = VIRTUAL_GIFTS.find((g) => g.coins === coinsAmount) || {
      id: `demo_${coinsAmount}`,
      name: giftName,
      icon: '🎁',
      coins: coinsAmount,
      animationType: 'sparkle',
      description: 'Demo gift with 60% host diamond split',
    };
    const res = executeGiftEconomy(matchedGift, currentUser.id, 1, currentUser.displayName, {
      context: 'demo',
    });
    if (!res.success) {
      return {
        success: false,
        message: `You need ${coinsAmount.toLocaleString()} Coins to run this demo 60/40 split test. Top up Coins above first.`,
        hostDiamonds: res.hostDiamonds,
        appShareCoins: res.appShareCoins,
      };
    }
    return {
      success: true,
      message: `60/40 Split Applied: +${res.hostDiamonds.toLocaleString()} 💎 credited to Host Diamond Wallet (${res.appShareCoins.toLocaleString()} Coins App Share)!`,
      hostDiamonds: res.hostDiamonds,
      appShareCoins: res.appShareCoins,
    };
  };

  const clearActiveGiftBanner = () => {
    setActiveGiftBanner(null);
  };

  const openPartyRoom = (room: PartyRoom) => {
    const uid = auth.currentUser?.uid || currentUser.id;
    setActivePartyRoom(room);
    const mySeat = Array.isArray(room.seats)
      ? room.seats.find((s: any) => s.user?.id === uid)
      : null;
    setUserSeatIndex(mySeat ? Number(mySeat.seatIndex) : null);
    setIsMicMuted(mySeat ? Boolean(mySeat.isMuted || mySeat.isHostMuted) : false);
    setCurrentScreen('party_room');
  };

  const closePartyRoom = (shouldDelete = false) => {
    if (activePartyRoom) {
      realtimeSocket.leaveRoom('party', activePartyRoom.id);
      p2pStreamingEngine.stopPartyVoice(activePartyRoom.id).catch(() => {});
      if (shouldDelete) {
        realtimeSocket.removePartyRoom(activePartyRoom.id);
        deletePartyRoomFromFirestore(activePartyRoom.id).catch(() => {});
        setPartyRooms((prev) => prev.filter((r) => r.id !== activePartyRoom.id));
      }
    }
    setActivePartyRoom(null);
    setUserSeatIndex(null);
    setIsMicMuted(false);
    navigateBack();
  };

  const createPartyRoom = async (room: PartyRoom): Promise<{ success: boolean; error?: string }> => {
    const firebaseUid = auth.currentUser?.uid;
    if (!firebaseUid) {
      return { success: false, error: 'Please sign in first to host a Party Room.' };
    }
    const normalizedRoom: PartyRoom = {
      ...room,
      isActive: true,
      host: { ...room.host, id: firebaseUid },
    };
    try {
      realtimeSocket.announcePartyRoom(normalizedRoom);
      await syncPartyRoomToFirestore(normalizedRoom);
      setPartyRooms((prev) => [normalizedRoom, ...prev.filter((r) => r.id !== normalizedRoom.id)]);
      fetchBroadcastRecipientIds(firebaseUid, 25)
        .then((uids) => {
          uids.forEach((recipientId) => {
            sendFirestoreNotification({
              recipientId,
              type: 'party_invite',
              category: 'partyInvites',
              title: `🎙️ ${normalizedRoom.host.displayName} opened a Party Room!`,
              message: `Join "${normalizedRoom.title || 'Voice Party Room'}" — open mic seats are ready!`,
              senderName: normalizedRoom.host.displayName,
              senderAvatar: normalizedRoom.host.avatar,
              screen: 'party_room',
              roomId: normalizedRoom.id,
            }).catch(() => {});
          });
        })
        .catch(() => {});
      openPartyRoom(normalizedRoom);
      return { success: true };
    } catch (err: any) {
      realtimeSocket.removePartyRoom(normalizedRoom.id);
      console.error('Failed to create party room:', err);
      let msg = 'Unable to save Party Room to database.';
      if (err instanceof Error && err.message) {
        try {
          const parsed = JSON.parse(err.message);
          msg = parsed.error || err.message;
        } catch {
          msg = err.message;
        }
      }
      return { success: false, error: msg };
    }
  };

  const updateActivePartyRoomLevel = (level: 1 | 2 | 3) => {
    if (!activePartyRoom) return;
    const updated: PartyRoom = { ...activePartyRoom, level };
    setActivePartyRoom(updated);
    setPartyRooms((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    syncPartyRoomToFirestore(updated).catch(() => {});
  };

  const toggleSeat = async (seatIndex: number): Promise<{ success: boolean; reason?: string }> => {
    if (!activePartyRoom || !currentUser?.id) {
      return { success: false, reason: 'NO_ACTIVE_ROOM' };
    }

    const room = activePartyRoom;
    const prevSeatIndex = userSeatIndex;
    const isLeaving = userSeatIndex === seatIndex;
    const effectiveUser = auth.currentUser?.uid ? { ...currentUser, id: auth.currentUser.uid } : currentUser;
    const targetServerSeat = Array.isArray(room.seats)
      ? room.seats.find((s: any) => Number(s.seatIndex) === seatIndex)
      : null;
    const nextSeatMuted = isLeaving ? false : Boolean(targetServerSeat?.isHostMuted);

    // Immediate optimistic update
    setUserSeatIndex(isLeaving ? null : seatIndex);
    setIsMicMuted(nextSeatMuted);

    const roomSeats = Array.isArray(room.seats) ? [...room.seats] : [];
    const optimisticSeats = roomSeats.map((s: any) => {
      if (Number(s.seatIndex) === seatIndex) {
        return isLeaving
          ? { ...s, user: null, isSpeaking: false, isMuted: false, isHostMuted: false }
          : { ...s, user: effectiveUser, isSpeaking: false, isMuted: nextSeatMuted };
      }
      if (!isLeaving && s.user?.id === effectiveUser.id) {
        return { ...s, user: null, isSpeaking: false, isMuted: false, isHostMuted: false };
      }
      return s;
    });

    const optimisticRoom = { ...room, seats: optimisticSeats };
    setActivePartyRoom(optimisticRoom);
    setPartyRooms((prev) => prev.map((item) => (item.id === room.id ? optimisticRoom : item)));

    // Persist atomically via Firestore transaction
    const result = await updatePartyRoomSeat(
      room.id,
      seatIndex,
      isLeaving ? null : effectiveUser,
      effectiveUser.id,
      nextSeatMuted
    );

    if (result.success && result.seats) {
      const verifiedRoom = { ...room, seats: result.seats };
      setActivePartyRoom(verifiedRoom);
      setPartyRooms((prev) => prev.map((item) => (item.id === room.id ? verifiedRoom : item)));
      const mySeat = result.seats.find((s: any) => s.user?.id === effectiveUser.id);
      setUserSeatIndex(mySeat ? Number(mySeat.seatIndex) : null);
      if (mySeat) {
        setIsMicMuted(Boolean(mySeat.isMuted || mySeat.isHostMuted));
      } else {
        setIsMicMuted(false);
      }
      return { success: true };
    }

    console.warn('Party seat update rejected:', result.reason);
    // Revert optimistic state if transaction declined (occupied/locked/restricted)
    setUserSeatIndex(prevSeatIndex);
    setIsMicMuted(false);
    setActivePartyRoom(room);
    setPartyRooms((prev) => prev.map((item) => (item.id === room.id ? room : item)));
    return { success: false, reason: result.reason || 'REJECTED' };
  };

  const openConversation = (conv: Conversation) => {
    setActiveConversation(conv);
    setCurrentScreen('chat_conversation');
  };

  const openPublicUserProfile = (user: User) => {
    setViewingPublicUser(user);
  };

  const closePublicUserProfile = () => {
    setViewingPublicUser(null);
  };

  const openUploadScreen = (mode: 'record' | 'photo' | 'gallery' | 'post' = 'post') => {
    setUploadInitialMode(mode);
    setCurrentScreen('upload');
  };

  const toggleFollowUser = async (targetUser: User): Promise<boolean> => {
    const myUid = auth.currentUser?.uid || currentUser.id;
    if (!targetUser?.id || targetUser.id === myUid) return false;
    const currentlyFollowing = followingUserIds.includes(targetUser.id);
    const shouldFollow = !currentlyFollowing;
    const isFollowBack = shouldFollow && followerUserIds.includes(targetUser.id);

    // Optimistic state update
    setFollowingUserIds((prev) =>
      shouldFollow ? Array.from(new Set([...prev, targetUser.id])) : prev.filter((id) => id !== targetUser.id)
    );

    if (auth.currentUser?.uid) {
      return setUserFollowStateFirestore({
        me: currentUser,
        target: targetUser,
        shouldFollow,
        isFollowBack,
      });
    }
    return shouldFollow;
  };

  const startDirectMessage = async (targetUser: User) => {
    const myUid = auth.currentUser?.uid;
    let chatId = `conv_${targetUser.id || Date.now()}`;

    if (myUid && targetUser.id && targetUser.id !== myUid) {
      try {
        chatId = await getOrCreateDirectChat(
          {
            id: myUid,
            displayName: currentUser.displayName,
            username: currentUser.username,
            uniqueId: currentUser.uniqueId,
            avatar: currentUser.avatar,
          },
          {
            id: targetUser.id,
            displayName: targetUser.displayName,
            username: targetUser.username,
            uniqueId: targetUser.uniqueId,
            avatar: targetUser.avatar,
          }
        );
      } catch (err) {
        console.warn('Direct chat initialization fallback:', err);
      }
    }

    const existingConv = conversations.find(
      (c) => c.id === chatId || (!c.isGroup && c.user?.id === targetUser.id)
    );
    const convToOpen: Conversation = existingConv || {
      id: chatId,
      user: targetUser,
      lastMessage: 'Connected on Alpha Mate',
      lastTimestamp: 'Just now',
      unreadCount: 0,
      isGroup: false,
      messages: [],
    };
    setActiveConversation(convToOpen);
    setCurrentScreen('chat_conversation');
  };

  const sendMessage = (convId: string, text: string, imageUrl?: string) => {
    if (!text.trim() && !imageUrl) return;

    const newMsg = {
      id: `msg_${Date.now()}`,
      senderId: currentUser.id,
      senderName: currentUser.displayName,
      senderAvatar: currentUser.avatar,
      text: text.trim(),
      imageUrl,
      timestamp: 'Just now',
      isRead: true,
      isMe: true,
    };

    setConversations((prev) =>
      prev.map((c) => {
        if (c.id === convId) {
          return {
            ...c,
            lastMessage: text.trim() || 'Photo sent',
            lastTimestamp: 'Just now',
            messages: [...c.messages, newMsg],
          };
        }
        return c;
      })
    );

    if (activeConversation && activeConversation.id === convId) {
      setActiveConversation((prev) =>
        prev
          ? {
              ...prev,
              lastMessage: text.trim() || 'Photo sent',
              lastTimestamp: 'Just now',
              messages: [...prev.messages, newMsg],
            }
          : null
      );
    }
  };

  const addVideoPost = (videoData: Omit<VideoPost, 'id' | 'likes' | 'commentsCount' | 'sharesCount' | 'timestamp'>) => {
    const newPost: VideoPost = {
      id: `vid_${Date.now()}`,
      ...videoData,
      likes: 1,
      commentsCount: 0,
      sharesCount: 0,
      viewsCount: 1,
      feedCategory: 'For You',
      isLiked: false,
      timestamp: 'Just now',
    };
    setVideos((prev) => [newPost, ...prev]);
  };

  const toggleLikeVideo = (videoId: string) => {
    const targetVideo = videos.find((v) => v.id === videoId);
    const willLike = targetVideo ? !targetVideo.isLiked : false;

    setVideos((prev) =>
      prev.map((v) => {
        if (v.id === videoId) {
          const isLiked = !v.isLiked;
          // Sync with Firestore reel likes
          toggleReelLike(videoId, isLiked).catch(() => {});
          return {
            ...v,
            isLiked,
            likes: isLiked ? v.likes + 1 : Math.max(0, v.likes - 1),
          };
        }
        return v;
      })
    );

    if (willLike && targetVideo?.user?.id && targetVideo.user.id !== currentUser.id) {
      sendNotificationToUser({
        recipientId: targetVideo.user.id,
        type: 'like',
        category: 'likes',
        title: `💖 ${currentUser.displayName} liked your Moment`,
        message: `"${targetVideo.title || 'Your video'}" received a new like!`,
        screen: 'moments',
        reelId: targetVideo.id,
      }).catch(() => {});
    }
  };

  const deleteVideoPost = async (postId: string, videoKey?: string) => {
    // 1. Optimistically remove from state
    setVideos((prev) => prev.filter((v) => v.id !== postId));

    // 2. Permanently remove from Cloudflare R2 and Cloud Firestore
    try {
      await deleteReel(postId, videoKey || '');
    } catch (err) {
      console.warn('Reel deletion error:', err);
      throw err;
    }
  };

  const addMyStory = (storyData: {
    mediaUrl: string;
    caption?: string;
    musicTitle?: string;
    backgroundColor?: string;
    stickers?: string[];
  }) => {
    const newStory: StoryItem = {
      id: `story_me_${Date.now()}`,
      mediaUrl: storyData.mediaUrl,
      caption: storyData.caption,
      musicTitle: storyData.musicTitle,
      backgroundColor: storyData.backgroundColor,
      stickers: storyData.stickers,
      createdAt: 'Just now',
      likes: 0,
      isLiked: false,
      viewsCount: 1,
    };
    setMyStories((prev) => {
      const updated = [newStory, ...prev];
      try {
        localStorage.setItem('alphamate_my_stories', JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  };

  const toggleLikeStory = (friendId: string, storyId: string) => {
    if (friendId === 'me' || friendId === currentUser.id) {
      setMyStories((prev) =>
        prev.map((s) => {
          if (s.id === storyId) {
            const isLiked = !s.isLiked;
            return {
              ...s,
              isLiked,
              likes: isLiked ? s.likes + 1 : Math.max(0, s.likes - 1),
            };
          }
          return s;
        })
      );
      return;
    }

    setFriendStories((prev) =>
      prev.map((f) => {
        if (f.id === friendId || f.user.id === friendId) {
          return {
            ...f,
            stories: f.stories.map((s) => {
              if (s.id === storyId) {
                const isLiked = !s.isLiked;
                return {
                  ...s,
                  isLiked,
                  likes: isLiked ? s.likes + 1 : Math.max(0, s.likes - 1),
                };
              }
              return s;
            }),
          };
        }
        return f;
      })
    );
  };

  const reactToStory = (friendId: string, storyId: string, _emoji: string) => {
    // Increment likes and flash reaction
    setFriendStories((prev) =>
      prev.map((f) => {
        if (f.id === friendId || f.user.id === friendId) {
          return {
            ...f,
            stories: f.stories.map((s) => {
              if (s.id === storyId) {
                return {
                  ...s,
                  likes: s.likes + 1,
                  isLiked: true,
                };
              }
              return s;
            }),
          };
        }
        return f;
      })
    );
  };

  const markStorySeen = (friendId: string) => {
    setFriendStories((prev) =>
      prev.map((f) => (f.id === friendId || f.user.id === friendId ? { ...f, isSeen: true } : f))
    );
  };

  const addCoins = (amount: number, reason: string) => {
    setCoins((prev) => prev + amount);
    setCurrentUser((prev) => {
      const updated = { ...prev, coins: (prev.coins || 0) + amount };
      try {
        localStorage.setItem('alphamate_current_user', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    const newTx: WalletTransaction = {
      id: `tx_${Date.now()}`,
      type: 'reward',
      amount,
      currency: 'coins',
      title: reason || 'Coins Reward',
      date: 'Just now',
      status: 'completed',
    };
    setTransactions((prev) => [newTx, ...prev]);
  };

  const addDiamonds = (amount: number, reason: string) => {
    setDiamonds((prev) => prev + amount);
    setCurrentUser((prev) => {
      const updated = { ...prev, diamonds: (prev.diamonds || 0) + amount };
      try {
        localStorage.setItem('alphamate_current_user', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    const newTx: WalletTransaction = {
      id: `tx_${Date.now()}`,
      type: 'gift_received',
      amount,
      currency: 'diamonds',
      title: reason || 'Gift Received / Stream Earnings',
      date: 'Just now',
      status: 'completed',
    };
    setTransactions((prev) => [newTx, ...prev]);
  };

  const rechargeCoins = async (amount: number, priceUSD: number, paymentMethod: string): Promise<boolean> => {
    // realistic checkout delay
    await new Promise((res) => setTimeout(res, 800));
    setCoins((prev) => prev + amount);
    setCurrentUser((prev) => {
      const updated = { ...prev, coins: (prev.coins || 0) + amount };
      try {
        localStorage.setItem('alphamate_current_user', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    const newTx: WalletTransaction = {
      id: `tx_${Date.now()}`,
      type: 'recharge',
      amount,
      currency: 'coins',
      title: `Coin Top Up (${amount.toLocaleString()} Coins via ${paymentMethod})`,
      date: 'Just now',
      status: 'completed',
    };
    setTransactions((prev) => [newTx, ...prev]);
    return true;
  };

  const withdrawDiamonds = (
    amountUSD: number,
    method: string,
    accountDetails: { title: string; number: string; bankName?: string }
  ): { success: boolean; message: string } => {
    if (amountUSD < 10) {
      return { success: false, message: 'Minimum withdrawal amount is $10.00 (100,000 Diamonds)' };
    }
    const diamondsNeeded = Math.round(amountUSD * 10000);
    if (diamonds < diamondsNeeded) {
      return {
        success: false,
        message: `Insufficient diamonds! You need ${diamondsNeeded.toLocaleString()} Diamonds for a $${amountUSD.toFixed(2)} withdrawal.`,
      };
    }

    // Exchange rate: 1 USD = ~280 PKR
    const pkrAmount = Math.round(amountUSD * 280);

    // Hold the diamonds immediately: deduct from available diamonds, add to heldDiamonds
    setDiamonds((prev) => Math.max(0, prev - diamondsNeeded));
    setHeldDiamonds((prev) => prev + diamondsNeeded);

    setCurrentUser((prev) => {
      const updated = {
        ...prev,
        diamonds: Math.max(0, (prev.diamonds || 0) - diamondsNeeded),
        heldDiamonds: (prev.heldDiamonds || 0) + diamondsNeeded,
      };
      try {
        localStorage.setItem('alphamate_current_user', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    const newTx: WalletTransaction = {
      id: `tx_withdraw_${Date.now()}`,
      type: 'withdrawal',
      amount: amountUSD,
      currency: 'USD',
      title: `Withdrawal via ${method} ($${amountUSD.toFixed(2)} / PKR ${pkrAmount.toLocaleString()})`,
      date: 'Just now',
      status: 'pending',
      heldDiamonds: diamondsNeeded,
      pkrAmount: pkrAmount,
      accountDetails: {
        method,
        title: accountDetails.title,
        number: accountDetails.number,
        bankName: accountDetails.bankName,
      },
    };
    setTransactions((prev) => [newTx, ...prev]);

    const withdrawNotif: NotificationItem = {
      id: `notif_withdraw_${Date.now()}`,
      type: 'system',
      title: '💸 Withdrawal Request Submitted (Pending)',
      message: `Your withdrawal of $${amountUSD.toFixed(2)} (PKR ${pkrAmount.toLocaleString()}) via ${method} has been submitted to admin. ${diamondsNeeded.toLocaleString()} Diamonds are now securely held until approval. Processing time: 12-24 hours.`,
      timestamp: 'Just now',
      isRead: false,
    };
    setNotifications((prev) => [withdrawNotif, ...prev]);

    return {
      success: true,
      message: `Withdrawal request for $${amountUSD.toFixed(2)} (PKR ${pkrAmount.toLocaleString()}) submitted! ${diamondsNeeded.toLocaleString()} Diamonds are held pending admin review.`,
    };
  };

  const equipFrame = (frameId: string) => {
    setCurrentUser((prev) => {
      const updated = { ...prev, activeFrame: frameId };
      try {
        localStorage.setItem('alphamate_current_user', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const equipHonorTitle = (title: string) => {
    setCurrentUser((prev) => {
      const updated = { ...prev, activeHonorTitle: title };
      try {
        localStorage.setItem('alphamate_current_user', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const exchangeDiamondsToCoins = (
    diamondsAmount: number
  ): { success: boolean; message: string } => {
    if (diamondsAmount <= 0) {
      return { success: false, message: 'Please enter a valid amount of diamonds to exchange' };
    }
    if (diamonds < diamondsAmount) {
      return { success: false, message: 'Insufficient diamonds balance' };
    }

    setDiamonds((prev) => prev - diamondsAmount);
    setCoins((prev) => prev + diamondsAmount);

    setCurrentUser((prev) => {
      const updated = {
        ...prev,
        diamonds: Math.max(0, (prev.diamonds || 0) - diamondsAmount),
        coins: (prev.coins || 0) + diamondsAmount,
      };
      try {
        localStorage.setItem('alphamate_current_user', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    const newTx: WalletTransaction = {
      id: `tx_exchange_${Date.now()}`,
      type: 'reward',
      amount: diamondsAmount,
      currency: 'coins',
      title: `Converted ${diamondsAmount.toLocaleString()} Diamonds to Coins`,
      date: 'Just now',
      status: 'completed',
    };
    setTransactions((prev) => [newTx, ...prev]);

    return {
      success: true,
      message: `Successfully converted ${diamondsAmount.toLocaleString()} Diamonds into ${diamondsAmount.toLocaleString()} Coins!`,
    };
  };

  const purchaseStoreItem = (cost: number, currency: 'coins' | 'diamonds', itemTitle: string): boolean => {
    if (currency === 'coins') {
      if (coins < cost) return false;
      setCoins((c) => c - cost);
    } else {
      if (diamonds < cost) return false;
      setDiamonds((d) => d - cost);
    }

    const newTx: WalletTransaction = {
      id: `tx_${Date.now()}`,
      type: 'gift_sent',
      amount: cost,
      currency,
      title: `Store Purchase: ${itemTitle}`,
      date: 'Just now',
      status: 'completed',
    };
    setTransactions((prev) => [newTx, ...prev]);
    return true;
  };

  const markNotificationRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    if (firebaseUser?.uid && !id.startsWith('notif_') && !id.startsWith('local_notif_')) {
      markFirestoreNotificationRead(firebaseUser.uid, id).catch(() => {});
    }
  };

  const markAllNotificationsRead = () => {
    const unreadIds = notifications.filter((n) => !n.isRead).map((n) => n.id);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    if (firebaseUser?.uid) {
      const fsIds = unreadIds.filter((id) => !id.startsWith('notif_') && !id.startsWith('local_notif_'));
      if (fsIds.length > 0) {
        markAllFirestoreNotificationsRead(firebaseUser.uid, fsIds).catch(() => {});
      }
    }
  };

  const unreadNotificationsCount = notifications.filter((n) => !n.isRead).length;

  return (
    <AppContext.Provider
      value={{
        currentScreen,
        setCurrentScreen,
        activeTab,
        setActiveTab,
        navigateBack,
        screenHistory,
        legalConsent,
        setLegalConsent,
        isAuthenticated,
        currentUser,
        setCurrentUser,
        updateUserProfile,
        login,
        logout,
        register,
        registeredUsers,
        loginWithGoogle,
        registerWithFullDetails,
        loginWithCredentials,
        firebaseUser,
        firebaseAuthLoading,
        isEmailVerified,
        loginWithFirebaseGoogle,
        loginWithFirebaseEmail,
        registerWithFirebaseEmail,
        refreshFirebaseVerification,
        resendEmailVerificationLink,
        logoutFirebase,
        sendAccountDeletionOtp,
        verifyAccountDeletionOtp,
        deactivateCurrentAccount,
        requestPermanentAccountDeletion,
        recoverCurrentAccount,
        liveStreams,
        activeStream,
        openLiveStream,
        publishLiveStream,
        closeLiveStream,
        sendLiveGift,
        activeGiftBanner,
        clearActiveGiftBanner,
        giftTransactions,
        simulateDemoHostGift,
        activePKBattle,
        openPKBattle,
        pkScores,
        supportPKHost,
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
        conversations,
        activeConversation,
        openConversation,
        startDirectMessage,
        sendMessage,
        videos,
        uploadInitialMode,
        openUploadScreen,
        addVideoPost,
        toggleLikeVideo,
        deleteVideoPost,
        friendStories,
        myStories,
        addMyStory,
        toggleLikeStory,
        reactToStory,
        markStorySeen,
        coins,
        diamonds,
        heldDiamonds,
        transactions,
        addCoins,
        addDiamonds,
        rechargeCoins,
        withdrawDiamonds,
        exchangeDiamondsToCoins,
        purchaseStoreItem,
        equipFrame,
        equipHonorTitle,
        dailyCheckInState,
        claimDailyReward,
        showDailyCheckInModal,
        setShowDailyCheckInModal,
        notifications,
        markNotificationRead,
        markAllNotificationsRead,
        unreadNotificationsCount,
        notificationPreferences,
        updateNotificationPreferences,
        toggleMasterNotifications,
        showPushSettingsModal,
        setShowPushSettingsModal,
        sendNotificationToUser,
        leaderboardMonthKey,
        leaderboardPreviousMonthKey,
        leaderboardWeekKey,
        firestoreLeaderboardEntries,
        previousMonthLeaderboardEntries,
        localLeaderboardOverrides,
        previousMonthLocalOverrides,
        showLeaderboardModal,
        setShowLeaderboardModal,
        leaderboardInitialScope,
        setLeaderboardInitialScope,
        openLeaderboard,
        loadPreviousMonthLeaderboard,
        userHistoricalStats: evaluatedBadgeResult.nextStats,
        evaluatedBadges: evaluatedBadgeResult.evaluatedBadges,
        showBadgesModal,
        setShowBadgesModal,
        openBadgesModal,
        toggleEquipUserBadge,
        realUsers,
        followingUserIds,
        followerUserIds,
        toggleFollowUser,
        viewingPublicUser,
        openPublicUserProfile,
        closePublicUserProfile,
        searchQuery,
        setSearchQuery,
        deviceMode,
        setDeviceMode,
        customLogoUrl,
        setCustomLogoUrl,
        agencyProfile,
        agencyOrders,
        agencyTransactions,
        sendAgencyCoins,
        deliverAgencyOrder,
        rejectAgencyOrder,
        updateAgencyProfile,
        setAgencySecurityPin,
        createBuyerCoinOrder,
        findUserByIdOrUsername,
        hostAgencyProfile,
        agencyHosts,
        hostJoinRequests,
        agencyApplications,
        allHostAgencies,
        updateHostAgencyProfile,
        setHostWeeklyTarget,
        updateHostCommission,
        updateHostContract,
        toggleHostLiveStatus,
        approveHostJoinRequest,
        rejectHostJoinRequest,
        removeHostFromAgency,
        requestHostResignation,
        submitHostJoinRequest,
        submitAgencyApplication,
        reviewAgencyApplication,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
