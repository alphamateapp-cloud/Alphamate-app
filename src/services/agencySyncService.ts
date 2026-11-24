import { HostAgencyProfile, HostJoinRequest, User } from '../types';
import { parseFirestoreTimestampMs } from './adminModerationService';

export type CanonicalAgencyType = 'coin_seller' | 'host_agency';
export type CanonicalAgencyStatus = 'active' | 'suspended' | 'hold' | 'inactive';
export type CanonicalRequestStatus = 'pending' | 'approved' | 'rejected';

export interface NormalizedWhatsAppInfo {
  e164Digits: string;
  display: string;
  isValid: boolean;
}

export interface NormalizedAgencyRecord {
  agencyId: string;
  type: CanonicalAgencyType;
  status: CanonicalAgencyStatus;
  agencyName: string;
  agencyCode: string;
  agencyTag: string;
  tagColor: string;
  logo: string;
  badge: string;
  ownerUserId: string;
  ownerName: string;
  ownerUniqueId: string;
  ownerAvatar: string;
  whatsappNumber: string;
  whatsappDisplay: string;
  hasValidWhatsApp: boolean;
  agencyBalance: number;
  isPinSet: boolean;
  defaultCommissionRate: number;
  minWeeklyHours: number;
  slogan: string;
  isOfficial: boolean;
  totalHosts: number;
  paymentMethods: string[];
  rates: Array<{ amount: number; bonus: number; price: string }>;
  createdAtMs: number;
  raw: Record<string, any>;
}

export interface ResolvedHostAgencyMembership {
  isActiveMember: boolean;
  status: 'active' | 'pending' | 'rejected' | 'none';
  agencyId: string;
  agencyName: string;
  agencyCode: string;
  agencyTag: string;
  agencyLogo: string;
  ownerUserId: string;
  ownerName: string;
  whatsappNumber: string;
  whatsappDisplay: string;
  hasValidWhatsApp: boolean;
  joinedAt?: string;
  pendingRequest: HostJoinRequest | null;
  latestRejectedRequest: HostJoinRequest | null;
  matchedAgency: HostAgencyProfile | null;
}

/**
 * Normalizes agency type strings written by Super Admin or existing Alpha Mate portals.
 * Keeps Coin Seller Agency and Host Agency strictly separated.
 */
export function normalizeAgencyType(doc: Record<string, any> | null | undefined): CanonicalAgencyType | null {
  if (!doc || typeof doc !== 'object') return null;
  const candidates = [
    doc.type,
    doc.agencyType,
    doc.agency_type,
    doc.category,
    doc.roleType,
  ];
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const cleaned = candidate.trim().toLowerCase().replace(/[\s_-]+/g, ' ');
    if (!cleaned) continue;

    if (
      cleaned === 'coin seller' ||
      cleaned === 'coin seller agency' ||
      cleaned === 'coinseller' ||
      cleaned === 'coinseller agency' ||
      cleaned === 'coin merchant' ||
      cleaned === 'coin agency' ||
      cleaned === 'merchant'
    ) {
      return 'coin_seller';
    }

    if (
      cleaned === 'host agency' ||
      cleaned === 'host' ||
      cleaned === 'hostagency' ||
      cleaned === 'talent agency' ||
      cleaned === 'host talent agency'
    ) {
      return 'host_agency';
    }
  }
  return null;
}

/**
 * Strictly determines whether an agency document is Active.
 * Hold, On Hold, Suspended, Inactive, Pending, Rejected, or disabled flags never qualify as Active.
 */
export function normalizeAgencyStatus(doc: Record<string, any> | null | undefined): CanonicalAgencyStatus {
  if (!doc || typeof doc !== 'object') return 'inactive';
  if (
    doc.isSuspended === true ||
    doc.suspended === true ||
    doc.isBanned === true ||
    doc.isDeleted === true
  ) {
    return 'suspended';
  }
  if (doc.onHold === true || doc.isOnHold === true || doc.hold === true) {
    return 'hold';
  }
  if (doc.isActive === false || doc.enabled === false) {
    return 'inactive';
  }

  const rawStatus = String(doc.status ?? doc.agencyStatus ?? doc.state ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, ' ');

  if (rawStatus === 'active' || rawStatus === 'activated' || rawStatus === 'approved active') {
    return 'active';
  }
  if (rawStatus === 'suspended' || rawStatus === 'banned' || rawStatus === 'blocked' || rawStatus === 'revoked') {
    return 'suspended';
  }
  if (rawStatus === 'hold' || rawStatus === 'on hold' || rawStatus === 'paused') {
    return 'hold';
  }
  return 'inactive';
}

export function isAgencyActive(doc: Record<string, any> | null | undefined): boolean {
  return normalizeAgencyStatus(doc) === 'active';
}

/**
 * Formats and validates an international WhatsApp phone number for wa.me links.
 * Returns isValid: false when empty or fewer than 8 digits so WhatsApp CTA can be hidden/disabled.
 */
export function normalizeWhatsAppNumber(raw: unknown, displayFallback?: unknown): NormalizedWhatsAppInfo {
  const source = typeof raw === 'string' && raw.trim() ? raw.trim() : typeof displayFallback === 'string' ? displayFallback.trim() : '';
  if (!source) {
    return { e164Digits: '', display: '', isValid: false };
  }

  let digits = source.replace(/[^0-9+]/g, '');
  if (digits.startsWith('+')) {
    digits = digits.slice(1);
  } else if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }
  digits = digits.replace(/[^0-9]/g, '');

  // International phone numbers must have between 8 and 15 digits (ITU-T E.164)
  const isValid = digits.length >= 8 && digits.length <= 15 && !/^0+$/.test(digits);
  const display =
    typeof displayFallback === 'string' && displayFallback.trim()
      ? displayFallback.trim()
      : isValid
      ? `+${digits}`
      : source;

  return {
    e164Digits: isValid ? digits : '',
    display: isValid ? display : '',
    isValid,
  };
}

export function buildWhatsAppUrl(rawNumber: unknown, message: string): string | null {
  const info = normalizeWhatsAppNumber(rawNumber);
  if (!info.isValid || !info.e164Digits) return null;
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${info.e164Digits}?text=${encoded}`;
}

export function openExternalWhatsApp(url: string): void {
  if (!url) return;
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  } catch {
    window.location.href = url;
  }
}

export function normalizeRequestStatus(raw: unknown): CanonicalRequestStatus {
  const value = String(raw || '')
    .trim()
    .toLowerCase();
  if (value === 'approved' || value === 'active' || value === 'accepted') {
    return 'approved';
  }
  if (value === 'rejected' || value === 'declined' || value === 'denied' || value === 'cancelled') {
    return 'rejected';
  }
  return 'pending';
}

function firstNonEmptyString(...values: unknown[]): string {
  for (const val of values) {
    if (typeof val === 'string' && val.trim().length > 0) {
      return val.trim();
    }
  }
  return '';
}

function deriveShortTag(name: string, code: string): string {
  const fromCode = code.replace(/^AM[-_]?[A-Z]{2}[-_]?/i, '').replace(/[^A-Za-z0-9]/g, '');
  if (fromCode.length >= 2 && fromCode.length <= 6) {
    return fromCode.toUpperCase();
  }
  const letters = name.replace(/[^A-Za-z0-9]/g, '').slice(0, 5).toUpperCase();
  return letters || 'HOST';
}

/**
 * Normalizes any Firestore `/agencies/{agencyId}` document from either Super Admin or Alpha Mate portal
 * into one canonical structure using `agencyId`.
 */
export function normalizeOfficialAgencyDoc(doc: Record<string, any>): NormalizedAgencyRecord | null {
  if (!doc || typeof doc !== 'object') return null;
  const type = normalizeAgencyType(doc);
  if (!type) return null;

  const status = normalizeAgencyStatus(doc);
  const agencyId = firstNonEmptyString(doc.agencyId, doc.id);
  if (!agencyId) return null;

  const agencyName = firstNonEmptyString(
    doc.agencyName,
    doc.name,
    doc.title,
    type === 'coin_seller' ? 'Official Coin Seller Agency' : 'Official Host Agency'
  );
  const agencyCode = firstNonEmptyString(
    doc.agencyCode,
    doc.code,
    doc.referenceCode,
    agencyId.slice(0, 12).toUpperCase()
  );
  const agencyTag = firstNonEmptyString(
    doc.agencyTag,
    doc.tag,
    deriveShortTag(agencyName, agencyCode)
  ).slice(0, 12);

  const logo = firstNonEmptyString(
    doc.logo,
    doc.logoUrl,
    doc.logoURL,
    doc.photoURL,
    doc.profileImage,
    doc.profileImageUrl,
    doc.avatar,
    doc.imageUrl,
    doc.image
  );

  const ownerUserId = firstNonEmptyString(
    doc.ownerUserId,
    doc.ownerId,
    doc.ownerUid,
    doc.managerUserId,
    doc.managerId,
    doc.managerUid,
    doc.representativeUserId,
    doc.representativeUid,
    doc.userId,
    doc.uid
  );

  const ownerName = firstNonEmptyString(
    doc.ownerName,
    doc.managerName,
    doc.ownerDisplayName,
    doc.representativeName,
    doc.contactName,
    doc.owner?.displayName,
    doc.owner?.name
  );

  const ownerUniqueId = firstNonEmptyString(
    doc.ownerUniqueId,
    doc.ownerAlphaId,
    doc.owner?.uniqueId
  );

  const ownerAvatar = firstNonEmptyString(
    doc.ownerAvatar,
    doc.ownerPhotoURL,
    doc.owner?.avatar,
    doc.owner?.photoURL
  );

  const rawWa = firstNonEmptyString(
    doc.whatsappNumber,
    doc.whatsapp,
    doc.whatsappPhone,
    doc.whatsAppNumber,
    doc.whatsApp,
    doc.contactWhatsapp,
    doc.phoneNumber,
    doc.phone,
    doc.contactNumber
  );
  const rawWaDisplay = firstNonEmptyString(doc.whatsappDisplay, rawWa);
  const waInfo = normalizeWhatsAppNumber(rawWa, rawWaDisplay);

  const totalHosts = Math.max(
    0,
    Number(
      doc.totalHosts ??
        doc.assignedHostsCount ??
        doc.totalAssignedHosts ??
        doc.hostsCount ??
        doc.activeHostsCount ??
        doc.hostCount ??
        doc.memberCount ??
        0
    ) || 0
  );

  const createdAtMs =
    parseFirestoreTimestampMs(doc.createdAtMs) ??
    parseFirestoreTimestampMs(doc.createdAt) ??
    parseFirestoreTimestampMs(doc.activatedAt) ??
    parseFirestoreTimestampMs(doc.updatedAt) ??
    0;

  const paymentMethods = Array.isArray(doc.paymentMethods)
    ? doc.paymentMethods.filter((m: unknown) => typeof m === 'string' && m.trim()).map((m: string) => m.trim())
    : [];

  const rates = Array.isArray(doc.rates)
    ? doc.rates
        .filter((r: any) => r && typeof r === 'object' && Number(r.amount) > 0)
        .map((r: any) => ({
          amount: Number(r.amount) || 0,
          bonus: Number(r.bonus) || 0,
          price: String(r.price || ''),
        }))
    : [];

  return {
    agencyId,
    type,
    status,
    agencyName,
    agencyCode,
    agencyTag,
    tagColor: firstNonEmptyString(doc.tagColor, '#F59E0B'),
    logo,
    badge: firstNonEmptyString(
      doc.badge,
      type === 'coin_seller' ? 'Official Coin Seller Agency' : 'Official Host Agency'
    ),
    ownerUserId,
    ownerName,
    ownerUniqueId,
    ownerAvatar,
    whatsappNumber: waInfo.e164Digits ? `+${waInfo.e164Digits}` : '',
    whatsappDisplay: waInfo.display,
    hasValidWhatsApp: waInfo.isValid,
    agencyBalance: Math.max(0, Math.floor(Number(doc.agencyBalance ?? doc.coinBalance ?? doc.coins ?? doc.coinStock ?? doc.stock ?? 0) || 0)),
    isPinSet: Boolean(doc.isPinSet),
    defaultCommissionRate: Math.max(0, Math.min(80, Number(doc.defaultCommissionRate ?? doc.commissionRate ?? 15) || 15)),
    minWeeklyHours: Math.max(0, Number(doc.minWeeklyHours ?? 15) || 15),
    slogan: firstNonEmptyString(
      doc.slogan,
      doc.description,
      doc.bio,
      type === 'coin_seller'
        ? 'Officially activated Alpha Mate Coin Seller Agency.'
        : 'Officially activated Alpha Mate Host Agency.'
    ),
    isOfficial: doc.isOfficial !== false,
    totalHosts,
    paymentMethods,
    rates,
    createdAtMs,
    raw: doc,
  };
}

/**
 * Normalizes a Firestore `/agency_requests/{requestId}` document written by the app or Super Admin.
 */
export function normalizeHostAgencyRequestDoc(doc: Record<string, any>): HostJoinRequest | null {
  if (!doc || typeof doc !== 'object') return null;
  const id = firstNonEmptyString(doc.id, doc.requestId);
  const applicantUid = firstNonEmptyString(
    doc.applicantUid,
    doc.userId,
    doc.applicantUserId,
    doc.uid,
    doc.userDocId
  );
  const agencyId = firstNonEmptyString(doc.agencyId, doc.targetAgencyId);
  if (!id || !applicantUid || !agencyId) return null;

  const createdAtMs =
    parseFirestoreTimestampMs(doc.createdAtMs) ??
    parseFirestoreTimestampMs(doc.createdAt) ??
    parseFirestoreTimestampMs(doc.appliedAt) ??
    parseFirestoreTimestampMs(doc.submittedAt) ??
    parseFirestoreTimestampMs(doc.timestamp) ??
    Date.now();

  const createdAtIso = new Date(createdAtMs).toISOString();
  const appliedDate = firstNonEmptyString(
    doc.appliedDate,
    new Date(createdAtMs).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  );

  const reviewedMs = parseFirestoreTimestampMs(doc.reviewedAt);

  return {
    id,
    applicantUid,
    userId: applicantUid,
    userDocId: firstNonEmptyString(doc.userDocId, applicantUid),
    uniqueId: firstNonEmptyString(doc.uniqueId, doc.applicantUniqueId, applicantUid.slice(0, 10)),
    displayName: firstNonEmptyString(doc.displayName, doc.applicantName, 'Alpha Mate Creator'),
    username: firstNonEmptyString(doc.username, doc.applicantUsername, 'creator'),
    avatar: firstNonEmptyString(doc.avatar, doc.applicantAvatar),
    level: Math.max(0, Number(doc.level ?? doc.applicantLevel ?? 1) || 1),
    agencyId,
    agencyName: firstNonEmptyString(doc.agencyName, doc.targetAgencyName, 'Official Host Agency'),
    agencyCode: firstNonEmptyString(doc.agencyCode, doc.code),
    agencyTag: firstNonEmptyString(doc.agencyTag, doc.tag),
    agencyOwnerId: firstNonEmptyString(doc.agencyOwnerId, doc.ownerUserId, doc.ownerId),
    agencyType: firstNonEmptyString(doc.agencyType, doc.requestedAgencyType, 'Host Agency'),
    whatsapp: firstNonEmptyString(doc.whatsapp, doc.whatsappNumber, doc.phoneNumber),
    experience: firstNonEmptyString(doc.experience, doc.note, 'Host Agency joining request'),
    expectedHours: Math.max(0, Number(doc.expectedHours ?? 15) || 15),
    appliedDate,
    createdAt: createdAtIso,
    createdAtMs,
    reviewedAt: reviewedMs ? new Date(reviewedMs).toISOString() : undefined,
    reviewedBy: firstNonEmptyString(doc.reviewedBy, doc.adminName) || undefined,
    rejectionReason: firstNonEmptyString(doc.rejectionReason, doc.rejectReason, doc.reason, doc.adminNote) || undefined,
    status: normalizeRequestStatus(doc.status),
  };
}

/**
 * Resolves the signed-in user's real-time Host Agency membership strictly from Firestore user profile
 * and Super Admin-reviewed `agency_requests`. Pending or Rejected requests NEVER activate membership.
 */
export function resolveUserHostAgencyMembership(
  user: User,
  myHostRequests: HostJoinRequest[],
  activeHostAgencies: HostAgencyProfile[]
): ResolvedHostAgencyMembership {
  const sortedRequests = [...myHostRequests].sort(
    (a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0)
  );
  const pendingRequest = sortedRequests.find((r) => r.status === 'pending') || null;
  const latestApprovedRequest = sortedRequests.find((r) => r.status === 'approved') || null;
  const latestRejectedRequest = sortedRequests.find((r) => r.status === 'rejected') || null;

  const rawUserStatus = String(user.hostAgencyStatus || '')
    .trim()
    .toLowerCase();

  const isExplicitlyRejectedOrRemoved =
    rawUserStatus === 'rejected' ||
    rawUserStatus === 'removed' ||
    rawUserStatus === 'revoked' ||
    rawUserStatus === 'suspended' ||
    rawUserStatus === 'inactive' ||
    rawUserStatus === 'none';

  const isExplicitlyPending = rawUserStatus === 'pending' || rawUserStatus === 'requested';

  const hasApprovedUserFields =
    Boolean(user.agencyId) &&
    !isExplicitlyRejectedOrRemoved &&
    !isExplicitlyPending &&
    (rawUserStatus === 'active' ||
      rawUserStatus === 'approved' ||
      user.isAgencyHost === true ||
      Boolean(user.agencyName) ||
      Boolean(user.agencyTag));

  // If Super Admin approved the agency_requests doc even if user doc sync is still propagating
  const hasApprovedRequestWithoutNewerPendingOrReject =
    Boolean(latestApprovedRequest) &&
    !isExplicitlyRejectedOrRemoved &&
    !isExplicitlyPending &&
    (!latestRejectedRequest ||
      (latestApprovedRequest!.createdAtMs || 0) >= (latestRejectedRequest.createdAtMs || 0));

  const isActiveMember = hasApprovedUserFields || hasApprovedRequestWithoutNewerPendingOrReject;

  if (isActiveMember) {
    const resolvedAgencyId = user.agencyId || latestApprovedRequest?.agencyId || '';
    const matchedAgency =
      activeHostAgencies.find((a) => a.agencyId === resolvedAgencyId) || null;

    const agencyName =
      user.agencyName ||
      matchedAgency?.agencyName ||
      latestApprovedRequest?.agencyName ||
      'Official Host Agency';
    const agencyCode =
      user.agencyCode ||
      matchedAgency?.agencyCode ||
      latestApprovedRequest?.agencyCode ||
      resolvedAgencyId;
    const agencyTag =
      user.agencyTag ||
      matchedAgency?.agencyTag ||
      latestApprovedRequest?.agencyTag ||
      deriveShortTag(agencyName, agencyCode);
    const ownerUserId =
      user.agencyOwnerId ||
      matchedAgency?.ownerUserId ||
      latestApprovedRequest?.agencyOwnerId ||
      '';
    const ownerName =
      user.agencyOwnerName ||
      matchedAgency?.ownerName ||
      'Agency Owner';
    const waInfo = normalizeWhatsAppNumber(
      matchedAgency?.whatsappNumber,
      matchedAgency?.whatsappDisplay
    );

    return {
      isActiveMember: true,
      status: 'active',
      agencyId: resolvedAgencyId,
      agencyName,
      agencyCode,
      agencyTag,
      agencyLogo: matchedAgency?.logo || '',
      ownerUserId,
      ownerName,
      whatsappNumber: waInfo.e164Digits ? `+${waInfo.e164Digits}` : '',
      whatsappDisplay: waInfo.display,
      hasValidWhatsApp: waInfo.isValid,
      joinedAt: user.agencyJoinedAt || latestApprovedRequest?.reviewedAt || latestApprovedRequest?.appliedDate,
      pendingRequest,
      latestRejectedRequest,
      matchedAgency,
    };
  }

  if (pendingRequest || isExplicitlyPending) {
    return {
      isActiveMember: false,
      status: 'pending',
      agencyId: pendingRequest?.agencyId || '',
      agencyName: pendingRequest?.agencyName || '',
      agencyCode: pendingRequest?.agencyCode || '',
      agencyTag: pendingRequest?.agencyTag || '',
      agencyLogo: '',
      ownerUserId: pendingRequest?.agencyOwnerId || '',
      ownerName: '',
      whatsappNumber: '',
      whatsappDisplay: '',
      hasValidWhatsApp: false,
      pendingRequest,
      latestRejectedRequest,
      matchedAgency: null,
    };
  }

  if (latestRejectedRequest || rawUserStatus === 'rejected') {
    return {
      isActiveMember: false,
      status: 'rejected',
      agencyId: '',
      agencyName: latestRejectedRequest?.agencyName || '',
      agencyCode: latestRejectedRequest?.agencyCode || '',
      agencyTag: '',
      agencyLogo: '',
      ownerUserId: '',
      ownerName: '',
      whatsappNumber: '',
      whatsappDisplay: '',
      hasValidWhatsApp: false,
      pendingRequest: null,
      latestRejectedRequest,
      matchedAgency: null,
    };
  }

  return {
    isActiveMember: false,
    status: 'none',
    agencyId: '',
    agencyName: '',
    agencyCode: '',
    agencyTag: '',
    agencyLogo: '',
    ownerUserId: '',
    ownerName: '',
    whatsappNumber: '',
    whatsappDisplay: '',
    hasValidWhatsApp: false,
    pendingRequest: null,
    latestRejectedRequest: null,
    matchedAgency: null,
  };
}
