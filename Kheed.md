# Kheed.md: Comprehensive Codebase Audit Report

## 1. Executive Summary
The codebase is currently in a pre-production state, characterized by extreme architectural coupling (the "God Object" monolith in `server/db.ts`) and substantial functional incompleteness in core business domains (Banking, Marketplace, Escrow). The system requires a phased refactoring to achieve production stability.

---

## 2. Structural & Architectural Findings

### 2.1 Monolithic Coupling (The "God Object")
*   **Issues:** `server/db.ts` conflates database persistence, authentication, CLI routing, and business logic for multiple domains (User, Lounge, Marketplace).
*   **Impact:** Cascading failures where changes in one domain (e.g., Lounge moderation) risk breaking unrelated modules (e.g., Auth nonce generation).
*   **Action:** Requires complete domain decomposition as planned.

### 2.2 CLI Divergence
*   **Issues:** The `executeCliCommand` handler in `server/db.ts` acts as a facade. Several commands defined in help text (e.g., `db-export`, `db-restore`) have no underlying implementation, returning decorative success messages.
*   **Impact:** Misleading administrative interface; potential for operational error when expecting command execution that does not occur.
*   **Action:** Remove decorative commands or implement them in a dedicated `server/cli-router.ts`.

### 2.3 Persistence Fragility
*   **Issues:** Global `decryptionErrorDetected` flag aborts all writes on a single failure. `saveDb` debouncing mechanism uses `setTimeout` and risks data loss on process termination.
*   **Impact:** Potential for catastrophic data loss if decryption transiently fails.
*   **Action:** Implement granular error handling per-row, not globally. Transition to a more robust persistence saving mechanism (e.g., write-ahead logging or ACID-compliant database operations).

---

## 3. Domain Logic Status & Completeness

| Domain | Status | Observations |
| :--- | :--- | :--- |
| **User/Auth** | Stable | Functional, but tightly coupled to `db.ts`. |
| **Banking** | Incomplete | Repository methods are stubs; ledger verification is manual and fragile. |
| **Marketplace** | Incomplete | Transactions are held in `escrow_transactions` but lacks settlement state machine. |
| **Presence/Sync** | Unhooked | Presence state is in-memory only, no DB persistence; cloud sync is disabled/stubs. |
| **WebSocket** | Fragmented | Dual TS/JS files create conflicting connection handling. |

---

## 4. Unhooked/Broken Logic
*   **Audit Proxy:** `server/db.ts` exports `setupAuditLogProxy()` but the function body is empty. Audit logging is non-functional.
*   **Diagnostic Views:** `AdminVerificationView.tsx` and `AdminDiagnosticsView.tsx` (frontend) lack backend API implementation for metrics consumption.
*   **WebSocket Signaling:** Commands like `sys-kill` modify server-side memory state but do not force-disconnect client WebSockets, allowing sessions to persist in the UI.

---

## 5. Proposed Remediation Roadmap

1.  **Phase 1: Stabilization.** Establish a clean build pipeline. Move all configuration/types to separate modules.
2.  **Phase 2: Domain Extraction.** Extract business logic from `server/db.ts` into isolated services.
3.  **Phase 3: Persistence Layer Optimization.** Replace the JSON blob persistence with granular, transactional SQL operations.
4.  **Phase 4: Functional Implementation.** Implement the stubs for Banking/Marketplace/Escrow.
5.  **Phase 5: WebSocket/UI Sync.** Fix the state divergence between client/server.
