import 'dotenv/config';
import express from 'express';
import { createServer as createHttpServer } from 'http';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { loadDb, hardResetAndSeedDatabase } from './db.js';
import { restoreDbFromCloud } from './services/sync.js';
import { startClearingWorker } from './services/clearingWorker.js';
import { wss, setupCloudMessageSync } from './services/websocket.js';
import { securityHeaders, fileProtection } from './middlewares/security.js';
import { apiRouter } from './routes/index.js';
import helmet from 'helmet';

export const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.disable('x-powered-by');

const isProduction = process.env.NODE_ENV === 'production' && fs.existsSync(path.join(process.cwd(), 'dist', 'index.html'));

// Mount global security middlewares
app.use(securityHeaders);
app.use(fileProtection);

app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ limit: '12mb', extended: true }));

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
  // 1. Load SQLite tables into memory immediately so the UI populates instantly
  loadDb();

  if (process.env.NODE_ENV === 'development' || process.env.DISABLE_CLOUD_BACKUP === '1') {
    console.log('[SYS-SECURE] Development/cloud-backup-disabled mode: skipping cloud restore and realtime sync.');
  } else {
    console.log('[SYS-SECURE] RESTORING DATABASE STATE FROM CLOUD... (Checking connection to Neon PostgreSQL)');
    // 2. Run cloud restore in the background without blocking server startup
    restoreDbFromCloud().catch(() => {});

    // Initialize distributed cloud message replication observer
    try {
      setupCloudMessageSync();
    } catch (err) {
      console.error('[SYS-SECURE] Distributed message listener error:', err);
    }
  }

  // Ensure administrative base seed accounts exist without force resetting existing user data
  try {
    await hardResetAndSeedDatabase(false);
  } catch (err) {
    console.error('[SYS-SECURE] Error during administrative startup seeding:', err);
  }

  // Start the background automated clearing worker & run reconciliation audits
  try {
    startClearingWorker();
  } catch (err) {
    console.error('[SYS-SECURE] Error starting clearing worker:', err);
  }

  if (!isProduction) {
    console.log('[SYS-SECURE] Mounting Vite Dev Server middleware for dynamic asset compiling...');
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: { server }
      },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    console.log('[SYS-SECURE] Serving pre-compiled production build from dist/ directory...');
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

  const PORT = process.env.PORT ? parseInt(String(process.env.PORT), 10) : 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[SYS-SECURE] [Velum V3] Premium Secure Engine active. Listening on port: ${PORT}`);
  });
}

startServer();
