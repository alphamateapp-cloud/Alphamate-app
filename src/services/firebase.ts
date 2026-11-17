import { initializeApp, getApps, getApp, deleteApp } from 'firebase/app';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import {
  getAuth,
  initializeAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  signInWithCredential,
  signInWithCustomToken,
  GoogleAuthProvider,
  EmailAuthProvider,
  linkWithCredential,
  updatePassword,
  updateCurrentUser,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  reload,
  signOut,
  onAuthStateChanged,
  onIdTokenChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import { getFunctions } from 'firebase/functions';
import {
  getFirestore,
  initializeFirestore,
  enableNetwork,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  updateDoc,
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  runTransaction,
  addDoc,
  deleteDoc,
  serverTimestamp,
  writeBatch,
  getDocs,
  increment,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { sanitizeAvatarString } from '../utils/imageCompressor';

interface NativeGoogleAuthPluginContract {
  signIn(options: {
    serverClientId?: string;
    forceAccountPicker?: boolean;
    useCredentialManager?: boolean;
  }): Promise<{
    idToken?: string;
    email?: string | null;
    displayName?: string | null;
    photoUrl?: string | null;
  }>;
  signOut(): Promise<void>;
}

const NativeGoogleAuth = registerPlugin<NativeGoogleAuthPluginContract>('NativeGoogleAuth');

// Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const FIRESTORE_PROJECT_ID = firebaseConfig.projectId;
export const FIRESTORE_DATABASE_ID = firebaseConfig.firestoreDatabaseId;

// CRITICAL: The app will break without passing firestoreDatabaseId
function createFirestoreInstance() {
  const isIframeOrPreview =
    typeof window !== 'undefined' &&
    (() => {
      try {
        return window.self !== window.top || window.location.hostname.endsWith('.run.app');
      } catch {
        return true;
      }
    })();
  const useForceLongPolling = Capacitor.isNativePlatform() || isIframeOrPreview;
  const settings = useForceLongPolling
    ? { experimentalForceLongPolling: true }
    : { experimentalAutoDetectLongPolling: true };

  try {
    return initializeFirestore(app, settings, firebaseConfig.firestoreDatabaseId);
  } catch {
    return getFirestore(app, firebaseConfig.firestoreDatabaseId);
  }
}

export const db = createFirestoreInstance();
// Use durable IndexedDB persistence in Capacitor Android so the Firebase JS SDK
// keeps the same session after native Google Sign-In returns an ID token.
function createFirebaseAuth() {
  if (Capacitor.isNativePlatform()) {
    try {
      return initializeAuth(app, { persistence: indexedDBLocalPersistence });
    } catch (error) {
      // Another module may already have initialized Auth.
      console.warn('Firebase Auth already initialized; using existing instance.', error);
      return getAuth(app);
    }
  }
  return getAuth(app);
}
export const auth = createFirebaseAuth();
export const functions = getFunctions(app, 'us-central1');

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

// =========================================================================
// ERROR HANDLER CONFORMING TO FirestoreErrorInfo
// =========================================================================
async function withFirestoreTimeout<T>(promise: Promise<T>, timeoutMs: number = 9000, label: string = 'Firestore operation'): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${Math.round(timeoutMs / 1000)}s. Please check your internet connection.`));
    }, timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function isFirestoreQuotaExceededError(error: unknown): boolean {
  if (!error) return false;
  const code = String((error as any)?.code || '').toLowerCase();
  const message = String(error instanceof Error ? error.message : error).toLowerCase();
  return (
    code === 'resource-exhausted' ||
    code === 'firestore/resource-exhausted' ||
    message.includes('quota exceeded') ||
    message.includes('resource-exhausted') ||
    message.includes('resource exhausted')
  );
}

export function isTransientFirestoreNetworkError(error: unknown): boolean {
  if (!error) return false;
  const code = String((error as any)?.code || '').toLowerCase();
  const message = String(error instanceof Error ? error.message : error).toLowerCase();
  return (
    code === 'unavailable' ||
    code === 'deadline-exceeded' ||
    code === 'aborted' ||
    code === 'cancelled' ||
    message.includes('timed out') ||
    message.includes('deadline-exceeded') ||
    message.includes('the client is offline') ||
    message.includes('unavailable') ||
    message.includes('network error') ||
    message.includes('failed to get document because the client is offline')
  );
}

let firestoreQuotaExceededState = false;
const firestoreQuotaListeners = new Set<(exceeded: boolean) => void>();

export function isFirestoreQuotaExceeded(): boolean {
  return firestoreQuotaExceededState;
}

export function notifyFirestoreQuotaExceeded(): void {
  if (firestoreQuotaExceededState) return;
  firestoreQuotaExceededState = true;
  firestoreQuotaListeners.forEach((cb) => {
    try {
      cb(true);
    } catch {
      // ignore subscriber errors
    }
  });
}

export function clearFirestoreQuotaExceeded(): void {
  if (!firestoreQuotaExceededState) return;
  firestoreQuotaExceededState = false;
  firestoreQuotaListeners.forEach((cb) => {
    try {
      cb(false);
    } catch {
      // ignore subscriber errors
    }
  });
}

export function subscribeToFirestoreQuotaExceeded(
  callback: (exceeded: boolean) => void
): () => void {
  firestoreQuotaListeners.add(callback);
  try {
    callback(firestoreQuotaExceededState);
  } catch {
    // ignore
  }
  return () => {
    firestoreQuotaListeners.delete(callback);
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  if (isFirestoreQuotaExceededError(error)) {
    notifyFirestoreQuotaExceeded();
  }
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function handleSnapshotListenerError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): void {
  if (isFirestoreQuotaExceededError(error)) {
    notifyFirestoreQuotaExceeded();
    console.warn(`Firestore Quota Exceeded on listener (${path || 'unknown'}); keeping cached data active.`);
    return;
  }
  handleFirestoreError(error, operationType, path);
}

export function handleBackgroundWriteError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): void {
  if (isFirestoreQuotaExceededError(error)) {
    notifyFirestoreQuotaExceeded();
    console.warn(`Firestore Quota Exceeded on background write (${path || 'unknown'}); pausing non-essential syncs.`);
    return;
  }
  if (isTransientFirestoreNetworkError(error)) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`Transient Firestore background write delay (${path || 'unknown'}): ${msg}`);
    return;
  }
  handleFirestoreError(error, operationType, path);
}

// =========================================================================
// CONNECTION TEST ON APP BOOT
// =========================================================================
export async function testConnection(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return false;
  }

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      await withFirestoreTimeout(
        getDocFromServer(doc(db, 'test', 'connection')),
        8000,
        'Firestore connection check'
      );
      clearFirestoreQuotaExceeded();
      console.log('Firebase Firestore connection verified.');
      return true;
    } catch (error) {
      if (isFirestoreQuotaExceededError(error)) {
        notifyFirestoreQuotaExceeded();
        console.warn('Firestore daily quota currently reached:', (error as Error)?.message || error);
        return false;
      }
      const message = error instanceof Error ? error.message : String(error || '');
      const isOfflineOrTimeout =
        message.includes('the client is offline') ||
        message.includes('timed out') ||
        message.includes('unavailable');

      if (isOfflineOrTimeout && attempt === 1) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        continue;
      }

      if (message.includes('the client is offline')) {
        console.error('Please check your Firebase configuration: client is offline.');
      } else {
        console.log('Firestore initialized:', message);
      }
      return false;
    }
  }
  return false;
}

// Trigger initial verification
testConnection().catch(() => {});

// =========================================================================
// AUTHENTICATION HELPER METHODS
// =========================================================================

export function isFirebaseUserVerified(fbUser: FirebaseUser | null | undefined): boolean {
  if (!fbUser) return false;
  const isGoogle = fbUser.providerData?.some((p) => p.providerId === 'google.com');
  return Boolean(fbUser.emailVerified || isGoogle);
}

export function hasFirebasePasswordProvider(fbUser: FirebaseUser | null | undefined): boolean {
  if (!fbUser) return false;
  return Boolean(fbUser.providerData?.some((p) => p.providerId === 'password'));
}

/**
 * Sign In with Google Popup (with automatic Redirect fallback if popups are blocked)
 */
function isGoogleSignInCancelledError(error: any): boolean {
  const msg = String(error?.message || '').toLowerCase();
  const code = String(error?.code || '').toLowerCase();
  return (
    msg.includes('cancel') ||
    code.includes('cancel') ||
    code === '16' ||
    code === '12501'
  );
}

function isPluginNotImplementedError(error: any): boolean {
  const msg = String(error?.message || '').toLowerCase();
  const code = String(error?.code || '').toLowerCase();
  return (
    code === 'unimplemented' ||
    msg.includes('not implemented') ||
    msg.includes('not loaded') ||
    msg.includes('unable to find plugin')
  );
}

async function withAuthTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(errorMessage));
    }, timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function signInWithGoogle(options?: { forceAccountPicker?: boolean }) {
  try {
    if (Capacitor.isNativePlatform()) {
      let idToken: string | undefined;
      let lastNativeError: any = null;
      const forceAccountPicker = options?.forceAccountPicker !== false;

      // 1. Prefer our Activity-bound NativeGoogleAuth plugin with classic GoogleSignInClient
      // account picker first so it opens reliably on all Android devices without stalling
      // inside @capacitor-firebase/authentication's CredentialManager context lookup.
      if (Capacitor.isPluginAvailable('NativeGoogleAuth')) {
        try {
          const builtInResult = await withAuthTimeout(
            NativeGoogleAuth.signIn({
              serverClientId: firebaseConfig.oAuthClientId,
              forceAccountPicker,
              useCredentialManager: false,
            }),
            65_000,
            'Google account picker timed out. Please try again.'
          );
          idToken = builtInResult?.idToken;
        } catch (nativeAuthErr: any) {
          if (isGoogleSignInCancelledError(nativeAuthErr)) {
            throw nativeAuthErr;
          }
          lastNativeError = nativeAuthErr;
        }

        // Optional Credential Manager attempt if classic chooser failed with non-cancellation error
        if (!idToken) {
          try {
            const cmBuiltInResult = await withAuthTimeout(
              NativeGoogleAuth.signIn({
                serverClientId: firebaseConfig.oAuthClientId,
                forceAccountPicker,
                useCredentialManager: true,
              }),
              45_000,
              'Google Sign-In timed out. Please try again.'
            );
            idToken = cmBuiltInResult?.idToken;
          } catch (cmBuiltInErr: any) {
            if (isGoogleSignInCancelledError(cmBuiltInErr)) {
              throw cmBuiltInErr;
            }
            lastNativeError = cmBuiltInErr;
          }
        }
      }

      // 2. Fallback to @capacitor-firebase/authentication with bounded timeouts
      if (!idToken && Capacitor.isPluginAvailable('FirebaseAuthentication')) {
        try {
          if (forceAccountPicker) {
            await withAuthTimeout(
              FirebaseAuthentication.signOut(),
              2500,
              'Native Google sign-out timed out'
            ).catch(() => {});
          }

          let nativeResult: Awaited<ReturnType<typeof FirebaseAuthentication.signInWithGoogle>>;
          try {
            nativeResult = await withAuthTimeout(
              FirebaseAuthentication.signInWithGoogle({
                useCredentialManager: false,
              }),
              45_000,
              'Google Sign-In timed out. Please try again.'
            );
          } catch (legacyPluginErr: any) {
            if (isGoogleSignInCancelledError(legacyPluginErr)) {
              throw legacyPluginErr;
            }
            nativeResult = await withAuthTimeout(
              FirebaseAuthentication.signInWithGoogle({
                useCredentialManager: true,
              }),
              35_000,
              'Google Sign-In timed out. Please try again.'
            );
          }
          idToken = nativeResult.credential?.idToken;
        } catch (fbPluginErr: any) {
          if (isGoogleSignInCancelledError(fbPluginErr)) {
            throw fbPluginErr;
          }
          lastNativeError = fbPluginErr;
        }
      } else if (!idToken && !Capacitor.isPluginAvailable('NativeGoogleAuth')) {
        throw new Error(
          'Native Google Sign-In plugin is not loaded in this Android APK build. Rebuild and sync Android (npx cap sync android && ./gradlew assembleRelease).'
        );
      }

      if (!idToken) {
        if (lastNativeError && !isPluginNotImplementedError(lastNativeError)) {
          throw lastNativeError;
        }
        throw new Error(
          'Google Sign-In did not return an ID token. Verify the APK signing SHA-1/SHA-256 and Firebase Google provider configuration.'
        );
      }
      const credential = GoogleAuthProvider.credential(idToken);
      const webResult = await withAuthTimeout(
        signInWithCredential(auth, credential),
        15_000,
        'Firebase Google authentication timed out. Please check your internet connection and retry.'
      );
      return webResult.user;
    }

    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    const code = error?.code || '';
    if (
      !Capacitor.isNativePlatform() &&
      (code === 'auth/popup-blocked' ||
       code === 'auth/operation-not-supported-in-this-environment')
    ) {
      try {
        sessionStorage.setItem('alphamate_google_redirect_pending', '1');
      } catch {}
      await signInWithRedirect(auth, googleProvider);
      return null;
    }
    // Never log OAuth tokens or credentials.
    console.error('Google Sign-In Error:', {
      code: error?.code,
      message: error?.message,
    });
    throw error;
  }
}

/**
 * Resolve any pending Google redirect sign-in on boot
 */
export async function consumeGoogleRedirectResult(): Promise<FirebaseUser | null> {
  // Native Capacitor Google Sign-In does not use browser redirect handling.
  if (Capacitor.isNativePlatform()) return null;
  try {
    const result = await getRedirectResult(auth);
    try {
      sessionStorage.removeItem('alphamate_google_redirect_pending');
    } catch {}
    return result?.user || null;
  } catch (error) {
    try {
      sessionStorage.removeItem('alphamate_google_redirect_pending');
    } catch {}
    console.warn('Google Redirect Result Error:', error);
    return null;
  }
}

/**
 * Sign In with Email & Password
 */
export async function signInWithEmail(email: string, pass: string) {
  try {
    const result = await signInWithEmailAndPassword(auth, email, pass);
    return result.user;
  } catch (error: any) {
    console.error('Email Sign-In Error:', error);
    throw error;
  }
}

/**
 * Register with Email & Password (optionally skip Firebase verification link when using Resend Email OTP)
 */
export async function registerWithEmail(
  email: string,
  pass: string,
  options?: { skipVerificationEmail?: boolean }
) {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, pass);
    if (!options?.skipVerificationEmail && result.user && !result.user.emailVerified) {
      await sendEmailVerification(result.user).catch((err) => {
        console.warn('Could not send verification email:', err);
      });
    }
    return result.user;
  } catch (error: any) {
    console.error('Email Registration Error:', error);
    throw error;
  }
}

export async function resendVerificationEmail() {
  if (!auth.currentUser) {
    throw new Error('No active account found to verify.');
  }
  await sendEmailVerification(auth.currentUser);
}

export async function reloadCurrentFirebaseUser(): Promise<FirebaseUser | null> {
  if (!auth.currentUser) return null;
  await reload(auth.currentUser);
  return auth.currentUser;
}

export async function sendPasswordReset(email: string) {
  await sendPasswordResetEmail(auth, email.trim());
}

/**
 * Sign in with a server-minted Firebase Custom Token (used after server-side Email OTP login validation)
 */
export async function signInWithFirebaseCustomToken(customToken: string): Promise<FirebaseUser> {
  const result = await signInWithCustomToken(auth, customToken);
  return result.user;
}

/**
 * Attach or update an Email/Password credential on the currently signed-in Firebase user
 * (e.g., when a Google user sets their password during in-app registration so both Google and
 * Email+Password open the exact same UID).
 */
export async function linkOrSetUserPassword(email: string, password: string): Promise<FirebaseUser> {
  const activeUser = auth.currentUser;
  if (!activeUser) {
    throw new Error('No active authenticated session found to attach password.');
  }
  const cleanEmail = (email || activeUser.email || '').trim().toLowerCase();
  if (!cleanEmail) {
    throw new Error('No email address is associated with this account.');
  }

  const alreadyHasPassword = hasFirebasePasswordProvider(activeUser);
  if (alreadyHasPassword) {
    await updatePassword(activeUser, password);
    await reload(activeUser).catch(() => {});
    return auth.currentUser || activeUser;
  }

  try {
    const cred = EmailAuthProvider.credential(cleanEmail, password);
    const linked = await linkWithCredential(activeUser, cred);
    return linked.user;
  } catch (err: any) {
    if (err?.code === 'auth/provider-already-linked') {
      await updatePassword(activeUser, password);
      await reload(activeUser).catch(() => {});
      return auth.currentUser || activeUser;
    }
    throw err;
  }
}

/**
 * Serialize a FirebaseUser (including stsTokenManager refresh token) for instant multi-account switching on this device.
 */
export function serializeFirebaseUserBlob(
  fbUser: FirebaseUser | null | undefined
): Record<string, any> | null {
  if (!fbUser || typeof (fbUser as any).toJSON !== 'function') return null;
  try {
    const raw = (fbUser as any).toJSON();
    if (!raw || typeof raw !== 'object' || !raw.uid || !raw.stsTokenManager?.refreshToken) {
      return null;
    }
    return JSON.parse(JSON.stringify(raw));
  } catch {
    return null;
  }
}

/**
 * Reconstruct and activate a previously authenticated FirebaseUser on the default Auth instance
 * without prompting for password or OTP.
 */
export async function hydrateFirebaseUserOnDefaultAuth(
  persistedBlob: Record<string, any> | null | undefined
): Promise<FirebaseUser | null> {
  if (!persistedBlob?.uid || !persistedBlob?.stsTokenManager?.refreshToken) {
    return null;
  }

  const existingUser = auth.currentUser;
  if (existingUser && existingUser.uid === persistedBlob.uid) {
    await existingUser.getIdToken().catch(() => {});
    return existingUser;
  }

  const normalizedBlob = {
    ...persistedBlob,
    apiKey: firebaseConfig.apiKey,
    appName: auth.name,
  };

  let userCtor: any = (auth.currentUser as any)?.constructor;
  let tempApp: ReturnType<typeof initializeApp> | null = null;
  const tempName = `alphamate_hydrator_${Date.now()}`;
  const storageKey = `firebase:authUser:${firebaseConfig.apiKey}:${tempName}`;

  try {
    if (!userCtor || typeof userCtor._fromJSON !== 'function') {
      localStorage.setItem(storageKey, JSON.stringify({ ...normalizedBlob, appName: tempName }));
      tempApp = initializeApp(firebaseConfig, tempName);
      const tempAuth = initializeAuth(tempApp, { persistence: browserLocalPersistence });
      if (typeof (tempAuth as any).authStateReady === 'function') {
        await (tempAuth as any).authStateReady();
      }
      userCtor = (tempAuth.currentUser as any)?.constructor;
    }

    if (!userCtor || typeof userCtor._fromJSON !== 'function') {
      return null;
    }

    const hydratedUser: FirebaseUser = userCtor._fromJSON(auth as any, normalizedBlob);
    await updateCurrentUser(auth, hydratedUser);
    await hydratedUser.getIdToken(true);
    return auth.currentUser || hydratedUser;
  } catch (err) {
    console.warn('Multi-account local token hydration warning:', err);
    return null;
  } finally {
    try {
      localStorage.removeItem(storageKey);
    } catch {}
    if (tempApp) {
      await deleteApp(tempApp).catch(() => {});
    }
  }
}

/**
 * Detach the active user from default Auth without revoking saved refresh tokens on other slots
 * (used when starting the "Add New Account" flow).
 */
export async function clearDefaultAuthCurrentUser(): Promise<void> {
  try {
    await updateCurrentUser(auth, null);
  } catch {
    await signOut(auth).catch(() => {});
  }
}

/**
 * Check if a username is available across Firestore users (excluding the caller's own UID).
 */
export async function checkUsernameAvailabilityFirestore(
  username: string,
  excludeUid?: string
): Promise<boolean> {
  const clean = String(username || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '');
  if (clean.length < 3) return false;
  if (isFirestoreQuotaExceeded()) return true;

  try {
    const snap = await getDocs(
      query(collection(db, 'users'), where('usernameLower', '==', clean), limit(5))
    );
    for (const d of snap.docs) {
      if (!excludeUid || d.id !== excludeUid) {
        return false;
      }
    }
    return true;
  } catch (err) {
    if (isFirestoreQuotaExceededError(err)) {
      notifyFirestoreQuotaExceeded();
    }
    return true;
  }
}

/**
 * Log Out
 */
export async function logoutUser() {
  try {
    if (Capacitor.isNativePlatform()) {
      if (Capacitor.isPluginAvailable('FirebaseAuthentication')) {
        await withAuthTimeout(FirebaseAuthentication.signOut(), 2500, 'Sign out timeout').catch(() => {});
      }
      if (Capacitor.isPluginAvailable('NativeGoogleAuth')) {
        await withAuthTimeout(NativeGoogleAuth.signOut(), 2500, 'Sign out timeout').catch(() => {});
      }
    }
    await signOut(auth);
  } catch (error: any) {
    console.error('Sign-Out Error:', error);
    throw error;
  }
}

export { onAuthStateChanged, onIdTokenChanged };
export type { FirebaseUser };

// =========================================================================
// FIRESTORE REAL-TIME DATA HELPERS
// =========================================================================

function stripUndefinedFields<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => stripUndefinedFields(item)) as unknown as T;
  }
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value as Record<string, any>)) {
      if (v !== undefined) {
        out[k] = stripUndefinedFields(v);
      }
    }
    return out as T;
  }
  return value;
}

/**
 * Save / Update User Profile in Firestore
 */
export async function syncUserProfileToFirestore(
  userData: any,
  options?: { background?: boolean }
) {
  if (!userData?.id) return;
  if (options?.background && isFirestoreQuotaExceeded()) return;
  const path = `users/${userData.id}`;
  try {
    const { password: _omitPassword, coverImage, ...restUser } = userData;
    const rawProfile: Record<string, any> = {
      ...restUser,
      usernameLower: String(userData.username || '').trim().toLowerCase(),
      displayNameLower: String(userData.displayName || '').trim().toLowerCase(),
      uniqueIdLower: String(userData.uniqueId || '').trim().toLowerCase(),
      avatar: sanitizeAvatarString(userData.avatar),
      updatedAt: new Date().toISOString(),
    };

    // Prevent oversized base64 cover images (>80KB) or undefined values from breaking setDoc
    if (typeof coverImage === 'string' && coverImage.length > 0 && coverImage.length <= 80000) {
      rawProfile.coverImage = coverImage;
    }

    const sanitizedProfile = stripUndefinedFields(rawProfile);
    await withFirestoreTimeout(
      setDoc(doc(db, 'users', userData.id), sanitizedProfile, { merge: true }),
      9000,
      'User profile sync'
    );
  } catch (error) {
    if (options?.background) {
      handleBackgroundWriteError(error, OperationType.WRITE, path);
      return;
    }
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Fetch User Profile from Firestore
 */
export async function getUserProfileFromFirestore(userId: string) {
  const path = `users/${userId}`;
  try {
    const snap = await withFirestoreTimeout(
      getDoc(doc(db, 'users', userId)),
      9000,
      'Loading user profile'
    );
    return snap.exists() ? snap.data() : null;
  } catch (error) {
    if (isFirestoreQuotaExceededError(error)) {
      notifyFirestoreQuotaExceeded();
      console.warn(`Firestore quota reached loading profile (${path}); falling back to local cache.`);
      throw error;
    }
    handleFirestoreError(error, OperationType.GET, path);
  }
}

/**
 * Real-time Listener for User Profile
 */
export function subscribeToUserProfile(userId: string, onUpdate: (data: any) => void) {
  const path = `users/${userId}`;
  return onSnapshot(
    doc(db, 'users', userId),
    (snap) => {
      if (snap.exists()) {
        onUpdate(snap.data());
      }
    },
    (error) => {
      handleSnapshotListenerError(error, OperationType.GET, path);
    }
  );
}

/**
 * Safe real-time Listener for viewing another user's public Firestore profile
 */
export function subscribeToPublicUserProfile(
  userId: string,
  onUpdate: (data: Record<string, any> | null) => void
): () => void {
  const cleanId = String(userId || '').trim();
  if (!cleanId || !FIRESTORE_VALID_ID_RE.test(cleanId) || cleanId.startsWith('user_') || isFirestoreQuotaExceeded()) {
    return () => {};
  }
  return onSnapshot(
    doc(db, 'users', cleanId),
    (snap) => {
      onUpdate(snap.exists() ? ({ id: snap.id, ...snap.data() } as Record<string, any>) : null);
    },
    (error) => {
      if (isFirestoreQuotaExceededError(error)) {
        notifyFirestoreQuotaExceeded();
      }
      console.warn('Public user profile listener warning:', error);
    }
  );
}

export function getCanonicalPartyRoomId(hostUid: string): string {
  return `party_host_${String(hostUid || '').trim()}`;
}

export function getCanonicalLiveStreamId(hostUid: string): string {
  return `live_host_${String(hostUid || '').trim()}`;
}

export function isLegacyErrorCardId(id: string): boolean {
  return /^party_\d+$/.test(id) || /^live_my_\d+$/.test(id);
}

/**
 * Purge legacy, duplicate, or stuck Party Room & Solo Live cards owned by the signed-in host.
 */
export async function purgeStaleHostCardsInFirestore(
  hostUid: string,
  options?: { keepPartyId?: string | null; keepLiveId?: string | null }
): Promise<void> {
  if (!hostUid || auth.currentUser?.uid !== hostUid || isFirestoreQuotaExceeded()) return;

  try {
    const myRoomsSnap = await getDocs(
      query(collection(db, 'partyRooms'), where('host.id', '==', hostUid), limit(25))
    );
    const canonicalPartyId = getCanonicalPartyRoomId(hostUid);
    const keepPartyId = options?.keepPartyId ?? canonicalPartyId;
    await Promise.all(
      myRoomsSnap.docs.map(async (d) => {
        const data = d.data() as any;
        const shouldRemove =
          isLegacyErrorCardId(d.id) ||
          data?.isActive === false ||
          data?.roomStatus === 'ended' ||
          !Array.isArray(data?.seats) ||
          (keepPartyId ? d.id !== keepPartyId : true);
        if (shouldRemove) {
          await deleteDoc(doc(db, 'partyRooms', d.id)).catch(() => {});
        }
      })
    );
  } catch (err) {
    if (isFirestoreQuotaExceededError(err)) {
      notifyFirestoreQuotaExceeded();
      return;
    }
  }

  try {
    const myStreamsSnap = await getDocs(
      query(collection(db, 'liveStreams'), where('host.id', '==', hostUid), limit(25))
    );
    const keepLiveId = options?.keepLiveId || null;
    await Promise.all(
      myStreamsSnap.docs.map(async (d) => {
        if (!keepLiveId || d.id !== keepLiveId || isLegacyErrorCardId(d.id)) {
          await deleteDoc(doc(db, 'liveStreams', d.id)).catch(() => {});
        }
      })
    );
  } catch (err) {
    if (isFirestoreQuotaExceededError(err)) {
      notifyFirestoreQuotaExceeded();
    }
  }
}

/**
 * Save Party Room to Firestore with Payload Sanitization
 * Strips unbounded sub-objects, large base64 photos, and cover images to stay well below 1MB.
 */
export async function syncPartyRoomToFirestore(room: any) {
  if (!room?.id || isLegacyErrorCardId(room.id) || isFirestoreQuotaExceeded()) return;
  const path = `partyRooms/${room.id}`;
  try {
    const parsedViewers =
      typeof room.activeViewers === 'number' && Number.isFinite(room.activeViewers)
        ? Math.max(0, Math.floor(room.activeViewers))
        : 0;
    const sanitizedRoom = {
      id: room.id,
      title: (room.title || '').slice(0, 100),
      category: room.category || 'Chat',
      announcement: (room.announcement || '').slice(0, 200),
      activeViewers: parsedViewers,
      isHostPresent: room.isHostPresent !== false,
      level: Number(room.level) || 1,
      totalGiftCoins: Number(room.totalGiftCoins) || 0,
      isActive: room.isActive !== false,
      roomStatus: room.isActive !== false ? 'ready' : 'ended',
      coverImageUrl: typeof room.coverImageUrl === 'string' && room.coverImageUrl.startsWith('https://') ? room.coverImageUrl : '',
      backgroundTheme: room.backgroundTheme || 'from-[#1E103A] to-[#0A0614]',
      nowPlaying: room.nowPlaying || '',
      moderatorIds: (room.moderatorIds || []).slice(0, 10),
      kickedUserIds: (room.kickedUserIds || []).slice(0, 100),
      blockedUserIds: (room.blockedUserIds || []).slice(0, 100),
      host: {
        id: room.host?.id || '',
        uniqueId: room.host?.uniqueId || room.host?.id || '',
        displayName: room.host?.displayName || 'Host',
        username: room.host?.username || '',
        avatar: sanitizeAvatarString(room.host?.avatar),
        level: Number(room.host?.level ?? 0),
        vipTier: Number(room.host?.vipTier ?? 0),
        isVerified: !!room.host?.isVerified,
      },
      seats: (Array.isArray(room.seats) ? room.seats : []).map((s: any) => ({
        seatIndex: Number(s.seatIndex),
        isMuted: !!s.isMuted,
        isHostMuted: !!s.isHostMuted,
        isLocked: !!s.isLocked,
        isSpeaking: !!s.isSpeaking,
        receivedCoins: Number(s.receivedCoins) || 0,
        user: s.user
          ? {
              id: s.user.id,
              uniqueId: s.user.uniqueId || s.user.id,
              displayName: s.user.displayName,
              avatar: sanitizeAvatarString(s.user.avatar),
              level: Number(s.user.level ?? 0),
              vipTier: Number(s.user.vipTier ?? 0),
              isVerified: !!s.user.isVerified,
            }
          : null,
      })),
      lastSeenAtMs: Date.now(),
      updatedAt: new Date().toISOString(),
    };

    const sanitizedPayload = stripUndefinedFields(sanitizedRoom);
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        await withFirestoreTimeout(
          setDoc(doc(db, 'partyRooms', room.id), sanitizedPayload, { merge: true }),
          15000,
          'Party Room sync'
        );
        break;
      } catch (err) {
        if (attempt === 1 && isTransientFirestoreNetworkError(err)) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }
        throw err;
      }
    }
  } catch (error) {
    if (isFirestoreQuotaExceededError(error)) {
      notifyFirestoreQuotaExceeded();
      return;
    }
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

/**
 * Update specific Party Room fields (moderation, seat mute/lock, metadata)
 */
export async function updatePartyRoomFields(roomId: string, fields: Record<string, any>) {
  if (!roomId || isFirestoreQuotaExceeded()) return;
  const path = `partyRooms/${roomId}`;
  try {
    await updateDoc(doc(db, 'partyRooms', roomId), stripUndefinedFields({
      ...fields,
      ...(Object.prototype.hasOwnProperty.call(fields, 'seats') ? { lastSeenAtMs: Date.now() } : {}),
      updatedAt: new Date().toISOString(),
    }));
  } catch (error: any) {
    if (error?.code === 'not-found') return;
    handleBackgroundWriteError(error, OperationType.WRITE, path);
  }
}

/**
 * Permanently delete Party Room from Firestore when host chooses Close Room
 */
export async function deletePartyRoomFromFirestore(roomId: string) {
  if (!roomId) return;
  try {
    if (!isFirestoreQuotaExceeded()) {
      await updateDoc(doc(db, 'partyRooms', roomId), {
        isActive: false,
        roomStatus: 'ended',
        activeViewers: 0,
        isHostPresent: false,
        endedAt: new Date().toISOString(),
      }).catch(() => {});
    }
    await deleteDoc(doc(db, 'partyRooms', roomId));
  } catch (error) {
    if (isFirestoreQuotaExceededError(error)) {
      notifyFirestoreQuotaExceeded();
      return;
    }
    console.warn('Error deleting party room from Firestore:', error);
  }
}

/**
 * Real-time Listener for Party Rooms (strictly 1 valid active card per host, error cards excluded)
 */
export function subscribeToPartyRooms(onUpdate: (rooms: any[]) => void) {
  const path = 'partyRooms';
  const activeRoomsQuery = query(
    collection(db, 'partyRooms'),
    where('isActive', '==', true)
  );
  return onSnapshot(
    activeRoomsQuery,
    (snapshot) => {
      const byHostId = new Map<string, any>();
      const myUid = auth.currentUser?.uid || '';

      snapshot.docs.forEach((docSnap) => {
        const raw = docSnap.data() as any;
        const id = docSnap.id;
        const hostId = String(raw?.host?.id || '').trim();

        // Filter out legacy stuck/error cards or malformed documents
        if (
          !id ||
          isLegacyErrorCardId(id) ||
          !hostId ||
          raw?.isActive !== true ||
          raw?.roomStatus === 'ended'
        ) {
          if (myUid && hostId === myUid && !isFirestoreQuotaExceeded()) {
            deleteDoc(doc(db, 'partyRooms', id)).catch(() => {});
          }
          return;
        }

        const normalized = {
          ...raw,
          id,
          seats: Array.isArray(raw.seats) ? raw.seats : [],
          activeViewers:
            typeof raw.activeViewers === 'number' && Number.isFinite(raw.activeViewers)
              ? Math.max(0, Math.floor(raw.activeViewers))
              : 0,
          isHostPresent: raw.isHostPresent !== false,
        };

        const existing = byHostId.get(hostId);
        if (!existing) {
          byHostId.set(hostId, normalized);
          return;
        }

        const canonicalId = getCanonicalPartyRoomId(hostId);
        const preferIncoming =
          id === canonicalId ||
          (existing.id !== canonicalId &&
            Number(normalized.lastSeenAtMs || 0) >= Number(existing.lastSeenAtMs || 0));

        if (preferIncoming) {
          if (myUid && hostId === myUid && existing.id !== id && !isFirestoreQuotaExceeded()) {
            deleteDoc(doc(db, 'partyRooms', existing.id)).catch(() => {});
          }
          byHostId.set(hostId, normalized);
        } else if (myUid && hostId === myUid && !isFirestoreQuotaExceeded()) {
          deleteDoc(doc(db, 'partyRooms', id)).catch(() => {});
        }
      });

      onUpdate(Array.from(byHostId.values()));
    },
    (error) => {
      handleSnapshotListenerError(error, OperationType.LIST, path);
    }
  );
}

/**
 * Atomically claim or release a party seat.
 * A user may occupy only one guest seat in a room. The host seat is never claimable.
 * Firestore transaction prevents two clients from successfully claiming the same seat.
 */
export async function updatePartyRoomSeat(
  roomId: string,
  seatIndex: number,
  user: any | null,
  currentUserId?: string,
  initialMuted: boolean = false
): Promise<{ success: boolean; seats?: any[]; reason?: string }> {
  const roomRef = doc(db, 'partyRooms', roomId);
  const effectiveUserId = user?.id || currentUserId || auth.currentUser?.uid || 'guest_user';
  try {
    return await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(roomRef);
      if (!snapshot.exists()) return { success: false, reason: 'ROOM_NOT_FOUND' };

      const room = snapshot.data() as any;
      if (room.isActive === false) return { success: false, reason: 'ROOM_CLOSED' };
      const kickedIds = Array.isArray(room.kickedUserIds) ? room.kickedUserIds : [];
      const blockedIds = Array.isArray(room.blockedUserIds) ? room.blockedUserIds : [];
      if (user && (kickedIds.includes(effectiveUserId) || blockedIds.includes(effectiveUserId))) {
        return { success: false, reason: 'USER_RESTRICTED' };
      }

      const totalCapacity = room.level === 3 ? 15 : room.level === 1 ? 4 : 8;
      let seats = Array.isArray(room.seats) ? room.seats.map((seat: any) => ({ ...seat })) : [];

      while (seats.length < totalCapacity) {
        seats.push({
          seatIndex: seats.length,
          user: null,
          isMuted: false,
          isHostMuted: false,
          isLocked: false,
          isSpeaking: false,
          receivedCoins: 0,
        });
      }

      let target = seats.findIndex((seat: any) => Number(seat.seatIndex) === seatIndex);
      if (target < 0) {
        seats.push({
          seatIndex,
          user: null,
          isMuted: false,
          isHostMuted: false,
          isLocked: false,
          isSpeaking: false,
          receivedCoins: 0,
        });
        target = seats.length - 1;
      }

      const targetSeat = seats[target];

      if (!user) {
        // Leaving seat: clear any seat occupied by this user or this target seat
        seats = seats.map((s: any) => {
          if (Number(s.seatIndex) === seatIndex || (s.user && s.user.id === effectiveUserId)) {
            return { ...s, user: null, isSpeaking: false, isMuted: false, isHostMuted: false };
          }
          return s;
        });
      } else {
        if (targetSeat.isLocked) {
          return { success: false, reason: 'SEAT_LOCKED' };
        }
        if (targetSeat.user && targetSeat.user.id !== user.id) {
          return { success: false, reason: 'SEAT_OCCUPIED' };
        }

        // Vacate previous seat occupied by this user
        seats = seats.map((s: any) => {
          if (s.user && s.user.id === user.id && Number(s.seatIndex) !== seatIndex) {
            return { ...s, user: null, isSpeaking: false, isMuted: false, isHostMuted: false };
          }
          return s;
        });

        // Claim target seat
        seats[target] = {
          ...targetSeat,
          seatIndex,
          user: {
            id: user.id,
            uniqueId: user.uniqueId || user.id,
            displayName: user.displayName || user.username || 'User',
            avatar: sanitizeAvatarString(user.avatar),
            level: Number(user.level ?? 0),
            vipTier: Number(user.vipTier ?? 0),
            isVerified: !!user.isVerified,
          },
          isSpeaking: false,
          isMuted: Boolean(initialMuted || targetSeat.isHostMuted),
        };
      }

      transaction.update(roomRef, {
        seats,
        lastSeenAtMs: Date.now(),
        updatedAt: new Date().toISOString(),
      });
      return { success: true, seats };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `partyRooms/${roomId}/seats`);
    return { success: false, reason: 'FIRESTORE_ERROR' };
  }
}

/**
 * Toggle lock state on a specific guest seat (Host / Moderator action)
 */
export async function togglePartySeatLockInFirestore(
  roomId: string,
  seatIndex: number,
  isLocked: boolean
): Promise<{ success: boolean; seats?: any[] }> {
  const roomRef = doc(db, 'partyRooms', roomId);
  try {
    return await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(roomRef);
      if (!snapshot.exists()) return { success: false };
      const room = snapshot.data() as any;
      const seats = Array.isArray(room.seats) ? room.seats.map((s: any) => ({ ...s })) : [];
      const target = seats.findIndex((s: any) => Number(s.seatIndex) === seatIndex);
      if (target < 0) return { success: false };
      seats[target] = {
        ...seats[target],
        isLocked,
        ...(isLocked ? { user: null, isSpeaking: false, isMuted: false, isHostMuted: false } : {}),
      };
      transaction.update(roomRef, { seats, updatedAt: new Date().toISOString() });
      return { success: true, seats };
    });
  } catch (error) {
    console.warn('Failed to toggle seat lock:', error);
    return { success: false };
  }
}

// =========================================================================
// REAL-TIME LIVE STREAMS (SOLO & PK BROADCASTS)
// =========================================================================

export const LIVE_STREAM_STALE_MS = 180_000;

/**
 * Sync active Live Stream to Firestore ONLY with verified SFU session metadata
 */
export async function syncLiveStreamToFirestore(stream: any) {
  if (!stream?.id || isLegacyErrorCardId(stream.id) || isFirestoreQuotaExceeded()) return;
  const path = `liveStreams/${stream.id}`;
  try {
    const nowMs = Date.now();
    const sanitizedStream = {
      id: stream.id,
      title: (stream.title || 'Live Stream').slice(0, 100),
      category: stream.category || 'Live',
      tag: stream.tag || 'Live',
      viewerCount: Math.max(1, Number(stream.viewerCount) || 1),
      thumbnail: sanitizeAvatarString(stream.thumbnail || stream.host?.avatar),
      coverImageUrl: typeof stream.coverImageUrl === 'string' && stream.coverImageUrl.startsWith('https://') ? stream.coverImageUrl : '',
      isPK: !!stream.isPK,
      isActive: stream.isActive !== false && Boolean(stream.sfuSessionId),
      sfuSessionId: typeof stream.sfuSessionId === 'string' ? stream.sfuSessionId : '',
      publishedTracks: Array.isArray(stream.publishedTracks)
        ? stream.publishedTracks.map((t: any) => ({
            trackName: String(t.trackName || ''),
            mid: t.mid ? String(t.mid) : '',
            kind: t.kind === 'audio' ? 'audio' : 'video',
          }))
        : [],
      isVideoOn: stream.isVideoOn !== false,
      isMicOn: stream.isMicOn !== false,
      durationMinutes: Number(stream.durationMinutes) || 0,
      moderatorIds: Array.isArray(stream.moderatorIds) ? stream.moderatorIds.slice(0, 10) : [],
      kickedUserIds: Array.isArray(stream.kickedUserIds) ? stream.kickedUserIds.slice(0, 100) : [],
      blockedUserIds: Array.isArray(stream.blockedUserIds) ? stream.blockedUserIds.slice(0, 100) : [],
      host: {
        id: stream.host?.id || '',
        uniqueId: stream.host?.uniqueId || stream.host?.id || '',
        displayName: stream.host?.displayName || 'Host',
        username: stream.host?.username || '',
        avatar: sanitizeAvatarString(stream.host?.avatar),
        level: Number(stream.host?.level ?? 0),
        vipTier: Number(stream.host?.vipTier ?? 0),
        isVerified: !!stream.host?.isVerified,
      },
      lastHeartbeat: serverTimestamp(),
      lastHeartbeatMs: stream.lastHeartbeatMs || nowMs,
      lastSeenAt: serverTimestamp(),
      lastSeenAtMs: stream.lastSeenAtMs || nowMs,
      updatedAt: new Date(nowMs).toISOString(),
      createdAt: stream.createdAt || new Date(nowMs).toISOString(),
    };

    const sanitizedPayload = stripUndefinedFields(sanitizedStream);
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        await withFirestoreTimeout(
          setDoc(doc(db, 'liveStreams', stream.id), sanitizedPayload, { merge: true }),
          18000,
          'Live Stream sync'
        );
        break;
      } catch (err) {
        if (attempt === 1 && isTransientFirestoreNetworkError(err)) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }
        throw err;
      }
    }
  } catch (error) {
    if (isFirestoreQuotaExceededError(error)) {
      notifyFirestoreQuotaExceeded();
      return;
    }
    handleBackgroundWriteError(error, OperationType.WRITE, path);
  }
}

/**
 * Update Live Stream fields (camera/mic state, moderation, viewerCount)
 */
export async function updateLiveStreamFields(streamId: string, fields: Record<string, any>) {
  if (!streamId || isFirestoreQuotaExceeded()) return;
  const path = `liveStreams/${streamId}`;
  try {
    await updateDoc(doc(db, 'liveStreams', streamId), stripUndefinedFields({
      ...fields,
      updatedAt: new Date().toISOString(),
    }));
  } catch (error: any) {
    if (error?.code === 'not-found') return;
    handleBackgroundWriteError(error, OperationType.UPDATE, path);
  }
}

/**
 * Heartbeat update so stale/crashed streams do not leave ghost cards
 */
export async function updateLiveStreamHeartbeat(streamId: string) {
  if (!streamId || isFirestoreQuotaExceeded()) return;
  const path = `liveStreams/${streamId}`;
  try {
    const nowMs = Date.now();
    await updateDoc(doc(db, 'liveStreams', streamId), {
      lastHeartbeat: serverTimestamp(),
      lastHeartbeatMs: nowMs,
      lastSeenAt: serverTimestamp(),
      lastSeenAtMs: nowMs,
      updatedAt: new Date(nowMs).toISOString(),
    });
  } catch (error: any) {
    if (error?.code === 'not-found') return;
    if (isFirestoreQuotaExceededError(error)) {
      notifyFirestoreQuotaExceeded();
      return;
    }
    if (error?.code === 'permission-denied') {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
    console.warn('Failed to send live stream heartbeat:', error);
  }
}

/**
 * Remove Live Stream from Firestore when host finishes broadcast
 */
export async function deleteLiveStreamFromFirestore(streamId: string) {
  if (!streamId) return;
  try {
    if (!isFirestoreQuotaExceeded()) {
      await updateDoc(doc(db, 'liveStreams', streamId), {
        isActive: false,
        endedAt: new Date().toISOString(),
      }).catch(() => {});
    }
    await deleteDoc(doc(db, 'liveStreams', streamId));
  } catch (error) {
    if (isFirestoreQuotaExceededError(error)) {
      notifyFirestoreQuotaExceeded();
      return;
    }
    console.warn('Error deleting live stream from Firestore:', error);
  }
}

/**
 * Subscribe to real-time Live Streams list across all users/devices.
 * Strictly exposes 1 active broadcast card per host with a published SFU session,
 * using Firestore server timestamps so client clock skew never hides a fresh card.
 */
export function subscribeToLiveStreams(onUpdate: (streams: any[]) => void) {
  const path = 'liveStreams';
  const activeStreamsQuery = query(
    collection(db, 'liveStreams'),
    where('isActive', '==', true)
  );
  return onSnapshot(
    activeStreamsQuery,
    (snapshot) => {
      const now = Date.now();
      const myUid = auth.currentUser?.uid || '';
      const byHostId = new Map<string, any>();

      snapshot.docs.forEach((docSnap) => {
        const s: any = {
          id: docSnap.id,
          ...docSnap.data(),
        };
        const hostId = String(s.host?.id || '').trim();

        if (
          !s.id ||
          isLegacyErrorCardId(s.id) ||
          !hostId ||
          s.isActive !== true ||
          !s.sfuSessionId ||
          typeof s.sfuSessionId !== 'string'
        ) {
          if (myUid && hostId === myUid && !isFirestoreQuotaExceeded()) {
            deleteDoc(doc(db, 'liveStreams', s.id)).catch(() => {});
          }
          return;
        }

        // Only compare server-assigned timestamp to avoid multi-device phone clock skew
        const serverHeartbeatMs =
          typeof s.lastHeartbeat?.toMillis === 'function'
            ? s.lastHeartbeat.toMillis()
            : typeof s.lastSeenAt?.toMillis === 'function'
              ? s.lastSeenAt.toMillis()
              : null;
        if (typeof serverHeartbeatMs === 'number' && now - serverHeartbeatMs > LIVE_STREAM_STALE_MS) {
          if (myUid && hostId === myUid && !isFirestoreQuotaExceeded()) {
            deleteDoc(doc(db, 'liveStreams', s.id)).catch(() => {});
          }
          return;
        }

        const existing = byHostId.get(hostId);
        if (!existing) {
          byHostId.set(hostId, s);
          return;
        }

        const canonicalId = getCanonicalLiveStreamId(hostId);
        const preferIncoming =
          s.id === canonicalId ||
          (existing.id !== canonicalId &&
            Number(s.lastSeenAtMs || 0) >= Number(existing.lastSeenAtMs || 0));

        if (preferIncoming) {
          if (myUid && hostId === myUid && existing.id !== s.id && !isFirestoreQuotaExceeded()) {
            deleteDoc(doc(db, 'liveStreams', existing.id)).catch(() => {});
          }
          byHostId.set(hostId, s);
        } else if (myUid && hostId === myUid && !isFirestoreQuotaExceeded()) {
          deleteDoc(doc(db, 'liveStreams', s.id)).catch(() => {});
        }
      });

      onUpdate(Array.from(byHostId.values()));
    },
    (error) => {
      handleSnapshotListenerError(error, OperationType.LIST, path);
    }
  );
}

/**
 * Live Stream Comments Real-time Subscription
 */
export function subscribeToLiveStreamMessages(
  streamId: string,
  onUpdate: (msgs: any[]) => void
) {
  if (!streamId) {
    onUpdate([]);
    return () => {};
  }
  const path = `liveStreams/${streamId}/messages`;
  const messagesQuery = query(
    collection(db, 'liveStreams', streamId, 'messages'),
    orderBy('createdAt', 'asc'),
    limit(100)
  );
  return onSnapshot(
    messagesQuery,
    (snapshot) => {
      const list = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      }));
      onUpdate(list);
    },
    (error) => {
      if (isFirestoreQuotaExceededError(error)) {
        notifyFirestoreQuotaExceeded();
        return;
      }
      if ((error as any)?.code === 'permission-denied') {
        handleSnapshotListenerError(error, OperationType.LIST, path);
        return;
      }
      console.warn('Live stream comments listener error:', error);
    }
  );
}

/**
 * Send comment to real-time Live Stream
 */
export async function sendLiveStreamMessage(streamId: string, message: any) {
  const uid = auth.currentUser?.uid;
  if (!streamId || !uid || isFirestoreQuotaExceeded()) return;
  const path = `liveStreams/${streamId}/messages`;
  try {
    await addDoc(
      collection(db, 'liveStreams', streamId, 'messages'),
      stripUndefinedFields({
        ...message,
        senderId: uid,
        createdAt: serverTimestamp(),
      })
    );
  } catch (error) {
    handleBackgroundWriteError(error, OperationType.CREATE, path);
  }
}

export async function joinLiveStreamViewer(streamId: string, viewer: any) {
  if (!streamId || !auth.currentUser?.uid || isFirestoreQuotaExceeded()) return;
  const uid = auth.currentUser.uid;
  const path = `liveStreams/${streamId}/viewers/${uid}`;
  try {
    const nowMs = Date.now();
    await setDoc(
      doc(db, 'liveStreams', streamId, 'viewers', uid),
      stripUndefinedFields({
        id: uid,
        uniqueId: viewer?.uniqueId || uid,
        username: viewer?.username || viewer?.displayName || 'viewer',
        displayName: viewer?.displayName || 'Viewer',
        avatar: sanitizeAvatarString(viewer?.avatar),
        level: Number(viewer?.level ?? 0),
        vipTier: Number(viewer?.vipTier ?? 0),
        countryFlag: viewer?.countryFlag,
        isVerified: !!viewer?.isVerified,
        isHost: !!viewer?.isHost,
        joinedAtMs: viewer?.joinedAtMs || nowMs,
        lastSeenAt: serverTimestamp(),
        lastSeenAtMs: nowMs,
      }),
      { merge: true }
    );
  } catch (error: any) {
    if (isFirestoreQuotaExceededError(error)) {
      notifyFirestoreQuotaExceeded();
      return;
    }
    if (error?.code === 'permission-denied') {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }
}

export async function leaveLiveStreamViewer(streamId: string, userId?: string) {
  const uid = userId || auth.currentUser?.uid;
  if (!streamId || !uid || isFirestoreQuotaExceeded()) return;
  try {
    await deleteDoc(doc(db, 'liveStreams', streamId, 'viewers', uid));
  } catch (error) {
    if (isFirestoreQuotaExceededError(error)) {
      notifyFirestoreQuotaExceeded();
    }
  }
}

export function subscribeToLiveStreamViewers(
  streamId: string,
  onUpdate: (viewers: any[]) => void
) {
  if (!streamId) return () => {};
  const viewersRef = collection(db, 'liveStreams', streamId, 'viewers');
  return onSnapshot(
    viewersRef,
    (snapshot) => {
      const now = Date.now();
      const active = snapshot.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) }))
        .filter((v) => {
          const seenMs =
            typeof v.lastSeenAt?.toMillis === 'function'
              ? v.lastSeenAt.toMillis()
              : typeof v.lastSeenAtMs === 'number'
                ? v.lastSeenAtMs
                : now;
          return now - seenMs <= 75_000;
        });
      onUpdate(active);
    },
    (error) => {
      console.warn('Live viewers subscription warning:', error);
    }
  );
}

// =========================================================================
// ACCOUNT DEACTIVATION, 15-DAY PERMANENT DELETION & RECOVERY HELPERS
// =========================================================================

export const FIFTEEN_DAYS_MS = 15 * 24 * 60 * 60 * 1000;

function sanitizeDeletionReason(reason?: string): string {
  return String(reason || '').trim().slice(0, 500);
}

/**
 * Temporarily deactivate user account (never deleted, unlimited recovery window).
 */
export async function submitAccountDeactivationFirestore(
  user: {
    id: string;
    uniqueId?: string;
    username?: string;
    displayName?: string;
    email?: string;
    avatar?: string;
  },
  reason?: string
): Promise<{ deactivatedAt: string }> {
  const uid = auth.currentUser?.uid || user.id;
  if (!uid) throw new Error('Authenticated user required to deactivate account.');

  const nowIso = new Date().toISOString();
  const cleanReason = sanitizeDeletionReason(reason);
  const userPath = `users/${uid}`;
  const reqPath = `accountDeletionRequests/${uid}`;

  try {
    await setDoc(
      doc(db, 'users', uid),
      stripUndefinedFields({
        accountStatus: 'deactivated',
        deactivatedAt: nowIso,
        deletionRequestedAt: null,
        scheduledPermanentDeletionAt: null,
        deletionOtpVerifiedAt: null,
        deletionReason: cleanReason,
        updatedAt: nowIso,
      }),
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }

  try {
    const reqDoc = stripUndefinedFields({
      uid,
      uniqueId: String(user.uniqueId || uid).slice(0, 64),
      username: String(user.username || 'user').slice(0, 64),
      displayName: String(user.displayName || 'Alpha Mate User').slice(0, 128),
      email: String(auth.currentUser?.email || user.email || '').toLowerCase().slice(0, 128),
      avatar: sanitizeAvatarString(user.avatar),
      type: 'deactivation',
      status: 'deactivated',
      otpVerified: false,
      requestedAt: nowIso,
      reason: cleanReason,
      updatedAt: nowIso,
    });
    await setDoc(doc(db, 'accountDeletionRequests', uid), reqDoc);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, reqPath);
  }

  return { deactivatedAt: nowIso };
}

/**
 * Submit OTP-verified Permanent Account Deletion request into Official 15-Day Pending Queue.
 */
export async function submitPermanentDeletionRequestFirestore(
  user: {
    id: string;
    uniqueId?: string;
    username?: string;
    displayName?: string;
    email?: string;
    avatar?: string;
  },
  otpVerifiedAt: string,
  reason?: string
): Promise<{ requestedAt: string; scheduledPermanentDeletionAt: string }> {
  const uid = auth.currentUser?.uid || user.id;
  if (!uid) throw new Error('Authenticated user required to request permanent account deletion.');
  if (!otpVerifiedAt) throw new Error('Email OTP verification is required before requesting permanent deletion.');

  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const scheduledIso = new Date(nowMs + FIFTEEN_DAYS_MS).toISOString();
  const cleanReason = sanitizeDeletionReason(reason);
  const userPath = `users/${uid}`;
  const reqPath = `accountDeletionRequests/${uid}`;

  try {
    await setDoc(
      doc(db, 'users', uid),
      stripUndefinedFields({
        accountStatus: 'pending_deletion',
        deletionRequestedAt: nowIso,
        scheduledPermanentDeletionAt: scheduledIso,
        deletionOtpVerifiedAt: otpVerifiedAt,
        deletionReason: cleanReason,
        updatedAt: nowIso,
      }),
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }

  try {
    const reqDoc = stripUndefinedFields({
      uid,
      uniqueId: String(user.uniqueId || uid).slice(0, 64),
      username: String(user.username || 'user').slice(0, 64),
      displayName: String(user.displayName || 'Alpha Mate User').slice(0, 128),
      email: String(auth.currentUser?.email || user.email || '').toLowerCase().slice(0, 128),
      avatar: sanitizeAvatarString(user.avatar),
      type: 'permanent_delete',
      status: 'pending_official_deletion',
      otpVerified: true,
      otpVerifiedAt,
      requestedAt: nowIso,
      scheduledPermanentDeletionAt: scheduledIso,
      reason: cleanReason,
      updatedAt: nowIso,
    });
    await setDoc(doc(db, 'accountDeletionRequests', uid), reqDoc);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, reqPath);
  }

  return {
    requestedAt: nowIso,
    scheduledPermanentDeletionAt: scheduledIso,
  };
}

/**
 * Fetch a user's current deactivation/deletion request document.
 */
export async function getAccountDeletionRequestFirestore(uid: string) {
  if (!uid) return null;
  const path = `accountDeletionRequests/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'accountDeletionRequests', uid));
    return snap.exists() ? snap.data() : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

/**
 * Recover a deactivated account (any time) or a pending permanent deletion account (within 15 days).
 */
export async function recoverAccountLifecycleFirestore(user: {
  id: string;
  uniqueId?: string | null;
  username?: string | null;
  displayName?: string | null;
  email?: string | null;
  avatar?: string | null;
  accountStatus?: string | null;
  deletionRequestedAt?: string | null;
  scheduledPermanentDeletionAt?: string | null;
}): Promise<{ reactivatedAt: string }> {
  const uid = auth.currentUser?.uid || user.id;
  if (!uid) throw new Error('Authenticated user required to recover account.');

  const existingReq = await getAccountDeletionRequestFirestore(uid).catch(() => null);
  const scheduledIso = existingReq?.scheduledPermanentDeletionAt || user.scheduledPermanentDeletionAt;
  const effectiveStatus = existingReq?.status || user.accountStatus;

  if (effectiveStatus === 'permanently_deleted') {
    throw new Error('This account has already been permanently deleted and can no longer be recovered.');
  }

  if (
    (effectiveStatus === 'pending_official_deletion' || user.accountStatus === 'pending_deletion') &&
    scheduledIso
  ) {
    const deadlineMs = Date.parse(scheduledIso);
    if (Number.isFinite(deadlineMs) && Date.now() >= deadlineMs) {
      throw new Error(
        'The 15-day recovery window has expired. This account is queued for final permanent removal and cannot be recovered.'
      );
    }
  }

  const nowIso = new Date().toISOString();
  const userPath = `users/${uid}`;
  const reqPath = `accountDeletionRequests/${uid}`;

  try {
    await setDoc(
      doc(db, 'users', uid),
      stripUndefinedFields({
        accountStatus: 'active',
        reactivatedAt: nowIso,
        deactivatedAt: null,
        deletionRequestedAt: null,
        scheduledPermanentDeletionAt: null,
        deletionOtpVerifiedAt: null,
        updatedAt: nowIso,
      }),
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }

  try {
    const reqDoc = stripUndefinedFields({
      uid,
      uniqueId: String(existingReq?.uniqueId || user.uniqueId || uid).slice(0, 64),
      username: String(existingReq?.username || user.username || 'user').slice(0, 64),
      displayName: String(existingReq?.displayName || user.displayName || 'Alpha Mate User').slice(0, 128),
      email: String(existingReq?.email || auth.currentUser?.email || user.email || '').toLowerCase().slice(0, 128),
      avatar: sanitizeAvatarString(existingReq?.avatar || user.avatar),
      type: existingReq?.type === 'permanent_delete' ? 'permanent_delete' : 'deactivation',
      status: 'recovered',
      otpVerified: Boolean(existingReq?.otpVerified),
      ...(existingReq?.otpVerifiedAt ? { otpVerifiedAt: existingReq.otpVerifiedAt } : {}),
      requestedAt: existingReq?.requestedAt || user.deletionRequestedAt || nowIso,
      recoveredAt: nowIso,
      processedBy: 'user_self_recovery',
      updatedAt: nowIso,
    });
    await setDoc(doc(db, 'accountDeletionRequests', uid), reqDoc);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, reqPath);
  }

  return { reactivatedAt: nowIso };
}

/**
 * Real-time subscription for Official Admin Dashboard deletion queue.
 */
export function subscribeToAccountDeletionRequests(onUpdate: (items: any[]) => void) {
  const path = 'accountDeletionRequests';
  const q = query(collection(db, 'accountDeletionRequests'), orderBy('updatedAt', 'desc'), limit(200));
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      onUpdate(items);
    },
    (error) => {
      handleSnapshotListenerError(error, OperationType.LIST, path);
    }
  );
}

/**
 * Official Admin action: restore a user account or mark an expired request as permanently deleted.
 */
export async function adminProcessAccountDeletionRequest(
  reqItem: {
    uid: string;
    uniqueId?: string | null;
    username?: string | null;
    displayName: string;
    email: string;
    avatar?: string | null;
    type: 'deactivation' | 'permanent_delete';
    otpVerified?: boolean | null;
    otpVerifiedAt?: string | null;
    requestedAt: string;
    scheduledPermanentDeletionAt?: string | null;
  },
  action: 'restore' | 'finalize'
): Promise<void> {
  const uid = reqItem.uid;
  const nowIso = new Date().toISOString();
  const adminEmail = auth.currentUser?.email || 'official_admin';

  if (action === 'restore') {
    await setDoc(
      doc(db, 'users', uid),
      stripUndefinedFields({
        accountStatus: 'active',
        reactivatedAt: nowIso,
        deactivatedAt: null,
        deletionRequestedAt: null,
        scheduledPermanentDeletionAt: null,
        deletionOtpVerifiedAt: null,
        updatedAt: nowIso,
      }),
      { merge: true }
    );
    await setDoc(
      doc(db, 'accountDeletionRequests', uid),
      stripUndefinedFields({
        uid,
        uniqueId: reqItem.uniqueId || uid,
        username: reqItem.username || 'user',
        displayName: String(reqItem.displayName || 'Alpha Mate User').slice(0, 128),
        email: String(reqItem.email || '').toLowerCase().slice(0, 128),
        avatar: sanitizeAvatarString(reqItem.avatar || undefined),
        type: reqItem.type,
        status: 'recovered',
        otpVerified: Boolean(reqItem.otpVerified),
        ...(reqItem.otpVerifiedAt ? { otpVerifiedAt: reqItem.otpVerifiedAt } : {}),
        requestedAt: reqItem.requestedAt || nowIso,
        recoveredAt: nowIso,
        processedBy: adminEmail,
        updatedAt: nowIso,
      })
    );
    return;
  }

  await setDoc(
    doc(db, 'users', uid),
    stripUndefinedFields({
      accountStatus: 'permanently_deleted',
      updatedAt: nowIso,
    }),
    { merge: true }
  );
  await setDoc(
    doc(db, 'accountDeletionRequests', uid),
    stripUndefinedFields({
      uid,
      uniqueId: reqItem.uniqueId || uid,
      username: reqItem.username || 'user',
      displayName: String(reqItem.displayName || 'Alpha Mate User').slice(0, 128),
      email: String(reqItem.email || '').toLowerCase().slice(0, 128),
      avatar: sanitizeAvatarString(reqItem.avatar || undefined),
      type: 'permanent_delete',
      status: 'permanently_deleted',
      otpVerified: Boolean(reqItem.otpVerified),
      ...(reqItem.otpVerifiedAt ? { otpVerifiedAt: reqItem.otpVerifiedAt } : {}),
      requestedAt: reqItem.requestedAt || nowIso,
      ...(reqItem.scheduledPermanentDeletionAt
        ? { scheduledPermanentDeletionAt: reqItem.scheduledPermanentDeletionAt }
        : {}),
      permanentlyDeletedAt: nowIso,
      processedBy: adminEmail,
      updatedAt: nowIso,
    })
  );
}

// =========================================================================
// REAL-TIME USER NOTIFICATIONS & PREFERENCES
// =========================================================================

const FIRESTORE_VALID_ID_RE = /^[a-zA-Z0-9_-]{1,128}$/;

function formatNotificationTimestamp(ms?: number): string {
  if (!ms || !Number.isFinite(ms)) return 'Just now';
  const diff = Date.now() - ms;
  if (diff < 60_000) return 'Just now';
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(ms).toLocaleDateString();
}

export async function updateUserNotificationPreferencesFirestore(
  userId: string,
  preferences: { enabled: boolean; categories: Record<string, boolean>; updatedAt?: string }
): Promise<void> {
  if (!userId || !FIRESTORE_VALID_ID_RE.test(userId)) return;
  const path = `users/${userId}`;
  try {
    await setDoc(
      doc(db, 'users', userId),
      {
        notificationPreferences: {
          enabled: Boolean(preferences.enabled),
          categories: { ...preferences.categories },
          updatedAt: preferences.updatedAt || new Date().toISOString(),
        },
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export interface SendNotificationParams {
  recipientId: string;
  type:
    | 'live_on'
    | 'live_invite'
    | 'party_invite'
    | 'friend_request'
    | 'follow'
    | 'gift'
    | 'comment'
    | 'message'
    | 'like'
    | 'pk_invite'
    | 'wallet'
    | 'agency'
    | 'system';
  category?: string;
  title: string;
  message: string;
  senderName?: string;
  senderAvatar?: string;
  screen?: string;
  tab?: string;
  roomId?: string;
  streamId?: string;
  reelId?: string;
  chatId?: string;
}

const VALID_NOTIFICATION_TYPES = new Set<SendNotificationParams['type']>([
  'live_on',
  'live_invite',
  'party_invite',
  'friend_request',
  'follow',
  'gift',
  'comment',
  'message',
  'like',
  'pk_invite',
  'wallet',
  'agency',
  'system',
]);

export async function sendFirestoreNotification(
  params: SendNotificationParams
): Promise<string | null> {
  if (isFirestoreQuotaExceeded()) return null;
  const senderUid = String(auth.currentUser?.uid || '').trim();
  const recipientId = String(params.recipientId || '').trim();
  if (
    !senderUid ||
    !recipientId ||
    !FIRESTORE_VALID_ID_RE.test(senderUid) ||
    !FIRESTORE_VALID_ID_RE.test(recipientId)
  ) {
    return null;
  }

  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const notifId = `n_${nowMs}_${Math.random().toString(36).slice(2, 8)}`;
  const path = `users/${recipientId}/notifications/${notifId}`;

  const safeType = VALID_NOTIFICATION_TYPES.has(params.type) ? params.type : 'system';
  const safeSenderName =
    String(params.senderName || auth.currentUser?.displayName || 'Alpha Mate User')
      .trim()
      .slice(0, 128) || 'Alpha Mate User';
  const rawAvatar = sanitizeAvatarString(params.senderAvatar || auth.currentUser?.photoURL || undefined);
  const safeAvatar =
    rawAvatar.length <= 65000
      ? rawAvatar
      : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80';
  const safeTitle = String(params.title || '').trim().slice(0, 160) || 'Alpha Mate';
  const safeMessage =
    String(params.message || '').trim().slice(0, 600) || 'New activity on Alpha Mate.';
  const trimOpt = (val: string | undefined, maxLen: number) => {
    const trimmed = typeof val === 'string' ? val.trim() : '';
    return trimmed ? trimmed.slice(0, maxLen) : undefined;
  };

  const payload = stripUndefinedFields({
    recipientId,
    senderId: senderUid,
    senderName: safeSenderName,
    senderAvatar: safeAvatar,
    type: safeType,
    category: trimOpt(params.category, 64),
    title: safeTitle,
    message: safeMessage,
    screen: trimOpt(params.screen, 64),
    tab: trimOpt(params.tab, 64),
    roomId: trimOpt(params.roomId, 128),
    streamId: trimOpt(params.streamId, 128),
    reelId: trimOpt(params.reelId, 128),
    chatId: trimOpt(params.chatId, 128),
    isRead: false,
    createdAt: nowIso,
    createdAtMs: nowMs,
  });

  try {
    await setDoc(doc(db, 'users', recipientId, 'notifications', notifId), payload);
    return notifId;
  } catch (error) {
    handleBackgroundWriteError(error, OperationType.CREATE, path);
    return null;
  }
}

export function subscribeToUserNotifications(
  userId: string,
  onUpdate: (items: any[]) => void
) {
  const path = `users/${userId}/notifications`;
  const q = query(
    collection(db, 'users', userId, 'notifications'),
    orderBy('createdAtMs', 'desc'),
    limit(100)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs.map((docSnap) => {
        const d = docSnap.data() as Record<string, any>;
        return {
          id: docSnap.id,
          type: d.type || 'system',
          category: d.category,
          title: d.title || 'Alpha Mate',
          message: d.message || '',
          senderId: d.senderId,
          senderName: d.senderName,
          senderAvatar: d.senderAvatar,
          recipientId: d.recipientId,
          screen: d.screen,
          tab: d.tab,
          roomId: d.roomId,
          streamId: d.streamId,
          reelId: d.reelId,
          chatId: d.chatId,
          isRead: Boolean(d.isRead),
          createdAtMs: Number(d.createdAtMs) || Date.now(),
          timestamp: formatNotificationTimestamp(Number(d.createdAtMs)),
          user: d.senderId
            ? {
                id: d.senderId,
                displayName: d.senderName || 'Alpha Mate User',
                avatar: d.senderAvatar || '',
              }
            : undefined,
        };
      });
      onUpdate(list);
    },
    (error) => {
      handleSnapshotListenerError(error, OperationType.LIST, path);
    }
  );
}

export async function markFirestoreNotificationRead(
  userId: string,
  notificationId: string
): Promise<void> {
  if (!userId || !notificationId || isFirestoreQuotaExceeded()) return;
  const path = `users/${userId}/notifications/${notificationId}`;
  try {
    await updateDoc(doc(db, 'users', userId, 'notifications', notificationId), {
      isRead: true,
      readAt: new Date().toISOString(),
    });
  } catch (error: any) {
    if (error?.code === 'not-found') return;
    handleBackgroundWriteError(error, OperationType.UPDATE, path);
  }
}

export async function markAllFirestoreNotificationsRead(
  userId: string,
  notificationIds: string[]
): Promise<void> {
  if (!userId || notificationIds.length === 0 || isFirestoreQuotaExceeded()) return;
  const readAt = new Date().toISOString();
  const batch = writeBatch(db);
  notificationIds.slice(0, 100).forEach((id) => {
    if (FIRESTORE_VALID_ID_RE.test(id)) {
      batch.update(doc(db, 'users', userId, 'notifications', id), {
        isRead: true,
        readAt,
      });
    }
  });
  try {
    await batch.commit();
  } catch (error) {
    handleBackgroundWriteError(error, OperationType.WRITE, `users/${userId}/notifications`);
  }
}

export async function fetchBroadcastRecipientIds(
  excludeUid: string,
  maxUsers: number = 30
): Promise<string[]> {
  if (!auth.currentUser?.uid) return [];
  try {
    const snap = await getDocs(query(collection(db, 'users'), limit(maxUsers + 5)));
    return snap.docs
      .map((d) => d.id)
      .filter((id) => id !== excludeUid && FIRESTORE_VALID_ID_RE.test(id))
      .slice(0, maxUsers);
  } catch (err) {
    console.warn('Could not query broadcast notification recipients:', err);
    return [];
  }
}

// =========================================================================
// 60/40 GIFTING ECONOMY (60% HOST DIAMONDS + 40% APP REVENUE SHARE)
// =========================================================================

export interface SixtyFortyGiftInput {
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  recipientId: string;
  recipientName: string;
  giftId: string;
  giftName: string;
  giftIcon: string;
  unitCoins: number;
  quantity: number;
  context: 'live' | 'party' | 'moments' | 'pk' | 'demo';
  roomId?: string;
  streamId?: string;
  reelId?: string;
}

export interface SixtyFortyGiftResult {
  txId: string;
  totalCoins: number;
  hostDiamonds: number;
  appShareCoins: number;
  creditedHostFirestore: boolean;
  senderNextCoins?: number;
  senderNextDiamonds?: number;
}

export async function executeSixtyFortyGiftTransaction(
  input: SixtyFortyGiftInput
): Promise<SixtyFortyGiftResult> {
  const qty = Math.max(1, Math.floor(Number(input.quantity) || 1));
  const unitCoins = Math.max(1, Math.floor(Number(input.unitCoins) || 1));
  const totalCoins = unitCoins * qty;
  const hostDiamonds = Math.round(totalCoins * 0.6);
  const appShareCoins = totalCoins - hostDiamonds;

  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const txId = `gift_${nowMs}_${Math.random().toString(36).slice(2, 8)}`;

  const authUid = auth.currentUser?.uid;
  if (!authUid || isFirestoreQuotaExceeded()) {
    return {
      txId,
      totalCoins,
      hostDiamonds,
      appShareCoins,
      creditedHostFirestore: false,
    };
  }

  const recipientId = String(input.recipientId || authUid).trim();
  const isSelfRecipient = recipientId === authUid;
  const canQueryRecipientDoc = FIRESTORE_VALID_ID_RE.test(recipientId);

  let creditedHostFirestore = false;
  let senderNextCoins: number | undefined;
  let senderNextDiamonds: number | undefined;

  try {
    await runTransaction(db, async (transaction) => {
      const senderRef = doc(db, 'users', authUid);
      const senderSnap = await transaction.get(senderRef);

      let recipientSnap: any = null;
      const recipientRef = canQueryRecipientDoc && !isSelfRecipient ? doc(db, 'users', recipientId) : null;
      if (recipientRef) {
        recipientSnap = await transaction.get(recipientRef);
      }

      if (senderSnap.exists()) {
        const senderData = senderSnap.data() as Record<string, any>;
        const currentCoins = Number(senderData.coins ?? 0);
        const currentDiamonds = Number(senderData.diamonds ?? 0);
        senderNextCoins = Math.max(0, currentCoins - totalCoins);

        if (isSelfRecipient) {
          senderNextDiamonds = currentDiamonds + hostDiamonds;
          transaction.update(senderRef, {
            coins: senderNextCoins,
            diamonds: senderNextDiamonds,
            updatedAt: nowIso,
          });
          creditedHostFirestore = true;
        } else {
          transaction.update(senderRef, {
            coins: senderNextCoins,
            updatedAt: nowIso,
          });
        }
      }

      if (recipientRef && recipientSnap && recipientSnap.exists()) {
        const rData = recipientSnap.data() as Record<string, any>;
        const currentRecipientDiamonds = Number(rData.diamonds ?? 0);
        transaction.update(recipientRef, {
          diamonds: currentRecipientDiamonds + hostDiamonds,
          updatedAt: nowIso,
        });
        creditedHostFirestore = true;
      }

      const ledgerPayload = stripUndefinedFields({
        senderId: authUid,
        senderName: String(input.senderName || 'Alpha Mate User').slice(0, 128),
        recipientId: canQueryRecipientDoc ? recipientId : authUid,
        recipientName: String(input.recipientName || 'Host').slice(0, 128),
        giftId: String(input.giftId || 'gift').slice(0, 64),
        giftName: String(input.giftName || 'Gift').slice(0, 80),
        giftIcon: String(input.giftIcon || '🎁').slice(0, 32),
        quantity: qty,
        totalCoins,
        hostDiamonds,
        appShareCoins,
        context: input.context,
        roomId: input.roomId ? String(input.roomId).slice(0, 128) : undefined,
        streamId: input.streamId ? String(input.streamId).slice(0, 128) : undefined,
        reelId: input.reelId ? String(input.reelId).slice(0, 128) : undefined,
        status: 'completed',
        createdAt: nowIso,
        createdAtMs: nowMs,
      });

      transaction.set(doc(db, 'giftTransactions', txId), ledgerPayload);
    });
  } catch (error) {
    if (isFirestoreQuotaExceededError(error)) {
      notifyFirestoreQuotaExceeded();
      return {
        txId,
        totalCoins,
        hostDiamonds,
        appShareCoins,
        creditedHostFirestore: false,
      };
    }
    handleFirestoreError(error, OperationType.WRITE, `giftTransactions/${txId}`);
  }

  if (!isFirestoreQuotaExceeded()) {
    if (input.context === 'live' && input.streamId) {
      updateDoc(doc(db, 'liveStreams', input.streamId), {
        totalGiftCoins: increment(totalCoins),
        updatedAt: nowIso,
      }).catch((err) => {
        if (isFirestoreQuotaExceededError(err)) notifyFirestoreQuotaExceeded();
      });
    } else if (input.context === 'party' && input.roomId) {
      updateDoc(doc(db, 'partyRooms', input.roomId), {
        totalGiftCoins: increment(totalCoins),
        updatedAt: nowIso,
      }).catch((err) => {
        if (isFirestoreQuotaExceededError(err)) notifyFirestoreQuotaExceeded();
      });
    }

    if (canQueryRecipientDoc) {
      sendFirestoreNotification({
        recipientId,
        type: 'gift',
        category: 'gifts',
        title: `${input.giftIcon} Gift Received (+${hostDiamonds.toLocaleString()} 💎)`,
        message: `${input.senderName} sent ${qty > 1 ? `${qty}x ` : ''}${input.giftName} (${totalCoins.toLocaleString()} Coins). Your 60% host share (+${hostDiamonds.toLocaleString()} Diamonds) is in your wallet!`,
        senderName: input.senderName,
        senderAvatar: input.senderAvatar,
        screen: 'wallet',
        roomId: input.roomId,
        streamId: input.streamId,
        reelId: input.reelId,
      }).catch((err) => console.warn('Gift notification dispatch warning:', err));

      import('./leaderboardService')
        .then((m) =>
          m.recordLeaderboardGiftReceived({
            recipientId,
            recipientName: input.recipientName,
            giftCoins: totalCoins,
            hostDiamonds,
          })
        )
        .catch((err) => console.warn('Leaderboard gift update warning:', err));
    }
  }

  return {
    txId,
    totalCoins,
    hostDiamonds,
    appShareCoins,
    creditedHostFirestore,
    senderNextCoins,
    senderNextDiamonds,
  };
}

export function subscribeToGiftTransactions(
  options: { userId?: string; isAdmin?: boolean },
  onUpdate: (items: any[]) => void
) {
  const path = 'giftTransactions';
  if (options.isAdmin) {
    const q = query(
      collection(db, 'giftTransactions'),
      orderBy('createdAtMs', 'desc'),
      limit(200)
    );
    return onSnapshot(
      q,
      (snap) => onUpdate(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => handleSnapshotListenerError(err, OperationType.LIST, path)
    );
  }
  const uid = options.userId;
  if (!uid) return () => {};

  let sentDocs: any[] = [];
  let receivedDocs: any[] = [];
  const mergeAndEmit = () => {
    const byId = new Map<string, any>();
    [...sentDocs, ...receivedDocs].forEach((item) => byId.set(item.id, item));
    const merged = Array.from(byId.values()).sort(
      (a, b) => (Number(b.createdAtMs) || 0) - (Number(a.createdAtMs) || 0)
    );
    onUpdate(merged);
  };

  const qSent = query(
    collection(db, 'giftTransactions'),
    where('senderId', '==', uid),
    limit(100)
  );
  const qReceived = query(
    collection(db, 'giftTransactions'),
    where('recipientId', '==', uid),
    limit(100)
  );

  const unsubSent = onSnapshot(
    qSent,
    (snap) => {
      sentDocs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      mergeAndEmit();
    },
    (err) => handleSnapshotListenerError(err, OperationType.LIST, path)
  );
  const unsubReceived = onSnapshot(
    qReceived,
    (snap) => {
      receivedDocs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      mergeAndEmit();
    },
    (err) => handleSnapshotListenerError(err, OperationType.LIST, path)
  );

  return () => {
    unsubSent();
    unsubReceived();
  };
}

// =========================================================================
// SCOPED NETWORK RECOVERY & SERVER SNAPSHOT HELPERS
// =========================================================================
export async function recoverFirestoreNetwork(): Promise<{ online: boolean; error?: string }> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { online: false, error: 'You appear to be offline. Please check your internet connection.' };
  }
  try {
    // Do NOT call enableNetwork(db) when network was never disabled; redundant calls
    // while PersistentWriteStream is active trigger Firestore JS SDK assertion c050.
    await withFirestoreTimeout(getDocFromServer(doc(db, 'test', 'connection')), 5500, 'Network connection check');
    clearFirestoreQuotaExceeded();
    return { online: true };
  } catch (err: any) {
    if (isFirestoreQuotaExceededError(err)) {
      notifyFirestoreQuotaExceeded();
      return {
        online: true,
        error: 'Firestore daily Spark quota has been reached. Cached data remains active until daily reset or plan upgrade.',
      };
    }
    const msg = String(err?.message || err || '').toLowerCase();
    // If Firestore responded with permission-denied, the network connection to Firestore is genuinely alive!
    if (msg.includes('permission') || msg.includes('missing or insufficient')) {
      return { online: true };
    }
    if (msg.includes('offline') || msg.includes('timed out') || msg.includes('network') || msg.includes('unavailable')) {
      return { online: false, error: 'Network unavailable. Please check your connection and pull again.' };
    }
    return { online: true };
  }
}

export async function fetchLiveStreamFromServer(streamId: string): Promise<any | null> {
  if (!streamId) return null;
  try {
    const snap = await withFirestoreTimeout(
      getDocFromServer(doc(db, 'liveStreams', streamId)),
      6000,
      'Refresh live broadcast'
    );
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() };
  } catch {
    return null;
  }
}

export async function fetchPartyRoomFromServer(roomId: string): Promise<any | null> {
  if (!roomId) return null;
  try {
    const snap = await withFirestoreTimeout(
      getDocFromServer(doc(db, 'partyRooms', roomId)),
      6000,
      'Refresh party room'
    );
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() };
  } catch {
    return null;
  }
}

// =========================================================================
// AGENCY APPLICATIONS & ADMIN-APPROVED AGENCIES
// =========================================================================
export interface FirestoreAgencyApplicationInput {
  id: string;
  type: 'coin_seller' | 'host_agency';
  applicantUserId: string;
  applicantName: string;
  applicantUniqueId: string;
  agencyName: string;
  agencyTag?: string;
  whatsapp: string;
  phoneNumber: string;
  idCardNumber?: string;
  experience: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
  createdAtMs: number;
}

export async function submitAgencyApplicationToFirestore(
  appData: FirestoreAgencyApplicationInput
): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error('Please sign in with a verified account to submit an agency application.');
  }
  const path = `agencyApplications/${appData.id}`;
  const payload = stripUndefinedFields({
    id: String(appData.id).slice(0, 128),
    type: appData.type,
    applicantUserId: uid,
    applicantName: String(appData.applicantName || 'Alpha Mate Creator').slice(0, 128),
    applicantUniqueId: String(appData.applicantUniqueId || uid).slice(0, 64),
    agencyName: String(appData.agencyName).trim().slice(0, 128),
    agencyTag: appData.agencyTag ? String(appData.agencyTag).trim().slice(0, 16) : undefined,
    whatsapp: String(appData.whatsapp).trim().slice(0, 64),
    phoneNumber: String(appData.phoneNumber).trim().slice(0, 64),
    idCardNumber: appData.idCardNumber ? String(appData.idCardNumber).trim().slice(0, 64) : undefined,
    experience: String(appData.experience || 'Agency applicant').trim().slice(0, 1000),
    status: 'pending',
    submittedAt: String(appData.submittedAt || new Date().toISOString()).slice(0, 64),
    createdAtMs: Number(appData.createdAtMs) || Date.now(),
  });
  try {
    await setDoc(doc(db, 'agencyApplications', appData.id), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function subscribeToMyAgencyApplications(
  uid: string,
  onUpdate: (apps: any[]) => void
) {
  if (!uid) return () => {};
  const path = 'agencyApplications';
  const q = query(
    collection(db, 'agencyApplications'),
    where('applicantUserId', '==', uid),
    limit(50)
  );
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a: any, b: any) => (Number(b.createdAtMs) || 0) - (Number(a.createdAtMs) || 0));
      onUpdate(items);
    },
    (err) => handleSnapshotListenerError(err, OperationType.LIST, path)
  );
}

export function subscribeToAllAgencyApplications(
  onUpdate: (apps: any[]) => void
) {
  const path = 'agencyApplications';
  const q = query(
    collection(db, 'agencyApplications'),
    orderBy('createdAtMs', 'desc'),
    limit(150)
  );
  return onSnapshot(
    q,
    (snap) => {
      onUpdate(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    },
    (err) => handleSnapshotListenerError(err, OperationType.LIST, path)
  );
}

export function subscribeToApprovedAgencies(
  onUpdate: (agencies: any[]) => void
) {
  if (!auth.currentUser) return () => {};
  const path = 'agencies';
  const q = query(
    collection(db, 'agencies'),
    where('status', '==', 'active'),
    limit(150)
  );
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map((d) => ({ agencyId: d.id, ...d.data() }))
        .sort((a: any, b: any) => (Number(b.createdAtMs) || 0) - (Number(a.createdAtMs) || 0));
      onUpdate(items);
    },
    (err) => handleSnapshotListenerError(err, OperationType.LIST, path)
  );
}

export async function adminReviewAgencyApplicationInFirestore(
  app: any,
  action: 'approve' | 'reject'
): Promise<{ agencyId?: string }> {
  const adminEmail = auth.currentUser?.email || 'alphamateapp@gmail.com';
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const appId = String(app.id);
  const nextStatus = action === 'approve' ? 'approved' : 'rejected';

  try {
    await updateDoc(doc(db, 'agencyApplications', appId), {
      status: nextStatus,
      reviewedAt: nowIso,
      reviewedBy: adminEmail,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `agencyApplications/${appId}`);
  }

  if (action !== 'approve') {
    return {};
  }

  const agencyId = `agency_${app.type}_${nowMs}_${Math.random().toString(36).slice(2, 6)}`;
  const codeSuffix = String(Math.floor(100 + Math.random() * 900));
  const agencyCode = app.type === 'coin_seller' ? `AM-EX-${codeSuffix}` : `AM-HT-${codeSuffix}`;
  const cleanTag =
    app.type === 'host_agency'
      ? String(app.agencyTag || 'VIP').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'VIP'
      : undefined;

  const agencyPayload = stripUndefinedFields({
    agencyId,
    type: app.type,
    agencyName: String(app.agencyName || 'Official Agency').slice(0, 128),
    agencyCode,
    agencyTag: cleanTag,
    tagColor: app.type === 'host_agency' ? '#F59E0B' : undefined,
    badge:
      app.type === 'coin_seller'
        ? 'Diamond Certified Official'
        : 'Diamond Certified Host Agency',
    ownerUserId: String(app.applicantUserId).slice(0, 128),
    ownerName: String(app.applicantName || 'Agency Owner').slice(0, 128),
    agencyBalance: 0, // Always starts at 0; only Official Admin allocates Coin Seller stock
    isPinSet: false,
    whatsappNumber: String(app.whatsapp || '').replace(/[^0-9+]/g, '').slice(0, 64) || String(app.whatsapp || '').slice(0, 64),
    whatsappDisplay: String(app.whatsapp || '').slice(0, 64),
    defaultCommissionRate: app.type === 'host_agency' ? 15 : undefined,
    minWeeklyHours: app.type === 'host_agency' ? 15 : undefined,
    slogan:
      app.type === 'coin_seller'
        ? 'Verified official coin seller agency.'
        : 'Official live talent and party host agency.',
    isOfficial: true,
    activeHostsCount: app.type === 'host_agency' ? 0 : undefined,
    status: 'active',
    createdAt: nowIso,
    createdAtMs: nowMs,
    updatedAt: nowIso,
  });

  try {
    await setDoc(doc(db, 'agencies', agencyId), agencyPayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `agencies/${agencyId}`);
  }

  return { agencyId };
}

export async function adminAllocateAgencyCoinsInFirestore(
  agencyId: string,
  coinsToAdd: number
): Promise<number> {
  const safeAdd = Math.floor(Number(coinsToAdd) || 0);
  if (safeAdd <= 0) {
    throw new Error('Coin allocation amount must be greater than zero.');
  }
  const agencyRef = doc(db, 'agencies', agencyId);
  let nextBalance = 0;
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(agencyRef);
      if (!snap.exists()) {
        throw new Error('Agency record not found.');
      }
      const data = snap.data() as Record<string, any>;
      if (data.type !== 'coin_seller') {
        throw new Error('Only Coin Seller agencies can hold coin stock.');
      }
      const current = Math.max(0, Number(data.agencyBalance) || 0);
      nextBalance = current + safeAdd;
      tx.update(agencyRef, {
        agencyBalance: nextBalance,
        updatedAt: new Date().toISOString(),
      });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `agencies/${agencyId}`);
  }
  return nextBalance;
}

export async function updateApprovedAgencySettingsInFirestore(
  agencyId: string,
  updates: Record<string, any>
): Promise<void> {
  if (!agencyId || !auth.currentUser) return;
  const allowed = stripUndefinedFields({
    whatsappNumber: updates.whatsappNumber,
    whatsappDisplay: updates.whatsappDisplay,
    slogan: updates.slogan,
    defaultCommissionRate: updates.defaultCommissionRate,
    minWeeklyHours: updates.minWeeklyHours,
    isPinSet: updates.isPinSet,
    updatedAt: new Date().toISOString(),
  });
  try {
    await updateDoc(doc(db, 'agencies', agencyId), allowed);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `agencies/${agencyId}`);
  }
}

export async function deductCoinSellerAgencyBalanceInFirestore(
  agencyId: string,
  amount: number
): Promise<number> {
  const safeAmount = Math.floor(Number(amount) || 0);
  if (safeAmount <= 0) {
    throw new Error('Transfer amount must be positive.');
  }
  const agencyRef = doc(db, 'agencies', agencyId);
  let nextBalance = 0;
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(agencyRef);
      if (!snap.exists()) {
        throw new Error('Official agency record not found.');
      }
      const data = snap.data() as Record<string, any>;
      const current = Math.max(0, Number(data.agencyBalance) || 0);
      if (safeAmount > current) {
        throw new Error(`Insufficient agency coin stock (${current.toLocaleString()} Coins available).`);
      }
      nextBalance = current - safeAmount;
      tx.update(agencyRef, {
        agencyBalance: nextBalance,
        updatedAt: new Date().toISOString(),
      });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `agencies/${agencyId}`);
  }
  return nextBalance;
}


