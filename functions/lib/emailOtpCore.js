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
exports.EmailOtpServiceEngine = exports.OTP_HOURLY_WINDOW_MS = exports.OTP_MAX_HOURLY_SENDS = exports.OTP_MAX_ATTEMPTS = exports.OTP_COOLDOWN_MS = exports.PRE_SIGNUP_TICKET_TTL_MS = exports.OTP_TTL_MS = exports.RESEND_API_URL = exports.RESEND_FROM_HEADER = exports.RESEND_SENDER_EMAIL = void 0;
exports.normalizeEmail = normalizeEmail;
exports.isValidEmailFormat = isValidEmailFormat;
exports.escapeHtmlText = escapeHtmlText;
exports.maskEmailAddress = maskEmailAddress;
exports.generateSixDigitOtp = generateSixDigitOtp;
exports.buildChallengeDocId = buildChallengeDocId;
exports.computeOtpHash = computeOtpHash;
exports.timingSafeHexEqual = timingSafeHexEqual;
exports.buildResendEmailPayload = buildResendEmailPayload;
exports.createResendMailer = createResendMailer;
const crypto = __importStar(require("node:crypto"));
exports.RESEND_SENDER_EMAIL = 'no-reply@alphamate.app';
exports.RESEND_FROM_HEADER = `Alpha Mate <${exports.RESEND_SENDER_EMAIL}>`;
exports.RESEND_API_URL = 'https://api.resend.com/emails';
exports.OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes expiry
exports.PRE_SIGNUP_TICKET_TTL_MS = 15 * 60 * 1000; // 15 minutes to submit password after OTP verified
exports.OTP_COOLDOWN_MS = 60 * 1000; // 60 seconds resend cooldown
exports.OTP_MAX_ATTEMPTS = 5; // Maximum wrong verification attempts per code
exports.OTP_MAX_HOURLY_SENDS = 8; // Anti-abuse per-hour send cap
exports.OTP_HOURLY_WINDOW_MS = 60 * 60 * 1000;
function normalizeEmail(raw) {
    return typeof raw === 'string' ? raw.trim().toLowerCase() : '';
}
function isValidEmailFormat(email) {
    if (!email || email.length > 128)
        return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}
function escapeHtmlText(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
function maskEmailAddress(email) {
    const [local, domain] = String(email || '').split('@');
    if (!local || !domain)
        return email || '';
    const visible = local.slice(0, Math.min(2, local.length));
    return `${visible}${'*'.repeat(Math.max(2, local.length - visible.length))}@${domain}`;
}
function generateSixDigitOtp() {
    return String(crypto.randomInt(100000, 1000000));
}
function buildChallengeDocId(purpose, subjectKey) {
    const digest = crypto
        .createHash('sha256')
        .update(`${purpose}:${subjectKey.trim().toLowerCase()}`)
        .digest('hex')
        .slice(0, 40);
    return `otp_${purpose}_${digest}`;
}
function computeOtpHash(params) {
    return crypto
        .createHmac('sha256', params.salt)
        .update(`${params.purpose}:${params.email}:${params.challengeId}:${params.otpCode.trim()}`)
        .digest('hex');
}
function timingSafeHexEqual(aHex, bHex) {
    if (!aHex || !bHex || aHex.length !== bHex.length)
        return false;
    try {
        const a = Buffer.from(aHex, 'hex');
        const b = Buffer.from(bHex, 'hex');
        if (a.length === 0 || a.length !== b.length)
            return false;
        return crypto.timingSafeEqual(a, b);
    }
    catch {
        return false;
    }
}
function buildResendEmailPayload(input) {
    const safeName = escapeHtmlText(input.displayName || 'Alpha Mate Member');
    const expiryMinutes = Math.floor(exports.OTP_TTL_MS / 60000);
    if (input.purpose === 'account_deletion') {
        const subject = `Alpha Mate Account Deletion Verification Code: ${input.otpCode}`;
        const text = [
            'Alpha Mate Security Verification',
            '',
            `Your 6-digit verification code to confirm your Alpha Mate account deletion request is: ${input.otpCode}`,
            '',
            `This code expires in ${expiryMinutes} minutes. Never share this code with anyone.`,
            'Once verified, your account enters a 15-day pending deletion window during which you may sign back in to recover it.',
            '',
            'If you did not initiate this request, ignore this email.',
        ].join('\n');
        const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#09070F;color:#F4F4F5;padding:28px;border-radius:16px;max-width:520px;margin:0 auto;border:1px solid #2E1A47;">
        <div style="font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#C084FC;margin-bottom:8px;">ALPHA MATE SECURITY</div>
        <h2 style="margin:0 0 8px;color:#FFFFFF;font-size:20px;">Account Deletion Verification</h2>
        <p style="margin:0 0 18px;color:#A1A1AA;font-size:14px;line-height:1.5;">
          Use the 6-digit verification code below to confirm your permanent account deletion request. This code expires in <strong>${expiryMinutes} minutes</strong>.
        </p>
        <div style="background:#160D2B;border:1px solid #A855F7;border-radius:12px;padding:18px;text-align:center;margin-bottom:18px;">
          <span style="font-family:monospace;font-size:32px;font-weight:800;letter-spacing:8px;color:#F9A8D4;">${input.otpCode}</span>
        </div>
        <p style="margin:0;color:#71717A;font-size:12px;line-height:1.5;">
          Never share this code with anyone. If you did not initiate this request, you can safely ignore this message.
        </p>
      </div>
    `;
        return {
            from: exports.RESEND_FROM_HEADER,
            to: [input.toEmail],
            subject,
            text,
            html,
        };
    }
    const isLogin = input.purpose === 'login';
    const heading = isLogin ? 'Sign In Verification Code' : 'Verify Your Email Address';
    const subject = isLogin
        ? `Your Alpha Mate Login Code: ${input.otpCode}`
        : `Your Alpha Mate Sign-Up Verification Code: ${input.otpCode}`;
    const introText = isLogin
        ? `Hi ${input.displayName || 'Alpha Mate Member'}, use this 6-digit verification code to sign in to your Alpha Mate account:`
        : `Welcome to Alpha Mate${input.displayName ? `, ${input.displayName}` : ''}! Use this 6-digit verification code to verify your email and continue setting up your account:`;
    const text = [
        introText,
        '',
        `${input.otpCode}`,
        '',
        `This code expires in ${expiryMinutes} minutes. Never share this code with anyone.`,
        '',
        'If you did not request this code, you can safely ignore this email.',
    ].join('\n');
    const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#09070F;color:#F4F4F5;padding:28px;border-radius:16px;max-width:520px;margin:0 auto;border:1px solid #2E1A47;">
      <div style="font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#C084FC;margin-bottom:8px;">ALPHA MATE</div>
      <h2 style="margin:0 0 8px;color:#FFFFFF;font-size:20px;">${heading}</h2>
      <p style="margin:0 0 18px;color:#A1A1AA;font-size:14px;line-height:1.5;">
        Hi <strong style="color:#FFFFFF;">${safeName}</strong>, ${isLogin
        ? 'enter the 6-digit code below to sign in to Alpha Mate.'
        : 'enter the 6-digit code below in Alpha Mate to verify your email address.'} This code expires in <strong>${expiryMinutes} minutes</strong>.
      </p>
      <div style="background:#160D2B;border:1px solid #A855F7;border-radius:12px;padding:18px;text-align:center;margin-bottom:18px;">
        <span style="font-family:monospace;font-size:32px;font-weight:800;letter-spacing:8px;color:#F9A8D4;">${input.otpCode}</span>
      </div>
      <p style="margin:0;color:#71717A;font-size:12px;line-height:1.5;">
        Never share this verification code with anyone. Sent securely by Alpha Mate (${exports.RESEND_SENDER_EMAIL}).
      </p>
    </div>
  `;
    return {
        from: exports.RESEND_FROM_HEADER,
        to: [input.toEmail],
        subject,
        text,
        html,
    };
}
function createResendMailer(getSecretApiKey, fetchImpl = fetch) {
    return async (input) => {
        const apiKey = (getSecretApiKey() || '').trim();
        if (!apiKey) {
            const err = new Error('Email OTP service is not configured yet. Configure the RESEND_API_KEY secret in Firebase Secret Manager.');
            err.code = 'EMAIL_OTP_NOT_CONFIGURED';
            throw err;
        }
        const payload = buildResendEmailPayload(input);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12_000);
        try {
            const response = await fetchImpl(exports.RESEND_API_URL, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
                signal: controller.signal,
            });
            const bodyJson = (await response.json().catch(() => null));
            if (!response.ok) {
                const reason = bodyJson?.message ||
                    bodyJson?.error ||
                    `HTTP ${response.status}`;
                const err = new Error(`Resend email delivery failed: ${String(reason).slice(0, 180)}`);
                err.code = 'RESEND_DELIVERY_FAILED';
                throw err;
            }
            return { messageId: bodyJson?.id || null };
        }
        finally {
            clearTimeout(timeout);
        }
    };
}
class EmailOtpServiceEngine {
    store;
    authAdapter;
    mailer;
    now;
    generateOtp;
    constructor(deps) {
        this.store = deps.store;
        this.authAdapter = deps.authAdapter;
        this.mailer = deps.mailer;
        this.now = deps.now || (() => Date.now());
        this.generateOtp = deps.generateOtp || generateSixDigitOtp;
    }
    async issueAndSendChallenge(params) {
        const nowMs = this.now();
        const nowIso = new Date(nowMs).toISOString();
        const docId = buildChallengeDocId(params.purpose, `${params.uid}:${params.email}`);
        const otpCode = this.generateOtp();
        const challengeId = crypto.randomBytes(16).toString('hex');
        const salt = crypto.randomBytes(16).toString('hex');
        const expiresAtMs = nowMs + exports.OTP_TTL_MS;
        const expiresAtIso = new Date(expiresAtMs).toISOString();
        const otpHash = computeOtpHash({
            purpose: params.purpose,
            email: params.email,
            challengeId,
            salt,
            otpCode,
        });
        const reservation = await this.store.runAtomic(docId, (existing, save) => {
            if (existing && existing.lastSentAtMs > 0) {
                const elapsedMs = nowMs - existing.lastSentAtMs;
                if (elapsedMs < exports.OTP_COOLDOWN_MS) {
                    const waitSec = Math.max(1, Math.ceil((exports.OTP_COOLDOWN_MS - elapsedMs) / 1000));
                    return {
                        allowed: false,
                        code: 'OTP_COOLDOWN',
                        retryAfterSeconds: waitSec,
                        error: `Please wait ${waitSec}s before requesting another verification code.`,
                    };
                }
            }
            let windowStartMs = existing?.hourlyWindowStartMs || nowMs;
            let hourlyCount = existing?.hourlySendCount || 0;
            if (nowMs - windowStartMs >= exports.OTP_HOURLY_WINDOW_MS) {
                windowStartMs = nowMs;
                hourlyCount = 0;
            }
            if (hourlyCount >= exports.OTP_MAX_HOURLY_SENDS) {
                const retrySec = Math.max(60, Math.ceil((exports.OTP_HOURLY_WINDOW_MS - (nowMs - windowStartMs)) / 1000));
                return {
                    allowed: false,
                    code: 'OTP_RATE_LIMITED',
                    retryAfterSeconds: retrySec,
                    error: 'Too many OTP requests for this email. Please wait a little while and try again.',
                };
            }
            save({
                docId,
                purpose: params.purpose,
                uid: params.uid,
                email: params.email,
                challengeId,
                salt,
                otpHash,
                attempts: 0,
                consumed: false,
                createdAt: nowIso,
                createdAtMs: nowMs,
                expiresAt: expiresAtIso,
                expiresAtMs,
                lastSentAtMs: nowMs,
                hourlyWindowStartMs: windowStartMs,
                hourlySendCount: hourlyCount + 1,
                updatedAt: nowIso,
            });
            return { allowed: true, previousRecord: existing };
        });
        if (!reservation.allowed) {
            return {
                success: false,
                code: reservation.code,
                retryAfterSeconds: reservation.retryAfterSeconds,
                error: reservation.error,
            };
        }
        try {
            await this.mailer({
                toEmail: params.email,
                otpCode,
                purpose: params.purpose,
                displayName: params.displayName,
            });
        }
        catch (err) {
            const prev = reservation.previousRecord;
            await this.store
                .runAtomic(docId, (_curr, save) => {
                if (prev) {
                    save(prev);
                }
                else {
                    save({
                        docId,
                        purpose: params.purpose,
                        uid: params.uid,
                        email: params.email,
                        challengeId: '',
                        salt: '',
                        otpHash: '',
                        attempts: 0,
                        consumed: true,
                        createdAt: nowIso,
                        createdAtMs: nowMs,
                        expiresAt: nowIso,
                        expiresAtMs: nowMs,
                        lastSentAtMs: 0,
                        hourlyWindowStartMs: nowMs,
                        hourlySendCount: 0,
                        updatedAt: nowIso,
                    });
                }
            })
                .catch(() => { });
            const typedErr = err;
            return {
                success: false,
                code: typedErr?.code || 'RESEND_DELIVERY_FAILED',
                error: typedErr?.message || 'Failed to send verification code email.',
            };
        }
        return {
            success: true,
            emailMasked: maskEmailAddress(params.email),
            challengeToken: challengeId,
            expiresAt: expiresAtMs,
            expiresInSeconds: Math.floor(exports.OTP_TTL_MS / 1000),
            cooldownSeconds: Math.floor(exports.OTP_COOLDOWN_MS / 1000),
            provider: 'resend',
        };
    }
    async validateChallengeAndConsume(params) {
        const cleanToken = String(params.challengeToken || '').trim();
        const cleanOtp = String(params.otp || '').replace(/\s+/g, '');
        if (!cleanToken || !/^\d{6}$/.test(cleanOtp)) {
            return {
                valid: false,
                code: 'OTP_MALFORMED',
                error: 'Please enter the exact 6-digit verification code sent to your email.',
            };
        }
        const nowMs = this.now();
        const nowIso = new Date(nowMs).toISOString();
        const docId = buildChallengeDocId(params.purpose, `${params.uid}:${params.email}`);
        return this.store.runAtomic(docId, (existing, save) => {
            if (!existing || !existing.challengeId || existing.consumed) {
                return {
                    valid: false,
                    code: 'OTP_SESSION_INVALID',
                    error: 'This verification code has already been used or replaced. Please request a new code.',
                };
            }
            if (existing.uid !== params.uid || existing.email !== params.email || existing.purpose !== params.purpose) {
                return {
                    valid: false,
                    code: 'OTP_ACCOUNT_MISMATCH',
                    error: 'This verification challenge does not match the active account.',
                };
            }
            if (existing.challengeId !== cleanToken) {
                return {
                    valid: false,
                    code: 'OTP_SUPERSEDED',
                    error: 'A newer verification code was sent. Please enter the latest 6-digit code from your inbox.',
                };
            }
            if (nowMs > existing.expiresAtMs) {
                save({
                    ...existing,
                    consumed: true,
                    updatedAt: nowIso,
                });
                return {
                    valid: false,
                    code: 'OTP_EXPIRED',
                    error: 'Verification code has expired (valid for 10 minutes). Please tap Resend OTP.',
                };
            }
            if (existing.attempts >= exports.OTP_MAX_ATTEMPTS) {
                return {
                    valid: false,
                    code: 'OTP_MAX_ATTEMPTS',
                    remainingAttempts: 0,
                    error: 'Too many incorrect attempts. Please tap Resend OTP to receive a fresh 6-digit code.',
                };
            }
            const candidateHash = computeOtpHash({
                purpose: params.purpose,
                email: params.email,
                challengeId: existing.challengeId,
                salt: existing.salt,
                otpCode: cleanOtp,
            });
            if (!timingSafeHexEqual(candidateHash, existing.otpHash)) {
                const nextAttempts = existing.attempts + 1;
                const remaining = Math.max(0, exports.OTP_MAX_ATTEMPTS - nextAttempts);
                save({
                    ...existing,
                    attempts: nextAttempts,
                    consumed: nextAttempts >= exports.OTP_MAX_ATTEMPTS ? true : existing.consumed,
                    updatedAt: nowIso,
                });
                return {
                    valid: false,
                    code: remaining === 0 ? 'OTP_MAX_ATTEMPTS' : 'OTP_INVALID',
                    remainingAttempts: remaining,
                    error: remaining > 0
                        ? `Incorrect verification code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
                        : 'Too many incorrect attempts. Please tap Resend OTP to receive a fresh 6-digit code.',
                };
            }
            save({
                ...existing,
                consumed: true,
                verifiedAt: nowIso,
                verifiedAtMs: nowMs,
                updatedAt: nowIso,
            });
            return {
                valid: true,
                verifiedAtIso: nowIso,
            };
        });
    }
    /**
     * Step 1 of Email Sign-Up: Send 6-digit OTP to email BEFORE password creation.
     * Allows brand-new emails as well as existing Google-only emails that have not set a password yet
     * so that setting a password links onto the exact same account UID.
     */
    async sendPreSignupOtp(params) {
        const cleanEmail = normalizeEmail(params.email);
        if (!isValidEmailFormat(cleanEmail)) {
            return {
                success: false,
                code: 'INVALID_EMAIL',
                error: 'Please enter a valid email address.',
            };
        }
        const existingUser = await this.authAdapter.getUserByEmail(cleanEmail);
        if (existingUser?.disabled) {
            return {
                success: false,
                code: 'ACCOUNT_DISABLED',
                error: 'This account has been disabled. Please contact support@alphamate.app.',
            };
        }
        if (existingUser && existingUser.emailVerified && existingUser.hasPasswordProvider) {
            return {
                success: false,
                code: 'EMAIL_ALREADY_REGISTERED',
                error: 'An account with this email already has a password. Please Sign In or Continue with Google.',
            };
        }
        return this.issueAndSendChallenge({
            purpose: 'pre_signup',
            uid: 'pre_signup',
            email: cleanEmail,
            displayName: existingUser?.displayName,
        });
    }
    /**
     * Step 2 of Email Sign-Up: Verify the 6-digit OTP and issue a short-lived single-use registrationTicket
     * allowing the user to set their password in Step 3.
     */
    async verifyPreSignupOtp(params) {
        const cleanEmail = normalizeEmail(params.email);
        if (!isValidEmailFormat(cleanEmail)) {
            return {
                success: false,
                code: 'INVALID_EMAIL',
                error: 'Please enter a valid email address.',
            };
        }
        const check = await this.validateChallengeAndConsume({
            purpose: 'pre_signup',
            uid: 'pre_signup',
            email: cleanEmail,
            challengeToken: params.challengeToken,
            otp: params.otp,
        });
        if (!check.valid) {
            return {
                success: false,
                code: check.code,
                remainingAttempts: check.remainingAttempts,
                error: check.error,
            };
        }
        const nowMs = this.now();
        const nowIso = new Date(nowMs).toISOString();
        const expiresAtMs = nowMs + exports.PRE_SIGNUP_TICKET_TTL_MS;
        const expiresAtIso = new Date(expiresAtMs).toISOString();
        const ticketDocId = buildChallengeDocId('pre_signup_ticket', `pre_signup:${cleanEmail}`);
        const registrationTicket = crypto.randomBytes(24).toString('hex');
        const ticketSalt = crypto.randomBytes(16).toString('hex');
        const ticketId = crypto.randomBytes(12).toString('hex');
        const ticketHash = computeOtpHash({
            purpose: 'pre_signup_ticket',
            email: cleanEmail,
            challengeId: ticketId,
            salt: ticketSalt,
            otpCode: registrationTicket,
        });
        await this.store.runAtomic(ticketDocId, (_existing, save) => {
            save({
                docId: ticketDocId,
                purpose: 'pre_signup_ticket',
                uid: 'pre_signup',
                email: cleanEmail,
                challengeId: ticketId,
                salt: ticketSalt,
                otpHash: ticketHash,
                attempts: 0,
                consumed: false,
                createdAt: nowIso,
                createdAtMs: nowMs,
                expiresAt: expiresAtIso,
                expiresAtMs,
                lastSentAtMs: nowMs,
                hourlyWindowStartMs: nowMs,
                hourlySendCount: 1,
                verifiedAt: check.verifiedAtIso,
                verifiedAtMs: nowMs,
                updatedAt: nowIso,
            });
        });
        return {
            success: true,
            email: cleanEmail,
            registrationTicket: `${ticketId}.${registrationTicket}`,
            emailVerifiedAt: check.verifiedAtIso,
        };
    }
    /**
     * Step 3 of Email Sign-Up: Consume verified registrationTicket, create or link password on the
     * exact same email account UID, mark emailVerified: true, and return uid + customToken.
     */
    async completePreSignupWithPassword(params) {
        const cleanEmail = normalizeEmail(params.email);
        if (!isValidEmailFormat(cleanEmail)) {
            return {
                success: false,
                code: 'INVALID_EMAIL',
                error: 'Please enter a valid email address.',
            };
        }
        const rawPassword = typeof params.password === 'string' ? params.password : '';
        if (rawPassword.length < 6 || rawPassword.length > 128) {
            return {
                success: false,
                code: 'WEAK_PASSWORD',
                error: 'Password must be between 6 and 128 characters.',
            };
        }
        const [ticketId, ticketSecret] = String(params.registrationTicket || '').trim().split('.');
        if (!ticketId || !ticketSecret) {
            return {
                success: false,
                code: 'TICKET_INVALID',
                error: 'Your email verification session expired. Please verify your email OTP again.',
            };
        }
        if (!this.authAdapter.upsertVerifiedPasswordUser) {
            return {
                success: false,
                code: 'UPSERT_UNSUPPORTED',
                error: 'Password registration adapter is not configured.',
            };
        }
        const nowMs = this.now();
        const nowIso = new Date(nowMs).toISOString();
        const ticketDocId = buildChallengeDocId('pre_signup_ticket', `pre_signup:${cleanEmail}`);
        const ticketCheck = await this.store.runAtomic(ticketDocId, (existing, save) => {
            if (!existing || existing.consumed || existing.purpose !== 'pre_signup_ticket') {
                return {
                    ok: false,
                    code: 'TICKET_CONSUMED',
                    error: 'This email verification session has already been used. Please sign in or request a new OTP.',
                };
            }
            if (existing.email !== cleanEmail || existing.challengeId !== ticketId) {
                return {
                    ok: false,
                    code: 'TICKET_MISMATCH',
                    error: 'Verification ticket does not match this email address.',
                };
            }
            if (nowMs > existing.expiresAtMs) {
                save({ ...existing, consumed: true, updatedAt: nowIso });
                return {
                    ok: false,
                    code: 'TICKET_EXPIRED',
                    error: 'Verification session expired. Please verify your 6-digit email OTP again.',
                };
            }
            const candidateHash = computeOtpHash({
                purpose: 'pre_signup_ticket',
                email: cleanEmail,
                challengeId: existing.challengeId,
                salt: existing.salt,
                otpCode: ticketSecret,
            });
            if (!timingSafeHexEqual(candidateHash, existing.otpHash)) {
                return {
                    ok: false,
                    code: 'TICKET_INVALID',
                    error: 'Invalid email verification token. Please verify your OTP again.',
                };
            }
            save({
                ...existing,
                consumed: true,
                updatedAt: nowIso,
            });
            return {
                ok: true,
                verifiedAtIso: existing.verifiedAt || nowIso,
            };
        });
        if (!ticketCheck.ok) {
            return {
                success: false,
                code: ticketCheck.code,
                error: ticketCheck.error,
            };
        }
        const created = await this.authAdapter.upsertVerifiedPasswordUser(cleanEmail, rawPassword, ticketCheck.verifiedAtIso);
        return {
            success: true,
            uid: created.uid,
            email: created.email,
            emailVerifiedAt: ticketCheck.verifiedAtIso,
            customToken: created.customToken,
        };
    }
    async sendAuthenticatedOtp(params) {
        const authUser = await this.authAdapter.getUserByUid(params.uid);
        const registeredEmail = normalizeEmail(authUser?.email || params.tokenEmail);
        if (!registeredEmail || !isValidEmailFormat(registeredEmail)) {
            return {
                success: false,
                code: 'MISSING_ACCOUNT_EMAIL',
                error: 'No valid email address is associated with this account.',
            };
        }
        const reqEmail = normalizeEmail(params.requestedEmail);
        if (reqEmail && reqEmail !== registeredEmail) {
            return {
                success: false,
                code: 'EMAIL_MISMATCH',
                error: 'Verification codes can only be sent to your registered account email address.',
            };
        }
        if (params.purpose === 'signup' && authUser?.emailVerified) {
            return {
                success: true,
                alreadyVerified: true,
                emailMasked: maskEmailAddress(registeredEmail),
            };
        }
        return this.issueAndSendChallenge({
            purpose: params.purpose,
            uid: params.uid,
            email: registeredEmail,
            displayName: params.displayName || authUser?.displayName,
        });
    }
    async verifyAuthenticatedOtp(params) {
        const authUser = await this.authAdapter.getUserByUid(params.uid);
        const registeredEmail = normalizeEmail(authUser?.email || params.tokenEmail);
        if (!registeredEmail) {
            return {
                success: false,
                code: 'MISSING_ACCOUNT_EMAIL',
                error: 'No email address was found for this account.',
            };
        }
        const check = await this.validateChallengeAndConsume({
            purpose: params.purpose,
            uid: params.uid,
            email: registeredEmail,
            challengeToken: params.challengeToken,
            otp: params.otp,
        });
        if (!check.valid) {
            return {
                success: false,
                code: check.code,
                remainingAttempts: check.remainingAttempts,
                error: check.error,
            };
        }
        if (params.purpose === 'signup') {
            await this.authAdapter.markEmailVerified(params.uid, registeredEmail, check.verifiedAtIso);
            return {
                success: true,
                uid: params.uid,
                email: registeredEmail,
                emailVerifiedAt: check.verifiedAtIso,
            };
        }
        return {
            success: true,
            uid: params.uid,
            email: registeredEmail,
            otpVerifiedAt: check.verifiedAtIso,
        };
    }
    async sendLoginOtp(params) {
        const cleanEmail = normalizeEmail(params.email);
        if (!isValidEmailFormat(cleanEmail)) {
            return {
                success: false,
                code: 'INVALID_EMAIL',
                error: 'Please enter a valid registered email address.',
            };
        }
        const authUser = await this.authAdapter.getUserByEmail(cleanEmail);
        if (!authUser) {
            return {
                success: false,
                code: 'ACCOUNT_NOT_FOUND',
                error: 'No Alpha Mate account was found with this email. Please create an account first.',
            };
        }
        if (authUser.disabled) {
            return {
                success: false,
                code: 'ACCOUNT_DISABLED',
                error: 'This account has been disabled. Please contact support@alphamate.app.',
            };
        }
        return this.issueAndSendChallenge({
            purpose: 'login',
            uid: authUser.uid,
            email: cleanEmail,
            displayName: authUser.displayName,
        });
    }
    async verifyLoginOtp(params) {
        const cleanEmail = normalizeEmail(params.email);
        if (!isValidEmailFormat(cleanEmail)) {
            return {
                success: false,
                code: 'INVALID_EMAIL',
                error: 'Please enter a valid registered email address.',
            };
        }
        const authUser = await this.authAdapter.getUserByEmail(cleanEmail);
        if (!authUser || authUser.disabled) {
            return {
                success: false,
                code: 'ACCOUNT_NOT_FOUND',
                error: 'Account not found or unavailable.',
            };
        }
        const check = await this.validateChallengeAndConsume({
            purpose: 'login',
            uid: authUser.uid,
            email: cleanEmail,
            challengeToken: params.challengeToken,
            otp: params.otp,
        });
        if (!check.valid) {
            return {
                success: false,
                code: check.code,
                remainingAttempts: check.remainingAttempts,
                error: check.error,
            };
        }
        await this.authAdapter.markEmailVerified(authUser.uid, cleanEmail, check.verifiedAtIso);
        const customToken = await this.authAdapter.createLoginCustomToken(authUser.uid);
        return {
            success: true,
            uid: authUser.uid,
            email: cleanEmail,
            emailVerifiedAt: check.verifiedAtIso,
            customToken,
        };
    }
}
exports.EmailOtpServiceEngine = EmailOtpServiceEngine;
//# sourceMappingURL=emailOtpCore.js.map