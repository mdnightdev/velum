## 2026-08-15T01:08:15Z

You are the E2E Test Writer (Replacement / Finisher) for Velum.
Your working directory is `/root/velum/.agents/e2e_test_writer_2/`.
You MUST read `/root/velum/.agents/ORIGINAL_REQUEST.md`, `/root/velum/PROJECT.md`, and `/root/velum/TEST_INFRA.md` before starting.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations and tests must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. An auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Context:
The previous test writer created initial implementations:
- `tests/e2e/helpers/mockIndexedDB.ts`
- `tests/e2e/helpers/testEnv.ts`
- `tests/e2e/e2ee-protocol-tiers.test.ts`
- `tests/e2e/e2ee-signal.test.ts`

Your mission:
1. Inspect the existing test files in `tests/e2e/`.
2. Ensure the test coverage requirements in `TEST_INFRA.md` are completely met:
   - Tier 1: Feature Coverage (>=5 tests per feature across all 7 features: Identity generation, prekey publishing, X3DH session building, encryption, decryption, attachments, offline outbox - >=35 tests total).
   - Tier 2: Boundary & Corner Cases (>=5 tests per feature: zero one-time prekeys, duplicate replay rejection, corrupted ciphertext/HMAC, identity key mismatch, max payload size, rapid concurrent encryption - >=35 tests total).
   - Tier 3: Cross-Feature Combinations (Bidirectional ratchet stepping, out-of-order delivery with skipped keys, outbox reconnect draining, etc. - >=10 tests total).
   - Tier 4: Real-World Scenarios (Full Alice & Bob simulated conversation with 10+ bidirectional messages, alternating text, voice notes, attachments, offline catch-up, device reset - >=5 scenarios total).
   - `tests/e2e/e2ee-signal.test.ts` (multi-turn conversation and integration test harness).
3. Execute `npx vitest run tests/e2e/` (or package.json test script). Fix any syntax, typing, or runtime errors in the tests/helpers so that ALL tests pass with 100% success.
4. Verify `npm run lint` or `npx tsc --noEmit` if relevant for tests.
5. Write your complete handoff report to `/root/velum/.agents/e2e_test_writer_2/handoff.md` including exact test counts per tier and test execution output.
6. Send a message to your parent when done.
