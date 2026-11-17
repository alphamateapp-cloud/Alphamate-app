# Alpha Mate Party Voice Fix v1.2.3

## Changes in this source update
- Party voice now schedules automatic reconnect attempts after Agora disconnect/failure/error, using exponential backoff (1.5s up to 30s).
- A reconnect leaves the previous Agora channel and removes old event listeners before joining again.
- Agora local speaking detection now reads the local speaker volume entry (UID 0), restoring local mic activity state; remote speaker activity remains mapped from Agora remote UIDs.
- Android listening-only viewers no longer need microphone permission just to join and hear a Party Room.
- Android requests microphone permission when a listener takes a seat / switches to publishing, and reports permission denial cleanly.

## Important verification limits
- This is a source-code update. The full Vite/TypeScript/Android build and real-device Agora call tests have not been run in this environment.
- The current `agoraPartyEngine.ts` still explicitly limits the Party voice transport to the native Android Agora plugin (`AGORA_ANDROID_REQUIRED`). Therefore this update does **not** implement browser/Web Party voice. A separate Agora Web SDK transport and web microphone/audio playback validation are still required before claiming Web voice support.
- Automatic reconnection cannot guarantee uninterrupted audio during a network outage; it restores the session after connectivity returns. Agora token endpoint and credentials must be valid.
