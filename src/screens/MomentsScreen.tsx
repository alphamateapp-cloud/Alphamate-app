import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { VideoPost, Gift } from '../types';
import { VIRTUAL_GIFTS } from '../data/mockData';
import { copyToClipboard } from '../utils/clipboard';
import {
  Plus,
  Heart,
  MessageCircle,
  Share2,
  Gift as GiftIcon,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Eye,
  Check,
  Send,
  X,
  Sparkles,
  Bookmark,
  MoreVertical,
  Download,
  Link2,
  Flag,
  Slash,
  ChevronUp,
  ChevronDown,
  Music,
  ShieldCheck,
  Crown,
} from 'lucide-react';

export const MomentsScreen: React.FC = () => {
  const {
    videos,
    toggleLikeVideo,
    currentUser,
    setCurrentScreen,
    sendLiveGift,
    coins,
  } = useApp();

  // Active top navigation tab: FOR YOU | FOLLOWING | TRENDING | SAVED
  const [activeTab, setActiveTab] = useState<'FOR YOU' | 'FOLLOWING' | 'TRENDING' | 'SAVED'>('FOR YOU');
  const [isMuted, setIsMuted] = useState(true);
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({
    host_01: true,
  });

  // Saved Videos/Posts state (persisted in session)
  const [savedVideoIds, setSavedVideoIds] = useState<Record<string, boolean>>({
    vid_01: true,
    vid_03: true,
  });

  // Video playback states
  const [isPlayingMap, setIsPlayingMap] = useState<Record<string, boolean>>({});
  const [showPlayPauseRipple, setShowPlayPauseRipple] = useState<{ id: string; playing: boolean } | null>(null);

  // Floating heart burst on double-tap
  const [heartBurst, setHeartBurst] = useState<{ x: number; y: number; id: number } | null>(null);
  const lastTapRef = useRef<number>(0);

  // Comments Sheet state
  const [showCommentsVideoId, setShowCommentsVideoId] = useState<string | null>(null);
  const [commentsMap, setCommentsMap] = useState<Record<string, Array<{ id: string; user: string; text: string; time: string }>>>({
    vid_01: [
      { id: 'c1', user: 'Luna Star 🌙', text: 'Love this choreo! 🔥', time: '1h ago' },
      { id: 'c2', user: 'DJ Kairo', text: 'Bass drop went crazy in this cut', time: '2h ago' },
      { id: 'c3', user: 'Zack Alpha', text: 'Where did you get that neon outfit?!', time: '3h ago' },
    ],
    vid_02: [
      { id: 'c4', user: 'Elena Dance', text: 'Voice of an angel 💜', time: '4h ago' },
      { id: 'c5', user: 'Alex Rider', text: 'Listening on repeat!', time: '5h ago' },
    ],
    vid_03: [
      { id: 'c6', user: 'Sammy ⚡', text: 'Drop of the year for real! 🚀', time: '30m ago' },
    ],
  });
  const [inputComment, setInputComment] = useState('');

  // Gift Modal state
  const [giftTargetPost, setGiftTargetPost] = useState<VideoPost | null>(null);

  // Three-dots More Action Sheet state
  const [threeDotsVideo, setThreeDotsVideo] = useState<VideoPost | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Filter moments according to active tab
  const filteredVideos = videos.filter((vid) => {
    if (activeTab === 'SAVED') {
      return !!savedVideoIds[vid.id];
    }
    if (activeTab === 'TRENDING') {
      return (vid.likes && vid.likes > 20000) || vid.feedCategory === 'Trending';
    }
    if (activeTab === 'FOLLOWING') {
      return followingMap[vid.user.id] || vid.feedCategory === 'Following';
    }
    // FOR YOU - shows all
    return true;
  });

  // Follow / Unfollow creator
  const handleToggleFollow = (userId: string) => {
    setFollowingMap((prev) => {
      const next = !prev[userId];
      showToast(next ? 'Followed creator! ⭐' : 'Unfollowed creator');
      return { ...prev, [userId]: next };
    });
  };

  // Save / Bookmark Video toggle
  const handleToggleSaveVideo = (video: VideoPost) => {
    setSavedVideoIds((prev) => {
      const isSaved = !prev[video.id];
      showToast(
        isSaved
          ? 'Saved to your Collection! Watch anytime in the Saved tab 🔖'
          : 'Removed from Saved'
      );
      return { ...prev, [video.id]: isSaved };
    });
  };

  // Share Video handler
  const handleShare = async (video: VideoPost) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: video.title,
          text: `Check out ${video.user.displayName}'s moment on Alpha Mate!`,
          url: window.location.href,
        });
        return;
      } catch {
        // Fallback to copy link
      }
    }
    await copyToClipboard(window.location.href);
    showToast(`Link to "${video.title}" copied to clipboard! 🔗`);
  };

  // Download Video simulation
  const handleDownloadVideo = (video: VideoPost) => {
    setIsDownloading(true);
    setDownloadProgress(20);
    showToast(`Starting download: "${video.title}"...`);

    const interval = setInterval(() => {
      setDownloadProgress((prev) => {
        if (prev >= 90) {
          clearInterval(interval);
          setTimeout(() => {
            setIsDownloading(false);
            setDownloadProgress(0);
            setThreeDotsVideo(null);
            showToast(`Downloaded "${video.title}" to device gallery! 📥`);
          }, 400);
          return 100;
        }
        return prev + 25;
      });
    }, 250);
  };

  // Add Comment handler
  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputComment.trim() || !showCommentsVideoId) return;

    const newComment = {
      id: `comm_${Date.now()}`,
      user: currentUser.displayName,
      text: inputComment.trim(),
      time: 'Just now',
    };

    setCommentsMap((prev) => ({
      ...prev,
      [showCommentsVideoId]: [newComment, ...(prev[showCommentsVideoId] || [])],
    }));
    setInputComment('');
    showToast('Comment posted! 💬');
  };

  // Tap on video: Single tap toggles Play/Pause; Double tap Likes
  const handleVideoAreaClick = (e: React.MouseEvent, video: VideoPost) => {
    const now = Date.now();
    const timeDiff = now - lastTapRef.current;

    if (timeDiff < 300) {
      // Double Tap detected -> trigger Like & flying heart
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setHeartBurst({ x, y, id: Date.now() });
      setTimeout(() => setHeartBurst(null), 900);

      if (!video.isLiked) {
        toggleLikeVideo(video.id);
      }
      showToast('Liked! 💖');
    } else {
      // Single Tap -> Play/Pause toggle
      const currentlyPlaying = isPlayingMap[video.id] !== false;
      const nextPlaying = !currentlyPlaying;
      setIsPlayingMap((prev) => ({ ...prev, [video.id]: nextPlaying }));
      setShowPlayPauseRipple({ id: video.id, playing: nextPlaying });
      setTimeout(() => setShowPlayPauseRipple(null), 800);
    }
    lastTapRef.current = now;
  };

  // Scroll to next/prev video via chevrons
  const scrollFeed = (direction: 'up' | 'down') => {
    if (containerRef.current) {
      const scrollAmount = containerRef.current.clientHeight;
      containerRef.current.scrollBy({
        top: direction === 'down' ? scrollAmount : -scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  return (
    <div className="relative w-full h-[calc(100vh-64px)] bg-black text-white overflow-hidden select-none">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-[#1A1033]/95 border border-[#A855F7]/40 shadow-2xl backdrop-blur-md text-xs font-semibold text-white flex items-center gap-2 animate-bounce pointer-events-none">
          <Sparkles className="w-3.5 h-3.5 text-[#EC4899]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* =========================================================================
          TOP BAR OVERLAY: Transparent Branding, Tabs & Upload Button
          ========================================================================= */}
      <div className="absolute top-0 inset-x-0 z-30 pointer-events-auto bg-gradient-to-b from-black/85 via-black/40 to-transparent px-3 pt-3 pb-6 flex items-center justify-between">
        {/* Left: Alpha Mate Logo Emblem & Name */}
        <div className="flex items-center gap-2">
          <img
            src="/alpha-mate-logo-emblem.png"
            alt="Alpha Mate"
            className="w-7 h-7 object-contain drop-shadow-[0_0_8px_rgba(168,85,247,0.7)]"
          />
          <span className="text-xs font-black tracking-widest text-white uppercase drop-shadow hidden sm:inline-block">
            MOMENTS
          </span>
        </div>

        {/* Center: Transparent Navigation Tabs */}
        <div className="flex items-center gap-3 sm:gap-5">
          {(['FOR YOU', 'FOLLOWING', 'TRENDING', 'SAVED'] as const).map((tab) => {
            const isActive = activeTab === tab;
            const savedCount = Object.values(savedVideoIds).filter(Boolean).length;

            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`relative pb-1 text-xs sm:text-sm font-black tracking-wider transition-all cursor-pointer focus:outline-none drop-shadow flex items-center gap-1 ${
                  isActive ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <span>{tab}</span>
                {tab === 'SAVED' && savedCount > 0 && (
                  <span className="text-[9px] font-black px-1.5 py-0.2 rounded-full bg-[#EC4899] text-white">
                    {savedCount}
                  </span>
                )}
                {isActive && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2.5px] rounded-full bg-gradient-to-r from-[#A855F7] via-[#EC4899] to-[#F43F5E] shadow-[0_0_8px_#EC4899]" />
                )}
              </button>
            );
          })}
        </div>

        {/* Right: Sound toggle & Upload Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setIsMuted(!isMuted);
              showToast(isMuted ? 'Sound Unmuted 🔊' : 'Sound Muted 🔇');
            }}
            className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-black/60 transition-colors cursor-pointer"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4 text-zinc-300" />
            ) : (
              <Volume2 className="w-4 h-4 text-emerald-400" />
            )}
          </button>

          <button
            onClick={() => setCurrentScreen('upload')}
            className="px-2.5 py-1.5 rounded-full bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white font-bold text-xs shadow-md shadow-[#7928CA]/30 hover:brightness-110 active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
            title="Upload Video or Post"
          >
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
            <span className="text-[11px] hidden sm:inline">Upload</span>
          </button>
        </div>
      </div>

      {/* Desktop Up/Down Navigation Chevrons */}
      <div className="hidden md:flex flex-col gap-2 absolute left-4 top-1/2 -translate-y-1/2 z-30">
        <button
          onClick={() => scrollFeed('up')}
          className="w-9 h-9 rounded-full bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-[#7928CA]/70 transition-colors cursor-pointer"
          title="Previous Moment"
        >
          <ChevronUp className="w-5 h-5" />
        </button>
        <button
          onClick={() => scrollFeed('down')}
          className="w-9 h-9 rounded-full bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-[#7928CA]/70 transition-colors cursor-pointer"
          title="Next Moment"
        >
          <ChevronDown className="w-5 h-5" />
        </button>
      </div>

      {/* =========================================================================
          FULL-SCREEN VERTICAL REEL / SNAP FEED
          One creator video / post occupies the full screen view
          ========================================================================= */}
      <div
        ref={containerRef}
        className="w-full h-full overflow-y-scroll snap-y snap-mandatory scrollbar-none"
      >
        {filteredVideos.length === 0 ? (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-zinc-400 bg-[#09070F]">
            <span className="text-4xl mb-3">
              {activeTab === 'SAVED' ? '🔖' : '🎬'}
            </span>
            <h3 className="text-base font-black text-white mb-1">
              {activeTab === 'SAVED'
                ? 'No Saved Moments Yet'
                : `No moments in ${activeTab}`}
            </h3>
            <p className="text-xs text-zinc-400 max-w-xs mb-4">
              {activeTab === 'SAVED'
                ? 'Tap the bookmark icon on any moment or video to save it here for later viewing!'
                : 'Be the first creator to share your music, dance, or PK moments with Alpha Mate!'}
            </p>
            {activeTab === 'SAVED' ? (
              <button
                onClick={() => setActiveTab('FOR YOU')}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white text-xs font-bold"
              >
                Browse For You Moments
              </button>
            ) : (
              <button
                onClick={() => setCurrentScreen('upload')}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white text-xs font-bold"
              >
                Upload a Moment
              </button>
            )}
          </div>
        ) : (
          filteredVideos.map((video) => {
            const isFollowing = followingMap[video.user.id] || false;
            const isSaved = !!savedVideoIds[video.id];
            const isPlaying = isPlayingMap[video.id] !== false;
            const commentsList = commentsMap[video.id] || [];

            return (
              <div
                key={video.id}
                className="relative w-full h-full snap-start snap-always bg-black flex items-center justify-center overflow-hidden"
              >
                {/* 1. MEDIA PLAYER (Video or Photo Post) */}
                <div
                  className="relative w-full h-full cursor-pointer flex items-center justify-center overflow-hidden"
                  onClick={(e) => handleVideoAreaClick(e, video)}
                >
                  {video.postType === 'post' ? (
                    /* Photo / Image Moment Post with Ambient Backdrop */
                    <div className="relative w-full h-full flex items-center justify-center bg-zinc-950">
                      <img
                        src={video.thumbnail}
                        alt={video.title}
                        className="w-full h-full object-cover"
                      />
                      {/* Ambient Neon Glow */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-black/50" />
                    </div>
                  ) : (
                    /* Video Element */
                    <video
                      src={video.videoUrl}
                      poster={video.thumbnail}
                      loop
                      muted={isMuted}
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover"
                      ref={(el) => {
                        if (el) {
                          if (isPlaying) {
                            el.play().catch(() => {});
                          } else {
                            el.pause();
                          }
                        }
                      }}
                    />
                  )}

                  {/* Gradient Scrims: Dark gradient at bottom for transparent controls */}
                  <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/90 pointer-events-none" />

                  {/* Play / Pause Ripple Indicator when tapped */}
                  {showPlayPauseRipple?.id === video.id && (
                    <div className="absolute z-20 pointer-events-none w-20 h-20 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center border border-white/20 animate-ping">
                      {showPlayPauseRipple.playing ? (
                        <Play className="w-9 h-9 text-white fill-white ml-1" />
                      ) : (
                        <Pause className="w-9 h-9 text-white fill-white" />
                      )}
                    </div>
                  )}

                  {/* Double-Tap Flying Heart Burst */}
                  {heartBurst && (
                    <div
                      className="absolute z-30 pointer-events-none animate-bounce"
                      style={{ left: heartBurst.x - 28, top: heartBurst.y - 28 }}
                    >
                      <Heart className="w-16 h-16 fill-[#EC4899] text-[#EC4899] drop-shadow-[0_0_20px_#EC4899]" />
                    </div>
                  )}
                </div>

                {/* 2. TRANSPARENT RIGHT ACTION RAIL: Avatar, Like, Comment, Gift, Share, Save, Three Dots */}
                <div className="absolute right-2.5 sm:right-3 bottom-20 sm:bottom-24 z-30 flex flex-col items-center gap-2 sm:gap-3">
                  {/* Creator Avatar & Follow Button */}
                  <div className="relative mb-0.5">
                    <div className="w-11 h-11 rounded-full p-[2px] bg-gradient-to-tr from-[#7928CA] to-[#EC4899] shadow-lg shadow-[#7928CA]/40">
                      <img
                        src={video.user.avatar}
                        alt={video.user.displayName}
                        className="w-full h-full rounded-full object-cover bg-zinc-900"
                      />
                    </div>
                    <button
                      onClick={() => handleToggleFollow(video.user.id)}
                      className={`absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-90 cursor-pointer ${
                        isFollowing
                          ? 'bg-zinc-800 text-zinc-300 border border-white/20'
                          : 'bg-[#EC4899] text-white hover:scale-110 shadow-[#EC4899]/50'
                      }`}
                      title={isFollowing ? 'Following' : 'Follow'}
                    >
                      {isFollowing ? (
                        <Check className="w-3 h-3 stroke-[3]" />
                      ) : (
                        <Plus className="w-3.5 h-3.5 stroke-[3]" />
                      )}
                    </button>
                  </div>

                  {/* 1. Like Button */}
                  <div className="flex flex-col items-center">
                    <button
                      onClick={() => toggleLikeVideo(video.id)}
                      className="w-11 h-11 rounded-full bg-black/45 backdrop-blur-md border border-white/20 hover:border-[#EC4899]/60 flex items-center justify-center active:scale-125 transition-all cursor-pointer shadow-lg"
                      title={video.isLiked ? 'Unlike' : 'Like'}
                    >
                      <Heart
                        className={`w-6 h-6 transition-colors ${
                          video.isLiked
                            ? 'fill-[#EC4899] text-[#EC4899] drop-shadow-[0_0_12px_#EC4899]'
                            : 'text-white'
                        }`}
                      />
                    </button>
                    <span className="text-[10px] font-black text-white mt-1 drop-shadow tabular-nums">
                      {video.likes >= 1000 ? `${(video.likes / 1000).toFixed(1)}k` : video.likes}
                    </span>
                  </div>

                  {/* 2. Comment Button */}
                  <div className="flex flex-col items-center">
                    <button
                      onClick={() => setShowCommentsVideoId(video.id)}
                      className="w-11 h-11 rounded-full bg-black/45 backdrop-blur-md border border-white/20 hover:border-white/50 flex items-center justify-center active:scale-110 transition-all cursor-pointer shadow-lg"
                      title="Comments"
                    >
                      <MessageCircle className="w-5 h-5 text-white" />
                    </button>
                    <span className="text-[10px] font-black text-white mt-1 drop-shadow tabular-nums">
                      {(video.commentsCount + commentsList.length).toLocaleString()}
                    </span>
                  </div>

                  {/* 3. Virtual Gift Button */}
                  <div className="flex flex-col items-center">
                    <button
                      onClick={() => setGiftTargetPost(video)}
                      className="w-11 h-11 rounded-full bg-gradient-to-tr from-[#7928CA] to-[#EC4899] p-[1.5px] shadow-lg shadow-[#EC4899]/30 active:scale-110 transition-transform cursor-pointer"
                      title="Send Virtual Gift"
                    >
                      <div className="w-full h-full rounded-full bg-[#180A28] flex items-center justify-center">
                        <GiftIcon className="w-5 h-5 text-amber-300 animate-pulse" />
                      </div>
                    </button>
                    <span className="text-[10px] font-black text-amber-300 mt-1 drop-shadow">
                      Gift
                    </span>
                  </div>

                  {/* 4. Share Button */}
                  <div className="flex flex-col items-center">
                    <button
                      onClick={() => handleShare(video)}
                      className="w-11 h-11 rounded-full bg-black/45 backdrop-blur-md border border-white/20 hover:border-white/50 flex items-center justify-center active:scale-110 transition-all cursor-pointer shadow-lg"
                      title="Share Video"
                    >
                      <Share2 className="w-5 h-5 text-white" />
                    </button>
                    <span className="text-[10px] font-black text-white mt-1 drop-shadow tabular-nums">
                      {video.sharesCount >= 1000
                        ? `${(video.sharesCount / 1000).toFixed(1)}k`
                        : video.sharesCount}
                    </span>
                  </div>

                  {/* 5. Save Video (Bookmark) Button */}
                  <div className="flex flex-col items-center">
                    <button
                      onClick={() => handleToggleSaveVideo(video)}
                      className="w-11 h-11 rounded-full bg-black/45 backdrop-blur-md border border-white/20 hover:border-amber-400/60 flex items-center justify-center active:scale-125 transition-all cursor-pointer shadow-lg"
                      title={isSaved ? 'Remove from Saved' : 'Save Video'}
                    >
                      <Bookmark
                        className={`w-5 h-5 transition-colors ${
                          isSaved
                            ? 'fill-amber-400 text-amber-400 drop-shadow-[0_0_10px_#F59E0B]'
                            : 'text-white'
                        }`}
                      />
                    </button>
                    <span className="text-[10px] font-black text-amber-300 mt-1 drop-shadow tabular-nums">
                      {isSaved ? 'Saved' : 'Save'}
                    </span>
                  </div>

                  {/* 6. Three Dots Button (Download & More Options) */}
                  <div className="flex flex-col items-center">
                    <button
                      onClick={() => setThreeDotsVideo(video)}
                      className="w-11 h-11 rounded-full bg-black/45 backdrop-blur-md border border-white/20 hover:border-[#A855F7]/60 flex items-center justify-center active:scale-110 transition-all cursor-pointer shadow-lg"
                      title="Download & More Actions"
                    >
                      <MoreVertical className="w-5 h-5 text-white" />
                    </button>
                    <span className="text-[10px] font-bold text-zinc-300 mt-1 drop-shadow">
                      More
                    </span>
                  </div>

                  {/* Rotating Music Disc at bottom */}
                  <div className="relative mt-1">
                    <div className="w-9 h-9 rounded-full bg-black/70 border border-white/20 flex items-center justify-center animate-spin [animation-duration:6s]">
                      <div className="w-4 h-4 rounded-full bg-gradient-to-tr from-[#7928CA] to-[#EC4899] flex items-center justify-center">
                        <Music className="w-2.5 h-2.5 text-white" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. TRANSPARENT BOTTOM LEFT OVERLAY: Creator Handle, Caption, Tags, Music Track */}
                <div className="absolute left-3 sm:left-4 right-16 sm:right-18 bottom-20 sm:bottom-24 z-20 flex flex-col gap-1.5 text-left pointer-events-auto">
                  {/* Creator Info */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-black text-white drop-shadow flex items-center gap-1">
                      @{video.user.username}
                    </span>
                    {video.user.isVerified && (
                      <ShieldCheck className="w-4 h-4 text-[#A855F7] fill-[#A855F7]/30" />
                    )}
                    {video.user.vipTier > 0 && (
                      <span className="flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[9px] font-black border border-amber-500/40">
                        <Crown className="w-2.5 h-2.5" />
                        <span>VIP {video.user.vipTier}</span>
                      </span>
                    )}
                    <span className="text-[10px] text-zinc-400 font-medium">
                      • {video.timestamp}
                    </span>
                  </div>

                  {/* Caption / Description */}
                  <p className="text-xs font-semibold text-zinc-100 drop-shadow leading-snug line-clamp-2 max-w-sm">
                    {video.description || video.title}
                  </p>

                  {/* Hashtags */}
                  <div className="flex flex-wrap gap-1.5">
                    {video.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[11px] font-black text-[#C084FC] hover:underline cursor-pointer drop-shadow"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* Music Audio Track Bar */}
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-zinc-300 font-medium bg-black/35 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 w-fit max-w-[280px]">
                    <Music className="w-3.5 h-3.5 text-[#EC4899] animate-pulse" />
                    <span className="truncate">
                      Original Audio • {video.user.displayName}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* =========================================================================
          THREE DOTS ACTION DRAWER (Video Download, Save, Link, Report)
          ========================================================================= */}
      {threeDotsVideo && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col justify-end animate-in fade-in duration-150">
          <div className="flex-1" onClick={() => setThreeDotsVideo(null)} />

          <div className="w-full max-w-md mx-auto rounded-t-3xl bg-[#140C26] border-t border-[#A855F7]/35 p-5 pb-8 shadow-2xl animate-in slide-in-from-bottom duration-200">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full overflow-hidden border border-[#A855F7]/40">
                  <img
                    src={threeDotsVideo.user.avatar}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <h4 className="text-xs font-black text-white truncate max-w-[200px]">
                    {threeDotsVideo.title}
                  </h4>
                  <span className="text-[10px] text-zinc-400">
                    by @{threeDotsVideo.user.username}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setThreeDotsVideo(null)}
                className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Download Progress Bar if active */}
            {isDownloading && (
              <div className="my-3 p-3 rounded-2xl bg-black/40 border border-[#A855F7]/30">
                <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                  <span className="text-zinc-200 flex items-center gap-1.5">
                    <Download className="w-3.5 h-3.5 text-[#EC4899] animate-bounce" />
                    Downloading Video...
                  </span>
                  <span className="text-[#C084FC]">{downloadProgress}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#7928CA] to-[#EC4899] transition-all duration-200 rounded-full"
                    style={{ width: `${downloadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Action Items List */}
            <div className="space-y-2 mt-4">
              {/* Option 1: Download Video */}
              <button
                disabled={isDownloading}
                onClick={() => handleDownloadVideo(threeDotsVideo)}
                className="w-full py-3 px-4 rounded-2xl bg-[#1D1138] hover:bg-[#28184C] border border-[#A855F7]/30 flex items-center justify-between transition-colors cursor-pointer disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#7928CA] to-[#EC4899] flex items-center justify-center text-white">
                    <Download className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <span className="text-xs font-black text-white block">Download Video</span>
                    <span className="text-[10px] text-zinc-400">Save directly to your phone/device gallery</span>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                  HD Quality
                </span>
              </button>

              {/* Option 2: Save / Bookmark Video */}
              <button
                onClick={() => {
                  handleToggleSaveVideo(threeDotsVideo);
                  setThreeDotsVideo(null);
                }}
                className="w-full py-3 px-4 rounded-2xl bg-[#1D1138] hover:bg-[#28184C] border border-white/10 flex items-center gap-3 transition-colors cursor-pointer"
              >
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center">
                  <Bookmark className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <span className="text-xs font-black text-white block">
                    {savedVideoIds[threeDotsVideo.id] ? 'Remove from Saved' : 'Save Video to Collection'}
                  </span>
                  <span className="text-[10px] text-zinc-400">Bookmark to view later anytime in the Saved tab</span>
                </div>
              </button>

              {/* Option 3: Copy Link */}
              <button
                onClick={async () => {
                  await copyToClipboard(window.location.href);
                  showToast('Video link copied to clipboard! 🔗');
                  setThreeDotsVideo(null);
                }}
                className="w-full py-3 px-4 rounded-2xl bg-[#1D1138] hover:bg-[#28184C] border border-white/10 flex items-center gap-3 transition-colors cursor-pointer"
              >
                <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-300 flex items-center justify-center">
                  <Link2 className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <span className="text-xs font-black text-white block">Copy Link</span>
                  <span className="text-[10px] text-zinc-400">Share with friends on external apps</span>
                </div>
              </button>

              {/* Option 4: Not Interested */}
              <button
                onClick={() => {
                  showToast('We will show fewer moments like this.');
                  setThreeDotsVideo(null);
                  scrollFeed('down');
                }}
                className="w-full py-3 px-4 rounded-2xl bg-[#1D1138] hover:bg-[#28184C] border border-white/10 flex items-center gap-3 transition-colors cursor-pointer"
              >
                <div className="w-9 h-9 rounded-xl bg-zinc-700/30 text-zinc-300 flex items-center justify-center">
                  <Slash className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <span className="text-xs font-black text-white block">Not Interested</span>
                  <span className="text-[10px] text-zinc-400">Hide similar moments from your feed</span>
                </div>
              </button>

              {/* Option 5: Report */}
              <button
                onClick={() => {
                  showToast('Thank you. Moment submitted for safety review.');
                  setThreeDotsVideo(null);
                }}
                className="w-full py-3 px-4 rounded-2xl bg-[#1D1138] hover:bg-[#28184C] border border-rose-500/20 flex items-center gap-3 transition-colors cursor-pointer"
              >
                <div className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center">
                  <Flag className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <span className="text-xs font-black text-rose-300 block">Report Moment</span>
                  <span className="text-[10px] text-zinc-400">Report inappropriate or spam content</span>
                </div>
              </button>
            </div>

            <button
              onClick={() => setThreeDotsVideo(null)}
              className="mt-4 w-full py-2.5 rounded-2xl bg-white/10 hover:bg-white/15 text-zinc-300 text-xs font-bold cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          COMMENTS BOTTOM SHEET DRAWER
          ========================================================================= */}
      {showCommentsVideoId && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col justify-end animate-in fade-in duration-150">
          <div className="flex-1" onClick={() => setShowCommentsVideoId(null)} />

          <div className="w-full max-w-md mx-auto rounded-t-3xl bg-[#130B24] border-t border-[#A855F7]/35 p-4 pb-6 shadow-2xl flex flex-col max-h-[70vh] animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-sm font-black text-white uppercase tracking-wider">
                Comments ({(commentsMap[showCommentsVideoId] || []).length})
              </h3>
              <button
                onClick={() => setShowCommentsVideoId(null)}
                className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Comments List */}
            <div className="flex-1 overflow-y-auto py-3 space-y-3">
              {(commentsMap[showCommentsVideoId] || []).length === 0 ? (
                <div className="text-center py-8 text-xs text-zinc-400">
                  No comments yet. Be the first to share your thoughts!
                </div>
              ) : (
                (commentsMap[showCommentsVideoId] || []).map((comm) => (
                  <div key={comm.id} className="flex items-start gap-2.5 text-xs">
                    <div className="w-7 h-7 rounded-full bg-[#241744] flex items-center justify-center font-bold text-[#C084FC] shrink-0 border border-purple-500/30">
                      {comm.user[0]}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{comm.user}</span>
                        <span className="text-[10px] text-zinc-500">{comm.time}</span>
                      </div>
                      <p className="text-zinc-200 mt-0.5 leading-relaxed">{comm.text}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Comment Input */}
            <form
              onSubmit={handleAddComment}
              className="pt-2 flex items-center gap-2 border-t border-white/10"
            >
              <input
                type="text"
                placeholder="Add a friendly comment..."
                value={inputComment}
                onChange={(e) => setInputComment(e.target.value)}
                className="flex-1 h-10 px-4 rounded-full bg-[#1C1236] border border-white/15 text-white placeholder-zinc-500 text-xs focus:outline-none focus:border-[#EC4899]"
              />
              <button
                type="submit"
                disabled={!inputComment.trim()}
                className="w-10 h-10 rounded-full bg-gradient-to-r from-[#7928CA] to-[#EC4899] flex items-center justify-center text-white disabled:opacity-40 shadow-md cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIRTUAL GIFT SENDING DRAWER
          ========================================================================= */}
      {giftTargetPost && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col justify-end animate-in fade-in duration-150">
          <div className="flex-1" onClick={() => setGiftTargetPost(null)} />

          <div className="w-full max-w-md mx-auto rounded-t-3xl bg-[#140C26] border-t border-[#A855F7]/35 p-5 pb-6 shadow-2xl animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div>
                <h3 className="text-sm font-black text-white">
                  Send Gift to @{giftTargetPost.user.username}
                </h3>
                <span className="text-xs text-amber-300 font-bold">
                  💰 {coins.toLocaleString()} Coins Available
                </span>
              </div>
              <button
                onClick={() => setGiftTargetPost(null)}
                className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-2.5 py-4">
              {VIRTUAL_GIFTS.slice(0, 4).map((g) => (
                <button
                  key={g.id}
                  onClick={() => {
                    sendLiveGift(g, giftTargetPost.user.id);
                    setGiftTargetPost(null);
                    showToast(
                      `Sent ${g.name} ${g.icon} to @${giftTargetPost.user.username}! 🎁✨`
                    );
                  }}
                  className="p-3 rounded-2xl bg-[#1E1238] border border-white/10 hover:border-[#EC4899] flex flex-col items-center justify-center cursor-pointer transition-all active:scale-95 shadow-md group"
                >
                  <span className="text-2xl mb-1 group-hover:scale-110 transition-transform">
                    {g.icon}
                  </span>
                  <span className="text-[10px] font-bold text-white truncate max-w-full">
                    {g.name}
                  </span>
                  <span className="text-[10px] text-amber-400 font-black mt-0.5">
                    {g.coins} 💰
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
