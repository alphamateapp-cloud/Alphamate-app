import React, { useState } from 'react';
import { Sparkles, Sliders, X, Check, Eye, RefreshCw, Sun, Moon, Wand2 } from 'lucide-react';

export type FilterPresetId =
  | 'normal'
  | 'neon'
  | 'soft'
  | 'bw'
  | 'cyber'
  | 'sunset'
  | 'vintage';

export interface FilterPreset {
  id: FilterPresetId;
  name: string;
  badge: string;
  description: string;
  // CSS filter string
  cssFilter: (intensity: number) => string;
  // Blend overlay style
  overlayStyle?: (intensity: number) => React.CSSProperties;
  previewThumbnailColor: string;
}

export const CAMERA_FILTER_PRESETS: FilterPreset[] = [
  {
    id: 'normal',
    name: 'Normal',
    badge: 'Original',
    description: 'Natural true-to-life color reproduction without grading',
    cssFilter: () => 'none',
    previewThumbnailColor: 'linear-gradient(135deg, #2A2438, #161224)',
  },
  {
    id: 'neon',
    name: 'Neon',
    badge: 'Neon Glow',
    description: 'Vibrant neon purple and magenta saturation with sharpened contrast',
    cssFilter: (intensity) => {
      const factor = intensity / 100;
      const contrast = 1 + factor * 0.35;
      const saturate = 1 + factor * 1.1;
      const hue = factor * -15;
      return `contrast(${contrast}) saturate(${saturate}) hue-rotate(${hue}deg) brightness(${1 + factor * 0.05})`;
    },
    overlayStyle: (intensity) => ({
      background: 'radial-gradient(circle at 50% 40%, rgba(168, 85, 247, 0.22) 0%, rgba(236, 72, 153, 0.18) 55%, rgba(10, 5, 25, 0.4) 100%)',
      mixBlendMode: 'screen',
      opacity: intensity / 100,
    }),
    previewThumbnailColor: 'linear-gradient(135deg, #7928CA, #EC4899)',
  },
  {
    id: 'soft',
    name: 'Soft',
    badge: 'Soft Dream',
    description: 'Dreamy pastel warmth, gentle diffused bloom, and smoothed skin tones',
    cssFilter: (intensity) => {
      const factor = intensity / 100;
      const brightness = 1 + factor * 0.12;
      const contrast = 1 - factor * 0.12;
      const saturate = 1 + factor * 0.15;
      return `brightness(${brightness}) contrast(${contrast}) saturate(${saturate}) sepia(${factor * 0.18})`;
    },
    overlayStyle: (intensity) => ({
      background: 'linear-gradient(180deg, rgba(254, 215, 170, 0.25) 0%, rgba(244, 114, 182, 0.15) 60%, rgba(168, 85, 247, 0.1) 100%)',
      mixBlendMode: 'soft-light',
      opacity: (intensity / 100) * 0.85,
    }),
    previewThumbnailColor: 'linear-gradient(135deg, #FDE68A, #F472B6)',
  },
  {
    id: 'bw',
    name: 'Black & White',
    badge: 'Cinematic B&W',
    description: 'High-contrast noir monochrome with deep rich blacks and silver highlights',
    cssFilter: (intensity) => {
      const factor = intensity / 100;
      const gray = factor * 100;
      const contrast = 1 + factor * 0.45;
      const brightness = 1 - factor * 0.04;
      return `grayscale(${gray}%) contrast(${contrast}) brightness(${brightness})`;
    },
    overlayStyle: (intensity) => ({
      background: 'radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.08) 0%, rgba(0, 0, 0, 0.45) 100%)',
      mixBlendMode: 'multiply',
      opacity: intensity / 100,
    }),
    previewThumbnailColor: 'linear-gradient(135deg, #FFFFFF, #1F2937)',
  },
  {
    id: 'cyber',
    name: 'Cyberpunk',
    badge: 'Cyber Blue',
    description: 'Futuristic electric cyan and violet matrix split-tone grading',
    cssFilter: (intensity) => {
      const factor = intensity / 100;
      return `contrast(${1 + factor * 0.3}) saturate(${1 + factor * 0.8}) hue-rotate(${factor * 35}deg)`;
    },
    overlayStyle: (intensity) => ({
      background: 'radial-gradient(circle at 80% 20%, rgba(6, 182, 212, 0.3) 0%, rgba(147, 51, 234, 0.2) 60%, transparent 100%)',
      mixBlendMode: 'color-dodge',
      opacity: intensity / 100,
    }),
    previewThumbnailColor: 'linear-gradient(135deg, #06B6D4, #7928CA)',
  },
  {
    id: 'sunset',
    name: 'Sunset Amber',
    badge: 'Golden Hour',
    description: 'Radiant golden hour amber hues with warm rose ambient glow',
    cssFilter: (intensity) => {
      const factor = intensity / 100;
      return `sepia(${factor * 0.35}) saturate(${1 + factor * 0.4}) brightness(${1 + factor * 0.08})`;
    },
    overlayStyle: (intensity) => ({
      background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.25) 0%, rgba(225, 29, 72, 0.2) 100%)',
      mixBlendMode: 'overlay',
      opacity: intensity / 100,
    }),
    previewThumbnailColor: 'linear-gradient(135deg, #F59E0B, #E11D48)',
  },
];

interface CameraFilterOverlayProps {
  activePresetId: FilterPresetId;
  intensity: number;
  isOverlayOpen: boolean;
  onSelectPreset: (presetId: FilterPresetId) => void;
  onChangeIntensity: (value: number) => void;
  onClose: () => void;
}

/**
 * CameraFilterOverlay
 * Visual aesthetic color grading layer + Interactive control drawer
 */
export const CameraFilterOverlay: React.FC<CameraFilterOverlayProps> = ({
  activePresetId,
  intensity,
  isOverlayOpen,
  onSelectPreset,
  onChangeIntensity,
  onClose,
}) => {
  const currentPreset =
    CAMERA_FILTER_PRESETS.find((p) => p.id === activePresetId) || CAMERA_FILTER_PRESETS[0];

  return (
    <>
      {/* 1. Visual Blend Overlay Layer applied directly over the video canvas */}
      {currentPreset.overlayStyle && (
        <div
          className="absolute inset-0 pointer-events-none transition-all duration-300 z-10"
          style={currentPreset.overlayStyle(intensity)}
        />
      )}

      {/* Subtle Cinematic Vignette for styled filters */}
      {currentPreset.id !== 'normal' && (
        <div
          className="absolute inset-0 pointer-events-none z-10 transition-opacity duration-300"
          style={{
            background: 'radial-gradient(circle at 50% 50%, transparent 60%, rgba(0, 0, 0, 0.55) 100%)',
            opacity: (intensity / 100) * 0.7,
          }}
        />
      )}

      {/* Active Filter Pill Badge (Tap to reopen drawer) */}
      {currentPreset.id !== 'normal' && !isOverlayOpen && (
        <div className="absolute top-16 left-4 z-20 pointer-events-auto">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-[10px] font-bold text-white shadow-lg animate-fade-in">
            <Sparkles className="w-3 h-3 text-[#EC4899] animate-pulse" />
            <span>{currentPreset.name}</span>
            <span className="text-zinc-400 font-mono">({intensity}%)</span>
          </div>
        </div>
      )}

      {/* 2. Interactive Filter Selector Drawer */}
      {isOverlayOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex flex-col justify-end pointer-events-auto animate-fade-in">
          {/* Backdrop Click Dismiss */}
          <div className="flex-1" onClick={onClose} />

          <div
            className="w-full max-w-md mx-auto rounded-t-3xl bg-[#140D26] border-t border-[#A855F7]/30 p-4 pb-6 shadow-2xl animate-slide-up select-none"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#A855F7]/15">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#7928CA] to-[#EC4899] flex items-center justify-center text-white shadow-md">
                  <Wand2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <span>Camera Color Grading</span>
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Aesthetic live broadcast presets
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {currentPreset.id !== 'normal' && (
                  <button
                    onClick={() => {
                      onSelectPreset('normal');
                      onChangeIntensity(100);
                    }}
                    className="px-2.5 py-1 rounded-full bg-[#20143B] text-[10px] font-semibold text-zinc-300 hover:text-white border border-white/10"
                  >
                    Reset
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-[#1C1236] flex items-center justify-center text-zinc-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Presets Horizontal Carousel / Grid */}
            <div className="py-4">
              <div className="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-none px-1">
                {CAMERA_FILTER_PRESETS.map((preset) => {
                  const isSelected = activePresetId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      onClick={() => onSelectPreset(preset.id)}
                      className="flex flex-col items-center gap-1.5 shrink-0 group cursor-pointer focus:outline-none"
                    >
                      {/* Preset Mini Canvas Thumbnail */}
                      <div
                        className={`relative w-16 h-20 rounded-2xl p-[2px] transition-all transform ${
                          isSelected
                            ? 'bg-gradient-to-b from-[#A855F7] via-[#EC4899] to-[#F59E0B] scale-105 shadow-lg shadow-[#7928CA]/50'
                            : 'bg-zinc-800 hover:scale-102 border border-white/10'
                        }`}
                      >
                        <div
                          className="w-full h-full rounded-[14px] overflow-hidden flex flex-col justify-between p-1.5"
                          style={{ background: preset.previewThumbnailColor }}
                        >
                          <div className="flex justify-end">
                            {isSelected && (
                              <div className="w-4 h-4 rounded-full bg-[#EC4899] flex items-center justify-center shadow-md">
                                <Check className="w-2.5 h-2.5 text-white stroke-[3]" />
                              </div>
                            )}
                          </div>
                          <span className="text-[9px] font-black uppercase text-white drop-shadow tracking-wider text-center">
                            {preset.name}
                          </span>
                        </div>
                      </div>

                      <span
                        className={`text-[11px] font-semibold transition-colors ${
                          isSelected ? 'text-[#EC4899]' : 'text-zinc-400 group-hover:text-zinc-200'
                        }`}
                      >
                        {preset.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Intensity Slider (Enabled for graded filters) */}
            {currentPreset.id !== 'normal' ? (
              <div className="pt-2 px-1">
                <div className="flex items-center justify-between text-xs font-semibold mb-2">
                  <div className="flex items-center gap-1.5 text-zinc-300">
                    <Sliders className="w-3.5 h-3.5 text-[#C084FC]" />
                    <span>Grading Intensity</span>
                  </div>
                  <span className="font-mono text-amber-300 font-bold">{intensity}%</span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-zinc-500 font-medium">Mild</span>
                  <input
                    type="range"
                    min={20}
                    max={100}
                    step={1}
                    value={intensity}
                    onChange={(e) => onChangeIntensity(Number(e.target.value))}
                    className="flex-1 h-2 bg-[#20153D] rounded-lg appearance-none cursor-pointer accent-[#EC4899]"
                  />
                  <span className="text-[10px] text-zinc-500 font-medium">Vivid</span>
                </div>

                {/* Preset Description */}
                <p className="mt-3 text-[11px] text-zinc-400 bg-[#191030] p-2 rounded-xl border border-white/5">
                  <span className="font-bold text-white">{currentPreset.badge}:</span>{' '}
                  {currentPreset.description}
                </p>
              </div>
            ) : (
              <div className="py-2 px-3 rounded-xl bg-[#181030] border border-white/5 text-center text-xs text-zinc-400">
                ✨ Original sensor mode — Select a preset above to apply real-time aesthetic color grading.
              </div>
            )}

            {/* Quick Presets Shortcuts: Neon, Soft, Black & White */}
            <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-[#A855F7]/15">
              {(['neon', 'soft', 'bw'] as const).map((id) => {
                const isSelected = activePresetId === id;
                const label = id === 'neon' ? 'Neon' : id === 'soft' ? 'Soft' : 'Black & White';
                return (
                  <button
                    key={id}
                    onClick={() => {
                      onSelectPreset(id);
                      if (activePresetId !== id) onChangeIntensity(100);
                    }}
                    className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white shadow-md'
                        : 'bg-[#1C1236] text-zinc-300 hover:text-white border border-white/5'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
