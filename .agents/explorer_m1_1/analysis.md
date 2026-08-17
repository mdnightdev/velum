# Milestone 1 Analysis: Package & WASM Bundler Configuration

## Executive Summary
This document provides a comprehensive technical investigation of package distribution, bundler resolution (Vite / Rollup), TypeScript configuration, and runtime/test environments (Node.js / Vitest / Browser) for migrating Velum's E2EE cryptographic engine to `@signalapp/libsignal-client` and supporting Signal Protocol operations.

---

## 1. Current Repository Build & Configuration Audit

### 1.1 `package.json` Inspection
- **Package name & type**: `"velum"`, `"version": "2.2.0"`, `"type": "module"`.
- **Current Scripts**:
  - `"dev"`: `"tsx watch --exclude 'server/db/**' --exclude 'server/logs/**' server/index.ts"`
  - `"start"`: `"node dist/server.cjs"`
  - `"build"`: `"vite build && esbuild server/index.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs"`
  - `"lint"`: `"tsc --noEmit"`
  - `"heal"`: `"tsx server/self-healing.ts"`
  - `"dev:server"`: `"tsx watch server/index.ts"`
  - `"cli"` / `"cli:v2"`: `"tsx cli/v2/index.ts"`
  - `"backup"`, `"restore"`, `"sync-to-cloud"`, `"sync-from-cloud"`: shell scripts
- **Missing Test Script**: `"test"` script is currently missing from `package.json` `"scripts"`. `"vitest"` is installed in `devDependencies` (`^4.1.9`), but no `"test": "vitest run"` entry exists.
- **Current Dependencies**:
  - `idb`: `^8.0.3` (IndexedDB Promise wrapper)
  - `hash-wasm`: `^4.11.0` (WASM hashing library)
  - `drizzle-orm`: `^0.45.2`, `pg`: `^8.22.0`, `@neondatabase/serverless`: `^1.1.0`
  - `express`: `^4.19.2`, `ws`: `^8.17.0`, `zod`: `^4.4.3`
  - `react`: `^18.3.1`, `react-dom`: `^18.3.1`
- **Missing Dependencies**:
  - `@signalapp/libsignal-client` is not currently in `package.json` `dependencies`.
  - WASM bundler plugins (`vite-plugin-wasm`, `vite-plugin-top-level-await`) and test mock libraries (`fake-indexeddb`) are not currently in `devDependencies`.

### 1.2 `vite.config.ts` Inspection
- **Current Plugins**: `[react(), tailwindcss()]`
- **Current Test Block**:
  ```typescript
  test: {
    testTimeout: 20000,
  }
  ```
- **Current Resolve Alias**: `alias: { '@': '/src' }`
- **Current Build Configuration**:
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
- **WASM & Target Constraints**:
  - Vite default build target (`modules`) does not automatically enable top-level await unless configured with `build.target: 'esnext'` or supported by `vite-plugin-top-level-await`.
  - Loading `.wasm` modules or WASM-backed ES modules requires `vite-plugin-wasm` and `vite-plugin-top-level-await`.

### 1.3 `tsconfig.json` Inspection
- **Compiler Options**:
  - `"target": "ES2022"`
  - `"module": "ESNext"`
  - `"lib": ["ES2022", "DOM", "DOM.Iterable"]`
  - `"moduleResolution": "bundler"`
  - `"skipLibCheck": true`
  - `"noEmit": true`
  - `"paths": { "@/*": ["./*"] }`
- **Assessment**: The TypeScript configuration already uses modern `"moduleResolution": "bundler"` and `"skipLibCheck": true`, ensuring TypeScript will typecheck without conflicts from external declaration files or WASM bindings.

---

## 2. `@signalapp/libsignal-client` Distribution & Architecture

### 2.1 Distribution Model
- `@signalapp/libsignal-client` is the official Signal Protocol cryptographic implementation maintained by Signal in Rust.
- The npm package distributes:
  1. Precompiled native addons (`.node` binaries in `prebuilds/`) for Node.js platforms (Linux x64/arm64, Darwin x64/arm64, Win32 x64).
  2. TypeScript declaration files (`.d.ts`) defining the core protocol contracts (`IdentityKeyPair`, `PreKeyRecord`, `SignedPreKeyRecord`, `SessionRecord`, `ProtocolAddress`, `SessionBuilder`, `SessionCipher`, `signalEncrypt`, `signalDecrypt`, `signalDecryptPreKey`, `IdentityKeyStore`, `PreKeyStore`, `SignedPreKeyStore`, `SessionStore`, `SenderKeyStore`).
  3. WebAssembly / Web binding fallback for browser and non-native execution.

### 2.2 Bundler & Browser Integration Requirements
1. **WASM & Top-Level Await**:
   - WebAssembly module instantiation is asynchronous (`WebAssembly.instantiateStreaming` / `WebAssembly.instantiate`).
   - ES modules wrapping WASM require top-level await.
   - Vite requires `vite-plugin-wasm` and `vite-plugin-top-level-await` so that Rollup bundles WASM binaries into the client asset pipeline (`assets/*.wasm`) without failing during development HMR or production chunk compilation.
2. **Build Target**:
   - `build.target: 'esnext'` in `vite.config.ts` ensures Rollup preserves modern JavaScript features required by WASM wrappers and modern crypto APIs.
3. **Rollup Manual Chunks**:
   - In `vite.config.ts`, `manualChunks` should handle WASM-related crypto dependencies under `vendor-crypto` or `vendor-utils` cleanly.

---

## 3. Node.js (Vitest) vs. Browser (Vite) Environment Matrix

| Environment Feature | Browser (Vite Dev / Build) | Node.js (Vitest / Server) |
|---|---|---|
| Runtime Engine | Chromium / WebKit / Firefox | Node.js 20+ |
| Cryptography Primitives | `window.crypto.subtle` (WebCrypto) | `globalThis.crypto.subtle` (Node WebCrypto) or native binding |
| IndexedDB | `window.indexedDB` (Native) | Not present by default; requires `fake-indexeddb` in Vitest |
| WASM Loading | Fetch + `WebAssembly.instantiateStreaming` via `vite-plugin-wasm` | Buffer / native file read or Node native addon |
| Bundler / Transpiler | Vite (Rollup / esbuild) | Vitest (esbuild / Vite pipeline in Node) |

### 3.1 Test Runner (Vitest) Considerations
- Vitest tests running in Node.js need access to IndexedDB if testing `cryptoDbStore.ts` or `doubleRatchetService.ts`.
- Adding `fake-indexeddb` (`import 'fake-indexeddb/auto'`) in test setup files or Vitest test config enables IndexedDB operations to run synchronously and identically in Node.js test runs.
- WebCrypto (`crypto.subtle`) is globally available in Node.js 20+, compatible with standard WebCrypto calls.

---

## 4. Implementation Plan for Milestone 1

### Step 1: `package.json` Updates
1. Add `"test": "vitest run"` to `"scripts"`.
2. Add `@signalapp/libsignal-client` to `"dependencies"`.
3. Add `vite-plugin-wasm`, `vite-plugin-top-level-await`, and `fake-indexeddb` to `"devDependencies"`.

### Step 2: `vite.config.ts` Updates
1. Import `wasm` from `vite-plugin-wasm` and `topLevelAwait` from `vite-plugin-top-level-await`.
2. Add `wasm()` and `topLevelAwait()` to the `plugins` array.
3. Set `build.target: 'esnext'` and configure `test` block with `environment: 'jsdom'` or `'node'` and `globals: true`.
4. Ensure `rollupOptions` handles WASM assets and manual chunks cleanly.

### Step 3: Verification & Quality Gate
1. Execute `npm run lint` (`tsc --noEmit`) to verify 0 type errors.
2. Execute `npm run build` (`vite build && esbuild ...`) to verify 0 bundling / WASM errors.
3. Execute `npm test` (`vitest run`) to verify all existing and new unit tests execute cleanly.
