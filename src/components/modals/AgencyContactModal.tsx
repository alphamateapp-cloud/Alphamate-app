import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  Star,
  CheckCircle2,
  Clock,
  Sparkles,
  Coins,
  Copy,
  Check,
  ExternalLink,
  MessageCircle,
} from 'lucide-react';
import { copyToClipboard } from '../../utils/clipboard';
import { CreateCoinOrderModal } from '../agency/CreateCoinOrderModal';

export interface OfficialAgency {
  id: string;
  name: string;
  tagline: string;
  logo: string;
  badge: 'Gold Verified' | 'Diamond Certified' | 'Crown Partner';
  badgeColor: string;
  whatsappNumber: string;
  whatsappDisplay: string;
  rating: number;
  ordersCompleted: string;
  bonusOffer: string;
  avgDeliveryTime: string;
  paymentMethods: string[];
  rates: Array<{
    amount: number;
    bonus: number;
    price: string;
  }>;
}

interface AgencyContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  agency: OfficialAgency | null;
}

export const AgencyContactModal: React.FC<AgencyContactModalProps> = ({
  isOpen,
  onClose,
  agency,
}) => {
  const [copied, setCopied] = useState(false);
  const [selectedPack, setSelectedPack] = useState<number | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);

  if (!isOpen || !agency) return null;

  const handleCopyWhatsApp = () => {
    copyToClipboard(agency.whatsappNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenWhatsApp = (packCoins?: number) => {
    const packText = packCoins ? ` for the ${packCoins.toLocaleString()} Coins package` : '';
    const message = encodeURIComponent(
      `Hello ${agency.name}! I am an Alpha Mate user and I want to purchase coins directly from your official agency${packText}. Please share payment details.`
    );
    // WhatsApp URL format
    const cleanNumber = agency.whatsappNumber.replace(/[^0-9]/g, '');
    const url = `https://wa.me/${cleanNumber}?text=${message}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-md rounded-3xl bg-gradient-to-b from-[#1C0E34] via-[#120822] to-[#0A0414] border border-amber-400/40 shadow-2xl overflow-hidden text-white flex flex-col max-h-[90vh]">
        {/* Top Gold Glowing Accent */}
        <div className="h-1.5 w-full bg-gradient-to-r from-amber-400 via-[#EC4899] to-amber-400" />

        {/* Modal Header */}
        <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-white/10 bg-[#160A2C]/80">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img
                src={agency.logo}
                alt={agency.name}
                className="w-11 h-11 rounded-2xl object-cover border-2 border-amber-400/80 shadow-md"
              />
              <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border border-black flex items-center justify-center text-[8px] text-white font-bold">
                ✓
              </span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm sm:text-base font-black text-white">{agency.name}</h3>
                <span className="px-1.5 py-0.2 rounded-md bg-amber-400/20 text-amber-300 text-[8.5px] font-extrabold border border-amber-400/30">
                  OFFICIAL
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10.5px] text-zinc-400 mt-0.5">
                <span className="flex items-center gap-0.5 text-amber-400 font-bold">
                  <Star className="w-3 h-3 fill-amber-400" />
                  <span>{agency.rating}</span>
                </span>
                <span>•</span>
                <span className="text-zinc-300">{agency.ordersCompleted} Orders</span>
                <span>•</span>
                <span className="text-emerald-400 font-semibold">{agency.avgDeliveryTime} Delivery</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Content */}
        <div className="px-5 py-4 overflow-y-auto space-y-3.5 scrollbar-none flex-1">
          {/* Official Guarantee Banner */}
          <div className="p-3 rounded-2xl bg-gradient-to-r from-amber-500/15 via-purple-500/10 to-pink-500/15 border border-amber-400/30 flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0" />
            <div className="text-[11px] leading-snug">
              <span className="font-bold text-amber-200 block">Get coins from official agency direct</span>
              <span className="text-zinc-300 text-[10px]">
                Authorized coin merchant. Safe, secure, and 100% genuine top-ups delivered to your Alpha Mate ID.
              </span>
            </div>
          </div>

          {/* Bonus Promo Callout */}
          <div className="p-2.5 rounded-xl bg-[#231240] border border-[#EC4899]/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#EC4899]" />
              <span className="text-xs font-bold text-white">Special Agency Promotion</span>
            </div>
            <span className="px-2 py-0.5 rounded-md bg-[#EC4899] text-white text-[10px] font-black uppercase shadow">
              {agency.bonusOffer}
            </span>
          </div>

          {/* Quick Rate Packages */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-zinc-300">
                Official Agency Rates
              </span>
              <span className="text-[10px] text-amber-400 font-bold">Tap a pack to order</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {agency.rates.map((pack) => {
                const isSelected = selectedPack === pack.amount;

                return (
                  <div
                    key={pack.amount}
                    onClick={() => setSelectedPack(pack.amount)}
                    className={`p-2.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-gradient-to-r from-amber-500/25 to-pink-500/25 border-amber-400 shadow-md shadow-amber-500/20 scale-[1.02]'
                        : 'bg-white/5 border-white/10 hover:border-amber-400/40 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-amber-300 font-mono font-bold text-xs">
                        <Coins className="w-3.5 h-3.5 fill-amber-400" />
                        <span>{pack.amount.toLocaleString()}</span>
                      </div>
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-black">
                        +{pack.bonus.toLocaleString()} Extra
                      </span>
                    </div>

                    <div className="mt-2 flex items-center justify-between pt-1 border-t border-white/5">
                      <span className="text-[10px] text-zinc-400">Direct Price</span>
                      <span className="text-xs font-black text-white">{pack.price}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Accepted Payment Methods */}
          <div className="p-3 rounded-2xl bg-white/5 border border-white/5 space-y-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">
              Supported Payment Gateways
            </span>
            <div className="flex flex-wrap gap-1.5">
              {agency.paymentMethods.map((method) => (
                <span
                  key={method}
                  className="px-2.5 py-1 rounded-lg bg-[#1B0F33] border border-purple-500/25 text-[10px] font-bold text-purple-200"
                >
                  {method}
                </span>
              ))}
            </div>
          </div>

          {/* Direct WhatsApp Contact Details */}
          <div className="p-3.5 rounded-2xl bg-[#0F2018]/90 border border-emerald-500/40 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center text-black shadow-md">
                <MessageCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="text-[9.5px] text-emerald-400 font-bold uppercase tracking-wider block">
                  Official WhatsApp Contact
                </span>
                <span className="text-xs sm:text-sm font-mono font-bold text-white">
                  {agency.whatsappDisplay}
                </span>
              </div>
            </div>

            <button
              onClick={handleCopyWhatsApp}
              className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {/* Modal Action CTA */}
        <div className="p-4 border-t border-white/10 bg-[#0F071B]/95 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setShowOrderModal(true)}
              className="h-12 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/25 hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer"
            >
              <Coins className="w-4 h-4 fill-current" />
              <span>Order In-App 📝</span>
            </button>

            <button
              onClick={() => handleOpenWhatsApp(selectedPack || undefined)}
              className="h-12 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/30 hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer"
            >
              <MessageCircle className="w-4 h-4 fill-current" />
              <span>WhatsApp 💬</span>
            </button>
          </div>

          <p className="text-[9.5px] text-zinc-400 text-center">
            Submit payment slip in-app or chat directly with official agency support.
          </p>
        </div>
      </div>

      {/* In-App Order Creation Dialog */}
      <CreateCoinOrderModal
        isOpen={showOrderModal}
        onClose={() => setShowOrderModal(false)}
        agencyName={agency.name}
      />
    </div>
  );
};
