import { Capacitor } from '@capacitor/core';
import {
  PushNotifications,
  Token,
  PushNotificationSchema,
  ActionPerformed,
  PermissionStatus,
} from '@capacitor/push-notifications';
import { doc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import {
  NotificationCategoryKey,
  NotificationEventType,
  NotificationPreferences,
} from '../types';

export interface PushNotificationPayload {
  title: string;
  body: string;
  id?: string;
  data?: {
    type?: NotificationEventType;
    category?: NotificationCategoryKey;
    screen?: string;
    tab?: string;
    roomId?: string;
    streamId?: string;
    reelId?: string;
    chatId?: string;
    senderId?: string;
    [key: string]: any;
  };
}

export interface PushStatus {
  isSupported: boolean;
  isNative: boolean;
  permission: 'prompt' | 'granted' | 'denied';
  token: string | null;
  error: string | null;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  enabled: true,
  categories: {
    liveOn: true,
    partyInvites: true,
    friendRequests: true,
    gifts: true,
    comments: true,
    messages: true,
    likes: true,
    pkBattles: true,
    walletAndSystem: true,
  },
};

export const NOTIFICATION_CATEGORY_META: Array<{
  key: NotificationCategoryKey;
  label: string;
  description: string;
  channelId: string;
  accent: string;
}> = [
  {
    key: 'liveOn',
    label: 'Live Broadcast Alerts',
    description: 'Notify when followed hosts or friends go Live',
    channelId: 'alpha_live_alerts',
    accent: 'text-[#EC4899] bg-[#EC4899]/20',
  },
  {
    key: 'partyInvites',
    label: 'Party Rooms & Invites',
    description: 'New voice party rooms, seat invites & room openings',
    channelId: 'alpha_live_alerts',
    accent: 'text-[#A855F7] bg-[#A855F7]/20',
  },
  {
    key: 'friendRequests',
    label: 'Friend Requests & Followers',
    description: 'New friend/chat requests, acceptances & followers',
    channelId: 'alpha_social_alerts',
    accent: 'text-emerald-400 bg-emerald-500/20',
  },
  {
    key: 'gifts',
    label: 'Gifts Received (60% Diamonds)',
    description: 'Instant alerts for gifts received & Diamond credits',
    channelId: 'alpha_rewards_alerts',
    accent: 'text-amber-400 bg-amber-500/20',
  },
  {
    key: 'messages',
    label: 'Direct & Group Messages',
    description: 'Private DM replies, voice notes & group messages',
    channelId: 'alpha_social_alerts',
    accent: 'text-cyan-400 bg-cyan-500/20',
  },
  {
    key: 'comments',
    label: 'Video & Moment Comments',
    description: 'When someone comments on your Moments or Reels',
    channelId: 'alpha_social_alerts',
    accent: 'text-violet-300 bg-violet-500/20',
  },
  {
    key: 'likes',
    label: 'Video & Moment Likes',
    description: 'When someone likes your uploaded videos or posts',
    channelId: 'alpha_social_alerts',
    accent: 'text-rose-400 bg-rose-500/20',
  },
  {
    key: 'pkBattles',
    label: 'PK Battle Challenges',
    description: 'Direct PK battle challenges & match starts',
    channelId: 'alpha_live_alerts',
    accent: 'text-fuchsia-400 bg-fuchsia-500/20',
  },
  {
    key: 'walletAndSystem',
    label: 'Wallet, Agency & Official Alerts',
    description: 'Coin top-ups, withdrawals, agency deliveries & system notices',
    channelId: 'alpha_agency_chat',
    accent: 'text-sky-400 bg-sky-500/20',
  },
];

export function getCategoryForNotificationType(type?: string): NotificationCategoryKey {
  switch (type) {
    case 'live_on':
    case 'live_invite':
      return 'liveOn';
    case 'party_invite':
      return 'partyInvites';
    case 'friend_request':
    case 'follow':
      return 'friendRequests';
    case 'gift':
      return 'gifts';
    case 'comment':
      return 'comments';
    case 'message':
      return 'messages';
    case 'like':
      return 'likes';
    case 'pk_invite':
      return 'pkBattles';
    case 'wallet':
    case 'agency':
    case 'system':
    default:
      return 'walletAndSystem';
  }
}

const PREFS_STORAGE_KEY = 'alphamate_notification_prefs';

class PushNotificationService {
  private token: string | null = null;
  private isInitialized = false;
  private preferences: NotificationPreferences = DEFAULT_NOTIFICATION_PREFERENCES;
  private onNotificationReceivedHandlers: Array<(notification: PushNotificationSchema) => void> = [];
  private onNotificationActionPerformedHandlers: Array<(action: ActionPerformed) => void> = [];
  private onTokenHandlers: Array<(token: string) => void> = [];

  constructor() {
    try {
      this.token = localStorage.getItem('alphamate_push_token') || null;
    } catch {
      // ignore
    }
    this.preferences = this.getPreferences();
  }

  public isNative(): boolean {
    return Capacitor.isNativePlatform();
  }

  public getToken(): string | null {
    return this.token;
  }

  public getPreferences(): NotificationPreferences {
    try {
      const raw = localStorage.getItem(PREFS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<NotificationPreferences>;
        return {
          enabled: parsed.enabled !== undefined ? Boolean(parsed.enabled) : true,
          categories: {
            ...DEFAULT_NOTIFICATION_PREFERENCES.categories,
            ...(parsed.categories || {}),
          },
          updatedAt: parsed.updatedAt,
        };
      }
    } catch {
      // ignore
    }
    return {
      enabled: DEFAULT_NOTIFICATION_PREFERENCES.enabled,
      categories: { ...DEFAULT_NOTIFICATION_PREFERENCES.categories },
    };
  }

  public setLocalPreferences(prefs: NotificationPreferences): NotificationPreferences {
    const normalized: NotificationPreferences = {
      enabled: Boolean(prefs.enabled),
      categories: {
        ...DEFAULT_NOTIFICATION_PREFERENCES.categories,
        ...(prefs.categories || {}),
      },
      updatedAt: new Date().toISOString(),
    };
    this.preferences = normalized;
    try {
      localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(normalized));
    } catch {
      // ignore
    }
    return normalized;
  }

  public async saveAndSyncPreferences(
    userId: string | null | undefined,
    prefs: NotificationPreferences
  ): Promise<NotificationPreferences> {
    const normalized = this.setLocalPreferences(prefs);
    if (!userId) return normalized;
    const path = `users/${userId}`;
    try {
      await setDoc(
        doc(db, 'users', userId),
        {
          notificationPreferences: normalized,
          updatedAt: normalized.updatedAt,
        },
        { merge: true }
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
    return normalized;
  }

  public isCategoryAllowed(type?: string): boolean {
    const prefs = this.preferences || this.getPreferences();
    if (!prefs.enabled) return false;
    const categoryKey = getCategoryForNotificationType(type);
    return prefs.categories[categoryKey] !== false;
  }

  public async checkPermissions(): Promise<PushStatus> {
    const native = Capacitor.isNativePlatform();

    if (!native) {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        const perm = Notification.permission;
        return {
          isSupported: true,
          isNative: false,
          permission: perm === 'default' ? 'prompt' : perm,
          token: this.token,
          error: null,
        };
      }
      return {
        isSupported: false,
        isNative: false,
        permission: 'denied',
        token: null,
        error: 'Web Notifications API not supported in this browser environment',
      };
    }

    try {
      const status: PermissionStatus = await PushNotifications.checkPermissions();
      return {
        isSupported: true,
        isNative: true,
        permission: status.receive as 'prompt' | 'granted' | 'denied',
        token: this.token,
        error: null,
      };
    } catch (err: any) {
      return {
        isSupported: true,
        isNative: true,
        permission: 'prompt',
        token: this.token,
        error: err?.message || 'Failed to check push permissions',
      };
    }
  }

  public async initialize(options?: {
    onReceived?: (notification: PushNotificationSchema) => void;
    onActionPerformed?: (action: ActionPerformed) => void;
    onToken?: (token: string) => void;
  }): Promise<void> {
    if (options?.onReceived) {
      this.onNotificationReceivedHandlers.push(options.onReceived);
    }
    if (options?.onActionPerformed) {
      this.onNotificationActionPerformedHandlers.push(options.onActionPerformed);
    }
    if (options?.onToken) {
      this.onTokenHandlers.push(options.onToken);
    }

    if (this.isInitialized) {
      return;
    }

    if (!Capacitor.isNativePlatform()) {
      this.isInitialized = true;
      return;
    }

    try {
      await this.setupAndroidChannels();

      await PushNotifications.addListener('registration', (token: Token) => {
        this.token = token.value;
        try {
          localStorage.setItem('alphamate_push_token', token.value);
        } catch {
          // ignore
        }
        this.onTokenHandlers.forEach((h) => {
          try {
            h(token.value);
          } catch (e) {
            console.error('[PushService] Token handler error:', e);
          }
        });
      });

      await PushNotifications.addListener('registrationError', (error: any) => {
        console.warn('[PushService] Registration Error:', error);
      });

      await PushNotifications.addListener(
        'pushNotificationReceived',
        (notification: PushNotificationSchema) => {
          const notifType = (notification.data as any)?.type;
          if (!this.isCategoryAllowed(notifType)) return;
          this.onNotificationReceivedHandlers.forEach((h) => {
            try {
              h(notification);
            } catch (e) {
              console.error('[PushService] Notification received handler error:', e);
            }
          });
        }
      );

      await PushNotifications.addListener(
        'pushNotificationActionPerformed',
        (action: ActionPerformed) => {
          this.onNotificationActionPerformedHandlers.forEach((h) => {
            try {
              h(action);
            } catch (e) {
              console.error('[PushService] Notification action handler error:', e);
            }
          });
        }
      );

      this.isInitialized = true;
    } catch (err) {
      console.warn('[PushService] Error initializing native push notifications:', err);
    }
  }

  public async requestPermissions(): Promise<PushStatus> {
    if (!Capacitor.isNativePlatform()) {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        try {
          const res = await Notification.requestPermission();
          const perm = res === 'default' ? 'prompt' : res;
          const webToken = 'web_push_' + Math.random().toString(36).substring(2, 12);
          if (res === 'granted') {
            this.token = webToken;
            try {
              localStorage.setItem('alphamate_push_token', webToken);
            } catch {}
            this.onTokenHandlers.forEach((h) => h(webToken));
          }
          return {
            isSupported: true,
            isNative: false,
            permission: perm,
            token: this.token,
            error: null,
          };
        } catch (err: any) {
          return {
            isSupported: true,
            isNative: false,
            permission: 'denied',
            token: null,
            error: err?.message || 'Permission request rejected',
          };
        }
      }
      return {
        isSupported: false,
        isNative: false,
        permission: 'denied',
        token: null,
        error: 'Notifications API not supported',
      };
    }

    try {
      let permStatus = await PushNotifications.checkPermissions();
      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
      }

      if (permStatus.receive === 'granted') {
        await PushNotifications.register();
      }

      return {
        isSupported: true,
        isNative: true,
        permission: permStatus.receive as 'prompt' | 'granted' | 'denied',
        token: this.token,
        error: null,
      };
    } catch (err: any) {
      console.error('[PushService] Error requesting permissions:', err);
      return {
        isSupported: true,
        isNative: true,
        permission: 'denied',
        token: this.token,
        error: err?.message || 'Failed to request native push permissions',
      };
    }
  }

  private async setupAndroidChannels(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;

    try {
      await PushNotifications.createChannel({
        id: 'alpha_live_alerts',
        name: 'Live Streams, Party Rooms & PK',
        description: 'Instant alerts when followed hosts go live, open party rooms, or challenge PK',
        importance: 5,
        visibility: 1,
        vibration: true,
        lights: true,
        lightColor: '#EC4899',
      });

      await PushNotifications.createChannel({
        id: 'alpha_rewards_alerts',
        name: 'Gifts & Diamond Wallet',
        description: 'Gifts received (60% Diamond share) and wallet updates',
        importance: 4,
        visibility: 1,
        vibration: true,
        lights: true,
        lightColor: '#F59E0B',
      });

      await PushNotifications.createChannel({
        id: 'alpha_social_alerts',
        name: 'Friends, Messages, Likes & Comments',
        description: 'Friend requests, followers, DM/group messages, video likes and comments',
        importance: 4,
        visibility: 1,
        vibration: true,
        lights: true,
        lightColor: '#10B981',
      });

      await PushNotifications.createChannel({
        id: 'alpha_agency_chat',
        name: 'Agency & Official Notices',
        description: 'Coin seller orders, host applications, and official announcements',
        importance: 4,
        visibility: 1,
        vibration: true,
        lights: true,
        lightColor: '#A855F7',
      });
    } catch (e) {
      console.warn('[PushService] Could not register Android channels:', e);
    }
  }

  public async syncTokenToUserDoc(userId: string): Promise<boolean> {
    if (!userId || !this.token) return false;
    const path = `users/${userId}`;
    try {
      await setDoc(
        doc(db, 'users', userId),
        {
          pushNotificationToken: this.token,
          pushPlatform: Capacitor.isNativePlatform() ? 'android' : 'web',
          pushLastActiveAt: new Date().toISOString(),
          notificationPreferences: this.getPreferences(),
        },
        { merge: true }
      );
      return true;
    } catch (error) {
      console.warn('[PushService] Could not sync push token to Firestore:', error);
      return false;
    }
  }

  /**
   * Dispatch a foreground alert banner + browser Notification (if enabled by user preferences).
   */
  public notifyForeground(payload: PushNotificationPayload, force = false): boolean {
    const type = payload.data?.type;
    if (!force && !this.isCategoryAllowed(type)) {
      return false;
    }

    if (!Capacitor.isNativePlatform() && typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        try {
          new Notification(payload.title, {
            body: payload.body,
            icon: '/alpha-mate-logo-emblem.png',
            data: payload.data,
          });
        } catch (e) {
          console.warn('[PushService] Web Notification error:', e);
        }
      }
    }

    const syntheticNotification: PushNotificationSchema = {
      id: payload.id || 'notif_' + Date.now(),
      title: payload.title,
      body: payload.body,
      data: payload.data || {},
    };

    this.onNotificationReceivedHandlers.forEach((h) => {
      try {
        h(syntheticNotification);
      } catch (e) {
        console.error(e);
      }
    });
    return true;
  }

  public triggerTestNotification(payload: PushNotificationPayload): boolean {
    return this.notifyForeground(payload, false);
  }
}

export const pushService = new PushNotificationService();
