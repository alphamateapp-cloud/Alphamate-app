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
import { initDeviceDimensions } from './services/deviceDimensions';
import { BatteryStatus } from './components/common/BatteryStatus';
import { OfflineIndicator } from './components/common/OfflineIndicator';
import { PushNotificationBanner } from './components/notifications/PushNotificationBanner';
import { PushNotificationSettingsModal } from './components/modals/PushNotificationSettingsModal';
import { GlobalWeeklyLeaderboardModal } from './components/leaderboard/GlobalWeeklyLeaderboard';
import { UserBadgesModal } from './components/badges/UserBadgesModal';
import { PublicUserProfileModal } from './components/modals/PublicUserProfileModal';
import { ProfileRegistrationModal } from './components/modals/ProfileRegistrationModal';
import { AccountSwitcherModal } from './components/modals/AccountSwitcherModal';
import { AdminActionModals } from './components/moderation/AdminActionModals';
import {
  ModerationGuard,
  useAuthModerationStatus,
  LIVE_RESTRICTED_SCREENS,
  PARTY_RESTRICTED_SCREENS,
} from './components/moderation/ModerationGuard';
import {
  subscribeToFirestoreQuotaExceeded,
  FIRESTORE_PROJECT_ID,
  FIRESTORE_DATABASE_ID,
} from './services/firebase';

/**
 * Keeps native platform integrations (screen wake lock, FCM push setup, Android StatusBar & hardware back button)
 * active consistently across both unrestricted screens and moderation restriction screens.
 */
const NativePlatformBridge: React.FC = () => {
  const {
    currentScreen,
    setCurrentScreen,
    setActiveTab,
    deviceMode,
    activePartyRoom,
    activeStream,
    closePartyRoom,
    closeLiveStream,
    navigateBack,
    currentUser,
  } = useApp();

  const {
    isSessionReadyAndAuthed,
    isAccountAdminRestricted,
    isLiveRestricted,
    isPartyRestricted,
  } = useAuthModerationStatus();

  const isInUnrestrictedLiveSession = Boolean(
    !isLiveRestricted &&
      (activeStream !== null ||
        currentScreen === 'live_stream' ||
        currentScreen === 'pk_battle')
  );
  const isInUnrestrictedPartySession = Boolean(
    !isPartyRestricted && (activePartyRoom !== null || currentScreen === 'party_room')
  );

  const shouldKeepScreenAwake = Boolean(
    deviceMode !== 'admin' &&
      isSessionReadyAndAuthed &&
      !isAccountAdminRestricted &&
      (isInUnrestrictedLiveSession || isInUnrestrictedPartySession)
  );

  useEffect(() => {
    void keepScreenAwake.setActive(shouldKeepScreenAwake);
  }, [shouldKeepScreenAwake]);

  useEffect(() => {
    return () => {
      void keepScreenAwake.setActive(false);
    };
  }, []);

  // Push Notifications Setup (Capacitor FCM & Real-Time Engagement)
  useEffect(() => {
    if (!isSessionReadyAndAuthed || isAccountAdminRestricted || !currentUser?.id) return;
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
  }, [
    isSessionReadyAndAuthed,
    isAccountAdminRestricted,
    currentUser?.id,
    setCurrentScreen,
    setActiveTab,
  ]);

  // Universal Device Dimensions & Safe-Area Inset Synchronization (Android, iOS, PWA & Web)
  useEffect(() => {
    return initDeviceDimensions();
  }, []);

  // Android Native Hardware Back Button & Status Bar Integration (Active on Native Android/iOS)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    try {
      StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});
      StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
      StatusBar.setBackgroundColor({ color: '#09070F' }).catch(() => {});
    } catch {}

    let listenerHandle: { remove: () => Promise<void> } | null = null;
    CapApp.addListener('backButton', ({ canGoBack }) => {
      if (isAccountAdminRestricted) {
        CapApp.minimizeApp().catch(() => {});
        return;
      }
      if (isLiveRestricted && (LIVE_RESTRICTED_SCREENS.has(currentScreen) || activeStream !== null)) {
        if (activeStream) closeLiveStream();
        setActiveTab('home');
        setCurrentScreen('home');
        return;
      }
      if (
        isPartyRestricted &&
        (PARTY_RESTRICTED_SCREENS.has(currentScreen) || activePartyRoom !== null)
      ) {
        if (activePartyRoom) closePartyRoom(false);
        setActiveTab('home');
        setCurrentScreen('home');
        return;
      }
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
  }, [
    isAccountAdminRestricted,
    isLiveRestricted,
    isPartyRestricted,
    currentScreen,
    navigateBack,
    setActiveTab,
    setCurrentScreen,
    activePartyRoom,
    activeStream,
    closePartyRoom,
    closeLiveStream,
  ]);

  return null;
};

const AppContent: React.FC = () => {
  const {
    currentScreen,
    deviceMode,
    activePartyRoom,
    activeConversation,
    refreshScope,
  } = useApp();
  const mainTabScrollRef = useRef<HTMLDivElement>(null);

  // Admin Dashboard mode
  if (deviceMode === 'admin') {
    return <AdminDashboard />;
  }

  // Public & legal full-screen views without bottom navigation
  switch (currentScreen) {
    case 'splash':
      return <SplashScreen />;
    case 'welcome':
      return <WelcomeScreen />;
    case 'register':
      return <RegisterScreen />;
    case 'signin':
      return <SignInScreen />;
    case 'privacy_policy':
      return <PrivacyPolicyScreen />;
    case 'terms_conditions':
      return <TermsConditionsScreen />;
    case 'delete_account':
      return <DeleteAccountScreen />;
    case 'account_recovery':
      return <AccountRecoveryScreen />;
    case 'live_stream':
      return <LiveStreamScreen />;
    case 'pk_battle':
      return <PKBattleScreen />;
    case 'wallet':
      return <WalletScreen />;
    case 'levels':
      return <LevelSystemScreen />;
    case 'notifications':
      return <NotificationsScreen />;
    case 'search':
      return <SearchScreen />;
    case 'settings':
      return <SettingsScreen />;
    case 'agency_management':
      return <AgencyManagementScreen />;
    default:
      break;
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
    <div className="relative w-full h-full bg-[#09070F] flex flex-col overflow-hidden">
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
        {currentScreen === 'party' && (
          <ModerationGuard scope="party">
            <PartyRoomsScreen />
          </ModerationGuard>
        )}
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

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      message: error?.message || 'An unexpected error occurred.',
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full min-h-[100dvh] bg-[#09070F] text-white flex flex-col items-center justify-center p-6 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-2xl">
            ⚠️
          </div>
          <div className="space-y-1 max-w-sm">
            <h2 className="text-base font-extrabold text-white">Something went wrong</h2>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Please tap Reload to restore your session cleanly.
            </p>
          </div>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, message: '' })}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white text-xs font-bold shadow-lg cursor-pointer"
          >
            Reload View
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <AppProvider>
      <DeviceFrame>
        <NativePlatformBridge />
        <PushNotificationBanner />
        <BatteryStatus />
        <OfflineIndicator />
        <GlobalFirestoreQuotaBanner />
        <GlobalPushSettingsHost />
        <GlobalWeeklyLeaderboardModal />
        <UserBadgesModal />
        <PublicUserProfileModal />
        <ProfileRegistrationModal />
        <AccountSwitcherModal />
        <AdminActionModals />
        <AppErrorBoundary>
          <ModerationGuard>
            <AppContent />
          </ModerationGuard>
        </AppErrorBoundary>
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
    <div className="fixed top-[calc(var(--app-safe-top,0px)+12px)] inset-x-4 z-50 mx-auto max-w-md pointer-events-auto">
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
