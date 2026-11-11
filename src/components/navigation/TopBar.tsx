import React from 'react';
import { useApp } from '../../context/AppContext';
import { AlphaMateLogo } from '../brand/AlphaMateLogo';
import { Search, Bell } from 'lucide-react';

interface TopBarProps {
  onSearchClick?: () => void;
  onNotificationsClick?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onSearchClick, onNotificationsClick }) => {
  const {
    setCurrentScreen,
    setActiveTab,
    unreadNotificationsCount,
    customLogoUrl,
  } = useApp();

  return (
    <header className="sticky top-0 z-30 w-full bg-gradient-to-b from-[#09070F]/95 via-[#09070F]/60 to-transparent px-3.5 sm:px-4 pt-2 pb-1.5 flex items-center justify-between pointer-events-auto">
      {/* Zone 1: Alpha Mate Branding */}
      <div
        onClick={() => {
          setActiveTab('home');
          setCurrentScreen('home');
        }}
        className="cursor-pointer shrink-0 transition-transform active:scale-95"
      >
        <AlphaMateLogo
          size="sm"
          showText={true}
          withGlow={true}
          customLogoUrl={customLogoUrl}
        />
      </div>

      {/* Zone 2: Action Icons (Search & Notification Bell) */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Search Icon */}
        <button
          onClick={onSearchClick || (() => setCurrentScreen('search'))}
          className="w-8.5 h-8.5 sm:w-9 sm:h-9 rounded-full bg-[#1A1133]/85 backdrop-blur-md border border-white/10 flex items-center justify-center text-zinc-300 hover:text-white hover:border-[#A855F7]/40 active:scale-95 transition-all cursor-pointer shadow-md shadow-black/30"
          title="Search"
          aria-label="Search"
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Notifications Icon with Unread Badge */}
        <button
          onClick={onNotificationsClick || (() => setCurrentScreen('notifications'))}
          className="relative w-8.5 h-8.5 sm:w-9 sm:h-9 rounded-full bg-[#1A1133]/85 backdrop-blur-md border border-white/10 flex items-center justify-center text-zinc-300 hover:text-white hover:border-[#A855F7]/40 active:scale-95 transition-all cursor-pointer shadow-md shadow-black/30"
          title="Notifications"
          aria-label="Notifications"
        >
          <Bell className="w-4 h-4" />
          {unreadNotificationsCount > 0 && (
            <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-[#EC4899] ring-2 ring-[#09070F] animate-pulse" />
          )}
        </button>
      </div>
    </header>
  );
};
