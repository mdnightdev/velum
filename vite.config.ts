/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import wasm from 'vite-plugin-wasm';
import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig({
  define: {
    'import.meta.env.VITE_BUILD_TIME': JSON.stringify(new Date().toISOString()),
  },
  plugins: [wasm(), react(), tailwindcss()],
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
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 20000,
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  build: {
    target: 'esnext',
    sourcemap: false,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]',
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@signalapp/libsignal-client') || id.includes('hash-wasm') || id.includes('idb')) return 'vendor-crypto';
            if (id.includes('react') || id.includes('react-dom')) return 'vendor-react';
            if (id.includes('lucide-react')) return 'vendor-icons';
            return 'vendor-utils';
          }
        },
      },
    },
  },
} as any);
