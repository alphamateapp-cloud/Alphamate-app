import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { VIRTUAL_GIFTS } from '../data/mockData';
import { Gift } from '../types';
import {
  CameraFilterOverlay,
  FilterPresetId,
  CAMERA_FILTER_PRESETS,
} from '../components/stream/CameraFilterOverlay';
import { p2pStreamingEngine } from '../services/webrtcService';
import { VipAvatarFrame } from '../components/brand/VipAvatarFrame';
import { LevelBadgeIcon } from '../components/brand/LevelBadgeIcon';
import { copyToClipboard } from '../utils/clipboard';
import {
  X,
  Heart,
  Gift as GiftIcon,
  Share2,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Sparkles,
  Settings,
  Send,
  Users,
  Plus,
  Check,
  Crown,
  Volume2,
  VolumeX,
  Wand2,
  RotateCcw,
  FlipHorizontal,
  Copy,
  Radio,
  Eye,
  Camera,
  Shield,
  ShieldCheck,
  Trash2,
  UserX,
  Ban,
  Flame,
  Zap,
} from 'lucide-react';
import { User } from '../types';
import { UserActionSheetModal } from '../components/live/UserActionSheetModal';
import { RoomViewersModal } from '../components/live/RoomViewersModal';
import { MOCK_ROOM_VIEWERS } from '../data/mockData';
import { GiftAnimationOverlay, ActiveGiftEvent } from '../components/live/GiftAnimationOverlay';
import { TopGiversLeaderboard, SessionGiver } from '../components/live/TopGiversLeaderboard';
import { LuckyDrawModal } from '../components/live/LuckyDrawModal';

interface FloatingHeart {
  id: number;
  x: number;
  y: number;
  color: string;
}

export const LiveStreamScreen: React.FC = () => {
  const {
    activeStream,
    closeLiveStream,
    coins,
    addCoins,
    sendLiveGift,
    activeGiftBanner,
    clearActiveGiftBanner,
    currentUser,
    setCurrentScreen,
    startDirectMessage,
  } = useApp();

  // Role perspective: Host or Viewer (strictly separates Host publishing from Viewer subscription)
  const isHostByUser =
    activeStream?.host?.id === currentUser?.id ||
    activeStream?.host?.displayName === currentUser?.displayName;
  const [activeRole, setActiveRole] = useState<'host' | 'viewer'>(isHostByUser ? 'host' : 'viewer');

  // Moderation & Audience state (Moderator limit: 10)
  const [moderatorIds, setModeratorIds] = useState<string[]>(
    activeStream?.moderatorIds || []
  );
  const [kickedUserIds, setKickedUserIds] = useState<string[]>(
    activeStream?.kickedUserIds || []
  );
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>(
    activeStream?.blockedUserIds || []
  );
  const [selectedUserForActionSheet, setSelectedUserForActionSheet] = useState<User | null>(null);
  const [showUserActionSheet, setShowUserActionSheet] = useState(false);
  const [showViewersModal, setShowViewersModal] = useState(false);
  const [followingUserIds, setFollowingUserIds] = useState<Set<string>>(new Set());
  const [giftRecipientUser, setGiftRecipientUser] = useState<User | null>(null);

  // Host broadcast controls & hardware states
  const [isHostMicOn, setIsHostMicOn] = useState(true);
  const [isHostVideoOn, setIsHostVideoOn] = useState(true);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  // Viewer subscription & remote broadcast states (Viewer local camera is ALWAYS OFF)
  const [isRemoteVideoOn, setIsRemoteVideoOn] = useState(true);
  const [isRemoteMicOn, setIsRemoteMicOn] = useState(true);
  const [isRemoteAudioMuted, setIsRemoteAudioMuted] = useState(false);

  // Audience & Social interaction state
  const [isFollowing, setIsFollowing] = useState(false);
  const [viewerCount, setViewerCount] = useState(activeStream?.viewerCount || 0);
  const [durationSecs, setDurationSecs] = useState(0);
  const [hearts, setHearts] = useState<FloatingHeart[]>([]);
  const [comments, setComments] = useState<
    Array<{
      id: string;
      user: string;
      text: string;
      vipLevel?: number;
      level?: number;
      isGiftHighlight?: boolean;
      isEntryNotice?: boolean;
    }>
  >([]);
  const [inputComment, setInputComment] = useState('');
  const [showGiftDrawer, setShowGiftDrawer] = useState(false);
  const [showLuckyDrawModal, setShowLuckyDrawModal] = useState(false);
  const [selectedGift, setSelectedGift] = useState<Gift>(VIRTUAL_GIFTS[0]);

  // Spectacular Visual Gift Animation & Combo states
  const [activeGiftAnimation, setActiveGiftAnimation] = useState<ActiveGiftEvent | null>(null);
  const [giftComboCount, setGiftComboCount] = useState<number>(1);
  const [lastSentGiftId, setLastSentGiftId] = useState<string | null>(null);
  const [lastGiftSentTime, setLastGiftSentTime] = useState<number>(0);
  const [giftQuantityMultiplier, setGiftQuantityMultiplier] = useState<number>(1);

  // Top Givers Leaderboard State for Current Broadcast Session
  const [sessionGivers, setSessionGivers] = useState<SessionGiver[]>([]);

  // Host camera filters & settings
  const [activeFilterPreset, setActiveFilterPreset] = useState<FilterPresetId>('neon');
  const [filterIntensity, setFilterIntensity] = useState<number>(100);
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const isHost = activeRole === 'host';
  const isModerator = moderatorIds.includes(currentUser.id);
  const canModerate = isHost || isModerator;

  // Check if current user is blocked or kicked
  useEffect(() => {
    if (!activeStream) return;
    if (blockedUserIds.includes(currentUser.id)) {
      showToast('You are blocked from this live stream by the host! ⛔');
      closeLiveStream();
    } else if (kickedUserIds.includes(currentUser.id)) {
      showToast('You were kicked from this live session! 🚫');
      closeLiveStream();
    }
  }, [activeStream?.id, blockedUserIds, kickedUserIds, currentUser.id]);

  // Moderation Action Handlers
  const handleToggleModerator = (targetUserId: string) => {
    if (!isHost) {
      showToast('Only the stream Host can assign moderators! 👑');
      return;
    }
    if (moderatorIds.includes(targetUserId)) {
      setModeratorIds((prev) => prev.filter((id) => id !== targetUserId));
      showToast('Removed as Moderator 🛡️');
    } else {
      if (moderatorIds.length >= 10) {
        showToast('Maximum 10 moderators limit reached! ⚠️');
        return;
      }
      setModeratorIds((prev) => [...prev, targetUserId]);
      showToast('Assigned as Live Stream Moderator! 🛡️ (Permanent until removed)');
    }
  };

  const handleKickUser = (targetUserId: string, targetDisplayName: string) => {
    if (!canModerate) return;
    if (activeStream && (targetUserId === activeStream.host.id || targetDisplayName === activeStream.host.displayName)) {
      showToast('Cannot kick the stream Host! 👑');
      return;
    }
    setKickedUserIds((prev) => [...prev, targetUserId]);
    showToast(`Kicked ${targetDisplayName} from this live session! 🚫`);
    setComments((prev) => [
      ...prev,
      {
        id: `sys_kick_${Date.now()}`,
        user: 'System',
        text: `🛡️ ${targetDisplayName} was kicked from the stream by ${isHost ? 'Host' : 'Moderator'}.`,
      },
    ]);
  };

  const handleBlockUser = (targetUserId: string, targetDisplayName: string) => {
    if (!canModerate) return;
    if (activeStream && (targetUserId === activeStream.host.id || targetDisplayName === activeStream.host.displayName)) {
      showToast('Cannot block the stream Host! 👑');
      return;
    }
    setBlockedUserIds((prev) => [...prev, targetUserId]);
    setKickedUserIds((prev) => [...prev, targetUserId]);
    showToast(`Permanently blocked ${targetDisplayName}! ⛔`);
    setComments((prev) => [
      ...prev,
      {
        id: `sys_block_${Date.now()}`,
        user: 'System',
        text: `⛔ ${targetDisplayName} was permanently blocked by host.`,
      },
    ]);
  };

  const handleClearChat = () => {
    if (!canModerate) {
      showToast('Only Host and Moderators can clear comments history! 🛡️');
      return;
    }
    setComments([
      {
        id: `clear_${Date.now()}`,
        user: 'System',
        text: `🧹 Comment history was cleared by ${isHost ? 'Host' : 'Moderator'}.`,
      },
    ]);
    showToast('Comments cleared! 🧹');
  };

  const handleToggleFollowUser = (targetUser: User) => {
    const isNowFollowing = !followingUserIds.has(targetUser.id);
    setFollowingUserIds((prev) => {
      const next = new Set(prev);
      if (isNowFollowing) {
        next.add(targetUser.id);
      } else {
        next.delete(targetUser.id);
      }
      return next;
    });
    showToast(isNowFollowing ? `Following ${targetUser.displayName}! 💜` : `Unfollowed ${targetUser.displayName}`);
  };

  const handleCommentClick = (comment: { id: string; user: string; text: string; vipLevel?: number }) => {
    const isTargetHost = activeStream && comment.user === activeStream.host.displayName;
    const targetUser: User = isTargetHost && activeStream
      ? activeStream.host
      : {
          id: `user_${comment.user.replace(/[^a-zA-Z0-9]/g, '_')}`,
          uniqueId: `AM_${Math.floor(100000 + Math.random() * 900000)}`,
          username: comment.user.replace(/[^a-zA-Z0-9]/g, ''),
          displayName: comment.user,
          avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80',
          bio: 'Alpha Mate live stream viewer 💜',
          followersCount: 3800,
          followingCount: 140,
          likesCount: 29000,
          level: 22,
          xp: 8500,
          nextLevelXp: 12000,
          vipTier: comment.vipLevel || 0,
          coins: 1400,
          diamonds: 500,
          isVerified: isTargetHost || false,
          isHost: isTargetHost || false,
        };

    setSelectedUserForActionSheet(targetUser);
    setShowUserActionSheet(true);
  };

  const currentPreset =
    CAMERA_FILTER_PRESETS.find((p) => p.id === activeFilterPreset) || CAMERA_FILTER_PRESETS[0];

  const commentsEndRef = useRef<HTMLDivElement>(null);
  const hostVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const lastTapRef = useRef<number>(0);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Determine currently active camera/mic states based on perspective
  const isCameraActive = activeRole === 'host' ? isHostVideoOn : isRemoteVideoOn;
  const isMicActive = activeRole === 'host' ? isHostMicOn : isRemoteMicOn;

  // =========================================================================
  // STRICT STREAM PIPELINE: HOST PUBLISHING VS VIEWER SUBSCRIPTION
  // =========================================================================
  useEffect(() => {
    if (!activeStream) return;
    let isMounted = true;

    if (activeRole === 'viewer') {
      // -----------------------------------------------------------------------
      // STRICT VIEWER MODE:
      // 1. Viewer local camera is NEVER initialized / requested.
      // 2. Viewer local microphone is NEVER captured / unmuted.
      // 3. Stop any existing local hardware tracks to guarantee zero leak.
      // 4. Subscribe strictly to the host's remote broadcast.
      // -----------------------------------------------------------------------
      p2pStreamingEngine.stopLocalMediaStream();

      p2pStreamingEngine
        .subscribeToRemoteBroadcast(activeStream.id, activeStream.host, (state) => {
          if (isMounted) {
            setIsRemoteVideoOn(state.isVideoOn);
            setIsRemoteMicOn(state.isMicOn);
          }
        })
        .then(({ stream, isVideoOn, isMicOn }) => {
          if (isMounted) {
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = stream;
              remoteVideoRef.current.play().catch(() => {
                // Browser may require user gesture for initial playback
              });
            }
            setIsRemoteVideoOn(isVideoOn);
            setIsRemoteMicOn(isMicOn);
          }
        })
        .catch((err) => {
          console.warn('Viewer remote broadcast subscription error', err);
        });

      return () => {
        isMounted = false;
        p2pStreamingEngine.unsubscribeFromRemoteBroadcast(activeStream.id);
      };
    } else {
      // -----------------------------------------------------------------------
      // HOST MODE:
      // 1. Acquire local camera and microphone for the host.
      // 2. Publish stream to remote viewers and register broadcast state.
      // -----------------------------------------------------------------------
      const initHostCamera = async () => {
        try {
          const stream = await p2pStreamingEngine.getLocalMediaStream(facingMode, isHostMicOn);
          if (hostVideoRef.current && isMounted) {
            hostVideoRef.current.srcObject = stream;
            hostVideoRef.current.play().catch(() => {});
          }
          p2pStreamingEngine.registerHostBroadcast(
            activeStream.id,
            stream,
            isHostVideoOn,
            isHostMicOn,
            currentUser.id
          );
          p2pStreamingEngine.createPeerConnection(activeStream.id);
        } catch (err) {
          console.warn('Host camera stream initialization error:', err);
        }
      };

      initHostCamera();

      return () => {
        isMounted = false;
        p2pStreamingEngine.stopHostBroadcast(activeStream.id);
      };
    }
  }, [activeRole, activeStream?.id, facingMode]);

  // Flip / Rotate Camera for Host (Front <-> Rear)
  const handleFlipCamera = async () => {
    if (activeRole !== 'host') return;
    const nextFacing = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextFacing);
    try {
      const newStream = await p2pStreamingEngine.flipCamera();
      if (hostVideoRef.current) {
        hostVideoRef.current.srcObject = newStream;
        hostVideoRef.current.play().catch(() => {});
      }
      showToast(nextFacing === 'user' ? 'Front Camera 🤳' : 'Rear Camera 📷');
    } catch (err) {
      console.warn('Flip camera error', err);
    }
  };

  // Toggle Host Microphone
  const handleToggleHostMic = () => {
    if (!activeStream) return;
    const nextState = !isHostMicOn;
    setIsHostMicOn(nextState);
    p2pStreamingEngine.setHostMicState(activeStream.id, nextState);
    showToast(nextState ? 'Microphone Active 🎙️' : 'Microphone Muted 🔇');
  };

  // Toggle Host Video Camera
  const handleToggleHostVideo = () => {
    if (!activeStream) return;
    const nextState = !isHostVideoOn;
    setIsHostVideoOn(nextState);
    p2pStreamingEngine.setHostCameraState(activeStream.id, nextState);
    showToast(nextState ? 'Camera Video Active 📹' : 'Camera is Off 📷🚫');
  };

  // Switch Role Perspective (Tester / Switcher between Host and Viewer)
  const handleToggleRolePerspective = () => {
    const nextRole = activeRole === 'host' ? 'viewer' : 'host';
    setActiveRole(nextRole);
    showToast(nextRole === 'host' ? 'Switched to Host HUD 🎙️' : 'Switched to Viewer Mode 👁️');
  };

  // Auto-scroll comments feed
  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  // Stream broadcast elapsed timer
  useEffect(() => {
    const timer = setInterval(() => {
      setDurationSecs((d) => d + 1);
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  // Format MM:SS duration
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Spawn floating heart
  const spawnHeart = (clientX?: number, clientY?: number) => {
    const colors = ['#EC4899', '#A855F7', '#F43F5E', '#C084FC', '#F59E0B', '#38BDF8'];
    const newHeart: FloatingHeart = {
      id: Date.now() + Math.random(),
      x: clientX ? clientX - 20 + (Math.random() * 30 - 15) : Math.floor(Math.random() * 60) - 30,
      y: clientY ? clientY - 40 : 0,
      color: colors[Math.floor(Math.random() * colors.length)],
    };
    setHearts((prev) => [...prev, newHeart]);

    setTimeout(() => {
      setHearts((prev) => prev.filter((h) => h.id !== newHeart.id));
    }, 1800);
  };

  // Double tap handler on entire screen (allowed for both host and viewers)
  const handleScreenTouchOrClick = (e: React.MouseEvent | React.TouchEvent) => {
    // Resume viewer audio playback on user touch if paused by browser autoplay policy
    if (activeRole === 'viewer' && remoteVideoRef.current) {
      remoteVideoRef.current.play().catch(() => {});
    }

    const now = Date.now();
    const timeDiff = now - lastTapRef.current;
    if (timeDiff < 320) {
      const clientX = 'touches' in e && e.touches[0] ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
      const clientY = 'touches' in e && e.touches[0] ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
      spawnHeart(clientX, clientY);
      spawnHeart(clientX ? clientX + 15 : undefined, clientY ? clientY - 15 : undefined);
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
  };

  const handleSendComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputComment.trim()) return;
    setComments((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        user: currentUser.displayName,
        text: inputComment.trim(),
        vipLevel: currentUser.vipTier,
        level: currentUser.level,
      },
    ]);
    setInputComment('');
  };

  // Sync incoming external gift banner to full visual animation
  useEffect(() => {
    if (activeGiftBanner && !activeGiftAnimation) {
      setActiveGiftAnimation({
        id: `ext_gift_${Date.now()}`,
        gift: activeGiftBanner.gift,
        senderName: activeGiftBanner.sender,
        recipientName: activeGiftBanner.recipient,
        comboCount: 1,
        quantity: 1,
        timestamp: Date.now(),
      });
      clearActiveGiftBanner();
    }
  }, [activeGiftBanner, activeGiftAnimation, clearActiveGiftBanner]);

  // Enhanced Virtual Gift Sending Handler with Combos & Visual Animations
  const handleSendSelectedGift = (customMultiplier?: number) => {
    const qty = customMultiplier || giftQuantityMultiplier;
    const requiredCoins = selectedGift.coins * qty;

    if (coins < requiredCoins) {
      showToast(
        `Insufficient coins! You need ${requiredCoins.toLocaleString()} coins for ${qty}x ${selectedGift.name}. Recharge in Wallet 💰`
      );
      return;
    }

    const recipientId = giftRecipientUser ? giftRecipientUser.id : (activeStream?.host.id || 'host_01');
    const recipientName = giftRecipientUser
      ? giftRecipientUser.displayName
      : (activeStream?.host.displayName || 'Host');

    // Deduct coins & record via AppContext
    sendLiveGift(selectedGift, recipientId);

    // Calculate Combo Streaks (reset if > 4.2 seconds between sends)
    const now = Date.now();
    let nextCombo = 1;
    if (lastSentGiftId === selectedGift.id && now - lastGiftSentTime < 4200) {
      nextCombo = giftComboCount + 1;
    }
    setGiftComboCount(nextCombo);
    setLastSentGiftId(selectedGift.id);
    setLastGiftSentTime(now);

    // Trigger Spectacular Screen Takeover Animation
    setActiveGiftAnimation({
      id: `gift_anim_${now}_${Math.random()}`,
      gift: selectedGift,
      senderName: currentUser.displayName,
      senderAvatar: currentUser.avatar,
      senderVipTier: currentUser.vipTier || 1,
      recipientName,
      comboCount: nextCombo,
      quantity: qty,
      timestamp: now,
    });

    // Add Highlighted Gift Notification into Live Chat Stream
    setComments((prev) => [
      ...prev,
      {
        id: `gift_msg_${now}`,
        user: currentUser.displayName,
        text: `sent ${selectedGift.name} ${qty > 1 ? `x${qty} ` : ''}to ${recipientName}! ${selectedGift.icon} (+${requiredCoins.toLocaleString()} 💰)`,
        vipLevel: currentUser.vipTier,
        isGiftHighlight: true,
      },
    ]);

    // Spawn floating celebration hearts
    spawnHeart();
    spawnHeart();

    // Dynamically update Session Top Givers Leaderboard
    setSessionGivers((prev) => {
      const existingIdx = prev.findIndex((g) => g.user.id === currentUser.id);
      let updated: SessionGiver[];
      if (existingIdx !== -1) {
        updated = prev.map((g, idx) =>
          idx === existingIdx
            ? {
                ...g,
                totalCoins: g.totalCoins + requiredCoins,
                giftCount: g.giftCount + qty,
                lastGiftName: selectedGift.name,
                lastGiftIcon: selectedGift.icon,
              }
            : g
        );
      } else {
        updated = [
          ...prev,
          {
            user: currentUser,
            totalCoins: requiredCoins,
            giftCount: qty,
            lastGiftName: selectedGift.name,
            lastGiftIcon: selectedGift.icon,
          },
        ];
      }
      return updated.sort((a, b) => b.totalCoins - a.totalCoins);
    });

    showToast(
      `Sent ${qty > 1 ? `${qty}x ` : ''}${selectedGift.name} to ${recipientName}! ${selectedGift.icon} ${
        nextCombo > 1 ? `(Combo x${nextCombo} 🔥)` : ''
      }`
    );
  };

  // Share broadcast handler
  const handleShareBroadcast = async () => {
    const url = window.location.href;
    const copied = await copyToClipboard(url);
    if (copied) {
      showToast('Live stream link copied to clipboard! 🔗');
    }
    setShowShareModal(true);
  };

  if (!activeStream) return null;

  // Host metadata
  const hostVipTier = activeStream.host.vipTier || 6;
  const hostLevel = activeStream.host.level || 42;

  return (
    <div
      onDoubleClick={(e) => {
        if (activeRole === 'viewer' && remoteVideoRef.current) {
          remoteVideoRef.current.play().catch(() => {});
        }
        spawnHeart(e.clientX, e.clientY);
        spawnHeart(e.clientX + 10, e.clientY - 20);
      }}
      onTouchStart={handleScreenTouchOrClick}
      className="relative w-full h-full h-[100dvh] max-h-[100dvh] bg-black text-white overflow-hidden flex flex-col justify-between select-none"
    >
      {/* Toast Alert Feedback */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-[#180E2C]/95 border border-[#A855F7]/40 text-white text-xs font-bold shadow-2xl backdrop-blur-md flex items-center gap-2 animate-bounce pointer-events-none">
          <Sparkles className="w-3.5 h-3.5 text-[#EC4899]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* =========================================================================
          BROADCAST BACKGROUND LAYER:
          - CAMERA ON: Real-time Camera Video (Host local preview OR Viewer remote stream)
          - CAMERA OFF: Host Profile Picture (DP) as FULLSCREEN Background (Cover/Center Crop)
         ========================================================================= */}
      <div className="absolute inset-0 z-0 bg-[#0A0614] overflow-hidden">
        {isCameraActive ? (
          <div className="relative w-full h-full">
            {activeRole === 'host' ? (
              <video
                ref={hostVideoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover transition-all duration-300 ${
                  facingMode === 'user' ? 'scale-x-[-1]' : 'scale-x-100'
                }`}
                style={{
                  filter: currentPreset.cssFilter(filterIntensity),
                }}
              />
            ) : (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                muted={isRemoteAudioMuted}
                className="w-full h-full object-cover"
              />
            )}
            {/* Ambient dynamic pulsing video aura */}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-black/60 pointer-events-none" />
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-[#7928CA]/20 blur-[120px] pointer-events-none" />
          </div>
        ) : (
          /* =====================================================================
             HOST CAMERA OFF – FULLSCREEN PROFILE BACKGROUND
             - Host's profile picture covers 100% of the live video area (object-cover)
             - Subtle dark transparent gradient ensures readability of comments & controls
             - NO small circular DP in center
             - Works for any host
             ===================================================================== */
          <div className="relative w-full h-full overflow-hidden bg-[#0A0614]">
            {/* Fullscreen Host Profile Picture (DP) */}
            <img
              src={activeStream.host.avatar}
              alt={activeStream.host.displayName}
              className="w-full h-full object-cover object-center select-none"
            />

            {/* Subtle dark gradient overlay to ensure comments and controls remain crisp & readable */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/25 to-black/80 pointer-events-none" />

            {/* Subtle Off-Camera Indicator Badge */}
            <div className="absolute top-20 left-4 z-10 px-3 py-1.5 rounded-full bg-black/65 backdrop-blur-md border border-white/10 text-white text-[11px] font-semibold flex items-center gap-1.5 pointer-events-none shadow-lg">
              <VideoOff className="w-3.5 h-3.5 text-rose-400" />
              <span>Host Camera is Off</span>
            </div>

            {/* In viewer mode, keep remote audio stream element attached so audio continues uninterrupted */}
            {activeRole === 'viewer' && (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                muted={isRemoteAudioMuted}
                className="hidden"
              />
            )}
          </div>
        )}
      </div>

      {/* Floating Microphone Muted Indicator (Host or Viewer perspective) */}
      {!isMicActive && (
        <div className="absolute top-20 right-4 z-30 px-3 py-1 rounded-full bg-rose-600/90 text-white text-[11px] font-black flex items-center gap-1.5 shadow-lg border border-rose-400/40 animate-pulse">
          <MicOff className="w-3.5 h-3.5" />
          <span>{activeRole === 'host' ? 'Microphone Muted 🔇' : 'Host is Muted 🔇'}</span>
        </div>
      )}

      {/* Floating Animated Hearts Area */}
      <div className="absolute right-6 bottom-28 z-20 pointer-events-none w-20 h-56 flex flex-col items-center justify-end">
        {hearts.map((heart) => (
          <div
            key={heart.id}
            className="absolute animate-float-heart"
            style={{
              transform: `translateX(${heart.x}px)`,
              color: heart.color,
            }}
          >
            <Heart className="w-7 h-7 fill-current drop-shadow-[0_0_8px_currentColor]" />
          </div>
        ))}
      </div>

      {/* Full-Screen Visual Animations & Spectacular Takeover for Virtual Gifts */}
      <GiftAnimationOverlay
        currentEvent={activeGiftAnimation}
        onComplete={() => setActiveGiftAnimation(null)}
      />

      {/* Top Overlay Bar: Host Profile, Level, VIP, Follow, Viewer Count, Perspective Switcher, Close */}
      <div className="relative z-30 pt-[calc(env(safe-area-inset-top,0px)+10px)] px-2 sm:px-3 shrink-0 flex items-start justify-between gap-1.5 pointer-events-none">
        {/* Left Column: Host Capsule on top + Top Givers Leaderboard line directly underneath it */}
        <div className="flex flex-col items-start gap-1 min-w-0 max-w-[62%] pointer-events-auto">
          {/* Host Capsule with VIP Avatar Frame, Name, Level & VIP */}
          <div
            onClick={() => {
              if (activeRole === 'viewer') {
                setSelectedUserForActionSheet(activeStream.host);
                setShowUserActionSheet(true);
              }
            }}
            className={`flex items-center gap-1.5 p-1 pl-1.5 pr-2 rounded-full bg-black/65 backdrop-blur-md border border-white/10 shadow-lg min-w-0 max-w-full ${
              activeRole === 'viewer' ? 'cursor-pointer hover:border-[#A855F7]/40' : ''
            }`}
          >
            <VipAvatarFrame
              avatarUrl={activeStream.host.avatar}
              vipTier={hostVipTier}
              size="sm"
              showCrownBadge={true}
            />
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1">
                <span className="text-xs font-black text-white truncate max-w-[65px] sm:max-w-[85px]">
                  {activeStream.host.displayName}
                </span>
                <LevelBadgeIcon level={hostLevel} size="xs" className="shrink-0" />
                <span className="hidden xs:inline px-1 py-0.2 rounded bg-[#7928CA]/30 text-[#C084FC] text-[8px] font-black shrink-0">
                  VIP {hostVipTier}
                </span>
              </div>
              <div className="flex items-center gap-1 text-[9px] text-zinc-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>{formatTime(durationSecs)}</span>
              </div>
            </div>

            {/* Follow Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsFollowing(!isFollowing);
              }}
              className={`ml-0.5 px-2 py-0.5 rounded-full text-[9px] font-bold transition-all cursor-pointer shrink-0 ${
                isFollowing
                  ? 'bg-zinc-700 text-zinc-300'
                  : 'bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white shadow-sm'
              }`}
            >
              {isFollowing ? 'Following' : '+ Follow'}
            </button>
          </div>

          {/* Top Givers Leaderboard Line (Directly Below Host Name on Left) */}
          <TopGiversLeaderboard
            givers={sessionGivers}
            currentUser={currentUser}
            onSelectUser={(targetUser) => {
              setSelectedUserForActionSheet(targetUser);
              setShowUserActionSheet(true);
            }}
            onOpenGiftDrawer={() => setShowGiftDrawer(true)}
          />
        </div>

        {/* Right Top Actions: Viewer Count, Perspective Switcher (Host <-> Viewer), Close */}
        <div className="flex items-center gap-1 shrink-0 pointer-events-auto">
          {/* Audience Rush / Viewers Count */}
          <button
            onClick={() => setShowViewersModal(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/65 backdrop-blur-md border border-white/10 hover:border-[#A855F7]/40 text-[10px] font-bold text-zinc-200 hover:text-white cursor-pointer transition-all"
            title="View Live Audience"
          >
            <Users className="w-3 h-3 text-[#C084FC]" />
            <span>{viewerCount.toLocaleString()}</span>
          </button>

          {/* Perspective Tester Toggle (Host Mode <-> Viewer Mode) */}
          <button
            onClick={handleToggleRolePerspective}
            className="px-1.5 py-1 rounded-full bg-[#180E2C]/90 border border-[#A855F7]/40 text-[9px] font-bold text-[#C084FC] hover:text-white transition-colors cursor-pointer flex items-center gap-0.5"
            title="Toggle between Host Controls and Viewer Mode"
          >
            {activeRole === 'host' ? <Radio className="w-3 h-3 text-emerald-400" /> : <Eye className="w-3 h-3 text-cyan-400" />}
            <span className="hidden xs:inline">{activeRole === 'host' ? 'Host' : 'Viewer'}</span>
          </button>

          {/* Close Live Button */}
          <button
            onClick={closeLiveStream}
            className="w-7 h-7 rounded-full bg-black/65 backdrop-blur-md border border-white/10 flex items-center justify-center text-zinc-300 hover:text-white cursor-pointer"
            title="Leave Stream"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Bottom Live Stream Section: Comments Feed + Bottom Controls HUD (Tight Mobile Fit) */}
      <div className="relative z-30 px-2.5 pb-[calc(env(safe-area-inset-bottom,0px)+8px)] shrink-0 flex flex-col justify-end pointer-events-auto">
        {/* Live Chat Comments Header with Clear Chat for Host & Mod */}
        <div className="flex items-center justify-between mb-1 px-1">
          <span className="text-[9.5px] text-purple-200 font-bold flex items-center gap-1">
            💬 Live Chat Feed
          </span>
          {canModerate && (
            <button
              onClick={handleClearChat}
              className="flex items-center gap-1 text-[8px] font-bold text-rose-300 hover:text-white px-1.5 py-0.5 rounded-full bg-rose-950/60 border border-rose-500/30 cursor-pointer transition-colors"
              title="Clear Comment History"
            >
              <Trash2 className="w-2.5 h-2.5 text-rose-400" />
              <span>Clear Chat</span>
            </button>
          )}
        </div>

        {/* Live Chat Comments Stream — Compact height strictly preventing viewport spill */}
        <div className="max-h-24 sm:max-h-28 overflow-y-auto space-y-1 pr-1.5 mb-1.5 scrollbar-none pointer-events-auto">
          <div className="inline-block px-2.5 py-0.5 rounded-xl bg-purple-900/60 backdrop-blur-md border border-[#A855F7]/30 text-[10px] text-purple-200 font-medium">
            👋 Welcome to Alpha Mate Live! Tap any comment to view profile & actions! 💜
          </div>

          {comments.map((msg) => (
            <div
              key={msg.id}
              onClick={() => handleCommentClick(msg)}
              className={`inline-flex items-center gap-1.5 max-w-[95%] px-2.5 py-1 rounded-xl backdrop-blur-md border text-[11px] text-white shadow-sm cursor-pointer transition-all ${
                msg.isGiftHighlight
                  ? 'bg-gradient-to-r from-amber-500/25 via-pink-500/20 to-purple-600/30 border-amber-400/60 shadow-[0_0_12px_rgba(251,191,36,0.3)] animate-pulse'
                  : msg.isEntryNotice
                  ? 'bg-gradient-to-r from-purple-950/70 to-pink-950/60 border-purple-400/40 text-amber-200'
                  : 'bg-black/55 border-white/5 hover:border-[#A855F7]/40 hover:bg-black/75'
              }`}
              title="Tap to view user profile & controls"
            >
              {/* Level Badge Icon */}
              <LevelBadgeIcon
                level={msg.level ?? (msg.vipLevel ? msg.vipLevel * 8 : 12)}
                size="xs"
                className="shrink-0"
              />

              {msg.isGiftHighlight ? (
                <span className="px-1 py-0.2 rounded bg-gradient-to-r from-amber-400 to-pink-500 text-black text-[8px] font-black uppercase shadow">
                  🎁 GIFT
                </span>
              ) : msg.vipLevel && msg.vipLevel > 0 ? (
                <span className="px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[8px] font-bold uppercase border border-amber-500/40">
                  VIP {msg.vipLevel}
                </span>
              ) : null}

              <span
                className={`font-black shrink-0 ${
                  msg.isGiftHighlight
                    ? 'text-amber-300'
                    : msg.isEntryNotice
                    ? 'text-amber-200'
                    : 'text-[#C084FC]'
                }`}
              >
                {msg.user}:
              </span>
              <span
                className={`break-words ${
                  msg.isGiftHighlight ? 'text-white font-semibold' : 'text-zinc-200'
                }`}
              >
                {msg.text}
              </span>
            </div>
          ))}
          <div ref={commentsEndRef} />
        </div>

        {/* =========================================================================
            BOTTOM CONTROLS HUD — STRICT HOST VS VIEWER DIFFERENTIATION
           ========================================================================= */}
        {activeRole === 'viewer' ? (
          /* VIEWER BOTTOM BAR: Share, Volume, Comment Input, Gift Box */
          <div className="flex items-center gap-1.5">
            {/* 1. Share Broadcast */}
            <button
              onClick={handleShareBroadcast}
              className="w-8.5 h-8.5 rounded-full bg-black/60 backdrop-blur-md border border-white/15 flex items-center justify-center text-zinc-300 hover:text-white active:scale-95 transition-all cursor-pointer shrink-0"
              title="Share Broadcast"
            >
              <Share2 className="w-4 h-4 text-zinc-200" />
            </button>

            {/* Remote Audio Volume Toggle for Viewer */}
            <button
              onClick={() => {
                const nextMute = !isRemoteAudioMuted;
                setIsRemoteAudioMuted(nextMute);
                showToast(nextMute ? 'Host Audio Muted 🔇' : 'Host Audio Playing 🔊');
              }}
              className={`w-8.5 h-8.5 rounded-full backdrop-blur-md border flex items-center justify-center active:scale-95 transition-all cursor-pointer shrink-0 ${
                isRemoteAudioMuted
                  ? 'bg-rose-950/80 border-rose-500/50 text-rose-300'
                  : 'bg-black/60 border-white/15 text-zinc-200 hover:text-white'
              }`}
              title={isRemoteAudioMuted ? 'Unmute Host Audio' : 'Mute Host Audio'}
            >
              {isRemoteAudioMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-[#C084FC]" />}
            </button>

            {/* 2. Send Comment */}
            <form onSubmit={handleSendComment} className="flex-1 flex items-center relative">
              <input
                type="text"
                placeholder="Say something nice..."
                value={inputComment}
                onChange={(e) => setInputComment(e.target.value)}
                className="w-full h-8.5 pl-3 pr-8 rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-white placeholder-zinc-400 text-xs focus:outline-none focus:border-[#A855F7]"
              />
              <button
                type="submit"
                className="absolute right-1 w-6.5 h-6.5 rounded-full bg-[#7928CA] flex items-center justify-center text-white hover:bg-[#A855F7] transition-colors cursor-pointer"
              >
                <Send className="w-3 h-3" />
              </button>
            </form>

            {/* 3. Lucky Draw Mini-Game Button */}
            <button
              onClick={() => setShowLuckyDrawModal(true)}
              className="w-8.5 h-8.5 rounded-full bg-gradient-to-tr from-amber-400 via-[#EC4899] to-[#7928CA] p-[1.5px] shadow-lg shadow-amber-500/40 active:scale-95 transition-transform cursor-pointer shrink-0"
              title="Lucky Draw Wheel"
            >
              <div className="w-full h-full rounded-full bg-[#1A0D30] flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-amber-300 animate-spin-slow" />
              </div>
            </button>

            {/* 4. Gift Box Button */}
            <button
              onClick={() => setShowGiftDrawer(true)}
              className="w-8.5 h-8.5 rounded-full bg-gradient-to-tr from-[#7928CA] via-[#EC4899] to-[#F59E0B] p-[1.5px] shadow-lg shadow-[#EC4899]/40 active:scale-95 transition-transform cursor-pointer shrink-0"
              title="Gift Box"
            >
              <div className="w-full h-full rounded-full bg-[#180E2B] flex items-center justify-center">
                <GiftIcon className="w-4 h-4 text-amber-300 animate-pulse" />
              </div>
            </button>
          </div>
        ) : (
          /* HOST BOTTOM BAR: Comment input + 6 Direct Compact Action Buttons */
          <div className="flex flex-col gap-1.5">
            {/* Top row: Comment input */}
            <form onSubmit={handleSendComment} className="w-full flex items-center relative">
              <input
                type="text"
                placeholder="Chat with your audience as Host..."
                value={inputComment}
                onChange={(e) => setInputComment(e.target.value)}
                className="w-full h-8 pl-3 pr-8 rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-white placeholder-zinc-400 text-xs focus:outline-none focus:border-[#A855F7]"
              />
              <button
                type="submit"
                className="absolute right-1 w-6 h-6 rounded-full bg-[#7928CA] flex items-center justify-center text-white hover:bg-[#A855F7] transition-colors cursor-pointer"
              >
                <Send className="w-2.5 h-2.5" />
              </button>
            </form>

            {/* Bottom Row: 6 Direct Host Action Buttons — Compact & Mobile-fitting */}
            <div className="grid grid-cols-6 gap-1 w-full">
              {/* 1. Camera Color Grading Filter Button */}
              <button
                onClick={() => setShowFilterDrawer(true)}
                className={`h-8.5 rounded-lg border flex flex-col items-center justify-center p-0.5 transition-all cursor-pointer min-w-0 ${
                  activeFilterPreset !== 'normal'
                    ? 'bg-gradient-to-tr from-[#7928CA] to-[#EC4899] border-[#EC4899] text-white shadow-md'
                    : 'bg-black/65 backdrop-blur-md border-white/15 text-zinc-300 hover:text-white'
                }`}
                title="Filters"
              >
                <Wand2 className="w-3 h-3 text-[#EC4899]" />
                <span className="text-[7.5px] font-bold tracking-tight truncate max-w-full">Filter</span>
              </button>

              {/* 2. Cam On / Off Toggle Button */}
              <button
                onClick={handleToggleHostVideo}
                className={`h-8.5 rounded-lg border flex flex-col items-center justify-center p-0.5 transition-all cursor-pointer min-w-0 ${
                  isHostVideoOn
                    ? 'bg-black/65 backdrop-blur-md border-white/15 text-white'
                    : 'bg-rose-950/80 border-rose-500/50 text-rose-300'
                }`}
                title="Toggle Video Camera"
              >
                {isHostVideoOn ? <Video className="w-3 h-3 text-emerald-400" /> : <VideoOff className="w-3 h-3 text-rose-400" />}
                <span className="text-[7.5px] font-bold tracking-tight truncate max-w-full">{isHostVideoOn ? 'Cam' : 'Off'}</span>
              </button>

              {/* 3. Mic On / Off Toggle Button */}
              <button
                onClick={handleToggleHostMic}
                className={`h-8.5 rounded-lg border flex flex-col items-center justify-center p-0.5 transition-all cursor-pointer min-w-0 ${
                  isHostMicOn
                    ? 'bg-black/65 backdrop-blur-md border-white/15 text-white'
                    : 'bg-rose-950/80 border-rose-500/50 text-rose-300'
                }`}
                title="Toggle Microphone"
              >
                {isHostMicOn ? <Mic className="w-3 h-3 text-emerald-400" /> : <MicOff className="w-3 h-3 text-rose-400" />}
                <span className="text-[7.5px] font-bold tracking-tight truncate max-w-full">{isHostMicOn ? 'Mic' : 'Muted'}</span>
              </button>

              {/* 4. Rotate / Flip Cam Button */}
              <button
                onClick={handleFlipCamera}
                className="h-8.5 rounded-lg bg-black/65 backdrop-blur-md border border-white/15 flex flex-col items-center justify-center p-0.5 text-zinc-200 hover:text-white active:scale-95 transition-all cursor-pointer min-w-0"
                title="Rotate / Flip Camera"
              >
                <RotateCcw className="w-3 h-3 text-[#C084FC]" />
                <span className="text-[7.5px] font-bold tracking-tight truncate max-w-full">Rotate</span>
              </button>

              {/* 5. Share Broadcast Button */}
              <button
                onClick={handleShareBroadcast}
                className="h-8.5 rounded-lg bg-black/65 backdrop-blur-md border border-white/15 flex flex-col items-center justify-center p-0.5 text-zinc-200 hover:text-white active:scale-95 transition-all cursor-pointer min-w-0"
                title="Share Broadcast"
              >
                <Share2 className="w-3 h-3 text-amber-300" />
                <span className="text-[7.5px] font-bold tracking-tight truncate max-w-full">Share</span>
              </button>

              {/* 6. Settings Button */}
              <button
                onClick={() => setShowSettingsModal(true)}
                className="h-8.5 rounded-lg bg-black/65 backdrop-blur-md border border-white/15 flex flex-col items-center justify-center p-0.5 text-zinc-200 hover:text-white active:scale-95 transition-all cursor-pointer min-w-0"
                title="Settings"
              >
                <Settings className="w-3 h-3 text-zinc-300" />
                <span className="text-[7.5px] font-bold tracking-tight truncate max-w-full">Config</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Virtual Gifts Drawer Modal with Multipliers and Rapid Combos */}
      {showGiftDrawer && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex flex-col justify-end animate-fade-in">
          <div className="w-full max-w-md mx-auto rounded-t-3xl bg-[#140C26] border-t border-[#A855F7]/30 p-4 pb-6 shadow-2xl animate-slide-up">
            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#A855F7]/20">
              <div className="flex items-center gap-2">
                <GiftIcon className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-black text-white">Send Virtual Gift</span>
                {giftRecipientUser ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-900/60 border border-purple-500/40 text-purple-200 truncate max-w-[110px]">
                    To: {giftRecipientUser.displayName}
                  </span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300">
                    To Host 👑
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/60 border border-amber-400/30">
                  <span className="text-xs text-amber-400 font-black">
                    💰 {coins.toLocaleString()}
                  </span>
                </div>
                <button
                  onClick={() => {
                    setShowGiftDrawer(false);
                    setShowLuckyDrawModal(true);
                  }}
                  className="px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-400 to-[#EC4899] text-black font-black text-[10px] hover:brightness-110 active:scale-95 transition-all cursor-pointer shadow flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3 text-amber-950" />
                  <span>Lucky Draw</span>
                </button>
                <button
                  onClick={() => setCurrentScreen('wallet')}
                  className="px-2 py-1 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-zinc-200 text-[10px] font-bold active:scale-95 transition-all cursor-pointer shadow"
                >
                  + Recharge
                </button>
                <button
                  onClick={() => {
                    setShowGiftDrawer(false);
                    setGiftRecipientUser(null);
                  }}
                  className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white flex items-center justify-center cursor-pointer transition-all ml-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Gift Grid */}
            <div className="grid grid-cols-4 gap-2 py-3.5 max-h-64 overflow-y-auto">
              {VIRTUAL_GIFTS.map((g) => {
                const isSelected = selectedGift.id === g.id;
                const isMythic = g.coins >= 19999;
                const isEpic = g.coins >= 1999 && !isMythic;
                return (
                  <div
                    key={g.id}
                    onClick={() => setSelectedGift(g)}
                    className={`relative rounded-2xl p-2.5 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-gradient-to-b from-[#7928CA]/50 to-[#EC4899]/40 border-2 border-[#EC4899] shadow-[0_0_20px_rgba(236,72,153,0.4)] scale-105'
                        : 'bg-[#1C1236] border border-white/5 hover:border-white/20'
                    }`}
                  >
                    {isMythic && (
                      <span className="absolute -top-1.5 -right-1 px-1 rounded bg-gradient-to-r from-red-600 to-amber-500 text-[7px] font-black text-white shadow">
                        MYTHIC
                      </span>
                    )}
                    {isEpic && (
                      <span className="absolute -top-1.5 -right-1 px-1 rounded bg-gradient-to-r from-purple-600 to-pink-500 text-[7px] font-black text-white shadow">
                        VIP
                      </span>
                    )}
                    <span className="text-2xl mb-1 drop-shadow">{g.icon}</span>
                    <span className="text-[10.5px] font-bold text-white truncate max-w-full">
                      {g.name}
                    </span>
                    <span className="text-[10px] text-amber-300 font-extrabold mt-0.5 flex items-center gap-0.5">
                      <span>{g.coins.toLocaleString()}</span>
                      <span className="text-[9px]">💰</span>
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Quantity Multiplier Selector Bar */}
            <div className="pt-2 pb-2.5 border-t border-[#A855F7]/15 flex items-center justify-between gap-1.5">
              <span className="text-[11px] font-bold text-zinc-400 shrink-0">Quantity:</span>
              <div className="flex items-center gap-1 overflow-x-auto py-0.5">
                {[1, 5, 10, 66, 99, 188, 520].map((num) => {
                  const isActive = giftQuantityMultiplier === num;
                  return (
                    <button
                      key={num}
                      onClick={() => setGiftQuantityMultiplier(num)}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-black transition-all cursor-pointer shrink-0 ${
                        isActive
                          ? 'bg-gradient-to-r from-amber-400 to-pink-500 text-black shadow-md'
                          : 'bg-[#221642] text-zinc-300 hover:text-white border border-white/5'
                      }`}
                    >
                      x{num}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected Gift Footer with Send & Combo Button */}
            <div className="flex items-center justify-between pt-2 border-t border-[#A855F7]/15 gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-2xl shrink-0 drop-shadow">{selectedGift.icon}</span>
                <div className="min-w-0">
                  <div className="text-xs font-black text-white truncate">
                    {selectedGift.name}
                    {giftQuantityMultiplier > 1 && (
                      <span className="ml-1 text-pink-400">x{giftQuantityMultiplier}</span>
                    )}
                  </div>
                  <div className="text-[10px] text-amber-300 font-bold">
                    Total: {(selectedGift.coins * giftQuantityMultiplier).toLocaleString()} Coins
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {giftComboCount > 1 && (
                  <div className="flex items-center gap-1 px-2 py-1 rounded-xl bg-red-950/80 border border-red-500/50 text-red-300 text-[10px] font-black animate-pulse">
                    <Flame className="w-3 h-3 text-red-400" />
                    <span>Streak x{giftComboCount}</span>
                  </div>
                )}
                <button
                  onClick={() => handleSendSelectedGift()}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#7928CA] via-[#9333EA] to-[#EC4899] text-white font-black text-xs shadow-lg shadow-[#7928CA]/50 hover:brightness-110 active:scale-90 transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                >
                  <span>Send</span>
                  <span className="text-[10px] opacity-90">
                    ({(selectedGift.coins * giftQuantityMultiplier).toLocaleString()} 💰)
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Share Broadcast Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-[#171030] border border-[#A855F7]/30 p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Share2 className="w-4 h-4 text-amber-400" />
                <span>Share Broadcast</span>
              </h3>
              <button onClick={() => setShowShareModal(false)} className="text-zinc-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-zinc-300 mb-4">
              Invite friends to watch <span className="font-bold text-white">{activeStream.host.displayName}</span>'s live stream!
            </p>

            <div className="grid grid-cols-4 gap-3 mb-4">
              {[
                { name: 'Copy Link', icon: '🔗', action: () => { copyToClipboard(window.location.href); showToast('Link copied! 📋'); } },
                { name: 'WhatsApp', icon: '💬', action: () => { window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(`Watch ${activeStream.host.displayName} live on Alpha Mate!`)}`, '_blank'); } },
                { name: 'Telegram', icon: '✈️', action: () => { window.open(`https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent('Live on Alpha Mate!')}`, '_blank'); } },
                { name: 'Twitter/X', icon: '🐦', action: () => { window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent('Live on Alpha Mate!')}&url=${encodeURIComponent(window.location.href)}`, '_blank'); } },
              ].map((item) => (
                <button
                  key={item.name}
                  onClick={item.action}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl bg-[#120924] border border-white/5 hover:border-[#A855F7]/40 transition-all cursor-pointer"
                >
                  <span className="text-2xl mb-1">{item.icon}</span>
                  <span className="text-[10px] font-semibold text-zinc-300">{item.name}</span>
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowShareModal(false)}
              className="w-full h-10 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold hover:text-white cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Host Stream Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-[#171030] border border-[#A855F7]/30 p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Settings className="w-4 h-4 text-[#A855F7]" />
                <span>Stream Settings</span>
              </h3>
              <button onClick={() => setShowSettingsModal(false)} className="text-zinc-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 mb-4">
              {/* Camera Direction */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#110A22]">
                <div className="flex items-center gap-2 text-xs text-white">
                  <FlipHorizontal className="w-4 h-4 text-[#A855F7]" />
                  <span>Camera Direction</span>
                </div>
                <button
                  onClick={handleFlipCamera}
                  className="px-3 py-1 rounded-lg bg-[#7928CA]/30 border border-[#A855F7]/40 text-xs font-bold text-[#C084FC]"
                >
                  {facingMode === 'user' ? 'Front' : 'Rear'}
                </button>
              </div>

              {/* Video Resolution */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#110A22]">
                <span className="text-xs text-white">Stream Quality</span>
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30">
                  1080p 60FPS
                </span>
              </div>

              {/* Audio Noise Suppression */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#110A22]">
                <span className="text-xs text-white">AI Noise Cancellation</span>
                <span className="px-2.5 py-1 rounded-lg bg-purple-500/20 text-purple-300 text-xs font-bold border border-purple-500/30">
                  Active
                </span>
              </div>
            </div>

            <button
              onClick={() => setShowSettingsModal(false)}
              className="w-full h-10 rounded-xl bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white text-xs font-bold cursor-pointer"
            >
              Save & Return
            </button>
          </div>
        </div>
      )}

      {/* Camera Filter Overlay & Color Grading Drawer */}
      <CameraFilterOverlay
        activePresetId={activeFilterPreset}
        intensity={filterIntensity}
        isOverlayOpen={showFilterDrawer}
        onSelectPreset={(presetId) => setActiveFilterPreset(presetId)}
        onChangeIntensity={(val) => setFilterIntensity(val)}
        onClose={() => setShowFilterDrawer(false)}
      />

      {/* Master User Action Sheet Modal for Viewers & Comments */}
      {selectedUserForActionSheet && (
        <UserActionSheetModal
          isOpen={showUserActionSheet}
          onClose={() => {
            setShowUserActionSheet(false);
            setSelectedUserForActionSheet(null);
          }}
          user={selectedUserForActionSheet}
          isViewerHost={isHost}
          isViewerModerator={isModerator}
          hostUser={activeStream.host}
          moderatorIds={moderatorIds}
          onToggleModerator={handleToggleModerator}
          onKickUser={handleKickUser}
          onBlockUser={handleBlockUser}
          onSendGift={(target) => {
            setGiftRecipientUser(target);
            setShowGiftDrawer(true);
          }}
          onDirectMessage={(target) => {
            startDirectMessage(target);
          }}
          onVisitProfile={(target) => {
            showToast(`Visiting ${target.displayName}'s profile... 🌟`);
            setCurrentScreen('profile');
          }}
          isFollowing={followingUserIds.has(selectedUserForActionSheet.id)}
          onToggleFollow={handleToggleFollowUser}
          currentUserId={currentUser.id}
        />
      )}

      {/* Master Room Viewers List Modal */}
      <RoomViewersModal
        isOpen={showViewersModal}
        onClose={() => setShowViewersModal(false)}
        viewers={MOCK_ROOM_VIEWERS}
        hostUser={activeStream.host}
        moderatorIds={moderatorIds}
        totalViewerCount={viewerCount}
        isPartyRoom={false}
        canInviteToSeat={false}
        onSelectUser={(viewer) => {
          setShowViewersModal(false);
          setSelectedUserForActionSheet(viewer);
          setShowUserActionSheet(true);
        }}
      />

      {/* Lucky Draw Mini-Game Modal */}
      <LuckyDrawModal
        isOpen={showLuckyDrawModal}
        onClose={() => setShowLuckyDrawModal(false)}
        userCoins={coins}
        hostName={activeStream.host.displayName}
        onWinCoins={(amount, rewardName) => {
          addCoins(amount, `Lucky Draw: Won ${rewardName} (${amount} Coins)`);
          showToast(`Won ${amount.toLocaleString()} Coins from Lucky Draw! 🪙✨`);

          // Insert congratulatory comment in chat
          setComments((prev) => [
            ...prev,
            {
              id: `comment_luck_${Date.now()}`,
              user: currentUser.displayName,
              text: `🎉 Won ${amount.toLocaleString()} Coins in Lucky Draw!`,
              vipLevel: currentUser.vipTier,
              isGiftHighlight: true,
            },
          ]);
        }}
        onSendBonusGiftToHost={(coinsWon) => {
          const halfCoins = Math.floor(coinsWon / 2);
          if (halfCoins > 0) {
            // Send bonus gift
            const bonusGift: Gift = {
              id: `gift_lucky_${Date.now()}`,
              name: 'Lucky Share',
              icon: '🍀',
              coins: halfCoins,
              animationType: 'sparkle',
              description: `Lucky Draw Prize Shared with ${activeStream.host.displayName}!`,
            };
            sendLiveGift(bonusGift, activeStream.host.id);
            showToast(`Sent ${halfCoins.toLocaleString()} Lucky Bonus Coins to ${activeStream.host.displayName}! 🎁`);
          }
        }}
      />
    </div>
  );
};
