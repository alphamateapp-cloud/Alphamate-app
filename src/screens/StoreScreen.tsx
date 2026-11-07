import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { VIP_TIER_CONFIGS, VipAvatarFrame, VipTierConfig } from '../components/brand/VipAvatarFrame';
import {
  ShoppingBag,
  Crown,
  Sparkles,
  Zap,
  Car,
  MessageSquare,
  ShieldCheck,
  Check,
  Lock,
  Plus,
  Flame,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';

interface EntranceItem {
  id: string;
  name: string;
  icon: string;
  category: string;
  description: string;
  priceCoins: number;
  durationDays: number;
  badge: string;
}

interface ChatBubbleItem {
  id: string;
  name: string;
  previewBg: string;
  previewBorder: string;
  textColor: string;
  description: string;
  priceCoins: number;
}

interface BoosterItem {
  id: string;
  name: string;
  icon: string;
  multiplier: string;
  description: string;
  xpGrant: number;
  priceCoins: number;
  popular?: boolean;
}

const ENTRANCE_ITEMS: EntranceItem[] = [
  {
    id: 'supercar_purple',
    name: 'Cyber Hypercar 🏎️',
    icon: '🏎️',
    category: 'Hypercar',
    description: 'Drifts across the live room in glowing neon purple headlights and roaring engine sounds!',
    priceCoins: 8000,
    durationDays: 30,
    badge: 'HOT SELLER',
  },
  {
    id: 'golden_yacht',
    name: 'Royal Golden Yacht 🛥️',
    icon: '🛥️',
    category: 'Luxury Cruise',
    description: 'Golden superyacht cuts through shimmering waves with fireworks exploding overhead.',
    priceCoins: 15000,
    durationDays: 30,
    badge: 'ROYAL VIP',
  },
  {
    id: 'mythic_dragon',
    name: 'Mythic Amethyst Dragon 🐉',
    icon: '🐉',
    category: 'Mythic Beast',
    description: 'A colossal glowing dragon swoops across the stream, breathing purple celestial flames!',
    priceCoins: 25000,
    durationDays: 30,
    badge: 'LEGENDARY',
  },
  {
    id: 'galaxy_shuttle',
    name: 'Cosmic Starship 🚀',
    icon: '🚀',
    category: 'Space Warp',
    description: 'Hyperspace jump animation beaming host down with stellar laser effects!',
    priceCoins: 35000,
    durationDays: 30,
    badge: 'SUPREME',
  },
];

const CHAT_BUBBLES: ChatBubbleItem[] = [
  {
    id: 'bubble_neon',
    name: 'Neon Violet Glow',
    previewBg: 'bg-gradient-to-r from-purple-900/80 to-pink-900/80',
    previewBorder: 'border-[#A855F7]',
    textColor: 'text-purple-200',
    description: 'Electrifying neon purple borders with animated ambient glow.',
    priceCoins: 2000,
  },
  {
    id: 'bubble_gold',
    name: 'Imperial Golden Scroll',
    previewBg: 'bg-gradient-to-r from-amber-950/80 to-yellow-900/80',
    previewBorder: 'border-amber-400',
    textColor: 'text-amber-200',
    description: 'Royal gold leaf borders with crowns and glitter particles.',
    priceCoins: 4500,
  },
  {
    id: 'bubble_cyber',
    name: 'Cyberpunk Matrix Blue',
    previewBg: 'bg-gradient-to-r from-cyan-950/80 to-blue-900/80',
    previewBorder: 'border-cyan-400',
    textColor: 'text-cyan-200',
    description: 'Futuristic digital grid with glowing scan lines.',
    priceCoins: 3500,
  },
  {
    id: 'bubble_crimson',
    name: 'Crimson Dragon Blaze',
    previewBg: 'bg-gradient-to-r from-rose-950/80 to-red-900/80',
    previewBorder: 'border-rose-500',
    textColor: 'text-rose-200',
    description: 'Fiery crimson smoke edges with embers floating upwards.',
    priceCoins: 6000,
  },
];

const LEVEL_BOOSTERS: BoosterItem[] = [
  {
    id: 'xp_potion_small',
    name: 'Elixir of Swift Levelling',
    icon: '🧪',
    multiplier: '+2,500 XP',
    description: 'Instantly grants +2,500 XP to rapidly rank up through the 100 Levels!',
    xpGrant: 2500,
    priceCoins: 1200,
  },
  {
    id: 'xp_double_pass',
    name: '2X XP Double Hour Token',
    icon: '⚡',
    multiplier: '2X BOOST',
    description: 'Earn double XP for all live stream gifts and comments for 2 hours!',
    xpGrant: 5000,
    priceCoins: 2500,
    popular: true,
  },
  {
    id: 'xp_titan_scroll',
    name: 'Alpha Titan Grand XP Scroll',
    icon: '📜',
    multiplier: '+15,000 XP',
    description: 'Massive level surge! Unlocks multiple VIP Tier frames instantly!',
    xpGrant: 15000,
    priceCoins: 7500,
  },
];

export const StoreScreen: React.FC = () => {
  const {
    currentUser,
    updateUserProfile,
    coins,
    diamonds,
    purchaseStoreItem,
    setCurrentScreen,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'frames' | 'entrance' | 'bubbles' | 'boosters'>('frames');
  const [selectedVipTier, setSelectedVipTier] = useState<number>(currentUser.vipTier || 3);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const currentPreviewTier =
    VIP_TIER_CONFIGS.find((c) => c.tier === selectedVipTier) || VIP_TIER_CONFIGS[0];

  // Handle equipping or purchasing VIP frame
  const handleEquipOrBuyFrame = (tierConfig: VipTierConfig) => {
    const isLevelQualified = currentUser.level >= tierConfig.requiredLevel;
    const isCurrent = currentUser.vipTier === tierConfig.tier;

    if (isCurrent) {
      showToast(`Already wearing ${tierConfig.name}! ✨`);
      return;
    }

    if (isLevelQualified) {
      // Free equip via level achievement
      updateUserProfile({ vipTier: tierConfig.tier });
      showToast(`Equipped ${tierConfig.name} frame! 🎉`);
    } else {
      // Can unlock early via Coins in Store!
      const price = tierConfig.priceCoins || 5000;
      if (coins < price) {
        showToast(`Need ${price.toLocaleString()} Coins to unlock early! Please recharge.`);
        return;
      }
      const success = purchaseStoreItem(price, 'coins', `${tierConfig.name} VIP Frame`);
      if (success) {
        updateUserProfile({ vipTier: tierConfig.tier });
        showToast(`Unlocked & equipped ${tierConfig.name}! 👑`);
      }
    }
  };

  // Handle buying entrance animation
  const handleBuyEntrance = (item: EntranceItem) => {
    const isEquipped = currentUser.entranceAnimation === item.id;
    if (isEquipped) {
      showToast(`${item.name} is already equipped!`);
      return;
    }

    if (coins < item.priceCoins) {
      showToast(`Insufficient coins for ${item.name}! Please recharge.`);
      return;
    }

    const success = purchaseStoreItem(item.priceCoins, 'coins', item.name);
    if (success) {
      updateUserProfile({ entranceAnimation: item.id });
      showToast(`Equipped ${item.name}! Your entrance will now stun the audience! 🌟`);
    }
  };

  // Handle buying chat bubble
  const handleBuyBubble = (item: ChatBubbleItem) => {
    const isEquipped = currentUser.chatBubble === item.id;
    if (isEquipped) {
      showToast(`${item.name} is already active!`);
      return;
    }

    if (coins < item.priceCoins) {
      showToast(`Insufficient coins for ${item.name}! Please recharge.`);
      return;
    }

    const success = purchaseStoreItem(item.priceCoins, 'coins', item.name);
    if (success) {
      updateUserProfile({ chatBubble: item.id });
      showToast(`Equipped ${item.name} chat bubble! 💬`);
    }
  };

  // Handle buying level booster
  const handleBuyBooster = (item: BoosterItem) => {
    if (coins < item.priceCoins) {
      showToast(`Insufficient coins for ${item.name}! Please recharge.`);
      return;
    }

    const success = purchaseStoreItem(item.priceCoins, 'coins', item.name);
    if (success) {
      const newXp = currentUser.xp + item.xpGrant;
      let newLevel = currentUser.level;
      let nextXp = currentUser.nextLevelXp;

      if (newXp >= nextXp) {
        newLevel = Math.min(100, newLevel + Math.floor(newXp / nextXp));
        nextXp = newLevel * 1000 + 5000;
      }

      // Check if unlocked a higher VIP tier
      const unlockedVip = Math.min(12, Math.floor(newLevel / 8));

      updateUserProfile({
        xp: newXp,
        level: newLevel,
        nextLevelXp: nextXp,
        vipTier: Math.max(currentUser.vipTier, unlockedVip),
      });

      showToast(`+${item.xpGrant.toLocaleString()} XP Added! You are now Level ${newLevel}! 🚀`);
    }
  };

  return (
    <div className="relative w-full h-full min-h-screen pb-32 bg-[#09070F] text-white overflow-y-auto">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-full bg-[#1A1035]/95 border border-[#A855F7]/50 text-white text-xs font-bold shadow-2xl backdrop-blur-xl flex items-center gap-2 animate-bounce">
          <Sparkles className="w-4 h-4 text-amber-300" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header Bar */}
      <div className="sticky top-0 z-30 w-full bg-[#09070F]/90 backdrop-blur-md border-b border-[#A855F7]/15 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#7928CA] to-[#EC4899] p-0.5 flex items-center justify-center shadow-lg shadow-[#7928CA]/30">
            <ShoppingBag className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-base font-black tracking-wide text-white flex items-center gap-1.5">
              <span>ALPHA STORE</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-amber-300 text-black font-extrabold">
                VIP
              </span>
            </h1>
            <p className="text-[10px] text-zinc-400">Prestige Frames, Effects & Boosters</p>
          </div>
        </div>

        {/* Currency Badges & Quick Recharge */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentScreen('wallet')}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#18102C] border border-amber-500/30 text-amber-300 text-xs font-bold hover:bg-[#20153D] transition-colors cursor-pointer"
          >
            <span>💰</span>
            <span>{coins.toLocaleString()}</span>
            <Plus className="w-3 h-3 text-amber-400 ml-0.5" />
          </button>
        </div>
      </div>

      {/* Hero Showcase Card — Live Avatar Preview */}
      <div className="p-4">
        <div className="relative rounded-3xl p-5 overflow-hidden bg-gradient-to-br from-[#1C0F38] via-[#2A1450] to-[#120824] border border-[#A855F7]/30 shadow-2xl">
          {/* Background Ambient Glow */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-[#EC4899]/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#7928CA]/20 rounded-full blur-3xl pointer-events-none" />

          <div className="relative flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Live User Avatar with Previewed VIP Frame */}
            <div className="flex items-center gap-3.5 w-full sm:w-auto">
              <VipAvatarFrame
                avatarUrl={currentUser.avatar}
                vipTier={selectedVipTier}
                size="lg"
                showCrownBadge={true}
              />

              <div className="flex flex-col min-w-0 flex-1">
                <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                  <span className="text-sm font-extrabold text-white truncate max-w-[120px] sm:max-w-[160px]">
                    {currentUser.displayName}
                  </span>
                  <span className="px-1.5 py-0.5 rounded-md bg-[#7928CA]/40 text-[#C084FC] text-[10px] font-black border border-[#A855F7]/30">
                    Lv.{currentUser.level}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                  <span
                    className="text-[10px] sm:text-xs font-black px-2 py-0.5 rounded-full text-black shadow-sm"
                    style={{ backgroundColor: currentPreviewTier.crownColor }}
                  >
                    VIP {currentPreviewTier.tier}
                  </span>
                  <span className="text-xs font-bold text-zinc-300">{currentPreviewTier.name}</span>
                </div>

                <p className="text-[10.5px] text-zinc-300 leading-snug line-clamp-2">
                  {currentPreviewTier.description}
                </p>
              </div>
            </div>

            {/* Quick Equip / Buy Action for previewed frame */}
            <div className="flex sm:flex-col flex-row items-center sm:items-end justify-between sm:justify-start gap-2 shrink-0 w-full sm:w-auto pt-2.5 sm:pt-0 border-t sm:border-t-0 border-white/10">
              <span className="text-[10px] text-zinc-400">
                Unlock at Lv.{currentPreviewTier.requiredLevel}
              </span>

              {currentUser.vipTier === currentPreviewTier.tier ? (
                <div className="px-3.5 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs font-black flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" />
                  <span>EQUIPPED</span>
                </div>
              ) : currentUser.level >= currentPreviewTier.requiredLevel ? (
                <button
                  onClick={() => handleEquipOrBuyFrame(currentPreviewTier)}
                  className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 text-black text-xs font-black shadow-lg shadow-emerald-500/30 hover:brightness-110 active:scale-95 transition-all cursor-pointer"
                >
                  EQUIP FREE
                </button>
              ) : (
                <button
                  onClick={() => handleEquipOrBuyFrame(currentPreviewTier)}
                  className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-300 text-black text-xs font-black shadow-lg shadow-amber-500/30 hover:brightness-110 active:scale-95 transition-all cursor-pointer flex items-center gap-1"
                >
                  <span>BUY</span>
                  <span>{currentPreviewTier.priceCoins?.toLocaleString()} 💰</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Store Navigation Categories */}
      <div className="px-4 mb-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: 'frames', label: '12 VIP Frames', icon: Crown },
            { id: 'entrance', label: 'Entrance FX', icon: Car },
            { id: 'bubbles', label: 'Chat Bubbles', icon: MessageSquare },
            { id: 'boosters', label: 'XP Boosters', icon: Zap },
          ].map((cat) => {
            const isActive = activeTab === cat.id;
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveTab(cat.id as any)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white shadow-lg shadow-[#7928CA]/40 scale-105'
                    : 'bg-[#150D28] text-zinc-400 hover:text-white border border-white/5'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: 12 VIP FRAMES */}
      {activeTab === 'frames' && (
        <div className="px-4 space-y-3">
          <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
            <span>Tap any frame to preview on your avatar</span>
            <span className="text-[#C084FC] font-semibold">12 Exclusive Tiers</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {VIP_TIER_CONFIGS.map((tier) => {
              const isSelected = selectedVipTier === tier.tier;
              const isEquipped = currentUser.vipTier === tier.tier;
              const isUnlocked = currentUser.level >= tier.requiredLevel;

              return (
                <div
                  key={tier.tier}
                  onClick={() => setSelectedVipTier(tier.tier)}
                  className={`relative p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-gradient-to-b from-[#241344] to-[#160B2C] border-[#EC4899] shadow-xl shadow-[#EC4899]/20 scale-[1.02]'
                      : 'bg-[#140A26] border-white/5 hover:border-white/20'
                  }`}
                >
                  {/* Top Row: VIP Tier Tag & Status */}
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className="px-2 py-0.5 rounded-full text-[10px] font-black text-black"
                      style={{ backgroundColor: tier.crownColor }}
                    >
                      VIP {tier.tier}
                    </span>

                    {isEquipped ? (
                      <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 text-[9px] font-black flex items-center gap-0.5">
                        <Check className="w-2.5 h-2.5" /> ON
                      </span>
                    ) : isUnlocked ? (
                      <span className="px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 text-[9px] font-bold">
                        UNLOCKED
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 text-[9px] font-bold flex items-center gap-0.5">
                        <Lock className="w-2.5 h-2.5" /> Lv.{tier.requiredLevel}
                      </span>
                    )}
                  </div>

                  {/* Frame Visual Preview */}
                  <div className="flex flex-col items-center justify-center my-2">
                    <VipAvatarFrame
                      avatarUrl={currentUser.avatar}
                      vipTier={tier.tier}
                      size="lg"
                      showCrownBadge={true}
                    />
                    <h3 className="text-xs font-black text-white mt-2.5 text-center truncate max-w-full">
                      {tier.name}
                    </h3>
                    <p className="text-[10px] text-zinc-400 text-center line-clamp-1 mt-0.5">
                      {tier.badgeTitle}
                    </p>
                  </div>

                  {/* Bottom Action Button */}
                  <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-amber-300">
                      {tier.priceCoins?.toLocaleString()} 💰
                    </span>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEquipOrBuyFrame(tier);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer ${
                        isEquipped
                          ? 'bg-zinc-800 text-zinc-400'
                          : isUnlocked
                          ? 'bg-emerald-500 text-black hover:bg-emerald-400'
                          : 'bg-gradient-to-r from-amber-500 to-amber-300 text-black hover:brightness-110'
                      }`}
                    >
                      {isEquipped ? 'Equipped' : isUnlocked ? 'Equip' : 'Buy'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: ENTRANCE ANIMATIONS */}
      {activeTab === 'entrance' && (
        <div className="px-4 space-y-3">
          <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
            <span>Special room arrival takeovers for hosts & guests</span>
            <span className="text-amber-400 font-semibold">Live Flair</span>
          </div>

          <div className="space-y-3">
            {ENTRANCE_ITEMS.map((item) => {
              const isEquipped = currentUser.entranceAnimation === item.id;
              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${
                    isEquipped
                      ? 'bg-gradient-to-r from-[#2B1450] to-[#1A0B33] border-[#EC4899] shadow-lg shadow-[#EC4899]/20'
                      : 'bg-[#140A26] border-white/5 hover:border-white/15'
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#7928CA]/30 to-[#EC4899]/30 border border-[#A855F7]/30 flex items-center justify-center text-3xl shadow-md">
                      {item.icon}
                    </div>

                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs font-black text-white">{item.name}</h3>
                        <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 text-[9px] font-black border border-amber-500/30">
                          {item.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-300 max-w-[210px] leading-snug mt-1">
                        {item.description}
                      </p>
                      <span className="text-[10px] text-zinc-500 mt-1">Valid for {item.durationDays} Days</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className="text-xs font-mono font-black text-amber-300">
                      {item.priceCoins.toLocaleString()} 💰
                    </span>
                    <button
                      onClick={() => handleBuyEntrance(item)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                        isEquipped
                          ? 'bg-emerald-500/20 border border-emerald-400 text-emerald-300'
                          : 'bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white hover:brightness-110 shadow-md'
                      }`}
                    >
                      {isEquipped ? 'Equipped' : 'Unlock'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: CHAT BUBBLES */}
      {activeTab === 'bubbles' && (
        <div className="px-4 space-y-3">
          <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
            <span>Stand out in stream chats & direct messages</span>
            <span className="text-[#C084FC] font-semibold">Custom Look</span>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {CHAT_BUBBLES.map((bubble) => {
              const isEquipped = currentUser.chatBubble === bubble.id;
              return (
                <div
                  key={bubble.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    isEquipped
                      ? 'bg-[#1E1139] border-[#EC4899] shadow-lg shadow-[#EC4899]/20'
                      : 'bg-[#140A26] border-white/5 hover:border-white/15'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2.5">
                    <h3 className="text-xs font-black text-white">{bubble.name}</h3>
                    <span className="text-xs font-mono font-black text-amber-300">
                      {bubble.priceCoins.toLocaleString()} 💰
                    </span>
                  </div>

                  {/* Bubble Preview */}
                  <div
                    className={`p-3 rounded-2xl border ${bubble.previewBg} ${bubble.previewBorder} mb-3 shadow-inner`}
                  >
                    <p className={`text-xs font-medium ${bubble.textColor}`}>
                      Hello Alpha Mate! 👑 Sending love to everyone in the room! 💜
                    </p>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-zinc-400">
                    <span>{bubble.description}</span>
                    <button
                      onClick={() => handleBuyBubble(bubble)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                        isEquipped
                          ? 'bg-emerald-500/20 border border-emerald-400 text-emerald-300'
                          : 'bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white hover:brightness-110 shadow-md'
                      }`}
                    >
                      {isEquipped ? 'Active' : 'Buy Bubble'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: XP BOOSTERS & LEVEL RUSH */}
      {activeTab === 'boosters' && (
        <div className="px-4 space-y-3">
          <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
            <span>Fast-track your path to Level 100</span>
            <span className="text-emerald-400 font-semibold flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" /> High Velocity
            </span>
          </div>

          <div className="space-y-3">
            {LEVEL_BOOSTERS.map((booster) => (
              <div
                key={booster.id}
                className="p-4 rounded-2xl bg-[#140A26] border border-white/5 hover:border-[#A855F7]/30 transition-all flex items-center justify-between"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-[#7928CA]/30 to-[#EC4899]/30 border border-[#A855F7]/30 flex items-center justify-center text-3xl shadow-md">
                    {booster.icon}
                  </div>

                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-black text-white">{booster.name}</h3>
                      {booster.popular && (
                        <span className="px-1.5 py-0.2 rounded-full bg-rose-500/20 text-rose-300 text-[9px] font-black border border-rose-500/30">
                          POPULAR
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-black text-emerald-400 mt-0.5">
                      {booster.multiplier}
                    </span>
                    <p className="text-[11px] text-zinc-300 max-w-[210px] leading-snug mt-1">
                      {booster.description}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span className="text-xs font-mono font-black text-amber-300">
                    {booster.priceCoins.toLocaleString()} 💰
                  </span>
                  <button
                    onClick={() => handleBuyBooster(booster)}
                    className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 text-black text-xs font-black hover:brightness-110 shadow-md shadow-emerald-500/30 transition-all cursor-pointer"
                  >
                    Buy XP
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
