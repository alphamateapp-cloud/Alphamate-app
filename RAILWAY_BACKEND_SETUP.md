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


## Alpha Mate Admin API (read-only)

The Admin Panel is a separate frontend/domain. These endpoints are added to this existing Railway backend and read from the **same Firebase project and named Firestore database** configured above. They do not write, update, or delete app records.

Required private Railway variables:

- `FIREBASE_SERVICE_ACCOUNT_JSON` – complete service-account JSON for the same Firebase project. Store only in Railway Variables; never add it to GitHub, `.env.example` with a real value, frontend code, or APK.
- `ADMIN_EMAILS` – comma-separated Firebase-authenticated administrator email allowlist (default: `alphamateapp@gmail.com`).
- `FIREBASE_PROJECT_ID` – same project as the app (`gen-lang-client-0468444352`).
- `FIREBASE_DATABASE_ID` – same named Firestore database as the app (`ai-studio-alphamatelivepar-88a3637b-56a3-47f2-a3ab-b67bf1702cff`).
- `ALLOWED_ORIGINS` – include both the main app origin and the separate Admin Panel origin.

Every Admin API request must send `Authorization: Bearer <Firebase ID token>` for a Firebase-authenticated user whose email is in `ADMIN_EMAILS`.

Read-only endpoints:

- `GET /api/admin/status` – verifies the service-account connection and returns project/database identifiers.
- `GET /api/admin/dashboard` – returns real Firestore aggregate counts for users, party rooms, live streams, and reels. A `null` count means the count query could not be read; it is not shown as zero.
- `GET /api/admin/collections/users?pageSize=50` – paginated user profiles.
- `GET /api/admin/collections/partyRooms?pageSize=50` – paginated party room records.
- `GET /api/admin/collections/liveStreams?pageSize=50` – paginated live stream records.
- `GET /api/admin/collections/reels?pageSize=50` – paginated reel metadata, including R2 video URLs saved by the app.
- `GET /api/admin/collections/presence?pageSize=50` – paginated user presence records.

Pagination: pass the returned `nextPageToken` as the next request's `pageToken`. Maximum page size is 100. Unsupported collection names are rejected. Credential-like fields are filtered from returned documents. No fake coin usage or transaction records are generated; those modules remain unavailable until the app writes real records to a documented Firestore collection.

The API provides secure paginated reads. For instant push-style updates, the separate Admin Panel can poll these endpoints or add a dedicated realtime subscription/SSE layer in a later change. The current endpoints do not claim to push live updates by themselves.
