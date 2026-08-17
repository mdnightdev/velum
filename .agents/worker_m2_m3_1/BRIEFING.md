# BRIEFING — 2026-08-15T09:21:02Z

## Mission
Implement Milestone 2 and Milestone 3 for Velum Signal Protocol integration (IndexedDB CryptoDbStore, SignalKeyUtils, server PreKey vault & routes, and comprehensive tests).

## 🔒 My Identity
- Archetype: worker
- Roles: [implementer, qa, specialist]
- Working directory: /root/velum/.agents/worker_m2_m3_1
- Original parent: d73b7bb4-d784-4a44-b237-6abdaf141cd7
- Milestone: M2 & M3

## 🔒 Key Constraints
- Pure production implementation, no stubs/dummies/placeholders.
- Respect AGENTS.md, PROJECT.md, and SCOPE.md.
- Ensure all tests pass with 0 exit code.

## Current Parent
- Conversation ID: d73b7bb4-d784-4a44-b237-6abdaf141cd7
- Updated: 2026-08-15T09:21:02Z

## Task Summary
- **What to build**:
  - `src/services/cryptoDbStore.ts`: libsignal-client IndexedDB store backing IdentityKeyStore, PreKeyStore, SignedPreKeyStore, SessionStore, SenderKeyStore, plus purgeCryptoVault.
  - `src/services/signalKeyUtils.ts`: Key pair generation, bundle serialization/deserialization helpers, safety number calculation.
  - `server/v2/db/schema/keys.ts`: Drizzle schema for user_prekeys.
  - `server/v2/services/crypto/prekeyVaultService.ts`: Prekey bundle storage and atomic one-time prekey consumption.
  - `server/v2/routes/cryptoRoutes.ts`: Express routes for prekeys and safety numbers.
  - Tests for all of the above.
- **Success criteria**: All tests pass, typechecks pass, zero regressions, full end-to-end compatibility.

## Key Decisions Made
- [TBD after reading references]

## Artifact Index
- `/root/velum/.agents/worker_m2_m3_1/DISPATCH.md` — Assignment
- `/root/velum/.agents/worker_m2_m3_1/progress.md` — Progress tracker
- `/root/velum/.agents/worker_m2_m3_1/handoff.md` — Final handoff

## Change Tracker
- **Files modified**: [TBD]
- **Build status**: [TBD]
- **Pending issues**: None

## Quality Status
- **Build/test result**: [TBD]
- **Lint status**: [TBD]
- **Tests added/modified**: [TBD]

## Loaded Skills
- None yet.
