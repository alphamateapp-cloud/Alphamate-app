import React, { useState } from 'react';
import {
  Smartphone,
  CheckCircle2,
  Copy,
  Check,
  Terminal,
  Download,
  ShieldCheck,
  ExternalLink,
  Layers,
  Sparkles,
  X,
  FileCode,
  Package,
} from 'lucide-react';
import { copyToClipboard } from '../../utils/clipboard';
import { usePWAInstall } from '../../hooks/usePWAInstall';

interface AndroidSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AndroidSetupModal: React.FC<AndroidSetupModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const { isInstallable, isInstalled, install } = usePWAInstall();

  if (!isOpen) return null;

  const handleCopy = async (key: string, text: string) => {
    await copyToClipboard(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-xl rounded-t-3xl sm:rounded-3xl bg-[#110822] border border-[#A855F7]/40 shadow-2xl max-h-[90vh] flex flex-col overflow-hidden text-white">
        {/* Header */}
        <div className="relative p-5 pb-4 bg-gradient-to-r from-[#1E0B38] via-[#140626] to-[#0D031A] border-b border-[#A855F7]/25 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-400 via-teal-500 to-emerald-600 p-0.5 shadow-lg shadow-emerald-500/20 flex items-center justify-center">
              <div className="w-full h-full rounded-[14px] bg-[#0E1A1A] flex items-center justify-center text-emerald-400">
                <Smartphone className="w-6 h-6" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-white">Android Environment Hub</h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black border border-emerald-500/30">
                  APK & AAB READY
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Capacitor Native Android Project • com.alphamate.liveparty
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-zinc-300 hover:text-white cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Quick Status Cards */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3.5 rounded-2xl bg-[#180D2E] border border-white/10 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                <span>Native Android Engine</span>
              </div>
              <p className="text-[11px] text-zinc-300 font-mono">Capacitor 8 + Gradle 8</p>
              <p className="text-[10px] text-zinc-400">Configured in /android with full Java/Kotlin wrapper</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#180D2E] border border-white/10 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-purple-300">
                <Package className="w-4 h-4 text-purple-400" />
                <span>Output Formats</span>
              </div>
              <p className="text-[11px] text-zinc-300 font-mono">.apk & .aab bundles</p>
              <p className="text-[10px] text-zinc-400">Google Play Store & direct sideload compliant</p>
            </div>
          </div>

          {/* Direct Install on Android Device (If PWA Prompt Available) */}
          {isInstallable && !isInstalled && (
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/40 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/30 text-emerald-300 flex items-center justify-center shrink-0">
                  <Download className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-black text-white">Direct Install on This Android Device</h4>
                  <p className="text-[10px] text-zinc-300">Install Alpha Mate app directly to your home screen</p>
                </div>
              </div>
              <button
                onClick={install}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs cursor-pointer shadow-md active:scale-95 transition-all"
              >
                Install Now
              </button>
            </div>
          )}

          {/* Section 1: How to Build APK */}
          <div className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">📦</span>
                <div>
                  <h3 className="text-xs font-black uppercase text-white tracking-wider">
                    1. Generate Android APK (.apk)
                  </h3>
                  <p className="text-[10px] text-zinc-400">
                    Direct installation file to test on any Android phone or tablet
                  </p>
                </div>
              </div>
              <span className="text-[9.5px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono font-bold">
                Debug & Release
              </span>
            </div>

            <div className="p-3 rounded-xl bg-[#0B0615] border border-white/10 font-mono text-xs flex items-center justify-between gap-2">
              <span className="text-amber-300 select-all truncate">npm run android:apk</span>
              <button
                onClick={() => handleCopy('apk', 'npm run android:apk')}
                className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold text-zinc-300 hover:text-white flex items-center gap-1 cursor-pointer shrink-0"
              >
                {copiedKey === 'apk' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === 'apk' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            <div className="text-[11px] text-zinc-400 space-y-1">
              <p>📍 <strong>Output Location:</strong></p>
              <code className="text-[10px] text-purple-300 bg-white/5 px-2 py-1 rounded block select-all">
                android/app/build/outputs/apk/debug/app-debug.apk
              </code>
            </div>
          </div>

          {/* Section 2: How to Build AAB (Google Play Store Bundle) */}
          <div className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">🚀</span>
                <div>
                  <h3 className="text-xs font-black uppercase text-white tracking-wider">
                    2. Generate Android App Bundle (.aab)
                  </h3>
                  <p className="text-[10px] text-zinc-400">
                    Official bundle format required for publishing on Google Play Store
                  </p>
                </div>
              </div>
              <span className="text-[9.5px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono font-bold">
                Google Play Store
              </span>
            </div>

            <div className="p-3 rounded-xl bg-[#0B0615] border border-white/10 font-mono text-xs flex items-center justify-between gap-2">
              <span className="text-amber-300 select-all truncate">npm run android:aab</span>
              <button
                onClick={() => handleCopy('aab', 'npm run android:aab')}
                className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold text-zinc-300 hover:text-white flex items-center gap-1 cursor-pointer shrink-0"
              >
                {copiedKey === 'aab' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === 'aab' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            <div className="text-[11px] text-zinc-400 space-y-1">
              <p>📍 <strong>Output Location:</strong></p>
              <code className="text-[10px] text-purple-300 bg-white/5 px-2 py-1 rounded block select-all">
                android/app/build/outputs/bundle/release/app-release.aab
              </code>
            </div>
          </div>

          {/* Section 3: Open in Android Studio */}
          <div className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">🛠️</span>
                <div>
                  <h3 className="text-xs font-black uppercase text-white tracking-wider">
                    3. Open Directly in Android Studio
                  </h3>
                  <p className="text-[10px] text-zinc-400">
                    Test in Android Emulator, configure Firebase push notifications, or run on connected USB device
                  </p>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#0B0615] border border-white/10 font-mono text-xs flex items-center justify-between gap-2">
              <span className="text-amber-300 select-all truncate">npm run android:open</span>
              <button
                onClick={() => handleCopy('open', 'npm run android:open')}
                className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold text-zinc-300 hover:text-white flex items-center gap-1 cursor-pointer shrink-0"
              >
                {copiedKey === 'open' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === 'open' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* Section 4: Release Signing Keytool */}
          <div className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-2.5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-black uppercase text-white tracking-wider">
                Release Keystore Generator (For Google Play Signing)
              </h3>
            </div>
            <p className="text-[10px] text-zinc-400">
              Run this single command in terminal to create your official release signing key:
            </p>
            <div className="p-3 rounded-xl bg-[#0B0615] border border-white/10 font-mono text-[11px] flex items-center justify-between gap-2">
              <span className="text-zinc-300 select-all truncate">
                keytool -genkey -v -keystore release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias alphamate
              </span>
              <button
                onClick={() =>
                  handleCopy(
                    'keytool',
                    'keytool -genkey -v -keystore release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias alphamate'
                  )
                }
                className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold text-zinc-300 hover:text-white flex items-center gap-1 cursor-pointer shrink-0"
              >
                {copiedKey === 'keytool' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === 'keytool' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-[#0A0414] border-t border-white/10 flex items-center justify-between">
          <span className="text-[10px] text-zinc-400">
            Package: <strong className="text-white font-mono">com.alphamate.liveparty</strong>
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
