import { SavedDeviceAccount, User } from '../types';
import { sanitizeAvatarString } from '../utils/imageCompressor';

export const MAX_DEVICE_ACCOUNTS = 5;
const MULTI_ACCOUNT_STORAGE_KEY = 'alphamate_saved_device_accounts_v1';
const DEVICE_FINGERPRINT_KEY = 'alphamate_device_switch_fp_v1';

export function getOrCreateDeviceFingerprint(): string {
  try {
    const existing = localStorage.getItem(DEVICE_FINGERPRINT_KEY);
    if (existing && existing.length >= 12) return existing;
    const bytes = new Uint8Array(16);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(bytes);
    } else {
      for (let i = 0; i < bytes.length; i++) {
        bytes[i] = Math.floor(Math.random() * 256);
      }
    }
    const generated = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    localStorage.setItem(DEVICE_FINGERPRINT_KEY, generated);
    return generated;
  } catch {
    return 'alphamate_device_default_fp';
  }
}

export function loadSavedDeviceAccounts(): SavedDeviceAccount[] {
  try {
    const raw = localStorage.getItem(MULTI_ACCOUNT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item: any) => item && typeof item.uid === 'string' && item.uid.trim().length > 0)
      .slice(0, MAX_DEVICE_ACCOUNTS);
  } catch {
    return [];
  }
}

function persistSavedDeviceAccounts(accounts: SavedDeviceAccount[]): SavedDeviceAccount[] {
  const trimmed = accounts.slice(0, MAX_DEVICE_ACCOUNTS);
  try {
    localStorage.setItem(MULTI_ACCOUNT_STORAGE_KEY, JSON.stringify(trimmed));
  } catch (err) {
    console.warn('Could not persist multi-account list:', err);
  }
  return trimmed;
}

export function upsertSavedDeviceAccount(params: {
  user: User;
  firebaseUserBlob?: Record<string, any> | null;
  switchSessionId?: string;
  switchTicket?: string;
}): {
  accounts: SavedDeviceAccount[];
  limitReached: boolean;
} {
  const uid = String(params.user?.id || '').trim();
  if (!uid || uid === 'current_user' || uid.startsWith('user_demo')) {
    return { accounts: loadSavedDeviceAccounts(), limitReached: false };
  }

  const current = loadSavedDeviceAccounts();
  const existingIndex = current.findIndex((a) => a.uid === uid);

  if (existingIndex === -1 && current.length >= MAX_DEVICE_ACCOUNTS) {
    return { accounts: current, limitReached: true };
  }

  const prev = existingIndex >= 0 ? current[existingIndex] : undefined;
  const entry: SavedDeviceAccount = {
    uid,
    uniqueId: params.user.uniqueId || prev?.uniqueId || `AM_${uid.slice(0, 6).toUpperCase()}`,
    username: params.user.username || prev?.username || 'alphamate',
    displayName: params.user.displayName || prev?.displayName || 'Alpha Mate',
    email: (params.user.email || prev?.email || '').trim().toLowerCase(),
    avatar: sanitizeAvatarString(params.user.avatar || prev?.avatar || ''),
    vipTier: typeof params.user.vipTier === 'number' ? params.user.vipTier : prev?.vipTier || 1,
    level: typeof params.user.level === 'number' ? params.user.level : prev?.level || 1,
    authProvider: params.user.authProvider || prev?.authProvider || 'email',
    hasPassword:
      typeof params.user.hasPassword === 'boolean'
        ? params.user.hasPassword
        : Boolean(prev?.hasPassword),
    profileCompleted:
      typeof params.user.profileCompleted === 'boolean'
        ? params.user.profileCompleted
        : Boolean(prev?.profileCompleted),
    lastActiveAt: new Date().toISOString(),
    lastActiveAtMs: Date.now(),
    switchSessionId: params.switchSessionId || prev?.switchSessionId,
    switchTicket: params.switchTicket || prev?.switchTicket,
    firebaseUserBlob: params.firebaseUserBlob || prev?.firebaseUserBlob,
  };

  const withoutTarget = current.filter((a) => a.uid !== uid);
  const nextList = [entry, ...withoutTarget].slice(0, MAX_DEVICE_ACCOUNTS);
  return {
    accounts: persistSavedDeviceAccounts(nextList),
    limitReached: false,
  };
}

export function updateSavedDeviceAccountSessionData(
  uid: string,
  patch: Partial<Pick<SavedDeviceAccount, 'firebaseUserBlob' | 'switchSessionId' | 'switchTicket' | 'lastActiveAt' | 'hasPassword' | 'profileCompleted'>>
): SavedDeviceAccount[] {
  const cleanUid = String(uid || '').trim();
  if (!cleanUid) return loadSavedDeviceAccounts();
  const current = loadSavedDeviceAccounts();
  const idx = current.findIndex((a) => a.uid === cleanUid);
  if (idx === -1) return current;
  const updated = [...current];
  updated[idx] = {
    ...updated[idx],
    ...patch,
  };
  return persistSavedDeviceAccounts(updated);
}

export function removeSavedDeviceAccount(uid: string): SavedDeviceAccount[] {
  const cleanUid = String(uid || '').trim();
  const current = loadSavedDeviceAccounts();
  const filtered = current.filter((a) => a.uid !== cleanUid);
  return persistSavedDeviceAccounts(filtered);
}
