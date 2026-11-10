import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { AlphaMateLogo } from '../brand/AlphaMateLogo';
import { copyToClipboard } from '../../utils/clipboard';
import {
  X,
  Share2,
  Copy,
  Check,
  Send,
  MessageSquare,
  Crown,
  ExternalLink,
  Sparkles,
  QrCode,
} from 'lucide-react';

interface ShareProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShareProfileModal: React.FC<ShareProfileModalProps> = ({ isOpen, onClose }) => {
  const { currentUser, conversations, sendMessage } = useApp();

  const [copiedLink, setCopiedLink] = useState(false);
  const [sentInAppTo, setSentInAppTo] = useState<string[]>([]);
  const [showQrCode, setShowQrCode] = useState(false);

  if (!isOpen) return null;

  const profileUrl = `https://alphamate.app/@${currentUser.username}`;
  const shareText = `🌟 Check out ${currentUser.displayName}'s profile on Alpha Mate! Watch live streams, join 8-seat audio lounges & battle together: ${profileUrl}`;

  // 1. Copy Link
  const handleCopyLink = async () => {
    await copyToClipboard(profileUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // 2. WhatsApp Direct Share
  const handleShareWhatsApp = () => {
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
    window.open(waUrl, '_blank');
  };

  // 3. Native Web Share API (Instagram, Twitter, Telegram, Discord, etc.)
  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${currentUser.displayName} on Alpha Mate`,
          text: shareText,
          url: profileUrl,
        });
      } catch {
        // User cancelled or error
      }
    } else {
      handleCopyLink();
    }
  };

  // 4. In-App Sharing to Inbox / Conversations
  const handleShareToConversation = (convId: string, convName: string) => {
    if (sentInAppTo.includes(convId)) return;

    sendMessage(
      convId,
      `👋 Check out my Alpha Mate profile: @${currentUser.username}! Follow me here: ${profileUrl}`
    );

    setSentInAppTo((prev) => [...prev, convId]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-sm rounded-3xl bg-[#140D27] border-2 border-[#A855F7]/40 p-5 shadow-2xl shadow-purple-900/60 overflow-hidden text-white animate-scale-up">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-zinc-300 hover:text-white transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="text-center pb-3 border-b border-[#A855F7]/20">
          <h2 className="text-xl font-black text-white tracking-tight flex items-center justify-center gap-2">
            <span>Share Profile</span>
            <Share2 className="w-4 h-4 text-pink-400" />
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">Invite fans & friends to follow you on Alpha Mate</p>
        </div>

        {/* Profile Card Preview */}
        <div className="my-3.5 p-3.5 rounded-2xl bg-gradient-to-r from-[#20123D] via-[#1B1033] to-[#140B28] border border-[#A855F7]/30 shadow-inner flex items-center gap-3">
          <div className="relative shrink-0">
            <div className="w-13 h-13 rounded-full p-[2px] bg-gradient-to-tr from-[#7928CA] via-[#EC4899] to-amber-400">
              <img
                src={currentUser.avatar}
                alt={currentUser.displayName}
                className="w-full h-full rounded-full object-cover"
              />
            </div>
            {currentUser.vipTier > 0 && (
              <div className="absolute -bottom-1 -right-1 w-4.5 h-4.5 rounded-full bg-amber-400 flex items-center justify-center text-black shadow">
                <Crown className="w-3 h-3 stroke-[3]" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-black text-white truncate">{currentUser.displayName}</h4>
            <span className="text-xs text-[#C084FC] font-mono block">@{currentUser.username}</span>
            <div className="flex items-center gap-2 text-[10px] text-zinc-400 mt-1">
              <span>{currentUser.followersCount.toLocaleString()} Followers</span>
              <span>•</span>
              <span className="text-emerald-400 font-semibold">Live Creator</span>
            </div>
          </div>

          <button
            onClick={() => setShowQrCode(!showQrCode)}
            className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-purple-300 hover:text-white transition cursor-pointer shrink-0"
            title="Show QR Code"
          >
            <QrCode className="w-5 h-5" />
          </button>
        </div>

        {/* QR Code Expansion */}
        {showQrCode && (
          <div className="mb-3.5 p-4 rounded-2xl bg-white text-black flex flex-col items-center justify-center text-center animate-scale-up">
            <div className="w-32 h-32 bg-zinc-900 rounded-xl p-2 flex items-center justify-center">
              {/* Stylized QR placeholder block */}
              <div className="w-full h-full border-4 border-white border-dashed flex flex-col items-center justify-center text-white">
                <QrCode className="w-16 h-16 text-white" />
                <span className="text-[9px] font-mono mt-1 text-[#C084FC]">SCAN TO OPEN</span>
              </div>
            </div>
            <span className="text-xs font-black text-black mt-2">{currentUser.displayName}</span>
            <span className="text-[10px] text-zinc-600 font-mono">@{currentUser.username}</span>
          </div>
        )}

        {/* ======================================================== */}
        {/* 1. IN-APP SHARING */}
        {/* ======================================================== */}
        <div className="mb-3">
          <label className="text-[11px] font-bold text-purple-300 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5 text-purple-400" />
            <span>Send to In-App Chats</span>
          </label>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {conversations.slice(0, 5).map((conv) => {
              const hasSent = sentInAppTo.includes(conv.id);
              return (
                <button
                  key={conv.id}
                  onClick={() => handleShareToConversation(conv.id, conv.user.displayName)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition cursor-pointer shrink-0 w-16 ${
                    hasSent
                      ? 'bg-emerald-500/15 border-emerald-500/40'
                      : 'bg-[#181131] border-[#A855F7]/25 hover:border-[#EC4899]'
                  }`}
                >
                  <div className="relative">
                    <img
                      src={conv.user.avatar}
                      alt={conv.user.displayName}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                    {hasSent && (
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center text-white">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </div>
                    )}
                  </div>
                  <span className="text-[9px] text-zinc-300 font-semibold truncate max-w-[55px]">
                    {hasSent ? 'Sent' : conv.user.displayName.split(' ')[0]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ======================================================== */}
        {/* 2. EXTERNAL SOCIAL & OTHERS SHARING */}
        {/* ======================================================== */}
        <div className="space-y-2">
          {/* WhatsApp Direct Share */}
          <button
            onClick={handleShareWhatsApp}
            className="w-full h-11 rounded-2xl bg-[#075E54] hover:bg-[#128C7E] border border-[#25D366]/40 flex items-center justify-between px-4 transition active:scale-[0.98] cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 fill-white shrink-0" viewBox="0 0 24 24">
                <path d="M12.031 2C6.51 2 2.016 6.495 2.016 12.016c0 1.888.528 3.655 1.444 5.174L2 22l4.981-1.427a9.983 9.983 0 0 0 5.05 1.443c5.52 0 10.016-4.495 10.016-10.016C22.047 6.495 17.551 2 12.031 2zm5.787 14.184c-.244.685-1.22 1.258-1.704 1.334-.483.076-1.07.133-3.483-.827-2.875-1.144-4.717-4.04-4.86-4.23-.143-.19-1.16-1.545-1.16-2.946 0-1.402.734-2.09.994-2.376.26-.285.57-.356.76-.356.19 0 .38.002.547.01.176.01.412-.067.644.49.24.577.818 1.996.89 2.139.071.143.119.31.024.499-.095.19-.143.31-.285.475-.143.167-.3.372-.428.5-.143.143-.292.3-.125.586.167.285.742 1.223 1.593 1.98 1.093.974 2.016 1.277 2.302 1.42.285.143.452.12.619-.072.167-.19.714-.833.904-1.119.19-.285.38-.238.642-.143.262.095 1.666.785 1.951.928.285.143.475.214.547.333.071.119.071.69-.173 1.375z" />
              </svg>
              <span className="text-xs font-bold text-white">Share on WhatsApp</span>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-zinc-300" />
          </button>

          {/* More Apps (Native Share / Other Apps) */}
          <button
            onClick={handleNativeShare}
            className="w-full h-11 rounded-2xl bg-[#1C1236] hover:bg-[#251A48] border border-[#A855F7]/30 flex items-center justify-between px-4 transition active:scale-[0.98] cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-[#7928CA] to-[#EC4899] flex items-center justify-center text-white">
                <Share2 className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-bold text-white">Share to Other Apps (Instagram, X, etc.)</span>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-zinc-300" />
          </button>
        </div>

        {/* Copy Link Input Bar */}
        <div className="mt-3 p-1 rounded-2xl bg-[#0D071A] border border-white/10 flex items-center justify-between pl-3 pr-1">
          <span className="text-xs text-zinc-400 font-mono truncate max-w-[200px]">{profileUrl}</span>
          <button
            onClick={handleCopyLink}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            {copiedLink ? (
              <>
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
