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

/** Keeps the display awake only while the user is in a live broadcast or party room. */
export class KeepScreenAwakeController {
  private active = false;
  private wakeLock: WakeLockSentinelLike | null = null;
  private onVisibilityChange = () => {
    if (this.active && document.visibilityState === 'visible') void this.enable();
  };

  async setActive(active: boolean): Promise<void> {
    this.active = active;
    if (active) {
      document.addEventListener('visibilitychange', this.onVisibilityChange);
      await this.enable();
      return;
    }
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
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

    const wakeLockApi = (navigator as Navigator & {
      wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> };
    }).wakeLock;
    if (!wakeLockApi || this.wakeLock && !this.wakeLock.released) return;
    try {
      this.wakeLock = await wakeLockApi.request('screen');
      this.wakeLock.addEventListener?.('release', () => {
        this.wakeLock = null;
        if (this.active && document.visibilityState === 'visible') void this.enable();
      });
    } catch (error) {
      console.warn('[KeepScreenAwake] Browser screen wake lock unavailable:', error);
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
      try { await this.wakeLock.release(); } catch {}
    }
    this.wakeLock = null;
  }
}
