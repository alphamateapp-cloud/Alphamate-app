import React, { useMemo, useState } from 'react';
import {
  X,
  Share2,
  Copy,
  Check,
  MessageSquare,
  Users,
  Link2,
  Mail,
  MessageCircle,
  Send,
  ExternalLink,
  Smartphone,
} from 'lucide-react';
import { PartyRoom } from '../../types';
import { useApp } from '../../context/AppContext';
import { copyToClipboard } from '../../utils/clipboard';
import { DEFAULT_AVATAR_URL, getHdImageUrl, safeImageSrc } from '../../utils/imageHd';
import {
  buildPartyRoomDeepLink,
  buildSocialShareUrls,
  isNativeShareSupported,
  triggerNativePartyShare,
} from '../../utils/partyDeepLink';

interface SharePartyModalProps {
  isOpen: boolean;
  room: PartyRoom | null;
  activeViewers: number;
  onClose: () => void;
  onToast?: (message: string) => void;
}

export const SharePartyModal: React.FC<SharePartyModalProps> = ({
  isOpen,
  room,
  activeViewers,
  onClose,
  onToast,
}) => {
  const { currentUser, conversations, sendMessage } = useApp();
  const [copiedLink, setCopiedLink] = useState(false);
  const [sentConvIds, setSentConvIds] = useState<string[]>([]);
  const [isSharingNative, setIsSharingNative] = useState(false);

  const sharePayload = useMemo(() => {
    if (!room) return null;
    return buildPartyRoomDeepLink(room, {
      displayName: currentUser.displayName,
      username: currentUser.username,
    });
  }, [room, currentUser.displayName, currentUser.username]);

  const socialUrls = useMemo(() => {
    if (!sharePayload) return null;
    return buildSocialShareUrls(sharePayload);
  }, [sharePayload]);

  const nativeShareAvailable = useMemo(() => isNativeShareSupported(), []);

  if (!isOpen || !room || !sharePayload || !socialUrls) return null;

  const notify = (msg: string) => {
    if (onToast) onToast(msg);
  };

  const handleCopyDeepLink = async () => {
    await copyToClipboard(sharePayload.webUrl);
    setCopiedLink(true);
    notify('Party invite link copied!');
    window.setTimeout(() => setCopiedLink(false), 2200);
  };

  const handleNativeShare = async () => {
    if (isSharingNative) return;
    setIsSharingNative(true);
    try {
      const result = await triggerNativePartyShare(sharePayload);
      if (result === 'shared') {
        notify('Party invitation shared!');
        onClose();
      } else if (result === 'unsupported') {
        await handleCopyDeepLink();
      }
    } finally {
      setIsSharingNative(false);
    }
  };

  const handleInviteInAppFriend = (convId: string, friendName: string) => {
    if (sentConvIds.includes(convId)) return;
    sendMessage(
      convId,
      `🎙️ Join my live Party Room "${sharePayload.roomTitle}" on Alpha Mate!\n${sharePayload.webUrl}`
    );
    setSentConvIds((prev) => [...prev, convId]);
    notify(`Invited ${friendName} in chat!`);
  };

  const roomCover = getHdImageUrl(room.coverImageUrl || room.host?.avatar, DEFAULT_AVATAR_URL);

  const externalChannels = [
    {
      id: 'whatsapp',
      label: 'WhatsApp',
      href: socialUrls.whatsapp,
      accentClass: 'bg-[#075E54]/80 border-[#25D366]/40 hover:bg-[#128C7E]/80 text-white',
      icon: (
        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12.031 2C6.51 2 2.016 6.495 2.016 12.016c0 1.888.528 3.655 1.444 5.174L2 22l4.981-1.427a9.983 9.983 0 0 0 5.05 1.443c5.52 0 10.016-4.495 10.016-10.016C22.047 6.495 17.551 2 12.031 2zm5.787 14.184c-.244.685-1.22 1.258-1.704 1.334-.483.076-1.07.133-3.483-.827-2.875-1.144-4.717-4.04-4.86-4.23-.143-.19-1.16-1.545-1.16-2.946 0-1.402.734-2.09.994-2.376.26-.285.57-.356.76-.356.19 0 .38.002.547.01.176.01.412-.067.644.49.24.577.818 1.996.89 2.139.071.143.119.31.024.499-.095.19-.143.31-.285.475-.143.167-.3.372-.428.5-.143.143-.292.3-.125.586.167.285.742 1.223 1.593 1.98 1.093.974 2.016 1.277 2.302 1.42.285.143.452.12.619-.072.167-.19.714-.833.904-1.119.19-.285.38-.238.642-.143.262.095 1.666.785 1.951.928.285.143.475.214.547.333.071.119.071.69-.173 1.375z" />
        </svg>
      ),
    },
    {
      id: 'telegram',
      label: 'Telegram',
      href: socialUrls.telegram,
      accentClass: 'bg-[#1D4E78]/80 border-sky-400/35 hover:bg-[#22649B]/80 text-white',
      icon: <Send className="w-4 h-4" />,
    },
    {
      id: 'twitter',
      label: 'X / Twitter',
      href: socialUrls.twitter,
      accentClass: 'bg-zinc-900/90 border-white/20 hover:bg-zinc-800 text-white',
      icon: (
        <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      ),
    },
    {
      id: 'facebook',
      label: 'Facebook',
      href: socialUrls.facebook,
      accentClass: 'bg-[#183B74]/85 border-blue-400/35 hover:bg-[#1E4B94]/85 text-white',
      icon: (
        <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M13.5 22v-8.25h2.77l.42-3.22H13.5V8.48c0-.93.26-1.57 1.6-1.57h1.7V4.03c-.3-.04-1.31-.13-2.49-.13-2.46 0-4.15 1.5-4.15 4.26v2.37H7.38v3.22h2.78V22h3.34z" />
        </svg>
      ),
    },
    {
      id: 'sms',
      label: 'Messages',
      href: socialUrls.sms,
      accentClass: 'bg-emerald-950/80 border-emerald-400/30 hover:bg-emerald-900/80 text-emerald-200',
      icon: <MessageCircle className="w-4 h-4" />,
    },
    {
      id: 'email',
      label: 'Email',
      href: socialUrls.email,
      accentClass: 'bg-purple-950/80 border-purple-400/30 hover:bg-purple-900/80 text-purple-200',
      icon: <Mail className="w-4 h-4" />,
    },
  ];

  return (
    <div
      data-keep-dark="true"
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-[#130B26]/98 border-t sm:border border-white/15 p-5 shadow-2xl animate-scale-up flex flex-col max-h-[86vh] text-white"
      >
        {/* Mobile Sheet Handle */}
        <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-3 sm:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[#7928CA] via-[#EC4899] to-amber-400 flex items-center justify-center shrink-0 shadow-md">
              <Share2 className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-white leading-tight">Share Party</h3>
              <p className="text-[11px] text-zinc-400 truncate">
                Invite friends straight into this live room
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close share party modal"
            className="w-11 h-11 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-zinc-300 hover:text-white cursor-pointer shrink-0 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto pt-4 pb-2 space-y-4 flex-1">
          {/* Live Party Preview Card */}
          <div className="p-3 rounded-2xl bg-gradient-to-r from-[#211240] via-[#190F33] to-[#120A26] border border-white/10 flex items-center gap-3">
            <img
              src={roomCover}
              alt={sharePayload.roomTitle}
              referrerPolicy="no-referrer"
              className="w-12 h-12 rounded-xl object-cover border border-[#EC4899]/50 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-extrabold text-white truncate">{sharePayload.roomTitle}</p>
              <p className="text-[11px] text-zinc-300 truncate mt-0.5">
                Hosted by <span className="text-[#C084FC] font-semibold">{sharePayload.hostName}</span>
              </p>
              <div className="flex items-center gap-2 mt-1 text-[10px] text-zinc-400">
                <span className="inline-flex items-center gap-1 text-emerald-300 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live Now
                </span>
                <span>•</span>
                <span className="inline-flex items-center gap-1">
                  <Users className="w-3 h-3 text-cyan-300" />
                  {activeViewers.toLocaleString()} listening
                </span>
              </div>
            </div>
          </div>

          {/* Primary Action: Platform-Integrated Native Share Sheet */}
          <button
            type="button"
            onClick={handleNativeShare}
            disabled={isSharingNative}
            className="w-full min-h-[48px] px-4 rounded-2xl bg-gradient-to-r from-[#7928CA] via-[#EC4899] to-amber-500 text-white text-xs font-extrabold flex items-center justify-between shadow-lg shadow-[#EC4899]/25 hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-60"
          >
            <span className="flex items-center gap-2.5">
              <Smartphone className="w-4 h-4 shrink-0" />
              <span>
                {nativeShareAvailable
                  ? 'Share via Device Sheet & Apps'
                  : 'Copy Deep Link to Share Anywhere'}
              </span>
            </span>
            <ExternalLink className="w-4 h-4 shrink-0 opacity-90" />
          </button>

          {/* Deep Link Display & One-Tap Copy */}
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5 mb-1.5">
              <Link2 className="w-3.5 h-3.5 text-[#C084FC]" />
              <span>Direct Party Deep Link</span>
            </span>
            <div className="p-1.5 rounded-2xl bg-[#0B0617] border border-white/10 flex items-center gap-2">
              <span className="text-[11px] text-zinc-300 font-mono truncate flex-1 pl-2 select-all">
                {sharePayload.webUrl}
              </span>
              <button
                type="button"
                onClick={handleCopyDeepLink}
                className={`min-h-[40px] px-3.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 transition-all cursor-pointer active:scale-95 ${
                  copiedLink
                    ? 'bg-emerald-500 text-white'
                    : 'bg-white/10 hover:bg-white/20 text-white border border-white/10'
                }`}
              >
                {copiedLink ? (
                  <>
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                    <span>Copied</span>
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

          {/* In-App Friend Chats Quick Invite */}
          {conversations.length > 0 && (
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5 mb-2">
                <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                <span>Invite Alpha Mate Friends</span>
              </span>
              <div className="flex items-center gap-2.5 overflow-x-auto pb-1 scrollbar-none">
                {conversations.slice(0, 8).map((conv) => {
                  const hasSent = sentConvIds.includes(conv.id);
                  return (
                    <button
                      key={conv.id}
                      type="button"
                      onClick={() => handleInviteInAppFriend(conv.id, conv.user.displayName)}
                      className={`flex flex-col items-center gap-1.5 p-2 rounded-2xl border transition-all cursor-pointer shrink-0 w-[68px] active:scale-95 ${
                        hasSent
                          ? 'bg-emerald-500/15 border-emerald-400/45'
                          : 'bg-[#191032] border-white/10 hover:border-[#EC4899]/60'
                      }`}
                    >
                      <div className="relative">
                        <img
                          src={safeImageSrc(conv.user.avatar, DEFAULT_AVATAR_URL)}
                          alt={conv.user.displayName}
                          referrerPolicy="no-referrer"
                          className="w-9 h-9 rounded-full object-cover border border-white/15"
                        />
                        {hasSent && (
                          <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-semibold text-zinc-200 truncate w-full text-center">
                        {hasSent ? 'Sent' : conv.user.displayName.split(' ')[0]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* External Social & Messaging Apps */}
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block mb-2">
              Share on External Apps
            </span>
            <div className="grid grid-cols-3 gap-2.5">
              {externalChannels.map((channel) => (
                <a
                  key={channel.id}
                  href={channel.href}
                  target={channel.id === 'sms' || channel.id === 'email' ? undefined : '_blank'}
                  rel={
                    channel.id === 'sms' || channel.id === 'email'
                      ? undefined
                      : 'noopener noreferrer'
                  }
                  onClick={() => notify(`Opening ${channel.label}...`)}
                  className={`min-h-[60px] rounded-2xl border flex flex-col items-center justify-center gap-1.5 px-2 py-2.5 transition-all active:scale-95 ${channel.accentClass}`}
                >
                  {channel.icon}
                  <span className="text-[10.5px] font-bold truncate max-w-full">
                    {channel.label}
                  </span>
                </a>
              ))}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full min-h-[44px] rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 text-zinc-200 text-xs font-bold hover:text-white cursor-pointer transition-colors shrink-0"
        >
          Done
        </button>
      </div>
    </div>
  );
};
