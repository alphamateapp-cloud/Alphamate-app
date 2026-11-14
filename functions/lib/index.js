"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendPushOnNotificationCreated = exports.processExpiredAccountDeletions = exports.cleanupStaleLiveStreams = void 0;
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const auth_1 = require("firebase-admin/auth");
const messaging_1 = require("firebase-admin/messaging");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const firestore_2 = require("firebase-functions/v2/firestore");
const logger = __importStar(require("firebase-functions/logger"));
const FIRESTORE_DATABASE_ID = process.env.FIREBASE_DATABASE_ID ||
    'ai-studio-alphamatelivepar-88a3637b-56a3-47f2-a3ab-b67bf1702cff';
const CLOUDFLARE_SFU_BASE = 'https://rtc.live.cloudflare.com/v1';
// Hosts update `lastHeartbeat` every 5 seconds; mark streams stale after 30s (6 missed beats).
const STALE_HEARTBEAT_TIMEOUT_MS = 30_000;
// Keep `isActive: false` briefly so connected viewers receive the ended snapshot before deletion.
const ENDED_STREAM_RETENTION_MS = 5 * 60 * 1000;
const MAX_BATCH_SIZE = 450;
const app = (0, app_1.getApps)().length > 0 ? (0, app_1.getApps)()[0] : (0, app_1.initializeApp)();
const db = (0, firestore_1.getFirestore)(app, FIRESTORE_DATABASE_ID);
function extractTimestampMs(data, ...keys) {
    for (const key of keys) {
        const val = data[key];
        if (!val)
            continue;
        if (val instanceof firestore_1.Timestamp) {
            return val.toMillis();
        }
        const maybeTimestamp = val;
        if (typeof maybeTimestamp.toMillis === 'function') {
            return maybeTimestamp.toMillis();
        }
        if (typeof val === 'number' && Number.isFinite(val)) {
            return val;
        }
        if (typeof val === 'string') {
            const parsed = Date.parse(val);
            if (Number.isFinite(parsed))
                return parsed;
        }
    }
    return null;
}
async function closeCloudflareSfuSession(sfuSessionId) {
    const appId = process.env.REALTIME_SFU_APP_ID;
    const bearerToken = process.env.REALTIME_SFU_BEARER_TOKEN;
    if (!appId || !bearerToken || !sfuSessionId)
        return;
    try {
        const sessionUrl = `${CLOUDFLARE_SFU_BASE}/apps/${encodeURIComponent(appId)}/sessions/${encodeURIComponent(sfuSessionId)}`;
        const stateRes = await fetch(sessionUrl, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${bearerToken}`,
                Accept: 'application/json',
            },
        });
        if (!stateRes.ok)
            return;
        const stateJson = (await stateRes.json().catch(() => ({})));
        const mids = (Array.isArray(stateJson.tracks) ? stateJson.tracks : [])
            .map((t) => t?.mid)
            .filter((mid) => typeof mid === 'string' && mid.trim().length > 0);
        if (mids.length === 0)
            return;
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
    }
    catch (err) {
        logger.warn('Best-effort Cloudflare SFU cleanup failed', { sfuSessionId, err });
    }
}
/**
 * Scheduled Cloud Function running every minute to deactivate stale live streams
 * whose host stopped updating `lastHeartbeat` within 30 seconds, and purge expired docs.
 */
exports.cleanupStaleLiveStreams = (0, scheduler_1.onSchedule)({
    schedule: 'every 1 minutes',
    timeZone: 'UTC',
    timeoutSeconds: 60,
    memory: '256MiB',
}, async () => {
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    // 1. Deactivate active streams with missing/expired `lastHeartbeat`
    const activeSnapshot = await db
        .collection('liveStreams')
        .where('isActive', '==', true)
        .get();
    const staleDocs = activeSnapshot.docs.filter((docSnap) => {
        const data = docSnap.data();
        const heartbeatMs = extractTimestampMs(data, 'lastHeartbeat', 'lastHeartbeatMs', 'lastSeenAt', 'lastSeenAtMs', 'updatedAt', 'createdAt');
        if (heartbeatMs === null)
            return true;
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
    await Promise.allSettled(staleDocs.map((docSnap) => {
        const sfuSessionId = docSnap.get('sfuSessionId');
        return typeof sfuSessionId === 'string' && sfuSessionId
            ? closeCloudflareSfuSession(sfuSessionId)
            : Promise.resolve();
    }));
    // 2. Purge inactive stream documents past the retention window
    const endedSnapshot = await db
        .collection('liveStreams')
        .where('isActive', '==', false)
        .limit(500)
        .get();
    const expiredDocs = endedSnapshot.docs.filter((docSnap) => {
        const data = docSnap.data();
        const endedMs = extractTimestampMs(data, 'endedAt', 'lastHeartbeat', 'lastHeartbeatMs', 'updatedAt', 'createdAt');
        if (endedMs === null)
            return true;
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
});
/**
 * Scheduled Cloud Function running hourly to permanently delete accounts whose
 * OTP-verified 15-day Official Pending Deletion window has elapsed without recovery.
 */
exports.processExpiredAccountDeletions = (0, scheduler_1.onSchedule)({
    schedule: 'every 60 minutes',
    timeZone: 'UTC',
    timeoutSeconds: 120,
    memory: '256MiB',
}, async () => {
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const pendingSnap = await db
        .collection('accountDeletionRequests')
        .where('status', '==', 'pending_official_deletion')
        .limit(200)
        .get();
    const adminAuth = (0, auth_1.getAuth)(app);
    let processedCount = 0;
    for (const reqDoc of pendingSnap.docs) {
        const data = reqDoc.data();
        const uid = String(data.uid || reqDoc.id);
        const scheduledMs = extractTimestampMs(data, 'scheduledPermanentDeletionAt');
        if (scheduledMs === null || scheduledMs > nowMs)
            continue;
        try {
            await db.collection('users').doc(uid).delete().catch(() => { });
            await db.collection('presence').doc(uid).delete().catch(() => { });
            try {
                await adminAuth.deleteUser(uid);
            }
            catch (authErr) {
                if (authErr?.code !== 'auth/user-not-found') {
                    logger.warn('Failed deleting Firebase Auth user during 15-day purge', { uid, authErr });
                }
            }
            await reqDoc.ref.set({
                status: 'permanently_deleted',
                permanentlyDeletedAt: nowIso,
                updatedAt: nowIso,
                processedBy: 'auto_15_day_scheduler',
            }, { merge: true });
            processedCount += 1;
        }
        catch (err) {
            logger.error('Failed processing expired permanent account deletion', { uid, err });
        }
    }
    if (processedCount > 0) {
        logger.info('Processed expired 15-day permanent account deletions', { processedCount });
    }
});
function mapNotificationTypeToCategoryKey(type) {
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
function mapNotificationTypeToAndroidChannel(type) {
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
exports.sendPushOnNotificationCreated = (0, firestore_2.onDocumentCreated)({
    document: 'users/{userId}/notifications/{notificationId}',
    database: FIRESTORE_DATABASE_ID,
}, async (event) => {
    const snapshot = event.data;
    if (!snapshot)
        return;
    const userId = event.params.userId;
    const notif = snapshot.data();
    const notifType = String(notif.type || 'system');
    const title = String(notif.title || 'Alpha Mate');
    const body = String(notif.message || '');
    try {
        const userSnap = await db.collection('users').doc(userId).get();
        if (!userSnap.exists)
            return;
        const userData = userSnap.data();
        const prefs = userData.notificationPreferences;
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
        if (!token ||
            token.startsWith('web_push_') ||
            token.startsWith('web-simulated-token-')) {
            return;
        }
        const channelId = mapNotificationTypeToAndroidChannel(notifType);
        await (0, messaging_1.getMessaging)(app).send({
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
    }
    catch (err) {
        logger.warn('FCM send failed for notification', {
            userId,
            notificationId: event.params.notificationId,
            errorCode: err?.code,
            errorMessage: err?.message,
        });
    }
});
//# sourceMappingURL=index.js.map