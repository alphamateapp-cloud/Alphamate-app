import { httpsCallable } from 'firebase/functions';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { auth, functions } from './firebase';
import { p2pStreamingEngine } from './webrtcService';

export interface CloudSendOtpResult {
  success: boolean;
  alreadyVerified?: boolean;
  emailMasked?: string;
  challengeToken?: string;
  expiresAt?: number;
  expiresInSeconds?: number;
  cooldownSeconds?: number;
  retryAfterSeconds?: number;
  provider?: string;
  code?: string;
  error?: string;
}

export interface CloudVerifyOtpResult {
  success: boolean;
  uid?: string;
  email?: string;
  emailVerifiedAt?: string;
  otpVerifiedAt?: string;
  customToken?: string;
  remainingAttempts?: number;
  code?: string;
  error?: string;
}

export interface CloudPreSignupVerifyResult extends CloudVerifyOtpResult {
  registrationTicket?: string;
}

export interface CloudPreSignupCompleteResult extends CloudVerifyOtpResult {
  clientCompleteFallback?: boolean;
}

function getOrderedBackendEndpoints(subPath: string): string[] {
  const railwayBase = p2pStreamingEngine.getResolvedBackendApiBase().replace(/\/$/, '');
  const isLocalOrPreviewHost =
    typeof window !== 'undefined' &&
    !Capacitor.isNativePlatform() &&
    (window.location.hostname.endsWith('.run.app') ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1');

  const candidates = isLocalOrPreviewHost
    ? [subPath, `${railwayBase}${subPath}`]
    : [`${railwayBase}${subPath}`];

  return Array.from(new Set(candidates));
}

function shouldTryNextBackendOrCloudFunction(status: number, data: Record<string, any> | null): boolean {
  if (status === 404 || status === 502 || status === 504) return true;
  if (status === 503 && data?.code === 'EMAIL_OTP_NOT_CONFIGURED') return true;
  if (status === 503 && data?.code === 'FIREBASE_SERVICE_ACCOUNT_REQUIRED') return true;
  return false;
}

function formatCallableError(err: unknown, fallbackMessage: string): string {
  const code = String((err as { code?: string })?.code || '');
  const msg = String((err as { message?: string })?.message || '').trim();
  if (code === 'functions/unauthenticated') {
    return 'Please sign in first to verify your email address.';
  }
  if (
    code.includes('not-found') ||
    code.includes('unavailable') ||
    code.includes('internal') ||
    msg.toLowerCase().includes('cors') ||
    msg.toLowerCase().includes('failed to fetch')
  ) {
    return fallbackMessage;
  }
  if (msg && msg !== 'INTERNAL') {
    return msg;
  }
  return fallbackMessage;
}

async function postJsonToEndpoint(
  url: string,
  headers: Record<string, string>,
  body: Record<string, unknown>
): Promise<{ status: number; data: Record<string, any> | null }> {
  // On native Android/iOS, CapacitorHttp executes outside the WebView sandbox so WebView CORS
  // restrictions (e.g. https://localhost -> https://api.alphamate.app) never block OTP requests.
  if (Capacitor.isNativePlatform()) {
    try {
      const nativeRes = await CapacitorHttp.post({
        url,
        headers,
        data: body,
        connectTimeout: 15000,
        readTimeout: 15000,
      });
      let parsedData: Record<string, any> | null = null;
      if (nativeRes.data && typeof nativeRes.data === 'object') {
        parsedData = nativeRes.data as Record<string, any>;
      } else if (typeof nativeRes.data === 'string' && nativeRes.data.trim().startsWith('{')) {
        parsedData = JSON.parse(nativeRes.data);
      }
      return { status: Number(nativeRes.status || 0), data: parsedData };
    } catch {
      // Fall through to WebView fetch fallback below
    }
  }

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), 15000) : null;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      ...(controller ? { signal: controller.signal } : {}),
    });
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return { status: res.status, data: null };
    }
    const data = await res.json().catch(() => null);
    return {
      status: res.status,
      data: data && typeof data === 'object' ? (data as Record<string, any>) : null,
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function callBackendOtpEndpoint(params: {
  subPath: string;
  body: Record<string, unknown>;
  requireAuth: boolean;
}): Promise<{
  handled: boolean;
  data: Record<string, any> | null;
  lastUnconfiguredError?: string;
  lastTransportError?: string;
}> {
  let authHeader: string | undefined;
  if (params.requireAuth) {
    const activeFbUser = auth.currentUser;
    if (!activeFbUser) {
      return {
        handled: true,
        data: {
          success: false,
          code: 'UNAUTHENTICATED',
          error: 'Please sign in first to verify your email address.',
        },
      };
    }
    try {
      const idToken = await activeFbUser.getIdToken(true);
      authHeader = `Bearer ${idToken}`;
    } catch {
      return {
        handled: true,
        data: {
          success: false,
          code: 'UNAUTHENTICATED',
          error: 'Session token could not be refreshed. Please sign in again.',
        },
      };
    }
  }

  let lastUnconfiguredError: string | undefined;
  let lastTransportError: string | undefined;
  const endpoints = getOrderedBackendEndpoints(params.subPath);

  for (const url of endpoints) {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };
      if (authHeader) {
        headers.Authorization = authHeader;
      }

      const { status, data } = await postJsonToEndpoint(url, headers, params.body);
      if (!data) {
        if (status > 0) {
          lastTransportError = `OTP server returned HTTP ${status}. Please try again.`;
        }
        continue;
      }

      if (shouldTryNextBackendOrCloudFunction(status, data)) {
        if (typeof data.error === 'string' && data.error.trim()) {
          if (data.code === 'EMAIL_OTP_NOT_CONFIGURED' || data.code === 'FIREBASE_SERVICE_ACCOUNT_REQUIRED') {
            lastUnconfiguredError = data.error;
          } else {
            lastTransportError = data.error;
          }
        }
        continue;
      }

      return { handled: true, data };
    } catch (err: any) {
      const msg = String(err?.message || '').trim();
      lastTransportError =
        err?.name === 'AbortError'
          ? 'OTP server request timed out. Please check your internet connection and try again.'
          : msg
          ? `Unable to reach Email OTP server (${msg}).`
          : 'Unable to reach Email OTP server. Please check your internet connection.';
    }
  }

  return { handled: false, data: null, lastUnconfiguredError, lastTransportError };
}

/**
 * Sends a 6-digit Email OTP via the Alpha Mate Railway/Express backend (`/api/auth/signup-otp/send` or
 * `/api/account/deletion-otp/send`), with automatic fallback to Firebase Cloud Functions (`sendEmailOtp`).
 * Uses verified sender `Alpha Mate <no-reply@alphamate.app>` and server secret `RESEND_API_KEY`.
 */
export async function requestAuthenticatedEmailOtp(params: {
  purpose: 'signup' | 'account_deletion';
  email?: string;
  displayName?: string;
}): Promise<CloudSendOtpResult> {
  const subPath =
    params.purpose === 'account_deletion'
      ? '/api/account/deletion-otp/send'
      : '/api/auth/signup-otp/send';

  const backendAttempt = await callBackendOtpEndpoint({
    subPath,
    body: {
      email: params.email,
      displayName: params.displayName,
    },
    requireAuth: true,
  });

  if (backendAttempt.handled && backendAttempt.data) {
    return backendAttempt.data as CloudSendOtpResult;
  }

  try {
    const callable = httpsCallable<
      { purpose: 'signup' | 'account_deletion'; email?: string; displayName?: string },
      CloudSendOtpResult
    >(functions, 'sendEmailOtp');
    const response = await callable({
      purpose: params.purpose,
      email: params.email,
      displayName: params.displayName,
    });
    return response.data;
  } catch (err: unknown) {
    return {
      success: false,
      code: backendAttempt.lastTransportError ? 'OTP_NETWORK_ERROR' : 'EMAIL_OTP_NOT_CONFIGURED',
      error: formatCallableError(
        err,
        backendAttempt.lastUnconfiguredError ||
          backendAttempt.lastTransportError ||
          'Email OTP backend is awaiting RESEND_API_KEY configuration on Railway (api.alphamate.app) or AI Studio Secrets.'
      ),
    };
  }
}

/**
 * Validates a 6-digit Email OTP server-side via Railway/Express backend or Cloud Functions (`verifyEmailOtp`).
 */
export async function confirmAuthenticatedEmailOtp(params: {
  purpose: 'signup' | 'account_deletion';
  challengeToken: string;
  otp: string;
}): Promise<CloudVerifyOtpResult> {
  const subPath =
    params.purpose === 'account_deletion'
      ? '/api/account/deletion-otp/verify'
      : '/api/auth/signup-otp/verify';

  const backendAttempt = await callBackendOtpEndpoint({
    subPath,
    body: {
      challengeToken: params.challengeToken,
      otp: params.otp,
    },
    requireAuth: true,
  });

  if (backendAttempt.handled && backendAttempt.data) {
    return backendAttempt.data as CloudVerifyOtpResult;
  }

  try {
    const callable = httpsCallable<
      { purpose: 'signup' | 'account_deletion'; challengeToken: string; otp: string },
      CloudVerifyOtpResult
    >(functions, 'verifyEmailOtp');
    const response = await callable({
      purpose: params.purpose,
      challengeToken: params.challengeToken,
      otp: params.otp,
    });
    return response.data;
  } catch (err: unknown) {
    return {
      success: false,
      error: formatCallableError(err, 'Unable to verify OTP code right now. Please try again.'),
    };
  }
}

/**
 * Sends a 6-digit Login OTP to an existing Alpha Mate email account via Railway/Express (`/api/auth/login-otp/send`)
 * or Cloud Functions (`sendLoginEmailOtp`).
 */
export async function requestLoginEmailOtp(email: string): Promise<CloudSendOtpResult> {
  const cleanEmail = email.trim().toLowerCase();

  const backendAttempt = await callBackendOtpEndpoint({
    subPath: '/api/auth/login-otp/send',
    body: { email: cleanEmail },
    requireAuth: false,
  });

  if (backendAttempt.handled && backendAttempt.data) {
    return backendAttempt.data as CloudSendOtpResult;
  }

  try {
    const callable = httpsCallable<{ email: string }, CloudSendOtpResult>(
      functions,
      'sendLoginEmailOtp'
    );
    const response = await callable({ email: cleanEmail });
    return response.data;
  } catch (err: unknown) {
    return {
      success: false,
      code: backendAttempt.lastTransportError ? 'OTP_NETWORK_ERROR' : 'EMAIL_OTP_NOT_CONFIGURED',
      error: formatCallableError(
        err,
        backendAttempt.lastUnconfiguredError ||
          backendAttempt.lastTransportError ||
          'Login Email OTP backend is awaiting RESEND_API_KEY configuration on Railway (api.alphamate.app) or AI Studio Secrets.'
      ),
    };
  }
}

/**
 * Verifies a 6-digit Login OTP server-side via Railway/Express (`/api/auth/login-otp/verify`)
 * or Cloud Functions (`verifyLoginEmailOtp`) and returns a Firebase Auth customToken.
 */
export async function confirmLoginEmailOtp(params: {
  email: string;
  challengeToken: string;
  otp: string;
}): Promise<CloudVerifyOtpResult> {
  const cleanEmail = params.email.trim().toLowerCase();
  const cleanOtp = params.otp.replace(/\D/g, '').slice(0, 6);

  const backendAttempt = await callBackendOtpEndpoint({
    subPath: '/api/auth/login-otp/verify',
    body: {
      email: cleanEmail,
      challengeToken: params.challengeToken.trim(),
      otp: cleanOtp,
    },
    requireAuth: false,
  });

  if (backendAttempt.handled && backendAttempt.data) {
    return backendAttempt.data as CloudVerifyOtpResult;
  }

  try {
    const callable = httpsCallable<
      { email: string; challengeToken: string; otp: string },
      CloudVerifyOtpResult
    >(functions, 'verifyLoginEmailOtp');
    const response = await callable({
      email: cleanEmail,
      challengeToken: params.challengeToken.trim(),
      otp: cleanOtp,
    });
    return response.data;
  } catch (err: unknown) {
    return {
      success: false,
      error: formatCallableError(
        err,
        backendAttempt.lastUnconfiguredError || 'Unable to verify sign-in OTP code. Please try again.'
      ),
    };
  }
}

/**
 * Step 1 of Email Sign-Up: Send 6-digit OTP to the email address before password creation.
 */
export async function requestPreSignupEmailOtp(email: string): Promise<CloudSendOtpResult> {
  const cleanEmail = email.trim().toLowerCase();

  const backendAttempt = await callBackendOtpEndpoint({
    subPath: '/api/auth/pre-signup-otp/send',
    body: { email: cleanEmail },
    requireAuth: false,
  });

  if (backendAttempt.handled && backendAttempt.data) {
    return backendAttempt.data as CloudSendOtpResult;
  }

  try {
    const callable = httpsCallable<{ email: string }, CloudSendOtpResult>(
      functions,
      'sendPreSignupEmailOtp'
    );
    const response = await callable({ email: cleanEmail });
    return response.data;
  } catch (err: unknown) {
    return {
      success: false,
      code: backendAttempt.lastTransportError ? 'OTP_NETWORK_ERROR' : 'EMAIL_OTP_NOT_CONFIGURED',
      error: formatCallableError(
        err,
        backendAttempt.lastUnconfiguredError ||
          backendAttempt.lastTransportError ||
          'Sign-Up Email OTP backend is awaiting RESEND_API_KEY configuration on Railway (api.alphamate.app) or AI Studio Secrets.'
      ),
    };
  }
}

/**
 * Step 2 of Email Sign-Up: Verify 6-digit OTP and obtain single-use registrationTicket.
 */
export async function confirmPreSignupEmailOtp(params: {
  email: string;
  challengeToken: string;
  otp: string;
}): Promise<CloudPreSignupVerifyResult> {
  const cleanEmail = params.email.trim().toLowerCase();
  const cleanOtp = params.otp.replace(/\D/g, '').slice(0, 6);

  const backendAttempt = await callBackendOtpEndpoint({
    subPath: '/api/auth/pre-signup-otp/verify',
    body: {
      email: cleanEmail,
      challengeToken: params.challengeToken.trim(),
      otp: cleanOtp,
    },
    requireAuth: false,
  });

  if (backendAttempt.handled && backendAttempt.data) {
    return backendAttempt.data as CloudPreSignupVerifyResult;
  }

  try {
    const callable = httpsCallable<
      { email: string; challengeToken: string; otp: string },
      CloudPreSignupVerifyResult
    >(functions, 'verifyPreSignupEmailOtp');
    const response = await callable({
      email: cleanEmail,
      challengeToken: params.challengeToken.trim(),
      otp: cleanOtp,
    });
    return response.data;
  } catch (err: unknown) {
    return {
      success: false,
      error: formatCallableError(err, 'Unable to verify OTP code right now. Please try again.'),
    };
  }
}

/**
 * Step 3 of Email Sign-Up: Save password for the verified email (creating or unifying on the same UID).
 */
export async function finalizePreSignupWithPassword(params: {
  email: string;
  password: string;
  registrationTicket: string;
}): Promise<CloudPreSignupCompleteResult> {
  const cleanEmail = params.email.trim().toLowerCase();

  const backendAttempt = await callBackendOtpEndpoint({
    subPath: '/api/auth/pre-signup-otp/complete',
    body: {
      email: cleanEmail,
      password: params.password,
      registrationTicket: params.registrationTicket.trim(),
    },
    requireAuth: false,
  });

  if (backendAttempt.handled && backendAttempt.data) {
    return backendAttempt.data as CloudPreSignupCompleteResult;
  }

  try {
    const callable = httpsCallable<
      { email: string; password: string; registrationTicket: string },
      CloudPreSignupCompleteResult
    >(functions, 'completePreSignupWithPassword');
    const response = await callable({
      email: cleanEmail,
      password: params.password,
      registrationTicket: params.registrationTicket.trim(),
    });
    return response.data;
  } catch (err: unknown) {
    return {
      success: false,
      error: formatCallableError(err, 'Unable to save password right now. Please try again.'),
    };
  }
}

/**
 * Server-side fallback to attach/update password on an authenticated Google account (same UID).
 */
export async function setCloudAccountPassword(password: string): Promise<{
  success: boolean;
  uid?: string;
  email?: string;
  error?: string;
}> {
  const backendAttempt = await callBackendOtpEndpoint({
    subPath: '/api/auth/set-password',
    body: { password },
    requireAuth: true,
  });

  if (backendAttempt.handled && backendAttempt.data) {
    return backendAttempt.data as {
      success: boolean;
      uid?: string;
      email?: string;
      error?: string;
    };
  }

  try {
    const callable = httpsCallable<
      { password: string },
      { success: boolean; uid?: string; email?: string; error?: string }
    >(functions, 'setAuthenticatedUserPassword');
    const response = await callable({ password });
    return response.data;
  } catch (err: unknown) {
    return {
      success: false,
      error: formatCallableError(err, 'Could not set account password right now.'),
    };
  }
}

/**
 * Issue a 90-day server-side switch ticket for instant passwordless multi-account switching.
 */
export async function registerCloudDeviceSwitchSession(deviceFingerprint: string): Promise<{
  success: boolean;
  uid?: string;
  sessionId?: string;
  switchTicket?: string;
}> {
  const backendAttempt = await callBackendOtpEndpoint({
    subPath: '/api/auth/device-switch/register',
    body: { deviceFingerprint },
    requireAuth: true,
  });

  if (backendAttempt.handled && backendAttempt.data) {
    return {
      success: Boolean(backendAttempt.data.success),
      uid: backendAttempt.data.uid,
      sessionId: backendAttempt.data.sessionId,
      switchTicket: backendAttempt.data.switchTicket || backendAttempt.data.switchToken,
    };
  }

  try {
    const callable = httpsCallable<
      { deviceFingerprint: string },
      { success: boolean; uid?: string; sessionId?: string; switchTicket?: string; switchToken?: string }
    >(functions, 'registerDeviceSwitchSession');
    const response = await callable({ deviceFingerprint });
    return {
      success: Boolean(response.data?.success),
      uid: response.data?.uid,
      sessionId: response.data?.sessionId,
      switchTicket: response.data?.switchTicket || response.data?.switchToken,
    };
  } catch {
    return { success: false };
  }
}

/**
 * Redeem a stored server-side switch ticket for a Firebase customToken.
 */
export async function redeemCloudDeviceSwitchSession(params: {
  sessionId: string;
  switchTicket: string;
  deviceFingerprint: string;
  uid?: string;
}): Promise<{
  success: boolean;
  uid?: string;
  customToken?: string;
  error?: string;
}> {
  const backendAttempt = await callBackendOtpEndpoint({
    subPath: '/api/auth/device-switch/redeem',
    body: {
      uid: params.uid,
      sessionId: params.sessionId,
      switchTicket: params.switchTicket,
      switchToken: params.switchTicket,
      deviceFingerprint: params.deviceFingerprint,
    },
    requireAuth: false,
  });

  if (backendAttempt.handled && backendAttempt.data) {
    return backendAttempt.data as {
      success: boolean;
      uid?: string;
      customToken?: string;
      error?: string;
    };
  }

  try {
    const callable = httpsCallable<
      { uid?: string; sessionId: string; switchTicket: string; switchToken: string; deviceFingerprint: string },
      { success: boolean; uid?: string; customToken?: string; error?: string }
    >(functions, 'switchDeviceAccount');
    const response = await callable({
      uid: params.uid,
      sessionId: params.sessionId,
      switchTicket: params.switchTicket,
      switchToken: params.switchTicket,
      deviceFingerprint: params.deviceFingerprint,
    });
    return response.data;
  } catch (err: unknown) {
    return {
      success: false,
      error: formatCallableError(err, 'Could not switch account via cloud session.'),
    };
  }
}
