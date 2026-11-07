import React from 'react';
import { useApp } from '../../context/AppContext';
import { AlphaMateLogo } from '../brand/AlphaMateLogo';
import { Search, Bell, Crown, Gift } from 'lucide-react';

interface TopBarProps {
  onSearchClick?: () => void;
  onNotificationsClick?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onSearchClick, onNotificationsClick }) => {
  const {
    currentUser,
    setCurrentScreen,
    setActiveTab,
    unreadNotificationsCount,
    customLogoUrl,
    dailyCheckInState,
    setShowDailyCheckInModal,
  } = useApp();

  return (
    <header className="sticky top-0 z-30 w-full bg-[#09070F]/90 backdrop-blur-md border-b border-[#A855F7]/15 px-3 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between">
      {/* Zone 1: Alpha Mate Branding */}
      <div
        onClick={() => {
          setActiveTab('home');
          setCurrentScreen('home');
        }}
        className="cursor-pointer shrink-0"
      >
        <AlphaMateLogo
          size="sm"
          showText={true}
          withGlow={true}
          customLogoUrl={customLogoUrl}
        />
      </div>

      {/* Zone 2: Action Icons & Profile Shortcut */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Daily Check-In Rewards Icon */}
        <button
          onClick={() => setShowDailyCheckInModal(true)}
          className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#18102E] border border-amber-500/30 hover:border-amber-400 flex items-center justify-center text-amber-300 hover:text-amber-200 transition-colors cursor-pointer"
          title="Daily Check-In Rewards"
        >
          <Gift className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          {!dailyCheckInState.isClaimedToday && (
            <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-gradient-to-r from-amber-400 to-[#EC4899] ring-2 ring-[#09070F] animate-bounce flex items-center justify-center text-[7px] font-black text-white">
              !
            </span>
          )}
        </button>

        {/* Search Icon */}
        <button
          onClick={onSearchClick || (() => setCurrentScreen('search'))}
          className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#18102E] border border-[#A855F7]/20 flex items-center justify-center text-zinc-300 hover:text-white hover:border-[#A855F7]/50 transition-colors cursor-pointer"
          title="Search"
        >
          <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>

        {/* Notifications Icon with Unread Badge */}
        <button
          onClick={onNotificationsClick || (() => setCurrentScreen('notifications'))}
          className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#18102E] border border-[#A855F7]/20 flex items-center justify-center text-zinc-300 hover:text-white hover:border-[#A855F7]/50 transition-colors cursor-pointer"
          title="Notifications"
        >
          <Bell className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          {unreadNotificationsCount > 0 && (
            <span className="absolute top-0.5 right-0.5 w-2.5 h-2.5 rounded-full bg-[#EC4899] ring-2 ring-[#09070F] animate-pulse" />
          )}
        </button>

        {/* User Profile Shortcut */}
        <button
          onClick={() => {
            setActiveTab('me');
            setCurrentScreen('profile');
          }}
          className="relative ml-0.5 cursor-pointer group"
          title="My Profile"
        >
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full p-[1.5px] bg-gradient-to-tr from-[#7928CA] via-[#EC4899] to-[#F59E0B] shadow-sm">
            <img
              src={currentUser.avatar}
              alt={currentUser.displayName}
              className="w-full h-full rounded-full object-cover"
            />
          </div>
          {currentUser.vipTier > 0 && (
            <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-gradient-to-r from-amber-400 to-amber-600 flex items-center justify-center shadow-sm">
              <Crown className="w-2 h-2 sm:w-2.5 sm:h-2.5 text-black stroke-[2.5]" />
            </div>
          )}
        </button>
      </div>
    </header>
  );
};
