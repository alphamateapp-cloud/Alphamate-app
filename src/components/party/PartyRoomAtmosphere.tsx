import React, { useEffect, useState } from 'react';
import { getHdImageUrl } from '../../utils/imageHd';

// 7 Featured Scenic Party Room Themes (9:16 vertical HD WebP artwork — 87% smaller than raw JPG)
import royalCastleBg from '../../assets/images/party_bg_castle_1795427421579.webp';
import starryNightBg from '../../assets/images/party_bg_night_1795427421040.webp';
import sufiMaidenBg from '../../assets/images/party_bg_sufi_girl_1795427421174.webp';
import sufiCourtyardBg from '../../assets/images/party_bg_sufi_hall_1795427420974.webp';
import sakuraMoonBg from '../../assets/images/party_bg_sakura_1795427420873.webp';
import arabianPalaceBg from '../../assets/images/party_bg_arabian_1795427421310.webp';
import emeraldWaterfallBg from '../../assets/images/party_bg_waterfall_1795427420906.webp';

// Classic Scenic Room Backdrops (WebP)
import sunriseGlowBg from '../../assets/images/sunrise_morning_glow_1794219060916.webp';
import sunsetTwilightBg from '../../assets/images/sunset_twilight_sky_1794219061964.webp';
import grandMosqueBg from '../../assets/images/pakistan_grand_mosque_1794219062043.webp';

export type PartyBackgroundTheme =
  | 'royal_castle'
  | 'starry_night'
  | 'sufi_maiden'
  | 'sufi_courtyard'
  | 'sakura_moon'
  | 'arabian_palace'
  | 'emerald_waterfall'
  | 'logo'
  | 'dp'
  | 'sunrise'
  | 'sunset'
  | 'mosque';

export interface PartyBackgroundConfig {
  id: PartyBackgroundTheme;
  name: string;
  subtitle: string;
  category: 'featured' | 'classic';
  imageUrl?: string;
  isThumbLogo?: boolean;
  fallbackGradient: string;
  imageClass: string;
  overlayGradient: string;
  ambientGlowClass: string;
  eqGradientClass: string;
  particleColors: string[];
  showClubLasers: boolean;
  accentHex: string;
}

export const PARTY_BACKGROUND_CATALOG: PartyBackgroundConfig[] = [
  // =========================================================================
  // 7 NEW FEATURED SCENIC PARTY ROOM THEMES
  // =========================================================================
  {
    id: 'royal_castle',
    name: 'Royal Castle',
    subtitle: 'Moonlit palace spires & starry night',
    category: 'featured',
    imageUrl: royalCastleBg,
    fallbackGradient: 'from-[#161038] via-[#0D0A24] to-[#050311]',
    imageClass: 'brightness-[0.90] contrast-[1.05] scale-[1.02]',
    overlayGradient: 'from-transparent via-transparent to-[#05020D]/80',
    ambientGlowClass: 'from-indigo-500/20 via-amber-400/8 to-transparent',
    eqGradientClass: 'from-indigo-500 via-amber-300 to-sky-300',
    particleColors: ['bg-amber-200', 'bg-indigo-300', 'bg-sky-200', 'bg-amber-300'],
    showClubLasers: false,
    accentHex: '#F59E0B',
  },
  {
    id: 'starry_night',
    name: 'Midnight Night Mode',
    subtitle: 'Velvet dark sky & silver starlight',
    category: 'featured',
    imageUrl: starryNightBg,
    fallbackGradient: 'from-[#0B1026] via-[#060918] to-[#03040B]',
    imageClass: 'brightness-[0.90] contrast-[1.06] scale-[1.02]',
    overlayGradient: 'from-transparent via-transparent to-[#03040B]/80',
    ambientGlowClass: 'from-blue-500/18 via-indigo-500/10 to-transparent',
    eqGradientClass: 'from-blue-500 via-indigo-400 to-cyan-300',
    particleColors: ['bg-sky-200', 'bg-indigo-200', 'bg-white', 'bg-cyan-200'],
    showClubLasers: false,
    accentHex: '#60A5FA',
  },
  {
    id: 'sufi_maiden',
    name: 'Sufi Grace',
    subtitle: 'Mystical lantern light & serene spirit',
    category: 'featured',
    imageUrl: sufiMaidenBg,
    fallbackGradient: 'from-[#1E130B] via-[#120B08] to-[#070405]',
    imageClass: 'brightness-[0.88] contrast-[1.05] scale-[1.02] object-[center_22%]',
    overlayGradient: 'from-transparent via-transparent to-[#070305]/80',
    ambientGlowClass: 'from-amber-500/20 via-orange-400/8 to-transparent',
    eqGradientClass: 'from-amber-600 via-amber-400 to-yellow-200',
    particleColors: ['bg-amber-300', 'bg-yellow-200', 'bg-orange-300', 'bg-amber-100'],
    showClubLasers: false,
    accentHex: '#FBBF24',
  },
  {
    id: 'sufi_courtyard',
    name: 'Sufi Sanctuary',
    subtitle: 'Golden brass lanterns & carved arches',
    category: 'featured',
    imageUrl: sufiCourtyardBg,
    fallbackGradient: 'from-[#1D120A] via-[#100A09] to-[#060306]',
    imageClass: 'brightness-[0.88] contrast-[1.06] scale-[1.02]',
    overlayGradient: 'from-transparent via-transparent to-[#060305]/80',
    ambientGlowClass: 'from-amber-500/22 via-yellow-500/8 to-transparent',
    eqGradientClass: 'from-amber-500 via-yellow-400 to-orange-300',
    particleColors: ['bg-amber-300', 'bg-amber-200', 'bg-yellow-300', 'bg-orange-200'],
    showClubLasers: false,
    accentHex: '#F59E0B',
  },
  {
    id: 'sakura_moon',
    name: 'Moonlit Sakura',
    subtitle: 'Floating cherry blossoms under silver moon',
    category: 'featured',
    imageUrl: sakuraMoonBg,
    fallbackGradient: 'from-[#22102B] via-[#12091E] to-[#07030E]',
    imageClass: 'brightness-[0.90] contrast-[1.05] scale-[1.02]',
    overlayGradient: 'from-transparent via-transparent to-[#06020C]/80',
    ambientGlowClass: 'from-pink-400/20 via-fuchsia-400/8 to-transparent',
    eqGradientClass: 'from-pink-500 via-rose-300 to-fuchsia-300',
    particleColors: ['bg-pink-300', 'bg-rose-200', 'bg-fuchsia-200', 'bg-white'],
    showClubLasers: false,
    accentHex: '#F472B6',
  },
  {
    id: 'arabian_palace',
    name: 'Arabian Nights',
    subtitle: 'Royal golden arches & desert twilight',
    category: 'featured',
    imageUrl: arabianPalaceBg,
    fallbackGradient: 'from-[#1C1226] via-[#120B1C] to-[#06040D]',
    imageClass: 'brightness-[0.88] contrast-[1.06] scale-[1.02]',
    overlayGradient: 'from-transparent via-transparent to-[#06030C]/80',
    ambientGlowClass: 'from-amber-400/20 via-violet-500/10 to-transparent',
    eqGradientClass: 'from-amber-500 via-yellow-300 to-violet-400',
    particleColors: ['bg-amber-300', 'bg-yellow-200', 'bg-violet-300', 'bg-amber-100'],
    showClubLasers: false,
    accentHex: '#EAB308',
  },
  {
    id: 'emerald_waterfall',
    name: 'Enchanted Falls',
    subtitle: 'Mystic night waterfall & glowing fireflies',
    category: 'featured',
    imageUrl: emeraldWaterfallBg,
    fallbackGradient: 'from-[#081E1E] via-[#061418] to-[#030A0D]',
    imageClass: 'brightness-[0.90] contrast-[1.06] scale-[1.02]',
    overlayGradient: 'from-transparent via-transparent to-[#02080A]/80',
    ambientGlowClass: 'from-emerald-400/18 via-cyan-400/10 to-transparent',
    eqGradientClass: 'from-emerald-500 via-teal-300 to-cyan-300',
    particleColors: ['bg-emerald-300', 'bg-teal-200', 'bg-cyan-200', 'bg-lime-200'],
    showClubLasers: false,
    accentHex: '#34D399',
  },

  // =========================================================================
  // CLASSIC ROOM BACKDROPS (Preserved)
  // =========================================================================
  {
    id: 'logo',
    name: 'Alpha Mate Emblem',
    subtitle: 'Official emblem with royal party glow',
    category: 'classic',
    imageUrl: '/alpha-mate-logo-emblem.png',
    isThumbLogo: true,
    fallbackGradient: 'from-[#16082C] via-[#0C0418] to-[#05010B]',
    imageClass: 'object-contain opacity-40',
    overlayGradient: 'from-transparent via-transparent to-black/75',
    ambientGlowClass: 'from-[#7928CA]/25 via-[#EC4899]/12 to-transparent',
    eqGradientClass: 'from-[#7928CA] via-[#A855F7] to-[#EC4899]',
    particleColors: ['bg-fuchsia-400', 'bg-purple-300', 'bg-pink-400', 'bg-cyan-300'],
    showClubLasers: true,
    accentHex: '#EC4899',
  },
  {
    id: 'dp',
    name: 'Host Profile Photo',
    subtitle: "Host's profile picture with soft vignette",
    category: 'classic',
    fallbackGradient: 'from-[#180A30] via-[#0E051E] to-[#07020F]',
    imageClass: 'scale-105 brightness-[0.82] contrast-[1.08]',
    overlayGradient: 'from-transparent via-transparent to-[#05010B]/80',
    ambientGlowClass: 'from-[#7928CA]/24 via-[#EC4899]/12 to-transparent',
    eqGradientClass: 'from-[#7928CA] via-[#A855F7] to-[#EC4899]',
    particleColors: ['bg-fuchsia-400', 'bg-purple-300', 'bg-pink-400', 'bg-amber-300'],
    showClubLasers: true,
    accentHex: '#A855F7',
  },
  {
    id: 'sunrise',
    name: 'Sunrise Morning Glow',
    subtitle: 'Golden dawn rays over mountain peaks',
    category: 'classic',
    imageUrl: sunriseGlowBg,
    fallbackGradient: 'from-[#281326] via-[#16081A] to-[#080209]',
    imageClass: 'brightness-[0.86] contrast-[1.05]',
    overlayGradient: 'from-transparent via-transparent to-[#080209]/82',
    ambientGlowClass: 'from-amber-400/20 via-rose-400/10 to-transparent',
    eqGradientClass: 'from-amber-500 via-orange-400 to-rose-400',
    particleColors: ['bg-amber-300', 'bg-orange-200', 'bg-rose-300', 'bg-yellow-200'],
    showClubLasers: false,
    accentHex: '#FB923C',
  },
  {
    id: 'sunset',
    name: 'Sunset Evening Twilight',
    subtitle: 'Romantic twilight sky over gentle sea',
    category: 'classic',
    imageUrl: sunsetTwilightBg,
    fallbackGradient: 'from-[#240F38] via-[#140724] to-[#07020F]',
    imageClass: 'brightness-[0.88] contrast-[1.06]',
    overlayGradient: 'from-transparent via-transparent to-[#07020F]/82',
    ambientGlowClass: 'from-pink-500/20 via-purple-500/12 to-transparent',
    eqGradientClass: 'from-purple-500 via-pink-400 to-amber-300',
    particleColors: ['bg-pink-300', 'bg-purple-300', 'bg-amber-200', 'bg-fuchsia-300'],
    showClubLasers: false,
    accentHex: '#EC4899',
  },
  {
    id: 'mosque',
    name: 'Grand Imperial Palace',
    subtitle: 'Illuminated imperial domes & starry night',
    category: 'classic',
    imageUrl: grandMosqueBg,
    fallbackGradient: 'from-[#0B1228] via-[#070B1A] to-[#03040A]',
    imageClass: 'brightness-[0.86] contrast-[1.06]',
    overlayGradient: 'from-transparent via-transparent to-[#03040A]/82',
    ambientGlowClass: 'from-amber-400/18 via-indigo-500/10 to-transparent',
    eqGradientClass: 'from-amber-400 via-yellow-300 to-sky-300',
    particleColors: ['bg-amber-300', 'bg-sky-200', 'bg-yellow-200', 'bg-indigo-300'],
    showClubLasers: false,
    accentHex: '#FBBF24',
  },
];

export const VALID_PARTY_BACKGROUND_THEMES = new Set<string>(
  PARTY_BACKGROUND_CATALOG.map((item) => item.id)
);

export function isValidPartyBackgroundTheme(value: unknown): value is PartyBackgroundTheme {
  return typeof value === 'string' && VALID_PARTY_BACKGROUND_THEMES.has(value);
}

interface PartyRoomAtmosphereProps {
  isMusicPlaying?: boolean;
  theme?: PartyBackgroundTheme;
  hostAvatar?: string;
}

const FLOATING_PARTICLES = [
  { top: '16%', left: '12%', size: 'w-1 h-1', dur: '4.4s' },
  { top: '24%', left: '84%', size: 'w-1.5 h-1.5', dur: '5.4s' },
  { top: '38%', left: '9%', size: 'w-1 h-1', dur: '3.9s' },
  { top: '44%', left: '91%', size: 'w-1.5 h-1.5', dur: '6.2s' },
  { top: '58%', left: '16%', size: 'w-1 h-1', dur: '4.8s' },
  { top: '67%', left: '82%', size: 'w-1 h-1', dur: '5.6s' },
];

export const PartyRoomAtmosphere: React.FC<PartyRoomAtmosphereProps> = ({
  isMusicPlaying = true,
  theme = 'royal_castle',
  hostAvatar,
}) => {
  const hdAvatar = getHdImageUrl(hostAvatar);
  const [imageError, setImageError] = useState(false);

  const activeConfig =
    PARTY_BACKGROUND_CATALOG.find((item) => item.id === theme) || PARTY_BACKGROUND_CATALOG[0];

  const resolvedImageSrc =
    activeConfig.id === 'dp' ? hdAvatar || '' : activeConfig.imageUrl || '';

  useEffect(() => {
    setImageError(false);
  }, [theme, resolvedImageSrc]);

  return (
    <div
      data-keep-dark="true"
      className="absolute inset-0 pointer-events-none overflow-hidden z-0 select-none bg-[#070311]"
    >
      {/* Curated dark fallback gradient (guarantees zero blank/broken background) */}
      <div
        className={`absolute inset-0 bg-gradient-to-b ${activeConfig.fallbackGradient} transition-colors duration-700`}
      />

      {/* =====================================================================
          ACTIVE BACKGROUND ARTWORK LAYER
         ===================================================================== */}
      {activeConfig.id === 'logo' ? (
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative w-72 h-72 sm:w-80 sm:h-80 -mt-10 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#7928CA]/35 via-[#EC4899]/30 to-[#38BDF8]/20 blur-3xl animate-pulse" />
              <img
                src="/alpha-mate-logo-emblem.png"
                alt="Alpha Mate"
                referrerPolicy="no-referrer"
                className="relative w-56 h-56 object-contain opacity-40 filter drop-shadow-[0_0_25px_rgba(168,85,247,0.4)]"
              />
            </div>
          </div>
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/75" />
        </div>
      ) : (
        <div className="absolute inset-0 overflow-hidden">
          {resolvedImageSrc && !imageError && (
            <img
              key={`${activeConfig.id}-${resolvedImageSrc}`}
              src={resolvedImageSrc}
              alt={activeConfig.name}
              referrerPolicy="no-referrer"
              onError={() => setImageError(true)}
              className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 ${activeConfig.imageClass}`}
            />
          )}

          {/* Clean Full-Bleed Top with Bottom-Only Chat Readability Scrim */}
          <div
            className={`absolute inset-0 bg-gradient-to-b ${activeConfig.overlayGradient} transition-all duration-700`}
          />
          <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
        </div>
      )}

      {/* =====================================================================
          THEME-MATCHED AMBIENT STAGE LIGHTING
         ===================================================================== */}
      <div
        className={`absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-72 bg-gradient-to-b ${activeConfig.ambientGlowClass} blur-3xl opacity-80 transition-all duration-700`}
      />

      {activeConfig.showClubLasers && (
        <>
          <div className="absolute -top-10 left-1/4 w-36 h-72 bg-gradient-to-b from-[#A855F7]/25 to-transparent rotate-[-25deg] blur-2xl opacity-50 animate-pulse" />
          <div
            className="absolute -top-10 right-1/4 w-36 h-72 bg-gradient-to-b from-[#EC4899]/25 to-transparent rotate-[25deg] blur-2xl opacity-50 animate-pulse"
            style={{ animationDelay: '1.2s' }}
          />

          <svg className="absolute inset-0 w-full h-full opacity-35" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="laserViolet" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#C084FC" stopOpacity="0.8" />
                <stop offset="60%" stopColor="#7928CA" stopOpacity="0.25" />
                <stop offset="100%" stopColor="transparent" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="laserMagenta" x1="100%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#F472B6" stopOpacity="0.8" />
                <stop offset="60%" stopColor="#EC4899" stopOpacity="0.25" />
                <stop offset="100%" stopColor="transparent" stopOpacity="0" />
              </linearGradient>
            </defs>
            <polygon
              points="0,0 25,0 220,800 200,800"
              fill="url(#laserViolet)"
              className="animate-pulse"
              style={{ animationDuration: '4.5s' }}
            />
            <polygon
              points="390,0 415,0 170,800 150,800"
              fill="url(#laserMagenta)"
              className="animate-pulse"
              style={{ animationDuration: '5.2s', animationDelay: '1.2s' }}
            />
          </svg>
        </>
      )}

      {/* Subtle Theme-Matched Audio Equalizer Behind Host Seat */}
      <div className="absolute top-14 left-1/2 -translate-x-1/2 w-64 h-14 flex items-end justify-between px-6 opacity-25">
        {[24, 45, 68, 92, 54, 78, 36, 85, 96, 62, 48, 88, 70, 52, 34, 65, 82, 40].map((h, i) => (
          <div
            key={i}
            className={`w-1 rounded-full bg-gradient-to-t ${activeConfig.eqGradientClass}`}
            style={{
              height: isMusicPlaying ? `${h}%` : '18%',
              animation: isMusicPlaying
                ? `bounce ${0.65 + (i % 5) * 0.15}s infinite alternate ease-in-out`
                : 'none',
              animationDelay: `${(i * 0.08).toFixed(2)}s`,
            }}
          />
        ))}
      </div>

      {/* Delicate Theme-Matched Floating Atmospheric Particles */}
      <div className="absolute inset-0">
        {FLOATING_PARTICLES.map((pt, i) => {
          const colorClass = activeConfig.particleColors[i % activeConfig.particleColors.length];
          return (
            <div
              key={i}
              className={`absolute rounded-full ${pt.size} ${colorClass} shadow-[0_0_8px_currentColor] animate-float-heart opacity-55`}
              style={{
                top: pt.top,
                left: pt.left,
                animationDuration: pt.dur,
                animationDelay: `${i * 0.45}s`,
              }}
            />
          );
        })}
      </div>
    </div>
  );
};
