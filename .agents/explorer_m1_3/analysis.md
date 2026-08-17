# Milestone 1: Technical Analysis & Environment Compatibility Report
**Role**: Explorer 3 (Replacement) — Package, WASM & Test Runner Architecture  
**Target Milestone**: Milestone 1 (Package & WASM Bundler Configuration)  
**Date**: 2026-08-15  

---

## 1. Executive Summary

This investigation evaluates the test runner configuration (Vitest), Node.js vs browser runtime differences for `@signalapp/libsignal-client`, IndexedDB mock/shim requirements, test execution scripts, and linting/build compatibility for Milestone 1.

Key findings:
1. **Test Runner Scripts**: `package.json` currently lacks a `"test"` script. Registering `"test": "vitest run"` is required to enable standard test execution across the workspace.
2. **Vitest Configuration**: `vite.config.ts` currently specifies a basic `test: { testTimeout: 20000 }` block. Adding `globals: true`, explicit `environment: 'node'`, and a dedicated `setupFiles` entry will streamline execution for both unit and E2E suites.
3. **`@signalapp/libsignal-client` Dual-Runtime Model**:
   - **Node.js (Vitest & Backend)**: Employs native binary addons / C++ / Rust bindings or Node-compatible ES modules. Operates directly in Node.js 20+ environments.
   - **Browser (Vite Client Bundle)**: Requires WASM asset handling and top-level await support. Requires `vite-plugin-wasm`, `vite-plugin-top-level-await`, and `build.target: 'esnext'` (or `'es2022'`).
4. **Storage & Environment Polyfills**:
   - Node.js test runs lack native `indexedDB`. While `tests/e2e/helpers/mockIndexedDB.ts` provides a custom mock, adding `fake-indexeddb` as a `devDependency` provides complete W3C IndexedDB spec compliance (supporting transactions, cursor operations, and structured cloning) for `cryptoDbStore.ts`.
5. **Linting & Build Verification**:
   - Project linting is driven by `"lint": "tsc --noEmit"`. With `tsconfig.json` configured for `moduleResolution: "bundler"`, `target: "ES2022"`, and `skipLibCheck: true`, typechecking will pass cleanly.
   - Server bundling uses `esbuild` with `--packages=external`, preventing native/external node module bundling breakage during `npm run build`.

---

## 2. Detailed Technical Findings

### 2.1 Vitest Configuration & Test Runners

#### Current State
- **`package.json` (`/root/velum/package.json`)**:
  - Contains `"vitest": "^4.1.9"` in `devDependencies`.
  - Missing `"test"` command in `"scripts"`.
  - Scripts present: `dev`, `start`, `build`, `lint`, `heal`, `dev:server`, `cli`, `cli:v2`, `backup`, `restore`, `sync-to-cloud`, `sync-from-cloud`.
- **`vite.config.ts` (`/root/velum/vite.config.ts`)**:
  - Lines 23-25:
    ```typescript
    test: {
      testTimeout: 20000,
    }
    ```
  - Vitest defaults to the `node` environment when unset.
  - Test suites (`tests/e2e/e2ee-protocol-tiers.test.ts`, `tests/e2e/e2ee-signal.test.ts`, `src/services/encryptionService.test.ts`) use explicit imports: `import { describe, it, expect } from 'vitest'`.

#### Recommended Adjustments
1. Add `"test": "vitest run"` and optional `"test:e2e": "vitest run tests/e2e/"` to `package.json` `scripts`.
2. Enhance `test` block in `vite.config.ts`:
   ```typescript
   test: {
     globals: true,
     environment: 'node',
     testTimeout: 20000,
     setupFiles: ['./tests/setup.ts'],
   }
   ```

---

### 2.2 `@signalapp/libsignal-client` Runtime & Instantiation

#### Node.js Runtime (Vitest & Server Tests)
- `@signalapp/libsignal-client` provides platform-native binary bindings for Node.js.
- Node.js 20+ natively supports:
  - `globalThis.crypto.subtle` (Web Crypto API).
  - ECMAScript modules (ESM) with top-level await.
  - Native `.node` binary addon loading.
- When running Vitest in Node.js, `@signalapp/libsignal-client` modules (e.g., `ProtocolAddress`, `SessionCipher`, `SessionBuilder`, `SignalProtocolStore`, `IdentityKeyPair`, `PreKeyBundle`, `PrivateKey`, `PublicKey`) can be imported directly via ES module syntax.

#### Browser Runtime (Vite Dev & Production Bundle)
- Browser builds require compiling and serving WebAssembly binaries.
- Standard Vite 8 Rollup bundling requires:
  1. `vite-plugin-wasm`: Intercepts WASM module imports and handles asynchronous module loading.
  2. `vite-plugin-top-level-await`: Polyfills top-level await if older ES targets are configured.
  3. `build.target: 'esnext'` (or `'es2022'`): Instructs Rollup and ESBuild to preserve top-level await syntax in production output.
  4. Dedicated chunking in `manualChunks`:
     ```typescript
     manualChunks(id) {
       if (id.includes('node_modules')) {
         if (id.includes('@signalapp/libsignal-client') || id.includes('idb') || id.includes('hash-wasm')) {
           return 'vendor-crypto';
         }
         if (id.includes('react') || id.includes('react-dom')) return 'vendor-react';
         if (id.includes('lucide-react')) return 'vendor-icons';
         return 'vendor-utils';
       }
     }
     ```

---

### 2.3 Storage Mocking & Test Environment (`fake-indexeddb` vs `jsdom` vs `node`)

#### Assessment of Test Environments
| Environment Option | Pros | Cons | Recommendation |
|--------------------|------|------|----------------|
| **`node` + Polyfills / `fake-indexeddb`** | Fast execution, native crypto performance, identical to Node backend and CI | Requires explicit IndexedDB / DOM polyfills | **Preferred** |
| **`jsdom`** | Full DOM API simulation (`window`, `document`, `navigator`) | Heavier footprint, slower execution, `crypto.subtle` sometimes incomplete in older jsdom | Secondary (used per-file if UI testing) |

#### Storage Polyfill Strategy
1. **Existing Test Harness (`tests/e2e/helpers/testEnv.ts`)**:
   - Contains custom in-memory `MockIndexedDBFactory` (`tests/e2e/helpers/mockIndexedDB.ts`).
   - Mocks `window`, `subtle`, `sessionStorage`, `localStorage`, and `fetch`.
2. **`fake-indexeddb` Integration**:
   - Installing `fake-indexeddb` (`devDependencies`) allows `import 'fake-indexeddb/auto'` in Vitest setup.
   - Replaces custom mock with a spec-compliant in-memory IndexedDB engine that fully supports `idb` version migrations, multi-store transactions, indexes, and cursor iterations.

---

### 2.4 Linting & Type Checking (`tsc --noEmit`)

#### Verification Analysis
- **Linter Command**: `"lint": "tsc --noEmit"`.
- **`tsconfig.json` Configuration**:
  ```json
  {
    "compilerOptions": {
      "target": "ES2022",
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
- **Key Properties**:
  - `moduleResolution: "bundler"`: Properly resolves `@signalapp/libsignal-client` export maps.
  - `skipLibCheck: true`: Prevents compilation errors from third-party `.d.ts` declaration conflicts between Node types and DOM types.
  - `target: "ES2022"`: Guarantees compatibility with Top-Level Await and modern ES features.

---

### 2.5 Server & Client Build Verification

#### Build Command Structure
```json
"build": "vite build && esbuild server/index.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs"
```
1. **`vite build`**:
   - Builds frontend assets into `dist/`.
   - Uses Rollup and Vite plugins.
   - Configured with `wasm()` and `topLevelAwait()` plugins to bundle WASM assets cleanly.
2. **`esbuild server/index.ts`**:
   - Bundles server code to `dist/server.cjs`.
   - `--packages=external`: Leaves all `node_modules` unbundled.
   - Ensures native Node addons and server-side dependencies are loaded by Node.js runtime without esbuild bundling errors.

---

## 3. Implementation Blueprint for Milestone 1

### Step 1: Package Dependencies (`package.json`)
- Add `"@signalapp/libsignal-client"` to `dependencies`.
- Add `"vite-plugin-wasm"`, `"vite-plugin-top-level-await"`, `"fake-indexeddb"` to `devDependencies`.
- Add `"test": "vitest run"` to `scripts`.

### Step 2: Vite Configuration (`vite.config.ts`)
- Import `wasm` from `'vite-plugin-wasm'`.
- Import `topLevelAwait` from `'vite-plugin-top-level-await'`.
- Add `wasm()` and `topLevelAwait()` to `plugins` array.
- Set `build.target: 'esnext'` (or `'es2022'`).
- Update `test` block with `globals: true`, `environment: 'node'`.
- Add `vendor-crypto` in `build.rollupOptions.output.manualChunks`.

### Step 3: Vitest Setup File (`tests/setup.ts`)
- Initialize `fake-indexeddb/auto` for headless IndexedDB access.
- Polyfill `globalThis.window` if undefined in Node environment.

### Step 4: Verification Commands
- `npm run lint` (`tsc --noEmit`) -> Expect 0 errors.
- `npm run build` (`vite build && esbuild ...`) -> Expect 0 errors, output in `dist/`.
- `npm test` (`vitest run`) -> Expect test suites to execute.
