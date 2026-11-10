import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Heart,
  Send,
  Eye,
  Plus,
  Radio,
  ChevronLeft,
  ChevronRight,
  Music,
  Sparkles,
} from 'lucide-react';
import { FriendStory, StoryItem, User, LiveStream } from '../../types';
import { LevelBadgeIcon } from '../brand/LevelBadgeIcon';
import { VipAvatarFrame } from '../brand/VipAvatarFrame';

interface StoryViewerModalProps {
  friend: FriendStory | null;
  isMyStory?: boolean;
  currentUser: User;
  myStories: StoryItem[];
  allFriends: FriendStory[];
  onClose: () => void;
  onOpenLiveStream?: (streamId: string) => void;
  onToggleLike: (friendId: string, storyId: string) => void;
  onReact: (friendId: string, storyId: string, emoji: string) => void;
  onOpenCreateStory?: () => void;
}

export const StoryViewerModal: React.FC<StoryViewerModalProps> = ({
  friend,
  isMyStory = false,
  currentUser,
  myStories,
  allFriends,
  onClose,
  onOpenLiveStream,
  onToggleLike,
  onReact,
  onOpenCreateStory,
}) => {
  // Determine current active author and stories list
  const [currentFriendIndex, setCurrentFriendIndex] = useState<number>(() => {
    if (isMyStory || !friend) return -1;
    const idx = allFriends.findIndex((f) => f.id === friend.id);
    return idx >= 0 ? idx : 0;
  });

  const activeFriend = currentFriendIndex === -1 ? null : allFriends[currentFriendIndex];
  const activeUser = activeFriend ? activeFriend.user : currentUser;
  const isViewingSelf = currentFriendIndex === -1;

  const currentStoriesList: StoryItem[] = isViewingSelf
    ? myStories
    : activeFriend?.stories || [];

  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [floatingReactions, setFloatingReactions] = useState<
    Array<{ id: number; emoji: string; x: number; y: number }>
  >([]);
  const [sentFeedback, setSentFeedback] = useState<string | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const STORY_DURATION = 5000; // 5 seconds per slide
  const PROGRESS_INTERVAL = 50;

  const currentStory = currentStoriesList[currentStoryIndex] || currentStoriesList[0];

  // Advance or reset timer
  useEffect(() => {
    setProgress(0);
  }, [currentStoryIndex, currentFriendIndex]);

  useEffect(() => {
    if (isPaused || !currentStory) return;

    timerRef.current = setInterval(() => {
      setProgress((prev) => {
        const next = prev + (PROGRESS_INTERVAL / STORY_DURATION) * 100;
        if (next >= 100) {
          handleNextStory();
          return 0;
        }
        return next;
      });
    }, PROGRESS_INTERVAL);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPaused, currentStoryIndex, currentFriendIndex, currentStoriesList.length]);

  const handleNextStory = () => {
    if (currentStoryIndex < currentStoriesList.length - 1) {
      setCurrentStoryIndex((prev) => prev + 1);
    } else {
      // Advance to next friend with stories
      if (currentFriendIndex === -1) {
        // Was on my story, go to first friend with stories if available
        const nextFriendIdx = allFriends.findIndex((f) => f.hasStory && f.stories.length > 0);
        if (nextFriendIdx !== -1) {
          setCurrentFriendIndex(nextFriendIdx);
          setCurrentStoryIndex(0);
        } else {
          onClose();
        }
      } else {
        const nextFriendIdx = allFriends.findIndex(
          (f, idx) => idx > currentFriendIndex && f.hasStory && f.stories.length > 0
        );
        if (nextFriendIdx !== -1) {
          setCurrentFriendIndex(nextFriendIdx);
          setCurrentStoryIndex(0);
        } else {
          onClose();
        }
      }
    }
  };

  const handlePrevStory = () => {
    if (currentStoryIndex > 0) {
      setCurrentStoryIndex((prev) => prev - 1);
    } else {
      // Go to previous friend
      if (currentFriendIndex > 0) {
        setCurrentFriendIndex((prev) => prev - 1);
        setCurrentStoryIndex(0);
      } else if (currentFriendIndex === 0 && myStories.length > 0) {
        setCurrentFriendIndex(-1);
        setCurrentStoryIndex(0);
      }
    }
  };

  const triggerReaction = (emoji: string) => {
    if (!currentStory) return;
    const authorId = isViewingSelf ? 'me' : activeFriend?.id || '';
    onReact(authorId, currentStory.id, emoji);

    // Floating reaction animation
    const newId = Date.now() + Math.random();
    setFloatingReactions((prev) => [
      ...prev,
      {
        id: newId,
        emoji,
        x: 60 + Math.random() * 25,
        y: 80,
      },
    ]);

    setTimeout(() => {
      setFloatingReactions((prev) => prev.filter((r) => r.id !== newId));
    }, 1500);
  };

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    setSentFeedback('Reply sent to chat! 💌');
    setReplyText('');
    setTimeout(() => setSentFeedback(null), 2500);
  };

  if (!currentStory) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center select-none overflow-hidden">
      {/* Mobile-contained Story Container */}
      <div
        className="relative w-full max-w-md h-full max-h-[100dvh] bg-[#0A0714] flex flex-col justify-between overflow-hidden sm:rounded-3xl sm:border sm:border-[#A855F7]/30 shadow-2xl"
        onPointerDown={() => setIsPaused(true)}
        onPointerUp={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
      >
        {/* Story Background / Media */}
        <div className="absolute inset-0 z-0">
          {currentStory.mediaUrl ? (
            <img
              src={currentStory.mediaUrl}
              alt="Story"
              className="w-full h-full object-cover"
            />
          ) : (
            <div
              className={`w-full h-full bg-gradient-to-br ${
                currentStory.backgroundColor || 'from-[#7928CA] via-[#1A0B2E] to-[#EC4899]'
              }`}
            />
          )}
          {/* Subtle gradient vignettes for top and bottom controls readability */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-transparent to-black/85 pointer-events-none" />
        </div>

        {/* Floating Heart / Reaction Bursts */}
        <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
          {floatingReactions.map((item) => (
            <div
              key={item.id}
              className="absolute text-4xl animate-float-fade"
              style={{
                left: `${item.x}%`,
                bottom: '12%',
              }}
            >
              {item.emoji}
            </div>
          ))}
        </div>

        {/* Top Progress Bars Header */}
        <div className="relative z-20 pt-3 px-3">
          <div className="flex items-center gap-1.5 w-full">
            {currentStoriesList.map((story, idx) => {
              let fillPercent = 0;
              if (idx < currentStoryIndex) fillPercent = 100;
              else if (idx === currentStoryIndex) fillPercent = progress;

              return (
                <div
                  key={story.id}
                  className="h-1 flex-1 bg-white/25 rounded-full overflow-hidden backdrop-blur-sm"
                >
                  <div
                    className="h-full bg-white rounded-full transition-all duration-75"
                    style={{ width: `${fillPercent}%` }}
                  />
                </div>
              );
            })}
          </div>

          {/* User Header Details */}
          <div className="flex items-center justify-between mt-3 px-1">
            <div className="flex items-center gap-2.5">
              <div className="relative w-10 h-10 shrink-0">
                <VipAvatarFrame
                  vipTier={activeUser.vipTier || 0}
                  size="sm"
                  avatarUrl={activeUser.avatar}
                />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="text-white font-bold text-xs tracking-tight drop-shadow-md">
                    {isViewingSelf ? 'Your Story' : activeUser.displayName}
                  </span>
                  <LevelBadgeIcon level={activeUser.level || 1} size="xs" />
                </div>
                <span className="text-[10px] text-zinc-300 font-medium drop-shadow-sm">
                  {currentStory.createdAt}
                </span>
              </div>
            </div>

            {/* Close Button */}
            <div className="flex items-center gap-2">
              {isViewingSelf && onOpenCreateStory && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenCreateStory();
                  }}
                  className="px-2.5 py-1 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md text-white text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md text-white flex items-center justify-center transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Live Stream Callout if Friend is currently Live */}
          {activeFriend?.isLive && activeFriend.liveStreamId && onOpenLiveStream && (
            <div className="mt-2.5 flex justify-center">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenLiveStream(activeFriend.liveStreamId!);
                  onClose();
                }}
                className="px-3 py-1 rounded-full bg-gradient-to-r from-red-600 via-[#EC4899] to-[#7928CA] text-white text-[11px] font-extrabold flex items-center gap-1.5 shadow-lg shadow-red-500/30 animate-pulse hover:scale-105 transition-transform cursor-pointer"
              >
                <Radio className="w-3.5 h-3.5 text-white" />
                <span>Broadcasting LIVE Now • Watch Stream</span>
              </button>
            </div>
          )}
        </div>

        {/* Middle Touch Navigation Areas (Left 30% prev, Right 70% next) */}
        <div className="relative z-10 flex-1 flex">
          <div
            className="w-1/3 h-full cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              handlePrevStory();
            }}
          />
          <div
            className="w-2/3 h-full cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              handleNextStory();
            }}
          />
        </div>

        {/* Story Caption & Music Sticker */}
        <div className="relative z-20 px-4 pb-3 space-y-3">
          {currentStory.musicTitle && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-white text-[11px] font-medium shadow-md">
              <Music className="w-3.5 h-3.5 text-[#C084FC] animate-spin-slow" />
              <span className="truncate max-w-[240px]">{currentStory.musicTitle}</span>
            </div>
          )}

          {currentStory.caption && (
            <div className="bg-black/40 backdrop-blur-md p-3 rounded-2xl border border-white/10">
              <p className="text-white text-sm font-medium leading-relaxed drop-shadow-sm">
                {currentStory.caption}
              </p>
            </div>
          )}

          {/* Toast feedback */}
          {sentFeedback && (
            <div className="py-1 px-3 rounded-xl bg-emerald-500/90 text-white text-xs font-bold text-center shadow-lg animate-fade-in">
              {sentFeedback}
            </div>
          )}

          {/* Bottom Controls */}
          {isViewingSelf ? (
            /* Self View Controls: View count, Likes count */
            <div className="flex items-center justify-between p-2.5 rounded-2xl bg-black/60 backdrop-blur-md border border-white/10">
              <div className="flex items-center gap-4 text-xs font-semibold text-zinc-300">
                <span className="flex items-center gap-1 text-white">
                  <Eye className="w-4 h-4 text-[#A855F7]" />
                  <span>{currentStory.viewsCount || 128} Views</span>
                </span>
                <span className="flex items-center gap-1 text-white">
                  <Heart className="w-4 h-4 text-pink-500 fill-pink-500" />
                  <span>{currentStory.likes || 0} Likes</span>
                </span>
              </div>
              <span className="text-[11px] text-[#C084FC] font-bold">24h Alpha Story</span>
            </div>
          ) : (
            /* Friend View: Reply Bar & Quick Emojis */
            <div className="space-y-2.5">
              {/* Quick Emojis Bar */}
              <div className="flex items-center justify-between px-1">
                {['❤️', '🔥', '👏', '😂', '😮', '💜'].map((emoji) => (
                  <button
                    key={emoji}
                    onClick={(e) => {
                      e.stopPropagation();
                      triggerReaction(emoji);
                    }}
                    className="w-10 h-10 rounded-full bg-black/40 hover:bg-white/20 backdrop-blur-md flex items-center justify-center text-xl transition-transform active:scale-125 cursor-pointer"
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              {/* Reply Input & Like Button */}
              <form
                onSubmit={handleSendReply}
                className="flex items-center gap-2 pt-1"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder={`Reply to ${activeUser.displayName}...`}
                    className="w-full py-2.5 px-4 pr-10 rounded-full bg-black/50 backdrop-blur-md border border-white/20 text-white text-xs placeholder:text-zinc-400 focus:outline-none focus:border-[#A855F7]"
                  />
                  {replyText.trim() && (
                    <button
                      type="submit"
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const authorId = activeFriend?.id || '';
                    onToggleLike(authorId, currentStory.id);
                    triggerReaction('❤️');
                  }}
                  className={`w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-md border transition-all cursor-pointer ${
                    currentStory.isLiked
                      ? 'bg-pink-600/30 border-pink-500 text-pink-500'
                      : 'bg-black/50 border-white/20 text-white hover:text-pink-400'
                  }`}
                >
                  <Heart
                    className={`w-5 h-5 ${currentStory.isLiked ? 'fill-pink-500' : ''}`}
                  />
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
