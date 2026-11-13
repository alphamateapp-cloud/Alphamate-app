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
exports.cleanupStaleLiveStreams = void 0;
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const scheduler_1 = require("firebase-functions/v2/scheduler");
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
//# sourceMappingURL=index.js.map