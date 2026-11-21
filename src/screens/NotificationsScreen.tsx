import React, { useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { PullToRefresh } from '../components/common/PullToRefresh';
import { safeImageSrc } from '../utils/imageHd';
import {
  ArrowLeft,
  Bell,
  Gift,
  Swords,
  Radio,
  UserPlus,
  Info,
  CheckCheck,
  SlidersHorizontal,
  MessageCircle,
  MessageSquare,
  Heart,
  Users,
  ShieldCheck,
  ShieldBan,
  AlertTriangle,
  CheckCircle2,
  BadgeCheck,
  Clock,
  DollarSign,
  ChevronDown,
  ChevronUp,
  ChevronRight,
} from 'lucide-react';
import {
  NOTIFICATION_CATEGORY_META,
  getCategoryForNotificationType,
} from '../services/pushNotificationService';
import { NotificationCategoryKey, NotificationItem } from '../types';

type FeedFilter = 'all' | 'admin' | 'live_party' | 'gifts' | 'social' | 'messages' | 'system';

export const NotificationsScreen: React.FC = () => {
  const {
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
    unreadNotificationsCount,
    navigateBack,
    notificationPreferences,
    updateNotificationPreferences,
    toggleMasterNotifications,
    setShowPushSettingsModal,
    setCurrentScreen,
    setActiveTab,
    liveStreams,
    openLiveStream,
    partyRooms,
    openPartyRoom,
    refreshScope,
    openAdminNotificationDetails,
  } = useApp();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [activeFilter, setActiveFilter] = useState<FeedFilter>('all');
  const [showInlineCategories, setShowInlineCategories] = useState<boolean>(
    notificationPreferences.enabled
  );

  const getIcon = (type: string, actionKind?: string) => {
    if (actionKind === 'account_blocked' || actionKind === 'live_suspended' || actionKind === 'party_restricted') {
      return <ShieldBan className="w-4 h-4 text-rose-400" />;
    }
    if (actionKind === 'account_suspended' || actionKind === 'admin_warning') {
      return <AlertTriangle className="w-4 h-4 text-amber-400" />;
    }
    if (
      actionKind === 'account_unblocked' ||
      actionKind === 'account_restored' ||
      actionKind === 'live_restored' ||
      actionKind === 'party_restored'
    ) {
      return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
    }
    if (
      actionKind === 'verification_granted' ||
      actionKind === 'verification_removed' ||
      actionKind === 'verification_updated'
    ) {
      return <BadgeCheck className="w-4 h-4 text-sky-400" />;
    }
    switch (type) {
      case 'account_blocked':
      case 'live_restricted':
      case 'party_restricted':
        return <ShieldBan className="w-4 h-4 text-rose-400" />;
      case 'account_suspended':
      case 'admin_warning':
        return <AlertTriangle className="w-4 h-4 text-amber-400" />;
      case 'access_restored':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case 'verification':
        return <BadgeCheck className="w-4 h-4 text-sky-400" />;
      case 'admin_action':
      case 'moderation':
        return <ShieldCheck className="w-4 h-4 text-[#C084FC]" />;
      case 'live_on':
        return <Radio className="w-4 h-4 text-[#EC4899]" />;
      case 'party_invite':
        return <Users className="w-4 h-4 text-[#A855F7]" />;
      case 'friend_request':
      case 'follow':
        return <UserPlus className="w-4 h-4 text-emerald-400" />;
      case 'gift':
        return <Gift className="w-4 h-4 text-amber-400" />;
      case 'message':
        return <MessageCircle className="w-4 h-4 text-cyan-400" />;
      case 'comment':
        return <MessageSquare className="w-4 h-4 text-violet-300" />;
      case 'like':
        return <Heart className="w-4 h-4 text-rose-400" />;
      case 'pk_invite':
        return <Swords className="w-4 h-4 text-fuchsia-400" />;
      case 'agency':
        return <ShieldCheck className="w-4 h-4 text-emerald-400" />;
      case 'wallet':
        return <DollarSign className="w-4 h-4 text-green-400" />;
      default:
        return <Info className="w-4 h-4 text-sky-400" />;
    }
  };

  const getCategoryIconSmall = (key: NotificationCategoryKey) => {
    switch (key) {
      case 'liveOn':
        return <Radio className="w-3.5 h-3.5" />;
      case 'partyInvites':
        return <Users className="w-3.5 h-3.5" />;
      case 'friendRequests':
        return <UserPlus className="w-3.5 h-3.5" />;
      case 'gifts':
        return <Gift className="w-3.5 h-3.5" />;
      case 'messages':
        return <MessageCircle className="w-3.5 h-3.5" />;
      case 'comments':
        return <MessageSquare className="w-3.5 h-3.5" />;
      case 'likes':
        return <Heart className="w-3.5 h-3.5" />;
      case 'pkBattles':
        return <Swords className="w-3.5 h-3.5" />;
      case 'walletAndSystem':
      default:
        return <ShieldCheck className="w-3.5 h-3.5" />;
    }
  };

  const handleToggleMaster = async () => {
    const next = !notificationPreferences.enabled;
    await toggleMasterNotifications(next);
    if (next) {
      setShowInlineCategories(true);
    }
  };

  const handleToggleCategory = async (key: NotificationCategoryKey) => {
    await updateNotificationPreferences({
      ...notificationPreferences,
      enabled: true,
      categories: {
        ...notificationPreferences.categories,
        [key]: !notificationPreferences.categories[key],
      },
      updatedAt: new Date().toISOString(),
    });
  };

  const handleNotificationTap = (n: NotificationItem) => {
    if (n.isAdminAction) {
      openAdminNotificationDetails(n);
      return;
    }
    markNotificationRead(n.id);

    if (n.streamId) {
      const matched = liveStreams.find((s) => s.id === n.streamId);
      if (matched) {
        openLiveStream(matched);
        return;
      }
    }
    if (n.roomId) {
      const matchedRoom = partyRooms.find((r) => r.id === n.roomId);
      if (matchedRoom) {
        openPartyRoom(matchedRoom);
        return;
      }
    }

    if (n.screen && n.screen !== 'live_stream' && n.screen !== 'party_room') {
      setCurrentScreen(n.screen as any);
      return;
    }
    if (n.tab) {
      setActiveTab(n.tab as any);
      return;
    }

    switch (n.type) {
      case 'live_on':
        setActiveTab('home');
        setCurrentScreen('home');
        break;
      case 'party_invite':
      case 'pk_invite':
        setActiveTab('party');
        setCurrentScreen('party');
        break;
      case 'gift':
      case 'wallet':
        setCurrentScreen('wallet');
        break;
      case 'message':
      case 'friend_request':
      case 'follow':
        setActiveTab('chat');
        setCurrentScreen('chat');
        break;
      case 'comment':
      case 'like':
        setCurrentScreen('moments');
        break;
      case 'agency':
        setCurrentScreen('agency_management');
        break;
      default:
        break;
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'admin') return Boolean(n.isAdminAction);
    const cat = getCategoryForNotificationType(n.type);
    if (activeFilter === 'live_party') {
      return cat === 'liveOn' || cat === 'partyInvites' || cat === 'pkBattles';
    }
    if (activeFilter === 'gifts') return cat === 'gifts';
    if (activeFilter === 'social') {
      return cat === 'friendRequests' || cat === 'comments' || cat === 'likes';
    }
    if (activeFilter === 'messages') return cat === 'messages';
    if (activeFilter === 'system') return cat === 'walletAndSystem';
    return true;
  });

  const activeCategoryCount = NOTIFICATION_CATEGORY_META.filter(
    (c) => notificationPreferences.categories[c.key] !== false
  ).length;

  return (
    <div
      ref={scrollContainerRef}
      className="relative w-full h-full min-h-screen pb-24 bg-[#09070F] text-white overflow-y-auto"
    >
      <PullToRefresh
        scrollContainerRef={scrollContainerRef}
        label="Refreshing notifications..."
        onRefresh={() => refreshScope('notifications')}
      />
      {/* Header */}
      <div className="sticky top-0 z-30 w-full bg-[#09070F]/90 backdrop-blur-md border-b border-[#A855F7]/15 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={navigateBack}
            className="w-8 h-8 rounded-full bg-[#1A1133] flex items-center justify-center text-zinc-300 hover:text-white cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-white">Notification Center</span>
            {unreadNotificationsCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-[#EC4899]/20 text-[#EC4899] text-[10px] font-black border border-[#EC4899]/30">
                {unreadNotificationsCount} new
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPushSettingsModal(true)}
            className="p-2 rounded-xl bg-[#1A1133] border border-[#A855F7]/30 text-[#C084FC] hover:text-white cursor-pointer"
            title="Push Notification & FCM Settings"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={markAllNotificationsRead}
            className="flex items-center gap-1 text-xs text-[#C084FC] hover:underline cursor-pointer"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            <span>Read all</span>
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Inline Push Notification Master & Category Customization Panel */}
        <div className="rounded-3xl bg-gradient-to-br from-[#190F31] to-[#110922] border border-[#A855F7]/30 overflow-hidden shadow-lg">
          <div className="p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#A855F7] to-[#EC4899] flex items-center justify-center text-white shrink-0">
                <Bell className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-black text-white">Push Notifications</h3>
                  <span
                    className={`text-[9.5px] font-bold px-2 py-0.5 rounded-full uppercase ${
                      notificationPreferences.enabled
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-zinc-700 text-zinc-300'
                    }`}
                  >
                    {notificationPreferences.enabled
                      ? `${activeCategoryCount}/9 Active`
                      : 'Paused'}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 truncate">
                  {notificationPreferences.enabled
                    ? 'Select below which notifications you want ON or OFF'
                    : 'Turn ON to customize Live, Party, Gifts, Social & Chat alerts'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleToggleMaster}
              aria-label="Toggle Push Notifications"
              className={`w-12 h-6 rounded-full transition-colors p-0.5 cursor-pointer shrink-0 ${
                notificationPreferences.enabled
                  ? 'bg-gradient-to-r from-[#A855F7] to-[#EC4899]'
                  : 'bg-zinc-700'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  notificationPreferences.enabled ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {notificationPreferences.enabled && (
            <div className="border-t border-white/10">
              <button
                type="button"
                onClick={() => setShowInlineCategories((prev) => !prev)}
                className="w-full px-4 py-2.5 flex items-center justify-between text-[11px] font-bold text-[#C084FC] hover:bg-white/[0.03] cursor-pointer"
              >
                <span>Customize Alert Categories (Live, Party, Friends, Gifts, Messages, Comments, Likes)</span>
                {showInlineCategories ? (
                  <ChevronUp className="w-4 h-4 shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 shrink-0" />
                )}
              </button>

              {showInlineCategories && (
                <div className="px-4 pb-4 space-y-2 border-t border-white/5 pt-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {NOTIFICATION_CATEGORY_META.map((cat) => {
                      const isOn = notificationPreferences.categories[cat.key] !== false;
                      return (
                        <div
                          key={cat.key}
                          onClick={() => handleToggleCategory(cat.key)}
                          className={`p-2.5 rounded-2xl border flex items-center justify-between gap-2 cursor-pointer transition-all ${
                            isOn
                              ? 'bg-[#1F133A] border-[#A855F7]/35'
                              : 'bg-[#120A22] border-white/5 opacity-60'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${cat.accent}`}>
                              {getCategoryIconSmall(cat.key)}
                            </div>
                            <div className="min-w-0">
                              <div className="text-[11px] font-bold text-white truncate">{cat.label}</div>
                              <div className="text-[9.5px] text-zinc-400 truncate">{cat.description}</div>
                            </div>
                          </div>
                          <div
                            className={`w-9 h-5 rounded-full transition-colors p-0.5 shrink-0 ${
                              isOn ? 'bg-gradient-to-r from-[#A855F7] to-[#EC4899]' : 'bg-zinc-700'
                            }`}
                          >
                            <div
                              className={`w-4 h-4 rounded-full bg-white transition-transform ${
                                isOn ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="pt-1 flex items-center justify-between">
                    <span className="text-[10px] text-emerald-400 font-medium">
                      Saved to Firestore & FCM Cloud Push
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowPushSettingsModal(true)}
                      className="text-[10.5px] font-bold text-[#C084FC] hover:underline cursor-pointer"
                    >
                      Device Token & Test Alerts →
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: 'all', label: 'All' },
            { id: 'admin', label: 'Official Admin' },
            { id: 'live_party', label: 'Live & Party' },
            { id: 'gifts', label: 'Gifts 💎' },
            { id: 'social', label: 'Friends, Comments & Likes' },
            { id: 'messages', label: 'Messages' },
            { id: 'system', label: 'Wallet & Official' },
          ].map((tab) => {
            const active = activeFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveFilter(tab.id as FeedFilter)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap cursor-pointer transition-all ${
                  active
                    ? 'bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white shadow'
                    : 'bg-[#140C26] text-zinc-400 border border-white/10 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Notifications List */}
        <div className="space-y-2.5">
          {filteredNotifications.length === 0 ? (
            <div className="p-8 rounded-3xl bg-[#120A22] border border-white/5 text-center space-y-2">
              <Bell className="w-8 h-8 text-zinc-500 mx-auto" />
              <p className="text-xs font-bold text-zinc-300">No notifications in this category yet</p>
              <p className="text-[11px] text-zinc-500">
                Official Admin notices, Live broadcasts, party invites, gifts, friend requests, messages, likes and comments appear here in real time.
              </p>
            </div>
          ) : (
            filteredNotifications.map((n) => {
              const isAdmin = Boolean(n.isAdminAction);
              const isWarning = n.actionKind === 'admin_warning' || n.type === 'admin_warning';
              const isRestored =
                n.type === 'access_restored' ||
                n.actionKind === 'live_restored' ||
                n.actionKind === 'party_restored' ||
                n.actionKind === 'account_restored' ||
                n.actionKind === 'account_unblocked';
              const isSevere =
                n.actionKind === 'account_blocked' ||
                n.actionKind === 'account_suspended' ||
                n.actionKind === 'live_suspended' ||
                n.actionKind === 'party_restricted';

              const cardStyle = isAdmin
                ? isSevere
                  ? n.isRead
                    ? 'bg-[#1B0D18] border-rose-500/25 opacity-85 hover:opacity-100'
                    : 'bg-[#220E1D] border-rose-500/50 shadow-lg shadow-rose-950/30'
                  : isWarning
                  ? n.isRead
                    ? 'bg-[#1B140C] border-amber-500/25 opacity-85 hover:opacity-100'
                    : 'bg-[#24190D] border-amber-400/50 shadow-lg shadow-amber-950/30'
                  : isRestored
                  ? n.isRead
                    ? 'bg-[#0E1B16] border-emerald-500/25 opacity-85 hover:opacity-100'
                    : 'bg-[#10241C] border-emerald-400/45 shadow-lg shadow-emerald-950/30'
                  : n.isRead
                  ? 'bg-[#141026] border-sky-500/25 opacity-85 hover:opacity-100'
                  : 'bg-[#181330] border-sky-400/45 shadow-lg'
                : n.isRead
                ? 'bg-[#120A22] border-white/5 opacity-75 hover:opacity-100'
                : 'bg-[#180E2E] border-[#A855F7]/35 shadow-md';

              return (
                <div
                  key={n.id}
                  onClick={() => handleNotificationTap(n)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${cardStyle}`}
                >
                  <div className="flex items-start gap-3">
                    {safeImageSrc(n.senderAvatar) && !isAdmin ? (
                      <div className="relative shrink-0">
                        <img
                          src={safeImageSrc(n.senderAvatar)}
                          alt={n.senderName || 'User'}
                          className="w-10 h-10 rounded-full object-cover border border-[#A855F7]/40"
                        />
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#1B1033] border border-white/15 flex items-center justify-center">
                          {getIcon(n.type, n.actionKind)}
                        </div>
                      </div>
                    ) : (
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          isAdmin
                            ? isSevere
                              ? 'bg-rose-500/20 border border-rose-400/35'
                              : isWarning
                              ? 'bg-amber-500/20 border border-amber-400/35'
                              : isRestored
                              ? 'bg-emerald-500/20 border border-emerald-400/35'
                              : 'bg-sky-500/20 border border-sky-400/35'
                            : 'bg-[#231542]'
                        }`}
                      >
                        {getIcon(n.type, n.actionKind)}
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {isAdmin && (
                            <span
                              className={`px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider shrink-0 ${
                                isSevere
                                  ? 'bg-rose-500/25 text-rose-200'
                                  : isWarning
                                  ? 'bg-amber-500/25 text-amber-200'
                                  : isRestored
                                  ? 'bg-emerald-500/25 text-emerald-200'
                                  : 'bg-sky-500/25 text-sky-200'
                              }`}
                            >
                              {isWarning ? 'Warning' : 'Official Admin'}
                            </span>
                          )}
                          <h4 className="text-xs font-bold text-white truncate">
                            {n.actionTitle || n.title}
                          </h4>
                        </div>
                        <span className="text-[10px] text-zinc-400 shrink-0">{n.timestamp}</span>
                      </div>

                      <p className="text-xs text-zinc-200 mt-1 leading-snug line-clamp-2">
                        {n.message}
                      </p>

                      {isAdmin && (
                        <div className="mt-2 pt-2 border-t border-white/10 space-y-1 text-[10.5px]">
                          {n.reason && (
                            <p className="text-zinc-300 truncate">
                              <span className="text-zinc-400 font-semibold">Reason: </span>
                              {n.reason}
                            </p>
                          )}
                          <div className="flex flex-wrap items-center justify-between gap-2 text-zinc-400">
                            <span className="truncate">
                              By <span className="text-zinc-200 font-semibold">{n.adminLabel || n.adminName || 'Alpha Mate Admin'}</span>
                            </span>
                            {n.duration && (
                              <span className="inline-flex items-center gap-1 text-amber-300 font-semibold">
                                <Clock className="w-3 h-3" />
                                {n.duration}
                              </span>
                            )}
                            <span className="inline-flex items-center gap-0.5 text-[#C084FC] font-bold ml-auto">
                              <span>Full Details</span>
                              <ChevronRight className="w-3 h-3" />
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {!n.isRead && (
                      <span className="w-2 h-2 rounded-full bg-[#EC4899] shrink-0 mt-1.5" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
