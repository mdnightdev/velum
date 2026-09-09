/// <reference types="vitest" />
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import wasm from 'vite-plugin-wasm';
import fs from 'node:fs';
import path from 'node:path';

/**
 * public/uploads holds runtime user media. Vite copies publicDir wholesale into
 * dist, which would ship every uploaded file in the bundle and the OTA zip.
 */
function excludeUploadsFromBuild(): Plugin {
  return {
    name: 'velum-exclude-uploads',
    apply: 'build',
    closeBundle() {
      const uploadsOut = path.resolve(process.cwd(), 'dist', 'uploads');
      fs.rmSync(uploadsOut, { recursive: true, force: true });
    },
  };
}

/**
 * VITE_* values are inlined at build time, so a localhost endpoint here ships a
 * bundle that calls the user's own device instead of the server.
 */
function assertProductionEndpoints(mode: string): void {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const suspect = (['VITE_API_URL', 'VITE_WS_URL'] as const).filter((key) =>
    /localhost|127\.0\.0\.1|0\.0\.0\.0/.test(env[key] || '')
  );
  if (!suspect.length) return;

  const detail = `${suspect.join(', ')} point at localhost`;
  if (process.env.ALLOW_LOCALHOST_BUILD === 'true') {
    console.warn(`[BUILD] Warning: ${detail}. This bundle is not deployable.`);
    return;
  }
  throw new Error(
    `[BUILD] ${detail}. Set them to the public domain, or run with ALLOW_LOCALHOST_BUILD=true for a local-only bundle.`
  );
}

export default defineConfig(({ mode }) => {
  assertProductionEndpoints(mode);

  return {
    define: {
      'import.meta.env.VITE_BUILD_TIME': JSON.stringify(new Date().toISOString()),
      'process.env': {},
      global: 'globalThis',
    },
    esbuild: {
      drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
    },
    plugins: [wasm(), react(), tailwindcss(), excludeUploadsFromBuild()],
    server: {
      port: 3000,
      host: '0.0.0.0',
      strictPort: true,
      allowedHosts: true,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      },
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    resolve: {
      alias: {
        '@': '/src',
      },
    },
  };
});
