import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Trophy,
  Award,
  Crown,
  Flame,
  Swords,
  Shield,
  Sparkles,
  Check,
  X,
  Star,
  Zap,
  ChevronRight,
} from 'lucide-react';
import { UserBadgeStrip } from '../badges/UserBadgeIcon';

interface TopAchievementsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FrameOption {
  id: string;
  name: string;
  description: string;
  color: string;
  glow: string;
  borderColor: string;
  icon: string;
  tier: string;
}

interface HonorTagOption {
  id: string;
  tag: string;
  title: string;
  subtitle: string;
  color: string;
  border: string;
  bg: string;
  icon: string;
}

export const TopAchievementsModal: React.FC<TopAchievementsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { currentUser, equipFrame, equipHonorTitle, openBadgesModal, userHistoricalStats } = useApp();
  const [activeTab, setActiveTab] = useState<'overview' | 'frames' | 'tags'>('overview');
  const [feedback, setFeedback] = useState<string | null>(null);

  if (!isOpen) return null;

  const showNotice = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 2500);
  };

  const currentFrameId = currentUser.activeFrame || 'golden_dragon';
  const currentTag = currentUser.activeHonorTitle || '[VICTOR]';

  const avatarFrames: FrameOption[] = [
    {
      id: 'golden_dragon',
      name: 'Royal Sovereign Golden Dragon',
      description: 'Ancient auric dragon aura with pulsating flames',
      color: 'from-amber-400 via-yellow-500 to-amber-600',
      glow: 'shadow-amber-500/50',
      borderColor: 'border-amber-400',
      icon: '🐉',
      tier: 'Mythic',
    },
    {
      id: 'cyber_neon',
      name: 'Cyber Neon Pulse Ring',
      description: 'Dual electric cyan & violet futuristic halo',
      color: 'from-cyan-400 via-fuchsia-500 to-purple-600',
      glow: 'shadow-fuchsia-500/50',
      borderColor: 'border-cyan-400',
      icon: '⚡',
      tier: 'Legendary',
    },
    {
      id: 'diamond_crown',
      name: 'Imperial Diamond Crown',
      description: 'Glittering crystalline crest for supreme patrons',
      color: 'from-sky-300 via-blue-400 to-indigo-500',
      glow: 'shadow-sky-400/50',
      borderColor: 'border-sky-300',
      icon: '👑',
      tier: 'Imperial',
    },
    {
      id: 'phoenix_blaze',
      name: 'Blazing Phoenix Wings',
      description: 'Flaming immortal feathers ignited by PK victories',
      color: 'from-rose-500 via-orange-500 to-amber-400',
      glow: 'shadow-orange-500/50',
      borderColor: 'border-rose-500',
      icon: '🔥',
      tier: 'Master',
    },
    {
      id: 'astral_sovereign',
      name: 'Celestial Astral Shield',
      description: 'Cosmic astral shield with starlight sparkles',
      color: 'from-purple-500 via-violet-600 to-indigo-700',
      glow: 'shadow-purple-500/50',
      borderColor: 'border-purple-400',
      icon: '🛡️',
      tier: 'Elite',
    },
  ];

  const honorTags: HonorTagOption[] = [
    {
      id: 'tag_victor',
      tag: '[VICTOR]',
      title: 'Supreme Battle Victor',
      subtitle: 'Awarded for continuous PK Battle victories and arena dominance',
      color: 'text-amber-300',
      border: 'border-amber-400/40',
      bg: 'bg-amber-400/10',
      icon: '⚔️',
    },
    {
      id: 'tag_warrior',
      tag: '[WARRIOR]',
      title: 'Grand Arena Warrior',
      subtitle: 'Achieved 100+ Live Battle Victories with high combat rating',
      color: 'text-rose-300',
      border: 'border-rose-400/40',
      bg: 'bg-rose-400/10',
      icon: '🛡️',
    },
    {
      id: 'tag_conqueror',
      tag: '[CONQUEROR]',
      title: 'Seasonal Tourney Conqueror',
      subtitle: 'Ranked in Top 1% Global Party PK Champion Leaderboards',
      color: 'text-purple-300',
      border: 'border-purple-400/40',
      bg: 'bg-purple-400/10',
      icon: '🏆',
    },
    {
      id: 'tag_legend',
      tag: '[LEGEND]',
      title: 'King of Kings Sovereign',
      subtitle: 'Highest tier recognition for royal community patrons',
      color: 'text-yellow-300',
      border: 'border-yellow-400/40',
      bg: 'bg-yellow-400/10',
      icon: '👑',
    },
    {
      id: 'tag_star',
      tag: '[STAR HOST]',
      title: 'Certified Alpha Star',
      subtitle: 'Official host with certified quality broadcast status',
      color: 'text-cyan-300',
      border: 'border-cyan-400/40',
      bg: 'bg-cyan-400/10',
      icon: '⭐',
    },
  ];

  const handleEquipFrame = (id: string, name: string) => {
    equipFrame(id);
    showNotice(`Equipped "${name}" frame to your profile!`);
  };

  const handleEquipTag = (tag: string) => {
    equipHonorTitle(tag);
    showNotice(`Equipped honor tag "${tag}" to your identity!`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl bg-[#110822] border border-[#A855F7]/40 shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="relative p-5 pb-4 bg-gradient-to-r from-[#2B104E] via-[#1A0A33] to-[#120524] border-b border-[#A855F7]/25">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-zinc-300 hover:text-white cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-400 via-rose-500 to-purple-600 p-0.5 shadow-lg shadow-amber-500/20 flex items-center justify-center">
              <div className="w-full h-full rounded-[14px] bg-[#160A2A] flex items-center justify-center text-amber-300">
                <Trophy className="w-6 h-6" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-white">Top Achievements</h2>
                <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-[10px] font-black border border-amber-400/30 flex items-center gap-1">
                  <Crown className="w-3 h-3" />
                  <span>HONOR HALL</span>
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Warrior & Victor Status • Equip Badges & Avatar Frames
              </p>
            </div>
          </div>

          {/* Active Identity Bar Preview */}
          <div className="mt-4 p-3 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative shrink-0">
                <img
                  src={currentUser.avatar}
                  alt={currentUser.displayName}
                  className="w-12 h-12 rounded-full object-cover border-2 border-amber-400 shadow-md"
                />
                <span className="absolute -bottom-1 -right-1 text-xs">
                  {avatarFrames.find((f) => f.id === currentFrameId)?.icon || '🐉'}
                </span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-black text-white truncate">
                    {currentUser.displayName}
                  </span>
                  <span className="px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 text-[10px] font-black border border-amber-400/40">
                    {currentTag}
                  </span>
                </div>
                <p className="text-[10px] text-zinc-400 mt-0.5 truncate">
                  Active Frame: {avatarFrames.find((f) => f.id === currentFrameId)?.name || 'Royal Dragon'}
                </p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="text-[9px] uppercase tracking-wider text-emerald-400 font-bold block">
                Lv.{currentUser.level} {currentUser.vipTier > 0 ? `• VIP ${currentUser.vipTier}` : ''}
              </span>
              <span className="text-xs font-black text-white font-mono">
                {Object.keys(userHistoricalStats.earnedBadges || {}).length} Badges
              </span>
            </div>
          </div>

          {/* Feedback Toast */}
          {feedback && (
            <div className="mt-2 p-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs font-bold text-center animate-in fade-in duration-150">
              {feedback}
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-white/10 px-4 pt-2 bg-[#0E061B]">
          {[
            { id: 'overview', label: 'Combat & Honors', icon: Swords },
            { id: 'frames', label: 'Avatar Frames', icon: Sparkles },
            { id: 'tags', label: 'Honor Tags', icon: Award },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            const TabIcon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  isActive
                    ? 'border-amber-400 text-amber-300'
                    : 'border-transparent text-zinc-400 hover:text-white'
                }`}
              >
                <TabIcon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* TAB 1: Combat & Honors Overview */}
          {activeTab === 'overview' && (
            <div className="space-y-3.5">
              {/* Real Historical Record Hero */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-[#200A38] via-[#17082A] to-[#10041F] border border-amber-400/30">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-black uppercase text-amber-300 tracking-wider flex items-center gap-1.5">
                    <Swords className="w-4 h-4" />
                    <span>Activity & Honor Record</span>
                  </span>
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    {userHistoricalStats.bestLeaderboardRank ? `Best Rank #${userHistoricalStats.bestLeaderboardRank}` : 'Active Challenger'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
                    <div className="text-lg font-black text-white font-mono">
                      {userHistoricalStats.totalGiftsSentCount.toLocaleString()}
                    </div>
                    <div className="text-[9.5px] text-zinc-400 uppercase font-bold mt-0.5">Gifts Sent</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
                    <div className="text-lg font-black text-amber-400 font-mono">
                      {userHistoricalStats.maxDailyStreak} Days
                    </div>
                    <div className="text-[9.5px] text-zinc-400 uppercase font-bold mt-0.5">Best Streak 🔥</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
                    <div className="text-lg font-black text-emerald-400 font-mono">
                      {userHistoricalStats.totalActiveMinutes.toLocaleString()}m
                    </div>
                    <div className="text-[9.5px] text-zinc-400 uppercase font-bold mt-0.5">Active Time</div>
                  </div>
                </div>
              </div>

              {/* Rank Progression */}
              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-zinc-300">Level XP Progression</span>
                  <span className="font-mono font-bold text-amber-300">
                    Lv.{currentUser.level} ({currentUser.xp.toLocaleString()} / {currentUser.nextLevelXp.toLocaleString()} XP)
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-black/60 overflow-hidden border border-white/10">
                  <div
                    className="h-full bg-gradient-to-r from-amber-400 via-rose-500 to-purple-600 rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, Math.max(4, Math.round((currentUser.xp / Math.max(1, currentUser.nextLevelXp)) * 100)))}%`,
                    }}
                  />
                </div>
                <p className="text-[10px] text-zinc-400">
                  Earned {userHistoricalStats.totalDiamondsEarned.toLocaleString()} 💎 Diamonds &amp; {userHistoricalStats.postsCreatedCount} Moments published.
                </p>
              </div>

              {/* Quick Equipped Badges */}
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-zinc-300 mb-2">
                  Equipped Honors On Identity
                </h3>
                <div className="space-y-2">
                  <div className="p-3 rounded-xl bg-[#1C0D30] border border-amber-400/40 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">⚔️</span>
                      <div>
                        <div className="text-xs font-bold text-white flex items-center gap-1.5">
                          <span>Active Tag: {currentTag}</span>
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 font-bold">
                            Active
                          </span>
                        </div>
                        <p className="text-[10px] text-zinc-400">Displayed next to your username in party rooms</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveTab('tags')}
                      className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[10.5px] font-bold cursor-pointer"
                    >
                      Change Tag
                    </button>
                  </div>

                  <div className="p-3 rounded-xl bg-[#1C0D30] border border-purple-400/40 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">🐉</span>
                      <div>
                        <div className="text-xs font-bold text-white flex items-center gap-1.5">
                          <span>
                            Frame: {avatarFrames.find((f) => f.id === currentFrameId)?.name || 'Royal Dragon'}
                          </span>
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-400/20 text-purple-300 font-bold">
                            Active
                          </span>
                        </div>
                        <p className="text-[10px] text-zinc-400">Glowing avatar frame shown across live feeds</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveTab('frames')}
                      className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[10.5px] font-bold cursor-pointer"
                    >
                      Change Frame
                    </button>
                  </div>

                  <div className="p-3 rounded-xl bg-[#1C0D30] border border-pink-400/40 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-pink-500/20 border border-pink-400/30 flex items-center justify-center shrink-0">
                        <Award className="w-4 h-4 text-pink-300" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white flex items-center gap-1.5 flex-wrap">
                          <span>Historical Profile Badges</span>
                          <UserBadgeStrip
                            badgeIds={userHistoricalStats.equippedBadgeIds}
                            earnedBadges={userHistoricalStats.earnedBadges}
                            size="xs"
                          />
                        </div>
                        <p className="text-[10px] text-zinc-400 truncate">
                          Top Contributor, Gift King, Party Attendee & more
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        openBadgesModal();
                      }}
                      className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white text-[10.5px] font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                    >
                      <span>Badge Vault</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Avatar Frames */}
          {activeTab === 'frames' && (
            <div className="space-y-2.5">
              <p className="text-[11px] text-zinc-400 mb-1">
                Choose any unlocked avatar frame to equip directly on your profile and party seats:
              </p>
              {avatarFrames.map((frame) => {
                const isEquipped = currentFrameId === frame.id;
                return (
                  <div
                    key={frame.id}
                    className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                      isEquipped
                        ? 'bg-[#200B3B] border-amber-400/80 shadow-lg shadow-amber-500/10'
                        : 'bg-white/5 border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-12 h-12 rounded-2xl bg-gradient-to-tr ${frame.color} p-0.5 shadow-md ${frame.glow} shrink-0 flex items-center justify-center`}
                      >
                        <div className="w-full h-full rounded-[14px] bg-[#140A28] flex items-center justify-center text-xl">
                          {frame.icon}
                        </div>
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-black text-white truncate">{frame.name}</h4>
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-white/10 text-amber-300 font-bold shrink-0">
                            {frame.tier}
                          </span>
                        </div>
                        <p className="text-[10px] text-zinc-400 mt-0.5 line-clamp-1">{frame.description}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleEquipFrame(frame.id, frame.name)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer flex items-center gap-1 ${
                        isEquipped
                          ? 'bg-amber-400 text-black shadow-md shadow-amber-400/20 font-black'
                          : 'bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white hover:brightness-110 active:scale-95'
                      }`}
                    >
                      {isEquipped ? (
                        <>
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                          <span>Equipped</span>
                        </>
                      ) : (
                        <span>Equip</span>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 3: Honor Titles & Tags */}
          {activeTab === 'tags' && (
            <div className="space-y-2.5">
              <p className="text-[11px] text-zinc-400 mb-1">
                Select your proudest honor tag to display beside your name across all public rooms:
              </p>
              {honorTags.map((t) => {
                const isEquipped = currentTag === t.tag;
                return (
                  <div
                    key={t.id}
                    className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                      isEquipped
                        ? 'bg-[#200B3B] border-amber-400/80 shadow-lg shadow-amber-500/10'
                        : 'bg-white/5 border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-black/40 border border-white/10 flex items-center justify-center text-lg shrink-0">
                        {t.icon}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-md font-mono text-xs font-black border ${t.border} ${t.bg} ${t.color}`}
                          >
                            {t.tag}
                          </span>
                          <span className="text-xs font-bold text-white truncate">{t.title}</span>
                        </div>
                        <p className="text-[10px] text-zinc-400 mt-1 line-clamp-1">{t.subtitle}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleEquipTag(t.tag)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer flex items-center gap-1 ${
                        isEquipped
                          ? 'bg-amber-400 text-black shadow-md shadow-amber-400/20 font-black'
                          : 'bg-gradient-to-r from-amber-500 to-amber-600 text-black hover:brightness-110 active:scale-95'
                      }`}
                    >
                      {isEquipped ? (
                        <>
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                          <span>Active</span>
                        </>
                      ) : (
                        <span>Equip Tag</span>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 bg-[#0A0414] border-t border-white/10 text-center">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-zinc-300 hover:text-white text-xs font-bold cursor-pointer transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
