import { Capacitor, registerPlugin } from '@capacitor/core';

interface KeepScreenOnPluginContract {
  setEnabled(options: { enabled: boolean }): Promise<{ enabled: boolean }>;
}

const NativeKeepScreenOn = registerPlugin<KeepScreenOnPluginContract>('KeepScreenOn');

type WakeLockSentinelLike = {
  released: boolean;
  release: () => Promise<void>;
  addEventListener?: (type: 'release', listener: () => void) => void;
};

/** Keeps the display awake while the user is in any Live Stream, PK Battle, or Party Room (host, guest, viewer, or audience). */
export class KeepScreenAwakeController {
  private active = false;
  private wakeLock: WakeLockSentinelLike | null = null;
  private listenersAttached = false;
  private requestInFlight = false;

  private reacquireIfVisible = () => {
    if (this.active && (typeof document === 'undefined' || document.visibilityState === 'visible')) {
      void this.enable();
    }
  };

  private attachListeners() {
    if (this.listenersAttached || typeof document === 'undefined' || typeof window === 'undefined') return;
    this.listenersAttached = true;
    document.addEventListener('visibilitychange', this.reacquireIfVisible);
    window.addEventListener('focus', this.reacquireIfVisible);
    window.addEventListener('pageshow', this.reacquireIfVisible);
    window.addEventListener('pointerdown', this.reacquireIfVisible, { passive: true });
    window.addEventListener('touchstart', this.reacquireIfVisible, { passive: true });
  }

  private detachListeners() {
    if (!this.listenersAttached || typeof document === 'undefined' || typeof window === 'undefined') return;
    this.listenersAttached = false;
    document.removeEventListener('visibilitychange', this.reacquireIfVisible);
    window.removeEventListener('focus', this.reacquireIfVisible);
    window.removeEventListener('pageshow', this.reacquireIfVisible);
    window.removeEventListener('pointerdown', this.reacquireIfVisible);
    window.removeEventListener('touchstart', this.reacquireIfVisible);
  }

  async setActive(active: boolean): Promise<void> {
    const nextActive = Boolean(active);
    if (this.active === nextActive) {
      if (nextActive) {
        await this.enable();
      }
      return;
    }

    this.active = nextActive;
    if (nextActive) {
      this.attachListeners();
      await this.enable();
      return;
    }

    this.detachListeners();
    await this.disable();
  }

  private async enable(): Promise<void> {
    if (!this.active) return;

    if (Capacitor.isNativePlatform()) {
      try {
        await NativeKeepScreenOn.setEnabled({ enabled: true });
      } catch (error) {
        console.warn('[KeepScreenAwake] Native keep-screen-on request failed:', error);
      }
      return;
    }

    if (typeof navigator === 'undefined') return;
    const wakeLockApi = (navigator as Navigator & {
      wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> };
    }).wakeLock;
    if (!wakeLockApi) return;
    if ((this.wakeLock && !this.wakeLock.released) || this.requestInFlight) return;
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;

    this.requestInFlight = true;
    try {
      const sentinel = await wakeLockApi.request('screen');
      if (!this.active) {
        try {
          await sentinel.release();
        } catch {
          // ignore
        }
        return;
      }
      this.wakeLock = sentinel;
      sentinel.addEventListener?.('release', () => {
        if (this.wakeLock === sentinel) {
          this.wakeLock = null;
        }
        if (this.active && document.visibilityState === 'visible') {
          void this.enable();
        }
      });
    } catch {
      // Browser may defer wake lock until a user gesture or page focus; listener will retry automatically.
    } finally {
      this.requestInFlight = false;
    }
  }

  private async disable(): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      try {
        await NativeKeepScreenOn.setEnabled({ enabled: false });
      } catch (error) {
        console.warn('[KeepScreenAwake] Native keep-screen-on release failed:', error);
      }
    }
    if (this.wakeLock && !this.wakeLock.released) {
      try {
        await this.wakeLock.release();
      } catch {
        // ignore
      }
    }
    this.wakeLock = null;
  }
}

export const keepScreenAwake = new KeepScreenAwakeController();
