import { describe, it, expect, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { mediaRouter } from '../routes/mediaRoutes';
import { uploadsRouter } from '../routes/uploadsRoutes';

const app = express();

vi.mock('../middleware/auth.js', () => ({
  hashSessionToken: (token: string) => token,
  auth: (req: any, res: any, next: any) => {
    if (req.headers.authorization === 'Bearer mock-token') {
      req.user = { userId: 1, username: 'testuser', role: 'USER' };
      return next();
    }
    return res.status(401).json({ error: 'Unauthorized: Session token missing.' });
  },
}));


// Same serving path as production: local disk first, then object storage
app.use('/uploads', uploadsRouter);

app.use('/v2', mediaRouter);

// Standard error handler to return body-parser size limit statuses correctly (e.g. 413)
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  res.status(err.status || err.statusCode || 500).json({ error: err.message });
});

const uploadsRoot = path.join(process.cwd(), 'public', 'uploads');

/**
 * Only remove folders this suite created. Wiping the whole uploads root would
 * destroy real user media on any machine that runs the tests.
 */
const preexistingUploadEntries = fs.existsSync(uploadsRoot)
  ? new Set(fs.readdirSync(uploadsRoot))
  : new Set<string>();

function cleanupUploads() {
  if (!fs.existsSync(uploadsRoot)) return;
  for (const entry of fs.readdirSync(uploadsRoot)) {
    if (preexistingUploadEntries.has(entry)) continue;
    fs.rmSync(path.join(uploadsRoot, entry), { recursive: true, force: true });
  }
}

const REAL_PNG = Buffer.from(
  '89504e470d0a1a0a0000000d4948445200000001000000010802000000907753de0000000a49444154789c6360000002000100ffff03000006000557bfabd40000000049454e44ae426082',
  'hex'
);

describe('PUT /v2/media/upload — attachment upload security', () => {
  afterEach(cleanupUploads);

  it('[CRITICAL] requires authentication', async () => {
    const res = await request(app)
      .put('/v2/media/upload?filename=test.png&folder=media')
      .set('Content-Type', 'image/png')
      .send(REAL_PNG);

    expect(res.status).toBe(401);
  });

  it.each([
    'shell.php',
    'exploit.html',
    'malware.js',
    'backdoor.sh',
    'virus.exe',
    'payload.phtml',
    'webshell.asp',
  ])('[CRITICAL] rejects executable/script extension: %s', async (filename) => {
    const res = await request(app)
      .put(`/v2/media/upload?filename=${filename}&folder=media`)
      .set('Authorization', 'Bearer mock-token')
      .send(Buffer.from('malicious payload'));
    expect(res.status).toBe(400);
  });

  it('rejects double-extension bypass (invoice.pdf.php)', async () => {
    const res = await request(app)
      .put('/v2/media/upload?filename=invoice.pdf.php&folder=media')
      .set('Authorization', 'Bearer mock-token')
      .send(Buffer.from('<?php system($_GET["c"]); ?>'));
    expect(res.status).toBe(400);
  });

  it('rejects null-byte filename trick', async () => {
    const res = await request(app)
      .put('/v2/media/upload?filename=shell.php%00.png&folder=media')
      .set('Authorization', 'Bearer mock-token')
      .send(Buffer.from('<?php system($_GET["c"]); ?>'));
    expect(res.status).toBe(400);
  });

  it('rejects HTML/script content disguised with a safe extension', async () => {
    const res = await request(app)
      .put('/v2/media/upload?filename=fake.png&folder=media')
      .set('Authorization', 'Bearer mock-token')
      .send(Buffer.from('<html><script>alert(document.cookie)</script></html>'));
    expect(res.status).toBe(400);
  });

  it('rejects SVG containing embedded script', async () => {
    const res = await request(app)
      .put('/v2/media/upload?filename=logo.svg&folder=media')
      .set('Authorization', 'Bearer mock-token')
      .send(Buffer.from('<svg onload="alert(1)"><script>alert(2)</script></svg>'));
    expect(res.status).toBe(400);
  });

  it('rejects path traversal in filename', async () => {
    const res = await request(app)
      .put('/v2/media/upload?filename=../../../etc/cron.d/evil&folder=media')
      .set('Authorization', 'Bearer mock-token')
      .send(Buffer.from('* * * * * root touch /tmp/pwned'));
    expect(res.status).toBe(400);
  });

  it('rejects path traversal in folder', async () => {
    const res = await request(app)
      .put('/v2/media/upload?filename=x.png&folder=../../etc')
      .set('Authorization', 'Bearer mock-token')
      .send(REAL_PNG);
    expect(res.status).toBe(400);
  });

  it('rejects payload exceeding size limit', async () => {
    const big = Buffer.alloc(60 * 1024 * 1024); // over the 50mb express.raw limit
    const res = await request(app)
      .put('/v2/media/upload?filename=big.png&folder=media')
      .set('Authorization', 'Bearer mock-token')
      .send(big);
    expect(res.status).toBe(413);
  });

  it('accepts a genuine PNG and serves it safely', async () => {
    const uploadRes = await request(app)
      .put('/v2/media/upload?filename=avatar.png&folder=avatars')
      .set('Authorization', 'Bearer mock-token')
      .set('Content-Type', 'image/png')
      .send(REAL_PNG);

    expect(uploadRes.status).toBe(200);
    expect(uploadRes.body.url).toMatch(/^\/uploads\/avatars\/.+\.png$/);

    const fetchRes = await request(app).get(uploadRes.body.url);
    expect(fetchRes.headers['content-type']).toMatch(/image\/png/);
    expect(fetchRes.headers['x-content-type-options']).toBe('nosniff');
  });
});

describe('POST /v2/media/upload — mirrors PUT route, same checks apply', () => {
  afterEach(cleanupUploads);

  it('[CRITICAL] requires authentication', async () => {
    const res = await request(app)
      .post('/v2/media/upload?filename=test.png&folder=media')
      .send(REAL_PNG);
    expect(res.status).toBe(401);
  });

  it('rejects executable extension', async () => {
    const res = await request(app)
      .post('/v2/media/upload?filename=shell.php&folder=media')
      .set('Authorization', 'Bearer mock-token')
      .send(Buffer.from('malicious'));
    expect(res.status).toBe(400);
  });
});
