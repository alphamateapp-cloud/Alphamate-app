import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  EmailOtpServiceEngine,
  createResendMailer,
  RESEND_SENDER_EMAIL,
  RESEND_FROM_HEADER,
  RESEND_API_URL,
  OTP_TTL_MS,
  OTP_COOLDOWN_MS,
} = require('../lib/emailOtpCore.js');

function createInMemoryTestHarness() {
  let currentTimeMs = 1_760_000_000_000;
  const records = new Map();
  const usersByUid = new Map();
  const sentEmails = [];

  const store = {
    async runAtomic(docId, fn) {
      const existing = records.has(docId) ? structuredClone(records.get(docId)) : null;
      let nextRecord = null;
      const out = await fn(existing, (record) => {
        nextRecord = structuredClone(record);
      });
      if (nextRecord) {
        records.set(docId, nextRecord);
      }
      return out;
    },
    async deleteRecord(docId) {
      records.delete(docId);
    },
  };

  const authAdapter = {
    async getUserByUid(uid) {
      return usersByUid.get(uid) || null;
    },
    async getUserByEmail(email) {
      const norm = email.trim().toLowerCase();
      for (const user of usersByUid.values()) {
        if (user.email === norm) return user;
      }
      return null;
    },
    async markEmailVerified(uid, _email, verifiedAtIso) {
      const u = usersByUid.get(uid);
      if (u) {
        u.emailVerified = true;
        u.verifiedAtIso = verifiedAtIso;
      }
    },
    async createLoginCustomToken(uid) {
      return `firebase_custom_token_for_${uid}`;
    },
    async upsertVerifiedPasswordUser(email, password, verifiedAtIso) {
      const norm = email.trim().toLowerCase();
      for (const existing of usersByUid.values()) {
        if (existing.email === norm) {
          existing.emailVerified = true;
          existing.hasPasswordProvider = true;
          existing.passwordSet = Boolean(password);
          existing.verifiedAtIso = verifiedAtIso;
          return {
            uid: existing.uid,
            email: norm,
            customToken: `firebase_custom_token_for_${existing.uid}`,
            existed: true,
          };
        }
      }
      const newUid = `uid_created_${usersByUid.size + 1}`;
      usersByUid.set(newUid, {
        uid: newUid,
        email: norm,
        emailVerified: true,
        hasPasswordProvider: true,
        passwordSet: Boolean(password),
        verifiedAtIso,
        disabled: false,
      });
      return {
        uid: newUid,
        email: norm,
        customToken: `firebase_custom_token_for_${newUid}`,
        existed: false,
      };
    },
  };

  let mockResendApiKey = 're_test_secret_from_firebase_secret_manager';
  const mockFetch = async (url, init) => {
    assert.equal(url, RESEND_API_URL);
    assert.equal(init.method, 'POST');
    assert.equal(init.headers.Authorization, `Bearer ${mockResendApiKey}`);
    const body = JSON.parse(init.body);
    sentEmails.push(body);
    return {
      ok: true,
      status: 200,
      async json() {
        return { id: `resend_msg_${sentEmails.length}` };
      },
    };
  };

  const mailer = createResendMailer(() => mockResendApiKey, mockFetch);

  const engine = new EmailOtpServiceEngine({
    store,
    authAdapter,
    mailer,
    now: () => currentTimeMs,
  });

  return {
    engine,
    records,
    usersByUid,
    sentEmails,
    advanceMs(ms) {
      currentTimeMs += ms;
    },
    setResendSecret(val) {
      mockResendApiKey = val;
    },
  };
}

test('Registration Email OTP flow: generates 6-digit OTP, sends from no-reply@alphamate.app via Resend, stores only hash, and verifies server-side', async () => {
  const h = createInMemoryTestHarness();
  h.usersByUid.set('uid_new_user_1', {
    uid: 'uid_new_user_1',
    email: 'newmember@example.com',
    emailVerified: false,
    displayName: 'Zara Khan',
    disabled: false,
  });

  const sendRes = await h.engine.sendAuthenticatedOtp({
    uid: 'uid_new_user_1',
    requestedEmail: 'newmember@example.com',
    purpose: 'signup',
    displayName: 'Zara Khan',
  });

  assert.equal(sendRes.success, true);
  assert.equal(sendRes.provider, 'resend');
  assert.equal(sendRes.cooldownSeconds, 60);
  assert.equal(sendRes.expiresInSeconds, 600);
  assert.ok(sendRes.challengeToken);
  assert.equal(h.sentEmails.length, 1);

  const dispatched = h.sentEmails[0];
  assert.equal(RESEND_SENDER_EMAIL, 'no-reply@alphamate.app');
  assert.equal(dispatched.from, RESEND_FROM_HEADER);
  assert.ok(dispatched.from.includes('no-reply@alphamate.app'));
  assert.deepEqual(dispatched.to, ['newmember@example.com']);

  const otpMatch = dispatched.subject.match(/(\d{6})$/);
  assert.ok(otpMatch, 'Subject should contain 6-digit OTP');
  const extractedOtp = otpMatch[1];

  // Ensure plaintext OTP is NEVER stored in database record
  const storedValues = Array.from(h.records.values());
  assert.equal(storedValues.length, 1);
  assert.equal(JSON.stringify(storedValues[0]).includes(extractedOtp), false);
  assert.equal(typeof storedValues[0].otpHash, 'string');
  assert.equal(storedValues[0].otpHash.length, 64);

  // Verify with exact 6-digit OTP
  const verifyRes = await h.engine.verifyAuthenticatedOtp({
    uid: 'uid_new_user_1',
    purpose: 'signup',
    challengeToken: sendRes.challengeToken,
    otp: extractedOtp,
  });

  assert.equal(verifyRes.success, true);
  assert.equal(verifyRes.uid, 'uid_new_user_1');
  assert.equal(h.usersByUid.get('uid_new_user_1').emailVerified, true);

  // Replay of the same OTP must be rejected
  const replayRes = await h.engine.verifyAuthenticatedOtp({
    uid: 'uid_new_user_1',
    purpose: 'signup',
    challengeToken: sendRes.challengeToken,
    otp: extractedOtp,
  });
  assert.equal(replayRes.success, false);
  assert.equal(replayRes.code, 'OTP_SESSION_INVALID');
});

test('Resend cooldown & superseding: blocks immediate resend, allows after 60s, and invalidates previous OTP', async () => {
  const h = createInMemoryTestHarness();
  h.usersByUid.set('uid_user_2', {
    uid: 'uid_user_2',
    email: 'cooldown@example.com',
    emailVerified: false,
    disabled: false,
  });

  const firstSend = await h.engine.sendAuthenticatedOtp({
    uid: 'uid_user_2',
    purpose: 'signup',
  });
  assert.equal(firstSend.success, true);
  const firstOtp = h.sentEmails[0].subject.match(/(\d{6})$/)[1];

  // Advance 15s (< 60s cooldown) -> must reject with OTP_COOLDOWN
  h.advanceMs(15_000);
  const earlyResend = await h.engine.sendAuthenticatedOtp({
    uid: 'uid_user_2',
    purpose: 'signup',
  });
  assert.equal(earlyResend.success, false);
  assert.equal(earlyResend.code, 'OTP_COOLDOWN');
  assert.equal(earlyResend.retryAfterSeconds, 45);

  // Advance past 60s cooldown -> resend succeeds and supersedes first OTP
  h.advanceMs(OTP_COOLDOWN_MS);
  const secondSend = await h.engine.sendAuthenticatedOtp({
    uid: 'uid_user_2',
    purpose: 'signup',
  });
  assert.equal(secondSend.success, true);
  const secondOtp = h.sentEmails[1].subject.match(/(\d{6})$/)[1];

  // Trying old challengeToken must fail with OTP_SUPERSEDED
  const oldVerify = await h.engine.verifyAuthenticatedOtp({
    uid: 'uid_user_2',
    purpose: 'signup',
    challengeToken: firstSend.challengeToken,
    otp: firstOtp,
  });
  assert.equal(oldVerify.success, false);
  assert.equal(oldVerify.code, 'OTP_SUPERSEDED');

  // Latest OTP succeeds
  const latestVerify = await h.engine.verifyAuthenticatedOtp({
    uid: 'uid_user_2',
    purpose: 'signup',
    challengeToken: secondSend.challengeToken,
    otp: secondOtp,
  });
  assert.equal(latestVerify.success, true);
});

test('Expiry & brute-force protection: rejects expired codes after 10m and locks after 5 wrong attempts', async () => {
  const h = createInMemoryTestHarness();
  h.usersByUid.set('uid_user_3', {
    uid: 'uid_user_3',
    email: 'security@example.com',
    emailVerified: false,
    disabled: false,
  });

  const send1 = await h.engine.sendAuthenticatedOtp({
    uid: 'uid_user_3',
    purpose: 'signup',
  });
  const otp1 = h.sentEmails[0].subject.match(/(\d{6})$/)[1];

  // Advance past 10m TTL
  h.advanceMs(OTP_TTL_MS + 1000);
  const expiredRes = await h.engine.verifyAuthenticatedOtp({
    uid: 'uid_user_3',
    purpose: 'signup',
    challengeToken: send1.challengeToken,
    otp: otp1,
  });
  assert.equal(expiredRes.success, false);
  assert.equal(expiredRes.code, 'OTP_EXPIRED');

  // Issue fresh OTP and test 5 wrong attempts lockout
  const send2 = await h.engine.sendAuthenticatedOtp({
    uid: 'uid_user_3',
    purpose: 'signup',
  });
  const realOtp2 = h.sentEmails[1].subject.match(/(\d{6})$/)[1];
  const wrongOtp = realOtp2 === '111111' ? '222222' : '111111';

  for (let i = 1; i <= 4; i++) {
    const attemptRes = await h.engine.verifyAuthenticatedOtp({
      uid: 'uid_user_3',
      purpose: 'signup',
      challengeToken: send2.challengeToken,
      otp: wrongOtp,
    });
    assert.equal(attemptRes.success, false);
    assert.equal(attemptRes.code, 'OTP_INVALID');
    assert.equal(attemptRes.remainingAttempts, 5 - i);
  }

  const fifthAttempt = await h.engine.verifyAuthenticatedOtp({
    uid: 'uid_user_3',
    purpose: 'signup',
    challengeToken: send2.challengeToken,
    otp: wrongOtp,
  });
  assert.equal(fifthAttempt.success, false);
  assert.equal(fifthAttempt.code, 'OTP_MAX_ATTEMPTS');
  assert.equal(fifthAttempt.remainingAttempts, 0);

  // Even the real OTP must now be rejected until a fresh OTP is requested
  const postLockAttempt = await h.engine.verifyAuthenticatedOtp({
    uid: 'uid_user_3',
    purpose: 'signup',
    challengeToken: send2.challengeToken,
    otp: realOtp2,
  });
  assert.equal(postLockAttempt.success, false);
});

test('Complete Email OTP Login flow: sends login code to registered email, validates OTP, and issues Firebase customToken', async () => {
  const h = createInMemoryTestHarness();
  h.usersByUid.set('uid_login_member', {
    uid: 'uid_login_member',
    email: 'member@alphamate.app',
    emailVerified: true,
    displayName: 'Ali Raza',
    disabled: false,
  });

  // Unknown email is rejected cleanly
  const unknownRes = await h.engine.sendLoginOtp({ email: 'nobody@alphamate.app' });
  assert.equal(unknownRes.success, false);
  assert.equal(unknownRes.code, 'ACCOUNT_NOT_FOUND');

  // Registered email receives 6-digit login OTP from no-reply@alphamate.app
  const loginSend = await h.engine.sendLoginOtp({ email: 'Member@AlphaMate.app' });
  assert.equal(loginSend.success, true);
  assert.ok(loginSend.challengeToken);
  assert.equal(h.sentEmails.length, 1);
  assert.equal(h.sentEmails[0].from, 'Alpha Mate <no-reply@alphamate.app>');

  const loginOtp = h.sentEmails[0].subject.match(/(\d{6})$/)[1];
  const loginVerify = await h.engine.verifyLoginOtp({
    email: 'member@alphamate.app',
    challengeToken: loginSend.challengeToken,
    otp: loginOtp,
  });

  assert.equal(loginVerify.success, true);
  assert.equal(loginVerify.uid, 'uid_login_member');
  assert.equal(loginVerify.customToken, 'firebase_custom_token_for_uid_login_member');
});

test('3-Step Pre-Signup Flow (Email -> OTP -> Password) & Same-Email Google UID Unification', async () => {
  const h = createInMemoryTestHarness();

  // Case A: Brand-new email signs up via Step 1 (Send OTP) -> Step 2 (Verify OTP) -> Step 3 (Save Password)
  const step1 = await h.engine.sendPreSignupOtp({ email: 'NewCreator@AlphaMate.app' });
  assert.equal(step1.success, true);
  assert.ok(step1.challengeToken);
  const codeA = h.sentEmails[0].subject.match(/(\d{6})$/)[1];

  const step2 = await h.engine.verifyPreSignupOtp({
    email: 'newcreator@alphamate.app',
    challengeToken: step1.challengeToken,
    otp: codeA,
  });
  assert.equal(step2.success, true);
  assert.ok(step2.registrationTicket);

  const step3 = await h.engine.completePreSignupWithPassword({
    email: 'newcreator@alphamate.app',
    password: 'StrongPassword123!',
    registrationTicket: step2.registrationTicket,
  });
  assert.equal(step3.success, true);
  assert.equal(step3.uid, 'uid_created_1');
  assert.equal(step3.customToken, 'firebase_custom_token_for_uid_created_1');
  assert.equal(h.usersByUid.get('uid_created_1').emailVerified, true);
  assert.equal(h.usersByUid.get('uid_created_1').hasPasswordProvider, true);

  // Replaying the same registrationTicket must fail
  const replayTicket = await h.engine.completePreSignupWithPassword({
    email: 'newcreator@alphamate.app',
    password: 'AnotherPassword123!',
    registrationTicket: step2.registrationTicket,
  });
  assert.equal(replayTicket.success, false);
  assert.equal(replayTicket.code, 'TICKET_CONSUMED');

  // Trying to pre-signup again when password is already set must return EMAIL_ALREADY_REGISTERED
  const duplicateSignup = await h.engine.sendPreSignupOtp({ email: 'newcreator@alphamate.app' });
  assert.equal(duplicateSignup.success, false);
  assert.equal(duplicateSignup.code, 'EMAIL_ALREADY_REGISTERED');

  // Case B: Existing Google-only user signs up with Email -> attaches password to the EXACT SAME UID
  h.usersByUid.set('uid_existing_google_777', {
    uid: 'uid_existing_google_777',
    email: 'sameuser@gmail.com',
    emailVerified: true,
    hasPasswordProvider: false,
    displayName: 'Same Google User',
    disabled: false,
  });

  const googleStep1 = await h.engine.sendPreSignupOtp({ email: 'SameUser@gmail.com' });
  assert.equal(googleStep1.success, true);
  const codeB = h.sentEmails[1].subject.match(/(\d{6})$/)[1];

  const googleStep2 = await h.engine.verifyPreSignupOtp({
    email: 'sameuser@gmail.com',
    challengeToken: googleStep1.challengeToken,
    otp: codeB,
  });
  assert.equal(googleStep2.success, true);

  const googleStep3 = await h.engine.completePreSignupWithPassword({
    email: 'sameuser@gmail.com',
    password: 'UnifiedPassword99',
    registrationTicket: googleStep2.registrationTicket,
  });
  assert.equal(googleStep3.success, true);
  assert.equal(googleStep3.uid, 'uid_existing_google_777');
  assert.equal(h.usersByUid.get('uid_existing_google_777').hasPasswordProvider, true);
});

