# Alpha Mate Chat – implementation status and Firebase deployment

## Implemented in this project
- Chat UI with Chats / Requests tabs, private/group filters, user search, request accept/block, group creation and group invitation accept/decline.
- Firebase Auth UID guard for remote chat operations.
- Firestore real-time listeners for conversations, messages, direct-message requests and group invitations.
- Stranger-first-message request flow: the recipient must accept before the direct conversation is created.
- Firestore message writes, reply references, edit, delete-for-me, delete-for-everyone and read receipt updates.
- Firebase Storage upload path for image/video/audio attachments, with client-side file size checks.
- Basic Firestore presence documents.
- Firestore and Storage rules are included in `firestore.rules` and `storage.rules`.

## Required before production release
1. Review and deploy the included Firestore rules to the exact database ID in `firebase-applet-config.json`.
2. Deploy `storage.rules` to the configured Firebase Storage bucket and verify Storage is enabled in Firebase Console.
3. Create Firestore composite indexes if Firebase displays a missing-index link (chat list, request list and group-invite list queries use `array-contains` / filters with ordering).
4. Enable and test the required Firebase Authentication providers. The remote chat service only works when `auth.currentUser.uid` matches the app's `currentUser.id`; local/demo sessions use the old local fallback.
5. Configure trusted Cloud Functions for FCM notifications, spam/rate limiting, abuse reporting, cleanup and server-side moderation.
6. Use Firebase Realtime Database presence with `onDisconnect` (or a trusted backend) for reliable online/offline status. Firestore `pagehide` is only best-effort and cannot detect every crash/network loss.

## Not yet production-complete
- Voice/video calling controls remain UI placeholders. Actual calling needs WebRTC signaling, TURN servers, incoming-call handling, permissions, call state, and real-device/network testing.
- Voice-note recording and playback are not fully wired; the microphone button currently sends a placeholder text in the UI.
- Message reactions are UI-only; reaction persistence and group reaction aggregation are not wired.
- Group membership invitation acceptance is wired, but admin roles, member removal, group settings and invitation notifications need further work.
- The current media uploader supports images/videos/audio files through Firebase Storage, but media playback/rendering and moderation/virus scanning need QA.
- Presence is not a guaranteed realtime connection detector. Do not show it as authoritative until the Realtime Database `onDisconnect` flow is deployed.
- This implementation is not end-to-end encrypted. Do not advertise E2EE.

## Verification
A dependency installation was attempted, but `npm ci` timed out in this environment, so TypeScript, Vite build and Android APK build could not be run. Do not ship this ZIP directly to production without running `npm ci`, `npm run lint`, `npm run build`, Firebase Emulator security tests, and Android/iOS device QA.
