import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { AlphaMateLogo } from '../components/brand/AlphaMateLogo';
import {
  Mail,
  Lock,
  User as UserIcon,
  Check,
  ArrowLeft,
  Calendar,
  Sparkles,
  Eye,
  EyeOff,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  ChevronRight,
} from 'lucide-react';

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=400&q=80',
];

export const RegisterScreen: React.FC = () => {
  const {
    setCurrentScreen,
    customLogoUrl,
    isAuthenticated,
    firebaseUser,
    firebaseAuthLoading,
    isEmailVerified,
    updateUserProfile,
    loginWithFirebaseGoogle,
    registerWithFirebaseEmail,
    refreshFirebaseVerification,
    resendEmailVerificationLink,
  } = useApp();

  // Registration step: 'select_method' | 'profile_details' | 'verify_email'
  const [step, setStep] = useState<'select_method' | 'profile_details' | 'verify_email'>('select_method');

  // Auto-redirect only when a real, verified Firebase Auth session is active
  React.useEffect(() => {
    if (!firebaseAuthLoading && isAuthenticated && firebaseUser && isEmailVerified) {
      setCurrentScreen('home');
    } else if (!firebaseAuthLoading && firebaseUser && !isEmailVerified) {
      setEmail(firebaseUser.email || '');
      setStep('verify_email');
    }
  }, [firebaseAuthLoading, isAuthenticated, firebaseUser, isEmailVerified, setCurrentScreen]);

  // Form fields
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [dob, setDob] = useState('2001-08-14');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState(PRESET_AVATARS[0]);
  const [agreedToTerms, setAgreedToTerms] = useState(true);

  // Status & validation
  const [errorMessage, setErrorMessage] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAppleComingSoon, setShowAppleComingSoon] = useState(false);
  const [showPlatformRegistrationModal, setShowPlatformRegistrationModal] = useState(false);

  const formatFirebaseAuthError = (raw?: string) => {
    const msg = raw || '';
    if (msg.includes('popup-closed-by-user')) {
      return 'Google sign-in was closed before finishing. Tap Continue with Google to try again.';
    }
    if (msg.includes('operation-not-allowed')) {
      return 'Email/Password sign-up is not enabled on this server. Please tap Continue with Google (Gmail) for instant account creation.';
    }
    if (msg.includes('email-already-in-use')) {
      return 'An account with this email already exists. Please tap Sign In below or Continue with Google.';
    }
    if (msg.includes('weak-password')) {
      return 'Password is too weak. Please choose at least 6 characters.';
    }
    if (msg.includes('invalid-email')) {
      return 'Please enter a valid email address.';
    }
    return msg || 'Sign-in could not complete. Please try again.';
  };

  // Handle Direct Firebase Google (Gmail) Sign-In & Account Creation
  const handleDirectGoogleSignIn = async () => {
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

  // Handle switching to Email Registration
  const handleStartEmailRegistration = () => {
    setErrorMessage('');
    setStatusMessage('');
    setEmail('');
    setDisplayName('');
    setUsername('');
    setStep('profile_details');
  };

  // Final Registration Submission
  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!displayName.trim()) {
      setErrorMessage('Please enter your full name');
      return;
    }

    if (!username.trim()) {
      setErrorMessage('Please enter a username');
      return;
    }

    if (username.length < 3) {
      setErrorMessage('Username must be at least 3 characters');
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Please enter a valid email address');
      return;
    }

    if (!dob) {
      setErrorMessage('Please provide your Date of Birth');
      return;
    }

    // Check age minimum 18
    const birthYear = new Date(dob).getFullYear();
    const currentYear = new Date().getFullYear();
    if (currentYear - birthYear < 18) {
      setErrorMessage('You must be at least 18 years old to join Alpha Mate.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match');
      return;
    }

    if (!agreedToTerms) {
      setErrorMessage('You must accept the Terms of Service & Privacy Policy');
      return;
    }

    setIsSubmitting(true);

    const fbRes = await registerWithFirebaseEmail({
      email: email.trim().toLowerCase(),
      pass: password,
      displayName: displayName.trim(),
      username: username.trim(),
    });
    setIsSubmitting(false);

    if (!fbRes.success) {
      setErrorMessage(formatFirebaseAuthError(fbRes.error));
      return;
    }

    updateUserProfile({ dob, avatar: selectedAvatar });

    if (fbRes.needsVerification) {
      setStatusMessage(`Verification link sent to ${email.trim().toLowerCase()}. Please verify to enter.`);
      setStep('verify_email');
    }
  };

  const handleCheckEmailVerified = async () => {
    setIsSubmitting(true);
    setErrorMessage('');
    setStatusMessage('');
    try {
      const verified = await refreshFirebaseVerification();
      setIsSubmitting(false);
      if (!verified) {
        setErrorMessage('Email is not verified yet. Please click the verification link in your inbox, then tap again.');
      }
    } catch (err: any) {
      setIsSubmitting(false);
      setErrorMessage(err?.message || 'Unable to verify status right now.');
    }
  };

  const handleResendVerification = async () => {
    setIsSubmitting(true);
    setErrorMessage('');
    try {
      await resendEmailVerificationLink();
      setStatusMessage(`Verification email resent to ${email || firebaseUser?.email}. Check Inbox or Spam.`);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Please wait a moment before resending.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative w-full h-full min-h-[660px] flex flex-col justify-between p-5 overflow-y-auto scrollbar-none bg-[#09070F] select-none text-white">
      {/* Background ambient lighting */}
      <div className="absolute -top-16 -right-16 w-80 h-80 rounded-full bg-[#7928CA]/30 blur-[90px] pointer-events-none" />
      <div className="absolute bottom-1/4 -left-20 w-80 h-80 rounded-full bg-[#EC4899]/20 blur-[100px] pointer-events-none" />

      {/* Top Header */}
      <div className="relative z-10 flex items-center justify-between pt-1">
        <button
          onClick={() => {
            if (step === 'profile_details' || step === 'verify_email') {
              setStep('select_method');
              setErrorMessage('');
              setStatusMessage('');
            } else {
              setCurrentScreen('welcome');
            }
          }}
          className="w-10 h-10 rounded-full bg-[#18102C] border border-[#A855F7]/30 flex items-center justify-center text-zinc-300 hover:text-white hover:border-[#A855F7] transition cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-1.5">
          <AlphaMateLogo size="sm" showText={false} customLogoUrl={customLogoUrl} />
          <span className="text-xs font-black tracking-wider text-purple-200">ALPHA MATE</span>
        </div>

        {/* Platform Registration Info button */}
        <button
          type="button"
          onClick={() => setShowPlatformRegistrationModal(true)}
          className="px-2 py-1 rounded-full bg-[#7928CA]/30 border border-[#A855F7]/40 text-[#D8B4FE] text-[10px] font-bold flex items-center gap-1 hover:brightness-110 cursor-pointer"
          title="Firebase Apple & Android App Registration Info"
        >
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Firebase</span>
        </button>
      </div>

      {/* STEP 1: SELECT METHOD (Google Gmail, Email, Apple) */}
      {step === 'select_method' && (
        <div className="relative z-10 py-4 max-w-sm w-full mx-auto my-auto">
          <div className="text-center mb-6">
            <span className="px-3 py-1 rounded-full bg-[#7928CA]/25 border border-[#A855F7]/40 text-[10px] font-bold text-[#E9D5FF] tracking-widest uppercase">
              CREATE ACCOUNT
            </span>
            <h1 className="text-2xl font-black text-white tracking-tight mt-2.5">
              Continue with Email
            </h1>
            <p className="mt-1 text-xs text-zinc-400">
              Sign up with your Gmail or Email to verify and enter Alpha Mate directly on future visits
            </p>
          </div>

          {errorMessage && (
            <div className="mb-3 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {statusMessage && (
            <div className="mb-3 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{statusMessage}</span>
            </div>
          )}

          <div className="flex flex-col gap-3">
            {/* 1. Continue with Google / Gmail (Instant Verified Account) */}
            <button
              onClick={handleDirectGoogleSignIn}
              disabled={isSubmitting}
              className="group relative w-full h-14 rounded-2xl bg-gradient-to-r from-[#231542] to-[#1A1033] hover:from-[#2B1952] hover:to-[#221542] border-2 border-[#A855F7]/60 hover:border-[#EC4899] p-1 flex items-center justify-between px-4 transition-all shadow-lg shadow-[#7928CA]/25 active:scale-[0.98] cursor-pointer disabled:opacity-60"
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
                    Instant verified account • Recommended
                  </span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-purple-300 group-hover:translate-x-1 transition-transform" />
            </button>

            {/* 2. Register with Email */}
            <button
              onClick={handleStartEmailRegistration}
              disabled={isSubmitting}
              className="w-full h-12 rounded-2xl bg-[#140D26] hover:bg-[#1E1338] border border-white/10 hover:border-purple-400/50 flex items-center justify-between px-4 transition-all active:scale-[0.98] cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#7928CA] to-[#A855F7] flex items-center justify-center text-white shrink-0">
                  <Mail className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <span className="text-xs sm:text-sm font-bold text-white block">Continue with Email</span>
                  <span className="text-[10px] text-zinc-400">Create password & verify inbox</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-500" />
            </button>

            {/* 3. Continue with Apple (Marked Coming Soon) */}
            <div className="relative">
              <button
                onClick={() => setShowAppleComingSoon(true)}
                className="w-full h-12 rounded-2xl bg-black/60 border border-zinc-800 flex items-center justify-between px-4 opacity-75 hover:opacity-100 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-black flex items-center justify-center border border-zinc-700 text-white shrink-0">
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 170 170">
                      <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.69-3.08-7.73-7.98-12.14-14.71-6.19-9.52-11.02-20.53-14.49-33.02-3.48-12.49-5.22-24.16-5.22-35.03 0-14.78 3.73-27.18 11.19-37.21 7.46-10.03 16.94-15.17 28.45-15.42 4.93 0 10.37 1.25 16.32 3.76 5.96 2.51 9.77 3.82 11.44 3.93 1.34 0 5.42-1.42 12.24-4.25 6.83-2.84 12.65-4.14 17.47-3.9 12.98.78 23.3 5.34 30.98 13.68-11.48 6.94-17.07 16.38-16.77 28.32.33 9.4 3.82 17.15 10.47 23.26 6.64 6.11 14.51 9.69 23.6 10.74-2.24 6.94-5.01 14.03-8.33 21.28zM119.22 33.15c0-7.27 2.65-14.07 7.95-20.41 5.3-6.34 11.96-10.42 19.98-12.24.11 1.01.17 1.8.17 2.37 0 7.15-2.82 14.15-8.46 21-5.63 6.85-12.42 10.87-20.37 12.06-.33-1.01-.52-1.93-.57-2.78z" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <span className="text-xs sm:text-sm font-bold text-zinc-300 block">Continue with Apple</span>
                    <span className="text-[10px] text-zinc-500">Apple ID authentication</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-[9px] font-bold text-amber-300">
                  Coming Soon
                </span>
              </button>
            </div>
          </div>

          {/* Security & Benefits Badge */}
          <div className="mt-6 p-3 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
            <p className="text-[11px] text-zinc-400 leading-snug">
              Once verified, this device stays signed in so you enter Alpha Mate directly every time until you log out.
            </p>
          </div>
        </div>
      )}

      {/* VERIFY EMAIL STEP (for Email & Password registrations) */}
      {step === 'verify_email' && (
        <div className="relative z-10 py-4 max-w-sm w-full mx-auto my-auto animate-scale-up text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-[#7928CA] to-[#EC4899] flex items-center justify-center shadow-lg shadow-[#A855F7]/30 mb-4">
            <Mail className="w-7 h-7 text-white" />
          </div>
          <span className="px-3 py-1 rounded-full bg-[#7928CA]/30 border border-[#A855F7]/40 text-[10px] font-bold text-[#E9D5FF] tracking-widest uppercase">
            VERIFY YOUR EMAIL
          </span>
          <h2 className="text-xl font-black text-white mt-2">Check Your Inbox</h2>
          <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
            We sent a verification link to{' '}
            <span className="text-white font-semibold">{email || firebaseUser?.email}</span>. Open the email, click the link, then tap below to enter Alpha Mate.
          </p>

          {errorMessage && (
            <div className="mt-4 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2 text-left">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {statusMessage && (
            <div className="mt-4 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2 text-left">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{statusMessage}</span>
            </div>
          )}

          <div className="mt-5 space-y-2.5">
            <button
              onClick={handleCheckEmailVerified}
              disabled={isSubmitting}
              className="w-full h-12 rounded-2xl bg-gradient-to-r from-[#7928CA] via-[#9333EA] to-[#EC4899] font-extrabold text-white text-xs sm:text-sm shadow-lg shadow-[#7928CA]/40 hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'Checking...' : "I've Verified — Enter App"}</span>
            </button>

            <button
              onClick={handleResendVerification}
              disabled={isSubmitting}
              className="w-full h-11 rounded-xl bg-[#17102B] hover:bg-[#21173D] border border-[#A855F7]/30 text-xs font-bold text-[#D8B4FE] cursor-pointer"
            >
              Resend Verification Link
            </button>

            <button
              onClick={handleDirectGoogleSignIn}
              disabled={isSubmitting}
              className="w-full h-11 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-zinc-200 cursor-pointer"
            >
              Or Continue with Google (Gmail) Instead
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: EMAIL ACCOUNT DETAILS */}
      {step === 'profile_details' && (
        <div className="relative z-10 py-2 max-w-sm w-full mx-auto">
          <div className="text-center mb-3">
            <span className="px-3 py-0.5 rounded-full bg-[#7928CA]/30 border border-[#A855F7]/40 text-[9px] font-bold text-[#E9D5FF] tracking-widest uppercase">
              CREATE ACCOUNT WITH EMAIL
            </span>
            <h2 className="text-xl font-black text-white mt-1">Set Up Your Profile</h2>
            <p className="text-[11px] text-zinc-400">
              Enter your email and password to create your verified Alpha Mate account
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleFinalSubmit} className="space-y-2.5">
            {errorMessage && (
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Avatar Selector */}
            <div>
              <label className="text-[10px] uppercase font-bold text-purple-300 tracking-wider block mb-1.5">
                Choose Profile Avatar
              </label>
              <div className="flex items-center justify-between gap-1.5">
                {PRESET_AVATARS.map((av, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedAvatar(av)}
                    className={`relative w-10 h-10 rounded-full overflow-hidden border-2 transition-all cursor-pointer ${
                      selectedAvatar === av
                        ? 'border-[#EC4899] scale-110 shadow-lg shadow-[#EC4899]/50'
                        : 'border-white/20 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={av} alt="Avatar" className="w-full h-full object-cover" />
                    {selectedAvatar === av && (
                      <span className="absolute inset-0 bg-[#EC4899]/20 flex items-center justify-center">
                        <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Full Name */}
            <div>
              <label className="text-[10px] uppercase font-bold text-purple-300 tracking-wider block mb-1">
                Full Name / Display Name
              </label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type="text"
                  placeholder="e.g. Alex Champion"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full h-10 pl-9 pr-3 rounded-xl bg-[#140D27] border border-[#A855F7]/30 text-white placeholder-zinc-500 text-xs focus:border-[#C084FC] focus:outline-none"
                />
              </div>
            </div>

            {/* Username */}
            <div>
              <label className="text-[10px] uppercase font-bold text-purple-300 tracking-wider block mb-1">
                Unique Username
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-400">@</span>
                <input
                  type="text"
                  placeholder="alphaking"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  className="w-full h-10 pl-8 pr-3 rounded-xl bg-[#140D27] border border-[#A855F7]/30 text-white placeholder-zinc-500 text-xs focus:border-[#C084FC] focus:outline-none"
                />
              </div>
            </div>

            {/* Email Address */}
            <div>
              <label className="text-[10px] uppercase font-bold text-purple-300 tracking-wider block mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type="email"
                  placeholder="you@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-10 pl-9 pr-3 rounded-xl bg-[#140D27] border border-[#A855F7]/30 text-white placeholder-zinc-500 text-xs focus:border-[#C084FC] focus:outline-none"
                />
              </div>
            </div>

            {/* Date of Birth */}
            <div>
              <label className="text-[10px] uppercase font-bold text-purple-300 tracking-wider block mb-1">
                Date of Birth (18+ Required)
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type="date"
                  value={dob}
                  max="2008-01-01"
                  onChange={(e) => setDob(e.target.value)}
                  className="w-full h-10 pl-9 pr-3 rounded-xl bg-[#140D27] border border-[#A855F7]/30 text-white text-xs focus:border-[#C084FC] focus:outline-none"
                />
              </div>
            </div>

            {/* Create Password */}
            <div>
              <label className="text-[10px] uppercase font-bold text-purple-300 tracking-wider block mb-1">
                Create Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Min 6 characters (for manual sign-in)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-10 pl-9 pr-9 rounded-xl bg-[#140D27] border border-[#A855F7]/30 text-white placeholder-zinc-500 text-xs focus:border-[#C084FC] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="text-[10px] uppercase font-bold text-purple-300 tracking-wider block mb-1">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full h-10 pl-9 pr-3 rounded-xl bg-[#140D27] border border-[#A855F7]/30 text-white placeholder-zinc-500 text-xs focus:border-[#C084FC] focus:outline-none"
                />
              </div>
            </div>

            {/* Terms checkbox */}
            <label className="flex items-start gap-2 pt-1 cursor-pointer select-none">
              <div
                onClick={() => setAgreedToTerms(!agreedToTerms)}
                className={`w-4 h-4 mt-0.5 rounded flex items-center justify-center shrink-0 border transition ${
                  agreedToTerms
                    ? 'bg-gradient-to-r from-[#7928CA] to-[#A855F7] border-[#A855F7]'
                    : 'border-zinc-700 bg-[#120B22]'
                }`}
              >
                {agreedToTerms && <Check className="w-3 h-3 text-white stroke-[3]" />}
              </div>
              <span className="text-[10px] text-zinc-400 leading-tight">
                I agree to Alpha Mate's{' '}
                <span className="text-[#C084FC] underline">Community Guidelines</span> &{' '}
                <span className="text-[#C084FC] underline">Terms of Service</span>.
              </span>
            </label>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-12 mt-2 rounded-2xl bg-gradient-to-r from-[#7928CA] via-[#9333EA] to-[#EC4899] font-extrabold text-white text-xs sm:text-sm shadow-lg shadow-[#7928CA]/40 hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <span>Creating Account...</span>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Complete Registration & Enter</span>
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* Footer Switch to Sign In */}
      <div className="relative z-10 pt-2 pb-2 text-center">
        <span className="text-xs text-zinc-400">
          Already registered?{' '}
          <button
            onClick={() => setCurrentScreen('signin')}
            className="text-[#C084FC] font-bold hover:underline cursor-pointer ml-1"
          >
            Sign In
          </button>
        </span>
      </div>

      {/* Apple Coming Soon Modal */}
      {showAppleComingSoon && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-xs rounded-2xl bg-[#17102D] border border-amber-400/40 p-5 text-center shadow-2xl animate-scale-up">
            <div className="w-12 h-12 rounded-2xl bg-black border border-zinc-700 flex items-center justify-center mx-auto mb-3 text-white">
              <Clock className="w-6 h-6 text-amber-400" />
            </div>
            <h3 className="text-base font-bold text-white">Apple Sign-In</h3>
            <p className="text-xs text-zinc-400 mt-1 mb-4 leading-relaxed">
              Continue with Apple is currently being finalized and will be available in the upcoming release.
              Please use <strong className="text-white">Continue with Google</strong> or <strong className="text-white">Register with Email</strong> to proceed.
            </p>
            <button
              onClick={() => setShowAppleComingSoon(false)}
              className="w-full h-10 rounded-xl bg-gradient-to-r from-[#7928CA] to-[#9333EA] text-white text-xs font-bold cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* Firebase Platform Registration Modal (Android & Apple iOS) */}
      {showPlatformRegistrationModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-sm rounded-3xl bg-[#150D2B] border border-[#A855F7]/40 p-5 shadow-2xl animate-scale-up text-left">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-black text-white">Firebase Project Connected</h3>
              </div>
              <button
                onClick={() => setShowPlatformRegistrationModal(false)}
                className="w-7 h-7 rounded-full bg-white/10 text-zinc-300 hover:text-white flex items-center justify-center text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-[11px] text-zinc-300 mb-3 leading-relaxed">
              Firebase is provisioned and linked to Alpha Mate for real-time Firestore database and Authentication!
            </p>

            <div className="space-y-2.5 text-xs">
              <div className="p-2.5 rounded-xl bg-[#0D061A] border border-white/5">
                <span className="text-[10px] text-zinc-400 uppercase font-bold block">Firebase Project ID</span>
                <span className="font-mono text-purple-300 font-bold select-all">gen-lang-client-0468444352</span>
              </div>

              {/* Android Registration */}
              <div className="p-2.5 rounded-xl bg-[#0D061A] border border-emerald-500/20">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-emerald-300 flex items-center gap-1">
                    <span>🤖</span> Android App Registration
                  </span>
                  <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 text-[9px] font-black">Ready</span>
                </div>
                <p className="text-[10px] text-zinc-400 mb-1">
                  Package Name: <span className="font-mono text-white select-all">com.alphamate.live</span>
                </p>
                <p className="text-[9.5px] text-zinc-500">
                  Add Android App in Firebase Console with this package name to download <code className="text-zinc-300">google-services.json</code>.
                </p>
              </div>

              {/* Apple iOS Registration */}
              <div className="p-2.5 rounded-xl bg-[#0D061A] border border-purple-500/20">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-[#D8B4FE] flex items-center gap-1">
                    <span>🍏</span> Apple iOS App Registration
                  </span>
                  <span className="px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 text-[9px] font-black">Ready</span>
                </div>
                <p className="text-[10px] text-zinc-400 mb-1">
                  Bundle ID: <span className="font-mono text-white select-all">com.alphamate.live</span>
                </p>
                <p className="text-[9.5px] text-zinc-500">
                  Add iOS App in Firebase Console with this bundle ID to download <code className="text-zinc-300">GoogleService-Info.plist</code>.
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowPlatformRegistrationModal(false)}
              className="mt-4 w-full h-10 rounded-xl bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white text-xs font-bold cursor-pointer hover:brightness-110 transition-all"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
