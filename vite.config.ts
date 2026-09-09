/// <reference types="vitest" />
import { defineConfig, type Plugin } from 'vite';
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

export default defineConfig({
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
});
