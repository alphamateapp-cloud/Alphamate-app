import React, { useEffect, useRef, useState } from 'react';
import {
  ShieldBan,
  Clock,
  LogOut,
  RefreshCw,
  Users,
  Copy,
  Check,
} from 'lucide-react';
import { AdminRestrictionDetail } from '../../types';
import { useApp } from '../../context/AppContext';
import {
  formatAdminDateTime,
  formatRemainingTime,
} from '../../services/adminModerationService';
import { copyToClipboard } from '../../utils/clipboard';

export interface AccountRestrictionScreenProps {
  mode: 'blocked' | 'suspended';
  detail: AdminRestrictionDetail;
}

export const AccountRestrictionScreen: React.FC<AccountRestrictionScreenProps> = ({
  mode,
  detail,
}) => {
  const {
    currentUser,
    logout,
    refreshScope,
    savedAccounts,
    setShowAccountSwitcherModal,
  } = useApp();

  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [refreshing, setRefreshing] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);
  const [avatarBroken, setAvatarBroken] = useState(false);
  const [copiedField, setCopiedField] = useState<'uid' | 'ref' | null>(null);
  const expiryRefreshTriggeredRef = useRef(false);

  const isSuspended = mode === 'suspended';
  const isPermanent = Boolean(!isSuspended || detail.isPermanent || !detail.expiresAtMs);
  const hasTemporaryExpiry = Boolean(
    isSuspended && !detail.isPermanent && detail.expiresAtMs && detail.expiresAtMs > 0
  );

  useEffect(() => {
    setAvatarBroken(false);
  }, [currentUser.avatar]);

  useEffect(() => {
    expiryRefreshTriggeredRef.current = false;
  }, [detail.expiresAtMs, detail.actionId, mode]);

  // Live 1-second countdown and automatic status refresh on temporary suspension expiry
  useEffect(() => {
    if (!hasTemporaryExpiry) return;
    const timer = window.setInterval(() => {
      const current = Date.now();
      setNowMs(current);
      if (
        detail.expiresAtMs &&
        current >= detail.expiresAtMs &&
        !expiryRefreshTriggeredRef.current
      ) {
        expiryRefreshTriggeredRef.current = true;
        refreshScope('profile').catch(() => {});
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [hasTemporaryExpiry, detail.expiresAtMs, refreshScope]);

  const remainingLabel = hasTemporaryExpiry
    ? formatRemainingTime(detail.expiresAtMs, nowMs)
    : null;

  const progressPercent = (() => {
    if (!hasTemporaryExpiry || !detail.startedAtMs || !detail.expiresAtMs) return null;
    const total = detail.expiresAtMs - detail.startedAtMs;
    if (total <= 0) return 100;
    const elapsed = Math.max(0, Math.min(total, nowMs - detail.startedAtMs));
    return Math.round((elapsed / total) * 100);
  })();

  const handleRefreshStatus = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setStatusFeedback(null);
    try {
      await refreshScope('profile');
      const checkedAt = new Date().toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
      });
      setStatusFeedback(`Status checked at ${checkedAt} — restriction is still active.`);
    } catch {
      setStatusFeedback('Unable to reach server right now. Please try again in a moment.');
    } finally {
      window.setTimeout(() => setRefreshing(false), 350);
    }
  };

  const handleCopyValue = async (value: string, field: 'uid' | 'ref') => {
    await copyToClipboard(value);
    setCopiedField(field);
    window.setTimeout(() => {
      setCopiedField((prev) => (prev === field ? null : prev));
    }, 1800);
  };

  const statusText =
    detail.currentStatus ||
    (isSuspended
      ? isPermanent
        ? 'Account Suspended (Permanent)'
        : 'Account Suspended (Temporary)'
      : 'Account Blocked');

  const durationText = isSuspended
    ? detail.isPermanent
      ? 'Permanent'
      : detail.duration || 'Temporary'
    : detail.duration || 'Permanent until Admin unblock';

  const expiryText = hasTemporaryExpiry
    ? formatAdminDateTime(detail.expiresAtMs)
    : isSuspended
    ? 'Permanent — Until Admin Restores'
    : 'Until Admin Unblocks Account';

  const adminDisplayName = detail.adminLabel || detail.adminName || 'Alpha Mate Admin';
  const showAdminEmail =
    Boolean(detail.adminEmail) &&
    detail.adminEmail?.toLowerCase() !== adminDisplayName.toLowerCase();

  const initials = (currentUser.displayName || 'AM')
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

  const accentIconColor = isSuspended ? 'text-amber-300' : 'text-rose-300';
  const accentSurface = isSuspended
    ? 'bg-amber-500/12 border-amber-400/30'
    : 'bg-rose-500/12 border-rose-400/30';
  const accentText = isSuspended ? 'text-amber-300' : 'text-rose-300';
  const accentBar = isSuspended ? 'text-amber-400' : 'text-rose-400';

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="account-restriction-title"
      aria-describedby="account-restriction-summary"
      className="relative w-full h-full min-h-[100dvh] bg-[#09070F] text-white overflow-y-auto overscroll-contain flex flex-col"
    >
      {/* Subtle Top Scrim */}
      <div
        aria-hidden="true"
        className={`pointer-events-none fixed inset-x-0 top-0 h-44 opacity-25 blur-3xl ${
          isSuspended
            ? 'bg-gradient-to-b from-amber-600/50 to-transparent'
            : 'bg-gradient-to-b from-rose-600/55 to-transparent'
        }`}
      />

      <div className="relative z-10 flex-1 w-full max-w-md mx-auto px-5 pt-7 pb-6 flex flex-col justify-between gap-6">
        <div className="space-y-6">
          {/* Header & Primary Status Anchor */}
          <header className="space-y-3.5 text-center pt-1">
            <div
              className={`w-14 h-14 mx-auto rounded-2xl border flex items-center justify-center ${accentSurface} ${accentIconColor}`}
            >
              {isSuspended ? (
                <Clock className="w-7 h-7" aria-hidden="true" />
              ) : (
                <ShieldBan className="w-7 h-7" aria-hidden="true" />
              )}
            </div>

            <div className="space-y-2">
              <p className={`text-xs font-semibold tracking-wide ${accentText}`}>
                {statusText}
                <span className="mx-1.5 text-zinc-500" aria-hidden="true">·</span>
                <span className="text-zinc-300">{detail.actionTaken}</span>
              </p>

              <h1
                id="account-restriction-title"
                className="text-[21px] font-bold tracking-tight text-white leading-snug text-balance"
              >
                {isSuspended
                  ? 'YOUR ACCOUNT HAS BEEN SUSPENDED'
                  : 'YOUR ACCOUNT HAS BEEN BLOCKED'}
              </h1>

              <p
                id="account-restriction-summary"
                className="text-[13px] text-zinc-300 leading-relaxed max-w-sm mx-auto"
              >
                {isSuspended
                  ? isPermanent
                    ? 'This suspension is permanent and remains active until restored by an Alpha Mate Administrator.'
                    : 'Your account access is temporarily suspended and will restore automatically once the timer expires.'
                  : 'Your Alpha Mate account has been blocked by moderation. App features remain locked while this block is active.'}
              </p>
            </div>
          </header>

          {/* Temporary Suspension Live Countdown */}
          {hasTemporaryExpiry && remainingLabel && (
            <section
              aria-label="Remaining suspension countdown"
              aria-live="polite"
              className="rounded-2xl bg-[#151024] border border-amber-400/25 px-4 py-4 space-y-2.5"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-xs font-medium text-amber-200/90">
                  Remaining suspension time
                </span>
                <span className="text-xs text-zinc-400 tabular-nums">
                  {durationText}
                </span>
              </div>

              <p className="text-2xl font-bold font-mono tabular-nums text-white tracking-tight">
                {remainingLabel}
              </p>

              {progressPercent !== null && (
                <div
                  role="progressbar"
                  aria-label="Suspension elapsed progress"
                  aria-valuenow={progressPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden"
                >
                  <svg
                    viewBox="0 0 100 6"
                    preserveAspectRatio="none"
                    className={`w-full h-full block ${accentBar}`}
                  >
                    <rect
                      x="0"
                      y="0"
                      width={Math.max(4, Math.min(100, progressPercent))}
                      height="6"
                      rx="3"
                      fill="currentColor"
                    />
                  </svg>
                </div>
              )}

              <p className="text-xs text-zinc-300 tabular-nums">
                Restores automatically on {formatAdminDateTime(detail.expiresAtMs)}
              </p>
            </section>
          )}

          {/* Unified Moderation Notice Surface (Single Elevation, Hairline Dividers) */}
          <section
            aria-label="Admin action details"
            className="rounded-2xl bg-[#120D1F] border border-white/10 overflow-hidden divide-y divide-white/[0.07]"
          >
            {/* Affected Account Row */}
            <div className="px-4 py-3.5 flex items-center gap-3">
              {currentUser.avatar && !avatarBroken ? (
                <img
                  src={currentUser.avatar}
                  alt={currentUser.displayName}
                  referrerPolicy="no-referrer"
                  onError={() => setAvatarBroken(true)}
                  className="w-10 h-10 rounded-full object-cover border border-white/15 shrink-0 bg-[#1B1330]"
                />
              ) : (
                <div
                  aria-hidden="true"
                  className="w-10 h-10 rounded-full bg-[#1E1535] border border-white/15 flex items-center justify-center text-xs font-bold text-zinc-200 shrink-0"
                >
                  {initials || 'AM'}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white truncate">
                  {currentUser.displayName}
                </p>
                <p className="text-xs text-zinc-400 truncate tabular-nums">
                  @{currentUser.username}
                  <span className="mx-1.5" aria-hidden="true">·</span>
                  ID {currentUser.uniqueId}
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleCopyValue(currentUser.uniqueId, 'uid')}
                aria-label="Copy account ID"
                className="min-h-[44px] min-w-[44px] -mr-1.5 rounded-xl flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 transition-colors cursor-pointer shrink-0"
              >
                {copiedField === 'uid' ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>

            {/* Reason Section */}
            <div className="px-4 py-3.5 space-y-1.5">
              <h2 className="text-xs font-semibold text-zinc-400">
                {isSuspended ? 'Suspension Reason' : 'Reason for Blocking'}
              </h2>
              <p className="text-sm font-medium text-white leading-relaxed">
                {detail.reason}
              </p>
            </div>

            {/* Additional Admin Message */}
            {detail.adminMessage && detail.adminMessage !== detail.reason && (
              <div className="px-4 py-3.5 space-y-1.5 bg-white/[0.02]">
                <h2 className="text-xs font-semibold text-zinc-400">
                  Additional Admin Message
                </h2>
                <p className="text-[13px] text-zinc-200 leading-relaxed whitespace-pre-line">
                  {detail.adminMessage}
                </p>
              </div>
            )}

            {/* Structured Moderation Metadata List */}
            <dl className="px-4 py-1 divide-y divide-white/[0.06] text-[13px]">
              <div className="py-3 flex items-start justify-between gap-4">
                <dt className="text-zinc-400 shrink-0">Action Taken</dt>
                <dd className="font-medium text-white text-right">
                  {detail.actionTaken}
                </dd>
              </div>

              <div className="py-3 flex items-start justify-between gap-4">
                <dt className="text-zinc-400 shrink-0">Action By</dt>
                <dd className="text-right min-w-0">
                  <div className="font-semibold text-white truncate">
                    {adminDisplayName}
                  </div>
                  {showAdminEmail && (
                    <div className="text-xs text-zinc-400 truncate mt-0.5">
                      {detail.adminEmail}
                    </div>
                  )}
                </dd>
              </div>

              <div className="py-3 flex items-start justify-between gap-4">
                <dt className="text-zinc-400 shrink-0">
                  {isSuspended ? 'Start Date & Time' : 'Action Date & Time'}
                </dt>
                <dd className="font-medium text-zinc-100 text-right tabular-nums">
                  {formatAdminDateTime(detail.startedAtMs)}
                </dd>
              </div>

              <div className="py-3 flex items-start justify-between gap-4">
                <dt className="text-zinc-400 shrink-0">
                  {isSuspended ? 'Suspension Duration' : 'Duration'}
                </dt>
                <dd className={`font-semibold text-right tabular-nums ${accentText}`}>
                  {durationText}
                </dd>
              </div>

              <div className="py-3 flex items-start justify-between gap-4">
                <dt className="text-zinc-400 shrink-0">Expiry Date & Time</dt>
                <dd className="font-medium text-zinc-100 text-right tabular-nums">
                  {expiryText}
                </dd>
              </div>

              <div className="py-3 flex items-start justify-between gap-4">
                <dt className="text-zinc-400 shrink-0">Current Status</dt>
                <dd className={`font-semibold text-right ${accentText}`}>
                  {statusText}
                </dd>
              </div>

              {detail.actionId && (
                <div className="py-2.5 flex items-center justify-between gap-3">
                  <dt className="text-zinc-400 shrink-0">Reference ID</dt>
                  <dd className="flex items-center gap-1.5 min-w-0">
                    <span className="font-mono text-xs text-zinc-300 truncate max-w-[160px] tabular-nums">
                      {detail.actionId}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyValue(detail.actionId!, 'ref')}
                      aria-label="Copy reference ID"
                      className="min-h-[36px] min-w-[36px] rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 transition-colors cursor-pointer shrink-0"
                    >
                      {copiedField === 'ref' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </dd>
                </div>
              )}
            </dl>
          </section>
        </div>

        {/* Thumb-Zone Footer Controls (Never bypasses restriction) */}
        <footer className="space-y-3 pt-1 pb-2">
          {statusFeedback && (
            <p
              role="status"
              aria-live="polite"
              className="text-xs text-center text-zinc-300 px-2"
            >
              {statusFeedback}
            </p>
          )}

          <button
            type="button"
            onClick={handleRefreshStatus}
            disabled={refreshing}
            className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-white text-[#09070F] hover:bg-zinc-100 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60 whitespace-nowrap"
          >
            <RefreshCw className={`w-4 h-4 shrink-0 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Checking Status...' : 'Check Updated Status'}</span>
          </button>

          <div className="flex items-center gap-2.5">
            {savedAccounts.length > 1 && (
              <button
                type="button"
                onClick={() => setShowAccountSwitcherModal(true)}
                className="flex-1 min-h-[48px] px-4 py-3 rounded-xl bg-[#181229] hover:bg-[#211938] border border-white/10 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 text-zinc-100 text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer whitespace-nowrap"
              >
                <Users className="w-4 h-4 text-zinc-300 shrink-0" />
                <span>Switch Account</span>
              </button>
            )}

            <button
              type="button"
              onClick={logout}
              className="flex-1 min-h-[48px] px-4 py-3 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/30 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 text-rose-100 text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer whitespace-nowrap"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span>Sign Out</span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};
