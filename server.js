import http from 'http';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createApiApp } from './server-api.js';
import { attachRealtimeWebSocketServer } from './server-realtime.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3000;

const app = createApiApp();

// Serve the built app from the same Railway service when configured as a combined deployment.
app.use(
  express.static(path.join(__dirname, 'dist'), {
    maxAge: '1d',
    index: false,
    setHeaders: (res, filePath) => {
      if (
        filePath.endsWith('sw.js') ||
        filePath.endsWith('registerSW.js') ||
        filePath.endsWith('manifest.webmanifest') ||
        filePath.endsWith('manifest.json')
      ) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      }
    },
  })
);
app.get('*', (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const server = http.createServer(app);
server.requestTimeout = 0;
server.headersTimeout = 60_000;
attachRealtimeWebSocketServer(server, {
  app,
  verifyFirebaseIdToken: app.locals.verifyFirebaseIdToken,
});

server.listen(PORT, '0.0.0.0', () => console.log(`[Alpha Mate] Server + WebSocket running on port ${PORT}`));
