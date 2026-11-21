import {
  collection,
  doc,
  limit,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  AdminActionKind,
  AdminModerationState,
  AdminRestrictionDetail,
  AdminRestrictionScope,
  AdminWarningRecord,
  NotificationEventType,
  NotificationItem,
} from '../types';
import { auth, db, isFirestoreQuotaExceeded } from './firebase';

const OFFICIAL_ADMIN_EMAIL = 'alphamateapp@gmail.com';

/**
 * Keys on `users/{uid}` that are strictly controlled by the Admin Panel / Super Admin.
 * Regular user client profile syncs must strip these so normal profile edits never fail
 * Firestore security rules and cannot accidentally overwrite Admin moderation state.
 */
export const ADMIN_PROTECTED_USER_FIELDS = new Set<string>([
  'isBlocked',
  'blocked',
  'isBanned',
  'banned',
  'blockReason',
  'banReason',
  'blockedAt',
  'blockedAtMs',
  'blockedBy',
  'blockedByName',
  'blockMessage',
  'isSuspended',
  'suspended',
  'suspensionReason',
  'suspendReason',
  'suspensionDuration',
  'suspensionHours',
  'suspensionDays',
  'suspendedAt',
  'suspendedAtMs',
  'suspensionStartAt',
  'suspendedUntil',
  'suspensionExpiresAt',
  'suspensionExpiry',
  'isPermanentSuspension',
  'permanentSuspension',
  'suspensionMessage',
  'suspendedBy',
  'liveDisabled',
  'liveSuspended',
  'liveRestricted',
  'liveBanned',
  'liveAccess',
  'canGoLive',
  'liveRestrictionReason',
  'liveSuspensionReason',
  'liveRestrictionDuration',
  'liveSuspendedAt',
  'liveSuspendedUntil',
  'liveExpiresAt',
  'liveRestrictionMessage',
  'liveRestrictedBy',
  'partyDisabled',
  'partySuspended',
  'partyRestricted',
  'partyBanned',
  'partyAccess',
  'canJoinParty',
  'canCreateParty',
  'partyRestrictionReason',
  'partySuspensionReason',
  'partyRestrictionDuration',
  'partyRestrictedAt',
  'partySuspendedUntil',
  'partyExpiresAt',
  'partyRestrictionMessage',
  'partyRestrictedBy',
  'moderation',
  'restrictions',
  'warnings',
  'latestWarning',
  'activeWarning',
  'lastAdminAction',
  'adminActions',
  'isVerified',
  'blueTick',
  'hasBlueTick',
  'verificationStatus',
  'verificationReason',
  'verificationUpdatedAt',
  'verificationUpdatedBy',
  'verifiedBy',
  'verifiedAt',
  'agencyId',
  'hostAgencyId',
  'agencyName',
  'hostAgencyName',
  'agencyCode',
  'hostAgencyCode',
  'agencyTag',
  'hostAgencyTag',
  'hostAgencyStatus',
  'isAgencyHost',
  'agencyOwnerId',
  'agencyOwnerName',
  'agencyJoinedAt',
]);

export function isOfficialAdminAuthUser(): boolean {
  const email = auth.currentUser?.email?.trim().toLowerCase();
  return Boolean(email && email === OFFICIAL_ADMIN_EMAIL && auth.currentUser?.emailVerified);
}

/**
 * Strips Admin-controlled moderation and verification fields from non-admin client profile updates.
 */
export function stripAdminProtectedUserFields(
  payload: Record<string, any>,
  options?: { isNewUserDoc?: boolean }
): Record<string, any> {
  if (isOfficialAdminAuthUser()) return payload;
  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (ADMIN_PROTECTED_USER_FIELDS.has(key)) {
      // Allow initial creation to set default isVerified: false only
      if (options?.isNewUserDoc && key === 'isVerified' && value === false) {
        cleaned[key] = false;
      }
      continue;
    }
    // Never allow a client self-sync to overwrite an admin-managed accountStatus
    if (key === 'accountStatus') {
      const s = String(value || '').toLowerCase();
      if (s === 'blocked' || s === 'banned' || s === 'suspended') {
        continue;
      }
      // For regular self-syncs of profile edits, omit accountStatus unless explicitly lifecycle
      if (s !== 'deactivated' && s !== 'pending_deletion' && s !== 'permanently_deleted') {
        continue;
      }
    }
    cleaned[key] = value;
  }
  return cleaned;
}

/**
 * Robustly parses Firestore Timestamp, {seconds}, epoch ms, epoch sec, Date, or ISO string to epoch ms.
 */
export function parseFirestoreTimestampMs(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) return null;
    // Handle Unix seconds vs milliseconds
    return value < 1e11 ? Math.round(value * 1000) : Math.round(value);
  }
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof value === 'object') {
    if (typeof value.toMillis === 'function') {
      try {
        const ms = value.toMillis();
        return Number.isFinite(ms) ? ms : null;
      } catch {
        return null;
      }
    }
    const secs =
      typeof value.seconds === 'number'
        ? value.seconds
        : typeof value._seconds === 'number'
        ? value._seconds
        : null;
    if (secs !== null && Number.isFinite(secs)) {
      const nanos =
        typeof value.nanoseconds === 'number'
          ? value.nanoseconds
          : typeof value._nanoseconds === 'number'
          ? value._nanoseconds
          : 0;
      return Math.round(secs * 1000 + nanos / 1e6);
    }
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^\d+$/.test(trimmed)) {
      const n = Number(trimmed);
      if (Number.isFinite(n) && n > 0) {
        return n < 1e11 ? Math.round(n * 1000) : Math.round(n);
      }
    }
    const parsed = Date.parse(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function formatAdminDateTime(ms?: number | null): string {
  if (!ms || !Number.isFinite(ms)) return 'Not specified';
  try {
    return new Date(ms).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return new Date(ms).toISOString();
  }
}

export function formatRelativeNotificationTime(ms?: number | null): string {
  if (!ms || !Number.isFinite(ms)) return 'Just now';
  const diffSec = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
  return new Date(ms).toLocaleDateString();
}

export function formatRemainingTime(expiresAtMs?: number | null, nowMs: number = Date.now()): string {
  if (!expiresAtMs || !Number.isFinite(expiresAtMs)) return '';
  const diffMs = Math.max(0, expiresAtMs - nowMs);
  if (diffMs <= 0) return 'Expired — restoring access...';

  const totalSec = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 || days > 0) parts.push(`${hours}h`);
  if (minutes > 0 || hours > 0 || days > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);
  return parts.join(' ');
}

export function formatDurationLabel(
  rawDuration: any,
  startedAtMs?: number | null,
  expiresAtMs?: number | null,
  isPermanent?: boolean
): string {
  if (isPermanent) return 'Permanent';
  if (typeof rawDuration === 'string' && rawDuration.trim()) {
    const cleaned = rawDuration.trim();
    if (/^perm/i.test(cleaned)) return 'Permanent';
    return cleaned;
  }
  if (typeof rawDuration === 'number' && Number.isFinite(rawDuration) && rawDuration > 0) {
    // Interpret numeric duration intelligently (if <= 720 likely hours unless specified)
    if (rawDuration >= 24 && rawDuration % 24 === 0) {
      const days = rawDuration / 24;
      return `${days} ${days === 1 ? 'Day' : 'Days'}`;
    }
    return `${rawDuration} ${rawDuration === 1 ? 'Hour' : 'Hours'}`;
  }
  if (startedAtMs && expiresAtMs && expiresAtMs > startedAtMs) {
    const diffMin = Math.round((expiresAtMs - startedAtMs) / 60000);
    if (diffMin < 60) return `${Math.max(1, diffMin)} Minutes`;
    const diffHours = Math.round(diffMin / 60);
    if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'Hour' : 'Hours'}`;
    const diffDays = Math.round(diffHours / 24);
    return `${diffDays} ${diffDays === 1 ? 'Day' : 'Days'}`;
  }
  return 'Until Admin Review';
}

function firstNonEmptyString(...candidates: any[]): string | undefined {
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim().length > 0) {
      return c.trim();
    }
  }
  return undefined;
}

function resolveAdminLabel(obj: Record<string, any> | null | undefined, fallbackObj?: Record<string, any> | null): {
  adminName: string;
  adminLabel: string;
  adminEmail?: string;
} {
  const adminName =
    firstNonEmptyString(
      obj?.adminName,
      obj?.actedByName,
      obj?.performedByName,
      obj?.issuedByName,
      obj?.blockedByName,
      obj?.suspendedByName,
      obj?.moderatorName,
      obj?.adminLabel,
      obj?.byName,
      obj?.admin,
      obj?.actedBy,
      obj?.performedBy,
      obj?.issuedBy,
      obj?.blockedBy,
      obj?.suspendedBy,
      fallbackObj?.adminName,
      fallbackObj?.adminLabel,
      fallbackObj?.blockedByName,
      fallbackObj?.suspendedByName,
      fallbackObj?.blockedBy,
      fallbackObj?.suspendedBy
    ) || 'Alpha Mate Admin';

  const adminEmail = firstNonEmptyString(
    obj?.adminEmail,
    obj?.performedByEmail,
    obj?.actedByEmail,
    fallbackObj?.adminEmail
  );

  const adminLabel =
    firstNonEmptyString(obj?.adminLabel, obj?.adminRole, fallbackObj?.adminLabel) ||
    (adminName.toLowerCase().includes('super')
      ? 'Alpha Mate Super Admin'
      : adminName.toLowerCase().includes('admin')
      ? adminName
      : `${adminName} (Alpha Mate Admin)`);

  return { adminName, adminLabel, adminEmail };
}

function isRestrictionStatusString(val: any): boolean {
  if (typeof val !== 'string') return false;
  const s = val.trim().toLowerCase();
  return (
    s === 'suspended' ||
    s === 'disabled' ||
    s === 'restricted' ||
    s === 'blocked' ||
    s === 'banned' ||
    s === 'revoked' ||
    s === 'off'
  );
}

function isRestoredStatusString(val: any): boolean {
  if (typeof val !== 'string') return false;
  const s = val.trim().toLowerCase();
  return s === 'active' || s === 'enabled' || s === 'restored' || s === 'allowed' || s === 'normal';
}

/**
 * Resolves the user's Blue Tick verification status cleanly from Firestore user profile fields.
 * Never conflates email verification with Blue Tick verification.
 */
export function resolveUserBlueTickVerified(
  rawUser: Record<string, any> | null | undefined,
  fallback = false
): boolean {
  if (!rawUser || typeof rawUser !== 'object') return fallback;

  const modVer = rawUser.moderation?.verification || rawUser.verification || null;
  if (typeof modVer?.isVerified === 'boolean') return modVer.isVerified;
  if (typeof modVer?.blueTick === 'boolean') return modVer.blueTick;
  if (typeof modVer?.enabled === 'boolean') return modVer.enabled;

  if (typeof rawUser.blueTick === 'boolean') return rawUser.blueTick;
  if (typeof rawUser.hasBlueTick === 'boolean') return rawUser.hasBlueTick;

  const vStatus = firstNonEmptyString(
    rawUser.verificationStatus,
    modVer?.status,
    rawUser.moderation?.verificationStatus
  )?.toLowerCase();
  if (vStatus) {
    if (['verified', 'approved', 'active', 'granted', 'blue_tick', 'enabled'].includes(vStatus)) {
      return true;
    }
    if (['removed', 'revoked', 'unverified', 'rejected', 'disabled', 'none', 'false'].includes(vStatus)) {
      return false;
    }
  }

  if (typeof rawUser.isVerified === 'boolean') return rawUser.isVerified;
  return fallback;
}

/**
 * Resolves the user's automatic Green Tick (account/email verification) status from Firestore profile fields.
 * Automatically active for any user who has completed email OTP, Firebase email verification, or Google/Apple sign-in.
 */
export function resolveUserGreenTickVerified(
  rawUser: Record<string, any> | null | undefined,
  fallback = false
): boolean {
  if (!rawUser || typeof rawUser !== 'object') return fallback;

  if (rawUser.greenTick === true) return true;
  if (rawUser.isAccountVerified === true || rawUser.accountVerified === true) return true;
  if (rawUser.emailOtpVerified === true || rawUser.emailVerified === true) return true;
  if (typeof rawUser.emailOtpVerifiedAt === 'string' && rawUser.emailOtpVerifiedAt.trim().length > 0) {
    return true;
  }

  const provider = String(rawUser.authProvider || '').trim().toLowerCase();
  if (provider === 'google' || provider === 'apple') {
    return true;
  }

  if (rawUser.greenTick === false || rawUser.isAccountVerified === false) {
    return false;
  }

  return fallback;
}

/**
 * Parses all Admin moderation & verification states from a Firestore `users/{uid}` document.
 * Compatible with both flat fields and nested `moderation` / `restrictions` objects written by
 * the existing Alpha Mate Admin Panel / Super Admin Dashboard.
 */
export function parseAdminModerationState(
  rawUser: Record<string, any> | null | undefined,
  nowMs: number = Date.now()
): AdminModerationState {
  const u = (rawUser && typeof rawUser === 'object' ? rawUser : {}) as Record<string, any>;
  const mod = (u.moderation && typeof u.moderation === 'object' ? u.moderation : {}) as Record<string, any>;
  const res = (u.restrictions && typeof u.restrictions === 'object' ? u.restrictions : {}) as Record<string, any>;

  const accountStatusRaw = String(u.accountStatus || u.status || mod.accountStatus || '').trim().toLowerCase();

  // 1. ACCOUNT BLOCK
  const blockObj = (
    (mod.accountBlock && typeof mod.accountBlock === 'object' && mod.accountBlock) ||
    (mod.block && typeof mod.block === 'object' && mod.block) ||
    (res.accountBlock && typeof res.accountBlock === 'object' && res.accountBlock) ||
    (res.block && typeof res.block === 'object' && res.block) ||
    (res.account && typeof res.account === 'object' && res.account.blocked ? res.account : null) ||
    null
  ) as Record<string, any> | null;

  const isBlockFlagged = Boolean(
    accountStatusRaw === 'blocked' ||
      accountStatusRaw === 'banned' ||
      u.isBlocked === true ||
      u.blocked === true ||
      u.isBanned === true ||
      u.banned === true ||
      mod.isBlocked === true ||
      mod.blocked === true ||
      mod.isBanned === true ||
      blockObj?.active === true ||
      blockObj?.isBlocked === true ||
      blockObj?.blocked === true ||
      blockObj?.status === 'blocked' ||
      blockObj?.status === 'banned'
  );

  let accountBlock: AdminRestrictionDetail | null = null;
  if (isBlockFlagged) {
    const adminInfo = resolveAdminLabel(blockObj, u);
    const startedAtMs = parseFirestoreTimestampMs(
      blockObj?.blockedAt ??
        blockObj?.startedAt ??
        blockObj?.createdAt ??
        blockObj?.actionDate ??
        u.blockedAt ??
        u.blockedAtMs ??
        u.bannedAt ??
        mod.blockedAt
    );
    accountBlock = {
      isActive: true,
      scope: 'account',
      actionKind: 'account_blocked',
      title: 'YOUR ACCOUNT HAS BEEN BLOCKED',
      actionTaken:
        firstNonEmptyString(blockObj?.actionTaken, blockObj?.action, 'Account Blocked by Admin') ||
        'Account Blocked by Admin',
      reason:
        firstNonEmptyString(
          blockObj?.reason,
          u.blockReason,
          u.banReason,
          mod.blockReason,
          u.lastAdminAction?.reason,
          'Violation of Alpha Mate community safety guidelines.'
        ) || 'Violation of Alpha Mate community safety guidelines.',
      adminName: adminInfo.adminName,
      adminLabel: adminInfo.adminLabel,
      adminEmail: adminInfo.adminEmail,
      adminMessage: firstNonEmptyString(
        blockObj?.adminMessage,
        blockObj?.message,
        blockObj?.note,
        u.blockMessage,
        mod.blockMessage,
        u.adminMessage
      ),
      duration: 'Permanent until Admin unblock',
      startedAtMs,
      expiresAtMs: null,
      isPermanent: true,
      currentStatus: 'Blocked',
      actionId: firstNonEmptyString(blockObj?.actionId, blockObj?.id),
    };
  }

  // 2. ACCOUNT SUSPENSION
  const suspendObj = (
    (mod.accountSuspension && typeof mod.accountSuspension === 'object' && mod.accountSuspension) ||
    (mod.suspension && typeof mod.suspension === 'object' && mod.suspension) ||
    (res.accountSuspension && typeof res.accountSuspension === 'object' && res.accountSuspension) ||
    (res.suspension && typeof res.suspension === 'object' && res.suspension) ||
    (res.account && typeof res.account === 'object' && (res.account.suspended || res.account.isSuspended)
      ? res.account
      : null) ||
    null
  ) as Record<string, any> | null;

  const isSuspendFlagged = Boolean(
    accountStatusRaw === 'suspended' ||
      u.isSuspended === true ||
      u.suspended === true ||
      mod.isSuspended === true ||
      mod.suspended === true ||
      suspendObj?.active === true ||
      suspendObj?.isSuspended === true ||
      suspendObj?.suspended === true ||
      suspendObj?.status === 'suspended'
  );

  let accountSuspension: AdminRestrictionDetail | null = null;
  if (isSuspendFlagged) {
    const adminInfo = resolveAdminLabel(suspendObj, u);
    const startedAtMs = parseFirestoreTimestampMs(
      suspendObj?.startedAt ??
        suspendObj?.suspendedAt ??
        suspendObj?.startTime ??
        suspendObj?.createdAt ??
        u.suspendedAt ??
        u.suspendedAtMs ??
        u.suspensionStartAt ??
        mod.suspendedAt
    );
    let expiresAtMs = parseFirestoreTimestampMs(
      suspendObj?.expiresAt ??
        suspendObj?.expiresAtMs ??
        suspendObj?.suspendedUntil ??
        suspendObj?.expiryDate ??
        suspendObj?.endTime ??
        u.suspendedUntil ??
        u.suspensionExpiresAt ??
        u.suspensionExpiry ??
        mod.suspendedUntil ??
        mod.suspensionExpiresAt
    );
    const rawDuration =
      suspendObj?.duration ??
      suspendObj?.suspensionDuration ??
      u.suspensionDuration ??
      mod.suspensionDuration ??
      (typeof suspendObj?.durationHours === 'number'
        ? `${suspendObj.durationHours} Hours`
        : typeof u.suspensionHours === 'number'
        ? `${u.suspensionHours} Hours`
        : typeof suspendObj?.durationDays === 'number'
        ? `${suspendObj.durationDays} Days`
        : typeof u.suspensionDays === 'number'
        ? `${u.suspensionDays} Days`
        : undefined);

    // Derive expiry if start + numeric hours/days exist without explicit expiresAt
    if (!expiresAtMs && startedAtMs) {
      const hours = Number(suspendObj?.durationHours ?? u.suspensionHours ?? 0);
      const days = Number(suspendObj?.durationDays ?? u.suspensionDays ?? 0);
      if (hours > 0) expiresAtMs = startedAtMs + hours * 3600 * 1000;
      else if (days > 0) expiresAtMs = startedAtMs + days * 86400 * 1000;
    }

    const explicitPermanent = Boolean(
      suspendObj?.isPermanent === true ||
        suspendObj?.permanent === true ||
        u.isPermanentSuspension === true ||
        u.permanentSuspension === true ||
        mod.isPermanentSuspension === true ||
        (typeof rawDuration === 'string' && /^perm/i.test(rawDuration.trim()))
    );
    const isPermanent = explicitPermanent || !expiresAtMs;
    const hasExpired = !isPermanent && Boolean(expiresAtMs && nowMs >= expiresAtMs);

    accountSuspension = {
      isActive: !hasExpired,
      hasExpired,
      scope: 'account',
      actionKind: 'account_suspended',
      title: 'YOUR ACCOUNT HAS BEEN SUSPENDED',
      actionTaken:
        firstNonEmptyString(
          suspendObj?.actionTaken,
          suspendObj?.action,
          isPermanent ? 'Permanent Account Suspension' : 'Temporary Account Suspension'
        ) || 'Account Suspension',
      reason:
        firstNonEmptyString(
          suspendObj?.reason,
          u.suspensionReason,
          u.suspendReason,
          mod.suspensionReason,
          u.lastAdminAction?.reason,
          'Your account was suspended by Alpha Mate moderation.'
        ) || 'Your account was suspended by Alpha Mate moderation.',
      adminName: adminInfo.adminName,
      adminLabel: adminInfo.adminLabel,
      adminEmail: adminInfo.adminEmail,
      adminMessage: firstNonEmptyString(
        suspendObj?.adminMessage,
        suspendObj?.message,
        suspendObj?.note,
        u.suspensionMessage,
        mod.suspensionMessage,
        u.adminMessage
      ),
      duration: formatDurationLabel(rawDuration, startedAtMs, expiresAtMs, isPermanent),
      startedAtMs,
      expiresAtMs: isPermanent ? null : expiresAtMs,
      isPermanent,
      currentStatus: hasExpired
        ? 'Active (Suspension Expired)'
        : isPermanent
        ? 'Permanently Suspended'
        : 'Temporarily Suspended',
      actionId: firstNonEmptyString(suspendObj?.actionId, suspendObj?.id),
    };
  }

  // 3. LIVE STREAMING RESTRICTION
  const liveObj = (
    (mod.liveRestriction && typeof mod.liveRestriction === 'object' && mod.liveRestriction) ||
    (mod.live && typeof mod.live === 'object' && mod.live) ||
    (res.live && typeof res.live === 'object' && res.live) ||
    (res.liveStreaming && typeof res.liveStreaming === 'object' && res.liveStreaming) ||
    null
  ) as Record<string, any> | null;

  const isLiveFlagged = Boolean(
    !isRestoredStatusString(u.liveAccess) &&
      (u.liveDisabled === true ||
        u.liveSuspended === true ||
        u.liveRestricted === true ||
        u.liveBanned === true ||
        u.canGoLive === false ||
        isRestrictionStatusString(u.liveAccess) ||
        mod.liveDisabled === true ||
        mod.liveSuspended === true ||
        mod.liveRestricted === true ||
        liveObj?.active === true ||
        liveObj?.suspended === true ||
        liveObj?.disabled === true ||
        liveObj?.restricted === true ||
        liveObj?.canGoLive === false ||
        isRestrictionStatusString(liveObj?.status))
  );

  let liveRestriction: AdminRestrictionDetail | null = null;
  if (isLiveFlagged) {
    const adminInfo = resolveAdminLabel(liveObj, u);
    const startedAtMs = parseFirestoreTimestampMs(
      liveObj?.startedAt ??
        liveObj?.suspendedAt ??
        liveObj?.restrictedAt ??
        liveObj?.createdAt ??
        u.liveSuspendedAt ??
        u.liveRestrictedAt ??
        mod.liveSuspendedAt
    );
    let expiresAtMs = parseFirestoreTimestampMs(
      liveObj?.expiresAt ??
        liveObj?.expiresAtMs ??
        liveObj?.suspendedUntil ??
        liveObj?.expiryDate ??
        u.liveSuspendedUntil ??
        u.liveExpiresAt ??
        mod.liveSuspendedUntil
    );
    const rawDuration =
      liveObj?.duration ??
      liveObj?.suspensionDuration ??
      u.liveRestrictionDuration ??
      mod.liveRestrictionDuration;

    if (!expiresAtMs && startedAtMs) {
      const hours = Number(liveObj?.durationHours ?? 0);
      const days = Number(liveObj?.durationDays ?? 0);
      if (hours > 0) expiresAtMs = startedAtMs + hours * 3600 * 1000;
      else if (days > 0) expiresAtMs = startedAtMs + days * 86400 * 1000;
    }

    const explicitPermanent = Boolean(
      liveObj?.isPermanent === true ||
        liveObj?.permanent === true ||
        (typeof rawDuration === 'string' && /^perm/i.test(rawDuration.trim()))
    );
    const isPermanent = explicitPermanent || !expiresAtMs;
    const hasExpired = !isPermanent && Boolean(expiresAtMs && nowMs >= expiresAtMs);

    liveRestriction = {
      isActive: !hasExpired,
      hasExpired,
      scope: 'live',
      actionKind: 'live_suspended',
      title: 'YOUR LIVE ACCESS HAS BEEN SUSPENDED',
      actionTaken:
        firstNonEmptyString(liveObj?.actionTaken, liveObj?.action, 'Live Streaming Access Suspended') ||
        'Live Streaming Access Suspended',
      reason:
        firstNonEmptyString(
          liveObj?.reason,
          u.liveRestrictionReason,
          u.liveSuspensionReason,
          mod.liveRestrictionReason,
          'Live streaming privileges were suspended by Admin.'
        ) || 'Live streaming privileges were suspended by Admin.',
      adminName: adminInfo.adminName,
      adminLabel: adminInfo.adminLabel,
      adminEmail: adminInfo.adminEmail,
      adminMessage: firstNonEmptyString(
        liveObj?.adminMessage,
        liveObj?.message,
        liveObj?.note,
        u.liveRestrictionMessage,
        mod.liveRestrictionMessage
      ),
      duration: formatDurationLabel(rawDuration, startedAtMs, expiresAtMs, isPermanent),
      startedAtMs,
      expiresAtMs: isPermanent ? null : expiresAtMs,
      isPermanent,
      currentStatus: hasExpired
        ? 'Live Access Active'
        : isPermanent
        ? 'Live Access Suspended (Permanent)'
        : 'Live Access Suspended',
      actionId: firstNonEmptyString(liveObj?.actionId, liveObj?.id),
    };
  }

  // 4. PARTY ACCESS RESTRICTION
  const partyObj = (
    (mod.partyRestriction && typeof mod.partyRestriction === 'object' && mod.partyRestriction) ||
    (mod.party && typeof mod.party === 'object' && mod.party) ||
    (res.party && typeof res.party === 'object' && res.party) ||
    (res.partyRooms && typeof res.partyRooms === 'object' && res.partyRooms) ||
    null
  ) as Record<string, any> | null;

  const isPartyFlagged = Boolean(
    !isRestoredStatusString(u.partyAccess) &&
      (u.partyDisabled === true ||
        u.partySuspended === true ||
        u.partyRestricted === true ||
        u.partyBanned === true ||
        u.canJoinParty === false ||
        u.canCreateParty === false ||
        isRestrictionStatusString(u.partyAccess) ||
        mod.partyDisabled === true ||
        mod.partySuspended === true ||
        mod.partyRestricted === true ||
        partyObj?.active === true ||
        partyObj?.disabled === true ||
        partyObj?.suspended === true ||
        partyObj?.restricted === true ||
        partyObj?.canJoinParty === false ||
        partyObj?.canCreateParty === false ||
        isRestrictionStatusString(partyObj?.status))
  );

  let partyRestriction: AdminRestrictionDetail | null = null;
  if (isPartyFlagged) {
    const adminInfo = resolveAdminLabel(partyObj, u);
    const startedAtMs = parseFirestoreTimestampMs(
      partyObj?.startedAt ??
        partyObj?.restrictedAt ??
        partyObj?.suspendedAt ??
        partyObj?.createdAt ??
        u.partyRestrictedAt ??
        u.partySuspendedAt ??
        mod.partyRestrictedAt
    );
    let expiresAtMs = parseFirestoreTimestampMs(
      partyObj?.expiresAt ??
        partyObj?.expiresAtMs ??
        partyObj?.suspendedUntil ??
        partyObj?.expiryDate ??
        u.partySuspendedUntil ??
        u.partyExpiresAt ??
        mod.partySuspendedUntil
    );
    const rawDuration =
      partyObj?.duration ??
      partyObj?.suspensionDuration ??
      u.partyRestrictionDuration ??
      mod.partyRestrictionDuration;

    if (!expiresAtMs && startedAtMs) {
      const hours = Number(partyObj?.durationHours ?? 0);
      const days = Number(partyObj?.durationDays ?? 0);
      if (hours > 0) expiresAtMs = startedAtMs + hours * 3600 * 1000;
      else if (days > 0) expiresAtMs = startedAtMs + days * 86400 * 1000;
    }

    const explicitPermanent = Boolean(
      partyObj?.isPermanent === true ||
        partyObj?.permanent === true ||
        (typeof rawDuration === 'string' && /^perm/i.test(rawDuration.trim()))
    );
    const isPermanent = explicitPermanent || !expiresAtMs;
    const hasExpired = !isPermanent && Boolean(expiresAtMs && nowMs >= expiresAtMs);

    partyRestriction = {
      isActive: !hasExpired,
      hasExpired,
      scope: 'party',
      actionKind: 'party_restricted',
      title: 'YOUR PARTY ACCESS HAS BEEN RESTRICTED',
      actionTaken:
        firstNonEmptyString(partyObj?.actionTaken, partyObj?.action, 'Party Room Access Restricted') ||
        'Party Room Access Restricted',
      reason:
        firstNonEmptyString(
          partyObj?.reason,
          u.partyRestrictionReason,
          u.partySuspensionReason,
          mod.partyRestrictionReason,
          'Party Room creation and participation were restricted by Admin.'
        ) || 'Party Room creation and participation were restricted by Admin.',
      adminName: adminInfo.adminName,
      adminLabel: adminInfo.adminLabel,
      adminEmail: adminInfo.adminEmail,
      adminMessage: firstNonEmptyString(
        partyObj?.adminMessage,
        partyObj?.message,
        partyObj?.note,
        u.partyRestrictionMessage,
        mod.partyRestrictionMessage
      ),
      duration: formatDurationLabel(rawDuration, startedAtMs, expiresAtMs, isPermanent),
      startedAtMs,
      expiresAtMs: isPermanent ? null : expiresAtMs,
      isPermanent,
      currentStatus: hasExpired
        ? 'Party Access Active'
        : isPermanent
        ? 'Party Access Restricted (Permanent)'
        : 'Party Access Restricted',
      actionId: firstNonEmptyString(partyObj?.actionId, partyObj?.id),
    };
  }

  // 5. LATEST WARNING (if stored directly on users/{uid})
  let latestWarning: AdminWarningRecord | null = null;
  const rawWarnCandidate =
    (u.latestWarning && typeof u.latestWarning === 'object' ? u.latestWarning : null) ||
    (u.activeWarning && typeof u.activeWarning === 'object' ? u.activeWarning : null) ||
    (mod.latestWarning && typeof mod.latestWarning === 'object' ? mod.latestWarning : null) ||
    (mod.warning && typeof mod.warning === 'object' ? mod.warning : null) ||
    (Array.isArray(u.warnings) && u.warnings.length > 0 ? u.warnings[u.warnings.length - 1] : null);

  if (rawWarnCandidate && typeof rawWarnCandidate === 'object') {
    const adminInfo = resolveAdminLabel(rawWarnCandidate, u);
    const createdAtMs =
      parseFirestoreTimestampMs(
        rawWarnCandidate.createdAtMs ??
          rawWarnCandidate.createdAt ??
          rawWarnCandidate.issuedAt ??
          rawWarnCandidate.timestamp
      ) || Date.now();
    const message = firstNonEmptyString(
      rawWarnCandidate.message,
      rawWarnCandidate.warningMessage,
      rawWarnCandidate.adminMessage,
      rawWarnCandidate.text,
      rawWarnCandidate.reason
    );
    if (message) {
      latestWarning = {
        id:
          firstNonEmptyString(rawWarnCandidate.id, rawWarnCandidate.warningId) ||
          `profile_warn_${createdAtMs}`,
        title: firstNonEmptyString(rawWarnCandidate.title, 'OFFICIAL ADMIN WARNING') || 'OFFICIAL ADMIN WARNING',
        message,
        reason:
          firstNonEmptyString(rawWarnCandidate.reason, 'Community Guidelines Notice') ||
          'Community Guidelines Notice',
        adminName: adminInfo.adminName,
        adminLabel: adminInfo.adminLabel,
        adminEmail: adminInfo.adminEmail,
        createdAtMs,
        isRead: Boolean(rawWarnCandidate.isRead || rawWarnCandidate.acknowledged),
      };
    }
  }

  // 6. BLUE TICK / VERIFICATION STATUS
  const isVerified = resolveUserBlueTickVerified(u, false);
  const verObj = (mod.verification && typeof mod.verification === 'object' ? mod.verification : u.verification) || null;
  const verificationStatus =
    firstNonEmptyString(
      u.verificationStatus,
      verObj?.status,
      isVerified ? 'Verified (Blue Tick Active)' : 'Not Verified'
    ) || (isVerified ? 'Verified (Blue Tick Active)' : 'Not Verified');
  const verificationReason = firstNonEmptyString(
    u.verificationReason,
    verObj?.reason,
    mod.verificationReason
  );
  const verificationAdmin = resolveAdminLabel(verObj, u);
  const verificationUpdatedAtMs = parseFirestoreTimestampMs(
    u.verificationUpdatedAt ?? verObj?.updatedAt ?? u.verifiedAt
  );

  // 7. NEXT AUTO-EXPIRY TIMESTAMP
  const futureExpiries = [
    accountSuspension?.isActive ? accountSuspension.expiresAtMs : null,
    liveRestriction?.isActive ? liveRestriction.expiresAtMs : null,
    partyRestriction?.isActive ? partyRestriction.expiresAtMs : null,
  ].filter((ms): ms is number => typeof ms === 'number' && ms > nowMs);
  const nextExpiryMs = futureExpiries.length > 0 ? Math.min(...futureExpiries) : null;

  const isAccountBlocked = Boolean(accountBlock?.isActive);
  const isAccountSuspended = Boolean(!isAccountBlocked && accountSuspension?.isActive);
  const isLiveRestricted = Boolean(liveRestriction?.isActive);
  const isPartyRestricted = Boolean(partyRestriction?.isActive);

  let currentAccountStatusLabel = 'Active';
  if (isAccountBlocked) currentAccountStatusLabel = 'Account Blocked';
  else if (isAccountSuspended) currentAccountStatusLabel = accountSuspension?.currentStatus || 'Account Suspended';
  else if (isLiveRestricted && isPartyRestricted) currentAccountStatusLabel = 'Live & Party Access Restricted';
  else if (isLiveRestricted) currentAccountStatusLabel = 'Live Access Suspended';
  else if (isPartyRestricted) currentAccountStatusLabel = 'Party Access Restricted';

  return {
    isAccountBlocked,
    isAccountSuspended,
    isLiveRestricted,
    isPartyRestricted,
    accountBlock,
    accountSuspension,
    liveRestriction,
    partyRestriction,
    latestWarning,
    isVerified,
    verificationStatus,
    verificationReason,
    verificationAdminName: verificationAdmin.adminLabel,
    verificationUpdatedAtMs,
    nextExpiryMs,
    currentAccountStatusLabel,
  };
}

/**
 * Determines whether a Firestore notification document is an Admin / Moderation action.
 */
export function isAdminNotificationRecord(raw: Record<string, any> | null | undefined): boolean {
  if (!raw || typeof raw !== 'object') return false;
  if (raw.isAdminAction === true) return true;
  const type = String(raw.type || raw.actionType || raw.action || '').trim().toLowerCase();
  if (
    [
      'admin_action',
      'admin_warning',
      'warning',
      'moderation',
      'verification',
      'blue_tick',
      'bluetick',
      'account_blocked',
      'block',
      'ban',
      'account_unblocked',
      'unblock',
      'unban',
      'account_suspended',
      'suspend',
      'account_restored',
      'restore',
      'unsuspend',
      'live_restricted',
      'live_suspended',
      'live_disabled',
      'live_restored',
      'party_restricted',
      'party_disabled',
      'party_suspended',
      'party_restored',
      'access_restored',
    ].includes(type)
  ) {
    return true;
  }
  const cat = String(raw.category || '').trim().toLowerCase();
  if (cat === 'admin' || cat === 'moderation' || cat === 'warning' || cat === 'verification') {
    return true;
  }
  const sender = String(raw.senderId || '').trim().toLowerCase();
  if (sender === 'admin' || sender === 'super_admin' || sender === 'alpha_admin' || sender === 'moderation') {
    return true;
  }
  if (raw.actionType || raw.actionTaken || raw.moderationAction || raw.restrictionScope) {
    return true;
  }
  return false;
}

export function inferAdminActionKind(raw: Record<string, any>): {
  actionKind: AdminActionKind;
  eventType: NotificationEventType;
  scope: AdminRestrictionScope;
  defaultTitle: string;
  defaultActionTaken: string;
  defaultStatus: string;
} {
  const combined = `${raw.actionKind || ''} ${raw.actionType || ''} ${raw.type || ''} ${raw.action || ''} ${raw.title || ''}`
    .trim()
    .toLowerCase();

  if (combined.includes('unblock') || combined.includes('unban')) {
    return {
      actionKind: 'account_unblocked',
      eventType: 'access_restored',
      scope: 'account',
      defaultTitle: 'YOUR ACCOUNT HAS BEEN RESTORED',
      defaultActionTaken: 'Account Unblocked by Admin',
      defaultStatus: 'Active',
    };
  }
  if (combined.includes('block') || combined.includes('ban')) {
    if (combined.includes('live')) {
      return {
        actionKind: 'live_suspended',
        eventType: 'live_restricted',
        scope: 'live',
        defaultTitle: 'YOUR LIVE ACCESS HAS BEEN SUSPENDED',
        defaultActionTaken: 'Live Streaming Access Suspended',
        defaultStatus: 'Live Access Suspended',
      };
    }
    if (combined.includes('party')) {
      return {
        actionKind: 'party_restricted',
        eventType: 'party_restricted',
        scope: 'party',
        defaultTitle: 'YOUR PARTY ACCESS HAS BEEN RESTRICTED',
        defaultActionTaken: 'Party Room Access Restricted',
        defaultStatus: 'Party Access Restricted',
      };
    }
    return {
      actionKind: 'account_blocked',
      eventType: 'account_blocked',
      scope: 'account',
      defaultTitle: 'YOUR ACCOUNT HAS BEEN BLOCKED',
      defaultActionTaken: 'Account Blocked by Admin',
      defaultStatus: 'Blocked',
    };
  }
  if (combined.includes('live') && (combined.includes('restore') || combined.includes('enable') || combined.includes('unsuspend') || combined.includes('lift'))) {
    return {
      actionKind: 'live_restored',
      eventType: 'access_restored',
      scope: 'live',
      defaultTitle: 'YOUR LIVE ACCESS HAS BEEN RESTORED',
      defaultActionTaken: 'Live Streaming Access Restored',
      defaultStatus: 'Live Access Active',
    };
  }
  if (combined.includes('live') && (combined.includes('suspend') || combined.includes('disable') || combined.includes('restrict'))) {
    return {
      actionKind: 'live_suspended',
      eventType: 'live_restricted',
      scope: 'live',
      defaultTitle: 'YOUR LIVE ACCESS HAS BEEN SUSPENDED',
      defaultActionTaken: 'Live Streaming Access Suspended',
      defaultStatus: 'Live Access Suspended',
    };
  }
  if (combined.includes('party') && (combined.includes('restore') || combined.includes('enable') || combined.includes('unsuspend') || combined.includes('lift'))) {
    return {
      actionKind: 'party_restored',
      eventType: 'access_restored',
      scope: 'party',
      defaultTitle: 'YOUR PARTY ACCESS HAS BEEN RESTORED',
      defaultActionTaken: 'Party Room Access Restored',
      defaultStatus: 'Party Access Active',
    };
  }
  if (combined.includes('party') && (combined.includes('restrict') || combined.includes('disable') || combined.includes('suspend'))) {
    return {
      actionKind: 'party_restricted',
      eventType: 'party_restricted',
      scope: 'party',
      defaultTitle: 'YOUR PARTY ACCESS HAS BEEN RESTRICTED',
      defaultActionTaken: 'Party Room Access Restricted',
      defaultStatus: 'Party Access Restricted',
    };
  }
  if (combined.includes('unsuspend') || combined.includes('restore') || combined.includes('reactivate')) {
    return {
      actionKind: 'account_restored',
      eventType: 'access_restored',
      scope: 'account',
      defaultTitle: 'YOUR ACCOUNT ACCESS HAS BEEN RESTORED',
      defaultActionTaken: 'Account Suspension Removed',
      defaultStatus: 'Active',
    };
  }
  if (combined.includes('suspend')) {
    return {
      actionKind: 'account_suspended',
      eventType: 'account_suspended',
      scope: 'account',
      defaultTitle: 'YOUR ACCOUNT HAS BEEN SUSPENDED',
      defaultActionTaken: 'Account Suspended by Admin',
      defaultStatus: 'Suspended',
    };
  }
  if (combined.includes('warn')) {
    return {
      actionKind: 'admin_warning',
      eventType: 'admin_warning',
      scope: 'warning',
      defaultTitle: 'OFFICIAL ADMIN WARNING',
      defaultActionTaken: 'Official Admin Warning Issued',
      defaultStatus: 'Warning Issued',
    };
  }
  if (combined.includes('blue') || combined.includes('verif') || combined.includes('tick')) {
    const removed = combined.includes('remov') || combined.includes('revok') || combined.includes('disable');
    const granted = combined.includes('grant') || combined.includes('approv') || combined.includes('add') || combined.includes('verified');
    return {
      actionKind: removed
        ? 'verification_removed'
        : granted
        ? 'verification_granted'
        : 'verification_updated',
      eventType: 'verification',
      scope: 'verification',
      defaultTitle: removed
        ? 'Blue Tick Verification Removed'
        : granted
        ? 'Blue Tick Verification Approved'
        : 'Verification Status Updated',
      defaultActionTaken: removed
        ? 'Blue Tick Verification Removed'
        : granted
        ? 'Blue Tick Verification Granted'
        : 'Verification Status Updated',
      defaultStatus: removed ? 'Not Verified' : granted ? 'Verified (Blue Tick)' : 'Verification Updated',
    };
  }

  return {
    actionKind: 'admin_action',
    eventType: 'admin_action',
    scope: 'general',
    defaultTitle: 'Official Alpha Mate Admin Notice',
    defaultActionTaken: firstNonEmptyString(raw.actionTaken, raw.actionType, 'Admin Moderation Action') || 'Admin Moderation Action',
    defaultStatus: firstNonEmptyString(raw.currentStatus, 'Updated by Admin') || 'Updated by Admin',
  };
}

/**
 * Normalizes any Firestore document from `users/{uid}/notifications`, `users/{uid}/adminActions`,
 * `users/{uid}/warnings`, or top-level `adminActions` into a rich `NotificationItem`.
 */
export function normalizeNotificationDocument(
  docId: string,
  raw: Record<string, any>,
  sourceCollection: 'notifications' | 'adminActions' | 'warnings' = 'notifications'
): NotificationItem {
  const isAdmin =
    sourceCollection !== 'notifications' || isAdminNotificationRecord(raw);

  const createdAtMs =
    parseFirestoreTimestampMs(
      raw.createdAtMs ??
        raw.createdAt ??
        raw.actionDateMs ??
        raw.actionDate ??
        raw.timestamp ??
        raw.issuedAt ??
        raw.updatedAt
    ) || Date.now();

  if (!isAdmin) {
    return {
      id: docId,
      type: (raw.type || 'system') as NotificationEventType,
      category: raw.category,
      title: firstNonEmptyString(raw.title, 'Alpha Mate') || 'Alpha Mate',
      message: firstNonEmptyString(raw.message, raw.body, '') || '',
      senderId: raw.senderId,
      senderName: raw.senderName,
      senderAvatar: raw.senderAvatar,
      recipientId: raw.recipientId || raw.targetUserId || raw.userId,
      screen: raw.screen,
      tab: raw.tab,
      roomId: raw.roomId,
      streamId: raw.streamId,
      reelId: raw.reelId,
      chatId: raw.chatId,
      isRead: Boolean(raw.isRead),
      createdAtMs,
      timestamp: formatRelativeNotificationTime(createdAtMs),
      sourceCollection,
      user: raw.senderId
        ? {
            id: raw.senderId,
            displayName: raw.senderName || 'Alpha Mate User',
            avatar: raw.senderAvatar || '',
          } as any
        : undefined,
    };
  }

  const inferred = inferAdminActionKind(
    sourceCollection === 'warnings' ? { ...raw, actionType: raw.actionType || 'admin_warning' } : raw
  );
  const adminInfo = resolveAdminLabel(raw);
  const startedAtMs =
    parseFirestoreTimestampMs(
      raw.startedAtMs ?? raw.startedAt ?? raw.startDate ?? raw.suspendedAt ?? raw.createdAtMs ?? raw.createdAt
    ) || createdAtMs;
  const expiresAtMs = parseFirestoreTimestampMs(
    raw.expiresAtMs ?? raw.expiresAt ?? raw.expiryDate ?? raw.suspendedUntil ?? raw.endTime
  );
  const isPermanent = Boolean(
    raw.isPermanent === true ||
      raw.permanent === true ||
      (typeof raw.duration === 'string' && /^perm/i.test(raw.duration.trim()))
  );
  const duration =
    raw.duration !== undefined || raw.durationHours !== undefined || expiresAtMs || isPermanent
      ? formatDurationLabel(
          raw.duration ??
            (typeof raw.durationHours === 'number' ? `${raw.durationHours} Hours` : undefined),
          startedAtMs,
          expiresAtMs,
          isPermanent
        )
      : undefined;

  const title = firstNonEmptyString(raw.actionTitle, raw.title, inferred.defaultTitle) || inferred.defaultTitle;
  const reason = firstNonEmptyString(raw.reason, raw.moderationReason, raw.warningReason);
  const adminMessage = firstNonEmptyString(raw.adminMessage, raw.note, raw.details, raw.warningMessage);
  const actionTaken = firstNonEmptyString(raw.actionTaken, raw.actionLabel, inferred.defaultActionTaken) || inferred.defaultActionTaken;
  const message =
    firstNonEmptyString(
      raw.message,
      raw.body,
      adminMessage,
      reason ? `${actionTaken}. Reason: ${reason}` : actionTaken
    ) || actionTaken;

  const dedupBucket = Math.floor(createdAtMs / 15000);
  const dedupKey = firstNonEmptyString(
    raw.dedupKey,
    raw.actionId ? `action_${raw.actionId}` : undefined,
    `${inferred.actionKind}:${(reason || '').toLowerCase().slice(0, 48)}:${dedupBucket}`
  );

  return {
    id: sourceCollection === 'notifications' ? docId : `${sourceCollection}_${docId}`,
    type: inferred.eventType,
    category: 'walletAndSystem',
    title,
    message,
    senderId: raw.senderId || 'alpha_mate_admin',
    senderName: adminInfo.adminLabel,
    senderAvatar: raw.senderAvatar,
    recipientId: raw.recipientId || raw.targetUserId || raw.userId,
    screen: raw.screen || 'notifications',
    isRead: Boolean(raw.isRead || raw.acknowledged),
    createdAtMs,
    timestamp: formatRelativeNotificationTime(createdAtMs),
    isAdminAction: true,
    actionKind: inferred.actionKind,
    actionType: firstNonEmptyString(raw.actionType, raw.type, inferred.actionKind),
    actionTitle: title,
    actionTaken,
    reason: reason || 'Official Alpha Mate moderation review',
    adminName: adminInfo.adminName,
    adminLabel: adminInfo.adminLabel,
    adminEmail: adminInfo.adminEmail,
    adminMessage: adminMessage || (message !== actionTaken ? message : undefined),
    duration,
    startedAt: formatAdminDateTime(startedAtMs),
    startedAtMs,
    expiresAt: expiresAtMs ? formatAdminDateTime(expiresAtMs) : undefined,
    expiresAtMs,
    isPermanent,
    currentStatus: firstNonEmptyString(raw.currentStatus, raw.accountStatus, inferred.defaultStatus),
    restrictionScope: (raw.restrictionScope as AdminRestrictionScope) || inferred.scope,
    verificationStatus: firstNonEmptyString(raw.verificationStatus),
    actionDate: formatAdminDateTime(createdAtMs),
    actionDateMs: createdAtMs,
    sourceCollection,
    dedupKey,
  };
}

/**
 * Merges notifications from `users/{uid}/notifications`, `users/{uid}/adminActions`,
 * `users/{uid}/warnings`, and live state-transition records without ever creating duplicates.
 */
export function mergeAndDeduplicateNotifications(lists: NotificationItem[][]): NotificationItem[] {
  const byId = new Map<string, NotificationItem>();
  const adminByDedupKey = new Map<string, NotificationItem>();

  const flat = lists.flat().filter(Boolean);

  for (const item of flat) {
    if (!item?.id) continue;

    // Prefer primary `notifications` collection item when dedupKey matches
    if (item.isAdminAction && item.dedupKey) {
      const existing = adminByDedupKey.get(item.dedupKey);
      if (existing) {
        const incomingPriority =
          item.sourceCollection === 'notifications'
            ? 3
            : item.sourceCollection === 'adminActions' || item.sourceCollection === 'warnings'
            ? 2
            : 1;
        const existingPriority =
          existing.sourceCollection === 'notifications'
            ? 3
            : existing.sourceCollection === 'adminActions' || existing.sourceCollection === 'warnings'
            ? 2
            : 1;

        if (incomingPriority > existingPriority) {
          byId.delete(existing.id);
          const merged: NotificationItem = {
            ...existing,
            ...item,
            isRead: existing.isRead || item.isRead,
          };
          adminByDedupKey.set(item.dedupKey, merged);
          byId.set(merged.id, merged);
        } else {
          const merged: NotificationItem = {
            ...item,
            ...existing,
            isRead: existing.isRead || item.isRead,
          };
          adminByDedupKey.set(item.dedupKey, merged);
          byId.set(merged.id, merged);
        }
        continue;
      }
      adminByDedupKey.set(item.dedupKey, item);
    }

    const prev = byId.get(item.id);
    if (!prev) {
      byId.set(item.id, item);
    } else {
      byId.set(item.id, { ...prev, ...item, isRead: prev.isRead || item.isRead });
    }
  }

  return Array.from(byId.values()).sort(
    (a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0)
  );
}

/**
 * Subscribes in real time to optional per-user Admin Action & Warning collections
 * (`users/{uid}/adminActions`, `users/{uid}/warnings`, and top-level `adminActions` scoped strictly to `uid`).
 * Any missing collection or non-granted optional path degrades silently without breaking the user session.
 */
export function subscribeToUserAdminActionCollections(
  userId: string,
  onUpdate: (items: NotificationItem[]) => void
): () => void {
  if (!userId || isFirestoreQuotaExceeded()) return () => {};

  let subActions: NotificationItem[] = [];
  let subWarnings: NotificationItem[] = [];
  let topTargetActions: NotificationItem[] = [];
  let topUserActions: NotificationItem[] = [];

  const emit = () => {
    onUpdate(
      mergeAndDeduplicateNotifications([
        subActions,
        subWarnings,
        topTargetActions,
        topUserActions,
      ])
    );
  };

  const unsubs: Array<() => void> = [];

  try {
    unsubs.push(
      onSnapshot(
        query(collection(db, 'users', userId, 'adminActions'), limit(60)),
        (snap) => {
          subActions = snap.docs.map((d) =>
            normalizeNotificationDocument(d.id, d.data() as Record<string, any>, 'adminActions')
          );
          emit();
        },
        () => {
          subActions = [];
        }
      )
    );
  } catch {
    // ignore optional listener setup failures
  }

  try {
    unsubs.push(
      onSnapshot(
        query(collection(db, 'users', userId, 'warnings'), limit(60)),
        (snap) => {
          subWarnings = snap.docs.map((d) =>
            normalizeNotificationDocument(d.id, d.data() as Record<string, any>, 'warnings')
          );
          emit();
        },
        () => {
          subWarnings = [];
        }
      )
    );
  } catch {
    // ignore
  }

  try {
    unsubs.push(
      onSnapshot(
        query(
          collection(db, 'adminActions'),
          where('targetUserId', '==', userId),
          limit(50)
        ),
        (snap) => {
          topTargetActions = snap.docs.map((d) =>
            normalizeNotificationDocument(d.id, d.data() as Record<string, any>, 'adminActions')
          );
          emit();
        },
        () => {
          topTargetActions = [];
        }
      )
    );
  } catch {
    // ignore
  }

  try {
    unsubs.push(
      onSnapshot(
        query(
          collection(db, 'adminActions'),
          where('userId', '==', userId),
          limit(50)
        ),
        (snap) => {
          topUserActions = snap.docs.map((d) =>
            normalizeNotificationDocument(d.id, d.data() as Record<string, any>, 'adminActions')
          );
          emit();
        },
        () => {
          topUserActions = [];
        }
      )
    );
  } catch {
    // ignore
  }

  return () => {
    unsubs.forEach((u) => {
      try {
        u();
      } catch {
        // ignore
      }
    });
  };
}

/**
 * Marks an admin action / warning item as read in whichever Firestore collection it originated from.
 */
export async function markAdminActionItemRead(
  userId: string,
  item: NotificationItem
): Promise<void> {
  if (!userId || !item?.id || isFirestoreQuotaExceeded()) return;
  const readAt = new Date().toISOString();
  try {
    if (item.sourceCollection === 'notifications' || !item.sourceCollection) {
      await updateDoc(doc(db, 'users', userId, 'notifications', item.id), {
        isRead: true,
        readAt,
      });
    } else if (item.sourceCollection === 'adminActions' && item.id.startsWith('adminActions_')) {
      const rawId = item.id.replace(/^adminActions_/, '');
      await updateDoc(doc(db, 'users', userId, 'adminActions', rawId), {
        isRead: true,
        readAt,
      });
    } else if (item.sourceCollection === 'warnings' && item.id.startsWith('warnings_')) {
      const rawId = item.id.replace(/^warnings_/, '');
      await updateDoc(doc(db, 'users', userId, 'warnings', rawId), {
        isRead: true,
        acknowledged: true,
        readAt,
      });
    }
  } catch {
    // Ignore if document is from top-level read-only collection or synthetic transition
  }
}

/**
 * Persists a real moderation action from the existing Admin Console (requires Official Admin auth)
 * to both `users/{targetUid}` and `users/{targetUid}/notifications` + `users/{targetUid}/adminActions`.
 */
export async function recordAdminModerationAction(params: {
  targetUserId: string;
  actionKind: AdminActionKind;
  reason: string;
  adminMessage?: string;
  durationHours?: number | null;
  isPermanent?: boolean;
  adminName?: string;
  streamIdToClose?: string;
}): Promise<{ success: boolean; error?: string }> {
  if (!isOfficialAdminAuthUser()) {
    return { success: false, error: 'Official Admin authorization required.' };
  }
  const targetUid = String(params.targetUserId || '').trim();
  if (!targetUid) return { success: false, error: 'Target user ID is required.' };

  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const actionId = `adm_${nowMs}_${Math.random().toString(36).slice(2, 8)}`;
  const adminName = params.adminName || auth.currentUser?.displayName || 'Alpha Mate Official Admin';
  const adminEmail = auth.currentUser?.email || OFFICIAL_ADMIN_EMAIL;
  const expiresAtMs =
    !params.isPermanent && params.durationHours && params.durationHours > 0
      ? nowMs + params.durationHours * 3600 * 1000
      : null;
  const expiresAtIso = expiresAtMs ? new Date(expiresAtMs).toISOString() : null;
  const durationLabel =
    params.actionKind === 'admin_warning'
      ? undefined
      : formatDurationLabel(
          params.durationHours ? `${params.durationHours} Hours` : undefined,
          nowMs,
          expiresAtMs,
          Boolean(params.isPermanent || !expiresAtMs)
        );

  const inferred = inferAdminActionKind({ actionKind: params.actionKind });
  const userUpdates: Record<string, any> = { updatedAt: nowIso };

  if (params.actionKind === 'admin_warning') {
    userUpdates.latestWarning = {
      id: actionId,
      title: 'OFFICIAL ADMIN WARNING',
      message: params.adminMessage || params.reason,
      reason: params.reason,
      adminName,
      adminLabel: `${adminName} (Alpha Mate Admin)`,
      adminEmail,
      createdAt: nowIso,
      createdAtMs: nowMs,
      isRead: false,
    };
  } else if (params.actionKind === 'live_suspended') {
    userUpdates.liveDisabled = true;
    userUpdates.liveSuspended = true;
    userUpdates.canGoLive = false;
    userUpdates.liveAccess = 'suspended';
    userUpdates.liveRestrictionReason = params.reason;
    userUpdates.liveSuspendedAt = nowIso;
    userUpdates.liveSuspendedUntil = expiresAtIso;
    userUpdates['moderation.liveRestriction'] = {
      active: true,
      actionId,
      reason: params.reason,
      adminName,
      adminLabel: `${adminName} (Alpha Mate Admin)`,
      adminEmail,
      adminMessage: params.adminMessage || '',
      duration: durationLabel,
      startedAt: nowIso,
      startedAtMs: nowMs,
      expiresAt: expiresAtIso,
      expiresAtMs,
      isPermanent: Boolean(params.isPermanent || !expiresAtMs),
    };
  } else if (params.actionKind === 'live_restored') {
    userUpdates.liveDisabled = false;
    userUpdates.liveSuspended = false;
    userUpdates.canGoLive = true;
    userUpdates.liveAccess = 'active';
    userUpdates.liveSuspendedUntil = null;
    userUpdates['moderation.liveRestriction'] = { active: false, restoredAt: nowIso };
  } else if (params.actionKind === 'account_blocked') {
    userUpdates.accountStatus = 'blocked';
    userUpdates.isBlocked = true;
    userUpdates.blockReason = params.reason;
    userUpdates.blockedAt = nowIso;
    userUpdates.blockedByName = adminName;
    userUpdates.blockMessage = params.adminMessage || '';
  }

  try {
    await updateDoc(doc(db, 'users', targetUid), userUpdates);

    const notifPayload: Record<string, any> = {
      recipientId: targetUid,
      senderId: auth.currentUser?.uid || 'alpha_mate_admin',
      senderName: `${adminName} (Alpha Mate Admin)`,
      type: inferred.eventType,
      category: 'walletAndSystem',
      title: inferred.defaultTitle,
      message: params.adminMessage || params.reason,
      isRead: false,
      createdAt: nowIso,
      createdAtMs: nowMs,
      isAdminAction: true,
      actionId,
      actionKind: params.actionKind,
      actionType: params.actionKind,
      actionTitle: inferred.defaultTitle,
      actionTaken: inferred.defaultActionTaken,
      reason: params.reason,
      adminName,
      adminLabel: `${adminName} (Alpha Mate Admin)`,
      adminEmail,
      adminMessage: params.adminMessage || '',
      currentStatus: inferred.defaultStatus,
      restrictionScope: inferred.scope,
      startedAt: nowIso,
      startedAtMs: nowMs,
      ...(durationLabel ? { duration: durationLabel } : {}),
      ...(expiresAtIso ? { expiresAt: expiresAtIso, expiresAtMs } : {}),
      isPermanent: Boolean(params.isPermanent),
    };

    await setDoc(doc(db, 'users', targetUid, 'notifications', actionId), notifPayload);
    await setDoc(doc(db, 'users', targetUid, 'adminActions', actionId), notifPayload).catch(() => {});

    if (params.streamIdToClose) {
      await updateDoc(doc(db, 'liveStreams', params.streamIdToClose), {
        isActive: false,
        endedByAdmin: true,
        updatedAt: nowIso,
      }).catch(() => {});
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to persist admin moderation action.' };
  }
}

/**
 * Generates synthetic transition notifications ONLY when the Admin Panel updates `users/{uid}` directly
 * (for example toggling `isVerified`, `liveDisabled`, `partyDisabled`, `isBlocked`, `isSuspended`)
 * without writing a companion notification doc. Deduplication prevents duplicates if a real doc arrives.
 */
export function buildProfileTransitionNotifications(
  prevState: AdminModerationState | null,
  nextState: AdminModerationState,
  userId: string
): NotificationItem[] {
  if (!prevState) return [];
  const generated: NotificationItem[] = [];
  const nowMs = Date.now();
  const bucket = Math.floor(nowMs / 15000);

  // Live Access Restored
  if (prevState.isLiveRestricted && !nextState.isLiveRestricted) {
    const expired = Boolean(nextState.liveRestriction?.hasExpired);
    generated.push({
      id: `local_admin_live_restored_${nowMs}`,
      type: 'access_restored',
      category: 'walletAndSystem',
      recipientId: userId,
      senderId: 'alpha_mate_admin',
      senderName: 'Alpha Mate Admin',
      title: 'YOUR LIVE ACCESS HAS BEEN RESTORED',
      message: expired
        ? 'Your temporary Live streaming suspension has expired. You can now go Live again.'
        : 'Alpha Mate Admin has restored your Live streaming access. You can now broadcast Live again.',
      isRead: false,
      createdAtMs: nowMs,
      timestamp: 'Just now',
      isAdminAction: true,
      actionKind: 'live_restored',
      actionType: 'live_restored',
      actionTitle: 'YOUR LIVE ACCESS HAS BEEN RESTORED',
      actionTaken: expired ? 'Temporary Live Suspension Expired' : 'Live Access Restored by Admin',
      reason: expired
        ? 'Temporary restriction duration completed'
        : 'Admin restored your Live streaming privileges.',
      adminName: nextState.liveRestriction?.adminName || 'Alpha Mate Admin',
      adminLabel: nextState.liveRestriction?.adminLabel || 'Alpha Mate Admin',
      currentStatus: 'Live Access Active',
      restrictionScope: 'live',
      actionDate: formatAdminDateTime(nowMs),
      actionDateMs: nowMs,
      sourceCollection: 'profile_transition',
      dedupKey: `live_restored::${bucket}`,
    });
  }

  // Party Access Restored
  if (prevState.isPartyRestricted && !nextState.isPartyRestricted) {
    const expired = Boolean(nextState.partyRestriction?.hasExpired);
    generated.push({
      id: `local_admin_party_restored_${nowMs}`,
      type: 'access_restored',
      category: 'walletAndSystem',
      recipientId: userId,
      senderId: 'alpha_mate_admin',
      senderName: 'Alpha Mate Admin',
      title: 'YOUR PARTY ACCESS HAS BEEN RESTORED',
      message: expired
        ? 'Your temporary Party Room restriction has expired. You can now create and join Party Rooms again.'
        : 'Alpha Mate Admin has restored your Party Room access. You can now create and join Party Rooms again.',
      isRead: false,
      createdAtMs: nowMs,
      timestamp: 'Just now',
      isAdminAction: true,
      actionKind: 'party_restored',
      actionType: 'party_restored',
      actionTitle: 'YOUR PARTY ACCESS HAS BEEN RESTORED',
      actionTaken: expired ? 'Temporary Party Restriction Expired' : 'Party Access Restored by Admin',
      reason: expired
        ? 'Temporary restriction duration completed'
        : 'Admin restored your Party Room privileges.',
      adminName: nextState.partyRestriction?.adminName || 'Alpha Mate Admin',
      adminLabel: nextState.partyRestriction?.adminLabel || 'Alpha Mate Admin',
      currentStatus: 'Party Access Active',
      restrictionScope: 'party',
      actionDate: formatAdminDateTime(nowMs),
      actionDateMs: nowMs,
      sourceCollection: 'profile_transition',
      dedupKey: `party_restored::${bucket}`,
    });
  }

  // Account Unblocked / Suspension Restored
  if (
    (prevState.isAccountBlocked && !nextState.isAccountBlocked) ||
    (prevState.isAccountSuspended && !nextState.isAccountSuspended)
  ) {
    const wasBlocked = prevState.isAccountBlocked;
    const expired = Boolean(nextState.accountSuspension?.hasExpired);
    const kind: AdminActionKind = wasBlocked ? 'account_unblocked' : 'account_restored';
    generated.push({
      id: `local_admin_account_restored_${nowMs}`,
      type: 'access_restored',
      category: 'walletAndSystem',
      recipientId: userId,
      senderId: 'alpha_mate_admin',
      senderName: 'Alpha Mate Admin',
      title: 'YOUR ACCOUNT ACCESS HAS BEEN RESTORED',
      message: expired
        ? 'Your temporary account suspension has expired and full account access has been restored.'
        : wasBlocked
        ? 'Your account has been unblocked by Alpha Mate Admin. Welcome back!'
        : 'Your account suspension has been removed by Alpha Mate Admin.',
      isRead: false,
      createdAtMs: nowMs,
      timestamp: 'Just now',
      isAdminAction: true,
      actionKind: kind,
      actionType: kind,
      actionTitle: 'YOUR ACCOUNT ACCESS HAS BEEN RESTORED',
      actionTaken: expired
        ? 'Temporary Suspension Expired'
        : wasBlocked
        ? 'Account Unblocked by Admin'
        : 'Account Restored by Admin',
      reason: expired
        ? 'Suspension duration completed'
        : 'Account review completed by Alpha Mate Admin.',
      adminName: 'Alpha Mate Admin',
      adminLabel: 'Alpha Mate Admin',
      currentStatus: nextState.currentAccountStatusLabel,
      restrictionScope: 'account',
      actionDate: formatAdminDateTime(nowMs),
      actionDateMs: nowMs,
      sourceCollection: 'profile_transition',
      dedupKey: `${kind}::${bucket}`,
    });
  }

  // Blue Tick Verification Status Changed
  if (prevState.isVerified !== nextState.isVerified) {
    const granted = nextState.isVerified;
    const kind: AdminActionKind = granted ? 'verification_granted' : 'verification_removed';
    generated.push({
      id: `local_admin_verification_${nowMs}`,
      type: 'verification',
      category: 'walletAndSystem',
      recipientId: userId,
      senderId: 'alpha_mate_admin',
      senderName: nextState.verificationAdminName || 'Alpha Mate Admin',
      title: granted ? 'Blue Tick Respect Badge Approved' : 'Blue Tick Verification Removed',
      message: granted
        ? 'Your Alpha Mate Blue Tick respect badge (Host / Gifter Honor) is now active on your profile.'
        : nextState.verificationReason
        ? `Your Blue Tick respect badge was removed by Admin. Reason: ${nextState.verificationReason}`
        : 'Your Blue Tick respect badge has been removed by Alpha Mate Admin. Your other profile details remain unchanged.',
      isRead: false,
      createdAtMs: nowMs,
      timestamp: 'Just now',
      isAdminAction: true,
      actionKind: kind,
      actionType: kind,
      actionTitle: granted ? 'Blue Tick Respect Badge Approved' : 'Blue Tick Verification Removed',
      actionTaken: granted ? 'Blue Tick Respect Badge Granted' : 'Blue Tick Verification Removed',
      reason:
        nextState.verificationReason ||
        (granted
          ? 'Official Blue Tick respect honor granted by Alpha Mate Admin'
          : 'Verification status updated by Alpha Mate Admin'),
      adminName: nextState.verificationAdminName || 'Alpha Mate Admin',
      adminLabel: nextState.verificationAdminName || 'Alpha Mate Admin',
      currentStatus: granted ? 'Blue Tick Respect Badge Active' : 'No Blue Tick',
      restrictionScope: 'verification',
      verificationStatus: nextState.verificationStatus,
      actionDate: formatAdminDateTime(nowMs),
      actionDateMs: nowMs,
      sourceCollection: 'profile_transition',
      dedupKey: `${kind}::${bucket}`,
    });
  }

  return generated;
}
