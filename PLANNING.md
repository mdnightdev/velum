# Plan: Dynamic Admin Seeder Credential Sync & Permanent IDs

## 1. Dynamic Admin Seeder Invariants (`server/v2/services/adminSeeder.ts`)
- **Strict Permanent ID Binding**:
  - `adminUser.id = 1` is permanently the `CLI_ADMIN` (`midnight`).
  - `adminUser.id = 2` is permanently the `LOGIN_ADMIN` (`lexie`).
  - `adminUser.id = 999` is permanently the `ADMIN` bot (`velum`).
- **Dynamic Credential Rotation Sync on Boot**:
  - Query admin by permanent ID (`users.id = adminUser.id`) or role.
  - If admin exists:
    - Check if `.env` password (`MIDNIGHT_PASSWORD` / `LEXIE_PASSWORD`) has been rotated.
    - If the stored password hash does not validate against the current `.env` password, hash the new `.env` password with Argon2id and update the existing admin record in-place (`WHERE id = existing.id`).
    - Guarantee that no duplicate admin row is ever inserted.
  - If admin does not exist (DB empty or wiped):
    - Insert admin with permanent ID (1 or 2).

## 2. Permanent Official Lounge IDs (1–11) Migration (`server/v2/services/loungeSeeder.ts`)
- Remap official lounges to permanent IDs 1–11 in live PostgreSQL database and update foreign keys (`messages`, `lounge_members`, `user_read_cursors`, `lounge_mute_settings`).
- Set `lounges_id_seq` to 1000+ so DM channels never collide with permanent IDs 1–11.

---

## Phases
- **Phase 1:** Update `server/v2/services/adminSeeder.ts` to sync rotated credentials dynamically in-place without duplicate row creation.
- **Phase 2:** Execute live SQL migration to reassign official lounges to IDs 1–11 and re-link FKs.
- **Phase 3:** Update `server/v2/services/loungeSeeder.ts` to enforce permanent IDs 1–11.
- **Phase 4:** Verify with test suite.
