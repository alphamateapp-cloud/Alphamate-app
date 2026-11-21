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
        <div className="flex items-center gap-2 rounded-2xl border border-amber-400/35 bg-[#1D1308]/95 backdrop-blur-xl px-3.5 py-2 text-xs font-semibold text-amber-100 shadow-2xl shadow-black/60">
          <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0 animate-pulse" />
          <span>Offline Mode — Showing cached UI &amp; profiles</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-400/35 bg-[#081F15]/95 backdrop-blur-xl px-3.5 py-2 text-xs font-semibold text-emerald-100 shadow-2xl shadow-black/60">
          <Wifi className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>Back online — Live sync restored</span>
        </div>
      )}
    </div>
  );
};
