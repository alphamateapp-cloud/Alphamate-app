# Alpha Mate Railway Backend – TURN Credentials

Deploy this project using the existing `npm start` command. The Express server now exposes:

- `GET /api/health` – backend health check.
- `GET /api/auth/verify` – validates Firebase ID tokens for the app and Cloudflare Worker.
- `GET /api/webrtc/turn-credentials` – authenticated, short-lived Cloudflare Calls TURN credentials.

## Railway Variables (private)

- `FIREBASE_API_KEY` – Firebase Web API key for validating Firebase ID tokens through Identity Toolkit.
- `CLOUDFLARE_TURN_KEY_ID` – Cloudflare Calls TURN key ID.
- `CLOUDFLARE_TURN_API_TOKEN` – Cloudflare API token permitted to create TURN credentials. Keep secret.
- `TURN_CREDENTIAL_TTL` – optional integer seconds (default 3600; max 86400).
- `ALLOWED_ORIGINS` – comma-separated app origins; use `*` only for temporary testing.

## Frontend build variable

- `VITE_RAILWAY_API_URL` – public base URL of this Railway service, e.g. `https://your-service.up.railway.app`. This is a URL, not a secret. Set it in the frontend build environment before building the APK/web app.

The app sends the signed-in Firebase ID token to Railway. Railway validates it, then calls Cloudflare Calls with its private API token and returns only short-lived ICE credentials. No TURN API token is shipped to the browser/APK.

## Separate Cloudflare Worker configuration

The existing Reels Worker still runs on Cloudflare. Keep the `REELS_BUCKET` R2 binding in Cloudflare and add the non-secret `RAILWAY_API_URL` variable pointing to this Railway backend. The Worker delegates Firebase token verification to Railway, so `FIREBASE_API_KEY` is stored only in Railway.

## Firestore rules

Deploy the updated `firestore.rules` file. Party voice signaling paths are `partyRooms/{roomId}/voiceParticipants/{uid}` and `partyRooms/{roomId}/voiceSignals/{pairId}/messages/{messageId}`.

## Deployment order and exact locations

1. Deploy this app/backend to Railway with Node.js 24.12+ and the existing `npm start` start command.
2. In Railway -> Service -> Variables, add the private variables listed above. `FIREBASE_API_KEY` is the `apiKey` from the project's `firebase-applet-config.json`; the Cloudflare TURN key ID and API token come from Cloudflare Calls TURN settings. Create the API token with the permission required to create TURN credentials.
3. Copy the Railway public domain. Add it as `VITE_RAILWAY_API_URL` in the frontend build environment before rebuilding the web app/APK.
4. In Cloudflare -> Workers & Pages -> `alpha-mate-reels-api` -> Settings -> Variables, set `RAILWAY_API_URL` to the same Railway public domain. Keep the `REELS_BUCKET` R2 binding in Cloudflare. Deploy the Worker after changing this variable.
5. Deploy the updated `firestore.rules` to the Firebase project used by `firebase-applet-config.json`.
6. Test `/api/health`; then sign in to the app and test `/api/auth/verify` and `/api/webrtc/turn-credentials` from the app. The TURN endpoint requires a valid Firebase ID token.

`VITE_RAILWAY_API_URL` and Cloudflare Worker's `RAILWAY_API_URL` are public service URLs, not secrets. Do not put `CLOUDFLARE_TURN_API_TOKEN` in any `VITE_` variable, frontend file, APK, or Cloudflare Worker. The private TURN API token belongs only in Railway Variables.

## Party voice architecture note

Party signaling now uses authenticated Firestore participant presence and per-pair offer/answer/ICE message collections. The client builds a peer-to-peer audio mesh. This is suitable for integration testing and small rooms, but a 15-seat room creates many peer connections per device; for reliable production scale at the largest party tier, migrate the media plane to an SFU (for example, a managed SFU provider). TURN provides relay connectivity; it is not an SFU. Real multi-device and mobile-network testing remains mandatory.
