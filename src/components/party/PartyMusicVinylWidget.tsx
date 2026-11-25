import React from 'react';

interface PartyMusicVinylWidgetProps {
  isPlaying: boolean;
  trackTitle: string;
  canModerate: boolean;
  onOpenMusicModal?: () => void;
}

/**
 * Vintage Spinning Vinyl Turntable & Woofer Speaker Widget
 * Anchored in the lower-right corner above the Party Room comments input.
 * - Spins smoothly like a classic record plate with an animated tonearm and pulsing woofer rings while playing.
 * - Emits rising animated musical notes (♪ ♫ ♬) above the turntable during playback.
 * - Host & Moderator can tap to open the music playlist; Viewers & Guests see it read-only.
 */
export const PartyMusicVinylWidget: React.FC<PartyMusicVinylWidgetProps> = ({
  isPlaying,
  trackTitle,
  canModerate,
  onOpenMusicModal,
}) => {
  const shortTitle = (trackTitle || 'Party Beats').split('(')[0].trim();

  const content = (
    <div className="relative flex flex-col items-center select-none">
      {/* Rising Animated Musical Notes — Float upward only while music is playing */}
      {isPlaying && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-12 left-1/2 -translate-x-1/2 w-16 h-16 overflow-visible"
        >
          <span
            className="absolute bottom-1 left-6 text-[13px] font-black text-amber-300 drop-shadow-[0_0_6px_rgba(251,191,36,0.9)] animate-music-note-a"
            style={{ animationDelay: '0s' }}
          >
            ♪
          </span>
          <span
            className="absolute bottom-0 left-8 text-[14px] font-black text-pink-400 drop-shadow-[0_0_7px_rgba(236,72,153,0.9)] animate-music-note-b"
            style={{ animationDelay: '0.65s' }}
          >
            ♫
          </span>
          <span
            className="absolute bottom-1 left-5 text-[11px] font-black text-purple-300 drop-shadow-[0_0_6px_rgba(192,132,252,0.95)] animate-music-note-a"
            style={{ animationDelay: '1.35s' }}
          >
            ♬
          </span>
          <span
            className="absolute bottom-0 left-7 text-[12px] font-black text-cyan-300 drop-shadow-[0_0_6px_rgba(56,189,248,0.85)] animate-music-note-b"
            style={{ animationDelay: '1.95s' }}
          >
            ♪
          </span>
        </div>
      )}

      {/* Turntable + Woofer Assembly */}
      <div className="relative w-[56px] h-[56px] sm:w-[60px] sm:h-[60px] flex items-center justify-center">
        {/* Expanding Woofer / Bass Acoustic Rings (Active while playing) */}
        {isPlaying && (
          <>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-full border border-[#EC4899]/70 animate-vinyl-woofer-ring"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-full border border-amber-300/60 animate-vinyl-woofer-ring"
              style={{ animationDelay: '0.88s' }}
            />
          </>
        )}

        {/* Outer Speaker / Woofer Chassis Bezel */}
        <div
          className={`relative w-[52px] h-[52px] sm:w-[56px] sm:h-[56px] rounded-full p-[3px] shadow-[0_6px_22px_rgba(0,0,0,0.75)] transition-opacity duration-300 ${
            isPlaying
              ? 'bg-gradient-to-tr from-[#2A104A] via-[#7928CA] to-[#F59E0B] animate-vinyl-woofer-cone opacity-100'
              : 'bg-gradient-to-tr from-zinc-800 via-zinc-700 to-zinc-800 opacity-70'
          }`}
        >
          {/* Woofer Rubber Surround Ring */}
          <div className="relative w-full h-full rounded-full bg-[#0A0614] p-[2px] flex items-center justify-center overflow-hidden shadow-inner">
            {/* Spinning Classic Vinyl Record Plate */}
            <svg
              viewBox="0 0 100 100"
              className="w-full h-full animate-vinyl-spin"
              style={{ animationPlayState: isPlaying ? 'running' : 'paused' }}
              aria-hidden="true"
            >
              <defs>
                <radialGradient id="vinylPlateBase" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#1B1329" />
                  <stop offset="48%" stopColor="#0C0814" />
                  <stop offset="78%" stopColor="#171024" />
                  <stop offset="100%" stopColor="#07040C" />
                </radialGradient>
                <linearGradient id="vinylSheen" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.28)" />
                  <stop offset="32%" stopColor="rgba(236,72,153,0.08)" />
                  <stop offset="52%" stopColor="rgba(255,255,255,0)" />
                  <stop offset="76%" stopColor="rgba(251,191,36,0.2)" />
                  <stop offset="100%" stopColor="rgba(255,255,255,0.24)" />
                </linearGradient>
                <radialGradient id="vinylLabelGrad" cx="35%" cy="30%" r="70%">
                  <stop offset="0%" stopColor="#FDE047" />
                  <stop offset="45%" stopColor="#EC4899" />
                  <stop offset="100%" stopColor="#6D28D9" />
                </radialGradient>
              </defs>

              {/* Main Black Vinyl Disc */}
              <circle cx="50" cy="50" r="48" fill="url(#vinylPlateBase)" stroke="rgba(255,255,255,0.16)" strokeWidth="1.2" />

              {/* Classic Record Grooves */}
              <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="0.7" />
              <circle cx="50" cy="50" r="36.5" fill="none" stroke="rgba(236,72,153,0.18)" strokeWidth="0.7" />
              <circle cx="50" cy="50" r="31" fill="none" stroke="rgba(255,255,255,0.11)" strokeWidth="0.7" />
              <circle cx="50" cy="50" r="25.5" fill="none" stroke="rgba(251,191,36,0.18)" strokeWidth="0.7" />

              {/* Specular Light Reflection Wedge (makes rotation unmistakably visible!) */}
              <path
                d="M50,50 L15,18 A48,48 0 0,1 52,2 Z"
                fill="url(#vinylSheen)"
                opacity="0.75"
              />
              <path
                d="M50,50 L85,82 A48,48 0 0,1 48,98 Z"
                fill="url(#vinylSheen)"
                opacity="0.65"
              />

              {/* Center Printed Record Label */}
              <circle cx="50" cy="50" r="17" fill="url(#vinylLabelGrad)" stroke="#FDE68A" strokeWidth="1.2" />
              <circle cx="50" cy="50" r="12.5" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="0.7" strokeDasharray="3 2" />

              {/* Vintage Metallic Spindle Hole */}
              <circle cx="50" cy="50" r="4.5" fill="#0B0615" stroke="#FCD34D" strokeWidth="1.2" />
            </svg>
          </div>
        </div>

        {/* Classic Turntable Tonearm (Swings onto the vinyl plate while playing, rests off-disc when paused) */}
        <svg
          viewBox="0 0 36 44"
          aria-hidden="true"
          className="pointer-events-none absolute -top-1 -right-1 w-6 h-7 overflow-visible transition-transform duration-500 ease-out"
          style={{
            transformOrigin: '26px 8px',
            transform: isPlaying ? 'rotate(16deg)' : 'rotate(-16deg)',
          }}
        >
          {/* Pivot Base */}
          <circle cx="26" cy="8" r="5" fill="#1F1238" stroke="#FBBF24" strokeWidth="1.4" />
          <circle cx="26" cy="8" r="1.8" fill="#FDE68A" />
          {/* Metallic Tonearm Rod */}
          <path
            d="M26 11 L23 26 L16 33"
            fill="none"
            stroke="#E5E7EB"
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Stylus Cartridge Head */}
          <rect
            x="11.5"
            y="31"
            width="6"
            height="4"
            rx="1.2"
            transform="rotate(-40 14.5 33)"
            fill="#F59E0B"
            stroke="#FEF08A"
            strokeWidth="0.7"
          />
        </svg>
      </div>

      {/* Subtle Unboxed Track Label Underneath */}
      <span
        className={`mt-1 max-w-[74px] truncate text-[9px] font-bold tracking-tight drop-shadow-[0_1px_4px_rgba(0,0,0,0.95)] ${
          isPlaying ? 'text-amber-200/95' : 'text-zinc-400/80'
        }`}
      >
        {isPlaying ? shortTitle : 'Music'}
      </span>
    </div>
  );

  if (onOpenMusicModal) {
    return (
      <button
        type="button"
        onClick={onOpenMusicModal}
        className="group flex flex-col items-center cursor-pointer active:scale-95 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EC4899] rounded-full"
        title={
          isPlaying
            ? `Now Playing: ${trackTitle} — Tap for Music DJ & Volume`
            : canModerate
            ? 'Tap to search & play background music'
            : 'Tap to open Party Music & Volume'
        }
        aria-label={`Music turntable: ${isPlaying ? `playing ${trackTitle}` : 'idle'}. Tap to open Party Music.`}
      >
        {content}
      </button>
    );
  }

  return (
    <div
      className="flex flex-col items-center"
      title={isPlaying ? `Now Playing: ${trackTitle}` : 'Room music paused'}
      aria-label={isPlaying ? `Music playing: ${trackTitle}` : 'Room music paused'}
    >
      {content}
    </div>
  );
};

