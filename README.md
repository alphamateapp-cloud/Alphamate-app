<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/88a3637b-56a3-47f2-a3ab-b67bf1702cff

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Railway / WebRTC backend setup

See `RAILWAY_BACKEND_SETUP.md` for the exact Railway variables, Cloudflare Worker URL binding, Firebase rules deployment, and test order. Private TURN API credentials are kept on Railway; the client receives only short-lived TURN ICE credentials after Firebase authentication.
