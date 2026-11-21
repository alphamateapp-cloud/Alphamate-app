import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ShieldCheck,
  ShieldBan,
  Clock,
  Calendar,
  UserCheck,
  MessageSquareText,
  X,
  CheckCircle2,
  BadgeCheck,
  Bell,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  formatAdminDateTime,
  formatRemainingTime,
} from '../../services/adminModerationService';
import { FeatureRestrictionScreen } from './FeatureRestrictionScreen';

export const AdminActionModals: React.FC = () => {
  const {
    activeAdminWarning,
    dismissActiveAdminWarning,
    selectedAdminNotification,
    setSelectedAdminNotification,
    activeFeatureRestrictionModal,
    setActiveFeatureRestrictionModal,
    markNotificationRead,
    setCurrentScreen,
    adminModerationState,
  } = useApp();

  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  const hasSelectedExpiry = Boolean(
    selectedAdminNotification?.expiresAtMs &&
      !selectedAdminNotification.isPermanent &&
      selectedAdminNotification.expiresAtMs > nowMs
  );

  useEffect(() => {
    if (!hasSelectedExpiry) return;
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [hasSelectedExpiry]);

  const getStatusAccent = (actionKind?: string) => {
    switch (actionKind) {
      case 'account_blocked':
      case 'live_suspended':
      case 'party_restricted':
        return {
          border: 'border-rose-500/40',
          badge: 'bg-rose-500/15 border-rose-400/35 text-rose-300',
          iconBg: 'bg-rose-500/20 border-rose-400/40 text-rose-300',
          icon: <ShieldBan className="w-6 h-6" />,
        };
      case 'account_suspended':
      case 'admin_warning':
        return {
          border: 'border-amber-500/40',
          badge: 'bg-amber-500/15 border-amber-400/35 text-amber-300',
          iconBg: 'bg-amber-500/20 border-amber-400/40 text-amber-300',
          icon: <AlertTriangle className="w-6 h-6" />,
        };
      case 'account_unblocked':
      case 'account_restored':
      case 'live_restored':
      case 'party_restored':
        return {
          border: 'border-emerald-500/40',
          badge: 'bg-emerald-500/15 border-emerald-400/35 text-emerald-300',
          iconBg: 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300',
          icon: <CheckCircle2 className="w-6 h-6" />,
        };
      case 'verification_granted':
      case 'verification_removed':
      case 'verification_updated':
        return {
          border: 'border-sky-500/40',
          badge: 'bg-sky-500/15 border-sky-400/35 text-sky-300',
          iconBg: 'bg-sky-500/20 border-sky-400/40 text-sky-300',
          icon: <BadgeCheck className="w-6 h-6" />,
        };
      default:
        return {
          border: 'border-[#A855F7]/40',
          badge: 'bg-[#A855F7]/15 border-[#A855F7]/35 text-[#C084FC]',
          iconBg: 'bg-[#A855F7]/20 border-[#A855F7]/40 text-[#C084FC]',
          icon: <ShieldCheck className="w-6 h-6" />,
        };
    }
  };

  return (
    <>
      {/* 1. Feature Restriction Modal (Live / Party) */}
      {activeFeatureRestrictionModal && (
        <FeatureRestrictionScreen
          scope={activeFeatureRestrictionModal.scope}
          detail={activeFeatureRestrictionModal.detail}
          isModal={true}
          onClose={() => setActiveFeatureRestrictionModal(null)}
        />
      )}

      {/* 2. Official Admin Warning Card / Modal */}
      {activeAdminWarning && !selectedAdminNotification && (
        <div className="fixed inset-0 z-[75] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-md rounded-3xl bg-[#150C26] border border-amber-400/45 shadow-2xl overflow-hidden">
            <div className="px-5 pt-5 pb-4 bg-gradient-to-b from-amber-500/20 via-[#1A1030] to-[#150C26] border-b border-amber-400/20 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0 shadow-lg">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <span className="inline-block px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/35 text-amber-300 text-[9.5px] font-black uppercase tracking-widest">
                    Official Notice
                  </span>
                  <h3 className="text-base font-black text-white tracking-tight mt-1">
                    OFFICIAL ADMIN WARNING
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => dismissActiveAdminWarning(true)}
                aria-label="Close warning"
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-zinc-200 cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-300">
                  Warning Message
                </p>
                <p className="text-xs text-white bg-amber-500/10 border border-amber-400/25 rounded-2xl px-3.5 py-3 leading-relaxed font-medium">
                  {activeAdminWarning.adminMessage || activeAdminWarning.message}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  Reason
                </p>
                <p className="text-xs font-semibold text-zinc-100 bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2.5 leading-relaxed">
                  {activeAdminWarning.reason || 'Community Guidelines Notice'}
                </p>
              </div>

              <div className="rounded-2xl bg-[#0E081B] border border-white/10 p-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-zinc-400 flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                    <span>Issued By</span>
                  </span>
                  <span className="font-bold text-white text-right">
                    {activeAdminWarning.adminLabel || activeAdminWarning.adminName || 'Alpha Mate Admin'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-zinc-400 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-sky-400" />
                    <span>Date & Time</span>
                  </span>
                  <span className="font-semibold text-zinc-200 text-right">
                    {formatAdminDateTime(activeAdminWarning.actionDateMs || activeAdminWarning.createdAtMs)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    dismissActiveAdminWarning(true);
                    setCurrentScreen('notifications');
                  }}
                  className="flex-1 h-11 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-200 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Bell className="w-3.5 h-3.5 text-[#C084FC]" />
                  <span>Warning History</span>
                </button>
                <button
                  type="button"
                  onClick={() => dismissActiveAdminWarning(true)}
                  className="flex-1 h-11 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-black text-xs font-black shadow-lg hover:brightness-110 cursor-pointer"
                >
                  I Understand
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Full Admin Action Notification Detail Modal */}
      {selectedAdminNotification && (() => {
        const n = selectedAdminNotification;
        const accent = getStatusAccent(n.actionKind);
        const showTiming = Boolean(n.duration || n.expiresAtMs || n.isPermanent);
        const remaining =
          n.expiresAtMs && !n.isPermanent && n.expiresAtMs > nowMs
            ? formatRemainingTime(n.expiresAtMs, nowMs)
            : null;

        return (
          <div className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
            <div
              className={`w-full max-w-md rounded-3xl bg-[#130B24] border ${accent.border} shadow-2xl overflow-hidden my-auto`}
            >
              {/* Modal Header */}
              <div className="px-5 pt-5 pb-4 bg-[#190F31] border-b border-white/10 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={`w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0 ${accent.iconBg}`}
                  >
                    {accent.icon}
                  </div>
                  <div className="min-w-0">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full border text-[9.5px] font-black uppercase tracking-wider ${accent.badge}`}
                    >
                      {n.currentStatus || adminModerationState.currentAccountStatusLabel}
                    </span>
                    <h3 className="text-sm font-black text-white leading-snug mt-1">
                      {n.actionTitle || n.title}
                    </h3>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedAdminNotification(null)}
                  aria-label="Close admin action details"
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-zinc-200 cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Complete Structured Action Details */}
              <div className="p-5 space-y-3.5 max-h-[72vh] overflow-y-auto">
                {remaining && (
                  <div className="rounded-2xl bg-amber-500/10 border border-amber-400/35 p-3 text-center">
                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-300">
                      Remaining Duration
                    </p>
                    <p className="text-lg font-black font-mono text-white mt-0.5">{remaining}</p>
                  </div>
                )}

                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    Exact Action Taken
                  </p>
                  <p className="text-xs font-bold text-white bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2.5">
                    {n.actionTaken || n.title}
                  </p>
                </div>

                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    Reason
                  </p>
                  <p className="text-xs text-zinc-100 bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2.5 leading-relaxed">
                    {n.reason || n.message}
                  </p>
                </div>

                {(n.adminMessage || (n.message && n.message !== n.reason)) && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1">
                      <MessageSquareText className="w-3 h-3 text-[#C084FC]" />
                      <span>Admin Message</span>
                    </p>
                    <p className="text-xs text-zinc-200 bg-[#1B1033] border border-[#A855F7]/25 rounded-xl px-3.5 py-2.5 leading-relaxed">
                      {n.adminMessage || n.message}
                    </p>
                  </div>
                )}

                <div className="rounded-2xl bg-[#0E081B] border border-white/10 p-3.5 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-zinc-400 flex items-center gap-1.5 shrink-0">
                      <UserCheck className="w-3.5 h-3.5 text-[#C084FC]" />
                      <span>Admin</span>
                    </span>
                    <span className="font-bold text-white text-right">
                      {n.adminLabel || n.adminName || 'Alpha Mate Admin'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-zinc-400 flex items-center gap-1.5 shrink-0">
                      <Calendar className="w-3.5 h-3.5 text-sky-400" />
                      <span>Action Date & Time</span>
                    </span>
                    <span className="font-semibold text-zinc-200 text-right">
                      {n.actionDate || formatAdminDateTime(n.actionDateMs || n.createdAtMs)}
                    </span>
                  </div>

                  {showTiming && (
                    <>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-zinc-400 flex items-center gap-1.5 shrink-0">
                          <Clock className="w-3.5 h-3.5 text-amber-400" />
                          <span>Duration</span>
                        </span>
                        <span className="font-bold text-amber-300 text-right">
                          {n.isPermanent ? 'Permanent' : n.duration || 'Temporary'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <span className="text-zinc-400 flex items-center gap-1.5 shrink-0">
                          <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Expiry Date & Time</span>
                        </span>
                        <span className="font-semibold text-zinc-200 text-right">
                          {n.isPermanent
                            ? 'Until Admin Restores'
                            : n.expiresAt || formatAdminDateTime(n.expiresAtMs)}
                        </span>
                      </div>
                    </>
                  )}

                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/5">
                    <span className="text-zinc-400 shrink-0">Current Access Status</span>
                    <span className="font-bold text-[#C084FC] text-right">
                      {adminModerationState.currentAccountStatusLabel}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (!n.isRead) markNotificationRead(n.id);
                    setSelectedAdminNotification(null);
                  }}
                  className="w-full h-11 rounded-2xl bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white text-xs font-black tracking-wide shadow-lg hover:brightness-110 cursor-pointer"
                >
                  Close Details
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
};
