import React from 'react';
import { getHdImageUrl } from '../../utils/imageHd';

export type PartyBackgroundTheme = 'logo' | 'dp' | 'sunrise' | 'sunset' | 'mosque';

interface PartyRoomAtmosphereProps {
  isMusicPlaying?: boolean;
  theme?: PartyBackgroundTheme;
  hostAvatar?: string;
}

export const PartyRoomAtmosphere: React.FC<PartyRoomAtmosphereProps> = ({
  isMusicPlaying = true,
  theme = 'logo',
  hostAvatar,
}) => {
  const hdAvatar = getHdImageUrl(hostAvatar);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 select-none">
      {/* =====================================================================
          BASE BACKGROUND THEMES
         ===================================================================== */}
      {/* 1. Theme: Alpha Mate Official Logo Emblem (Default) */}
      {theme === 'logo' && (
        <div className="absolute inset-0 bg-[#090314] overflow-hidden">
          {/* Deep royal night gradient base */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#16082C] via-[#0C0418] to-[#05010B]" />

          {/* Centered Large Alpha Mate Logo Emblem with Ambient Glow */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative w-72 h-72 sm:w-80 sm:h-80 -mt-10 flex items-center justify-center">
              {/* Backlight pulsing aura */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#7928CA]/35 via-[#EC4899]/30 to-[#38BDF8]/20 blur-3xl animate-pulse" />
              <img
                src="/alpha-mate-logo-emblem.png"
                alt="Alpha Mate"
                className="relative w-56 h-56 object-contain opacity-40 filter drop-shadow-[0_0_25px_rgba(168,85,247,0.4)]"
              />
            </div>
          </div>

          {/* Dark radial vignette to keep text & seats crisp */}
          <div className="absolute inset-0 bg-radial-vignette opacity-85" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/85" />
        </div>
      )}

      {/* 2. Theme: Host DP / Profile Picture Backdrop (CRYSTAL CLEAR HD) */}
      {theme === 'dp' && (
        <div className="absolute inset-0 bg-[#07020F] overflow-hidden">
          {hdAvatar ? (
            <>
              {/* Full HD Backdrop: Crisp, high-resolution display with high-end contrast */}
              <div
                className="absolute inset-0 bg-cover bg-center scale-105 brightness-[0.72] contrast-[1.12] transition-all duration-700"
                style={{ backgroundImage: `url(${hdAvatar})` }}
              />
              {/* High-definition cinematic lighting and vignette */}
              <div className="absolute inset-0 bg-gradient-to-b from-[#090314]/75 via-transparent to-[#05010B]/90" />
              <div className="absolute inset-0 bg-radial-vignette opacity-50" />
            </>
          ) : (
            <div className="absolute inset-0 bg-gradient-to-b from-[#180A30] to-[#07020F]" />
          )}
        </div>
      )}

      {/* 3. Theme: Sunrise Morning Glow */}
      {theme === 'sunrise' && (
        <div className="absolute inset-0 bg-[#080209] overflow-hidden">
          <div
            className="absolute inset-0 bg-cover bg-center brightness-[0.7] contrast-[1.05] transition-all duration-700"
            style={{ backgroundImage: 'url(/assets/backgrounds/sunrise.jpg)' }}
          />
          {/* Warm sunrise golden atmospheric gradient */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#14061A]/75 via-transparent to-[#080209]/95" />
          <div className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-b from-black/70 to-transparent" />
        </div>
      )}

      {/* 4. Theme: Sunset Evening Twilight */}
      {theme === 'sunset' && (
        <div className="absolute inset-0 bg-[#090314] overflow-hidden">
          <div
            className="absolute inset-0 bg-cover bg-center brightness-[0.75] contrast-[1.08] transition-all duration-700"
            style={{ backgroundImage: 'url(/assets/backgrounds/sunset.jpg)' }}
          />
          {/* Romantic twilight purple/pink evening vignette */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#120524]/75 via-transparent to-[#07020F]/95" />
          <div className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-b from-black/70 to-transparent" />
        </div>
      )}

      {/* 5. Theme: Grand Imperial Palace */}
      {theme === 'mosque' && (
        <div className="absolute inset-0 bg-[#04060E] overflow-hidden">
          <div
            className="absolute inset-0 bg-cover bg-center brightness-[0.7] contrast-[1.1] transition-all duration-700"
            style={{ backgroundImage: 'url(/assets/backgrounds/mosque.jpg)' }}
          />
          {/* Starry night & golden dome ambient vignette */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#060A17]/80 via-transparent to-[#03040A]/95" />
          <div className="absolute top-0 left-0 right-0 h-44 bg-gradient-to-b from-black/75 to-transparent" />
        </div>
      )}

      {/* =====================================================================
          ATMOSPHERIC STAGE LIGHTS & LASERS (Runs on top of all themes)
         ===================================================================== */}
      {/* Top-down Overhead Stage Spotlight onto Host Platform */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-72 bg-gradient-to-b from-[#7928CA]/30 via-[#EC4899]/15 to-transparent blur-3xl opacity-75" />
      <div
        className="absolute -top-10 left-1/4 w-36 h-72 bg-gradient-to-b from-[#A855F7]/25 to-transparent rotate-[-25deg] blur-2xl opacity-50 animate-pulse"
      />
      <div
        className="absolute -top-10 right-1/4 w-36 h-72 bg-gradient-to-b from-[#EC4899]/25 to-transparent rotate-[25deg] blur-2xl opacity-50 animate-pulse"
        style={{ animationDelay: '1.2s' }}
      />

      {/* Subtle Moving Laser Beams */}
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
          <linearGradient id="laserCyan" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.7" />
            <stop offset="70%" stopColor="#6366F1" stopOpacity="0.2" />
            <stop offset="100%" stopColor="transparent" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Diagonal sweeping beam left */}
        <polygon
          points="0,0 25,0 220,800 200,800"
          fill="url(#laserViolet)"
          className="animate-pulse"
          style={{ animationDuration: '4.5s' }}
        />
        {/* Diagonal sweeping beam right */}
        <polygon
          points="390,0 415,0 170,800 150,800"
          fill="url(#laserMagenta)"
          className="animate-pulse"
          style={{ animationDuration: '5.2s', animationDelay: '1.2s' }}
        />
      </svg>

      {/* Equalizer Audio Spectrum behind host */}
      <div className="absolute top-24 left-1/2 -translate-x-1/2 w-64 h-16 flex items-end justify-between px-6 opacity-30">
        {[24, 45, 68, 92, 54, 78, 36, 85, 96, 62, 48, 88, 70, 52, 34, 65, 82, 40].map((h, i) => (
          <div
            key={i}
            className="w-1 rounded-full bg-gradient-to-t from-[#7928CA] via-[#A855F7] to-[#EC4899]"
            style={{
              height: isMusicPlaying ? `${h}%` : '18%',
              animation: isMusicPlaying ? `bounce ${0.6 + (i % 5) * 0.15}s infinite alternate ease-in-out` : 'none',
              animationDelay: `${(i * 0.08).toFixed(2)}s`,
            }}
          />
        ))}
      </div>

      {/* Floating Neon Light Particles */}
      <div className="absolute inset-0">
        {[
          { top: '15%', left: '12%', size: 'w-1 h-1', color: 'bg-fuchsia-400', dur: '4s' },
          { top: '22%', left: '85%', size: 'w-1.5 h-1.5', color: 'bg-purple-300', dur: '5s' },
          { top: '35%', left: '8%', size: 'w-1 h-1', color: 'bg-pink-400', dur: '3.5s' },
          { top: '42%', left: '92%', size: 'w-1.5 h-1.5', color: 'bg-cyan-300', dur: '6s' },
          { top: '55%', left: '18%', size: 'w-1 h-1', color: 'bg-amber-300', dur: '4.5s' },
          { top: '65%', left: '80%', size: 'w-1 h-1', color: 'bg-purple-400', dur: '5.2s' },
        ].map((pt, i) => (
          <div
            key={i}
            className={`absolute rounded-full ${pt.size} ${pt.color} shadow-[0_0_8px_currentColor] animate-float-heart opacity-65`}
            style={{
              top: pt.top,
              left: pt.left,
              animationDuration: pt.dur,
              animationDelay: `${i * 0.4}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
};
