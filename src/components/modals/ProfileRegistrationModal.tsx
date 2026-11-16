import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { compressImage } from '../../utils/imageCompressor';
import {
  Camera,
  Image as ImageIcon,
  User as UserIcon,
  AtSign,
  Calendar,
  FileText,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Users,
  Check,
  Loader2,
} from 'lucide-react';

const PRESET_DP_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=400&q=80',
];

function computeAgeFromDob(dobStr: string): number {
  if (!dobStr) return 22;
  const birth = new Date(dobStr);
  if (Number.isNaN(birth.getTime())) return 22;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }
  return Math.max(1, age);
}

function buildDobFromAge(targetAge: number, existingDob: string): string {
  const safeAge = Math.min(99, Math.max(18, Math.floor(targetAge || 22)));
  const now = new Date();
  const targetYear = now.getFullYear() - safeAge;
  const parts = existingDob.split('-');
  const month = parts[1] && /^\d{2}$/.test(parts[1]) ? parts[1] : '06';
  const day = parts[2] && /^\d{2}$/.test(parts[2]) ? parts[2] : '15';
  return `${targetYear}-${month}-${day}`;
}

export const ProfileRegistrationModal: React.FC = () => {
  const {
    currentScreen,
    isAuthenticated,
    firebaseUser,
    isEmailVerified,
    currentUser,
    needsProfileRegistration,
    completeInAppProfileRegistration,
    checkUsernameAvailable,
    savedAccounts,
    setShowAccountSwitcherModal,
  } = useApp();

  const isExcludedScreen =
    currentScreen === 'splash' ||
    currentScreen === 'welcome' ||
    currentScreen === 'register' ||
    currentScreen === 'signin' ||
    currentScreen === 'privacy_policy' ||
    currentScreen === 'terms_conditions' ||
    currentScreen === 'delete_account' ||
    currentScreen === 'account_recovery';

  const isOpen = Boolean(
    isAuthenticated &&
      firebaseUser &&
      isEmailVerified &&
      needsProfileRegistration &&
      !isExcludedScreen
  );

  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [avatar, setAvatar] = useState<string>(currentUser.avatar || PRESET_DP_AVATARS[0]);
  const [displayName, setDisplayName] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('male');
  const [dob, setDob] = useState<string>('2002-06-15');
  const [ageInput, setAgeInput] = useState<string>('24');
  const [bio, setBio] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);

  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [isUploadingDp, setIsUploadingDp] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const requiresPasswordCreation = !currentUser.hasPassword;

  // Hydrate initial form values whenever the active unregistered UID changes
  useEffect(() => {
    if (!isOpen || !firebaseUser?.uid) return;
    setAvatar(currentUser.avatar || firebaseUser.photoURL || PRESET_DP_AVATARS[0]);
    const initialName =
      currentUser.displayName && currentUser.displayName !== 'Alpha Mate'
        ? currentUser.displayName
        : firebaseUser.displayName || '';
    setDisplayName(initialName);
    const initialUsername = (currentUser.username || '')
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '');
    setUsername(initialUsername);
    const initialDob = currentUser.dob || '2002-06-15';
    setDob(initialDob);
    setAgeInput(String(currentUser.age || computeAgeFromDob(initialDob)));
    if (
      currentUser.gender === 'male' ||
      currentUser.gender === 'female' ||
      currentUser.gender === 'other'
    ) {
      setGender(currentUser.gender);
    }
    const defaultTemplateBio = '🌟 Alpha Mate VIP Member | LIVE • PARTY • SOCIAL 💜';
    setBio(
      currentUser.bio && currentUser.bio !== defaultTemplateBio ? currentUser.bio : ''
    );
    setPassword('');
    setConfirmPassword('');
    setErrorMessage('');
  }, [isOpen, firebaseUser?.uid]);

  // Live debounced username availability check
  useEffect(() => {
    if (!isOpen) return;
    const clean = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (clean.length < 3) {
      setUsernameStatus('idle');
      return;
    }
    let cancelled = false;
    setUsernameStatus('checking');
    const timer = window.setTimeout(async () => {
      const ok = await checkUsernameAvailable(clean);
      if (!cancelled) {
        setUsernameStatus(ok ? 'available' : 'taken');
      }
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [username, isOpen, checkUsernameAvailable]);

  if (!isOpen) return null;

  const handleDpFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingDp(true);
    setErrorMessage('');
    try {
      const compressed = await compressImage(file, 420, 420, 0.78);
      setAvatar(compressed);
    } catch {
      setErrorMessage('Could not process selected photo. Please try another image.');
    } finally {
      setIsUploadingDp(false);
      e.target.value = '';
    }
  };

  const handleDobChange = (nextDob: string) => {
    setDob(nextDob);
    if (nextDob) {
      const calculated = computeAgeFromDob(nextDob);
      setAgeInput(String(calculated));
    }
  };

  const handleAgeChange = (rawVal: string) => {
    const digits = rawVal.replace(/\D/g, '').slice(0, 2);
    setAgeInput(digits);
    const num = Number(digits);
    if (num >= 18 && num <= 99) {
      setDob(buildDobFromAge(num, dob));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const cleanName = displayName.trim();
    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    const numericAge = Number(ageInput) || computeAgeFromDob(dob);

    if (cleanName.length < 2) {
      setErrorMessage('Please enter your Name (at least 2 characters).');
      return;
    }
    if (cleanUsername.length < 3) {
      setErrorMessage('Username must be at least 3 letters or numbers.');
      return;
    }
    if (usernameStatus === 'taken') {
      setErrorMessage(`@${cleanUsername} is already in use. Please pick another username.`);
      return;
    }
    if (!dob || numericAge < 18) {
      setErrorMessage('You must be 18 years or older to register on Alpha Mate.');
      return;
    }
    if (!bio.trim()) {
      setErrorMessage('Please write a short profile description / bio.');
      return;
    }

    if (requiresPasswordCreation) {
      if (password.length < 6) {
        setErrorMessage('Please create a password with at least 6 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage('Password and Confirm Password do not match.');
        return;
      }
    }

    setIsSaving(true);
    try {
      const res = await completeInAppProfileRegistration({
        avatar,
        displayName: cleanName,
        username: cleanUsername,
        gender,
        dob,
        age: numericAge,
        bio: bio.trim(),
        password: requiresPasswordCreation ? password : undefined,
      });
      if (!res.success) {
        setErrorMessage(res.error || 'Could not save your registration details. Please try again.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Registration failed. Please check your connection.');
    } finally {
      setIsSaving(false);
    }
  };

  const maxAdultDate = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 18);
    return d.toISOString().split('T')[0];
  })();

  return (
    <div className="fixed inset-0 z-50 bg-[#09070F]/95 backdrop-blur-xl flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleDpFileChange}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={handleDpFileChange}
      />

      <div className="w-full max-w-md max-h-[92dvh] overflow-y-auto scrollbar-none rounded-3xl bg-[#120B22] border border-[#A855F7]/35 shadow-2xl shadow-[#7928CA]/30 p-5 text-white my-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-3.5 border-b border-white/10">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#C084FC]">
              Complete Official Profile
            </p>
            <h2 className="text-lg font-black text-white mt-0.5">
              Set Up Your Alpha Mate ID
            </h2>
            <p className="text-[11px] text-zinc-400 mt-0.5 truncate max-w-[250px]">
              {firebaseUser?.email || currentUser.email} &bull; ID: {currentUser.uniqueId}
            </p>
          </div>

          {savedAccounts.length > 1 && (
            <button
              type="button"
              onClick={() => setShowAccountSwitcherModal(true)}
              className="min-h-[44px] px-3 rounded-xl bg-[#1E1338] hover:bg-[#28194A] border border-[#A855F7]/30 text-[11px] font-bold text-purple-200 flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <Users className="w-3.5 h-3.5 text-[#EC4899]" />
              <span>Switch</span>
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/40 text-rose-200 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* DP / Profile Picture Section */}
          <div className="p-3.5 rounded-2xl bg-[#170F2C] border border-white/10">
            <div className="flex items-center gap-4">
              <div className="relative w-20 h-20 rounded-full p-0.5 bg-gradient-to-tr from-[#7928CA] via-[#A855F7] to-[#EC4899] shrink-0">
                <img
                  src={avatar}
                  alt="Profile DP"
                  referrerPolicy="no-referrer"
                  className="w-full h-full rounded-full object-cover bg-[#09070F]"
                />
                {isUploadingDp && (
                  <div className="absolute inset-0 rounded-full bg-black/70 flex items-center justify-center">
                    <Loader2 className="w-5 h-5 text-white animate-spin" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0 space-y-2">
                <div>
                  <span className="text-xs font-bold text-white block">
                    Select Profile Picture (DP)
                  </span>
                  <span className="text-[11px] text-zinc-400">
                    Upload from Gallery, Camera, or pick below
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    className="flex-1 min-h-[44px] px-3 rounded-xl bg-[#251745] hover:bg-[#311E5B] border border-[#A855F7]/40 text-xs font-bold text-white flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <ImageIcon className="w-3.5 h-3.5 text-[#C084FC]" />
                    <span>Gallery</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex-1 min-h-[44px] px-3 rounded-xl bg-[#251745] hover:bg-[#311E5B] border border-[#EC4899]/40 text-xs font-bold text-white flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5 text-[#EC4899]" />
                    <span>Camera</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Preset Avatars */}
            <div className="grid grid-cols-6 gap-2 mt-3 pt-3 border-t border-white/5">
              {PRESET_DP_AVATARS.map((presetUrl, idx) => {
                const selected = avatar === presetUrl;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setAvatar(presetUrl)}
                    className={`relative aspect-square min-h-[44px] rounded-xl overflow-hidden border-2 transition cursor-pointer ${
                      selected
                        ? 'border-[#EC4899] shadow-md shadow-[#EC4899]/40'
                        : 'border-white/10 opacity-75 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={presetUrl}
                      alt={`Avatar option ${idx + 1}`}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    {selected && (
                      <span className="absolute inset-0 bg-[#EC4899]/25 flex items-center justify-center">
                        <Check className="w-4 h-4 text-white stroke-[3]" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Display Name */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-purple-200">
                Full Name / Display Name
              </label>
              <span className="text-[10px] text-zinc-500">Changes every 7 days later</span>
            </div>
            <div className="relative">
              <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                maxLength={32}
                placeholder="Enter your display name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full min-h-[44px] pl-10 pr-3.5 rounded-xl bg-[#18102E] border border-[#A855F7]/30 text-white placeholder-zinc-500 text-xs sm:text-sm focus:border-[#EC4899] focus:outline-none"
              />
            </div>
          </div>

          {/* Unique Username */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-purple-200">
                Unique Username
              </label>
              <span className="text-[10px] text-zinc-500">Changes every 30 days later</span>
            </div>
            <div className="relative">
              <AtSign className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                maxLength={24}
                placeholder="username"
                value={username}
                onChange={(e) =>
                  setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))
                }
                className="w-full min-h-[44px] pl-10 pr-24 rounded-xl bg-[#18102E] border border-[#A855F7]/30 text-white placeholder-zinc-500 text-xs sm:text-sm focus:border-[#EC4899] focus:outline-none"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold">
                {usernameStatus === 'checking' && (
                  <span className="text-zinc-400">Checking...</span>
                )}
                {usernameStatus === 'available' && (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Available
                  </span>
                )}
                {usernameStatus === 'taken' && (
                  <span className="text-rose-400">Taken</span>
                )}
              </div>
            </div>
          </div>

          {/* Gender Selection */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-purple-200 block mb-1.5">
              Select Gender
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'male', label: 'Male' },
                  { id: 'female', label: 'Female' },
                  { id: 'other', label: 'Other' },
                ] as const
              ).map((opt) => {
                const active = gender === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setGender(opt.id)}
                    className={`min-h-[44px] rounded-xl border text-xs font-bold transition cursor-pointer ${
                      active
                        ? 'bg-gradient-to-r from-[#7928CA] to-[#EC4899] border-[#EC4899] text-white shadow-md shadow-[#7928CA]/30'
                        : 'bg-[#18102E] border-white/10 text-zinc-300 hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Age & Date of Birth (18+) */}
          <div className="grid grid-cols-3 gap-2.5">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-purple-200 block mb-1">
                Age (18+)
              </label>
              <input
                type="number"
                min={18}
                max={99}
                value={ageInput}
                onChange={(e) => handleAgeChange(e.target.value)}
                className="w-full min-h-[44px] px-3 rounded-xl bg-[#18102E] border border-[#A855F7]/30 text-white text-center font-bold text-sm focus:border-[#EC4899] focus:outline-none"
              />
            </div>
            <div className="col-span-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-purple-200 block mb-1">
                Date of Birth
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                <input
                  type="date"
                  max={maxAdultDate}
                  value={dob}
                  onChange={(e) => handleDobChange(e.target.value)}
                  className="w-full min-h-[44px] pl-9 pr-3 rounded-xl bg-[#18102E] border border-[#A855F7]/30 text-white text-xs focus:border-[#EC4899] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Description / Bio */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-purple-200 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-[#C084FC]" />
                <span>Description / Bio</span>
              </label>
              <span className="text-[10px] text-zinc-500">{bio.length}/160</span>
            </div>
            <textarea
              rows={2}
              maxLength={160}
              placeholder="Tell everyone about yourself, music, live streams & party vibes..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full p-3 rounded-xl bg-[#18102E] border border-[#A855F7]/30 text-white placeholder-zinc-500 text-xs leading-relaxed resize-none focus:border-[#EC4899] focus:outline-none"
            />
          </div>

          {/* Create Password for Google Sign-Up Users so both Password & Google open the exact same ID */}
          {requiresPasswordCreation && (
            <div className="p-3.5 rounded-2xl bg-[#18102E] border border-[#A855F7]/35 space-y-2.5">
              <div>
                <p className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-[#EC4899]" />
                  <span>Create Account Password</span>
                </p>
                <p className="text-[11px] text-zinc-400 mt-0.5 leading-snug">
                  Save a password so next time you can open this exact same ID via either{' '}
                  <strong className="text-purple-200">Email + Password</strong> or{' '}
                  <strong className="text-purple-200">Continue with Google</strong>.
                </p>
              </div>

              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Create password (min 6 characters)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full min-h-[44px] pl-10 pr-11 rounded-xl bg-[#110A22] border border-white/15 text-white placeholder-zinc-500 text-xs focus:border-[#EC4899] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full min-h-[44px] pl-10 pr-3.5 rounded-xl bg-[#110A22] border border-white/15 text-white placeholder-zinc-500 text-xs focus:border-[#EC4899] focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Save Permanent Profile Button */}
          <button
            type="submit"
            disabled={isSaving || isUploadingDp}
            className="w-full min-h-[48px] rounded-2xl bg-gradient-to-r from-[#7928CA] via-[#9333EA] to-[#EC4899] text-white font-extrabold text-sm shadow-xl shadow-[#7928CA]/40 hover:brightness-105 active:scale-[0.99] transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving Permanent Profile...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Save Profile &amp; Enter Alpha Mate</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
