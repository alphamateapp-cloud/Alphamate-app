import { Capacitor, registerPlugin } from '@capacitor/core';
import { auth } from './firebase';

type NativeDeviceInfo = {
  installationId: string; brand: string; manufacturer: string; model: string;
  device: string; product: string; androidVersion: string; androidApi: number;
};
interface DeviceSecurityPluginContract {
  getDeviceInfo(): Promise<NativeDeviceInfo>;
}
const NativeDeviceSecurity = registerPlugin<DeviceSecurityPluginContract>('DeviceSecurity');

const FUNCTION_URL = 'https://us-central1-gen-lang-client-0468444352.cloudfunctions.net/recordDeviceSecurityActivity';

function webInstallationId(): string {
  const key = 'alpha_mate_installation_id';
  let value = localStorage.getItem(key);
  if (!value) {
    value = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(key, value);
  }
  return value;
}

async function readDeviceInfo() {
  if (Capacitor.getPlatform() === 'android') {
    try { return await NativeDeviceSecurity.getDeviceInfo(); } catch {}
  }
  const ua = navigator.userAgent;
  const android = ua.match(/Android\s([\d.]+)/i)?.[1] || '';
  return {
    installationId: webInstallationId(),
    brand: 'Unknown',
    manufacturer: 'Unknown',
    model: /;\s*([^;)]+)\s+Build\//i.exec(ua)?.[1] || 'Browser / Web device',
    device: 'web',
    product: 'web',
    androidVersion: android,
    androidApi: 0,
  };
}

let watchId: number | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let sending = false;
let lastSentAtMs = 0;
let lastGeoSentAtMs = 0;
const MIN_FOREGROUND_HEARTBEAT_MS = 120_000;
const MIN_RESUME_THROTTLE_MS = 35_000;
const MIN_GPS_REPORT_INTERVAL_MS = 120_000;

async function sendActivity(includeLocation: boolean, options?: { force?: boolean }) {
  if (sending) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  if (!options?.force && typeof document !== 'undefined' && document.hidden) return;
  const now = Date.now();
  if (!options?.force && now - lastSentAtMs < MIN_RESUME_THROTTLE_MS) return;

  const user = auth.currentUser;
  if (!user) return;
  sending = true;
  try {
    const [device, token] = await Promise.all([readDeviceInfo(), user.getIdToken()]);
    let location: { latitude: number; longitude: number; accuracy: number } | null = null;
    if (includeLocation && 'geolocation' in navigator) {
      location = await new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: Math.round(pos.coords.accuracy),
          }),
          () => resolve(null),
          { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
        );
      });
    }
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 8000) : null;
    try {
      const response = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        signal: controller?.signal,
        body: JSON.stringify({
          device,
          location,
          locationConsent: includeLocation,
          platform: Capacitor.getPlatform(),
          appVersion: '1.4.0',
          userAgent: navigator.userAgent.slice(0, 500),
        }),
      });
      lastSentAtMs = Date.now();
      if (includeLocation) lastGeoSentAtMs = lastSentAtMs;
      if (response.status === 403) {
        const body = await response.json().catch(() => ({}));
        if (body?.banned) {
          await auth.signOut();
          window.dispatchEvent(new CustomEvent('alpha-mate-security-blocked', {
            detail: { message: body.message || 'This account or device is restricted.' },
          }));
        }
      }
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  } catch (error) {
    console.warn('Device security sync failed', error);
  } finally {
    sending = false;
  }
}

/** Starts foreground device/IP heartbeats. GPS is requested only with explicit consent. */
export async function startDeviceSecurityMonitoring() {
  stopDeviceSecurityMonitoring();
  if (!auth.currentUser) return;
  let locationConsent = false;
  try {
    locationConsent = localStorage.getItem('alpha_mate_location_consent') === 'granted';
    if (!locationConsent && 'geolocation' in navigator) {
      // Browser/Android permission prompt is shown by the OS only after this explicit request.
      locationConsent = await new Promise<boolean>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          () => { localStorage.setItem('alpha_mate_location_consent', 'granted'); resolve(true); },
          () => resolve(false),
          { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
        );
      });
    }
  } catch { locationConsent = false; }

  await sendActivity(locationConsent, { force: true });
  if (locationConsent && 'geolocation' in navigator) {
    watchId = navigator.geolocation.watchPosition(
      () => {
        if (typeof document !== 'undefined' && document.hidden) return;
        if (Date.now() - lastGeoSentAtMs < MIN_GPS_REPORT_INTERVAL_MS) return;
        void sendActivity(true);
      },
      () => {},
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 20_000 },
    );
  }
  heartbeatTimer = setInterval(() => {
    if (typeof document !== 'undefined' && document.hidden) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    void sendActivity(locationConsent);
  }, MIN_FOREGROUND_HEARTBEAT_MS);
  document.addEventListener('visibilitychange', onVisibility);
}
function onVisibility() {
  if (document.visibilityState === 'visible') {
    void sendActivity(localStorage.getItem('alpha_mate_location_consent') === 'granted');
  }
}
export function stopDeviceSecurityMonitoring() {
  if (watchId !== null && 'geolocation' in navigator) navigator.geolocation.clearWatch(watchId);
  watchId = null;
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = null;
  document.removeEventListener('visibilitychange', onVisibility);
}
