# Alpha Mate Reels API — Cloudflare Worker Deployment Guide

This Cloudflare Worker handles raw video streaming into Cloudflare R2 (`alpha-mate-reels`) with:
1. **Server-Side Streamed Size Enforcement:** Automatically rejects videos larger than 100 MB during streaming (not just checking `Content-Length`).
2. **Firebase Auth Token Verification:** Authenticates requests via `Authorization: Bearer <ID_TOKEN>` using Firebase Identity Toolkit API.
3. **Owner Protection:** Deletions are strictly restricted to the user who uploaded the reel.
4. **Custom Domain:** Returns media URLs on `https://media.alphamate.app`.

---

## 1. Quick Deploy via Wrangler

To deploy or update this Worker in Cloudflare:

```bash
cd cloudflare-worker
npx wrangler deploy
```

---

## 2. Set the Required Secret: `FIREBASE_API_KEY`

The worker requires the `FIREBASE_API_KEY` secret to verify incoming Firebase ID tokens:

```bash
npx wrangler secret put FIREBASE_API_KEY
```
When prompted, paste the Firebase Web API Key:
```
AIzaSyBvTPyVnoubFs9J36o4thMhta5-NYUWPn0
```

Or configure it in the Cloudflare Dashboard:
1. Go to **Workers & Pages** -> **alpha-mate-reels-api**.
2. Click **Settings** -> **Variables and Secrets**.
3. Add a secret named `FIREBASE_API_KEY` with the Firebase Web API key value.
4. Click **Deploy / Save**.

---

## 3. R2 Bucket & Custom Domain Configuration

In Cloudflare Dashboard:
1. **R2 Object Storage** -> **alpha-mate-reels**.
2. In **Settings** -> **Public access**:
   - Ensure custom domain `media.alphamate.app` is connected to bucket `alpha-mate-reels`.
   - Ensure CORS rule allows `GET` requests with `AllowedOrigins: ["*"]`.
