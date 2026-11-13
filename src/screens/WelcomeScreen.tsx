import React from 'react';
import { useApp } from '../context/AppContext';
import { AlphaMateLogo } from '../components/brand/AlphaMateLogo';
import {
  ArrowRight,
  Video,
  Mic,
  Play,
  MessageCircle,
  Crown,
  Plus,
  Radio,
  Flame,
} from 'lucide-react';

export const WelcomeScreen: React.FC = () => {
  const {
    setCurrentScreen,
    customLogoUrl,
    isAuthenticated,
    firebaseUser,
    firebaseAuthLoading,
    isEmailVerified,
  } = useApp();

  // If user already has an active, verified Firebase session on this device, enter directly
  React.useEffect(() => {
    if (!firebaseAuthLoading && isAuthenticated && firebaseUser && isEmailVerified) {
      setCurrentScreen('home');
    }
  }, [firebaseAuthLoading, isAuthenticated, firebaseUser, isEmailVerified, setCurrentScreen]);

  return (
    <div className="relative w-full h-full min-h-[660px] flex flex-col justify-between p-4 sm:p-5 overflow-y-auto scrollbar-none bg-[#09070F] select-none text-white">
      {/* Background ambient lighting and concert beams */}
      <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-[#7928CA]/35 blur-[110px] pointer-events-none" />
      <div className="absolute top-1/3 -right-20 w-80 h-80 rounded-full bg-[#EC4899]/25 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 -left-20 w-80 h-80 rounded-full bg-[#9333EA]/20 blur-[100px] pointer-events-none" />

      {/* Subtle stage light beam lines */}
      <div
        className="absolute inset-0 opacity-15 pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(circle at 50% 20%, rgba(168, 85, 247, 0.4) 1px, transparent 1px), linear-gradient(to bottom, rgba(121, 40, 202, 0.1) 0%, transparent 60%)',
          backgroundSize: '24px 24px, 100% 100%',
        }}
      />

      {/* ============================================================ */}
      {/* 1. TOP SECTION: Logo, Brand Name, Heading, Tagline */}
      {/* ============================================================ */}
      <div className="relative z-10 pt-1 flex flex-col items-center text-center">
        {/* Original Clean Alpha Mate Logo Asset */}
        <div className="relative group transition-transform duration-300 hover:scale-105">
          <div className="absolute -inset-2 bg-gradient-to-r from-[#7928CA]/70 via-[#A855F7]/50 to-[#EC4899]/70 rounded-3xl blur-lg opacity-80" />
          <div className="relative p-1.5 rounded-2xl bg-[#140D27]/90 border border-[#A855F7]/40 backdrop-blur-xl shadow-xl shadow-[#7928CA]/40">
            <AlphaMateLogo
              size="md"
              showText={false}
              withGlow={true}
              customLogoUrl={customLogoUrl}
            />
          </div>
        </div>

        {/* Brand Name Typography */}
        <div className="mt-2 flex flex-col items-center">
          <span className="text-[11px] font-black tracking-[0.22em] uppercase text-purple-300 drop-shadow">
            ALPHA MATE
          </span>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white mt-0.5">
            WELCOME TO{' '}
            <span className="bg-gradient-to-r from-[#D8B4FE] via-[#EC4899] to-[#F43F5E] bg-clip-text text-transparent drop-shadow-[0_2px_14px_rgba(236,72,153,0.5)]">
              ALPHA MATE
            </span>
          </h1>

          {/* Tagline Badge */}
          <div className="mt-1.5 inline-flex items-center gap-2 px-3 py-0.5 rounded-full bg-[#1F143D]/90 border border-[#A855F7]/40 shadow-inner">
            <span className="w-1.5 h-1.5 rounded-full bg-[#EC4899] animate-ping" />
            <span className="text-[9px] sm:text-[10px] font-black tracking-[0.24em] text-[#E9D5FF] uppercase">
              LIVE • PARTY • SOCIAL
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#7928CA]" />
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 2. HERO SECTION — OUTSTANDING COMMUNITY (Three Live Personalities) */}
      {/* ============================================================ */}
      <div className="relative z-10 my-3 w-full max-w-sm mx-auto flex flex-col items-center">
        {/* Three Outstanding Live Creators Stage */}
        <div className="relative w-full flex items-center justify-center pt-5 pb-2">
          {/* Subtle Stage Spotlight Glow behind Central Host */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-gradient-to-r from-[#7928CA]/50 via-[#EC4899]/40 to-[#F59E0B]/30 rounded-full blur-2xl pointer-events-none" />

          {/* LEFT CREATOR (Flanking) */}
          <div className="relative z-10 w-24 sm:w-26 h-36 rounded-2xl overflow-hidden border-2 border-[#7928CA]/60 bg-[#170E2F] shadow-lg shadow-[#7928CA]/30 transform -rotate-6 -mr-4 hover:rotate-0 hover:z-30 transition-all duration-300">
            <img
              src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80"
              alt="Party Host"
              className="w-full h-full object-cover object-center"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
            <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-black/60 border border-purple-500/40 text-[8px] font-bold text-purple-200 flex items-center gap-0.5">
              <Mic className="w-2.5 h-2.5 text-[#EC4899]" />
              <span>Party</span>
            </div>
            <div className="absolute bottom-1.5 left-1.5 right-1.5">
              <span className="text-[10px] font-bold text-white block truncate leading-tight">Alex Rivers</span>
              <span className="text-[8px] text-zinc-400">DJ • 4.8K</span>
            </div>
          </div>

          {/* CENTRAL CREATOR (Large Outstanding Profile with Gold Crown & LIVE Badge) */}
          <div className="relative z-20 w-32 sm:w-36 h-46 rounded-2xl overflow-hidden border-2 border-[#EC4899] bg-[#1C1236] shadow-2xl shadow-[#EC4899]/40 hover:scale-105 transition-all duration-300">
            {/* Crown Decoration Above Profile */}
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-30 flex items-center justify-center">
              <div className="relative flex items-center justify-center">
                <div className="absolute w-6 h-6 bg-amber-400/60 rounded-full blur-md" />
                <div className="w-7 h-7 rounded-full bg-gradient-to-b from-amber-300 via-amber-400 to-amber-600 border border-amber-200 flex items-center justify-center shadow-lg shadow-amber-500/50">
                  <Crown className="w-4 h-4 text-amber-950 fill-amber-900 drop-shadow" />
                </div>
              </div>
            </div>

            {/* LIVE Badge */}
            <div className="absolute top-2 right-2 z-20 px-2 py-0.5 rounded-full bg-red-600/90 border border-red-400 text-[8px] font-black uppercase text-white shadow-lg animate-pulse flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
              <span>LIVE</span>
            </div>

            {/* Live Host Photo */}
            <img
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80"
              alt="Sophia Star"
              className="w-full h-full object-cover object-top"
            />

            {/* Host Info Overlay at Base */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/25 to-transparent flex flex-col justify-end p-2">
              <div className="flex items-center gap-1">
                <span className="text-xs font-black text-white truncate">Sophia Star</span>
                <Crown className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />
              </div>
              <div className="flex items-center justify-between text-[9px] text-zinc-300 mt-0.5">
                <span className="text-[#C084FC] font-semibold">Top Star #1</span>
                <span className="flex items-center gap-0.5 font-bold text-amber-300">
                  <Radio className="w-2.5 h-2.5 text-red-400 animate-pulse" />
                  18.4K
                </span>
              </div>
              {/* Live Audio Visualizer Bars */}
              <div className="flex items-center gap-0.5 mt-1">
                <span className="w-1 h-2 bg-purple-400 rounded-full animate-pulse" />
                <span className="w-1 h-3.5 bg-[#EC4899] rounded-full animate-pulse [animation-delay:0.15s]" />
                <span className="w-1 h-2.5 bg-pink-400 rounded-full animate-pulse [animation-delay:0.3s]" />
                <span className="w-1 h-4 bg-amber-400 rounded-full animate-pulse [animation-delay:0.2s]" />
                <span className="w-1 h-2 bg-purple-400 rounded-full animate-pulse [animation-delay:0.1s]" />
              </div>
            </div>
          </div>

          {/* RIGHT CREATOR (Flanking) */}
          <div className="relative z-10 w-24 sm:w-26 h-36 rounded-2xl overflow-hidden border-2 border-[#EC4899]/60 bg-[#170E2F] shadow-lg shadow-[#EC4899]/30 transform rotate-6 -ml-4 hover:rotate-0 hover:z-30 transition-all duration-300">
            <img
              src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80"
              alt="Elena Ray"
              className="w-full h-full object-cover object-center"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
            <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-black/60 border border-pink-500/40 text-[8px] font-bold text-pink-200 flex items-center gap-0.5">
              <Flame className="w-2.5 h-2.5 text-amber-400" />
              <span>PK Battle</span>
            </div>
            <div className="absolute bottom-1.5 left-1.5 right-1.5">
              <span className="text-[10px] font-bold text-white block truncate leading-tight">Elena Ray</span>
              <span className="text-[8px] text-zinc-400">Singer • 9.8K</span>
            </div>
          </div>
        </div>

        {/* Audience Concert Silhouette and Atmospheric Glow */}
        <div className="relative w-full h-6 -mt-3 flex items-center justify-center opacity-70 pointer-events-none">
          <div className="w-48 h-3 bg-gradient-to-r from-transparent via-[#A855F7]/30 to-transparent rounded-full blur-sm" />
        </div>
      </div>

      {/* ============================================================ */}
      {/* 3. FEATURE SHORTCUTS (4 Equally Sized Cards) */}
      {/* ============================================================ */}
      <div className="relative z-10 my-2 w-full max-w-sm mx-auto">
        <div className="grid grid-cols-4 gap-2">
          {/* LIVE — Video Camera Icon */}
          <div className="p-2 sm:p-2.5 rounded-2xl bg-[#140D27]/85 border border-[#A855F7]/35 backdrop-blur-md flex flex-col items-center text-center shadow-lg shadow-[#7928CA]/10 hover:border-[#EC4899] hover:scale-105 transition-all cursor-default">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#7928CA] to-[#A855F7] flex items-center justify-center text-white mb-1.5 shadow-md shadow-[#7928CA]/40">
              <Video className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-black text-white tracking-wider uppercase">LIVE</span>
            <span className="text-[8px] text-purple-300 font-medium mt-0.5">Broadcast</span>
          </div>

          {/* PARTY — Microphone Icon */}
          <div className="p-2 sm:p-2.5 rounded-2xl bg-[#140D27]/85 border border-[#EC4899]/35 backdrop-blur-md flex flex-col items-center text-center shadow-lg shadow-[#EC4899]/10 hover:border-[#EC4899] hover:scale-105 transition-all cursor-default">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#EC4899] to-[#F43F5E] flex items-center justify-center text-white mb-1.5 shadow-md shadow-[#EC4899]/40">
              <Mic className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-black text-white tracking-wider uppercase">PARTY</span>
            <span className="text-[8px] text-pink-300 font-medium mt-0.5">8-Seats</span>
          </div>

          {/* MOMENTS — Play Icon */}
          <div className="p-2 sm:p-2.5 rounded-2xl bg-[#140D27]/85 border border-[#A855F7]/35 backdrop-blur-md flex flex-col items-center text-center shadow-lg shadow-[#7928CA]/10 hover:border-[#EC4899] hover:scale-105 transition-all cursor-default">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#9333EA] to-[#C026D3] flex items-center justify-center text-white mb-1.5 shadow-md shadow-[#9333EA]/40">
              <Play className="w-4 h-4 fill-white ml-0.5" />
            </div>
            <span className="text-[10px] font-black text-white tracking-wider uppercase">MOMENTS</span>
            <span className="text-[8px] text-purple-300 font-medium mt-0.5">Reels</span>
          </div>

          {/* CHAT — Message Icon */}
          <div className="p-2 sm:p-2.5 rounded-2xl bg-[#140D27]/85 border border-[#EC4899]/35 backdrop-blur-md flex flex-col items-center text-center shadow-lg shadow-[#EC4899]/10 hover:border-[#EC4899] hover:scale-105 transition-all cursor-default">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#C026D3] to-[#EC4899] flex items-center justify-center text-white mb-1.5 shadow-md shadow-[#C026D3]/40">
              <MessageCircle className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-black text-white tracking-wider uppercase">CHAT</span>
            <span className="text-[8px] text-pink-300 font-medium mt-0.5">Direct</span>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 4. COMMUNITY SECTION & 5. PAGE INDICATOR */}
      {/* ============================================================ */}
      <div className="relative z-10 my-2 w-full max-w-sm mx-auto flex flex-col items-center gap-2">
        {/* Horizontal row of circular user profiles with glowing borders */}
        <div className="flex items-center gap-3 px-3.5 py-1.5 rounded-full bg-[#140D27]/90 border border-white/10 backdrop-blur-md shadow-md">
          {/* Overlapping User Avatars Stack */}
          <div className="flex items-center -space-x-2">
            {[
              'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=120&q=80',
              'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=120&q=80',
              'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=120&q=80',
              'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=120&q=80',
            ].map((avatarUrl, i) => (
              <div
                key={i}
                className="w-7 h-7 rounded-full overflow-hidden border-2 border-[#120B22] shadow-sm shadow-[#A855F7]/30"
              >
                <img src={avatarUrl} alt="Community User" className="w-full h-full object-cover" />
              </div>
            ))}
            {/* Small Plus Icon for discovering more */}
            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#7928CA] to-[#EC4899] border-2 border-[#120B22] flex items-center justify-center text-white shadow-sm">
              <Plus className="w-3 h-3 stroke-[3]" />
            </div>
          </div>

          {/* Community Indicator Text (Promotional Content) */}
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-black text-white tracking-wide">1M+ Active Users</span>
          </div>
        </div>

        {/* 5. Page Indicator (Three onboarding pagination dots, 2nd dot active) */}
        <div className="flex items-center gap-1.5 pt-1">
          {/* Dot 1 */}
          <div className="w-2 h-2 rounded-full bg-white/20 transition-all" />
          {/* Dot 2 (ACTIVE) */}
          <div className="w-6 h-2 rounded-full bg-gradient-to-r from-[#7928CA] to-[#EC4899] shadow-sm shadow-[#EC4899]/60 transition-all" />
          {/* Dot 3 */}
          <div className="w-2 h-2 rounded-full bg-white/20 transition-all" />
        </div>
      </div>

      {/* ============================================================ */}
      {/* 6. GET STARTED BUTTON & AUTH NAVIGATION */}
      {/* ============================================================ */}
      <div className="relative z-10 pb-1 flex flex-col items-center gap-2 w-full max-w-sm mx-auto">
        {/* Large Premium Gradient Pill Button */}
        <button
          onClick={() => setCurrentScreen('register')}
          className="group relative w-full h-13.5 sm:h-14 rounded-full bg-gradient-to-r from-[#7928CA] via-[#9333EA] to-[#EC4899] p-[1.5px] shadow-xl shadow-[#7928CA]/40 hover:shadow-[#A855F7]/70 active:scale-[0.98] transition-all cursor-pointer"
        >
          <div className="w-full h-full rounded-full bg-gradient-to-r from-[#7928CA] via-[#9333EA] to-[#EC4899] flex items-center justify-between px-6 text-white font-extrabold text-base tracking-wide">
            <span className="tracking-wide">Get Started</span>
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center group-hover:translate-x-1.5 transition-transform shadow-sm">
              <ArrowRight className="w-4.5 h-4.5 text-white" />
            </div>
          </div>
        </button>

        {/* Secondary Navigation Option */}
        <div className="flex items-center justify-center w-full px-3 text-xs pt-0.5">
          <button
            onClick={() => setCurrentScreen('signin')}
            className="text-zinc-400 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5 py-1"
          >
            <span>Already have an account?</span>
            <span className="text-[#C084FC] font-bold underline underline-offset-4">Sign In</span>
          </button>
        </div>
      </div>
    </div>
  );
};
