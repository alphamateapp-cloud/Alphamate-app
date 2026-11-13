import React, { useEffect } from 'react';
import { useApp } from '../context/AppContext';

export const SplashScreen: React.FC = () => {
  const {
    setCurrentScreen,
    isAuthenticated,
    firebaseUser,
    firebaseAuthLoading,
    isEmailVerified,
    customLogoUrl,
  } = useApp();
  const [minDelayElapsed, setMinDelayElapsed] = React.useState(false);
  const [tapPending, setTapPending] = React.useState(false);

  const navigateNext = React.useCallback(() => {
    if (isAuthenticated && firebaseUser && isEmailVerified) {
      setCurrentScreen('home');
    } else {
      setCurrentScreen('welcome');
    }
  }, [isAuthenticated, firebaseUser, isEmailVerified, setCurrentScreen]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setMinDelayElapsed(true);
    }, 1600);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!firebaseAuthLoading && (minDelayElapsed || tapPending)) {
      navigateNext();
    }
  }, [firebaseAuthLoading, minDelayElapsed, tapPending, navigateNext]);

  const handleNextScreen = () => {
    if (!firebaseAuthLoading) {
      navigateNext();
    } else {
      setTapPending(true);
    }
  };

  const logoSrc = customLogoUrl || '/alpha-mate-logo-emblem.png';

  return (
    <div
      onClick={handleNextScreen}
      className="relative flex h-full min-h-[100dvh] w-full cursor-pointer select-none flex-col items-center justify-center overflow-hidden bg-[#080510] px-5"
      role="button"
      aria-label="Continue to Alpha Mate"
    >
      {/* Deep purple ambient glow, matching the approved splash concept */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[min(82vw,560px)] w-[min(82vw,560px)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#7928CA]/25 blur-[100px]" />
      <div className="pointer-events-none absolute left-1/2 top-[43%] h-[min(58vw,390px)] w-[min(58vw,390px)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#A855F7]/20 blur-[85px]" />

      {/* Fine background texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            'radial-gradient(circle, rgba(192,132,252,0.48) 0.8px, transparent 0.9px)',
          backgroundSize: '25px 25px',
        }}
      />

      {/* Official logo enlarged and centered above the app name */}
      <div className="relative z-10 flex w-full max-w-md -translate-y-2 flex-col items-center text-center">
        <div className="relative flex items-center justify-center">
          <div className="pointer-events-none absolute -inset-8 rounded-[42px] bg-gradient-to-br from-[#7928CA]/35 via-[#A855F7]/25 to-[#EC4899]/25 blur-3xl" />
          <img
            src={logoSrc}
            alt="Alpha Mate official logo"
            className="relative z-10 h-[clamp(168px,48vw,218px)] w-[clamp(168px,48vw,218px)] rounded-[28px] object-contain drop-shadow-[0_0_28px_rgba(168,85,247,0.58)]"
          />
        </div>

        <h1 className="mt-7 text-center text-[clamp(30px,8vw,42px)] font-extrabold leading-none tracking-[0.09em] text-white [text-shadow:0_2px_18px_rgba(168,85,247,0.42)]">
          ALPHA{' '}
          <span className="bg-gradient-to-r from-[#D8B4FE] via-[#EC4899] to-[#F43F5E] bg-clip-text text-transparent">
            MATE
          </span>
        </h1>

        {/* Three animated loading dots */}
        <div className="mt-10 flex items-center justify-center gap-2.5" aria-hidden="true">
          <span className="h-3.5 w-3.5 animate-bounce rounded-full bg-[#A855F7] [animation-delay:-0.3s]" />
          <span className="h-3.5 w-3.5 animate-bounce rounded-full bg-[#EC4899] [animation-delay:-0.15s]" />
          <span className="h-3.5 w-3.5 animate-bounce rounded-full bg-[#C084FC]" />
        </div>
      </div>

      {/* Existing tap-to-continue hint stays at the bottom */}
      <div className="absolute bottom-[max(28px,env(safe-area-inset-bottom))] z-10 text-center text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
        Tap anywhere to continue
      </div>
    </div>
  );
};
