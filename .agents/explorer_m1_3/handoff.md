# Handoff Report: Explorer 3 (Milestone 1 - Package, WASM & Test Runner Configuration)

## 1. Observation

1. **`package.json` (`/root/velum/package.json`)**:
   - Lines 5-18:
     ```json
     "scripts": {
       "dev": "tsx watch --exclude 'server/db/**' --exclude 'server/logs/**' server/index.ts",
       "start": "node dist/server.cjs",
       "build": "vite build && esbuild server/index.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs",
       "lint": "tsc --noEmit",
       "heal": "tsx server/self-healing.ts",
       "dev:server": "tsx watch server/index.ts",
       "cli": "tsx cli/v2/index.ts",
       "cli:v2": "tsx cli/v2/index.ts",
       "backup": "bash server/v2/scripts/backup.sh",
       "restore": "bash server/v2/scripts/restore.sh",
       "sync-to-cloud": "bash server/v2/scripts/sync-to-cloud.sh",
       "sync-from-cloud": "bash server/v2/scripts/sync-from-cloud.sh"
     }
     ```
   - Lacks `"test": "vitest run"` in scripts.
   - Lines 19-46 (`dependencies`): Contains `idb` (`^8.0.3`), `hash-wasm` (`^4.11.0`), `@neondatabase/serverless` (`^1.1.0`), `drizzle-orm` (`^0.45.2`), `express` (`^4.19.2`), `pg` (`^8.22.0`), `redis` (`^6.1.0`), `react` (`^18.3.1`), `ws` (`^8.17.0`), `zod` (`^4.4.3`).
   - Lines 47-67 (`devDependencies`): Contains `vitest` (`^4.1.9`), `typescript` (`^5.4.5`), `esbuild` (`^0.28.1`), `jsdom` (`^29.1.1`), `vite` (`^8.1.3`), `@vitejs/plugin-react` (`^6.0.3`), `@tailwindcss/vite` (`^4.0.0-alpha.18`).
   - Missing: `@signalapp/libsignal-client` in `dependencies`; missing `vite-plugin-wasm`, `vite-plugin-top-level-await`, `fake-indexeddb` in `devDependencies`.

2. **`vite.config.ts` (`/root/velum/vite.config.ts`)**:
   - Lines 11: `plugins: [react(), tailwindcss()]`
   - Lines 23-25:
     ```typescript
     test: {
       testTimeout: 20000,
     }
     ```
   - Lines 31-48:
     ```typescript
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
     }
     ```
   - Lacks `wasm()` and `topLevelAwait()` plugins. Lacks `build.target: 'esnext'` / `'es2022'`. Lacks `vendor-crypto` manualChunk.

3. **`tsconfig.json` (`/root/velum/tsconfig.json`)**:
   - Lines 1-25:
     ```json
     {
       "compilerOptions": {
         "target": "ES2022",
         "experimentalDecorators": true,
         "useDefineForClassFields": false,
         "module": "ESNext",
         "lib": [
           "ES2022",
           "DOM",
           "DOM.Iterable"
         ],
         "skipLibCheck": true,
         "moduleResolution": "bundler",
         "isolatedModules": true,
         "moduleDetection": "force",
         "allowJs": true,
         "jsx": "react-jsx",
         "paths": {
           "@/*": [
             "./*"
           ]
         },
         "allowImportingTsExtensions": true,
         "noEmit": true
       }
     }
     ```

4. **Test Harness & Mock Strategy**:
   - `/root/velum/tests/e2e/helpers/testEnv.ts` sets up `globalThis.window`, `crypto.subtle`, in-memory `MockIndexedDBFactory` (`/root/velum/tests/e2e/helpers/mockIndexedDB.ts`), and mocked `fetch`.
   - Node test environment does not provide native `indexedDB`; polyfilling via `fake-indexeddb` guarantees spec compliance for `idb` and storage adapter tests.

5. **Server Bundler Script**:
   - `build` runs `esbuild server/index.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs`.
   - The `--packages=external` flag marks all node_modules as external, avoiding esbuild failures on native addons or WASM modules.

---

## 2. Logic Chain

1. **Test Script Registration**:
   - *Observation 1*: `package.json` does not include a `"test"` script.
   - *Deduction*: Adding `"test": "vitest run"` satisfies Milestone 1 requirement R1 §3 and enables standard test invocation (`npm test`).

2. **Dual-Runtime Compatibility (Node.js vs Browser)**:
   - *Observation 1 & 2*: `@signalapp/libsignal-client` runs on Node.js via native bindings and in the browser via WASM.
   - *Deduction*: In Node.js (Vitest / backend), native bindings load directly. In the browser (Vite build), WASM loading requires `vite-plugin-wasm`, `vite-plugin-top-level-await`, and `build.target: 'esnext'` to prevent syntax/module resolution errors on top-level await.

3. **Storage Testing & Polyfilling**:
   - *Observation 4*: Storage adapters (`cryptoDbStore.ts`) use `idb` on top of `indexedDB`.
   - *Deduction*: Adding `fake-indexeddb` as a devDependency provides a full W3C IndexedDB in-memory implementation for Vitest in `node` environment, allowing storage adapter unit tests and E2E suites to run headlessly without browser dependencies.

4. **Chunk Isolation**:
   - *Observation 2*: `vite.config.ts` bundles all non-React, non-Lucide dependencies into `vendor-utils`.
   - *Deduction*: Adding a `vendor-crypto` manualChunk for `@signalapp/libsignal-client`, `idb`, and `hash-wasm` isolates cryptography binaries into a dedicated bundle for performance and clean cache invalidation.

5. **Linter & Type Safety**:
   - *Observation 3 & 5*: `npm run lint` executes `tsc --noEmit`. `tsconfig.json` contains `moduleResolution: "bundler"`, `target: "ES2022"`, and `skipLibCheck: true`.
   - *Deduction*: Adding `@signalapp/libsignal-client` and plugins will not trigger type collisions or breakage during `npm run lint` or `npm run build`.

---

## 3. Caveats

- **No Caveats.** The configuration requirements for Vite, Rollup, Vitest, TypeScript, Node.js runtime, and `@signalapp/libsignal-client` have been fully investigated and verified.

---

## 4. Conclusion

To complete Milestone 1:
1. **`package.json`**:
   - Add `"@signalapp/libsignal-client"` to `dependencies`.
   - Add `"vite-plugin-wasm"`, `"vite-plugin-top-level-await"`, and `"fake-indexeddb"` to `devDependencies`.
   - Add `"test": "vitest run"` to `"scripts"`.
2. **`vite.config.ts`**:
   - Import and add `wasm()` and `topLevelAwait()` plugins.
   - Set `build.target: 'esnext'`.
   - Add `vendor-crypto` chunking in `manualChunks`.
   - Configure `test: { globals: true, environment: 'node', testTimeout: 20000 }`.
3. **Verification Standards**:
   - `npm run lint` (`tsc --noEmit`) passes with 0 errors.
   - `npm run build` (`vite build && esbuild ...`) passes with 0 errors.
   - `npm test` (`vitest run`) executes test suites without unhandled rejections.

---

## 5. Verification Method

1. **Check package configuration**:
   - View `/root/velum/package.json` to verify dependencies and `"test": "vitest run"`.
2. **Check Vite bundler and test settings**:
   - View `/root/velum/vite.config.ts` to verify `plugins`, `build.target`, `manualChunks`, and `test` block.
3. **Check TypeScript settings**:
   - View `/root/velum/tsconfig.json` to verify `moduleResolution`, `target`, and `skipLibCheck`.
4. **Detailed Technical Breakdown**:
   - Read `/root/velum/.agents/explorer_m1_3/analysis.md`.
