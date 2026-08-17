# BRIEFING — 2026-08-15T09:56:15Z

## Mission
Investigate backend schema, prekey vault services, routes, and atomic pool consumption logic for Milestone 3 (Identity & Prekey Bundle Management).

## 🔒 My Identity
- Archetype: Explorer
- Roles: Backend Investigator, Schema & Service Architect
- Working directory: /root/velum/.agents/explorer_m3_2/
- Original parent: 82da5259-8d41-4d16-88bd-19ef84d571a3
- Milestone: M3 (Identity & Prekey Bundle Management)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement production code
- Adhere to AGENTS.md rules: zero fluff, no emojis, strict technical peer-to-peer communication

## Current Parent
- Conversation ID: 82da5259-8d41-4d16-88bd-19ef84d571a3
- Updated: 2026-08-15T09:56:15Z

## Investigation State
- **Explored paths**:
  - `server/v2/db/schema/keys.ts`
  - `server/v2/db/schema/devices.ts`
  - `server/v2/db/schema/index.ts`
  - `server/v2/services/crypto/prekeyVaultService.ts`
  - `server/v2/routes/cryptoRoutes.ts`
  - `server/v2/routes/userRoutes.ts`
  - `server/v2/routes/ticketRoutes.ts`
  - `server/v2/app.ts`
  - `server/index.ts`
  - `tests/e2e/e2ee-protocol-tiers.test.ts`
  - `tests/e2e/e2ee-signal.test.ts`
  - `tests/e2e/helpers/testEnv.ts`
- **Key findings**:
  - `user_prekeys` schema lacks `registrationId`, `deviceId`, `signedPrekeyId`, and typed `jsonb` one-time prekeys pool.
  - `prekeyVaultService.ts` contains a race condition where concurrent `fetchPrekeyBundle` calls can pop the identical OPK; needs transaction with `SELECT ... FOR UPDATE`.
  - `userRoutes.ts` has duplicate uncoordinated prekey routes that bypass atomic OPK consumption and should be aliased to `prekeyVaultService`.
  - Canonical routes are mounted under `/v2/crypto/prekeys` and `/api/v2/crypto/prekeys`.
- **Unexplored areas**: None. Investigation complete.

## Key Decisions Made
- Designed Drizzle schema for `user_prekeys` with composite unique index on `(userId, deviceId)`.
- Designed `publishPrekeyBundle` using atomic `onConflictDoUpdate`.
- Designed `fetchPrekeyBundle` using `db.transaction` and `.for('update')` row locking for race-free OPK consumption.
- Structured response DTOs strictly adhering to `SignalPrekeyBundleDTO` and `SignalPrekeyPublishDTO`.

## Artifact Index
- `/root/velum/.agents/explorer_m3_2/analysis.md` — Detailed backend analysis and design
- `/root/velum/.agents/explorer_m3_2/handoff.md` — 5-component handoff report
