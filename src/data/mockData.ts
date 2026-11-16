import {
  User,
  LiveStream,
  PartyRoom,
  Gift,
  Conversation,
  VideoPost,
  WalletTransaction,
  NotificationItem,
  StoryItem,
  FriendStory,
} from '../types';
import { getAllVirtualGifts } from '../services/virtual-gift-database';

export const CURRENT_USER: User = {
  id: 'user_me_01',
  uniqueId: 'AM_100001',
  username: 'AlphaUser',
  displayName: 'Alpha Member',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
  bio: 'Welcome to Alpha Mate Live & Party! 🌟',
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
  familyCrew: 'Alpha Mate',
  isHost: true,
  friendsCount: 0,
  visitorsCount: 0,
  gender: 'male',
  age: 22,
  country: 'United States',
  countryFlag: '🇺🇸',
  heldDiamonds: 0,
  activeFrame: 'golden_dragon',
  activeHonorTitle: '[VICTOR]',
};

export const MOCK_HOSTS: User[] = [];

export const MOCK_LIVE_STREAMS: LiveStream[] = [];

export const MOCK_PARTY_ROOMS: PartyRoom[] = [];

export const VIRTUAL_GIFTS: Gift[] = getAllVirtualGifts();

export const MOCK_CONVERSATIONS: Conversation[] = [];

export const MOCK_VIDEOS: VideoPost[] = [];

export const MOCK_NOTIFICATIONS: NotificationItem[] = [];

export const MOCK_TRANSACTIONS: WalletTransaction[] = [];

export const MOCK_ROOM_VIEWERS: User[] = [];

export const MOCK_FRIEND_STORIES: FriendStory[] = [];
