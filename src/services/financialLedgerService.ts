/**
 * Authoritative financial ledger calculations, canonical agency balance resolution,
 * deterministic transaction IDs, and validation helpers for Alpha Mate.
 *
 * ZERO Math.max() across legacy agency balance aliases — `agencyBalance` is always
 * the single canonical source of truth when present, with safe fallback to legacy
 * fields only when `agencyBalance` is missing on an unmigrated record.
 */

export const GIFT_RECIPIENT_EARNING_RATE = 0.6;
export const GIFT_PLATFORM_SHARE_RATE = 0.4;
export const MAX_SINGLE_GIFT_TOTAL_COINS = 50_000_000;
export const MAX_SINGLE_AGENCY_TRANSFER_COINS = 1_000_000_000;

export interface SixtyFortyGiftSplit {
  unitCoins: number;
  quantity: number;
  totalCoins: number;
  recipientEarnings: number; // 60% -> Earnings Wallet (diamonds)
  platformShare: number; // 40% -> Platform share (coins)
}

export interface AgencyTransferValidationInput {
  agencyId: string;
  agencyDoc: Record<string, any> | null | undefined;
  callerUid: string;
  recipientUid: string;
  recipientExists: boolean;
  amount: number;
}

export interface AgencyTransferValidationResult {
  valid: boolean;
  error?: string;
  safeAmount: number;
  currentAgencyBalance: number;
  nextAgencyBalance: number;
}

/**
 * Resolves the authoritative Coin Seller Agency balance from a Firestore document.
 * Strict canonical precedence:
 *   1. `agencyBalance` (canonical live balance)
 *   2. `coinBalance` (admin panel alias, fallback only when `agencyBalance` is undefined/null)
 *   3. `coins`
 *   4. `coinStock` (legacy)
 *   5. `stock` (legacy)
 *
 * NEVER takes Math.max() across fields, preventing stale legacy aliases from restoring
 * an old balance after deduction.
 */
export function resolveCanonicalAgencyBalance(doc: Record<string, any> | null | undefined): number {
  if (!doc || typeof doc !== 'object') return 0;
  const candidates = [doc.agencyBalance, doc.coinBalance, doc.coins, doc.coinStock, doc.stock];
  for (const raw of candidates) {
    if (raw === undefined || raw === null || raw === '') continue;
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.floor(parsed));
    }
  }
  return 0;
}

/**
 * Builds the exact Firestore update payload for an agency balance write.
 * Always writes the canonical `agencyBalance` plus synchronized `coinBalance` and `coins`,
 * and also updates legacy `coinStock`/`stock` if those keys already exist on the document
 * so no stale balance alias can ever survive on disk.
 */
export function buildSynchronizedAgencyBalanceUpdate(
  existingDoc: Record<string, any>,
  nextBalance: number,
  extraFields?: Record<string, any>
): Record<string, any> {
  const safeBalance = Math.max(0, Math.floor(Number(nextBalance) || 0));
  const payload: Record<string, any> = {
    agencyBalance: safeBalance,
    coinBalance: safeBalance,
    coins: safeBalance,
    ...(extraFields || {}),
  };
  if ('coinStock' in existingDoc) {
    payload.coinStock = safeBalance;
  }
  if ('stock' in existingDoc) {
    payload.stock = safeBalance;
  }
  return payload;
}

/**
 * Checks whether a Firestore agency document is owned by `uid`.
 */
export function isAgencyOwnedByUid(doc: Record<string, any> | null | undefined, uid: string): boolean {
  if (!doc || !uid) return false;
  const ownerCandidates = [
    doc.ownerUserId,
    doc.ownerUid,
    doc.ownerId,
    doc.ownerAuthUid,
    doc.managerUserId,
    doc.managerUid,
  ];
  return ownerCandidates.some((v) => typeof v === 'string' && v.trim() === uid);
}

/**
 * Checks whether an agency document is a Coin Seller agency.
 */
export function isCoinSellerAgencyDoc(doc: Record<string, any> | null | undefined): boolean {
  if (!doc || typeof doc !== 'object') return false;
  const raw = String(doc.type ?? doc.agencyType ?? doc.agency_type ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, ' ');
  return (
    raw === 'coin seller' ||
    raw === 'coin seller agency' ||
    raw === 'coinseller' ||
    raw === 'coinseller agency' ||
    raw === 'coin agency' ||
    raw === 'coin merchant'
  );
}

/**
 * Checks whether an agency document is Active (not Hold, Suspended, Banned, or Deleted).
 */
export function isActiveAgencyDoc(doc: Record<string, any> | null | undefined): boolean {
  if (!doc || typeof doc !== 'object') return false;
  if (
    doc.isSuspended === true ||
    doc.suspended === true ||
    doc.isBanned === true ||
    doc.isDeleted === true ||
    doc.onHold === true ||
    doc.isOnHold === true ||
    doc.isActive === false
  ) {
    return false;
  }
  const status = String(doc.status ?? doc.agencyStatus ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, ' ');
  return status === 'active' || status === 'activated' || status === 'approved active';
}

/**
 * Validates every invariant required before executing an atomic Agency Coin Transfer.
 */
export function validateAgencyTransfer(
  input: AgencyTransferValidationInput
): AgencyTransferValidationResult {
  const safeAmount = Math.floor(Number(input.amount));
  if (!Number.isFinite(Number(input.amount)) || Number(input.amount) !== safeAmount || safeAmount <= 0) {
    return {
      valid: false,
      error: 'Transfer amount must be a positive whole number of coins.',
      safeAmount: 0,
      currentAgencyBalance: 0,
      nextAgencyBalance: 0,
    };
  }
  if (safeAmount > MAX_SINGLE_AGENCY_TRANSFER_COINS) {
    return {
      valid: false,
      error: 'Transfer amount exceeds the maximum single-transaction limit.',
      safeAmount: 0,
      currentAgencyBalance: 0,
      nextAgencyBalance: 0,
    };
  }
  if (!input.callerUid) {
    return {
      valid: false,
      error: 'Authentication required to transfer agency coins.',
      safeAmount,
      currentAgencyBalance: 0,
      nextAgencyBalance: 0,
    };
  }
  if (!input.agencyId || !input.agencyDoc) {
    return {
      valid: false,
      error: 'Official Coin Seller Agency record not found.',
      safeAmount,
      currentAgencyBalance: 0,
      nextAgencyBalance: 0,
    };
  }
  if (!isAgencyOwnedByUid(input.agencyDoc, input.callerUid)) {
    return {
      valid: false,
      error: 'Unauthorized: only the approved Coin Seller Agency owner can transfer coins.',
      safeAmount,
      currentAgencyBalance: 0,
      nextAgencyBalance: 0,
    };
  }
  if (!isCoinSellerAgencyDoc(input.agencyDoc)) {
    return {
      valid: false,
      error: 'Only Coin Seller Agencies can transfer coin stock.',
      safeAmount,
      currentAgencyBalance: 0,
      nextAgencyBalance: 0,
    };
  }
  if (!isActiveAgencyDoc(input.agencyDoc)) {
    return {
      valid: false,
      error: 'This agency is currently inactive, on hold, or suspended.',
      safeAmount,
      currentAgencyBalance: 0,
      nextAgencyBalance: 0,
    };
  }
  if (!input.recipientUid || !input.recipientExists) {
    return {
      valid: false,
      error: 'Recipient Alpha Mate account was not found in Firestore.',
      safeAmount,
      currentAgencyBalance: 0,
      nextAgencyBalance: 0,
    };
  }

  const currentAgencyBalance = resolveCanonicalAgencyBalance(input.agencyDoc);
  if (safeAmount > currentAgencyBalance) {
    return {
      valid: false,
      error: `Insufficient agency stock. Available: ${currentAgencyBalance.toLocaleString()} Coins.`,
      safeAmount,
      currentAgencyBalance,
      nextAgencyBalance: currentAgencyBalance,
    };
  }

  const nextAgencyBalance = currentAgencyBalance - safeAmount;
  if (nextAgencyBalance < 0) {
    return {
      valid: false,
      error: 'Transfer rejected: agency balance cannot become negative.',
      safeAmount,
      currentAgencyBalance,
      nextAgencyBalance: currentAgencyBalance,
    };
  }

  return {
    valid: true,
    safeAmount,
    currentAgencyBalance,
    nextAgencyBalance,
  };
}

/**
 * Computes the exact authoritative 60% Recipient Earnings / 40% Platform Share split.
 * Invariant: recipientEarnings + platformShare === totalCoins.
 *   100 coins     -> 60 earnings / 40 platform
 *   1,000 coins   -> 600 earnings / 400 platform
 *   10,000 coins  -> 6,000 earnings / 4,000 platform
 *   100,000 coins -> 60,000 earnings / 40,000 platform
 */
export function calculateSixtyFortyGiftSplit(
  rawUnitCoins: number,
  rawQuantity = 1
): SixtyFortyGiftSplit {
  const unitCoins = Math.floor(Number(rawUnitCoins));
  const quantity = Math.floor(Number(rawQuantity));
  if (!Number.isFinite(unitCoins) || unitCoins < 1) {
    throw new Error('Gift coin value must be at least 1 coin.');
  }
  if (!Number.isFinite(quantity) || quantity < 1 || quantity > 9999) {
    throw new Error('Gift quantity must be between 1 and 9999.');
  }
  const totalCoins = unitCoins * quantity;
  if (totalCoins > MAX_SINGLE_GIFT_TOTAL_COINS) {
    throw new Error('Gift transaction exceeds single-send coin limit.');
  }
  const recipientEarnings = Math.round(totalCoins * GIFT_RECIPIENT_EARNING_RATE);
  const platformShare = totalCoins - recipientEarnings;
  return {
    unitCoins,
    quantity,
    totalCoins,
    recipientEarnings,
    platformShare,
  };
}

/**
 * Generates a Firestore-safe unique transaction ID (<= 128 chars, [a-zA-Z0-9_-]).
 * If an explicit idempotency key is provided, deterministically sanitizes it so retries
 * resolve to the exact same Firestore document ID.
 */
export function buildIdempotentTxId(prefix: string, idempotencyKey?: string): string {
  const cleanPrefix = String(prefix || 'tx').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20) || 'tx';
  if (idempotencyKey && idempotencyKey.trim()) {
    const cleanKey = idempotencyKey.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    const prefixed = cleanKey.startsWith(`${cleanPrefix}_`) ? cleanKey : `${cleanPrefix}_${cleanKey}`;
    return prefixed.slice(0, 120);
  }
  const rand =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 14)
      : `${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 8)}`;
  return `${cleanPrefix}_${Date.now()}_${rand}`.slice(0, 120);
}
