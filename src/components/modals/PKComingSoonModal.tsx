import React from 'react';
import { Swords, Sparkles, Bell, X, Shield, Trophy } from 'lucide-react';

interface PKComingSoonModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PKComingSoonModal: React.FC<PKComingSoonModalProps> = ({ isOpen, onClose }) => {
  const [isSubscribed, setIsSubscribed] = React.useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-sm rounded-3xl bg-gradient-to-b from-[#1F103A] via-[#140A28] to-[#0D051B] border border-[#EC4899]/40 shadow-2xl p-6 text-white text-center overflow-hidden">
        {/* Glow backdrop */}
        <div className="absolute -top-12 -left-12 w-36 h-36 rounded-full bg-[#EC4899]/20 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -right-12 w-36 h-36 rounded-full bg-[#7928CA]/25 blur-2xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header Visual with Animated Swords */}
        <div className="relative inline-flex items-center justify-center my-3">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-[#EC4899] via-[#9333EA] to-[#3B82F6] flex items-center justify-center shadow-lg shadow-[#EC4899]/40 animate-pulse">
            <Swords className="w-10 h-10 text-white" />
          </div>
          <div className="absolute -bottom-2 -right-2 px-2 py-0.5 rounded-full bg-[#F59E0B] text-black font-black text-[10px] uppercase tracking-wider shadow">
            Next Gen
          </div>
        </div>

        {/* Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EC4899]/15 border border-[#EC4899]/30 text-[#EC4899] text-xs font-bold mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          <span>PK BATTLE ARENA</span>
        </div>

        {/* Title */}
        <h3 className="text-xl font-black text-white tracking-tight mb-2">
          Coming Soon!
        </h3>

        {/* Description */}
        <p className="text-xs text-zinc-300 leading-relaxed mb-5 px-2">
          Global 1v1 Host Battles are being fine-tuned with high-performance real-time streaming engines. Solo live streaming is live and ready right now!
        </p>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-2 gap-2 text-left mb-5">
          <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#A855F7] shrink-0" />
            <div className="text-[11px] leading-tight">
              <span className="font-bold text-white block">Host 1v1</span>
              <span className="text-zinc-400 text-[10px]">Split-screen battle</span>
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-[#F59E0B] shrink-0" />
            <div className="text-[11px] leading-tight">
              <span className="font-bold text-white block">Gift Wars</span>
              <span className="text-zinc-400 text-[10px]">Real-time score bar</span>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="space-y-2">
          <button
            onClick={() => {
              setIsSubscribed(true);
              setTimeout(() => onClose(), 800);
            }}
            disabled={isSubscribed}
            className={`w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg ${
              isSubscribed
                ? 'bg-emerald-600 text-white'
                : 'bg-gradient-to-r from-[#EC4899] to-[#7928CA] text-white hover:opacity-95 shadow-[#EC4899]/30'
            }`}
          >
            <Bell className="w-4 h-4" />
            <span>{isSubscribed ? 'Notified! We will alert you' : 'Notify Me Upon Launch'}</span>
          </button>

          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            Explore Solo Live Stream
          </button>
        </div>
      </div>
    </div>
  );
};
