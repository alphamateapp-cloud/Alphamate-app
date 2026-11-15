import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { PullToRefresh, RefreshScopeButton } from '../components/common/PullToRefresh';
import { User } from '../types';
import { searchAllRealUsers } from '../services/userDirectoryService';
import { UserBadgeStrip } from '../components/badges/UserBadgeIcon';
import {
  ArrowLeft,
  Search,
  UserPlus,
  UserCheck,
  MessageCircle,
  ShieldCheck,
  Crown,
  Users,
  X,
  Eye,
} from 'lucide-react';

export const SearchScreen: React.FC = () => {
  const {
    currentUser,
    realUsers,
    followingUserIds,
    followerUserIds,
    toggleFollowUser,
    openPublicUserProfile,
    startDirectMessage,
    navigateBack,
    refreshScope,
    userSyncRefreshEpoch,
  } = useApp();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState('');
  const [directoryTab, setDirectoryTab] = useState<'all' | 'followers' | 'following'>('all');
  const [remoteMatches, setRemoteMatches] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsSearching(true);
    const timer = window.setTimeout(() => {
      searchAllRealUsers(query, {
        excludeUid: currentUser.id,
        cachedUsers: realUsers,
        maxResults: 120,
      })
        .then((results) => {
          if (!cancelled) {
            setRemoteMatches(results);
          }
        })
        .catch(() => {
          if (!cancelled) setRemoteMatches([]);
        })
        .finally(() => {
          if (!cancelled) setIsSearching(false);
        });
    }, query.trim() ? 180 : 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, realUsers, currentUser.id, userSyncRefreshEpoch]);

  const displayedUsers = useMemo(() => {
    const base =
      remoteMatches.length > 0 || query.trim()
        ? remoteMatches
        : realUsers.filter((u) => u.id !== currentUser.id);

    if (directoryTab === 'followers') {
      return base.filter((u) => followerUserIds.includes(u.id));
    }
    if (directoryTab === 'following') {
      return base.filter((u) => followingUserIds.includes(u.id));
    }
    return base;
  }, [remoteMatches, realUsers, query, currentUser.id, directoryTab, followerUserIds, followingUserIds]);

  const handleFollowToggle = async (e: React.MouseEvent, targetUser: User) => {
    e.stopPropagation();
    if (busyUserId === targetUser.id) return;
    setBusyUserId(targetUser.id);
    try {
      await toggleFollowUser(targetUser);
    } finally {
      setBusyUserId(null);
    }
  };

  const handleMessageClick = async (e: React.MouseEvent, targetUser: User) => {
    e.stopPropagation();
    await startDirectMessage(targetUser);
  };

  return (
    <div
      ref={scrollContainerRef}
      className="relative w-full h-full min-h-screen pb-24 bg-[#09070F] text-white overflow-y-auto"
    >
      <PullToRefresh
        scrollContainerRef={scrollContainerRef}
        label="Refreshing directory..."
        onRefresh={() => refreshScope('search')}
      />
      {/* Top Search Header */}
      <div className="sticky top-0 z-30 w-full bg-[#09070F]/95 backdrop-blur-md border-b border-[#A855F7]/20 px-4 py-3 space-y-3">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={navigateBack}
            aria-label="Go back"
            className="w-9 h-9 rounded-full bg-[#1A1133] border border-white/10 flex items-center justify-center text-zinc-300 hover:text-white cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#C084FC]" />
            <input
              type="text"
              placeholder="Search name, @username or AM ID..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
              className="w-full h-11 pl-10 pr-9 rounded-2xl bg-[#140E28] border border-[#A855F7]/30 text-white placeholder-zinc-500 text-xs focus:border-[#EC4899] focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-zinc-300 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <RefreshScopeButton scope="search" compact className="w-9 h-9 shrink-0" title="Refresh user directory" />
        </div>

        {/* Directory Filter Bar */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            {(
              [
                { id: 'all', label: `All Users (${realUsers.filter((u) => u.id !== currentUser.id).length})` },
                { id: 'followers', label: `Followers (${followerUserIds.length})` },
                { id: 'following', label: `Following (${followingUserIds.length})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setDirectoryTab(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                  directoryTab === tab.id
                    ? 'bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white shadow-md shadow-[#7928CA]/25'
                    : 'bg-[#150F2C] text-zinc-400 hover:text-white border border-white/5'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Real-Time Users Directory List */}
      <div className="p-4 space-y-2.5">
        <div className="flex items-center justify-between text-[11px] text-zinc-400 px-1">
          <span className="font-bold uppercase tracking-wider flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-[#A855F7]" />
            <span>
              {query.trim()
                ? `Matching Users (${displayedUsers.length})`
                : `Registered Alpha Mate Members (${displayedUsers.length})`}
            </span>
          </span>
          {isSearching && <span className="text-[#C084FC] font-semibold">Updating...</span>}
        </div>

        {displayedUsers.length === 0 ? (
          <div className="py-14 px-5 rounded-3xl bg-[#130C24] border border-white/10 text-center space-y-2">
            <Users className="w-9 h-9 text-zinc-500 mx-auto" />
            <h3 className="text-sm font-black text-white">
              {isSearching ? 'Searching Alpha Mate directory...' : 'No matching users found'}
            </h3>
            <p className="text-xs text-zinc-400 max-w-xs mx-auto">
              {query.trim()
                ? 'Try a different name, @username, or Alpha Mate AM_ ID.'
                : 'Real registered Alpha Mate users appear here automatically as members join.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {displayedUsers.map((user) => {
              const isFollowing = followingUserIds.includes(user.id);
              const followsMe = followerUserIds.includes(user.id);
              const isBusy = busyUserId === user.id;

              return (
                <div
                  key={user.id}
                  onClick={() => openPublicUserProfile(user)}
                  className="p-3 rounded-2xl bg-[#140D26] hover:bg-[#1B1234] border border-white/10 hover:border-[#A855F7]/45 flex items-center justify-between gap-3 cursor-pointer transition-all"
                >
                  {/* Left: Avatar + Name + Username + Unique ID */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="relative shrink-0">
                      <img
                        src={user.avatar}
                        alt={user.displayName}
                        referrerPolicy="no-referrer"
                        className="w-12 h-12 rounded-full object-cover border border-[#A855F7]/50 bg-[#1F153B]"
                      />
                      {user.countryFlag && (
                        <span className="absolute -bottom-0.5 -right-0.5 text-xs bg-[#140D26] rounded-full px-0.5">
                          {user.countryFlag}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs sm:text-sm font-black text-white truncate max-w-[140px]">
                          {user.displayName}
                        </span>
                        {user.isVerified && (
                          <ShieldCheck className="w-3.5 h-3.5 text-[#A855F7] shrink-0" />
                        )}
                        {user.vipTier > 0 && (
                          <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[9px] font-black border border-amber-500/30 flex items-center gap-0.5 shrink-0">
                            <Crown className="w-2.5 h-2.5" />
                            <span>VIP {user.vipTier}</span>
                          </span>
                        )}
                        {user.equippedBadgeIds && user.equippedBadgeIds.length > 0 && (
                          <UserBadgeStrip badgeIds={user.equippedBadgeIds} size="xs" />
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 text-[10.5px] text-zinc-400 truncate mt-0.5">
                        <span className="text-zinc-300 font-semibold">@{user.username}</span>
                        <span>•</span>
                        <span className="font-mono text-[#C084FC]">{user.uniqueId}</span>
                        <span>•</span>
                        <span>Lv.{user.level}</span>
                      </div>

                      {followsMe && (
                        <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 text-[9.5px] font-bold">
                          {isFollowing ? 'Mutual Friends' : 'Follows you'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: Visit / Follow / Message */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={(e) => handleFollowToggle(e, user)}
                      className={`min-h-[36px] px-3 rounded-xl text-[11px] font-black flex items-center gap-1 transition-all cursor-pointer active:scale-95 disabled:opacity-60 ${
                        isFollowing
                          ? 'bg-white/10 hover:bg-white/15 border border-white/15 text-zinc-200'
                          : followsMe
                          ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white shadow-md shadow-emerald-500/20'
                          : 'bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white shadow-md shadow-[#EC4899]/20'
                      }`}
                    >
                      {isFollowing ? (
                        <>
                          <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Following</span>
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
                      onClick={(e) => handleMessageClick(e, user)}
                      title={`Chat with ${user.displayName}`}
                      aria-label={`Chat with ${user.displayName}`}
                      className="w-9 h-9 rounded-xl bg-[#1F153B] hover:bg-[#2B1D52] border border-[#A855F7]/30 flex items-center justify-center text-[#C084FC] hover:text-white cursor-pointer transition-colors"
                    >
                      <MessageCircle className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openPublicUserProfile(user);
                      }}
                      title="Visit Profile"
                      aria-label={`Visit ${user.displayName} profile`}
                      className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 flex items-center justify-center text-zinc-300 hover:text-white cursor-pointer transition-colors hidden sm:flex"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
