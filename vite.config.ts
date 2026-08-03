import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig({
  define: {
    'import.meta.env.VITE_BUILD_TIME': JSON.stringify(new Date().toISOString()),
  },
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    strictPort: true,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    },
    // HMR enabled for faster development.
    hmr: true,
    // Enable file watching.
    watch: {},
  },
  test: {
    testTimeout: 20000,
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]',
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')) return 'vendor-react';
            if (id.includes('lucide-react')) return 'vendor-icons';
            return 'vendor-utils';
          }
        },
      },
    },
  },
});
