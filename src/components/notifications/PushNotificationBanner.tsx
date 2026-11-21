import React, { useState, useEffect, useCallback } from 'react';
import {
  Bell,
  X,
  ExternalLink,
  Gift,
  Swords,
  Radio,
  ShieldCheck,
  ShieldBan,
  AlertTriangle,
  CheckCircle2,
  BadgeCheck,
  DollarSign,
  UserPlus,
  MessageCircle,
  MessageSquare,
  Heart,
  Users,
} from 'lucide-react';
import { pushService, isOfficialAdminNotificationType } from '../../services/pushNotificationService';
import { useApp } from '../../context/AppContext';

export interface ActivePushBanner {
  id: string;
  title: string;
  body: string;
  data?: any;
}

export const PushNotificationBanner: React.FC = () => {
  const [activeBanner, setActiveBanner] = useState<ActivePushBanner | null>(null);
  const {
    setCurrentScreen,
    setActiveTab,
    liveStreams,
    openLiveStream,
    partyRooms,
    openPartyRoom,
    notifications,
    openAdminNotificationDetails,
  } = useApp();

  const handleBannerClick = useCallback(
    (banner: ActivePushBanner) => {
      const data = banner.data || {};
      if (data.isAdminAction || isOfficialAdminNotificationType(data.type)) {
        const matched =
          notifications.find((n) => n.id === (data.notificationId || banner.id)) || null;
        if (matched) {
          openAdminNotificationDetails(matched);
        } else {
          setCurrentScreen('notifications');
        }
        setActiveBanner(null);
        return;
      }
      if (data.streamId) {
        const matchedStream = liveStreams.find((s) => s.id === data.streamId);
        if (matchedStream) {
          openLiveStream(matchedStream);
          setActiveBanner(null);
          return;
        }
      }
      if (data.roomId) {
        const matchedRoom = partyRooms.find((r) => r.id === data.roomId);
        if (matchedRoom) {
          openPartyRoom(matchedRoom);
          setActiveBanner(null);
          return;
        }
      }

      const screen = data.screen;
      const tab = data.tab;
      const type = data.type;

      if (screen && screen !== 'live_stream' && screen !== 'party_room') {
        setCurrentScreen(screen as any);
      } else if (tab) {
        setActiveTab(tab as any);
      } else if (type === 'gift' || type === 'wallet') {
        setCurrentScreen('wallet');
      } else if (type === 'pk_invite' || type === 'party_invite') {
        setActiveTab('party');
        setCurrentScreen('party');
      } else if (type === 'live_on') {
        setActiveTab('home');
        setCurrentScreen('home');
      } else if (type === 'message' || type === 'friend_request' || type === 'follow') {
        setActiveTab('chat');
        setCurrentScreen('chat');
      } else if (type === 'comment' || type === 'like') {
        setCurrentScreen('moments');
      } else if (type === 'agency') {
        setCurrentScreen('agency_management');
      } else {
        setCurrentScreen('notifications');
      }

      setActiveBanner(null);
    },
    [
      liveStreams,
      openLiveStream,
      partyRooms,
      openPartyRoom,
      setCurrentScreen,
      setActiveTab,
      notifications,
      openAdminNotificationDetails,
    ]
  );

  useEffect(() => {
    pushService.initialize({
      onReceived: (notification) => {
        const type = (notification.data as any)?.type;
        if (!pushService.isCategoryAllowed(type)) return;
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
  }, [handleBannerClick]);

  // Auto-dismiss banner after 6 seconds
  useEffect(() => {
    if (!activeBanner) return;
    const timer = setTimeout(() => {
      setActiveBanner(null);
    }, 6000);
    return () => clearTimeout(timer);
  }, [activeBanner]);

  if (!activeBanner) return null;

  const getIcon = () => {
    const type = activeBanner.data?.type;
    switch (type) {
      case 'account_blocked':
      case 'live_restricted':
      case 'party_restricted':
        return <ShieldBan className="w-5 h-5 text-rose-400" />;
      case 'account_suspended':
      case 'admin_warning':
        return <AlertTriangle className="w-5 h-5 text-amber-400" />;
      case 'access_restored':
        return <CheckCircle2 className="w-5 h-5 text-emerald-400" />;
      case 'verification':
        return <BadgeCheck className="w-5 h-5 text-sky-400" />;
      case 'admin_action':
      case 'moderation':
        return <ShieldCheck className="w-5 h-5 text-[#C084FC]" />;
      case 'live_on':
        return <Radio className="w-5 h-5 text-[#EC4899] animate-pulse" />;
      case 'party_invite':
        return <Users className="w-5 h-5 text-[#A855F7]" />;
      case 'friend_request':
      case 'follow':
        return <UserPlus className="w-5 h-5 text-emerald-400" />;
      case 'gift':
        return <Gift className="w-5 h-5 text-amber-400" />;
      case 'message':
        return <MessageCircle className="w-5 h-5 text-cyan-400" />;
      case 'comment':
        return <MessageSquare className="w-5 h-5 text-violet-300" />;
      case 'like':
        return <Heart className="w-5 h-5 text-rose-400" />;
      case 'pk_invite':
        return <Swords className="w-5 h-5 text-[#EC4899]" />;
      case 'agency':
        return <ShieldCheck className="w-5 h-5 text-emerald-400" />;
      case 'wallet':
        return <DollarSign className="w-5 h-5 text-green-400" />;
      default:
        return <Bell className="w-5 h-5 text-[#C084FC]" />;
    }
  };

  const isOfficialAdminBanner = Boolean(
    activeBanner.data?.isAdminAction || isOfficialAdminNotificationType(activeBanner.data?.type)
  );

  return (
    <div className="fixed top-[calc(var(--app-safe-top,0px)+12px)] inset-x-3 z-50 max-w-md mx-auto animate-in slide-in-from-top-4 duration-300 pointer-events-auto">
      <div
        onClick={() => handleBannerClick(activeBanner)}
        className={`w-full bg-[#180E2E]/95 backdrop-blur-xl border shadow-2xl shadow-purple-950/60 rounded-2xl p-3.5 flex items-start gap-3 cursor-pointer transition-all group ${
          isOfficialAdminBanner
            ? 'border-amber-400/55 hover:border-amber-300'
            : 'border-[#A855F7]/40 hover:border-[#EC4899]/60'
        }`}
      >
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#A855F7]/30 to-[#EC4899]/30 border border-white/10 flex items-center justify-center shrink-0 shadow-inner">
          {getIcon()}
        </div>

        <div className="flex-1 min-w-0 pr-1">
          <div className="flex items-center justify-between gap-2">
            <span
              className={`text-[11px] font-bold tracking-wider uppercase flex items-center gap-1.5 ${
                isOfficialAdminBanner ? 'text-amber-300' : 'text-[#C084FC]'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full animate-ping ${
                  isOfficialAdminBanner ? 'bg-amber-400' : 'bg-emerald-400'
                }`}
              />
              {isOfficialAdminBanner ? 'Official Admin Action' : 'Alpha Mate Alert'}
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
