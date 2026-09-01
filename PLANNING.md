# Codebase Duplication Resolution Plan

**Source:** [`review/DUPLICATED_CODE_AUDIT.md`](file:///root/velum/review/DUPLICATED_CODE_AUDIT.md)  
**Target:** Eliminate boilerplate, enforce DRY principles, and consolidate shared logic.

---

## Phase 1: Authentication Middleware Consolidation (DUP-001)
**Priority:** High  
**Goal:** Consolidate 16 duplicate `createAuthMiddleware` implementations into a centralized middleware module.

### Tasks:
1. **Centralize Auth Middleware (`server/v2/middleware/auth.ts`):**
   * Export pre-configured `authMiddleware` verifying session token hash via `userRepository.findSessionByTokenHash`.
   * Export `adminAuthMiddleware` enforcing admin roles (`CLI_ADMIN`, `LOGIN_ADMIN`, `SUPPORT_ADMIN`).
   * Export `requireRole(...roles)` helper for granular permission gating.
2. **Refactor 16 Route Files:**
   * Import centralized `authMiddleware` / `adminAuthMiddleware` in:
     * `server/v2/routes/authRoutes.ts`
     * `server/v2/routes/userRoutes.ts`
     * `server/v2/routes/adminRoutes.ts`
     * `server/v2/routes/bankRoutes.ts`
     * `server/v2/routes/marketRoutes.ts`
     * `server/v2/routes/friendRoutes.ts`
     * `server/v2/routes/messageRoutes.ts`
     * `server/v2/routes/communityRoutes.ts`
     * `server/v2/routes/channelRoutes.ts`
     * `server/v2/routes/mediaRoutes.ts`
     * `server/v2/routes/settingsRoutes.ts`
     * `server/v2/routes/notificationRoutes.ts`
     * `server/v2/routes/supportRoutes.ts`
     * `server/v2/routes/escrowRoutes.ts`
     * `server/v2/routes/ticketRoutes.ts`
     * `server/v2/routes/reportRoutes.ts`
   * Strip redundant local `createAuthMiddleware(...)` boilerplates (~420 lines removed).

---

## Phase 2: Database Cleanup & Self-Healing Consolidation (DUP-003)
**Priority:** Medium  
**Goal:** Unify orphan database record cleanup logic between CLI and server self-healing.

### Tasks:
1. **Create `server/v2/utils/databaseCleanup.ts`:**
   * Encapsulate SQL queries for orphaned messages, channels, memberships, and marketplace escrows.
   * Provide structured cleanup report return types (`{ cleanedMessages: number, cleanedMemberships: number }`).
2. **Refactor Callers:**
   * Connect CLI `/db` maintenance and server self-healing daemon to `databaseCleanup`.

---

## Phase 3: Lounge Data Access Consolidation (DUP-002)
**Priority:** Medium  
**Goal:** Abstract raw `await db.select().from(lounges)` into a dedicated repository.

### Tasks:
1. **Create/Extend `server/v2/repositories/loungeRepository.ts`:**
   * Implement `findAll()`, `findById()`, `findActive()`, `findByCommunityId()`, `findByCreatorId()`.
2. **Refactor `server/v2/services/loungeService.ts`:**
   * Replace 38+ repetitive Drizzle query blocks with repository calls.

---

## Phase 4: Shared Types & Validation Alignment (DUP-004 & DUP-005)
**Priority:** Low  
**Goal:** Ensure single source of truth for user models and password validation rules.

### Tasks:
1. **Unify User Types:**
   * Centralize `User` interface in `src/types/user.ts` and `server/v2/types/user.ts`.
2. **Unify Password Rules:**
   * Ensure frontend validation matching backend Zod auth schema constraints.

---

## Verification & Testing
* Run `npx tsx tests/unit/cliSecurity.test.ts`
* Run backend route smoke tests across authenticated endpoints.
* Verify TypeScript compilation passes without errors.
