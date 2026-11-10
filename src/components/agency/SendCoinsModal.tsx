import React, { useState } from 'react';
import {
  X,
  Search,
  ShieldCheck,
  Coins,
  Lock,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  UserCheck,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { User } from '../../types';

interface SendCoinsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
}

export const SendCoinsModal: React.FC<SendCoinsModalProps> = ({
  isOpen,
  onClose,
  initialQuery = '',
}) => {
  const { agencyProfile, sendAgencyCoins, findUserByIdOrUsername } = useApp();

  const [query, setQuery] = useState(initialQuery);
  const [recipient, setRecipient] = useState<User | null>(() => {
    return initialQuery ? findUserByIdOrUsername(initialQuery) : null;
  });
  const [searchError, setSearchError] = useState<string | null>(null);

  const [amount, setAmount] = useState<string>('50000');
  const [pin, setPin] = useState<string>('');
  const [showPin, setShowPin] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSearchUser = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSearchError(null);
    setErrorMsg(null);

    if (!query.trim()) {
      setSearchError('Please enter a User ID or Username');
      setRecipient(null);
      return;
    }

    const found = findUserByIdOrUsername(query);
    if (found) {
      setRecipient(found);
    } else {
      setRecipient(null);
      setSearchError('No user found matching this User ID or Username');
    }
  };

  const handleQuickAmount = (val: number) => {
    setAmount(val.toString());
  };

  const handleTransfer = () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!recipient) {
      setErrorMsg('Please search and verify the recipient user first');
      return;
    }

    const numAmount = parseInt(amount.replace(/[^0-9]/g, ''), 10);
    if (!numAmount || numAmount <= 0) {
      setErrorMsg('Please enter a valid coin transfer amount');
      return;
    }

    if (numAmount > agencyProfile.agencyBalance) {
      setErrorMsg(`Insufficient agency balance. You have ${agencyProfile.agencyBalance.toLocaleString()} Coins.`);
      return;
    }

    if (!pin || pin.length !== 4) {
      setErrorMsg('Please enter your 4-digit security PIN');
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      const res = sendAgencyCoins(recipient.uniqueId || recipient.username, numAmount, pin);
      setIsSubmitting(false);

      if (res.success) {
        setSuccessMsg(res.message);
        setPin('');
        setTimeout(() => {
          onClose();
        }, 1800);
      } else {
        setErrorMsg(res.message);
      }
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-md rounded-3xl bg-gradient-to-b from-[#1C0D34] via-[#120822] to-[#0A0414] border border-amber-400/50 shadow-2xl overflow-hidden text-white flex flex-col max-h-[92vh]">
        {/* Top Gold Bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-amber-400 via-[#EC4899] to-amber-400" />

        {/* Modal Header */}
        <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-white/10 bg-[#160A2C]/90">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-black shadow-md">
              <Coins className="w-5 h-5 text-black fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm sm:text-base font-black text-white">Send Coins (Official Agency)</h3>
                <span className="px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 text-[8.5px] font-black border border-amber-400/40">
                  INSTANT
                </span>
              </div>
              <p className="text-[10px] text-zinc-400">
                Stock Balance: <span className="text-amber-300 font-mono font-bold">{agencyProfile.agencyBalance.toLocaleString()} Coins</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="px-5 py-4 overflow-y-auto space-y-4 scrollbar-none flex-1">
          {/* Step 1: Search Recipient User */}
          <div>
            <label className="text-[11px] font-black uppercase tracking-wider text-zinc-300 block mb-1.5">
              1. Recipient User ID or Username
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setSearchError(null);
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchUser()}
                  placeholder="e.g. AM_664129 or sophia"
                  className="w-full h-11 pl-3.5 pr-10 rounded-2xl bg-white/5 border border-white/15 focus:border-amber-400 focus:outline-none text-xs text-white placeholder-zinc-500 font-medium"
                />
                <button
                  type="button"
                  onClick={() => handleSearchUser()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-xl bg-amber-400 hover:bg-amber-300 text-black flex items-center justify-center transition-colors cursor-pointer shadow"
                >
                  <Search className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {searchError && (
              <p className="text-[11px] text-rose-400 flex items-center gap-1 mt-1 font-medium">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{searchError}</span>
              </p>
            )}
          </div>

          {/* Verified Recipient Card */}
          {recipient && (
            <div className="p-3 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-transparent border border-emerald-500/40 animate-fade-in flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <img
                    src={recipient.avatar}
                    alt={recipient.displayName}
                    className="w-11 h-11 rounded-2xl object-cover border border-emerald-400/80 shadow"
                  />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border border-black flex items-center justify-center text-[8px] text-white font-bold">
                    ✓
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs sm:text-sm font-black text-white">{recipient.displayName}</span>
                    <span className="px-1.5 py-0.2 rounded bg-purple-500/30 text-purple-200 text-[8.5px] font-bold border border-purple-400/30">
                      Lv.{recipient.level}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-zinc-300 mt-0.5 font-mono">
                    <span className="text-emerald-400 font-bold">ID: {recipient.uniqueId}</span>
                    <span>•</span>
                    <span className="text-zinc-400">@{recipient.username}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 text-emerald-400 text-[10px] font-bold px-2 py-1 rounded-lg bg-emerald-500/20">
                <UserCheck className="w-3.5 h-3.5" />
                <span>Verified</span>
              </div>
            </div>
          )}

          {/* Step 2: Coin Amount */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-black uppercase tracking-wider text-zinc-300">
                2. Coin Amount
              </label>
              <span className="text-[10px] text-zinc-400">
                Available: <span className="text-amber-300 font-mono font-bold">{agencyProfile.agencyBalance.toLocaleString()}</span>
              </span>
            </div>

            <div className="relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-amber-400 flex items-center">
                <Coins className="w-4 h-4 fill-amber-400" />
              </div>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="w-full h-12 pl-10 pr-4 rounded-2xl bg-white/5 border border-white/15 focus:border-amber-400 focus:outline-none text-base font-mono font-black text-white placeholder-zinc-500"
              />
            </div>

            {/* Quick Amount Chips */}
            <div className="grid grid-cols-4 gap-1.5 mt-2">
              {[10000, 50000, 100000, 500000].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => handleQuickAmount(val)}
                  className="py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-mono font-bold text-zinc-300 hover:text-white transition-colors cursor-pointer"
                >
                  +{(val / 1000)}k
                </button>
              ))}
            </div>
          </div>

          {/* Step 3: 4-Digit Security PIN */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-black uppercase tracking-wider text-zinc-300 flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>3. Enter 4-Digit Security PIN</span>
              </label>
              <span className="text-[9.5px] text-zinc-400">Default: 1234</span>
            </div>

            <div className="relative">
              <input
                type={showPin ? 'text' : 'password'}
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="••••"
                className="w-full h-12 px-4 rounded-2xl bg-white/5 border border-white/15 focus:border-amber-400 focus:outline-none text-center text-xl font-mono tracking-[0.5em] font-black text-amber-300 placeholder-zinc-600"
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white p-1"
              >
                {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[9.5px] text-zinc-400 mt-1">
              Required for all agency coin transfers to protect your stock balance.
            </p>
          </div>

          {/* Feedback Messages */}
          {errorMsg && (
            <div className="p-3 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2 animate-fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-white/10 bg-[#0F071B]/95 flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-12 rounded-2xl bg-white/5 hover:bg-white/10 text-zinc-300 font-bold text-xs uppercase transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={isSubmitting || !recipient || !amount || pin.length !== 4}
            onClick={handleTransfer}
            className={`flex-[2] h-12 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all ${
              isSubmitting || !recipient || !amount || pin.length !== 4
                ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed opacity-60'
                : 'bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-black shadow-amber-500/30 hover:brightness-110 active:scale-95 cursor-pointer'
            }`}
          >
            <Coins className="w-4 h-4 fill-current" />
            <span>{isSubmitting ? 'Verifying & Sending...' : 'Authorize & Send Coins'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
