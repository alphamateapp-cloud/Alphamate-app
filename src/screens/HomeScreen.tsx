import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { TopBar } from '../components/navigation/TopBar';
import { DailyCheckInModal } from '../components/modals/DailyCheckInModal';
import { StoryViewerModal } from '../components/story/StoryViewerModal';
import { CreateStoryModal } from '../components/story/CreateStoryModal';
import { PKComingSoonModal } from '../components/modals/PKComingSoonModal';
import { CoinSellerAgenciesCarousel } from '../components/home/CoinSellerAgenciesCarousel';
import { LiveStream, FriendStory } from '../types';
import {
  Radio,
  Users,
  Flame,
  Video,
  Sparkles,
  Plus,
  Swords,
  Filter,
  Gift,
  Check,
  Coins,
  Crown,
  Trophy,
  TrendingUp,
} from 'lucide-react';

export const HomeScreen: React.FC = () => {
  const {
    liveStreams,
    openLiveStream,
    currentUser,
    setCurrentScreen,
    dailyCheckInState,
    setShowDailyCheckInModal,
    friendStories,
    myStories,
    addMyStory,
    toggleLikeStory,
    reactToStory,
    markStorySeen,
  } = useApp();

  const [activeCategory, setActiveCategory] = useState<'Live' | 'Following' | 'For You'>('Live');
  const [selectedTag, setSelectedTag] = useState<string>('All');
  const [showGoLiveModal, setShowGoLiveModal] = useState<boolean>(false);
  const [showPKModal, setShowPKModal] = useState<boolean>(false);
  const [customRoomTitle, setCustomRoomTitle] = useState<string>('Party with Alex! 💜 Drop in');

  // Stories modal state
  const [viewingStoryFriend, setViewingStoryFriend] = useState<FriendStory | null>(null);
  const [isViewingMyStory, setIsViewingMyStory] = useState<boolean>(false);
  const [showCreateStoryModal, setShowCreateStoryModal] = useState<boolean>(false);

  const tags = ['All', 'PK Battle', 'Music', 'Dancing', 'Gaming', 'Chat'];

  // Auto-prompt Daily Check-In modal on HomeScreen if today is not yet claimed
  useEffect(() => {
    if (!dailyCheckInState.isClaimedToday) {
      const promptedSession = sessionStorage.getItem('alphamate_checkin_session_prompted');
      if (!promptedSession) {
        const timer = setTimeout(() => {
          setShowDailyCheckInModal(true);
          sessionStorage.setItem('alphamate_checkin_session_prompted', 'true');
        }, 1100);
        return () => clearTimeout(timer);
      }
    }
  }, [dailyCheckInState.isClaimedToday, setShowDailyCheckInModal]);

  // Dynamic ranking algorithm:
  // Balances Gifting (1.5x) and Live Viewers (50x)
  // When a host receives higher gifting, they rank higher; if another host overtakes in viewers, they take Top 1.
  const rankedStreams = useMemo(() => {
    let list = liveStreams.filter((stream: LiveStream) => {
      if (activeCategory === 'Following' && stream.host.id !== 'host_01') return false;
      if (selectedTag !== 'All') {
        if (selectedTag === 'PK Battle' && !stream.isPK) return false;
        if (selectedTag !== 'PK Battle' && stream.category !== selectedTag) return false;
      }
      return true;
    });

    return list.sort((a, b) => {
      const scoreA = (a.totalGiftCoins || 0) * 1.5 + (a.viewerCount || 0) * 50;
      const scoreB = (b.totalGiftCoins || 0) * 1.5 + (b.viewerCount || 0) * 50;
      return scoreB - scoreA;
    });
  }, [liveStreams, activeCategory, selectedTag]);

  // Top 1 or 2 Top Broadcasters
  const topStreams = useMemo(() => rankedStreams.slice(0, 2), [rankedStreams]);
  // Remaining All Broadcasts
  const allOtherStreams = useMemo(() => rankedStreams.slice(2), [rankedStreams]);

  const handleStartBroadcast = () => {
    setShowGoLiveModal(false);
    const myStream: LiveStream = {
      id: `live_my_${Date.now()}`,
      title: customRoomTitle || 'My Live Stream',
      host: currentUser,
      viewerCount: 1,
      thumbnail: currentUser.avatar,
      category: 'Chat',
      tag: 'Broadcasting',
      isPK: false,
      durationMinutes: 0,
    };
    openLiveStream(myStream);
  };

  return (
    <div className="relative w-full h-full pb-24 bg-[#09070F] text-white overflow-y-auto overscroll-contain">
      {/* Top Bar */}
      <TopBar />

      {/* Categories Bar: Live | Following | For You */}
      <div className="px-4 pt-2.5 pb-1 flex items-center justify-between border-b border-[#A855F7]/10 bg-[#0C081A]/60 backdrop-blur-sm">
        <div className="flex items-center gap-6">
          {(['Live', 'Following', 'For You'] as const).map((cat) => {
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`relative pb-2 text-xs sm:text-sm font-bold tracking-wide transition-colors cursor-pointer ${
                  isActive ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {cat}
                {isActive && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2.5px] rounded-full bg-gradient-to-r from-[#7928CA] via-[#A855F7] to-[#EC4899] shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
                )}
              </button>
            );
          })}
        </div>

        {/* Quick PK Arena Shortcut Pill */}
        <button
          onClick={() => {
            const pkStream = liveStreams.find((s) => s.isPK);
            if (pkStream) openLiveStream(pkStream);
          }}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-[#EC4899]/20 to-[#7928CA]/20 border border-[#EC4899]/40 text-[#EC4899] text-[11px] font-bold hover:brightness-110 active:scale-95 transition-all cursor-pointer"
        >
          <Swords className="w-3.5 h-3.5" />
          <span>PK Arena</span>
        </button>
      </div>

      {/* Daily Check-In Reward Banner */}
      <div className="px-4 pt-2.5 pb-1">
        <div
          onClick={() => setShowDailyCheckInModal(true)}
          className="relative w-full rounded-2xl p-[1px] bg-gradient-to-r from-amber-500/80 via-[#EC4899]/70 to-[#7928CA]/80 shadow-lg shadow-purple-900/30 cursor-pointer group active:scale-[0.99] transition-all"
        >
          <div className="w-full rounded-[15px] bg-gradient-to-r from-[#1D113A] via-[#1A0F33] to-[#140A28] px-3.5 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-400 via-amber-500 to-yellow-300 flex items-center justify-center text-amber-950 shadow-md group-hover:scale-105 transition-transform shrink-0">
                <Gift className="w-5 h-5 fill-amber-900" />
              </div>
              <div className="text-left">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-black text-white">Daily Check-In Rewards</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-amber-400/20 text-amber-300 text-[9px] font-bold border border-amber-400/30">
                    Day {dailyCheckInState.streak === 7 ? 1 : dailyCheckInState.isClaimedToday ? dailyCheckInState.streak : dailyCheckInState.streak + 1}
                  </span>
                </div>
                <span className="text-[10px] text-zinc-300 block mt-0.5">
                  {!dailyCheckInState.isClaimedToday
                    ? 'Free Alpha Coins available to claim now!'
                    : `Claimed for today (${dailyCheckInState.streak} Day streak 🔥) • Tap to view ladder`}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {!dailyCheckInState.isClaimedToday ? (
                <span className="px-3 py-1 rounded-xl bg-gradient-to-r from-amber-400 to-[#EC4899] text-white font-black text-[11px] shadow-sm animate-pulse flex items-center gap-1">
                  <span>Claim</span>
                  <Sparkles className="w-3 h-3 text-yellow-200" />
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold text-[10px] flex items-center gap-1">
                  <Check className="w-3 h-3 stroke-[3]" />
                  <span>Done</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Official Coin Seller Agencies Auto-Rotating & Swipeable Carousel */}
      <CoinSellerAgenciesCarousel />

      {/* Horizontal Strip of Friends & Stories (Replacing old generic Live Hosts) */}
      <div className="pt-2 pb-2 px-4 border-b border-[#A855F7]/10">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold tracking-wider uppercase text-zinc-300">Friends</span>
            <span className="px-1.5 py-0.2 rounded-full bg-[#EC4899]/20 text-[#EC4899] text-[9px] font-extrabold uppercase">
              Stories
            </span>
          </div>
          <span className="text-[10px] text-[#C084FC] font-semibold">
            {friendStories.filter((f) => f.isLive).length} Live •{' '}
            {friendStories.filter((f) => f.hasStory).length + (myStories.length > 0 ? 1 : 0)} Stories
          </span>
        </div>

        <div className="flex items-center gap-3.5 overflow-x-auto pb-1 scrollbar-none">
          {/* First Item: Current User Profile ("You") */}
          <div
            onClick={() => {
              if (myStories.length > 0) {
                setIsViewingMyStory(true);
              } else {
                setShowCreateStoryModal(true);
              }
            }}
            className="flex flex-col items-center gap-1 shrink-0 cursor-pointer group"
          >
            <div
              className={`relative w-15 h-15 rounded-full p-[2px] transition-transform group-hover:scale-105 ${
                myStories.length > 0
                  ? 'bg-gradient-to-tr from-[#EC4899] via-[#A855F7] to-[#06B6D4] ring-2 ring-[#EC4899]/40 shadow-md shadow-[#EC4899]/25 animate-spin-slow'
                  : 'bg-[#2A1F4D] border border-dashed border-[#A855F7]/40'
              }`}
            >
              <img
                src={currentUser.avatar}
                alt={currentUser.displayName}
                className="w-full h-full rounded-full object-cover"
              />
              {/* Plus Button to add story */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowCreateStoryModal(true);
                }}
                title="Add Story"
                className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-gradient-to-tr from-[#7928CA] to-[#EC4899] border-2 border-[#0D091F] flex items-center justify-center text-white shadow-md hover:scale-110 transition-transform cursor-pointer"
              >
                <Plus className="w-3 h-3 stroke-[3]" />
              </button>
            </div>
            <span className="text-[10px] font-bold text-white tracking-tight flex items-center gap-0.5">
              <span>You</span>
              {myStories.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-pink-500" />}
            </span>
          </div>

          {/* Friends List (Live & Stories) */}
          {friendStories.map((friend) => {
            const isLive = friend.isLive;
            const hasStory = friend.hasStory && friend.stories.length > 0;
            const isSeen = friend.isSeen;

            return (
              <div
                key={friend.id}
                onClick={() => {
                  if (isLive && friend.liveStreamId) {
                    const matchedStream = liveStreams.find((s) => s.id === friend.liveStreamId);
                    if (matchedStream) {
                      openLiveStream(matchedStream);
                      return;
                    }
                  }
                  if (hasStory) {
                    markStorySeen(friend.id);
                    setViewingStoryFriend(friend);
                  } else if (isLive && liveStreams.length > 0) {
                    openLiveStream(liveStreams[0]);
                  }
                }}
                className="flex flex-col items-center gap-1 shrink-0 cursor-pointer group"
              >
                <div
                  className={`relative w-15 h-15 rounded-full p-[2px] transition-transform group-hover:scale-105 ${
                    isLive
                      ? 'bg-gradient-to-tr from-[#EF4444] via-[#EC4899] to-[#8B5CF6] animate-pulse ring-2 ring-red-500/50'
                      : hasStory
                      ? isSeen
                        ? 'bg-zinc-700/60 ring-1 ring-zinc-600'
                        : 'bg-gradient-to-tr from-[#EC4899] via-[#A855F7] to-[#06B6D4] ring-2 ring-[#A855F7]/40 animate-spin-slow'
                      : 'bg-[#21183E]'
                  }`}
                >
                  <img
                    src={friend.user.avatar}
                    alt={friend.user.displayName}
                    className="w-full h-full rounded-full object-cover"
                  />

                  {/* Badge: Red LIVE badge or story circle indicator */}
                  {isLive ? (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-0.2 rounded-full bg-red-600 text-[8px] font-black tracking-widest text-white uppercase shadow-md animate-bounce">
                      LIVE
                    </span>
                  ) : hasStory && !isSeen ? (
                    <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-gradient-to-tr from-[#06B6D4] to-[#A855F7] border border-[#0D091F] flex items-center justify-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                    </span>
                  ) : null}
                </div>

                <span className="text-[10px] font-medium text-zinc-300 max-w-[62px] truncate text-center">
                  {friend.user.displayName.split(' ')[0]}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Subcategory Filter Pills */}
      <div className="px-4 py-2.5 flex items-center gap-2 overflow-x-auto scrollbar-none">
        {tags.map((tag) => {
          const isSelected = selectedTag === tag;
          return (
            <button
              key={tag}
              onClick={() => {
                if (tag === 'PK Battle') {
                  setShowPKModal(true);
                } else {
                  setSelectedTag(tag);
                }
              }}
              className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                isSelected
                  ? 'bg-gradient-to-r from-[#7928CA] to-[#A855F7] text-white shadow-md shadow-[#7928CA]/30'
                  : 'bg-[#181131] text-zinc-400 hover:text-white border border-[#A855F7]/15'
              }`}
            >
              {tag}
            </button>
          );
        })}
      </div>

      {/* Top Broadcasters & All Broadcasts Grid */}
      <div className="px-4 py-2 space-y-4">
        {/* Top 1 & Top 2 Dynamic Ranking Cards */}
        {topStreams.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black tracking-wider uppercase text-amber-300 flex items-center gap-1.5">
                <Crown className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                <span>TOP BROADCASTS</span>
              </span>
              <span className="text-[10px] text-zinc-400 font-medium">
                Live Gifting & Viewers
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {topStreams.map((stream, idx) => {
                const isTop1 = idx === 0;

                return (
                  <div
                    key={stream.id}
                    onClick={() => {
                      if (stream.isPK) {
                        setShowPKModal(true);
                      } else {
                        openLiveStream(stream);
                      }
                    }}
                    className={`group relative rounded-2xl overflow-hidden bg-[#160F2E] border cursor-pointer transform hover:-translate-y-0.5 transition-all shadow-xl ${
                      isTop1
                        ? 'border-2 border-amber-400/80 shadow-amber-500/20'
                        : 'border-2 border-[#EC4899]/70 shadow-pink-500/20'
                    }`}
                  >
                    {/* Thumbnail Container */}
                    <div className="relative aspect-[4/5] w-full overflow-hidden bg-[#1E143B]">
                      <img
                        src={stream.thumbnail}
                        alt={stream.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />

                      {/* Scrim Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-[#09070F] via-transparent to-black/50" />

                      {/* Top Rank Badge Trophy Banner */}
                      <div className="absolute top-2 left-2 z-10">
                        <div
                          className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider flex items-center gap-1 shadow-md ${
                            isTop1
                              ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-amber-950'
                              : 'bg-gradient-to-r from-[#EC4899] to-[#7928CA] text-white'
                          }`}
                        >
                          <Trophy className="w-2.5 h-2.5" />
                          <span>{isTop1 ? 'TOP 1' : 'TOP 2'}</span>
                        </div>
                      </div>

                      {/* Top Right: Live Viewer Count */}
                      <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-zinc-200 text-[10px] font-medium z-10">
                        <Users className="w-3 h-3 text-[#A855F7]" />
                        <span>{stream.viewerCount.toLocaleString()}</span>
                      </div>

                      {/* Gifting Coin Counter Badge */}
                      <div className="absolute top-8 left-2 z-10">
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md border border-amber-400/50 text-amber-300 text-[9px] font-bold">
                          <span>🎁</span>
                          <span>{((stream.totalGiftCoins || 0) > 999 ? `${((stream.totalGiftCoins || 0) / 1000).toFixed(1)}k` : stream.totalGiftCoins || 0)} Coins</span>
                        </div>
                      </div>

                      {/* PK Battle Ribbon if 1v1 */}
                      {stream.isPK && (
                        <div className="absolute top-15 left-2 px-2 py-0.5 rounded-md bg-gradient-to-r from-[#EC4899] to-[#7928CA] text-white text-[8px] font-extrabold uppercase tracking-wider shadow-md">
                          PK 1v1
                        </div>
                      )}

                      {/* Host Info & Room Title Overlay */}
                      <div className="absolute bottom-2 left-2 right-2 flex flex-col gap-1">
                        <div className="flex items-center gap-1.5">
                          <img
                            src={stream.host.avatar}
                            alt={stream.host.displayName}
                            className={`w-5 h-5 rounded-full object-cover border ${
                              isTop1 ? 'border-amber-400' : 'border-[#EC4899]'
                            }`}
                          />
                          <span className="text-[11px] font-semibold text-white truncate drop-shadow">
                            {stream.host.displayName}
                          </span>
                          {stream.countryFlag && (
                            <span className="text-[10px] shrink-0">{stream.countryFlag}</span>
                          )}
                        </div>

                        <p className="text-[11px] font-bold text-zinc-100 line-clamp-1 leading-tight drop-shadow">
                          {stream.title}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* All Other Live Broadcasts Section */}
        <div>
          <div className="flex items-center justify-between mb-2 pt-1">
            <span className="text-[11px] font-bold tracking-wider uppercase text-zinc-400">
              All Broadcasts
            </span>
            <span className="text-[10px] text-[#C084FC] font-semibold">
              {allOtherStreams.length} streaming
            </span>
          </div>

          {rankedStreams.length === 0 ? (
            <div className="py-12 px-4 rounded-3xl bg-gradient-to-b from-[#170E2E]/80 to-[#0F0820]/90 border border-[#A855F7]/20 text-center flex flex-col items-center justify-center my-2">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#7928CA]/30 to-[#EC4899]/30 border border-[#A855F7]/30 flex items-center justify-center text-[#EC4899] mb-3 shadow-lg">
                <Radio className="w-8 h-8 animate-pulse text-[#EC4899]" />
              </div>
              <h3 className="text-sm font-bold text-white mb-1">No Live Streams Right Now</h3>
              <p className="text-xs text-zinc-400 max-w-xs mb-4">
                Be the first broadcaster to go live today and collect gifts from the Alpha Mate community!
              </p>
              <button
                onClick={() => setShowGoLiveModal(true)}
                className="px-5 py-2.5 rounded-full bg-gradient-to-r from-[#7928CA] via-[#9333EA] to-[#EC4899] text-white text-xs font-bold shadow-lg shadow-purple-600/30 hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Radio className="w-3.5 h-3.5" />
                <span>Start Solo Live Stream</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {allOtherStreams.map((stream) => (
                <div
                  key={stream.id}
                  onClick={() => {
                    if (stream.isPK) {
                      setShowPKModal(true);
                    } else {
                      openLiveStream(stream);
                    }
                  }}
                  className="group relative rounded-2xl overflow-hidden bg-[#160F2E] border border-[#A855F7]/20 hover:border-[#A855F7]/50 shadow-lg shadow-black/40 cursor-pointer transform hover:-translate-y-0.5 transition-all"
                >
                  {/* Thumbnail Container */}
                  <div className="relative aspect-[4/5] w-full overflow-hidden bg-[#1E143B]">
                    <img
                      src={stream.thumbnail}
                      alt={stream.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />

                    {/* Scrim Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#09070F] via-transparent to-black/40" />

                    {/* Top Badges: Category & Live Viewer Count */}
                    <div className="absolute top-2 left-2 right-2 flex items-center justify-between">
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-white text-[10px] font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#EC4899] animate-ping" />
                        <span>LIVE</span>
                      </div>

                      <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-zinc-200 text-[10px] font-medium">
                        <Users className="w-3 h-3 text-[#A855F7]" />
                        <span>{stream.viewerCount.toLocaleString()}</span>
                      </div>
                    </div>

                    {/* PK Battle Ribbon if 1v1 */}
                    {stream.isPK && (
                      <div className="absolute top-9 left-2 px-2 py-0.5 rounded-md bg-gradient-to-r from-[#EC4899] to-[#7928CA] text-white text-[9px] font-extrabold uppercase tracking-wider shadow-md">
                        PK 1v1 BATTLE
                      </div>
                    )}

                    {/* Host Info & Room Title Overlay */}
                    <div className="absolute bottom-2 left-2 right-2 flex flex-col gap-1">
                      <div className="flex items-center gap-1.5">
                        <img
                          src={stream.host.avatar}
                          alt={stream.host.displayName}
                          className="w-5 h-5 rounded-full object-cover border border-[#EC4899]"
                        />
                        <span className="text-[11px] font-semibold text-white truncate drop-shadow">
                          {stream.host.displayName}
                        </span>
                        {stream.countryFlag && (
                          <span className="text-[10px] shrink-0">{stream.countryFlag}</span>
                        )}
                        {stream.host.vipTier && stream.host.vipTier > 0 ? (
                          <span className="px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[8px] font-black border border-amber-500/30 shrink-0">
                            VIP {stream.host.vipTier}
                          </span>
                        ) : null}
                      </div>

                      <p className="text-[11px] font-bold text-zinc-100 line-clamp-2 leading-tight drop-shadow">
                        {stream.title}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Floating "Go Live" Button */}
      <div className="fixed bottom-20 right-4 sm:right-[max(1rem,calc(50%-185px))] z-30 pointer-events-auto">
        <button
          onClick={() => setShowGoLiveModal(true)}
          className="group flex items-center gap-2 pl-3 pr-3.5 sm:pl-3.5 sm:pr-4 py-2 sm:py-2.5 rounded-full bg-gradient-to-r from-[#7928CA] via-[#9333EA] to-[#EC4899] text-white font-bold text-xs shadow-xl shadow-[#7928CA]/60 hover:shadow-[#A855F7]/80 hover:scale-105 active:scale-95 transition-all cursor-pointer"
        >
          <div className="w-5.5 h-5.5 sm:w-6 sm:h-6 rounded-full bg-white/20 flex items-center justify-center">
            <Radio className="w-3 h-3 sm:w-3.5 sm:h-3.5 animate-pulse" />
          </div>
          <span className="tracking-wide uppercase text-[11px] sm:text-xs">Go Live</span>
        </button>
      </div>

      {/* Go Live Setup Modal */}
      {showGoLiveModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-[#171030] border border-[#A855F7]/30 p-6 shadow-2xl animate-scale-up">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-r from-[#7928CA] to-[#EC4899] flex items-center justify-center text-white">
                  <Radio className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Start Live Stream</h3>
                  <p className="text-[11px] text-zinc-400">Broadcast to Alpha Mate audience</p>
                </div>
              </div>
              <button
                onClick={() => setShowGoLiveModal(false)}
                className="text-zinc-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-zinc-300 font-semibold block mb-1.5">
                  Live Stream Title
                </label>
                <input
                  type="text"
                  value={customRoomTitle}
                  onChange={(e) => setCustomRoomTitle(e.target.value)}
                  placeholder="What's your stream about?"
                  className="w-full h-11 px-3.5 rounded-xl bg-[#0F0A20] border border-[#A855F7]/30 text-white placeholder-zinc-500 text-xs sm:text-sm focus:border-[#EC4899] focus:outline-none"
                />
              </div>

              {/* Camera & Mic Ready check */}
              <div className="p-3 rounded-xl bg-[#120B24] border border-[#A855F7]/15 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-zinc-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>Camera & Microphone Ready</span>
                </div>
                <span className="text-[10px] text-emerald-400 font-bold uppercase">1080p HD</span>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => setShowGoLiveModal(false)}
                  className="flex-1 h-12 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold hover:bg-zinc-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleStartBroadcast}
                  className="flex-1 h-12 rounded-xl bg-gradient-to-r from-[#7928CA] via-[#9333EA] to-[#EC4899] text-white text-xs font-bold shadow-lg shadow-[#7928CA]/40 hover:opacity-95 cursor-pointer"
                >
                  Go Live Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Daily Check-In Pop-up Modal */}
      <DailyCheckInModal />

      {/* Story Viewer Modal (For Friends or Current User) */}
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

      {/* Create / Add Story Modal */}
      {showCreateStoryModal && (
        <CreateStoryModal
          currentUser={currentUser}
          onClose={() => setShowCreateStoryModal(false)}
          onSubmit={(newStory) => {
            addMyStory(newStory);
          }}
        />
      )}

      {/* PK Battle Coming Soon Modal */}
      <PKComingSoonModal
        isOpen={showPKModal}
        onClose={() => setShowPKModal(false)}
      />
    </div>
  );
};
