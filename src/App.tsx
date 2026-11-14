import React, { useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
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
import { PushNotificationBanner } from './components/notifications/PushNotificationBanner';
import { PushNotificationSettingsModal } from './components/modals/PushNotificationSettingsModal';

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
  } = useApp();

  const isRestrictedLifecycleAccount = Boolean(
    firebaseUser &&
      isEmailVerified &&
      (currentUser?.accountStatus === 'deactivated' ||
        currentUser?.accountStatus === 'pending_deletion' ||
        currentUser?.accountStatus === 'permanently_deleted')
  );
  const isSessionReadyAndAuthed = Boolean(isAuthenticated && firebaseUser && isEmailVerified && !isRestrictedLifecycleAccount);

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
  return (
    <div className="relative w-full h-full max-h-[100dvh] bg-[#09070F] flex flex-col overflow-hidden">
      <div className="flex-1 w-full overflow-y-auto overflow-x-hidden min-h-0 overscroll-contain">
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
        <GlobalPushSettingsHost />
        <AppContent />
      </DeviceFrame>
    </AppProvider>
  );
}

const GlobalPushSettingsHost: React.FC = () => {
  const { showPushSettingsModal, setShowPushSettingsModal } = useApp();
  return (
    <PushNotificationSettingsModal
      isOpen={showPushSettingsModal}
      onClose={() => setShowPushSettingsModal(false)}
    />
  );
};
