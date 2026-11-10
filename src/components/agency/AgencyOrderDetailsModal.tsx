import React, { useState } from 'react';
import {
  X,
  Coins,
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertCircle,
  Lock,
  Eye,
  EyeOff,
  Maximize2,
  ArrowRight,
  User,
  CreditCard,
  FileText,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { AgencyOrder } from '../../types';

interface AgencyOrderDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: AgencyOrder | null;
}

export const AgencyOrderDetailsModal: React.FC<AgencyOrderDetailsModalProps> = ({
  isOpen,
  onClose,
  order,
}) => {
  const { agencyProfile, deliverAgencyOrder, rejectAgencyOrder } = useApp();

  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [showSlipZoom, setShowSlipZoom] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isDelivering, setIsDelivering] = useState(false);

  if (!isOpen || !order) return null;

  const totalCoins = order.coins + (order.bonusCoins || 0);

  const handleDeliver = () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (pin.length !== 4) {
      setErrorMsg('Please enter your 4-digit security PIN to authorize coin delivery.');
      return;
    }

    if (totalCoins > agencyProfile.agencyBalance) {
      setErrorMsg(
        `Insufficient agency stock. Required: ${totalCoins.toLocaleString()} Coins. Available: ${agencyProfile.agencyBalance.toLocaleString()} Coins.`
      );
      return;
    }

    setIsDelivering(true);
    setTimeout(() => {
      const res = deliverAgencyOrder(order.id, pin);
      setIsDelivering(false);

      if (res.success) {
        setSuccessMsg(res.message);
        setPin('');
        setTimeout(() => {
          onClose();
        }, 1800);
      } else {
        setErrorMsg(res.message);
      }
    }, 450);
  };

  const handleReject = () => {
    const confirmReject = window.confirm(
      `Reject order #${order.orderNo}? The payment receipt will be marked as invalid.`
    );
    if (confirmReject) {
      rejectAgencyOrder(order.id, 'Payment receipt verification rejected by merchant');
      onClose();
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
        <div className="relative w-full max-w-md rounded-3xl bg-gradient-to-b from-[#1C0D34] via-[#120822] to-[#0A0414] border border-amber-400/50 shadow-2xl overflow-hidden text-white flex flex-col max-h-[92vh]">
          {/* Top Decorative Border */}
          <div className="h-1.5 w-full bg-gradient-to-r from-amber-400 via-[#EC4899] to-amber-400" />

          {/* Modal Header */}
          <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-white/10 bg-[#160A2C]/90">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#7928CA] to-[#EC4899] flex items-center justify-center text-white shadow-md">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm sm:text-base font-black text-white">Order #{order.orderNo}</h3>
                  <span
                    className={`px-1.5 py-0.2 rounded text-[8.5px] font-black uppercase ${
                      order.status === 'delivered'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : order.status === 'rejected'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        : 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
                    }`}
                  >
                    {order.status}
                  </span>
                </div>
                <p className="text-[10.5px] text-zinc-400">
                  Placed {order.createdAt} • Via {order.paymentMethod}
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
            {/* Buyer Info Card */}
            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img
                  src={order.buyerAvatar}
                  alt={order.buyerName}
                  className="w-11 h-11 rounded-2xl object-cover border border-amber-400/60 shadow"
                />
                <div>
                  <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider block">
                    Buyer Details
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-black text-white">{order.buyerName}</span>
                  </div>
                  <div className="text-[10.5px] text-amber-300 font-mono font-bold">
                    User ID: {order.buyerUniqueId}
                  </div>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] text-zinc-400 uppercase font-bold block">Paid Amount</span>
                <span className="text-sm font-black text-emerald-400">{order.price}</span>
              </div>
            </div>

            {/* Requested Package & Coins */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-purple-500/10 to-transparent border border-amber-400/30 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-zinc-400 uppercase font-bold block">Requested Coins</span>
                <div className="flex items-center gap-1.5 text-amber-300 font-mono font-black text-base mt-0.5">
                  <Coins className="w-4 h-4 fill-amber-400" />
                  <span>{order.coins.toLocaleString()}</span>
                  {order.bonusCoins > 0 && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                      +{order.bonusCoins.toLocaleString()} Bonus
                    </span>
                  )}
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] text-zinc-400 uppercase font-bold block">Total to Deliver</span>
                <span className="text-sm font-mono font-black text-white">
                  {totalCoins.toLocaleString()} Coins
                </span>
              </div>
            </div>

            {/* Payment Slip / Receipt Inspection */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-black uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-amber-400" />
                  <span>Payment Receipt / Slip</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowSlipZoom(true)}
                  className="text-[10.5px] text-amber-300 hover:text-amber-200 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Maximize2 className="w-3 h-3" />
                  <span>Enlarge Slip</span>
                </button>
              </div>

              {/* Receipt Preview Thumbnail Card */}
              <div
                onClick={() => setShowSlipZoom(true)}
                className="relative rounded-2xl overflow-hidden border border-white/20 bg-black/40 group cursor-pointer aspect-[16/9] flex items-center justify-center shadow-inner"
              >
                <img
                  src={order.receiptUrl}
                  alt={`Receipt for ${order.orderNo}`}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 group-hover:opacity-90 transition-opacity flex items-center justify-center">
                  <div className="px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/20 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg">
                    <Maximize2 className="w-3.5 h-3.5 text-amber-400" />
                    <span>Click to Inspect Full Slip</span>
                  </div>
                </div>

                {/* Corner Status Badge */}
                <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-lg bg-black/70 backdrop-blur-md text-[9.5px] font-mono text-zinc-200 border border-white/10">
                  Gateway: {order.paymentMethod}
                </div>
              </div>

              {order.note && (
                <div className="mt-2 p-2.5 rounded-xl bg-white/5 border border-white/10 text-[11px] text-zinc-300">
                  <span className="text-zinc-400 font-bold">Buyer Note: </span>
                  {order.note}
                </div>
              )}
            </div>

            {/* Step: Security PIN Required to Fulfill Order */}
            {order.status === 'pending' && (
              <div className="pt-2 border-t border-white/10">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-black uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Enter 4-Digit Security PIN</span>
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
                    className="w-full h-11 px-4 rounded-2xl bg-white/5 border border-white/15 focus:border-amber-400 focus:outline-none text-center text-lg font-mono tracking-[0.5em] font-black text-amber-300 placeholder-zinc-600"
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
                  Once confirmed, {totalCoins.toLocaleString()} Coins will be deducted from your agency balance and delivered to {order.buyerName} with a receipt notification.
                </p>
              </div>
            )}

            {/* Delivered State Notice */}
            {order.status === 'delivered' && (
              <div className="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <span className="font-bold block">Coins Delivered Successfully</span>
                  <span className="text-[10px] text-zinc-300">
                    Delivered {order.deliveredAt || 'Earlier'}. Notification sent to buyer's inbox.
                  </span>
                </div>
              </div>
            )}

            {/* Feedback Messages */}
            {errorMsg && (
              <div className="p-3 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{successMsg}</span>
              </div>
            )}
          </div>

          {/* Modal Action Footer */}
          <div className="p-4 border-t border-white/10 bg-[#0F071B]/95 flex items-center gap-2">
            {order.status === 'pending' ? (
              <>
                <button
                  type="button"
                  onClick={handleReject}
                  className="px-3.5 h-12 rounded-2xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-300 font-bold text-xs uppercase transition-colors cursor-pointer"
                >
                  Reject
                </button>

                <button
                  type="button"
                  disabled={isDelivering || pin.length !== 4}
                  onClick={handleDeliver}
                  className={`flex-1 h-12 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all ${
                    isDelivering || pin.length !== 4
                      ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed opacity-60'
                      : 'bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 text-white shadow-emerald-500/30 hover:brightness-110 active:scale-95 cursor-pointer'
                  }`}
                >
                  <Coins className="w-4 h-4 fill-current" />
                  <span>
                    {isDelivering
                      ? 'Delivering...'
                      : `Confirm & Deliver ${totalCoins.toLocaleString()} Coins`}
                  </span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="w-full h-12 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs uppercase transition-colors cursor-pointer"
              >
                Close Order
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Slip Zoom Full-Screen Modal */}
      {showSlipZoom && (
        <div
          onClick={() => setShowSlipZoom(false)}
          className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-lg flex items-center justify-center p-4 animate-fade-in cursor-zoom-out"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-lg w-full rounded-3xl overflow-hidden bg-[#160A2C] border border-amber-400/40 shadow-2xl p-3"
          >
            <div className="flex items-center justify-between pb-3 px-2 border-b border-white/10">
              <span className="text-xs font-black text-amber-300">
                Payment Slip Verification • {order.orderNo}
              </span>
              <button
                onClick={() => setShowSlipZoom(false)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-3 rounded-2xl overflow-hidden border border-white/10 max-h-[70vh] flex items-center justify-center bg-black">
              <img
                src={order.receiptUrl}
                alt="Payment Slip Zoom"
                className="max-h-[70vh] w-auto object-contain"
              />
            </div>

            <div className="mt-3 px-2 flex items-center justify-between text-[11px] text-zinc-300">
              <span>Paid via <strong className="text-white">{order.paymentMethod}</strong></span>
              <span className="font-mono text-emerald-400 font-bold">{order.price}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
