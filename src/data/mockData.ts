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
};

export const MOCK_HOSTS: User[] = [];

export const MOCK_LIVE_STREAMS: LiveStream[] = [];

export const MOCK_PARTY_ROOMS: PartyRoom[] = [];

export const VIRTUAL_GIFTS: Gift[] = [
  {
    id: 'gift_rose',
    name: 'Red Rose',
    icon: '🌹',
    coins: 10,
    animationType: 'sparkle',
    description: 'A fresh scented rose for your favorite host',
  },
  {
    id: 'gift_ice_cream',
    name: 'Sweet Gelato',
    icon: '🍦',
    coins: 50,
    animationType: 'sparkle',
    description: 'Refreshing treat to brighten up the chat',
  },
  {
    id: 'gift_heart',
    name: 'Heart Sparkle',
    icon: '💖',
    coins: 100,
    animationType: 'heart',
    description: 'Animated pulse of affection and loyalty',
  },
  {
    id: 'gift_ring',
    name: 'Diamond Ring',
    icon: '💍',
    coins: 520,
    animationType: 'ring',
    description: 'Sparkling engagement diamond of prestige',
  },
  {
    id: 'gift_crown',
    name: 'Alpha Crown',
    icon: '👑',
    coins: 1999,
    animationType: 'crown',
    description: 'Royal imperial crown of honor',
  },
  {
    id: 'gift_car',
    name: 'Cyber Supercar',
    icon: '🏎️',
    coins: 4999,
    animationType: 'car',
    description: 'Twin-turbo neon supercar road takeover',
  },
  {
    id: 'gift_yacht',
    name: 'Royal Yacht',
    icon: '🛥️',
    coins: 9999,
    animationType: 'yacht',
    description: 'Cruise the private neon sea in luxury',
  },
  {
    id: 'gift_rocket',
    name: 'Galaxy Rocket',
    icon: '🚀',
    coins: 19999,
    animationType: 'rocket',
    description: 'Blast off across the cosmos with orbital sparks',
  },
  {
    id: 'gift_dragon',
    name: 'Mythic Dragon',
    icon: '🐉',
    coins: 49999,
    animationType: 'dragon',
    description: 'Imperial fire-breathing mythical dragon screen takeover!',
  },
];

export const MOCK_CONVERSATIONS: Conversation[] = [];

export const MOCK_VIDEOS: VideoPost[] = [];

export const MOCK_NOTIFICATIONS: NotificationItem[] = [];

export const MOCK_TRANSACTIONS: WalletTransaction[] = [];

export const MOCK_ROOM_VIEWERS: User[] = [];

export const MOCK_FRIEND_STORIES: FriendStory[] = [];
