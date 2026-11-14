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
  isVerified: boolean;
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
  agencyTag?: string;
  isAgencyHost?: boolean;
  heldDiamonds?: number;
  activeFrame?: string;
  activeHonorTitle?: string;
  accountStatus?: 'active' | 'deactivated' | 'pending_deletion' | 'permanently_deleted';
  deactivatedAt?: string | null;
  deletionRequestedAt?: string | null;
  scheduledPermanentDeletionAt?: string | null;
  deletionOtpVerifiedAt?: string | null;
  deletionReason?: string | null;
  reactivatedAt?: string | null;
  pushNotificationToken?: string;
  pushPlatform?: 'android' | 'ios' | 'web';
  notificationPreferences?: NotificationPreferences;
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
  receivedCoins?: number;
}

export interface PartyRoom {
  id: string;
  title: string;
  host: User;
  announcement: string;
  category: 'Chat' | 'Music' | 'Singing' | 'Gaming' | 'Dating';
  activeViewers: number;
  seats: PartySeat[];
  backgroundTheme: string;
  nowPlaying?: string;
  level?: 1 | 2 | 3;
  isActive?: boolean;
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

export interface Gift {
  id: string;
  name: string;
  icon: string;
  coins: number;
  animationType: 'sparkle' | 'heart' | 'car' | 'rocket' | 'crown' | 'dragon' | 'yacht' | 'ring';
  description: string;
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
  type: 'recharge' | 'reward' | 'gift_sent' | 'gift_received' | 'vip_upgrade' | 'withdrawal';
  amount: number;
  currency: 'coins' | 'diamonds' | 'USD';
  title: string;
  date: string;
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
  | 'system';

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
  recipientId: string;
  recipientUniqueId: string;
  recipientName: string;
  recipientAvatar: string;
  coins: number;
  remainingBalance: number;
  timestamp: string;
  referenceId?: string;
}

export interface CoinSellerAgencyProfile {
  agencyId: string;
  agencyName: string;
  agencyCode: string;
  badge: string;
  ownerUserId: string;
  agencyBalance: number;
  pin: string;
  isPinSet: boolean;
  whatsappNumber: string;
  whatsappDisplay: string;
  isOfficial: boolean;
  slogan: string;
}

export interface HostAgencyProfile {
  agencyId: string;
  agencyName: string;
  agencyCode: string;
  agencyTag: string; // e.g. "ROYAL"
  tagColor?: string;
  badge: string;
  ownerUserId: string;
  whatsappNumber: string;
  whatsappDisplay: string;
  defaultCommissionRate: number; // percentage, e.g. 15
  minWeeklyHours: number;
  slogan: string;
  isOfficial: boolean;
  activeHostsCount?: number;
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
  userId: string;
  uniqueId: string;
  displayName: string;
  username: string;
  avatar: string;
  level: number;
  agencyId: string;
  whatsapp: string;
  experience: string;
  expectedHours: number;
  appliedDate: string;
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
}
