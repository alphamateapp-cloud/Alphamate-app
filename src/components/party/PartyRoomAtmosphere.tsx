import React from 'react';

interface PartyRoomAtmosphereProps {
  isMusicPlaying?: boolean;
}

export const PartyRoomAtmosphere: React.FC<PartyRoomAtmosphereProps> = ({ isMusicPlaying = true }) => {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 select-none">
      {/* 1. Deep Nightclub Violet & Dark Purple Midnight Atmosphere */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#140728] via-[#0D051C] to-[#06020E]" />

      {/* 2. Top-down Overhead Stage Spotlights onto the Host Platform */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-72 bg-gradient-to-b from-[#7928CA]/35 via-[#EC4899]/15 to-transparent blur-3xl opacity-80" />
      <div className="absolute -top-10 left-1/4 w-40 h-80 bg-gradient-to-b from-[#A855F7]/30 to-transparent rotate-[-25deg] blur-2xl opacity-60 animate-pulse" />
      <div className="absolute -top-10 right-1/4 w-40 h-80 bg-gradient-to-b from-[#EC4899]/30 to-transparent rotate-[25deg] blur-2xl opacity-60 animate-pulse" style={{ animationDelay: '1.2s' }} />

      {/* 3. Subtle Moving Laser Beams */}
      <svg className="absolute inset-0 w-full h-full opacity-40" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="laserViolet" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#C084FC" stopOpacity="0.8" />
            <stop offset="60%" stopColor="#7928CA" stopOpacity="0.3" />
            <stop offset="100%" stopColor="transparent" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="laserMagenta" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#F472B6" stopOpacity="0.8" />
            <stop offset="60%" stopColor="#EC4899" stopOpacity="0.3" />
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
          points="0,0 30,0 260,800 240,800"
          fill="url(#laserViolet)"
          className="animate-pulse"
          style={{ animationDuration: '4s' }}
        />
        {/* Diagonal sweeping beam right */}
        <polygon
          points="390,0 420,0 160,800 140,800"
          fill="url(#laserMagenta)"
          className="animate-pulse"
          style={{ animationDuration: '5s', animationDelay: '1s' }}
        />
        {/* Center stage vertical laser */}
        <line
          x1="50%"
          y1="0"
          x2="50%"
          y2="60%"
          stroke="url(#laserCyan)"
          strokeWidth="1.5"
          strokeDasharray="4 8"
          className="opacity-70"
        />
      </svg>

      {/* 4. Host Stage Backing Neon Equalizer Audio Spectrum */}
      <div className="absolute top-28 left-1/2 -translate-x-1/2 w-72 h-20 flex items-end justify-between px-6 opacity-35">
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

      {/* 5. Radial Neon Glow Behind Host Pod */}
      <div className="absolute top-24 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full bg-gradient-to-tr from-[#7928CA]/30 via-[#EC4899]/25 to-[#F59E0B]/15 blur-2xl pointer-events-none" />

      {/* 6. Floating Neon Light Particles */}
      <div className="absolute inset-0">
        {[
          { top: '15%', left: '12%', size: 'w-1.5 h-1.5', color: 'bg-fuchsia-400', dur: '4s' },
          { top: '22%', left: '85%', size: 'w-2 h-2', color: 'bg-purple-300', dur: '5s' },
          { top: '35%', left: '8%', size: 'w-1 h-1', color: 'bg-pink-400', dur: '3.5s' },
          { top: '42%', left: '92%', size: 'w-2 h-2', color: 'bg-cyan-300', dur: '6s' },
          { top: '55%', left: '18%', size: 'w-1.5 h-1.5', color: 'bg-amber-300', dur: '4.5s' },
          { top: '65%', left: '80%', size: 'w-1.5 h-1.5', color: 'bg-purple-400', dur: '5.2s' },
          { top: '75%', left: '30%', size: 'w-1 h-1', color: 'bg-pink-300', dur: '3.8s' },
          { top: '82%', left: '70%', size: 'w-2 h-2', color: 'bg-fuchsia-300', dur: '4.8s' },
        ].map((pt, i) => (
          <div
            key={i}
            className={`absolute rounded-full ${pt.size} ${pt.color} shadow-[0_0_8px_currentColor] animate-float-heart opacity-70`}
            style={{
              top: pt.top,
              left: pt.left,
              animationDuration: pt.dur,
              animationDelay: `${i * 0.4}s`,
            }}
          />
        ))}
      </div>

      {/* 7. Subtle Perspective Stage Floor Grid at Lower Screen */}
      <div
        className="absolute bottom-0 left-0 right-0 h-64 opacity-15"
        style={{
          background: `
            linear-gradient(to bottom, transparent 0%, rgba(168, 85, 247, 0.25) 100%),
            repeating-linear-gradient(90deg, rgba(168, 85, 247, 0.3) 0, rgba(168, 85, 247, 0.3) 1px, transparent 1px, transparent 40px),
            repeating-linear-gradient(0deg, rgba(168, 85, 247, 0.3) 0, rgba(168, 85, 247, 0.3) 1px, transparent 1px, transparent 40px)
          `,
          maskImage: 'linear-gradient(to top, black 20%, transparent 90%)',
          WebkitMaskImage: 'linear-gradient(to top, black 20%, transparent 90%)',
        }}
      />

      {/* 8. Neon Horizon Glow across the middle */}
      <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#EC4899]/30 to-transparent blur-[1px]" />
    </div>
  );
};
