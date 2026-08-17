# Milestone 1: Package & WASM Bundler Configuration — Technical Analysis

## Executive Summary
This investigation assesses the Vite, TypeScript, Rollup, and Vitest configuration for integrating `@signalapp/libsignal-client` into Velum. The analysis covers module resolution, type safety, browser vs. Node runtime constraints, dependency helpers/polyfills, and build/test pipelines.

---

## 1. Vite & TypeScript Configuration Assessment

### 1.1 `vite.config.ts` Inspection
- **Current Configuration:**
  - Vite version: `^8.1.3`
  - Plugins: `@vitejs/plugin-react` (`^6.0.3`), `@tailwindcss/vite` (`^4.0.0-alpha.18`)
  - Server define: `import.meta.env.VITE_BUILD_TIME`
  - Alias: `'@': '/src'`
  - Test timeout: `20000`
  - Build settings: `sourcemap: false`, `manualChunks` splitting `vendor-react` and `vendor-icons`, defaulting rest to `vendor-utils`.
- **Gaps & Necessary Adjustments:**
  1. **Build Target**: `build.target` is not set explicitly (defaults to `'modules'` / `es2020`). Setting `build.target: 'es2022'` aligns with `tsconfig.json` (`"target": "ES2022"`) and ensures native support for Top-Level Await and modern typed array methods.
  2. **Vendor Chunking (`manualChunks`)**: Heavy cryptographic modules (`@signalapp/libsignal-client`, `hash-wasm`, `idb`) should be isolated into a dedicated `vendor-crypto` chunk rather than bundling into `vendor-utils`.
  3. **WASM / Asset Rules**: If `.wasm` assets are imported directly, ensure `assetsInclude: ['**/*.wasm']` or standard Vite WASM URL handling (`import wasmUrl from './module.wasm?url'`) is supported.
  4. **Dependency Optimization (`optimizeDeps`)**: If `@signalapp/libsignal-client` is imported in frontend modules, configuring `optimizeDeps.exclude: ['@signalapp/libsignal-client']` (or `optimizeDeps.include` based on distribution format) avoids esbuild pre-bundling conflicts with native/WASM bindings.

### 1.2 `tsconfig.json` Inspection
- **Current Configuration:**
  ```json
  {
    "compilerOptions": {
      "target": "ES2022",
      "experimentalDecorators": true,
      "useDefineForClassFields": false,
      "module": "ESNext",
      "lib": ["ES2022", "DOM", "DOM.Iterable"],
      "skipLibCheck": true,
      "moduleResolution": "bundler",
      "isolatedModules": true,
      "moduleDetection": "force",
      "allowJs": true,
      "jsx": "react-jsx",
      "paths": {
        "@/*": ["./*"]
      },
      "allowImportingTsExtensions": true,
      "noEmit": true
    },
    "exclude": ["DEAD ENGINE", "node_modules", "dist"]
  }
  ```
- **Evaluation:**
  - `"target": "ES2022"`: Fully supports modern JavaScript features including top-level await, class fields, and modern ArrayBuffer/TypedArray primitives.
  - `"moduleResolution": "bundler"`: Ideal for TypeScript 5.4+ with Vite. Correctly honors `exports` map conditions in modern `package.json` files.
  - `"skipLibCheck": true`: Prevents compilation errors from mismatched external `.d.ts` files.
  - `"paths"`: Currently maps `"@/*": ["./*"]`. Since Vite aliases `'@': '/src'`, path imports using `@/services/...` resolve to `src/services/...` in Vite. Aligning `tsconfig.json` `"@/*": ["./src/*"]` or using explicit relative paths (`./`, `../`) ensures consistent resolution across both IDE/tsc and bundler.

---

## 2. `@signalapp/libsignal-client` TypeScript & Runtime Analysis

### 2.1 Module Resolution & Import Mechanics
- **Package Architecture**:
  - `@signalapp/libsignal-client` exposes TypeScript/JavaScript APIs wrapping the official Rust core.
  - Exported classes include:
    - `ProtocolAddress` (or `SignalProtocolAddress`): Addresses recipient sessions `(${name}, ${deviceId})`.
    - `IdentityKeyPair`, `PrivateKey`, `PublicKey`: Curve25519 / Ed25519 identity key primitives.
    - `PreKeyRecord`, `SignedPreKeyRecord`, `SessionRecord`, `SenderKeyRecord`: Record state containers.
    - `PreKeyBundle`: Remote peer prekey bundle structure for X3DH session initiation.
    - `SessionCipher`, `SessionBuilder`, `GroupCipher`, `GroupSessionBuilder`: Core encryption and ratchet ciphers.
    - Storage interfaces: `IdentityKeyStore`, `PreKeyStore`, `SignedPreKeyStore`, `SessionStore`, `SenderKeyStore`.
- **Import Strategy in TypeScript**:
  - Direct named imports:
    ```typescript
    import {
      ProtocolAddress,
      IdentityKeyPair,
      PrivateKey,
      PublicKey,
      SessionCipher,
      SessionBuilder,
      PreKeyBundle,
      PreKeyRecord,
      SignedPreKeyRecord,
      SessionRecord,
      Direction
    } from '@signalapp/libsignal-client';
    ```
  - Compatible with `moduleResolution: "bundler"` and `module: "ESNext"`.

### 2.2 ES Target & Top-Level Await
- With `target: "ES2022"` in `tsconfig.json` and `build.target: "es2022"` in `vite.config.ts`, asynchronous module initialization (if required by WASM/bindings) can leverage top-level await cleanly without polyfill overhead.

---

## 3. Dependency Inventory & Polyfill Requirements

### 3.1 `package.json` Review
- **Existing Production Dependencies**:
  - `@neondatabase/serverless` (`^1.1.0`), `drizzle-orm` (`^0.45.2`), `pg` (`^8.22.0`), `redis` (`^6.1.0`)
  - `idb` (`^8.0.3`): IndexedDB promise library, ideal for implementing `cryptoDbStore.ts` Signal storage interfaces.
  - `hash-wasm` (`^4.11.0`): WebAssembly hashing primitives.
  - `express` (`^4.19.2`), `ws` (`^8.17.0`), `zod` (`^4.4.3`), `zxcvbn` (`^4.4.2`).
- **Existing DevDependencies**:
  - `vite` (`^8.1.3`), `vitest` (`^4.1.9`), `typescript` (`^5.4.5`), `esbuild` (`^0.28.1`), `jsdom` (`^29.1.1`).

### 3.2 Missing Scripts & Helpers
1. **Missing Test Script in `package.json`**:
   - `"test": "vitest run"` must be added to `scripts` in `package.json` as required by Milestone 1 / R5.
   - Additional recommended test scripts: `"test:watch": "vitest"`, `"test:e2e": "vitest run tests/e2e"`.
2. **Polyfills & Test Helpers**:
   - **`fake-indexeddb`**: Needed as a devDependency (`npm i -D fake-indexeddb`) for running IndexedDB-backed Signal store tests (`cryptoDbStore.ts`) in Vitest / Node.js without requiring a full browser or manual mocking.
   - **`buffer`**: For Base64 / binary conversions in browser environments where Node `Buffer` is absent. `Uint8Array` helper utilities (or lightweight base64 helper functions) provide clean cross-platform conversions between Signal binary records and server JSON strings without bloated polyfills.
   - **Web Crypto (`crypto.subtle`)**: In Node 20+, `globalThis.crypto` is globally available. In browser environments, `window.crypto` is standard.

---

## 4. Production & Test Bundling Strategy

### 4.1 Production Build Pipeline (`npm run build`)
- **Pipeline Components**:
  1. `vite build`: Compiles client frontend into `dist/` with ES2022 target.
  2. `esbuild server/index.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs`: Compiles server.
- **Why External Packages Work for Server**:
  - `--packages=external` tells esbuild not to bundle `node_modules` into `dist/server.cjs`.
  - `@signalapp/libsignal-client` and native modules are dynamically loaded by Node at runtime without bundling conflicts.
- **Rollup Output Optimization in `vite.config.ts`**:
  ```typescript
  manualChunks(id) {
    if (id.includes('node_modules')) {
      if (id.includes('react') || id.includes('react-dom')) return 'vendor-react';
      if (id.includes('lucide-react')) return 'vendor-icons';
      if (id.includes('@signalapp') || id.includes('hash-wasm') || id.includes('idb')) return 'vendor-crypto';
      return 'vendor-utils';
    }
  }
  ```

### 4.2 Vitest Test Runner Configuration
- **Configuration in `vite.config.ts` / `vitest.config.ts`**:
  ```typescript
  test: {
    testTimeout: 20000,
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
  }
  ```
- **Test Setup File (`tests/setup.ts`)**:
  ```typescript
  import 'fake-indexeddb/auto';
  // Ensure globalThis.crypto is available
  if (typeof globalThis.crypto === 'undefined') {
    const { webcrypto } = await import('node:crypto');
    globalThis.crypto = webcrypto as any;
  }
  ```

---

## 5. Summary Table of Recommendations

| Component | Target File | Recommended Change | Rationale |
|-----------|-------------|---------------------|-----------|
| `scripts` | `package.json` | Add `"test": "vitest run"` | Satisfies R5 & automated test requirement |
| `dependencies` | `package.json` | Add `@signalapp/libsignal-client` | Core cryptographic engine migration |
| `devDependencies` | `package.json` | Add `fake-indexeddb` | Enables Vitest execution of `cryptoDbStore.ts` IndexedDB tests in Node |
| `build.target` | `vite.config.ts` | Set `target: 'es2022'` in `build` | Guarantees top-level await and modern typed array support |
| `manualChunks` | `vite.config.ts` | Add `vendor-crypto` chunk for `@signalapp`, `hash-wasm`, `idb` | Isolates cryptographic engine assets for performance & caching |
| `test.setupFiles` | `vite.config.ts` | Configure `tests/setup.ts` | Auto-registers `fake-indexeddb` and `crypto` polyfill for all Vitest suites |
