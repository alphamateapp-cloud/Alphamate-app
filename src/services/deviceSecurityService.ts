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

async function sendActivity(includeLocation: boolean) {
  if (sending) return;
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
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 15000 },
        );
      });
    }
    const response = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device,
        location,
        locationConsent: includeLocation,
        platform: Capacitor.getPlatform(),
        appVersion: '1.2.0',
        userAgent: navigator.userAgent.slice(0, 500),
      }),
    });
    if (response.status === 403) {
      const body = await response.json().catch(() => ({}));
      if (body?.banned) {
        await auth.signOut();
        window.dispatchEvent(new CustomEvent('alpha-mate-security-blocked', {
          detail: { message: body.message || 'This account or device is restricted.' },
        }));
      }
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
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 },
        );
      });
    }
  } catch { locationConsent = false; }

  await sendActivity(locationConsent);
  if (locationConsent && 'geolocation' in navigator) {
    watchId = navigator.geolocation.watchPosition(
      () => { void sendActivity(true); },
      () => {},
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 },
    );
  }
  heartbeatTimer = setInterval(() => { void sendActivity(locationConsent); }, 30000);
  document.addEventListener('visibilitychange', onVisibility);
}
function onVisibility() {
  if (document.visibilityState === 'visible') void sendActivity(
    localStorage.getItem('alpha_mate_location_consent') === 'granted',
  );
}
export function stopDeviceSecurityMonitoring() {
  if (watchId !== null && 'geolocation' in navigator) navigator.geolocation.clearWatch(watchId);
  watchId = null;
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = null;
  document.removeEventListener('visibilitychange', onVisibility);
}
