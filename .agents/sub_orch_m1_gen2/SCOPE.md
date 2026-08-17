# Scope: Milestone 1 - Package & WASM Bundler Configuration (Gen 2)

## Objective
Verify `@signalapp/libsignal-client` installation and bundler (Vite, Rollup, TypeScript, Vitest) configuration to ensure WASM/native crypto modules resolve and execute cleanly in browser and Node environments. Validate via full review, adversarial challenger testing, and forensic audit.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Package & WASM Configuration | Setup `@signalapp/libsignal-client` and configure Vite / Rollup / Vitest bundler resolution | M1 | ORIGINAL_REQUEST §R1 |

## Requirements Breakdown
1. `@signalapp/libsignal-client` in `package.json` dependencies.
2. `vite-plugin-wasm` and node/browser configuration in `vite.config.ts`.
3. `"test": "vitest run"` in `package.json` scripts.
4. `npm run build` and `npm run lint` succeed cleanly with 0 errors.
5. Reviewer, Challenger, and Forensic Auditor verification for Gate Pass.

## Code Layout Ownership
- `package.json`
- `vite.config.ts`
- `tsconfig.json`
- `tests/unit/libsignal-primitives.test.ts`
