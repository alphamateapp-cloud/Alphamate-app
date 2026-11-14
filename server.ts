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

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist'), { maxAge: '1d', index: false }));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  const server = http.createServer(app);
  server.requestTimeout = 0;
  server.headersTimeout = 60_000;
  attachRealtimeWebSocketServer(server, {
    app,
    verifyFirebaseIdToken: app.locals.verifyFirebaseIdToken,
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Alpha Mate] Dev & API + WebSocket Server running on port ${PORT}`);
  });
}

startServer();
