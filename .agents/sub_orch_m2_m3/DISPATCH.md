## 2026-08-15T09:13:51Z
You are the Sub-Orchestrator for Milestones 2 & 3 (Store Adapter & Prekey Bundle Management).
Your working directory is `/root/velum/.agents/sub_orch_m2_m3/`.
You MUST read `/root/velum/.agents/ORIGINAL_REQUEST.md`, `/root/velum/PROJECT.md`, and `/root/velum/TEST_READY.md` before starting.

Your scope:
1. **Milestone 2 (R2 - Signal Protocol Store Adapter)**:
   - In `src/services/cryptoDbStore.ts`, implement the required Signal Protocol storage interfaces backed by IndexedDB (`idb`):
     - `IdentityKeyStore` (`getIdentityKeyPair`, `getLocalRegistrationId`, `saveIdentity`, `isTrustedIdentity`, `getIdentity`)
     - `PreKeyStore` (`savePreKey`, `getPreKey`, `removePreKey`)
     - `SignedPreKeyStore` (`saveSignedPreKey`, `getSignedPreKey`)
     - `SessionStore` (`saveSession`, `getSession`, `getExistingSessions`)
     - `SenderKeyStore` (`saveSenderKey`, `getSenderKey`)
   - Strict namespacing by `${localUserId}`.
   - Clean reset and purge support via `purgeCryptoVault(userId?: string)`.
2. **Milestone 3 (R3 - Identity & Prekey Bundle Management and Backend Routes)**:
   - Generate Curve25519 IdentityKeyPair, SignedPreKeyRecord + Ed25519 signature, OneTimePreKey records.
   - Base64 wire serialization.
   - Update `server/v2/db/schema/keys.ts` (`user_prekeys` table with registrationId, signedPrekeyId, oneTimePrekeys).
   - Update `server/v2/services/crypto/prekeyVaultService.ts` and `server/v2/routes/cryptoRoutes.ts` (and consolidate any duplicate routes in `userRoutes.ts`) to publish and fetch Signal-compliant prekey bundles with atomic one-time prekey consumption.

Execution workflow:
1. Initialize `SCOPE.md`, `BRIEFING.md`, `progress.md`.
2. Dispatch Worker (with MANDATORY INTEGRITY WARNING: "DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. An auditor will independently verify your work.").
3. Dispatch 2 Reviewers, 2 Challengers, and 1 Forensic Auditor.
4. Evaluate gate in `GATE_STATUS.md`.
5. When all criteria pass, write `handoff.md` and send a completion message to your parent.
