import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { EditProfileModal } from '../components/modals/EditProfileModal';
import { ShareProfileModal } from '../components/modals/ShareProfileModal';
import { VipAvatarFrame } from '../components/brand/VipAvatarFrame';
import { copyToClipboard } from '../utils/clipboard';
import {
  Crown,
  Copy,
  Check,
  Edit3,
  Wallet,
  Trophy,
  Users,
  Settings,
  Share2,
  Heart,
  Video,
  Gift as GiftIcon,
  Flame,
  ShieldCheck,
  Camera,
  Sparkles,
  Image as ImageIcon,
  ChevronRight,
  ChevronLeft,
  Zap,
  Award,
  CheckSquare,
  Gamepad2,
  Briefcase,
  PartyPopper,
  Shield,
  UserCheck,
  HelpCircle,
  Headphones,
  X,
  RefreshCw,
  Upload,
  Eye,
  MessageCircle,
  Play,
  Volume2,
  Radio,
  Star,
  CheckCircle2,
} from 'lucide-react';

interface CoverSlide {
  id: string;
  title: string;
  subtitle: string;
  tag: string;
  gradient: string;
  ambientColor: string;
}

const DEFAULT_COVER_SLIDES: CoverSlide[] = [
  {
    id: 'stage_dj',
    title: 'ALPHA ARENA • LIVE DJ NIGHT',
    subtitle: 'Electronic Beats & Neon Lasers',
    tag: 'NOW LIVE',
    gradient: 'from-[#3B0764] via-[#1E113A] to-[#0A0515]',
    ambientColor: '#A855F7',
  },
  {
    id: 'cyber_festival',
    title: 'CYBER METROPOLIS 2026',
    subtitle: 'PK Battle Global Championship',
    tag: 'FEATURED',
    gradient: 'from-[#4C1D95] via-[#2E1065] to-[#0B0314]',
    ambientColor: '#EC4899',
  },
  {
    id: 'royal_lounge',
    title: 'ROYAL VIP CLUB LOUNGE',
    subtitle: 'Exclusive Privileges & Golden Aura',
    tag: 'VIP ONLY',
    gradient: 'from-[#701A75] via-[#2A0845] to-[#090510]',
    ambientColor: '#F59E0B',
  },
];

export const UserProfileScreen: React.FC = () => {
  const {
    currentUser,
    setCurrentScreen,
    coins,
    diamonds,
    videos,
    updateUserProfile,
  } = useApp();

  // Navigation & Modal states
  const [activeTab, setActiveTab] = useState<'videos' | 'posts' | 'replays' | 'gifts'>('videos');
  const [copiedId, setCopiedId] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showCoverModal, setShowCoverModal] = useState(false);
  const [showExploreFeaturesModal, setShowExploreFeaturesModal] = useState(false);
  const [showShortcutModal, setShowShortcutModal] = useState<{
    type: string;
    title: string;
    description: string;
    icon: any;
    data?: any;
  } | null>(null);

  // Cover carousel states
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isCoverPaused, setIsCoverPaused] = useState(false);

  // File input refs for Cover Photo upload
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Auto-slide cover carousel every 5s unless custom cover is set or user pauses
  useEffect(() => {
    if (currentUser.coverImage || isCoverPaused) return;
    const interval = setInterval(() => {
      setCurrentSlideIndex((prev) => (prev + 1) % DEFAULT_COVER_SLIDES.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [currentUser.coverImage, isCoverPaused]);

  // ID Copy handler
  const handleCopyId = async () => {
    await copyToClipboard(currentUser.uniqueId);
    setCopiedId(true);
    showToast(`Copied ID: ${currentUser.uniqueId}`);
    setTimeout(() => setCopiedId(false), 2000);
  };

  // Cover Image File Handler (Camera or Gallery)
  const handleCoverFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          updateUserProfile({ coverImage: reader.result });
          showToast('Cover photo updated successfully!');
          setShowCoverModal(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleResetCover = () => {
    updateUserProfile({ coverImage: undefined });
    showToast('Reset to animated DJ stage cover');
    setShowCoverModal(false);
  };

  const myVideos = videos.filter((v) => v.user.id === currentUser.id || v.user.username === currentUser.username);

  // Equalizer sound bars heights animation generator
  const soundwaveHeights = [18, 36, 62, 44, 78, 55, 92, 68, 85, 42, 65, 38, 72, 50, 80, 40];

  return (
    <div className="relative w-full h-full min-h-screen pb-32 sm:pb-36 bg-[#09070F] text-white overflow-y-auto selection:bg-[#9333EA] selection:text-white">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-[#1F1138]/95 border border-[#A855F7]/40 text-white text-xs font-semibold shadow-2xl backdrop-blur-md flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Hidden file inputs for Cover change */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleCoverFileUpload}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleCoverFileUpload}
      />

      {/* =========================================================================
          SECTION 1: ANIMATED COVER BACKGROUND & CAROUSEL (TOP)
          ========================================================================= */}
      <div
        className="relative w-full h-72 sm:h-80 overflow-hidden select-none"
        onMouseEnter={() => setIsCoverPaused(true)}
        onMouseLeave={() => setIsCoverPaused(false)}
      >
        {currentUser.coverImage ? (
          /* Custom Uploaded User Cover */
          <div className="relative w-full h-full">
            <img
              src={currentUser.coverImage}
              alt="Profile Cover"
              className="w-full h-full object-cover"
            />
            {/* Dark glass overlay for text readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#09070F] via-black/40 to-black/30" />
          </div>
        ) : (
          /* Animated DJ / Music Concert Cover Slides */
          <div className="relative w-full h-full">
            {DEFAULT_COVER_SLIDES.map((slide, idx) => {
              const isActive = idx === currentSlideIndex;
              return (
                <div
                  key={slide.id}
                  className={`absolute inset-0 transition-opacity duration-1000 ease-in-out bg-gradient-to-br ${slide.gradient} ${
                    isActive ? 'opacity-100 z-10' : 'opacity-0 z-0'
                  }`}
                >
                  {/* Neon Spotlight Beams */}
                  <div className="absolute -top-10 -left-10 w-72 h-72 rounded-full bg-[#7928CA]/30 blur-3xl pointer-events-none animate-pulse" />
                  <div className="absolute top-1/4 -right-10 w-80 h-80 rounded-full bg-[#EC4899]/25 blur-3xl pointer-events-none animate-pulse" />
                  <div className="absolute -bottom-10 left-1/3 w-64 h-64 rounded-full bg-[#9333EA]/35 blur-3xl pointer-events-none" />

                  {/* Concert Grid & Laser Lines */}
                  <div
                    className="absolute inset-0 opacity-15 pointer-events-none"
                    style={{
                      backgroundImage: `radial-gradient(circle at 50% 50%, rgba(255,255,255,0.15) 1px, transparent 1px)`,
                      backgroundSize: '24px 24px',
                    }}
                  />

                  {/* DJ Stage Graphics / Equalizer Silhouette */}
                  <div className="absolute inset-x-0 bottom-0 h-40 flex items-end justify-between px-6 pointer-events-none opacity-40">
                    <div className="flex items-end gap-1.5 h-28">
                      {soundwaveHeights.map((h, i) => (
                        <div
                          key={`left-eq-${i}`}
                          className="w-1.5 rounded-t-full bg-gradient-to-t from-[#7928CA] via-[#EC4899] to-[#F59E0B]"
                          style={{
                            height: `${(h * ((i % 3) + 1.2)) % 100}%`,
                            animation: `pulse 1.${(i % 5) + 2}s infinite alternate ease-in-out`,
                          }}
                        />
                      ))}
                    </div>
                    <div className="flex items-end gap-1.5 h-28">
                      {soundwaveHeights.slice().reverse().map((h, i) => (
                        <div
                          key={`right-eq-${i}`}
                          className="w-1.5 rounded-t-full bg-gradient-to-t from-[#EC4899] via-[#9333EA] to-[#38BDF8]"
                          style={{
                            height: `${(h * ((i % 4) + 1.1)) % 100}%`,
                            animation: `pulse 1.${(i % 4) + 3}s infinite alternate ease-in-out`,
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Concert Banner Info in Slide */}
                  <div className="absolute top-16 left-5 right-5 z-20 flex items-center justify-between">
                    <div>
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-black/40 border border-white/15 backdrop-blur-md text-[10px] font-black tracking-wider text-amber-300 shadow-sm">
                        <Radio className="w-3 h-3 text-rose-500 animate-pulse" />
                        <span>{slide.tag}</span>
                      </div>
                      <h2 className="text-base sm:text-lg font-black text-white tracking-wide mt-1.5 drop-shadow-md">
                        {slide.title}
                      </h2>
                      <p className="text-xs text-zinc-300 drop-shadow flex items-center gap-1.5">
                        <Volume2 className="w-3 h-3 text-[#A855F7]" />
                        <span>{slide.subtitle}</span>
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Slide Navigation Dots (bottom right of cover) */}
            <div className="absolute bottom-16 right-5 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-md border border-white/10">
              {DEFAULT_COVER_SLIDES.map((_, i) => (
                <button
                  key={`dot-${i}`}
                  onClick={() => setCurrentSlideIndex(i)}
                  className={`transition-all rounded-full cursor-pointer ${
                    i === currentSlideIndex
                      ? 'w-4 h-1.5 bg-gradient-to-r from-[#A855F7] to-[#EC4899]'
                      : 'w-1.5 h-1.5 bg-white/40 hover:bg-white/80'
                  }`}
                  title={`Slide ${i + 1}`}
                />
              ))}
            </div>

            {/* Left / Right manual arrow buttons */}
            <button
              onClick={() =>
                setCurrentSlideIndex((prev) =>
                  prev === 0 ? DEFAULT_COVER_SLIDES.length - 1 : prev - 1
                )
              }
              className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white/70 hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() =>
                setCurrentSlideIndex((prev) => (prev + 1) % DEFAULT_COVER_SLIDES.length)
              }
              className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white/70 hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Ambient Top Shadow Bar for Navigation Controls */}
        <div className="absolute top-0 inset-x-0 h-16 bg-gradient-to-b from-black/80 via-black/30 to-transparent z-20 px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img
              src="/alpha-mate-logo-emblem.png"
              alt="Alpha Mate"
              className="w-7 h-7 object-contain drop-shadow"
            />
            <span className="text-xs font-black tracking-widest text-white uppercase drop-shadow">
              ALPHA MATE
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Working "Edit Cover" button */}
            <button
              onClick={() => setShowCoverModal(true)}
              className="px-2.5 py-1 rounded-full bg-black/50 hover:bg-black/80 border border-white/20 text-zinc-200 hover:text-white text-[11px] font-bold backdrop-blur-md flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-lg"
              title="Change Cover"
            >
              <Camera className="w-3.5 h-3.5 text-[#C084FC]" />
              <span>Edit Cover</span>
            </button>

            {/* Settings shortcut */}
            <button
              onClick={() => setCurrentScreen('settings')}
              className="w-8 h-8 rounded-full bg-black/50 hover:bg-black/80 border border-white/20 text-zinc-200 hover:text-white backdrop-blur-md flex items-center justify-center transition-all cursor-pointer shadow-lg"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Deep gradient fade at bottom to fuse smoothly into profile card */}
        <div className="absolute bottom-0 inset-x-0 h-24 bg-gradient-to-t from-[#09070F] to-transparent pointer-events-none z-10" />
      </div>

      {/* =========================================================================
          SECTION 2: FLOATING GLASSMORPHISM PROFILE CARD (OVERLAPPING -mt-16)
          ========================================================================= */}
      <div className="relative z-20 px-4 -mt-16">
        <div className="rounded-3xl p-5 bg-[#120B22]/90 backdrop-blur-xl border border-[#A855F7]/30 shadow-2xl shadow-[#7928CA]/20">
          {/* Top row inside card: Avatar with glowing border & Action Buttons */}
          <div className="flex items-end justify-between -mt-12 sm:-mt-14">
            {/* Circular Avatar with Glowing VIP Halo & Camera Badge */}
            <div className="relative group">
              <VipAvatarFrame
                avatarUrl={currentUser.avatar}
                vipTier={currentUser.vipTier}
                size="xl"
                showCrownBadge={true}
              />

              {/* Camera click badge to trigger Avatar update in EditProfileModal */}
              <button
                onClick={() => setShowEditModal(true)}
                className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-gradient-to-tr from-[#7928CA] to-[#EC4899] border-2 border-[#120B22] flex items-center justify-center text-white shadow-lg hover:scale-110 active:scale-95 transition-all cursor-pointer"
                title="Change Avatar"
              >
                <Camera className="w-4 h-4" />
              </button>

              {/* Online Pulse Dot */}
              <div className="absolute top-1 right-1 flex items-center">
                <span className="relative flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-[#120B22]" />
                </span>
              </div>
            </div>

            {/* Quick Action Buttons: Edit Profile & Share Profile */}
            <div className="flex items-center gap-1.5 sm:gap-2 mb-1 shrink-0">
              <button
                onClick={() => setShowEditModal(true)}
                className="px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-[#231542] hover:bg-[#2F1C58] border border-[#A855F7]/35 text-[11px] sm:text-xs font-bold text-white shadow-md active:scale-95 transition-all flex items-center gap-1 sm:gap-1.5 cursor-pointer shrink-0"
              >
                <Edit3 className="w-3.5 h-3.5 text-[#C084FC]" />
                <span>Edit Profile</span>
              </button>

              <button
                onClick={() => setShowShareModal(true)}
                className="px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-[11px] sm:text-xs font-bold text-white shadow-lg shadow-[#EC4899]/25 hover:brightness-110 active:scale-95 transition-all flex items-center gap-1 sm:gap-1.5 cursor-pointer shrink-0"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share</span>
              </button>
            </div>
          </div>

          {/* Profile Identity Details */}
          <div className="mt-3.5">
            {/* Display Name with Crown & Verified Shield */}
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-black text-white tracking-tight flex items-center gap-1.5">
                <span>{currentUser.displayName}</span>
              </h1>
              {currentUser.isVerified && (
                <div title="Verified Alpha Creator">
                  <ShieldCheck className="w-5 h-5 text-[#A855F7] fill-[#A855F7]/20" />
                </div>
              )}
              {currentUser.vipTier > 0 && (
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-400/20 to-amber-600/20 border border-amber-400/40 text-[10px] font-black text-amber-300">
                  <Crown className="w-3 h-3 text-amber-400" />
                  <span>VIP {currentUser.vipTier}</span>
                </div>
              )}
            </div>

            {/* Unique ID & Username with Copy Button */}
            <div className="flex items-center gap-3 text-xs text-zinc-400 mt-1 flex-wrap">
              <span className="font-medium text-zinc-300">@{currentUser.username}</span>
              <span className="text-zinc-600">•</span>
              <button
                onClick={handleCopyId}
                className="inline-flex items-center gap-1.5 text-[#C084FC] hover:text-white transition-colors cursor-pointer font-mono bg-purple-950/40 px-2 py-0.5 rounded-md border border-purple-500/20"
                title="Tap to copy ID"
              >
                <span>ID: {currentUser.uniqueId}</span>
                {copiedId ? (
                  <Check className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Copy className="w-3 h-3 opacity-80" />
                )}
              </button>
            </div>

            {/* Demographics Badges: Country Flag, Gender & Age, Level, Status */}
            <div className="flex items-center gap-2 mt-2.5 flex-wrap text-[11px]">
              {/* Country Badge */}
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#1F1538] border border-white/10 text-zinc-300 font-semibold">
                <span>{currentUser.countryFlag || '🇵🇰'}</span>
                <span>{currentUser.country || 'Pakistan'}</span>
              </span>

              {/* Gender & Age Badge */}
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-950/40 border border-blue-500/30 text-blue-300 font-bold">
                <span>{currentUser.gender === 'female' ? '♀' : '♂'}</span>
                <span>{currentUser.age || 24}</span>
              </span>

              {/* Honor Level Badge */}
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-gradient-to-r from-[#7928CA]/30 to-[#9333EA]/30 border border-[#9333EA]/40 text-[#C084FC] font-black">
                <Zap className="w-3 h-3 text-amber-400 fill-amber-400" />
                <span>Lv.{currentUser.level}</span>
              </span>

              {/* Online State Pill */}
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 font-semibold text-[10px]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Online</span>
              </span>
            </div>

            {/* Bio with multi-language & Urdu RTL/LTR auto detection */}
            <p
              dir="auto"
              className="text-xs text-zinc-300 mt-3 leading-relaxed break-words whitespace-pre-wrap bg-black/20 p-2.5 rounded-xl border border-white/5"
            >
              {currentUser.bio}
            </p>

            {/* Interactive Level & VIP Status Bar (Direct link to 1-100 Levels & 12 VIPs) */}
            <div
              onClick={() => setCurrentScreen('levels')}
              className="mt-3 p-3 rounded-2xl bg-gradient-to-r from-[#1C0F35] via-[#2A144E] to-[#150B28] border border-[#A855F7]/30 hover:border-[#EC4899]/50 shadow-md cursor-pointer transition-all active:scale-[0.99] group"
              title="Open Levels & VIP Roadmap"
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#7928CA] to-[#EC4899] flex items-center justify-center shadow-xs">
                    <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black text-white">Level {currentUser.level}</span>
                      <span className="text-[10px] text-zinc-400">/ 100</span>
                      <span className="px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 text-[9px] font-black border border-amber-400/30">
                        VIP {currentUser.vipTier}
                      </span>
                    </div>
                    <p className="text-[10px] text-[#C084FC] font-semibold">
                      {currentUser.level < 100
                        ? `Level ${currentUser.level + 1} Roadmap • Tap to view all 100 levels`
                        : 'Alpha Emperor Prestige Master'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-[11px] font-bold text-[#EC4899] group-hover:translate-x-0.5 transition-transform">
                  <span>View Roadmap</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full h-1.5 rounded-full bg-black/60 overflow-hidden border border-white/5">
                <div
                  className="h-full bg-gradient-to-r from-[#7928CA] via-[#A855F7] to-[#EC4899] rounded-full"
                  style={{ width: `${Math.min(100, Math.max(15, (currentUser.level % 8) * 12.5))}%` }}
                />
              </div>
            </div>

            {/* Family / Crew Badge if present */}
            {currentUser.familyCrew && (
              <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-gradient-to-r from-[#EC4899]/15 to-[#7928CA]/15 border border-[#EC4899]/30 text-xs font-bold text-[#EC4899]">
                <Flame className="w-3.5 h-3.5 fill-[#EC4899]" />
                <span className="text-zinc-400 text-[11px]">Crew:</span>
                <span className="text-white">{currentUser.familyCrew}</span>
              </div>
            )}
          </div>

          {/* =========================================================================
              PROFILE STATISTICS: Friends, Following, Followers, Visitors
              ========================================================================= */}
          <div className="grid grid-cols-4 gap-1 mt-4 pt-4 border-t border-[#A855F7]/20 text-center">
            <button
              onClick={() => showToast(`Friends: ${(currentUser.friendsCount || 342).toLocaleString()}`)}
              className="p-1 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
            >
              <div className="text-base sm:text-lg font-black text-white tabular-nums">
                {(currentUser.friendsCount || 342).toLocaleString()}
              </div>
              <div className="text-[10px] text-zinc-400 font-semibold tracking-wider uppercase mt-0.5">
                Friends
              </div>
            </button>

            <button
              onClick={() => showToast(`Following: ${currentUser.followingCount.toLocaleString()} creators`)}
              className="p-1 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
            >
              <div className="text-base sm:text-lg font-black text-white tabular-nums">
                {currentUser.followingCount.toLocaleString()}
              </div>
              <div className="text-[10px] text-zinc-400 font-semibold tracking-wider uppercase mt-0.5">
                Following
              </div>
            </button>

            <button
              onClick={() => showToast(`Followers: ${currentUser.followersCount.toLocaleString()} fans`)}
              className="p-1 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
            >
              <div className="text-base sm:text-lg font-black text-white tabular-nums">
                {currentUser.followersCount >= 1000
                  ? `${(currentUser.followersCount / 1000).toFixed(1)}k`
                  : currentUser.followersCount}
              </div>
              <div className="text-[10px] text-zinc-400 font-semibold tracking-wider uppercase mt-0.5">
                Followers
              </div>
            </button>

            <button
              onClick={() => showToast(`Profile Visitors: ${(currentUser.visitorsCount || 8940).toLocaleString()}`)}
              className="p-1 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
            >
              <div className="text-base sm:text-lg font-black text-white tabular-nums">
                {currentUser.visitorsCount
                  ? currentUser.visitorsCount >= 1000
                    ? `${(currentUser.visitorsCount / 1000).toFixed(1)}k`
                    : currentUser.visitorsCount
                  : '8.9k'}
              </div>
              <div className="text-[10px] text-zinc-400 font-semibold tracking-wider uppercase mt-0.5">
                Visitors
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================================
          SECTION 3: "KING OF KINGS" LUXURY VIP MEMBERSHIP BANNER
          ========================================================================= */}
      <div className="px-4 mt-3.5">
        <div className="relative rounded-2xl overflow-hidden p-4 bg-gradient-to-r from-[#2B1055] via-[#431682] to-[#2B1055] border border-amber-400/40 shadow-xl shadow-purple-950/40 flex items-center justify-between">
          {/* Ambient Glows */}
          <div className="absolute -left-6 -top-6 w-24 h-24 rounded-full bg-amber-400/20 blur-xl pointer-events-none" />
          <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-[#EC4899]/20 blur-xl pointer-events-none" />

          {/* Left: Crown icon + King of Kings branding */}
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-300 via-amber-500 to-amber-700 p-0.5 shadow-lg shadow-amber-500/25 flex items-center justify-center">
              <div className="w-full h-full rounded-[14px] bg-[#1C0D30] flex items-center justify-center">
                <Crown className="w-6 h-6 text-amber-400 animate-bounce" />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-yellow-300 tracking-wide uppercase">
                  King of Kings
                </h3>
                <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 border border-amber-400/40">
                  TOP PRIVILEGE
                </span>
              </div>
              <p className="text-[11px] text-purple-200/80 mt-0.5">
                Become and enjoy exclusive privileges & top room entrance
              </p>
            </div>
          </div>

          {/* Right: Activate Button */}
          <button
            onClick={() => {
              setShowShortcutModal({
                type: 'vip',
                title: 'King of Kings • Royal Membership',
                description:
                  'Activate King of Kings status to unlock: Golden Nameplate, 3D Super Entrance Yacht, Room Dominance Badge, +50% XP Boost, and 24/7 Dedicated Concierge.',
                icon: Crown,
              });
            }}
            className="relative z-10 px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-600 text-black text-xs font-black tracking-wide shadow-lg shadow-amber-500/30 hover:brightness-110 active:scale-95 transition-all cursor-pointer whitespace-nowrap"
          >
            Activate
          </button>
        </div>
      </div>

      {/* =========================================================================
          EXPLORE FEATURES & SERVICES (Single Option Replacing Cluttered Shelves)
          ========================================================================= */}
      <div className="px-4 mt-3.5">
        <button
          onClick={() => setShowExploreFeaturesModal(true)}
          className="w-full p-4 rounded-2xl bg-gradient-to-r from-[#180E2E] via-[#241344] to-[#180E2E] border border-[#A855F7]/30 hover:border-[#A855F7]/60 shadow-xl flex items-center justify-between cursor-pointer group active:scale-[0.99] transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#7928CA] to-[#EC4899] p-0.5 shadow-lg shadow-[#7928CA]/30 flex items-center justify-center">
              <div className="w-full h-full rounded-[14px] bg-[#140A28] flex items-center justify-center text-white">
                <Sparkles className="w-5 h-5 text-[#C084FC] group-hover:rotate-12 transition-transform" />
              </div>
            </div>
            <div className="text-left">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-white tracking-wide">
                  Explore Features
                </h3>
                <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-[#EC4899]/20 text-[#EC4899] border border-[#EC4899]/30">
                  13 Services
                </span>
              </div>
              <p className="text-[11px] text-zinc-300 mt-0.5">
                Tasks, Honor Level, Fans Club, VIP, Games & more
              </p>
            </div>
          </div>
          <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-zinc-400 group-hover:text-white group-hover:bg-white/10 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </div>
        </button>
      </div>

      {/* =========================================================================
          SECTION 6: PROFILE CONTENT TABS (Videos, Posts, Replays, Gifts)
          ========================================================================= */}
      <div className="px-4 mt-6">
        <div className="border-b border-[#A855F7]/20 flex items-center justify-around">
          {[
            { id: 'videos', label: 'Videos', count: myVideos.length },
            { id: 'posts', label: 'Posts', count: 12 },
            { id: 'replays', label: 'Replays', count: 3 },
            { id: 'gifts', label: 'Gifts', count: 48 },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`pb-3 pt-1 text-xs font-bold transition-all cursor-pointer relative ${
                  isActive ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <span>{tab.label}</span>
                <span className="ml-1 text-[10px] text-zinc-400">({tab.count})</span>
                {isActive && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#7928CA] to-[#EC4899]" />
                )}
              </button>
            );
          })}
        </div>

        {/* Tab Content Display */}
        <div className="py-4">
          {activeTab === 'videos' && (
            <div className="grid grid-cols-2 gap-3">
              {myVideos.map((vid) => (
                <div
                  key={vid.id}
                  className="rounded-2xl overflow-hidden bg-[#160E2A] border border-white/10 shadow-md group cursor-pointer relative"
                  onClick={() => showToast(`Playing: ${vid.title}`)}
                >
                  <div className="relative aspect-[3/4] overflow-hidden">
                    <img
                      src={vid.thumbnail}
                      alt={vid.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80" />

                    <div className="absolute top-2 right-2 p-1.5 rounded-full bg-black/40 backdrop-blur-md text-white">
                      <Play className="w-3.5 h-3.5 fill-white" />
                    </div>

                    <div className="absolute bottom-2 left-2 right-2">
                      <span className="text-[11px] font-bold text-white line-clamp-1">
                        {vid.title}
                      </span>
                      <div className="flex items-center gap-3 text-[10px] text-zinc-300 mt-1">
                        <span className="flex items-center gap-1 font-semibold">
                          <Heart className="w-3 h-3 fill-rose-500 text-rose-500" />{' '}
                          {vid.likes.toLocaleString()}
                        </span>
                        <span className="flex items-center gap-1 text-zinc-400">
                          <Eye className="w-3 h-3" /> {(vid.likes * 4).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'posts' && (
            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-[#140C26] border border-white/10">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-full overflow-hidden border border-[#A855F7]">
                    <img src={currentUser.avatar} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block">{currentUser.displayName}</span>
                    <span className="text-[10px] text-zinc-400">Yesterday at 9:30 PM</span>
                  </div>
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Thank you everyone who tuned in to tonight’s PK battle! We defended the crown with 150k points! You guys are true legends 💜👑🔥
                </p>
                <div className="flex items-center gap-4 mt-3 pt-2 border-t border-white/5 text-xs text-zinc-400">
                  <span className="flex items-center gap-1 text-rose-400">
                    <Heart className="w-3.5 h-3.5 fill-rose-500" /> 2,420
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageCircle className="w-3.5 h-3.5" /> 184 comments
                  </span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'replays' && (
            <div className="space-y-3">
              {[
                { title: 'Grand PK Battle vs Luna Star', duration: '45 mins', date: '2 days ago', views: '12.4k' },
                { title: 'Late Night Acoustic Music Jam', duration: '1 hr 12 mins', date: '5 days ago', views: '28.1k' },
              ].map((rep, idx) => (
                <div
                  key={idx}
                  onClick={() => showToast(`Loading replay: ${rep.title}`)}
                  className="p-3.5 rounded-2xl bg-[#140C26] border border-[#A855F7]/20 flex items-center justify-between cursor-pointer hover:border-[#A855F7]/50 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#20133D] border border-purple-500/30 flex items-center justify-center text-purple-300">
                      <Play className="w-4 h-4 fill-purple-400" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">{rep.title}</h4>
                      <p className="text-[10px] text-zinc-400 mt-0.5">
                        {rep.duration} • {rep.views} views • {rep.date}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-500" />
                </div>
              ))}
            </div>
          )}

          {activeTab === 'gifts' && (
            <div className="p-4 rounded-2xl bg-[#150E28] border border-[#A855F7]/20">
              <div className="flex items-center gap-2 mb-3">
                <GiftIcon className="w-5 h-5 text-[#EC4899]" />
                <h4 className="text-xs font-black text-white uppercase tracking-wider">
                  48 Virtual Gifts Received
                </h4>
              </div>

              <div className="grid grid-cols-4 gap-2 text-center">
                {[
                  { name: 'Mythic Dragon', icon: '🐉', count: 1, val: '25,000' },
                  { name: 'Galaxy Yacht', icon: '🛥️', count: 2, val: '15,000' },
                  { name: 'Royal Crown', icon: '👑', count: 8, val: '5,000' },
                  { name: 'Diamond Ring', icon: '💍', count: 12, val: '1,500' },
                ].map((g, idx) => (
                  <div key={idx} className="p-2.5 rounded-xl bg-black/30 border border-white/5">
                    <span className="text-2xl block">{g.icon}</span>
                    <span className="text-[10px] font-bold text-white mt-1 block truncate">
                      {g.name}
                    </span>
                    <span className="text-[9px] font-black text-amber-300 block">x{g.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* =========================================================================
          MODALS & ACTION SHEETS
          ========================================================================= */}

      {/* Cover Image Selector Modal / Sheet */}
      {showCoverModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-[#150D29] border border-[#A855F7]/40 p-5 shadow-2xl animate-in fade-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-[#A855F7]" />
                <h3 className="text-sm font-black text-white uppercase tracking-wide">
                  Change Cover Photo
                </h3>
              </div>
              <button
                onClick={() => setShowCoverModal(false)}
                className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 mt-4">
              {/* Option 1: Choose from Gallery */}
              <button
                onClick={() => {
                  galleryInputRef.current?.click();
                }}
                className="w-full py-3 px-4 rounded-xl bg-[#20143D] hover:bg-[#2C1B54] border border-[#A855F7]/30 text-white text-xs font-bold flex items-center gap-3 transition-colors cursor-pointer"
              >
                <div className="w-8 h-8 rounded-lg bg-[#7928CA]/30 flex items-center justify-center text-[#C084FC]">
                  <ImageIcon className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <span className="block font-bold">Choose from Gallery</span>
                  <span className="text-[10px] text-zinc-400">Upload a custom banner photo</span>
                </div>
              </button>

              {/* Option 2: Take Photo with Camera */}
              <button
                onClick={() => {
                  cameraInputRef.current?.click();
                }}
                className="w-full py-3 px-4 rounded-xl bg-[#20143D] hover:bg-[#2C1B54] border border-[#EC4899]/30 text-white text-xs font-bold flex items-center gap-3 transition-colors cursor-pointer"
              >
                <div className="w-8 h-8 rounded-lg bg-[#EC4899]/30 flex items-center justify-center text-pink-400">
                  <Camera className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <span className="block font-bold">Take with Camera</span>
                  <span className="text-[10px] text-zinc-400">Snap a new live photo</span>
                </div>
              </button>

              {/* Option 3: Reset to Animated Stage Carousel */}
              {currentUser.coverImage && (
                <button
                  onClick={handleResetCover}
                  className="w-full py-3 px-4 rounded-xl bg-purple-950/40 hover:bg-purple-900/40 border border-purple-500/20 text-white text-xs font-bold flex items-center gap-3 transition-colors cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-amber-400">
                    <RefreshCw className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <span className="block font-bold">Use Animated Stage Carousel</span>
                    <span className="text-[10px] text-zinc-400">Reset to official DJ stage effects</span>
                  </div>
                </button>
              )}
            </div>

            <button
              onClick={() => setShowCoverModal(false)}
              className="mt-4 w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-zinc-300 text-xs font-bold cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Feature & Services Shortcut Details Modal */}
      {showShortcutModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-[#140C27] border border-[#A855F7]/40 p-5 shadow-2xl animate-in fade-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#7928CA]/30 border border-[#A855F7]/30 flex items-center justify-center text-purple-300">
                  {React.createElement(showShortcutModal.icon, { className: 'w-4 h-4 text-[#C084FC]' })}
                </div>
                <h3 className="text-sm font-black text-white">{showShortcutModal.title}</h3>
              </div>
              <button
                onClick={() => setShowShortcutModal(null)}
                className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-300 mt-4 leading-relaxed bg-black/30 p-3.5 rounded-2xl border border-white/5">
              {showShortcutModal.description}
            </p>

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => {
                  showToast(`Opened ${showShortcutModal.title}`);
                  setShowShortcutModal(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white text-xs font-bold shadow-lg shadow-[#EC4899]/25 hover:brightness-110 active:scale-95 transition-all cursor-pointer"
              >
                Open Feature
              </button>
              <button
                onClick={() => setShowShortcutModal(null)}
                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-zinc-300 text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Explore Features & Services Modal / Sheet */}
      {showExploreFeaturesModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-3 sm:p-4">
          <div className="w-full max-w-md rounded-3xl bg-[#130B24] border border-[#A855F7]/40 p-5 shadow-2xl max-h-[85vh] flex flex-col animate-in fade-in slide-in-from-bottom duration-200">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#A855F7]/20">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#7928CA] to-[#EC4899] p-0.5 flex items-center justify-center">
                  <div className="w-full h-full rounded-[10px] bg-[#140A28] flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-[#C084FC]" />
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">
                    Explore Features & Services
                  </h3>
                  <span className="text-[10px] text-zinc-400">13 interactive entertainment features</span>
                </div>
              </div>
              <button
                onClick={() => setShowExploreFeaturesModal(false)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Grid of 13 features */}
            <div className="flex-1 overflow-y-auto py-4 grid grid-cols-3 sm:grid-cols-4 gap-2.5">
              {[
                {
                  id: 'task',
                  label: 'Daily Tasks',
                  badge: 'Rewards',
                  icon: CheckSquare,
                  color: 'from-emerald-500 to-teal-600',
                  action: () => {
                    setShowExploreFeaturesModal(false);
                    setShowShortcutModal({
                      type: 'task',
                      title: 'Daily & Weekly Tasks',
                      description:
                        'Complete daily streaming, chat in party rooms, send 3 gifts, and claim up to 1,500 free bonus coins every day!',
                      icon: CheckSquare,
                    });
                  },
                },
                {
                  id: 'level',
                  label: 'Honor Level',
                  badge: `Lv.${currentUser.level}`,
                  icon: Zap,
                  color: 'from-[#7928CA] to-[#9333EA]',
                  action: () => {
                    setShowExploreFeaturesModal(false);
                    setCurrentScreen('levels');
                  },
                },
                {
                  id: 'fans_club',
                  label: 'Fans Club',
                  badge: 'Top 5',
                  icon: Heart,
                  color: 'from-rose-500 to-pink-600',
                  action: () => {
                    setShowExploreFeaturesModal(false);
                    setShowShortcutModal({
                      type: 'fans_club',
                      title: 'Creator Fans Club',
                      description:
                        'Join Alex Rider’s exclusive fan club! Unlock custom fan badges, private audio room access, and weekly fan ranking rewards.',
                      icon: Heart,
                    });
                  },
                },
                {
                  id: 'game',
                  label: 'Game Hall',
                  badge: 'Lucky',
                  icon: Gamepad2,
                  color: 'from-amber-500 to-orange-600',
                  action: () => {
                    setShowExploreFeaturesModal(false);
                    setShowShortcutModal({
                      type: 'game',
                      title: 'Alpha Entertainment Games',
                      description:
                        'Play Lucky Wheel, Live PK Predictions, and Dice Battles to multiply your coins and win exclusive entrance effects!',
                      icon: Gamepad2,
                    });
                  },
                },
                {
                  id: 'backpack',
                  label: 'Backpack',
                  badge: '8 Items',
                  icon: Briefcase,
                  color: 'from-blue-500 to-indigo-600',
                  action: () => {
                    setShowExploreFeaturesModal(false);
                    setShowShortcutModal({
                      type: 'backpack',
                      title: 'My Inventory Backpack',
                      description:
                        'Your storage contains: 2x Galaxy Rocket Gift, 1x 7-Day Neon Avatar Frame, 5x Room Broadcast Megaphones.',
                      icon: Briefcase,
                    });
                  },
                },
                {
                  id: 'dress_store',
                  label: 'Dress Store',
                  badge: 'New',
                  icon: Sparkles,
                  color: 'from-fuchsia-500 to-purple-600',
                  action: () => {
                    setShowExploreFeaturesModal(false);
                    setShowShortcutModal({
                      type: 'dress_store',
                      title: 'Avatar & Entrance Dress Store',
                      description:
                        'Equip cyber neon frames, golden chat bubbles, and 3D sports car entrance effects to stun everyone when entering live rooms!',
                      icon: Sparkles,
                    });
                  },
                },
                {
                  id: 'event_center',
                  label: 'Event Center',
                  badge: 'Live',
                  icon: PartyPopper,
                  color: 'from-pink-500 to-rose-600',
                  action: () => {
                    setShowExploreFeaturesModal(false);
                    setShowShortcutModal({
                      type: 'event_center',
                      title: 'Alpha Seasonal Tournaments',
                      description:
                        'Summer PK Clash & Singing Star 2026 is underway! Compete on the leaderboard to win 500,000 Diamonds prize pool.',
                      icon: PartyPopper,
                    });
                  },
                },
                {
                  id: 'vip',
                  label: 'VIP Privileges',
                  badge: `VIP ${currentUser.vipTier}`,
                  icon: Crown,
                  color: 'from-amber-400 to-yellow-600',
                  action: () => {
                    setShowExploreFeaturesModal(false);
                    setShowShortcutModal({
                      type: 'vip',
                      title: 'VIP Royal Tier Privileges',
                      description:
                        'Your current tier is VIP 3 Gold. Privileges include: Custom ID flair, anti-kick immunity in normal rooms, and priority customer service.',
                      icon: Crown,
                    });
                  },
                },
                {
                  id: 'guardian',
                  label: 'Guardian Angel',
                  badge: 'Shield',
                  icon: Shield,
                  color: 'from-indigo-500 to-purple-600',
                  action: () => {
                    setShowExploreFeaturesModal(false);
                    setShowShortcutModal({
                      type: 'guardian',
                      title: 'Guardian Angel Protection',
                      description:
                        'Become a host’s personal Guardian Angel! Display an exclusive golden shield next to their avatar and enjoy special party room rights.',
                      icon: Shield,
                    });
                  },
                },
                {
                  id: 'real_person',
                  label: 'Real Person',
                  badge: 'Verified',
                  icon: UserCheck,
                  color: 'from-emerald-500 to-green-600',
                  action: () => {
                    setShowExploreFeaturesModal(false);
                    setShowShortcutModal({
                      type: 'real_person',
                      title: 'Real Person Identity Detection',
                      description:
                        'Your profile is fully verified with biometric facial scan and authentic host certification. No further verification required.',
                      icon: UserCheck,
                    });
                  },
                },
                {
                  id: 'help',
                  label: 'Help Center',
                  badge: 'Guides',
                  icon: HelpCircle,
                  color: 'from-sky-500 to-blue-600',
                  action: () => {
                    setShowExploreFeaturesModal(false);
                    setShowShortcutModal({
                      type: 'help',
                      title: 'Help Center & Guides',
                      description:
                        'Learn how to host live streams, play PK battles, withdraw diamond earnings, and secure your account credentials.',
                      icon: HelpCircle,
                    });
                  },
                },
                {
                  id: 'customer_service',
                  label: 'Live Support',
                  badge: '24/7 Live',
                  icon: Headphones,
                  color: 'from-purple-500 to-fuchsia-600',
                  action: () => {
                    setShowExploreFeaturesModal(false);
                    setShowShortcutModal({
                      type: 'customer_service',
                      title: '24/7 Official Customer Support',
                      description:
                        'Connect with an official Alpha Mate representative directly through live chat for assistance with recharge, accounts, or disputes.',
                      icon: Headphones,
                    });
                  },
                },
                {
                  id: 'settings',
                  label: 'Settings',
                  badge: 'Config',
                  icon: Settings,
                  color: 'from-slate-600 to-zinc-700',
                  action: () => {
                    setShowExploreFeaturesModal(false);
                    setCurrentScreen('settings');
                  },
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={item.action}
                    className="p-3 rounded-2xl bg-[#1A1030] hover:bg-[#251745] border border-white/10 hover:border-[#A855F7]/40 flex flex-col items-center justify-between text-center group cursor-pointer transition-all active:scale-95 shadow-md"
                  >
                    <div
                      className={`w-11 h-11 rounded-xl bg-gradient-to-tr ${item.color} flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[11px] font-bold text-white mt-2 line-clamp-1 w-full">
                      {item.label}
                    </span>
                    <span className="text-[9px] font-bold text-[#C084FC] bg-white/5 px-1.5 py-0.5 rounded-md mt-1 line-clamp-1">
                      {item.badge}
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setShowExploreFeaturesModal(false)}
              className="mt-2 w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-zinc-300 text-xs font-bold cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}


      <EditProfileModal isOpen={showEditModal} onClose={() => setShowEditModal(false)} />

      {/* Share Profile Modal */}
      <ShareProfileModal isOpen={showShareModal} onClose={() => setShowShareModal(false)} />
    </div>
  );
};
