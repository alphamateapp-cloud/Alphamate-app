import React, { useState } from 'react';
import {
  X,
  Lock,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  KeyRound,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface AgencyPinSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AgencyPinSetupModal: React.FC<AgencyPinSetupModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { agencyProfile, setAgencySecurityPin } = useApp();

  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (agencyProfile.isPinSet && currentPin.length !== 4) {
      setErrorMsg('Please enter your current 4-digit PIN');
      return;
    }

    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      setErrorMsg('New PIN must be exactly 4 numeric digits (0-9)');
      return;
    }

    if (newPin !== confirmPin) {
      setErrorMsg('New PIN and Confirm PIN do not match');
      return;
    }

    const res = setAgencySecurityPin(currentPin, newPin);
    if (res.success) {
      setSuccessMsg(res.message);
      setTimeout(() => {
        onClose();
      }, 1500);
    } else {
      setErrorMsg(res.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-sm rounded-3xl bg-gradient-to-b from-[#1C0D34] via-[#120822] to-[#0A0414] border border-amber-400/50 shadow-2xl overflow-hidden text-white flex flex-col">
        {/* Top Gold Bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-amber-400 via-[#EC4899] to-amber-400" />

        {/* Modal Header */}
        <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-white/10 bg-[#160A2C]/90">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-black shadow">
              <KeyRound className="w-5 h-5 text-black" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-white">Security PIN Settings</h3>
              <p className="text-[10px] text-zinc-400">4-Digit Transfer Authorization PIN</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3.5">
          <div className="p-3 rounded-2xl bg-amber-400/10 border border-amber-400/30 text-[11px] text-amber-200 leading-snug">
            Your 4-digit security PIN is required whenever transferring coins or fulfilling orders to keep your stock safe.
          </div>

          {/* Current PIN */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-black uppercase tracking-wider text-zinc-300">
                Current PIN
              </label>
              <span className="text-[9.5px] text-zinc-400">Default: 1234</span>
            </div>
            <input
              type={showPin ? 'text' : 'password'}
              maxLength={4}
              value={currentPin}
              onChange={(e) => setCurrentPin(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="••••"
              className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/15 focus:border-amber-400 focus:outline-none text-center text-base font-mono tracking-[0.5em] font-black text-white"
            />
          </div>

          {/* New PIN */}
          <div>
            <label className="text-[11px] font-black uppercase tracking-wider text-zinc-300 block mb-1">
              New 4-Digit PIN
            </label>
            <input
              type={showPin ? 'text' : 'password'}
              maxLength={4}
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="••••"
              className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/15 focus:border-amber-400 focus:outline-none text-center text-base font-mono tracking-[0.5em] font-black text-amber-300"
            />
          </div>

          {/* Confirm New PIN */}
          <div>
            <label className="text-[11px] font-black uppercase tracking-wider text-zinc-300 block mb-1">
              Confirm New PIN
            </label>
            <input
              type={showPin ? 'text' : 'password'}
              maxLength={4}
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="••••"
              className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/15 focus:border-amber-400 focus:outline-none text-center text-base font-mono tracking-[0.5em] font-black text-amber-300"
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => setShowPin(!showPin)}
              className="text-[10.5px] text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer"
            >
              {showPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{showPin ? 'Hide Digits' : 'Show Digits'}</span>
            </button>
          </div>

          {/* Alerts */}
          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          <div className="pt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-11 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 font-bold text-xs uppercase cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 h-11 rounded-xl bg-gradient-to-r from-amber-400 to-amber-600 text-black font-black text-xs uppercase tracking-wider hover:brightness-110 active:scale-95 cursor-pointer shadow-lg shadow-amber-500/25"
            >
              Save PIN
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
