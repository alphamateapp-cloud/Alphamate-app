import React, { useState, useRef } from 'react';
import {
  X,
  Coins,
  Upload,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  CreditCard,
  FileCheck,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { compressImage } from '../../utils/imageCompressor';

interface CreateCoinOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  agencyName?: string;
}

const SAMPLE_PACKAGES = [
  { amount: 10000, bonus: 1500, price: 'Rs. 2,500' },
  { amount: 50000, bonus: 8000, price: 'Rs. 11,900' },
  { amount: 100000, bonus: 18000, price: 'Rs. 22,500' },
  { amount: 500000, bonus: 100000, price: 'Rs. 105,000' },
];

const PAYMENT_METHODS = [
  'JazzCash',
  'EasyPaisa',
  'Bank Transfer / Raast',
  'USDT / Crypto',
];

export const CreateCoinOrderModal: React.FC<CreateCoinOrderModalProps> = ({
  isOpen,
  onClose,
  agencyName = 'Alpha Mate Official Exchange',
}) => {
  const { currentUser, createBuyerCoinOrder } = useApp();

  const [selectedPackIndex, setSelectedPackIndex] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0]);
  const [buyerUniqueId, setBuyerUniqueId] = useState(currentUser.uniqueId);
  const [note, setNote] = useState('');
  const [receiptImage, setReceiptImage] = useState<string>(
    'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=600&q=80'
  );
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const selectedPack = SAMPLE_PACKAGES[selectedPackIndex];

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      try {
        const compressed = await compressImage(file, 800, 600, 0.8);
        setReceiptImage(compressed);
      } catch {
        setErrorMsg('Could not process receipt image. Using standard verification preview.');
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!buyerUniqueId.trim()) {
      setErrorMsg('Please confirm your Alpha Mate Unique ID');
      return;
    }

    if (!receiptImage) {
      setErrorMsg('Please attach your payment receipt / slip image');
      return;
    }

    createBuyerCoinOrder({
      buyerId: currentUser.id,
      buyerUniqueId: buyerUniqueId.trim(),
      buyerName: currentUser.displayName,
      buyerAvatar: currentUser.avatar,
      coins: selectedPack.amount,
      bonusCoins: selectedPack.bonus,
      price: selectedPack.price,
      paymentMethod,
      receiptUrl: receiptImage,
      note: note.trim() || `Order for ${selectedPack.amount.toLocaleString()} Coins via ${paymentMethod}`,
    });

    setIsSuccess(true);
    setTimeout(() => {
      setIsSuccess(false);
      onClose();
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-md rounded-3xl bg-gradient-to-b from-[#1C0D34] via-[#120822] to-[#0A0414] border border-amber-400/50 shadow-2xl overflow-hidden text-white flex flex-col max-h-[92vh]">
        {/* Top Gold Bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-amber-400 via-[#EC4899] to-amber-400" />

        {/* Modal Header */}
        <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-white/10 bg-[#160A2C]/90">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-[#EC4899] flex items-center justify-center text-black shadow-md">
              <Coins className="w-5 h-5 text-black fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm sm:text-base font-black text-white">Order Coins In-App</h3>
                <span className="px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 text-[8.5px] font-black border border-amber-400/40">
                  OFFICIAL
                </span>
              </div>
              <p className="text-[10px] text-zinc-400">{agencyName}</p>
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
        {isSuccess ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h4 className="text-lg font-black text-white">Order Submitted Successfully!</h4>
            <p className="text-xs text-zinc-300 max-w-xs mx-auto">
              Your payment receipt and order details have been delivered to the official agency. Coins will be credited to your ID shortly.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-5 py-4 overflow-y-auto space-y-4 scrollbar-none flex-1">
            {/* Step 1: Select Package */}
            <div>
              <label className="text-[11px] font-black uppercase tracking-wider text-zinc-300 block mb-1.5">
                1. Select Coin Package
              </label>
              <div className="grid grid-cols-2 gap-2">
                {SAMPLE_PACKAGES.map((pkg, idx) => {
                  const isSelected = selectedPackIndex === idx;
                  return (
                    <button
                      key={pkg.amount}
                      type="button"
                      onClick={() => setSelectedPackIndex(idx)}
                      className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-gradient-to-r from-amber-500/25 to-pink-500/25 border-amber-400 shadow-md scale-[1.02]'
                          : 'bg-white/5 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-amber-300 text-xs">
                          {pkg.amount.toLocaleString()} Coins
                        </span>
                        <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                          +{pkg.bonus.toLocaleString()}
                        </span>
                      </div>
                      <div className="text-xs font-black text-white mt-1">{pkg.price}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Confirm Buyer ID */}
            <div>
              <label className="text-[11px] font-black uppercase tracking-wider text-zinc-300 block mb-1">
                2. Recipient Alpha Mate Unique ID
              </label>
              <input
                type="text"
                value={buyerUniqueId}
                onChange={(e) => setBuyerUniqueId(e.target.value)}
                placeholder="e.g. AM_884920"
                className="w-full h-11 px-3.5 rounded-xl bg-white/5 border border-white/15 focus:border-amber-400 focus:outline-none text-xs font-mono font-bold text-amber-300"
              />
            </div>

            {/* Step 3: Payment Method */}
            <div>
              <label className="text-[11px] font-black uppercase tracking-wider text-zinc-300 block mb-1">
                3. Payment Method Used
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl bg-[#1B0E33] border border-white/15 focus:border-amber-400 focus:outline-none text-xs text-white"
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m} className="bg-[#1B0E33]">
                    {m}
                  </option>
                ))}
              </select>
            </div>

            {/* Step 4: Attach Payment Receipt / Slip */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-black uppercase tracking-wider text-zinc-300">
                  4. Attach Payment Slip / Receipt Screenshot
                </label>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-[10.5px] text-amber-300 hover:text-amber-200 font-bold cursor-pointer"
                >
                  Upload New Slip
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                className="rounded-2xl border border-dashed border-amber-400/50 bg-black/30 p-2.5 flex items-center gap-3 cursor-pointer hover:bg-black/40 transition-colors"
              >
                <img
                  src={receiptImage}
                  alt="Receipt Preview"
                  className="w-16 h-12 rounded-xl object-cover border border-white/10 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-bold text-white block truncate">
                    {isUploading ? 'Compressing Slip...' : 'Payment Slip Attached'}
                  </span>
                  <span className="text-[10px] text-zinc-400">
                    Click to replace with your transfer screenshot
                  </span>
                </div>
                <div className="w-8 h-8 rounded-xl bg-amber-400/20 text-amber-300 flex items-center justify-center shrink-0">
                  <Upload className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* Optional Note / TID */}
            <div>
              <label className="text-[11px] font-black uppercase tracking-wider text-zinc-300 block mb-1">
                Transaction ID / Reference Note (Optional)
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. TID: 994820124 or sender phone number"
                className="w-full h-10 px-3.5 rounded-xl bg-white/5 border border-white/15 focus:border-amber-400 focus:outline-none text-xs text-white"
              />
            </div>

            {errorMsg && (
              <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                className="w-full h-12 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-amber-500/30 hover:brightness-110 active:scale-95 cursor-pointer"
              >
                <FileCheck className="w-4 h-4" />
                <span>Submit Order ({selectedPack.price})</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
