# Alpha Mate — Production Deployment & Data Protection Guide

## 1. Environment Separation
Alpha Mate uses two strictly separate deployment channels so client app builds never touch or wipe Firestore data, Firebase Storage files, or security rules:

1. **Web & Android App Builds (`git push`, GitHub Actions, Capacitor Android):**
   - Builds static web assets (`vite build`) and Capacitor Android bundles (`npx cap sync android`, `./gradlew bundleRelease`).
   - Does **NOT** run `firebase deploy` automatically and never modifies Firestore documents, indexes, Storage buckets, or Security Rules.

2. **Firebase Infrastructure Deploys (Manual / Explicit CLI Only):**
   - Uses explicit target flags (`--only`) against project `gen-lang-client-0468444352` and named Firestore database `ai-studio-alphamatelivepar-88a3637b-56a3-47f2-a3ab-b67bf1702cff`.

---

## 2. Pre-Deploy Safety Checklist (Mandatory Before Rules, Indexes, or Functions Changes)

### A. Export / Backup Existing Firestore Data
Before any schema or security rule rollout, create a managed export in GCS or verify the latest scheduled backup in Firebase Console / `gcloud`:
```bash
gcloud firestore export gs://gen-lang-client-0468444352-backups/manual-$(date +%Y%m%d-%H%M%S) \
  --database='ai-studio-alphamatelivepar-88a3637b-56a3-47f2-a3ab-b67bf1702cff' \
  --project=gen-lang-client-0468444352
```

### B. Review Diffs Against Live Rules
Always inspect changes to `firestore.rules`, `storage.rules`, and `firestore.indexes.json` before deploying:
```bash
git diff firestore.rules storage.rules firestore.indexes.json firebase.json
```
Ensure all rule updates remain **additive** and preserve existing collection permissions (`/users`, `/userFollows`, `/giftTransactions`, `/partyRooms`, `/liveStreams`, `/reels`, `/chats`, `/chatRequests`, `/groupInvites`, `/presence`).

---

## 3. Non-Destructive Firebase Deployment Commands

Never run bare `firebase deploy` without verifying active project/target. Use the scoped npm scripts in `package.json`:

1. **Select & verify Firebase project:**
   ```bash
   npx firebase-tools use gen-lang-client-0468444352
   ```

2. **Deploy Firestore Rules, Composite Indexes & Storage Rules:**
   ```bash
   npm run firebase:deploy:rules
   # Runs: firebase deploy --only firestore:rules,firestore:indexes,storage
   ```

3. **Build & Deploy Cloud Functions (Push Notifications & Maintenance Schedulers):**
   ```bash
   npm run firebase:deploy:functions
   # Runs: npm --prefix functions run build && firebase deploy --only functions
   ```

4. **Deploy All Firebase Backend Targets Explicitly:**
   ```bash
   npm run firebase:deploy:all
   ```

---

## 4. Android & Web Production Parity Checks
- **Firebase Project:** `gen-lang-client-0468444352` (`android/app/google-services.json` matches `firebase-applet-config.json`).
- **Named Firestore Database:** `ai-studio-alphamatelivepar-88a3637b-56a3-47f2-a3ab-b67bf1702cff`.
- **Storage Bucket:** `gen-lang-client-0468444352.firebasestorage.app` (avatars stored under `users/{uid}/profile/profile_image`).
- **Push Notifications:** Cloud Functions trigger on `chats/{chatId}/messages/{messageId}` and `users/{userId}/notifications/{notificationId}`; Android deep linking opens target `chatId` on tap in foreground, background, and terminated states.
- **After syncing Android assets:**
  ```bash
  npm run android:sync
  ```
