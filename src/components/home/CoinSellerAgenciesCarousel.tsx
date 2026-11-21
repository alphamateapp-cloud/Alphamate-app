import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck,
  Coins,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  MessageSquare,
  CheckCircle2,
  Hash,
  Zap,
} from 'lucide-react';
import { OfficialAgency, AgencyContactModal } from '../modals/AgencyContactModal';
import { useApp } from '../../context/AppContext';
import { buildWhatsAppUrl, openExternalWhatsApp } from '../../services/agencySyncService';

// Legacy static export kept empty; Official Coin Seller Agencies come strictly from active Firestore docs.
export const OFFICIAL_AGENCIES: OfficialAgency[] = [];

const getAgencyInitials = (name: string): string => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return `${words[0][0]}${words[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase() || 'AM';
};

export const CoinSellerAgenciesCarousel: React.FC = () => {
  const { officialCoinSellerAgencies, contactAgencyInApp } = useApp();
  const agencies = officialCoinSellerAgencies;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [selectedAgency, setSelectedAgency] = useState<OfficialAgency | null>(null);
  const [chatNotice, setChatNotice] = useState<string | null>(null);
  const [openingChatId, setOpeningChatId] = useState<string | null>(null);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    if (currentIndex >= agencies.length && agencies.length > 0) {
      setCurrentIndex(0);
    }
  }, [agencies.length, currentIndex]);

  // Auto-rotate carousel every 4.5 seconds when 2+ active Coin Seller Agencies exist
  useEffect(() => {
    if (isPaused || agencies.length <= 1) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % agencies.length);
    }, 4500);

    return () => clearInterval(timer);
  }, [isPaused, agencies.length]);

  if (agencies.length === 0) {
    return null;
  }

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % agencies.length);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + agencies.length) % agencies.length);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX;

    if (diff > 45) {
      handleNext();
    } else if (diff < -45) {
      handlePrev();
    }
    touchStartX.current = null;
  };

  const currentAgency = agencies[currentIndex] || agencies[0];
  const hasValidWhatsApp = Boolean(currentAgency.hasValidWhatsApp && currentAgency.whatsappNumber);
  const canContactInApp = Boolean(currentAgency.ownerUserId);

  const handleDirectWhatsApp = (agency: OfficialAgency, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!agency.hasValidWhatsApp || !agency.whatsappNumber) return;
    const url = buildWhatsAppUrl(
      agency.whatsappNumber,
      `Hello ${agency.name} (Code: ${agency.agencyCode})! I want to purchase coins directly from your Official Coin Seller Agency on Alpha Mate. Please share your current packages and payment details.`
    );
    if (url) {
      openExternalWhatsApp(url);
    }
  };

  const handleDirectInAppChat = async (agency: OfficialAgency, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setChatNotice(null);
    if (!agency.ownerUserId) {
      setSelectedAgency(agency);
      return;
    }
    setOpeningChatId(agency.id);
    try {
      const res = await contactAgencyInApp({
        agencyId: agency.id,
        agencyName: agency.name,
        agencyCode: agency.agencyCode,
        ownerUserId: agency.ownerUserId,
        ownerName: agency.ownerName,
        ownerAvatar: agency.ownerAvatar,
      });
      if (!res.success) {
        setChatNotice(res.message);
        setTimeout(() => setChatNotice(null), 3200);
      }
    } finally {
      setOpeningChatId(null);
    }
  };

  return (
    <div className="pt-2 pb-3 px-4 select-none">
      {/* Official Section Heading & Subtitle */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-amber-400 to-[#EC4899] flex items-center justify-center text-white shadow-sm shrink-0">
              <Coins className="w-3 h-3 fill-current" />
            </div>
            <h2 className="text-[11px] sm:text-xs font-black tracking-wide uppercase text-amber-300 leading-tight">
              Be Alpha Mate — Official Coin Seller Agencies
            </h2>
          </div>
          <p className="text-[10px] text-zinc-400 mt-0.5 leading-snug pl-6">
            These are the officially activated Coin Seller Agencies of Alpha Mate.
          </p>
        </div>

        {/* Slide Counter & Rotation Controls */}
        {agencies.length > 1 && (
          <div className="flex items-center gap-1 text-[10px] text-zinc-400 font-mono shrink-0 pt-0.5">
            <span>
              {currentIndex + 1}/{agencies.length}
            </span>
            <button
              type="button"
              onClick={handlePrev}
              className="w-5 h-5 rounded-full bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white flex items-center justify-center cursor-pointer transition-colors ml-0.5"
              title="Previous Agency"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="w-5 h-5 rounded-full bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
              title="Next Agency"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Subtle feedback notice if self-chat or missing owner */}
      {chatNotice && (
        <div className="mb-2 px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-400/40 text-amber-200 text-[10.5px] font-semibold">
          {chatNotice}
        </div>
      )}

      {/* Main Swipeable Rotating Interactive Card Deck */}
      <div
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onClick={() => setSelectedAgency(currentAgency)}
        className="relative group rounded-3xl overflow-hidden cursor-pointer transition-all duration-300 hover:scale-[1.01] active:scale-[0.99]"
      >
        {/* Animated Cyber-Gold Glowing Border Frame */}
        <div className="relative rounded-3xl p-[1.5px] bg-gradient-to-r from-amber-400 via-[#EC4899] to-[#7928CA] shadow-[0_0_25px_rgba(245,158,11,0.25)]">
          <div
            key={currentAgency.id}
            className="relative rounded-[22px] bg-gradient-to-b from-[#1C0D33] via-[#120722] to-[#0B0415] p-3.5 sm:p-4 text-white overflow-hidden animate-fade-in"
          >
            {/* Ambient Lighting Accents */}
            <div className="absolute -top-12 -right-12 w-36 h-36 rounded-full bg-amber-500/15 blur-2xl pointer-events-none" />
            <div className="absolute -bottom-12 -left-12 w-36 h-36 rounded-full bg-[#EC4899]/15 blur-2xl pointer-events-none" />

            {/* Top Row: Agency Logo/Monogram + Name + Official Coin Seller Agency Label + Active Status */}
            <div className="flex items-start justify-between gap-2.5 mb-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="relative shrink-0">
                  {currentAgency.logo ? (
                    <img
                      src={currentAgency.logo}
                      alt={currentAgency.name}
                      className="w-11 h-11 rounded-2xl object-cover border-2 border-amber-400/90 shadow-md group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 via-[#EC4899] to-[#7928CA] border-2 border-amber-300/90 shadow-md flex items-center justify-center text-white font-black text-sm group-hover:scale-105 transition-transform">
                      {getAgencyInitials(currentAgency.name)}
                    </div>
                  )}
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border border-[#0B0415] flex items-center justify-center text-[8px] text-white font-black">
                    ✓
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="text-xs sm:text-sm font-black text-white truncate group-hover:text-amber-300 transition-colors">
                      {currentAgency.name}
                    </h3>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                    <span className="px-1.5 py-0.5 rounded-md bg-amber-400/20 text-amber-300 text-[8.5px] font-extrabold border border-amber-400/30 inline-flex items-center gap-0.5">
                      <ShieldCheck className="w-2.5 h-2.5 shrink-0" />
                      <span>Official Coin Seller Agency</span>
                    </span>
                    {currentAgency.agencyCode && (
                      <span className="inline-flex items-center gap-0.5 text-[9.5px] font-mono text-zinc-300 bg-white/5 px-1.5 py-0.5 rounded border border-white/10">
                        <Hash className="w-2.5 h-2.5 text-amber-400" />
                        <span>{currentAgency.agencyCode}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Active Status Badge */}
              <div className="shrink-0 text-right">
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-extrabold text-[9px] inline-flex items-center gap-1 uppercase">
                  <CheckCircle2 className="w-2.5 h-2.5" />
                  <span>Active</span>
                </span>
              </div>
            </div>

            {/* Middle Promo Highlight Banner */}
            <div className="mb-3 px-3 py-2 rounded-2xl bg-gradient-to-r from-amber-500/20 via-pink-500/15 to-purple-500/20 border border-amber-400/30 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-lg bg-amber-400/30 flex items-center justify-center text-amber-300 shrink-0">
                  <Zap className="w-3.5 h-3.5 fill-current" />
                </div>
                <div className="leading-tight min-w-0">
                  <span className="text-[11px] font-black text-white block truncate">
                    Get coins from official agency direct
                  </span>
                  <span className="text-[9.5px] text-amber-200 font-semibold block truncate">
                    {currentAgency.ownerName
                      ? `Managed by ${currentAgency.ownerName} • ${currentAgency.bonusOffer}`
                      : currentAgency.bonusOffer}
                  </span>
                </div>
              </div>

              <span className="text-[8.5px] px-2 py-0.5 rounded-full bg-amber-400 text-black font-black uppercase shadow tracking-wider shrink-0">
                OFFICIAL
              </span>
            </div>

            {/* Bottom Row: Contact In-App & Contact on WhatsApp Action Buttons */}
            <div className="pt-2 border-t border-white/10">
              <div className={`grid gap-2 ${hasValidWhatsApp ? 'grid-cols-2' : 'grid-cols-1'}`}>
                <button
                  type="button"
                  disabled={!canContactInApp || openingChatId === currentAgency.id}
                  onClick={(e) => handleDirectInAppChat(currentAgency, e)}
                  className="min-h-[36px] px-2.5 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-600 hover:from-amber-300 hover:to-amber-500 disabled:opacity-50 text-black font-black text-[10px] uppercase tracking-wide flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/25 active:scale-95 transition-all cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">
                    {openingChatId === currentAgency.id ? 'Opening Chat...' : 'Contact In-App'}
                  </span>
                </button>

                {hasValidWhatsApp && (
                  <button
                    type="button"
                    onClick={(e) => handleDirectWhatsApp(currentAgency, e)}
                    className="min-h-[36px] px-2.5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-black text-[10px] uppercase tracking-wide flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/30 active:scale-95 transition-all cursor-pointer"
                  >
                    <MessageCircle className="w-3.5 h-3.5 fill-current shrink-0" />
                    <span className="truncate">Contact on WhatsApp</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Carousel Pagination Dots */}
        {agencies.length > 1 && (
          <div className="flex items-center justify-center gap-1.5 mt-2">
            {agencies.map((ag, idx) => (
              <button
                key={ag.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex(idx);
                }}
                className={`h-1.5 rounded-full transition-all cursor-pointer ${
                  idx === currentIndex
                    ? 'w-6 bg-gradient-to-r from-amber-400 to-[#EC4899] shadow-sm'
                    : 'w-1.5 bg-white/20 hover:bg-white/40'
                }`}
                title={`View ${ag.name}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal for In-Depth Agency Details, Rates & Direct Contact */}
      <AgencyContactModal
        isOpen={!!selectedAgency}
        onClose={() => setSelectedAgency(null)}
        agency={selectedAgency}
      />
    </div>
  );
};
