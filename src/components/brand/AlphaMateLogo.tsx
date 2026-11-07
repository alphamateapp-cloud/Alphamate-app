import React from 'react';

interface AlphaMateLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  showTagline?: boolean;
  layout?: 'horizontal' | 'vertical';
  withGlow?: boolean;
  className?: string;
  variant?: 'emblem' | 'full';
  customLogoUrl?: string | null;
}

export const AlphaMateLogo: React.FC<AlphaMateLogoProps> = ({
  size = 'md',
  showText = true,
  showTagline = false,
  layout = 'horizontal',
  withGlow = true,
  className = '',
  variant,
  customLogoUrl = null,
}) => {
  // Official Alpha Mate original clean emblem asset
  const officialEmblem = '/alpha-mate-logo-emblem.png';

  // Dimension scaling
  const dimensions = {
    xs: { emblem: 26, text: 'text-xs font-black tracking-wider', tagline: 'text-[8px]', gap: 'gap-1.5' },
    sm: { emblem: 34, text: 'text-sm font-black tracking-widest', tagline: 'text-[9px]', gap: 'gap-2' },
    md: { emblem: 46, text: 'text-lg font-black tracking-widest', tagline: 'text-[10px]', gap: 'gap-2.5' },
    lg: { emblem: 72, text: 'text-2xl font-black tracking-widest', tagline: 'text-xs', gap: 'gap-3' },
    xl: { emblem: 110, text: 'text-3xl font-black tracking-widest', tagline: 'text-sm', gap: 'gap-3.5' },
  }[size];

  const emblemSrc = customLogoUrl || officialEmblem;
  const isVertical = layout === 'vertical' || variant === 'full';

  return (
    <div
      className={`inline-flex select-none ${
        isVertical ? 'flex-col items-center text-center' : 'items-center'
      } ${dimensions.gap} ${className}`}
    >
      {/* Official Clean Emblem with Neon Glow */}
      <div className="relative shrink-0 flex items-center justify-center">
        {withGlow && (
          <div
            className="absolute -inset-2 rounded-3xl blur-xl opacity-75 pointer-events-none transition-opacity"
            style={{
              background:
                'radial-gradient(circle, rgba(168, 85, 247, 0.7) 0%, rgba(236, 72, 153, 0.35) 60%, transparent 80%)',
            }}
          />
        )}

        <img
          src={emblemSrc}
          alt="ALPHA MATE"
          style={{ width: dimensions.emblem, height: dimensions.emblem }}
          className="relative z-10 object-contain rounded-2xl drop-shadow-[0_4px_20px_rgba(168,85,247,0.55)] transition-transform duration-300 hover:scale-105"
        />
      </div>

      {/* Typography: "ALPHA MATE" rendered cleanly in native UI code */}
      {showText && (
        <div className={`flex flex-col ${isVertical ? 'items-center mt-1' : 'justify-center'} leading-none`}>
          <span
            className={`${dimensions.text} uppercase font-black text-white`}
            style={{
              textShadow: '0 2px 14px rgba(168, 85, 247, 0.6)',
              fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
            }}
          >
            ALPHA{' '}
            <span className="bg-gradient-to-r from-[#D8B4FE] via-[#EC4899] to-[#F43F5E] bg-clip-text text-transparent">
              MATE
            </span>
          </span>

          {showTagline && (
            <span
              className={`mt-1.5 font-bold tracking-[0.24em] text-[#C084FC] uppercase ${dimensions.tagline}`}
              style={{
                textShadow: '0 0 10px rgba(192, 132, 252, 0.5)',
              }}
            >
              LIVE • PARTY • SOCIAL
            </span>
          )}
        </div>
      )}
    </div>
  );
};
