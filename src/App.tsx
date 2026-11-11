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
import { BottomNavigation } from './components/navigation/BottomNavigation';
import { pushService } from './services/pushNotificationService';
import { PushNotificationBanner } from './components/notifications/PushNotificationBanner';

const AppContent: React.FC = () => {
  const {
    currentScreen,
    setCurrentScreen,
    setActiveTab,
    deviceMode,
    activePartyRoom,
    activeConversation,
    navigateBack,
    currentUser,
  } = useApp();

  // Push Notifications Setup (Capacitor FCM & Real-Time Engagement)
  useEffect(() => {
    pushService
      .initialize({
        onToken: (token) => {
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
  }, [currentUser?.id, setCurrentScreen, setActiveTab]);

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
      if (currentScreen !== 'home' && currentScreen !== 'welcome' && currentScreen !== 'splash') {
        navigateBack();
      } else if (!canGoBack) {
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
  }, [currentScreen, navigateBack]);

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
        <AppContent />
      </DeviceFrame>
    </AppProvider>
  );
}
