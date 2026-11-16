import * as crypto from 'node:crypto';
import { App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { Firestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as logger from 'firebase-functions/logger';
import {
  AuthUserRecordSummary,
  createResendMailer,
  EmailOtpServiceEngine,
  OtpAuthAdapter,
  OtpChallengeStore,
  StoredOtpChallengeRecord,
  timingSafeHexEqual,
} from './emailOtpCore';

/**
 * Firebase Secret Manager binding for Resend API key.
 * Configure via CLI:
 *   firebase functions:secrets:set RESEND_API_KEY
 */
export const RESEND_API_KEY = defineSecret('RESEND_API_KEY');

const OTP_CHALLENGES_COLLECTION = 'emailOtpChallenges';
const DEVICE_SWITCH_SESSIONS_COLLECTION = 'deviceSwitchSessions';
const EXPIRED_CHALLENGE_RETENTION_MS = 24 * 60 * 60 * 1000; // Purge challenges > 24h old
const DEVICE_SWITCH_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90-day multi-account device session

function createFirestoreOtpChallengeStore(db: Firestore): OtpChallengeStore {
  return {
    async runAtomic<T>(
      docId: string,
      fn: (
        existing: StoredOtpChallengeRecord | null,
        save: (record: StoredOtpChallengeRecord) => void
      ) => Promise<T> | T
    ): Promise<T> {
      const docRef = db.collection(OTP_CHALLENGES_COLLECTION).doc(docId);
      return db.runTransaction(async (tx) => {
        const snap = await tx.get(docRef);
        const existing = snap.exists ? (snap.data() as StoredOtpChallengeRecord) : null;
        let pendingWrite: StoredOtpChallengeRecord | null = null;
        const result = await fn(existing, (record) => {
          pendingWrite = record;
        });
        if (pendingWrite) {
          tx.set(docRef, pendingWrite);
        }
        return result;
      });
    },
    async deleteRecord(docId: string): Promise<void> {
      await db.collection(OTP_CHALLENGES_COLLECTION).doc(docId).delete().catch(() => {});
    },
  };
}

function createFirebaseAdminOtpAuthAdapter(app: App, db: Firestore): OtpAuthAdapter {
  const adminAuth = getAuth(app);

  const toSummary = (u: {
    uid: string;
    email?: string;
    emailVerified: boolean;
    displayName?: string;
    disabled: boolean;
    providerData?: Array<{ providerId?: string }>;
  }): AuthUserRecordSummary => ({
    uid: u.uid,
    email: (u.email || '').trim().toLowerCase(),
    emailVerified: Boolean(u.emailVerified),
    hasPasswordProvider: Boolean(u.providerData?.some((p) => p.providerId === 'password')),
    displayName: u.displayName || undefined,
    disabled: Boolean(u.disabled),
  });

  return {
    async getUserByUid(uid: string): Promise<AuthUserRecordSummary | null> {
      try {
        const userRecord = await adminAuth.getUser(uid);
        return toSummary(userRecord);
      } catch (err: unknown) {
        const code = (err as { code?: string })?.code;
        if (code === 'auth/user-not-found') return null;
        throw err;
      }
    },

    async getUserByEmail(email: string): Promise<AuthUserRecordSummary | null> {
      try {
        const userRecord = await adminAuth.getUserByEmail(email);
        return toSummary(userRecord);
      } catch (err: unknown) {
        const code = (err as { code?: string })?.code;
        if (code === 'auth/user-not-found') return null;
        throw err;
      }
    },

    async markEmailVerified(uid: string, email: string, verifiedAtIso: string): Promise<void> {
      await adminAuth.updateUser(uid, { emailVerified: true });
      await db
        .collection('users')
        .doc(uid)
        .set(
          {
            id: uid,
            email,
            isVerified: true,
            emailOtpVerified: true,
            emailOtpVerifiedAt: verifiedAtIso,
            updatedAt: verifiedAtIso,
          },
          { merge: true }
        )
        .catch((err) => {
          logger.warn('Non-fatal Firestore user verification metadata sync warning', {
            uid,
            err: err instanceof Error ? err.message : String(err),
          });
        });
    },

    async createLoginCustomToken(uid: string): Promise<string> {
      return adminAuth.createCustomToken(uid, { emailOtpVerified: true });
    },

    async upsertVerifiedPasswordUser(
      email: string,
      password: string,
      verifiedAtIso: string
    ): Promise<{ uid: string; email: string; customToken: string }> {
      let uid: string;
      let existingRecord = null;
      try {
        existingRecord = await adminAuth.getUserByEmail(email);
      } catch (err: unknown) {
        const code = (err as { code?: string })?.code;
        if (code !== 'auth/user-not-found') throw err;
      }

      if (existingRecord) {
        // Same email already exists (e.g. from Continue with Google or unfinished registration):
        // attach password + emailVerified onto the EXACT SAME UID so Google & Password share one ID.
        await adminAuth.updateUser(existingRecord.uid, {
          password,
          emailVerified: true,
        });
        uid = existingRecord.uid;
      } else {
        const created = await adminAuth.createUser({
          email,
          password,
          emailVerified: true,
        });
        uid = created.uid;
      }

      const existingProfileSnap = await db.collection('users').doc(uid).get().catch(() => null);
      const alreadyCompleted = Boolean(existingProfileSnap?.exists && existingProfileSnap.data()?.profileCompleted);

      await db
        .collection('users')
        .doc(uid)
        .set(
          {
            id: uid,
            email,
            isVerified: true,
            hasPassword: true,
            profileCompleted: alreadyCompleted,
            emailOtpVerified: true,
            emailOtpVerifiedAt: verifiedAtIso,
            updatedAt: verifiedAtIso,
          },
          { merge: true }
        )
        .catch((err) => {
          logger.warn('Non-fatal Firestore user password metadata sync warning', {
            uid,
            err: err instanceof Error ? err.message : String(err),
          });
        });

      const customToken = await adminAuth.createCustomToken(uid, { emailOtpVerified: true });
      return { uid, email, customToken };
    },
  };
}

export function createEmailOtpCloudFunctions(app: App, db: Firestore) {
  const adminAuth = getAuth(app);

  const buildEngine = () =>
    new EmailOtpServiceEngine({
      store: createFirestoreOtpChallengeStore(db),
      authAdapter: createFirebaseAdminOtpAuthAdapter(app, db),
      mailer: createResendMailer(() => RESEND_API_KEY.value()),
    });

  const callableWithSecretOptions = {
    secrets: [RESEND_API_KEY],
    cors: true,
    region: 'us-central1',
    memory: '256MiB' as const,
    timeoutSeconds: 30,
  };

  const callableNoSecretOptions = {
    cors: true,
    region: 'us-central1',
    memory: '256MiB' as const,
    timeoutSeconds: 30,
  };

  /**
   * Callable Cloud Function: sendPreSignupEmailOtp
   * Step 1 of Email Sign-Up: Sends a 6-digit OTP from no-reply@alphamate.app BEFORE password creation.
   */
  const sendPreSignupEmailOtp = onCall(callableWithSecretOptions, async (request) => {
    const data = (request.data || {}) as { email?: string };
    const engine = buildEngine();
    const res = await engine.sendPreSignupOtp({ email: String(data.email || '') });
    if (!res.success) {
      logger.warn('sendPreSignupEmailOtp rejected', { code: res.code });
    } else {
      logger.info('sendPreSignupEmailOtp dispatched via Resend', { emailMasked: res.emailMasked });
    }
    return res;
  });

  /**
   * Callable Cloud Function: verifyPreSignupEmailOtp
   * Step 2 of Email Sign-Up: Verifies 6-digit OTP and returns a short-lived registrationTicket.
   */
  const verifyPreSignupEmailOtp = onCall(callableWithSecretOptions, async (request) => {
    const data = (request.data || {}) as {
      email?: string;
      challengeToken?: string;
      otp?: string;
    };
    const engine = buildEngine();
    return engine.verifyPreSignupOtp({
      email: String(data.email || ''),
      challengeToken: String(data.challengeToken || ''),
      otp: String(data.otp || ''),
    });
  });

  /**
   * Callable Cloud Function: completePreSignupWithPassword
   * Step 3 of Email Sign-Up: Consumes registrationTicket and creates/updates the verified password user.
   */
  const completePreSignupWithPassword = onCall(callableWithSecretOptions, async (request) => {
    const data = (request.data || {}) as {
      email?: string;
      password?: string;
      registrationTicket?: string;
    };
    const engine = buildEngine();
    const res = await engine.completePreSignupWithPassword({
      email: String(data.email || ''),
      password: String(data.password || ''),
      registrationTicket: String(data.registrationTicket || ''),
    });
    if (res.success) {
      logger.info('completePreSignupWithPassword succeeded', { uid: res.uid });
    } else {
      logger.warn('completePreSignupWithPassword failed', { code: res.code });
    }
    return res;
  });

  /**
   * Callable Cloud Function: setAuthenticatedUserPassword
   * Allows a Google-authenticated user completing their In-App Profile Registration to bind a password
   * onto their exact same Firebase Auth UID so they can sign in next time with either Password or Google.
   */
  const setAuthenticatedUserPassword = onCall(callableNoSecretOptions, async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Please sign in first to set your password.');
    }
    const data = (request.data || {}) as { password?: string };
    const password = typeof data.password === 'string' ? data.password : '';
    if (password.length < 6 || password.length > 128) {
      return {
        success: false,
        code: 'WEAK_PASSWORD',
        error: 'Password must be between 6 and 128 characters.',
      };
    }

    const uid = request.auth.uid;
    const nowIso = new Date().toISOString();
    await adminAuth.updateUser(uid, {
      password,
      emailVerified: true,
    });

    await db
      .collection('users')
      .doc(uid)
      .set(
        {
          id: uid,
          hasPassword: true,
          isVerified: true,
          updatedAt: nowIso,
        },
        { merge: true }
      )
      .catch(() => {});

    return { success: true, uid };
  });

  /**
   * Callable Cloud Function: registerDeviceSwitchSession
   * Registers a hashed 90-day multi-account switch session for instant 1-tap switching across up to 5 accounts.
   */
  const registerDeviceSwitchSession = onCall(callableNoSecretOptions, async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Authentication required to register account switch slot.');
    }
    const uid = request.auth.uid;
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const sessionId = `dsw_${crypto.randomBytes(16).toString('hex')}`;
    const switchToken = crypto.randomBytes(24).toString('hex');
    const salt = crypto.randomBytes(16).toString('hex');
    const tokenHash = crypto
      .createHmac('sha256', salt)
      .update(`${sessionId}:${uid}:${switchToken}`)
      .digest('hex');

    await db.collection(DEVICE_SWITCH_SESSIONS_COLLECTION).doc(sessionId).set({
      sessionId,
      uid,
      salt,
      tokenHash,
      createdAtMs: nowMs,
      expiresAtMs: nowMs + DEVICE_SWITCH_TTL_MS,
      lastUsedAtMs: nowMs,
      updatedAt: nowIso,
    });

    return {
      success: true,
      uid,
      sessionId,
      switchTicket: switchToken,
      switchToken,
    };
  });

  /**
   * Callable Cloud Function: switchDeviceAccount
   * Validates a stored device switch token in constant time and mints a Firebase customToken for 1-tap switching.
   */
  const switchDeviceAccount = onCall(callableNoSecretOptions, async (request) => {
    const data = (request.data || {}) as {
      uid?: string;
      sessionId?: string;
      switchTicket?: string;
      switchToken?: string;
    };
    const requestedUid = String(data.uid || '').trim();
    const sessionId = String(data.sessionId || '').trim();
    const switchToken = String(data.switchTicket || data.switchToken || '').trim();

    if (!sessionId || !switchToken || !/^dsw_[a-f0-9]{32}$/.test(sessionId)) {
      return { success: false, code: 'INVALID_SWITCH_SESSION', error: 'Invalid account switch session.' };
    }

    const docRef = db.collection(DEVICE_SWITCH_SESSIONS_COLLECTION).doc(sessionId);
    const snap = await docRef.get();
    if (!snap.exists) {
      return { success: false, code: 'SWITCH_SESSION_NOT_FOUND', error: 'Saved session expired. Please sign in once again.' };
    }

    const record = snap.data() as {
      uid: string;
      salt: string;
      tokenHash: string;
      expiresAtMs: number;
    };
    const uid = record.uid;
    const nowMs = Date.now();
    if (!uid || (requestedUid && record.uid !== requestedUid) || nowMs > Number(record.expiresAtMs || 0)) {
      return { success: false, code: 'SWITCH_SESSION_EXPIRED', error: 'Saved session expired. Please sign in once again.' };
    }

    const candidateHash = crypto
      .createHmac('sha256', record.salt)
      .update(`${sessionId}:${uid}:${switchToken}`)
      .digest('hex');

    if (!timingSafeHexEqual(candidateHash, record.tokenHash)) {
      return { success: false, code: 'SWITCH_TOKEN_MISMATCH', error: 'Invalid switch credentials.' };
    }

    const userRecord = await adminAuth.getUser(uid).catch(() => null);
    if (!userRecord || userRecord.disabled) {
      return { success: false, code: 'ACCOUNT_UNAVAILABLE', error: 'Account is no longer available.' };
    }

    const nowIso = new Date(nowMs).toISOString();
    await docRef
      .set(
        {
          lastUsedAtMs: nowMs,
          expiresAtMs: nowMs + DEVICE_SWITCH_TTL_MS,
          updatedAt: nowIso,
        },
        { merge: true }
      )
      .catch(() => {});

    const customToken = await adminAuth.createCustomToken(uid, { emailOtpVerified: true });
    return {
      success: true,
      uid,
      customToken,
    };
  });

  /**
   * Callable Cloud Function: sendEmailOtp
   * Sends a 6-digit OTP from no-reply@alphamate.app to the signed-in Firebase user's email
   * for sign-up activation ('signup') or account deletion confirmation ('account_deletion').
   */
  const sendEmailOtp = onCall(callableWithSecretOptions, async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Please sign in first to request a verification code.');
    }

    const data = (request.data || {}) as {
      purpose?: string;
      email?: string;
      displayName?: string;
    };
    const purpose = data.purpose === 'account_deletion' ? 'account_deletion' : 'signup';
    const displayName =
      typeof data.displayName === 'string' ? data.displayName.trim().slice(0, 80) : undefined;

    const engine = buildEngine();
    const res = await engine.sendAuthenticatedOtp({
      uid: request.auth.uid,
      tokenEmail: typeof request.auth.token?.email === 'string' ? request.auth.token.email : undefined,
      requestedEmail: data.email,
      purpose,
      displayName,
    });

    if (!res.success) {
      logger.warn('sendEmailOtp rejected', {
        uid: request.auth.uid,
        purpose,
        code: res.code,
      });
    } else {
      logger.info('sendEmailOtp dispatched via Resend', {
        uid: request.auth.uid,
        purpose,
        alreadyVerified: Boolean(res.alreadyVerified),
      });
    }

    return res;
  });

  /**
   * Callable Cloud Function: verifyEmailOtp
   * Validates the 6-digit OTP server-side for the signed-in Firebase user.
   */
  const verifyEmailOtp = onCall(callableWithSecretOptions, async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Please sign in first to verify your code.');
    }

    const data = (request.data || {}) as {
      purpose?: string;
      challengeToken?: string;
      otp?: string;
    };
    const purpose = data.purpose === 'account_deletion' ? 'account_deletion' : 'signup';

    const engine = buildEngine();
    const res = await engine.verifyAuthenticatedOtp({
      uid: request.auth.uid,
      tokenEmail: typeof request.auth.token?.email === 'string' ? request.auth.token.email : undefined,
      purpose,
      challengeToken: String(data.challengeToken || ''),
      otp: String(data.otp || ''),
    });

    if (res.success) {
      logger.info('verifyEmailOtp succeeded', { uid: request.auth.uid, purpose });
    } else {
      logger.warn('verifyEmailOtp failed', { uid: request.auth.uid, purpose, code: res.code });
    }

    return res;
  });

  /**
   * Callable Cloud Function: sendLoginEmailOtp
   * Dispatches a 6-digit sign-in OTP via Resend (no-reply@alphamate.app) to an existing account's email.
   */
  const sendLoginEmailOtp = onCall(callableWithSecretOptions, async (request) => {
    const data = (request.data || {}) as { email?: string };
    const engine = buildEngine();
    const res = await engine.sendLoginOtp({
      email: String(data.email || ''),
    });

    if (!res.success) {
      logger.warn('sendLoginEmailOtp rejected', { code: res.code });
    } else {
      logger.info('sendLoginEmailOtp dispatched via Resend', { emailMasked: res.emailMasked });
    }

    return res;
  });

  /**
   * Callable Cloud Function: verifyLoginEmailOtp
   * Validates a 6-digit sign-in OTP server-side and returns a Firebase Auth customToken.
   */
  const verifyLoginEmailOtp = onCall(callableWithSecretOptions, async (request) => {
    const data = (request.data || {}) as {
      email?: string;
      challengeToken?: string;
      otp?: string;
    };
    const engine = buildEngine();
    const res = await engine.verifyLoginOtp({
      email: String(data.email || ''),
      challengeToken: String(data.challengeToken || ''),
      otp: String(data.otp || ''),
    });

    if (res.success) {
      logger.info('verifyLoginEmailOtp succeeded', { uid: res.uid });
    } else {
      logger.warn('verifyLoginEmailOtp failed', { code: res.code });
    }

    return res;
  });

  /**
   * Periodic cleanup helper to remove expired/consumed OTP challenge docs older than 24 hours.
   */
  const purgeExpiredOtpChallenges = async (): Promise<number> => {
    const cutoffMs = Date.now() - EXPIRED_CHALLENGE_RETENTION_MS;
    const snap = await db
      .collection(OTP_CHALLENGES_COLLECTION)
      .where('expiresAtMs', '<', cutoffMs)
      .limit(250)
      .get();

    if (snap.empty) return 0;

    const batch = db.batch();
    for (const docSnap of snap.docs) {
      batch.delete(docSnap.ref);
    }
    await batch.commit();
    return snap.size;
  };

  return {
    sendPreSignupEmailOtp,
    verifyPreSignupEmailOtp,
    completePreSignupWithPassword,
    setAuthenticatedUserPassword,
    registerDeviceSwitchSession,
    switchDeviceAccount,
    sendEmailOtp,
    verifyEmailOtp,
    sendLoginEmailOtp,
    verifyLoginEmailOtp,
    purgeExpiredOtpChallenges,
  };
}
