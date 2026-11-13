import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createApiApp } from './server-api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3000;

const app = createApiApp();

// Serve the built app from the same Railway service when configured as a combined deployment.
app.use(express.static(path.join(__dirname, 'dist'), { maxAge: '1d', index: false }));
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => console.log(`[Alpha Mate] Server running on port ${PORT}`));
