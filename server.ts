import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createApiApp } from './server-api.js';
import { attachRealtimeWebSocketServer } from './server-realtime.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 3000);

async function startServer() {
  const app = createApiApp();

  const server = http.createServer(app);
  server.requestTimeout = 0;
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
        ws: { server },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const HASHED_ASSET_RE = /[\\/]assets[\\/][^\\/]+-[A-Za-z0-9_-]{6,}\.(?:js|css|webp|avif|jpe?g|png|svg|woff2?)$/i;
    app.use(
      express.static(path.join(__dirname, 'dist'), {
        maxAge: '1d',
        etag: true,
        lastModified: true,
        index: false,
        setHeaders: (res, filePath) => {
          if (
            filePath.endsWith('sw.js') ||
            filePath.endsWith('registerSW.js') ||
            filePath.endsWith('manifest.webmanifest') ||
            filePath.endsWith('manifest.json')
          ) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          } else if (HASHED_ASSET_RE.test(filePath)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          } else {
            res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
          }
        },
      })
    );
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  attachRealtimeWebSocketServer(server, {
    app,
    verifyFirebaseIdToken: app.locals.verifyFirebaseIdToken,
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Alpha Mate] Dev & API + WebSocket Server running on port ${PORT}`);
  });
}

startServer();
