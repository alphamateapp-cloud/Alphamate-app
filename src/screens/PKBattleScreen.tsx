import React from 'react';
import { useApp } from '../context/AppContext';
import { Swords, ArrowLeft, Bell, Sparkles, Shield, Trophy, Flame } from 'lucide-react';

export const PKBattleScreen: React.FC = () => {
  const { navigateBack, setCurrentScreen } = useApp();
  const [isNotified, setIsNotified] = React.useState(false);

  return (
    <div className="relative w-full h-full h-[100dvh] max-h-[100dvh] bg-gradient-to-b from-[#190A2E] via-[#0E061B] to-[#07030D] text-white flex flex-col justify-between overflow-hidden select-none">
      {/* Top Bar */}
      <div className="relative z-30 pt-3 pb-3 px-4 flex items-center justify-between bg-black/40 backdrop-blur-md border-b border-[#A855F7]/20">
        <button
          onClick={navigateBack}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-semibold cursor-pointer transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>
        <div className="flex items-center gap-2">
          <div className="px-3 py-1 rounded-full bg-gradient-to-r from-[#EC4899] to-[#7928CA] flex items-center gap-1.5 shadow-md">
            <Swords className="w-3.5 h-3.5 text-white animate-pulse" />
            <span className="text-[10px] font-black tracking-widest uppercase">1v1 PK ARENA</span>
          </div>
        </div>
        <div className="w-12" />
      </div>

      {/* Main Coming Soon Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center z-20">
        {/* Animated Cyber Arena Badge */}
        <div className="relative inline-flex items-center justify-center mb-6">
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-[#EC4899] via-[#9333EA] to-[#3B82F6] flex items-center justify-center shadow-2xl shadow-[#EC4899]/50 animate-pulse">
            <Swords className="w-12 h-12 text-white stroke-[2.2]" />
          </div>
          <span className="absolute -top-2 -right-2 px-2.5 py-0.5 rounded-full bg-[#F59E0B] text-black font-black text-[10px] uppercase tracking-wider shadow">
            Phase 2
          </span>
        </div>

        {/* Title */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EC4899]/15 border border-[#EC4899]/30 text-[#EC4899] text-xs font-bold mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          <span>GLOBAL 1V1 ARENA</span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-3">
          PK Battle Mode
          <span className="block text-transparent bg-clip-text bg-gradient-to-r from-[#EC4899] via-[#A855F7] to-[#3B82F6] text-xl sm:text-2xl mt-1">
            Coming Soon!
          </span>
        </h1>

        <p className="text-xs sm:text-sm text-zinc-300 max-w-sm leading-relaxed mb-6">
          High-performance split-screen battles and real-time interactive gift wars are currently under active development. Solo live streaming is live and ready right now!
        </p>

        {/* Highlights Cards */}
        <div className="grid grid-cols-2 gap-3 max-w-xs w-full mb-6 text-left">
          <div className="p-3 rounded-2xl bg-[#1A0E30]/80 border border-purple-500/20">
            <div className="w-7 h-7 rounded-lg bg-pink-500/20 flex items-center justify-center text-pink-400 mb-2">
              <Shield className="w-4 h-4" />
            </div>
            <span className="font-bold text-xs text-white block">Split Broadcast</span>
            <span className="text-[10px] text-zinc-400">Low-latency dual host video</span>
          </div>

          <div className="p-3 rounded-2xl bg-[#1A0E30]/80 border border-purple-500/20">
            <div className="w-7 h-7 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400 mb-2">
              <Trophy className="w-4 h-4" />
            </div>
            <span className="font-bold text-xs text-white block">Tug of War</span>
            <span className="text-[10px] text-zinc-400">Live audience coin gifting</span>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2.5 w-full max-w-xs">
          <button
            onClick={() => setIsNotified(true)}
            disabled={isNotified}
            className={`w-full py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg ${
              isNotified
                ? 'bg-emerald-600 text-white'
                : 'bg-gradient-to-r from-[#EC4899] to-[#7928CA] text-white hover:opacity-95 shadow-[#EC4899]/30'
            }`}
          >
            <Bell className="w-4 h-4" />
            <span>{isNotified ? 'Subscribed for Update! 🔔' : 'Notify Me On Launch'}</span>
          </button>

          <button
            onClick={() => setCurrentScreen('home')}
            className="w-full py-2.5 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            Back to Home Feed
          </button>
        </div>
      </div>

      {/* Decorative Arena Glow Footer */}
      <div className="relative z-10 py-3 text-center border-t border-white/5 bg-black/40">
        <span className="text-[10px] text-zinc-400 tracking-wider uppercase font-semibold flex items-center justify-center gap-1.5">
          <Flame className="w-3.5 h-3.5 text-pink-500 animate-pulse" />
          <span>Alpha Mate Battle Arena • Development in Progress</span>
        </span>
      </div>
    </div>
  );
};
