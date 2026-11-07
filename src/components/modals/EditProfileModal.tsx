import React, { useState, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { compressImage } from '../../utils/imageCompressor';
import {
  X,
  Camera,
  Image as ImageIcon,
  Lock,
  Check,
  AlertCircle,
  Calendar,
  Sparkles,
  Info,
  User,
  AtSign,
  HelpCircle,
  CheckCircle2,
} from 'lucide-react';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=400&q=80',
];

const STYLISH_DECORATORS = ['👑', '★', '✨', '꧁', '꧂', '💎', '⚡', '🌙', '💜', '🔥'];
const BIO_QUICK_EMOJIS = ['✨', '👑', '🎙️', '💜', '🌟', '🔥', '💫', '🎶', '🚀', '💎', '🇵🇰', '🌍'];

export const EditProfileModal: React.FC<EditProfileModalProps> = ({ isOpen, onClose }) => {
  const { currentUser, updateUserProfile } = useApp();

  const [displayName, setDisplayName] = useState(currentUser.displayName);
  const [username, setUsername] = useState(currentUser.username);
  const [bio, setBio] = useState(currentUser.bio || '');
  const [dob, setDob] = useState(currentUser.dob || '2000-01-15');
  const [avatar, setAvatar] = useState(currentUser.avatar);

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Hidden file inputs
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // --- 1. Display Name 7-Day Cooldown Check ---
  // Name can only be changed once every 7 days (7 days = 7 * 24 * 60 * 60 * 1000 ms)
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  const lastDisplayNameTime = currentUser.lastNameChangeDate
    ? new Date(currentUser.lastNameChangeDate).getTime()
    : 0;
  const now = Date.now();
  const timeSinceNameChange = now - lastDisplayNameTime;
  const isNameChangeAllowed = !currentUser.lastNameChangeDate || timeSinceNameChange >= SEVEN_DAYS_MS;
  const daysLeftForName = Math.ceil((SEVEN_DAYS_MS - timeSinceNameChange) / (24 * 60 * 60 * 1000));

  // --- 2. Username 30-Day Cooldown Check ---
  // Username can only be changed once every 30 days (1 month)
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const lastUsernameTime = currentUser.lastUsernameChangeDate
    ? new Date(currentUser.lastUsernameChangeDate).getTime()
    : 0;
  const timeSinceUsernameChange = now - lastUsernameTime;
  const isUsernameChangeAllowed = !currentUser.lastUsernameChangeDate || timeSinceUsernameChange >= THIRTY_DAYS_MS;
  const daysLeftForUsername = Math.ceil((THIRTY_DAYS_MS - timeSinceUsernameChange) / (24 * 60 * 60 * 1000));

  // Bio word count calculation (Max ~300 words)
  const bioWordsCount = bio.trim() ? bio.trim().split(/\s+/).length : 0;
  const maxWords = 300;

  // Handle Photo Selection via FileReader
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      setErrorMessage('Image size too large. Please select an image under 8MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAvatar(reader.result);
        setErrorMessage('');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAppendDecorator = (decorator: string) => {
    if (!isNameChangeAllowed) return;
    setDisplayName((prev) => prev + decorator);
  };

  const handleAppendBioEmoji = (emoji: string) => {
    setBio((prev) => prev + emoji);
  };

  // Save Profile Handler
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    // Check name change cooldown
    const isEditingName = displayName.trim() !== currentUser.displayName;
    if (isEditingName && !isNameChangeAllowed) {
      setErrorMessage(`Display Name can only be changed once every 7 days. Please wait ${daysLeftForName} more day(s).`);
      return;
    }

    // Check username change cooldown
    const isEditingUsername = username.trim().toLowerCase() !== currentUser.username.toLowerCase();
    if (isEditingUsername && !isUsernameChangeAllowed) {
      setErrorMessage(`Username can only be changed once a month (30 days). Please wait ${daysLeftForUsername} more day(s).`);
      return;
    }

    // Username formatting: strictly simple letters, numbers, and underscores (no emojis or fancy fonts)
    const cleanUsername = username.trim().toLowerCase();
    if (isEditingUsername) {
      if (!cleanUsername) {
        setErrorMessage('Username cannot be empty.');
        return;
      }
      if (!/^[a-z0-9_]{3,24}$/.test(cleanUsername)) {
        setErrorMessage('Username must be 3-24 characters, only lowercase letters, numbers, and underscores (no emojis or special symbols).');
        return;
      }
    }

    // Word count check for bio
    if (bioWordsCount > maxWords) {
      setErrorMessage(`Bio exceeds the 300 words limit (currently ${bioWordsCount} words).`);
      return;
    }

    // DOB age verification (18+)
    if (dob) {
      const birthYear = new Date(dob).getFullYear();
      const currentYear = new Date().getFullYear();
      if (currentYear - birthYear < 18) {
        setErrorMessage('Must be 18+ years of age for live streaming privileges.');
        return;
      }
    }

    setIsSaving(true);
    setTimeout(() => {
      const updates: any = {
        avatar,
        bio: bio.trim(),
        dob,
      };

      if (isEditingName) {
        updates.displayName = displayName.trim() || currentUser.displayName;
        updates.lastNameChangeDate = new Date().toISOString();
      }

      if (isEditingUsername) {
        updates.username = cleanUsername;
        updates.lastUsernameChangeDate = new Date().toISOString();
      }

      updateUserProfile(updates);
      setIsSaving(false);
      setSuccessMessage('Profile updated successfully!');
      setTimeout(() => {
        onClose();
      }, 700);
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-md max-h-[90vh] rounded-3xl bg-[#140D27] border-2 border-[#A855F7]/40 p-5 shadow-2xl shadow-purple-900/60 overflow-y-auto scrollbar-none text-white animate-scale-up">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-zinc-300 hover:text-white transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="text-center pb-3 border-b border-[#A855F7]/20">
          <h2 className="text-xl font-black text-white tracking-tight flex items-center justify-center gap-2">
            <span>Edit Profile</span>
            <Sparkles className="w-4 h-4 text-purple-400" />
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">Customize your identity, avatar, and bio</p>
        </div>

        {/* Feedback Alerts */}
        {errorMessage && (
          <div className="mt-3 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="mt-3 p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successMessage}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="mt-4 space-y-4">
          {/* ======================================================== */}
          {/* 1. PROFILE PICTURE / AVATAR (Camera & Gallery Upload) */}
          {/* ======================================================== */}
          <div className="flex flex-col items-center">
            <div className="relative group">
              <div className="w-22 h-22 rounded-full p-[2.5px] bg-gradient-to-tr from-[#7928CA] via-[#EC4899] to-[#F59E0B] shadow-lg shadow-[#7928CA]/30">
                <img src={avatar} alt="Profile" className="w-full h-full rounded-full object-cover" />
              </div>
              <div className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-[#EC4899] border-2 border-[#140D27] flex items-center justify-center text-white shadow-md">
                <Camera className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Hidden File Inputs */}
            <input
              type="file"
              ref={galleryInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
            />
            <input
              type="file"
              ref={cameraInputRef}
              accept="image/*"
              capture="user"
              className="hidden"
              onChange={handleImageUpload}
            />

            {/* Photo Action Buttons */}
            <div className="flex items-center gap-2 mt-3">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="px-3 py-1.5 rounded-xl bg-[#20153D] hover:bg-[#2B1C52] border border-[#A855F7]/30 text-xs font-bold text-white flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-sm"
              >
                <Camera className="w-3.5 h-3.5 text-pink-400" />
                <span>Take Photo</span>
              </button>

              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                className="px-3 py-1.5 rounded-xl bg-[#20153D] hover:bg-[#2B1C52] border border-[#A855F7]/30 text-xs font-bold text-white flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-sm"
              >
                <ImageIcon className="w-3.5 h-3.5 text-purple-400" />
                <span>From Gallery</span>
              </button>
            </div>

            {/* Preset Avatars Tray */}
            <div className="flex items-center gap-2 mt-2.5">
              <span className="text-[10px] text-zinc-400">Presets:</span>
              <div className="flex items-center gap-1.5">
                {PRESET_AVATARS.map((pUrl, i) => (
                  <div
                    key={i}
                    onClick={() => setAvatar(pUrl)}
                    className={`w-7 h-7 rounded-full overflow-hidden border-2 cursor-pointer transition ${
                      avatar === pUrl ? 'border-[#EC4899] scale-110' : 'border-white/20 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={pUrl} alt="preset" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ======================================================== */}
          {/* 2. DISPLAY NAME (Changes once every 7 days, Stylish Allowed) */}
          {/* ======================================================== */}
          <div className="p-3.5 rounded-2xl bg-[#1B1233]/70 border border-[#A855F7]/30">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-white flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-purple-400" />
                <span>Display Name</span>
              </label>

              {isNameChangeAllowed ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                  Change Available
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" />
                  <span>Wait {daysLeftForName}d</span>
                </span>
              )}
            </div>

            {/* Instruction Banner */}
            <p className="text-[10px] text-purple-200/80 mb-2 leading-relaxed">
              Display Name can be changed <strong>once every 7 days</strong>. Stylish names, emojis, and special characters (★ 👑 ꧁ ꧂) are fully supported!
            </p>

            <div className="relative">
              <input
                type="text"
                disabled={!isNameChangeAllowed}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter stylish display name"
                className={`w-full h-11 px-3.5 rounded-xl border text-xs sm:text-sm font-semibold transition ${
                  isNameChangeAllowed
                    ? 'bg-[#0E081D] border-[#A855F7]/40 text-white focus:border-[#EC4899] focus:outline-none'
                    : 'bg-black/30 border-zinc-700 text-zinc-400 cursor-not-allowed'
                }`}
              />
              {!isNameChangeAllowed && (
                <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              )}
            </div>

            {/* Stylish Decorators Palette (User can click to add) */}
            {isNameChangeAllowed && (
              <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-zinc-400">Stylize:</span>
                {STYLISH_DECORATORS.map((dec, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleAppendDecorator(dec)}
                    className="w-6 h-6 rounded-lg bg-white/5 hover:bg-white/15 text-xs flex items-center justify-center cursor-pointer transition border border-white/10"
                    title={`Add ${dec}`}
                  >
                    {dec}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ======================================================== */}
          {/* 3. USERNAME (Changes once a month, Simple Alphanumeric only) */}
          {/* ======================================================== */}
          <div className="p-3.5 rounded-2xl bg-[#1B1233]/70 border border-[#A855F7]/30">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-white flex items-center gap-1.5">
                <AtSign className="w-3.5 h-3.5 text-pink-400" />
                <span>Unique Username</span>
              </label>

              {isUsernameChangeAllowed ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                  Change Available
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" />
                  <span>Wait {daysLeftForUsername}d</span>
                </span>
              )}
            </div>

            {/* Instruction Banner */}
            <p className="text-[10px] text-pink-200/80 mb-2 leading-relaxed">
              Username can only be changed <strong>once a month (30 days)</strong>. Strictly simple letters, numbers, and underscores (no fancy fonts or emojis).
            </p>

            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-400">@</span>
              <input
                type="text"
                disabled={!isUsernameChangeAllowed}
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder="simple_username"
                className={`w-full h-11 pl-8 pr-3.5 rounded-xl border text-xs sm:text-sm font-mono transition ${
                  isUsernameChangeAllowed
                    ? 'bg-[#0E081D] border-[#A855F7]/40 text-white focus:border-[#EC4899] focus:outline-none'
                    : 'bg-black/30 border-zinc-700 text-zinc-400 cursor-not-allowed'
                }`}
              />
              {!isUsernameChangeAllowed && (
                <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              )}
            </div>
          </div>

          {/* ======================================================== */}
          {/* 4. BIO (Editable Anytime, ~300 Words, Urdu & English & Emojis) */}
          {/* ======================================================== */}
          <div className="p-3.5 rounded-2xl bg-[#1B1233]/70 border border-[#A855F7]/30">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>Bio / About Me (بائیو)</span>
                <span className="text-[10px] text-emerald-400 font-semibold">• Edit Anytime</span>
              </label>

              <span className={`text-[10px] font-bold ${bioWordsCount > maxWords ? 'text-rose-400' : 'text-zinc-400'}`}>
                {bioWordsCount}/{maxWords} words
              </span>
            </div>

            <p className="text-[10px] text-zinc-400 mb-2">
              Supports Urdu (اردو), English, and emojis. Share your personality with fans!
            </p>

            <textarea
              dir="auto"
              rows={4}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Write your bio in English or Urdu... مثلاً: لائیو اسٹریمر اور میوزک آرٹسٹ 💜"
              className="w-full p-3 rounded-xl bg-[#0E081D] border border-[#A855F7]/40 text-white text-xs leading-relaxed focus:border-[#EC4899] focus:outline-none resize-none"
            />

            {/* Quick Emoji Bar for Bio */}
            <div className="mt-2 flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-zinc-400">Quick Emojis:</span>
              {BIO_QUICK_EMOJIS.map((em, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleAppendBioEmoji(em)}
                  className="w-6 h-6 rounded-lg bg-white/5 hover:bg-white/15 text-xs flex items-center justify-center cursor-pointer transition border border-white/5"
                >
                  {em}
                </button>
              ))}
            </div>
          </div>

          {/* ======================================================== */}
          {/* 5. DATE OF BIRTH */}
          {/* ======================================================== */}
          <div className="p-3.5 rounded-2xl bg-[#1B1233]/70 border border-[#A855F7]/30">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-white flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                <span>Date of Birth (تاریخ پیدائش)</span>
              </label>
              <span className="text-[10px] text-zinc-400">18+ Required</span>
            </div>

            <input
              type="date"
              value={dob}
              max="2008-01-01"
              onChange={(e) => setDob(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl bg-[#0E081D] border border-[#A855F7]/40 text-white text-xs sm:text-sm focus:border-[#EC4899] focus:outline-none"
            />
          </div>

          {/* Submit Actions */}
          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-12 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 h-12 rounded-2xl bg-gradient-to-r from-[#7928CA] via-[#9333EA] to-[#EC4899] text-white text-xs font-black shadow-lg shadow-[#7928CA]/40 hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              {isSaving ? (
                <span>Saving Changes...</span>
              ) : (
                <>
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
