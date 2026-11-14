import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { AlphaMateLogo } from '../components/brand/AlphaMateLogo';
import {
  ArrowLeft,
  ShieldAlert,
  PauseCircle,
  Trash2,
  MailCheck,
  Clock,
  RotateCcw,
  Copy,
  Check,
  KeyRound,
  AlertTriangle,
  LogIn,
  ShieldCheck,
  ExternalLink,
  CheckCircle2,
  LogOut,
} from 'lucide-react';

const PUBLIC_DELETE_URL = 'https://alphamate.app/delete-account';

const REASON_PRESETS = [
  'Taking a temporary break',
  'Privacy or security concerns',
  'Managing multiple accounts',
  'Too many notifications',
  'Other reason',
];

export const DeleteAccountScreen: React.FC = () => {
  const {
    currentUser,
    firebaseUser,
    isAuthenticated,
    isEmailVerified,
    customLogoUrl,
    navigateBack,
    setCurrentScreen,
    loginWithFirebaseGoogle,
    sendAccountDeletionOtp,
    verifyAccountDeletionOtp,
    deactivateCurrentAccount,
    requestPermanentAccountDeletion,
    logout,
  } = useApp();

  const [reason, setReason] = useState<string>('');
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Deactivation confirmation state
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);

  // Permanent deletion OTP & confirmation state
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [maskedEmail, setMaskedEmail] = useState<string | null>(null);
  const [otpInput, setOtpInput] = useState<string>('');
  const [otpVerifiedAt, setOtpVerifiedAt] = useState<string | null>(null);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [submittingDeletion, setSubmittingDeletion] = useState(false);
  const [otpStatusMsg, setOtpStatusMsg] = useState<string | null>(null);
  const [otpErrorMsg, setOtpErrorMsg] = useState<string | null>(null);
  const [cooldownSec, setCooldownSec] = useState<number>(0);
  const [confirmPermanentChecked, setConfirmPermanentChecked] = useState(false);

  // Cooldown timer for OTP resend
  useEffect(() => {
    if (cooldownSec <= 0) return;
    const timer = setInterval(() => {
      setCooldownSec((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownSec]);

  const isSignedIn = Boolean(firebaseUser && isEmailVerified);
  const accountStatus = currentUser?.accountStatus || 'active';
  const isRestricted =
    isSignedIn &&
    (accountStatus === 'deactivated' ||
      accountStatus === 'pending_deletion' ||
      accountStatus === 'permanently_deleted');

  const handleCopyPublicUrl = async () => {
    try {
      await navigator.clipboard.writeText(PUBLIC_DELETE_URL);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2500);
    } catch {
      // ignore clipboard errors in restricted frames
    }
  };

  const handleDeactivateSubmit = async () => {
    setDeactivateError(null);
    setDeactivating(true);
    const res = await deactivateCurrentAccount(reason);
    setDeactivating(false);
    if (!res.success) {
      setDeactivateError(res.error || 'Could not deactivate account. Please try again.');
    }
  };

  const handleSendOtp = async () => {
    setOtpErrorMsg(null);
    setOtpStatusMsg(null);
    setSendingOtp(true);
    const res = await sendAccountDeletionOtp();
    setSendingOtp(false);

    if (!res.success || !res.challengeToken) {
      setOtpErrorMsg(
        res.error || 'Unable to send OTP to your registered email. Please try again or contact support@alphamate.app.'
      );
      return;
    }

    setChallengeToken(res.challengeToken);
    setMaskedEmail(res.emailMasked || firebaseUser?.email || currentUser?.email || null);
    setCooldownSec(res.cooldownSeconds || 30);
    setOtpVerifiedAt(null);
    setOtpInput('');
    setOtpStatusMsg(
      `A 6-digit verification OTP has been sent to ${res.emailMasked || firebaseUser?.email || 'your email'}. Valid for 10 minutes.`
    );
  };

  const handleVerifyOtp = async () => {
    if (!challengeToken) {
      setOtpErrorMsg('Please request an OTP first.');
      return;
    }
    const cleanOtp = otpInput.replace(/\D/g, '').slice(0, 6);
    if (cleanOtp.length !== 6) {
      setOtpErrorMsg('Enter the exact 6-digit numeric OTP from your email.');
      return;
    }

    setOtpErrorMsg(null);
    setVerifyingOtp(true);
    const res = await verifyAccountDeletionOtp(challengeToken, cleanOtp);
    setVerifyingOtp(false);

    if (!res.success || !res.otpVerifiedAt) {
      setOtpErrorMsg(res.error || 'OTP verification failed. Please check the code and try again.');
      return;
    }

    setOtpVerifiedAt(res.otpVerifiedAt);
    setOtpStatusMsg('Email ownership verified! You may now submit your 15-day permanent deletion request.');
  };

  const handleConfirmPermanentDeletion = async () => {
    if (!otpVerifiedAt) {
      setOtpErrorMsg('Complete Email OTP verification first.');
      return;
    }
    if (!confirmPermanentChecked) {
      setOtpErrorMsg('Please check the acknowledgment box confirming the 15-day pending deletion process.');
      return;
    }
    setOtpErrorMsg(null);
    setSubmittingDeletion(true);
    const res = await requestPermanentAccountDeletion(otpVerifiedAt, reason);
    setSubmittingDeletion(false);
    if (!res.success) {
      setOtpErrorMsg(res.error || 'Failed to schedule permanent account deletion.');
    }
  };

  const handleGoogleQuickAuth = async () => {
    setOtpErrorMsg(null);
    await loginWithFirebaseGoogle({ skipRedirect: true });
  };

  const scheduledDatePreview = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="w-full h-full flex-1 bg-[#09070F] text-zinc-200 overflow-y-auto overscroll-contain select-text">
      {/* Top Sticky App Bar */}
      <header className="sticky top-0 z-30 w-full bg-[#09070F]/90 backdrop-blur-md border-b border-[#A855F7]/20">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={navigateBack}
            className="min-w-[44px] min-h-[44px] -ml-2 px-2 rounded-full flex items-center justify-center gap-1.5 text-zinc-300 hover:text-white hover:bg-white/5 transition cursor-pointer"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-xs font-semibold hidden sm:inline">Back</span>
          </button>

          <div className="flex items-center gap-2 min-w-0">
            <AlphaMateLogo size="sm" showText={false} customLogoUrl={customLogoUrl} />
            <h1 className="text-sm sm:text-base font-bold text-white truncate">Account Deletion &amp; Deactivation</h1>
          </div>

          <button
            type="button"
            onClick={() => setCurrentScreen('privacy_policy')}
            className="min-h-[44px] px-3 rounded-xl bg-[#1A1033] hover:bg-[#251649] border border-[#A855F7]/30 text-[11px] sm:text-xs font-bold text-[#D8B4FE] flex items-center gap-1.5 shrink-0 cursor-pointer transition"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Privacy</span>
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-20 space-y-5">
        {/* Hero Overview Banner */}
        <section className="rounded-3xl bg-gradient-to-br from-[#170E2E] via-[#130B24] to-[#0E071B] border border-[#A855F7]/30 p-5 sm:p-7 shadow-xl space-y-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#EC4899] to-[#7928CA] flex items-center justify-center text-white shrink-0 shadow-lg shadow-[#EC4899]/25">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#F9A8D4]">
                Alpha Mate Account Controls
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Manage Account Deactivation or Deletion
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                Choose between <strong className="text-zinc-200">Temporary Deactivation</strong> (never deleted, recover
                anytime with no time limit) or <strong className="text-zinc-200">OTP-Verified Permanent Deletion</strong>{' '}
                (enters the official 15-day pending review window before permanent removal).
              </p>
            </div>
          </div>

          {/* Public Play Store Deletion URL Box */}
          <div className="rounded-2xl bg-[#0C0718] border border-white/10 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Official Google Play Store Account Deletion URL
              </div>
              <div className="text-xs sm:text-sm font-mono text-[#D8B4FE] truncate">{PUBLIC_DELETE_URL}</div>
            </div>
            <button
              type="button"
              onClick={handleCopyPublicUrl}
              className="min-h-[40px] px-3.5 rounded-xl bg-[#1F123A] hover:bg-[#2C1A52] border border-[#A855F7]/30 text-xs font-bold text-white flex items-center justify-center gap-1.5 shrink-0 cursor-pointer transition"
            >
              {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedUrl ? 'Link Copied' : 'Copy Link'}</span>
            </button>
          </div>
        </section>

        {/* Already Restricted Account Status Notice */}
        {isRestricted && (
          <section className="rounded-3xl bg-amber-500/10 border border-amber-400/40 p-5 space-y-3">
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-amber-200">
                  Your Account Is Currently{' '}
                  {accountStatus === 'deactivated'
                    ? 'Temporarily Deactivated'
                    : accountStatus === 'pending_deletion'
                    ? 'In 15-Day Official Pending Deletion'
                    : 'Permanently Deleted'}
                </h3>
                <p className="text-xs text-amber-100/80">
                  Signed in as <span className="font-semibold text-white">{firebaseUser?.email}</span>. Open Account
                  Recovery to restore your account or view remaining days.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={() => setCurrentScreen('account_recovery')}
                className="min-h-[44px] px-4 rounded-xl bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white text-xs font-bold flex items-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Go to Account Recovery</span>
              </button>
              <button
                type="button"
                onClick={logout}
                className="min-h-[44px] px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-zinc-200 flex items-center gap-2 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </section>
        )}

        {/* Signed-in Active Account Controls */}
        {isSignedIn && isAuthenticated && !isRestricted ? (
          <>
            {/* Active Account Identity Summary */}
            <section className="rounded-2xl bg-[#120B22] border border-white/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={currentUser.avatar}
                  alt={currentUser.displayName}
                  className="w-12 h-12 rounded-2xl object-cover border border-[#A855F7]/50 shrink-0"
                />
                <div className="min-w-0">
                  <div className="text-sm font-bold text-white truncate">{currentUser.displayName}</div>
                  <div className="text-xs text-zinc-400 truncate">
                    {firebaseUser?.email || currentUser.email} &bull; ID: {currentUser.uniqueId}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono">
                <div className="px-3 py-1.5 rounded-xl bg-[#1A1033] border border-amber-400/20 text-amber-300">
                  {(currentUser.coins || 0).toLocaleString()} Coins
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-[#1A1033] border border-cyan-400/20 text-cyan-300">
                  {(currentUser.diamonds || 0).toLocaleString()} Diamonds
                </div>
              </div>
            </section>

            {/* Optional Reason Selector */}
            <section className="rounded-2xl bg-[#120B22] border border-white/10 p-4 sm:p-5 space-y-3">
              <label htmlFor="deletion-reason-input" className="block text-xs font-bold uppercase tracking-wider text-zinc-400">
                Reason for Leaving (Optional)
              </label>
              <div className="flex flex-wrap gap-2">
                {REASON_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setReason(preset)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition cursor-pointer ${
                      reason === preset
                        ? 'bg-[#7928CA]/30 border-[#A855F7] text-white'
                        : 'bg-[#0B0617] border-white/10 text-zinc-300 hover:border-white/25'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
              <input
                id="deletion-reason-input"
                type="text"
                maxLength={300}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Share an optional note for our team..."
                className="w-full h-11 px-3.5 rounded-xl bg-[#0B0617] border border-white/10 text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#A855F7]"
              />
            </section>

            {/* Option 1: Temporary Deactivation (No Time Limit) */}
            <section className="rounded-3xl bg-[#120B22] border border-[#A855F7]/30 p-5 sm:p-6 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#7928CA]/20 border border-[#A855F7]/40 text-[#D8B4FE] flex items-center justify-center shrink-0">
                    <PauseCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-bold text-white">Temporary Deactivation</h3>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-bold uppercase text-emerald-300">
                        No Time Limit &bull; Never Deleted
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-zinc-400 mt-1 leading-relaxed">
                      Pause your account safely. Your profile, Coins, Diamonds, VIP level, and content stay intact and
                      will <strong className="text-zinc-200">never be permanently deleted</strong>. Whenever you sign back
                      in—days, months, or years later—you can reactivate immediately.
                    </p>
                  </div>
                </div>
              </div>

              {deactivateError && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-200">
                  {deactivateError}
                </div>
              )}

              {!confirmDeactivate ? (
                <button
                  type="button"
                  onClick={() => setConfirmDeactivate(true)}
                  className="w-full sm:w-auto min-h-[44px] px-5 rounded-xl bg-[#241345] hover:bg-[#311A5E] border border-[#A855F7]/40 text-xs sm:text-sm font-bold text-[#E9D5FF] flex items-center justify-center gap-2 cursor-pointer transition"
                >
                  <PauseCircle className="w-4 h-4" />
                  <span>Deactivate Account Temporarily</span>
                </button>
              ) : (
                <div className="rounded-2xl bg-[#0C0718] border border-[#A855F7]/30 p-4 space-y-3">
                  <p className="text-xs text-zinc-300">
                    Confirm temporary deactivation for <strong className="text-white">{firebaseUser?.email}</strong>?
                    You will be signed out now and can recover anytime with zero deadline.
                  </p>
                  <div className="flex flex-wrap gap-2.5">
                    <button
                      type="button"
                      disabled={deactivating}
                      onClick={handleDeactivateSubmit}
                      className="min-h-[44px] px-5 rounded-xl bg-gradient-to-r from-[#7928CA] to-[#A855F7] text-white text-xs font-bold disabled:opacity-60 cursor-pointer"
                    >
                      {deactivating ? 'Deactivating...' : 'Confirm Temporary Deactivation'}
                    </button>
                    <button
                      type="button"
                      disabled={deactivating}
                      onClick={() => setConfirmDeactivate(false)}
                      className="min-h-[44px] px-4 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* Option 2: Permanent Deletion (Email OTP -> 15-Day Official Queue) */}
            <section className="rounded-3xl bg-[#140A19] border border-rose-500/35 p-5 sm:p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/15 border border-rose-500/35 text-rose-400 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-bold text-white">Permanent Account Deletion</h3>
                    <span className="px-2 py-0.5 rounded-md bg-rose-500/15 border border-rose-500/30 text-[10px] font-bold uppercase text-rose-300">
                      OTP Required &bull; 15-Day Pending
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-zinc-400 mt-1 leading-relaxed">
                    Permanent deletion requires a <strong className="text-zinc-200">6-digit Email OTP</strong> sent to{' '}
                    <span className="text-zinc-200 font-medium">{firebaseUser?.email}</span>. Once verified, your account
                    moves into the <strong className="text-zinc-200">15-day Official Pending Deletion queue</strong>{' '}
                    (targeted completion: <strong className="text-rose-200">{scheduledDatePreview}</strong>). Sign back in
                    within those 15 days to cancel deletion and recover your account.
                  </p>
                </div>
              </div>

              {otpStatusMsg && (
                <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/35 text-xs text-emerald-200 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{otpStatusMsg}</span>
                </div>
              )}

              {otpErrorMsg && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-200 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{otpErrorMsg}</span>
                </div>
              )}

              {/* Step 1: Request OTP */}
              <div className="rounded-2xl bg-[#0D0614] border border-white/10 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-white flex items-center gap-2">
                    <MailCheck className="w-4 h-4 text-[#EC4899]" />
                    <span>Step 1: Verify Email Ownership with 6-Digit OTP</span>
                  </span>
                  {otpVerifiedAt && (
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold uppercase">
                      Verified
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    disabled={sendingOtp || cooldownSec > 0}
                    onClick={handleSendOtp}
                    className="min-h-[44px] px-4 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-200 text-xs font-bold disabled:opacity-50 cursor-pointer transition"
                  >
                    {sendingOtp
                      ? 'Sending OTP...'
                      : cooldownSec > 0
                      ? `Resend OTP in ${cooldownSec}s`
                      : challengeToken
                      ? 'Resend 6-Digit Email OTP'
                      : 'Send 6-Digit OTP to My Email'}
                  </button>
                  {maskedEmail && (
                    <span className="text-[11px] text-zinc-400">
                      Target: <span className="font-mono text-zinc-200">{maskedEmail}</span>
                    </span>
                  )}
                </div>

                {/* Step 2: Enter & Verify OTP */}
                {challengeToken && !otpVerifiedAt && (
                  <div className="pt-2 border-t border-white/10 space-y-2.5">
                    <label htmlFor="deletion-otp-code" className="block text-xs font-semibold text-zinc-300">
                      Step 2: Enter the 6-digit OTP sent to your email
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2.5">
                      <input
                        id="deletion-otp-code"
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={otpInput}
                        onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="000000"
                        className="h-11 px-4 rounded-xl bg-[#08040E] border border-rose-500/35 text-center font-mono text-lg tracking-[0.4em] text-white placeholder-zinc-600 focus:outline-none focus:border-[#EC4899] sm:w-48"
                      />
                      <button
                        type="button"
                        disabled={verifyingOtp || otpInput.length !== 6}
                        onClick={handleVerifyOtp}
                        className="min-h-[44px] px-5 rounded-xl bg-gradient-to-r from-[#EC4899] to-[#7928CA] text-white text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                      >
                        <KeyRound className="w-4 h-4" />
                        <span>{verifyingOtp ? 'Verifying...' : 'Verify OTP Code'}</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 3: Submit Verified Request to 15-Day Queue */}
                {otpVerifiedAt && (
                  <div className="pt-3 border-t border-white/10 space-y-3">
                    <label className="flex items-start gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={confirmPermanentChecked}
                        onChange={(e) => setConfirmPermanentChecked(e.target.checked)}
                        className="mt-0.5 w-4 h-4 accent-rose-500 rounded cursor-pointer"
                      />
                      <span className="text-xs text-zinc-300 leading-relaxed">
                        I understand my account will enter the{' '}
                        <strong className="text-white">Official 15-Day Pending Deletion Queue</strong> and will be
                        permanently deleted after 15 days unless I sign back in to recover it.
                      </span>
                    </label>

                    <button
                      type="button"
                      disabled={submittingDeletion || !confirmPermanentChecked}
                      onClick={handleConfirmPermanentDeletion}
                      className="w-full sm:w-auto min-h-[44px] px-5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer transition"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>
                        {submittingDeletion ? 'Submitting Request...' : 'Submit Permanent Account Deletion (15-Day Queue)'}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            </section>
          </>
        ) : null}

        {/* Public Google Play Store Web Instructions & Sign-In Fallback */}
        {!isSignedIn && (
          <section className="rounded-3xl bg-[#120B22] border border-white/10 p-5 sm:p-6 space-y-4">
            <h3 className="text-base font-bold text-white">Sign In to Deactivate or Delete Your Account</h3>
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
              Sign in with your Alpha Mate Google or Email account right here on the web or inside Settings in the Android
              app to trigger Temporary Deactivation or OTP-verified Permanent Deletion immediately.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleGoogleQuickAuth}
                className="min-h-[44px] px-5 rounded-xl bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white text-xs sm:text-sm font-bold flex items-center gap-2 cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In with Google</span>
              </button>
              <button
                type="button"
                onClick={() => setCurrentScreen('signin')}
                className="min-h-[44px] px-5 rounded-xl bg-[#1C1136] hover:bg-[#27184B] border border-[#A855F7]/30 text-white text-xs sm:text-sm font-semibold flex items-center gap-2 cursor-pointer"
              >
                <span>Sign In with Email &amp; Password</span>
              </button>
            </div>
          </section>
        )}

        {/* Clear Lifecycle Documentation (Always Visible for Play Store Reviewers & Users) */}
        <section className="rounded-3xl bg-[#120B22]/90 border border-white/10 p-5 sm:p-6 space-y-4">
          <h3 className="text-base font-bold text-white">How Alpha Mate Account Deletion &amp; Recovery Works</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs sm:text-sm">
            <div className="rounded-2xl bg-[#0C0718] border border-white/10 p-4 space-y-2">
              <div className="font-bold text-[#D8B4FE] flex items-center gap-2">
                <PauseCircle className="w-4 h-4" />
                <span>1. Temporary Deactivation (Unlimited Time)</span>
              </div>
              <ul className="list-disc pl-4 space-y-1 text-zinc-400 text-xs leading-relaxed">
                <li>Your account access is paused immediately and you are signed out.</li>
                <li>Your account, Coins, Diamonds, VIP level, and profile are never deleted.</li>
                <li>Log back in at any time (no time limit) to reactivate instantly.</li>
              </ul>
            </div>

            <div className="rounded-2xl bg-[#0C0718] border border-white/10 p-4 space-y-2">
              <div className="font-bold text-rose-300 flex items-center gap-2">
                <Trash2 className="w-4 h-4" />
                <span>2. Permanent Deletion (OTP + 15-Day Pending)</span>
              </div>
              <ul className="list-disc pl-4 space-y-1 text-zinc-400 text-xs leading-relaxed">
                <li>Requires verifying a 6-digit OTP sent to your registered email address.</li>
                <li>Account enters our Official 15-Day Pending Deletion queue upon OTP verification.</li>
                <li>Sign back in within 15 days to cancel and restore everything; after 15 days, data &amp; login credentials are permanently deleted.</li>
              </ul>
            </div>
          </div>

          <div className="rounded-2xl bg-[#0C0718] border border-white/10 p-4 text-xs text-zinc-400 leading-relaxed flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <strong className="text-zinc-200">Data Deleted vs. Retained:</strong> Permanent deletion removes your
              Firebase Authentication login, user profile, Coins/Diamonds balances, and presence records. Records required
              for fraud prevention, chargebacks, or legal compliance may be retained briefly per applicable law.
            </div>
            <a
              href="mailto:support@alphamate.app?subject=Alpha%20Mate%20Account%20Deletion%20Request"
              className="min-h-[40px] px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-[#D8B4FE] flex items-center justify-center gap-1.5 shrink-0"
            >
              <span>support@alphamate.app</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </section>
      </main>
    </div>
  );
};
