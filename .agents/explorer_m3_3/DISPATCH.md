## 2026-08-15T07:52:20Z
You are Explorer 3 (Spec Miner) for Milestone 3 (M3: Identity & Prekey Bundle Management).
Your working directory is `/root/velum/.agents/explorer_m3_3/`.
Read `/root/velum/.agents/ORIGINAL_REQUEST.md`, `/root/velum/PROJECT.md`, `/root/velum/TEST_READY.md`, and `/root/velum/.agents/sub_orch_m3/SCOPE.md`.

Your task:
1. Investigate existing test files in `tests/` (e.g. `tests/e2e/`, `tests/unit/`, `vitest.config.ts`).
2. Identify how tests are structured, how mocks/fixtures or test databases/in-memory environments are set up for unit & integration testing.
3. Formulate the exact specification and test cases required for M3:
   - Client key generation (Curve25519 identity key, signed prekey + valid signature, one-time prekeys pool)
   - Serialization to `SignalPrekeyBundleDTO` and `SignalPrekeyPublishDTO`
   - Verification of signature with identity public key
   - Backend publishing of bundle
   - Backend atomic consumption of one-time prekey (ensuring one-time prekeys are consumed once and pool size decreases)
   - Handling of empty one-time prekey pool (returning null for oneTimePrekey when depleted)
4. Write your specification and test design to `/root/velum/.agents/explorer_m3_3/analysis.md` and deliver `handoff.md`.
Then send a message to parent with the summary.
