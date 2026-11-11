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
  | 'agency_management';

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
  videoUrl?: string;
  pkOpponent?: User;
  moderatorIds?: string[];
  kickedUserIds?: string[];
  blockedUserIds?: string[];
  viewers?: User[];
  totalGiftCoins?: number;
  country?: string;
  countryFlag?: string;
}

export interface PartySeat {
  seatIndex: number;
  user: User | null;
  isMuted: boolean;
  isHostMuted?: boolean;
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
  totalGiftCoins?: number;
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

export interface NotificationItem {
  id: string;
  type: 'follow' | 'message' | 'party_invite' | 'live_invite' | 'gift' | 'pk_invite' | 'system';
  title: string;
  message: string;
  user?: User;
  timestamp: string;
  isRead: boolean;
  actionUrl?: string;
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
