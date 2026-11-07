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
  subscribeToPartyRooms,
  FirebaseUser,
} from '../services/firebase';

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
  closePartyRoom: () => void;
  createPartyRoom: (room: PartyRoom) => void;
  updateActivePartyRoomLevel: (level: 1 | 2 | 3) => void;
  toggleSeat: (seatIndex: number) => void;
  userSeatIndex: number | null;
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

  // Wallet & Economy
  coins: number;
  diamonds: number;
  transactions: WalletTransaction[];
  rechargeCoins: (amount: number, priceUSD: number, paymentMethod: string) => Promise<boolean>;
  purchaseStoreItem: (cost: number, currency: 'coins' | 'diamonds', itemTitle: string) => boolean;

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
  ];

  const [registeredUsers, setRegisteredUsers] = useState<User[]>(() => {
    try {
      const saved = localStorage.getItem('alphamate_registered_users');
      if (saved) return JSON.parse(saved);
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

  // Sync auth state and real-time Firestore listeners
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

    const unsubscribeRooms = subscribeToPartyRooms((remoteRooms) => {
      if (remoteRooms && remoteRooms.length > 0) {
        setPartyRooms((prev) => {
          const remoteIds = new Set(remoteRooms.map((r: any) => r.id));
          const uniqueExisting = prev.filter((r) => !remoteIds.has(r.id));
          return [...remoteRooms, ...uniqueExisting];
        });
      }
    });

    return () => {
      unsubscribeAuth();
      unsubscribeRooms();
    };
  }, []);

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

  // Economy
  const [coins, setCoins] = useState<number>(CURRENT_USER.coins);
  const [diamonds, setDiamonds] = useState<number>(CURRENT_USER.diamonds);
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

  const closeLiveStream = () => {
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
      alert(`Insufficient coins! You need ${gift.coins} coins to send ${gift.name}. Recharge in Wallet.`);
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
    setActivePartyRoom(room);
    setUserSeatIndex(null);
    setCurrentScreen('party_room');
  };

  const closePartyRoom = () => {
    setActivePartyRoom(null);
    setUserSeatIndex(null);
    navigateBack();
  };

  const createPartyRoom = (room: PartyRoom) => {
    setPartyRooms((prev) => [room, ...prev]);
    syncPartyRoomToFirestore(room).catch(() => {});
    openPartyRoom(room);
  };

  const updateActivePartyRoomLevel = (level: 1 | 2 | 3) => {
    if (!activePartyRoom) return;
    const updated: PartyRoom = { ...activePartyRoom, level };
    setActivePartyRoom(updated);
    setPartyRooms((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    syncPartyRoomToFirestore(updated).catch(() => {});
  };

  const toggleSeat = (seatIndex: number) => {
    if (!activePartyRoom) return;

    const currentSeat = activePartyRoom.seats[seatIndex];
    if (userSeatIndex === seatIndex) {
      // Leave seat
      const updatedSeats = [...activePartyRoom.seats];
      updatedSeats[seatIndex] = {
        ...currentSeat,
        user: null,
        isSpeaking: false,
      };
      setActivePartyRoom({ ...activePartyRoom, seats: updatedSeats });
      setUserSeatIndex(null);
    } else if (!currentSeat.user) {
      // Take seat
      const updatedSeats = [...activePartyRoom.seats];
      if (userSeatIndex !== null) {
        updatedSeats[userSeatIndex] = {
          ...updatedSeats[userSeatIndex],
          user: null,
          isSpeaking: false,
        };
      }
      updatedSeats[seatIndex] = {
        ...currentSeat,
        user: currentUser,
        isSpeaking: false,
      };
      setActivePartyRoom({ ...activePartyRoom, seats: updatedSeats });
      setUserSeatIndex(seatIndex);
    }
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
          return {
            ...v,
            isLiked,
            likes: isLiked ? v.likes + 1 : v.likes - 1,
          };
        }
        return v;
      })
    );
  };

  const rechargeCoins = async (amount: number, priceUSD: number, paymentMethod: string): Promise<boolean> => {
    // realistic checkout delay
    await new Promise((res) => setTimeout(res, 800));
    setCoins((prev) => prev + amount);

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
        coins,
        diamonds,
        transactions,
        rechargeCoins,
        purchaseStoreItem,
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
