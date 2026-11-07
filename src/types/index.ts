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
  | 'admin_dashboard';

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
  moderatorIds?: string[];
  kickedUserIds?: string[];
  blockedUserIds?: string[];
  viewers?: User[];
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
}

export interface WalletTransaction {
  id: string;
  type: 'recharge' | 'reward' | 'gift_sent' | 'gift_received' | 'vip_upgrade' | 'withdrawal';
  amount: number;
  currency: 'coins' | 'diamonds' | 'USD';
  title: string;
  date: string;
  status: 'completed' | 'pending';
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
