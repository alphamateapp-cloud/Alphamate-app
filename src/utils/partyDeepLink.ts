import { Capacitor } from '@capacitor/core';
import { PartyRoom } from '../types';

export interface PartySharePayload {
  roomId: string;
  roomTitle: string;
  hostName: string;
  inviterName: string;
  inviterUsername?: string;
  webUrl: string;
  nativeDeepLink: string;
  shareTitle: string;
  shareText: string;
  fullMessage: string;
}

const DEFAULT_PUBLIC_WEB_ORIGIN = 'https://alphamate.app';

/**
 * Resolves the canonical shareable origin for web and Capacitor native builds.
 */
export function getShareableAppOrigin(): string {
  const configuredOrigin = (import.meta as any)?.env?.VITE_PUBLIC_APP_URL as string | undefined;
  if (configuredOrigin && /^https?:\/\//i.test(configuredOrigin.trim())) {
    return configuredOrigin.trim().replace(/\/+$/, '');
  }

  if (typeof window !== 'undefined' && !Capacitor.isNativePlatform()) {
    const { origin, protocol, hostname } = window.location;
    const isCapacitorOrLocal =
      protocol === 'capacitor:' ||
      protocol === 'file:' ||
      hostname === 'localhost' ||
      hostname === '127.0.0.1';

    if (!isCapacitorOrLocal && origin && /^https?:\/\//i.test(origin)) {
      return origin.replace(/\/+$/, '');
    }
    if (origin && /^https?:\/\//i.test(origin)) {
      return origin.replace(/\/+$/, '');
    }
  }

  return DEFAULT_PUBLIC_WEB_ORIGIN;
}

/**
 * Generates a deep link and rich invite copy for a live Party Room.
 */
export function buildPartyRoomDeepLink(
  room: Pick<PartyRoom, 'id' | 'title' | 'host'>,
  inviter?: { displayName?: string; username?: string }
): PartySharePayload {
  const origin = getShareableAppOrigin();
  const safeRoomId = String(room.id || '').trim();
  const roomTitle = (room.title || `${room.host?.displayName || 'Alpha Mate'}'s Party`).trim();
  const hostName = (room.host?.displayName || 'Host').trim();
  const inviterName = (inviter?.displayName || hostName).trim();
  const inviterUsername = (inviter?.username || '').replace(/^@/, '').trim();

  const params = new URLSearchParams();
  params.set('party', safeRoomId);
  if (inviterUsername) {
    params.set('ref', inviterUsername);
  }

  const webUrl = `${origin}/?${params.toString()}`;
  const nativeDeepLink = `alphamate://party/${encodeURIComponent(safeRoomId)}${
    inviterUsername ? `?ref=${encodeURIComponent(inviterUsername)}` : ''
  }`;

  const shareTitle = `${roomTitle} • Alpha Mate Party`;
  const shareText = `Join ${inviterName} live in "${roomTitle}" on Alpha Mate! Tap to enter the voice party room:`;
  const fullMessage = `${shareText}\n${webUrl}`;

  return {
    roomId: safeRoomId,
    roomTitle,
    hostName,
    inviterName,
    inviterUsername,
    webUrl,
    nativeDeepLink,
    shareTitle,
    shareText,
    fullMessage,
  };
}

/**
 * Extracts a Party Room ID from a web URL, hash fragment, or custom alphamate:// deep link.
 */
export function extractPartyRoomIdFromUrl(rawUrl: string): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  try {
    // Support custom native scheme: alphamate://party/<roomId>
    const customMatch = trimmed.match(/^alphamate:\/\/party\/([^/?#]+)/i);
    if (customMatch?.[1]) {
      return decodeURIComponent(customMatch[1]).trim() || null;
    }

    const parsed = new URL(
      trimmed,
      typeof window !== 'undefined' ? window.location.origin : DEFAULT_PUBLIC_WEB_ORIGIN
    );

    const queryRoomId =
      parsed.searchParams.get('party') ||
      parsed.searchParams.get('partyRoom') ||
      parsed.searchParams.get('room');
    if (queryRoomId && queryRoomId.trim()) {
      return queryRoomId.trim();
    }

    const pathMatch = parsed.pathname.match(/\/party\/([^/?#]+)/i);
    if (pathMatch?.[1]) {
      return decodeURIComponent(pathMatch[1]).trim() || null;
    }

    const hashMatch = parsed.hash.match(/^#\/?party\/([^/?#]+)/i);
    if (hashMatch?.[1]) {
      return decodeURIComponent(hashMatch[1]).trim() || null;
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * Checks whether platform-integrated native sharing (Web Share API or Capacitor Share plugin) is available.
 */
export function isNativeShareSupported(): boolean {
  if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('Share')) {
    return true;
  }
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

/**
 * Invokes platform-integrated sharing (Capacitor Share plugin or Web Share API).
 */
export async function triggerNativePartyShare(
  payload: PartySharePayload
): Promise<'shared' | 'cancelled' | 'unsupported'> {
  // 1. Native Capacitor Share plugin if registered in the native shell
  if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('Share')) {
    try {
      const capPlugins = (window as any)?.Capacitor?.Plugins;
      if (capPlugins?.Share?.share) {
        await capPlugins.Share.share({
          title: payload.shareTitle,
          text: payload.shareText,
          url: payload.webUrl,
          dialogTitle: 'Share Party Room',
        });
        return 'shared';
      }
    } catch (err: any) {
      const msg = String(err?.message || '').toLowerCase();
      if (msg.includes('cancel') || msg.includes('abort')) {
        return 'cancelled';
      }
    }
  }

  // 2. Standard Web Share API (Mobile Chrome/Safari, Android WebView, PWA, Desktop Safari/Edge)
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({
        title: payload.shareTitle,
        text: payload.shareText,
        url: payload.webUrl,
      });
      return 'shared';
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return 'cancelled';
      }
      return 'unsupported';
    }
  }

  return 'unsupported';
}

/**
 * Builds direct external app / social sharing URLs for anchor links (no window.open needed).
 */
export function buildSocialShareUrls(payload: PartySharePayload) {
  const encodedUrl = encodeURIComponent(payload.webUrl);
  const encodedText = encodeURIComponent(payload.shareText);
  const encodedFull = encodeURIComponent(payload.fullMessage);
  const encodedTitle = encodeURIComponent(payload.shareTitle);

  return {
    whatsapp: `https://api.whatsapp.com/send?text=${encodedFull}`,
    telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
    twitter: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedText}`,
    sms: `sms:?&body=${encodedFull}`,
    email: `mailto:?subject=${encodedTitle}&body=${encodedFull}`,
  };
}
