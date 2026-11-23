# Alpha Mate — Admin Gift Gallery Real-time Sync

This source release connects the app's Live Room, Party Room, and Moments gift galleries to the shared Firestore `gifts` collection used by Alpha Mate Admin Gift Management.

## Runtime behavior

- The app subscribes to `gifts` and `gift_catalog_meta/default_seed` with Firestore `onSnapshot` listeners.
- Admin additions, coin-price edits, image/animation URL changes, ordering changes, and visibility/status changes flow into the app without restarting or publishing another APK.
- The same `publishedCatalogGifts` list feeds Live Room, Party Room, and Moments.
- Gift sends resolve the latest catalog record and price from the shared catalog.
- Uploaded WEBM, MP4, MOV, SVGA, SVG, and GIF assets are passed to the existing universal animation player. PNG assets are used as thumbnails.
- Admin-paused or hidden records are excluded. A paused record also suppresses a same-ID advanced gift so it cannot reappear from the legacy animation collection.
- Store inventory remains separate; this feature reads only `gifts` and does not connect Store Management to the gift gallery.
- The existing `advancedGifts` listener remains enabled, preserving existing published advanced gifts such as Alpha Mate Queen.

## One-time release requirement

This is an app-code change. Build and publish this updated app once (APK/AAB or web release). After users have this release installed/loaded, subsequent Admin gift catalog changes are remote Firestore updates and do not require another app release.

## Firestore access

`firestore.rules` already permits public read/list on `gifts` and restricts client writes to official admins. `gift_catalog_meta/default_seed` is readable by clients and writable only by official admins. Do not grant app clients write access to the catalog.

## Android build

The project declares Node `>=24.12.0`. Use Node 24.12.0 or newer for a supported production build:

```bash
npm ci
npm run build
npm run android:sync
npm run android:aab
```

For a debug APK, use `npm run android:apk`. Configure the existing production signing credentials before generating a release AAB/APK.

## Verification checklist

1. Add an active gift in Admin with name, coin value, icon/thumbnail, animation format, and a persistent Firebase Storage download URL.
2. Confirm it appears in Live Room, Party Room, and Moments after Firestore listener delivery.
3. Send it and confirm the coin debit and animation use the current Admin price and media URL.
4. Change its price/media/order and confirm all three galleries refresh.
5. Pause or hide it and confirm it disappears from all three galleries.
6. Confirm Store inventory is unchanged.
7. Reconnect a device that was offline and confirm the catalog refreshes.

The repository package install/build must be run in the project's supported Node environment before treating the APK/AAB as production-verified.
