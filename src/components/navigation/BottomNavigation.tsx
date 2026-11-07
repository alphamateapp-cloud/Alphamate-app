import React from 'react';
import { useApp } from '../../context/AppContext';
import { MainTabType } from '../../types';
import { Home, Radio, Clapperboard, ShoppingBag, MessageCircle, User } from 'lucide-react';

export const BottomNavigation: React.FC = () => {
  const { activeTab, setActiveTab, conversations } = useApp();

  const totalUnreadMessages = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  const tabs: { id: MainTabType; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'home', label: 'HOME', icon: Home },
    { id: 'party', label: 'PARTY', icon: Radio },
    { id: 'moments', label: 'MOMENTS', icon: Clapperboard },
    { id: 'store', label: 'STORE', icon: ShoppingBag },
    { id: 'chat', label: 'CHAT', icon: MessageCircle },
    { id: 'me', label: 'ME', icon: User },
  ];

  return (
    <nav
      role="navigation"
      aria-label="Main Navigation"
      className="fixed bottom-0 left-0 right-0 z-40 max-w-md mx-auto pointer-events-auto"
    >
      {/* 6-item Equal Width Bottom Bar with Safe Area Support */}
      <div className="relative h-15 sm:h-16 bg-[#0B0617]/95 backdrop-blur-xl border-t border-[#A855F7]/20 px-0.5 sm:px-1 grid grid-cols-6 items-center shadow-[0_-8px_30px_rgba(0,0,0,0.7)] pb-[env(safe-area-inset-bottom)]">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
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
                      ? 'text-[#C084FC] stroke-[2.4] scale-110 drop-shadow-[0_0_10px_rgba(168,85,247,0.7)]'
                      : 'text-zinc-400 group-hover:text-zinc-200 stroke-[1.8]'
                  }`}
                />

                {/* Badge for Chat */}
                {tab.id === 'chat' && totalUnreadMessages > 0 && (
                  <span className="absolute -top-1 -right-2 min-w-[14px] h-[14px] px-0.5 rounded-full bg-[#EC4899] text-[8px] font-black text-white flex items-center justify-center border border-[#0B0617]">
                    {totalUnreadMessages}
                  </span>
                )}
              </div>

              {/* Label */}
              <span
                className={`text-[9px] sm:text-[10px] font-bold tracking-tight truncate max-w-full text-center mt-0.5 transition-colors ${
                  isActive
                    ? 'text-white drop-shadow-[0_0_6px_rgba(168,85,247,0.5)]'
                    : 'text-zinc-400 group-hover:text-zinc-300'
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
