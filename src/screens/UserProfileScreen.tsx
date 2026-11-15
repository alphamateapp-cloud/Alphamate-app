import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { EditProfileModal } from '../components/modals/EditProfileModal';
import { ShareProfileModal } from '../components/modals/ShareProfileModal';
import { JoinAgencyModal } from '../components/modals/JoinAgencyModal';
import { TopAchievementsModal } from '../components/modals/TopAchievementsModal';
import { VipAvatarFrame } from '../components/brand/VipAvatarFrame';
import { copyToClipboard } from '../utils/clipboard';
import { compressImage } from '../utils/imageCompressor';
import { LevelBadgeTag } from '../components/brand/LevelBadgeTag';
import { UserBadgeStrip } from '../components/badges/UserBadgeIcon';
import { ProfileBadgeShowcase } from '../components/badges/UserBadgesModal';
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
  Coins,
  Building2,
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
  Bookmark,
  Lock,
  Music,
  BarChart3,
  Globe,
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
    agencyProfile,
    openLeaderboard,
    openBadgesModal,
    userHistoricalStats,
  } = useApp();

  // Navigation & Modal states: Videos, Posts, Liked, Saved, Private
  const [activeTab, setActiveTab] = useState<'videos' | 'posts' | 'liked' | 'saved' | 'private'>('videos');
  const [copiedId, setCopiedId] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showCoverModal, setShowCoverModal] = useState(false);
  const [showJoinAgencyModal, setShowJoinAgencyModal] = useState(false);
  const [showTopAchievementsModal, setShowTopAchievementsModal] = useState(false);
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
  const handleCoverFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressImage(file, 800, 450, 0.75);
        updateUserProfile({ coverImage: compressed });
        showToast('Cover photo updated successfully!');
        setShowCoverModal(false);
      } catch {
        showToast('Error processing cover image. Please choose another.');
      }
    }
  };

  const handleResetCover = () => {
    updateUserProfile({ coverImage: undefined });
    showToast('Reset to animated DJ stage cover');
    setShowCoverModal(false);
  };

  // Video Collections for Profile Tabs:
  // 1. My Public Videos (uploaded by user)
  const myVideos = videos.filter((v) => (v.user.id === currentUser.id || v.user.username === currentUser.username) && v.postType !== 'post');
  
  // 2. My Posts (text posts, quotes, photos with text)
  const myPosts = videos.filter((v) => (v.user.id === currentUser.id || v.user.username === currentUser.username) && v.postType === 'post');
  
  // 2. Liked Videos (videos liked by user)
  const likedVideos = videos.filter((v) => v.isLiked || v.id === 'vid_01' || v.id === 'vid_03');

  // 3. Saved Videos (videos bookmarked to watch later)
  const [savedVideoIds, setSavedVideoIds] = useState<Set<string>>(new Set(['vid_02', 'vid_04']));
  const savedVideos = videos.filter((v) => savedVideoIds.has(v.id));

  // 4. Private Videos (personal videos only visible to the owner)
  const [privateVideos, setPrivateVideos] = useState<Array<{ id: string; title: string; thumbnail: string; date: string; duration: string }>>([
    {
      id: 'priv_01',
      title: 'Voice Note Rehearsal & Vocal Warmup 🔒',
      thumbnail: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=400&q=80',
      date: 'Only you can see this',
      duration: '0:45',
    },
    {
      id: 'priv_02',
      title: 'Solo PK Battle Strategy Draft 🔒',
      thumbnail: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=400&q=80',
      date: 'Private vault • Encrypted',
      duration: '1:12',
    },
  ]);

  // Equalizer sound bars heights animation generator
  const soundwaveHeights = [18, 36, 62, 44, 78, 55, 92, 68, 85, 42, 65, 38, 72, 50, 80, 40];

  return (
    <div className="relative w-full h-full pb-24 bg-[#09070F] text-white overflow-y-auto overscroll-contain selection:bg-[#9333EA] selection:text-white">
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
          {/* Top row inside card: Avatar with VIP Frame & Action Buttons + Hero Level Badge Tag */}
          <div className="flex items-start justify-between -mt-12 sm:-mt-14 gap-3">
            {/* Circular Avatar with Glowing VIP Frame (Camera badge removed as requested) */}
            <div className="relative group shrink-0">
              <VipAvatarFrame
                avatarUrl={currentUser.avatar}
                vipTier={currentUser.vipTier}
                size="xl"
                showCrownBadge={true}
              />

              {/* Online Pulse Dot */}
              <div className="absolute top-1 right-1 flex items-center">
                <span className="relative flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-[#120B22]" />
                </span>
              </div>
            </div>

            {/* Right Column: Edit & Share Buttons + Compact Level Badge Tag */}
            <div className="flex-1 flex flex-col items-end gap-1.5 pt-8 sm:pt-9 min-w-0">
              {/* Quick Action Buttons: Edit Profile & Share Profile */}
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <button
                  onClick={() => setShowEditModal(true)}
                  className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-[#231542] hover:bg-[#2F1C58] border border-[#A855F7]/35 text-[11px] font-bold text-white shadow-md active:scale-95 transition-all flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <Edit3 className="w-3.5 h-3.5 text-[#C084FC]" />
                  <span>Edit Profile</span>
                </button>

                <button
                  onClick={() => setShowShareModal(true)}
                  className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-[11px] font-bold text-white shadow-lg shadow-[#EC4899]/25 hover:brightness-110 active:scale-95 transition-all flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Share</span>
                </button>
              </div>

              {/* Official Chart Level Badge Insignia in Profile Card */}
              <div className="flex items-center justify-end mt-1">
                <LevelBadgeTag
                  level={currentUser.level}
                  size="hero"
                  onClick={() => setCurrentScreen('levels')}
                />
              </div>

              {/* Join Agency / My Agency Button (Directly below Level Badge as instructed) */}
              <div className="flex items-center justify-end mt-1.5">
                <button
                  type="button"
                  onClick={() => setShowJoinAgencyModal(true)}
                  className={`px-2.5 py-1 rounded-xl text-[10.5px] font-black tracking-wide flex items-center gap-1 shadow-md active:scale-95 transition-all cursor-pointer ${
                    currentUser.agencyTag
                      ? 'bg-gradient-to-r from-amber-400 to-amber-600 text-black border border-amber-300 shadow-amber-500/20'
                      : 'bg-gradient-to-r from-[#7928CA]/90 to-[#EC4899]/90 text-white border border-white/20 hover:brightness-110'
                  }`}
                  title={currentUser.agencyTag ? `Bound to ${currentUser.agencyName || 'Agency'}` : 'Join an Official Host Agency'}
                >
                  <Users className="w-3 h-3" />
                  <span>
                    {currentUser.agencyTag ? `Agency: [${currentUser.agencyTag}]` : 'Join Agency 🌟'}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Profile Identity Details */}
          <div className="mt-3.5">
            {/* Display Name with Crown, Verified Shield & Official Agency Tag */}
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-black text-white tracking-tight flex items-center gap-1.5">
                <span>{currentUser.displayName}</span>
              </h1>
              <UserBadgeStrip
                badgeIds={userHistoricalStats.equippedBadgeIds}
                earnedBadges={userHistoricalStats.earnedBadges}
                size="xs"
                onClick={openBadgesModal}
              />
              {currentUser.activeHonorTitle && (
                <div
                  title="Equipped Honor Tag (Tap to view Top Achievements)"
                  onClick={() => setShowTopAchievementsModal(true)}
                  className="flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-400/20 to-rose-500/20 border border-amber-400/40 text-amber-300 text-[10px] font-black tracking-wider uppercase font-mono shadow cursor-pointer hover:border-amber-400"
                >
                  <span>{currentUser.activeHonorTitle}</span>
                </div>
              )}
              {currentUser.agencyTag && (
                <div
                  title={`Official Host bound to ${currentUser.agencyName || 'Agency'}`}
                  className="flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-amber-600 text-black text-[9.5px] font-black tracking-wider uppercase shadow"
                >
                  <span>[{currentUser.agencyTag}]</span>
                </div>
              )}
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
              <LevelBadgeTag
                level={currentUser.level}
                size="sm"
                onClick={() => setCurrentScreen('levels')}
              />

              {/* Online State Pill */}
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 font-semibold text-[10px]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Online</span>
              </span>
            </div>

            {/* Bio with multi-language auto detection */}
            <p
              dir="auto"
              className="text-xs text-zinc-300 mt-3 leading-relaxed break-words whitespace-pre-wrap bg-black/20 p-2.5 rounded-xl border border-white/5 text-center"
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

            {/* Historical User Badges Showcase */}
            <ProfileBadgeShowcase />
          </div>

          {/* =========================================================================
              PROFILE STATISTICS: Following, Followers, Likes (Matching Reference Design)
              ========================================================================= */}
          <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-[#A855F7]/20 text-center">
            <button
              onClick={() => showToast(`Following: ${currentUser.followingCount.toLocaleString()} creators`)}
              className="p-1 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
            >
              <div className="text-base sm:text-lg font-black text-white tabular-nums">
                {currentUser.followingCount.toLocaleString()}
              </div>
              <div className="text-[10px] text-zinc-400 font-bold tracking-wider uppercase mt-0.5">
                FOLLOWING
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
              <div className="text-[10px] text-zinc-400 font-bold tracking-wider uppercase mt-0.5">
                FOLLOWERS
              </div>
            </button>

            <button
              onClick={() => showToast(`Total Likes: 18`)}
              className="p-1 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
            >
              <div className="text-base sm:text-lg font-black text-white tabular-nums">
                {myVideos.reduce((acc, v) => acc + (v.likes || 0), 0) || 18}
              </div>
              <div className="text-[10px] text-zinc-400 font-bold tracking-wider uppercase mt-0.5">
                LIKES
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================================
          SECTION 3: ACTION BOXES: CREATOR, AGENCY, WALLET (Matching Reference Design)
          ========================================================================= */}
      <div className="px-4 mt-3.5">
        <div className="rounded-3xl p-4 bg-[#120B22]/90 backdrop-blur-xl border border-white/10 shadow-2xl flex items-center justify-around gap-2">
          {/* Box 1: Top Achievements (Warrior & Victor Honors, Unlocked Avatar Frames & Tags) */}
          <button
            type="button"
            onClick={() => setShowTopAchievementsModal(true)}
            className="flex-1 flex flex-col items-center gap-2 group cursor-pointer active:scale-95 transition-transform"
          >
            <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-400 via-rose-500 to-purple-600 p-0.5 shadow-lg shadow-amber-500/25 flex items-center justify-center group-hover:scale-105 transition-all">
              <div className="w-full h-full rounded-[14px] bg-gradient-to-b from-[#250F3B] to-[#130722] flex items-center justify-center text-amber-300 group-hover:text-amber-200">
                <Trophy className="w-6 h-6 drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
              </div>
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
              </span>
            </div>
            <div className="text-center leading-tight">
              <span className="text-[11px] sm:text-xs font-black text-amber-300 group-hover:text-white block line-clamp-1">
                Top Achievements
              </span>
              <span className="text-[9px] text-zinc-400 group-hover:text-amber-300 font-semibold line-clamp-1">
                Warrior & Victor
              </span>
            </div>
          </button>

          {/* Box 2: Agency */}
          <button
            type="button"
            onClick={() => setCurrentScreen('agency_management')}
            className="flex-1 flex flex-col items-center gap-2 group cursor-pointer active:scale-95 transition-transform"
          >
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#1D4ED8] to-[#0284C7] p-0.5 shadow-lg shadow-blue-600/30 flex items-center justify-center group-hover:scale-105 transition-all">
              <div className="w-full h-full rounded-[14px] bg-[#0E1D3B] flex items-center justify-center text-sky-300 group-hover:text-white">
                <Building2 className="w-6 h-6" />
              </div>
            </div>
            <span className="text-xs font-bold text-zinc-300 group-hover:text-white">Agency</span>
          </button>

          {/* Box 3: Wallet */}
          <button
            type="button"
            onClick={() => setCurrentScreen('wallet')}
            className="flex-1 flex flex-col items-center gap-2 group cursor-pointer active:scale-95 transition-transform"
          >
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#B45309] to-[#F59E0B] p-0.5 shadow-lg shadow-amber-600/30 flex items-center justify-center group-hover:scale-105 transition-all">
              <div className="w-full h-full rounded-[14px] bg-[#2A1608] flex items-center justify-center text-amber-300 group-hover:text-white">
                <Wallet className="w-6 h-6" />
              </div>
            </div>
            <span className="text-xs font-bold text-zinc-300 group-hover:text-white">Wallet</span>
          </button>

          {/* Box 4: Global & Weekly Rankings */}
          <button
            type="button"
            onClick={() => openLeaderboard('global')}
            className="flex-1 flex flex-col items-center gap-2 group cursor-pointer active:scale-95 transition-transform"
          >
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#7928CA] to-[#EC4899] p-0.5 shadow-lg shadow-purple-600/30 flex items-center justify-center group-hover:scale-105 transition-all">
              <div className="w-full h-full rounded-[14px] bg-[#1D0F38] flex items-center justify-center text-pink-300 group-hover:text-white">
                <BarChart3 className="w-6 h-6" />
              </div>
            </div>
            <span className="text-xs font-bold text-zinc-300 group-hover:text-white">Rankings</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          SECTION 6: PROFILE CONTENT TABS (Videos, Posts, Liked, Saved, Private)
          ========================================================================= */}
      <div className="px-4 mt-6">
        <div className="border-b border-[#A855F7]/20 flex items-center justify-between overflow-x-auto scrollbar-none gap-2">
          {[
            { id: 'videos', label: 'Public', count: myVideos.length, icon: Globe },
            { id: 'private', label: 'Private', count: privateVideos.length, icon: Lock },
            { id: 'saved', label: 'Saved', count: savedVideos.length, icon: Bookmark },
            { id: 'posts', label: 'Posts', count: myPosts.length + 1, icon: MessageCircle },
            { id: 'liked', label: 'Liked', count: likedVideos.length, icon: Heart },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            const TabIcon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`pb-3 pt-1 text-xs font-bold transition-all cursor-pointer relative shrink-0 flex items-center gap-1.5 ${
                  isActive ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <TabIcon className={`w-3.5 h-3.5 ${isActive ? 'text-[#EC4899]' : 'text-zinc-500'}`} />
                <span>{tab.label}</span>
                <span className="text-[10px] text-zinc-400">({tab.count})</span>
                {isActive && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2.5px] rounded-full bg-gradient-to-r from-[#7928CA] via-[#A855F7] to-[#EC4899] shadow-[0_0_8px_rgba(236,72,153,0.8)]" />
                )}
              </button>
            );
          })}
        </div>

        {/* Tab Content Display */}
        <div className="py-4">
          {/* TAB 1: My Videos */}
          {activeTab === 'videos' && (
            <div>
              {myVideos.length > 0 ? (
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
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80" />

                        <div className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 backdrop-blur-md text-white">
                          <Play className="w-3.5 h-3.5 fill-white" />
                        </div>

                        <div className="absolute bottom-2 left-2 right-2">
                          <span className="text-[11px] font-bold text-white line-clamp-1 drop-shadow">
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
              ) : (
                <div className="text-center py-10 px-4 rounded-2xl bg-[#140C26] border border-white/5">
                  <Video className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
                  <p className="text-xs text-zinc-400">No public videos yet.</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">Upload moments from the + tab to showcase your talent!</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Posts */}
          {activeTab === 'posts' && (
            <div className="space-y-3">
              {/* Write New Post Button */}
              <button
                onClick={() => setCurrentScreen('upload')}
                className="w-full p-3 rounded-2xl bg-gradient-to-r from-[#21143D] to-[#170B2E] border border-[#A855F7]/30 hover:border-[#EC4899] text-left flex items-center justify-between text-xs font-bold text-zinc-300 hover:text-white cursor-pointer active:scale-[0.99] transition-all shadow-md group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#7928CA] to-[#EC4899] flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform">
                    <Edit3 className="w-4 h-4" />
                  </div>
                  <span>What's on your mind? Share your thoughts...</span>
                </div>
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#7928CA]/30 text-[#C084FC] border border-[#A855F7]/30">
                  Write Post ✍️
                </span>
              </button>

              {/* Dynamically Rendered Published Posts */}
              {myPosts.map((post) => (
                <div key={post.id} className="p-4 rounded-2xl bg-[#140C26] border border-white/10 shadow-md space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full overflow-hidden border border-[#A855F7]">
                        <img src={currentUser.avatar} alt="" className="w-full h-full object-cover" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-white block">{currentUser.displayName}</span>
                        <span className="text-[10px] text-zinc-400">{post.timestamp || 'Just now'}</span>
                      </div>
                    </div>

                    {post.musicTitle && (
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/50 border border-[#EC4899]/40 text-[#EC4899] text-[9.5px] font-bold">
                        <Music className="w-3 h-3 animate-pulse" />
                        <span className="truncate max-w-[90px]">{post.musicTitle}</span>
                      </div>
                    )}
                  </div>

                  {/* Post Content Display */}
                  {post.attachedPhotoUrl ? (
                    <div className="relative rounded-xl overflow-hidden aspect-[4/3] bg-black">
                      <img src={post.attachedPhotoUrl} alt="" className="w-full h-full object-cover" />
                      {post.isTextOnPhoto && post.textContent && (
                        <div className="absolute inset-0 bg-black/45 backdrop-blur-[1px] flex items-center justify-center p-4">
                          <div className="rounded-xl bg-black/50 backdrop-blur-md border border-white/20 p-3 text-center">
                            <p className="text-xs sm:text-sm font-black text-white leading-relaxed">
                              “{post.textContent}”
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : post.textContent ? (
                    <div className={`p-4 rounded-xl text-center shadow-inner ${post.backgroundColor ? `bg-gradient-to-br ${post.backgroundColor}` : 'bg-gradient-to-br from-[#4C1D95] to-[#1E0836]'}`}>
                      <p className="text-sm sm:text-base font-black text-white leading-relaxed drop-shadow">
                        “{post.textContent}”
                      </p>
                    </div>
                  ) : null}

                  {/* Caption / Description if not on photo */}
                  {(!post.isTextOnPhoto || !post.attachedPhotoUrl) && post.description && post.description !== post.textContent && (
                    <p className="text-xs text-zinc-300 leading-relaxed">{post.description}</p>
                  )}

                  {/* Tags */}
                  {post.tags && post.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {post.tags.map((t, idx) => (
                        <span key={idx} className="text-[10px] font-bold text-[#C084FC]">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Post Stats */}
                  <div className="flex items-center gap-4 pt-2 border-t border-white/5 text-xs text-zinc-400">
                    <span className="flex items-center gap-1 text-rose-400">
                      <Heart className="w-3.5 h-3.5 fill-rose-500" /> {post.likes || 1}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageCircle className="w-3.5 h-3.5" /> {post.commentsCount || 0} comments
                    </span>
                  </div>
                </div>
              ))}

              {/* Sample Fallback Post */}
              <div className="p-4 rounded-2xl bg-[#140C26] border border-white/10 shadow-md">
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

          {/* TAB 3: Liked Videos (Replaces old 'replays') */}
          {activeTab === 'liked' && (
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                  Videos You Liked
                </span>
                <span className="text-[10px] text-zinc-500">
                  Visible to everyone
                </span>
              </div>

              {likedVideos.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {likedVideos.map((vid) => (
                    <div
                      key={vid.id}
                      className="rounded-2xl overflow-hidden bg-[#160E2A] border border-rose-500/20 shadow-md group cursor-pointer relative"
                      onClick={() => showToast(`Playing liked video: ${vid.title}`)}
                    >
                      <div className="relative aspect-[3/4] overflow-hidden">
                        <img
                          src={vid.thumbnail}
                          alt={vid.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-85" />

                        {/* Top Liked Heart Badge */}
                        <div className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 backdrop-blur-md text-rose-500 border border-rose-500/30">
                          <Heart className="w-3.5 h-3.5 fill-rose-500" />
                        </div>

                        {/* Video Creator info */}
                        <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-white text-[9.5px] font-medium border border-white/10">
                          <img
                            src={vid.user.avatar}
                            alt=""
                            className="w-3.5 h-3.5 rounded-full object-cover"
                          />
                          <span className="truncate max-w-[70px]">{vid.user.displayName.split(' ')[0]}</span>
                        </div>

                        <div className="absolute bottom-2 left-2 right-2">
                          <span className="text-[11px] font-bold text-white line-clamp-1 drop-shadow">
                            {vid.title}
                          </span>
                          <div className="flex items-center gap-3 text-[10px] text-zinc-300 mt-1">
                            <span className="flex items-center gap-1 font-semibold text-rose-400">
                              <Heart className="w-3 h-3 fill-rose-500" />{' '}
                              {vid.likes.toLocaleString()}
                            </span>
                            <span className="flex items-center gap-1 text-zinc-400">
                              <Eye className="w-3 h-3" /> {(vid.viewsCount || vid.likes * 4).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 px-4 rounded-2xl bg-[#140C26] border border-white/5">
                  <Heart className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
                  <p className="text-xs text-zinc-400">No liked videos yet.</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">Double tap moments you love to find them here!</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: Saved Videos (Replaces old 'gifts') */}
          {activeTab === 'saved' && (
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                  Bookmarked & Saved
                </span>
                <span className="text-[10px] text-[#A855F7] font-semibold">
                  Saved collection
                </span>
              </div>

              {savedVideos.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {savedVideos.map((vid) => (
                    <div
                      key={vid.id}
                      className="rounded-2xl overflow-hidden bg-[#160E2A] border border-[#A855F7]/30 shadow-md group cursor-pointer relative"
                      onClick={() => showToast(`Opening saved video: ${vid.title}`)}
                    >
                      <div className="relative aspect-[3/4] overflow-hidden">
                        <img
                          src={vid.thumbnail}
                          alt={vid.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-85" />

                        {/* Top Bookmark Badge */}
                        <div className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 backdrop-blur-md text-amber-400 border border-amber-400/30">
                          <Bookmark className="w-3.5 h-3.5 fill-amber-400" />
                        </div>

                        {/* Creator Info */}
                        <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-white text-[9.5px] font-medium border border-white/10">
                          <img
                            src={vid.user.avatar}
                            alt=""
                            className="w-3.5 h-3.5 rounded-full object-cover"
                          />
                          <span className="truncate max-w-[70px]">{vid.user.displayName.split(' ')[0]}</span>
                        </div>

                        <div className="absolute bottom-2 left-2 right-2">
                          <span className="text-[11px] font-bold text-white line-clamp-1 drop-shadow">
                            {vid.title}
                          </span>
                          <div className="flex items-center justify-between text-[10px] text-zinc-300 mt-1">
                            <span className="text-amber-300 font-semibold">Saved for later</span>
                            <Play className="w-3 h-3 text-white fill-white" />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 px-4 rounded-2xl bg-[#140C26] border border-white/5">
                  <Bookmark className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
                  <p className="text-xs text-zinc-400">No saved videos yet.</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">Save favorite broadcast clips to watch anytime!</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: Private Videos (Only visible to account owner) */}
          {activeTab === 'private' && (
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1 text-amber-300">
                  <Lock className="w-3 h-3 text-amber-400" />
                  <span>Only visible to you</span>
                </span>
                <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  Private Vault
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {privateVideos.map((priv) => (
                  <div
                    key={priv.id}
                    className="rounded-2xl overflow-hidden bg-[#160E2A] border border-amber-400/30 shadow-md group cursor-pointer relative"
                    onClick={() => showToast(`Opening private video: ${priv.title}`)}
                  >
                    <div className="relative aspect-[3/4] overflow-hidden">
                      <img
                        src={priv.thumbnail}
                        alt={priv.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent opacity-90" />

                      {/* Locked Padlock badge */}
                      <div className="absolute top-2 right-2 p-1.5 rounded-full bg-amber-500/20 backdrop-blur-md text-amber-300 border border-amber-400/40">
                        <Lock className="w-3.5 h-3.5" />
                      </div>

                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md text-[9px] font-black text-amber-300 border border-amber-400/30">
                        PRIVATE
                      </div>

                      <div className="absolute bottom-2 left-2 right-2">
                        <span className="text-[11px] font-bold text-white line-clamp-2 drop-shadow">
                          {priv.title}
                        </span>
                        <div className="flex items-center justify-between text-[10px] text-zinc-400 mt-1">
                          <span>{priv.duration}</span>
                          <span className="text-amber-400/90 font-medium">{priv.date}</span>
                        </div>
                      </div>
                    </div>
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



      <EditProfileModal isOpen={showEditModal} onClose={() => setShowEditModal(false)} />

      {/* Share Profile Modal */}
      <ShareProfileModal isOpen={showShareModal} onClose={() => setShowShareModal(false)} />

      {/* Join Official Host Agency Modal */}
      <JoinAgencyModal isOpen={showJoinAgencyModal} onClose={() => setShowJoinAgencyModal(false)} />

      {/* Top Achievements & Honor Hall Modal (Warrior & Victor Badges & Frames) */}
      <TopAchievementsModal
        isOpen={showTopAchievementsModal}
        onClose={() => setShowTopAchievementsModal(false)}
      />
    </div>
  );
};
