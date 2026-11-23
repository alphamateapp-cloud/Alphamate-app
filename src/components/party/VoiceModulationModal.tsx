import React, { useEffect, useState } from 'react';
import {
  X,
  Wand2,
  Check,
  Mic,
  Bot,
  Sparkles,
  Waves,
  AudioLines,
  Volume2,
  Headphones,
  RotateCcw,
  Radio,
} from 'lucide-react';
import {
  audioFilter,
  VOICE_FILTER_PRESETS,
  VoiceFilterPresetId,
} from '../../services/audioFilter';

interface VoiceModulationModalProps {
  isOpen: boolean;
  activeFilter: VoiceFilterPresetId;
  isOnMic: boolean;
  isMicMuted: boolean;
  onSelectFilter: (preset: VoiceFilterPresetId) => Promise<void> | void;
  onClose: () => void;
  onToast?: (message: string) => void;
}

const PRESET_ICON_MAP: Record<VoiceFilterPresetId, React.ReactNode> = {
  normal: <Mic className="w-4 h-4" />,
  robot: <Bot className="w-4 h-4" />,
  chipmunk: <Sparkles className="w-4 h-4" />,
  deep_echo: <Waves className="w-4 h-4" />,
  echo: <AudioLines className="w-4 h-4" />,
  deep: <Volume2 className="w-4 h-4" />,
  studio: <Headphones className="w-4 h-4" />,
};

export const VoiceModulationModal: React.FC<VoiceModulationModalProps> = ({
  isOpen,
  activeFilter,
  isOnMic,
  isMicMuted,
  onSelectFilter,
  onClose,
  onToast,
}) => {
  const [isApplying, setIsApplying] = useState<VoiceFilterPresetId | null>(null);
  const [isMonitorOn, setIsMonitorOn] = useState<boolean>(() => audioFilter.isLocalMonitorActive());
  const [monitorError, setMonitorError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState<number>(0);

  // Animate live mic level bar while modal is open and monitor/processing is active
  useEffect(() => {
    if (!isOpen) return;
    setMonitorError(null);
    setIsMonitorOn(audioFilter.isLocalMonitorActive());

    let rafId = 0;
    const tick = () => {
      setAudioLevel(audioFilter.getLiveAudioLevel());
      rafId = window.requestAnimationFrame(tick);
    };
    rafId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(rafId);
      // Automatically turn off local headphone feedback monitor on modal close to avoid room echo
      if (audioFilter.isLocalMonitorActive()) {
        void audioFilter.setLocalMonitor(false).catch(() => {});
      }
      setIsMonitorOn(false);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const activeMeta = audioFilter.getPresetMeta(activeFilter);

  const handleToggleMonitor = async () => {
    setMonitorError(null);
    const nextEnabled = !isMonitorOn;
    try {
      const result = await audioFilter.setLocalMonitor(nextEnabled);
      setIsMonitorOn(result);
      if (result) {
        onToast?.('Mic preview active — speak to hear your voice filter!');
      }
    } catch (err: any) {
      setIsMonitorOn(false);
      setMonitorError(
        err?.message || 'Allow microphone permission to test voice modulation.'
      );
    }
  };

  const handlePresetTap = async (presetId: VoiceFilterPresetId) => {
    if (isApplying) return;
    setIsApplying(presetId);
    try {
      await onSelectFilter(presetId);
    } finally {
      setIsApplying(null);
    }
  };

  return (
    <div
      data-keep-dark="true"
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-[#130B26]/98 border-t sm:border border-white/15 p-5 shadow-2xl animate-scale-up flex flex-col max-h-[88vh] text-white"
      >
        {/* Mobile sheet indicator */}
        <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-3 sm:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[#7928CA] via-[#EC4899] to-amber-400 flex items-center justify-center shrink-0 shadow-md">
              <Wand2 className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-white leading-tight">
                Voice Modulation Studio
              </h3>
              <p className="text-[11px] text-zinc-400 truncate">
                Active: <span className="text-[#EC4899] font-semibold">{activeMeta.label}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close voice modulation"
            className="w-11 h-11 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-zinc-300 hover:text-white cursor-pointer shrink-0 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto pt-3.5 pb-2 space-y-3.5 flex-1">
          {/* Live Voice Preview Bar (Hear Yourself + Animated Level Meter) */}
          <div className="p-3 rounded-2xl bg-[#1A1035] border border-white/10 flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <Radio
                  className={`w-3.5 h-3.5 shrink-0 ${
                    isMonitorOn ? 'text-emerald-400 animate-pulse' : 'text-zinc-400'
                  }`}
                />
                <span className="text-xs font-bold text-white truncate">
                  {isMonitorOn ? 'Live Preview Active' : 'Hear Yourself (Test Mic)'}
                </span>
              </div>
              {/* Real-time reactive level meter */}
              <div className="mt-2 h-2 w-full rounded-full bg-black/50 overflow-hidden flex items-center gap-0.5 px-0.5">
                {Array.from({ length: 16 }).map((_, idx) => {
                  const threshold = (idx + 1) / 16;
                  const lit = audioLevel >= threshold * 0.85;
                  return (
                    <span
                      key={idx}
                      className={`h-1 flex-1 rounded-full transition-colors duration-75 ${
                        lit
                          ? idx > 11
                            ? 'bg-pink-400'
                            : idx > 6
                            ? 'bg-amber-300'
                            : 'bg-emerald-400'
                          : 'bg-white/10'
                      }`}
                    />
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={handleToggleMonitor}
              className={`min-h-[40px] px-3.5 rounded-xl text-[11px] font-extrabold shrink-0 transition-all cursor-pointer active:scale-95 border ${
                isMonitorOn
                  ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-200 hover:bg-emerald-500/30'
                  : 'bg-white/10 border-white/15 text-white hover:bg-white/15'
              }`}
            >
              {isMonitorOn ? 'Stop Test' : 'Test Voice'}
            </button>
          </div>

          {monitorError && (
            <div className="px-3 py-2 rounded-xl bg-rose-500/15 border border-rose-400/30 text-[11px] text-rose-200">
              {monitorError}
            </div>
          )}

          {/* Voice Filter Presets Grid */}
          <div className="grid grid-cols-2 gap-2.5">
            {VOICE_FILTER_PRESETS.map((preset) => {
              const isActive = activeFilter === preset.id;
              const isLoading = isApplying === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  disabled={Boolean(isApplying)}
                  onClick={() => handlePresetTap(preset.id)}
                  className={`relative p-3 rounded-2xl border text-left transition-all cursor-pointer active:scale-[0.98] disabled:opacity-75 ${
                    isActive
                      ? `bg-gradient-to-br ${preset.accentGradient} border-white/50 text-white shadow-lg`
                      : 'bg-[#110822] border-white/10 text-zinc-200 hover:border-[#A855F7]/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                        isActive ? 'bg-black/25 text-white' : 'bg-white/5 text-[#C084FC]'
                      }`}
                    >
                      {PRESET_ICON_MAP[preset.id]}
                    </div>
                    {isActive ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-white bg-black/30 px-2 py-0.5 rounded-lg">
                        <Check className="w-3 h-3 stroke-[3]" />
                        <span>Active</span>
                      </span>
                    ) : isLoading ? (
                      <span className="text-[10px] font-bold text-zinc-300">Applying...</span>
                    ) : null}
                  </div>

                  <div className="text-xs font-extrabold leading-tight truncate">
                    {preset.label}
                  </div>
                  <p
                    className={`text-[10px] leading-snug mt-1 line-clamp-2 ${
                      isActive ? 'text-white/90' : 'text-zinc-400'
                    }`}
                  >
                    {preset.description}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Contextual Live Broadcast Status Guidance */}
          {!isOnMic ? (
            <div className="px-3 py-2.5 rounded-xl bg-purple-500/15 border border-purple-400/30 text-[11px] text-purple-200">
              Take an open seat (+) to broadcast your modulated voice live — your selected filter will activate automatically when you join the mic.
            </div>
          ) : isMicMuted ? (
            <div className="px-3 py-2.5 rounded-xl bg-amber-500/15 border border-amber-400/30 text-[11px] text-amber-200">
              Your microphone is currently muted. Unmute to broadcast <span className="font-bold">{activeMeta.label}</span> live to the room.
            </div>
          ) : null}
        </div>

        {/* Footer Actions */}
        <div className="mt-3 flex items-center gap-2 shrink-0">
          {activeFilter !== 'normal' && (
            <button
              type="button"
              onClick={() => handlePresetTap('normal')}
              className="min-h-[44px] px-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 hover:text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex-1 min-h-[44px] rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 text-white text-xs font-bold cursor-pointer transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
