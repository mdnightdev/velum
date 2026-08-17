# Handoff Report: Challenger 2 — Milestone 1 (Package & WASM Bundler Configuration)

**Verdict**: **REQUEST_CHANGES**

---

## 1. Observation

1. **Adversarial Concurrency & Bundler Test (`tests/unit/libsignal-concurrency-bundler.test.ts`)**:
   - Created and executed a high-concurrency stress test covering:
     - 50 concurrent async tasks executing `IdentityKeyPair.generate()`, `PrivateKey.generate()`, `idKeyPair.privateKey.sign()`, `SignedPreKeyRecord.new()`, `PreKeyBundle.new()`, and `ProtocolAddress.new()`.
     - 500 rapid key generation iterations and 100 serialize-deserialize roundtrips.
     - Protocol address edge cases (Unicode, whitespace, long strings, invalid negative device IDs).
     - Signature non-malleability and cross-payload isolation.
   - Executed:
     ```bash
     npx vitest run tests/unit/libsignal-concurrency-bundler.test.ts
     ```
   - Result:
     ```
     RUN  v4.1.10 /data/data/com.termux/files/home/velum
     Test Files  1 passed (1)
          Tests  6 passed (6)
     Duration  3.48s
     (Exited with code 0)
     ```

2. **Core Primitives Test (`tests/unit/libsignal-primitives.test.ts`)**:
   - Executed:
     ```bash
     npx vitest run tests/unit/libsignal-primitives.test.ts
     ```
   - Result:
     ```
     RUN  v4.1.10 /data/data/com.termux/files/home/velum
     Test Files  1 passed (1)
          Tests  7 passed (7)
     Duration  3.01s
     (Exited with code 0)
     ```

3. **Bundler & Build Pipeline Execution (`npm run build`)**:
   - Executed:
     ```bash
     npm run build
     ```
   - Result:
     ```
     vite v8.2.0 building client environment for production...
     ✓ 1603 modules transformed.
     dist/index.html                             1.15 kB │ gzip:  0.56 kB
     dist/assets/index.B0YvRKBI.css            123.31 kB │ gzip: 19.03 kB
     dist/assets/rolldown-runtime.hePW80VL.js    0.71 kB │ gzip:  0.42 kB
     dist/assets/PasswordInput.qUVW-P02.js       1.35 kB │ gzip:  0.73 kB
     dist/assets/LegalDocModal.0P2wewHm.js       4.87 kB │ gzip:  1.64 kB
     dist/assets/ProfileMigration.BOGas0c4.js    5.06 kB │ gzip:  1.77 kB
     dist/assets/AuthPortal.Ddm1Uh39.js         34.81 kB │ gzip:  7.14 kB
     dist/assets/index.CP0Ipft3.js              74.19 kB │ gzip: 21.39 kB
     dist/assets/AdminControlDesk.DeOkZAmI.js  148.13 kB │ gzip: 28.00 kB
     dist/assets/vendor-react.BHRPly9u.js      161.03 kB │ gzip: 52.54 kB
     dist/assets/PullToRefresh.D4W3-gP6.js     176.39 kB │ gzip: 41.68 kB
     dist/assets/DashboardLayout.8d1dA-uU.js   216.40 kB │ gzip: 43.39 kB
     ✓ built in 9.81s
       dist/server.cjs      382.0kb
       dist/server.cjs.map  697.2kb
     ⚡ Done in 313ms
     (Exited with code 0)
     ```

4. **Lint Check & TypeScript Verification (`npm run lint`)**:
   - Executed:
     ```bash
     npm run lint
     ```
   - Result (Exited with code 2, 6 errors):
     ```
     tests/unit/libsignal-stress.test.ts:115:51 - error TS2345: Argument of type 'Uint8Array<ArrayBuffer>' is not assignable to parameter of type 'Buffer<ArrayBufferLike>'.
     115           expect(idPair.publicKey.verify(message, corruptedSig)).toBe(false);

     tests/unit/libsignal-stress.test.ts:144:56 - error TS2345: Argument of type 'Uint8Array<ArrayBuffer>' is not assignable to parameter of type 'Buffer<ArrayBufferLike>'.
     144           const res = idPair.publicKey.verify(message, dummySig);

     tests/unit/libsignal-stress.test.ts:163:39 - error TS2345: Argument of type 'Buffer<ArrayBuffer> | Uint8Array<ArrayBuffer>' is not assignable to parameter of type 'Buffer<ArrayBufferLike>'.
     163           IdentityKeyPair.deserialize(payload);

     tests/unit/libsignal-stress.test.ts:177:36 - error TS2345: Argument of type 'Uint8Array<ArrayBuffer>' is not assignable to parameter of type 'Buffer<ArrayBufferLike>'.
     177           PreKeyRecord.deserialize(payload);

     tests/unit/libsignal-stress.test.ts:191:42 - error TS2345: Argument of type 'Uint8Array<ArrayBuffer>' is not assignable to parameter of type 'Buffer<ArrayBufferLike>'.
     191           SignedPreKeyRecord.deserialize(payload);

     tests/unit/libsignal-stress.test.ts:206:33 - error TS2345: Argument of type 'Uint8Array<ArrayBuffer>' is not assignable to parameter of type 'Buffer<ArrayBufferLike>'.
     206           PublicKey.deserialize(raw);

     Found 6 errors in the same file, starting at: tests/unit/libsignal-stress.test.ts:115
     ```

---

## 2. Logic Chain

1. **WASM / Native Crypto Primitives Instantiation & Concurrency**:
   - Observation 1 and 2 confirm `@signalapp/libsignal-client` executes cryptographic primitives correctly in parallel async environments.
   - High concurrency (50 tasks), memory recycling (500 rapid key allocations), serialization roundtrips, and tampering detection all pass without crashes or memory corruption.
2. **Bundler & Build Execution**:
   - Observation 3 confirms `vite build` and `esbuild` compile cleanly into `dist/` with code 0, meeting the bundler resolution requirement.
3. **Type Safety & Linting Failure**:
   - Observation 4 demonstrates that `@signalapp/libsignal-client` TypeScript typings require `Buffer` for `.verify(message, signature)` and `.deserialize(payload)`.
   - `tests/unit/libsignal-stress.test.ts` passes raw `Uint8Array` to these methods, causing `tsc --noEmit` (`npm run lint`) to fail with exit code 2 and 6 type errors.
   - Acceptance criteria require `npm run lint` to exit with code 0 (zero errors).

---

## 3. Caveats

- The core implementation files (`package.json`, `vite.config.ts`, `tsconfig.json`) and the worker's unit test (`tests/unit/libsignal-primitives.test.ts`) are completely healthy and valid.
- The 6 TypeScript errors reside exclusively in `tests/unit/libsignal-stress.test.ts` where `Buffer.from(...)` wrapping is required for `Uint8Array` parameters passed to `verify` and `deserialize`.
- Database integration test failures in `server/v2/tests/` are due to PostgreSQL service being offline in the headless environment, which is expected and documented.

---

## 4. Conclusion

**Verdict**: **REQUEST_CHANGES**

**Required Action**:
Update `tests/unit/libsignal-stress.test.ts` to wrap `Uint8Array` instances with `Buffer.from(...)` (or cast to `Buffer`) on lines 115, 144, 163, 177, 191, and 206 so that `npm run lint` (`tsc --noEmit`) passes with 0 errors.

---

## 5. Verification Method

1. **Verify Concurrency & Bundler Stress**:
   ```bash
   npx vitest run tests/unit/libsignal-concurrency-bundler.test.ts
   ```
   *Expected*: 6/6 tests pass.

2. **Verify Build**:
   ```bash
   npm run build
   ```
   *Expected*: Exits with code 0.

3. **Verify Lint**:
   ```bash
   npm run lint
   ```
   *Expected*: Exits with code 0 after remediating `tests/unit/libsignal-stress.test.ts`.
