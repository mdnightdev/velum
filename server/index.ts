// Suppress Node.js pg security warnings
process.removeAllListeners('warning');
process.on('warning', (warning) => {
  if (warning.message && warning.message.includes('SSL modes')) return;
  console.warn(warning.stack || warning.message);
});

import 'dotenv/config';
import express from 'express';
import { createServer as createHttpServer } from 'http';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { loadDb, hardResetAndSeedDatabase, SQLITE_FILE } from './db.js';
import { restoreDbFromCloud } from './services/sync.js';
import { startClearingWorker } from './services/clearingWorker.js';
import { wss, setupCloudMessageSync } from './services/websocket.js';
import { securityHeaders, fileProtection } from './middlewares/security.js';
import { apiRouter } from './routes/index.js';
import helmet from 'helmet';
import { writeServerLog } from './utils/logger.js';
import { getSecureAssetStream } from './services/storageService.js';

export const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.disable('x-powered-by');

const isProduction = process.env.NODE_ENV === 'production' && fs.existsSync(path.join(process.cwd(), 'dist', 'index.html'));

// Mount global security middlewares
app.use(securityHeaders);
app.use(fileProtection);

app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ limit: '12mb', extended: true }));

// Serve avatar and media files from local storage, fallback to Cloudflare R2
app.get('/avatars/:filename', async (req, res, next) => {
  const publicDir = path.join(process.cwd(), 'public');
  const filepath = path.join(publicDir, 'avatars', req.params.filename);
  if (fs.existsSync(filepath)) {
    return res.sendFile(filepath);
  }
  try {
    const { stream, contentType, contentLength } = await getSecureAssetStream('avatars', req.params.filename);
    if (contentType) res.setHeader('Content-Type', contentType);
    if (contentLength) res.setHeader('Content-Length', contentLength);
    (stream as any).pipe(res);
  } catch (err) {
    res.status(404).send('Not Found');
  }
});

app.get('/media/:filename', async (req, res, next) => {
  const publicDir = path.join(process.cwd(), 'public');
  const filepath = path.join(publicDir, 'media', req.params.filename);
  if (fs.existsSync(filepath)) {
    return res.sendFile(filepath);
  }
  try {
    const { stream, contentType, contentLength } = await getSecureAssetStream('media', req.params.filename);
    if (contentType) res.setHeader('Content-Type', contentType);
    if (contentLength) res.setHeader('Content-Length', contentLength);
    (stream as any).pipe(res);
  } catch (err) {
    res.status(404).send('Not Found');
  }
});

// Bind consolidated API routes
app.use('/api', apiRouter);

export const server = createHttpServer(app);

// WebSocket Upgrade Listener
server.on('upgrade', (request, socket, head) => {
  const { pathname } = new URL(request.url || '', `http://${request.headers.host}`);
  if (pathname === '/ws') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  }
});

export async function startServer() {
  // 1. Load SQLite tables into memory immediately so the UI populates instantly (sub-10ms)
  loadDb();

  // Ensure administrative base seed accounts exist without force resetting existing user data
  try {
    await hardResetAndSeedDatabase(false);
  } catch (err) {
    writeServerLog(`[SERVER] Error during administrative startup seeding: ${err}`);
  }

  // Start the background automated clearing worker & run reconciliation audits
  const instanceId = process.env.PM2_INSTANCE_ID || "0";
  if (instanceId === "0") {
    try {
      startClearingWorker();
    } catch (err) {
      writeServerLog(`[SERVER] Error starting clearing worker: ${err}`);
    }
  } else {
    writeServerLog(`[SERVER] Replica Node [${instanceId}] online. Background clearing workers bypassed.`);
  }

  // 2. Perform remote cloud restore check asynchronously in the background so it doesn't block server startup
  if (process.env.NODE_ENV === 'development' || process.env.DISABLE_CLOUD_BACKUP === '1') {
    writeServerLog('[SERVER] Development/cloud-backup-disabled mode: skipping cloud restore and realtime sync.');
  } else {
    (async () => {
      writeServerLog('[SERVER] RESTORING DATABASE STATE FROM CLOUD... (Checking connection to Neon PostgreSQL)');
      try {
        await restoreDbFromCloud();
        // Reload memory and SQLite mirrors if cloud restore successfully fetched and unlinked the local DB
        if (!fs.existsSync(SQLITE_FILE)) {
          loadDb(true);
        }
      } catch (err) {
        writeServerLog(`[SERVER] Error during cloud restore: ${err}`);
      }

      // Initialize distributed cloud message replication observer
      try {
        setupCloudMessageSync();
      } catch (err) {
        writeServerLog(`[SERVER] Distributed message listener error: ${err}`);
      }
    })().catch(err => {
      console.error('[SERVER] Background cloud restore unhandled rejection:', err);
    });
  }

  if (!isProduction) {
    writeServerLog('[SERVER] Mounting Vite Dev Server middleware for dynamic asset compiling...');
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: { server }
      },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    writeServerLog('[SERVER] Serving pre-compiled production build from dist/ directory...');
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, { 
      index: false,
      setHeaders: (res, filePath) => {
        // Prevent aggressive caching of service workers, manifests, and versions
        if (filePath.endsWith('sw.js') || filePath.endsWith('manifest.json') || filePath.endsWith('version.json')) {
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        } else {
          // For compiled asset chunks (js, css), force revalidation so hard refreshes pull modifications instantly
          res.setHeader('Cache-Control', 'no-cache, must-revalidate, max-age=0');
        }
      }
    }));
    app.get('*', (req, res) => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[SERVER] [Velum V3] Premium Secure Engine active. Listening on port: ${PORT}`);
  });
}

startServer();
