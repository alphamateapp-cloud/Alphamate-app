import React, { useEffect, useRef, useState } from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  const wasOfflineRef = useRef(false);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      wasOfflineRef.current = true;
      setShowReconnected(false);
      return;
    }

    if (wasOfflineRef.current) {
      wasOfflineRef.current = false;
      setShowReconnected(true);
      const timer = setTimeout(() => setShowReconnected(false), 3200);
      return () => clearTimeout(timer);
    }
  }, [isOnline]);

  if (isOnline && !showReconnected) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[65] pointer-events-none px-3 w-full max-w-sm flex justify-center"
    >
      {!isOnline ? (
        <div className="flex items-center gap-2 rounded-full border border-amber-400/35 bg-[#1D1308]/95 px-3.5 py-1.5 text-[11px] font-semibold text-amber-100 shadow-xl">
          <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0 animate-pulse" />
          <span>Reconnecting…</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-full border border-emerald-400/35 bg-[#081F15]/95 px-3.5 py-1.5 text-[11px] font-semibold text-emerald-100 shadow-xl">
          <Wifi className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>Connected</span>
        </div>
      )}
    </div>
  );
};
