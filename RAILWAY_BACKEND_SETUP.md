# Alpha Mate Railway Backend – Cloudflare Realtime SFU & TURN

Public Production Backend: **`https://api.alphamate.app`**

Deploy this project using the existing `npm start` command. The Express server exposes:

- `GET /api/health` – validated status check for Firebase, Cloudflare SFU, and Cloudflare TURN (`?fresh=1` bypasses 60s cache).
- `GET /api/auth/verify` – validates Firebase ID tokens for the app and Cloudflare Worker.
- `GET /api/webrtc/turn-credentials` – issues short-lived Cloudflare Realtime TURN ICE servers via `/v1/turn/keys/{id}/credentials/generate-ice-servers`.
- `POST /api/sfu/sessions`, `POST /api/sfu/sessions/:sessionId/tracks`, `PUT /api/sfu/sessions/:sessionId/renegotiate`, `PUT /api/sfu/sessions/:sessionId/tracks/close`, `GET /api/sfu/sessions/:sessionId`, `DELETE /api/sfu/sessions/:sessionId` – Cloudflare Realtime SFU gateway.
- `POST /api/sfu/party/rooms`, `POST /api/sfu/party/rooms/:roomId/token`, `POST /api/sfu/party/rooms/:roomId/leave` – authenticated Party Room SFU session & role token management.

## Railway Variables (private)

- `FIREBASE_API_KEY` – Firebase Web API key for validating Firebase ID tokens through Identity Toolkit.
- `CLOUDFLARE_TURN_TOKEN_ID` (or `CLOUDFLARE_TURN_KEY_ID`) – Cloudflare Realtime TURN Token ID.
- `CLOUDFLARE_TURN_API_TOKEN` – Cloudflare API token permitted to generate TURN credentials. Keep secret.
- `TURN_CREDENTIAL_TTL` – optional integer seconds (default 3600; min 300, max 86400).
- `REALTIME_SFU_APP_ID` – Cloudflare Realtime SFU Application ID.
- `REALTIME_SFU_BEARER_TOKEN` – Cloudflare Realtime SFU API Token / Bearer credential. Keep secret.
- `ALLOWED_ORIGINS` – comma-separated app origins (or `*`).

## Frontend build variable

- `VITE_RAILWAY_API_URL=https://api.alphamate.app` – public base URL of the Railway service used by both Web and Capacitor Android builds (no relative `/api` or `localhost` fallback).

The app sends the signed-in Firebase ID token to Railway (`https://api.alphamate.app`). Railway validates it, then calls Cloudflare SFU / TURN with private server credentials and returns only session IDs, SDP answers, and short-lived ICE servers. No Cloudflare or Firebase secrets are shipped to the browser or APK.
