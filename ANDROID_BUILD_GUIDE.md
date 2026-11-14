# Alpha Mate — Android Environment, APK & AAB Build Guide

This project is fully configured with **Capacitor 8** native Android integration, enabling you to build installable **APK** (direct sideload & testing) and **AAB (Android App Bundle)** files for publishing to the **Google Play Store**.

---

## 📱 App Specification

- **App Name:** `Alpha Mate`
- **Package ID / Application ID:** `com.alphamate.liveparty`
- **Target SDK:** Android 15+ (API 36)
- **Minimum SDK:** Android 7.0+ (API 24)
- **Primary Activity:** `com.alphamate.liveparty.MainActivity`
- **Native Android Directory:** `/android`
- **Automated Cloud CI/CD:** `.github/workflows/build-android.yml`

---

## 🚀 Quick Build Commands

From the project root directory, run:

### 1. Sync Latest Web Code to Android
```bash
npm run android:sync
```
*This compiles the React Vite application and copies all assets into `android/app/src/main/assets/public`.*

### 2. Build Debug APK (For Testing on Physical Devices)
```bash
npm run android:apk
```
Or directly using Gradle:
```bash
cd android
./gradlew assembleDebug
```
📍 **APK File Output Location:**
```
android/app/build/outputs/apk/debug/app-debug.apk
```
*You can transfer this `.apk` to any Android phone via USB, WhatsApp, or Google Drive and install it immediately.*

---

### 3. Build Release APK (Unsigned or Signed Release APK)
```bash
npm run android:release-apk
```
Or directly using Gradle:
```bash
cd android
./gradlew assembleRelease
```
📍 **Release APK Output Location:**
```
android/app/build/outputs/apk/release/app-release.apk          (when release keystore is configured)
android/app/build/outputs/apk/release/app-release-unsigned.apk (when built without keystore)
```

---

### 4. Build Release AAB (Google Play Store Bundle)
```bash
npm run android:aab
```
Or directly using Gradle:
```bash
cd android
./gradlew bundleRelease
```
📍 **AAB File Output Location:**
```
android/app/build/outputs/bundle/release/app-release.aab
```
*This is the official compressed format required by Google Play Console for Play Store distribution.*

---

### 5. Open in Android Studio
```bash
npm run android:open
```
*Opens the `/android` folder in Android Studio for debugging in the Android Emulator or running on a connected USB device.*

---

### 6. Automated 1-Click Cloud Build & Signed Release (GitHub Actions)
If your code is hosted on GitHub, an automated workflow is included in `.github/workflows/build-android.yml`:
- Go to **Settings > Secrets and variables > Actions** on your GitHub repository and confirm these secrets exist. The workflow reads only the four explicitly named signing secrets below; it does not enumerate or dump all repository secrets:
  - `ANDROID_KEYSTORE_BASE64` (or `KEYSTORE_BASE64`) — base64-encoded `.jks` keystore file
  - `ANDROID_KEYSTORE_PASSWORD` (or `KEYSTORE_PASSWORD`) — keystore store password
  - `ANDROID_KEY_ALIAS` (or `KEY_ALIAS`, defaults to `alphamate`) — key alias
  - `ANDROID_KEY_PASSWORD` (or `KEY_PASSWORD`, defaults to keystore password) — key password
  - `VITE_RAILWAY_API_URL` (Repository Secret or Variable) — your deployed Railway backend URL (`https://...up.railway.app`) for Live SFU & TURN
- Go to **Actions** tab -> **Build Android APK and AAB** -> **Run workflow**.
- The workflow requires the official Play Store upload keystore before producing release artifacts. It builds and verifies both **signed `app-release.apk`** (`alphamate-release-apk`) and **signed `app-release.aab`** (`alphamate-release-aab`).
- If official signing secrets are missing or invalid, the workflow stops with a clear error instead of producing a temporary preview-signed APK that cannot be used for Play Store updates.
- Required GitHub Actions Repository Secrets: `ANDROID_KEYSTORE_BASE64` and `ANDROID_KEYSTORE_PASSWORD`.
- Optional: `ANDROID_KEY_ALIAS` (auto-detected if omitted) and `ANDROID_KEY_PASSWORD` (defaults to the store password).

---

## 🔑 Production Release Signing (Google Play Store)

To sign your release `.aab` or `.apk` for Google Play:

1. **Generate your Keystore:**
   ```bash
   keytool -genkey -v -keystore release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias alphamate
   ```
2. **Encode Keystore to Base64 for GitHub Secrets:**
   ```bash
   base64 -w 0 release-key.jks
   ```
3. **In Android Studio (Local Alternative):**
   - Go to **Build** > **Generate Signed Bundle / APK...**
   - Select **Android App Bundle (.aab)**
   - Select your `release-key.jks` and enter your passwords
   - Choose **release** destination and click **Finish**

---

## 🛡️ Pre-Configured Native Android Permissions

The `android/app/src/main/AndroidManifest.xml` is pre-configured with all multimedia and network permissions required for live streaming and party rooms:

- `android.permission.INTERNET`
- `android.permission.ACCESS_NETWORK_STATE`
- `android.permission.POST_NOTIFICATIONS` (Android 13+ push alerts via `@capacitor/push-notifications`)
- `android.permission.CAMERA` (For video streaming and avatar capture)
- `android.permission.RECORD_AUDIO` (For voice party rooms and mic streaming)
- `android.permission.MODIFY_AUDIO_SETTINGS` (For speakerphone and mic switching)
- `android.permission.READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO`, `READ_MEDIA_AUDIO` (Android 13+ gallery uploads)
- `android.permission.VIBRATE` (For gift animations and PK battle alerts)
- `android.permission.WAKE_LOCK` (Keeps screen awake during live streams)
- `android:usesCleartextTraffic="true"` (Ensures real-time socket and local media connectivity)

---

## 🔔 Push Notifications Integration (@capacitor/push-notifications)

Alpha Mate includes full native push notifications via `@capacitor/push-notifications` backed by Firebase Cloud Messaging (FCM):
- **Android Channels:** Pre-configured high-priority channels for Live/PK alerts (`alpha_live_alerts`), Gifts & Wallet (`alpha_rewards_alerts`), and Agency chat (`alpha_agency_chat`).
- **Foreground Heads-Up Display:** `PushNotificationBanner` renders non-intrusive floating alert pills in foreground.
- **Deep Linking:** Notification payload data automatically navigates to corresponding screens (`wallet`, `party_rooms`, `agency`, `live_stream`).
- **Device Token Management:** Automatic sync to Firestore user document under `pushNotificationToken`.
- **In-App Hub:** Manage channels, test triggers, and copy device tokens in **Settings > Push Notifications Hub**.

---

## 📲 Direct Android Home Screen Installation (PWA / WebAPK)

In addition to native APK/AAB, Alpha Mate includes a full Web App Manifest (`public/manifest.json`) and Service Worker:
- On Android Chrome, tap the in-app **"Install on This Android Device"** button in **Settings > Android APK & AAB Hub** or select **"Install App"** from the browser menu to install instantly without compiling.
