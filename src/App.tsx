import React, { useEffect, useRef } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { PullToRefresh } from './components/common/PullToRefresh';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { DeviceFrame } from './components/layout/DeviceFrame';
import { SplashScreen } from './screens/SplashScreen';
import { WelcomeScreen } from './screens/WelcomeScreen';
import { RegisterScreen } from './screens/RegisterScreen';
import { SignInScreen } from './screens/SignInScreen';
import { HomeScreen } from './screens/HomeScreen';
import { LiveStreamScreen } from './screens/LiveStreamScreen';
import { PKBattleScreen } from './screens/PKBattleScreen';
import { PartyRoomsScreen } from './screens/PartyRoomsScreen';
import { ChatScreen } from './screens/ChatScreen';
import { VideoUploadScreen } from './screens/VideoUploadScreen';
import { UserProfileScreen } from './screens/UserProfileScreen';
import { WalletScreen } from './screens/WalletScreen';
import { LevelSystemScreen } from './screens/LevelSystemScreen';
import { NotificationsScreen } from './screens/NotificationsScreen';
import { SearchScreen } from './screens/SearchScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { MomentsScreen } from './screens/MomentsScreen';
import { StoreScreen } from './screens/StoreScreen';
import { AdminDashboard } from './screens/AdminDashboard';
import { AgencyManagementScreen } from './screens/AgencyManagementScreen';
import { PrivacyPolicyScreen } from './screens/PrivacyPolicyScreen';
import { TermsConditionsScreen } from './screens/TermsConditionsScreen';
import { DeleteAccountScreen } from './screens/DeleteAccountScreen';
import { AccountRecoveryScreen } from './screens/AccountRecoveryScreen';
import { BottomNavigation } from './components/navigation/BottomNavigation';
import { pushService } from './services/pushNotificationService';
import { keepScreenAwake } from './services/keepScreenAwake';
import { PushNotificationBanner } from './components/notifications/PushNotificationBanner';
import { PushNotificationSettingsModal } from './components/modals/PushNotificationSettingsModal';
import { GlobalWeeklyLeaderboardModal } from './components/leaderboard/GlobalWeeklyLeaderboard';
import { UserBadgesModal } from './components/badges/UserBadgesModal';
import { PublicUserProfileModal } from './components/modals/PublicUserProfileModal';
import { ProfileRegistrationModal } from './components/modals/ProfileRegistrationModal';
import { AccountSwitcherModal } from './components/modals/AccountSwitcherModal';
import {
  subscribeToFirestoreQuotaExceeded,
  FIRESTORE_PROJECT_ID,
  FIRESTORE_DATABASE_ID,
} from './services/firebase';

const PUBLIC_AUTH_SCREENS = new Set([
  'splash',
  'welcome',
  'register',
  'signin',
  'privacy_policy',
  'terms_conditions',
  'delete_account',
  'account_recovery',
]);

const AppContent: React.FC = () => {
  const {
    currentScreen,
    setCurrentScreen,
    setActiveTab,
    deviceMode,
    activePartyRoom,
    activeStream,
    closePartyRoom,
    closeLiveStream,
    activeConversation,
    navigateBack,
    currentUser,
    isAuthenticated,
    firebaseUser,
    firebaseAuthLoading,
    isEmailVerified,
    refreshScope,
  } = useApp();
  const mainTabScrollRef = useRef<HTMLDivElement>(null);

  const isRestrictedLifecycleAccount = Boolean(
    firebaseUser &&
      isEmailVerified &&
      (currentUser?.accountStatus === 'deactivated' ||
        currentUser?.accountStatus === 'pending_deletion' ||
        currentUser?.accountStatus === 'permanently_deleted')
  );
  const isSessionReadyAndAuthed = Boolean(isAuthenticated && firebaseUser && isEmailVerified && !isRestrictedLifecycleAccount);

  const shouldKeepScreenAwake = Boolean(
    deviceMode !== 'admin' &&
      isSessionReadyAndAuthed &&
      (activePartyRoom !== null ||
        activeStream !== null ||
        currentScreen === 'party_room' ||
        currentScreen === 'live_stream' ||
        currentScreen === 'pk_battle')
  );

  useEffect(() => {
    void keepScreenAwake.setActive(shouldKeepScreenAwake);
  }, [shouldKeepScreenAwake]);

  useEffect(() => {
    return () => {
      void keepScreenAwake.setActive(false);
    };
  }, []);

  // Route guard: never allow unauthenticated or restricted accounts into protected main screens
  useEffect(() => {
    if (deviceMode === 'admin') return;
    if (firebaseAuthLoading) return;
    if (
      isRestrictedLifecycleAccount &&
      currentScreen !== 'account_recovery' &&
      currentScreen !== 'delete_account' &&
      currentScreen !== 'privacy_policy' &&
      currentScreen !== 'terms_conditions'
    ) {
      setCurrentScreen('account_recovery');
      return;
    }
    if (!isSessionReadyAndAuthed && !PUBLIC_AUTH_SCREENS.has(currentScreen)) {
      setCurrentScreen('welcome');
    }
  }, [deviceMode, firebaseAuthLoading, isRestrictedLifecycleAccount, isSessionReadyAndAuthed, currentScreen, setCurrentScreen]);

  // Push Notifications Setup (Capacitor FCM & Real-Time Engagement)
  useEffect(() => {
    if (!isSessionReadyAndAuthed || !currentUser?.id) return;
    pushService
      .initialize({
        onToken: () => {
          if (currentUser?.id) {
            pushService.syncTokenToUserDoc(currentUser.id).catch(() => {});
          }
        },
        onActionPerformed: (action) => {
          const screen = action.notification?.data?.screen;
          const tab = action.notification?.data?.tab;
          if (screen) setCurrentScreen(screen as any);
          else if (tab) setActiveTab(tab as any);
        },
      })
      .catch(() => {});
  }, [isSessionReadyAndAuthed, currentUser?.id, setCurrentScreen, setActiveTab]);

  // Android Native Hardware Back Button & Status Bar Integration (Active on Native Android/iOS)
  useEffect(() => {
    // Only invoke native bridge plugins if running inside Capacitor native shell
    if (!Capacitor.isNativePlatform()) return;

    try {
      StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
      StatusBar.setBackgroundColor({ color: '#09070F' }).catch(() => {});
    } catch {}

    let listenerHandle: { remove: () => Promise<void> } | null = null;
    CapApp.addListener('backButton', ({ canGoBack }) => {
      if (activePartyRoom) {
        closePartyRoom(false);
        return;
      }
      if (currentScreen === 'live_stream' || activeStream) {
        closeLiveStream();
        return;
      }
      if (currentScreen === 'signin' || currentScreen === 'register') {
        setCurrentScreen('welcome');
        return;
      }
      if (currentScreen !== 'home' && currentScreen !== 'welcome' && currentScreen !== 'splash') {
        navigateBack();
      } else if (!canGoBack || currentScreen === 'welcome' || currentScreen === 'home') {
        CapApp.minimizeApp().catch(() => {});
      }
    })
      .then((handle) => {
        listenerHandle = handle;
      })
      .catch(() => {});

    return () => {
      if (listenerHandle) {
        listenerHandle.remove().catch(() => {});
      }
    };
  }, [currentScreen, navigateBack, setCurrentScreen, activePartyRoom, activeStream, closePartyRoom, closeLiveStream]);

  // If Admin Dashboard mode is chosen
  if (deviceMode === 'admin') {
    return <AdminDashboard />;
  }

  // Full-screen overlay screens without bottom navigation
  if (currentScreen === 'splash') {
    return <SplashScreen />;
  }
  if (currentScreen === 'welcome') {
    return <WelcomeScreen />;
  }
  if (currentScreen === 'register') {
    return <RegisterScreen />;
  }
  if (currentScreen === 'signin') {
    return <SignInScreen />;
  }
  if (currentScreen === 'privacy_policy') {
    return <PrivacyPolicyScreen />;
  }
  if (currentScreen === 'terms_conditions') {
    return <TermsConditionsScreen />;
  }
  if (currentScreen === 'delete_account') {
    return <DeleteAccountScreen />;
  }

  // Prevent flashing protected screens while auth is unresolved or unauthenticated
  if (firebaseAuthLoading) {
    return <SplashScreen />;
  }
  if (isRestrictedLifecycleAccount || currentScreen === 'account_recovery') {
    return firebaseUser ? <AccountRecoveryScreen /> : <WelcomeScreen />;
  }
  if (!isSessionReadyAndAuthed) {
    return <WelcomeScreen />;
  }
  if (currentScreen === 'live_stream') {
    return <LiveStreamScreen />;
  }
  if (currentScreen === 'pk_battle') {
    return <PKBattleScreen />;
  }
  if (currentScreen === 'wallet') {
    return <WalletScreen />;
  }
  if (currentScreen === 'levels') {
    return <LevelSystemScreen />;
  }
  if (currentScreen === 'notifications') {
    return <NotificationsScreen />;
  }
  if (currentScreen === 'search') {
    return <SearchScreen />;
  }
  if (currentScreen === 'settings') {
    return <SettingsScreen />;
  }
  if (currentScreen === 'agency_management') {
    return <AgencyManagementScreen />;
  }

  // Inside party room full screen
  if (currentScreen === 'party_room' || activePartyRoom !== null) {
    return <PartyRoomsScreen />;
  }

  // Inside direct chat full screen
  if (currentScreen === 'chat_conversation' || activeConversation !== null) {
    return <ChatScreen />;
  }

  // Main navigation tab views with fixed bottom navigation
  const usesDedicatedPullToRefresh =
    currentScreen === 'moments' || currentScreen === 'upload';

  return (
    <div className="relative w-full h-full max-h-[100dvh] bg-[#09070F] flex flex-col overflow-hidden">
      <div
        ref={mainTabScrollRef}
        className="flex-1 w-full overflow-y-auto overflow-x-hidden min-h-0 overscroll-contain"
      >
        {!usesDedicatedPullToRefresh && (
          <PullToRefresh
            scrollContainerRef={mainTabScrollRef}
            onRefresh={() => refreshScope()}
          />
        )}
        {currentScreen === 'home' && <HomeScreen />}
        {currentScreen === 'party' && <PartyRoomsScreen />}
        {currentScreen === 'moments' && <MomentsScreen />}
        {currentScreen === 'store' && <StoreScreen />}
        {currentScreen === 'upload' && <VideoUploadScreen />}
        {currentScreen === 'chat' && <ChatScreen />}
        {currentScreen === 'profile' && <UserProfileScreen />}
      </div>

      {/* Fixed Bottom Navigation (Home, Party, Upload, Chat, Me) */}
      <BottomNavigation />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <DeviceFrame>
        <PushNotificationBanner />
        <GlobalFirestoreQuotaBanner />
        <GlobalPushSettingsHost />
        <GlobalWeeklyLeaderboardModal />
        <UserBadgesModal />
        <PublicUserProfileModal />
        <ProfileRegistrationModal />
        <AccountSwitcherModal />
        <AppContent />
      </DeviceFrame>
    </AppProvider>
  );
}

const GlobalFirestoreQuotaBanner: React.FC = () => {
  const { refreshScope } = useApp();
  const [quotaExceeded, setQuotaExceeded] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(false);

  useEffect(() => {
    return subscribeToFirestoreQuotaExceeded((exceeded) => {
      setQuotaExceeded(exceeded);
      if (!exceeded) setDismissed(false);
    });
  }, []);

  if (!quotaExceeded || dismissed) return null;

  const pricingUrl = 'https://firebase.google.com/pricing#cloud-firestore';
  const consoleDbUrl = `https://console.firebase.google.com/project/${FIRESTORE_PROJECT_ID}/firestore/databases/${FIRESTORE_DATABASE_ID}/data?openUpgradeDialog=true`;

  return (
    <div className="fixed top-4 inset-x-4 z-50 mx-auto max-w-md pointer-events-auto">
      <div className="rounded-2xl border border-amber-400/40 bg-[#23190B]/95 backdrop-blur-xl px-4 py-3 text-xs text-amber-100 shadow-2xl space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-bold text-amber-300">Cloud Sync Quota Reached</p>
            <p className="text-[11px] text-amber-100/85 mt-0.5 leading-snug">
              Daily Firestore Spark free-tier write quota was reached and resets tomorrow. Background cloud writes are paused while cached data stays active.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold shrink-0 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => refreshScope()}
            className="px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/30 text-amber-200 text-[11px] font-bold cursor-pointer"
          >
            Retry Sync
          </button>
          <a
            href={consoleDbUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-white text-[11px] font-semibold"
          >
            Database Console
          </a>
          <a
            href={pricingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2.5 py-1 rounded-lg text-amber-300 hover:text-amber-200 underline text-[11px] font-medium"
          >
            Spark Limits
          </a>
        </div>
      </div>
    </div>
  );
};

const GlobalPushSettingsHost: React.FC = () => {
  const { showPushSettingsModal, setShowPushSettingsModal } = useApp();
  return (
    <PushNotificationSettingsModal
      isOpen={showPushSettingsModal}
      onClose={() => setShowPushSettingsModal(false)}
    />
  );
};
