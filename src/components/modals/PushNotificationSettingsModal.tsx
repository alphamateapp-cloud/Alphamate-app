import React, { useState, useEffect } from 'react';
import {
  X,
  Bell,
  CheckCircle,
  Copy,
  Check,
  Send,
  Radio,
  Swords,
  Gift,
  ShieldCheck,
  Smartphone,
  Globe,
  AlertTriangle,
  Users,
  UserPlus,
  MessageCircle,
  MessageSquare,
  Heart,
  Cloud,
} from 'lucide-react';
import {
  pushService,
  PushStatus,
  NOTIFICATION_CATEGORY_META,
} from '../../services/pushNotificationService';
import { NotificationCategoryKey, NotificationEventType } from '../../types';
import { useApp } from '../../context/AppContext';

interface PushNotificationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PushNotificationSettingsModal: React.FC<PushNotificationSettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    currentUser,
    notificationPreferences,
    updateNotificationPreferences,
    toggleMasterNotifications,
    sendNotificationToUser,
  } = useApp();

  const [status, setStatus] = useState<PushStatus>({
    isSupported: true,
    isNative: false,
    permission: 'prompt',
    token: null,
    error: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const checkStatus = async () => {
    const s = await pushService.checkPermissions();
    setStatus(s);
  };

  useEffect(() => {
    if (isOpen) {
      checkStatus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRequestPermissions = async () => {
    setIsLoading(true);
    setFeedbackMsg(null);
    try {
      const res = await pushService.requestPermissions();
      setStatus(res);
      if (res.permission === 'granted') {
        await toggleMasterNotifications(true);
        setFeedbackMsg('Push notifications enabled and synced with Cloud Firestore!');
        if (currentUser?.id) {
          await pushService.syncTokenToUserDoc(currentUser.id);
        }
      } else {
        setFeedbackMsg('Permission not granted. Please allow notifications in browser/Android settings.');
      }
    } catch (err: any) {
      setFeedbackMsg(err?.message || 'Error enabling notifications');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMasterToggle = async () => {
    setIsLoading(true);
    setFeedbackMsg(null);
    try {
      const nextEnabled = !notificationPreferences.enabled;
      await toggleMasterNotifications(nextEnabled);
      await checkStatus();
      setFeedbackMsg(
        nextEnabled
          ? 'All push notifications turned ON. Customize your alert categories below.'
          : 'All push notifications paused. Re-enable anytime.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleCategory = async (key: NotificationCategoryKey) => {
    const nextPrefs = {
      ...notificationPreferences,
      enabled: true,
      categories: {
        ...notificationPreferences.categories,
        [key]: !notificationPreferences.categories[key],
      },
      updatedAt: new Date().toISOString(),
    };
    await updateNotificationPreferences(nextPrefs);
  };

  const handleToggleAllCategories = async (value: boolean) => {
    const updatedCategories = { ...notificationPreferences.categories };
    (Object.keys(updatedCategories) as NotificationCategoryKey[]).forEach((k) => {
      updatedCategories[k] = value;
    });
    await updateNotificationPreferences({
      ...notificationPreferences,
      enabled: value ? true : notificationPreferences.enabled,
      categories: updatedCategories,
      updatedAt: new Date().toISOString(),
    });
    setFeedbackMsg(value ? 'All 9 notification categories enabled!' : 'Optional categories muted.');
  };

  const handleCopyToken = () => {
    if (!status.token) return;
    navigator.clipboard.writeText(status.token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const triggerTestAlert = (
    type: NotificationEventType,
    title: string,
    body: string,
    screen?: string,
    tab?: string
  ) => {
    setFeedbackMsg(null);
    if (!pushService.isCategoryAllowed(type)) {
      setFeedbackMsg('This category is currently turned OFF. Turn it ON above to receive this alert.');
      return;
    }

    if (currentUser?.id) {
      sendNotificationToUser({
        recipientId: currentUser.id,
        type,
        title,
        message: body,
        screen,
        tab,
      }).catch(() => {});
    }
    pushService.triggerTestNotification({
      title,
      body,
      data: { type, screen, tab },
    });
    setFeedbackMsg(`Triggered "${title}" alert!`);
  };

  const getCategoryIcon = (key: NotificationCategoryKey) => {
    switch (key) {
      case 'liveOn':
        return <Radio className="w-4 h-4" />;
      case 'partyInvites':
        return <Users className="w-4 h-4" />;
      case 'friendRequests':
        return <UserPlus className="w-4 h-4" />;
      case 'gifts':
        return <Gift className="w-4 h-4" />;
      case 'messages':
        return <MessageCircle className="w-4 h-4" />;
      case 'comments':
        return <MessageSquare className="w-4 h-4" />;
      case 'likes':
        return <Heart className="w-4 h-4" />;
      case 'pkBattles':
        return <Swords className="w-4 h-4" />;
      case 'walletAndSystem':
      default:
        return <ShieldCheck className="w-4 h-4" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[#0E091C] border border-[#A855F7]/30 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="relative px-5 py-4 bg-gradient-to-r from-[#1E103A] to-[#120A24] border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#A855F7] to-[#EC4899] flex items-center justify-center text-white shadow-lg shadow-purple-950/40">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Notification Controls</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30 flex items-center gap-1">
                  <Cloud className="w-3 h-3" />
                  FCM + Firestore
                </span>
              </div>
              <p className="text-[11px] text-zinc-400">
                Choose exactly which real-time alerts you want ON or OFF
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Master Switch & Permission Status */}
          <div className="p-4 rounded-2xl bg-[#150F26] border border-white/10 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    notificationPreferences.enabled && status.permission === 'granted'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : notificationPreferences.enabled
                      ? 'bg-purple-500/20 text-[#C084FC] border border-purple-500/30'
                      : 'bg-zinc-800 text-zinc-400 border border-white/10'
                  }`}
                >
                  {notificationPreferences.enabled ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <AlertTriangle className="w-5 h-5" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-white">Master Push Notifications</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        notificationPreferences.enabled
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-zinc-700 text-zinc-300'
                      }`}
                    >
                      {notificationPreferences.enabled ? 'Enabled' : 'Paused'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-zinc-400">
                    {status.isNative ? (
                      <span className="flex items-center gap-1 text-[#C084FC]">
                        <Smartphone className="w-3 h-3" />
                        Android FCM ({status.permission})
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-sky-400">
                        <Globe className="w-3 h-3" />
                        Web Push + In-App ({status.permission})
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleMasterToggle}
                disabled={isLoading}
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

            {status.permission !== 'granted' && (
              <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-2">
                <span className="text-[11px] text-amber-300">
                  Enable system permission for lock-screen & background delivery.
                </span>
                <button
                  type="button"
                  onClick={handleRequestPermissions}
                  disabled={isLoading}
                  className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-white text-[11px] font-bold hover:brightness-110 cursor-pointer disabled:opacity-50 shrink-0"
                >
                  {isLoading ? 'Enabling...' : 'Grant Permission'}
                </button>
              </div>
            )}
          </div>

          {feedbackMsg && (
            <div className="p-3 rounded-xl bg-purple-900/30 border border-purple-500/40 text-xs text-purple-200 flex items-center gap-2 animate-in fade-in">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{feedbackMsg}</span>
            </div>
          )}

          {/* Granular 9-Category Selector (Expanded whenever Master is ON) */}
          {notificationPreferences.enabled ? (
            <div className="p-4 rounded-2xl bg-[#140D26] border border-[#A855F7]/25 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-white block">
                    Choose Notification Categories (9)
                  </span>
                  <span className="text-[10px] text-zinc-400">
                    Select which alerts stay active on your account
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleToggleAllCategories(true)}
                    className="px-2 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 text-[10px] font-bold cursor-pointer"
                  >
                    All ON
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleAllCategories(false)}
                    className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 text-[10px] font-bold cursor-pointer"
                  >
                    Mute All
                  </button>
                </div>
              </div>

              <div className="divide-y divide-white/5">
                {NOTIFICATION_CATEGORY_META.map((cat) => {
                  const isOn = notificationPreferences.categories[cat.key] !== false;
                  return (
                    <div key={cat.key} className="py-2.5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${cat.accent}`}>
                          {getCategoryIcon(cat.key)}
                        </div>
                        <div className="min-w-0">
                          <h5 className="text-xs font-semibold text-white truncate">{cat.label}</h5>
                          <p className="text-[10px] text-zinc-400 leading-snug">{cat.description}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleCategory(cat.key)}
                        aria-label={`Toggle ${cat.label}`}
                        className={`w-10 h-5 rounded-full transition-colors p-0.5 cursor-pointer shrink-0 ${
                          isOn ? 'bg-gradient-to-r from-[#A855F7] to-[#EC4899]' : 'bg-zinc-700'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full bg-white transition-transform ${
                            isOn ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-[#140D26]/60 border border-white/5 text-center space-y-2">
              <p className="text-xs text-zinc-300 font-semibold">
                Notifications are currently paused
              </p>
              <p className="text-[11px] text-zinc-400">
                Turn ON Master Push Notifications above to select Live, Party, Friend Requests, Gifts, Messages, Comments & Likes alerts.
              </p>
            </div>
          )}

          {/* FCM / Device Push Token */}
          <div className="p-4 rounded-2xl bg-[#140D26] border border-white/5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                Device FCM Push Registration Token
              </span>
              {status.token && (
                <button
                  type="button"
                  onClick={handleCopyToken}
                  className="flex items-center gap-1 text-[11px] text-[#C084FC] hover:text-white transition-colors cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy Token</span>
                    </>
                  )}
                </button>
              )}
            </div>

            <div className="p-2.5 rounded-xl bg-[#090614] border border-white/5 font-mono text-[10px] text-zinc-300 break-all select-all">
              {status.token || (
                <span className="text-zinc-500 italic">
                  No token registered yet. Enable notifications above to register this device.
                </span>
              )}
            </div>
          </div>

          {/* Instant Test Triggers */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-[#1C1236] to-[#120A24] border border-[#A855F7]/30 space-y-3">
            <div className="flex items-center gap-2">
              <Send className="w-4 h-4 text-[#C084FC]" />
              <span className="text-xs font-bold text-white">
                Test Live Alerts (Respects Your Toggles)
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() =>
                  triggerTestAlert(
                    'live_on',
                    '🔴 Host Went Live!',
                    'Elena Rostova just started a Live Broadcast — tap to join!',
                    'home'
                  )
                }
                className="p-2 rounded-xl bg-[#251545] hover:bg-[#341C63] border border-[#EC4899]/30 text-left cursor-pointer"
              >
                <span className="text-[11px] font-bold text-[#EC4899] block">Live On</span>
                <span className="text-[9.5px] text-zinc-400">Host broadcast</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  triggerTestAlert(
                    'party_invite',
                    '🎙️ Party Room Open!',
                    'Royal Lounge Voice Party has open mic seats waiting for you.',
                    undefined,
                    'party'
                  )
                }
                className="p-2 rounded-xl bg-[#251545] hover:bg-[#341C63] border border-[#A855F7]/30 text-left cursor-pointer"
              >
                <span className="text-[11px] font-bold text-[#C084FC] block">Party Room</span>
                <span className="text-[9.5px] text-zinc-400">Seat / room invite</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  triggerTestAlert(
                    'friend_request',
                    '👋 New Friend Request',
                    'Alex Rider sent you a friend/chat request!',
                    'chat'
                  )
                }
                className="p-2 rounded-xl bg-[#251545] hover:bg-[#341C63] border border-emerald-500/30 text-left cursor-pointer"
              >
                <span className="text-[11px] font-bold text-emerald-400 block">Friend Req</span>
                <span className="text-[9.5px] text-zinc-400">Connect alert</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  triggerTestAlert(
                    'gift',
                    '💎 Gift Received (+600 💎)',
                    'Fan sent a 1,000 Coin Gift! Your 60% Host Share (+600 Diamonds) was added.',
                    'wallet'
                  )
                }
                className="p-2 rounded-xl bg-[#251545] hover:bg-[#341C63] border border-amber-500/30 text-left cursor-pointer"
              >
                <span className="text-[11px] font-bold text-amber-400 block">60% Gift 💎</span>
                <span className="text-[9.5px] text-zinc-400">Diamond payout</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  triggerTestAlert(
                    'message',
                    '💬 New Message',
                    'Sophia: "Join my party stage right now!"',
                    'chat'
                  )
                }
                className="p-2 rounded-xl bg-[#251545] hover:bg-[#341C63] border border-cyan-500/30 text-left cursor-pointer"
              >
                <span className="text-[11px] font-bold text-cyan-400 block">Message</span>
                <span className="text-[9.5px] text-zinc-400">DM / group chat</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  triggerTestAlert(
                    'comment',
                    '💭 Video Comment & Like',
                    'Zara commented "Amazing video 🔥" and liked your Moment!',
                    'moments'
                  )
                }
                className="p-2 rounded-xl bg-[#251545] hover:bg-[#341C63] border border-rose-500/30 text-left cursor-pointer"
              >
                <span className="text-[11px] font-bold text-rose-400 block">Comment/Like</span>
                <span className="text-[9.5px] text-zinc-400">Moment activity</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-[#0A0614] border-t border-white/5 flex items-center justify-between">
          <span className="text-[10px] text-zinc-400">
            Preferences synced to Firestore & FCM Cloud Functions
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
