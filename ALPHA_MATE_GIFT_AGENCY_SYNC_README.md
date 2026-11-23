# Alpha Mate — Gift Gallery + Agency Coin Sync

This update is based on the complete Alpha Mate source ZIP uploaded on 24 November 2026.

## What changed

### 1. One live gift gallery; Store remains separate

- The mobile app now subscribes in real time to the Admin Panel Firestore `gifts` collection.
- The nine original first-launch gifts are controlled by Admin Gift Management: name, coin value, icon/image, animation file, animation format, duration, order, active/inactive status and Gift Gallery visibility.
- Live Room and Party Room already used the shared `publishedCatalogGifts` list; that list now merges Admin `gifts` with the existing `advancedGifts` catalog.
- Moments/video gift drawer now uses the same shared gift list instead of a hard-coded four-gift subset.
- Existing advanced animated gifts are retained. If the 10,000-coin **Alpha Mate Queen** entry is already saved in Firestore `advancedGifts`, it remains in the gallery and keeps its advanced animation settings. The exact Queen document/name/media was not embedded in the uploaded ZIP, so its live Firestore record could not be independently inspected here.
- Admin Gift Management visibility is labelled **Gift Gallery Visibility**. It does not write to or populate Store Management / Store inventory.
- Store catalog code and Store inventory remain separate and were not connected to live gifts.
- A `gift_catalog_meta/default_seed` marker prevents the Admin API from re-seeding the nine defaults if the catalog is intentionally emptied later.
- Uploaded Admin gift media now receives a persistent Firebase Storage download-token URL instead of relying only on a six-hour signed URL.

### 2. Agency coin balance synchronization

- Mobile agency balance normalization now reads the available value from `coinBalance`, `agencyBalance`, `coins`, and older stock aliases, using the highest recorded balance during migration.
- Mobile agency coin deductions and allocations update `coinBalance`, `agencyBalance`, and `coins` together.
- Admin agency creation, allocation, hold, release and deduction routes now keep the same three balance fields synchronized.
- Admin agency lists and search results normalize the balance aliases so the Admin UI does not show a stale zero.
- Firestore rules now allow the owner of an Admin-created Coin Seller Agency to deduct stock while preventing the owner from increasing their own stock. The original app-created agency schema remains supported.

## Files changed in the mobile source

- `src/services/giftAnimationEngine.ts`
- `src/context/AppContext.tsx`
- `src/screens/MomentsScreen.tsx`
- `src/types/index.ts`
- `src/services/agencySyncService.ts`
- `src/services/firebase.ts`
- `firestore.rules`

The Admin Panel source changes are already deployed separately to the existing Admin app.

## Required rollout

1. Import/merge this updated source project into the current Alpha Mate mobile project. Do not replace it with the older 15-Nov source archive.
2. Deploy the updated Firestore rules to Firebase project `gen-lang-client-0468444352`:

   ```bash
   firebase deploy --only firestore:rules --project gen-lang-client-0468444352
   ```

   Or publish the complete `firestore.rules` file from Firebase Console > Firestore Database > Rules.
3. Build and release the mobile app once. The project declares Node `>=24.12.0` in `package.json`:

   ```bash
   npm ci
   npm run build
   npm run android:aab
   ```

4. Install the new build and sign in as the Coin Seller Agency owner to verify the live balance and gift gallery.

After this first mobile release, Admin gift changes should reach the mobile gift galleries through Firestore listeners without another APK/AAB rebuild.

## Verification limits

- The Admin Panel deployment is **Ready**. AppDeploy QA reported zero frontend errors, network errors and backend errors.
- The mobile source changes are prepared, but a full mobile build was **not** completed in this environment: the uploaded project requires Node `>=24.12.0`, this environment has Node `22.16.0`, and dependency installation could not complete. No APK/AAB is included in this archive.
- Firestore rules are included in this project but have not yet been published to Firebase.
- The exact live Alpha Mate Queen Firestore document and the reported agency's current 5.5-million balance were not directly queried; the code paths are prepared to read and preserve those existing records.
