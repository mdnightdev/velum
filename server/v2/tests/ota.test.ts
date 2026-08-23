import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { utilityRouter } from '../routes/utilityRoutes';

const app = express();
app.use(express.json());
app.use('/v2', utilityRouter);

describe('Over-The-Air (OTA) Live Updates Pipeline', () => {
  it('GET /v2/ota/manifest returns valid manifest metadata', async () => {
    const res = await request(app).get('/v2/ota/manifest');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('version');
    expect(res.body).toHaveProperty('buildTime');
    expect(res.body).toHaveProperty('bundleUrl');
    expect(res.body.bundleUrl).toBe('/v2/ota/bundle.zip');
  });

  it('GET /v2/ota/bundle.zip returns a valid zip archive with PK magic header', async () => {
    const res = await request(app)
      .get('/v2/ota/bundle.zip')
      .buffer(true)
      .parse((res, callback) => {
        res.setEncoding('binary');
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => { callback(null, Buffer.from(data, 'binary')); });
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/zip');
    
    // Zip file header signature check: PK\x03\x04 (0x50 0x4B 0x03 0x04)
    const buffer = res.body as Buffer;
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer[0]).toBe(0x50);
    expect(buffer[1]).toBe(0x4B);
    expect(buffer[2]).toBe(0x03);
    expect(buffer[3]).toBe(0x04);
  });
});
