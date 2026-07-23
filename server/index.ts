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
import { loadDb, hardResetAndSeedDatabase, SQLITE_FILE, syncDbIfNeeded } from './db.js';
import { restoreDbFromCloud } from './services/sync.js';
import { startClearingWorker } from './services/clearingWorker.js';
import { wss, setupCloudMessageSync } from './services/websocket.js';
import { securityHeaders, fileProtection } from './middlewares/security.js';
import { apiRouter } from './routes/index.js';
import helmet from 'helmet';
import { writeServerLog } from './utils/logger.js';
import { getSecureAssetStream } from './services/storageService.js';
import { runPendingMigrations } from './db/migrationManager.js';

export const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.disable('x-powered-by');

// Global cache synchronization middleware to auto-reload SQLite changes across clustered worker processes
app.use((req, res, next) => {
  syncDbIfNeeded();
  next();
});

const isProduction = process.env.NODE_ENV === 'production' && fs.existsSync(path.join(process.cwd(), 'dist', 'index.html'));

// Mount global security middlewares
app.use(securityHeaders);
app.use(fileProtection);

app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ limit: '12mb', extended: true }));

// Handle malformed JSON request bodies
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err && (err instanceof SyntaxError || err.type === 'entity.parse.failed') && 'status' in err && (err as any).status === 400) {
    return res.status(400).json({ error: 'Malformed JSON payload provided.' });
  }
  next(err);
});

// Serve legal documents
app.get('/terms', (_req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'terms-of-service.html'));
});
app.get('/privacy', (_req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'privacy-policy.html'));
});

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
  const instanceId = process.env.NODE_APP_INSTANCE || process.env.PM2_INSTANCE_ID || "0";
  const disableCloudBackup = process.env.DISABLE_CLOUD_BACKUP === '1' || process.env.NODE_ENV === 'development';

  const { DB_CRYPTO_KEY } = await import('./services/cryptoService.js');
  const key = process.env.DB_ENCRYPTION_KEY || '';
  const salt = process.env.DB_ENCRYPTION_SALT || '';
  writeServerLog(`[CRYPTO-VERIFY] Key length: ${key.length}, Salt length: ${salt.length}`);
  writeServerLog(`[CRYPTO-VERIFY] Key start/end: [${key[0] || ''}]/[${key.slice(-1)}], Salt start/end: [${salt[0] || ''}]/[${salt.slice(-1)}]`);
  writeServerLog(`[CRYPTO-VERIFY] Derived key hash on Render: ${DB_CRYPTO_KEY.toString('hex')}`);

  // 1. Perform remote cloud restore synchronously on instance 0 before loading database
  if (instanceId === "0" && !disableCloudBackup) {
    writeServerLog('[SERVER] RESTORING DATABASE STATE FROM CLOUD... (Checking connection to Neon PostgreSQL)');
    try {
      await restoreDbFromCloud();
    } catch (err) {
      writeServerLog(`[SERVER] Error during cloud restore: ${err}`);
    }
  }

  // 2. Load SQLite tables into memory
  loadDb(true);

  // Ensure administrative base seed accounts, database migrations, and clearing workers
  // are only executed by Instance 0 to prevent 'database is locked' collisions on PM2 cluster startup.
  if (instanceId === "0") {
    try {
      await hardResetAndSeedDatabase(false);
    } catch (err) {
      writeServerLog(`[SERVER] Error during administrative startup seeding: ${err}`);
    }

    try {
      const migrationResult = await runPendingMigrations();
      if (migrationResult.applied > 0) {
        writeServerLog(`[MIGRATIONS] Applied ${migrationResult.applied} pending migration(s) on startup.`);
      }
      if (migrationResult.failed > 0) {
        writeServerLog(`[MIGRATIONS] ${migrationResult.failed} migration(s) failed on startup. Errors: ${migrationResult.errors.join(', ')}`);
      }
    } catch (err) {
      writeServerLog(`[SERVER] Error running database migrations: ${err}`);
    }

    try {
      startClearingWorker();
    } catch (err) {
      writeServerLog(`[SERVER] Error starting clearing worker: ${err}`);
    }

    // Initialize distributed cloud message replication observer
    if (!disableCloudBackup) {
      try {
        setupCloudMessageSync();
      } catch (err) {
        writeServerLog(`[SERVER] Distributed message listener error: ${err}`);
      }
    }
  } else {
    writeServerLog(`[SERVER] Replica Node [${instanceId}] online. Background clearing workers, seeding, and migrations bypassed.`);
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
    
    app.get('*', async (req, res, next) => {
      const url = req.originalUrl;
      try {
        let template = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    app.get('/api/debug-log', (req, res) => {
      const logPath = path.join(process.cwd(), 'data', 'server.log');
      if (fs.existsSync(logPath)) {
        res.type('text/plain').send(fs.readFileSync(logPath, 'utf8'));
      } else {
        res.send('No log file found.');
      }
    });

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
