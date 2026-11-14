import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { AlphaMateLogo } from '../components/brand/AlphaMateLogo';
import {
  RotateCcw,
  Clock,
  PauseCircle,
  Trash2,
  AlertTriangle,
  LogOut,
  CheckCircle2,
  Mail,
} from 'lucide-react';

export const AccountRecoveryScreen: React.FC = () => {
  const {
    currentUser,
    firebaseUser,
    customLogoUrl,
    recoverCurrentAccount,
    logout,
    setCurrentScreen,
  } = useApp();

  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [recovering, setRecovering] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const status = currentUser?.accountStatus || 'deactivated';
  const scheduledIso = currentUser?.scheduledPermanentDeletionAt;
  const scheduledMs = scheduledIso ? Date.parse(scheduledIso) : NaN;
  const remainingMs = Number.isFinite(scheduledMs) ? Math.max(0, scheduledMs - nowMs) : 0;
  const isExpiredPending =
    status === 'permanently_deleted' ||
    (status === 'pending_deletion' && Number.isFinite(scheduledMs) && remainingMs <= 0);

  const daysLeft = Math.floor(remainingMs / (24 * 60 * 60 * 1000));
  const hoursLeft = Math.floor((remainingMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minsLeft = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));

  const handleRecover = async () => {
    setErrorMsg(null);
    setRecovering(true);
    const res = await recoverCurrentAccount();
    setRecovering(false);
    if (!res.success) {
      setErrorMsg(res.error || 'Could not recover your account right now. Please try again.');
    }
  };

  return (
    <div className="w-full h-full min-h-screen flex-1 bg-[#09070F] text-white overflow-y-auto px-4 py-8 flex items-center justify-center">
      <div className="w-full max-w-md rounded-3xl bg-gradient-to-b from-[#170F2D] to-[#100920] border border-[#A855F7]/30 p-6 shadow-2xl space-y-5">
        {/* Brand Header */}
        <div className="flex items-center justify-between">
          <AlphaMateLogo size="sm" showText={true} customLogoUrl={customLogoUrl} />
          <span
            className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
              isExpiredPending
                ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                : status === 'pending_deletion'
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                : 'bg-purple-500/20 border-purple-500/40 text-purple-200'
            }`}
          >
            {isExpiredPending
              ? 'Deletion Finalized'
              : status === 'pending_deletion'
              ? '15-Day Pending Deletion'
              : 'Deactivated Account'}
          </span>
        </div>

        {/* User Card */}
        <div className="rounded-2xl bg-[#0B0617] border border-white/10 p-3.5 flex items-center gap-3">
          <img
            src={currentUser.avatar}
            alt={currentUser.displayName}
            className="w-11 h-11 rounded-2xl object-cover border border-[#A855F7]/40 shrink-0"
          />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-white truncate">{currentUser.displayName}</div>
            <div className="text-xs text-zinc-400 truncate">
              {firebaseUser?.email || currentUser.email} &bull; {currentUser.uniqueId}
            </div>
          </div>
        </div>

        {/* Status Message */}
        {isExpiredPending ? (
          <div className="rounded-2xl bg-rose-500/10 border border-rose-500/35 p-4 space-y-2">
            <div className="flex items-center gap-2 text-rose-300 font-bold text-sm">
              <Trash2 className="w-4 h-4 shrink-0" />
              <span>15-Day Recovery Window Has Expired</span>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed">
              The 15-day official pending deletion window for this account has concluded. This account is queued for
              final removal or has already been permanently deleted and can no longer be restored.
            </p>
            <a
              href="mailto:support@alphamate.app"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#D8B4FE] underline pt-1"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>support@alphamate.app</span>
            </a>
          </div>
        ) : status === 'pending_deletion' ? (
          <div className="rounded-2xl bg-amber-500/10 border border-amber-400/35 p-4 space-y-3">
            <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
              <Clock className="w-4 h-4 shrink-0" />
              <span>Permanent Deletion Scheduled (Pending Official)</span>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed">
              You verified permanent deletion via Email OTP. Your account will be permanently deleted in:
            </p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-[#0B0617] border border-amber-400/20 py-2">
                <div className="text-lg font-black font-mono text-white">{daysLeft}</div>
                <div className="text-[10px] uppercase text-zinc-400">Days</div>
              </div>
              <div className="rounded-xl bg-[#0B0617] border border-amber-400/20 py-2">
                <div className="text-lg font-black font-mono text-white">{hoursLeft}</div>
                <div className="text-[10px] uppercase text-zinc-400">Hours</div>
              </div>
              <div className="rounded-xl bg-[#0B0617] border border-amber-400/20 py-2">
                <div className="text-lg font-black font-mono text-white">{minsLeft}</div>
                <div className="text-[10px] uppercase text-zinc-400">Minutes</div>
              </div>
            </div>
            {scheduledIso && (
              <div className="text-[11px] text-zinc-400">
                Scheduled Deletion Date:{' '}
                <span className="text-amber-200 font-semibold">
                  {new Date(scheduledIso).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-2xl bg-[#7928CA]/15 border border-[#A855F7]/35 p-4 space-y-2">
            <div className="flex items-center gap-2 text-[#D8B4FE] font-bold text-sm">
              <PauseCircle className="w-4 h-4 shrink-0" />
              <span>Account Temporarily Deactivated</span>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed">
              Your account was deactivated without permanent deletion. There is{' '}
              <strong className="text-white">no time limit</strong> to recover it—all your Coins (
              {(currentUser.coins || 0).toLocaleString()}), Diamonds ({(currentUser.diamonds || 0).toLocaleString()}),
              and VIP status are safely intact.
            </p>
          </div>
        )}

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-200 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-2.5 pt-1">
          {!isExpiredPending && (
            <button
              type="button"
              disabled={recovering}
              onClick={handleRecover}
              className="w-full min-h-[48px] px-5 rounded-2xl bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-[#7928CA]/30 hover:brightness-110 disabled:opacity-60 cursor-pointer transition"
            >
              {recovering ? (
                <span>Restoring Account...</span>
              ) : (
                <>
                  <RotateCcw className="w-4 h-4" />
                  <span>
                    {status === 'pending_deletion' ? 'Cancel Deletion & Recover Account' : 'Reactivate My Account Now'}
                  </span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={logout}
            className="w-full min-h-[44px] px-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>

          <button
            type="button"
            onClick={() => setCurrentScreen('delete_account')}
            className="w-full min-h-[40px] text-[11px] text-zinc-400 hover:text-[#D8B4FE] flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Read Account Deletion &amp; Recovery Policy</span>
          </button>
        </div>
      </div>
    </div>
  );
};
