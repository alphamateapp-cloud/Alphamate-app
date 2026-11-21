import React, { useEffect, useState } from 'react';
import { User } from '../../types';
import { VipAvatarFrame } from '../brand/VipAvatarFrame';
import { LevelBadgeIcon } from '../brand/LevelBadgeIcon';
import { copyToClipboard } from '../../utils/clipboard';
import { subscribeToPublicUserProfile } from '../../services/firebase';
import { fetchUserFollowCounts } from '../../services/userDirectoryService';
import {
  resolveUserBlueTickVerified,
  resolveUserGreenTickVerified,
} from '../../services/adminModerationService';
import { VerificationTicks } from '../badges/VerificationTicks';
import { DEFAULT_AVATAR_URL, safeImageSrc } from '../../utils/imageHd';
import {
  X,
  Gift,
  UserCheck,
  UserPlus,
  MessageCircle,
  ExternalLink,
  Mic,
  MicOff,
  Shield,
  ShieldCheck,
  ShieldAlert,
  UserX,
  Ban,
  Crown,
  Copy,
  Check,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';

export interface UserActionSheetModalProps {
  user: User;
  isOpen: boolean;
  onClose: () => void;
  // Context permissions
  isViewerHost: boolean;
  isViewerModerator: boolean;
  hostUser?: User;
  // Moderation state
  moderatorIds?: string[];
  onToggleModerator?: (targetUserId: string) => void;
  onKickUser?: (targetUserId: string, targetDisplayName: string) => void;
  onBlockUser?: (targetUserId: string, targetDisplayName: string) => void;
  // Mic & Seat state
  isSeated?: boolean;
  seatIndex?: number | null;
  isSeatMuted?: boolean;
  isSeatHostMuted?: boolean;
  onToggleSeatMic?: (seatIndex: number) => void;
  onRemoveFromSeat?: (seatIndex: number, targetUser: User) => void;
  // Interactions
  onSendGift: (targetUser: User) => void;
  onDirectMessage: (targetUser: User) => void;
  onVisitProfile: (targetUser: User) => void;
  // Follow state
  isFollowing?: boolean;
  onToggleFollow?: (targetUser: User) => void;
  currentUserId?: string;
}

export const UserActionSheetModal: React.FC<UserActionSheetModalProps> = ({
  user,
  isOpen,
  onClose,
  isViewerHost,
  isViewerModerator,
  hostUser,
  moderatorIds = [],
  onToggleModerator,
  onKickUser,
  onBlockUser,
  isSeated = false,
  seatIndex = null,
  isSeatMuted = false,
  isSeatHostMuted = false,
  onToggleSeatMic,
  onRemoveFromSeat,
  onSendGift,
  onDirectMessage,
  onVisitProfile,
  isFollowing = false,
  onToggleFollow,
  currentUserId,
}) => {
  const [copiedId, setCopiedId] = useState(false);
  const [showConfirmKick, setShowConfirmKick] = useState(false);
  const [showConfirmBlock, setShowConfirmBlock] = useState(false);
  const [liveProfile, setLiveProfile] = useState<Record<string, any> | null>(null);
  const [followCounts, setFollowCounts] = useState<{ followersCount: number; followingCount: number } | null>(null);

  useEffect(() => {
    if (!isOpen || !user?.id) {
      setLiveProfile(null);
      setFollowCounts(null);
      return;
    }

    let cancelled = false;
    setLiveProfile(null);
    setFollowCounts(null);

    const unsub = subscribeToPublicUserProfile(user.id, (data) => {
      if (!cancelled && data) {
        setLiveProfile(data);
      }
    });

    fetchUserFollowCounts(user.id)
      .then((res) => {
        if (!cancelled) {
          setFollowCounts(res);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      unsub();
    };
  }, [isOpen, user?.id, isFollowing]);

  if (!isOpen) return null;

  const displayUser: User = {
    ...user,
    displayName: String(liveProfile?.displayName || user.displayName || 'Alpha Mate'),
    username: String(liveProfile?.username || user.username || 'user'),
    uniqueId: String(liveProfile?.uniqueId || user.uniqueId || user.id),
    avatar:
      safeImageSrc(liveProfile?.avatar || liveProfile?.photoURL || user.avatar, DEFAULT_AVATAR_URL) ||
      DEFAULT_AVATAR_URL,
    bio: liveProfile?.bio !== undefined ? String(liveProfile.bio || '') : (user.bio || ''),
    level: Math.max(0, Number(liveProfile?.level ?? user.level ?? 0)),
    vipTier: Math.max(0, Number(liveProfile?.vipTier ?? user.vipTier ?? 0)),
    likesCount: Math.max(0, Number(liveProfile?.likesCount ?? user.likesCount ?? 0)),
    followersCount: Math.max(
      0,
      Number(followCounts ? followCounts.followersCount : (liveProfile?.followersCount ?? user.followersCount ?? 0))
    ),
    followingCount: Math.max(
      0,
      Number(followCounts ? followCounts.followingCount : (liveProfile?.followingCount ?? user.followingCount ?? 0))
    ),
    isVerified: liveProfile
      ? resolveUserBlueTickVerified(liveProfile, Boolean(user.isVerified))
      : Boolean(user.isVerified),
    isAccountVerified: liveProfile
      ? resolveUserGreenTickVerified(liveProfile, Boolean(user.isAccountVerified || user.greenTick))
      : resolveUserGreenTickVerified(user as Record<string, any>, false),
    country: liveProfile?.country ?? user.country,
    countryFlag: liveProfile?.countryFlag ?? user.countryFlag,
    familyCrew: liveProfile?.familyCrew ?? user.familyCrew,
  };

  const isMe = currentUserId === displayUser.id;
  const isTargetHost = hostUser
    ? hostUser.id === displayUser.id || hostUser.displayName === displayUser.displayName
    : displayUser.isHost;
  const isTargetModerator = moderatorIds.includes(displayUser.id);
  const canModerate = (isViewerHost || isViewerModerator) && !isTargetHost && !isMe;
  const isModeratorLimitReached = moderatorIds.length >= 10 && !isTargetModerator;

  const handleCopyId = async () => {
    const success = await copyToClipboard(displayUser.uniqueId || displayUser.id);
    if (success) {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      {/* Background click dismiss */}
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative z-10 w-full max-w-sm rounded-t-3xl sm:rounded-3xl bg-[#130B24] border border-[#A855F7]/30 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Top ambient glow bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#7928CA] via-[#EC4899] to-[#38BDF8]" />

        {/* Header Bar */}
        <div className="px-4 pt-3 pb-2 flex items-center justify-between border-b border-white/10 bg-[#170E2C]/80">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black tracking-wide text-zinc-300">USER PROFILE & CONTROLS</span>
            {isTargetHost && (
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[9px] font-black border border-amber-400/30 flex items-center gap-1">
                <Crown className="w-2.5 h-2.5" /> Host
              </span>
            )}
            {isTargetModerator && !isTargetHost && (
              <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-[9px] font-black border border-cyan-400/30 flex items-center gap-1">
                <ShieldCheck className="w-2.5 h-2.5" /> MOD ({moderatorIds.length}/10)
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-4 overflow-y-auto space-y-4 scrollbar-none">
          {/* User Card Showcase */}
          <div className="flex items-start gap-3.5 p-3 rounded-2xl bg-white/5 border border-white/10 relative overflow-hidden">
            {/* VIP Avatar Frame */}
            <div className="relative shrink-0">
              <VipAvatarFrame
                avatarUrl={displayUser.avatar}
                vipTier={displayUser.vipTier || 0}
                size="md"
                showCrownBadge={isTargetHost}
              />
              {isSeated && (
                <div
                  className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center border border-white/20 shadow-md ${
                    isSeatMuted ? 'bg-rose-600 text-white' : 'bg-emerald-500 text-black'
                  }`}
                  title={isSeatMuted ? 'Mic Muted' : 'Mic Live'}
                >
                  {isSeatMuted ? <MicOff className="w-2.5 h-2.5" /> : <Mic className="w-2.5 h-2.5" />}
                </div>
              )}
            </div>

            {/* Info details */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="text-sm font-black text-white truncate max-w-[150px]">
                  {displayUser.displayName}
                </h3>
                {displayUser.countryFlag && (
                  <span className="text-xs" title={displayUser.country}>{displayUser.countryFlag}</span>
                )}
                <VerificationTicks
                  isAccountVerified={Boolean(displayUser.isAccountVerified || displayUser.greenTick)}
                  isBlueTickVerified={Boolean(displayUser.isVerified)}
                  size="sm"
                />
              </div>

              {/* ID + 1-Click Copy */}
              <div className="flex items-center gap-1.5 mt-0.5">
                <button
                  onClick={handleCopyId}
                  className="flex items-center gap-1 text-[10px] font-mono text-zinc-400 hover:text-white px-1.5 py-0.5 rounded bg-black/40 border border-white/10 cursor-pointer transition-colors"
                  title="Click to copy ID"
                >
                  <span>ID: {displayUser.uniqueId || displayUser.id}</span>
                  {copiedId ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5 text-zinc-400" />}
                </button>
                {copiedId && (
                  <span className="text-[9px] text-emerald-400 font-bold">Copied!</span>
                )}
              </div>

              {/* Level & VIP Badges */}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <LevelBadgeIcon level={displayUser.level} size="sm" />
                {displayUser.vipTier > 0 ? (
                  <span className="px-1.5 py-0.5 rounded bg-[#7928CA]/30 text-[#C084FC] text-[9px] font-black border border-[#A855F7]/30">
                    VIP {displayUser.vipTier}
                  </span>
                ) : null}
                {displayUser.familyCrew && (
                  <span className="px-1.5 py-0.5 rounded bg-pink-500/20 text-pink-300 text-[8.5px] font-bold border border-pink-500/30 truncate max-w-[100px]">
                    {displayUser.familyCrew}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Social Stats: Followers, Following, Likes */}
          <div className="grid grid-cols-3 gap-2 text-center py-2 px-3 rounded-2xl bg-black/40 border border-white/5">
            <div>
              <p className="text-xs font-black text-white">{displayUser.followersCount.toLocaleString()}</p>
              <p className="text-[9px] text-zinc-400 font-medium">Followers</p>
            </div>
            <div>
              <p className="text-xs font-black text-white">{displayUser.followingCount.toLocaleString()}</p>
              <p className="text-[9px] text-zinc-400 font-medium">Following</p>
            </div>
            <div>
              <p className="text-xs font-black text-white">{displayUser.likesCount.toLocaleString()}</p>
              <p className="text-[9px] text-zinc-400 font-medium">Likes</p>
            </div>
          </div>

          {/* Bio statement */}
          {displayUser.bio && (
            <p className="text-xs text-zinc-300 italic px-1 line-clamp-2">
              "{displayUser.bio}"
            </p>
          )}

          {/* Core Interactive Actions */}
          <div className="grid grid-cols-2 gap-2">
            {/* 1. Send Gift */}
            <button
              onClick={() => {
                onClose();
                onSendGift(displayUser);
              }}
              className="h-11 rounded-xl bg-gradient-to-r from-[#7928CA] via-[#9333EA] to-[#EC4899] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-[#7928CA]/30 hover:brightness-110 active:scale-95 transition-all cursor-pointer"
            >
              <Gift className="w-4 h-4 text-amber-300" />
              <span>Send Gift</span>
            </button>

            {/* 2. Follow / Follow Back */}
            {!isMe ? (
              <button
                onClick={() => onToggleFollow && onToggleFollow(displayUser)}
                className={`h-11 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  isFollowing
                    ? 'bg-zinc-800 text-zinc-300 border border-white/10 hover:bg-zinc-700'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/30 active:scale-95'
                }`}
              >
                {isFollowing ? (
                  <>
                    <UserCheck className="w-4 h-4 text-emerald-400" />
                    <span>Following</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>Follow Back</span>
                  </>
                )}
              </button>
            ) : (
              <div className="h-11 rounded-xl bg-zinc-800/60 border border-white/5 flex items-center justify-center text-xs text-zinc-400 font-medium">
                This is you
              </div>
            )}

            {/* 3. Direct Message / Inbox */}
            {!isMe && (
              <button
                onClick={() => {
                  onClose();
                  onDirectMessage(displayUser);
                }}
                className="h-10 rounded-xl bg-[#1E1138] border border-white/10 hover:border-[#A855F7] text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all"
              >
                <MessageCircle className="w-4 h-4 text-[#C084FC]" />
                <span>Inbox</span>
              </button>
            )}

            {/* 4. Visit Profile */}
            <button
              onClick={() => {
                onClose();
                onVisitProfile(displayUser);
              }}
              className={`h-10 rounded-xl bg-[#1E1138] border border-white/10 hover:border-[#A855F7] text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                isMe ? 'col-span-2' : ''
              }`}
            >
              <ExternalLink className="w-4 h-4 text-cyan-400" />
              <span>Visit Profile</span>
            </button>
          </div>

          {/* ===================================================================
              HOST & MODERATOR CONTROLS SECTION
              - Mute / Unmute Mic (Locked by host/mod)
              - Make / Remove Moderator (Max 10)
              - Kick from Room (Blocked for this session)
              - Permanent Block
             =================================================================== */}
          {canModerate && (
            <div className="pt-3 border-t border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-amber-300 tracking-wider flex items-center gap-1">
                  <Shield className="w-3 h-3 text-amber-400" /> MODERATION CONTROLS
                </span>
                <span className="text-[9px] text-zinc-400">
                  {isViewerHost ? '👑 Host Access' : '🛡️ Moderator Access'}
                </span>
              </div>

              {/* A. Mic Control (if user is sitting on a guest seat) */}
              {isSeated && seatIndex !== null && onToggleSeatMic && (
                <div className="p-2.5 rounded-xl bg-[#1C1236] border border-[#A855F7]/30 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      {isSeatMuted ? <MicOff className="w-3.5 h-3.5 text-rose-400" /> : <Mic className="w-3.5 h-3.5 text-emerald-400" />}
                      <span>Seat {seatIndex + 1} Microphone</span>
                    </span>
                    <button
                      onClick={() => onToggleSeatMic(seatIndex)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                        isSeatMuted
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                          : 'bg-rose-600 hover:bg-rose-500 text-white'
                      }`}
                    >
                      {isSeatMuted ? 'Unmute Mic' : 'Mute Mic'}
                    </button>
                  </div>
                  <p className="text-[9px] text-zinc-400">
                    {isSeatMuted
                      ? '🔒 User is locked muted by Host/Mod and cannot unmute themselves until you unmute them.'
                      : 'Muting this user will lock their mic; they cannot turn it on themselves.'}
                  </p>
                </div>
              )}

              {/* A2. Remove from Seat (step guest down to audience) */}
              {isSeated && seatIndex !== null && onRemoveFromSeat && (
                <button
                  onClick={() => {
                    onClose();
                    onRemoveFromSeat(seatIndex, displayUser);
                  }}
                  className="w-full h-10 rounded-xl bg-orange-500/15 border border-orange-500/40 text-orange-200 hover:bg-orange-500/25 font-bold text-xs flex items-center justify-between px-3 cursor-pointer transition-all"
                >
                  <div className="flex items-center gap-2">
                    <UserX className="w-4 h-4 text-orange-400" />
                    <span>Remove Seat</span>
                  </div>
                  <span className="text-[9.5px] text-zinc-400">Seat #{seatIndex + 1} → Audience</span>
                </button>
              )}

              {/* B. Host Only: Make / Remove Moderator (1 to 10 limit) */}
              {isViewerHost && onToggleModerator && (
                <button
                  onClick={() => onToggleModerator(user.id)}
                  disabled={isModeratorLimitReached}
                  className={`w-full h-10 rounded-xl font-bold text-xs flex items-center justify-between px-3 transition-all cursor-pointer ${
                    isTargetModerator
                      ? 'bg-cyan-950/80 border border-cyan-500/50 text-cyan-200 hover:bg-cyan-900'
                      : isModeratorLimitReached
                      ? 'bg-zinc-800/40 border border-white/5 text-zinc-500 cursor-not-allowed'
                      : 'bg-[#181133] border border-cyan-500/30 text-cyan-300 hover:border-cyan-400 hover:bg-cyan-950/40'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-cyan-400" />
                    <span>
                      {isTargetModerator
                        ? 'Remove Moderator'
                        : 'Make Moderator'}
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-400">
                    {moderatorIds.length}/10 Active
                  </span>
                </button>
              )}

              {/* C. Kick from Room / Broadcast */}
              {onKickUser && (
                <div>
                  {!showConfirmKick ? (
                    <button
                      onClick={() => setShowConfirmKick(true)}
                      className="w-full h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20 font-bold text-xs flex items-center justify-between px-3 cursor-pointer transition-all"
                    >
                      <div className="flex items-center gap-2">
                        <UserX className="w-4 h-4 text-amber-400" />
                        <span>Kick from Room</span>
                      </div>
                      <span className="text-[9.5px] text-zinc-400">Cannot rejoin this live</span>
                    </button>
                  ) : (
                    <div className="p-3 rounded-xl bg-amber-950/80 border border-amber-500/50 space-y-2">
                      <p className="text-xs font-bold text-amber-200">
                        Confirm Kick "{user.displayName}"?
                      </p>
                      <p className="text-[9.5px] text-zinc-300">
                        They will be removed immediately and blocked from re-entering during this broadcast session.
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setShowConfirmKick(false);
                            onClose();
                            onKickUser(user.id, user.displayName);
                          }}
                          className="flex-1 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-black font-black text-xs cursor-pointer"
                        >
                          Confirm Kick
                        </button>
                        <button
                          onClick={() => setShowConfirmKick(false)}
                          className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 text-xs font-bold cursor-pointer hover:text-white"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* D. Permanent Block */}
              {onBlockUser && (
                <div>
                  {!showConfirmBlock ? (
                    <button
                      onClick={() => setShowConfirmBlock(true)}
                      className="w-full h-10 rounded-xl bg-rose-600/10 border border-rose-500/30 text-rose-300 hover:bg-rose-600/20 font-bold text-xs flex items-center justify-between px-3 cursor-pointer transition-all"
                    >
                      <div className="flex items-center gap-2">
                        <Ban className="w-4 h-4 text-rose-400" />
                        <span>Block User Permanently</span>
                      </div>
                      <span className="text-[9.5px] text-zinc-400">Blocked forever</span>
                    </button>
                  ) : (
                    <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-500/50 space-y-2">
                      <p className="text-xs font-bold text-rose-200">
                        Block "{user.displayName}" Permanently?
                      </p>
                      <p className="text-[9.5px] text-zinc-300">
                        They will be permanently blocked from ever entering or viewing any live stream or party room hosted by you.
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setShowConfirmBlock(false);
                            onClose();
                            onBlockUser(user.id, user.displayName);
                          }}
                          className="flex-1 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-black text-xs cursor-pointer"
                        >
                          Permanent Block
                        </button>
                        <button
                          onClick={() => setShowConfirmBlock(false)}
                          className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 text-xs font-bold cursor-pointer hover:text-white"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
