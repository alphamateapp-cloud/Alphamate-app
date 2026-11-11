import React, { useState, useEffect } from 'react';
import { Bell, X, ExternalLink, Gift, Swords, Radio, ShieldCheck, DollarSign } from 'lucide-react';
import { pushService } from '../../services/pushNotificationService';
import { useApp } from '../../context/AppContext';

export interface ActivePushBanner {
  id: string;
  title: string;
  body: string;
  data?: any;
}

export const PushNotificationBanner: React.FC = () => {
  const [activeBanner, setActiveBanner] = useState<ActivePushBanner | null>(null);
  const { setCurrentScreen, setActiveTab } = useApp();

  useEffect(() => {
    // Listen to push notifications arriving in foreground
    pushService.initialize({
      onReceived: (notification) => {
        setActiveBanner({
          id: notification.id || String(Date.now()),
          title: notification.title || 'Alpha Mate Alert',
          body: notification.body || '',
          data: notification.data || {},
        });
      },
      onActionPerformed: (action) => {
        handleBannerClick({
          id: action.notification.id || 'action',
          title: action.notification.title || '',
          body: action.notification.body || '',
          data: action.notification.data || {},
        });
      },
    });
  }, []);

  // Auto-dismiss banner after 6 seconds
  useEffect(() => {
    if (!activeBanner) return;
    const timer = setTimeout(() => {
      setActiveBanner(null);
    }, 6000);
    return () => clearTimeout(timer);
  }, [activeBanner]);

  if (!activeBanner) return null;

  const handleBannerClick = (banner: ActivePushBanner) => {
    const screen = banner.data?.screen;
    const tab = banner.data?.tab;

    if (screen) {
      setCurrentScreen(screen as any);
    } else if (tab) {
      setActiveTab(tab as any);
    } else if (banner.data?.type === 'gift' || banner.data?.type === 'wallet') {
      setCurrentScreen('wallet');
    } else if (banner.data?.type === 'pk_invite' || banner.data?.type === 'party_invite') {
      setActiveTab('party');
    } else if (banner.data?.type === 'agency') {
      setCurrentScreen('agency_management');
    } else {
      setCurrentScreen('notifications');
    }

    setActiveBanner(null);
  };

  const getIcon = () => {
    const type = activeBanner.data?.type;
    switch (type) {
      case 'gift':
        return <Gift className="w-5 h-5 text-amber-400" />;
      case 'pk_invite':
        return <Swords className="w-5 h-5 text-[#EC4899]" />;
      case 'party_invite':
        return <Radio className="w-5 h-5 text-[#A855F7]" />;
      case 'agency':
        return <ShieldCheck className="w-5 h-5 text-emerald-400" />;
      case 'wallet':
        return <DollarSign className="w-5 h-5 text-green-400" />;
      default:
        return <Bell className="w-5 h-5 text-[#C084FC]" />;
    }
  };

  return (
    <div className="fixed top-3 inset-x-3 z-50 max-w-md mx-auto animate-in slide-in-from-top-4 duration-300 pointer-events-auto">
      <div
        onClick={() => handleBannerClick(activeBanner)}
        className="w-full bg-[#180E2E]/95 backdrop-blur-xl border border-[#A855F7]/40 shadow-2xl shadow-purple-950/60 rounded-2xl p-3.5 flex items-start gap-3 cursor-pointer hover:border-[#EC4899]/60 transition-all group"
      >
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#A855F7]/30 to-[#EC4899]/30 border border-white/10 flex items-center justify-center shrink-0 shadow-inner">
          {getIcon()}
        </div>

        <div className="flex-1 min-w-0 pr-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold tracking-wider uppercase text-[#C084FC] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              Alpha Mate Alert
            </span>
            <span className="text-[10px] text-zinc-400">Just now</span>
          </div>

          <h4 className="text-xs font-bold text-white truncate mt-0.5">{activeBanner.title}</h4>
          <p className="text-xs text-zinc-300 line-clamp-2 mt-0.5 leading-snug">
            {activeBanner.body}
          </p>
        </div>

        <div className="flex flex-col items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setActiveBanner(null);
            }}
            className="w-6 h-6 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
          <ExternalLink className="w-3 h-3 text-[#C084FC] opacity-60 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>
    </div>
  );
};
