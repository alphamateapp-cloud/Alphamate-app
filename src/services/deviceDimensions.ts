import { Capacitor, registerPlugin } from '@capacitor/core';

interface SystemInsetsResult {
  top: number;
  bottom: number;
  left: number;
  right: number;
  appliedNatively: boolean;
}

interface SystemInsetsPluginInterface {
  getInsets: () => Promise<SystemInsetsResult>;
}

const SystemInsets = registerPlugin<SystemInsetsPluginInterface>('SystemInsets');

/**
 * Synchronizes dynamic viewport dimensions (`--app-viewport-height`, `--app-viewport-width`)
 * and system-bar safe-area insets across Native Android (API 24–36+), iOS, PWA, and Web browsers.
 *
 * - On Native Android: `MainActivity.java` pads the root container natively by the exact
 *   systemBars + displayCutout + IME insets, so we mark `html.am-native-insets` to prevent
 *   double top/bottom spacing while ensuring every button starts cleanly below battery/time/signal.
 * - On Mobile Web / PWA / iOS: falls back to CSS `env(safe-area-inset-*)` and tracks
 *   `window.visualViewport` height so dynamic browser bars & keyboards never clip buttons.
 */
export function initDeviceDimensions(): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => {};
  }

  const root = document.documentElement;
  const isNative = Capacitor.isNativePlatform();
  const platform = Capacitor.getPlatform();

  root.classList.toggle('am-native-app', isNative);
  root.classList.toggle('am-android', platform === 'android');
  root.classList.toggle('am-ios', platform === 'ios');

  const syncViewportDimensions = () => {
    const vv = window.visualViewport;
    const height = Math.round(vv?.height || window.innerHeight || 0);
    const width = Math.round(vv?.width || window.innerWidth || 0);
    if (height > 0) {
      root.style.setProperty('--app-viewport-height', `${height}px`);
    }
    if (width > 0) {
      root.style.setProperty('--app-viewport-width', `${width}px`);
    }
  };

  syncViewportDimensions();

  const syncNativeInsets = async () => {
    if (!isNative || platform !== 'android') return;

    try {
      if (Capacitor.isPluginAvailable('SystemInsets')) {
        const insets = await SystemInsets.getInsets();
        if (insets?.appliedNatively) {
          // Native MainActivity already padded android.R.id.content by exact statusBar/cutout/navBar
          root.classList.add('am-native-insets');
          root.style.setProperty('--app-native-top-dp', `${insets.top || 0}px`);
          root.style.setProperty('--app-native-bottom-dp', `${insets.bottom || 0}px`);
          return;
        }
      }
    } catch {
      // Fall through to safe fallback check
    }

    // Fallback: if native Android plugin isn't present in an older APK build, ensure top clearance
    root.classList.remove('am-native-insets');
    root.style.setProperty('--app-safe-top', 'max(env(safe-area-inset-top, 0px), 28px)');
    root.style.setProperty('--app-safe-bottom', 'max(env(safe-area-inset-bottom, 0px), 12px)');
  };

  void syncNativeInsets();
  const delayedRecheck = window.setTimeout(() => {
    syncViewportDimensions();
    void syncNativeInsets();
  }, 350);

  const handleResize = () => {
    syncViewportDimensions();
    if (isNative && platform === 'android') {
      void syncNativeInsets();
    }
  };

  window.addEventListener('resize', handleResize, { passive: true });
  window.addEventListener('orientationchange', handleResize, { passive: true });
  window.visualViewport?.addEventListener('resize', syncViewportDimensions, { passive: true });

  return () => {
    window.clearTimeout(delayedRecheck);
    window.removeEventListener('resize', handleResize);
    window.removeEventListener('orientationchange', handleResize);
    window.visualViewport?.removeEventListener('resize', syncViewportDimensions);
  };
}
