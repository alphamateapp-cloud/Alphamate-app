import React, { useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { PullToRefresh } from '../components/common/PullToRefresh';
import { AlphaMateLogo } from '../components/brand/AlphaMateLogo';
import { DEFAULT_AVATAR_URL, safeImageSrc } from '../utils/imageHd';
import {
  ArrowLeft,
  User,
  Shield,
  Bell,
  Radio,
  Globe,
  CreditCard,
  UserX,
  HelpCircle,
  Info,
  LogOut,
  Upload,
  Check,
  ChevronRight,
  Sparkles,
  Smartphone,
  FileText,
  ShieldCheck,
  Trash2,
  Users,
  Plus,
  HardDrive,
} from 'lucide-react';
import { AndroidSetupModal } from '../components/modals/AndroidSetupModal';
import { PWAInstallButton } from '../components/common/PWAInstallButton';
import { clearProfileSnippetCache } from '../services/profileSnippetCache';

export const SettingsScreen: React.FC = () => {
  const {
    logout,
    navigateBack,
    customLogoUrl,
    setCustomLogoUrl,
    setCurrentScreen,
    setActiveTab,
    setShowPushSettingsModal,
    notificationPreferences,
    refreshScope,
    currentUser,
    savedAccounts,
    maxSavedAccounts,
    setShowAccountSwitcherModal,
    startAddAccountFlow,
  } = useApp();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [streamQuality, setStreamQuality] = useState<'1080p' | '720p'>('1080p');
  const [selectedLanguage, setSelectedLanguage] = useState('English');
  const [showLogoModal, setShowLogoModal] = useState(false);
  const [showAndroidModal, setShowAndroidModal] = useState(false);
  const [logoInputUrl, setLogoInputUrl] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleApplyLogoUrl = () => {
    if (logoInputUrl.trim()) {
      setCustomLogoUrl(logoInputUrl.trim());
      setShowLogoModal(false);
      showToast('Custom original logo applied across the entire app!');
    }
  };

  const handleResetLogo = () => {
    setCustomLogoUrl(null);
    setShowLogoModal(false);
  };

  return (
    <div
      ref={scrollContainerRef}
      className="relative w-full h-full min-h-screen pb-24 bg-[#09070F] text-white overflow-y-auto"
    >
      <PullToRefresh
        scrollContainerRef={scrollContainerRef}
        label="Refreshing settings..."
        onRefresh={() => refreshScope('settings')}
      />
      {/* Top Header */}
      <div className="sticky top-0 z-30 w-full bg-[#09070F]/85 backdrop-blur-md border-b border-[#A855F7]/15 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={navigateBack}
            className="w-8 h-8 rounded-full bg-[#1A1133] flex items-center justify-center text-zinc-300 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-base font-bold text-white">Settings</span>
        </div>
        <div className="w-8" />
      </div>

      <div className="p-4 space-y-4 max-w-sm mx-auto">
        {/* Brand Identity & Original Logo Card */}
        <div className="p-4 rounded-3xl bg-gradient-to-r from-[#170E2E] to-[#120A24] border border-[#A855F7]/25 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlphaMateLogo size="sm" showText={false} customLogoUrl={customLogoUrl} />
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Alpha Mate Identity</h3>
              <p className="text-[10px] text-zinc-400">LIVE • PARTY • SOCIAL</p>
            </div>
          </div>

          <button
            onClick={() => setShowLogoModal(true)}
            className="px-3 py-1.5 rounded-xl bg-[#2A184E] border border-[#A855F7]/40 text-xs font-semibold text-[#C084FC] hover:bg-[#39206B] transition-colors"
          >
            Logo Asset
          </button>
        </div>

        {/* Android Environment Hub (APK & AAB Setup) */}
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 block px-1 mb-2 flex items-center gap-1.5">
            <Smartphone className="w-3.5 h-3.5" />
            <span>Android Environment (APK & AAB)</span>
          </span>
          <div className="rounded-2xl bg-[#140D26] border border-emerald-500/30 divide-y divide-white/5 overflow-hidden">
            <div
              onClick={() => setShowAndroidModal(true)}
              className="p-3.5 flex items-center justify-between hover:bg-white/[0.02] cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center shrink-0 border border-emerald-500/30">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-white">Android APK & AAB Hub</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold uppercase">
                      Ready
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-400">Capacitor native setup, build commands & signing</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-500 shrink-0" />
            </div>
          </div>
        </div>

        {/* Offline Experience & App Install (Service Worker Cache) */}
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-violet-300 block px-1 mb-2 flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5 text-[#A855F7]" />
            <span>Offline Cache &amp; Web App</span>
          </span>
          <div className="rounded-2xl bg-[#140D26] border border-[#A855F7]/25 p-3.5 space-y-3">
            <p className="text-[11px] text-zinc-300 leading-relaxed">
              Core UI assets and recently viewed profile snippets are cached locally by the Service Worker for faster startup and offline viewing.
            </p>
            <PWAInstallButton variant="card" />
            <button
              type="button"
              onClick={() => {
                clearProfileSnippetCache()
                  .then(() => showToast('Cached profile snippets cleared. Fresh profiles will load automatically.'))
                  .catch(() => showToast('Unable to clear cached profiles right now.'));
              }}
              className="w-full py-2 px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-[11px] font-semibold text-zinc-200 transition cursor-pointer"
            >
              Clear Cached Profile Snippets
            </button>
          </div>
        </div>

        {/* Multi-Account System (Up to 5 Accounts Instant Switch) */}
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#C084FC] px-1 mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-[#EC4899]" />
              <span>Multi-Account Switcher</span>
            </span>
            <span>
              {Math.max(1, savedAccounts.length)} / {maxSavedAccounts} IDs
            </span>
          </span>
          <div className="rounded-2xl bg-[#140D26] border border-[#A855F7]/30 divide-y divide-white/5 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowAccountSwitcherModal(true)}
              className="w-full min-h-[56px] p-3.5 flex items-center justify-between hover:bg-white/[0.03] cursor-pointer text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={safeImageSrc(currentUser.avatar, DEFAULT_AVATAR_URL)}
                  alt={currentUser.displayName}
                  referrerPolicy="no-referrer"
                  className="w-9 h-9 rounded-full object-cover border border-[#EC4899]/60 shrink-0"
                />
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white truncate">
                    Switch Account ({Math.max(1, savedAccounts.length)}/{maxSavedAccounts})
                  </div>
                  <div className="text-[10px] text-zinc-400 truncate">
                    Active: @{currentUser.username} &bull; 1-tap switch without password
                  </div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0" />
            </button>

            {savedAccounts.length < maxSavedAccounts && (
              <button
                type="button"
                onClick={async () => {
                  const res = await startAddAccountFlow('register');
                  if (!res.success && res.error) {
                    showToast(res.error);
                  }
                }}
                className="w-full min-h-[46px] px-3.5 py-2.5 flex items-center justify-between hover:bg-white/[0.03] cursor-pointer text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-[#7928CA]/25 border border-[#A855F7]/40 flex items-center justify-center text-[#E9D5FF]">
                    <Plus className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block">Add New Account</span>
                    <span className="text-[10px] text-zinc-400">
                      Sign up or log into another ID ({maxSavedAccounts - savedAccounts.length} slots free)
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-500 shrink-0" />
              </button>
            )}
          </div>
        </div>

        {/* Section 1: Account & Security */}
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block px-1 mb-2">
            Account & Security
          </span>
          <div className="rounded-2xl bg-[#140D26] border border-white/5 divide-y divide-white/5 overflow-hidden">
            <div
              onClick={() => {
                setActiveTab('me');
                setCurrentScreen('profile');
              }}
              className="p-3.5 flex items-center justify-between hover:bg-white/[0.02] cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <User className="w-4 h-4 text-[#A855F7]" />
                <span className="text-xs font-medium text-white">Edit Profile</span>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-500" />
            </div>

            <div
              onClick={() => showToast('Account security status: Verified 2FA enabled.')}
              className="p-3.5 flex items-center justify-between hover:bg-white/[0.02] cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <Shield className="w-4 h-4 text-[#A855F7]" />
                <span className="text-xs font-medium text-white">Account Security & 2FA</span>
              </div>
              <span className="text-[10px] text-emerald-400 font-semibold">Protected</span>
            </div>
          </div>
        </div>

        {/* Section 2: Preferences & Live Settings */}
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block px-1 mb-2">
            Preferences & Stream
          </span>
          <div className="rounded-2xl bg-[#140D26] border border-white/5 divide-y divide-white/5 overflow-hidden">
            <div
              onClick={() => setShowPushSettingsModal(true)}
              className="p-3.5 flex items-center justify-between hover:bg-white/[0.02] cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#EC4899]/20 text-[#EC4899] flex items-center justify-center shrink-0 border border-[#EC4899]/30">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-white">Push Notifications Hub</span>
                    <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                      notificationPreferences.enabled
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-zinc-700 text-zinc-300'
                    }`}>
                      {notificationPreferences.enabled ? 'ON' : 'OFF'}
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-400">Live, Party, Friends, Gifts, Messages & Likes</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-500 shrink-0" />
            </div>

            <div className="p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Radio className="w-4 h-4 text-[#EC4899]" />
                <span className="text-xs font-medium text-white">Live Broadcast Quality</span>
              </div>
              <button
                onClick={() => setStreamQuality(streamQuality === '1080p' ? '720p' : '1080p')}
                className="px-2 py-0.5 rounded-md bg-[#251642] text-[10px] font-bold text-[#C084FC]"
              >
                {streamQuality} HD
              </button>
            </div>

            <div className="p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Globe className="w-4 h-4 text-[#EC4899]" />
                <span className="text-xs font-medium text-white">Language</span>
              </div>
              <span className="text-xs text-zinc-400">{selectedLanguage}</span>
            </div>
          </div>
        </div>

        {/* Section 3: Billing & Payments */}
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block px-1 mb-2">
            Finance & Safety
          </span>
          <div className="rounded-2xl bg-[#140D26] border border-white/5 divide-y divide-white/5 overflow-hidden">
            <div
              onClick={() => setCurrentScreen('wallet')}
              className="p-3.5 flex items-center justify-between hover:bg-white/[0.02] cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <CreditCard className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-medium text-white">Payment Methods</span>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-500" />
            </div>

            <div
              onClick={() => showToast('No users currently blocked.')}
              className="p-3.5 flex items-center justify-between hover:bg-white/[0.02] cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <UserX className="w-4 h-4 text-zinc-400" />
                <span className="text-xs font-medium text-white">Blocked Users</span>
              </div>
              <span className="text-[10px] text-zinc-500">0</span>
            </div>
          </div>
        </div>

        {/* Section 4: About & Legal */}
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block px-1 mb-2">
            About & Community
          </span>
          <div className="rounded-2xl bg-[#140D26] border border-white/5 divide-y divide-white/5 overflow-hidden">
            <div
              onClick={() => showToast('Alpha Mate v2.4.0 (Build 8849). Official International Release.')}
              className="p-3.5 flex items-center justify-between hover:bg-white/[0.02] cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <Info className="w-4 h-4 text-zinc-400" />
                <span className="text-xs font-medium text-white">About Alpha Mate</span>
              </div>
              <span className="text-[10px] text-zinc-500">v2.4.0</span>
            </div>

            <div
              onClick={() => showToast('Alpha Mate 24/7 Creator Support: support@alphamate.app')}
              className="p-3.5 flex items-center justify-between hover:bg-white/[0.02] cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <HelpCircle className="w-4 h-4 text-zinc-400" />
                <span className="text-xs font-medium text-white">Help & Support</span>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-500" />
            </div>

            <button
              type="button"
              onClick={() => setCurrentScreen('terms_conditions')}
              className="w-full min-h-[44px] p-3.5 flex items-center justify-between hover:bg-white/[0.02] cursor-pointer text-left"
            >
              <div className="flex items-center gap-3">
                <FileText className="w-4 h-4 text-[#C084FC]" />
                <span className="text-xs font-medium text-white">Terms &amp; Conditions</span>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-500" />
            </button>

            <button
              type="button"
              onClick={() => setCurrentScreen('privacy_policy')}
              className="w-full min-h-[44px] p-3.5 flex items-center justify-between hover:bg-white/[0.02] cursor-pointer text-left"
            >
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-4 h-4 text-[#EC4899]" />
                <span className="text-xs font-medium text-white">Privacy Policy</span>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-500" />
            </button>
          </div>
        </div>

        {/* Account Deactivation & Deletion (Placed right above Log Out) */}
        <button
          type="button"
          onClick={() => setCurrentScreen('delete_account')}
          className="w-full p-3.5 rounded-2xl bg-[#140D26] hover:bg-[#1C1235] border border-amber-500/25 flex items-center justify-between transition-colors cursor-pointer text-left"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 flex items-center justify-center shrink-0">
              <Trash2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-white">Delete or Deactivate Account</div>
              <div className="text-[10px] text-zinc-400 truncate">
                Temporary deactivation (no limit) or OTP 15-day deletion
              </div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-zinc-500 shrink-0" />
        </button>

        {/* Log Out Button */}
        <button
          onClick={logout}
          className="w-full h-12 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Log Out</span>
        </button>
      </div>

      {/* Original Logo Asset Manager Modal */}
      {showLogoModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-[#171030] border border-[#A855F7]/30 p-6 shadow-2xl animate-scale-up">
            <h3 className="text-base font-bold text-white mb-1">Official Alpha Mate Logo</h3>
            <p className="text-xs text-zinc-400 mb-4">
              If you have the exact image or SVG file URL from the existing website, paste it below to use it globally.
            </p>

            <div className="space-y-3">
              <input
                type="text"
                placeholder="https://.../alpha-mate-logo.png"
                value={logoInputUrl}
                onChange={(e) => setLogoInputUrl(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl bg-[#0F0A20] border border-[#A855F7]/30 text-white placeholder-zinc-500 text-xs focus:border-[#EC4899] focus:outline-none"
              />

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleResetLogo}
                  className="flex-1 h-11 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-semibold hover:bg-zinc-700"
                >
                  Reset to Default
                </button>
                <button
                  type="button"
                  onClick={handleApplyLogoUrl}
                  className="flex-1 h-11 rounded-xl bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white text-xs font-bold"
                >
                  Apply Asset
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Android Setup Modal */}
      <AndroidSetupModal
        isOpen={showAndroidModal}
        onClose={() => setShowAndroidModal(false)}
      />

      {/* Non-blocking in-app toast notification */}
      {toastMessage && (
        <div className="fixed bottom-16 inset-x-4 z-50 flex justify-center pointer-events-none animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="px-4 py-2.5 rounded-2xl bg-[#1E1136]/95 border border-[#A855F7]/40 text-xs font-semibold text-white shadow-2xl backdrop-blur-md flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}
    </div>
  );
};
