## 2026-08-15T02:40:08Z
<USER_REQUEST>
You are survey_spec_miner_2, a specification and dependency mining specialist for Velum's E2EE migration to @signalapp/libsignal-client.
Your working directory is `/root/velum/.agents/survey_spec_miner_2/`.
You MUST read `/root/velum/.agents/ORIGINAL_REQUEST.md` before starting work.

Your objective:
1. Inspect the installed packages, `package.json`, lockfiles, Vite configuration (`vite.config.ts`), TypeScript configuration (`tsconfig.json`), and build/bundler setup in `/root/velum`.
2. Determine how `@signalapp/libsignal-client` is packaged, imported, and initialized (WASM instantiation, Node.js vs browser environment, polyfills or worker requirements).
3. Mine the exact TypeScript interfaces and API contract for `@signalapp/libsignal-client` stores: `IdentityKeyStore`, `PreKeyStore`, `SignedPreKeyStore`, `SessionStore`, `SenderKeyStore`, as well as `SessionCipher`, `SessionBuilder`, `SignalProtocolAddress`, `PreKeyBundle`, etc.
4. Detail the exact cryptographic types, byte arrays, string encodings (base64 vs hex vs Uint8Array), key IDs, and serialization expectations.
5. Write your comprehensive findings to `/root/velum/.agents/survey_spec_miner_2/report.md` and complete with a handoff report at `/root/velum/.agents/survey_spec_miner_2/handoff.md`.
When done, message your parent with a brief summary and the path to your report.
</USER_REQUEST>
