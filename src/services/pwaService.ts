import { Capacitor } from '@capacitor/core';
import { registerSW } from 'virtual:pwa-register';

const SW_UPDATE_INTERVAL_MS = 60 * 60 * 1000; // Check for SW updates every 60 minutes

let swInitialized = false;

/**
 * Registers the Vite PWA Workbox Service Worker in web/PWA browsers.
 * Skipped inside Capacitor native Android/iOS shells where assets are bundled locally.
 */
export function initServiceWorker(): void {
  if (swInitialized) return;
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  if (Capacitor.isNativePlatform()) return;

  swInitialized = true;

  try {
    registerSW({
      immediate: true,
      onRegisteredSW(_swUrl, registration) {
        if (!registration) return;
        setInterval(() => {
          if (typeof navigator !== 'undefined' && navigator.onLine !== false) {
            registration.update().catch(() => {});
          }
        }, SW_UPDATE_INTERVAL_MS);
      },
      onRegisterError(error) {
        console.warn('[PWA] Service Worker registration skipped:', error);
      },
    });
  } catch (error) {
    console.warn('[PWA] Unable to initialize Service Worker:', error);
  }
}
