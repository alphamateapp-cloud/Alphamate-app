export type ScreenType =
  | 'splash'
  | 'welcome'
  | 'register'
  | 'signin'
  | 'forgot_password'
  | 'home'
  | 'party'
  | 'moments'
  | 'upload'
  | 'chat'
  | 'profile'
  | 'live_stream'
  | 'pk_battle'
  | 'party_room'
  | 'chat_conversation'
  | 'wallet'
  | 'levels'
  | 'notifications'
  | 'search'
  | 'settings'
  | 'store'
  | 'admin_dashboard'
  | 'agency_management'
  | 'privacy_policy'
  | 'terms_conditions'
  | 'delete_account'
  | 'account_recovery';

export type MainTabType = 'home' | 'party' | 'moments' | 'store' | 'chat' | 'me';

export interface User {
  id: string;
  uniqueId: string; // e.g. "AM_884920"
  username: string;
  displayName: string;
  avatar: string;
  bio: string;
  email?: string;
  dob?: string;
  password?: string;
  authProvider?: 'google' | 'email' | 'apple';
  lastNameChangeDate?: string;
  lastUsernameChangeDate?: string;
  followersCount: number;
  followingCount: number;
  likesCount: number;
  level: number;
  xp: number;
  nextLevelXp: number;
  vipTier: number; // 0 = None, 1 to 12 = VIP 1 to VIP 12
  vipFrame?: string;
  entranceAnimation?: string;
  chatBubble?: string;
  coins: number;
  diamonds: number;
  /** Official Blue Tick (Respect Badge granted exclusively by Admin to Hosts & Gifters) */
  isVerified: boolean;
  /** Automatic Green Tick (granted automatically upon account/email verification) */
  isAccountVerified?: boolean;
  greenTick?: boolean;
  emailVerified?: boolean;
  profileCompleted?: boolean;
  hasPassword?: boolean;
  emailOtpVerified?: boolean;
  emailOtpVerifiedAt?: string;
  familyCrew?: string;
  isHost?: boolean;
  coverImage?: string;
  friendsCount?: number;
  visitorsCount?: number;
  gender?: 'male' | 'female' | 'other';
  age?: number;
  country?: string;
  countryFlag?: string;
  agencyId?: string;
  agencyName?: string;
  agencyCode?: string;
  agencyTag?: string;
  hostAgencyStatus?: string;
  agencyOwnerId?: string;
  agencyOwnerName?: string;
  agencyJoinedAt?: string;
  isAgencyHost?: boolean;
  heldDiamonds?: number;
  activeFrame?: string;
  activeHonorTitle?: string;
  accountStatus?:
    | 'active'
    | 'blocked'
    | 'banned'
    | 'suspended'
    | 'deactivated'
    | 'pending_deletion'
    | 'permanently_deleted';
  deactivatedAt?: string | null;
  deletionRequestedAt?: string | null;
  scheduledPermanentDeletionAt?: string | null;
  deletionOtpVerifiedAt?: string | null;
  deletionReason?: string | null;
  reactivatedAt?: string | null;
  pushNotificationToken?: string;
  pushPlatform?: 'android' | 'ios' | 'web';
  notificationPreferences?: NotificationPreferences;
  equippedBadgeIds?: UserBadgeId[];
  // Admin Moderation & Verification fields (read-only on user side; managed by Admin Panel)
  isBlocked?: boolean;
  blocked?: boolean;
  isBanned?: boolean;
  banned?: boolean;
  blockReason?: string | null;
  blockedAt?: any;
  blockedBy?: string | null;
  isSuspended?: boolean;
  suspended?: boolean;
  suspensionReason?: string | null;
  suspensionDuration?: string | number | null;
  suspendedAt?: any;
  suspendedUntil?: any;
  suspensionExpiresAt?: any;
  isPermanentSuspension?: boolean;
  liveDisabled?: boolean;
  liveSuspended?: boolean;
  liveRestricted?: boolean;
  liveAccess?: string;
  canGoLive?: boolean;
  liveRestrictionReason?: string | null;
  liveSuspendedUntil?: any;
  partyDisabled?: boolean;
  partySuspended?: boolean;
  partyRestricted?: boolean;
  partyAccess?: string;
  canJoinParty?: boolean;
  canCreateParty?: boolean;
  partyRestrictionReason?: string | null;
  partySuspendedUntil?: any;
  blueTick?: boolean;
  hasBlueTick?: boolean;
  verificationStatus?: string;
  verificationUpdatedAt?: any;
  verificationReason?: string | null;
  moderation?: Record<string, any> | null;
  restrictions?: Record<string, any> | null;
  latestWarning?: Record<string, any> | null;
  warnings?: Array<Record<string, any>>;
  lastAdminAction?: Record<string, any> | null;
}

export type AdminActionKind =
  | 'account_blocked'
  | 'account_unblocked'
  | 'account_suspended'
  | 'account_restored'
  | 'live_suspended'
  | 'live_restored'
  | 'party_restricted'
  | 'party_restored'
  | 'admin_warning'
  | 'verification_granted'
  | 'verification_removed'
  | 'verification_updated'
  | 'admin_action';

export type AdminRestrictionScope = 'account' | 'live' | 'party' | 'warning' | 'verification' | 'general';

export interface AdminRestrictionDetail {
  isActive: boolean;
  hasExpired?: boolean;
  scope: AdminRestrictionScope;
  actionKind: AdminActionKind;
  title: string;
  actionTaken: string;
  reason: string;
  adminName: string;
  adminLabel: string;
  adminEmail?: string;
  adminMessage?: string;
  duration?: string;
  startedAtMs?: number | null;
  expiresAtMs?: number | null;
  isPermanent: boolean;
  currentStatus: string;
  actionId?: string;
}

export interface AdminWarningRecord {
  id: string;
  title: string;
  message: string;
  reason: string;
  adminName: string;
  adminLabel: string;
  adminEmail?: string;
  createdAtMs: number;
  isRead?: boolean;
}

export interface AdminModerationState {
  isAccountBlocked: boolean;
  isAccountSuspended: boolean;
  isLiveRestricted: boolean;
  isPartyRestricted: boolean;
  accountBlock: AdminRestrictionDetail | null;
  accountSuspension: AdminRestrictionDetail | null;
  liveRestriction: AdminRestrictionDetail | null;
  partyRestriction: AdminRestrictionDetail | null;
  latestWarning: AdminWarningRecord | null;
  isVerified: boolean;
  verificationStatus: string;
  verificationReason?: string;
  verificationAdminName?: string;
  verificationUpdatedAtMs?: number | null;
  nextExpiryMs: number | null;
  currentAccountStatusLabel: string;
}

export interface SavedDeviceAccount {
  uid: string;
  uniqueId: string;
  email: string;
  displayName: string;
  username: string;
  avatar: string;
  level: number;
  vipTier: number;
  authProvider: 'google' | 'email' | 'apple';
  profileCompleted?: boolean;
  hasPassword?: boolean;
  lastActiveAt: string;
  lastActiveAtMs: number;
  firebaseUserBlob?: Record<string, any> | null;
  switchSessionId?: string;
  switchTicket?: string;
  switchToken?: string;
}

export interface AccountDeletionRequest {
  id: string;
  uid: string;
  uniqueId?: string;
  username?: string;
  displayName: string;
  email: string;
  avatar?: string;
  type: 'deactivation' | 'permanent_delete';
  status: 'deactivated' | 'pending_official_deletion' | 'recovered' | 'permanently_deleted';
  otpVerified: boolean;
  otpVerifiedAt?: string | null;
  requestedAt: string;
  scheduledPermanentDeletionAt?: string | null;
  reason?: string;
  recoveredAt?: string | null;
  permanentlyDeletedAt?: string | null;
  processedBy?: string | null;
  updatedAt: string;
}

export interface SfuPublishedTrack {
  trackName: string;
  mid?: string;
  kind: 'audio' | 'video';
}

export interface LiveStream {
  id: string;
  title: string;
  host: User;
  viewerCount: number;
  thumbnail: string;
  category: 'Live' | 'Gaming' | 'Music' | 'Chat' | 'Dancing' | 'PK Battle';
  tag: string;
  isPK: boolean;
  durationMinutes: number;
  isActive?: boolean;
  sfuSessionId?: string;
  publishedTracks?: SfuPublishedTrack[];
  isVideoOn?: boolean;
  isMicOn?: boolean;
  lastHeartbeat?: any;
  lastHeartbeatMs?: number;
  lastSeenAtMs?: number;
  lastSeenAt?: any;
  createdAt?: string;
  updatedAt?: string;
  videoUrl?: string;
  pkOpponent?: User;
  moderatorIds?: string[];
  kickedUserIds?: string[];
  blockedUserIds?: string[];
  viewers?: User[];
  totalGiftCoins?: number;
  coverImageUrl?: string;
  country?: string;
  countryFlag?: string;
}

export interface PartySeat {
  seatIndex: number;
  user: User | null;
  isMuted: boolean;
  isHostMuted?: boolean;
  isLocked?: boolean;
  isSpeaking: boolean;
  isHost?: boolean;
  isCoHost?: boolean;
  isVipGuest?: boolean;
  receivedCoins?: number;
}

export type PartyMusicSource = 'audius' | 'deezer' | 'itunes' | 'jamendo';

export interface PartyMusicTrack {
  id: string;
  sourceTrackId?: string;
  title: string;
  artist: string;
  album?: string;
  artworkUrl?: string;
  /** Playable stream duration in seconds (full length for Audius/Jamendo, ~30s for Deezer/iTunes preview). */
  durationSec: number;
  fullDurationSec?: number;
  /** Backend proxy stream URL (e.g. /api/music/audius/:id) for CORS-clean synced playback & visualizer. */
  streamUrl: string;
  /** Direct HTTPS fallback stream URL if backend proxy is unavailable. */
  directStreamUrl?: string;
  source: PartyMusicSource;
  isFullTrack: boolean;
  requestedBy?: string;
}

export interface PartyMusicRequest {
  id: string;
  track: PartyMusicTrack;
  requesterId: string;
  requesterName: string;
  requestedAtMs: number;
}

export interface PartyRoom {
  id: string;
  sessionId?: string;
  title: string;
  host: User;
  announcement: string;
  category: 'Chat' | 'Music' | 'Singing' | 'Gaming' | 'Dating';
  activeViewers: number;
  seats: PartySeat[];
  backgroundTheme: string;
  seatTheme?: 'royal_gold_diya' | 'royal_purple_lotus' | 'diamond_ice_blue';
  nowPlaying?: string;
  isMusicPlaying?: boolean;
  musicTrackIndex?: number;
  musicTrack?: PartyMusicTrack | null;
  musicStartedAtMs?: number;
  musicPositionSec?: number;
  musicQueue?: PartyMusicTrack[];
  musicLoop?: boolean;
  musicUpdatedBy?: string;
  level?: 1 | 2 | 3 | 4;
  isActive?: boolean;
  isHostPresent?: boolean;
  lastSeenAtMs?: number;
  createdAt?: string;
  updatedAt?: string;
  totalGiftCoins?: number;
  coverImageUrl?: string;
  country?: string;
  countryFlag?: string;
  moderatorIds?: string[];
  kickedUserIds?: string[];
  blockedUserIds?: string[];
  viewers?: User[];
}

export interface RoomPKSession {
  id: string;
  opponentRoom: {
    id: string;
    title: string;
    host: User;
    seats: PartySeat[];
    level: 1 | 2;
  };
  durationSeconds: number; // 300 seconds (5 mins)
  leftScore: number;
  rightScore: number;
  isActive: boolean;
  status: 'pending' | 'active' | 'ended';
  winner?: 'left' | 'right' | 'draw';
}

export type GiftAnimationType =
  | 'sparkle'
  | 'heart'
  | 'car'
  | 'rocket'
  | 'crown'
  | 'dragon'
  | 'yacht'
  | 'ring';

export type GiftCssAnimationClass =
  | 'animate-supercar'
  | 'animate-rocket-launch'
  | 'animate-dragon-fly'
  | 'animate-yacht'
  | 'animate-crown-drop'
  | 'animate-ring-levitate'
  | 'animate-shockwave'
  | 'animate-petal'
  | 'animate-float-heart'
  | 'animate-combo-pop'
  | 'animate-gift-shake';

export type GiftRarityTier = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';

export type AdvancedGiftFormat = 'webm' | 'svga' | 'mov' | 'mp4' | 'svg' | 'gif';

export type GiftDisplayMode = 'transparent' | 'semi_transparent' | 'overlay_background';

export type GiftEdgeBlendMode = 'normal' | 'screen' | 'lighten';

export type GiftTransparencyStatus =
  | 'alpha_verified'
  | 'alpha_limited_gif'
  | 'opaque_no_alpha'
  | 'unknown';

export type GiftPlaybackPosition = 'center' | 'top' | 'bottom' | 'fullscreen';

export type AdvancedGiftStatus = 'draft' | 'processing' | 'published' | 'disabled';

export type GiftConversionStatus =
  | 'not_needed'
  | 'pending'
  | 'converting'
  | 'completed'
  | 'failed'
  | 'unsupported';

export interface GiftMediaAnalysis {
  format: AdvancedGiftFormat;
  container?: string;
  codec?: string;
  pixFmt?: string;
  width?: number;
  height?: number;
  fps?: number;
  durationSec?: number;
  fileSizeBytes?: number;
  hasAlpha: boolean;
  hasAudio?: boolean;
  audioCodec?: string | null;
  transparencyStatus: GiftTransparencyStatus;
  recommendedMode: GiftDisplayMode;
  androidWebViewCompatible?: boolean;
  warnings: string[];
  svgFeatures?: {
    hasSmil: boolean;
    hasCssKeyframes: boolean;
    unsupportedFeatures: string[];
  };
}

export type UnifiedGiftKind = 'static' | 'animated';
export type UnifiedGiftFormat = 'static' | 'png' | AdvancedGiftFormat;

export interface UnifiedGiftCatalogSyncStats {
  total: number;
  animatedCount: number;
  staticCount: number;
  publishedCount: number;
  draftOrPausedCount: number;
  legacyCount: number;
  unindexedCount: number;
}

export interface AdvancedGiftConfig {
  id: string;
  schemaVersion?: number;
  giftKind?: UnifiedGiftKind;
  name: string;
  description: string;
  category: string;
  coins: number;
  tier?: GiftRarityTier;
  icon?: string;
  thumbnailUrl?: string;
  previewImageUrl?: string;
  originalFileUrl: string;
  optimizedFileUrl?: string;
  animationUrl: string;
  format: AdvancedGiftFormat;
  animationType?: GiftAnimationType;
  displayMode: GiftDisplayMode;
  transparencyStatus: GiftTransparencyStatus;
  opacity: number; // 10..100
  durationMs: number;
  loop: boolean;
  playbackSpeed: number; // 0.5..2.0
  position: GiftPlaybackPosition;
  scale: number; // 0.4..1.5
  priority: number; // 1..100
  enableParticles?: boolean;
  enableSound?: boolean;
  edgeFeather?: boolean;
  blendMode?: GiftEdgeBlendMode;
  status: AdvancedGiftStatus;
  isActive?: boolean;
  show?: boolean;
  conversionStatus: GiftConversionStatus;
  conversionMessage?: string;
  analysis?: GiftMediaAnalysis;
  isTestGift?: boolean;
  createdAt: string;
  createdAtMs: number;
  updatedAt: string;
  updatedAtMs?: number;
  createdBy?: string;
  /** Client-only telemetry: where this record was hydrated from before v2 unification */
  sourceCollection?: 'gifts' | 'advancedGifts' | 'default';
  /** Client-only flag: true if record lacks v2 unified schema or required index fields */
  needsSchemaSync?: boolean;
}

export type UnifiedGiftConfig = AdvancedGiftConfig;

export interface Gift {
  id: string;
  name: string;
  icon: string;
  coins: number;
  costInCoins?: number;
  animationType: GiftAnimationType;
  animationClassName?: GiftCssAnimationClass;
  secondaryAnimationClassNames?: GiftCssAnimationClass[];
  thumbnailUrl?: string;
  audioAssetPath?: string;
  tier?: GiftRarityTier;
  durationMs?: number;
  triggersScreenShake?: boolean;
  description: string;
  priority?: number;
  isTestGift?: boolean;
  advancedConfig?: AdvancedGiftConfig;
  /** True when this record originated in Admin Gift Management. */
  adminCatalog?: boolean;
  /** Admin visibility/status flag; false gifts stay hidden from all send-gift galleries. */
  catalogVisible?: boolean;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  text?: string;
  imageUrl?: string;
  audioDuration?: number;
  gift?: Gift;
  timestamp: string;
  isRead: boolean;
  isMe: boolean;
}

export interface Conversation {
  id: string;
  user: User;
  lastMessage: string;
  lastTimestamp: string;
  unreadCount: number;
  isGroup: boolean;
  groupName?: string;
  groupMembers?: User[];
  inviteStatus?: string;
  requestStatus?: 'connected' | 'new_request' | 'outgoing_pending' | 'incoming_pending' | 'rejected' | 'blocked';
  requestId?: string;
  messages: ChatMessage[];
}

export interface VideoPost {
  id: string;
  user: User;
  videoUrl: string;
  thumbnail: string;
  title: string;
  description: string;
  tags: string[];
  likes: number;
  commentsCount: number;
  sharesCount: number;
  viewsCount?: number;
  isLiked?: boolean;
  isFollowing?: boolean;
  feedCategory?: 'Trending' | 'For You' | 'Following';
  timestamp: string;
  postType?: 'video' | 'post';
  savedCount?: number;
  textContent?: string;
  attachedPhotoUrl?: string;
  isTextOnPhoto?: boolean;
  backgroundColor?: string;
  musicTitle?: string;
  musicArtist?: string;
  fontStyle?: string;
  videoKey?: string;
}

export interface WalletTransaction {
  id: string;
  type: 'recharge' | 'reward' | 'gift_sent' | 'gift_received' | 'vip_upgrade' | 'withdrawal' | 'agency_transfer' | 'diamond_exchange';
  amount: number;
  currency: 'coins' | 'diamonds' | 'USD';
  walletType?: 'gifting' | 'earnings';
  direction?: 'credit' | 'debit';
  balanceBefore?: number;
  balanceAfter?: number;
  referenceId?: string;
  title: string;
  date: string;
  createdAtMs?: number;
  status: 'completed' | 'pending';
  heldDiamonds?: number;
  pkrAmount?: number;
  accountDetails?: {
    method: string;
    title: string;
    number: string;
    bankName?: string;
  };
}

export type NotificationCategoryKey =
  | 'liveOn'
  | 'partyInvites'
  | 'friendRequests'
  | 'gifts'
  | 'comments'
  | 'messages'
  | 'likes'
  | 'pkBattles'
  | 'walletAndSystem';

export interface NotificationPreferences {
  enabled: boolean;
  categories: Record<NotificationCategoryKey, boolean>;
  updatedAt?: string;
}

export type NotificationEventType =
  | 'live_on'
  | 'live_invite'
  | 'party_invite'
  | 'friend_request'
  | 'follow'
  | 'gift'
  | 'comment'
  | 'message'
  | 'like'
  | 'pk_invite'
  | 'wallet'
  | 'agency'
  | 'system'
  | 'admin_action'
  | 'admin_warning'
  | 'moderation'
  | 'verification'
  | 'account_blocked'
  | 'account_suspended'
  | 'live_restricted'
  | 'party_restricted'
  | 'access_restored';

export interface NotificationItem {
  id: string;
  type: NotificationEventType;
  category?: NotificationCategoryKey;
  title: string;
  message: string;
  user?: User;
  senderId?: string;
  senderName?: string;
  senderAvatar?: string;
  recipientId?: string;
  screen?: string;
  tab?: string;
  roomId?: string;
  streamId?: string;
  reelId?: string;
  chatId?: string;
  timestamp: string;
  createdAtMs?: number;
  isRead: boolean;
  actionUrl?: string;
  // Admin Action & Moderation detail metadata
  isAdminAction?: boolean;
  actionKind?: AdminActionKind;
  actionType?: string;
  actionTitle?: string;
  actionTaken?: string;
  reason?: string;
  adminName?: string;
  adminLabel?: string;
  adminEmail?: string;
  adminMessage?: string;
  duration?: string;
  startedAt?: string;
  startedAtMs?: number | null;
  expiresAt?: string;
  expiresAtMs?: number | null;
  isPermanent?: boolean;
  currentStatus?: string;
  restrictionScope?: AdminRestrictionScope;
  verificationStatus?: string;
  actionDate?: string;
  actionDateMs?: number;
  sourceCollection?: 'notifications' | 'adminActions' | 'warnings' | 'profile_transition';
  dedupKey?: string;
}

export interface GiftTransactionRecord {
  id: string;
  senderId: string;
  senderName: string;
  recipientId: string;
  recipientName: string;
  giftId: string;
  giftName: string;
  giftIcon: string;
  quantity: number;
  totalCoins: number;
  hostDiamonds: number; // 60% host share
  appShareCoins: number; // 40% app revenue share
  context: 'live' | 'party' | 'moments' | 'pk' | 'demo';
  roomId?: string;
  streamId?: string;
  reelId?: string;
  status: 'completed';
  createdAt: string;
  createdAtMs: number;
}

export interface StoryItem {
  id: string;
  mediaUrl: string;
  caption?: string;
  createdAt: string;
  likes: number;
  isLiked?: boolean;
  viewsCount?: number;
  musicTitle?: string;
  backgroundColor?: string;
  stickers?: string[];
}

export interface FriendStory {
  id: string;
  user: User;
  isLive?: boolean;
  liveStreamId?: string;
  hasStory: boolean;
  isSeen?: boolean;
  stories: StoryItem[];
}

export interface AgencyOrder {
  id: string;
  orderNo: string;
  buyerId: string;
  buyerUniqueId: string;
  buyerName: string;
  buyerAvatar: string;
  coins: number;
  bonusCoins: number;
  price: string;
  paymentMethod: string;
  receiptUrl: string;
  status: 'pending' | 'delivered' | 'rejected';
  createdAt: string;
  deliveredAt?: string;
  note?: string;
}

export interface AgencyTransaction {
  id: string;
  type: 'direct_send' | 'order_delivery';
  agencyId?: string;
  agencyName?: string;
  agencyCode?: string;
  senderUid?: string;
  recipientId: string;
  recipientUniqueId: string;
  recipientName: string;
  recipientAvatar: string;
  coins: number;
  previousAgencyBalance?: number;
  remainingBalance: number;
  previousRecipientCoins?: number;
  nextRecipientCoins?: number;
  timestamp: string;
  createdAtMs?: number;
  referenceId?: string;
}

export interface CoinSellerAgencyProfile {
  agencyId: string;
  agencyName: string;
  agencyCode: string;
  logo?: string;
  badge: string;
  ownerUserId: string;
  ownerName?: string;
  ownerUniqueId?: string;
  ownerAvatar?: string;
  agencyBalance: number;
  pin: string;
  isPinSet: boolean;
  whatsappNumber: string;
  whatsappDisplay: string;
  hasValidWhatsApp?: boolean;
  isOfficial: boolean;
  slogan: string;
  status?: 'active' | 'suspended' | 'hold' | 'inactive';
  paymentMethods?: string[];
  rates?: Array<{ amount: number; bonus: number; price: string }>;
}

export interface HostAgencyProfile {
  agencyId: string;
  agencyName: string;
  agencyCode: string;
  agencyTag: string; // e.g. "ROYAL"
  logo?: string;
  tagColor?: string;
  badge: string;
  ownerUserId: string;
  ownerName?: string;
  ownerUniqueId?: string;
  ownerAvatar?: string;
  whatsappNumber: string;
  whatsappDisplay: string;
  hasValidWhatsApp?: boolean;
  defaultCommissionRate: number; // percentage, e.g. 15
  minWeeklyHours: number;
  slogan: string;
  isOfficial: boolean;
  activeHostsCount?: number;
  totalHosts?: number;
  status?: 'active' | 'suspended' | 'hold' | 'inactive';
}

export interface HostMember {
  id: string;
  userId: string;
  uniqueId: string;
  displayName: string;
  username: string;
  avatar: string;
  level: number;
  agencyId: string;
  agencyName: string;
  agencyTag: string;
  weeklyTargetDiamonds: number;
  currentProgressDiamonds: number;
  targetStatus: 'achieved' | 'pending' | 'expired';
  weeklyHoursStreamed: number;
  weeklyTargetHours: number;
  weeklyEarnings: number;
  commissionRate: number;
  isLive: boolean;
  joinedDate: string;
  resignationRequested?: boolean;
  resignationReason?: string;
}

export interface HostJoinRequest {
  id: string;
  applicantUid?: string;
  userId: string;
  userDocId?: string;
  uniqueId: string;
  displayName: string;
  username: string;
  avatar: string;
  level: number;
  agencyId: string;
  agencyName?: string;
  agencyCode?: string;
  agencyTag?: string;
  agencyOwnerId?: string;
  agencyType?: string;
  whatsapp: string;
  experience: string;
  expectedHours: number;
  appliedDate: string;
  createdAt?: string;
  createdAtMs?: number;
  reviewedAt?: string;
  reviewedBy?: string;
  rejectionReason?: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface AgencyApplication {
  id: string;
  type: 'coin_seller' | 'host_agency';
  applicantUserId: string;
  applicantName: string;
  applicantUniqueId: string;
  agencyName: string;
  agencyTag?: string;
  whatsapp: string;
  phoneNumber: string;
  idCardNumber?: string;
  experience: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
  createdAtMs?: number;
  reviewedAt?: string;
  reviewedBy?: string;
}

export type LeaderboardScope = 'global' | 'weekly';
export type LeaderboardMetric = 'overall' | 'gifts' | 'time';
export type LeaderboardMonthView = 'current' | 'previous';

export interface LeaderboardEntry {
  uid: string;
  uniqueId: string;
  displayName: string;
  username: string;
  avatar: string;
  countryFlag?: string;
  level: number;
  vipTier: number;
  monthKey: string; // e.g. "2026-11"
  weekKey: string; // e.g. "2026-W46"
  receivedGiftCoins: number;
  receivedDiamonds: number;
  giftsCount: number;
  timeSpentMinutes: number;
  score: number;
  weeklyGiftCoins: number;
  weeklyDiamonds: number;
  weeklyGiftsCount: number;
  weeklyTimeSpentMinutes: number;
  weeklyScore: number;
  isLive?: boolean;
  isRealUser?: boolean;
  equippedBadgeIds?: UserBadgeId[];
  updatedAt: string;
  updatedAtMs: number;
}

export type UserBadgeId =
  | 'top_contributor'
  | 'gift_king'
  | 'longest_party_attendee'
  | 'diamond_patron'
  | 'live_marathoner'
  | 'streak_champion'
  | 'social_creator'
  | 'royal_vip';

export type UserBadgeTier = 'bronze' | 'silver' | 'gold' | 'mythic';

export interface EarnedBadgeRecord {
  badgeId: UserBadgeId;
  tier: UserBadgeTier;
  unlockedAt: string;
  unlockedAtMs: number;
  metricValue: number;
}

export interface UserHistoricalStats {
  uid: string;
  totalGiftCoinsSent: number;
  totalGiftsSentCount: number;
  totalGiftCoinsReceived: number;
  totalDiamondsEarned: number;
  totalActiveMinutes: number;
  partyRoomMinutes: number;
  liveStreamMinutes: number;
  longestPartySessionMinutes: number;
  bestLeaderboardRank: number | null;
  checkInDaysCount: number;
  maxDailyStreak: number;
  postsCreatedCount: number;
  equippedBadgeIds: UserBadgeId[];
  earnedBadges: Record<string, EarnedBadgeRecord>;
  updatedAt: string;
  updatedAtMs: number;
}


