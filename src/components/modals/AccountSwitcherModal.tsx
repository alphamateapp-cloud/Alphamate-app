import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  X,
  Plus,
  LogIn,
  CheckCircle2,
  Trash2,
  Users,
  Loader2,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react';

export const AccountSwitcherModal: React.FC = () => {
  const {
    showAccountSwitcherModal,
    setShowAccountSwitcherModal,
    savedAccounts,
    maxSavedAccounts,
    currentUser,
    firebaseUser,
    isAuthenticated,
    switchAccount,
    startAddAccountFlow,
    removeSavedAccount,
  } = useApp();

  const [switchingUid, setSwitchingUid] = useState<string | null>(null);
  const [removingUid, setRemovingUid] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  if (!showAccountSwitcherModal) return null;

  const activeUid = isAuthenticated ? firebaseUser?.uid || currentUser?.id : '';
  const slotsRemaining = Math.max(0, maxSavedAccounts - savedAccounts.length);

  const handleSelectAccount = async (uid: string) => {
    setErrorMessage('');
    if (uid === activeUid && isAuthenticated) {
      setShowAccountSwitcherModal(false);
      return;
    }
    setSwitchingUid(uid);
    try {
      const res = await switchAccount(uid);
      if (!res.success) {
        setErrorMessage(
          res.error || 'Could not switch to this account automatically. Please sign in once to refresh it.'
        );
      }
    } finally {
      setSwitchingUid(null);
    }
  };

  const handleAddAccount = async (mode: 'register' | 'signin') => {
    setErrorMessage('');
    const res = await startAddAccountFlow(mode);
    if (!res.success && res.error) {
      setErrorMessage(res.error);
    }
  };

  const handleRemoveSlot = async (e: React.MouseEvent, uid: string) => {
    e.stopPropagation();
    setErrorMessage('');
    setRemovingUid(uid);
    try {
      await removeSavedAccount(uid);
    } finally {
      setRemovingUid(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={() => setShowAccountSwitcherModal(false)}
    >
      <div
        className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-[#120B22] border-t sm:border border-[#A855F7]/35 shadow-2xl shadow-[#7928CA]/30 p-5 text-white max-h-[88dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#7928CA] to-[#EC4899] flex items-center justify-center shadow-lg shadow-[#7928CA]/30">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">Switch Account</h3>
              <p className="text-[11px] text-zinc-400">
                {savedAccounts.length} / {maxSavedAccounts} accounts saved &bull; Instant 1-tap switch
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowAccountSwitcherModal(false)}
            className="w-11 h-11 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-300 hover:text-white cursor-pointer"
            aria-label="Close Switch Account"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMessage && (
          <div className="mt-3.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/40 text-rose-200 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Saved Accounts List (Up to 5) */}
        <div className="mt-4 space-y-2.5">
          {savedAccounts.length === 0 ? (
            <div className="p-5 rounded-2xl bg-[#18102E] border border-white/10 text-center text-xs text-zinc-400">
              No saved accounts yet. Sign up or log in below to add up to {maxSavedAccounts} accounts.
            </div>
          ) : (
            savedAccounts.map((acc) => {
              const isCurrent = acc.uid === activeUid && isAuthenticated;
              const isBusy = switchingUid === acc.uid;
              return (
                <div
                  key={acc.uid}
                  role="button"
                  tabIndex={0}
                  onClick={() => !switchingUid && handleSelectAccount(acc.uid)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      if (!switchingUid) handleSelectAccount(acc.uid);
                    }
                  }}
                  className={`w-full min-h-[68px] p-3 rounded-2xl border transition flex items-center justify-between gap-3 cursor-pointer ${
                    isCurrent
                      ? 'bg-gradient-to-r from-[#241445] to-[#1A0F33] border-[#EC4899]/70 shadow-lg shadow-[#7928CA]/20'
                      : 'bg-[#170F2C] hover:bg-[#21153E] border-white/10 hover:border-[#A855F7]/50'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative w-12 h-12 rounded-full p-0.5 bg-gradient-to-tr from-[#7928CA] to-[#EC4899] shrink-0">
                      <img
                        src={
                          acc.avatar ||
                          'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80'
                        }
                        alt={acc.displayName}
                        referrerPolicy="no-referrer"
                        className="w-full h-full rounded-full object-cover bg-[#09070F]"
                      />
                      {isCurrent && (
                        <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 border-2 border-[#120B22]" />
                      )}
                    </div>

                    <div className="min-w-0 text-left">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-extrabold text-white truncate">
                          {acc.displayName}
                        </span>
                        <span className="text-[10px] font-bold text-[#C084FC] shrink-0">
                          Lv.{acc.level || 1}
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-400 truncate">
                        @{acc.username} &bull; {acc.uniqueId}
                      </div>
                      {acc.email && (
                        <div className="text-[10px] text-zinc-500 truncate">{acc.email}</div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {isBusy ? (
                      <div className="px-3 py-1.5 rounded-xl bg-[#7928CA]/30 text-xs font-bold text-purple-200 flex items-center gap-1.5">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Switching</span>
                      </div>
                    ) : isCurrent ? (
                      <div className="px-2.5 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/35 text-[11px] font-bold text-emerald-300 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Active</span>
                      </div>
                    ) : (
                      <>
                        <span className="px-2.5 py-1.5 rounded-xl bg-[#29184D] border border-[#A855F7]/35 text-[11px] font-bold text-purple-200">
                          Switch
                        </span>
                        <button
                          type="button"
                          onClick={(e) => handleRemoveSlot(e, acc.uid)}
                          disabled={removingUid === acc.uid}
                          title="Remove from device"
                          className="w-11 h-11 rounded-xl bg-white/5 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-300 flex items-center justify-center transition cursor-pointer"
                        >
                          {removingUid === acc.uid ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Add Account Actions (Up to 5 total) */}
        <div className="mt-4 pt-3.5 border-t border-white/10 space-y-2.5">
          {slotsRemaining > 0 ? (
            <>
              <button
                type="button"
                onClick={() => handleAddAccount('register')}
                className="w-full min-h-[48px] rounded-2xl bg-gradient-to-r from-[#7928CA] via-[#9333EA] to-[#EC4899] text-white font-extrabold text-xs sm:text-sm shadow-lg shadow-[#7928CA]/35 hover:brightness-105 active:scale-[0.99] transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>
                  Add &amp; Sign Up New Account ({savedAccounts.length}/{maxSavedAccounts})
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleAddAccount('signin')}
                className="w-full min-h-[44px] rounded-2xl bg-[#1A1032] hover:bg-[#231642] border border-[#A855F7]/35 text-xs font-bold text-purple-200 flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <LogIn className="w-4 h-4 text-[#C084FC]" />
                <span>Log Into Existing Account</span>
              </button>
            </>
          ) : (
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-400/30 text-amber-200 text-xs text-center">
              All {maxSavedAccounts} account slots are active on this device. Tap any account above to switch instantly without a password, or remove an inactive slot to add another.
            </div>
          )}

          <div className="flex items-center justify-center gap-1.5 text-[11px] text-zinc-400 pt-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>No password or OTP required when switching between your 5 saved IDs</span>
          </div>
        </div>
      </div>
    </div>
  );
};
