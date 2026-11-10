import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Image as ImageIcon,
  Send,
  Music,
  Check,
  Type,
  Smile,
} from 'lucide-react';
import { User } from '../../types';

interface CreateStoryModalProps {
  currentUser: User;
  onClose: () => void;
  onSubmit: (story: {
    mediaUrl: string;
    caption?: string;
    musicTitle?: string;
    backgroundColor?: string;
    stickers?: string[];
  }) => void;
}

const SAMPLE_STORY_IMAGES = [
  {
    title: 'Neon Chill',
    url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80',
  },
  {
    title: 'Party Lights',
    url: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=800&q=80',
  },
  {
    title: 'City Sunset',
    url: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=800&q=80',
  },
  {
    title: 'Stage Concert',
    url: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=800&q=80',
  },
  {
    title: 'Coffee & Books',
    url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=800&q=80',
  },
  {
    title: 'Cyber Studio',
    url: 'https://images.unsplash.com/photo-1547153760-18fc86324498?auto=format&fit=crop&w=800&q=80',
  },
];

const BACKGROUND_GRADIENTS = [
  'from-[#7928CA] via-[#1A0B2E] to-[#EC4899]',
  'from-[#06B6D4] via-[#0F172A] to-[#3B82F6]',
  'from-[#F59E0B] via-[#451A03] to-[#EF4444]',
  'from-[#10B981] via-[#064E3B] to-[#047857]',
  'from-[#8B5CF6] via-[#2E1065] to-[#D946EF]',
];

const MUSIC_PRESETS = [
  'Alpha Beats - Cyber Neon Chill',
  'DJ Kairo - Midnight Bass Drop 🔥',
  'Luna Star - Golden Acoustic Melody',
  'Acoustic Nights - Relaxing Lo-Fi',
  'Club Anthem - 128 BPM Party Drop',
];

const STICKER_PRESETS = ['🔥 VIBE', '✨ MOOD', '👑 VIP', '🎉 PARTY', '💖 LOVE', '⚡ ALPHA'];

export const CreateStoryModal: React.FC<CreateStoryModalProps> = ({
  currentUser,
  onClose,
  onSubmit,
}) => {
  const [selectedImage, setSelectedImage] = useState<string>(SAMPLE_STORY_IMAGES[0].url);
  const [caption, setCaption] = useState('');
  const [selectedMusic, setSelectedMusic] = useState<string>(MUSIC_PRESETS[0]);
  const [selectedGradient, setSelectedGradient] = useState<string>(BACKGROUND_GRADIENTS[0]);
  const [activeSticker, setActiveSticker] = useState<string | null>('🔥 VIBE');
  const [customImageUrl, setCustomImageUrl] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalMediaUrl = customImageUrl.trim() || selectedImage;
    onSubmit({
      mediaUrl: finalMediaUrl,
      caption: caption.trim() || undefined,
      musicTitle: selectedMusic || undefined,
      backgroundColor: selectedGradient,
      stickers: activeSticker ? [activeSticker] : undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
      <div className="relative w-full max-w-md bg-[#130E26] border border-[#A855F7]/30 rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 border-b border-[#A855F7]/15 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#7928CA] to-[#EC4899] flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-white font-bold text-sm">Add New Story</h3>
              <p className="text-[10px] text-zinc-400">Share a moment with your friends (24h)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4 overflow-y-auto scrollbar-none">
          {/* Story Preview Card */}
          <div className="relative w-full h-56 rounded-2xl overflow-hidden border border-white/10 shadow-lg group">
            <img
              src={customImageUrl.trim() || selectedImage}
              alt="Story Preview"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 pointer-events-none" />

            {/* Top Author Preview */}
            <div className="absolute top-3 left-3 flex items-center gap-2 z-10">
              <img
                src={currentUser.avatar}
                alt={currentUser.displayName}
                className="w-7 h-7 rounded-full object-cover border border-white/40"
              />
              <span className="text-white text-xs font-bold drop-shadow">You</span>
            </div>

            {/* Sticker Pill Preview */}
            {activeSticker && (
              <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-white text-xs font-extrabold shadow">
                {activeSticker}
              </div>
            )}

            {/* Bottom Caption & Music Preview */}
            <div className="absolute bottom-3 left-3 right-3 z-10 space-y-1">
              {caption.trim() && (
                <p className="text-white text-xs font-semibold leading-tight drop-shadow line-clamp-2">
                  {caption}
                </p>
              )}
              {selectedMusic && (
                <div className="flex items-center gap-1.5 text-[10px] text-zinc-300">
                  <Music className="w-3 h-3 text-[#C084FC]" />
                  <span className="truncate">{selectedMusic}</span>
                </div>
              )}
            </div>
          </div>

          {/* Preset Photo Select */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                Choose Photo
              </label>
              <button
                type="button"
                onClick={() => setShowUrlInput(!showUrlInput)}
                className="text-[10px] text-[#C084FC] hover:underline font-semibold cursor-pointer"
              >
                {showUrlInput ? 'Use Presets' : 'Custom Image URL'}
              </button>
            </div>

            {showUrlInput ? (
              <input
                type="url"
                value={customImageUrl}
                onChange={(e) => setCustomImageUrl(e.target.value)}
                placeholder="Paste image URL (https://...)"
                className="w-full py-2 px-3 rounded-xl bg-[#1A1233] border border-[#A855F7]/20 text-white text-xs placeholder:text-zinc-500 focus:outline-none focus:border-[#A855F7]"
              />
            ) : (
              <div className="grid grid-cols-6 gap-2">
                {SAMPLE_STORY_IMAGES.map((img, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setSelectedImage(img.url);
                      setCustomImageUrl('');
                    }}
                    className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                      selectedImage === img.url && !customImageUrl
                        ? 'border-[#EC4899] scale-105 shadow-md shadow-pink-500/30'
                        : 'border-transparent opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={img.url} alt={img.title} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Caption Input */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5 block">
              Story Caption
            </label>
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="What's happening? (e.g. Live party tonight! 💜)"
              maxLength={120}
              className="w-full py-2.5 px-3.5 rounded-xl bg-[#1A1233] border border-[#A855F7]/20 text-white text-xs placeholder:text-zinc-500 focus:outline-none focus:border-[#A855F7]"
            />
          </div>

          {/* Stickers */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5 block">
              Add Badge / Sticker
            </label>
            <div className="flex items-center gap-1.5 flex-wrap">
              {STICKER_PRESETS.map((stk) => (
                <button
                  key={stk}
                  type="button"
                  onClick={() => setActiveSticker(activeSticker === stk ? null : stk)}
                  className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                    activeSticker === stk
                      ? 'bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white shadow-md'
                      : 'bg-[#1A1233] text-zinc-400 hover:text-white border border-[#A855F7]/15'
                  }`}
                >
                  {stk}
                </button>
              ))}
            </div>
          </div>

          {/* Background Music */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5 block">
              Background Track
            </label>
            <select
              value={selectedMusic}
              onChange={(e) => setSelectedMusic(e.target.value)}
              className="w-full py-2.5 px-3 rounded-xl bg-[#1A1233] border border-[#A855F7]/20 text-white text-xs focus:outline-none focus:border-[#A855F7] cursor-pointer"
            >
              {MUSIC_PRESETS.map((m, idx) => (
                <option key={idx} value={m} className="bg-[#1A1233] text-white">
                  🎵 {m}
                </option>
              ))}
            </select>
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-[#7928CA] via-[#A855F7] to-[#EC4899] text-white font-extrabold text-sm shadow-lg shadow-[#7928CA]/40 hover:opacity-95 transition-opacity flex items-center justify-center gap-2 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>Share to Story</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
