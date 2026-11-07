import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
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
import { BottomNavigation } from './components/navigation/BottomNavigation';

const AppContent: React.FC = () => {
  const { currentScreen, deviceMode, activePartyRoom, activeConversation } = useApp();

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
    <div className="relative w-full h-full min-h-screen bg-[#09070F] flex flex-col">
      <div className="flex-1 w-full">
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
        <AppContent />
      </DeviceFrame>
    </AppProvider>
  );
}
