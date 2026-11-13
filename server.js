import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3000;

// Private Railway variables. Never expose the Cloudflare API token to the app client.
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;
const CLOUDFLARE_TURN_KEY_ID = process.env.CLOUDFLARE_TURN_KEY_ID;
const CLOUDFLARE_TURN_API_TOKEN = process.env.CLOUDFLARE_TURN_API_TOKEN;
const TURN_CREDENTIAL_TTL = Math.min(Math.max(Number(process.env.TURN_CREDENTIAL_TTL || 3600), 300), 86400);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '*').split(',').map((v) => v.trim()).filter(Boolean);

app.use((req, res, next) => {
  const origin = req.headers.origin || '';
  const allowed = ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.includes(origin);
  if (allowed) res.header('Access-Control-Allow-Origin', ALLOWED_ORIGINS.includes('*') ? '*' : origin);
  res.header('Vary', 'Origin');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.get('/api/health', (_req, res) => res.json({ success: true, service: 'alpha-mate-backend', status: 'online' }));

async function verifyFirebaseIdToken(idToken) {
  if (!FIREBASE_API_KEY) throw new Error('FIREBASE_API_KEY is not configured in Railway.');
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(FIREBASE_API_KEY)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken }),
  });
  if (!response.ok) return null;
  const data = await response.json();
  const user = data.users?.[0];
  return user?.localId ? { uid: user.localId, email: user.email || null, emailVerified: !!user.emailVerified } : null;
}

app.get('/api/auth/verify', async (req, res) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) return res.status(401).json({ success: false, error: 'Firebase Bearer token required.' });
    const user = await verifyFirebaseIdToken(token);
    if (!user) return res.status(401).json({ success: false, error: 'Firebase ID token invalid or expired.' });
    return res.json({ success: true, user });
  } catch (error) {
    console.error('[Auth] Token verification failed:', error);
    return res.status(503).json({ success: false, error: 'Firebase token verification is not configured.' });
  }
});

// Authenticated endpoint: Firebase ID token -> short-lived Cloudflare Calls TURN credentials.
app.get('/api/webrtc/turn-credentials', async (req, res) => {
  try {
    if (!FIREBASE_API_KEY || !CLOUDFLARE_TURN_KEY_ID || !CLOUDFLARE_TURN_API_TOKEN) {
      return res.status(503).json({ success: false, error: 'TURN backend is not configured. Set FIREBASE_API_KEY, CLOUDFLARE_TURN_KEY_ID and CLOUDFLARE_TURN_API_TOKEN in Railway Variables.' });
    }
    const authHeader = req.headers.authorization || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!idToken) return res.status(401).json({ success: false, error: 'Firebase Bearer token required.' });

    const authenticatedUser = await verifyFirebaseIdToken(idToken);
    if (!authenticatedUser) return res.status(401).json({ success: false, error: 'Firebase ID token is invalid or expired.' });

    const turnResponse = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(CLOUDFLARE_TURN_KEY_ID)}/credentials`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${CLOUDFLARE_TURN_API_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ttl: TURN_CREDENTIAL_TTL }),
    });
    const turnData = await turnResponse.json().catch(() => ({}));
    if (!turnResponse.ok || !turnData.iceServers) {
      console.error('[TURN] Cloudflare Calls credential request failed:', turnData);
      return res.status(502).json({ success: false, error: 'Cloudflare TURN credential generation failed.' });
    }
    const dynamicServers = Array.isArray(turnData.iceServers) ? turnData.iceServers : [turnData.iceServers];
    return res.json({
      success: true,
      source: 'railway-cloudflare-calls',
      iceServers: [{ urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'] }, ...dynamicServers],
      ttl: TURN_CREDENTIAL_TTL,
      expiresAt: Date.now() + TURN_CREDENTIAL_TTL * 1000,
    });
  } catch (error) {
    console.error('[TURN] Credential endpoint error:', error);
    return res.status(500).json({ success: false, error: 'Unable to issue TURN credentials.' });
  }
});

// Serve the built app from the same Railway service when configured as a combined deployment.
app.use(express.static(path.join(__dirname, 'dist'), { maxAge: '1d', index: false }));
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ success: false, error: 'API endpoint not found.' });
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => console.log(`[Alpha Mate] Server running on port ${PORT}`));
