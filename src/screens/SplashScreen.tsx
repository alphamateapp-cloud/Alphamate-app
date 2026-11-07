import React, { useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { AlphaMateLogo } from '../components/brand/AlphaMateLogo';

export const SplashScreen: React.FC = () => {
  const { setCurrentScreen, isAuthenticated, currentUser, customLogoUrl } = useApp();

  const handleNextScreen = () => {
    // If the user has already logged in/registered, go directly into the app (home)
    // Never show welcome/register/signin screens repeatedly
    if (isAuthenticated && currentUser) {
      setCurrentScreen('home');
    } else {
      setCurrentScreen('welcome');
    }
  };

  useEffect(() => {
    // Automatically transition into the app after 1.8 seconds
    const timer = setTimeout(() => {
      handleNextScreen();
    }, 1800);

    return () => clearTimeout(timer);
  }, [isAuthenticated, currentUser]);

  return (
    <div
      onClick={handleNextScreen}
      className="relative w-full h-full min-h-[640px] flex flex-col items-center justify-center cursor-pointer select-none overflow-hidden bg-gradient-to-b from-[#09070F] via-[#140D26] to-[#05030A]"
    >
      {/* Ambient glowing radial effects */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-gradient-to-tr from-[#7928CA]/30 via-[#A855F7]/25 to-[#EC4899]/20 blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full bg-[#7928CA]/40 blur-2xl pointer-events-none" />

      {/* Subtle background ambient mesh */}
      <div
        className="absolute inset-0 opacity-15 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(168, 85, 247, 0.25) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* Logo & App Name Container (Strict requirement: ONLY logo and app name, NO tagline on splash) */}
      <div className="relative z-10 flex flex-col items-center text-center animate-fade-in">
        <div className="transition-transform duration-700 hover:scale-105 active:scale-95">
          <AlphaMateLogo
            size="xl"
            showText={true}
            withGlow={true}
            customLogoUrl={customLogoUrl}
          />
        </div>

        {/* Subtle loading spinner / pulse */}
        <div className="mt-12 flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-[#A855F7] animate-bounce [animation-delay:-0.3s]" />
          <div className="w-2 h-2 rounded-full bg-[#EC4899] animate-bounce [animation-delay:-0.15s]" />
          <div className="w-2 h-2 rounded-full bg-[#C084FC] animate-bounce" />
        </div>
      </div>

      {/* Screen tap hint */}
      <div className="absolute bottom-8 text-[11px] text-zinc-500 tracking-wider uppercase font-medium">
        Tap anywhere to continue
      </div>
    </div>
  );
};
