import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { VideoPost, FriendStory } from '../types';
import { copyToClipboard } from '../utils/clipboard';
import { CreateStoryModal } from '../components/story/CreateStoryModal';
import { StoryViewerModal } from '../components/story/StoryViewerModal';
import { VerificationTicks } from '../components/badges/VerificationTicks';
import { DEFAULT_AVATAR_URL, safeImageSrc } from '../utils/imageHd';
import {
  Plus,
  Heart,
  MessageCircle,
  Share2,
  Gift as GiftIcon,
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
  Crown,
  Edit3,
  Trash2,
  AlertTriangle,
  Camera,
  Video,
} from 'lucide-react';
import { auth } from '../services/firebase';
import {
  incrementReelViews,
  incrementReelShares,
  addReelComment,
  subscribeToReelComments,
} from '../services/reelsService';
import { GiftAnimationOverlay, ActiveGiftEvent } from '../components/live/GiftAnimationOverlay';
import { GiftCacheBadge, GiftCacheBar, GiftIconImage } from '../components/live/GiftBoxMedia';

export const MomentsScreen: React.FC = () => {
  const {
    videos,
    toggleLikeVideo,
    deleteVideoPost,
    currentUser,
    setCurrentScreen,
    openUploadScreen,
    openPublicUserProfile,
    followingUserIds,
    toggleFollowUser,
    sendLiveGift,
    publishedCatalogGifts,
    coins,
    friendStories,
    myStories,
    addMyStory,
    toggleLikeStory,
    reactToStory,
    liveStreams,
    openLiveStream,
    sendNotificationToUser,
  } = useApp();

  const [showCreateStoryModal, setShowCreateStoryModal] = useState<boolean>(false);
  const [showCreateMenuModal, setShowCreateMenuModal] = useState<boolean>(false);
  const [viewingStoryFriend, setViewingStoryFriend] = useState<FriendStory | null>(null);
  const [isViewingMyStory, setIsViewingMyStory] = useState<boolean>(false);

  // Active top navigation tab: FOR YOU | FOLLOWING | TRENDING | SAVED
  const [activeTab, setActiveTab] = useState<'FOR YOU' | 'FOLLOWING' | 'TRENDING' | 'SAVED'>('FOR YOU');

  // Saved Videos/Posts state (persisted in session)
  const [savedVideoIds, setSavedVideoIds] = useState<Record<string, boolean>>({});

  // Strictly track the single currently visible moment so only its video & audio can play
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);

  // Video playback states (manual pause overrides per video)
  const [isPlayingMap, setIsPlayingMap] = useState<Record<string, boolean>>({});
  const [showPlayPauseRipple, setShowPlayPauseRipple] = useState<{ id: string; playing: boolean } | null>(null);

  // Floating heart burst on double-tap
  const [heartBurst, setHeartBurst] = useState<{ x: number; y: number; id: number } | null>(null);
  const lastTapRef = useRef<number>(0);

  // Comments Sheet state
  const [showCommentsVideoId, setShowCommentsVideoId] = useState<string | null>(null);
  const [commentsMap, setCommentsMap] = useState<
    Record<string, Array<{ id: string; user: string; text: string; time: string }>>
  >({});
  const [inputComment, setInputComment] = useState('');

  // Gift Modal state
  const [giftTargetPost, setGiftTargetPost] = useState<VideoPost | null>(null);
  const [activeMomentGift, setActiveMomentGift] = useState<ActiveGiftEvent | null>(null);

  // Three-dots More Action Sheet state
  const [threeDotsVideo, setThreeDotsVideo] = useState<VideoPost | null>(null);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState<VideoPost | null>(null);
  const [isDeletingReel, setIsDeletingReel] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const slideRefsMap = useRef<Map<string, HTMLDivElement>>(new Map());
  const videoRefsMap = useRef<Map<string, HTMLVideoElement>>(new Map());
  const viewedReelIdsRef = useRef<Set<string>>(new Set());
  const scrollRafRef = useRef<number | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Filter moments according to active tab
  const filteredVideos = useMemo(
    () =>
      videos.filter((vid) => {
        if (activeTab === 'SAVED') {
          return !!savedVideoIds[vid.id];
        }
        if (activeTab === 'TRENDING') {
          return (vid.likes && vid.likes > 20000) || vid.feedCategory === 'Trending';
        }
        if (activeTab === 'FOLLOWING') {
          return followingUserIds.includes(vid.user.id) || vid.feedCategory === 'Following';
        }
        // FOR YOU - shows all
        return true;
      }),
    [videos, activeTab, savedVideoIds, followingUserIds]
  );

  const filteredVideoIdsKey = useMemo(
    () => filteredVideos.map((v) => v.id).join('|'),
    [filteredVideos]
  );

  // Ensure activeVideoId always points to a valid visible slide in the active tab
  useEffect(() => {
    if (filteredVideos.length === 0) {
      setActiveVideoId(null);
      return;
    }
    setActiveVideoId((prev) => {
      if (prev && filteredVideos.some((v) => v.id === prev)) return prev;
      return filteredVideos[0].id;
    });
  }, [filteredVideoIdsKey, filteredVideos]);

  // Reset scroll position to the first item when switching feed tabs
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
    setActiveVideoId(filteredVideos[0]?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Observe which slide occupies the viewport so only that single video is active
  useEffect(() => {
    const root = containerRef.current;
    if (!root || filteredVideos.length === 0) return;

    if (typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        let bestId: string | null = null;
        let bestRatio = 0;
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.55 && entry.intersectionRatio > bestRatio) {
            const id = (entry.target as HTMLElement).dataset.momentId || null;
            if (id) {
              bestId = id;
              bestRatio = entry.intersectionRatio;
            }
          }
        });
        if (bestId) {
          setActiveVideoId(bestId);
        }
      },
      {
        root,
        threshold: [0.55, 0.75, 0.9],
      }
    );

    slideRefsMap.current.forEach((el) => {
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, [filteredVideoIdsKey]);

  // Sync activeVideoId from scroll snap offset (handles rapid swipes & chevron jumps reliably)
  const handleFeedScroll = () => {
    if (scrollRafRef.current !== null) return;
    scrollRafRef.current = window.requestAnimationFrame(() => {
      scrollRafRef.current = null;
      const root = containerRef.current;
      if (!root || filteredVideos.length === 0) return;
      const slideHeight = root.clientHeight;
      if (slideHeight <= 0) return;
      const idx = Math.min(
        filteredVideos.length - 1,
        Math.max(0, Math.round(root.scrollTop / slideHeight))
      );
      const target = filteredVideos[idx];
      if (target && target.id !== activeVideoId) {
        setActiveVideoId(target.id);
      }
    });
  };

  // Clear any manual pause override whenever the user scrolls to a different video
  useEffect(() => {
    if (!activeVideoId) return;
    setIsPlayingMap((prev) => {
      if (prev[activeVideoId] === false) {
        const next = { ...prev };
        delete next[activeVideoId];
        return next;
      }
      return prev;
    });
  }, [activeVideoId]);

  // Track real-time views in Firestore once per active reel per session (videos + posts)
  useEffect(() => {
    if (!activeVideoId) return;
    if (!viewedReelIdsRef.current.has(activeVideoId)) {
      viewedReelIdsRef.current.add(activeVideoId);
      incrementReelViews(activeVideoId).catch(() => {});
    }
  }, [activeVideoId]);

  // Strictly enforce single-video direct-audio playback across the entire feed.
  // Audio plays directly with sound ON whenever entering or scrolling Moments.
  useEffect(() => {
    const isCoveredByStory = Boolean(viewingStoryFriend);
    const isPageHidden = typeof document !== 'undefined' && document.hidden;
    let cleanupGestureUnlock: (() => void) | null = null;

    // Pass 1: Immediately mute and pause ALL non-active videos so audio can never overlap/mix
    videoRefsMap.current.forEach((el, id) => {
      if (id !== activeVideoId) {
        el.muted = true;
        if (!el.paused) {
          el.pause();
        }
        if (el.currentTime > 0) {
          try {
            el.currentTime = 0;
          } catch {
            // ignore seek error before metadata loads
          }
        }
      }
    });

    // Pass 2: Play ONLY the single active video with sound ON directly
    if (!activeVideoId) return;
    const activeEl = videoRefsMap.current.get(activeVideoId);
    if (!activeEl) return;

    const shouldPlay =
      !isPageHidden && !isCoveredByStory && isPlayingMap[activeVideoId] !== false;

    if (!shouldPlay) {
      activeEl.muted = true;
      if (!activeEl.paused) {
        activeEl.pause();
      }
      return;
    }

    activeEl.muted = false;
    activeEl.volume = 1;
    const playPromise = activeEl.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        // Cold page load before first browser gesture: start video smoothly and
        // immediately restore direct audio on the very first touch/pointer/key gesture.
        if (videoRefsMap.current.get(activeVideoId) !== activeEl) return;
        activeEl.muted = true;
        activeEl.play().catch(() => {});

        const unlockDirectAudio = () => {
          const currentEl = videoRefsMap.current.get(activeVideoId);
          if (currentEl) {
            currentEl.muted = false;
            currentEl.volume = 1;
            if (currentEl.paused) {
              currentEl.play().catch(() => {});
            }
          }
          cleanupGestureUnlock?.();
        };

        window.addEventListener('pointerdown', unlockDirectAudio, { passive: true, once: true });
        window.addEventListener('touchstart', unlockDirectAudio, { passive: true, once: true });
        window.addEventListener('keydown', unlockDirectAudio, { passive: true, once: true });
        cleanupGestureUnlock = () => {
          window.removeEventListener('pointerdown', unlockDirectAudio);
          window.removeEventListener('touchstart', unlockDirectAudio);
          window.removeEventListener('keydown', unlockDirectAudio);
          cleanupGestureUnlock = null;
        };
      });
    }

    return () => {
      cleanupGestureUnlock?.();
    };
  }, [activeVideoId, isPlayingMap, viewingStoryFriend, filteredVideoIdsKey]);

  // Pause and mute all videos when app goes to background or when leaving MomentsScreen
  useEffect(() => {
    const pauseAllVideos = () => {
      videoRefsMap.current.forEach((el) => {
        el.muted = true;
        if (!el.paused) el.pause();
      });
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        pauseAllVideos();
      } else if (activeVideoId && !viewingStoryFriend && isPlayingMap[activeVideoId] !== false) {
        const activeEl = videoRefsMap.current.get(activeVideoId);
        if (activeEl) {
          activeEl.muted = false;
          activeEl.volume = 1;
          activeEl.play().catch(() => {});
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (scrollRafRef.current !== null) {
        window.cancelAnimationFrame(scrollRafRef.current);
        scrollRafRef.current = null;
      }
      pauseAllVideos();
    };
  }, [activeVideoId, isPlayingMap, viewingStoryFriend]);

  // Real-time Firestore comments listener when drawer is open
  useEffect(() => {
    if (!showCommentsVideoId || showCommentsVideoId.startsWith('vid_')) return;
    const unsubscribe = subscribeToReelComments(showCommentsVideoId, (remoteComments) => {
      setCommentsMap((prev) => ({
        ...prev,
        [showCommentsVideoId]: remoteComments.map((c) => ({
          id: c.id,
          user: c.user,
          text: c.text,
          time: c.time,
        })),
      }));
    });
    return () => unsubscribe();
  }, [showCommentsVideoId]);

  // Follow / Unfollow creator in real-time Firestore
  const handleToggleFollow = async (targetUser: VideoPost['user']) => {
    const nextFollow = await toggleFollowUser(targetUser);
    showToast(nextFollow ? 'Followed creator! ⭐' : 'Unfollowed creator');
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

  // Share Video handler (increments real-time sharesCount in Firestore)
  const handleShare = async (video: VideoPost) => {
    incrementReelShares(video.id).catch(() => {});
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

    const commentText = inputComment.trim();
    const targetVideo = videos.find((v) => v.id === showCommentsVideoId);
    const newComment = {
      id: `comm_${Date.now()}`,
      user: currentUser.displayName,
      text: commentText,
      time: 'Just now',
    };

    if (showCommentsVideoId.startsWith('vid_')) {
      setCommentsMap((prev) => ({
        ...prev,
        [showCommentsVideoId]: [newComment, ...(prev[showCommentsVideoId] || [])],
      }));
    } else if (auth.currentUser) {
      addReelComment(showCommentsVideoId, commentText, {
        id: currentUser.id,
        displayName: currentUser.displayName,
        avatar: currentUser.avatar,
      }).catch(() => {
        setCommentsMap((prev) => ({
          ...prev,
          [showCommentsVideoId]: [newComment, ...(prev[showCommentsVideoId] || [])],
        }));
      });
    } else {
      setCommentsMap((prev) => ({
        ...prev,
        [showCommentsVideoId]: [newComment, ...(prev[showCommentsVideoId] || [])],
      }));
    }

    if (targetVideo?.user?.id && targetVideo.user.id !== currentUser.id) {
      sendNotificationToUser({
        recipientId: targetVideo.user.id,
        type: 'comment',
        category: 'comments',
        title: `💭 ${currentUser.displayName} commented on your Moment`,
        message: `"${commentText.slice(0, 120)}"`,
        screen: 'moments',
        reelId: targetVideo.id,
      }).catch(() => {});
    }

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
    <div className="relative w-full h-full bg-black text-white overflow-hidden select-none">
      <GiftAnimationOverlay
        currentEvent={activeMomentGift}
        layer="both"
        onComplete={() => setActiveMomentGift(null)}
      />
      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-[#1A1033]/95 border border-[#A855F7]/40 shadow-2xl backdrop-blur-md text-xs font-semibold text-white flex items-center gap-2 animate-bounce pointer-events-none max-w-[calc(100%-2rem)]">
          <Sparkles className="w-3.5 h-3.5 text-[#EC4899] shrink-0" />
          <span className="truncate">{toastMessage}</span>
        </div>
      )}

      {/* =========================================================================
          TOP BAR OVERLAY: Clean TikTok-style Branding & Feed Tabs (No Speaker Toggle)
          ========================================================================= */}
      <div className="absolute top-0 inset-x-0 z-30 pointer-events-auto bg-gradient-to-b from-black/75 via-black/30 to-transparent px-3 pt-2.5 pb-5 flex items-center justify-between gap-2">
        {/* Left: Alpha Mate Logo Emblem */}
        <div className="flex items-center gap-2 shrink-0 w-7 sm:w-auto">
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
        <div className="flex items-center justify-center gap-3 sm:gap-5 min-w-0 flex-1 overflow-x-auto scrollbar-none px-1">
          {(['FOR YOU', 'FOLLOWING', 'TRENDING', 'SAVED'] as const).map((tab) => {
            const isActive = activeTab === tab;
            const savedCount = Object.values(savedVideoIds).filter(Boolean).length;

            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`relative pb-1 text-[11px] sm:text-sm font-black tracking-wider transition-all cursor-pointer focus:outline-none drop-shadow flex items-center gap-1 whitespace-nowrap shrink-0 ${
                  isActive ? 'text-white' : 'text-zinc-300/75 hover:text-white'
                }`}
              >
                <span>{tab}</span>
                {tab === 'SAVED' && savedCount > 0 && (
                  <span className="text-[9px] font-black px-1.5 py-0.2 rounded-full bg-[#EC4899] text-white tabular-nums">
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

        {/* Right spacer to keep tabs visually centered */}
        <div className="w-7 sm:w-16 shrink-0 pointer-events-none" aria-hidden="true" />
      </div>

      {/* Desktop Up/Down Navigation Chevrons */}
      <div className="hidden md:flex flex-col gap-2 absolute left-4 top-1/2 -translate-y-1/2 z-30">
        <button
          type="button"
          onClick={() => scrollFeed('up')}
          className="w-9 h-9 rounded-full bg-black/55 backdrop-blur-md border border-white/15 flex items-center justify-center text-white hover:bg-[#7928CA]/70 transition-colors cursor-pointer"
          title="Previous Moment"
        >
          <ChevronUp className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={() => scrollFeed('down')}
          className="w-9 h-9 rounded-full bg-black/55 backdrop-blur-md border border-white/15 flex items-center justify-center text-white hover:bg-[#7928CA]/70 transition-colors cursor-pointer"
          title="Next Moment"
        >
          <ChevronDown className="w-5 h-5" />
        </button>
      </div>

      {/* =========================================================================
          FULL-SCREEN VERTICAL REEL / SNAP FEED (Silky TikTok Snap Scrolling)
          ========================================================================= */}
      <div
        ref={containerRef}
        onScroll={handleFeedScroll}
        className="w-full h-full overflow-y-scroll snap-y snap-mandatory overscroll-y-contain touch-pan-y scrollbar-none [-webkit-overflow-scrolling:touch]"
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
          filteredVideos.map((video, index) => {
            const isFollowing = followingUserIds.includes(video.user.id);
            const isSaved = !!savedVideoIds[video.id];
            const isActiveSlide = video.id === activeVideoId;
            const activeIndex = filteredVideos.findIndex((v) => v.id === activeVideoId);
            const isNextSlide = activeIndex >= 0 && index === activeIndex + 1;
            const isAdjacentSlide = activeIndex >= 0 && Math.abs(index - activeIndex) <= 1;
            const commentsList = commentsMap[video.id] || [];
            const displayCommentsCount = video.id.startsWith('vid_')
              ? (video.commentsCount || 0) + commentsList.length
              : Math.max(video.commentsCount || 0, commentsList.length);
            const displayViewsCount = Math.max(0, video.viewsCount || 0);

            return (
              <div
                key={video.id}
                data-moment-id={video.id}
                ref={(el) => {
                  if (el) {
                    slideRefsMap.current.set(video.id, el);
                  } else {
                    slideRefsMap.current.delete(video.id);
                  }
                }}
                className="relative w-full h-full shrink-0 snap-start snap-always bg-black flex items-center justify-center overflow-hidden will-change-transform"
              >
                {/* 1. MEDIA PLAYER (Video or Photo Post) */}
                <div
                  className="relative w-full h-full cursor-pointer flex items-center justify-center overflow-hidden"
                  onClick={(e) => handleVideoAreaClick(e, video)}
                >
                  {video.postType === 'post' ? (
                    /* Rich Text Post or Photo Moment Post with Ambient Backdrop */
                    <div
                      className={`relative w-full h-full flex items-center justify-center p-6 ${
                        video.attachedPhotoUrl ? 'bg-black' : video.backgroundColor ? `bg-gradient-to-br ${video.backgroundColor}` : 'bg-gradient-to-br from-[#4C1D95] via-[#2E1065] to-[#1E0836]'
                      }`}
                    >
                      {/* Attached Photo Background */}
                      {safeImageSrc(video.attachedPhotoUrl) && (
                        <div className="absolute inset-0 z-0">
                          <img
                            src={safeImageSrc(video.attachedPhotoUrl)}
                            alt={video.title}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/50 backdrop-blur-[1px]" />
                        </div>
                      )}

                      {/* Text Over Photo Mode or Canvas Post Card */}
                      {video.textContent && (
                        <div
                          className={`relative z-10 max-w-sm w-full p-6 rounded-3xl text-center shadow-2xl ${
                            video.isTextOnPhoto
                              ? 'bg-black/60 backdrop-blur-md border border-white/25 shadow-purple-950/50'
                              : 'bg-transparent'
                          }`}
                        >
                          <p
                            className={`text-lg sm:text-2xl font-black text-white leading-relaxed drop-shadow-md ${
                              video.fontStyle === 'serif'
                                ? 'font-serif italic'
                                : video.fontStyle === 'neon'
                                ? 'font-mono text-[#F472B6] drop-shadow-[0_0_12px_#EC4899]'
                                : video.fontStyle === 'script'
                                ? 'font-serif tracking-wider'
                                : 'font-sans'
                            }`}
                          >
                            “{video.textContent}”
                          </p>

                          {/* Music Badge on Post Card */}
                          {video.musicTitle && (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md border border-[#EC4899]/40 text-amber-300 text-[11px] font-bold mt-4 shadow-md">
                              <Music className="w-3.5 h-3.5 text-[#EC4899] animate-pulse" />
                              <span>{video.musicTitle}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {!video.textContent && safeImageSrc(video.thumbnail) && (
                        <img
                          src={safeImageSrc(video.thumbnail)}
                          alt={video.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      )}

                      {/* Ambient Gradient Scrim */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-black/35 pointer-events-none" />
                    </div>
                  ) : (
                    /* Video Element: direct sound on active slide; non-active slides stay paused & muted */
                    <video
                      src={safeImageSrc(video.videoUrl)}
                      poster={safeImageSrc(video.thumbnail)}
                      loop
                      muted={!isActiveSlide}
                      playsInline
                      preload={isActiveSlide || isNextSlide ? 'auto' : isAdjacentSlide ? 'metadata' : 'none'}
                      className="w-full h-full object-cover"
                      onPlay={() => {
                        if (isActiveSlide && !viewedReelIdsRef.current.has(video.id)) {
                          viewedReelIdsRef.current.add(video.id);
                          incrementReelViews(video.id).catch(() => {});
                        }
                      }}
                      ref={(el) => {
                        if (el) {
                          videoRefsMap.current.set(video.id, el);
                          if (!isActiveSlide) {
                            el.muted = true;
                            if (!el.paused) el.pause();
                          }
                        } else {
                          const prevEl = videoRefsMap.current.get(video.id);
                          if (prevEl) {
                            prevEl.muted = true;
                            prevEl.pause();
                          }
                          videoRefsMap.current.delete(video.id);
                        }
                      }}
                    />
                  )}

                  {/* Measured Bottom & Top Scrims for TikTok-clean legibility without darkening the video */}
                  <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/55 to-transparent pointer-events-none" />
                  <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/85 via-black/35 to-transparent pointer-events-none" />

                  {/* Play / Pause Ripple Indicator when tapped */}
                  {showPlayPauseRipple?.id === video.id && (
                    <div className="absolute z-20 pointer-events-none w-20 h-20 rounded-full bg-black/55 backdrop-blur-md flex items-center justify-center border border-white/20 animate-ping">
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

                {/* 2. CLEAN TIKTOK RIGHT ACTION RAIL (Anchored Right Above Lower Navigation)
                    Top-to-bottom: '+' Upload Button -> Creator Avatar -> Like -> Comment -> Gift -> Share -> Save -> More -> Spinning Disc */}
                <div className="absolute right-2 sm:right-3 bottom-3 sm:bottom-4 z-30 flex flex-col items-center gap-2 sm:gap-2.5">
                  {/* '+' Upload / Create Button placed cleanly just above the Creator Profile Picture */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowCreateMenuModal(true);
                    }}
                    aria-label="Upload Video, Photo, Post or Story"
                    title="Upload Video, Photo, Post or Story"
                    className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#7928CA] via-[#EC4899] to-[#F59E0B] p-[1.5px] shadow-lg shadow-[#EC4899]/35 hover:scale-105 active:scale-95 transition-transform cursor-pointer mb-1"
                  >
                    <div className="w-full h-full rounded-full bg-black/55 backdrop-blur-md flex items-center justify-center text-white">
                      <Plus className="w-5 h-5 stroke-[2.75]" />
                    </div>
                  </button>

                  {/* Creator Avatar & Follow Button */}
                  <div className="relative mb-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openPublicUserProfile(video.user);
                      }}
                      className="w-11 h-11 rounded-full p-[2px] bg-gradient-to-tr from-[#7928CA] to-[#EC4899] shadow-lg shadow-black/50 cursor-pointer block hover:scale-105 transition-transform"
                      title={`View ${video.user.displayName}'s profile`}
                    >
                      <img
                        src={safeImageSrc(video.user.avatar, DEFAULT_AVATAR_URL)}
                        alt={video.user.displayName}
                        referrerPolicy="no-referrer"
                        className="w-full h-full rounded-full object-cover bg-zinc-900"
                      />
                    </button>
                    {video.user.id !== currentUser.id && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleFollow(video.user);
                        }}
                        className={`absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-90 cursor-pointer ${
                          isFollowing
                            ? 'bg-zinc-800 text-zinc-200 border border-white/25'
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
                    )}
                  </div>

                  {/* 1. Like Button (Real-Time Count) */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleLikeVideo(video.id);
                    }}
                    className="flex flex-col items-center min-w-[44px] active:scale-110 transition-transform cursor-pointer"
                    title={video.isLiked ? 'Unlike' : 'Like'}
                  >
                    <Heart
                      className={`w-7 h-7 transition-colors drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)] ${
                        video.isLiked
                          ? 'fill-[#EC4899] text-[#EC4899] drop-shadow-[0_0_12px_#EC4899]'
                          : 'text-white'
                      }`}
                    />
                    <span className="text-[11px] font-extrabold text-white mt-0.5 drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)] tabular-nums">
                      {video.likes >= 1000 ? `${(video.likes / 1000).toFixed(1)}k` : video.likes}
                    </span>
                  </button>

                  {/* 2. Comment Button (Real-Time Count) */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowCommentsVideoId(video.id);
                    }}
                    className="flex flex-col items-center min-w-[44px] active:scale-110 transition-transform cursor-pointer"
                    title="Comments"
                  >
                    <MessageCircle className="w-7 h-7 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]" />
                    <span className="text-[11px] font-extrabold text-white mt-0.5 drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)] tabular-nums">
                      {displayCommentsCount >= 1000
                        ? `${(displayCommentsCount / 1000).toFixed(1)}k`
                        : displayCommentsCount.toLocaleString()}
                    </span>
                  </button>

                  {/* 3. Virtual Gift Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setGiftTargetPost(video);
                    }}
                    className="flex flex-col items-center min-w-[44px] active:scale-110 transition-transform cursor-pointer"
                    title="Send Virtual Gift"
                  >
                    <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#7928CA] to-[#EC4899] p-[1.5px] shadow-md shadow-[#EC4899]/35">
                      <div className="w-full h-full rounded-full bg-[#180A28]/90 flex items-center justify-center">
                        <GiftIcon className="w-4.5 h-4.5 text-amber-300" />
                      </div>
                    </div>
                    <span className="text-[10px] font-extrabold text-amber-300 mt-0.5 drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
                      Gift
                    </span>
                  </button>

                  {/* 4. Share Button (Real-Time Count) */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleShare(video);
                    }}
                    className="flex flex-col items-center min-w-[44px] active:scale-110 transition-transform cursor-pointer"
                    title="Share Video"
                  >
                    <Share2 className="w-6 h-6 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]" />
                    <span className="text-[11px] font-extrabold text-white mt-0.5 drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)] tabular-nums">
                      {video.sharesCount >= 1000
                        ? `${(video.sharesCount / 1000).toFixed(1)}k`
                        : video.sharesCount}
                    </span>
                  </button>

                  {/* 5. Save Video (Bookmark) Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleSaveVideo(video);
                    }}
                    className="flex flex-col items-center min-w-[44px] active:scale-110 transition-transform cursor-pointer"
                    title={isSaved ? 'Remove from Saved' : 'Save Video'}
                  >
                    <Bookmark
                      className={`w-6 h-6 transition-colors drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)] ${
                        isSaved
                          ? 'fill-amber-400 text-amber-400 drop-shadow-[0_0_10px_#F59E0B]'
                          : 'text-white'
                      }`}
                    />
                    <span className="text-[10px] font-bold text-white/90 mt-0.5 drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
                      {isSaved ? 'Saved' : 'Save'}
                    </span>
                  </button>

                  {/* 6. More Options Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setThreeDotsVideo(video);
                    }}
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white/90 hover:text-white active:scale-110 transition-transform cursor-pointer"
                    title="Download & More Actions"
                    aria-label="More options"
                  >
                    <MoreVertical className="w-5 h-5 drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]" />
                  </button>

                  {/* Rotating Music Disc at very bottom of rail */}
                  <div className="w-9 h-9 rounded-full bg-black/75 border-2 border-zinc-700/90 flex items-center justify-center animate-spin [animation-duration:6s] shadow-lg">
                    <div className="w-4 h-4 rounded-full bg-gradient-to-tr from-[#7928CA] to-[#EC4899] flex items-center justify-center">
                      <Music className="w-2.5 h-2.5 text-white" />
                    </div>
                  </div>
                </div>

                {/* 3. CLEAN TIKTOK BOTTOM-LEFT OVERLAY (Right Above Lower Navigation)
                    Name/Handle + Views -> Caption & Tags -> Music Track at bottom */}
                <div className="absolute left-3 sm:left-4 right-[72px] sm:right-20 bottom-3 sm:bottom-4 z-20 flex flex-col gap-1 text-left pointer-events-auto">
                  {/* Creator Handle + Live Views */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openPublicUserProfile(video.user);
                      }}
                      className="text-[15px] font-black text-white drop-shadow-[0_1px_6px_rgba(0,0,0,0.9)] flex items-center gap-1 hover:text-[#F472B6] transition-colors cursor-pointer"
                    >
                      @{video.user.username}
                    </button>
                    <VerificationTicks
                      isAccountVerified={Boolean(video.user.isAccountVerified || video.user.greenTick)}
                      isBlueTickVerified={Boolean(video.user.isVerified)}
                      size="sm"
                    />
                    {video.user.vipTier > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-amber-300 text-[10px] font-extrabold drop-shadow">
                        <Crown className="w-2.5 h-2.5" />
                        <span>VIP {video.user.vipTier}</span>
                      </span>
                    )}
                    <span className="text-[11px] text-white/75 font-medium drop-shadow">·</span>
                    <span className="inline-flex items-center gap-1 text-[11px] text-white/85 font-semibold drop-shadow tabular-nums">
                      <Eye className="w-3 h-3 text-white/80" />
                      {displayViewsCount >= 1000
                        ? `${(displayViewsCount / 1000).toFixed(1)}k`
                        : displayViewsCount.toLocaleString()}
                    </span>
                  </div>

                  {/* Caption / Description */}
                  {(video.description || video.title) && (
                    <p className="text-xs sm:text-[13px] font-medium text-white/95 drop-shadow-[0_1px_5px_rgba(0,0,0,0.9)] leading-snug line-clamp-2 max-w-sm">
                      {video.description || video.title}
                    </p>
                  )}

                  {/* Hashtags (quiet inline) */}
                  {video.tags && video.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {video.tags.slice(0, 4).map((tag) => (
                        <span
                          key={tag}
                          className="text-[11px] font-bold text-white/90 drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Music Audio Track Row (Anchored cleanly right above lower navigation) */}
                  <div className="flex items-center gap-1.5 mt-0.5 text-[11.5px] text-white/90 font-semibold drop-shadow-[0_1px_5px_rgba(0,0,0,0.95)] max-w-[270px]">
                    <Music className="w-3.5 h-3.5 text-white shrink-0" />
                    <span className="truncate">
                      {video.musicTitle
                        ? `${video.musicTitle} · ${video.musicArtist || video.user.displayName}`
                        : `Original Sound · ${video.user.displayName}`}
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
                    src={safeImageSrc(threeDotsVideo.user.avatar, DEFAULT_AVATAR_URL)}
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

              {/* Option 6: Delete Reel (Strictly for Owner) */}
              {(threeDotsVideo.user.id === currentUser.id ||
                (auth.currentUser && threeDotsVideo.user.id === auth.currentUser.uid)) && (
                <button
                  onClick={() => {
                    const target = threeDotsVideo;
                    setThreeDotsVideo(null);
                    setShowDeleteConfirmModal(target);
                  }}
                  className="w-full py-3 px-4 rounded-2xl bg-rose-950/60 hover:bg-rose-900/70 border border-rose-500/40 flex items-center gap-3 transition-colors cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-xl bg-rose-600/30 text-rose-300 flex items-center justify-center">
                    <Trash2 className="w-4 h-4 text-rose-400" />
                  </div>
                  <div className="text-left">
                    <span className="text-xs font-black text-rose-300 block">Delete Reel (Cloudflare R2)</span>
                    <span className="text-[10px] text-rose-400/80">Permanently remove video and metadata</span>
                  </div>
                </button>
              )}
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
          CONFIRM DELETE REEL MODAL (Permanent Cloudflare R2 & Firestore Deletion)
          ========================================================================= */}
      {showDeleteConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-3xl bg-[#170E28] border border-rose-500/30 p-5 shadow-2xl text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-rose-600/20 text-rose-400 mx-auto flex items-center justify-center border border-rose-500/30">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-base font-black text-white">Delete This Reel?</h3>
              <p className="text-xs text-zinc-300 mt-1.5 leading-relaxed">
                This will permanently delete the video file from <strong className="text-amber-300">Cloudflare R2 Object Storage</strong> and remove its record from Cloud Firestore.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                disabled={isDeletingReel}
                onClick={() => setShowDeleteConfirmModal(null)}
                className="py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-zinc-300 text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isDeletingReel}
                onClick={async () => {
                  if (!showDeleteConfirmModal) return;
                  setIsDeletingReel(true);
                  try {
                    showToast('Deleting video from Cloudflare R2...');
                    await deleteVideoPost(showDeleteConfirmModal.id, showDeleteConfirmModal.videoKey);
                    showToast('Reel deleted from R2 and Moments! 🗑️');
                    setShowDeleteConfirmModal(null);
                  } catch (err: any) {
                    showToast(`Deletion failed: ${err?.message || 'Error'}`);
                  } finally {
                    setIsDeletingReel(false);
                  }
                }}
                className="py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white text-xs font-black shadow-lg shadow-rose-900/40 transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeletingReel ? 'Deleting...' : 'Delete Now'}</span>
              </button>
            </div>
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

            <GiftCacheBar gifts={publishedCatalogGifts} />

            <div className="grid grid-cols-4 gap-2.5 py-4 max-h-64 overflow-y-auto">
              {publishedCatalogGifts.map((g) => {
                const giftCost = g.costInCoins ?? g.coins;
                const handleSendMomentGift = () => {
                  if (coins < giftCost) {
                    showToast(`Insufficient coins! You need ${giftCost.toLocaleString()} Coins.`);
                    return;
                  }
                  const sent = sendLiveGift(g, giftTargetPost.user.id, 1, giftTargetPost.user.displayName, {
                    context: 'moments',
                    reelId: giftTargetPost.id,
                  });
                  if (!sent) {
                    showToast('Gift could not be sent. Please try again.');
                    return;
                  }
                  setActiveMomentGift({
                    id: `moment_gift_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                    gift: g,
                    senderName: currentUser.displayName,
                    senderAvatar: currentUser.avatar,
                    senderVipTier: currentUser.vipTier ?? 0,
                    recipientName: giftTargetPost.user.displayName,
                    comboCount: 1,
                    quantity: 1,
                    timestamp: Date.now(),
                  });
                  setGiftTargetPost(null);
                  showToast(`Sent ${g.name} to @${giftTargetPost.user.username}! ✨`);
                };
                return (
                  <div
                    key={g.id}
                    role="button"
                    tabIndex={0}
                    onClick={handleSendMomentGift}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleSendMomentGift();
                      }
                    }}
                    className="relative p-3 rounded-2xl bg-[#1E1238] border border-white/10 hover:border-[#EC4899] flex flex-col items-center justify-center cursor-pointer transition-all active:scale-95 shadow-md group"
                  >
                    {g.advancedConfig?.format && (
                      <span className="absolute -top-1.5 -left-1 px-1 rounded bg-emerald-600/90 text-[6.5px] font-black text-white uppercase shadow">
                        {g.advancedConfig.format}
                      </span>
                    )}
                    <GiftIconImage
                      gift={g}
                      className="w-10 h-10 object-contain mb-1 group-hover:scale-105 transition-transform drop-shadow"
                      emojiClassName="text-2xl mb-1 group-hover:scale-110 transition-transform"
                    />
                    <span className="text-[10px] font-bold text-white truncate max-w-full">
                      {g.name}
                    </span>
                    <span className="text-[10px] text-amber-400 font-black mt-0.5">
                      {giftCost.toLocaleString()} 💰
                    </span>
                    <GiftCacheBadge gift={g} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Story Viewer Modal */}
      {(viewingStoryFriend || isViewingMyStory) && (
        <StoryViewerModal
          friend={viewingStoryFriend}
          isMyStory={isViewingMyStory}
          currentUser={currentUser}
          myStories={myStories}
          allFriends={friendStories}
          onClose={() => {
            setViewingStoryFriend(null);
            setIsViewingMyStory(false);
          }}
          onOpenLiveStream={(streamId) => {
            const stream = liveStreams.find((s) => s.id === streamId);
            if (stream) openLiveStream(stream);
          }}
          onToggleLike={toggleLikeStory}
          onReact={reactToStory}
          onOpenCreateStory={() => setShowCreateStoryModal(true)}
        />
      )}

      {/* Create Story Modal */}
      {showCreateStoryModal && (
        <CreateStoryModal
          currentUser={currentUser}
          onClose={() => setShowCreateStoryModal(false)}
          onSubmit={(newStory) => {
            addMyStory(newStory);
            showToast('Story posted successfully! 🌟 (Active for 24h)');
          }}
        />
      )}

      {/* Corner '+' Creation Sheet (All 4 Options: Story, Post, Photo, Video) */}
      {showCreateMenuModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150"
          onClick={() => setShowCreateMenuModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-[#140C26] border border-[#A855F7]/35 p-5 pb-[max(24px,var(--app-safe-bottom,0px))] shadow-2xl space-y-3"
          >
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div>
                <h3 className="text-sm font-black text-white">Create Moment</h3>
                <p className="text-[11px] text-zinc-400">Choose what you want to share</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateMenuModal(false)}
                aria-label="Close create options"
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-zinc-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {/* 1. Add Story */}
              <button
                type="button"
                onClick={() => {
                  setShowCreateMenuModal(false);
                  setShowCreateStoryModal(true);
                }}
                className="p-3.5 rounded-2xl bg-gradient-to-br from-[#EC4899]/20 to-[#06B6D4]/20 border border-[#EC4899]/40 hover:border-[#EC4899] text-left space-y-1.5 cursor-pointer active:scale-95 transition-all"
              >
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#EC4899] to-[#06B6D4] flex items-center justify-center text-white shadow-md">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="text-xs font-black text-white">Add Story</div>
                <div className="text-[10px] text-zinc-400">Share a 24-hour status story</div>
              </button>

              {/* 2. Write Post */}
              <button
                type="button"
                onClick={() => {
                  setShowCreateMenuModal(false);
                  openUploadScreen('post');
                }}
                className="p-3.5 rounded-2xl bg-gradient-to-br from-[#7928CA]/20 to-[#A855F7]/20 border border-[#A855F7]/40 hover:border-[#A855F7] text-left space-y-1.5 cursor-pointer active:scale-95 transition-all"
              >
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#7928CA] to-[#A855F7] flex items-center justify-center text-white shadow-md">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div className="text-xs font-black text-white">Write Post</div>
                <div className="text-[10px] text-zinc-400">Text card, music &amp; backdrop</div>
              </button>

              {/* 3. Photo Moment */}
              <button
                type="button"
                onClick={() => {
                  setShowCreateMenuModal(false);
                  openUploadScreen('photo');
                }}
                className="p-3.5 rounded-2xl bg-gradient-to-br from-amber-500/15 to-orange-500/15 border border-amber-400/35 hover:border-amber-400 text-left space-y-1.5 cursor-pointer active:scale-95 transition-all"
              >
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-white shadow-md">
                  <Camera className="w-4 h-4" />
                </div>
                <div className="text-xs font-black text-white">Snap / Photo</div>
                <div className="text-[10px] text-zinc-400">Capture or share a photo</div>
              </button>

              {/* 4. Upload / Record Video */}
              <button
                type="button"
                onClick={() => {
                  setShowCreateMenuModal(false);
                  openUploadScreen('gallery');
                }}
                className="p-3.5 rounded-2xl bg-gradient-to-br from-emerald-500/15 to-cyan-500/15 border border-emerald-400/35 hover:border-emerald-400 text-left space-y-1.5 cursor-pointer active:scale-95 transition-all"
              >
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center text-white shadow-md">
                  <Video className="w-4 h-4" />
                </div>
                <div className="text-xs font-black text-white">Upload Video</div>
                <div className="text-[10px] text-zinc-400">Upload reel or record clip</div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
