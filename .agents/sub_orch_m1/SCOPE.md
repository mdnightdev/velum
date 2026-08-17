# Scope: Milestone 1 - Package & WASM Bundler Configuration

## Objective
Install `@signalapp/libsignal-client` and configure bundlers (Vite, Rollup, TypeScript) and test environments (Vitest / Node.js) to resolve, bundle, and execute libsignal-client WASM/native modules smoothly in both browser and Node/Vitest environments.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Package & WASM Configuration | Setup `@signalapp/libsignal-client` and configure Vite / Rollup / Vitest bundler resolution | M1 | ORIGINAL_REQUEST §R1 |

## Requirements Breakdown
1. Install `@signalapp/libsignal-client` (and any required WASM / bundler helpers or polyfills) in `package.json`.
2. Configure `vite.config.ts`, `tsconfig.json`, and Rollup build settings to ensure `@signalapp/libsignal-client` resolves and instantiates properly in both Vite frontend client builds and Vitest / Node.js test runner environments without build or SSR breakage.
3. Register `"test": "vitest run"` in `package.json` scripts if not already present.
4. Ensure `npm run build` and `npm run lint` execute cleanly with 0 errors.

## Code Layout Ownership
- `package.json`
- `vite.config.ts`
- `tsconfig.json`
- `tsconfig.node.json` (if applicable)
- `tests/` / setup files for vitest (e.g. `vitest.config.ts` or `vite.config.ts`)
