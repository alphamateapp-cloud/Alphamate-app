import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getMessaging } from 'firebase-admin/messaging';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import * as logger from 'firebase-functions/logger';

const FIRESTORE_DATABASE_ID =
  process.env.FIREBASE_DATABASE_ID ||
  'ai-studio-alphamatelivepar-88a3637b-56a3-47f2-a3ab-b67bf1702cff';

const CLOUDFLARE_SFU_BASE = 'https://rtc.live.cloudflare.com/v1';

// Hosts update `lastHeartbeat` every 5 seconds; mark streams stale after 30s (6 missed beats).
const STALE_HEARTBEAT_TIMEOUT_MS = 30_000;

// Keep `isActive: false` briefly so connected viewers receive the ended snapshot before deletion.
const ENDED_STREAM_RETENTION_MS = 5 * 60 * 1000;

const MAX_BATCH_SIZE = 450;

const app = getApps().length > 0 ? getApps()[0] : initializeApp();
const db = getFirestore(app, FIRESTORE_DATABASE_ID);

function extractTimestampMs(data: Record<string, unknown>, ...keys: string[]): number | null {
  for (const key of keys) {
    const val = data[key];
    if (!val) continue;
    if (val instanceof Timestamp) {
      return val.toMillis();
    }
    const maybeTimestamp = val as { toMillis?: () => number };
    if (typeof maybeTimestamp.toMillis === 'function') {
      return maybeTimestamp.toMillis();
    }
    if (typeof val === 'number' && Number.isFinite(val)) {
      return val;
    }
    if (typeof val === 'string') {
      const parsed = Date.parse(val);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

async function closeCloudflareSfuSession(sfuSessionId: string): Promise<void> {
  const appId = process.env.REALTIME_SFU_APP_ID;
  const bearerToken = process.env.REALTIME_SFU_BEARER_TOKEN;
  if (!appId || !bearerToken || !sfuSessionId) return;

  try {
    const sessionUrl = `${CLOUDFLARE_SFU_BASE}/apps/${encodeURIComponent(appId)}/sessions/${encodeURIComponent(sfuSessionId)}`;
    const stateRes = await fetch(sessionUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        Accept: 'application/json',
      },
    });
    if (!stateRes.ok) return;

    const stateJson = (await stateRes.json().catch(() => ({}))) as {
      tracks?: Array<{ mid?: string }>;
    };
    const mids = (Array.isArray(stateJson.tracks) ? stateJson.tracks : [])
      .map((t) => t?.mid)
      .filter((mid): mid is string => typeof mid === 'string' && mid.trim().length > 0);

    if (mids.length === 0) return;

    await fetch(`${sessionUrl}/tracks/close`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        tracks: mids.map((mid) => ({ mid })),
        force: true,
      }),
    });
  } catch (err) {
    logger.warn('Best-effort Cloudflare SFU cleanup failed', { sfuSessionId, err });
  }
}

/**
 * Scheduled Cloud Function running every minute to deactivate stale live streams
 * whose host stopped updating `lastHeartbeat` within 30 seconds, and purge expired docs.
 */
export const cleanupStaleLiveStreams = onSchedule(
  {
    schedule: 'every 1 minutes',
    timeZone: 'UTC',
    timeoutSeconds: 60,
    memory: '256MiB',
  },
  async () => {
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();

    // 1. Deactivate active streams with missing/expired `lastHeartbeat`
    const activeSnapshot = await db
      .collection('liveStreams')
      .where('isActive', '==', true)
      .get();

    const staleDocs = activeSnapshot.docs.filter((docSnap) => {
      const data = docSnap.data() as Record<string, unknown>;
      const heartbeatMs = extractTimestampMs(
        data,
        'lastHeartbeat',
        'lastHeartbeatMs',
        'lastSeenAt',
        'lastSeenAtMs',
        'updatedAt',
        'createdAt'
      );
      if (heartbeatMs === null) return true;
      return nowMs - heartbeatMs > STALE_HEARTBEAT_TIMEOUT_MS;
    });

    for (let i = 0; i < staleDocs.length; i += MAX_BATCH_SIZE) {
      const chunk = staleDocs.slice(i, i + MAX_BATCH_SIZE);
      const batch = db.batch();
      for (const docSnap of chunk) {
        batch.update(docSnap.ref, {
          isActive: false,
          endedReason: 'heartbeat_timeout',
          endedAt: nowIso,
          updatedAt: nowIso,
        });
      }
      await batch.commit();
    }

    // Best-effort Cloudflare SFU teardown for timed-out sessions (if configured)
    await Promise.allSettled(
      staleDocs.map((docSnap) => {
        const sfuSessionId = docSnap.get('sfuSessionId');
        return typeof sfuSessionId === 'string' && sfuSessionId
          ? closeCloudflareSfuSession(sfuSessionId)
          : Promise.resolve();
      })
    );

    // 2. Purge inactive stream documents past the retention window
    const endedSnapshot = await db
      .collection('liveStreams')
      .where('isActive', '==', false)
      .limit(500)
      .get();

    const expiredDocs = endedSnapshot.docs.filter((docSnap) => {
      const data = docSnap.data() as Record<string, unknown>;
      const endedMs = extractTimestampMs(
        data,
        'endedAt',
        'lastHeartbeat',
        'lastHeartbeatMs',
        'updatedAt',
        'createdAt'
      );
      if (endedMs === null) return true;
      return nowMs - endedMs > ENDED_STREAM_RETENTION_MS;
    });

    for (let i = 0; i < expiredDocs.length; i += MAX_BATCH_SIZE) {
      const chunk = expiredDocs.slice(i, i + MAX_BATCH_SIZE);
      const batch = db.batch();
      for (const docSnap of chunk) {
        batch.delete(docSnap.ref);
      }
      await batch.commit();
    }

    if (staleDocs.length > 0 || expiredDocs.length > 0) {
      logger.info('Cleaned up stale live stream sessions', {
        deactivatedCount: staleDocs.length,
        purgedCount: expiredDocs.length,
      });
    }
  }
);

/**
 * Scheduled Cloud Function running hourly to permanently delete accounts whose
 * OTP-verified 15-day Official Pending Deletion window has elapsed without recovery.
 */
export const processExpiredAccountDeletions = onSchedule(
  {
    schedule: 'every 60 minutes',
    timeZone: 'UTC',
    timeoutSeconds: 120,
    memory: '256MiB',
  },
  async () => {
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();

    const pendingSnap = await db
      .collection('accountDeletionRequests')
      .where('status', '==', 'pending_official_deletion')
      .limit(200)
      .get();

    const adminAuth = getAuth(app);
    let processedCount = 0;

    for (const reqDoc of pendingSnap.docs) {
      const data = reqDoc.data() as Record<string, unknown>;
      const uid = String(data.uid || reqDoc.id);
      const scheduledMs = extractTimestampMs(data, 'scheduledPermanentDeletionAt');
      if (scheduledMs === null || scheduledMs > nowMs) continue;

      try {
        await db.collection('users').doc(uid).delete().catch(() => {});
        await db.collection('presence').doc(uid).delete().catch(() => {});
        try {
          await adminAuth.deleteUser(uid);
        } catch (authErr: any) {
          if (authErr?.code !== 'auth/user-not-found') {
            logger.warn('Failed deleting Firebase Auth user during 15-day purge', { uid, authErr });
          }
        }
        await reqDoc.ref.set(
          {
            status: 'permanently_deleted',
            permanentlyDeletedAt: nowIso,
            updatedAt: nowIso,
            processedBy: 'auto_15_day_scheduler',
          },
          { merge: true }
        );
        processedCount += 1;
      } catch (err) {
        logger.error('Failed processing expired permanent account deletion', { uid, err });
      }
    }

    if (processedCount > 0) {
      logger.info('Processed expired 15-day permanent account deletions', { processedCount });
    }
  }
);

function mapNotificationTypeToCategoryKey(type: string): string {
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

function mapNotificationTypeToAndroidChannel(type: string): string {
  switch (type) {
    case 'live_on':
    case 'live_invite':
    case 'party_invite':
    case 'pk_invite':
      return 'alpha_live_alerts';
    case 'gift':
    case 'wallet':
      return 'alpha_rewards_alerts';
    case 'friend_request':
    case 'follow':
    case 'comment':
    case 'like':
    case 'message':
      return 'alpha_social_alerts';
    case 'agency':
    case 'system':
    default:
      return 'alpha_agency_chat';
  }
}

/**
 * Firestore trigger: dispatches a real FCM push notification whenever a
 * notification document is written to `users/{userId}/notifications/{notificationId}`
 * and the recipient's notificationPreferences allow that category.
 */
export const sendPushOnNotificationCreated = onDocumentCreated(
  {
    document: 'users/{userId}/notifications/{notificationId}',
    database: FIRESTORE_DATABASE_ID,
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const userId = event.params.userId;
    const notif = snapshot.data() as Record<string, any>;
    const notifType = String(notif.type || 'system');
    const title = String(notif.title || 'Alpha Mate');
    const body = String(notif.message || '');

    try {
      const userSnap = await db.collection('users').doc(userId).get();
      if (!userSnap.exists) return;

      const userData = userSnap.data() as Record<string, any>;
      const prefs = userData.notificationPreferences as
        | { enabled?: boolean; categories?: Record<string, boolean> }
        | undefined;

      if (prefs?.enabled === false) {
        logger.info('Push skipped: master notifications disabled by user', { userId, notifType });
        return;
      }

      const categoryKey = mapNotificationTypeToCategoryKey(notifType);
      if (prefs?.categories && prefs.categories[categoryKey] === false) {
        logger.info('Push skipped: category disabled by user preference', {
          userId,
          notifType,
          categoryKey,
        });
        return;
      }

      const token = typeof userData.pushNotificationToken === 'string' ? userData.pushNotificationToken.trim() : '';
      if (
        !token ||
        token.startsWith('web_push_') ||
        token.startsWith('web-simulated-token-')
      ) {
        return;
      }

      const channelId = mapNotificationTypeToAndroidChannel(notifType);

      await getMessaging(app).send({
        token,
        notification: {
          title,
          body,
        },
        data: {
          notificationId: event.params.notificationId,
          type: notifType,
          category: categoryKey,
          screen: String(notif.screen || ''),
          tab: String(notif.tab || ''),
          roomId: String(notif.roomId || ''),
          streamId: String(notif.streamId || ''),
          reelId: String(notif.reelId || ''),
          chatId: String(notif.chatId || ''),
          senderId: String(notif.senderId || ''),
        },
        android: {
          priority: 'high',
          notification: {
            channelId,
            sound: 'default',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      });
    } catch (err: any) {
      logger.warn('FCM send failed for notification', {
        userId,
        notificationId: event.params.notificationId,
        errorCode: err?.code,
        errorMessage: err?.message,
      });
    }
  }
);

/**
 * Scheduled Cloud Function running daily at 00:05 UTC to enforce the monthly
 * leaderboard retention policy: keeps the active calendar month and up to 1 previous
 * calendar month (max ~1-2 months), deleting expired monthly entry partitions.
 */
export const monthlyLeaderboardMaintenance = onSchedule(
  {
    schedule: '5 0 * * *',
    timeZone: 'UTC',
    timeoutSeconds: 180,
    memory: '256MiB',
  },
  async () => {
    const now = new Date();
    const currentYear = now.getUTCFullYear();
    const currentMonth = now.getUTCMonth(); // 0..11
    const formatKey = (y: number, mZero: number) =>
      `${y}-${String(mZero + 1).padStart(2, '0')}`;

    const prevDate = new Date(Date.UTC(currentYear, currentMonth - 1, 1));
    const allowedMonthKeys = new Set([
      formatKey(currentYear, currentMonth),
      formatKey(prevDate.getUTCFullYear(), prevDate.getUTCMonth()),
    ]);

    const monthsSnap = await db.collection('leaderboardMonths').listDocuments();
    let purgedEntries = 0;

    for (const monthDocRef of monthsSnap) {
      if (allowedMonthKeys.has(monthDocRef.id)) continue;

      const entriesSnap = await monthDocRef.collection('entries').limit(450).get();
      if (!entriesSnap.empty) {
        const batch = db.batch();
        for (const entryDoc of entriesSnap.docs) {
          batch.delete(entryDoc.ref);
        }
        await batch.commit();
        purgedEntries += entriesSnap.size;
      }

      if (entriesSnap.size < 450) {
        await monthDocRef.delete().catch(() => {});
      }
    }

    if (purgedEntries > 0) {
      logger.info('Purged expired monthly leaderboard partitions', {
        keptMonths: Array.from(allowedMonthKeys),
        purgedEntries,
      });
    }
  }
);


