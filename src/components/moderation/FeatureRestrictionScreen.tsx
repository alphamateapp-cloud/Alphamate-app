import React, { useEffect, useState } from 'react';
import {
  Radio,
  Users,
  Clock,
  Calendar,
  UserCheck,
  MessageSquareText,
  ShieldAlert,
  ArrowLeft,
  X,
} from 'lucide-react';
import { AdminRestrictionDetail } from '../../types';
import {
  formatAdminDateTime,
  formatRemainingTime,
} from '../../services/adminModerationService';

interface FeatureRestrictionScreenProps {
  scope: 'live' | 'party';
  detail: AdminRestrictionDetail;
  isModal?: boolean;
  onClose: () => void;
}

export const FeatureRestrictionScreen: React.FC<FeatureRestrictionScreenProps> = ({
  scope,
  detail,
  isModal = false,
  onClose,
}) => {
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const isLive = scope === 'live';
  const hasTemporaryExpiry = Boolean(!detail.isPermanent && detail.expiresAtMs && detail.expiresAtMs > 0);

  useEffect(() => {
    if (!hasTemporaryExpiry) return;
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [hasTemporaryExpiry]);

  const remainingLabel = hasTemporaryExpiry
    ? formatRemainingTime(detail.expiresAtMs, nowMs)
    : null;

  const heading = isLive
    ? 'YOUR LIVE ACCESS HAS BEEN SUSPENDED'
    : 'YOUR PARTY ACCESS HAS BEEN RESTRICTED';

  const subtitle = isLive
    ? 'Live streaming access is currently disabled for your account. Other Alpha Mate features such as Chat, Wallet, Profile, and Moments remain available.'
    : 'Creating and joining Party Rooms is currently disabled for your account. Other Alpha Mate features remain available.';

  const cardBody = (
    <div className="w-full max-w-md mx-auto rounded-3xl bg-[#130B24] border border-rose-500/35 shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="relative px-5 pt-6 pb-4 bg-gradient-to-b from-rose-600/20 via-[#180E2E] to-[#130B24] border-b border-white/10 text-center">
        {isModal && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close restriction details"
            className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-zinc-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-rose-500/25 to-amber-500/20 border border-rose-400/40 flex items-center justify-center text-rose-300 shadow-lg mb-3">
          {isLive ? <Radio className="w-7 h-7" /> : <Users className="w-7 h-7" />}
        </div>

        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-500/15 border border-rose-400/35 text-rose-300 text-[10px] font-black uppercase tracking-wider">
          <ShieldAlert className="w-3 h-3" />
          <span>{detail.currentStatus}</span>
        </span>

        <h2 className="text-lg font-black text-white tracking-tight mt-2 leading-snug">
          {heading}
        </h2>
        <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
          {subtitle}
        </p>
      </div>

      {/* Body Details */}
      <div className="p-5 space-y-4">
        {hasTemporaryExpiry && remainingLabel && (
          <div className="rounded-2xl bg-amber-500/10 border border-amber-400/35 p-3.5 text-center space-y-0.5">
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-300">
              Remaining Restriction Time
            </p>
            <p className="text-xl font-black font-mono text-white">{remainingLabel}</p>
            <p className="text-[11px] text-amber-100/80">
              Restores automatically at {formatAdminDateTime(detail.expiresAtMs)}
            </p>
          </div>
        )}

        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
            Reason
          </p>
          <p className="text-xs font-semibold text-white bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2.5 leading-relaxed">
            {detail.reason}
          </p>
        </div>

        {detail.adminMessage && detail.adminMessage !== detail.reason && (
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1">
              <MessageSquareText className="w-3 h-3 text-[#C084FC]" />
              <span>Admin Message</span>
            </p>
            <p className="text-xs text-zinc-200 bg-[#1B1033] border border-[#A855F7]/25 rounded-xl px-3 py-2.5 leading-relaxed">
              {detail.adminMessage}
            </p>
          </div>
        )}

        <div className="rounded-2xl bg-[#0E081B] border border-white/10 p-3.5 space-y-2.5 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-zinc-400">Action Taken</span>
            <span className="font-bold text-white text-right">{detail.actionTaken}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-zinc-400 flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5 text-[#C084FC]" />
              <span>Admin</span>
            </span>
            <span className="font-bold text-white text-right">{detail.adminLabel || detail.adminName}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-zinc-400 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>Duration</span>
            </span>
            <span className="font-bold text-amber-300 text-right">
              {detail.isPermanent ? 'Permanent (Until Admin Restores)' : detail.duration || 'Temporary'}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-zinc-400 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-sky-400" />
              <span>Start Time</span>
            </span>
            <span className="font-semibold text-zinc-200 text-right">
              {formatAdminDateTime(detail.startedAtMs)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-zinc-400 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-emerald-400" />
              <span>Expiry Time</span>
            </span>
            <span className="font-semibold text-zinc-200 text-right">
              {detail.isPermanent
                ? 'Until Admin Restores'
                : formatAdminDateTime(detail.expiresAtMs)}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full h-11 rounded-2xl bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white text-xs font-black tracking-wide shadow-lg hover:brightness-110 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{isModal ? 'Close Notice' : 'Return to Home'}</span>
        </button>
      </div>
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
        {cardBody}
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-[100dvh] bg-[#09070F] text-white px-4 py-8 pb-24 overflow-y-auto flex items-center justify-center">
      {cardBody}
    </div>
  );
};
