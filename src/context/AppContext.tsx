import React, { createContext, useContext, useState, useEffect } from 'react';
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
  StoryItem,
  FriendStory,
  AgencyOrder,
  AgencyTransaction,
  CoinSellerAgencyProfile,
  HostAgencyProfile,
  HostMember,
  HostJoinRequest,
  AgencyApplication,
} from '../types';
import {
  CURRENT_USER,
  MOCK_LIVE_STREAMS,
  MOCK_PARTY_ROOMS,
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
  signInWithEmail,
  registerWithEmail,
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
  FirebaseUser,
} from '../services/firebase';
import {
  subscribeToActiveReels,
  deleteReel,
  toggleReelLike,
  Reel,
} from '../services/reelsService';
import { p2pStreamingEngine } from '../services/webrtcService';

interface AppContextType {
  // Navigation & Screen state
  currentScreen: ScreenType;
  setCurrentScreen: (screen: ScreenType) => void;
  activeTab: MainTabType;
  setActiveTab: (tab: MainTabType) => void;
  navigateBack: () => void;
  screenHistory: ScreenType[];

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
  loginWithFirebaseGoogle: () => Promise<{ success: boolean; user?: User; error?: string }>;
  loginWithFirebaseEmail: (
    email: string,
    pass: string
  ) => Promise<{ success: boolean; user?: User; error?: string }>;
  registerWithFirebaseEmail: (data: {
    email: string;
    pass: string;
    displayName: string;
    username: string;
  }) => Promise<{ success: boolean; user?: User; error?: string }>;
  logoutFirebase: () => Promise<void>;

  // Live Stream state
  liveStreams: LiveStream[];
  activeStream: LiveStream | null;
  openLiveStream: (stream: LiveStream) => void;
  publishLiveStream: (stream: LiveStream) => Promise<void>;
  closeLiveStream: () => void;
  sendLiveGift: (gift: Gift, recipientHostId?: string) => void;
  activeGiftBanner: { gift: Gift; sender: string; recipient: string } | null;
  clearActiveGiftBanner: () => void;

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
  createPartyRoom: (room: PartyRoom) => void;
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
  startDirectMessage: (user: User) => void;
  sendMessage: (convId: string, text: string, imageUrl?: string) => void;

  // Video feed & Upload
  videos: VideoPost[];
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

  // Notifications
  notifications: NotificationItem[];
  markNotificationRead: (id: string) => void;
  unreadNotificationsCount: number;

  // Global Search
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
  const INITIAL_REGISTERED_USERS: User[] = [
    {
      ...CURRENT_USER,
      email: 'alphamateapp@gmail.com',
      dob: '2000-01-15',
      password: 'password123',
      authProvider: 'google',
    },
    {
      id: 'user_alex_demo',
      uniqueId: 'AM_992104',
      username: 'alex',
      displayName: 'Alex Rider',
      email: 'alex@alphamate.com',
      dob: '1998-05-20',
      password: 'password123',
      authProvider: 'email',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
      bio: 'VIP Royal Host 👑 | LIVE • PARTY • SOCIAL',
      followersCount: 12000,
      followingCount: 340,
      likesCount: 154000,
      level: 28,
      xp: 14200,
      nextLevelXp: 20000,
      vipTier: 3,
      coins: 5000,
      diamonds: 2000,
      isVerified: true,
    },
    {
      id: 'user_sophia_demo',
      uniqueId: 'AM_664129',
      username: 'sophia',
      displayName: 'Sophia Taylor',
      email: 'sophia@alphamate.com',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80',
      bio: 'Music & Vibes | Alpha Diamond VIP ✨',
      followersCount: 8400,
      followingCount: 190,
      likesCount: 92000,
      level: 22,
      xp: 11200,
      nextLevelXp: 15000,
      vipTier: 2,
      coins: 14200,
      diamonds: 1500,
      isVerified: true,
    },
    {
      id: 'user_liam_demo',
      uniqueId: 'AM_552109',
      username: 'liam',
      displayName: 'Liam Carter',
      email: 'liam@alphamate.com',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
      bio: 'Gaming streamer & Top Gifter 🎮',
      followersCount: 14500,
      followingCount: 420,
      likesCount: 180000,
      level: 35,
      xp: 24500,
      nextLevelXp: 30000,
      vipTier: 4,
      coins: 38000,
      diamonds: 8900,
      isVerified: true,
    },
    {
      id: 'user_elena_demo',
      uniqueId: 'AM_441908',
      username: 'elena',
      displayName: 'Elena Rostova',
      email: 'elena@alphamate.com',
      avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=400&q=80',
      bio: 'Singer & Party Host 🎤 Welcome to my room!',
      followersCount: 22000,
      followingCount: 510,
      likesCount: 310000,
      level: 42,
      xp: 41000,
      nextLevelXp: 50000,
      vipTier: 5,
      coins: 65000,
      diamonds: 12000,
      isVerified: true,
    },
    {
      id: 'user_zara_demo',
      uniqueId: 'AM_331820',
      username: 'zara',
      displayName: 'Zara Khan',
      email: 'zara@alphamate.com',
      avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80',
      bio: 'Alpha Mate Rising Star 🌟 Love from Lahore',
      followersCount: 6500,
      followingCount: 180,
      likesCount: 45000,
      level: 18,
      xp: 7800,
      nextLevelXp: 10000,
      vipTier: 1,
      coins: 9500,
      diamonds: 850,
      isVerified: true,
    },
  ];

  const [registeredUsers, setRegisteredUsers] = useState<User[]>(() => {
    try {
      const saved = localStorage.getItem('alphamate_registered_users');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Ensure new sample community users are included
        const existingIds = new Set(parsed.map((u: User) => u.id));
        const missing = INITIAL_REGISTERED_USERS.filter((u) => !existingIds.has(u.id));
        return [...parsed, ...missing];
      }
    } catch {
      // ignore
    }
    return INITIAL_REGISTERED_USERS;
  });

  const [currentScreen, setCurrentScreenState] = useState<ScreenType>('splash');
  const [screenHistory, setScreenHistory] = useState<ScreenType[]>(['splash']);
  const [activeTab, setActiveTabState] = useState<MainTabType>('home');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      const savedAuth = localStorage.getItem('alphamate_is_authenticated');
      if (savedAuth !== null) return savedAuth === 'true';
      const savedUser = localStorage.getItem('alphamate_current_user');
      return !!savedUser || true; // Default authenticated so user directly enters app
    } catch {
      return true;
    }
  });
  const [currentUser, setCurrentUser] = useState<User>(() => {
    try {
      const saved = localStorage.getItem('alphamate_current_user');
      if (saved) return JSON.parse(saved);
      // Persist default user session on first launch
      localStorage.setItem('alphamate_current_user', JSON.stringify(CURRENT_USER));
      localStorage.setItem('alphamate_is_authenticated', 'true');
    } catch {
      // ignore
    }
    return CURRENT_USER;
  });

  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [firebaseAuthLoading, setFirebaseAuthLoading] = useState<boolean>(true);

  const saveUserSession = (user: User) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
    try {
      localStorage.setItem('alphamate_current_user', JSON.stringify(user));
      localStorage.setItem('alphamate_is_authenticated', 'true');
    } catch {
      // ignore
    }
  };

  // Sync Firebase auth state
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      setFirebaseAuthLoading(false);

      if (fbUser) {
        try {
          const remoteProfile = await getUserProfileFromFirestore(fbUser.uid);
          if (remoteProfile) {
            const mergedUser: User = {
              ...currentUser,
              ...remoteProfile,
              id: fbUser.uid,
              email: fbUser.email || remoteProfile.email || currentUser.email,
              displayName: remoteProfile.displayName || fbUser.displayName || currentUser.displayName,
            };
            saveUserSession(mergedUser);
          } else {
            const newUserDoc: User = {
              ...currentUser,
              id: fbUser.uid,
              email: fbUser.email || currentUser.email,
              displayName: fbUser.displayName || currentUser.displayName,
              avatar: fbUser.photoURL || currentUser.avatar,
              isVerified: true,
            };
            await syncUserProfileToFirestore(newUserDoc);
            saveUserSession(newUserDoc);
          }
        } catch (e) {
          console.warn('Firestore profile sync error:', e);
        }
      }
    });

    return () => {
      unsubscribeAuth();
    };
  }, []);

  // Real-time Firestore listeners (rebinds automatically on auth transitions)
  useEffect(() => {
    const unsubscribeRooms = subscribeToPartyRooms((remoteRooms) => {
      const nextRooms = Array.isArray(remoteRooms) ? remoteRooms : [];
      setPartyRooms(nextRooms);
      setActivePartyRoom((currentActive) => {
        if (!currentActive) return null;
        const fresh = nextRooms.find((r: any) => r.id === currentActive.id);
        return fresh ? { ...currentActive, ...fresh } : currentActive;
      });
    });

    const unsubscribeLiveStreams = subscribeToLiveStreams((remoteStreams) => {
      if (remoteStreams && remoteStreams.length > 0) {
        setLiveStreams(remoteStreams);
      } else {
        setLiveStreams(MOCK_LIVE_STREAMS);
      }
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
      unsubscribeRooms();
      unsubscribeLiveStreams();
      unsubscribeReels();
    };
  }, [firebaseUser?.uid]);

  // Live Streams & PK
  const [liveStreams, setLiveStreams] = useState<LiveStream[]>(MOCK_LIVE_STREAMS);
  const [activeStream, setActiveStream] = useState<LiveStream | null>(null);
  const [activePKBattle, setActivePKBattle] = useState<LiveStream | null>(null);
  const [pkScores, setPkScores] = useState<{ left: number; right: number }>({ left: 3420, right: 2890 });
  const [activeGiftBanner, setActiveGiftBanner] = useState<{ gift: Gift; sender: string; recipient: string } | null>(null);

  // Audio Party Rooms
  const [partyRooms, setPartyRooms] = useState<PartyRoom[]>(MOCK_PARTY_ROOMS);
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
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return [
      {
        id: 'story_me_default',
        mediaUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80',
        caption: 'Alpha Mate Live vibe! Streaming chill music tonight 🎶💜',
        createdAt: '40m ago',
        likes: 64,
        isLiked: false,
        viewsCount: 240,
        musicTitle: 'Cyber Wave - Neon Sunset',
      },
    ];
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

  // Notifications
  const [notifications, setNotifications] = useState<NotificationItem[]>(MOCK_NOTIFICATIONS);

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

  const INITIAL_AGENCY_ORDERS: AgencyOrder[] = [
    {
      id: 'order_101',
      orderNo: 'ORD-9842',
      buyerId: 'user_sophia_demo',
      buyerUniqueId: 'AM_664129',
      buyerName: 'Sophia Taylor',
      buyerAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80',
      coins: 50000,
      bonusCoins: 8000,
      price: 'Rs. 11,900',
      paymentMethod: 'JazzCash',
      receiptUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=600&q=80',
      status: 'pending',
      createdAt: '12 mins ago',
      note: 'Payment done via JazzCash from 0300-XXXXXXX. Please deliver coins.',
    },
    {
      id: 'order_102',
      orderNo: 'ORD-9843',
      buyerId: 'user_liam_demo',
      buyerUniqueId: 'AM_552109',
      buyerName: 'Liam Carter',
      buyerAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
      coins: 100000,
      bonusCoins: 18000,
      price: 'Rs. 22,500',
      paymentMethod: 'EasyPaisa',
      receiptUrl: 'https://images.unsplash.com/photo-1554224154-26032ffc0d07?auto=format&fit=crop&w=600&q=80',
      status: 'pending',
      createdAt: '35 mins ago',
      note: 'EasyPaisa TID: 994820124. Need coins for PK battle support.',
    },
    {
      id: 'order_100',
      orderNo: 'ORD-9830',
      buyerId: 'user_elena_demo',
      buyerUniqueId: 'AM_441908',
      buyerName: 'Elena Rostova',
      buyerAvatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=400&q=80',
      coins: 20000,
      bonusCoins: 3000,
      price: 'Rs. 4,800',
      paymentMethod: 'Bank Transfer',
      receiptUrl: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=600&q=80',
      status: 'delivered',
      createdAt: '2 hours ago',
      deliveredAt: '1 hour ago',
      note: 'Verified and delivered.',
    },
  ];

  const [agencyOrders, setAgencyOrders] = useState<AgencyOrder[]>(() => {
    try {
      const saved = localStorage.getItem('alphamate_agency_orders');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return INITIAL_AGENCY_ORDERS;
  });

  const INITIAL_AGENCY_TRANSACTIONS: AgencyTransaction[] = [
    {
      id: 'atx_201',
      type: 'order_delivery',
      recipientId: 'user_elena_demo',
      recipientUniqueId: 'AM_441908',
      recipientName: 'Elena Rostova',
      recipientAvatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=400&q=80',
      coins: 20000,
      remainingBalance: 2500000,
      timestamp: 'Today, 01:15 PM',
      referenceId: 'ORD-9830',
    },
    {
      id: 'atx_200',
      type: 'direct_send',
      recipientId: 'user_alex_demo',
      recipientUniqueId: 'AM_992104',
      recipientName: 'Alex Rider',
      recipientAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
      coins: 10000,
      remainingBalance: 2520000,
      timestamp: 'Yesterday, 09:30 PM',
      referenceId: 'TX-DIRECT-8812',
    },
  ];

  const [agencyTransactions, setAgencyTransactions] = useState<AgencyTransaction[]>(() => {
    try {
      const saved = localStorage.getItem('alphamate_agency_transactions');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return INITIAL_AGENCY_TRANSACTIONS;
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

  const INITIAL_AGENCY_HOSTS: HostMember[] = [
    {
      id: 'host_member_sophia',
      userId: 'user_sophia_demo',
      uniqueId: 'AM_664129',
      displayName: 'Sophia Taylor',
      username: 'sophia',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80',
      level: 22,
      agencyId: 'agency_royal_talent',
      agencyName: 'Alpha Royal Talent Agency',
      agencyTag: 'ROYAL',
      weeklyTargetDiamonds: 500000,
      currentProgressDiamonds: 385000,
      targetStatus: 'pending',
      weeklyHoursStreamed: 18.5,
      weeklyTargetHours: 20,
      weeklyEarnings: 320000,
      commissionRate: 15,
      isLive: true,
      joinedDate: 'Joined 2 weeks ago',
    },
    {
      id: 'host_member_liam',
      userId: 'user_liam_demo',
      uniqueId: 'AM_552109',
      displayName: 'Liam Carter',
      username: 'liam',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
      level: 35,
      agencyId: 'agency_royal_talent',
      agencyName: 'Alpha Royal Talent Agency',
      agencyTag: 'ROYAL',
      weeklyTargetDiamonds: 1000000,
      currentProgressDiamonds: 1120000,
      targetStatus: 'achieved',
      weeklyHoursStreamed: 24.0,
      weeklyTargetHours: 20,
      weeklyEarnings: 950000,
      commissionRate: 15,
      isLive: false,
      joinedDate: 'Joined 1 month ago',
    },
    {
      id: 'host_member_elena',
      userId: 'user_elena_demo',
      uniqueId: 'AM_441908',
      displayName: 'Elena Rostova',
      username: 'elena',
      avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=400&q=80',
      level: 42,
      agencyId: 'agency_royal_talent',
      agencyName: 'Alpha Royal Talent Agency',
      agencyTag: 'ROYAL',
      weeklyTargetDiamonds: 250000,
      currentProgressDiamonds: 210000,
      targetStatus: 'pending',
      weeklyHoursStreamed: 12.0,
      weeklyTargetHours: 15,
      weeklyEarnings: 180000,
      commissionRate: 15,
      isLive: false,
      joinedDate: 'Joined 3 weeks ago',
    },
  ];

  const [agencyHosts, setAgencyHosts] = useState<HostMember[]>(() => {
    try {
      const saved = localStorage.getItem('alphamate_agency_hosts');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return INITIAL_AGENCY_HOSTS;
  });

  const INITIAL_HOST_REQUESTS: HostJoinRequest[] = [
    {
      id: 'hreq_zara',
      userId: 'user_zara_demo',
      uniqueId: 'AM_331820',
      displayName: 'Zara Khan',
      username: 'zara',
      avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80',
      level: 18,
      agencyId: 'agency_royal_talent',
      whatsapp: '+92 321 4455667',
      experience: 'Acoustic singing & live party chat host for 1+ year. Eager to achieve weekly 500k targets.',
      expectedHours: 18,
      appliedDate: 'Today, 10:20 AM',
      status: 'pending',
    },
  ];

  const [hostJoinRequests, setHostJoinRequests] = useState<HostJoinRequest[]>(() => {
    try {
      const saved = localStorage.getItem('alphamate_host_join_requests');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return INITIAL_HOST_REQUESTS;
  });

  const INITIAL_AGENCY_APPLICATIONS: AgencyApplication[] = [
    {
      id: 'app_agency_01',
      type: 'host_agency',
      applicantUserId: 'user_alex_demo',
      applicantName: 'Alex Rider',
      applicantUniqueId: 'AM_992104',
      agencyName: 'Alex Rising Stars',
      agencyTag: 'RIDER',
      whatsapp: '+92 301 9922110',
      phoneNumber: '+92 301 9922110',
      idCardNumber: '35201-XXXXXXX-1',
      experience: 'Experienced VIP streamer with 10+ recruited talent hosts.',
      status: 'pending',
      submittedAt: 'Yesterday, 04:30 PM',
    },
  ];

  const [agencyApplications, setAgencyApplications] = useState<AgencyApplication[]>(() => {
    try {
      const saved = localStorage.getItem('alphamate_agency_applications');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return INITIAL_AGENCY_APPLICATIONS;
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

  const setCurrentScreen = (screen: ScreenType) => {
    setScreenHistory((prev) => [...prev, screen]);
    setCurrentScreenState(screen);
  };

  const navigateBack = () => {
    if (screenHistory.length > 1) {
      const newHistory = [...screenHistory];
      newHistory.pop();
      const prevScreen = newHistory[newHistory.length - 1];
      setScreenHistory(newHistory);
      setCurrentScreenState(prevScreen);
    } else {
      setCurrentScreenState('home');
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

  const loginWithFirebaseGoogle = async () => {
    try {
      const fbUser = await signInWithGoogle();
      if (!fbUser) return { success: false, error: 'Sign-in cancelled' };

      const existingProfile = await getUserProfileFromFirestore(fbUser.uid);
      const cleanEmail = (fbUser.email || '').toLowerCase();
      const suggestedName = fbUser.displayName || cleanEmail.split('@')[0] || 'Alpha Mate';
      const suggestedUsername = (cleanEmail.split('@')[0] || `user_${Date.now()}`).toLowerCase().replace(/[^a-z0-9_]/g, '_');

      const userObj: User = existingProfile
        ? {
            ...currentUser,
            ...existingProfile,
            id: fbUser.uid,
            displayName: existingProfile.displayName || suggestedName,
            email: cleanEmail,
            avatar: existingProfile.avatar || fbUser.photoURL || currentUser.avatar,
            isVerified: true,
          }
        : {
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
            isVerified: true,
            familyCrew: 'Alpha Champions 👑',
            isHost: false,
            authProvider: 'google',
          };

      await syncUserProfileToFirestore(userObj);
      saveUserSession(userObj);
      setCurrentScreen('home');
      return { success: true, user: userObj };
    } catch (error: any) {
      console.error('Firebase Google Auth error:', error);
      return { success: false, error: error.message || 'Google sign-in failed' };
    }
  };

  const loginWithFirebaseEmail = async (email: string, pass: string) => {
    try {
      const fbUser = await signInWithEmail(email, pass);
      const remoteProfile = await getUserProfileFromFirestore(fbUser.uid);
      const userObj: User = remoteProfile
        ? {
            ...currentUser,
            ...remoteProfile,
            id: fbUser.uid,
          }
        : {
            ...currentUser,
            id: fbUser.uid,
            email: email.toLowerCase(),
            displayName: email.split('@')[0],
          };

      saveUserSession(userObj);
      setCurrentScreen('home');
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
      const newUser: User = {
        id: fbUser.uid,
        uniqueId: `AM_${Math.floor(100000 + Math.random() * 900000)}`,
        username: data.username.trim().toLowerCase(),
        displayName: data.displayName.trim() || data.username.trim(),
        email: data.email.trim().toLowerCase(),
        avatar:
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
        isVerified: false,
        familyCrew: 'Alpha Champions 👑',
        isHost: false,
        authProvider: 'email',
      };

      await syncUserProfileToFirestore(newUser);
      saveUserSession(newUser);
      setCurrentScreen('home');
      return { success: true, user: newUser };
    } catch (error: any) {
      console.error('Firebase Email Registration error:', error);
      return { success: false, error: error.message || 'Email registration failed' };
    }
  };

  const logoutFirebase = async () => {
    try {
      await logoutUser();
    } catch (e) {
      console.warn('Firebase logout warning:', e);
    }
    logout();
  };

  const updateUserProfile = (data: Partial<User>) => {
    setCurrentUser((prev) => {
      const updated = { ...prev, ...data };
      saveUserSession(updated);
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
    setIsAuthenticated(false);
    try {
      localStorage.setItem('alphamate_is_authenticated', 'false');
      localStorage.removeItem('alphamate_current_user');
    } catch {
      // ignore
    }
    setCurrentScreen('signin');
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
    await syncLiveStreamToFirestore(publishedStream);
    setActiveStream((prev) => (prev && prev.id === publishedStream.id ? publishedStream : prev));
    setLiveStreams((prev) => {
      const withoutCurrent = prev.filter((s) => s.id !== publishedStream.id);
      return [publishedStream, ...withoutCurrent];
    });
  };

  const closeLiveStream = () => {
    if (activeStream) {
      const isOwnerHost =
        activeStream.host.id === currentUser.id ||
        (auth.currentUser?.uid && activeStream.host.id === auth.currentUser.uid) ||
        activeStream.id.startsWith('live_my_');
      if (isOwnerHost) {
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

  const supportPKHost = (side: 'left' | 'right', amount: number) => {
    if (coins < amount) return;
    setCoins((prev) => prev - amount);
    setPkScores((prev) => ({
      ...prev,
      [side]: prev[side] + amount,
    }));
    // Flash banner
    setActiveGiftBanner({
      gift: VIRTUAL_GIFTS[1],
      sender: currentUser.displayName,
      recipient: side === 'left' ? 'Host Left' : 'Host Right',
    });
  };

  const sendLiveGift = (gift: Gift, recipientHostId?: string) => {
    if (coins < gift.coins) {
      return;
    }

    setCoins((prev) => prev - gift.coins);

    // Record transaction
    const newTx: WalletTransaction = {
      id: `tx_${Date.now()}`,
      type: 'gift_sent',
      amount: gift.coins,
      currency: 'coins',
      title: `Sent ${gift.name} (${gift.icon})`,
      date: 'Just now',
      status: 'completed',
    };
    setTransactions((prev) => [newTx, ...prev]);

    // Show celebration banner
    setActiveGiftBanner({
      gift,
      sender: currentUser.displayName,
      recipient: activeStream?.host.displayName || 'Host',
    });
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
    setCurrentScreen('party_room');
  };

  const closePartyRoom = (shouldDelete = false) => {
    if (activePartyRoom) {
      p2pStreamingEngine.stopPartyVoice(activePartyRoom.id).catch(() => {});
      if (shouldDelete) {
        deletePartyRoomFromFirestore(activePartyRoom.id).catch(() => {});
        setPartyRooms((prev) => prev.filter((r) => r.id !== activePartyRoom.id));
      }
    }
    setActivePartyRoom(null);
    setUserSeatIndex(null);
    navigateBack();
  };

  const createPartyRoom = (room: PartyRoom) => {
    const firebaseUid = auth.currentUser?.uid;
    const normalizedRoom: PartyRoom = firebaseUid
      ? {
          ...room,
          isActive: true,
          host: { ...room.host, id: firebaseUid },
        }
      : { ...room, isActive: true };
    setPartyRooms((prev) => [normalizedRoom, ...prev]);
    syncPartyRoomToFirestore(normalizedRoom).catch(() => {});
    openPartyRoom(normalizedRoom);
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

    // Immediate optimistic update
    setUserSeatIndex(isLeaving ? null : seatIndex);

    const roomSeats = Array.isArray(room.seats) ? [...room.seats] : [];
    const optimisticSeats = roomSeats.map((s: any) => {
      if (Number(s.seatIndex) === seatIndex) {
        return isLeaving
          ? { ...s, user: null, isSpeaking: false, isMuted: false, isHostMuted: false }
          : { ...s, user: effectiveUser, isSpeaking: false, isMuted: isMicMuted };
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
      isMicMuted
    );

    if (result.success && result.seats) {
      const verifiedRoom = { ...room, seats: result.seats };
      setActivePartyRoom(verifiedRoom);
      setPartyRooms((prev) => prev.map((item) => (item.id === room.id ? verifiedRoom : item)));
      const mySeat = result.seats.find((s: any) => s.user?.id === effectiveUser.id);
      setUserSeatIndex(mySeat ? Number(mySeat.seatIndex) : null);
      return { success: true };
    }

    console.warn('Party seat update rejected:', result.reason);
    // Revert optimistic state if transaction declined (occupied/locked/restricted)
    setUserSeatIndex(prevSeatIndex);
    setActivePartyRoom(room);
    setPartyRooms((prev) => prev.map((item) => (item.id === room.id ? room : item)));
    return { success: false, reason: result.reason || 'REJECTED' };
  };

  const openConversation = (conv: Conversation) => {
    setActiveConversation(conv);
    setCurrentScreen('chat_conversation');
  };

  const startDirectMessage = (targetUser: User) => {
    let existingConv = conversations.find(
      (c) => c.user.id === targetUser.id || c.user.displayName === targetUser.displayName
    );
    if (!existingConv) {
      existingConv = {
        id: `conv_${targetUser.id || Date.now()}`,
        user: targetUser,
        lastMessage: 'Chat started',
        lastTimestamp: 'Just now',
        unreadCount: 0,
        isGroup: false,
        messages: [
          {
            id: `msg_welcome_${Date.now()}`,
            senderId: targetUser.id,
            senderName: targetUser.displayName,
            senderAvatar: targetUser.avatar,
            text: `Hey there! Thanks for connecting with me on Alpha Mate 💜`,
            timestamp: 'Just now',
            isRead: true,
            isMe: false,
          },
        ],
      };
      setConversations((prev) => [existingConv!, ...prev]);
    }
    setActiveConversation(existingConv);
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
        loginWithFirebaseGoogle,
        loginWithFirebaseEmail,
        registerWithFirebaseEmail,
        logoutFirebase,
        liveStreams,
        activeStream,
        openLiveStream,
        publishLiveStream,
        closeLiveStream,
        sendLiveGift,
        activeGiftBanner,
        clearActiveGiftBanner,
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
        unreadNotificationsCount,
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
