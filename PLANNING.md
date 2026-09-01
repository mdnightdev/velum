# Bank & Audits Implementation Plan

## Overview
Refactor `/bank` and `/audits` to eliminate manual balance tampering and synthetic metrics, replacing them with atomic multi-user grant disbursements, standard banking transaction statements, and automated ledger reconciliation.

---

## Architecture & Design Specifications

### 1. `/bank` Namespace Modifications
* **Delete `wire` command**: Platform operators cannot transfer funds between users.
* **Delete `adjust` (and `bankad`) command**: Manual balance overwrites removed in favor of automated ledger repair.
* **Delete synthetic telemetry in `/bank audit`**: Remove liquidity/delta pseudo-metrics.
* **Add `/bank grant` (Atomic Batch Funding)**:
  * **Syntax**: `/bank grant <user1:amount> <user2:amount> ... [reason]`
  * **Atomicity**: Wrapped in a PostgreSQL `db.transaction()` block. All recipient wallets are locked and updated, with corresponding `DEPOSIT` transaction records generated. If any single user resolution or deposit fails, the entire transaction rolls back cleanly.

### 2. Standard Transaction Statement (`/bank tx`)
* Renders a real banking statement table for user wallets:
  * Columns: `Date/Time` · `Transaction ID / Ref` · `Type` · `Amount` · `User / Wallet` · `Description`

### 3. Automated Ledger Verification & Auto-Repair (`/audits`)
* **`/audits ledger`**:
  * Scans user wallets and computes `sum(transactions.amount)` vs `wallets.balance`.
  * Flags discrepancies in red with the calculated variance.
* **`/audits cat <wallet_id | txn_ref | username>`**:
  * Dumps the complete chronological transaction statement for the target account with running balance calculations.
* **`/audits repair [wallet_id | username | all]`**:
  * Recomputes exact atomic balance from immutable ledger rows.
  * Updates wallet records to match ledger truth.
  * Records audit log entry with the repaired delta.

---

## Implementation Phases

### Phase 1: `/bank` Cleanup & Multi-User Atomic Grant
1. Remove `wire`, `adjust`, `bankad`, and pseudo-telemetry from `cli/v2/handlers/bank.ts`.
2. Implement `/bank grant <user1:amount> <user2:amount> ... [reason]` with atomic PostgreSQL transaction support.
3. Update `/bank tx` to display clean bank statement formatting.
4. Update `cli/v2/registry.ts` to reflect the updated `/bank` command schema.

### Phase 2: `/audits` Ledger Inspection & Auto-Repair
1. Implement `/audits ledger` in `cli/v2/handlers/audits.ts` (mismatch detection with colored diffs).
2. Implement `/audits cat <id>` for full transaction chronology and statement audit.
3. Implement `/audits repair [target|all]` for atomic ledger balance reconciliation.
4. Update `cli/v2/registry.ts` to include ledger, cat, and repair under `/audits`.

### Phase 3: Verification & Test Suite Execution
1. Run multi-recipient batch grant tests with concurrency and rollback verifications.
2. Simulate deliberate wallet balance corruption and verify `/audits repair` restores exact ledger balance.
3. Run test suite (`tests/unit/cliSecurity.test.ts`) to ensure 100% pass rate.
4. Remove `PLANNING.md` upon final reconciliation.
