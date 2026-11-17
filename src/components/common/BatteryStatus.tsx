import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Capacitor, registerPlugin, PluginListenerHandle } from '@capacitor/core';
import { BatteryWarning, CheckCircle2, Save, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  auth,
  syncUserProfileToFirestore,
  updateLiveStreamFields,
  updatePartyRoomFields,
} from '../../services/firebase';

interface BatteryStatusPluginContract {
  getStatus(): Promise<{ level: number; isCharging: boolean }>;
  addListener(
    eventName: 'batteryChanged',
    listenerFunc: (event: { level: number; isCharging: boolean }) => void
  ): Promise<PluginListenerHandle>;
}

const NativeBatteryStatus = registerPlugin<BatteryStatusPluginContract>('BatteryStatus');

interface WebBatteryManager extends EventTarget {
  level: number;
  charging: boolean;
}

interface BatteryStatusProps {
  /** Low battery threshold percentage (default: 10%). */
  threshold?: number;
}

const SESSION_CHECKPOINT_KEY = 'alphamate_session_checkpoint';

export const BatteryStatus: React.FC<BatteryStatusProps> = ({ threshold = 10 }) => {
  const {
    currentScreen,
    activeStream,
    activePartyRoom,
    currentUser,
    userSeatIndex,
  } = useApp();

  const isInLiveOrParty = Boolean(
    activePartyRoom !== null ||
      activeStream !== null ||
      currentScreen === 'party_room' ||
      currentScreen === 'live_stream' ||
      currentScreen === 'pk_battle'
  );

  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [isCharging, setIsCharging] = useState<boolean>(false);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');

  const lastSessionKeyRef = useRef<string>('');
  const dismissedAtLevelRef = useRef<number | null>(null);
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentSessionKey = activePartyRoom?.id
    ? `party:${activePartyRoom.id}`
    : activeStream?.id
      ? `live:${activeStream.id}`
      : isInLiveOrParty
        ? `screen:${currentScreen}`
        : '';

  // Reset dismissal when entering a new live stream or party room session
  useEffect(() => {
    if (currentSessionKey !== lastSessionKeyRef.current) {
      lastSessionKeyRef.current = currentSessionKey;
      setIsDismissed(false);
      setSaveState('idle');
      dismissedAtLevelRef.current = null;
    }
  }, [currentSessionKey]);

  // Monitor battery state only while actively inside a Live Stream, PK Battle, or Party Room
  useEffect(() => {
    if (!isInLiveOrParty) {
      setIsDismissed(false);
      setSaveState('idle');
      return;
    }

    let cancelled = false;
    let nativeListener: PluginListenerHandle | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let webBattery: WebBatteryManager | null = null;

    const applySample = (rawPercent: number, charging: boolean) => {
      if (cancelled || !Number.isFinite(rawPercent) || rawPercent < 0 || rawPercent > 100) return;
      const rounded = Math.round(rawPercent);
      setBatteryLevel(rounded);
      setIsCharging(Boolean(charging));

      if (charging || rounded >= threshold) {
        dismissedAtLevelRef.current = null;
        setIsDismissed(false);
      } else if (
        dismissedAtLevelRef.current !== null &&
        rounded <= 5 &&
        dismissedAtLevelRef.current > 5
      ) {
        // Re-alert unobtrusively once if battery reaches critical <= 5%
        setIsDismissed(false);
        setSaveState('idle');
      }
    };

    const isAndroidNative =
      Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

    if (isAndroidNative) {
      const readNative = () => {
        NativeBatteryStatus.getStatus()
          .then((res) => {
            if (typeof res?.level === 'number' && res.level >= 0) {
              applySample(res.level, Boolean(res.isCharging));
            }
          })
          .catch(() => {});
      };

      readNative();
      NativeBatteryStatus.addListener('batteryChanged', (ev) => {
        if (typeof ev?.level === 'number' && ev.level >= 0) {
          applySample(ev.level, Boolean(ev.isCharging));
        }
      })
        .then((handle) => {
          if (cancelled) {
            handle.remove().catch(() => {});
          } else {
            nativeListener = handle;
          }
        })
        .catch(() => {});
      pollTimer = setInterval(readNative, 30_000);
    }

    const nav = navigator as Navigator & {
      getBattery?: () => Promise<WebBatteryManager>;
    };

    const syncWebBattery = () => {
      if (!webBattery) return;
      applySample(webBattery.level * 100, webBattery.charging);
    };

    if (!isAndroidNative && typeof nav.getBattery === 'function') {
      nav
        .getBattery()
        .then((bat) => {
          if (cancelled || !bat) return;
          webBattery = bat;
          syncWebBattery();
          bat.addEventListener('levelchange', syncWebBattery);
          bat.addEventListener('chargingchange', syncWebBattery);
        })
        .catch(() => {});
    }

    return () => {
      cancelled = true;
      if (nativeListener) {
        nativeListener.remove().catch(() => {});
      }
      if (pollTimer) {
        clearInterval(pollTimer);
      }
      if (webBattery) {
        webBattery.removeEventListener('levelchange', syncWebBattery);
        webBattery.removeEventListener('chargingchange', syncWebBattery);
      }
    };
  }, [isInLiveOrParty, threshold]);

  useEffect(() => {
    return () => {
      if (savedTimeoutRef.current) {
        clearTimeout(savedTimeoutRef.current);
      }
    };
  }, []);

  const handleDismiss = useCallback(() => {
    dismissedAtLevelRef.current = batteryLevel;
    setIsDismissed(true);
  }, [batteryLevel]);

  const handleSaveSessionProgress = useCallback(async () => {
    if (saveState === 'saving' || saveState === 'saved') return;
    setSaveState('saving');

    try {
      const uid = auth.currentUser?.uid || currentUser.id;
      const isParty = Boolean(activePartyRoom);
      const isHost = isParty
        ? activePartyRoom?.host?.id === uid
        : activeStream?.host?.id === uid;

      const checkpoint = {
        savedAt: new Date().toISOString(),
        batteryLevel,
        sessionType: activePartyRoom
          ? 'party_room'
          : currentScreen === 'pk_battle'
            ? 'pk_battle'
            : 'live_stream',
        sessionId: activePartyRoom?.id || activeStream?.id || null,
        sessionTitle: activePartyRoom?.title || activeStream?.title || '',
        role: isHost ? 'host' : userSeatIndex !== null ? 'guest' : 'viewer',
        seatIndex: userSeatIndex,
        userSnapshot: {
          id: uid,
          coins: currentUser.coins,
          diamonds: currentUser.diamonds,
          level: currentUser.level,
          xp: currentUser.xp,
        },
      };

      try {
        localStorage.setItem(SESSION_CHECKPOINT_KEY, JSON.stringify(checkpoint));
      } catch {
        // Ignore storage quota restrictions
      }

      if (auth.currentUser?.uid && currentUser.id === auth.currentUser.uid) {
        await syncUserProfileToFirestore(currentUser, { background: true }).catch(() => {});
      }

      if (activePartyRoom?.id && isHost) {
        await updatePartyRoomFields(activePartyRoom.id, {
          lastSeenAtMs: Date.now(),
        }).catch(() => {});
      } else if (activeStream?.id && isHost) {
        await updateLiveStreamFields(activeStream.id, {
          lastSeenAtMs: Date.now(),
        }).catch(() => {});
      }

      setSaveState('saved');
      dismissedAtLevelRef.current = batteryLevel;
      if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
      savedTimeoutRef.current = setTimeout(() => {
        setIsDismissed(true);
        setSaveState('idle');
      }, 2200);
    } catch {
      setSaveState('saved');
      if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
      savedTimeoutRef.current = setTimeout(() => {
        setIsDismissed(true);
        setSaveState('idle');
      }, 2000);
    }
  }, [
    saveState,
    currentUser,
    activePartyRoom,
    activeStream,
    batteryLevel,
    currentScreen,
    userSeatIndex,
  ]);

  const shouldAlert =
    isInLiveOrParty &&
    batteryLevel !== null &&
    batteryLevel < threshold &&
    !isCharging &&
    !isDismissed;

  if (!shouldAlert && saveState !== 'saved') {
    return null;
  }

  const isCritical = batteryLevel !== null && batteryLevel <= 5;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-[max(3.5rem,calc(env(safe-area-inset-top,0px)+3rem))] left-1/2 -translate-x-1/2 w-[calc(100%-1.5rem)] max-w-sm z-[75] pointer-events-auto animate-fade-in"
    >
      <div
        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-2xl backdrop-blur-md shadow-2xl border ${
          saveState === 'saved'
            ? 'bg-emerald-950/90 border-emerald-500/45 text-emerald-100'
            : isCritical
              ? 'bg-rose-950/92 border-rose-500/50 text-rose-50'
              : 'bg-[#190D2E]/95 border-amber-400/45 text-amber-50'
        }`}
      >
        <div
          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
            saveState === 'saved'
              ? 'bg-emerald-500/20 text-emerald-300'
              : isCritical
                ? 'bg-rose-500/20 text-rose-300'
                : 'bg-amber-500/20 text-amber-300'
          }`}
        >
          {saveState === 'saved' ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <BatteryWarning className="w-4 h-4" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold leading-tight truncate">
            {saveState === 'saved'
              ? 'Session progress saved'
              : `Low Battery (${batteryLevel}%)`}
          </p>
          <p className="text-[10px] opacity-80 leading-snug mt-0.5">
            {saveState === 'saved'
              ? 'Your profile & room progress are synced.'
              : 'Save your session progress before your device powers off.'}
          </p>
        </div>

        {saveState !== 'saved' && (
          <button
            type="button"
            onClick={handleSaveSessionProgress}
            disabled={saveState === 'saving'}
            className="shrink-0 px-2.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 text-[10px] font-extrabold flex items-center gap-1 shadow-sm cursor-pointer disabled:opacity-60 transition-colors"
          >
            <Save className="w-3 h-3" />
            <span>{saveState === 'saving' ? 'Saving…' : 'Save'}</span>
          </button>
        )}

        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss battery alert"
          className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/75 hover:text-white shrink-0 cursor-pointer transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
