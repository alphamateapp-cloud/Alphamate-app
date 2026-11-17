# Alpha Mate Party Agora Migration — Engineering Status

## Implemented in source
- Native Android Agora RTC SDK dependency and Capacitor `AgoraParty` bridge.
- Party screen uses `AgoraPartyEngine` for Party voice lifecycle, mute, speaker, speaking-mode and cleanup paths.
- Solo Live and Solo PK remain on the existing WebRTC service.
- Party token requests use the authenticated Railway endpoint `/api/agora/party/rooms/:roomId/token`.
- Publish permission changes request a fresh server-issued token before updating Agora publish role.
- Party screen supplies host/seat profile metadata; Agora numeric UIDs are mapped to Firebase user IDs using the same deterministic UID hash as the backend.
- Agora audio-volume callbacks update remote speaking indicators.

## Not verified / remaining release gates
- Dependency installation did not complete in this environment, so TypeScript/Vite compilation was not run.
- Android Gradle build was not completed.
- No physical Android device was available for Agora microphone, Bluetooth, speaker, reconnection, PK, or multi-seat tests.
- Agora remote video is intentionally disabled for Party; Party is audio-only as requested. Solo Live video remains WebRTC.
- Confirm Party PK listen/publish role transitions and seat changes on device; if token privileges are denied, refresh the token and rejoin the channel using the new token.
- Confirm the Railway deployed backend has the latest `server-api.js` token endpoint and the `AGORA_APP_ID`, `AGORA_APP_CERTIFICATE` and token TTL configuration.

This is an implementation candidate source package, not a certified production release until all release gates pass.
