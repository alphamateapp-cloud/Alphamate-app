import { Capacitor } from '@capacitor/core';
import {
  PushNotifications,
  Token,
  PushNotificationSchema,
  ActionPerformed,
  PermissionStatus,
} from '@capacitor/push-notifications';
import { doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

export interface PushNotificationPayload {
  title: string;
  body: string;
  id?: string;
  data?: {
    type?: 'gift' | 'pk_invite' | 'party_invite' | 'agency' | 'wallet' | 'message';
    screen?: string;
    roomId?: string;
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

class PushNotificationService {
  private token: string | null = null;
  private isInitialized = false;
  private onNotificationReceivedHandlers: Array<(notification: PushNotificationSchema) => void> = [];
  private onNotificationActionPerformedHandlers: Array<(action: ActionPerformed) => void> = [];
  private onTokenHandlers: Array<(token: string) => void> = [];

  constructor() {
    try {
      this.token = localStorage.getItem('alphamate_push_token') || null;
    } catch {
      // ignore
    }
  }

  /**
   * Check if native platform
   */
  public isNative(): boolean {
    return Capacitor.isNativePlatform();
  }

  /**
   * Get current cached token
   */
  public getToken(): string | null {
    return this.token;
  }

  /**
   * Check current push notification permission status
   */
  public async checkPermissions(): Promise<PushStatus> {
    const native = Capacitor.isNativePlatform();

    if (!native) {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        const perm = Notification.permission;
        return {
          isSupported: true,
          isNative: false,
          permission: perm === 'default' ? 'prompt' : perm,
          token: this.token || 'web-simulated-token-' + Math.random().toString(36).substring(7),
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

  /**
   * Initialize Push Notification listeners and Android notification channels
   */
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
      console.log('[PushService] Web environment detected. Simulation & Web Notifications enabled.');
      this.isInitialized = true;
      return;
    }

    try {
      // Create high-priority notification channels on Android 8.0+
      await this.setupAndroidChannels();

      // Listen for registration token
      await PushNotifications.addListener('registration', (token: Token) => {
        console.log('[PushService] Registration Token Received:', token.value);
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

      // Listen for registration errors
      await PushNotifications.addListener('registrationError', (error: any) => {
        console.warn('[PushService] Registration Error:', error);
      });

      // Listen for foreground notifications
      await PushNotifications.addListener(
        'pushNotificationReceived',
        (notification: PushNotificationSchema) => {
          console.log('[PushService] Push Notification Received in Foreground:', notification);
          this.onNotificationReceivedHandlers.forEach((h) => {
            try {
              h(notification);
            } catch (e) {
              console.error('[PushService] Notification received handler error:', e);
            }
          });
        }
      );

      // Listen for user tap on notification (action performed)
      await PushNotifications.addListener(
        'pushNotificationActionPerformed',
        (action: ActionPerformed) => {
          console.log('[PushService] Push Notification Action Performed:', action);
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
      console.log('[PushService] Native Push Notifications initialized successfully.');
    } catch (err) {
      console.warn('[PushService] Error initializing native push notifications:', err);
    }
  }

  /**
   * Request push notification permissions and register device
   */
  public async requestPermissions(): Promise<PushStatus> {
    if (!Capacitor.isNativePlatform()) {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        try {
          const res = await Notification.requestPermission();
          const perm = res === 'default' ? 'prompt' : res;
          const dummyToken = 'web_push_' + Math.random().toString(36).substring(2, 12);
          if (res === 'granted') {
            this.token = dummyToken;
            localStorage.setItem('alphamate_push_token', dummyToken);
            this.onTokenHandlers.forEach((h) => h(dummyToken));
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
        // Register with Google FCM / Apple APNS
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

  /**
   * Create dedicated Android notification channels
   */
  private async setupAndroidChannels(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;

    try {
      // Channel 1: Live & PK Battle Alerts
      await PushNotifications.createChannel({
        id: 'alpha_live_alerts',
        name: 'Live Streams & PK Battles',
        description: 'Instant alerts when favorite hosts go live or challenge you to PK',
        importance: 5, // High
        visibility: 1, // Public
        sound: 'res_custom_notification',
        vibration: true,
        lights: true,
        lightColor: '#EC4899',
      });

      // Channel 2: Gifts & Wallet
      await PushNotifications.createChannel({
        id: 'alpha_rewards_alerts',
        name: 'Gifts & Wallet Transactions',
        description: 'Coin deposits, diamond earnings, and gift received notices',
        importance: 4, // Default/High
        visibility: 1,
        vibration: true,
        lights: true,
        lightColor: '#F59E0B',
      });

      // Channel 3: Agency & Direct Messages
      await PushNotifications.createChannel({
        id: 'alpha_agency_chat',
        name: 'Agency & Direct Chat',
        description: 'Coin seller orders, host applications, and agency announcements',
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

  /**
   * Sync push device token to user's Firestore document
   */
  public async syncTokenToUserDoc(userId: string): Promise<boolean> {
    if (!userId || !this.token) return false;
    try {
      await setDoc(
        doc(db, 'users', userId),
        {
          pushNotificationToken: this.token,
          pushPlatform: Capacitor.isNativePlatform() ? 'android' : 'web',
          pushLastActiveAt: new Date().toISOString(),
        },
        { merge: true }
      );
      console.log(`[PushService] Synced push token to Firestore for user: ${userId}`);
      return true;
    } catch (err) {
      console.warn('[PushService] Could not sync push token to Firestore:', err);
      return false;
    }
  }

  /**
   * Trigger a simulated or local push notification for testing user engagement
   */
  public triggerTestNotification(payload: PushNotificationPayload): void {
    console.log('[PushService] Triggering test alert:', payload);

    // If on web and permission granted, use Web Notification API
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

    // Also dispatch to internal listeners so in-app alert banner & notifications list respond
    const syntheticNotification: PushNotificationSchema = {
      id: payload.id || 'test_' + Date.now(),
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
  }
}

export const pushService = new PushNotificationService();
