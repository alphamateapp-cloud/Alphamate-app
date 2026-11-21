# Alpha Mate Device Security Integration

- Android model/manufacturer/Android release/API level and a random app-installation ID are read by the native Capacitor DeviceSecurity plugin. No IMEI, serial number, contacts, or phone identifiers are collected.
- After Firebase authentication, the app posts device metadata to `recordDeviceSecurityActivity` in `us-central1`.
- The function verifies the Firebase ID token, obtains IP from the server request (not the client payload), checks active device/IP bans and blocked-account flags, then writes `users/{uid}` telemetry, `users/{uid}/deviceSessions/{installationId}`, and `security_events`.
- GPS is requested through Android/browser location permission. If permission is denied, device/IP telemetry still works. GPS updates and 30-second heartbeats run only while the app is open/in foreground; this is not background or always-on tracking.
- Deploy Functions and Firestore rules after review: `npm --prefix functions run build` then `firebase deploy --only functions,firestore:rules --project gen-lang-client-0468444352`.
- Build Android after sync: `npm run android:sync` then `npm run android:apk` (or release build with signing configured).
- The Admin UI must read `deviceModel`, `deviceBrand`, `androidVersion`, `appVersion`, `ipAddress`, `lastSeenAt`, `deviceLocation` / `lastKnownLocation`, plus `deviceSessions` and `security_events`. Ensure its security overview includes these subcollections if it currently reads only root user docs.
