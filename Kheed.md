# Kheed.md: Comprehensive Codebase Audit Report

## 1. Executive Summary
The codebase is in a pre-production state, characterized by extreme architectural coupling (monolithic `server/db.ts`) and functional incompleteness in core domains (Banking, Marketplace, Escrow). The system requires a phased refactoring to achieve production stability.

---

## 2. Structural & Architectural Findings

### 2.1 Monolithic Coupling (The "God Object")
*   **Issues:** `server/db.ts` conflates database persistence, authentication, CLI routing, and business logic for all domains.
*   **Action:** Immediate priority is domain decomposition.

### 2.2 CLI Divergence
*   **Issues:** The `executeCliCommand` handler in `server/db.ts` facade for decorative commands (e.g., `db-export`, `db-restore`) which have no implementation.
*   **Impact:** Misleading admin interface.
*   **Action:** Remove decorative commands or implement them in a dedicated `server/cli-router.ts`.

### 2.3 Persistence Fragility
*   **Issues:** Global `decryptionErrorDetected` flag aborts all writes on a single failure. `saveDb` debouncing mechanism uses `setTimeout` and risks data loss on process termination.
*   **Impact:** Potential for catastrophic data loss if decryption transiently fails.
*   **Action:** Implement granular error handling per-row, not globally. Transition to a more robust persistence saving mechanism.

---

## 3. Domain Audit

### 3.1 Authentication & Identity (Status: Incomplete)
*   **Entanglement:** `server/controllers/auth.ts` is overly entangled with persistence (`db.js`) and audit logging.
*   **Infrastructure Logic Leakage:** Controllers are responsible for IP/Geo correlation, audit log creation, and suspicious event tracking—tasks that should be abstracted into an `AuditService` or `SecurityService`.
*   **Mocked Production Data:** `performUserRegistration` injects hardcoded, fake financial credentials into the database.

### 3.2 Chat & Lounges (Status: Fragmented & Performance-Risk)
*   **Logic in UI:** `src/components/ChatArea.tsx` performs complex message filtering and presence synchronization logic that belongs in backend services/state managers.
*   **Performance Bottleneck:** Message filtering and parsing are done during rendering (`messages.filter`). As chat logs grow, this component will become unusable.
*   **Broken Persistence/WebSocket Integration:** Presence is handled via window events instead of WebSocket services, leading to eventual consistency issues.

### 3.3 Financial & Marketplace (Status: Broken/Prototype)
*   **Transactional Inconsistency:** Settlement and penalty logic in `resolveSupportChatDispute` executes wallet balance updates directly without transactional wrappers.
*   **Decorative Security:** `testSandboxEscrow` returns success without actual sandbox execution.

---

## 4. Unhooked/Broken Logic
*   **Audit Proxy:** `server/db.ts` exports `setupAuditLogProxy()`—function body is empty.
*   **Diagnostic Views:** `AdminVerificationView.tsx` lacks backend API implementation.
*   **WebSocket Signaling:** `sys-kill` modifies memory state but fails to force-disconnect WebSockets.
*   **Financial Pipeline Stubs:** Cloud backup functions in `server/db/index.ts` exist but remain unhooked.

---

## 5. Phased Remediation Plan (Active Guide)

### Phase 1: Persistence Layer Isolation (High Priority)
*   **Goal:** Decouple database orchestration from business logic.
*   **Steps:**
    1.  Move `loadDb`, `saveDb`, `executeSaveDb` to `server/db/persistence.ts`.
    2.  Migrate all table-specific row-processing logic (`loadPayloadTable`) to `server/db/repository.ts`.
    3.  `server/db.ts` becomes a pure internal hub that imports from these two files.

### Phase 2: Domain Business Logic Extraction (High Priority)
*   **Goal:** Extract business logic into isolated services.
*   **Steps:**
    1.  Extract User/Auth logic to `server/services/user.ts`.
    2.  Extract Lounge/Chat logic to `server/services/lounge.ts`.
    3.  Extract Market/Banking logic to `server/services/market.ts` and `server/services/banking.ts`.

### Phase 3: CLI and Administrative Infrastructure (Medium Priority)
*   **Goal:** Purge decorative commands and implement robust administrative routing.
*   **Steps:**
    1.  Extract CLI command routing from `db.ts` to `server/services/admin.ts`.
    2.  Implement or formally deprecate decorative/unhooked commands.

### Phase 4: WebSocket and Synchronization (Medium Priority)
*   **Goal:** Unify WebSocket implementation and fix state divergence.
*   **Steps:**
    1.  Consolidate `server/websocket.js` and `server/services/websocket.ts`.
    2.  Integrate real-time state sync for presence and audit logs.

### Phase 5: Cleanup and Deprecation (Low Priority)
*   **Goal:** Eliminate dead code and finalize architecture.
*   **Steps:**
    1.  Delete orphaned migration scripts and legacy JSON-blob handling.
    2.  Remove unused UI components.
