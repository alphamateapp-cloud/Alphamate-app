import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { AlphaMateLogo } from '../components/brand/AlphaMateLogo';
import { LegalConsentCheckboxes } from '../components/legal/LegalConsentCheckboxes';
import {
  Mail,
  Lock,
  ArrowLeft,
  Sparkles,
  Eye,
  EyeOff,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  ChevronRight,
  Users,
  KeyRound,
  Loader2,
} from 'lucide-react';

type RegisterStep =
  | 'select_method'
  | 'enter_email'
  | 'verify_otp'
  | 'create_password'
  | 'legacy_verify_email';

export const RegisterScreen: React.FC = () => {
  const {
    setCurrentScreen,
    customLogoUrl,
    isAuthenticated,
    firebaseUser,
    firebaseAuthLoading,
    isEmailVerified,
    loginWithFirebaseGoogle,
    sendPreSignupEmailOtp,
    verifyPreSignupEmailOtp,
    completePreSignupPassword,
    sendSignupEmailOtp,
    verifySignupEmailOtp,
    legalConsent,
    setLegalConsent,
    savedAccounts,
    maxSavedAccounts,
    isAddingAccount,
    cancelAddAccountFlow,
    switchAccount,
  } = useApp();

  const [step, setStep] = useState<RegisterStep>('select_method');

  // Auto-redirect only when a real, verified Firebase Auth session is active
  React.useEffect(() => {
    if (!firebaseAuthLoading && isAuthenticated && firebaseUser && isEmailVerified) {
      setCurrentScreen('home');
    } else if (!firebaseAuthLoading && firebaseUser && !isEmailVerified) {
      setEmail(firebaseUser.email || '');
      setStep('legacy_verify_email');
    }
  }, [firebaseAuthLoading, isAuthenticated, firebaseUser, isEmailVerified, setCurrentScreen]);

  const [email, setEmail] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [otpChallengeToken, setOtpChallengeToken] = useState('');
  const [otpMaskedEmail, setOtpMaskedEmail] = useState('');
  const [registrationTicket, setRegistrationTicket] = useState('');
  const [otpCooldownSec, setOtpCooldownSec] = useState(0);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [consentError, setConsentError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [switchingUid, setSwitchingUid] = useState<string | null>(null);
  const [showAppleComingSoon, setShowAppleComingSoon] = useState(false);
  const [showPlatformRegistrationModal, setShowPlatformRegistrationModal] = useState(false);

  const agreedToTerms = legalConsent.terms;
  const agreedToPrivacy = legalConsent.privacy;

  const setAgreedToTerms = (next: boolean) => {
    setLegalConsent((prev) => {
      const updated = { ...prev, terms: next };
      if (updated.terms && updated.privacy) {
        setConsentError(false);
        setErrorMessage('');
      }
      return updated;
    });
  };

  const setAgreedToPrivacy = (next: boolean) => {
    setLegalConsent((prev) => {
      const updated = { ...prev, privacy: next };
      if (updated.terms && updated.privacy) {
        setConsentError(false);
        setErrorMessage('');
      }
      return updated;
    });
  };

  React.useEffect(() => {
    if (otpCooldownSec <= 0) return;
    const timer = window.setInterval(() => {
      setOtpCooldownSec((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [otpCooldownSec]);

  const ensureLegalConsent = () => {
    if (!agreedToTerms || !agreedToPrivacy) {
      setConsentError(true);
      setErrorMessage(
        'Please check both boxes to accept our Terms & Conditions and Privacy Policy before creating an account.'
      );
      return false;
    }
    setConsentError(false);
    return true;
  };

  const formatFirebaseAuthError = (raw?: string) => {
    const msg = raw || '';
    if (msg.includes('popup-closed-by-user')) {
      return 'Google sign-in was closed before finishing. Tap Continue with Google to try again.';
    }
    if (msg.includes('email-already-in-use') || msg.includes('EMAIL_ALREADY_REGISTERED')) {
      return 'An account with this email already has a password. Please tap Sign In below or Continue with Google.';
    }
    if (msg.includes('weak-password')) {
      return 'Password is too weak. Please choose at least 6 characters.';
    }
    if (msg.includes('invalid-email')) {
      return 'Please enter a valid email address.';
    }
    return msg || 'Sign-up could not complete. Please try again.';
  };

  // Continue with Google (Gmail) -> enters app & opens In-App Profile Registration Window for new users
  const handleDirectGoogleSignIn = async () => {
    if (!ensureLegalConsent()) return;
    setIsSubmitting(true);
    setErrorMessage('');
    setStatusMessage('');
    try {
      const res = await loginWithFirebaseGoogle();
      setIsSubmitting(false);
      if (res.redirectPending) {
        setStatusMessage('Opening Google Sign-In...');
        return;
      }
      if (!res.success) {
        setErrorMessage(formatFirebaseAuthError(res.error));
      }
    } catch (err: any) {
      setIsSubmitting(false);
      setErrorMessage(formatFirebaseAuthError(err?.message));
    }
  };

  // Enter Step 1 of Email Sign-Up: Enter Email -> Send OTP
  const handleStartEmailRegistration = () => {
    if (!ensureLegalConsent()) return;
    setErrorMessage('');
    setStatusMessage('');
    setOtpInput('');
    setOtpChallengeToken('');
    setRegistrationTicket('');
    setPassword('');
    setConfirmPassword('');
    setStep('enter_email');
  };

  // Step 1 Submit: Send 6-Digit OTP to Email
  const handleSendPreSignupOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!ensureLegalConsent()) return;

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMessage('Please enter a valid email address (e.g. you@gmail.com).');
      return;
    }

    setSendingOtp(true);
    setErrorMessage('');
    setStatusMessage('');
    try {
      const otpRes = await sendPreSignupEmailOtp(cleanEmail);
      if (!otpRes.success || !otpRes.challengeToken) {
        if (otpRes.retryAfterSeconds) {
          setOtpCooldownSec(otpRes.retryAfterSeconds);
        }
        setErrorMessage(
          otpRes.error || 'Could not send 6-digit verification code right now. Please try again.'
        );
        return;
      }

      setOtpChallengeToken(otpRes.challengeToken);
      setOtpMaskedEmail(otpRes.emailMasked || cleanEmail);
      setOtpCooldownSec(otpRes.cooldownSeconds || 60);
      setOtpInput('');
      setStatusMessage(
        `6-digit OTP sent from no-reply@alphamate.app to ${otpRes.emailMasked || cleanEmail}.`
      );
      setStep('verify_otp');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Unable to send OTP right now. Please try again.');
    } finally {
      setSendingOtp(false);
    }
  };

  // Step 2 Submit: Verify 6-Digit OTP -> Advance to Step 3 (Create Password)
  const handleVerifyPreSignupOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ensureLegalConsent()) return;

    const cleanOtp = otpInput.replace(/\D/g, '').slice(0, 6);
    if (cleanOtp.length !== 6) {
      setErrorMessage('Please enter the 6-digit OTP code sent to your email.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    setStatusMessage('');
    try {
      const res = await verifyPreSignupEmailOtp(email.trim().toLowerCase(), otpChallengeToken, cleanOtp);
      setIsSubmitting(false);
      if (!res.success || !res.registrationTicket) {
        setErrorMessage(res.error || 'Incorrect or expired OTP code. Please try again.');
        return;
      }
      setRegistrationTicket(res.registrationTicket);
      setStatusMessage('Email verified! Now create and save your account password.');
      setStep('create_password');
    } catch (err: any) {
      setIsSubmitting(false);
      setErrorMessage(err?.message || 'Unable to verify OTP right now.');
    }
  };

  // Step 3 Submit: Save Password -> Enter App (where In-App Profile Registration Window opens)
  const handleSavePasswordAndEnter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ensureLegalConsent()) return;

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Password and Confirm Password do not match.');
      return;
    }
    if (!registrationTicket) {
      setErrorMessage('Your OTP session expired. Please verify your email OTP again.');
      setStep('enter_email');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    setStatusMessage('');
    try {
      const res = await completePreSignupPassword(
        email.trim().toLowerCase(),
        password,
        registrationTicket
      );
      setIsSubmitting(false);
      if (!res.success) {
        setErrorMessage(formatFirebaseAuthError(res.error));
      }
    } catch (err: any) {
      setIsSubmitting(false);
      setErrorMessage(formatFirebaseAuthError(err?.message));
    }
  };

  // Legacy fallback for an already-created unverified Firebase user
  const handleLegacySendOtp = async () => {
    setSendingOtp(true);
    setErrorMessage('');
    setStatusMessage('');
    try {
      const otpRes = await sendSignupEmailOtp();
      if (otpRes.alreadyVerified) return;
      if (!otpRes.success || !otpRes.challengeToken) {
        if (otpRes.retryAfterSeconds) setOtpCooldownSec(otpRes.retryAfterSeconds);
        setErrorMessage(otpRes.error || 'Could not send 6-digit OTP right now.');
        return;
      }
      setOtpChallengeToken(otpRes.challengeToken);
      setOtpMaskedEmail(otpRes.emailMasked || email || firebaseUser?.email || '');
      setOtpCooldownSec(otpRes.cooldownSeconds || 60);
      setOtpInput('');
      setStatusMessage(
        `6-digit OTP sent from no-reply@alphamate.app to ${otpRes.emailMasked || firebaseUser?.email}.`
      );
    } finally {
      setSendingOtp(false);
    }
  };

  const handleLegacyVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOtp = otpInput.replace(/\D/g, '').slice(0, 6);
    if (cleanOtp.length !== 6 || !otpChallengeToken) {
      setErrorMessage('Please enter the 6-digit verification code.');
      return;
    }
    setIsSubmitting(true);
    setErrorMessage('');
    const res = await verifySignupEmailOtp(otpChallengeToken, cleanOtp);
    setIsSubmitting(false);
    if (!res.success) {
      setErrorMessage(res.error || 'Invalid or expired OTP code.');
    }
  };

  const handleQuickSwitchSaved = async (uid: string) => {
    setErrorMessage('');
    setSwitchingUid(uid);
    try {
      const res = await switchAccount(uid);
      if (!res.success && res.error) {
        setErrorMessage(res.error);
      }
    } finally {
      setSwitchingUid(null);
    }
  };

  const handleBackNavigation = async () => {
    setErrorMessage('');
    setStatusMessage('');
    if (step === 'create_password') {
      setStep('enter_email');
      return;
    }
    if (step === 'verify_otp') {
      setStep('enter_email');
      return;
    }
    if (step === 'enter_email' || step === 'legacy_verify_email') {
      setStep('select_method');
      return;
    }
    if (isAddingAccount) {
      await cancelAddAccountFlow();
      return;
    }
    setCurrentScreen('welcome');
  };

  return (
    <div className="relative w-full h-full min-h-[660px] flex flex-col justify-between p-5 overflow-y-auto scrollbar-none bg-[#09070F] select-none text-white">
      {/* Background ambient lighting */}
      <div className="absolute -top-16 -right-16 w-80 h-80 rounded-full bg-[#7928CA]/30 blur-[90px] pointer-events-none" />
      <div className="absolute bottom-1/4 -left-20 w-80 h-80 rounded-full bg-[#EC4899]/20 blur-[100px] pointer-events-none" />

      {/* Top Header */}
      <div className="relative z-10 flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={handleBackNavigation}
          className="w-11 h-11 rounded-full bg-[#18102C] border border-[#A855F7]/30 flex items-center justify-center text-zinc-300 hover:text-white hover:border-[#A855F7] transition cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-1.5">
          <AlphaMateLogo size="sm" showText={false} customLogoUrl={customLogoUrl} />
          <span className="text-xs font-black tracking-wider text-purple-200">ALPHA MATE</span>
        </div>

        <button
          type="button"
          onClick={() => setShowPlatformRegistrationModal(true)}
          className="min-h-[44px] px-2.5 rounded-xl bg-[#7928CA]/25 border border-[#A855F7]/40 text-[#D8B4FE] text-[10px] font-bold flex items-center gap-1 hover:brightness-110 cursor-pointer"
          title="Firebase App Registration Info"
        >
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Firebase</span>
        </button>
      </div>

      {/* Multi-Account Banner when adding a 2nd–5th account */}
      {isAddingAccount && (
        <div className="relative z-10 mt-3 max-w-sm w-full mx-auto p-3 rounded-2xl bg-[#1A1033] border border-[#EC4899]/40 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Users className="w-4 h-4 text-[#EC4899] shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-bold text-white truncate">
                Add Account ({savedAccounts.length + 1}/{maxSavedAccounts})
              </p>
              <p className="text-[10px] text-zinc-400 truncate">
                Sign up once — switch anytime with zero password
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => cancelAddAccountFlow()}
            className="min-h-[40px] px-3 rounded-xl bg-white/10 hover:bg-white/15 text-[11px] font-bold text-purple-200 shrink-0 cursor-pointer"
          >
            Back to App
          </button>
        </div>
      )}

      {/* STEP 0: SELECT SIGN-UP METHOD (Google Gmail or 3-Step Email OTP) */}
      {step === 'select_method' && (
        <div className="relative z-10 py-4 max-w-sm w-full mx-auto my-auto">
          <div className="text-center mb-5">
            <p className="text-[11px] font-bold text-[#C084FC] tracking-widest uppercase">
              {isAddingAccount ? 'ADD NEW ACCOUNT' : 'CREATE ACCOUNT'}
            </p>
            <h1 className="text-2xl font-black text-white tracking-tight mt-1.5">
              Join Alpha Mate
            </h1>
            <p className="mt-1 text-xs text-zinc-400">
              Sign up with Gmail or verify your Email OTP &amp; Password to create your permanent ID
            </p>
          </div>

          {errorMessage && (
            <div className="mb-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {statusMessage && (
            <div className="mb-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{statusMessage}</span>
            </div>
          )}

          <div className="flex flex-col gap-3">
            {/* 1. Continue with Google (Gmail) */}
            <button
              type="button"
              onClick={handleDirectGoogleSignIn}
              disabled={isSubmitting}
              className="group relative w-full min-h-[56px] rounded-2xl bg-gradient-to-r from-[#231542] to-[#1A1033] hover:from-[#2B1952] hover:to-[#221542] border-2 border-[#A855F7]/60 hover:border-[#EC4899] px-4 flex items-center justify-between transition-all shadow-lg shadow-[#7928CA]/25 active:scale-[0.98] cursor-pointer disabled:opacity-60"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shadow-md shrink-0">
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.15z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.17 0 9.99 0 12s.45 3.83 1.25 5.42l4.03-3.15z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                    />
                  </svg>
                </div>
                <div className="text-left">
                  <span className="text-xs sm:text-sm font-bold text-white block">
                    {isSubmitting ? 'Connecting Gmail...' : 'Continue with Google (Gmail)'}
                  </span>
                  <span className="text-[10px] text-[#E9D5FF]">
                    Instant verified Gmail ID + In-App Registration
                  </span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-purple-300 group-hover:translate-x-1 transition-transform" />
            </button>

            {/* 2. Sign Up with Email (Email -> 6-Digit OTP -> Password -> In-App Registration) */}
            <button
              type="button"
              onClick={handleStartEmailRegistration}
              disabled={isSubmitting}
              className="w-full min-h-[52px] rounded-2xl bg-[#140D26] hover:bg-[#1E1338] border border-white/10 hover:border-purple-400/50 flex items-center justify-between px-4 transition-all active:scale-[0.98] cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#7928CA] to-[#A855F7] flex items-center justify-center text-white shrink-0">
                  <Mail className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <span className="text-xs sm:text-sm font-bold text-white block">
                    Sign Up with Email
                  </span>
                  <span className="text-[10px] text-zinc-400">
                    1. Email &rarr; 2. 6-Digit OTP &rarr; 3. Save Password
                  </span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-500" />
            </button>

            {/* 3. Continue with Apple (Coming Soon) */}
            <button
              type="button"
              onClick={() => setShowAppleComingSoon(true)}
              className="w-full min-h-[48px] rounded-2xl bg-black/60 border border-zinc-800 flex items-center justify-between px-4 opacity-75 hover:opacity-100 transition-all cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-black flex items-center justify-center border border-zinc-700 text-white shrink-0">
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 170 170">
                    <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.69-3.08-7.73-7.98-12.14-14.71-6.19-9.52-11.02-20.53-14.49-33.02-3.48-12.49-5.22-24.16-5.22-35.03 0-14.78 3.73-27.18 11.19-37.21 7.46-10.03 16.94-15.17 28.45-15.42 4.93 0 10.37 1.25 16.32 3.76 5.96 2.51 9.77 3.82 11.44 3.93 1.34 0 5.42-1.42 12.24-4.25 6.83-2.84 12.65-4.14 17.47-3.9 12.98.78 23.3 5.34 30.98 13.68-11.48 6.94-17.07 16.38-16.77 28.32.33 9.4 3.82 17.15 10.47 23.26 6.64 6.11 14.51 9.69 23.6 10.74-2.24 6.94-5.01 14.03-8.33 21.28zM119.22 33.15c0-7.27 2.65-14.07 7.95-20.41 5.3-6.34 11.96-10.42 19.98-12.24.11 1.01.17 1.8.17 2.37 0 7.15-2.82 14.15-8.46 21-5.63 6.85-12.42 10.87-20.37 12.06-.33-1.01-.52-1.93-.57-2.78z" />
                  </svg>
                </div>
                <div className="text-left">
                  <span className="text-xs sm:text-sm font-bold text-zinc-300 block">
                    Continue with Apple
                  </span>
                  <span className="text-[10px] text-zinc-500">Apple ID authentication</span>
                </div>
              </div>
              <span className="text-[10px] font-bold text-amber-300">Coming Soon</span>
            </button>
          </div>

          {/* Mandatory Legal Consent Checkboxes */}
          <div className="mt-4">
            <LegalConsentCheckboxes
              agreedToTerms={agreedToTerms}
              onToggleTerms={setAgreedToTerms}
              agreedToPrivacy={agreedToPrivacy}
              onTogglePrivacy={setAgreedToPrivacy}
              hasError={consentError}
            />
          </div>

          {/* 1-Tap Instant Switch Strip for Saved Accounts on This Device */}
          {savedAccounts.length > 0 && (
            <div className="mt-4 p-3 rounded-2xl bg-[#140D27] border border-[#A855F7]/25">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-300">
                  Saved Accounts on Device ({savedAccounts.length}/{maxSavedAccounts})
                </span>
                <span className="text-[10px] text-emerald-400 font-semibold">1-Tap Instant</span>
              </div>
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {savedAccounts.map((acc) => (
                  <button
                    key={acc.uid}
                    type="button"
                    onClick={() => handleQuickSwitchSaved(acc.uid)}
                    disabled={Boolean(switchingUid)}
                    className="min-h-[44px] px-2.5 py-1.5 rounded-xl bg-[#1F143A] hover:bg-[#291B4C] border border-white/10 flex items-center gap-2 shrink-0 cursor-pointer"
                  >
                    <img
                      src={
                        acc.avatar ||
                        'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80'
                      }
                      alt={acc.displayName}
                      referrerPolicy="no-referrer"
                      className="w-7 h-7 rounded-full object-cover"
                    />
                    <div className="text-left">
                      <span className="text-[11px] font-bold text-white block leading-tight max-w-[96px] truncate">
                        {acc.displayName}
                      </span>
                      <span className="text-[9px] text-zinc-400 block leading-tight">
                        {switchingUid === acc.uid ? 'Switching...' : `@${acc.username}`}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* STEP 1 OF EMAIL SIGN-UP: ENTER EMAIL -> SEND 6-DIGIT OTP */}
      {step === 'enter_email' && (
        <div className="relative z-10 py-4 max-w-sm w-full mx-auto my-auto">
          <div className="text-center mb-5">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-[#7928CA] to-[#EC4899] flex items-center justify-center shadow-lg shadow-[#7928CA]/35 mb-3">
              <Mail className="w-7 h-7 text-white" />
            </div>
            <p className="text-[11px] font-bold text-[#C084FC] uppercase tracking-wider">
              Step 1 of 3 &bull; Email Verification
            </p>
            <h2 className="text-xl font-black text-white mt-1">Enter Your Email</h2>
            <p className="text-xs text-zinc-400 mt-1">
              We will send a 6-digit OTP to verify your email before you set your password
            </p>
          </div>

          {errorMessage && (
            <div className="mb-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSendPreSignupOtp} className="space-y-3.5">
            <div>
              <label
                htmlFor="pre-signup-email"
                className="text-[11px] uppercase font-bold text-purple-300 tracking-wider block mb-1.5"
              >
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  id="pre-signup-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full min-h-[48px] pl-10 pr-3.5 rounded-2xl bg-[#140D27] border border-[#A855F7]/40 text-white placeholder-zinc-500 text-sm focus:border-[#EC4899] focus:outline-none"
                />
              </div>
            </div>

            {(!agreedToTerms || !agreedToPrivacy) && (
              <LegalConsentCheckboxes
                agreedToTerms={agreedToTerms}
                onToggleTerms={setAgreedToTerms}
                agreedToPrivacy={agreedToPrivacy}
                onTogglePrivacy={setAgreedToPrivacy}
                hasError={consentError}
              />
            )}

            <button
              type="submit"
              disabled={sendingOtp || otpCooldownSec > 0}
              className="w-full min-h-[48px] rounded-2xl bg-gradient-to-r from-[#7928CA] via-[#9333EA] to-[#EC4899] font-extrabold text-white text-sm shadow-lg shadow-[#7928CA]/40 hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {sendingOtp ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Sending 6-Digit OTP...</span>
                </>
              ) : otpCooldownSec > 0 ? (
                <span>Please wait {otpCooldownSec}s</span>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Send 6-Digit OTP to Email</span>
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* STEP 2 OF EMAIL SIGN-UP: ENTER & VERIFY 6-DIGIT OTP */}
      {step === 'verify_otp' && (
        <div className="relative z-10 py-4 max-w-sm w-full mx-auto my-auto text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-[#7928CA] to-[#EC4899] flex items-center justify-center shadow-lg shadow-[#A855F7]/30 mb-3">
            <KeyRound className="w-7 h-7 text-white" />
          </div>
          <p className="text-[11px] font-bold text-[#C084FC] uppercase tracking-wider">
            Step 2 of 3 &bull; Verify OTP
          </p>
          <h2 className="text-xl font-black text-white mt-1">Enter 6-Digit Code</h2>
          <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
            Enter the 6-digit verification code sent from{' '}
            <span className="text-purple-200 font-semibold">no-reply@alphamate.app</span> to{' '}
            <span className="text-white font-semibold">{otpMaskedEmail || email}</span>
          </p>

          {errorMessage && (
            <div className="mt-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2 text-left">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {statusMessage && (
            <div className="mt-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2 text-left">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{statusMessage}</span>
            </div>
          )}

          <form onSubmit={handleVerifyPreSignupOtp} className="mt-4 space-y-3">
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={otpInput}
              onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className="w-full min-h-[52px] px-4 rounded-2xl bg-[#140D27] border border-[#A855F7]/50 text-center font-mono text-xl font-black tracking-[0.45em] text-white placeholder-zinc-600 focus:border-[#EC4899] focus:outline-none"
            />

            <button
              type="submit"
              disabled={isSubmitting || otpInput.length !== 6}
              className="w-full min-h-[48px] rounded-2xl bg-gradient-to-r from-[#7928CA] via-[#9333EA] to-[#EC4899] font-extrabold text-white text-sm shadow-lg shadow-[#7928CA]/40 hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying OTP...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Verify OTP &amp; Continue</span>
                </>
              )}
            </button>

            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setStep('enter_email');
                  setErrorMessage('');
                }}
                className="min-h-[44px] px-3 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-zinc-300 cursor-pointer"
              >
                Change Email
              </button>

              <button
                type="button"
                onClick={() => handleSendPreSignupOtp()}
                disabled={sendingOtp || isSubmitting || otpCooldownSec > 0}
                className="min-h-[44px] px-3.5 rounded-xl bg-[#17102B] hover:bg-[#21173D] border border-[#A855F7]/30 text-xs font-bold text-[#D8B4FE] disabled:opacity-50 cursor-pointer"
              >
                {sendingOtp
                  ? 'Sending...'
                  : otpCooldownSec > 0
                  ? `Resend OTP (${otpCooldownSec}s)`
                  : 'Resend 6-Digit OTP'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* STEP 3 OF EMAIL SIGN-UP: CREATE & SAVE PASSWORD -> ENTER APP */}
      {step === 'create_password' && (
        <div className="relative z-10 py-4 max-w-sm w-full mx-auto my-auto">
          <div className="text-center mb-5">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-[#7928CA] to-[#EC4899] flex items-center justify-center shadow-lg shadow-[#7928CA]/35 mb-3">
              <Lock className="w-7 h-7 text-white" />
            </div>
            <p className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
              Step 3 of 3 &bull; Email Verified
            </p>
            <h2 className="text-xl font-black text-white mt-1">Create Your Password</h2>
            <p className="text-xs text-zinc-400 mt-1">
              Save your password for <span className="text-white font-semibold">{email}</span>. Next, your profile registration window will open inside the app.
            </p>
          </div>

          {errorMessage && (
            <div className="mb-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSavePasswordAndEnter} className="space-y-3.5">
            <div>
              <label className="text-[11px] uppercase font-bold text-purple-300 tracking-wider block mb-1.5">
                Create Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Minimum 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full min-h-[48px] pl-10 pr-11 rounded-2xl bg-[#140D27] border border-[#A855F7]/40 text-white placeholder-zinc-500 text-sm focus:border-[#EC4899] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-[11px] uppercase font-bold text-purple-300 tracking-wider block mb-1.5">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full min-h-[48px] pl-10 pr-3.5 rounded-2xl bg-[#140D27] border border-[#A855F7]/40 text-white placeholder-zinc-500 text-sm focus:border-[#EC4899] focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full min-h-[48px] rounded-2xl bg-gradient-to-r from-[#7928CA] via-[#9333EA] to-[#EC4899] font-extrabold text-white text-sm shadow-lg shadow-[#7928CA]/40 hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving Password &amp; Entering...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Save Password &amp; Enter App</span>
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* LEGACY UNVERIFIED SESSION FALLBACK */}
      {step === 'legacy_verify_email' && (
        <div className="relative z-10 py-4 max-w-sm w-full mx-auto my-auto text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-[#7928CA] to-[#EC4899] flex items-center justify-center shadow-lg shadow-[#A855F7]/30 mb-3">
            <Mail className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-xl font-black text-white">Verify Your Email</h2>
          <p className="text-xs text-zinc-400 mt-1.5">
            Verify <span className="text-white font-semibold">{otpMaskedEmail || firebaseUser?.email}</span> with a 6-digit OTP to enter Alpha Mate.
          </p>

          {errorMessage && (
            <div className="mt-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2 text-left">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {statusMessage && (
            <div className="mt-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2 text-left">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{statusMessage}</span>
            </div>
          )}

          <form onSubmit={handleLegacyVerifyOtp} className="mt-4 space-y-3">
            {otpChallengeToken && (
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="w-full min-h-[52px] px-4 rounded-2xl bg-[#140D27] border border-[#A855F7]/50 text-center font-mono text-xl font-black tracking-[0.45em] text-white"
              />
            )}
            {otpChallengeToken && (
              <button
                type="submit"
                disabled={isSubmitting || otpInput.length !== 6}
                className="w-full min-h-[48px] rounded-2xl bg-gradient-to-r from-[#7928CA] to-[#EC4899] font-extrabold text-white text-sm cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? 'Verifying...' : 'Verify OTP & Enter App'}
              </button>
            )}
            <button
              type="button"
              onClick={handleLegacySendOtp}
              disabled={sendingOtp || otpCooldownSec > 0}
              className="w-full min-h-[44px] rounded-xl bg-[#17102B] border border-[#A855F7]/30 text-xs font-bold text-[#D8B4FE] cursor-pointer disabled:opacity-50"
            >
              {sendingOtp
                ? 'Sending OTP...'
                : otpCooldownSec > 0
                ? `Resend OTP in ${otpCooldownSec}s`
                : otpChallengeToken
                ? 'Resend 6-Digit OTP'
                : 'Send 6-Digit Email OTP'}
            </button>
          </form>
        </div>
      )}

      {/* Footer Switch to Sign In */}
      <div className="relative z-10 pt-2 pb-2 text-center">
        <span className="text-xs text-zinc-400">
          Already registered?{' '}
          <button
            type="button"
            onClick={() => setCurrentScreen('signin')}
            className="min-h-[44px] px-2 text-[#C084FC] font-bold hover:underline cursor-pointer"
          >
            Sign In
          </button>
        </span>
      </div>

      {/* Apple Coming Soon Modal */}
      {showAppleComingSoon && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-xs rounded-2xl bg-[#17102D] border border-amber-400/40 p-5 text-center shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-black border border-zinc-700 flex items-center justify-center mx-auto mb-3 text-white">
              <Clock className="w-6 h-6 text-amber-400" />
            </div>
            <h3 className="text-base font-bold text-white">Apple Sign-In</h3>
            <p className="text-xs text-zinc-400 mt-1 mb-4 leading-relaxed">
              Continue with Apple will be available in an upcoming release. Please use{' '}
              <strong className="text-white">Continue with Google</strong> or{' '}
              <strong className="text-white">Sign Up with Email</strong>.
            </p>
            <button
              type="button"
              onClick={() => setShowAppleComingSoon(false)}
              className="w-full min-h-[44px] rounded-xl bg-gradient-to-r from-[#7928CA] to-[#9333EA] text-white text-xs font-bold cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* Firebase Platform Registration Modal */}
      {showPlatformRegistrationModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-sm rounded-3xl bg-[#150D2B] border border-[#A855F7]/40 p-5 shadow-2xl text-left">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-black text-white">Firebase Project Connected</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPlatformRegistrationModal(false)}
                className="w-9 h-9 rounded-full bg-white/10 text-zinc-300 hover:text-white flex items-center justify-center text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="p-2.5 rounded-xl bg-[#0D061A] border border-white/5">
                <span className="text-[10px] text-zinc-400 uppercase font-bold block">
                  Firebase Project ID
                </span>
                <span className="font-mono text-purple-300 font-bold select-all">
                  gen-lang-client-0468444352
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-[#0D061A] border border-emerald-500/20">
                <span className="font-bold text-emerald-300 block mb-1">
                  Android Package: com.alphamate.live
                </span>
                <p className="text-[10px] text-zinc-400">
                  Unified Google + Email OTP + Password + 5-Account instant device switcher active.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowPlatformRegistrationModal(false)}
              className="mt-4 w-full min-h-[44px] rounded-xl bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white text-xs font-bold cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
