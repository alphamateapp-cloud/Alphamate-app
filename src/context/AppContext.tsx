import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { DEFAULT_AVATAR_URL } from '../utils/imageHd';
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
  SavedDeviceAccount,
  AdminModerationState,
  AdminRestrictionDetail,
  AdvancedGiftConfig,
  UnifiedGiftConfig,
  UnifiedGiftCatalogSyncStats,
} from '../types';
import {
  ALPHA_MATE_10_ANIMATED_GIFTS,
  DEFAULT_ALPHA_MATE_TEST_GIFT_CONFIG,
  unifiedGiftToGift,
  subscribeToUnifiedGiftCatalog,
  saveUnifiedGiftToFirestore,
  deleteUnifiedGiftFromFirestore,
  migrateLegacyGiftsToUnifiedCatalog,
  validateGiftSendOnServer,
} from '../services/giftAnimationEngine';
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
  signInWithFirebaseCustomToken,
  registerWithEmail,
  resendVerificationEmail,
  reloadCurrentFirebaseUser,
  isFirebaseUserVerified,
  hasFirebasePasswordProvider,
  linkOrSetUserPassword,
  serializeFirebaseUserBlob,
  hydrateFirebaseUserOnDefaultAuth,
  clearDefaultAuthCurrentUser,
  checkUsernameAvailabilityFirestore,
  logoutUser,
  onAuthStateChanged,
  onIdTokenChanged,
  syncUserProfileToFirestore,
  getUserProfileFromFirestore,
  subscribeToUserProfile,
  syncPartyRoomToFirestore,
  updatePartyRoomFields,
  deletePartyRoomFromFirestore,
  subscribeToPartyRooms,
  updatePartyRoomSeat,
  syncLiveStreamToFirestore,
  deleteLiveStreamFromFirestore,
  subscribeToLiveStreams,
  getCanonicalPartyRoomId,
  isLegacyErrorCardId,
  purgeStaleHostCardsInFirestore,
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
  recoverFirestoreNetwork,
  isFirestoreQuotaExceeded,
  fetchLiveStreamFromServer,
  fetchPartyRoomFromServer,
  submitAgencyApplicationToFirestore,
  subscribeToMyAgencyApplications,
  subscribeToAllAgencyApplications,
  subscribeToApprovedAgencies,
  adminReviewAgencyApplicationInFirestore,
  adminAllocateAgencyCoinsInFirestore,
  updateApprovedAgencySettingsInFirestore,
  findRealUserInFirestore,
  transferAgencyCoinsAtomicInFirestore,
  subscribeToAgencyTransactions,
  subscribeToUserWalletTransactions,
  submitHostAgencyRequestToFirestore,
  subscribeToMyHostAgencyRequests,
  subscribeToAgencyOwnerHostRequests,
  subscribeToAllHostAgencyRequests,
  reviewHostAgencyRequestInFirestore,
  subscribeToAgencyHostMembers,
  SendNotificationParams,
  FirebaseUser,
} from '../services/firebase';
import { buildIdempotentTxId } from '../services/financialLedgerService';
import {
  normalizeOfficialAgencyDoc,
  normalizeHostAgencyRequestDoc,
  resolveUserHostAgencyMembership,
  ResolvedHostAgencyMembership,
} from '../services/agencySyncService';
import type { OfficialAgency } from '../components/modals/AgencyContactModal';
import {
  subscribeToActiveReels,
  deleteReel,
  toggleReelLike,
  Reel,
} from '../services/reelsService';
import { p2pStreamingEngine } from '../services/webrtcService';
import { agoraPartyEngine } from '../services/agoraPartyEngine';
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
import {
  cacheCurrentUserSnippet,
  clearCurrentUserSnippet,
  getCachedCurrentUserSnippet,
} from '../services/profileSnippetCache';
import { buildDirectChatId } from '../services/chatService';
import {
  requestAuthenticatedEmailOtp,
  confirmAuthenticatedEmailOtp,
  requestLoginEmailOtp,
  confirmLoginEmailOtp,
  requestPreSignupEmailOtp,
  confirmPreSignupEmailOtp,
  finalizePreSignupWithPassword,
  setCloudAccountPassword,
  registerCloudDeviceSwitchSession,
  redeemCloudDeviceSwitchSession,
} from '../services/emailOtpService';
import {
  MAX_DEVICE_ACCOUNTS,
  getOrCreateDeviceFingerprint,
  loadSavedDeviceAccounts,
  upsertSavedDeviceAccount,
  updateSavedDeviceAccountSessionData,
  removeSavedDeviceAccount,
} from '../services/multiAccountService';
import {
  parseAdminModerationState,
  resolveUserBlueTickVerified,
  resolveUserGreenTickVerified,
  mergeAndDeduplicateNotifications,
  subscribeToUserAdminActionCollections,
  markAdminActionItemRead,
  buildProfileTransitionNotifications,
} from '../services/adminModerationService';

export type RefreshScope =
  | 'home'
  | 'party'
  | 'party_room'
  | 'live_stream'
  | 'moments'
  | 'chat'
  | 'search'
  | 'profile'
  | 'notifications'
  | 'wallet'
  | 'store'
  | 'levels'
  | 'settings'
  | 'agency_management'
  | 'leaderboard'
  | 'pk_battle'
  | 'upload';

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
  sendSignupEmailOtp: (displayName?: string) => Promise<{
    success: boolean;
    alreadyVerified?: boolean;
    emailMasked?: string;
    challengeToken?: string;
    expiresAt?: number;
    cooldownSeconds?: number;
    retryAfterSeconds?: number;
    provider?: string;
    code?: string;
    error?: string;
  }>;
  verifySignupEmailOtp: (
    challengeToken: string,
    otp: string
  ) => Promise<{
    success: boolean;
    emailVerifiedAt?: string;
    code?: string;
    remainingAttempts?: number;
    error?: string;
  }>;
  sendLoginEmailOtp: (email: string) => Promise<{
    success: boolean;
    emailMasked?: string;
    challengeToken?: string;
    expiresAt?: number;
    cooldownSeconds?: number;
    retryAfterSeconds?: number;
    provider?: string;
    code?: string;
    error?: string;
  }>;
  verifyLoginEmailOtp: (
    email: string,
    challengeToken: string,
    otp: string
  ) => Promise<{
    success: boolean;
    user?: User;
    code?: string;
    remainingAttempts?: number;
    error?: string;
  }>;
  sendPreSignupEmailOtp: (email: string) => Promise<{
    success: boolean;
    emailMasked?: string;
    challengeToken?: string;
    expiresAt?: number;
    cooldownSeconds?: number;
    retryAfterSeconds?: number;
    provider?: string;
    code?: string;
    error?: string;
  }>;
  verifyPreSignupEmailOtp: (
    email: string,
    challengeToken: string,
    otp: string
  ) => Promise<{
    success: boolean;
    registrationTicket?: string;
    emailVerifiedAt?: string;
    code?: string;
    remainingAttempts?: number;
    error?: string;
  }>;
  completePreSignupPassword: (
    email: string,
    password: string,
    registrationTicket: string
  ) => Promise<{
    success: boolean;
    user?: User;
    code?: string;
    error?: string;
  }>;
  needsProfileRegistration: boolean;
  completeInAppProfileRegistration: (data: {
    avatar: string;
    displayName: string;
    username: string;
    gender: 'male' | 'female' | 'other';
    dob: string;
    age: number;
    bio: string;
    password?: string;
  }) => Promise<{ success: boolean; user?: User; error?: string }>;
  checkUsernameAvailable: (username: string) => Promise<boolean>;

  // Multi-Account System (Up to 5 Instant-Switch Accounts on Device)
  savedAccounts: SavedDeviceAccount[];
  maxSavedAccounts: number;
  isAddingAccount: boolean;
  addingAccountReturnUid: string | null;
  showAccountSwitcherModal: boolean;
  setShowAccountSwitcherModal: (show: boolean) => void;
  switchAccount: (uid: string) => Promise<{ success: boolean; error?: string }>;
  startAddAccountFlow: (targetScreen?: 'register' | 'signin') => Promise<{ success: boolean; error?: string }>;
  cancelAddAccountFlow: () => Promise<void>;
  removeSavedAccount: (uid: string) => Promise<void>;
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
  ) => boolean;
  activeGiftBanner: {
    id: string;
    gift: Gift;
    quantity: number;
    sender: string;
    senderAvatar?: string;
    senderVipTier?: number;
    recipient: string;
    context: 'live' | 'party' | 'pk';
    streamId?: string;
    roomId?: string;
    createdAtMs: number;
  } | null;
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
  closePartyRoom: (shouldDelete?: boolean, options?: { remainingViewers?: number }) => void;
  createPartyRoom: (
    room: PartyRoom
  ) => Promise<{ success: boolean; alreadyExists?: boolean; room?: PartyRoom; error?: string }>;
  updateActivePartyRoomLevel: (level: 1 | 2 | 3 | 4) => void;
  toggleSeat: (seatIndex: number) => Promise<{ success: boolean; reason?: string }>;
  userSeatIndex: number | null;
  setUserSeatIndex: React.Dispatch<React.SetStateAction<number | null>>;
  isMicMuted: boolean;
  setIsMicMuted: (muted: boolean) => void;

  // Chat & Messaging
  conversations: Conversation[];
  activeConversation: Conversation | null;
  openConversation: (conv: Conversation | null) => void;
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

  // Existing Admin Panel Actions – User-Side Moderation & Notification Integration
  adminModerationState: AdminModerationState;
  activeAdminWarning: NotificationItem | null;
  dismissActiveAdminWarning: (markRead?: boolean) => void;
  selectedAdminNotification: NotificationItem | null;
  setSelectedAdminNotification: (item: NotificationItem | null) => void;
  openAdminNotificationDetails: (item: NotificationItem) => void;
  activeFeatureRestrictionModal: {
    scope: 'live' | 'party';
    detail: AdminRestrictionDetail;
  } | null;
  setActiveFeatureRestrictionModal: (
    modal: { scope: 'live' | 'party'; detail: AdminRestrictionDetail } | null
  ) => void;

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

  // Scoped Refresh & Network Recovery
  refreshScope: (scope?: RefreshScope) => Promise<{ ok: boolean; message: string }>;
  chatRefreshEpoch: number;
  liveRefreshTick: number;
  partyRefreshTick: number;
  userSyncRefreshEpoch: number;

  // Device & Admin View
  deviceMode: 'mobile' | 'responsive' | 'admin';
  setDeviceMode: (mode: 'mobile' | 'responsive' | 'admin') => void;

  // Original Logo Asset
  customLogoUrl: string | null;
  setCustomLogoUrl: (url: string | null) => void;

  // Agency Center & Coin Seller Agency Management (Strictly Admin-Approved Only)
  agencyProfile: CoinSellerAgencyProfile | null;
  officialCoinSellerAgencies: OfficialAgency[];
  officialCoinSellerProfiles: CoinSellerAgencyProfile[];
  agencyOrders: AgencyOrder[];
  agencyTransactions: AgencyTransaction[];
  sendAgencyCoins: (
    recipientQuery: string,
    amount: number,
    pin: string,
    idempotencyKey?: string
  ) => Promise<{ success: boolean; message: string; tx?: AgencyTransaction }>;
  deliverAgencyOrder: (
    orderId: string,
    pin: string
  ) => Promise<{ success: boolean; message: string }>;
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
  findUserByIdOrUsernameAsync: (query: string) => Promise<User | null>;

  // Host Agency Management (Strictly Admin-Approved Only)
  hostAgencyProfile: HostAgencyProfile | null;
  agencyHosts: HostMember[];
  hostJoinRequests: HostJoinRequest[];
  myHostAgencyRequests: HostJoinRequest[];
  hostAgencyMembership: ResolvedHostAgencyMembership;
  agencyApplications: AgencyApplication[];
  allHostAgencies: HostAgencyProfile[];
  contactAgencyInApp: (agency: {
    agencyId: string;
    agencyName: string;
    agencyCode?: string;
    ownerUserId: string;
    ownerName?: string;
    ownerAvatar?: string;
  }) => Promise<{ success: boolean; message: string }>;
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
  rejectHostJoinRequest: (requestId: string, reason?: string) => { success: boolean; message: string };
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
  ) => Promise<{ success: boolean; message: string }>;
  submitAgencyApplication: (
    data: Omit<AgencyApplication, 'id' | 'status' | 'submittedAt'>
  ) => { success: boolean; message: string };
  reviewAgencyApplication: (
    applicationId: string,
    action: 'approve' | 'reject'
  ) => { success: boolean; message: string };
  adminAllocateAgencyCoins: (
    agencyId: string,
    coinsToAdd: number
  ) => Promise<{ success: boolean; message: string }>;

  // Single Unified Firestore Gift Catalog (/gifts schema v2 — static & animated)
  unifiedCatalogGifts: UnifiedGiftConfig[];
  catalogSyncStats: UnifiedGiftCatalogSyncStats;
  advancedGifts: AdvancedGiftConfig[];
  adminCatalogGifts: Gift[];
  publishedCatalogGifts: Gift[];
  saveAdvancedGift: (config: AdvancedGiftConfig) => Promise<{ success: boolean; message: string }>;
  deleteAdvancedGift: (giftId: string) => Promise<{ success: boolean; message: string }>;
  migrateUnifiedGiftCatalog: () => Promise<{ success: boolean; message: string }>;
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

  const [unifiedCatalogGifts, setUnifiedCatalogGifts] = useState<UnifiedGiftConfig[]>(() => [
    DEFAULT_ALPHA_MATE_TEST_GIFT_CONFIG,
    ...ALPHA_MATE_10_ANIMATED_GIFTS,
  ]);
  const [catalogSyncStats, setCatalogSyncStats] = useState<UnifiedGiftCatalogSyncStats>(() => {
    const initialCount = 1 + ALPHA_MATE_10_ANIMATED_GIFTS.length;
    return {
      total: initialCount,
      animatedCount: initialCount,
      staticCount: 0,
      publishedCount: initialCount,
      draftOrPausedCount: 0,
      legacyCount: 0,
      unindexedCount: 0,
    };
  });
  const [adminCatalogLoaded, setAdminCatalogLoaded] = useState(false);

  // Backward-compatible aliases derived directly from the single canonical `/gifts` state
  const advancedGifts = unifiedCatalogGifts;
  const adminCatalogGifts = useMemo<Gift[]>(
    () => unifiedCatalogGifts.map(unifiedGiftToGift),
    [unifiedCatalogGifts]
  );

  const publishedCatalogGifts = useMemo<Gift[]>(() => {
    const published = unifiedCatalogGifts
      .filter((cfg) => cfg.status === 'published')
      .map(unifiedGiftToGift);
    if (!adminCatalogLoaded && published.length === 0) {
      const merged = new Map<string, Gift>();
      published.forEach((gift) => merged.set(gift.id, gift));
      VIRTUAL_GIFTS.forEach((gift) => {
        if (!merged.has(gift.id)) merged.set(gift.id, gift);
      });
      return Array.from(merged.values()).sort((a, b) => (a.priority || 50) - (b.priority || 50));
    }
    return published.sort((a, b) => (a.priority || 50) - (b.priority || 50));
  }, [unifiedCatalogGifts, adminCatalogLoaded]);

  const saveAdvancedGift = useCallback(
    async (config: AdvancedGiftConfig): Promise<{ success: boolean; message: string }> => {
      try {
        const saved = await saveUnifiedGiftToFirestore(config);
        setUnifiedCatalogGifts((prev) => {
          const exists = prev.some((g) => g.id === saved.id);
          return exists ? prev.map((g) => (g.id === saved.id ? saved : g)) : [saved, ...prev];
        });
        return {
          success: true,
          message: `Saved "${saved.name}" (${saved.giftKind === 'animated' ? saved.format.toUpperCase() : 'STATIC'} • ${saved.status}) to Unified /gifts Catalog.`,
        };
      } catch (err: any) {
        return {
          success: false,
          message: err?.message || 'Unable to save gift configuration to Firestore.',
        };
      }
    },
    []
  );

  const deleteAdvancedGift = useCallback(
    async (giftId: string): Promise<{ success: boolean; message: string }> => {
      try {
        await deleteUnifiedGiftFromFirestore(giftId);
        setUnifiedCatalogGifts((prev) => prev.filter((g) => g.id !== giftId));
        return { success: true, message: 'Gift removed from Unified /gifts Catalog.' };
      } catch (err: any) {
        return {
          success: false,
          message: err?.message || 'Unable to delete gift configuration.',
        };
      }
    },
    []
  );

  const migrateUnifiedGiftCatalog = useCallback(async (): Promise<{
    success: boolean;
    message: string;
  }> => {
    try {
      const result = await migrateLegacyGiftsToUnifiedCatalog(unifiedCatalogGifts);
      const totalSynced = result.migratedCount + result.normalizedCount;
      if (totalSynced === 0) {
        return {
          success: true,
          message: 'All gifts are already normalized and indexed in the unified /gifts schema (v2).',
        };
      }
      return {
        success: true,
        message: `Unified ${totalSynced} gift${totalSynced === 1 ? '' : 's'} into /gifts schema v2 (${result.migratedCount} migrated from legacy /advancedGifts, ${result.normalizedCount} indexed in-place).`,
      };
    } catch (err: any) {
      return {
        success: false,
        message: err?.message || 'Unable to migrate legacy gifts to unified schema.',
      };
    }
  }, [unifiedCatalogGifts]);

  // Per-scope refresh epochs (trigger targeted re-subscriptions without leaving active rooms/screens)
  const [discoveryRefreshEpoch, setDiscoveryRefreshEpoch] = useState(0);
  const [reelsRefreshEpoch, setReelsRefreshEpoch] = useState(0);
  const [userSyncRefreshEpoch, setUserSyncRefreshEpoch] = useState(0);
  const [chatRefreshEpoch, setChatRefreshEpoch] = useState(0);
  const [leaderboardRefreshEpoch, setLeaderboardRefreshEpoch] = useState(0);
  const [liveRefreshTick, setLiveRefreshTick] = useState(0);
  const [partyRefreshTick, setPartyRefreshTick] = useState(0);
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
  const [deviceMode, setDeviceMode] = useState<'mobile' | 'responsive' | 'admin'>('mobile');
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

  // Subscribe to single canonical `/gifts` Unified Gift Catalog once Firebase Auth is ready & signed in
  useEffect(() => {
    if (firebaseAuthLoading || !firebaseUser?.uid) return;
    const unsubscribeUnified = subscribeToUnifiedGiftCatalog(
      ({ gifts, initialized, stats }) => {
        setUnifiedCatalogGifts(gifts);
        setAdminCatalogLoaded(initialized);
        setCatalogSyncStats(stats);
      },
      (error) => {
        console.warn('Unified gift catalog listener fallback:', error);
      }
    );
    return () => {
      unsubscribeUnified();
    };
  }, [firebaseAuthLoading, firebaseUser?.uid]);

  // Multi-Account (Up to 5 Accounts on Device) & In-App Registration Window State
  const [savedAccounts, setSavedAccounts] = useState<SavedDeviceAccount[]>(() =>
    loadSavedDeviceAccounts()
  );
  const [isAddingAccount, setIsAddingAccount] = useState<boolean>(false);
  const isAddingAccountRef = React.useRef<boolean>(false);
  React.useEffect(() => {
    isAddingAccountRef.current = isAddingAccount;
  }, [isAddingAccount]);
  const [addingAccountReturnUid, setAddingAccountReturnUid] = useState<string | null>(null);
  const [showAccountSwitcherModal, setShowAccountSwitcherModal] = useState<boolean>(false);
  const registeredSwitchTicketUidsRef = React.useRef<Set<string>>(new Set());

  const isProfileRegistrationCompleted = (u?: Partial<User> | null): boolean => {
    if (!u) return false;
    if (u.profileCompleted === true) return true;
    if (u.profileCompleted === false) return false;
    // Legacy accounts created before profileCompleted flag that already set DOB, Gender, or Name/Username timestamps
    return Boolean(
      u.dob ||
        u.gender ||
        typeof u.age === 'number' ||
        u.lastNameChangeDate ||
        u.lastUsernameChangeDate
    );
  };

  const syncAccountToDeviceSlot = useCallback(
    (userObj: User, fbUserOverride?: FirebaseUser | null) => {
      const targetFbUser = fbUserOverride ?? auth.currentUser;
      const uid = String(userObj?.id || targetFbUser?.uid || '').trim();
      if (!uid || uid === 'current_user' || uid.startsWith('user_demo')) return;

      const blob =
        targetFbUser && targetFbUser.uid === uid ? serializeFirebaseUserBlob(targetFbUser) : null;
      const { accounts } = upsertSavedDeviceAccount({
        user: userObj,
        firebaseUserBlob: blob,
      });
      setSavedAccounts(accounts);

      if (
        targetFbUser &&
        targetFbUser.uid === uid &&
        !registeredSwitchTicketUidsRef.current.has(uid)
      ) {
        registeredSwitchTicketUidsRef.current.add(uid);
        const fp = getOrCreateDeviceFingerprint();
        registerCloudDeviceSwitchSession(fp)
          .then((res) => {
            if (res?.success && res.sessionId && res.switchTicket) {
              const next = updateSavedDeviceAccountSessionData(uid, {
                switchSessionId: res.sessionId,
                switchTicket: res.switchTicket,
              });
              setSavedAccounts(next);
            }
          })
          .catch(() => {});
      }
    },
    []
  );

  // Keep stored Firebase refresh/access token blob fresh whenever Firebase rotates tokens
  useEffect(() => {
    const unsubToken = onIdTokenChanged(auth, (fbUser) => {
      if (!fbUser?.uid) return;
      const blob = serializeFirebaseUserBlob(fbUser);
      if (!blob) return;
      const updated = updateSavedDeviceAccountSessionData(fbUser.uid, {
        firebaseUserBlob: blob,
        hasPassword: hasFirebasePasswordProvider(fbUser) ? true : undefined,
        lastActiveAt: new Date().toISOString(),
      });
      setSavedAccounts(updated);
    });
    return () => unsubToken();
  }, []);

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
        void cacheCurrentUserSnippet(user);
      } else {
        localStorage.removeItem('alphamate_current_user');
        localStorage.setItem('alphamate_is_authenticated', 'false');
        void clearCurrentUserSnippet();
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
    const hasPass = hasFirebasePasswordProvider(fbUser);

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
      followersCount: 0,
      followingCount: 0,
      likesCount: 0,
      level: 0,
      xp: 0,
      nextLevelXp: 50000,
      vipTier: 0,
      coins: 0,
      diamonds: 0,
      isVerified: false,
      isAccountVerified: isFirebaseUserVerified(fbUser),
      greenTick: isFirebaseUserVerified(fbUser),
      emailVerified: isFirebaseUserVerified(fbUser),
      hasPassword: hasPass,
      profileCompleted: false,
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
        const providerVerified = isFirebaseUserVerified(fbUser);
        setIsEmailVerified(providerVerified);

        try {
          const remoteProfile = await getUserProfileFromFirestore(fbUser.uid);
          if (!active) return;

          const verified = providerVerified || Boolean(remoteProfile?.emailOtpVerified);
          setIsEmailVerified(verified);

          const hasPass =
            hasFirebasePasswordProvider(fbUser) || Boolean(remoteProfile?.hasPassword);
          const completed = remoteProfile ? isProfileRegistrationCompleted(remoteProfile) : false;
          const resolvedGreenTick = verified || resolveUserGreenTickVerified(remoteProfile, false);

          const mergedUser: User = remoteProfile
            ? {
                ...buildNewUserFromFirebase(fbUser),
                ...remoteProfile,
                id: fbUser.uid,
                email: (fbUser.email || remoteProfile.email || '').toLowerCase(),
                displayName: remoteProfile.displayName || fbUser.displayName || 'Alpha Mate',
                avatar: remoteProfile.avatar || fbUser.photoURL || CURRENT_USER.avatar,
                isVerified: resolveUserBlueTickVerified(remoteProfile, false),
                isAccountVerified: resolvedGreenTick,
                greenTick: resolvedGreenTick,
                emailVerified: verified,
                hasPassword: hasPass,
                profileCompleted: completed,
              }
            : buildNewUserFromFirebase(fbUser, {
                isVerified: false,
                isAccountVerified: verified,
                greenTick: verified,
                emailVerified: verified,
                hasPassword: hasPass,
                profileCompleted: false,
              });

          if (!remoteProfile) {
            await syncUserProfileToFirestore(mergedUser, {
              background: true,
              isNewUserDoc: true,
            }).catch(() => {});
          } else if (
            resolvedGreenTick &&
            (remoteProfile.greenTick !== true || remoteProfile.isAccountVerified !== true)
          ) {
            // Automatically backfill Green Tick on Firestore for already-verified accounts so other users see it too
            syncUserProfileToFirestore(
              {
                id: fbUser.uid,
                username: mergedUser.username,
                displayName: mergedUser.displayName,
                uniqueId: mergedUser.uniqueId,
                avatar: mergedUser.avatar,
                isAccountVerified: true,
                greenTick: true,
                emailVerified: verified,
              },
              { background: true }
            ).catch(() => {});
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
          if (verified && !restricted) {
            setIsAddingAccount(false);
            setAddingAccountReturnUid(null);
            syncAccountToDeviceSlot(mergedUser, fbUser);
          }
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
          const defaults = buildNewUserFromFirebase(fbUser);
          let cachedForSameUid: Partial<User> | null = null;
          try {
            const raw = localStorage.getItem('alphamate_current_user');
            if (raw) {
              const parsed = JSON.parse(raw);
              if (parsed?.id === fbUser.uid) cachedForSameUid = parsed;
            }
            if (!cachedForSameUid) {
              const swSnippet = await getCachedCurrentUserSnippet().catch(() => null);
              if (swSnippet && swSnippet.id === fbUser.uid) {
                cachedForSameUid = {
                  id: swSnippet.id,
                  uniqueId: swSnippet.uniqueId,
                  username: swSnippet.username,
                  displayName: swSnippet.displayName,
                  avatar: swSnippet.avatar,
                  bio: swSnippet.bio,
                  vipTier: swSnippet.vipTier,
                  level: swSnippet.level,
                  followersCount: swSnippet.followersCount,
                  followingCount: swSnippet.followingCount,
                  likesCount: swSnippet.likesCount,
                  isVerified: swSnippet.isVerified,
                  isAccountVerified: swSnippet.isAccountVerified,
                  greenTick: swSnippet.isAccountVerified,
                  isHost: swSnippet.isHost,
                  country: swSnippet.country,
                  countryFlag: swSnippet.countryFlag,
                  activeFrame: swSnippet.activeFrame,
                  activeHonorTitle: swSnippet.activeHonorTitle,
                  familyCrew: swSnippet.familyCrew,
                  equippedBadgeIds: swSnippet.equippedBadgeIds,
                };
              }
            }
            if (!cachedForSameUid) {
              const savedMatch = loadSavedDeviceAccounts().find((a) => a.uid === fbUser.uid);
              if (savedMatch) {
                cachedForSameUid = {
                  id: savedMatch.uid,
                  uniqueId: savedMatch.uniqueId,
                  username: savedMatch.username,
                  displayName: savedMatch.displayName,
                  email: savedMatch.email,
                  avatar: savedMatch.avatar,
                  vipTier: savedMatch.vipTier,
                  level: savedMatch.level,
                  hasPassword: savedMatch.hasPassword,
                  profileCompleted: savedMatch.profileCompleted,
                };
              }
            }
          } catch {
            // ignore
          }
          const verified = providerVerified || Boolean(cachedForSameUid?.emailOtpVerified);
          setIsEmailVerified(verified);
          const fallbackGreenTick =
            verified || resolveUserGreenTickVerified(cachedForSameUid as Record<string, any>, false);
          const fallbackUser: User = cachedForSameUid
            ? {
                ...defaults,
                ...cachedForSameUid,
                id: fbUser.uid,
                isVerified: resolveUserBlueTickVerified(cachedForSameUid as Record<string, any>, false),
                isAccountVerified: fallbackGreenTick,
                greenTick: fallbackGreenTick,
                emailVerified: verified,
                hasPassword:
                  hasFirebasePasswordProvider(fbUser) || Boolean(cachedForSameUid.hasPassword),
                profileCompleted: isProfileRegistrationCompleted(cachedForSameUid),
              }
            : defaults;
          if (verified) {
            setIsAddingAccount(false);
            setAddingAccountReturnUid(null);
            syncAccountToDeviceSlot(fallbackUser, fbUser);
          }
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
        if (!isAddingAccountRef.current) {
          setCurrentUser(CURRENT_USER);
        }
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
  }, [syncAccountToDeviceSlot]);

  const removedPartyUntilRef = React.useRef<Map<string, number>>(new Map());
  const removedLiveUntilRef = React.useRef<Map<string, number>>(new Map());
  const activeStreamIdRef = React.useRef<string | null>(null);
  const seatMutationInFlightRef = React.useRef<Set<string>>(new Set());

  // Real-time Firestore + WebSocket discovery listeners (rebinds automatically on auth transitions)
  useEffect(() => {
    if (firebaseAuthLoading) return;
    let firestoreRooms: PartyRoom[] = [];
    let firestoreStreams: LiveStream[] = [];
    const wsPartyMap = new Map<string, PartyRoom & { _localReceivedAtMs?: number }>();
    const wsLiveMap = new Map<string, LiveStream & { _localReceivedAtMs?: number }>();
    const removedPartyUntil = removedPartyUntilRef.current;
    const removedLiveUntil = removedLiveUntilRef.current;
    const myUid = firebaseUser?.uid || '';

    const normalizePartyItem = (r: any): PartyRoom | null => {
      if (!r?.id || isLegacyErrorCardId(String(r.id)) || r.isActive === false) return null;
      const hostId = String(r.host?.id || '').trim();
      if (!hostId) return null;
      const { _localReceivedAtMs, ...clean } = r;
      return {
        ...clean,
        seats: Array.isArray(clean.seats) ? clean.seats : [],
        activeViewers:
          typeof clean.activeViewers === 'number' && Number.isFinite(clean.activeViewers)
            ? Math.max(0, Math.floor(clean.activeViewers))
            : 0,
        isHostPresent: clean.isHostPresent !== false,
      };
    };

    const normalizeLiveItem = (s: any): LiveStream | null => {
      if (!s?.id || isLegacyErrorCardId(String(s.id)) || s.isActive === false || !s.sfuSessionId) {
        return null;
      }
      const hostId = String(s.host?.id || '').trim();
      if (!hostId) return null;
      const { _localReceivedAtMs, ...clean } = s;
      return clean;
    };

    const mergeAndPublishRooms = () => {
      const now = Date.now();
      const byId = new Map<string, PartyRoom>();

      firestoreRooms.forEach((raw) => {
        const r = normalizePartyItem(raw);
        if (!r) return;
        const removedAt = removedPartyUntil.get(r.id);
        if (removedAt && now - removedAt < 25_000) return;
        byId.set(r.id, r);
      });

      wsPartyMap.forEach((raw, id) => {
        const removedAt = removedPartyUntil.get(id);
        if (removedAt && now - removedAt < 25_000) return;
        const existing = byId.get(id);
        const rawTs = Number(raw.lastSeenAtMs || 0);
        const existingTs = Number(existing?.lastSeenAtMs || 0);
        // Firestore is the single authoritative source of truth for seats & moderation state.
        // WebSocket discovery may supplement ephemeral presence fields (activeViewers, isHostPresent),
        // but MUST NEVER overwrite existing Firestore seats with potentially stale WS state.
        const mergedCandidate = existing
          ? {
              ...raw,
              ...existing,
              activeViewers:
                rawTs >= existingTs && typeof raw.activeViewers === 'number'
                  ? raw.activeViewers
                  : existing.activeViewers,
              isHostPresent:
                rawTs >= existingTs && typeof raw.isHostPresent === 'boolean'
                  ? raw.isHostPresent
                  : existing.isHostPresent,
              lastSeenAtMs: existingTs,
            }
          : raw;
        const r = normalizePartyItem(mergedCandidate);
        if (!r) return;
        byId.set(id, r);
      });

      // Strictly 1 active Party Room card per host
      const byHost = new Map<string, PartyRoom>();
      byId.forEach((room) => {
        const hostId = room.host.id;
        const prev = byHost.get(hostId);
        if (!prev) {
          byHost.set(hostId, room);
          return;
        }
        const canonicalId = getCanonicalPartyRoomId(hostId);
        const preferIncoming =
          room.id === canonicalId ||
          (prev.id !== canonicalId &&
            Number(room.lastSeenAtMs || 0) >= Number(prev.lastSeenAtMs || 0));
        if (preferIncoming) {
          byHost.set(hostId, room);
        }
      });

      const nextRooms = Array.from(byHost.values());
      setPartyRooms(nextRooms);
      setActivePartyRoom((currentActive) => {
        if (!currentActive) return null;
        const fresh =
          nextRooms.find((r) => r.id === currentActive.id) ||
          nextRooms.find((r) => r.host?.id && r.host.id === currentActive.host?.id);
        if (!fresh) return currentActive;
        const currentTs = Number(currentActive.lastSeenAtMs || 0);
        const freshTs = Number(fresh.lastSeenAtMs || 0);
        if (seatMutationInFlightRef.current.has(currentActive.id) || freshTs < currentTs) {
          return {
            ...currentActive,
            ...fresh,
            seats: currentActive.seats,
            lastSeenAtMs: Math.max(currentTs, freshTs),
          };
        }
        return { ...currentActive, ...fresh };
      });
    };

    const mergeAndPublishStreams = () => {
      const now = Date.now();
      const byId = new Map<string, LiveStream>();

      firestoreStreams.forEach((raw) => {
        const s = normalizeLiveItem(raw);
        if (!s) return;
        const removedAt = removedLiveUntil.get(s.id);
        if (removedAt && now - removedAt < 25_000) return;
        byId.set(s.id, s);
      });

      wsLiveMap.forEach((raw, id) => {
        const removedAt = removedLiveUntil.get(id);
        if (removedAt && now - removedAt < 25_000) return;
        const existing = byId.get(id);
        const mergedCandidate = existing ? { ...existing, ...raw } : raw;
        const s = normalizeLiveItem(mergedCandidate);
        if (!s) return;
        byId.set(id, s);
      });

      // Strictly 1 active Solo Live card per host
      const byHost = new Map<string, LiveStream>();
      byId.forEach((stream) => {
        const hostId = stream.host.id;
        const prev = byHost.get(hostId);
        if (!prev) {
          byHost.set(hostId, stream);
          return;
        }
        if (Number(stream.lastSeenAtMs || 0) >= Number(prev.lastSeenAtMs || 0)) {
          byHost.set(hostId, stream);
        }
      });

      setLiveStreams(Array.from(byHost.values()));
    };

    if (myUid) {
      realtimeSocket.ensureConnected();
      purgeStaleHostCardsInFirestore(myUid, {
        keepPartyId: getCanonicalPartyRoomId(myUid),
        keepLiveId: activeStreamIdRef.current,
      }).catch(() => {});
    } else {
      realtimeSocket.disconnect();
    }

    const unsubscribeWs = realtimeSocket.onDiscoveryUpdate((event) => {
      const localNow = Date.now();
      if (event.type === 'discovery:snapshot') {
        wsLiveMap.clear();
        wsPartyMap.clear();
        event.liveStreams.forEach((s) => {
          if (!s?.id) return;
          const hostId = String(s.host?.id || '').trim();
          // Auto-purge our own stale/legacy Solo Live cards from live server memory
          if (myUid && hostId === myUid && (isLegacyErrorCardId(s.id) || activeStreamIdRef.current !== s.id)) {
            realtimeSocket.removeLiveStream(s.id);
            return;
          }
          if (!isLegacyErrorCardId(s.id) && s.isActive !== false && s.sfuSessionId) {
            wsLiveMap.set(s.id, { ...s, _localReceivedAtMs: localNow });
          }
        });
        event.partyRooms.forEach((r) => {
          if (!r?.id) return;
          const hostId = String(r.host?.id || '').trim();
          const canonicalPartyId = myUid ? getCanonicalPartyRoomId(myUid) : '';
          // Auto-purge our own legacy/duplicate Party Room cards from live server memory
          if (myUid && hostId === myUid && (isLegacyErrorCardId(r.id) || r.id !== canonicalPartyId)) {
            realtimeSocket.removePartyRoom(r.id);
            return;
          }
          if (!isLegacyErrorCardId(r.id) && r.isActive !== false) {
            wsPartyMap.set(r.id, { ...r, _localReceivedAtMs: localNow });
          }
        });
        mergeAndPublishStreams();
        mergeAndPublishRooms();
      } else if (event.type === 'live:upsert' && event.stream?.id) {
        const s = event.stream;
        if (isLegacyErrorCardId(s.id) || s.isActive === false || !s.sfuSessionId) {
          wsLiveMap.delete(s.id);
          mergeAndPublishStreams();
          return;
        }
        // Evict any earlier stream ID for the same host in wsLiveMap
        const hostId = String(s.host?.id || '').trim();
        if (hostId) {
          for (const [existingId, item] of Array.from(wsLiveMap.entries())) {
            if (existingId !== s.id && item.host?.id === hostId) {
              wsLiveMap.delete(existingId);
            }
          }
        }
        removedLiveUntil.delete(s.id);
        wsLiveMap.set(s.id, { ...s, _localReceivedAtMs: localNow });
        mergeAndPublishStreams();
      } else if (event.type === 'live:remove' && event.streamId) {
        wsLiveMap.delete(event.streamId);
        removedLiveUntil.set(event.streamId, localNow);
        mergeAndPublishStreams();
      } else if (event.type === 'party:upsert' && event.room?.id) {
        const r = event.room;
        if (isLegacyErrorCardId(r.id) || r.isActive === false) {
          wsPartyMap.delete(r.id);
          mergeAndPublishRooms();
          return;
        }
        const hostId = String(r.host?.id || '').trim();
        if (hostId) {
          for (const [existingId, item] of Array.from(wsPartyMap.entries())) {
            if (existingId !== r.id && item.host?.id === hostId) {
              wsPartyMap.delete(existingId);
            }
          }
        }
        removedPartyUntil.delete(r.id);
        const existingWs = wsPartyMap.get(r.id);
        wsPartyMap.set(r.id, { ...(existingWs || {}), ...r, _localReceivedAtMs: localNow });
        mergeAndPublishRooms();
      } else if (event.type === 'party:remove' && event.roomId) {
        wsPartyMap.delete(event.roomId);
        removedPartyUntil.set(event.roomId, localNow);
        mergeAndPublishRooms();
      }
    });

    const unsubscribeRooms = subscribeToPartyRooms((remoteRooms) => {
      firestoreRooms = Array.isArray(remoteRooms) ? remoteRooms : [];
      const activeIds = new Set(firestoreRooms.map((r) => r.id));
      const localNow = Date.now();
      for (const id of Array.from(wsPartyMap.keys())) {
        if (!activeIds.has(id) && !isFirestoreQuotaExceeded()) {
          const item = wsPartyMap.get(id);
          if (item?._localReceivedAtMs && localNow - item._localReceivedAtMs > 90_000) {
            wsPartyMap.delete(id);
          }
        }
      }
      mergeAndPublishRooms();
    });

    const unsubscribeLiveStreams = subscribeToLiveStreams((remoteStreams) => {
      firestoreStreams = Array.isArray(remoteStreams) ? remoteStreams : [];
      const activeIds = new Set(firestoreStreams.map((s) => s.id));
      const localNow = Date.now();
      for (const id of Array.from(wsLiveMap.keys())) {
        if (!activeIds.has(id) && !isFirestoreQuotaExceeded()) {
          const item = wsLiveMap.get(id);
          if (item?._localReceivedAtMs && localNow - item._localReceivedAtMs > 90_000) {
            wsLiveMap.delete(id);
          }
        }
      }
      mergeAndPublishStreams();
    });

    return () => {
      unsubscribeWs();
      unsubscribeRooms();
      unsubscribeLiveStreams();
    };
  }, [firebaseAuthLoading, firebaseUser?.uid, discoveryRefreshEpoch]);

  // Real-time Firestore Reels & Cloudflare R2 Feed Subscription (screen-scoped: active on Moments/Upload/Admin, disposed on exit)
  const shouldSubscribeReels =
    deviceMode === 'admin' ||
    currentScreen === 'moments' ||
    currentScreen === 'upload' ||
    currentScreen === 'admin_dashboard';
  useEffect(() => {
    if (firebaseAuthLoading || !shouldSubscribeReels) return;
    const uidKey = firebaseUser?.uid || 'guest';
    const readLikedSet = (): Set<string> => {
      try {
        const raw = window.localStorage.getItem(`alphamate_liked_reels_${uidKey}`);
        const parsed = raw ? JSON.parse(raw) : [];
        return new Set(Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : []);
      } catch {
        return new Set();
      }
    };

    const unsubscribeReels = subscribeToActiveReels((remoteReels: Reel[]) => {
      if (remoteReels && remoteReels.length > 0) {
        const likedSet = readLikedSet();
        setVideos((prevLocal) => {
          const prevLikedById = new Map<string, boolean>();
          prevLocal.forEach((p) => {
            if (p.isLiked) prevLikedById.set(p.id, true);
          });

          const remotePosts: VideoPost[] = remoteReels.map((reel) => ({
            id: reel.id,
            user: {
              id: reel.creator?.id || reel.uid,
              uniqueId: reel.creator?.uniqueId || reel.uid.slice(0, 8),
              username: reel.creator?.username || 'creator',
              displayName: reel.creator?.displayName || 'Alpha Creator',
              avatar: reel.creator?.avatar || DEFAULT_AVATAR_URL,
              bio: '',
              followersCount: 0,
              followingCount: 0,
              likesCount: reel.likesCount || 0,
              level: Number(reel.creator?.level ?? 0),
              xp: 0,
              nextLevelXp: 50000,
              vipTier: Number(reel.creator?.vipTier ?? 0),
              coins: 0,
              diamonds: 0,
              isVerified: !!reel.creator?.isVerified,
              isAccountVerified: !!reel.creator?.isAccountVerified,
              greenTick: !!reel.creator?.isAccountVerified,
            },
            videoUrl: reel.videoUrl,
            videoKey: reel.videoKey,
            thumbnail: reel.thumbnailUrl || reel.creator?.avatar || DEFAULT_AVATAR_URL,
            title: reel.title || reel.caption || 'Alpha Moment',
            description: reel.caption || '',
            tags: reel.tags || ['#AlphaMoments'],
            likes: Math.max(0, reel.likesCount || 0),
            commentsCount: Math.max(0, reel.commentsCount || 0),
            sharesCount: Math.max(0, reel.sharesCount || 0),
            viewsCount: Math.max(0, reel.viewsCount || 0),
            musicTitle: reel.musicTitle,
            musicArtist: reel.musicArtist,
            isLiked: likedSet.has(reel.id) || prevLikedById.get(reel.id) === true,
            feedCategory: 'For You',
            timestamp: reel.createdAt ? new Date(reel.createdAt).toLocaleDateString() : 'Just now',
            postType: 'video',
          }));

          const remoteIds = new Set(remotePosts.map((r) => r.id));
          const remoteUrls = new Set(remotePosts.map((r) => r.videoUrl).filter(Boolean));
          const localOnly = prevLocal.filter(
            (p) => !remoteIds.has(p.id) && !p.videoKey && (!p.videoUrl || !remoteUrls.has(p.videoUrl))
          );
          return [...remotePosts, ...localOnly];
        });
      }
    });

    return () => {
      unsubscribeReels();
    };
  }, [firebaseAuthLoading, firebaseUser?.uid, reelsRefreshEpoch, shouldSubscribeReels]);

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

  // Prune leaderboard records older than 1 previous month & subscribe ONLY when Leaderboard modal or Admin is open
  // (Eliminates 200 eager Firestore reads on every cold app startup)
  const shouldSubscribeLeaderboard =
    showLeaderboardModal || deviceMode === 'admin' || currentScreen === 'admin_dashboard';
  useEffect(() => {
    pruneExpiredLocalLeaderboardMonths(leaderboardMonthKey, leaderboardPreviousMonthKey);
    setLocalLeaderboardOverrides(loadLocalLeaderboardOverrides(leaderboardMonthKey));

    if (!firebaseUser?.uid || !isEmailVerified) {
      setFirestoreLeaderboardEntries([]);
      return;
    }
    if (!shouldSubscribeLeaderboard) return;

    const unsub = subscribeToMonthlyLeaderboard(
      leaderboardMonthKey,
      (entries) => {
        setFirestoreLeaderboardEntries(entries);
      },
      120
    );
    return () => {
      unsub();
    };
  }, [
    firebaseUser?.uid,
    isEmailVerified,
    leaderboardMonthKey,
    leaderboardPreviousMonthKey,
    leaderboardRefreshEpoch,
    shouldSubscribeLeaderboard,
  ]);

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

    const flushPendingTime = () => {
      if (isFirestoreQuotaExceeded()) return;
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

      if (pendingTimeSyncMinsRef.current >= 10) {
        flushPendingTime();
      }
    }, 60_000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && pendingTimeSyncMinsRef.current >= 3) {
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
  useEffect(() => {
    activeStreamIdRef.current = activeStream?.id || null;
  }, [activeStream?.id]);
  const [activePKBattle, setActivePKBattle] = useState<LiveStream | null>(null);
  const [pkScores, setPkScores] = useState<{ left: number; right: number }>({ left: 3420, right: 2890 });
  const [activeGiftBanner, setActiveGiftBanner] = useState<{
    id: string;
    gift: Gift;
    quantity: number;
    sender: string;
    senderAvatar?: string;
    senderVipTier?: number;
    recipient: string;
    context: 'live' | 'party' | 'pk';
    streamId?: string;
    roomId?: string;
    createdAtMs: number;
  } | null>(null);

  // Guaranteed auto-expiry for activeGiftBanner so stale banners never linger across broadcasts or rooms
  useEffect(() => {
    if (!activeGiftBanner) return;
    const coinsCost = Number(activeGiftBanner.gift.costInCoins ?? activeGiftBanner.gift.coins) || 10;
    const advDurationMs = activeGiftBanner.gift.advancedConfig?.durationMs;
    const ttlMs = advDurationMs
      ? Math.min(65_000, advDurationMs + 2000)
      : coinsCost <= 100
      ? 2000
      : 7500;
    const bannerId = activeGiftBanner.id;
    const timer = setTimeout(() => {
      setActiveGiftBanner((prev) => (prev?.id === bannerId ? null : prev));
    }, ttlMs);
    return () => clearTimeout(timer);
  }, [activeGiftBanner?.id]);

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
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
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

  // Admin Moderation & Action Notification User-Side State
  const [moderationClockMs, setModerationClockMs] = useState<number>(() => Date.now());
  const [activeAdminWarning, setActiveAdminWarning] = useState<NotificationItem | null>(null);
  const [selectedAdminNotification, setSelectedAdminNotification] = useState<NotificationItem | null>(null);
  const [activeFeatureRestrictionModal, setActiveFeatureRestrictionModal] = useState<{
    scope: 'live' | 'party';
    detail: AdminRestrictionDetail;
  } | null>(null);
  const primaryNotifsRef = React.useRef<NotificationItem[]>([]);
  const adminActionNotifsRef = React.useRef<NotificationItem[]>([]);
  const transitionNotifsRef = React.useRef<NotificationItem[]>([]);
  const dismissedWarningIdsRef = React.useRef<Set<string>>(new Set());
  const prevModerationStateRef = React.useRef<{ uid: string; state: AdminModerationState } | null>(null);

  const adminModerationState = useMemo<AdminModerationState>(
    () => parseAdminModerationState(currentUser, moderationClockMs),
    [currentUser, moderationClockMs]
  );

  const publishMergedNotifications = useCallback(() => {
    setNotifications((prev) => {
      const localOnly = prev.filter(
        (p) =>
          p.id.startsWith('local_notif_') &&
          p.sourceCollection !== 'profile_transition'
      );
      return mergeAndDeduplicateNotifications([
        primaryNotifsRef.current,
        adminActionNotifsRef.current,
        transitionNotifsRef.current,
        localOnly,
      ]);
    });
  }, []);

  // Automatically restore temporary suspensions (Account / Live / Party) the moment expiry passes
  useEffect(() => {
    const nextExpiry = adminModerationState.nextExpiryMs;
    if (!nextExpiry) return;
    const delayMs = Math.min(Math.max(1000, nextExpiry - Date.now() + 300), 60000);
    const timer = setTimeout(() => {
      setModerationClockMs(Date.now());
    }, delayMs);
    return () => clearTimeout(timer);
  }, [adminModerationState.nextExpiryMs, moderationClockMs]);

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
  const hasHydratedRemoteBadgesRef = React.useRef<boolean>(false);
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
    hasHydratedRemoteBadgesRef.current = false;
    try {
      lastSyncedBadgeSigRef.current =
        localStorage.getItem(`alphamate_badge_synced_sig_${activeBadgeUid}`) || '';
    } catch {
      lastSyncedBadgeSigRef.current = '';
    }
    setRawBadgeStats(loadLocalUserBadgeStats(activeBadgeUid));

    if (!firebaseUser?.uid || !isEmailVerified) return;

    const unsubBadges = subscribeToUserBadgeStats(firebaseUser.uid, (remote) => {
      hasHydratedRemoteBadgesRef.current = true;
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
    const minuteBucket = Math.floor((nextStats.totalActiveMinutes || 0) / 10);
    const sig = [
      nextStats.uid,
      nextStats.totalGiftCoinsSent,
      nextStats.totalGiftsSentCount,
      nextStats.totalGiftCoinsReceived,
      nextStats.totalDiamondsEarned,
      minuteBucket,
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
      hasHydratedRemoteBadgesRef.current &&
      firebaseUser?.uid === nextStats.uid &&
      isEmailVerified &&
      !isFirestoreQuotaExceeded() &&
      sig !== lastSyncedBadgeSigRef.current
    ) {
      lastSyncedBadgeSigRef.current = sig;
      syncUserBadgeStatsToFirestore(nextStats)
        .then((synced) => {
          if (synced) {
            try {
              localStorage.setItem(`alphamate_badge_synced_sig_${nextStats.uid}`, sig);
            } catch {
              // ignore storage errors
            }
          }
        })
        .catch(() => {});
      if (prevEquippedJoined !== nextEquippedJoined) {
        syncUserProfileToFirestore(
          {
            ...currentUserRef.current,
            id: firebaseUser.uid,
            equippedBadgeIds: nextStats.equippedBadgeIds,
          },
          { background: true }
        ).catch(() => {});
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

    if (firebaseUser?.uid && isEmailVerified && !isFirestoreQuotaExceeded()) {
      syncUserBadgeStatsToFirestore(updatedStats).catch(() => {});
      syncUserProfileToFirestore(
        {
          ...currentUserRef.current,
          id: firebaseUser.uid,
          equippedBadgeIds: updatedEquipped,
        },
        { background: true }
      ).catch(() => {});
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

  // Real-time User Profile, Admin Moderation, Notifications & 60/40 Gift Ledger Subscriptions
  useEffect(() => {
    if (!firebaseUser?.uid || !isEmailVerified) {
      seenNotificationIdsRef.current.clear();
      notificationBootedRef.current = false;
      primaryNotifsRef.current = [];
      adminActionNotifsRef.current = [];
      transitionNotifsRef.current = [];
      dismissedWarningIdsRef.current.clear();
      prevModerationStateRef.current = null;
      setNotifications([]);
      setActiveAdminWarning(null);
      setSelectedAdminNotification(null);
      setActiveFeatureRestrictionModal(null);
      return;
    }

    const uid = firebaseUser.uid;
    const isAdmin = firebaseUser.email?.toLowerCase() === 'alphamateapp@gmail.com';
    const sessionStartedAt = Date.now();
    primaryNotifsRef.current = [];
    adminActionNotifsRef.current = [];
    transitionNotifsRef.current = [];
    seenNotificationIdsRef.current.clear();
    notificationBootedRef.current = false;
    dismissedWarningIdsRef.current.clear();
    setNotifications([]);
    setActiveAdminWarning(null);

    const dispatchIncomingAlert = (n: NotificationItem, isBoot: boolean) => {
      if (seenNotificationIdsRef.current.has(n.id)) return;
      seenNotificationIdsRef.current.add(n.id);

      // Surface unread Official Admin Warnings immediately so the user can read and acknowledge them
      if (
        !n.isRead &&
        (n.actionKind === 'admin_warning' || n.type === 'admin_warning') &&
        !dismissedWarningIdsRef.current.has(n.id)
      ) {
        setActiveAdminWarning((prev) => {
          if (prev && (prev.createdAtMs || 0) >= (n.createdAtMs || 0)) return prev;
          return n;
        });
      }

      if (isBoot) return;
      const createdMs = n.createdAtMs || 0;
      if (!n.isRead && createdMs >= sessionStartedAt - 30000) {
        pushService.notifyForeground(
          {
            id: n.id,
            title: n.actionTitle || n.title,
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
              isAdminAction: n.isAdminAction,
              notificationId: n.id,
            },
          },
          Boolean(n.isAdminAction)
        );
      }
    };

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

      setCurrentUser((prev) => {
        const resolvedBlueTick = resolveUserBlueTickVerified(remoteProfile, prev.isVerified);
        const resolvedGreenTick = resolveUserGreenTickVerified(
          remoteProfile,
          Boolean(prev.isAccountVerified || prev.greenTick || isEmailVerified)
        );
        const updatedUser: User = {
          ...prev,
          coins: typeof remoteProfile.coins === 'number' ? remoteProfile.coins : prev.coins,
          diamonds: typeof remoteProfile.diamonds === 'number' ? remoteProfile.diamonds : prev.diamonds,
          heldDiamonds: typeof remoteProfile.heldDiamonds === 'number' ? remoteProfile.heldDiamonds : prev.heldDiamonds,
          notificationPreferences: remoteProfile.notificationPreferences || prev.notificationPreferences,
          equippedBadgeIds: Array.isArray(remoteProfile.equippedBadgeIds)
            ? remoteProfile.equippedBadgeIds
            : prev.equippedBadgeIds,
          // Sync Blue Tick (Admin Respect Badge) & Green Tick (Auto Account Verification) immediately
          isVerified: resolvedBlueTick,
          isAccountVerified: resolvedGreenTick,
          greenTick: resolvedGreenTick,
          emailOtpVerified:
            typeof remoteProfile.emailOtpVerified === 'boolean'
              ? remoteProfile.emailOtpVerified
              : prev.emailOtpVerified,
          blueTick: remoteProfile.blueTick,
          hasBlueTick: remoteProfile.hasBlueTick,
          verificationStatus: remoteProfile.verificationStatus,
          verificationUpdatedAt: remoteProfile.verificationUpdatedAt,
          verificationReason: remoteProfile.verificationReason,
          // Sync all Admin moderation & restriction fields in real time
          accountStatus: remoteProfile.accountStatus ?? prev.accountStatus,
          isBlocked: remoteProfile.isBlocked,
          blocked: remoteProfile.blocked,
          isBanned: remoteProfile.isBanned,
          banned: remoteProfile.banned,
          blockReason: remoteProfile.blockReason,
          blockedAt: remoteProfile.blockedAt,
          blockedBy: remoteProfile.blockedBy,
          isSuspended: remoteProfile.isSuspended,
          suspended: remoteProfile.suspended,
          suspensionReason: remoteProfile.suspensionReason,
          suspensionDuration: remoteProfile.suspensionDuration,
          suspendedAt: remoteProfile.suspendedAt,
          suspendedUntil: remoteProfile.suspendedUntil,
          suspensionExpiresAt: remoteProfile.suspensionExpiresAt,
          isPermanentSuspension: remoteProfile.isPermanentSuspension,
          liveDisabled: remoteProfile.liveDisabled,
          liveSuspended: remoteProfile.liveSuspended,
          liveRestricted: remoteProfile.liveRestricted,
          liveAccess: remoteProfile.liveAccess,
          canGoLive: remoteProfile.canGoLive,
          liveRestrictionReason: remoteProfile.liveRestrictionReason,
          liveSuspendedUntil: remoteProfile.liveSuspendedUntil,
          partyDisabled: remoteProfile.partyDisabled,
          partySuspended: remoteProfile.partySuspended,
          partyRestricted: remoteProfile.partyRestricted,
          partyAccess: remoteProfile.partyAccess,
          canJoinParty: remoteProfile.canJoinParty,
          canCreateParty: remoteProfile.canCreateParty,
          partyRestrictionReason: remoteProfile.partyRestrictionReason,
          partySuspendedUntil: remoteProfile.partySuspendedUntil,
          moderation: remoteProfile.moderation ?? null,
          restrictions: remoteProfile.restrictions ?? null,
          latestWarning: remoteProfile.latestWarning ?? null,
          warnings: Array.isArray(remoteProfile.warnings) ? remoteProfile.warnings : undefined,
          lastAdminAction: remoteProfile.lastAdminAction ?? null,
          // Sync Super Admin-managed Host Agency membership fields in real time
          agencyId:
            typeof remoteProfile.agencyId === 'string' && remoteProfile.agencyId.trim()
              ? remoteProfile.agencyId.trim()
              : typeof remoteProfile.hostAgencyId === 'string' && remoteProfile.hostAgencyId.trim()
              ? remoteProfile.hostAgencyId.trim()
              : undefined,
          agencyName:
            typeof remoteProfile.agencyName === 'string' && remoteProfile.agencyName.trim()
              ? remoteProfile.agencyName.trim()
              : typeof remoteProfile.hostAgencyName === 'string' && remoteProfile.hostAgencyName.trim()
              ? remoteProfile.hostAgencyName.trim()
              : undefined,
          agencyCode:
            typeof remoteProfile.agencyCode === 'string' && remoteProfile.agencyCode.trim()
              ? remoteProfile.agencyCode.trim()
              : typeof remoteProfile.hostAgencyCode === 'string' && remoteProfile.hostAgencyCode.trim()
              ? remoteProfile.hostAgencyCode.trim()
              : undefined,
          agencyTag:
            typeof remoteProfile.agencyTag === 'string' && remoteProfile.agencyTag.trim()
              ? remoteProfile.agencyTag.trim()
              : typeof remoteProfile.hostAgencyTag === 'string' && remoteProfile.hostAgencyTag.trim()
              ? remoteProfile.hostAgencyTag.trim()
              : undefined,
          hostAgencyStatus:
            typeof remoteProfile.hostAgencyStatus === 'string' && remoteProfile.hostAgencyStatus.trim()
              ? remoteProfile.hostAgencyStatus.trim()
              : undefined,
          agencyOwnerId:
            typeof remoteProfile.agencyOwnerId === 'string' && remoteProfile.agencyOwnerId.trim()
              ? remoteProfile.agencyOwnerId.trim()
              : undefined,
          agencyOwnerName:
            typeof remoteProfile.agencyOwnerName === 'string' && remoteProfile.agencyOwnerName.trim()
              ? remoteProfile.agencyOwnerName.trim()
              : undefined,
          agencyJoinedAt:
            typeof remoteProfile.agencyJoinedAt === 'string' && remoteProfile.agencyJoinedAt.trim()
              ? remoteProfile.agencyJoinedAt.trim()
              : undefined,
          isAgencyHost:
            typeof remoteProfile.isAgencyHost === 'boolean'
              ? remoteProfile.isAgencyHost
              : Boolean(remoteProfile.agencyId || remoteProfile.hostAgencyId),
        };
        void cacheCurrentUserSnippet(updatedUser);
        return updatedUser;
      });
    });

    const unsubNotifs = subscribeToUserNotifications(uid, (remoteItems) => {
      const typedItems = (remoteItems as NotificationItem[]).filter(
        (item) => !item.recipientId || item.recipientId === uid
      );
      primaryNotifsRef.current = typedItems;
      publishMergedNotifications();

      const isBoot = !notificationBootedRef.current;
      if (isBoot) {
        notificationBootedRef.current = true;
      }
      typedItems.forEach((n) => dispatchIncomingAlert(n, isBoot));
    });

    let disposed = false;
    const secondaryUnsubs: Array<() => void> = [];

    const secondaryTimer = window.setTimeout(() => {
      if (disposed) return;

      secondaryUnsubs.push(
        subscribeToUserAdminActionCollections(uid, (adminItems) => {
          const scopedItems = adminItems.filter(
            (item) => !item.recipientId || item.recipientId === uid
          );
          adminActionNotifsRef.current = scopedItems;
          publishMergedNotifications();

          scopedItems.forEach((n) => dispatchIncomingAlert(n, !notificationBootedRef.current));
        })
      );

      secondaryUnsubs.push(
        subscribeToMyFollowEdges(uid, (edges) => {
          setFollowingUserIds(edges.followingIds);
          setFollowerUserIds(edges.followerIds);
        })
      );
    }, 300);

    return () => {
      disposed = true;
      window.clearTimeout(secondaryTimer);
      unsubProfile();
      unsubNotifs();
      secondaryUnsubs.forEach((u) => {
        try {
          u();
        } catch {
          // ignore cleanup errors
        }
      });
    };
  }, [firebaseUser?.uid, firebaseUser?.email, isEmailVerified, userSyncRefreshEpoch, publishMergedNotifications]);

  // Screen-scoped Firestore Listeners: subscribe ONLY when user opens Wallet/Agency/Directory/Admin
  // and cleanly dispose on screen exit to slash idle Firestore document reads & mobile data usage.
  const shouldSubscribeUserDirectory =
    deviceMode === 'admin' ||
    currentScreen === 'search' ||
    currentScreen === 'chat' ||
    currentScreen === 'chat_conversation' ||
    currentScreen === 'admin_dashboard' ||
    currentScreen === 'agency_management' ||
    currentScreen === 'party_room' ||
    currentScreen === 'live_stream' ||
    currentScreen === 'pk_battle' ||
    currentScreen === 'profile';

  useEffect(() => {
    if (!firebaseUser?.uid || !isEmailVerified || !shouldSubscribeUserDirectory) return;
    return subscribeToRealUsers(
      (usersList) => {
        setRealUsers(usersList);
        setRegisteredUsers(usersList);
      },
      undefined,
      { maxUsers: 80, forceRefresh: userSyncRefreshEpoch > 0 }
    );
  }, [firebaseUser?.uid, isEmailVerified, shouldSubscribeUserDirectory, userSyncRefreshEpoch]);

  const shouldSubscribeFinancialLedgers =
    deviceMode === 'admin' ||
    currentScreen === 'wallet' ||
    currentScreen === 'profile' ||
    currentScreen === 'store' ||
    currentScreen === 'levels' ||
    currentScreen === 'agency_management' ||
    currentScreen === 'admin_dashboard';

  useEffect(() => {
    const uid = firebaseUser?.uid;
    if (!uid || !isEmailVerified || !shouldSubscribeFinancialLedgers) return;
    const isAdmin = (firebaseUser?.email || '').toLowerCase() === 'alphamateapp@gmail.com';

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

    const unsubWallet = subscribeToUserWalletTransactions(uid, (remoteWalletTxs) => {
      const normalized: WalletTransaction[] = remoteWalletTxs.map((tx: any) => {
        const ms = Number(tx.createdAtMs) || Date.now();
        const dateLabel = new Date(ms).toLocaleString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
        return {
          id: String(tx.id),
          type: (tx.type || 'recharge') as WalletTransaction['type'],
          amount: Number(tx.amount) || 0,
          currency: tx.currency === 'diamonds' ? 'diamonds' : 'coins',
          walletType: tx.walletType === 'earnings' ? 'earnings' : 'gifting',
          direction: tx.direction === 'debit' ? 'debit' : 'credit',
          balanceBefore: typeof tx.balanceBefore === 'number' ? tx.balanceBefore : undefined,
          balanceAfter: typeof tx.balanceAfter === 'number' ? tx.balanceAfter : undefined,
          referenceId: tx.referenceId,
          title: String(tx.title || 'Wallet Transaction'),
          date: dateLabel,
          createdAtMs: ms,
          status: tx.status === 'pending' ? 'pending' : 'completed',
        };
      });
      setTransactions((prev) => {
        const remoteIds = new Set(normalized.map((item) => item.id));
        const remoteRefs = new Set(normalized.map((item) => item.referenceId).filter(Boolean));
        const localOnly = prev.filter((item) => {
          if (remoteIds.has(item.id)) return false;
          if (item.referenceId && remoteRefs.has(item.referenceId)) return false;
          if (item.id.startsWith('tx_gift_') || item.id.startsWith('tx_earn_')) {
            return false;
          }
          return true;
        });
        return [...normalized, ...localOnly].sort(
          (a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0)
        );
      });
    });

    return () => {
      unsubGifts();
      unsubWallet();
    };
  }, [firebaseUser?.uid, firebaseUser?.email, isEmailVerified, shouldSubscribeFinancialLedgers]);

  const shouldSubscribeApprovedAgencies =
    deviceMode === 'admin' ||
    currentScreen === 'home' ||
    currentScreen === 'wallet' ||
    currentScreen === 'agency_management' ||
    currentScreen === 'profile' ||
    currentScreen === 'admin_dashboard';

  useEffect(() => {
    if (!firebaseUser?.uid || !isEmailVerified || !shouldSubscribeApprovedAgencies) return;
    return subscribeToApprovedAgencies((docs) => {
      setApprovedAgencyDocs(docs);
    });
  }, [firebaseUser?.uid, isEmailVerified, shouldSubscribeApprovedAgencies]);

  const shouldSubscribeAgencyManagement =
    deviceMode === 'admin' ||
    currentScreen === 'agency_management' ||
    currentScreen === 'wallet' ||
    currentScreen === 'profile' ||
    currentScreen === 'admin_dashboard';

  useEffect(() => {
    const uid = firebaseUser?.uid;
    if (!uid || !isEmailVerified || !shouldSubscribeAgencyManagement) return;
    const isAdmin = (firebaseUser?.email || '').toLowerCase() === 'alphamateapp@gmail.com';
    const unsubs: Array<() => void> = [];

    unsubs.push(
      isAdmin
        ? subscribeToAllAgencyApplications((apps) => {
            setAgencyApplications(apps as AgencyApplication[]);
          })
        : subscribeToMyAgencyApplications(uid, (apps) => {
            setAgencyApplications(apps as AgencyApplication[]);
          })
    );

    unsubs.push(
      subscribeToAgencyTransactions({ senderUid: uid, isAdmin }, (remoteAgencyTxs) => {
        const mapped: AgencyTransaction[] = remoteAgencyTxs.map((tx: any) => {
          const ms = Number(tx.createdAtMs) || Date.now();
          const dateLabel = new Date(ms).toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });
          return {
            id: String(tx.id),
            type: tx.type === 'order_delivery' ? 'order_delivery' : 'direct_send',
            agencyId: tx.agencyId,
            agencyName: tx.agencyName,
            agencyCode: tx.agencyCode,
            senderUid: tx.senderUid,
            recipientId: String(tx.recipientId || ''),
            recipientUniqueId: String(tx.recipientUniqueId || tx.recipientId || ''),
            recipientName: String(tx.recipientName || 'Alpha Mate User'),
            recipientAvatar: String(tx.recipientAvatar || ''),
            coins: Number(tx.coins) || 0,
            previousAgencyBalance:
              typeof tx.previousAgencyBalance === 'number' ? tx.previousAgencyBalance : undefined,
            remainingBalance: Number(tx.remainingBalance) || 0,
            previousRecipientCoins:
              typeof tx.previousRecipientCoins === 'number' ? tx.previousRecipientCoins : undefined,
            nextRecipientCoins:
              typeof tx.nextRecipientCoins === 'number' ? tx.nextRecipientCoins : undefined,
            timestamp: dateLabel,
            createdAtMs: ms,
            referenceId: tx.referenceId,
          };
        });
        setAgencyTransactions(mapped);
        try {
          localStorage.setItem('alphamate_agency_transactions', JSON.stringify(mapped.slice(0, 100)));
        } catch {}
      })
    );

    unsubs.push(
      subscribeToMyHostAgencyRequests(uid, (rawReqs) => {
        const normalized = rawReqs
          .map((r) => normalizeHostAgencyRequestDoc(r))
          .filter((r): r is HostJoinRequest => Boolean(r));
        setMyHostAgencyRequests(normalized);
      })
    );

    if (isAdmin) {
      unsubs.push(
        subscribeToAllHostAgencyRequests((rawReqs) => {
          const normalized = rawReqs
            .map((r) => normalizeHostAgencyRequestDoc(r))
            .filter((r): r is HostJoinRequest => Boolean(r));
          setHostJoinRequests(normalized);
        })
      );
    }

    return () => {
      unsubs.forEach((u) => {
        try {
          u();
        } catch {
          // ignore
        }
      });
    };
  }, [firebaseUser?.uid, firebaseUser?.email, isEmailVerified, shouldSubscribeAgencyManagement]);

  // Real-time Moderation State Transition Enforcement & Restoration Notifications
  useEffect(() => {
    const uid = firebaseUser?.uid;
    if (!uid || !isEmailVerified) return;

    const prevEntry = prevModerationStateRef.current;
    if (prevEntry && prevEntry.uid === uid) {
      const transitions = buildProfileTransitionNotifications(
        prevEntry.state,
        adminModerationState,
        uid
      );
      if (transitions.length > 0) {
        transitionNotifsRef.current = mergeAndDeduplicateNotifications([
          transitions,
          transitionNotifsRef.current,
        ]);
        publishMergedNotifications();
        transitions.forEach((n) => {
          pushService.notifyForeground(
            {
              id: n.id,
              title: n.actionTitle || n.title,
              body: n.message,
              data: {
                type: n.type,
                screen: 'notifications',
                isAdminAction: true,
                notificationId: n.id,
              },
            },
            true
          );
        });
      }
    }
    prevModerationStateRef.current = { uid, state: adminModerationState };

    // Also surface profile-embedded latestWarning if unread and not yet dismissed
    const profWarn = adminModerationState.latestWarning;
    if (profWarn && !profWarn.isRead && !dismissedWarningIdsRef.current.has(profWarn.id)) {
      const warnItem: NotificationItem = {
        id: profWarn.id,
        type: 'admin_warning',
        category: 'walletAndSystem',
        recipientId: uid,
        senderId: 'alpha_mate_admin',
        senderName: profWarn.adminLabel,
        title: profWarn.title || 'OFFICIAL ADMIN WARNING',
        message: profWarn.message,
        isRead: false,
        createdAtMs: profWarn.createdAtMs,
        timestamp: 'Just now',
        isAdminAction: true,
        actionKind: 'admin_warning',
        actionType: 'admin_warning',
        actionTitle: 'OFFICIAL ADMIN WARNING',
        actionTaken: 'Official Admin Warning Issued',
        reason: profWarn.reason,
        adminName: profWarn.adminName,
        adminLabel: profWarn.adminLabel,
        adminEmail: profWarn.adminEmail,
        adminMessage: profWarn.message,
        currentStatus: adminModerationState.currentAccountStatusLabel,
        restrictionScope: 'warning',
        actionDateMs: profWarn.createdAtMs,
        sourceCollection: 'profile_transition',
        dedupKey: `admin_warning:${profWarn.reason.toLowerCase().slice(0, 48)}:${Math.floor(profWarn.createdAtMs / 15000)}`,
      };
      transitionNotifsRef.current = mergeAndDeduplicateNotifications([
        [warnItem],
        transitionNotifsRef.current,
      ]);
      publishMergedNotifications();
      setActiveAdminWarning((prev) => prev || warnItem);
    }

    // Enforce active session termination when Admin restricts Account, Live, or Party in real time
    if (adminModerationState.isAccountBlocked || adminModerationState.isAccountSuspended) {
      if (activeStreamRef.current) {
        p2pStreamingEngine.stopHostBroadcast(activeStreamRef.current.id, true).catch(() => {});
        p2pStreamingEngine.unsubscribeFromRemoteBroadcast(activeStreamRef.current.id, true).catch(() => {});
        setActiveStream(null);
      }
      if (activePartyRoomRef.current) {
        agoraPartyEngine.stopPartyVoice(activePartyRoomRef.current.id, true).catch(() => {});
        setActivePartyRoom(null);
        setUserSeatIndex(null);
        setIsMicMuted(false);
      }
      setActiveConversation(null);
      return;
    }

    if (adminModerationState.isLiveRestricted && adminModerationState.liveRestriction) {
      if (activeStreamRef.current) {
        const s = activeStreamRef.current;
        realtimeSocket.leaveRoom('live', s.id);
        p2pStreamingEngine.stopHostBroadcast(s.id, true).catch(() => {});
        p2pStreamingEngine.unsubscribeFromRemoteBroadcast(s.id, true).catch(() => {});
        if (s.host?.id === uid) {
          deleteLiveStreamFromFirestore(s.id).catch(() => {});
        }
        setActiveStream(null);
        setCurrentScreenState('home');
        setActiveFeatureRestrictionModal({
          scope: 'live',
          detail: adminModerationState.liveRestriction,
        });
      }
    }

    if (adminModerationState.isPartyRestricted && adminModerationState.partyRestriction) {
      if (activePartyRoomRef.current) {
        const r = activePartyRoomRef.current;
        realtimeSocket.leaveRoom('party', r.id);
        agoraPartyEngine.stopPartyVoice(r.id, true).catch(() => {});
        setActivePartyRoom(null);
        setUserSeatIndex(null);
        setIsMicMuted(false);
        setCurrentScreenState('home');
        setActiveFeatureRestrictionModal({
          scope: 'party',
          detail: adminModerationState.partyRestriction,
        });
      }
    }
  }, [adminModerationState, firebaseUser?.uid, isEmailVerified, publishMergedNotifications]);

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
  // AGENCY MANAGEMENT (COIN SELLER AGENCY & HOST AGENCY — ADMIN-APPROVED ONLY)
  // =========================================================================
  const LEGACY_FAKE_AGENCY_IDS = useMemo(
    () =>
      new Set([
        'agency_alpha_official',
        'agency_royal_talent',
        'agency_star_hosts',
        'agency_phoenix_crew',
      ]),
    []
  );

  // Purge any legacy pre-seeded fake agency storage from earlier builds
  useEffect(() => {
    try {
      const legacyKeys = [
        'alphamate_agency_profile',
        'alphamate_all_host_agencies',
        'alphamate_host_agency_profile',
      ];
      legacyKeys.forEach((key) => {
        const raw = localStorage.getItem(key);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          if (parsed.some((item: any) => LEGACY_FAKE_AGENCY_IDS.has(String(item?.agencyId || '')))) {
            localStorage.removeItem(key);
          }
        } else if (parsed && LEGACY_FAKE_AGENCY_IDS.has(String(parsed?.agencyId || ''))) {
          localStorage.removeItem(key);
        }
      });
    } catch {
      // ignore
    }
  }, [LEGACY_FAKE_AGENCY_IDS]);

  const [approvedAgencyDocs, setApprovedAgencyDocs] = useState<any[]>([]);
  const [agencyApplications, setAgencyApplications] = useState<AgencyApplication[]>([]);
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

  // Reset user-scoped agency data whenever auth state clears or changes UID
  useEffect(() => {
    if (!firebaseUser?.uid || !isEmailVerified) {
      setApprovedAgencyDocs([]);
      setAgencyApplications([]);
    }
  }, [firebaseUser?.uid, isEmailVerified]);

  const getStoredAgencyPin = useCallback((uid: string, agencyId: string): string => {
    if (!uid || !agencyId) return '';
    try {
      return localStorage.getItem(`alphamate_agency_pin_${uid}_${agencyId}`) || '';
    } catch {
      return '';
    }
  }, []);

  const setStoredAgencyPin = useCallback((uid: string, agencyId: string, nextPin: string) => {
    if (!uid || !agencyId) return;
    try {
      localStorage.setItem(`alphamate_agency_pin_${uid}_${agencyId}`, nextPin);
    } catch {
      // ignore
    }
  }, []);

  const normalizedAgencies = useMemo(() => {
    return approvedAgencyDocs
      .map((docItem) => normalizeOfficialAgencyDoc(docItem))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
  }, [approvedAgencyDocs]);

  // Strictly Active Coin Seller Agencies ONLY (never Host Agencies, never Hold/Suspended)
  const officialCoinSellerProfiles: CoinSellerAgencyProfile[] = useMemo(() => {
    const activeUid = firebaseUser?.uid || currentUser.id;
    return normalizedAgencies
      .filter((item) => item.type === 'coin_seller' && item.status === 'active')
      .map((item) => {
        const storedPin =
          item.ownerUserId === activeUid
            ? getStoredAgencyPin(activeUid, item.agencyId)
            : '';
        return {
          agencyId: item.agencyId,
          agencyName: item.agencyName,
          agencyCode: item.agencyCode,
          badge: item.badge || 'Official Coin Seller Agency',
          logo: item.logo,
          ownerUserId: item.ownerUserId,
          ownerName: item.ownerName,
          ownerUniqueId: item.ownerUniqueId,
          ownerAvatar: item.ownerAvatar,
          agencyBalance: item.agencyBalance,
          pin: storedPin,
          isPinSet: Boolean(storedPin) || item.isPinSet,
          whatsappNumber: item.whatsappNumber,
          whatsappDisplay: item.whatsappDisplay,
          hasValidWhatsApp: item.hasValidWhatsApp,
          isOfficial: item.isOfficial,
          slogan: item.slogan,
          status: item.status,
          paymentMethods: item.paymentMethods,
          rates: item.rates,
        };
      });
  }, [normalizedAgencies, firebaseUser?.uid, currentUser.id, getStoredAgencyPin]);

  const officialCoinSellerAgencies: OfficialAgency[] = useMemo(() => {
    return officialCoinSellerProfiles
      .filter((p) => p.status === 'active')
      .map((p) => ({
        id: p.agencyId,
        agencyCode: p.agencyCode,
        name: p.agencyName,
        tagline: p.slogan || 'Official Coin Seller Agency',
        logo: p.logo || '',
        badge: 'Diamond Certified',
        badgeColor: '#F59E0B',
        ownerUserId: p.ownerUserId,
        ownerName: p.ownerName,
        ownerAvatar: p.ownerAvatar,
        whatsappNumber: p.whatsappNumber,
        whatsappDisplay: p.whatsappDisplay,
        hasValidWhatsApp: Boolean(p.hasValidWhatsApp),
        status: p.status || 'active',
        agencyBalance: p.agencyBalance,
        rating: 5.0,
        ordersCompleted: p.agencyBalance > 0 ? 'Official Stock Active' : 'Official Licensed',
        bonusOffer:
          p.agencyBalance > 0
            ? `Available Stock: ${p.agencyBalance.toLocaleString()} Coins`
            : 'Official Coin Seller Agency',
        avgDeliveryTime: 'Active',
        paymentMethods:
          p.paymentMethods && p.paymentMethods.length > 0
            ? p.paymentMethods
            : p.hasValidWhatsApp
            ? ['In-App Chat', 'WhatsApp Direct']
            : ['In-App Chat'],
        rates: p.rates && p.rates.length > 0 ? p.rates : [],
      }));
  }, [officialCoinSellerProfiles]);

  // Strictly Active Host Agencies ONLY (never Coin Seller Agencies, never Hold/Suspended)
  const allHostAgencies: HostAgencyProfile[] = useMemo(() => {
    return normalizedAgencies
      .filter((item) => item.type === 'host_agency' && item.status === 'active')
      .map((item) => ({
        agencyId: item.agencyId,
        agencyName: item.agencyName,
        agencyCode: item.agencyCode,
        agencyTag: item.agencyTag,
        tagColor: item.tagColor,
        badge: item.badge || 'Official Host Agency',
        logo: item.logo,
        ownerUserId: item.ownerUserId,
        ownerName: item.ownerName,
        ownerUniqueId: item.ownerUniqueId,
        ownerAvatar: item.ownerAvatar,
        whatsappNumber: item.whatsappNumber,
        whatsappDisplay: item.whatsappDisplay,
        hasValidWhatsApp: item.hasValidWhatsApp,
        defaultCommissionRate: item.defaultCommissionRate,
        minWeeklyHours: item.minWeeklyHours,
        slogan: item.slogan,
        isOfficial: item.isOfficial,
        activeHostsCount: item.totalHosts,
        totalHosts: item.totalHosts,
        status: item.status,
      }));
  }, [normalizedAgencies]);

  // Only expose an active agency profile if the currently signed-in user OWNS an Admin-approved agency
  const agencyProfile: CoinSellerAgencyProfile | null = useMemo(() => {
    const activeUid = firebaseUser?.uid || currentUser.id;
    if (!activeUid) return null;
    return officialCoinSellerProfiles.find((a) => a.ownerUserId === activeUid) || null;
  }, [officialCoinSellerProfiles, firebaseUser?.uid, currentUser.id]);

  const hostAgencyProfile: HostAgencyProfile | null = useMemo(() => {
    const activeUid = firebaseUser?.uid || currentUser.id;
    if (!activeUid) return null;
    return allHostAgencies.find((a) => a.ownerUserId === activeUid) || null;
  }, [allHostAgencies, firebaseUser?.uid, currentUser.id]);

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

  const agencyTransferInFlightRef = useRef(false);

  const findUserByIdOrUsername = (query: string): User | null => {
    if (!query || !query.trim()) return null;
    const clean = query.trim().replace(/^@/, '').toLowerCase();

    const pool = realUsers.length > 0 ? realUsers : registeredUsers;
    const matched = pool.find(
      (u) =>
        (u.uniqueId && u.uniqueId.toLowerCase() === clean) ||
        (u.username && u.username.toLowerCase() === clean) ||
        (u.displayName && u.displayName.toLowerCase() === clean) ||
        (u.email && u.email.toLowerCase() === clean) ||
        (u.id && u.id.toLowerCase() === clean)
    );
    if (matched) return matched;

    if (
      currentUser.uniqueId.toLowerCase() === clean ||
      currentUser.username.toLowerCase() === clean ||
      currentUser.displayName.toLowerCase() === clean ||
      (currentUser.email && currentUser.email.toLowerCase() === clean) ||
      currentUser.id.toLowerCase() === clean
    ) {
      return currentUser;
    }

    return null;
  };

  const findUserByIdOrUsernameAsync = async (query: string): Promise<User | null> => {
    const localHit = findUserByIdOrUsername(query);
    if (localHit && !localHit.id.startsWith('user_')) {
      return localHit;
    }
    const remoteDoc = await findRealUserInFirestore(query);
    if (!remoteDoc) return localHit;
    const resolved: User = {
      ...CURRENT_USER,
      ...remoteDoc,
      id: String(remoteDoc.id),
      uniqueId: String(remoteDoc.uniqueId || remoteDoc.id),
      username: String(remoteDoc.username || remoteDoc.displayName || 'user'),
      displayName: String(remoteDoc.displayName || remoteDoc.username || 'Alpha Mate User'),
      avatar: String(remoteDoc.avatar || ''),
      coins: Math.max(0, Math.floor(Number(remoteDoc.coins ?? 0) || 0)),
      diamonds: Math.max(0, Math.floor(Number(remoteDoc.diamonds ?? 0) || 0)),
      level: Number(remoteDoc.level ?? 1) || 1,
      vipTier: Number(remoteDoc.vipTier ?? 0) || 0,
    };
    return resolved;
  };

  const sendAgencyCoins = async (
    recipientQuery: string,
    amount: number,
    pin: string,
    idempotencyKey?: string
  ): Promise<{ success: boolean; message: string; tx?: AgencyTransaction }> => {
    if (!agencyProfile || !firebaseUser?.uid) {
      return {
        success: false,
        message: 'Only an Admin-approved Coin Seller Agency owner can send agency coins.',
      };
    }

    if (!agencyProfile.pin) {
      return {
        success: false,
        message: 'Please set your 4-digit Agency Security PIN first in Security PIN Settings.',
      };
    }

    if (pin !== agencyProfile.pin) {
      return { success: false, message: 'Invalid 4-digit security PIN. Please try again.' };
    }

    const numericAmount = Number(amount);
    const safeAmount = Math.floor(numericAmount);
    if (!Number.isFinite(numericAmount) || numericAmount !== safeAmount || safeAmount <= 0) {
      return { success: false, message: 'Please enter a valid whole coin amount greater than zero.' };
    }

    if (safeAmount > agencyProfile.agencyBalance) {
      return {
        success: false,
        message: `Insufficient agency stock. Available stock: ${agencyProfile.agencyBalance.toLocaleString()} Coins.`,
      };
    }

    if (agencyTransferInFlightRef.current) {
      return {
        success: false,
        message: 'A transfer is already being processed. Please wait a moment.',
      };
    }

    agencyTransferInFlightRef.current = true;
    try {
      const recipient = await findUserByIdOrUsernameAsync(recipientQuery);
      if (!recipient || !recipient.id || recipient.id.startsWith('user_')) {
        return {
          success: false,
          message: 'Real Alpha Mate user not found in Firestore. Please check the exact User ID, username, or email.',
        };
      }

      // Atomic Firestore ACID transfer: deducts agency balance, credits recipient Gifting Wallet,
      // writes immutable agencyTransactions/{txId} and users/{recipientId}/walletTransactions/{txId}.
      // Never reports success unless Firestore commits all writes atomically!
      const committed = await transferAgencyCoinsAtomicInFirestore({
        agencyId: agencyProfile.agencyId,
        recipientId: recipient.id,
        amount: safeAmount,
        type: 'direct_send',
        idempotencyKey,
        senderName: currentUser.displayName || agencyProfile.agencyName,
      });

      // Immediately reflect authoritative post-commit balance (matches onSnapshot with zero snap-back)
      setApprovedAgencyDocs((prev) =>
        prev.map((d) =>
          d.agencyId === agencyProfile.agencyId
            ? {
                ...d,
                agencyBalance: committed.remainingBalance,
                coinBalance: committed.remainingBalance,
                coins: committed.remainingBalance,
              }
            : d
        )
      );

      if (committed.recipientId === currentUser.id) {
        setCoins(committed.nextRecipientCoins);
        setCurrentUser((prev) => {
          const updated = { ...prev, coins: committed.nextRecipientCoins };
          saveUserSession(updated, isAuthenticated);
          return updated;
        });
      }

      const newTx: AgencyTransaction = {
        id: committed.txId,
        type: 'direct_send',
        agencyId: committed.agencyId,
        agencyName: committed.agencyName,
        agencyCode: committed.agencyCode,
        senderUid: committed.senderUid,
        recipientId: committed.recipientId,
        recipientUniqueId: committed.recipientUniqueId,
        recipientName: committed.recipientName,
        recipientAvatar: committed.recipientAvatar,
        coins: committed.coins,
        previousAgencyBalance: committed.previousAgencyBalance,
        remainingBalance: committed.remainingBalance,
        previousRecipientCoins: committed.previousRecipientCoins,
        nextRecipientCoins: committed.nextRecipientCoins,
        timestamp: 'Just now',
        createdAtMs: committed.createdAtMs,
        referenceId: committed.referenceId,
      };

      setAgencyTransactions((prev) => {
        const deduped = [newTx, ...prev.filter((t) => t.id !== newTx.id)];
        try {
          localStorage.setItem('alphamate_agency_transactions', JSON.stringify(deduped.slice(0, 100)));
        } catch {}
        return deduped;
      });

      return {
        success: true,
        message: `Successfully transferred ${committed.coins.toLocaleString()} Coins to ${committed.recipientName}'s Gifting Wallet (${committed.recipientUniqueId}). Remaining agency stock: ${committed.remainingBalance.toLocaleString()} Coins.`,
        tx: newTx,
      };
    } catch (err: any) {
      const errMsg =
        err instanceof Error && err.message
          ? err.message
          : 'Coin transfer failed. No balances were changed. Please try again.';
      return { success: false, message: errMsg };
    } finally {
      agencyTransferInFlightRef.current = false;
    }
  };

  const deliverAgencyOrder = async (
    orderId: string,
    pin: string
  ): Promise<{ success: boolean; message: string }> => {
    if (!agencyProfile || !firebaseUser?.uid) {
      return {
        success: false,
        message: 'Only an Admin-approved Coin Seller Agency owner can fulfill orders.',
      };
    }

    if (!agencyProfile.pin) {
      return {
        success: false,
        message: 'Please configure your 4-digit Agency Security PIN first.',
      };
    }

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

    const totalCoinsToCredit = Math.floor(Number(order.coins || 0) + Number(order.bonusCoins || 0));
    if (totalCoinsToCredit <= 0 || totalCoinsToCredit > agencyProfile.agencyBalance) {
      return {
        success: false,
        message: `Insufficient agency stock to fulfill order. Required: ${totalCoinsToCredit.toLocaleString()} Coins, Available: ${agencyProfile.agencyBalance.toLocaleString()} Coins.`,
      };
    }

    if (agencyTransferInFlightRef.current) {
      return {
        success: false,
        message: 'Another agency transfer is currently in progress. Please wait.',
      };
    }

    agencyTransferInFlightRef.current = true;
    try {
      const resolvedBuyer =
        (order.buyerId && !order.buyerId.startsWith('user_')
          ? await findUserByIdOrUsernameAsync(order.buyerId)
          : null) ||
        (order.buyerUniqueId ? await findUserByIdOrUsernameAsync(order.buyerUniqueId) : null);

      if (!resolvedBuyer || !resolvedBuyer.id || resolvedBuyer.id.startsWith('user_')) {
        return {
          success: false,
          message: 'Buyer account could not be verified in Firestore. Order not fulfilled.',
        };
      }

      // Deterministic idempotency key per order guarantees an order can NEVER be delivered twice
      const committed = await transferAgencyCoinsAtomicInFirestore({
        agencyId: agencyProfile.agencyId,
        recipientId: resolvedBuyer.id,
        amount: totalCoinsToCredit,
        type: 'order_delivery',
        orderId: order.id,
        idempotencyKey: `order_${order.id}`,
        senderName: currentUser.displayName || agencyProfile.agencyName,
      });

      setApprovedAgencyDocs((prev) =>
        prev.map((d) =>
          d.agencyId === agencyProfile.agencyId
            ? {
                ...d,
                agencyBalance: committed.remainingBalance,
                coinBalance: committed.remainingBalance,
                coins: committed.remainingBalance,
              }
            : d
        )
      );

      if (committed.recipientId === currentUser.id) {
        setCoins(committed.nextRecipientCoins);
        setCurrentUser((prev) => {
          const updated = { ...prev, coins: committed.nextRecipientCoins };
          saveUserSession(updated, isAuthenticated);
          return updated;
        });
      }

      const updatedOrders = agencyOrders.map((o) =>
        o.id === orderId ? { ...o, status: 'delivered' as const, deliveredAt: 'Just now' } : o
      );
      saveAgencyOrders(updatedOrders);

      const newTx: AgencyTransaction = {
        id: committed.txId,
        type: 'order_delivery',
        agencyId: committed.agencyId,
        agencyName: committed.agencyName,
        agencyCode: committed.agencyCode,
        senderUid: committed.senderUid,
        recipientId: committed.recipientId,
        recipientUniqueId: committed.recipientUniqueId,
        recipientName: committed.recipientName,
        recipientAvatar: committed.recipientAvatar,
        coins: committed.coins,
        previousAgencyBalance: committed.previousAgencyBalance,
        remainingBalance: committed.remainingBalance,
        previousRecipientCoins: committed.previousRecipientCoins,
        nextRecipientCoins: committed.nextRecipientCoins,
        timestamp: 'Just now',
        createdAtMs: committed.createdAtMs,
        referenceId: committed.referenceId,
      };

      setAgencyTransactions((prev) => {
        const deduped = [newTx, ...prev.filter((t) => t.id !== newTx.id)];
        try {
          localStorage.setItem('alphamate_agency_transactions', JSON.stringify(deduped.slice(0, 100)));
        } catch {}
        return deduped;
      });

      return {
        success: true,
        message: `Order ${order.orderNo} fulfilled! ${committed.coins.toLocaleString()} Coins credited to ${committed.recipientName}'s Gifting Wallet.`,
      };
    } catch (err: any) {
      const errMsg =
        err instanceof Error && err.message
          ? err.message
          : 'Order delivery failed. Agency stock was not deducted.';
      return { success: false, message: errMsg };
    } finally {
      agencyTransferInFlightRef.current = false;
    }
  };

  const rejectAgencyOrder = (orderId: string, reason?: string): { success: boolean; message: string } => {
    const updatedOrders = agencyOrders.map((o) =>
      o.id === orderId ? { ...o, status: 'rejected' as const, note: reason || 'Receipt verification rejected' } : o
    );
    saveAgencyOrders(updatedOrders);
    return { success: true, message: 'Order has been marked as rejected.' };
  };

  const updateAgencyProfile = (updates: Partial<CoinSellerAgencyProfile>) => {
    if (!agencyProfile) return;
    // Security: never allow client settings updates to alter agencyBalance
    const { agencyBalance: _ignoredBalance, pin: _ignoredPin, ownerUserId: _ignoredOwner, ...safeUpdates } = updates;
    setApprovedAgencyDocs((prev) =>
      prev.map((d) => (d.agencyId === agencyProfile.agencyId ? { ...d, ...safeUpdates } : d))
    );
    updateApprovedAgencySettingsInFirestore(agencyProfile.agencyId, safeUpdates).catch((err) => {
      console.warn('Update agency profile error:', err);
    });
  };

  const setAgencySecurityPin = (oldPin: string, newPin: string): { success: boolean; message: string } => {
    if (!agencyProfile || !firebaseUser?.uid) {
      return { success: false, message: 'Approved Coin Seller Agency ownership required.' };
    }
    if (agencyProfile.pin && oldPin !== agencyProfile.pin) {
      return { success: false, message: 'Current PIN is incorrect.' };
    }
    if (!/^\d{4}$/.test(newPin)) {
      return { success: false, message: 'New PIN must be exactly 4 digits (0-9).' };
    }
    setStoredAgencyPin(firebaseUser.uid, agencyProfile.agencyId, newPin);
    setApprovedAgencyDocs((prev) =>
      prev.map((d) => (d.agencyId === agencyProfile.agencyId ? { ...d, isPinSet: true } : d))
    );
    updateApprovedAgencySettingsInFirestore(agencyProfile.agencyId, { isPinSet: true }).catch(() => {});
    return { success: true, message: '4-digit Security PIN saved securely.' };
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
    saveAgencyOrders([newOrder, ...agencyOrders]);
    return newOrder;
  };

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

  const [hostJoinRequests, setHostJoinRequests] = useState<HostJoinRequest[]>([]);
  const [myHostAgencyRequests, setMyHostAgencyRequests] = useState<HostJoinRequest[]>([]);

  const hostAgencyMembership = useMemo(
    () => resolveUserHostAgencyMembership(currentUser, myHostAgencyRequests, allHostAgencies),
    [currentUser, myHostAgencyRequests, allHostAgencies]
  );

  // Real-time Host Agency Owner listeners: incoming agency_requests + Super Admin-approved host members
  useEffect(() => {
    const ownerUid = firebaseUser?.uid;
    const ownedAgencyId = hostAgencyProfile?.agencyId;
    if (!ownerUid || !ownedAgencyId || !isEmailVerified) return;

    const unsubReqs = subscribeToAgencyOwnerHostRequests(ownerUid, ownedAgencyId, (rawReqs) => {
      const normalized = rawReqs
        .map((r) => normalizeHostAgencyRequestDoc(r))
        .filter((r): r is HostJoinRequest => Boolean(r));
      setHostJoinRequests(normalized);
    });

    const unsubMembers = subscribeToAgencyHostMembers(ownedAgencyId, (memberDocs) => {
      setAgencyHosts((prev) => {
        const prevByUid = new Map(prev.map((h) => [h.userId, h]));
        const firestoreHosts: HostMember[] = memberDocs.map((docData) => {
          const uid = String(docData.id || docData.uid || '');
          const existing = prevByUid.get(uid);
          return {
            id: existing?.id || `host_member_${uid}`,
            userId: uid,
            uniqueId: String(docData.uniqueId || existing?.uniqueId || ''),
            displayName: String(docData.displayName || existing?.displayName || 'Alpha Mate Host'),
            username: String(docData.username || existing?.username || ''),
            avatar: String(docData.avatar || existing?.avatar || DEFAULT_AVATAR_URL),
            level: Number(docData.level || existing?.level || 1),
            agencyId: ownedAgencyId,
            agencyName: hostAgencyProfile.agencyName,
            agencyTag: hostAgencyProfile.agencyTag,
            weeklyTargetDiamonds: existing?.weeklyTargetDiamonds ?? 500000,
            currentProgressDiamonds: existing?.currentProgressDiamonds ?? Number(docData.diamonds || 0),
            targetStatus: existing?.targetStatus ?? 'pending',
            weeklyHoursStreamed: existing?.weeklyHoursStreamed ?? 0,
            weeklyTargetHours: existing?.weeklyTargetHours ?? hostAgencyProfile.minWeeklyHours,
            weeklyEarnings: existing?.weeklyEarnings ?? 0,
            commissionRate: existing?.commissionRate ?? hostAgencyProfile.defaultCommissionRate,
            isLive: Boolean(docData.isLive ?? existing?.isLive),
            joinedDate:
              typeof docData.agencyJoinedAt === 'string' && docData.agencyJoinedAt
                ? new Date(docData.agencyJoinedAt).toLocaleDateString()
                : existing?.joinedDate || 'Active Member',
            resignationRequested: existing?.resignationRequested,
            resignationReason: existing?.resignationReason,
          };
        });
        return firestoreHosts;
      });
    });

    return () => {
      unsubReqs();
      unsubMembers();
    };
  }, [
    firebaseUser?.uid,
    isEmailVerified,
    hostAgencyProfile?.agencyId,
    hostAgencyProfile?.agencyName,
    hostAgencyProfile?.agencyTag,
    hostAgencyProfile?.minWeeklyHours,
    hostAgencyProfile?.defaultCommissionRate,
  ]);

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

  const updateHostAgencyProfile = (updates: Partial<HostAgencyProfile>) => {
    if (!hostAgencyProfile) return;
    const { ownerUserId: _ignoredOwner, agencyId: _ignoredId, ...safeUpdates } = updates;
    setApprovedAgencyDocs((prev) =>
      prev.map((d) => (d.agencyId === hostAgencyProfile.agencyId ? { ...d, ...safeUpdates } : d))
    );
    updateApprovedAgencySettingsInFirestore(hostAgencyProfile.agencyId, safeUpdates).catch((err) => {
      console.warn('Update host agency profile error:', err);
    });
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
  };

  const toggleHostLiveStatus = (hostId: string) => {
    const updated = agencyHosts.map((h) =>
      h.id === hostId || h.userId === hostId ? { ...h, isLive: !h.isLive } : h
    );
    saveAgencyHosts(updated);
  };

  const approveHostJoinRequest = (
    requestId: string,
    targetDiamonds = 500000,
    commissionRate = 15,
    targetHours?: number
  ): { success: boolean; message: string } => {
    const isAdminUser =
      (firebaseUser?.email || '').toLowerCase() === 'alphamateapp@gmail.com' ||
      currentUser.id === 'user_admin';
    const req = hostJoinRequests.find((r) => r.id === requestId);
    if (!req) return { success: false, message: 'Request not found' };

    const targetAgency =
      hostAgencyProfile ||
      allHostAgencies.find((a) => a.agencyId === req.agencyId) ||
      null;

    if (!isAdminUser && !hostAgencyProfile) {
      return { success: false, message: 'Approved Host Agency ownership or Admin access required.' };
    }

    const resolvedAgencyId = req.agencyId || targetAgency?.agencyId || '';
    const resolvedAgencyName = req.agencyName || targetAgency?.agencyName || 'Official Host Agency';
    const resolvedAgencyCode = req.agencyCode || targetAgency?.agencyCode || '';
    const resolvedAgencyTag = req.agencyTag || targetAgency?.agencyTag || 'HOST';
    const resolvedOwnerId = req.agencyOwnerId || targetAgency?.ownerUserId || firebaseUser?.uid || '';
    const resolvedOwnerName = targetAgency?.ownerName || currentUser.displayName;

    const alreadyBound = agencyHosts.some((h) => h.userId === req.userId);
    if (!alreadyBound && resolvedAgencyId) {
      const newHost: HostMember = {
        id: `host_member_${req.userId || Date.now()}`,
        userId: req.userId,
        uniqueId: req.uniqueId,
        displayName: req.displayName,
        username: req.username,
        avatar: req.avatar,
        level: req.level,
        agencyId: resolvedAgencyId,
        agencyName: resolvedAgencyName,
        agencyTag: resolvedAgencyTag,
        weeklyTargetDiamonds: targetDiamonds,
        currentProgressDiamonds: 0,
        targetStatus: 'pending',
        weeklyHoursStreamed: 0,
        weeklyTargetHours: targetHours || req.expectedHours || targetAgency?.minWeeklyHours || 15,
        weeklyEarnings: 0,
        commissionRate,
        isLive: false,
        joinedDate: 'Joined just now',
      };
      saveAgencyHosts([newHost, ...agencyHosts]);
    }

    saveHostJoinRequests(
      hostJoinRequests.map((r) => (r.id === requestId ? { ...r, status: 'approved' as const } : r))
    );

    reviewHostAgencyRequestInFirestore(
      {
        id: req.id,
        applicantUid: req.applicantUid || req.userId,
        userId: req.userId,
        agencyId: resolvedAgencyId,
        agencyName: resolvedAgencyName,
        agencyCode: resolvedAgencyCode,
        agencyTag: resolvedAgencyTag,
        agencyOwnerId: resolvedOwnerId,
      },
      'approve',
      {
        ownerName: resolvedOwnerName,
        syncUserDoc: isAdminUser,
      }
    ).catch((err) => {
      console.warn('Firestore host agency request approval failed:', err);
    });

    return {
      success: true,
      message: `${req.displayName} approved for ${resolvedAgencyName} [${resolvedAgencyTag}]!`,
    };
  };

  const rejectHostJoinRequest = (
    requestId: string,
    reason = 'Application was not approved at this time.'
  ): { success: boolean; message: string } => {
    const isAdminUser =
      (firebaseUser?.email || '').toLowerCase() === 'alphamateapp@gmail.com' ||
      currentUser.id === 'user_admin';
    const req = hostJoinRequests.find((r) => r.id === requestId);
    saveHostJoinRequests(
      hostJoinRequests.map((r) =>
        r.id === requestId ? { ...r, status: 'rejected' as const, rejectionReason: reason } : r
      )
    );
    if (req) {
      reviewHostAgencyRequestInFirestore(
        {
          id: req.id,
          applicantUid: req.applicantUid || req.userId,
          userId: req.userId,
          agencyId: req.agencyId,
          agencyName: req.agencyName,
          agencyCode: req.agencyCode,
          agencyTag: req.agencyTag,
          agencyOwnerId: req.agencyOwnerId,
        },
        'reject',
        {
          rejectionReason: reason,
          syncUserDoc: isAdminUser,
        }
      ).catch((err) => {
        console.warn('Firestore host agency request rejection failed:', err);
      });
    }
    return { success: true, message: 'Host application has been rejected.' };
  };

  const removeHostFromAgency = (
    hostId: string,
    _reason?: string
  ): { success: boolean; message: string } => {
    const target = agencyHosts.find((h) => h.id === hostId || h.userId === hostId);
    if (!target) return { success: false, message: 'Host not found' };

    saveAgencyHosts(agencyHosts.filter((h) => h.id !== hostId && h.userId !== hostId));

    return { success: true, message: `${target.displayName} has been released from the agency.` };
  };

  const requestHostResignation = (reason: string): { success: boolean; message: string } => {
    saveAgencyHosts(
      agencyHosts.map((h) =>
        h.userId === currentUser.id || h.uniqueId === currentUser.uniqueId
          ? { ...h, resignationRequested: true, resignationReason: reason }
          : h
      )
    );

    return {
      success: true,
      message: 'Your resignation request has been submitted to your agency admin for review.',
    };
  };

  const submitHostJoinRequest = async (
    agencyId: string,
    whatsapp: string,
    experience: string,
    expectedHours: number
  ): Promise<{ success: boolean; message: string }> => {
    const uid = firebaseUser?.uid;
    if (!uid || !isEmailVerified) {
      return {
        success: false,
        message: 'Please sign in with a verified Alpha Mate account before applying to a Host Agency.',
      };
    }

    if (hostAgencyMembership.isActiveMember) {
      return {
        success: false,
        message: `You are already an active member of ${hostAgencyMembership.agencyName || 'an Official Host Agency'}.`,
      };
    }

    const existingPending = myHostAgencyRequests.find((r) => r.status === 'pending');
    if (existingPending) {
      return {
        success: false,
        message: `You already have a Pending Application for ${existingPending.agencyName || 'a Host Agency'}. Please wait for Super Admin approval.`,
      };
    }

    const targetAgency = allHostAgencies.find(
      (a) => a.agencyId === agencyId && a.status === 'active'
    );
    if (!targetAgency) {
      return {
        success: false,
        message: 'Selected Host Agency is no longer active or available.',
      };
    }

    const nowMs = Date.now();
    const requestId = `hreq_${uid.slice(0, 8)}_${nowMs}`;

    try {
      await submitHostAgencyRequestToFirestore({
        id: requestId,
        applicantUid: uid,
        userDocId: uid,
        uniqueId: currentUser.uniqueId,
        displayName: currentUser.displayName,
        username: currentUser.username,
        avatar: currentUser.avatar || DEFAULT_AVATAR_URL,
        level: currentUser.level || 1,
        agencyId: targetAgency.agencyId,
        agencyName: targetAgency.agencyName,
        agencyCode: targetAgency.agencyCode,
        agencyTag: targetAgency.agencyTag,
        agencyOwnerId: targetAgency.ownerUserId,
        whatsapp: whatsapp.trim(),
        experience: experience.trim() || 'Aspiring live host ready to meet weekly targets',
        expectedHours,
        createdAt: new Date(nowMs).toISOString(),
        createdAtMs: nowMs,
      });
    } catch (err: any) {
      return {
        success: false,
        message:
          typeof err?.message === 'string' && err.message.trim()
            ? err.message
            : 'Could not submit application. Please try again.',
      };
    }

    // Optimistically reflect strictly as PENDING — NEVER activate membership on submit
    const optimisticReq: HostJoinRequest = {
      id: requestId,
      applicantUid: uid,
      userId: uid,
      userDocId: uid,
      uniqueId: currentUser.uniqueId,
      displayName: currentUser.displayName,
      username: currentUser.username,
      avatar: currentUser.avatar || DEFAULT_AVATAR_URL,
      level: currentUser.level || 1,
      agencyId: targetAgency.agencyId,
      agencyName: targetAgency.agencyName,
      agencyCode: targetAgency.agencyCode,
      agencyTag: targetAgency.agencyTag,
      agencyOwnerId: targetAgency.ownerUserId,
      agencyType: 'Host Agency',
      whatsapp: whatsapp.trim(),
      experience: experience.trim() || 'Aspiring live host ready to meet weekly targets',
      expectedHours,
      appliedDate: 'Just now',
      createdAt: new Date(nowMs).toISOString(),
      createdAtMs: nowMs,
      status: 'pending',
    };

    setMyHostAgencyRequests((prev) => {
      if (prev.some((r) => r.id === optimisticReq.id)) return prev;
      return [optimisticReq, ...prev];
    });

    return {
      success: true,
      message: `Application submitted to ${targetAgency.agencyName}! Status is now Pending Super Admin approval.`,
    };
  };

  const submitAgencyApplication = (
    data: Omit<AgencyApplication, 'id' | 'status' | 'submittedAt'>
  ): { success: boolean; message: string } => {
    if (!firebaseUser?.uid || !isEmailVerified) {
      return {
        success: false,
        message: 'Please sign in with a verified Alpha Mate account before applying for an agency.',
      };
    }

    // Prevent duplicate pending application for the same agency type
    const hasPendingSameType = agencyApplications.some(
      (a) =>
        a.applicantUserId === firebaseUser.uid &&
        a.type === data.type &&
        a.status === 'pending'
    );
    if (hasPendingSameType) {
      return {
        success: false,
        message: `You already have a pending ${
          data.type === 'coin_seller' ? 'Coin Seller Agency' : 'Host Agency'
        } application awaiting Official Admin approval.`,
      };
    }

    // Prevent duplicate application if already approved & active
    if (data.type === 'coin_seller' && agencyProfile) {
      return {
        success: false,
        message: 'You already operate an approved Coin Seller Agency.',
      };
    }
    if (data.type === 'host_agency' && hostAgencyProfile) {
      return {
        success: false,
        message: 'You already operate an approved Host Agency.',
      };
    }

    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const newApp: AgencyApplication = {
      ...data,
      applicantUserId: firebaseUser.uid,
      id: `app_${nowMs}_${Math.random().toString(36).slice(2, 7)}`,
      status: 'pending',
      submittedAt: nowIso,
      createdAtMs: nowMs,
    };

    // Optimistically reflect as strictly PENDING ('requested'), never approved
    setAgencyApplications((prev) => [newApp, ...prev]);

    submitAgencyApplicationToFirestore({
      id: newApp.id,
      type: newApp.type,
      applicantUserId: firebaseUser.uid,
      applicantName: newApp.applicantName,
      applicantUniqueId: newApp.applicantUniqueId,
      agencyName: newApp.agencyName,
      agencyTag: newApp.agencyTag,
      whatsapp: newApp.whatsapp,
      phoneNumber: newApp.phoneNumber,
      idCardNumber: newApp.idCardNumber,
      experience: newApp.experience,
      status: 'pending',
      submittedAt: nowIso,
      createdAtMs: nowMs,
    }).catch((err) => {
      console.warn('Firestore agency application submit failed:', err);
      setAgencyApplications((prev) => prev.filter((a) => a.id !== newApp.id));
    });

    return {
      success: true,
      message:
        'Agency request submitted! Status: Pending (Requested). Your agency will remain closed until Official Admin approves it.',
    };
  };

  const reviewAgencyApplication = (
    applicationId: string,
    action: 'approve' | 'reject'
  ): { success: boolean; message: string } => {
    const isOfficialAdmin = firebaseUser?.email?.toLowerCase() === 'alphamateapp@gmail.com';
    if (!isOfficialAdmin) {
      return {
        success: false,
        message: 'Only Official Alpha Mate Admin (alphamateapp@gmail.com) can approve or reject agency licenses.',
      };
    }

    const app = agencyApplications.find((a) => a.id === applicationId);
    if (!app) return { success: false, message: 'Application not found.' };

    const nextStatus = action === 'approve' ? ('approved' as const) : ('rejected' as const);
    setAgencyApplications((prev) =>
      prev.map((a) => (a.id === applicationId ? { ...a, status: nextStatus } : a))
    );

    adminReviewAgencyApplicationInFirestore(app, action)
      .then(() => {
        if (app.applicantUserId) {
          sendFirestoreNotification({
            recipientId: app.applicantUserId,
            type: 'agency',
            category: 'system',
            title:
              action === 'approve'
                ? `🎉 Agency License Approved: ${app.agencyName}`
                : `Agency Application Update: ${app.agencyName}`,
            message:
              action === 'approve'
                ? `Your ${app.type === 'coin_seller' ? 'Coin Seller Agency' : 'Host Agency'} "${app.agencyName}" is now approved by Official Admin! Coin stock starts at 0 until Admin allocation.`
                : `Your application for "${app.agencyName}" was declined by Official Admin review.`,
            screen: 'agency_management',
          }).catch(() => {});
        }
      })
      .catch((err) => {
        console.warn('Admin agency review failed:', err);
        setAgencyApplications((prev) =>
          prev.map((a) => (a.id === applicationId ? { ...a, status: app.status } : a))
        );
      });

    return {
      success: true,
      message: `Agency application ${action === 'approve' ? 'approved (initial coin stock: 0)' : 'rejected'}.`,
    };
  };

  const adminAllocateAgencyCoins = async (
    agencyId: string,
    coinsToAdd: number
  ): Promise<{ success: boolean; message: string }> => {
    const isOfficialAdmin = firebaseUser?.email?.toLowerCase() === 'alphamateapp@gmail.com';
    if (!isOfficialAdmin) {
      return {
        success: false,
        message: 'Only Official Alpha Mate Admin can allocate agency coin stock.',
      };
    }
    try {
      const nextBalance = await adminAllocateAgencyCoinsInFirestore(agencyId, coinsToAdd);
      setApprovedAgencyDocs((prev) =>
        prev.map((d) => (d.agencyId === agencyId ? { ...d, agencyBalance: nextBalance } : d))
      );
      return {
        success: true,
        message: `Allocated +${coinsToAdd.toLocaleString()} Coins. New Agency Stock: ${nextBalance.toLocaleString()} Coins.`,
      };
    } catch (err: any) {
      return {
        success: false,
        message: err?.message || 'Unable to allocate coin stock to agency.',
      };
    }
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
    if (activeConversation) {
      setActiveConversation(null);
      setActiveTabState('chat');
      setCurrentScreenState('chat');
      syncBrowserUrlForScreen('chat');
      return;
    }
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
      followersCount: 0,
      followingCount: 0,
      likesCount: 0,
      level: 0,
      xp: 0,
      nextLevelXp: 50000,
      vipTier: 0,
      coins: 1000,
      diamonds: 100,
      isVerified: false,
      isAccountVerified: data.authProvider === 'google',
      greenTick: data.authProvider === 'google',
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
      const fbUser = await signInWithGoogle({ forceAccountPicker: true });
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

      const currentSaved = loadSavedDeviceAccounts();
      const alreadyOnDevice = currentSaved.some((a) => a.uid === fbUser.uid);
      if (!alreadyOnDevice && currentSaved.length >= MAX_DEVICE_ACCOUNTS) {
        await clearDefaultAuthCurrentUser();
        return {
          success: false,
          error: `Maximum ${MAX_DEVICE_ACCOUNTS} accounts can be active on this device at once. Remove an account from Switch Account first.`,
        };
      }

      const existingProfile = await getUserProfileFromFirestore(fbUser.uid).catch(() => null);
      const hasPass =
        hasFirebasePasswordProvider(fbUser) || Boolean(existingProfile?.hasPassword);
      const completed = existingProfile ? isProfileRegistrationCompleted(existingProfile) : false;

      const userObj: User = existingProfile
        ? {
            ...buildNewUserFromFirebase(fbUser),
            ...existingProfile,
            id: fbUser.uid,
            displayName: existingProfile.displayName || fbUser.displayName || 'Alpha Mate',
            email: (fbUser.email || existingProfile.email || '').toLowerCase(),
            avatar: existingProfile.avatar || fbUser.photoURL || CURRENT_USER.avatar,
            isVerified: resolveUserBlueTickVerified(existingProfile, false),
            isAccountVerified: true,
            greenTick: true,
            emailVerified: true,
            hasPassword: hasPass,
            profileCompleted: completed,
          }
        : buildNewUserFromFirebase(fbUser, {
            isVerified: false,
            isAccountVerified: true,
            greenTick: true,
            emailVerified: true,
            hasPassword: hasPass,
            profileCompleted: false,
            authProvider: 'google',
          });

      syncUserProfileToFirestore(userObj, {
        background: true,
        isNewUserDoc: !existingProfile,
      }).catch(() => {});
      setIsAddingAccount(false);
      setAddingAccountReturnUid(null);
      setFirebaseUser(fbUser);
      setIsEmailVerified(true);
      const restricted = isAccountRestrictedStatus(userObj.accountStatus);
      if (!restricted) {
        syncAccountToDeviceSlot(userObj, fbUser);
      }
      saveUserSession(userObj, !restricted);
      if (!options?.skipRedirect) {
        if (restricted) {
          setScreenHistory(['welcome', 'account_recovery']);
          setCurrentScreenState('account_recovery');
        } else {
          setActiveTabState('home');
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
      const cleanEmail = email.trim().toLowerCase();
      const currentSaved = loadSavedDeviceAccounts();
      const emailAlreadyOnDevice = currentSaved.some(
        (a) => a.email?.toLowerCase() === cleanEmail
      );
      if (!emailAlreadyOnDevice && currentSaved.length >= MAX_DEVICE_ACCOUNTS) {
        return {
          success: false,
          error: `Maximum ${MAX_DEVICE_ACCOUNTS} accounts can be saved on this device at once. Remove an account from Switch Account first.`,
        };
      }

      const fbUser = await signInWithEmail(cleanEmail, pass);
      const remoteProfile = await getUserProfileFromFirestore(fbUser.uid).catch(() => null);
      const verified = isFirebaseUserVerified(fbUser) || Boolean(remoteProfile?.emailOtpVerified);
      setFirebaseUser(fbUser);
      setIsEmailVerified(verified);

      const completed = remoteProfile ? isProfileRegistrationCompleted(remoteProfile) : false;

      const userObj: User = remoteProfile
        ? {
            ...buildNewUserFromFirebase(fbUser),
            ...remoteProfile,
            id: fbUser.uid,
            email: (fbUser.email || remoteProfile.email || cleanEmail).toLowerCase(),
            isVerified: resolveUserBlueTickVerified(remoteProfile, false),
            isAccountVerified: verified || resolveUserGreenTickVerified(remoteProfile, false),
            greenTick: verified || resolveUserGreenTickVerified(remoteProfile, false),
            emailVerified: verified,
            hasPassword: true,
            profileCompleted: completed,
          }
        : buildNewUserFromFirebase(fbUser, {
            email: cleanEmail,
            isVerified: false,
            isAccountVerified: verified,
            greenTick: verified,
            emailVerified: verified,
            hasPassword: true,
            profileCompleted: false,
          });

      if (!verified) {
        saveUserSession(userObj, false);
        return {
          success: false,
          needsVerification: true,
          user: userObj,
          error: 'Please verify your email address using the 6-digit OTP code sent to your inbox.',
        };
      }

      const restricted = isAccountRestrictedStatus(userObj.accountStatus);
      setIsAddingAccount(false);
      setAddingAccountReturnUid(null);
      await syncUserProfileToFirestore(userObj, { background: true }).catch(() => {});
      if (!restricted) {
        syncAccountToDeviceSlot(userObj, fbUser);
      }
      saveUserSession(userObj, !restricted);
      if (restricted) {
        setScreenHistory(['welcome', 'account_recovery']);
        setCurrentScreenState('account_recovery');
      } else {
        setActiveTabState('home');
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
      const fbUser = await registerWithEmail(data.email, data.pass, { skipVerificationEmail: true });
      const verified = isFirebaseUserVerified(fbUser);
      setFirebaseUser(fbUser);
      setIsEmailVerified(verified);

      const newUser = buildNewUserFromFirebase(fbUser, {
        username: data.username.trim().toLowerCase(),
        displayName: data.displayName.trim() || data.username.trim(),
        email: data.email.trim().toLowerCase(),
        isVerified: false,
        hasPassword: true,
        profileCompleted: false,
        authProvider: 'email',
      });

      await syncUserProfileToFirestore(newUser, { isNewUserDoc: true });
      saveUserSession(newUser, verified);

      if (!verified) {
        return { success: true, needsVerification: true, user: newUser };
      }

      setIsAddingAccount(false);
      setAddingAccountReturnUid(null);
      syncAccountToDeviceSlot(newUser, fbUser);
      setScreenHistory(['home']);
      setCurrentScreenState('home');
      return { success: true, user: newUser };
    } catch (error: any) {
      console.error('Firebase Email Registration error:', error);
      return { success: false, error: error.message || 'Email registration failed' };
    }
  };

  const sendPreSignupEmailOtp = async (email: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const currentSaved = loadSavedDeviceAccounts();
    const alreadySaved = currentSaved.some((a) => a.email?.toLowerCase() === cleanEmail);
    if (!alreadySaved && currentSaved.length >= MAX_DEVICE_ACCOUNTS) {
      return {
        success: false,
        code: 'MAX_ACCOUNTS_REACHED',
        error: `You already have ${MAX_DEVICE_ACCOUNTS} accounts saved on this device. Remove one account from Switch Account to sign up a new one.`,
      };
    }

    const res = await requestPreSignupEmailOtp(cleanEmail);
    return {
      success: Boolean(res?.success),
      emailMasked: res?.emailMasked,
      challengeToken: res?.challengeToken,
      expiresAt: res?.expiresAt,
      cooldownSeconds: res?.cooldownSeconds,
      retryAfterSeconds: res?.retryAfterSeconds,
      provider: res?.provider,
      code: res?.code,
      error: res?.error,
    };
  };

  const verifyPreSignupEmailOtp = async (email: string, challengeToken: string, otp: string) => {
    const res = await confirmPreSignupEmailOtp({
      email: email.trim().toLowerCase(),
      challengeToken,
      otp,
    });
    return {
      success: Boolean(res?.success),
      registrationTicket: res?.registrationTicket,
      emailVerifiedAt: res?.emailVerifiedAt,
      code: res?.code,
      remainingAttempts: res?.remainingAttempts,
      error: res?.error,
    };
  };

  const completePreSignupPassword = async (
    email: string,
    password: string,
    registrationTicket: string
  ) => {
    const cleanEmail = email.trim().toLowerCase();
    const completeRes = await finalizePreSignupWithPassword({
      email: cleanEmail,
      password,
      registrationTicket,
    });
    if (!completeRes?.success) {
      return {
        success: false,
        code: completeRes?.code,
        error: completeRes?.error || 'Could not save password. Please try again.',
      };
    }

    try {
      let fbUser: FirebaseUser | null = null;

      if (completeRes.clientCompleteFallback) {
        try {
          fbUser = await registerWithEmail(cleanEmail, password, { skipVerificationEmail: true });
        } catch (regErr: any) {
          if (regErr?.code === 'auth/email-already-in-use') {
            fbUser = await signInWithEmail(cleanEmail, password);
          } else {
            throw regErr;
          }
        }
      } else {
        // Sign in with Email + Password so Firebase stores a durable password refresh token for multi-account switching
        try {
          fbUser = await signInWithEmail(cleanEmail, password);
        } catch {
          if (completeRes.customToken) {
            fbUser = await signInWithFirebaseCustomToken(completeRes.customToken);
          }
        }
      }

      if (!fbUser) {
        return {
          success: false,
          error: 'Account created, please sign in with your email and password.',
        };
      }

      await fbUser.getIdToken(true).catch(() => {});
      const verifiedAtIso = completeRes.emailVerifiedAt || new Date().toISOString();
      const existingProfile = await getUserProfileFromFirestore(fbUser.uid).catch(() => null);
      const alreadyCompleted = existingProfile
        ? isProfileRegistrationCompleted(existingProfile)
        : false;

      const userObj: User = existingProfile
        ? {
            ...buildNewUserFromFirebase(fbUser),
            ...existingProfile,
            id: fbUser.uid,
            email: cleanEmail,
            isVerified: resolveUserBlueTickVerified(existingProfile, false),
            isAccountVerified: true,
            greenTick: true,
            emailVerified: true,
            emailOtpVerified: true,
            emailOtpVerifiedAt: existingProfile.emailOtpVerifiedAt || verifiedAtIso,
            hasPassword: true,
            profileCompleted: alreadyCompleted,
          }
        : buildNewUserFromFirebase(fbUser, {
            email: cleanEmail,
            isVerified: false,
            isAccountVerified: true,
            greenTick: true,
            emailVerified: true,
            emailOtpVerified: true,
            emailOtpVerifiedAt: verifiedAtIso,
            hasPassword: true,
            profileCompleted: false,
            authProvider: 'email',
          });

      await syncUserProfileToFirestore(userObj, { isNewUserDoc: !existingProfile }).catch((err) => {
        console.warn('Initial Firestore profile write warning:', err);
      });

      setIsAddingAccount(false);
      setAddingAccountReturnUid(null);
      setFirebaseUser(fbUser);
      setIsEmailVerified(true);
      const restricted = isAccountRestrictedStatus(userObj.accountStatus);
      if (!restricted) {
        syncAccountToDeviceSlot(userObj, fbUser);
      }
      saveUserSession(userObj, !restricted);
      if (restricted) {
        setScreenHistory(['welcome', 'account_recovery']);
        setCurrentScreenState('account_recovery');
      } else {
        setActiveTabState('home');
        setScreenHistory(['home']);
        setCurrentScreenState('home');
      }
      return { success: true, user: userObj };
    } catch (err: any) {
      console.error('Complete Pre-Signup Password error:', err);
      return {
        success: false,
        error: err?.message || 'Unable to finalize account creation. Please try signing in.',
      };
    }
  };

  const checkUsernameAvailable = async (username: string): Promise<boolean> => {
    const clean = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (clean.length < 3) return false;
    const uid = auth.currentUser?.uid || firebaseUser?.uid || currentUser.id;
    const takenInLocal = realUsers.some(
      (u) => u.id !== uid && u.username?.trim().toLowerCase() === clean
    );
    if (takenInLocal) return false;
    return checkUsernameAvailabilityFirestore(clean, uid);
  };

  const completeInAppProfileRegistration = async (data: {
    avatar: string;
    displayName: string;
    username: string;
    gender: 'male' | 'female' | 'other';
    dob: string;
    age: number;
    bio: string;
    password?: string;
  }): Promise<{ success: boolean; user?: User; error?: string }> => {
    const activeFb = auth.currentUser || firebaseUser;
    if (!activeFb?.uid) {
      return { success: false, error: 'No active authenticated account found. Please sign in again.' };
    }

    const cleanName = data.displayName.trim();
    const cleanUsername = data.username
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '');
    const cleanBio = data.bio.trim();

    if (cleanName.length < 2) {
      return { success: false, error: 'Please enter your full display name (at least 2 characters).' };
    }
    if (cleanUsername.length < 3) {
      return { success: false, error: 'Username must be at least 3 letters/numbers.' };
    }
    if (!data.dob || Number(data.age) < 18) {
      return { success: false, error: 'You must be at least 18 years old to register on Alpha Mate.' };
    }

    const isAvailable = await checkUsernameAvailable(cleanUsername);
    if (!isAvailable) {
      return {
        success: false,
        error: `@${cleanUsername} is already taken by another member. Please choose a unique username.`,
      };
    }

    const alreadyHasPassword =
      Boolean(currentUser.hasPassword) || hasFirebasePasswordProvider(activeFb);

    if (!alreadyHasPassword || (data.password && data.password.length > 0)) {
      const pass = String(data.password || '');
      if (pass.length < 6) {
        return {
          success: false,
          error: 'Please create a password (at least 6 characters) so you can also sign in with Email & Password.',
        };
      }

      try {
        await linkOrSetUserPassword(activeFb.email || currentUser.email || '', pass);
      } catch (linkErr: any) {
        // Fallback to server-side Cloud Function if recent-login or provider state requires Admin SDK
        const cloudSet = await setCloudAccountPassword(pass);
        if (!cloudSet.success) {
          return {
            success: false,
            error:
              linkErr?.message ||
              cloudSet.error ||
              'Could not save password for this account. Please try again.',
          };
        }
      }
    }

    const refreshedFb = (await reloadCurrentFirebaseUser().catch(() => null)) || auth.currentUser || activeFb;
    await refreshedFb.getIdToken(true).catch(() => {});

    const nowIso = new Date().toISOString();
    const updatedUser: User = {
      ...currentUser,
      id: refreshedFb.uid,
      email: (refreshedFb.email || currentUser.email || '').trim().toLowerCase(),
      avatar: data.avatar || currentUser.avatar,
      displayName: cleanName,
      username: cleanUsername,
      gender: data.gender,
      dob: data.dob,
      age: Number(data.age),
      bio: cleanBio || '🌟 Alpha Mate Official Member | LIVE • PARTY • SOCIAL 💜',
      isVerified: Boolean(currentUser.isVerified),
      hasPassword: true,
      profileCompleted: true,
      lastNameChangeDate: currentUser.lastNameChangeDate || nowIso,
      lastUsernameChangeDate: currentUser.lastUsernameChangeDate || nowIso,
    };

    try {
      await syncUserProfileToFirestore(updatedUser);
    } catch (err) {
      console.warn('Foreground profile registration write warning (saved locally):', err);
      await syncUserProfileToFirestore(updatedUser, { background: true }).catch(() => {});
    }

    setFirebaseUser(refreshedFb);
    setIsEmailVerified(true);
    saveUserSession(updatedUser, true);
    syncAccountToDeviceSlot(updatedUser, refreshedFb);

    setRegisteredUsers((users) => {
      const without = users.filter((u) => u.id !== updatedUser.id);
      const next = [updatedUser, ...without];
      try {
        localStorage.setItem('alphamate_registered_users', JSON.stringify(next));
      } catch {}
      return next;
    });

    return { success: true, user: updatedUser };
  };

  const teardownActiveRoomMedia = () => {
    if (activePartyRoom) {
      agoraPartyEngine.stopPartyVoice(activePartyRoom.id).catch(() => {});
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
  };

  const switchAccount = async (targetUid: string): Promise<{ success: boolean; error?: string }> => {
    const cleanUid = String(targetUid || '').trim();
    if (!cleanUid) {
      return { success: false, error: 'Invalid account selected.' };
    }

    if (
      cleanUid === auth.currentUser?.uid &&
      isAuthenticated &&
      isEmailVerified &&
      !isAddingAccount
    ) {
      setShowAccountSwitcherModal(false);
      setActiveTabState('home');
      setScreenHistory(['home']);
      setCurrentScreenState('home');
      return { success: true };
    }

    // Snapshot outgoing account token blob before switching
    if (auth.currentUser && currentUser?.id === auth.currentUser.uid && isAuthenticated) {
      syncAccountToDeviceSlot(currentUser, auth.currentUser);
    }

    const slots = loadSavedDeviceAccounts();
    const targetSlot = slots.find((s) => s.uid === cleanUid);
    if (!targetSlot) {
      return { success: false, error: 'Account slot not found on this device.' };
    }

    teardownActiveRoomMedia();

    let switchedFbUser = await hydrateFirebaseUserOnDefaultAuth(targetSlot.firebaseUserBlob);

    if (!switchedFbUser && targetSlot.switchSessionId && targetSlot.switchTicket) {
      const redeemed = await redeemCloudDeviceSwitchSession({
        sessionId: targetSlot.switchSessionId,
        switchTicket: targetSlot.switchTicket,
        deviceFingerprint: getOrCreateDeviceFingerprint(),
      });
      if (redeemed.success && redeemed.customToken) {
        switchedFbUser = await signInWithFirebaseCustomToken(redeemed.customToken).catch(() => null);
      }
    }

    if (!switchedFbUser) {
      return {
        success: false,
        error: 'Saved session for this account needs a one-time refresh. Please sign in once to re-link it.',
      };
    }

    const remoteProfile = await getUserProfileFromFirestore(switchedFbUser.uid).catch(() => null);
    const hasPass =
      hasFirebasePasswordProvider(switchedFbUser) ||
      Boolean(remoteProfile?.hasPassword) ||
      Boolean(targetSlot.hasPassword);
    const completed = remoteProfile
      ? isProfileRegistrationCompleted(remoteProfile)
      : Boolean(targetSlot.profileCompleted);

    const mergedUser: User = {
      ...buildNewUserFromFirebase(switchedFbUser),
      uniqueId: targetSlot.uniqueId,
      username: targetSlot.username,
      displayName: targetSlot.displayName,
      email: targetSlot.email,
      avatar: targetSlot.avatar,
      vipTier: targetSlot.vipTier,
      level: targetSlot.level,
      ...(remoteProfile || {}),
      id: switchedFbUser.uid,
      isVerified: resolveUserBlueTickVerified(remoteProfile, false),
      hasPassword: hasPass,
      profileCompleted: completed,
    };

    setIsAddingAccount(false);
    setAddingAccountReturnUid(null);
    setFirebaseUser(switchedFbUser);
    setIsEmailVerified(true);
    const restricted = isAccountRestrictedStatus(mergedUser.accountStatus);
    saveUserSession(mergedUser, !restricted);
    if (!restricted) {
      syncAccountToDeviceSlot(mergedUser, switchedFbUser);
    }
    setShowAccountSwitcherModal(false);

    if (restricted) {
      setScreenHistory(['welcome', 'account_recovery']);
      setCurrentScreenState('account_recovery');
    } else {
      setActiveTabState('home');
      setScreenHistory(['home']);
      setCurrentScreenState('home');
    }
    return { success: true };
  };

  const startAddAccountFlow = async (
    targetScreen: 'register' | 'signin' = 'register'
  ): Promise<{ success: boolean; error?: string }> => {
    if (auth.currentUser && currentUser?.id === auth.currentUser.uid && isAuthenticated) {
      syncAccountToDeviceSlot(currentUser, auth.currentUser);
    }

    const currentSlots = loadSavedDeviceAccounts();
    if (currentSlots.length >= MAX_DEVICE_ACCOUNTS) {
      return {
        success: false,
        error: `You already have ${MAX_DEVICE_ACCOUNTS} accounts saved. Remove one account first to add another.`,
      };
    }

    const returnUid = auth.currentUser?.uid || currentSlots[0]?.uid || null;
    teardownActiveRoomMedia();
    setShowAccountSwitcherModal(false);
    setIsAddingAccount(true);
    setAddingAccountReturnUid(returnUid);
    setLegalConsent({ terms: true, privacy: true });

    await clearDefaultAuthCurrentUser();
    setFirebaseUser(null);
    setIsEmailVerified(false);
    setIsAuthenticated(false);

    setScreenHistory(['welcome', targetScreen]);
    setCurrentScreenState(targetScreen);
    return { success: true };
  };

  const cancelAddAccountFlow = async (): Promise<void> => {
    const slots = loadSavedDeviceAccounts();
    const fallbackUid = addingAccountReturnUid || slots[0]?.uid || null;
    setIsAddingAccount(false);
    setAddingAccountReturnUid(null);

    if (fallbackUid) {
      const switched = await switchAccount(fallbackUid);
      if (switched.success) return;
    }
    setScreenHistory(['welcome']);
    setCurrentScreenState('welcome');
  };

  const removeSavedAccount = async (uid: string): Promise<void> => {
    const cleanUid = String(uid || '').trim();
    const updated = removeSavedDeviceAccount(cleanUid);
    setSavedAccounts(updated);

    if (cleanUid && (cleanUid === currentUser.id || cleanUid === auth.currentUser?.uid)) {
      if (updated.length > 0) {
        const switched = await switchAccount(updated[0].uid);
        if (switched.success) return;
      }
      await performCleanLogout();
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
        ? {
            ...buildNewUserFromFirebase(refreshed),
            ...remoteProfile,
            id: refreshed.uid,
            isVerified: resolveUserBlueTickVerified(remoteProfile, false),
            isAccountVerified: true,
            greenTick: true,
            emailVerified: true,
            profileCompleted: isProfileRegistrationCompleted(remoteProfile),
          }
        : buildNewUserFromFirebase(refreshed, {
            isVerified: false,
            isAccountVerified: true,
            greenTick: true,
            emailVerified: true,
            profileCompleted: false,
          });
      const restricted = isAccountRestrictedStatus(userObj.accountStatus);
      await syncUserProfileToFirestore(userObj, { background: true }).catch(() => {});
      if (!restricted) {
        syncAccountToDeviceSlot(userObj, refreshed);
      }
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
    const outgoingUid = auth.currentUser?.uid || currentUser?.id || '';
    teardownActiveRoomMedia();

    const remainingAccounts = outgoingUid
      ? removeSavedDeviceAccount(outgoingUid)
      : loadSavedDeviceAccounts();
    setSavedAccounts(remainingAccounts);

    if (remainingAccounts.length > 0) {
      const switched = await switchAccount(remainingAccounts[0].uid);
      if (switched.success) {
        return;
      }
    }

    try {
      await logoutUser();
    } catch (e) {
      console.warn('Firebase logout warning:', e);
    }

    setIsAddingAccount(false);
    setAddingAccountReturnUid(null);
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

  const sendSignupEmailOtp = async (displayName?: string) => {
    const email = (auth.currentUser?.email || firebaseUser?.email || currentUser?.email || '').trim().toLowerCase();
    const nameToSend = (displayName || currentUserRef.current?.displayName || '').trim();
    const res = await requestAuthenticatedEmailOtp({
      purpose: 'signup',
      email,
      displayName: nameToSend,
    });
    if (res?.alreadyVerified) {
      await refreshFirebaseVerification().catch(() => false);
    }
    return {
      success: Boolean(res?.success),
      alreadyVerified: Boolean(res?.alreadyVerified),
      emailMasked: res?.emailMasked,
      challengeToken: res?.challengeToken,
      expiresAt: res?.expiresAt,
      cooldownSeconds: res?.cooldownSeconds,
      retryAfterSeconds: res?.retryAfterSeconds,
      provider: res?.provider,
      code: res?.code,
      error: res?.error,
    };
  };

  const verifySignupEmailOtp = async (challengeToken: string, otp: string) => {
    const res = await confirmAuthenticatedEmailOtp({
      purpose: 'signup',
      challengeToken,
      otp,
    });
    if (!res?.success) {
      return {
        success: false,
        code: res?.code,
        remainingAttempts: res?.remainingAttempts,
        error: res?.error || 'OTP verification failed.',
      };
    }

    const verifiedAtIso = res.emailVerifiedAt || new Date().toISOString();
    const refreshedFbUser = (await reloadCurrentFirebaseUser().catch(() => null)) || auth.currentUser || firebaseUser;
    if (refreshedFbUser) {
      await refreshedFbUser.getIdToken(true).catch(() => {});
    }
    const remoteProfile = refreshedFbUser
      ? await getUserProfileFromFirestore(refreshedFbUser.uid).catch(() => null)
      : null;

    const baseUser = refreshedFbUser ? buildNewUserFromFirebase(refreshedFbUser) : currentUserRef.current;
    const existingLocal =
      currentUserRef.current?.id === refreshedFbUser?.uid ? currentUserRef.current : null;
    const mergedUser: User = {
      ...baseUser,
      ...(remoteProfile || {}),
      ...(existingLocal || {}),
      id: refreshedFbUser?.uid || baseUser.id,
      email: (refreshedFbUser?.email || remoteProfile?.email || baseUser.email || '').toLowerCase(),
      isVerified: resolveUserBlueTickVerified(remoteProfile, Boolean(existingLocal?.isVerified)),
      isAccountVerified: true,
      greenTick: true,
      emailVerified: true,
      emailOtpVerified: true,
      emailOtpVerifiedAt: verifiedAtIso,
      profileCompleted: remoteProfile ? isProfileRegistrationCompleted(remoteProfile) : false,
    };

    await syncUserProfileToFirestore(mergedUser, { background: true }).catch(() => {});
    if (refreshedFbUser) {
      setFirebaseUser(refreshedFbUser);
    }
    setIsAddingAccount(false);
    setAddingAccountReturnUid(null);
    setIsEmailVerified(true);
    const restricted = isAccountRestrictedStatus(mergedUser.accountStatus);
    if (!restricted && refreshedFbUser) {
      syncAccountToDeviceSlot(mergedUser, refreshedFbUser);
    }
    saveUserSession(mergedUser, !restricted);
    if (restricted) {
      setScreenHistory(['welcome', 'account_recovery']);
      setCurrentScreenState('account_recovery');
    } else {
      setScreenHistory(['home']);
      setCurrentScreenState('home');
    }

    return {
      success: true,
      emailVerifiedAt: verifiedAtIso,
    };
  };

  const sendLoginEmailOtp = async (email: string) => {
    const res = await requestLoginEmailOtp(email);
    return {
      success: Boolean(res?.success),
      emailMasked: res?.emailMasked,
      challengeToken: res?.challengeToken,
      expiresAt: res?.expiresAt,
      cooldownSeconds: res?.cooldownSeconds,
      retryAfterSeconds: res?.retryAfterSeconds,
      provider: res?.provider,
      code: res?.code,
      error: res?.error,
    };
  };

  const verifyLoginEmailOtp = async (email: string, challengeToken: string, otp: string) => {
    const res = await confirmLoginEmailOtp({ email, challengeToken, otp });
    if (!res?.success || !res.customToken) {
      return {
        success: false,
        code: res?.code,
        remainingAttempts: res?.remainingAttempts,
        error: res?.error || 'Invalid or expired verification code.',
      };
    }

    try {
      const fbUser = await signInWithFirebaseCustomToken(res.customToken);
      await fbUser.getIdToken(true).catch(() => {});
      const verifiedAtIso = res.emailVerifiedAt || new Date().toISOString();
      const remoteProfile = await getUserProfileFromFirestore(fbUser.uid).catch(() => null);

      const userObj: User = remoteProfile
        ? {
            ...buildNewUserFromFirebase(fbUser),
            ...remoteProfile,
            id: fbUser.uid,
            email: (fbUser.email || remoteProfile.email || email).toLowerCase(),
            isVerified: resolveUserBlueTickVerified(remoteProfile, false),
            isAccountVerified: true,
            greenTick: true,
            emailVerified: true,
            emailOtpVerified: true,
            emailOtpVerifiedAt: remoteProfile.emailOtpVerifiedAt || verifiedAtIso,
            profileCompleted: isProfileRegistrationCompleted(remoteProfile),
          }
        : buildNewUserFromFirebase(fbUser, {
            email: email.trim().toLowerCase(),
            isVerified: false,
            isAccountVerified: true,
            greenTick: true,
            emailVerified: true,
            emailOtpVerified: true,
            emailOtpVerifiedAt: verifiedAtIso,
            profileCompleted: false,
          });

      setIsAddingAccount(false);
      setAddingAccountReturnUid(null);
      setFirebaseUser(fbUser);
      setIsEmailVerified(true);
      const restricted = isAccountRestrictedStatus(userObj.accountStatus);
      await syncUserProfileToFirestore(userObj, { background: true }).catch(() => {});
      if (!restricted) {
        syncAccountToDeviceSlot(userObj, fbUser);
      }
      saveUserSession(userObj, !restricted);
      if (restricted) {
        setScreenHistory(['welcome', 'account_recovery']);
        setCurrentScreenState('account_recovery');
      } else {
        setActiveTabState('home');
        setScreenHistory(['home']);
        setCurrentScreenState('home');
      }
      return { success: true, user: userObj };
    } catch (err: any) {
      console.error('Firebase Custom Token OTP Sign-In error:', err);
      return {
        success: false,
        error: err?.message || 'Could not complete Email OTP sign-in.',
      };
    }
  };

  const sendAccountDeletionOtp = async () => {
    const email = (auth.currentUser?.email || firebaseUser?.email || currentUser?.email || '').trim().toLowerCase();
    const res = await requestAuthenticatedEmailOtp({
      purpose: 'account_deletion',
      email,
    });
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
    const res = await confirmAuthenticatedEmailOtp({
      purpose: 'account_deletion',
      challengeToken,
      otp,
    });
    return {
      success: Boolean(res?.success),
      otpVerifiedAt: res?.otpVerifiedAt,
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
      if (isAuthenticated && auth.currentUser?.uid === updated.id) {
        syncAccountToDeviceSlot(updated, auth.currentUser);
      }
      syncUserProfileToFirestore(updated, { background: true }).catch(() => {});

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
    if (adminModerationState.isLiveRestricted && adminModerationState.liveRestriction) {
      setActiveFeatureRestrictionModal({
        scope: 'live',
        detail: adminModerationState.liveRestriction,
      });
      return;
    }
    setActiveGiftBanner(null);
    if (activePartyRoom) {
      realtimeSocket.leaveRoom('party', activePartyRoom.id);
      agoraPartyEngine.stopPartyVoice(activePartyRoom.id, true).catch(() => {});
      setActivePartyRoom(null);
      setUserSeatIndex(null);
      setIsMicMuted(false);
    }
    if (stream.isPK) {
      openPKBattle(stream);
    } else {
      setActiveStream(stream);
      setCurrentScreen('live_stream');
    }
  };

  const publishLiveStream = async (publishedStream: LiveStream) => {
    if (adminModerationState.isLiveRestricted && adminModerationState.liveRestriction) {
      setActiveFeatureRestrictionModal({
        scope: 'live',
        detail: adminModerationState.liveRestriction,
      });
      return;
    }
    const hostId = publishedStream.host?.id || auth.currentUser?.uid || currentUser.id;
    removedLiveUntilRef.current.delete(publishedStream.id);

    // Clean up any other Solo Live card owned by this host so strictly 1 card exists
    liveStreams.forEach((s) => {
      if (s.host?.id === hostId && s.id !== publishedStream.id) {
        removedLiveUntilRef.current.set(s.id, Date.now());
        realtimeSocket.removeLiveStream(s.id);
        deleteLiveStreamFromFirestore(s.id).catch(() => {});
      }
    });

    realtimeSocket.announceLiveStream(publishedStream);
    setActiveStream((prev) => (prev && prev.id === publishedStream.id ? publishedStream : prev));
    setLiveStreams((prev) => {
      const withoutHost = prev.filter((s) => s.id !== publishedStream.id && s.host?.id !== hostId);
      return [publishedStream, ...withoutHost];
    });

    // Sync to Firestore in background without tearing down the live WebSocket broadcast if Spark quota is full
    syncLiveStreamToFirestore(publishedStream)
      .then(() => {
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
      })
      .catch((err) => {
        console.warn('Live stream Firestore persistence warning (WebSocket broadcast active):', err);
      });
  };

  const closeLiveStream = () => {
    setActiveGiftBanner(null);
    if (activeStream) {
      const streamToClose = activeStream;
      const hostUid = auth.currentUser?.uid || currentUser.id;
      const isOwnerHost =
        streamToClose.host.id === currentUser.id ||
        Boolean(auth.currentUser?.uid && streamToClose.host.id === auth.currentUser.uid) ||
        streamToClose.id.startsWith('live_my_') ||
        streamToClose.id.startsWith('live_host_');

      if (isOwnerHost) {
        removedLiveUntilRef.current.set(streamToClose.id, Date.now());
        realtimeSocket.sendRoomSignal('live', streamToClose.id, { type: 'stream_ended' });
        realtimeSocket.leaveRoom('live', streamToClose.id);
        realtimeSocket.removeLiveStream(streamToClose.id);
        p2pStreamingEngine.stopHostBroadcast(streamToClose.id).catch(() => {});
        deleteLiveStreamFromFirestore(streamToClose.id).catch(() => {});
        if (auth.currentUser?.uid) {
          purgeStaleHostCardsInFirestore(auth.currentUser.uid, {
            keepPartyId: getCanonicalPartyRoomId(auth.currentUser.uid),
            keepLiveId: null,
          }).catch(() => {});
        }
        setLiveStreams((prev) =>
          prev.filter((s) => s.id !== streamToClose.id && s.host?.id !== hostUid)
        );
      } else {
        realtimeSocket.leaveRoom('live', streamToClose.id);
        p2pStreamingEngine.unsubscribeFromRemoteBroadcast(streamToClose.id).catch(() => {});
      }
    }
    setActiveStream(null);
    navigateBack();
  };

  const openPKBattle = (stream: LiveStream) => {
    setActiveGiftBanner(null);
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
    // Authoritative catalog price lookup to prevent client-side coin tampering
    const authoritativeGift =
      publishedCatalogGifts.find((g) => g.id === gift.id) ||
      VIRTUAL_GIFTS.find((g) => g.id === gift.id) ||
      gift;
    const unitCoins = Math.max(1, Math.floor(authoritativeGift.coins || gift.coins || 1));
    const totalCoins = unitCoins * qty;
    const hostDiamonds = Math.round(totalCoins * 0.6);
    const appShareCoins = totalCoins - hostDiamonds;

    if (coins < totalCoins) {
      return { success: false, hostDiamonds, appShareCoins, totalCoins };
    }

    if (firebaseUser?.uid && (meta?.roomId || meta?.streamId)) {
      void validateGiftSendOnServer({
        giftId: authoritativeGift.id,
        unitCoins,
        quantity: qty,
        roomType: meta?.context === 'party' ? 'party' : 'live',
        roomId: meta?.roomId || meta?.streamId || 'room',
        recipientId: recipientHostId || activeStream?.host.id || activePartyRoom?.host.id || currentUser.id,
      });
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

    const prevCoinsSnapshot = coins;
    const prevDiamondsSnapshot = diamonds;
    const txId = buildIdempotentTxId('gift');
    const localLedgerId = firebaseUser?.uid ? txId : `local_gift_${Date.now()}`;
    const ledgerItem: GiftTransactionRecord = {
      id: localLedgerId,
      senderId: firebaseUser?.uid || currentUser.id,
      senderName: currentUser.displayName,
      recipientId: effectiveRecipientId,
      recipientName: resolvedRecipientName,
      giftId: authoritativeGift.id,
      giftName: authoritativeGift.name,
      giftIcon: authoritativeGift.icon,
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
      const updated = [ledgerItem, ...prev.filter((x) => x.id !== localLedgerId && !x.id.startsWith('pending_'))];
      try {
        localStorage.setItem('alphamate_gift_transactions', JSON.stringify(updated.slice(0, 100)));
      } catch {}
      return updated;
    });

    if (firebaseUser?.uid) {
      executeSixtyFortyGiftTransaction({
        txId,
        senderId: firebaseUser.uid,
        senderName: currentUser.displayName,
        senderAvatar: currentUser.avatar,
        recipientId: effectiveRecipientId,
        recipientName: resolvedRecipientName,
        giftId: authoritativeGift.id,
        giftName: authoritativeGift.name,
        giftIcon: authoritativeGift.icon,
        unitCoins,
        quantity: qty,
        context,
        roomId: meta?.roomId,
        streamId: meta?.streamId,
        reelId: meta?.reelId,
      })
        .then((res) => {
          if (typeof res.senderNextCoins === 'number') {
            setCoins(res.senderNextCoins);
          }
          if (typeof res.senderNextDiamonds === 'number') {
            setDiamonds(res.senderNextDiamonds);
          }
          setGiftTransactions((prev) =>
            prev.map((g) => (g.id === localLedgerId ? { ...g, id: res.txId } : g))
          );
        })
        .catch((err) => {
          console.error('60/40 Firestore gift transaction failed — rolling back optimistic balance:', err);
          // Roll back local optimistic balances if the atomic Firestore commit was rejected
          setCoins(prevCoinsSnapshot);
          if (isSelfHost) {
            setDiamonds(prevDiamondsSnapshot);
          }
          setGiftTransactions((prev) => prev.filter((g) => g.id !== localLedgerId));
          setTransactions((prev) => prev.filter((t) => t.id !== sentTx.id));
        });
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
    if (activePKBattle?.id) {
      const now = Date.now();
      setActiveGiftBanner({
        id: `pk_banner_${now}_${Math.random().toString(36).slice(2, 7)}`,
        gift: pkGift,
        quantity: 1,
        sender: currentUser.displayName,
        senderAvatar: currentUser.avatar,
        senderVipTier: currentUser.vipTier ?? 0,
        recipient: hostRecipientName,
        context: 'pk',
        streamId: activePKBattle.id,
        createdAtMs: now,
      });
    }
  };

  const sendLiveGift = (
    gift: Gift,
    recipientHostId?: string,
    quantity = 1,
    recipientDisplayName?: string,
    meta?: { context?: 'live' | 'party' | 'moments' | 'pk' | 'demo'; roomId?: string; streamId?: string; reelId?: string }
  ): boolean => {
    const resolvedRecipientName =
      recipientDisplayName ||
      activeStream?.host.displayName ||
      activePartyRoom?.host.displayName ||
      'Host';
    const res = executeGiftEconomy(gift, recipientHostId, quantity, resolvedRecipientName, meta);
    if (!res.success) return false;

    const resolvedContext = meta?.context;
    const resolvedStreamId = meta?.streamId || (resolvedContext === 'live' ? activeStream?.id : undefined);
    const resolvedRoomId = meta?.roomId || (resolvedContext === 'party' ? activePartyRoom?.id : undefined);

    // Scope banner strictly to the active live stream or party room where the gift was sent
    if (
      (resolvedContext === 'live' && resolvedStreamId) ||
      (resolvedContext === 'party' && resolvedRoomId)
    ) {
      const now = Date.now();
      setActiveGiftBanner({
        id: `gift_banner_${now}_${Math.random().toString(36).slice(2, 7)}`,
        gift,
        quantity: Math.max(1, Number(quantity) || 1),
        sender: currentUser.displayName,
        senderAvatar: currentUser.avatar,
        senderVipTier: currentUser.vipTier ?? 0,
        recipient: resolvedRecipientName,
        context: resolvedContext,
        streamId: resolvedStreamId,
        roomId: resolvedRoomId,
        createdAtMs: now,
      });
    }

    return true;
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
        message: `You need ${coinsAmount.toLocaleString()} Coins to run this demo 60/40 split test. Get Coins through an Admin-approved Coin Seller Agency first.`,
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

  const clearActiveGiftBanner = useCallback(() => {
    setActiveGiftBanner(null);
  }, []);

  const openPartyRoom = (room: PartyRoom) => {
    if (adminModerationState.isPartyRestricted && adminModerationState.partyRestriction) {
      setActiveFeatureRestrictionModal({
        scope: 'party',
        detail: adminModerationState.partyRestriction,
      });
      return;
    }
    setActiveGiftBanner(null);
    if (activeStream) {
      realtimeSocket.leaveRoom('live', activeStream.id);
      p2pStreamingEngine.stopHostBroadcast(activeStream.id, true).catch(() => {});
      p2pStreamingEngine.unsubscribeFromRemoteBroadcast(activeStream.id, true).catch(() => {});
      p2pStreamingEngine.stopLocalMediaStream();
      setActiveStream(null);
    }
    const uid = auth.currentUser?.uid || currentUser.id;
    const isOwnerHost = Boolean(uid && room.host?.id === uid);
    const safeSeats = Array.isArray(room.seats) ? room.seats : [];

    // When the Host enters or re-enters their Party Room, seat them directly on the Host Throne
    const nextRoom: PartyRoom = isOwnerHost
      ? {
          ...room,
          seats: safeSeats,
          isHostPresent: true,
          activeViewers: Math.max(1, Number(room.activeViewers) || 0),
        }
      : {
          ...room,
          seats: safeSeats,
        };

    setActivePartyRoom(nextRoom);
    if (isOwnerHost) {
      setPartyRooms((prev) => prev.map((r) => (r.id === nextRoom.id ? nextRoom : r)));
      realtimeSocket.announcePartyRoom({
        id: nextRoom.id,
        ...(nextRoom.sessionId ? { sessionId: nextRoom.sessionId } : {}),
        host: nextRoom.host,
        title: nextRoom.title,
        level: nextRoom.level,
        isActive: true,
        isHostPresent: true,
        activeViewers: nextRoom.activeViewers,
        lastSeenAtMs: Date.now(),
      });
      updatePartyRoomFields(nextRoom.id, {
        isHostPresent: true,
        activeViewers: nextRoom.activeViewers,
      }).catch(() => {});
    }

    const mySeat = safeSeats.find((s: any) => s.user?.id === uid);
    setUserSeatIndex(mySeat ? Number(mySeat.seatIndex) : null);
    setIsMicMuted(mySeat ? Boolean(mySeat.isMuted || mySeat.isHostMuted) : false);
    setCurrentScreen('party_room');
  };

  const closePartyRoom = (shouldDelete = false, options?: { remainingViewers?: number }) => {
    setActiveGiftBanner(null);
    if (activePartyRoom) {
      const roomToClose = activePartyRoom;
      const uid = auth.currentUser?.uid || currentUser.id;
      const isOwnerHost = Boolean(uid && roomToClose.host?.id === uid);

      realtimeSocket.leaveRoom('party', roomToClose.id);
      agoraPartyEngine.stopPartyVoice(roomToClose.id).catch(() => {});

      if (shouldDelete) {
        const targetsMap = new Map<string, PartyRoom>();
        targetsMap.set(roomToClose.id, roomToClose);
        partyRooms.forEach((r) => {
          if (r.host?.id === uid && !targetsMap.has(r.id)) {
            targetsMap.set(r.id, r);
          }
        });
        const deletePromises: Array<Promise<void>> = [];
        targetsMap.forEach((r) => {
          removedPartyUntilRef.current.set(r.id, Date.now());
          realtimeSocket.removePartyRoom(r.id);
          deletePromises.push(deletePartyRoomFromFirestore(r.id, r.sessionId).catch(() => {}));
        });
        Promise.all(deletePromises)
          .then(() => {
            if (auth.currentUser?.uid) {
              return purgeStaleHostCardsInFirestore(auth.currentUser.uid, {
                keepPartyId: null,
                keepLiveId: activeStreamIdRef.current,
              });
            }
            return undefined;
          })
          .catch(() => {});
        setPartyRooms((prev) =>
          prev.filter((r) => r.id !== roomToClose.id && r.host?.id !== uid)
        );
      } else {
        const nextViewers =
          typeof options?.remainingViewers === 'number'
            ? Math.max(0, Math.floor(options.remainingViewers))
            : 0;
        const safeSeats = Array.isArray(roomToClose.seats) ? roomToClose.seats : [];

        if (isOwnerHost) {
          // Host left without closing: Host Seat becomes empty, all session data/entries/gifts remain preserved
          const updatedRoom: PartyRoom = {
            ...roomToClose,
            seats: safeSeats,
            isHostPresent: false,
            activeViewers: nextViewers,
          };
          setPartyRooms((prev) => prev.map((r) => (r.id === roomToClose.id ? updatedRoom : r)));
          realtimeSocket.announcePartyRoom({
            id: roomToClose.id,
            ...(roomToClose.sessionId ? { sessionId: roomToClose.sessionId } : {}),
            isHostPresent: false,
            activeViewers: nextViewers,
            lastSeenAtMs: Date.now(),
          });
          updatePartyRoomFields(roomToClose.id, {
            isHostPresent: false,
            activeViewers: nextViewers,
          }).catch(() => {});
        } else {
          // Guest / Viewer left: release any guest seat they occupied and sync accurate remaining viewer count
          const mySeated = safeSeats.find((s) => s.user?.id === uid);
          const vacatedSeats = mySeated
            ? safeSeats.map((s) =>
                s.user?.id === uid
                  ? { ...s, user: null, isSpeaking: false, isMuted: false, isHostMuted: false }
                  : s
              )
            : safeSeats;
          const updatedRoom: PartyRoom = {
            ...roomToClose,
            seats: vacatedSeats,
            activeViewers: nextViewers,
          };
          setPartyRooms((prev) => prev.map((r) => (r.id === roomToClose.id ? updatedRoom : r)));
          realtimeSocket.announcePartyRoom({
            id: roomToClose.id,
            ...(roomToClose.sessionId ? { sessionId: roomToClose.sessionId } : {}),
            seats: vacatedSeats,
            activeViewers: nextViewers,
          });
          if (mySeated) {
            updatePartyRoomSeat(roomToClose.id, mySeated.seatIndex, null, uid).catch(() => {});
          }
          updatePartyRoomFields(roomToClose.id, { activeViewers: nextViewers }).catch(() => {});
        }
      }
    }
    setActivePartyRoom(null);
    setUserSeatIndex(null);
    setIsMicMuted(false);
    navigateBack();
  };

  const createPartyRoom = async (
    room: PartyRoom
  ): Promise<{ success: boolean; alreadyExists?: boolean; room?: PartyRoom; error?: string }> => {
    if (adminModerationState.isPartyRestricted && adminModerationState.partyRestriction) {
      setActiveFeatureRestrictionModal({
        scope: 'party',
        detail: adminModerationState.partyRestriction,
      });
      return {
        success: false,
        error: `YOUR PARTY ACCESS HAS BEEN RESTRICTED. Reason: ${adminModerationState.partyRestriction.reason}`,
      };
    }
    const firebaseUid = auth.currentUser?.uid;
    if (!firebaseUid) {
      return { success: false, error: 'Please sign in first to host a Party Room.' };
    }

    // Enforce strictly ONE Party Room per host: if host already has an open (not closed) room, re-enter with preserved entries
    const existingMyRoom = partyRooms.find(
      (r) => r.isActive !== false && r.host?.id === firebaseUid
    );
    if (existingMyRoom) {
      openPartyRoom(existingMyRoom);
      return { success: true, alreadyExists: true, room: existingMyRoom };
    }

    const canonicalId = getCanonicalPartyRoomId(firebaseUid);
    removedPartyUntilRef.current.delete(canonicalId);

    // Fresh room after permanent close: assign brand-new sessionId and zero out all seats, gifting & moderation lists
    const freshSessionId = `ps_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const rawSeats = Array.isArray(room.seats) ? room.seats : [];
    const cleanSeats = rawSeats.map((s, idx) => ({
      seatIndex: Number.isFinite(Number(s?.seatIndex)) ? Number(s.seatIndex) : idx,
      user: null,
      isMuted: false,
      isHostMuted: false,
      isLocked: false,
      isSpeaking: false,
      receivedCoins: 0,
    }));

    const normalizedRoom: PartyRoom = {
      ...room,
      id: canonicalId,
      sessionId: freshSessionId,
      isActive: true,
      isHostPresent: true,
      activeViewers: 1,
      totalGiftCoins: 0,
      moderatorIds: [],
      kickedUserIds: [],
      blockedUserIds: [],
      seats: cleanSeats,
      host: { ...room.host, id: firebaseUid },
    };
    try {
      realtimeSocket.announcePartyRoom(normalizedRoom);
      await syncPartyRoomToFirestore(normalizedRoom, { overwrite: true });
      purgeStaleHostCardsInFirestore(firebaseUid, {
        keepPartyId: canonicalId,
        keepLiveId: activeStreamIdRef.current,
      }).catch(() => {});
      setPartyRooms((prev) => [
        normalizedRoom,
        ...prev.filter((r) => r.id !== canonicalId && r.host?.id !== firebaseUid),
      ]);
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
      return { success: true, alreadyExists: false, room: normalizedRoom };
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

  const updateActivePartyRoomLevel = (level: 1 | 2 | 3 | 4) => {
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
    if (seatMutationInFlightRef.current.has(room.id)) {
      return { success: false, reason: 'IN_PROGRESS' };
    }

    const isLeaving = userSeatIndex === seatIndex;
    const effectiveUser = auth.currentUser?.uid ? { ...currentUser, id: auth.currentUser.uid } : currentUser;
    const targetServerSeat = Array.isArray(room.seats)
      ? room.seats.find((s: any) => Number(s.seatIndex) === seatIndex)
      : null;
    const nextSeatMuted = isLeaving ? false : Boolean(targetServerSeat?.isHostMuted);

    seatMutationInFlightRef.current.add(room.id);
    try {
      // Commit atomically in Firestore BEFORE flipping userSeatIndex / Agora role so
      // /api/agora/party/rooms/:roomId/token always sees the committed seat & issues a publisher token.
      const result = await updatePartyRoomSeat(
        room.id,
        seatIndex,
        isLeaving ? null : effectiveUser,
        effectiveUser.id,
        nextSeatMuted
      );

      if (result.success && result.seats) {
        const committedSeats = result.seats;
        const nowMs = Date.now();
        const verifiedRoom: PartyRoom = { ...room, seats: committedSeats, lastSeenAtMs: nowMs };
        setActivePartyRoom((prev) =>
          prev && prev.id === room.id ? { ...prev, seats: committedSeats, lastSeenAtMs: nowMs } : verifiedRoom
        );
        setPartyRooms((prev) =>
          prev.map((item) =>
            item.id === room.id ? { ...item, seats: committedSeats, lastSeenAtMs: nowMs } : item
          )
        );
        const mySeat = committedSeats.find((s: any) => s.user?.id === effectiveUser.id);
        setUserSeatIndex(mySeat ? Number(mySeat.seatIndex) : null);
        if (mySeat) {
          setIsMicMuted(Boolean(mySeat.isMuted || mySeat.isHostMuted));
        } else {
          setIsMicMuted(false);
        }
        realtimeSocket.announcePartyRoom({
          id: room.id,
          seats: result.seats,
          lastSeenAtMs: nowMs,
        });
        return { success: true };
      }

      console.warn('Party seat update rejected:', result.reason);
      return { success: false, reason: result.reason || 'REJECTED' };
    } finally {
      seatMutationInFlightRef.current.delete(room.id);
    }
  };

  const openConversation = (conv: Conversation | null) => {
    setActiveConversation(conv);
    if (conv) {
      setCurrentScreen('chat_conversation');
    } else {
      setActiveTabState('chat');
      setCurrentScreen('chat');
    }
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
    if (!targetUser?.id) return;
    const myUid = auth.currentUser?.uid || currentUser.id;
    if (targetUser.id === myUid) return;

    const chatId = auth.currentUser?.uid
      ? buildDirectChatId(auth.currentUser.uid, targetUser.id)
      : `conv_${targetUser.id}`;

    const existingConv = conversations.find(
      (c) => c.id === chatId || (!c.isGroup && c.user?.id === targetUser.id)
    );
    const convToOpen: Conversation = existingConv || {
      id: chatId,
      user: {
        ...targetUser,
        displayName: targetUser.displayName || 'Alpha Mate User',
        username: targetUser.username || '',
        uniqueId: targetUser.uniqueId || '',
        avatar: targetUser.avatar || DEFAULT_AVATAR_URL,
      },
      lastMessage: 'Selected for chat',
      lastTimestamp: 'Just now',
      unreadCount: 0,
      isGroup: false,
      requestStatus: 'new_request',
      messages: [],
    };
    setActiveConversation(convToOpen);
    setCurrentScreen('chat_conversation');
  };

  const contactAgencyInApp = async (agency: {
    agencyId: string;
    agencyName: string;
    agencyCode?: string;
    ownerUserId: string;
    ownerName?: string;
    ownerAvatar?: string;
  }): Promise<{ success: boolean; message: string }> => {
    const ownerUid = String(agency.ownerUserId || '').trim();
    if (!ownerUid) {
      return {
        success: false,
        message: 'This agency has no linked owner account for in-app messaging yet.',
      };
    }

    const myUid = auth.currentUser?.uid || currentUser.id;
    if (ownerUid === myUid) {
      return {
        success: false,
        message: 'You are the owner of this official agency.',
      };
    }

    const pool = realUsers.length > 0 ? realUsers : registeredUsers;
    let targetUser: User | null =
      pool.find((u) => u.id === ownerUid) || null;

    if (!targetUser) {
      try {
        const fetched = await getUserProfileFromFirestore(ownerUid);
        if (fetched) {
          targetUser = {
            ...CURRENT_USER,
            ...fetched,
            id: ownerUid,
            displayName:
              (fetched.displayName as string) ||
              agency.ownerName ||
              agency.agencyName,
            username:
              (fetched.username as string) ||
              (agency.agencyCode ? agency.agencyCode.toLowerCase() : 'agency'),
            uniqueId: (fetched.uniqueId as string) || agency.agencyCode || '',
            avatar:
              (fetched.avatar as string) ||
              agency.ownerAvatar ||
              DEFAULT_AVATAR_URL,
          };
        }
      } catch {
        // Fallback below uses canonical ownerUserId + agency metadata
      }
    }

    const resolvedUser: User = targetUser || {
      ...CURRENT_USER,
      id: ownerUid,
      uniqueId: agency.agencyCode || '',
      username: (agency.agencyCode || 'agency').toLowerCase(),
      displayName: agency.ownerName || agency.agencyName,
      avatar: agency.ownerAvatar || DEFAULT_AVATAR_URL,
      bio: `Official Representative — ${agency.agencyName}`,
      isVerified: true,
      agencyId: agency.agencyId,
      agencyName: agency.agencyName,
      agencyCode: agency.agencyCode,
    };

    await startDirectMessage(resolvedUser);
    return {
      success: true,
      message: `Opened in-app chat with ${resolvedUser.displayName}.`,
    };
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
    if (!targetVideo) return;
    const willLike = !targetVideo.isLiked;

    // Persist liked reel ID locally per user so real-time snapshots keep the heart lit
    try {
      const uidKey = firebaseUser?.uid || 'guest';
      const storageKey = `alphamate_liked_reels_${uidKey}`;
      const raw = window.localStorage.getItem(storageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      const set = new Set<string>(Array.isArray(parsed) ? parsed : []);
      if (willLike) set.add(videoId);
      else set.delete(videoId);
      window.localStorage.setItem(storageKey, JSON.stringify(Array.from(set).slice(-500)));
    } catch {
      // ignore storage errors
    }

    // Sync with Firestore reel likes (+1 on like, -1 on unlike)
    toggleReelLike(videoId, willLike).catch(() => {});

    setVideos((prev) =>
      prev.map((v) => {
        if (v.id === videoId) {
          return {
            ...v,
            isLiked: willLike,
            likes: willLike ? v.likes + 1 : Math.max(0, v.likes - 1),
          };
        }
        return v;
      })
    );

    if (willLike && targetVideo.user?.id && targetVideo.user.id !== currentUser.id) {
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

  const rechargeCoins = async (_amount: number, _priceUSD: number, _paymentMethod: string): Promise<boolean> => {
    // Online coin purchasing is disabled (Coming Soon) because payment gateways are not attached yet.
    return false;
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
    const matched = notifications.find((n) => n.id === id);
    primaryNotifsRef.current = primaryNotifsRef.current.map((n) =>
      n.id === id ? { ...n, isRead: true } : n
    );
    adminActionNotifsRef.current = adminActionNotifsRef.current.map((n) =>
      n.id === id ? { ...n, isRead: true } : n
    );
    transitionNotifsRef.current = transitionNotifsRef.current.map((n) =>
      n.id === id ? { ...n, isRead: true } : n
    );
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    if (firebaseUser?.uid && !id.startsWith('notif_') && !id.startsWith('local_')) {
      if (matched && matched.sourceCollection && matched.sourceCollection !== 'notifications') {
        markAdminActionItemRead(firebaseUser.uid, matched).catch(() => {});
      } else {
        markFirestoreNotificationRead(firebaseUser.uid, id).catch(() => {});
      }
    }
  };

  const dismissActiveAdminWarning = (markRead = true) => {
    if (activeAdminWarning) {
      dismissedWarningIdsRef.current.add(activeAdminWarning.id);
      if (markRead) {
        markNotificationRead(activeAdminWarning.id);
      }
    }
    setActiveAdminWarning(null);
  };

  const openAdminNotificationDetails = (item: NotificationItem) => {
    if (!item.isRead) {
      markNotificationRead(item.id);
    }
    setSelectedAdminNotification(item);
  };

  const markAllNotificationsRead = () => {
    const unreadItems = notifications.filter((n) => !n.isRead);
    primaryNotifsRef.current = primaryNotifsRef.current.map((n) => ({ ...n, isRead: true }));
    adminActionNotifsRef.current = adminActionNotifsRef.current.map((n) => ({ ...n, isRead: true }));
    transitionNotifsRef.current = transitionNotifsRef.current.map((n) => ({ ...n, isRead: true }));
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    if (firebaseUser?.uid) {
      const fsIds = unreadItems
        .filter((n) => (!n.sourceCollection || n.sourceCollection === 'notifications') && !n.id.startsWith('notif_') && !n.id.startsWith('local_'))
        .map((n) => n.id);
      if (fsIds.length > 0) {
        markAllFirestoreNotificationsRead(firebaseUser.uid, fsIds).catch(() => {});
      }
      unreadItems
        .filter((n) => n.sourceCollection === 'adminActions' || n.sourceCollection === 'warnings')
        .forEach((n) => {
          markAdminActionItemRead(firebaseUser.uid, n).catch(() => {});
        });
    }
  };

  const unreadNotificationsCount = notifications.filter((n) => !n.isRead).length;

  // Automatic silent network recovery when device comes back online
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleOnline = () => {
      recoverFirestoreNetwork().catch(() => {});
      if (auth.currentUser) {
        realtimeSocket.ensureConnected();
      }
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  // Context-aware scoped refresh: recovers stalled network/listeners for ONLY the active view/room
  // without reloading the app, leaving an active Live Broadcast or Party Room, or dropping seats.
  const refreshScope = async (
    requestedScope?: RefreshScope
  ): Promise<{ ok: boolean; message: string }> => {
    const inferredScope: RefreshScope =
      requestedScope ||
      (activeStream && currentScreen === 'live_stream'
        ? 'live_stream'
        : activePartyRoom
        ? 'party_room'
        : (currentScreen as RefreshScope) || 'home');

    const net = await recoverFirestoreNetwork();
    if (!net.online) {
      return {
        ok: false,
        message: net.error || 'No internet connection. Check your network and retry.',
      };
    }

    if (auth.currentUser) {
      await realtimeSocket.forceReconnect().catch(() => {});
    }

    const refreshUserProfileFromServer = async () => {
      const uid = auth.currentUser?.uid || firebaseUser?.uid;
      if (!uid) return;
      try {
        const remote = await getUserProfileFromFirestore(uid);
        if (!remote) return;
        if (typeof remote.coins === 'number') setCoins(remote.coins);
        if (typeof remote.diamonds === 'number') setDiamonds(remote.diamonds);
        if (typeof remote.heldDiamonds === 'number') setHeldDiamonds(remote.heldDiamonds);
        setCurrentUser((prev) => ({
          ...prev,
          ...remote,
          id: uid,
        }));
      } catch {
        // ignore transient errors; listener epoch still rebinds
      }
    };

    switch (inferredScope) {
      case 'live_stream': {
        if (activeStream?.id) {
          const freshStream = await fetchLiveStreamFromServer(activeStream.id);
          if (freshStream && freshStream.isActive !== false) {
            setActiveStream((prev) => (prev && prev.id === freshStream.id ? { ...prev, ...freshStream } : prev));
          }
        }
        setLiveRefreshTick((n) => n + 1);
        setDiscoveryRefreshEpoch((n) => n + 1);
        return { ok: true, message: 'Live broadcast refreshed' };
      }
      case 'party_room': {
        if (activePartyRoom?.id) {
          const freshRoom = await fetchPartyRoomFromServer(activePartyRoom.id);
          if (freshRoom && freshRoom.isActive !== false) {
            setActivePartyRoom((prev) => (prev && prev.id === freshRoom.id ? { ...prev, ...freshRoom } : prev));
          }
        }
        setPartyRefreshTick((n) => n + 1);
        setDiscoveryRefreshEpoch((n) => n + 1);
        return { ok: true, message: 'Party room refreshed' };
      }
      case 'party': {
        setDiscoveryRefreshEpoch((n) => n + 1);
        return { ok: true, message: 'Party rooms updated' };
      }
      case 'moments': {
        setReelsRefreshEpoch((n) => n + 1);
        setUserSyncRefreshEpoch((n) => n + 1);
        return { ok: true, message: 'Moments feed refreshed' };
      }
      case 'chat': {
        setChatRefreshEpoch((n) => n + 1);
        setUserSyncRefreshEpoch((n) => n + 1);
        return { ok: true, message: 'Chats synced' };
      }
      case 'search': {
        setUserSyncRefreshEpoch((n) => n + 1);
        return { ok: true, message: 'User directory refreshed' };
      }
      case 'leaderboard': {
        setLeaderboardRefreshEpoch((n) => n + 1);
        await loadPreviousMonthLeaderboard().catch(() => {});
        return { ok: true, message: 'Leaderboard updated' };
      }
      case 'profile':
      case 'wallet':
      case 'notifications':
      case 'store':
      case 'levels':
      case 'settings':
      case 'agency_management': {
        await refreshUserProfileFromServer();
        setUserSyncRefreshEpoch((n) => n + 1);
        return { ok: true, message: 'Account & network refreshed' };
      }
      case 'home':
      default: {
        await refreshUserProfileFromServer();
        setDiscoveryRefreshEpoch((n) => n + 1);
        setReelsRefreshEpoch((n) => n + 1);
        setUserSyncRefreshEpoch((n) => n + 1);
        return { ok: true, message: 'Home feed refreshed' };
      }
    }
  };

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
        sendSignupEmailOtp,
        verifySignupEmailOtp,
        sendLoginEmailOtp,
        verifyLoginEmailOtp,
        sendPreSignupEmailOtp,
        verifyPreSignupEmailOtp,
        completePreSignupPassword,
        needsProfileRegistration: Boolean(
          isAuthenticated &&
            firebaseUser &&
            isEmailVerified &&
            !isAccountRestrictedStatus(currentUser?.accountStatus) &&
            !isProfileRegistrationCompleted(currentUser)
        ),
        completeInAppProfileRegistration,
        checkUsernameAvailable,
        savedAccounts,
        maxSavedAccounts: MAX_DEVICE_ACCOUNTS,
        isAddingAccount,
        addingAccountReturnUid,
        showAccountSwitcherModal,
        setShowAccountSwitcherModal,
        switchAccount,
        startAddAccountFlow,
        cancelAddAccountFlow,
        removeSavedAccount,
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
        adminModerationState,
        activeAdminWarning,
        dismissActiveAdminWarning,
        selectedAdminNotification,
        setSelectedAdminNotification,
        openAdminNotificationDetails,
        activeFeatureRestrictionModal,
        setActiveFeatureRestrictionModal,
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
        refreshScope,
        chatRefreshEpoch,
        liveRefreshTick,
        partyRefreshTick,
        userSyncRefreshEpoch,
        deviceMode,
        setDeviceMode,
        customLogoUrl,
        setCustomLogoUrl,
        agencyProfile,
        officialCoinSellerAgencies,
        officialCoinSellerProfiles,
        agencyOrders,
        agencyTransactions,
        sendAgencyCoins,
        deliverAgencyOrder,
        rejectAgencyOrder,
        updateAgencyProfile,
        setAgencySecurityPin,
        createBuyerCoinOrder,
        findUserByIdOrUsername,
        findUserByIdOrUsernameAsync,
        hostAgencyProfile,
        agencyHosts,
        hostJoinRequests,
        myHostAgencyRequests,
        hostAgencyMembership,
        agencyApplications,
        allHostAgencies,
        contactAgencyInApp,
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
        adminAllocateAgencyCoins,
        unifiedCatalogGifts,
        catalogSyncStats,
        advancedGifts,
        adminCatalogGifts,
        publishedCatalogGifts,
        saveAdvancedGift,
        deleteAdvancedGift,
        migrateUnifiedGiftCatalog,
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
