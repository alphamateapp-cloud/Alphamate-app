import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import 'dotenv/config';

const VERIFIED_SENDER = 'Alpha Mate <no-reply@alphamate.app>';
const RAILWAY_PUBLIC_URL = (process.env.VITE_RAILWAY_API_URL || 'https://api.alphamate.app').replace(/\/$/, '');

function hasRealResendKey() {
  const val = (process.env.RESEND_API_KEY || '').trim();
  return Boolean(val && val !== 'YOUR_RESEND_API_KEY' && val !== 'MY_RESEND_API_KEY');
}

async function runExpressOtpIntegrationSuite() {
  const savedResendKey = process.env.RESEND_API_KEY;
  const savedServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const savedProjectId = process.env.FIREBASE_PROJECT_ID;
  const originalFetch = globalThis.fetch;

  const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const testServiceAccount = JSON.stringify({
    project_id: 'gen-lang-client-0468444352',
    client_email: 'firebase-adminsdk-test@gen-lang-client-0468444352.iam.gserviceaccount.com',
    private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }),
  });

  const capturedEmails = [];
  const fakeFirestoreDocs = new Map();

  process.env.RESEND_API_KEY = 're_test_mock_key_never_logged';
  process.env.FIREBASE_PROJECT_ID = 'gen-lang-client-0468444352';
  process.env.FIREBASE_SERVICE_ACCOUNT_JSON = testServiceAccount;

  globalThis.fetch = async (url, options = {}) => {
    const u = String(url);

    // Intercept Resend API calls during automated test suite
    if (u === 'https://api.resend.com/emails') {
      const body = JSON.parse(options.body || '{}');
      const codeMatch = String(body.subject || '').match(/(\d{6})/);
      capturedEmails.push({
        from: body.from,
        to: body.to,
        subject: body.subject,
        otp: codeMatch ? codeMatch[1] : null,
      });
      return new Response(JSON.stringify({ id: `re_msg_${capturedEmails.length}` }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Intercept Google OAuth2 service-account token exchange
    if (u === 'https://oauth2.googleapis.com/token') {
      return new Response(JSON.stringify({ access_token: 'mock_google_admin_token', expires_in: 3600 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Intercept Firebase Identity Toolkit Admin REST endpoints
    if (u.includes('identitytoolkit.googleapis.com') && u.includes('/accounts:lookup')) {
      const body = JSON.parse(options.body || '{}');
      const email = body?.email?.[0];
      if (email === 'existing-member@alphamate.app') {
        return new Response(
          JSON.stringify({
            users: [
              {
                localId: 'uid_alpha_member_01',
                email: 'existing-member@alphamate.app',
                displayName: 'Alpha Tester',
                emailVerified: true,
                disabled: false,
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify({ users: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (u.includes('identitytoolkit.googleapis.com') && u.endsWith('/accounts')) {
      const body = JSON.parse(options.body || '{}');
      return new Response(
        JSON.stringify({
          localId: 'uid_new_signup_01',
          email: body.email,
          emailVerified: true,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (u.includes('identitytoolkit.googleapis.com') && u.includes('/accounts:update')) {
      return new Response(JSON.stringify({ localId: 'uid_alpha_member_01', emailVerified: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Intercept Firestore Admin REST calls (emailOtpChallenges & users)
    if (u.includes('firestore.googleapis.com/v1/projects/')) {
      const docMatch = u.match(/\/documents\/([^?]+)/);
      const docPath = docMatch ? decodeURIComponent(docMatch[1]) : 'unknown';
      const method = (options.method || 'GET').toUpperCase();
      if (method === 'GET') {
        if (!fakeFirestoreDocs.has(docPath)) {
          return new Response(JSON.stringify({ error: { message: 'NOT_FOUND' } }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(
          JSON.stringify({
            name: `projects/gen-lang-client-0468444352/databases/default/documents/${docPath}`,
            fields: fakeFirestoreDocs.get(docPath),
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (method === 'PATCH') {
        const incoming = JSON.parse(options.body || '{}');
        const prev = fakeFirestoreDocs.get(docPath) || {};
        fakeFirestoreDocs.set(docPath, { ...prev, ...(incoming.fields || {}) });
        return new Response(
          JSON.stringify({
            name: `projects/gen-lang-client-0468444352/databases/default/documents/${docPath}`,
            fields: fakeFirestoreDocs.get(docPath),
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (method === 'DELETE') {
        fakeFirestoreDocs.delete(docPath);
        return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
    }

    // Pass through localhost test server requests
    return originalFetch(url, options);
  };

  const { createApiApp } = await import('../server-api.js');
  const app = createApiApp();
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;

  try {
    // 1. Check /api/auth/otp/status policy & sender
    const statusRes = await originalFetch(`${base}/api/auth/otp/status`);
    const statusJson = await statusRes.json();
    assert.equal(statusJson.configured, true);
    assert.equal(statusJson.provider, 'resend');
    assert.equal(statusJson.sender, VERIFIED_SENDER);
    assert.equal(statusJson.otpPolicy.digits, 6);
    assert.equal(statusJson.otpPolicy.expirySeconds, 600);
    assert.equal(statusJson.otpPolicy.resendCooldownSeconds, 60);
    assert.equal(statusJson.otpPolicy.maxAttempts, 5);

    // 2. Test 3-Step Registration Email OTP + 60s Cooldown + Max 5 Attempts + Firebase Auth & Firestore Sync
    const signupSend = await originalFetch(`${base}/api/auth/pre-signup-otp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'newuser@alphamate.app' }),
    });
    const signupSendJson = await signupSend.json();
    assert.equal(signupSend.status, 200);
    assert.equal(signupSendJson.success, true);
    assert.equal(signupSendJson.expiresInSeconds, 600);
    assert.equal(signupSendJson.cooldownSeconds, 60);
    assert.equal(capturedEmails[0].from, VERIFIED_SENDER);
    assert.match(capturedEmails[0].otp, /^\d{6}$/);

    // Immediate resend within 60s must return 429 OTP_COOLDOWN
    const cooldownRes = await originalFetch(`${base}/api/auth/pre-signup-otp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'newuser@alphamate.app' }),
    });
    const cooldownJson = await cooldownRes.json();
    assert.equal(cooldownRes.status, 429);
    assert.equal(cooldownJson.code, 'OTP_COOLDOWN');

    // Wrong OTP decrements remainingAttempts
    const wrongOtp = capturedEmails[0].otp === '123456' ? '654321' : '123456';
    const wrongVerify = await originalFetch(`${base}/api/auth/pre-signup-otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'newuser@alphamate.app',
        challengeToken: signupSendJson.challengeToken,
        otp: wrongOtp,
      }),
    });
    const wrongJson = await wrongVerify.json();
    assert.equal(wrongVerify.status, 400);
    assert.equal(wrongJson.remainingAttempts, 4);

    // Correct 6-digit OTP succeeds and issues registrationTicket
    const okVerify = await originalFetch(`${base}/api/auth/pre-signup-otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'newuser@alphamate.app',
        challengeToken: signupSendJson.challengeToken,
        otp: capturedEmails[0].otp,
      }),
    });
    const okVerifyJson = await okVerify.json();
    assert.equal(okVerify.status, 200);
    assert.equal(okVerifyJson.success, true);
    assert.ok(okVerifyJson.registrationTicket);

    // Complete signup with password creates verified Firebase user + Firestore user doc + customToken
    const completeRes = await originalFetch(`${base}/api/auth/pre-signup-otp/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'newuser@alphamate.app',
        password: 'StrongPassword123!',
        registrationTicket: okVerifyJson.registrationTicket,
      }),
    });
    const completeJson = await completeRes.json();
    assert.equal(completeRes.status, 200);
    assert.equal(completeJson.success, true);
    assert.equal(completeJson.uid, 'uid_new_signup_01');
    assert.ok(completeJson.customToken && completeJson.customToken.split('.').length === 3);
    assert.ok(fakeFirestoreDocs.has('users/uid_new_signup_01'));

    // 3. Test Login Email OTP + Max 5 Verification Attempts Lockout + CustomToken Minting
    const bruteEmail = 'existing-member@alphamate.app';
    const loginSend = await originalFetch(`${base}/api/auth/login-otp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: bruteEmail }),
    });
    const loginSendJson = await loginSend.json();
    assert.equal(loginSend.status, 200);
    assert.equal(loginSendJson.success, true);
    const loginOtp = capturedEmails[1].otp;
    assert.equal(capturedEmails[1].from, VERIFIED_SENDER);
    assert.match(loginOtp, /^\d{6}$/);

    // Verify correct Login OTP mints Firebase Auth customToken & syncs Firestore users/{uid}
    const loginVerify = await originalFetch(`${base}/api/auth/login-otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: bruteEmail,
        challengeToken: loginSendJson.challengeToken,
        otp: loginOtp,
      }),
    });
    const loginVerifyJson = await loginVerify.json();
    assert.equal(loginVerify.status, 200);
    assert.equal(loginVerifyJson.success, true);
    assert.equal(loginVerifyJson.uid, 'uid_alpha_member_01');
    assert.ok(loginVerifyJson.customToken && loginVerifyJson.customToken.split('.').length === 3);
    assert.ok(fakeFirestoreDocs.has('users/uid_alpha_member_01'));

    // Replaying the same OTP immediately fails with OTP_ALREADY_USED
    const replayVerify = await originalFetch(`${base}/api/auth/login-otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: bruteEmail,
        challengeToken: loginSendJson.challengeToken,
        otp: loginOtp,
      }),
    });
    const replayJson = await replayVerify.json();
    assert.equal(replayVerify.status, 400);
    assert.equal(replayJson.code, 'OTP_ALREADY_USED');

    // Test 5 wrong attempts lockout on another signup email
    const lockSend = await originalFetch(`${base}/api/auth/pre-signup-otp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'lockout-check@alphamate.app' }),
    });
    const lockSendJson = await lockSend.json();
    const lockRealOtp = capturedEmails[2].otp;
    const badCode = lockRealOtp === '000000' ? '999999' : '000000';
    for (let i = 1; i <= 5; i += 1) {
      const r = await originalFetch(`${base}/api/auth/pre-signup-otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'lockout-check@alphamate.app',
          challengeToken: lockSendJson.challengeToken,
          otp: badCode,
        }),
      });
      const j = await r.json();
      if (i < 5) {
        assert.equal(r.status, 400);
        assert.equal(j.remainingAttempts, 5 - i);
      } else {
        assert.equal(r.status, 429);
        assert.equal(j.code, 'OTP_MAX_ATTEMPTS');
      }
    }

    console.log('[PASS] Express/Railway server-api.js OTP suite passed (Registration OTP, Login OTP, 6-digit, 10m TTL, 60s cooldown, max 5 attempts, Firebase customToken, Firestore sync).');
  } finally {
    await new Promise((resolve) => server.close(resolve));
    globalThis.fetch = originalFetch;
    if (savedResendKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = savedResendKey;
    if (savedServiceAccount === undefined) delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    else process.env.FIREBASE_SERVICE_ACCOUNT_JSON = savedServiceAccount;
    if (savedProjectId === undefined) delete process.env.FIREBASE_PROJECT_ID;
    else process.env.FIREBASE_PROJECT_ID = savedProjectId;
  }
}

async function runLiveResendAndRailwayCheck() {
  console.log('\n--- Live Environment & Delivery Check ---');
  try {
    const railwayStatusRes = await fetch(`${RAILWAY_PUBLIC_URL}/api/auth/otp/status`);
    const text = await railwayStatusRes.text();
    console.log(`[Railway ${RAILWAY_PUBLIC_URL}/api/auth/otp/status] HTTP ${railwayStatusRes.status}: ${text.slice(0, 220)}`);
  } catch (err) {
    console.log(`[Railway ${RAILWAY_PUBLIC_URL}] Unreachable:`, err.message);
  }

  if (!hasRealResendKey()) {
    console.log('[PENDING SECRET] process.env.RESEND_API_KEY is NOT set in this runtime yet.');
    console.log('To test live Resend email delivery from Alpha Mate <no-reply@alphamate.app>, enter RESEND_API_KEY via AI Studio Settings -> Secrets (and Railway Variables), then re-run `npm run otp:verify`.');
    return;
  }

  const recipient = (process.env.OTP_TEST_RECIPIENT || 'alphamateapp@gmail.com').trim();
  const testCode = String(crypto.randomInt(100000, 1000000));
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY.trim()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: VERIFIED_SENDER,
      to: [recipient],
      subject: `Alpha Mate Live Resend OTP Verification Test: ${testCode}`,
      text: `Alpha Mate live Resend OTP delivery test succeeded.\nVerification code: ${testCode}\nSender: ${VERIFIED_SENDER}`,
    }),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`[FAIL] Live Resend API returned HTTP ${res.status}:`, payload?.message || payload?.error || payload);
    process.exitCode = 1;
    return;
  }
  console.log(`[PASS] Live Resend email delivered from "${VERIFIED_SENDER}" to "${recipient}"! Resend messageId: ${payload.id}`);
}

await runExpressOtpIntegrationSuite();
if (process.argv.includes('--live') || hasRealResendKey()) {
  await runLiveResendAndRailwayCheck();
}
