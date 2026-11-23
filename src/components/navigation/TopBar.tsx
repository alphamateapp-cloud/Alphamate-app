import React from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../../context/AppContext';
import { AlphaMateLogo } from '../brand/AlphaMateLogo';
import { Search, Bell } from 'lucide-react';
import { PWAInstallButton } from '../common/PWAInstallButton';
import { ThemeToggle } from '../common/ThemeToggle';

interface TopBarProps {
  onSearchClick?: () => void;
  onNotificationsClick?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onSearchClick, onNotificationsClick }) => {
  const { t } = useTranslation();
  const {
    setCurrentScreen,
    setActiveTab,
    unreadNotificationsCount,
    customLogoUrl,
  } = useApp();

  return (
    <header className="sticky top-0 z-30 w-full bg-gradient-to-b from-[#F5F3FA]/95 via-[#F5F3FA]/80 to-transparent dark:from-[#09070F]/95 dark:via-[#09070F]/60 dark:to-transparent px-3 sm:px-4 pt-2 pb-1.5 flex items-center justify-between gap-2 min-w-0 pointer-events-auto transition-colors">
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

      {/* Zone 2: Action Icons (Install PWA, Theme Toggle, Search & Notification Bell) */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <PWAInstallButton variant="compact" />
        {/* Global Theme Toggle */}
        <ThemeToggle variant="icon" />
        {/* Search Icon */}
        <button
          type="button"
          onClick={onSearchClick || (() => setCurrentScreen('search'))}
          className="w-8.5 h-8.5 sm:w-9 sm:h-9 rounded-full bg-white/90 dark:bg-[#1A1133]/85 backdrop-blur-md border border-[#7928CA]/20 dark:border-white/10 flex items-center justify-center text-[#5E5278] dark:text-zinc-300 hover:text-[#140D26] dark:hover:text-white hover:border-[#A855F7]/50 active:scale-95 transition-all cursor-pointer shadow-md shadow-purple-900/10 dark:shadow-black/30"
          title={t('nav.search')}
          aria-label={t('nav.search')}
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Notifications Icon with Unread Badge */}
        <button
          type="button"
          onClick={onNotificationsClick || (() => setCurrentScreen('notifications'))}
          className="relative w-8.5 h-8.5 sm:w-9 sm:h-9 rounded-full bg-white/90 dark:bg-[#1A1133]/85 backdrop-blur-md border border-[#7928CA]/20 dark:border-white/10 flex items-center justify-center text-[#5E5278] dark:text-zinc-300 hover:text-[#140D26] dark:hover:text-white hover:border-[#A855F7]/50 active:scale-95 transition-all cursor-pointer shadow-md shadow-purple-900/10 dark:shadow-black/30"
          title={t('nav.notifications')}
          aria-label={t('nav.notifications')}
        >
          <Bell className="w-4 h-4" />
          {unreadNotificationsCount > 0 && (
            <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-[#EC4899] ring-2 ring-[#F5F3FA] dark:ring-[#09070F] animate-pulse" />
          )}
        </button>
      </div>
    </header>
  );
};
