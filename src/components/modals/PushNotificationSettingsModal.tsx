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
} from 'lucide-react';
import { pushService, PushStatus } from '../../services/pushNotificationService';
import { useApp } from '../../context/AppContext';

interface PushNotificationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PushNotificationSettingsModal: React.FC<PushNotificationSettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { currentUser } = useApp();
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

  // Category Preferences
  const [channels, setChannels] = useState({
    liveAlerts: true,
    pkBattles: true,
    giftsRewards: true,
    agencyOrders: true,
    messages: true,
  });

  const checkStatus = async () => {
    const s = await pushService.checkPermissions();
    setStatus(s);
  };

  useEffect(() => {
    if (isOpen) {
      checkStatus();
      try {
        const savedChannels = localStorage.getItem('alphamate_push_channels');
        if (savedChannels) {
          setChannels(JSON.parse(savedChannels));
        }
      } catch {}
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
        setFeedbackMsg('Push notifications enabled! Device registered for real-time alerts.');
        if (currentUser?.id) {
          await pushService.syncTokenToUserDoc(currentUser.id);
        }
      } else {
        setFeedbackMsg('Permission not granted. Please check system notification settings.');
      }
    } catch (err: any) {
      setFeedbackMsg(err?.message || 'Error enabling notifications');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleChannel = (key: keyof typeof channels) => {
    const updated = { ...channels, [key]: !channels[key] };
    setChannels(updated);
    try {
      localStorage.setItem('alphamate_push_channels', JSON.stringify(updated));
    } catch {}
  };

  const handleCopyToken = () => {
    if (!status.token) return;
    navigator.clipboard.writeText(status.token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const triggerTestAlert = (type: 'pk' | 'gift' | 'agency') => {
    setFeedbackMsg(null);
    if (type === 'pk') {
      pushService.triggerTestNotification({
        title: '⚔️ PK Battle Challenge!',
        body: 'Malik Sardar challenged you to an intense 5-minute PK battle in Party Room #7!',
        data: {
          type: 'pk_invite',
          tab: 'party',
        },
      });
      setFeedbackMsg('Test PK Battle alert triggered!');
    } else if (type === 'gift') {
      pushService.triggerTestNotification({
        title: '💎 Golden Dragon Received!',
        body: 'Elena Rostova sent you a 50,000 Coin Golden Dragon gift! Check your Diamond wallet.',
        data: {
          type: 'gift',
          screen: 'wallet',
        },
      });
      setFeedbackMsg('Test Gift notification triggered!');
    } else if (type === 'agency') {
      pushService.triggerTestNotification({
        title: '🛡️ Agency Coins Delivered!',
        body: 'Official Coin Seller Alpha Royal Talent delivered 200,000 Coins to your balance.',
        data: {
          type: 'agency',
          screen: 'agency_management',
        },
      });
      setFeedbackMsg('Test Agency alert triggered!');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[#0E091C] border border-[#A855F7]/30 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="relative px-5 py-4 bg-gradient-to-r from-[#1E103A] to-[#120A24] border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#A855F7] to-[#EC4899] flex items-center justify-center text-white shadow-lg shadow-purple-950/40">
              <Bell className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Push Notifications Hub</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                  @capacitor/push-notifications
                </span>
              </div>
              <p className="text-[11px] text-zinc-400">
                Real-time engagement, instant alerts & FCM token management
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Status Banner */}
          <div className="p-4 rounded-2xl bg-[#150F26] border border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                  status.permission === 'granted'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                }`}
              >
                {status.permission === 'granted' ? (
                  <CheckCircle className="w-5 h-5" />
                ) : (
                  <AlertTriangle className="w-5 h-5" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white">Permission Status</span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                      status.permission === 'granted'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-amber-500/20 text-amber-300'
                    }`}
                  >
                    {status.permission === 'granted' ? 'Active & Granted' : status.permission}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-[11px] text-zinc-400">
                  {status.isNative ? (
                    <span className="flex items-center gap-1 text-[#C084FC]">
                      <Smartphone className="w-3 h-3" />
                      Capacitor Native (Android FCM)
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-sky-400">
                      <Globe className="w-3 h-3" />
                      Web Push & Foreground Simulation
                    </span>
                  )}
                </div>
              </div>
            </div>

            {status.permission !== 'granted' && (
              <button
                onClick={handleRequestPermissions}
                disabled={isLoading}
                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-white text-xs font-bold hover:brightness-110 active:scale-95 transition-all shadow-md shadow-purple-950/40 cursor-pointer disabled:opacity-50"
              >
                {isLoading ? 'Enabling...' : 'Enable Alerts'}
              </button>
            )}
          </div>

          {feedbackMsg && (
            <div className="p-3 rounded-xl bg-purple-900/30 border border-purple-500/40 text-xs text-purple-200 flex items-center gap-2 animate-in fade-in">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{feedbackMsg}</span>
            </div>
          )}

          {/* FCM / Device Push Token */}
          <div className="p-4 rounded-2xl bg-[#140D26] border border-white/5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                Device Push Registration Token
              </span>
              {status.token && (
                <button
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
                  No token registered yet. Tap "Enable Alerts" above to register this device.
                </span>
              )}
            </div>
          </div>

          {/* Alert Channels & Preferences */}
          <div className="p-4 rounded-2xl bg-[#140D26] border border-white/5 space-y-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block">
              Engagement Channels & Priority
            </span>

            <div className="divide-y divide-white/5">
              {/* Channel 1: PK Battle */}
              <div className="py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-[#EC4899]/20 text-[#EC4899] flex items-center justify-center">
                    <Swords className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h5 className="text-xs font-medium text-white">PK Battle Challenges</h5>
                    <p className="text-[10px] text-zinc-400">Direct invitations & battle start notices</p>
                  </div>
                </div>
                <button
                  onClick={() => toggleChannel('pkBattles')}
                  className={`w-9 h-5 rounded-full transition-colors p-0.5 cursor-pointer ${
                    channels.pkBattles ? 'bg-[#EC4899]' : 'bg-zinc-700'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      channels.pkBattles ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Channel 2: Live Streams */}
              <div className="py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-[#A855F7]/20 text-[#A855F7] flex items-center justify-center">
                    <Radio className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h5 className="text-xs font-medium text-white">Followed Host Live Alerts</h5>
                    <p className="text-[10px] text-zinc-400">Broadcast starts and VIP party rooms</p>
                  </div>
                </div>
                <button
                  onClick={() => toggleChannel('liveAlerts')}
                  className={`w-9 h-5 rounded-full transition-colors p-0.5 cursor-pointer ${
                    channels.liveAlerts ? 'bg-[#A855F7]' : 'bg-zinc-700'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      channels.liveAlerts ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Channel 3: Gifts & Rewards */}
              <div className="py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                    <Gift className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h5 className="text-xs font-medium text-white">Gift Receipts & Diamond Payouts</h5>
                    <p className="text-[10px] text-zinc-400">Real-time alerts when receiving gifts or withdrawals</p>
                  </div>
                </div>
                <button
                  onClick={() => toggleChannel('giftsRewards')}
                  className={`w-9 h-5 rounded-full transition-colors p-0.5 cursor-pointer ${
                    channels.giftsRewards ? 'bg-amber-500' : 'bg-zinc-700'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      channels.giftsRewards ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Channel 4: Agency */}
              <div className="py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <ShieldCheck className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h5 className="text-xs font-medium text-white">Agency Orders & Host Applications</h5>
                    <p className="text-[10px] text-zinc-400">Coin seller requests, deliveries & contract targets</p>
                  </div>
                </div>
                <button
                  onClick={() => toggleChannel('agencyOrders')}
                  className={`w-9 h-5 rounded-full transition-colors p-0.5 cursor-pointer ${
                    channels.agencyOrders ? 'bg-emerald-500' : 'bg-zinc-700'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      channels.agencyOrders ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Test Real-Time Engagement Alerts */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-[#1C1236] to-[#120A24] border border-[#A855F7]/30 space-y-3">
            <div className="flex items-center gap-2">
              <Send className="w-4 h-4 text-[#C084FC]" />
              <span className="text-xs font-bold text-white">
                Test Real-Time Alert Triggers (Instant Demo)
              </span>
            </div>
            <p className="text-[11px] text-zinc-300 leading-snug">
              Tap any test button below to trigger simulated foreground push notifications and heads-up banner alerts:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
              <button
                onClick={() => triggerTestAlert('pk')}
                className="p-2.5 rounded-xl bg-[#251545] hover:bg-[#341C63] border border-[#EC4899]/30 text-left transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-2 text-xs font-bold text-[#EC4899]">
                  <Swords className="w-3.5 h-3.5" />
                  <span>PK Challenge</span>
                </div>
                <span className="text-[10px] text-zinc-400 block mt-1">Simulate battle invite</span>
              </button>

              <button
                onClick={() => triggerTestAlert('gift')}
                className="p-2.5 rounded-xl bg-[#251545] hover:bg-[#341C63] border border-amber-500/30 text-left transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                  <Gift className="w-3.5 h-3.5" />
                  <span>50k Coin Gift</span>
                </div>
                <span className="text-[10px] text-zinc-400 block mt-1">Simulate diamond reward</span>
              </button>

              <button
                onClick={() => triggerTestAlert('agency')}
                className="p-2.5 rounded-xl bg-[#251545] hover:bg-[#341C63] border border-emerald-500/30 text-left transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Agency Order</span>
                </div>
                <span className="text-[10px] text-zinc-400 block mt-1">Simulate coin delivery</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-[#0A0614] border-t border-white/5 flex items-center justify-between">
          <span className="text-[10px] text-zinc-400">
            Powered by Capacitor 8 & Firebase Cloud Messaging
          </span>
          <button
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
