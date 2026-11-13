import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { AlphaMateLogo } from '../components/brand/AlphaMateLogo';
import { sendPasswordReset } from '../services/firebase';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowLeft,
  AlertCircle,
  Clock,
  Sparkles,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react';

export const SignInScreen: React.FC = () => {
  const {
    setCurrentScreen,
    customLogoUrl,
    isAuthenticated,
    firebaseUser,
    firebaseAuthLoading,
    isEmailVerified,
    loginWithFirebaseEmail,
    loginWithFirebaseGoogle,
    refreshFirebaseVerification,
    resendEmailVerificationLink,
  } = useApp();

  // Only auto-redirect if a real, verified Firebase Auth session is already active
  React.useEffect(() => {
    if (!firebaseAuthLoading && isAuthenticated && firebaseUser && isEmailVerified) {
      setCurrentScreen('home');
    }
  }, [firebaseAuthLoading, isAuthenticated, firebaseUser, isEmailVerified, setCurrentScreen]);

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [needsEmailVerification, setNeedsEmailVerification] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Apple modal
  const [showAppleComingSoon, setShowAppleComingSoon] = useState(false);

  // Forgot Password modal state
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [resetStatus, setResetStatus] = useState('');

  const formatFirebaseLoginError = (raw?: string) => {
    const msg = raw || '';
    if (msg.includes('popup-closed-by-user')) {
      return 'Google sign-in was cancelled. Tap Continue with Google to try again.';
    }
    if (msg.includes('invalid-credential') || msg.includes('wrong-password') || msg.includes('user-not-found')) {
      return 'Invalid email or password. Please check your credentials or Continue with Google (Gmail).';
    }
    if (msg.includes('operation-not-allowed')) {
      return 'Email/Password login is disabled. Please tap Continue with Google (Gmail) above.';
    }
    if (msg.includes('too-many-requests')) {
      return 'Too many attempts. Please wait a moment and try again.';
    }
    return msg || 'Sign-in failed. Please try again.';
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setStatusMessage('');
    setNeedsEmailVerification(false);

    const emailVal = identifier.trim();
    if (!emailVal || !emailVal.includes('@')) {
      setErrorMessage('Please enter your registered email address (e.g. name@gmail.com)');
      return;
    }
    if (!password.trim()) {
      setErrorMessage('Please enter your password');
      return;
    }

    setIsSubmitting(true);
    try {
      const fbRes = await loginWithFirebaseEmail(emailVal, password);
      setIsSubmitting(false);
      if (!fbRes.success) {
        if (fbRes.needsVerification) {
          setNeedsEmailVerification(true);
        }
        setErrorMessage(formatFirebaseLoginError(fbRes.error));
      }
    } catch (err: any) {
      setIsSubmitting(false);
      setErrorMessage(formatFirebaseLoginError(err?.message));
    }
  };

  const handleDirectGoogleSignIn = async () => {
    setIsSubmitting(true);
    setErrorMessage('');
    setStatusMessage('');
    setNeedsEmailVerification(false);
    try {
      const res = await loginWithFirebaseGoogle();
      setIsSubmitting(false);
      if (res.redirectPending) {
        setStatusMessage('Opening Google Sign-In...');
        return;
      }
      if (!res.success) {
        setErrorMessage(formatFirebaseLoginError(res.error));
      }
    } catch (err: any) {
      setIsSubmitting(false);
      setErrorMessage(formatFirebaseLoginError(err?.message));
    }
  };

  const handleVerifyAndContinue = async () => {
    setIsSubmitting(true);
    setErrorMessage('');
    try {
      const ok = await refreshFirebaseVerification();
      setIsSubmitting(false);
      if (!ok) {
        setErrorMessage('Email not verified yet. Please click the verification link in your inbox first.');
      }
    } catch (err: any) {
      setIsSubmitting(false);
      setErrorMessage(err?.message || 'Verification check failed.');
    }
  };

  const handleResendVerification = async () => {
    setIsSubmitting(true);
    setErrorMessage('');
    try {
      await resendEmailVerificationLink();
      setStatusMessage('Verification link resent! Please check your inbox.');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Could not resend verification link right now.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim() || !resetEmail.includes('@')) {
      setResetStatus('Please enter a valid email address.');
      return;
    }
    setResetSent(true);
    setResetStatus('');
    try {
      await sendPasswordReset(resetEmail.trim());
      setResetStatus('Password reset link sent! Please check your inbox.');
      setTimeout(() => {
        setShowForgotPassword(false);
        setResetSent(false);
        setResetStatus('');
      }, 1800);
    } catch (err: any) {
      setResetSent(false);
      setResetStatus(err?.message || 'Could not send reset email. Try Continue with Google.');
    }
  };

  return (
    <div className="relative w-full h-full min-h-[660px] flex flex-col justify-between p-5 overflow-y-auto scrollbar-none bg-[#09070F] select-none text-white">
      {/* Background ambient lighting */}
      <div className="absolute -top-16 -right-16 w-80 h-80 rounded-full bg-[#7928CA]/30 blur-[90px] pointer-events-none" />
      <div className="absolute bottom-1/4 -left-20 w-80 h-80 rounded-full bg-[#EC4899]/20 blur-[100px] pointer-events-none" />

      {/* Top Bar with Back Button & Centered Logo */}
      <div className="relative z-10 flex items-center justify-between pt-1">
        <button
          onClick={() => setCurrentScreen('welcome')}
          className="w-10 h-10 rounded-full bg-[#18102C] border border-[#A855F7]/30 flex items-center justify-center text-zinc-300 hover:text-white hover:border-[#A855F7] transition cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-1.5">
          <AlphaMateLogo size="sm" showText={false} customLogoUrl={customLogoUrl} />
          <span className="text-xs font-black tracking-wider text-purple-200">ALPHA MATE</span>
        </div>
        <div className="w-10" />
      </div>

      {/* Main Sign In Content */}
      <div className="relative z-10 py-4 max-w-sm w-full mx-auto my-auto">
        <div className="text-center mb-5">
          <h1 className="text-2xl font-black text-white tracking-tight">Welcome Back</h1>
          <p className="mt-1 text-xs text-zinc-400">
            Sign in to continue your live entertainment journey
          </p>
        </div>

        {/* 1. Fast Google One-Tap Sign In */}
        <div className="flex flex-col gap-2.5 mb-5">
          <button
            onClick={handleDirectGoogleSignIn}
            disabled={isSubmitting}
            className="group relative w-full h-12 rounded-2xl bg-[#17102B] hover:bg-[#21173D] border border-[#A855F7]/40 hover:border-[#C084FC] flex items-center justify-between px-4 transition-all shadow-md active:scale-[0.98] cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center shadow-sm shrink-0">
                <svg className="w-4 h-4" viewBox="0 0 24 24">
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
                <span className="text-[10px] text-[#C084FC]">Instant 1-Click Verified Login</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:translate-x-1 transition-transform" />
          </button>

          {/* Apple ID (Coming Soon) */}
          <button
            onClick={() => setShowAppleComingSoon(true)}
            className="w-full h-11 rounded-2xl bg-black/60 border border-zinc-800 flex items-center justify-between px-4 opacity-75 hover:opacity-100 transition-all cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-xl bg-black flex items-center justify-center border border-zinc-700 text-white shrink-0">
                <svg className="w-4 h-4 fill-current" viewBox="0 0 170 170">
                  <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.69-3.08-7.73-7.98-12.14-14.71-6.19-9.52-11.02-20.53-14.49-33.02-3.48-12.49-5.22-24.16-5.22-35.03 0-14.78 3.73-27.18 11.19-37.21 7.46-10.03 16.94-15.17 28.45-15.42 4.93 0 10.37 1.25 16.32 3.76 5.96 2.51 9.77 3.82 11.44 3.93 1.34 0 5.42-1.42 12.24-4.25 6.83-2.84 12.65-4.14 17.47-3.9 12.98.78 23.3 5.34 30.98 13.68-11.48 6.94-17.07 16.38-16.77 28.32.33 9.4 3.82 17.15 10.47 23.26 6.64 6.11 14.51 9.69 23.6 10.74-2.24 6.94-5.01 14.03-8.33 21.28zM119.22 33.15c0-7.27 2.65-14.07 7.95-20.41 5.3-6.34 11.96-10.42 19.98-12.24.11 1.01.17 1.8.17 2.37 0 7.15-2.82 14.15-8.46 21-5.63 6.85-12.42 10.87-20.37 12.06-.33-1.01-.52-1.93-.57-2.78z" />
                </svg>
              </div>
              <span className="text-xs font-semibold text-zinc-300">Continue with Apple</span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-[9px] font-bold text-amber-300">
              Coming Soon
            </span>
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-[1px] bg-zinc-800" />
          <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">
            Or with Email & Password
          </span>
          <div className="flex-1 h-[1px] bg-zinc-800" />
        </div>

        {/* Manual Form */}
        <form onSubmit={handleSignIn} className="flex flex-col gap-3">
          {errorMessage && (
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {statusMessage && (
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{statusMessage}</span>
            </div>
          )}

          {needsEmailVerification && (
            <div className="p-2.5 rounded-xl bg-[#1A1033] border border-[#A855F7]/40 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleVerifyAndContinue}
                  disabled={isSubmitting}
                  className="flex-1 h-9 rounded-lg bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-[11px] font-bold text-white cursor-pointer"
                >
                  I've Verified — Sign In
                </button>
                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={isSubmitting}
                  className="px-3 h-9 rounded-lg bg-white/10 text-[11px] font-semibold text-purple-200 cursor-pointer"
                >
                  Resend Link
                </button>
              </div>
            </div>
          )}

          {/* Email Input */}
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="email"
              placeholder="Email Address (e.g. name@gmail.com)"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-[#140D27] border border-[#A855F7]/30 text-white placeholder-zinc-500 text-xs sm:text-sm focus:outline-none focus:border-[#C084FC] transition-colors"
            />
          </div>

          {/* Password Input */}
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-11 pl-10 pr-10 rounded-xl bg-[#140D27] border border-[#A855F7]/30 text-white placeholder-zinc-500 text-xs sm:text-sm focus:outline-none focus:border-[#C084FC] transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {/* Forgot Password */}
          <div className="flex justify-end items-center text-xs">
            <button
              type="button"
              onClick={() => setShowForgotPassword(true)}
              className="text-xs text-[#C084FC] hover:underline cursor-pointer"
            >
              Forgot Password?
            </button>
          </div>

          {/* Sign In Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-12 mt-1 rounded-2xl bg-gradient-to-r from-[#7928CA] via-[#9333EA] to-[#EC4899] font-extrabold text-white text-xs sm:text-sm shadow-lg shadow-[#7928CA]/40 hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <span>Verifying Credentials...</span>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Sign In to Alpha Mate</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Footer Switch to Sign Up */}
      <div className="relative z-10 pt-2 pb-2 text-center">
        <span className="text-xs text-zinc-400">
          Don't have an account?{' '}
          <button
            onClick={() => setCurrentScreen('register')}
            className="text-[#C084FC] font-bold hover:underline cursor-pointer ml-1"
          >
            Create Account
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
              Please use <strong className="text-white">Continue with Google (Gmail)</strong> or your <strong className="text-white">Email & Password</strong>.
            </p>
            <button
              onClick={() => setShowAppleComingSoon(false)}
              className="w-full h-10 rounded-xl bg-gradient-to-r from-[#7928CA] to-[#9333EA] text-white text-xs font-bold"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-[#181131] border border-[#A855F7]/30 p-6 shadow-2xl animate-scale-up">
            <h3 className="text-lg font-bold text-white mb-1">Reset Password</h3>
            <p className="text-xs text-zinc-400 mb-4">
              Enter your registered email address to receive a recovery link.
            </p>

            <form onSubmit={handleSendReset} className="space-y-3">
              <input
                type="email"
                placeholder="Registered Email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl bg-[#110A22] border border-zinc-700 text-white placeholder-zinc-500 text-xs sm:text-sm focus:border-[#A855F7] focus:outline-none"
              />

              {resetStatus && (
                <p className="text-xs text-[#E9D5FF] bg-[#7928CA]/20 border border-[#A855F7]/30 rounded-xl px-3 py-2">
                  {resetStatus}
                </p>
              )}

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPassword(false);
                    setResetStatus('');
                  }}
                  className="flex-1 h-11 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-semibold hover:bg-zinc-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetSent}
                  className="flex-1 h-11 rounded-xl bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white text-xs font-bold hover:opacity-95"
                >
                  {resetSent ? 'Sending...' : 'Send Link'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
