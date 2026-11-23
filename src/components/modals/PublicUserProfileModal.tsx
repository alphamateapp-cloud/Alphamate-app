import React, { useEffect, useState } from 'react';
import {
  X,
  UserPlus,
  UserCheck,
  MessageCircle,
  Crown,
  Copy,
  Check,
  Users,
  Sparkles,
  Heart,
  Eye,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { User, UserBadgeId } from '../../types';
import { fetchUserFollowCounts } from '../../services/userDirectoryService';
import { subscribeToPublicUserProfile } from '../../services/firebase';
import { subscribeToUserBadgeStats } from '../../services/badgeService';
import { subscribeToCreatorReels, Reel } from '../../services/reelsService';
import { UserBadgeStrip } from '../badges/UserBadgeIcon';
import { copyToClipboard } from '../../utils/clipboard';
import {
  cacheUserProfileSnippet,
  getCachedUserProfileSnippet,
} from '../../services/profileSnippetCache';
import {
  resolveUserBlueTickVerified,
  resolveUserGreenTickVerified,
} from '../../services/adminModerationService';
import { VerificationTicksInfoModal } from '../badges/VerificationTicks';
import { VerificationBadge } from '../badges/VerificationBadge';
import { DEFAULT_AVATAR_URL, safeImageSrc } from '../../utils/imageHd';

export const PublicUserProfileModal: React.FC = () => {
  const {
    viewingPublicUser,
    closePublicUserProfile,
    currentUser,
    followingUserIds,
    followerUserIds,
    toggleFollowUser,
    startDirectMessage,
    videos,
  } = useApp();

  const [followBusy, setFollowBusy] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [counts, setCounts] = useState<{ followersCount: number; followingCount: number }>({
    followersCount: 0,
    followingCount: 0,
  });
  const [creatorReels, setCreatorReels] = useState<Reel[]>([]);
  const [badgeIds, setBadgeIds] = useState<UserBadgeId[]>([]);
  const [liveProfile, setLiveProfile] = useState<Record<string, any> | null>(null);
  const [showTicksInfo, setShowTicksInfo] = useState(false);

  useEffect(() => {
    if (!viewingPublicUser?.id) return;
    let cancelled = false;
    setLiveProfile(null);
    setBadgeIds(viewingPublicUser.equippedBadgeIds || []);
    setCounts({
      followersCount: Number(viewingPublicUser.followersCount ?? 0),
      followingCount: Number(viewingPublicUser.followingCount ?? 0),
    });

    // Hydrate immediately from Service Worker Cache Storage for instant load & offline viewing
    getCachedUserProfileSnippet(viewingPublicUser.id)
      .then((snippet) => {
        if (cancelled || !snippet) return;
        setLiveProfile((prev) => prev || snippet);
        if (Array.isArray(snippet.equippedBadgeIds) && snippet.equippedBadgeIds.length > 0) {
          setBadgeIds((prev) => (prev.length > 0 ? prev : snippet.equippedBadgeIds || []));
        }
        setCounts((prev) => ({
          followersCount: prev.followersCount || snippet.followersCount,
          followingCount: prev.followingCount || snippet.followingCount,
        }));
      })
      .catch(() => {});

    // Cache the base snippet immediately so even quick previews remain available offline
    void cacheUserProfileSnippet(viewingPublicUser);

    fetchUserFollowCounts(viewingPublicUser.id)
      .then((res) => {
        if (!cancelled) {
          setCounts({
            followersCount: res.followersCount,
            followingCount: res.followingCount,
          });
        }
      })
      .catch(() => {});

    const unsubProfile = subscribeToPublicUserProfile(viewingPublicUser.id, (data) => {
      if (!cancelled && data) {
        setLiveProfile(data);
        if (Array.isArray(data.equippedBadgeIds)) {
          setBadgeIds(data.equippedBadgeIds);
        }
        void cacheUserProfileSnippet({
          ...viewingPublicUser,
          ...data,
          id: viewingPublicUser.id,
        });
      }
    });

    const unsubBadges = subscribeToUserBadgeStats(viewingPublicUser.id, (stats) => {
      if (!cancelled && stats?.equippedBadgeIds?.length) {
        setBadgeIds(stats.equippedBadgeIds);
      }
    });

    const unsubCreatorReels = subscribeToCreatorReels(viewingPublicUser.id, (reels) => {
      if (!cancelled) {
        setCreatorReels(reels);
      }
    });

    return () => {
      cancelled = true;
      unsubProfile();
      unsubBadges();
      unsubCreatorReels();
    };
  }, [viewingPublicUser]);

  if (!viewingPublicUser) return null;

  const profileUser: User = {
    ...viewingPublicUser,
    displayName: String(liveProfile?.displayName || viewingPublicUser.displayName || 'Alpha Mate'),
    username: String(liveProfile?.username || viewingPublicUser.username || 'user'),
    uniqueId: String(liveProfile?.uniqueId || viewingPublicUser.uniqueId || viewingPublicUser.id),
    avatar:
      safeImageSrc(
        liveProfile?.avatar || liveProfile?.photoURL || viewingPublicUser.avatar,
        DEFAULT_AVATAR_URL
      ) || DEFAULT_AVATAR_URL,
    bio: liveProfile?.bio !== undefined ? String(liveProfile.bio || '') : (viewingPublicUser.bio || ''),
    level: Math.max(0, Number(liveProfile?.level ?? viewingPublicUser.level ?? 0)),
    vipTier: Math.max(0, Number(liveProfile?.vipTier ?? viewingPublicUser.vipTier ?? 0)),
    isVerified: liveProfile
      ? resolveUserBlueTickVerified(liveProfile, Boolean(viewingPublicUser.isVerified))
      : Boolean(viewingPublicUser.isVerified),
    isAccountVerified: liveProfile
      ? resolveUserGreenTickVerified(
          liveProfile,
          Boolean(viewingPublicUser.isAccountVerified || viewingPublicUser.greenTick)
        )
      : resolveUserGreenTickVerified(viewingPublicUser as Record<string, any>, false),
    countryFlag: liveProfile?.countryFlag ?? viewingPublicUser.countryFlag,
  };

  const isMe = profileUser.id === currentUser.id;
  const isFollowing = followingUserIds.includes(profileUser.id);
  const followsMe = followerUserIds.includes(profileUser.id);

  // Real-time aggregated Moments/Reels engagement counts for this creator
  const mergedCreatorReelMap = new Map<string, { likes: number; comments: number; views: number }>();
  creatorReels.forEach((r) => {
    mergedCreatorReelMap.set(r.id, {
      likes: Math.max(0, r.likesCount || 0),
      comments: Math.max(0, r.commentsCount || 0),
      views: Math.max(0, r.viewsCount || 0),
    });
  });
  videos.forEach((v) => {
    if (v.user.id === profileUser.id && !mergedCreatorReelMap.has(v.id)) {
      mergedCreatorReelMap.set(v.id, {
        likes: Math.max(0, v.likes || 0),
        comments: Math.max(0, v.commentsCount || 0),
        views: Math.max(0, v.viewsCount || 0),
      });
    }
  });
  let totalCreatorLikes = 0;
  let totalCreatorComments = 0;
  let totalCreatorViews = 0;
  mergedCreatorReelMap.forEach((entry) => {
    totalCreatorLikes += entry.likes;
    totalCreatorComments += entry.comments;
    totalCreatorViews += entry.views;
  });

  const handleToggleFollow = async () => {
    if (isMe || followBusy) return;
    setFollowBusy(true);
    try {
      const next = await toggleFollowUser(profileUser);
      setCounts((prev) => ({
        ...prev,
        followersCount: Math.max(0, prev.followersCount + (next ? 1 : -1)),
      }));
    } finally {
      setFollowBusy(false);
    }
  };

  const handleCopyId = async () => {
    await copyToClipboard(profileUser.uniqueId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 1800);
  };

  const handleMessage = async () => {
    const target: User = profileUser;
    closePublicUserProfile();
    await startDirectMessage(target);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${profileUser.displayName} profile`}
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={closePublicUserProfile}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-[#110A22] border border-[#A855F7]/35 shadow-2xl overflow-hidden text-white"
      >
        {/* Top Cover Header */}
        <div className="relative h-24 bg-gradient-to-r from-[#581C87] via-[#7928CA] to-[#EC4899]">
          <button
            type="button"
            onClick={closePublicUserProfile}
            aria-label="Close profile"
            className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/45 hover:bg-black/65 border border-white/15 flex items-center justify-center text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 pb-6 -mt-10 relative">
          <div className="flex items-end justify-between gap-3">
            <div className="relative shrink-0 mb-1.5">
              <img
                src={safeImageSrc(profileUser.avatar, DEFAULT_AVATAR_URL)}
                alt={profileUser.displayName}
                referrerPolicy="no-referrer"
                className="w-20 h-20 rounded-full object-cover border-4 border-[#110A22] shadow-xl bg-[#1A1033]"
              />
              {profileUser.countryFlag && (
                <span className="absolute top-0 right-0 text-sm bg-[#110A22] rounded-full px-1 shadow">
                  {profileUser.countryFlag}
                </span>
              )}
              <VerificationBadge
                isVerified={Boolean(profileUser.isAccountVerified)}
                isRespected={Boolean(profileUser.isVerified)}
                size="sm"
                position="bottom-center"
                onClick={() => setShowTicksInfo(true)}
              />
            </div>

            {!isMe && (
              <div className="flex items-center gap-2 pb-1">
                <button
                  type="button"
                  disabled={followBusy}
                  onClick={handleToggleFollow}
                  className={`min-h-[40px] px-4 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-60 ${
                    isFollowing
                      ? 'bg-white/10 hover:bg-white/15 border border-white/15 text-zinc-200'
                      : followsMe
                      ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white shadow-lg shadow-emerald-500/25'
                      : 'bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white shadow-lg shadow-[#EC4899]/25'
                  }`}
                >
                  {isFollowing ? (
                    <>
                      <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{followsMe ? 'Friends' : 'Following'}</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>{followsMe ? 'Follow Back' : 'Follow'}</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleMessage}
                  className="min-h-[40px] px-3.5 rounded-xl bg-[#1E133B] hover:bg-[#2A1B52] border border-[#A855F7]/35 text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-[#EC4899]" />
                  <span>Chat</span>
                </button>
              </div>
            )}
          </div>

          {/* Identity */}
          <div className="mt-3 space-y-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h2 className="text-lg font-black text-white">{profileUser.displayName}</h2>
              {badgeIds.length > 0 && <UserBadgeStrip badgeIds={badgeIds} size="sm" />}
            </div>

            <div className="flex items-center gap-2 flex-wrap text-xs text-zinc-400">
              <span>@{profileUser.username}</span>
              <span>•</span>
              <button
                type="button"
                onClick={handleCopyId}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 font-mono text-[11px] cursor-pointer"
              >
                <span>ID: {profileUser.uniqueId}</span>
                {copiedId ? (
                  <Check className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Copy className="w-3 h-3 text-zinc-400" />
                )}
              </button>
            </div>

            {followsMe && !isMe && (
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-bold text-emerald-300">
                <Sparkles className="w-3 h-3" />
                <span>{isFollowing ? 'Mutual Friends' : 'Follows you'}</span>
              </div>
            )}

            <p className="text-xs text-zinc-300 pt-1 leading-relaxed">
              {profileUser.bio || 'Alpha Mate Member'}
            </p>
          </div>

          {/* Level / VIP & Real-Time Engagement Stats */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="p-2.5 rounded-2xl bg-[#180E30] border border-white/10 text-center">
              <div className="text-sm font-black text-white tabular-nums">
                {counts.followersCount.toLocaleString()}
              </div>
              <div className="text-[10px] text-zinc-400 flex items-center justify-center gap-1 mt-0.5">
                <Users className="w-3 h-3" />
                <span>Followers</span>
              </div>
            </div>
            <div className="p-2.5 rounded-2xl bg-[#180E30] border border-white/10 text-center">
              <div className="text-sm font-black text-white tabular-nums">
                {counts.followingCount.toLocaleString()}
              </div>
              <div className="text-[10px] text-zinc-400 mt-0.5">Following</div>
            </div>
            <div className="p-2.5 rounded-2xl bg-[#180E30] border border-white/10 text-center">
              <div className="text-sm font-black text-amber-300 flex items-center justify-center gap-1">
                {profileUser.vipTier > 0 ? (
                  <>
                    <Crown className="w-3.5 h-3.5" />
                    <span>VIP {profileUser.vipTier}</span>
                  </>
                ) : (
                  <span>Lv.{profileUser.level}</span>
                )}
              </div>
              <div className="text-[10px] text-zinc-400 mt-0.5">
                {profileUser.vipTier > 0 ? `Lv.${profileUser.level}` : 'Tier Rank'}
              </div>
            </div>
          </div>

          {/* Real-Time Moments Stats: Likes, Views, Comments */}
          <div className="mt-2 grid grid-cols-3 gap-2">
            <div className="p-2.5 rounded-2xl bg-[#180E30]/80 border border-white/10 text-center">
              <div className="text-sm font-black text-rose-300 tabular-nums">
                {totalCreatorLikes >= 1000
                  ? `${(totalCreatorLikes / 1000).toFixed(1)}k`
                  : totalCreatorLikes.toLocaleString()}
              </div>
              <div className="text-[10px] text-zinc-400 flex items-center justify-center gap-1 mt-0.5">
                <Heart className="w-3 h-3 text-rose-400" />
                <span>Likes</span>
              </div>
            </div>
            <div className="p-2.5 rounded-2xl bg-[#180E30]/80 border border-white/10 text-center">
              <div className="text-sm font-black text-cyan-200 tabular-nums">
                {totalCreatorViews >= 1000
                  ? `${(totalCreatorViews / 1000).toFixed(1)}k`
                  : totalCreatorViews.toLocaleString()}
              </div>
              <div className="text-[10px] text-zinc-400 flex items-center justify-center gap-1 mt-0.5">
                <Eye className="w-3 h-3 text-cyan-300" />
                <span>Views</span>
              </div>
            </div>
            <div className="p-2.5 rounded-2xl bg-[#180E30]/80 border border-white/10 text-center">
              <div className="text-sm font-black text-purple-200 tabular-nums">
                {totalCreatorComments >= 1000
                  ? `${(totalCreatorComments / 1000).toFixed(1)}k`
                  : totalCreatorComments.toLocaleString()}
              </div>
              <div className="text-[10px] text-zinc-400 flex items-center justify-center gap-1 mt-0.5">
                <MessageCircle className="w-3 h-3 text-purple-300" />
                <span>Comments</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <VerificationTicksInfoModal
        isOpen={showTicksInfo}
        onClose={() => setShowTicksInfo(false)}
        displayName={profileUser.displayName}
        isAccountVerified={Boolean(profileUser.isAccountVerified)}
        isBlueTickVerified={Boolean(profileUser.isVerified)}
        isOwnProfile={isMe}
      />
    </div>
  );
};
