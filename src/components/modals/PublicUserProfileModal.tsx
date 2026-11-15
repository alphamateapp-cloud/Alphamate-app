import React, { useEffect, useState } from 'react';
import {
  X,
  UserPlus,
  UserCheck,
  MessageCircle,
  ShieldCheck,
  Crown,
  Copy,
  Check,
  Users,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { User, UserBadgeId } from '../../types';
import { fetchUserFollowCounts } from '../../services/userDirectoryService';
import { subscribeToUserBadgeStats } from '../../services/badgeService';
import { UserBadgeStrip } from '../badges/UserBadgeIcon';
import { copyToClipboard } from '../../utils/clipboard';

export const PublicUserProfileModal: React.FC = () => {
  const {
    viewingPublicUser,
    closePublicUserProfile,
    currentUser,
    followingUserIds,
    followerUserIds,
    toggleFollowUser,
    startDirectMessage,
  } = useApp();

  const [followBusy, setFollowBusy] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [counts, setCounts] = useState<{ followersCount: number; followingCount: number }>({
    followersCount: 0,
    followingCount: 0,
  });
  const [badgeIds, setBadgeIds] = useState<UserBadgeId[]>([]);

  useEffect(() => {
    if (!viewingPublicUser?.id) return;
    setBadgeIds(viewingPublicUser.equippedBadgeIds || []);
    setCounts({
      followersCount: viewingPublicUser.followersCount || 0,
      followingCount: viewingPublicUser.followingCount || 0,
    });

    fetchUserFollowCounts(viewingPublicUser.id)
      .then((res) => {
        setCounts({
          followersCount: Math.max(res.followersCount, viewingPublicUser.followersCount || 0),
          followingCount: Math.max(res.followingCount, viewingPublicUser.followingCount || 0),
        });
      })
      .catch(() => {});

    const unsub = subscribeToUserBadgeStats(viewingPublicUser.id, (stats) => {
      if (stats?.equippedBadgeIds?.length) {
        setBadgeIds(stats.equippedBadgeIds);
      }
    });

    return () => {
      unsub();
    };
  }, [viewingPublicUser]);

  if (!viewingPublicUser) return null;

  const isMe = viewingPublicUser.id === currentUser.id;
  const isFollowing = followingUserIds.includes(viewingPublicUser.id);
  const followsMe = followerUserIds.includes(viewingPublicUser.id);

  const handleToggleFollow = async () => {
    if (isMe || followBusy) return;
    setFollowBusy(true);
    try {
      const next = await toggleFollowUser(viewingPublicUser);
      setCounts((prev) => ({
        ...prev,
        followersCount: Math.max(0, prev.followersCount + (next ? 1 : -1)),
      }));
    } finally {
      setFollowBusy(false);
    }
  };

  const handleCopyId = async () => {
    await copyToClipboard(viewingPublicUser.uniqueId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 1800);
  };

  const handleMessage = async () => {
    const target: User = viewingPublicUser;
    closePublicUserProfile();
    await startDirectMessage(target);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${viewingPublicUser.displayName} profile`}
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
            <div className="relative">
              <img
                src={viewingPublicUser.avatar}
                alt={viewingPublicUser.displayName}
                referrerPolicy="no-referrer"
                className="w-20 h-20 rounded-full object-cover border-4 border-[#110A22] shadow-xl bg-[#1A1033]"
              />
              {viewingPublicUser.countryFlag && (
                <span className="absolute bottom-0 right-0 text-base bg-[#110A22] rounded-full px-1">
                  {viewingPublicUser.countryFlag}
                </span>
              )}
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
              <h2 className="text-lg font-black text-white">{viewingPublicUser.displayName}</h2>
              {viewingPublicUser.isVerified && (
                <ShieldCheck className="w-4 h-4 text-[#A855F7]" />
              )}
              {badgeIds.length > 0 && <UserBadgeStrip badgeIds={badgeIds} size="sm" />}
            </div>

            <div className="flex items-center gap-2 flex-wrap text-xs text-zinc-400">
              <span>@{viewingPublicUser.username}</span>
              <span>•</span>
              <button
                type="button"
                onClick={handleCopyId}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 font-mono text-[11px] cursor-pointer"
              >
                <span>ID: {viewingPublicUser.uniqueId}</span>
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
              {viewingPublicUser.bio || 'Alpha Mate Member'}
            </p>
          </div>

          {/* Level / VIP & Stats Row */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="p-3 rounded-2xl bg-[#180E30] border border-white/10 text-center">
              <div className="text-sm font-black text-white tabular-nums">
                {counts.followersCount.toLocaleString()}
              </div>
              <div className="text-[10px] text-zinc-400 flex items-center justify-center gap-1 mt-0.5">
                <Users className="w-3 h-3" />
                <span>Followers</span>
              </div>
            </div>
            <div className="p-3 rounded-2xl bg-[#180E30] border border-white/10 text-center">
              <div className="text-sm font-black text-white tabular-nums">
                {counts.followingCount.toLocaleString()}
              </div>
              <div className="text-[10px] text-zinc-400 mt-0.5">Following</div>
            </div>
            <div className="p-3 rounded-2xl bg-[#180E30] border border-white/10 text-center">
              <div className="text-sm font-black text-amber-300 flex items-center justify-center gap-1">
                {viewingPublicUser.vipTier > 0 ? (
                  <>
                    <Crown className="w-3.5 h-3.5" />
                    <span>VIP {viewingPublicUser.vipTier}</span>
                  </>
                ) : (
                  <span>Lv.{viewingPublicUser.level}</span>
                )}
              </div>
              <div className="text-[10px] text-zinc-400 mt-0.5">
                {viewingPublicUser.vipTier > 0 ? `Lv.${viewingPublicUser.level}` : 'Tier Rank'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
