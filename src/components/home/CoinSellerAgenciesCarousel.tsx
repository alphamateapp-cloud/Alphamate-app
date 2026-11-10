import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck,
  Sparkles,
  Coins,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Star,
  CheckCircle2,
  Clock,
  ArrowRight,
  Zap,
} from 'lucide-react';
import { OfficialAgency, AgencyContactModal } from '../modals/AgencyContactModal';

// Roster of Official Coin Seller Agencies (Easily extensible)
export const OFFICIAL_AGENCIES: OfficialAgency[] = [
  {
    id: 'agency_royal_vault',
    name: 'Alpha Royal Vault',
    tagline: 'Get coins from official agency direct',
    logo: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=400&q=80',
    badge: 'Diamond Certified',
    badgeColor: '#EC4899',
    whatsappNumber: '+923001234567',
    whatsappDisplay: '+92 300 1234567',
    rating: 4.9,
    ordersCompleted: '180k+',
    bonusOffer: '+15% Extra Coins Bonus',
    avgDeliveryTime: '< 2 Mins',
    paymentMethods: ['JazzCash', 'EasyPaisa', 'Bank Transfer', 'USDT / Binance'],
    rates: [
      { amount: 10000, bonus: 1500, price: 'Rs. 2,500' },
      { amount: 50000, bonus: 8000, price: 'Rs. 11,900' },
      { amount: 100000, bonus: 18000, price: 'Rs. 22,500' },
      { amount: 500000, bonus: 100000, price: 'Rs. 105,000' },
    ],
  },
  {
    id: 'agency_crown_exchange',
    name: 'Crown Star Merchant',
    tagline: 'Instant 24/7 Coin Top-Up & VIP Support',
    logo: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&w=400&q=80',
    badge: 'Crown Partner',
    badgeColor: '#F59E0B',
    whatsappNumber: '+923019876543',
    whatsappDisplay: '+92 301 9876543',
    rating: 5.0,
    ordersCompleted: '145k+',
    bonusOffer: 'Double VIP Points + 12% Bonus',
    avgDeliveryTime: '< 1 Min',
    paymentMethods: ['EasyPaisa', 'JazzCash', 'SadaPay', 'NayaPay'],
    rates: [
      { amount: 10000, bonus: 1200, price: 'Rs. 2,450' },
      { amount: 50000, bonus: 7500, price: 'Rs. 11,800' },
      { amount: 100000, bonus: 17000, price: 'Rs. 22,000' },
      { amount: 1000000, bonus: 250000, price: 'Rs. 200,000' },
    ],
  },
  {
    id: 'agency_global_express',
    name: 'Global Mate Express',
    tagline: 'Lowest Market Rates & Fast Worldwide Delivery',
    logo: 'https://images.unsplash.com/photo-1622979135225-d2ba269bc1df?auto=format&fit=crop&w=400&q=80',
    badge: 'Gold Verified',
    badgeColor: '#EAB308',
    whatsappNumber: '+971501234567',
    whatsappDisplay: '+971 50 123 4567',
    rating: 4.9,
    ordersCompleted: '210k+',
    bonusOffer: '10,000 Free Coins on First Order',
    avgDeliveryTime: '< 3 Mins',
    paymentMethods: ['Bank Transfer', 'Crypto / USDT', 'Wise', 'JazzCash'],
    rates: [
      { amount: 10000, bonus: 1000, price: '$10.00' },
      { amount: 50000, bonus: 6000, price: '$48.00' },
      { amount: 100000, bonus: 15000, price: '$92.00' },
      { amount: 500000, bonus: 90000, price: '$440.00' },
    ],
  },
  {
    id: 'agency_sultan_direct',
    name: 'Sultan Direct Exchange',
    tagline: 'Direct Official Agency Deposit Guaranteed',
    logo: 'https://images.unsplash.com/photo-1614680376593-902f749f7ffc?auto=format&fit=crop&w=400&q=80',
    badge: 'Diamond Certified',
    badgeColor: '#38BDF8',
    whatsappNumber: '+923215558899',
    whatsappDisplay: '+92 321 5558899',
    rating: 4.95,
    ordersCompleted: '95k+',
    bonusOffer: '+20% Bulk Purchase Bonus',
    avgDeliveryTime: '< 2 Mins',
    paymentMethods: ['JazzCash', 'EasyPaisa', 'Raast', 'USDT'],
    rates: [
      { amount: 20000, bonus: 3000, price: 'Rs. 4,800' },
      { amount: 50000, bonus: 9000, price: 'Rs. 11,500' },
      { amount: 150000, bonus: 35000, price: 'Rs. 32,000' },
      { amount: 800000, bonus: 200000, price: 'Rs. 165,000' },
    ],
  },
];

export const CoinSellerAgenciesCarousel: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [selectedAgency, setSelectedAgency] = useState<OfficialAgency | null>(null);
  const touchStartX = useRef<number | null>(null);

  // Auto-scroll carousel every 4.5 seconds
  useEffect(() => {
    if (isPaused) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % OFFICIAL_AGENCIES.length);
    }, 4500);

    return () => clearInterval(timer);
  }, [isPaused]);

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % OFFICIAL_AGENCIES.length);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + OFFICIAL_AGENCIES.length) % OFFICIAL_AGENCIES.length);
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

  const currentAgency = OFFICIAL_AGENCIES[currentIndex];

  const handleDirectWhatsApp = (agency: OfficialAgency, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const message = encodeURIComponent(
      `Hello ${agency.name}! I want to purchase coins directly from your official agency on Alpha Mate. Please share your current packages and payment details.`
    );
    const cleanNumber = agency.whatsappNumber.replace(/[^0-9]/g, '');
    window.open(`https://wa.me/${cleanNumber}?text=${message}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="pt-2 pb-3 px-4 select-none">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-amber-400 to-[#EC4899] flex items-center justify-center text-black shadow-sm">
            <Coins className="w-3 h-3 text-white fill-current" />
          </div>
          <span className="text-[11px] font-black tracking-wider uppercase text-amber-300">
            Official Coin Seller Agencies
          </span>
          <span className="px-1.5 py-0.2 rounded-full bg-amber-400/20 text-amber-300 text-[8.5px] font-black border border-amber-400/40">
            DIRECT
          </span>
        </div>

        {/* Slide Counter & Arrows */}
        <div className="flex items-center gap-1 text-[10px] text-zinc-400 font-mono">
          <span>{currentIndex + 1}/{OFFICIAL_AGENCIES.length}</span>
          <button
            onClick={handlePrev}
            className="w-5 h-5 rounded-full bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white flex items-center justify-center cursor-pointer transition-colors ml-1"
            title="Previous Agency"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleNext}
            className="w-5 h-5 rounded-full bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
            title="Next Agency"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Swipeable Interactive Card Deck */}
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
          <div className="relative rounded-[22px] bg-gradient-to-b from-[#1C0D33] via-[#120722] to-[#0B0415] p-3.5 sm:p-4 text-white overflow-hidden">
            {/* Ambient Lighting Accents */}
            <div className="absolute -top-12 -right-12 w-36 h-36 rounded-full bg-amber-500/15 blur-2xl pointer-events-none" />
            <div className="absolute -bottom-12 -left-12 w-36 h-36 rounded-full bg-[#EC4899]/15 blur-2xl pointer-events-none" />

            {/* Top Row: Agency Logo + Name + Verified Badge + Delivery */}
            <div className="flex items-start justify-between gap-3 mb-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="relative shrink-0">
                  <img
                    src={currentAgency.logo}
                    alt={currentAgency.name}
                    className="w-11 h-11 rounded-2xl object-cover border-2 border-amber-400/90 shadow-md group-hover:scale-105 transition-transform"
                  />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border border-[#0B0415] flex items-center justify-center text-[8px] text-white font-black">
                    ✓
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="text-xs sm:text-sm font-black text-white truncate group-hover:text-amber-300 transition-colors">
                      {currentAgency.name}
                    </h3>
                    <span className="px-1.5 py-0.2 rounded-md bg-amber-400/20 text-amber-300 text-[8.5px] font-extrabold border border-amber-400/30 flex items-center gap-0.5">
                      <ShieldCheck className="w-2.5 h-2.5" />
                      <span>{currentAgency.badge}</span>
                    </span>
                  </div>

                  <p className="text-[10px] text-zinc-300 truncate mt-0.5 font-medium">
                    {currentAgency.tagline}
                  </p>
                </div>
              </div>

              {/* Delivery Speed Badge */}
              <div className="shrink-0 text-right">
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-extrabold text-[9px] flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" />
                  <span>{currentAgency.avgDeliveryTime}</span>
                </span>
              </div>
            </div>

            {/* Middle Promo Highlight Banner: "Get coins from official agency direct" */}
            <div className="mb-3 px-3 py-2 rounded-2xl bg-gradient-to-r from-amber-500/20 via-pink-500/15 to-purple-500/20 border border-amber-400/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-amber-400/30 flex items-center justify-center text-amber-300 shrink-0">
                  <Zap className="w-3.5 h-3.5 fill-current" />
                </div>
                <div className="leading-tight">
                  <span className="text-[11px] font-black text-white block">
                    Get coins from official agency direct
                  </span>
                  <span className="text-[9.5px] text-amber-200 font-semibold">
                    {currentAgency.bonusOffer}
                  </span>
                </div>
              </div>

              <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-400 text-black font-black uppercase shadow tracking-wider shrink-0">
                OFFICIAL
              </span>
            </div>

            {/* Bottom Row: Payment Methods + Direct WhatsApp CTA */}
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/10">
              <div className="flex items-center gap-1 overflow-hidden">
                <span className="text-[9px] font-bold text-zinc-400 shrink-0">Pay:</span>
                <div className="flex items-center gap-1 truncate">
                  {currentAgency.paymentMethods.slice(0, 3).map((pm) => (
                    <span
                      key={pm}
                      className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[8.5px] text-zinc-300 font-semibold shrink-0"
                    >
                      {pm}
                    </span>
                  ))}
                  {currentAgency.paymentMethods.length > 3 && (
                    <span className="text-[8.5px] text-zinc-400 font-bold">+1</span>
                  )}
                </div>
              </div>

              {/* Order In-App & WhatsApp Action Buttons */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedAgency(currentAgency);
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-black font-black text-[10px] uppercase tracking-wider flex items-center gap-1 shadow-md shadow-amber-500/25 active:scale-95 transition-all cursor-pointer"
                >
                  <Coins className="w-3 h-3 fill-current" />
                  <span>Order 📝</span>
                </button>

                <button
                  type="button"
                  onClick={(e) => handleDirectWhatsApp(currentAgency, e)}
                  className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-black text-[10px] uppercase tracking-wider flex items-center gap-1 shadow-md shadow-emerald-500/30 active:scale-95 transition-all cursor-pointer"
                >
                  <MessageCircle className="w-3 h-3 fill-current" />
                  <span>WhatsApp 💬</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Carousel Pagination Dots */}
        <div className="flex items-center justify-center gap-1.5 mt-2">
          {OFFICIAL_AGENCIES.map((_, idx) => (
            <button
              key={idx}
              onClick={(e) => {
                e.stopPropagation();
                setCurrentIndex(idx);
              }}
              className={`h-1.5 rounded-full transition-all cursor-pointer ${
                idx === currentIndex
                  ? 'w-6 bg-gradient-to-r from-amber-400 to-[#EC4899] shadow-sm'
                  : 'w-1.5 bg-white/20 hover:bg-white/40'
              }`}
              title={`View Agency ${idx + 1}`}
            />
          ))}
        </div>
      </div>

      {/* Modal for In-Depth Agency Details, Rates & WhatsApp Direct Link */}
      <AgencyContactModal
        isOpen={!!selectedAgency}
        onClose={() => setSelectedAgency(null)}
        agency={selectedAgency}
      />
    </div>
  );
};
