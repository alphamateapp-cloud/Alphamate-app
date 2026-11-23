import React from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../../context/AppContext';
import { MainTabType } from '../../types';
import { Home, Radio, Clapperboard, ShoppingBag, MessageCircle, User } from 'lucide-react';

export const BottomNavigation: React.FC = () => {
  const { t } = useTranslation();
  const { activeTab, setActiveTab, conversations } = useApp();

  const totalUnreadMessages = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  const tabs: { id: MainTabType; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'home', label: t('nav.home'), icon: Home },
    { id: 'party', label: t('nav.party'), icon: Radio },
    { id: 'moments', label: t('nav.moments'), icon: Clapperboard },
    { id: 'store', label: t('nav.store'), icon: ShoppingBag },
    { id: 'chat', label: t('nav.chat'), icon: MessageCircle },
    { id: 'me', label: t('nav.me'), icon: User },
  ];

  return (
    <nav
      role="navigation"
      aria-label={t('nav.mainNavigation')}
      className="relative shrink-0 w-full z-40 pointer-events-auto bg-white/95 dark:bg-[#0B0617]/95 backdrop-blur-xl border-t border-[#7928CA]/15 dark:border-[#A855F7]/20 shadow-[0_-8px_24px_rgba(88,28,135,0.08)] dark:shadow-[0_-8px_30px_rgba(0,0,0,0.7)] transition-colors duration-200"
    >
      {/* 6-item Equal Width Bottom Bar with Non-Overlapping Touch Targets */}
      <div className="relative h-15 sm:h-16 px-0.5 sm:px-1 grid grid-cols-6 items-center">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className="relative flex flex-col items-center justify-center h-full py-1 min-w-0 transition-all cursor-pointer group focus:outline-none"
            >
              {/* Active Tab Accent Line */}
              {isActive && (
                <div className="absolute top-0 w-6 sm:w-8 h-[2.5px] rounded-full bg-gradient-to-r from-[#A855F7] via-[#EC4899] to-[#C084FC] shadow-[0_0_10px_#A855F7]" />
              )}

              {/* Icon Container with Badge */}
              <div className="relative flex items-center justify-center">
                <Icon
                  className={`w-4.5 h-4.5 sm:w-5 sm:h-5 transition-transform duration-200 ${
                    isActive
                      ? 'text-[#7928CA] dark:text-[#C084FC] stroke-[2.4] scale-110 drop-shadow-[0_0_8px_rgba(168,85,247,0.45)] dark:drop-shadow-[0_0_10px_rgba(168,85,247,0.7)]'
                      : 'text-[#6E628A] dark:text-zinc-400 group-hover:text-[#140D26] dark:group-hover:text-zinc-200 stroke-[1.8]'
                  }`}
                />

                {/* Badge for Chat */}
                {tab.id === 'chat' && totalUnreadMessages > 0 && (
                  <span className="absolute -top-1 -right-2 min-w-[14px] h-[14px] px-0.5 rounded-full bg-[#EC4899] text-[8px] font-black text-white flex items-center justify-center border border-white dark:border-[#0B0617]">
                    {totalUnreadMessages}
                  </span>
                )}
              </div>

              {/* Label */}
              <span
                className={`text-[9px] sm:text-[10px] font-bold tracking-tight truncate max-w-full text-center mt-0.5 transition-colors ${
                  isActive
                    ? 'text-[#140D26] dark:text-white dark:drop-shadow-[0_0_6px_rgba(168,85,247,0.5)]'
                    : 'text-[#6E628A] dark:text-zinc-400 group-hover:text-[#140D26] dark:group-hover:text-zinc-300'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
