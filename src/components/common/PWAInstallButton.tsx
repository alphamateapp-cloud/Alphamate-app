import React, { useState } from 'react';
import { Download, Share, PlusSquare, X, CheckCircle2 } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'compact' | 'card';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'compact' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [installing, setInstalling] = useState(false);

  if (isInstalled) {
    if (variant === 'card') {
      return (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 px-3 py-2 text-xs font-semibold text-emerald-300">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>App installed — Offline UI &amp; profile cache active</span>
        </div>
      );
    }
    return null;
  }

  const handleInstallClick = async () => {
    if (installing) return;
    setInstalling(true);
    try {
      await install();
    } finally {
      setInstalling(false);
    }
  };

  if (isInstallable) {
    if (variant === 'card') {
      return (
        <button
          type="button"
          onClick={handleInstallClick}
          disabled={installing}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#7928CA] to-[#EC4899] px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-[#7928CA]/25 hover:brightness-110 active:scale-[0.98] transition cursor-pointer disabled:opacity-60"
        >
          <Download className="w-4 h-4" />
          <span>{installing ? 'Opening Install Prompt...' : 'Install Alpha Mate App'}</span>
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={handleInstallClick}
        disabled={installing}
        title="Install Alpha Mate App"
        aria-label="Install Alpha Mate App"
        className="h-8.5 sm:h-9 px-2.5 rounded-full bg-gradient-to-r from-[#7928CA] to-[#EC4899] border border-white/15 flex items-center gap-1.5 text-[11px] font-bold text-white hover:brightness-110 active:scale-95 transition-all cursor-pointer shadow-md shadow-[#7928CA]/30"
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        <span>Install</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        {variant === 'card' ? (
          <button
            type="button"
            onClick={() => setShowIOSGuide(true)}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#2A184E] border border-[#A855F7]/40 px-4 py-2.5 text-xs font-bold text-[#E9D5FF] hover:bg-[#39206B] transition cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Install on iPhone / iPad</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setShowIOSGuide(true)}
            title="Install Alpha Mate on iOS"
            aria-label="Install Alpha Mate on iOS"
            className="h-8.5 sm:h-9 px-2.5 rounded-full bg-[#1A1133]/90 border border-[#A855F7]/40 flex items-center gap-1.5 text-[11px] font-bold text-[#E9D5FF] hover:border-[#EC4899]/60 active:scale-95 transition-all cursor-pointer shadow-md shadow-black/30"
          >
            <Download className="w-3.5 h-3.5 shrink-0" />
            <span>Install</span>
          </button>
        )}

        {showIOSGuide && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-3xl bg-[#140D26] border border-[#A855F7]/35 p-5 shadow-2xl text-white space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-white">Install Alpha Mate on iOS</h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-zinc-300 cursor-pointer"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-3 text-xs text-zinc-300 leading-relaxed">
                <div className="flex items-start gap-2.5 rounded-2xl bg-white/[0.04] border border-white/10 p-3">
                  <Share className="w-4 h-4 text-[#C084FC] shrink-0 mt-0.5" />
                  <p>
                    1. Tap the <strong className="text-white">Share</strong> icon in the Safari toolbar.
                  </p>
                </div>
                <div className="flex items-start gap-2.5 rounded-2xl bg-white/[0.04] border border-white/10 p-3">
                  <PlusSquare className="w-4 h-4 text-[#EC4899] shrink-0 mt-0.5" />
                  <p>
                    2. Scroll down and tap <strong className="text-white">Add to Home Screen</strong> for faster loading and offline profile access.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full rounded-xl bg-gradient-to-r from-[#7928CA] to-[#EC4899] py-2.5 text-xs font-bold text-white cursor-pointer"
              >
                Got It
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
