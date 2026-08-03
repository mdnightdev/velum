// Suppress Node.js pg security warnings
process.removeAllListeners('warning');
process.on('warning', (warning) => {
  if (warning.message && warning.message.includes('SSL modes')) return;
  console.warn(warning.stack || warning.message);
});

import express from 'express';
import { createServer as createHttpServer } from 'http';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import helmet from 'helmet';
import { app as v2App } from './v2/app.js';
import { config } from './v2/config.js';
import { ensureAdminSeeded } from './v2/services/adminSeeder.js';
import { setupWebSocketServer } from './websocket.js';
import { currencyConverter } from './v2/services/currencyConverter.js';

export const app = express();

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: false,
  frameguard: false
}));
app.disable('x-powered-by');

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

// Bind V2 Engine API
app.use(v2App);

// Serve uploads statically
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

export const server = createHttpServer(app);

export async function startServer() {
  // Seed admin users from environment variables
  await ensureAdminSeeded();
  
  // Load exchange rates from database into CurrencyConverter cache
  await currencyConverter.loadRatesFromDb();
  
  // Setup WebSocket server
  setupWebSocketServer(server);
  
  const isProduction = process.env.NODE_ENV === 'production' && fs.existsSync(path.join(process.cwd(), 'dist', 'index.html'));

  if (!isProduction) {
    console.log('[SERVER V2] Mounting Vite Dev Server middleware...');
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: false // Explicitly disable HMR
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
    console.log('[SERVER V2] Serving pre-compiled production build from dist/ directory...');
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, { 
      index: false,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('sw.js') || filePath.endsWith('manifest.json') || filePath.endsWith('version.json')) {
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        } else {
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

  const PORT = config.PORT || 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[SERVER] [Velum V2 Engine] Active on port: ${PORT}`);
  });
}

startServer();

