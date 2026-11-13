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

## 2. Connect the Railway authentication backend

The Worker delegates Firebase ID-token verification to Railway. Set the non-secret `RAILWAY_API_URL` variable in `wrangler.toml` (or Cloudflare Dashboard -> Worker Settings -> Variables and Secrets) to the deployed Railway service URL. Do not add the Firebase API key or Cloudflare TURN API token to the Worker.

After updating the URL, deploy the Worker again with `npx wrangler deploy`.

## 3. R2 Bucket & Custom Domain Configuration

In Cloudflare Dashboard:
1. **R2 Object Storage** -> **alpha-mate-reels**.
2. In **Settings** -> **Public access**:
   - Ensure custom domain `media.alphamate.app` is connected to bucket `alpha-mate-reels`.
   - Ensure CORS rule allows `GET` requests with `AllowedOrigins: ["*"]`.

## Railway authentication bridge

Set the non-secret `RAILWAY_API_URL` Worker variable to the deployed Railway backend URL. The Worker delegates Firebase ID-token validation to `GET /api/auth/verify`; keep `FIREBASE_API_KEY` only in Railway Variables. Keep the `REELS_BUCKET` R2 binding in Cloudflare because the Worker executes the R2 upload/delete operations.
