import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../context/AppContext';
import { PullToRefresh } from '../components/common/PullToRefresh';
import { AlphaMateLogo } from '../components/brand/AlphaMateLogo';
import { DEFAULT_AVATAR_URL, safeImageSrc } from '../utils/imageHd';
import {
  SUPPORTED_LANGUAGES,
  SupportedLanguageCode,
  getLanguageOption,
} from '../i18n';
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
  Check,
  ChevronRight,
  Smartphone,
  FileText,
  ShieldCheck,
  Trash2,
  Users,
  Plus,
  HardDrive,
  X,
  Sun,
  Moon,
} from 'lucide-react';
import { AndroidSetupModal } from '../components/modals/AndroidSetupModal';
import { PWAInstallButton } from '../components/common/PWAInstallButton';
import { ThemeToggle } from '../components/common/ThemeToggle';
import { useTheme } from '../context/ThemeContext';
import { clearProfileSnippetCache } from '../services/profileSnippetCache';

export const SettingsScreen: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { isDark } = useTheme();
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
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showLogoModal, setShowLogoModal] = useState(false);
  const [showAndroidModal, setShowAndroidModal] = useState(false);
  const [logoInputUrl, setLogoInputUrl] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const activeLanguage = getLanguageOption(i18n.resolvedLanguage || i18n.language);

  useEffect(() => {
    if (!showLanguageModal) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowLanguageModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showLanguageModal]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSelectLanguage = async (code: SupportedLanguageCode) => {
    const chosen = getLanguageOption(code);
    await i18n.changeLanguage(code);
    setShowLanguageModal(false);
    showToast(i18n.t('settings.languageUpdatedToast', { language: chosen.nativeName }));
  };

  const handleApplyLogoUrl = () => {
    if (logoInputUrl.trim()) {
      setCustomLogoUrl(logoInputUrl.trim());
      setShowLogoModal(false);
      showToast(t('settings.logoAppliedToast'));
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
        label={t('settings.refreshing')}
        onRefresh={() => refreshScope('settings')}
      />
      {/* Top Header */}
      <div className="sticky top-0 z-30 w-full bg-[#09070F]/85 backdrop-blur-md border-b border-[#A855F7]/15 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={navigateBack}
            className="w-8 h-8 rounded-full bg-[#1A1133] flex items-center justify-center text-zinc-300 hover:text-white cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
          </button>
          <span className="text-base font-bold text-white">{t('settings.title')}</span>
        </div>
        <div className="w-8" />
      </div>

      <div className="p-4 space-y-4 max-w-sm mx-auto">
        {/* Brand Identity & Original Logo Card */}
        <div className="p-4 rounded-3xl bg-gradient-to-r from-[#170E2E] to-[#120A24] border border-[#A855F7]/25 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlphaMateLogo size="sm" showText={false} customLogoUrl={customLogoUrl} />
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                {t('settings.identityTitle')}
              </h3>
              <p className="text-[10px] text-zinc-400">{t('settings.identitySubtitle')}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowLogoModal(true)}
            className="px-3 py-1.5 rounded-xl bg-[#2A184E] border border-[#A855F7]/40 text-xs font-semibold text-[#C084FC] hover:bg-[#39206B] transition-colors cursor-pointer"
          >
            {t('settings.logoAsset')}
          </button>
        </div>

        {/* Android Environment Hub (APK & AAB Setup) */}
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 block px-1 mb-2 flex items-center gap-1.5">
            <Smartphone className="w-3.5 h-3.5" />
            <span>{t('settings.androidSection')}</span>
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
                    <span className="text-xs font-bold text-white">
                      {t('settings.androidTitle')}
                    </span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold uppercase">
                      {t('settings.androidBadge')}
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-400">{t('settings.androidSubtitle')}</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-500 shrink-0 rtl:rotate-180" />
            </div>
          </div>
        </div>

        {/* Offline Experience & App Install (Service Worker Cache) */}
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-violet-300 block px-1 mb-2 flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5 text-[#A855F7]" />
            <span>{t('settings.offlineSection')}</span>
          </span>
          <div className="rounded-2xl bg-[#140D26] border border-[#A855F7]/25 p-3.5 space-y-3">
            <p className="text-[11px] text-zinc-300 leading-relaxed">
              {t('settings.offlineDescription')}
            </p>
            <PWAInstallButton variant="card" />
            <button
              type="button"
              onClick={() => {
                clearProfileSnippetCache()
                  .then(() => showToast(t('settings.clearCacheSuccess')))
                  .catch(() => showToast(t('settings.clearCacheError')));
              }}
              className="w-full py-2 px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-[11px] font-semibold text-zinc-200 transition cursor-pointer"
            >
              {t('settings.clearCacheButton')}
            </button>
          </div>
        </div>

        {/* Multi-Account System (Up to 5 Accounts Instant Switch) */}
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#C084FC] px-1 mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-[#EC4899]" />
              <span>{t('settings.multiAccountSection')}</span>
            </span>
            <span>
              {t('settings.idsCount', {
                current: Math.max(1, savedAccounts.length),
                max: maxSavedAccounts,
              })}
            </span>
          </span>
          <div className="rounded-2xl bg-[#140D26] border border-[#A855F7]/30 divide-y divide-white/5 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowAccountSwitcherModal(true)}
              className="w-full min-h-[56px] p-3.5 flex items-center justify-between hover:bg-white/[0.03] cursor-pointer text-start"
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
                    {t('settings.switchAccount', {
                      current: Math.max(1, savedAccounts.length),
                      max: maxSavedAccounts,
                    })}
                  </div>
                  <div className="text-[10px] text-zinc-400 truncate">
                    {t('settings.activeAccountHint', { username: currentUser.username })}
                  </div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0 rtl:rotate-180" />
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
                className="w-full min-h-[46px] px-3.5 py-2.5 flex items-center justify-between hover:bg-white/[0.03] cursor-pointer text-start"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-[#7928CA]/25 border border-[#A855F7]/40 flex items-center justify-center text-[#E9D5FF]">
                    <Plus className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block">
                      {t('settings.addNewAccount')}
                    </span>
                    <span className="text-[10px] text-zinc-400">
                      {t('settings.addNewAccountHint', {
                        free: maxSavedAccounts - savedAccounts.length,
                      })}
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-500 shrink-0 rtl:rotate-180" />
              </button>
            )}
          </div>
        </div>

        {/* Section 1: Account & Security */}
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block px-1 mb-2">
            {t('settings.accountSecuritySection')}
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
                <span className="text-xs font-medium text-white">
                  {t('settings.editProfile')}
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-500 rtl:rotate-180" />
            </div>

            <div
              onClick={() => showToast(t('settings.securityToast'))}
              className="p-3.5 flex items-center justify-between hover:bg-white/[0.02] cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <Shield className="w-4 h-4 text-[#A855F7]" />
                <span className="text-xs font-medium text-white">
                  {t('settings.security2fa')}
                </span>
              </div>
              <span className="text-[10px] text-emerald-400 font-semibold">
                {t('settings.protected')}
              </span>
            </div>
          </div>
        </div>

        {/* Section 2: Preferences & Live Settings */}
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block px-1 mb-2">
            {t('settings.preferencesSection')}
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
                    <span className="text-xs font-bold text-white">
                      {t('settings.pushHub')}
                    </span>
                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                        notificationPreferences.enabled
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-zinc-700 text-zinc-300'
                      }`}
                    >
                      {notificationPreferences.enabled
                        ? t('settings.pushOn')
                        : t('settings.pushOff')}
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-400">{t('settings.pushSubtitle')}</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-500 shrink-0 rtl:rotate-180" />
            </div>

            <div className="p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Radio className="w-4 h-4 text-[#EC4899]" />
                <span className="text-xs font-medium text-white">
                  {t('settings.broadcastQuality')}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setStreamQuality(streamQuality === '1080p' ? '720p' : '1080p')}
                className="px-2 py-0.5 rounded-md bg-[#251642] text-[10px] font-bold text-[#C084FC] cursor-pointer"
              >
                {streamQuality} HD
              </button>
            </div>

            <div className="p-3.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-amber-500/15 dark:bg-[#A855F7]/20 text-amber-600 dark:text-amber-300 flex items-center justify-center shrink-0 border border-amber-500/30 dark:border-[#A855F7]/30">
                  {isDark ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-bold text-white block">
                    {t('settings.appearance')}
                  </span>
                  <span className="text-[10px] text-zinc-400 block truncate">
                    {t('settings.appearanceSubtitle')}
                  </span>
                </div>
              </div>
              <ThemeToggle
                variant="segmented"
                onChange={(nextTheme) =>
                  showToast(
                    t('settings.themeSwitchedToast', {
                      mode:
                        nextTheme === 'dark'
                          ? t('settings.themeDark')
                          : t('settings.themeLight'),
                    })
                  )
                }
              />
            </div>

            <button
              type="button"
              onClick={() => setShowLanguageModal(true)}
              aria-haspopup="dialog"
              aria-expanded={showLanguageModal}
              className="w-full min-h-[54px] p-3.5 flex items-center justify-between gap-2 hover:bg-white/[0.03] transition-colors cursor-pointer text-start"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-[#A855F7]/20 text-[#C084FC] flex items-center justify-center shrink-0 border border-[#A855F7]/30">
                  <Globe className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-bold text-white block">
                    {t('settings.language')}
                  </span>
                  <span className="text-[10px] text-zinc-400 block truncate">
                    {t('settings.languageSubtitle')}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="px-2 py-0.5 rounded-md bg-[#251642] border border-[#A855F7]/30 text-[10px] font-semibold text-[#E9D5FF]">
                  {activeLanguage.nativeName}
                </span>
                <ChevronRight className="w-4 h-4 text-zinc-500 shrink-0 rtl:rotate-180" />
              </div>
            </button>
          </div>
        </div>

        {/* Section 3: Billing & Payments */}
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block px-1 mb-2">
            {t('settings.financeSection')}
          </span>
          <div className="rounded-2xl bg-[#140D26] border border-white/5 divide-y divide-white/5 overflow-hidden">
            <div
              onClick={() => setCurrentScreen('wallet')}
              className="p-3.5 flex items-center justify-between hover:bg-white/[0.02] cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <CreditCard className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-medium text-white">
                  {t('settings.paymentMethods')}
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-500 rtl:rotate-180" />
            </div>

            <div
              onClick={() => showToast(t('settings.noBlockedToast'))}
              className="p-3.5 flex items-center justify-between hover:bg-white/[0.02] cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <UserX className="w-4 h-4 text-zinc-400" />
                <span className="text-xs font-medium text-white">
                  {t('settings.blockedUsers')}
                </span>
              </div>
              <span className="text-[10px] text-zinc-500">0</span>
            </div>
          </div>
        </div>

        {/* Section 4: About & Legal */}
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block px-1 mb-2">
            {t('settings.aboutSection')}
          </span>
          <div className="rounded-2xl bg-[#140D26] border border-white/5 divide-y divide-white/5 overflow-hidden">
            <div
              onClick={() => showToast(t('settings.aboutToast'))}
              className="p-3.5 flex items-center justify-between hover:bg-white/[0.02] cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <Info className="w-4 h-4 text-zinc-400" />
                <span className="text-xs font-medium text-white">
                  {t('settings.aboutApp')}
                </span>
              </div>
              <span className="text-[10px] text-zinc-500">v2.4.0</span>
            </div>

            <div
              onClick={() => showToast(t('settings.helpToast'))}
              className="p-3.5 flex items-center justify-between hover:bg-white/[0.02] cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <HelpCircle className="w-4 h-4 text-zinc-400" />
                <span className="text-xs font-medium text-white">
                  {t('settings.helpSupport')}
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-500 rtl:rotate-180" />
            </div>

            <button
              type="button"
              onClick={() => setCurrentScreen('terms_conditions')}
              className="w-full min-h-[44px] p-3.5 flex items-center justify-between hover:bg-white/[0.02] cursor-pointer text-start"
            >
              <div className="flex items-center gap-3">
                <FileText className="w-4 h-4 text-[#C084FC]" />
                <span className="text-xs font-medium text-white">
                  {t('settings.termsConditions')}
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-500 rtl:rotate-180" />
            </button>

            <button
              type="button"
              onClick={() => setCurrentScreen('privacy_policy')}
              className="w-full min-h-[44px] p-3.5 flex items-center justify-between hover:bg-white/[0.02] cursor-pointer text-start"
            >
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-4 h-4 text-[#EC4899]" />
                <span className="text-xs font-medium text-white">
                  {t('settings.privacyPolicy')}
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-500 rtl:rotate-180" />
            </button>
          </div>
        </div>

        {/* Account Deactivation & Deletion (Placed right above Log Out) */}
        <button
          type="button"
          onClick={() => setCurrentScreen('delete_account')}
          className="w-full p-3.5 rounded-2xl bg-[#140D26] hover:bg-[#1C1235] border border-amber-500/25 flex items-center justify-between transition-colors cursor-pointer text-start"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 flex items-center justify-center shrink-0">
              <Trash2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-white">
                {t('settings.deleteAccount')}
              </div>
              <div className="text-[10px] text-zinc-400 truncate">
                {t('settings.deleteAccountSubtitle')}
              </div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-zinc-500 shrink-0 rtl:rotate-180" />
        </button>

        {/* Log Out Button */}
        <button
          type="button"
          onClick={logout}
          className="w-full h-12 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>{t('settings.logOut')}</span>
        </button>
      </div>

      {/* Language Selection Modal */}
      {showLanguageModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="language-modal-title"
          onClick={() => setShowLanguageModal(false)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl bg-[#171030] border border-[#A855F7]/30 p-5 shadow-2xl animate-scale-up"
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-[#7928CA]/40 to-[#EC4899]/30 border border-[#A855F7]/40 flex items-center justify-center text-[#E9D5FF] shrink-0">
                  <Globe className="w-4 h-4" />
                </div>
                <div>
                  <h3 id="language-modal-title" className="text-sm font-bold text-white">
                    {t('settings.languageModalTitle')}
                  </h3>
                  <p className="text-[11px] text-zinc-400 mt-0.5 leading-snug">
                    {t('settings.languageModalSubtitle')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowLanguageModal(false)}
                aria-label={t('settings.close')}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-colors shrink-0 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              {SUPPORTED_LANGUAGES.map((lang) => {
                const isSelected = activeLanguage.code === lang.code;
                return (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => handleSelectLanguage(lang.code)}
                    className={`w-full p-3 rounded-2xl border flex items-center justify-between gap-3 transition-all cursor-pointer text-start ${
                      isSelected
                        ? 'bg-gradient-to-r from-[#7928CA]/25 to-[#EC4899]/20 border-[#A855F7]/70 shadow-[0_0_20px_rgba(168,85,247,0.18)]'
                        : 'bg-[#0F0A20] border-white/10 hover:border-[#A855F7]/40 hover:bg-[#140D2B]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-extrabold shrink-0 border ${
                          isSelected
                            ? 'bg-gradient-to-br from-[#7928CA] to-[#EC4899] text-white border-white/20'
                            : 'bg-[#1A1133] text-zinc-300 border-white/10'
                        }`}
                      >
                        {lang.shortCode}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-white">
                            {lang.nativeName}
                          </span>
                          {lang.dir === 'rtl' && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-400/30 font-bold uppercase">
                              {t('settings.rtlBadge')}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-zinc-400 block truncate">
                          {lang.name} • {lang.region}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {isSelected ? (
                        <div className="w-6 h-6 rounded-full bg-gradient-to-r from-[#7928CA] to-[#EC4899] flex items-center justify-center text-white shadow-md">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-full border border-white/15" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setShowLanguageModal(false)}
              className="w-full mt-4 h-10 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-xs font-semibold text-zinc-200 transition-colors cursor-pointer"
            >
              {t('settings.close')}
            </button>
          </div>
        </div>
      )}

      {/* Original Logo Asset Manager Modal */}
      {showLogoModal && (
        <div
          onClick={() => setShowLogoModal(false)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl bg-[#171030] border border-[#A855F7]/30 p-6 shadow-2xl animate-scale-up"
          >
            <h3 className="text-base font-bold text-white mb-1">
              {t('settings.logoModalTitle')}
            </h3>
            <p className="text-xs text-zinc-400 mb-4">
              {t('settings.logoModalDescription')}
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
                  className="flex-1 h-11 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-semibold hover:bg-zinc-700 cursor-pointer"
                >
                  {t('settings.logoReset')}
                </button>
                <button
                  type="button"
                  onClick={handleApplyLogoUrl}
                  className="flex-1 h-11 rounded-xl bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white text-xs font-bold cursor-pointer"
                >
                  {t('settings.logoApply')}
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

