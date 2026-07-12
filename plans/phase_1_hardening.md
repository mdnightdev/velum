# Implementation Plan - Phase 1: Hardening

This plan addresses the "Phase 1: Hardening" recommendations from the systems audit. It focuses on optimizing database access patterns and standardizing unique identifier generation.

## 1. Refactor Database Access (Singleton Pattern)

Currently, `loadDb()` is called at the start of almost every controller and middleware. While it has a "loaded" check, the frequent calls are redundant and create technical debt. We will move to a pattern where the database is loaded once at startup.

### Changes:
- **`server/db/index.ts`**: Auto-initialize the DB on load or startup so that it is guaranteed to be loaded without manual triggers in every route.
- **`server/middlewares/auth.ts`**: Remove `loadDb()` call from `authenticateUser`.
- **`server/controllers/marketplace.ts`**: Remove `loadDb()` calls from all endpoints.
- **`server/controllers/bank.ts`**: Remove `loadDb()` calls.
- **`server/controllers/payments.ts`**: Remove `loadDb()` calls.

## 2. Unify ID Generation (ULID Standard)

Ad-hoc ID generation using `Date.now()` and `Math.random()` is prone to collisions in high-concurrency environments and creates inconsistent ID formats. We will migrate to ULID (Universally Unique Lexicographically Sortable Identifier) for all database entities.

### Changes:
- **`server/controllers/marketplace.ts`**:
    - Import `generateUlid` from `../utils/ulid.js`.
    - Replace all `Date.now()` and random string combinations with `generateUlid()`.
    - Affected IDs: `listing_id`, `sku_id`, `media_id`, `check_id`, `review_id`, `coupon_id`, `discussion_id`, `transaction_id`, `entry_id`, `refund_id`, `chat_id`, `message_id`.

## 3. Verification Plan

### Automated Tests
- Run existing tests to ensure no regressions:
    - `npm test server/tests/loungeRepository.test.ts`
    - `npm test server/tests/marketRepository.test.ts`
- Create a new test to verify ULID format for new entities if needed.

### Manual Verification
- Create a new listing and verify its `listing_id` in the console/database.
- Perform an escrow transaction and verify `transaction_id` and `entry_id`.
