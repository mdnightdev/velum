# Pending Migration: @signalapp/libsignal-client

## Overview
This document outlines the architectural hurdles and requirements for migrating the current custom WebCrypto (P-256) E2EE implementation (`doubleRatchetService.ts`) to the official `@signalapp/libsignal-client` library. This migration is on standby pending the results of the current custom implementation testing.

## Migration Requirements & Challenges

### 1. Cryptographic Incompatibility (Hard Reset Required)
- **Issue**: The current implementation uses WebCrypto with P-256 (NIST) curves. `libsignal-client` strictly uses Curve25519 (X25519).
- **Action**: Existing keys and active conversation states cannot be migrated. All users will need to generate new identity keys, upload new prekey bundles, and restart their ratchet sessions. A "migration phase" to purge old sessions will be necessary.

### 2. WASM & Bundler Configuration
- **Issue**: `libsignal-client` uses a Rust core compiled to WebAssembly (WASM).
- **Action**: The Vite build system must be configured to correctly serve and instantiate WASM files, which may require adjustments for SSR or test environments (like Jest/Vitest).

### 3. Implementing the Signal Protocol Store
- **Issue**: Signal requires a custom storage layer implementation.
- **Action**: A custom adapter must be written to implement Signal's `ProtocolStore` interfaces (`IdentityKeyStore`, `PreKeyStore`, `SessionStore`, and `SignedPreKeyStore`). The existing `cryptoDbStore.ts` IndexedDB logic must be rewritten to match Signal's expected asynchronous behavior and shapes.

### 4. Backend Schema Adjustments
- **Issue**: Signal's prekey bundles have very specific structures.
- **Action**: Minor database schema adjustments (in `schema/tickets.ts` or `users.ts`) may be needed to accommodate Signal's exact payload sizes and data structures for Identity Keys, Signed Prekeys, Signatures, and One-Time Prekeys.

## Conclusion
Migrating to `libsignal-client` will immediately resolve most of the security vulnerabilities identified in `E2EE_SECURITY_AUDIT.md` (e.g., using X25519, proper HKDF salts, secure nonces, and verified signatures). If the current custom implementation fails testing, this migration plan will be executed.
