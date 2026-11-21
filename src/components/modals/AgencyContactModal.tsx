import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  Sparkles,
  Coins,
  Copy,
  Check,
  MessageCircle,
  MessageSquare,
  CheckCircle2,
  UserCheck,
  Hash,
  AlertCircle,
} from 'lucide-react';
import { copyToClipboard } from '../../utils/clipboard';
import { CreateCoinOrderModal } from '../agency/CreateCoinOrderModal';
import { useApp } from '../../context/AppContext';
import { buildWhatsAppUrl, openExternalWhatsApp } from '../../services/agencySyncService';

export interface OfficialAgency {
  id: string;
  agencyCode: string;
  name: string;
  tagline: string;
  logo: string;
  badge: 'Gold Verified' | 'Diamond Certified' | 'Crown Partner';
  badgeColor: string;
  ownerUserId: string;
  ownerName?: string;
  ownerAvatar?: string;
  whatsappNumber: string;
  whatsappDisplay: string;
  hasValidWhatsApp: boolean;
  status: 'active' | 'suspended' | 'hold' | 'inactive';
  agencyBalance?: number;
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

const getAgencyInitials = (name: string): string => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return `${words[0][0]}${words[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase() || 'AM';
};

export const AgencyContactModal: React.FC<AgencyContactModalProps> = ({
  isOpen,
  onClose,
  agency,
}) => {
  const { contactAgencyInApp } = useApp();
  const [copied, setCopied] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [selectedPack, setSelectedPack] = useState<number | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [contactLoading, setContactLoading] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);

  if (!isOpen || !agency) return null;

  const hasWhatsApp = Boolean(agency.hasValidWhatsApp && agency.whatsappNumber);
  const canContactInApp = Boolean(agency.ownerUserId);

  const handleCopyWhatsApp = () => {
    if (!hasWhatsApp) return;
    copyToClipboard(agency.whatsappDisplay || agency.whatsappNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyCode = () => {
    if (!agency.agencyCode) return;
    copyToClipboard(agency.agencyCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleOpenWhatsApp = (packCoins?: number) => {
    if (!hasWhatsApp) return;
    const packText = packCoins ? ` for the ${packCoins.toLocaleString()} Coins package` : '';
    const url = buildWhatsAppUrl(
      agency.whatsappNumber,
      `Hello ${agency.name} (Code: ${agency.agencyCode})! I am an Alpha Mate user and I want to purchase coins directly from your Official Coin Seller Agency${packText}. Please share payment details.`
    );
    if (url) {
      openExternalWhatsApp(url);
    }
  };

  const handleContactInApp = async () => {
    setContactError(null);
    setContactLoading(true);
    try {
      const res = await contactAgencyInApp({
        agencyId: agency.id,
        agencyName: agency.name,
        agencyCode: agency.agencyCode,
        ownerUserId: agency.ownerUserId,
        ownerName: agency.ownerName,
        ownerAvatar: agency.ownerAvatar,
      });
      if (res.success) {
        onClose();
      } else {
        setContactError(res.message);
      }
    } finally {
      setContactLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-md rounded-3xl bg-gradient-to-b from-[#1C0E34] via-[#120822] to-[#0A0414] border border-amber-400/40 shadow-2xl overflow-hidden text-white flex flex-col max-h-[90vh]">
        {/* Top Gold Glowing Accent */}
        <div className="h-1.5 w-full bg-gradient-to-r from-amber-400 via-[#EC4899] to-amber-400" />

        {/* Modal Header */}
        <div className="px-5 pt-4 pb-3 flex items-center justify-between gap-2 border-b border-white/10 bg-[#160A2C]/80">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              {agency.logo ? (
                <img
                  src={agency.logo}
                  alt={agency.name}
                  className="w-11 h-11 rounded-2xl object-cover border-2 border-amber-400/80 shadow-md"
                />
              ) : (
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 via-[#EC4899] to-[#7928CA] border-2 border-amber-300/80 shadow-md flex items-center justify-center text-white font-black text-sm">
                  {getAgencyInitials(agency.name)}
                </div>
              )}
              <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border border-black flex items-center justify-center text-[8px] text-white font-bold">
                ✓
              </span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="text-sm sm:text-base font-black text-white truncate">{agency.name}</h3>
                <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[8.5px] font-extrabold border border-emerald-500/40 uppercase">
                  ACTIVE
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-amber-300 font-bold mt-0.5 flex-wrap">
                <span>Official Coin Seller Agency</span>
                {agency.agencyCode && (
                  <>
                    <span className="text-zinc-500">•</span>
                    <button
                      type="button"
                      onClick={handleCopyCode}
                      className="inline-flex items-center gap-1 font-mono text-zinc-200 hover:text-amber-300 cursor-pointer"
                      title="Copy Agency Code"
                    >
                      <Hash className="w-2.5 h-2.5 text-amber-400" />
                      <span>{agency.agencyCode}</span>
                      {copiedCode ? (
                        <Check className="w-2.5 h-2.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-2.5 h-2.5 opacity-70" />
                      )}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Content */}
        <div className="px-5 py-4 overflow-y-auto space-y-3.5 scrollbar-none flex-1">
          {contactError && (
            <div className="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{contactError}</span>
            </div>
          )}

          {/* Official Guarantee Banner */}
          <div className="p-3 rounded-2xl bg-gradient-to-r from-amber-500/15 via-purple-500/10 to-pink-500/15 border border-amber-400/30 flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0" />
            <div className="text-[11px] leading-snug">
              <span className="font-bold text-amber-200 block">
                Be Alpha Mate — Official Coin Seller Agency
              </span>
              <span className="text-zinc-300 text-[10px]">
                Activated and verified by Alpha Mate Super Admin. Contact directly in-app or via official WhatsApp for safe coin top-ups.
              </span>
            </div>
          </div>

          {/* Agency Metadata Summary */}
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2.5 rounded-2xl bg-white/5 border border-white/10">
              <span className="text-[9.5px] uppercase font-bold text-zinc-400 block">Agency Code</span>
              <span className="text-xs font-mono font-black text-amber-300 mt-0.5 block truncate">
                {agency.agencyCode || 'OFFICIAL'}
              </span>
            </div>
            <div className="p-2.5 rounded-2xl bg-white/5 border border-white/10">
              <span className="text-[9.5px] uppercase font-bold text-zinc-400 block">Status</span>
              <span className="text-xs font-black text-emerald-400 mt-0.5 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Active Official</span>
              </span>
            </div>
          </div>

          {agency.ownerName && (
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <UserCheck className="w-4 h-4 text-purple-300 shrink-0" />
                <div className="min-w-0">
                  <span className="text-[9.5px] text-zinc-400 uppercase font-bold block">
                    Authorized Agency Owner
                  </span>
                  <span className="text-xs font-bold text-white truncate block">{agency.ownerName}</span>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-md bg-purple-500/20 border border-purple-400/30 text-[9px] font-bold text-purple-200 shrink-0">
                In-App Ready
              </span>
            </div>
          )}

          {/* Bonus Promo Callout */}
          {agency.bonusOffer && (
            <div className="p-2.5 rounded-xl bg-[#231240] border border-[#EC4899]/30 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Sparkles className="w-4 h-4 text-[#EC4899] shrink-0" />
                <span className="text-xs font-bold text-white truncate">Agency Status</span>
              </div>
              <span className="px-2 py-0.5 rounded-md bg-[#EC4899] text-white text-[10px] font-black uppercase shadow shrink-0">
                {agency.bonusOffer}
              </span>
            </div>
          )}

          {/* Quick Rate Packages (only when configured) */}
          {agency.rates.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-zinc-300">
                  Official Agency Rates
                </span>
                <span className="text-[10px] text-amber-400 font-bold">Tap a pack to select</span>
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
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-black">
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
          )}

          {/* Direct WhatsApp Contact Details (shown ONLY when valid WhatsApp number exists) */}
          {hasWhatsApp && (
            <div className="p-3.5 rounded-2xl bg-[#0F2018]/90 border border-emerald-500/40 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center text-white shadow-md shrink-0">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[9.5px] text-emerald-400 font-bold uppercase tracking-wider block">
                    Official WhatsApp Contact
                  </span>
                  <span className="text-xs sm:text-sm font-mono font-bold text-white truncate block">
                    {agency.whatsappDisplay || agency.whatsappNumber}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCopyWhatsApp}
                className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors shrink-0"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Modal Action CTA */}
        <div className="p-4 border-t border-white/10 bg-[#0F071B]/95 space-y-2">
          <div className={`grid gap-2 ${hasWhatsApp ? 'grid-cols-2' : 'grid-cols-1'}`}>
            <button
              type="button"
              disabled={!canContactInApp || contactLoading}
              onClick={handleContactInApp}
              className="h-12 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 disabled:opacity-50 text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/25 hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer"
            >
              <MessageSquare className="w-4 h-4" />
              <span>{contactLoading ? 'Opening...' : 'Contact In-App'}</span>
            </button>

            {hasWhatsApp && (
              <button
                type="button"
                onClick={() => handleOpenWhatsApp(selectedPack || undefined)}
                className="h-12 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/30 hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer"
              >
                <MessageCircle className="w-4 h-4 fill-current" />
                <span>WhatsApp</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowOrderModal(true)}
            className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-200 font-bold text-[11px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Coins className="w-3.5 h-3.5 text-amber-400" />
            <span>Submit Coin Order Slip In-App</span>
          </button>
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
