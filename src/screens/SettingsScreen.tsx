import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { AlphaMateLogo } from '../components/brand/AlphaMateLogo';
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
} from 'lucide-react';

export const SettingsScreen: React.FC = () => {
  const {
    logout,
    navigateBack,
    customLogoUrl,
    setCustomLogoUrl,
    setCurrentScreen,
    setActiveTab,
  } = useApp();

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [streamQuality, setStreamQuality] = useState<'1080p' | '720p'>('1080p');
  const [selectedLanguage, setSelectedLanguage] = useState('English');
  const [showLogoModal, setShowLogoModal] = useState(false);
  const [logoInputUrl, setLogoInputUrl] = useState('');

  const handleApplyLogoUrl = () => {
    if (logoInputUrl.trim()) {
      setCustomLogoUrl(logoInputUrl.trim());
      setShowLogoModal(false);
      alert('Custom original logo applied across the entire app!');
    }
  };

  const handleResetLogo = () => {
    setCustomLogoUrl(null);
    setShowLogoModal(false);
  };

  return (
    <div className="relative w-full h-full min-h-screen pb-24 bg-[#09070F] text-white overflow-y-auto">
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
              onClick={() => alert('Account security status: Verified 2FA enabled.')}
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
            <div className="p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell className="w-4 h-4 text-[#EC4899]" />
                <span className="text-xs font-medium text-white">Push Notifications</span>
              </div>
              <button
                onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                className={`w-10 h-6 rounded-full transition-colors p-0.5 cursor-pointer ${
                  notificationsEnabled ? 'bg-[#7928CA]' : 'bg-zinc-700'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    notificationsEnabled ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
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
              onClick={() => alert('No users currently blocked.')}
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
              onClick={() => alert('Alpha Mate v2.4.0 (Build 8849). Official International Release.')}
              className="p-3.5 flex items-center justify-between hover:bg-white/[0.02] cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <Info className="w-4 h-4 text-zinc-400" />
                <span className="text-xs font-medium text-white">About Alpha Mate</span>
              </div>
              <span className="text-[10px] text-zinc-500">v2.4.0</span>
            </div>

            <div
              onClick={() => alert('Alpha Mate 24/7 Creator Support: support@alphamate.app')}
              className="p-3.5 flex items-center justify-between hover:bg-white/[0.02] cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <HelpCircle className="w-4 h-4 text-zinc-400" />
                <span className="text-xs font-medium text-white">Help & Support</span>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-500" />
            </div>
          </div>
        </div>

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
    </div>
  );
};
