import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import http from 'http';
import type { AddressInfo } from 'net';
import fs from 'fs';
import path from 'path';
import { utilityRouter } from '../routes/utilityRoutes';

const app = express();
app.use(express.json());
app.use('/v2', utilityRouter);

describe('OTA', () => {
  it('GET /v2/ota/manifest returns valid manifest metadata', async () => {
    const res = await request(app).get('/v2/ota/manifest');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('version');
    expect(res.body).toHaveProperty('buildTime');
    expect(res.body).toHaveProperty('bundleUrl');
    expect(res.body.bundleUrl).toBe('/v2/ota/bundle.zip');
  });

  it('GET /v2/ota/bundle.zip returns a valid zip archive with PK magic header', async () => {
    const zipPath = path.join(process.cwd(), 'public', 'ota', 'bundle.zip');
    expect(fs.existsSync(zipPath)).toBe(true);

    const server = await new Promise<http.Server>((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });
    const { port } = server.address() as AddressInfo;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/v2/ota/bundle.zip`);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type') || '').toContain('application/zip');

      const reader = res.body?.getReader();
      expect(reader).toBeTruthy();
      const first = await reader!.read();
      await reader!.cancel();

      const buf = first.value;
      expect(buf).toBeTruthy();
      expect(buf!.length).toBeGreaterThanOrEqual(4);
      expect(buf![0]).toBe(0x50);
      expect(buf![1]).toBe(0x4b);
      expect(buf![2]).toBe(0x03);
      expect(buf![3]).toBe(0x04);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    }
  });
});
