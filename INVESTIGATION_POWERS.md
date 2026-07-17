# Velum Platform Design & Operations Manual (INVESTIGATION_POWERS)

This document serves as the comprehensive "biography" and architectural blueprint of the Velum platform. It outlines the core system design, data structures, key operational workflows, security constraints, and administrative capabilities of the system. It is designed to onboard new backend engineers, database administrators, and Security Operations (SecOps) personnel.

---

## 1. Core Purpose & Elevator Pitch

### What is Velum?
Velum is a highly secure, privacy-first, full-stack ecosystem designed to support decentralized, gated community workspaces ("Lounges") combined with an embedded peer-to-peer marketplace and a robust sovereign financial ledger. 

### Who are its users?
Velum serves high-trust groups, closed trade cartels, private security forums (SecOps), and gated merchant collectives who require absolute confidentiality, secure transaction execution, and cryptographically verifiable operational actions.

### What makes it different?
Unlike standard messaging or marketplace platforms, Velum operates with:
- **Zero-Trust Infrastructure**: All database payloads stored in SQLite are cryptographically sealed at rest using AES-256-GCM symmetric encryption.
- **Strict Ledger Authority**: Every financial event (wallet balance adjustments, escrow holdings, processing fees) is represented as an immutable journal entry.
- **Unified Identity Lifecycle**: High-performance, collision-free ULIDs (Universally Unique Lexicographically Sortable Identifiers) are used to sequence and correlate events across chat logs, transactions, and user sessions.

---

## 2. User Types & Roles

Velum classifies accounts into four distinct user layers, establishing a rigorous separation of privileges:

1. **End User**
   - **Permissions**: Can join authorized Lounges, spawn sublounges, create channels/nodes, send chat messages, list products, engage in escrow transactions, manage their user wallets, and request support tickets.
   - **Assignment**: Self-registered through public endpoints. Default role of any new account.

2. **Moderator (Lounge-Level / Sublounge-Level)**
   - **Permissions**: Confined strictly to the Lounges they own or manage. Can mute users, jail members, restrict channels, manage membership requests, and review sub-space interactions.
   - **Assignment**: Conferred by a Lounge Owner or promoted via Lounge RBAC Roles config tables (`lounge_roles`).

3. **Admin (Global Login Admin / CLI Admin)**
   - **Permissions**: Global platform-level access.
     - *Login Admins* can reply to global tickets, quarantine users via security alerts, reset profile avatars, soft-delete users, and oversee the platform marketplace.
     - *CLI Admins* hold absolute operational authority, bypassing interface locks to repair database states, hard-delete records, seed systems, manually adjust ledger entries, and clear zombie user sessions.
   - **Assignment**: Configured manually through `platform_admins` SQL seed lists or promoted exclusively via CLI tools.

4. **System (Autonomous)**
   - **Permissions**: Operates with automated engine privileges. Triggers heuristic alerts on suspicious sessions, logs multi-factor security incidents, audits compliance data, and automatically drops database transactions if state inconsistencies are detected.

---

## 3. Core Entities & Data Model

The platform state is represented across 56 database tables. Below are the primary entities:

### 3.1. User
- **Description**: The fundamental unit of identity on the platform.
- **Key Fields**: `user_id` (INT, Sequential PK), `username` (TEXT, Unique), `uid` (TEXT, standard public handle `VEL-UID-XXXXXX`), `password_hash` (TEXT), `recovery_key` (TEXT), `status` (TEXT: `active`, `quarantined`, `soft_deleted`).
- **Relationships**: Owns one `UserWallet` (1:1), possesses multiple `Sessions` (1:N), is linked to a `Profile` (1:1).
- **Lifecycle**: Self-created → Modified via profile edits → Soft-deleted (flagged, credentials revoked) or Hard-deleted (purged by CLI).

### 3.2. Lounge (and Sublounge)
- **Description**: Closed community structures. Sublounges are represented as hierarchically nested records inside the same `lounges` table.
- **Key Fields**: `lounge_id` (TEXT, PK, standard prefix `comm_`), `name` (TEXT), `owner_id` (INTEGER, references owner user), `parent_lounge_id` (TEXT, self-referential NULLable foreign key for nesting), `type` (TEXT: `official`, `user_created`), `is_private` (INTEGER, 0 or 1), `is_locked` (INTEGER, 0 or 1).
- **Relationships**: Links to `LoungeMember` tables, contains multiple nested polymorphic `Nodes` (channels).
- **Lifecycle**: Created by end-user or system → Modified via config → Destroyed by owner (cascades down all sublounges and node views).

### 3.3. Message
- **Description**: Real-time messaging payloads mapped to channels.
- **Key Fields**: `message_id` (TEXT, PK, standard prefix `msg_`), `roomId` (TEXT, references polymorphic nodes), `userId` (INTEGER, sender reference), `content` (TEXT), `created_at` (INTEGER), `is_system` (INTEGER, 0 or 1).
- **Relationships**: Belongs to a Node, authored by a User.
- **Lifecycle**: Written → Immutable (edits append history, deletion purges payload but retains structural reference, CLI clean purges all room messages).

### 3.4. Asset & SKU Variant
- **Description**: Products listed inside the embedded marketplace.
- **Key Fields**: `listing_id` (TEXT, PK, standard prefix `list_`), `sku_id` (TEXT, standard prefix `sku_`), `title` (TEXT), `price` (REAL), `inventory_count` (INTEGER), `discount_price` (REAL, NULLable).
- **Relationships**: Created by `seller_id` (User), contains `market_asset_media` child records, referenced by `escrow_transactions`.
- **Lifecycle**: Created as active → Locked/suspended during verification checks → Soft-deleted/exhausted on final sell.

### 3.5. Token & Wallet Ledger Entry
- **Description**: Velum's sovereign ledger metrics representing virtual credits (Velum Tokens).
- **Key Fields**: `entry_id` (TEXT, PK, standard prefix `led_`), `user_id` (INTEGER), `amount_cents` (INTEGER), `entry_type` (TEXT: `RECHARGE`, `WITHDRAWAL`, `ESCROW_HOLD`, `ESCROW_RELEASE`, `ESCROW_REFUND`, `PLATFORM_FEE`, `AUTOMATED_ADJUSTMENT`), `currency_code` (TEXT).
- **Relationships**: Updates `UserWallet` (calculated balance check), referenced by transaction audits.
- **Lifecycle**: Append-only. Ledger entries are strictly **immutable**. To revert a ledger error, a new offsetting ledger entry must be appended.

### 3.6. Support Ticket
- **Description**: Customer support and identity recovery cases.
- **Key Fields**: `ticket_id` (TEXT, PK, standard prefix `t_`), `user_id` (INTEGER), `provided_recovery_key` (TEXT), `issue_type` (TEXT), `status` (TEXT: `open`, `pending`, `resolved`, `closed`).
- **Relationships**: Authored by User, managed/replied to by Admin.
- **Lifecycle**: Opened → Assigned Admin replies → Resolved → Archive-purged by CLI.

### 3.7. Audit Log
- **Description**: Security and operational tracking.
- **Key Fields**: `log_id` (TEXT, PK, standard prefix `aud_` or `al_`), `action` (TEXT), `actor_id` (INTEGER), `target_id` (TEXT), `metadata` (TEXT/JSON), `created_at` (INTEGER).
- **Relationships**: Mapped globally to systems (`system_audit_logs`) or scoped locally (`lounge_audit_logs`).
- **Lifecycle**: Read-only, append-only.

---

## 4. Key Workflows

### 4.1. User Registration and Onboarding
1. User supplies a unique username and password.
2. The platform generates a sequential `user_id` and a randomized cryptographically independent `uid` (e.g., `VEL-UID-129481`).
3. An AES-256-GCM encrypted profile entry is instantiated with an automated seed recovery key.
4. An empty `UserWallet` with 0 cents balance is registered for the user.

### 4.2. Creating/Managing Lounges and Sublounges
1. A user requests the creation of a Lounge. The system generates a secure ULID with the `comm_` prefix.
2. The user is assigned the role of 'owner' in `lounge_members`.
3. To spawn sublounges, the owner requests creation under the same parent. The system verifies the user owns the parent space and sets `parent_lounge_id = parent.lounge_id`, building an automated, infinite nested tree structure.

### 4.3. Messaging and Moderation
1. Message routing is handled via real-time WebSockets.
2. For channel moderation, an administrator or room owner can execute a `clean-lounge` command. This purges the message database rows belonging to the specific room, forcing an immediate sync sweep across all active WebSocket sessions.

### 4.4. Asset/Token System & Ledger Processing
- **Velum Tokens**: Virtual monetary representation (1 Token = 1 USD Cent).
- **Acquiring (Recharge)**: User requests credit recharge, verified by external payment gateway events. Upon confirmation, a ledger entry with `RECHARGE` is appended, updating `UserWallet.balance_cents`.
- **Transfer**: Directly logs debit and credit records in ledger tables synchronously inside a database transaction block.
- **Escrow Hold**: Buying triggers `ESCROW_HOLD` debiting the buyer, locking tokens inside an `escrow_transactions` record.
- **Release/Refund**: Releasing logs credit to the seller (`ESCROW_RELEASE`); refunding reverts the credit back to the buyer (`ESCROW_REFUND`).
- **Withdrawal**: User files withdrawal request. Approved status appends `WITHDRAWAL` debit ledger, clearing the payout.

### 4.5. Moderation Actions (Mutes, Bans, Jails)
- **Mutes**: Appends the user and lounge combination to `user_mutes`. WebSocket and Express middleware drop writing access to chat rooms.
- **Bans**: Inserts the banned ID into `admin_sanctions`. The authentication endpoint drops active sessions and prevents subsequent log-in procedures.
- **Jails/Overrides**: Special containment states that redirect user sockets exclusively to a quarantined sandboxed channel until explicitly overridden.

### 4.6. Fraud/Scam Detection and Response
1. Triggered via heuristic analysis of transactions (e.g., rapid currency conversion or unusual transfer patterns).
2. Suspicious activities are logged in `suspicious_events`.
3. High-risk profiles are automatically locked, active escrow funds are frozen, and the user's account is placed in a quarantined state.

### 4.7. Legitimate User Offboarding
1. A user files an account deletion request, logged in `account_deletion_requests`.
2. A strict **14-day grace period** is instituted.
3. Once the grace period expires, a background cron task triggers a permanent, irreversible purge (scrubbing personal profile metadata, and deleting direct message logs, while keeping immutable wallet transactions for financial audit correctness).

### 4.8. Support Ticket Handling
1. Users post recovery requests. The platform generates an open `SupportTicket`.
2. Admin reviews the case. Actions are restricted: `approve` (resolves ticket, unlocks recovery keys), `reject` (closes case), `demote` (suspends priority level).

### 4.9. Database Maintenance
- **Backups**: Admin issues a `backup` request. The CLI decrypts the binary state payload, packages it into a portable structural JSON snapshot, and exports it to a secondary `.corrupt` or `.bak` storage location.
- **Integrity Checks**: Rebuilds the relationship indices, checks for corrupted schemas, sweeps orphaned child keys, and executes `VACUUM` queries to compress memory footprints.

---

## 5. Data Retention & Privacy Policies

- **Cryptographic Sealing**: All user metadata, text channels, and direct messages are encrypted.
- **Retention Lifecycles**:
  - Active messages: Retained until pruned or cleaned.
  - Inactive sessions: Cleared automatically after 14 days of silent activity.
  - Ledger Logs: Retained permanently to comply with financial reporting standards.
- **Compliance Rules (GDPR Right to Be Forgotten)**: Once an account's deactivation grace period ends, all identity markers are scrubbed. The user is converted to a generic system reference (e.g., `user_id: [ID]` persists in ledger ledger logs to balance books, but all username, profile media, and IP mappings are permanently dropped).

---

## 6. Platform Constraints & Invariants

Velum enforces several non-negotiable rules to maintain structural integrity:

- **Owner-Exclusive Destruction**: A user is strictly forbidden from editing or deleting a Lounge or channel unless they are mapped as the absolute owner in the database or hold CLI Administrator credentials.
- **Audit Trace on Seizure**: Any action that modifies user wallets, suspends assets, or alters escrow states must emit a matching security log (`platform_financial_audit_logs`) linking the Admin ID.
- **Ledger Invariance**: A user's computed wallet balance must always equal the aggregate sum of all valid `wallet_ledger_entries` logged for their `user_id`. Direct database edits updating a wallet balance without a matching ledger entry trigger a runtime critical failure, freezing the account.
- **Token Precision Limits**: All calculations are completed in **integers (cents)** to eliminate floating-point rounding errors.

---

## 7. CLI Scope & Intended Audience

The Velum Command Line Interface (`cli.js`) is designed exclusively for:
- **Platform Administrators & SecOps Engineers**: Managing infrastructure, verifying database sanity, and performing raw-record repairs.
- **Customer Support Staff**: Responding to offline ticket recovery requests and manually managing user bans and sanctions.

The CLI serves as the primary sovereign toolset, capable of running in headless, air-gapped environments without requiring the frontend web interface to be active.

---

## 8. Current Command Inventory

Below is a map of the existing CLI operations:

### 8.1. Administrative Commands
- `list-pending` / `pending`: Lists all support tickets with `open` or `pending` status.
- `approve-support <ticket_id>`: Resolves a support case and recovers credentials.
- `reject-support <ticket_id>`: Closes a support case.
- `demote-support <ticket_id>`: Lowers ticket priority.
- `delete-ticket <ticket_id>`: Purges a support ticket from state.

### 8.2. User Containment Commands
- `ban-user <user_id> [reason]`: Applies global ban and terminates active sessions.
- `unban-user <user_id>`: Lifts global restrictions.
- `mute-user <user_id> <lounge_id>`: Mutes user inside a specific lounge.
- `unmute-user <user_id> <lounge_id>`: Restores lounge message permissions.
- `reset-avatar <user_id>`: Reverts profile avatars violating safety guidelines.
- `override-user <user_id> <containment_state>`: Forces special sandboxing on suspicious user paths.

### 8.3. Database & System Commands
- `integrity`: Audits foreign key hierarchies, orphans, and state schemas.
- `seed`: Seeds standard financial currencies, exchange rates, and administrative channels.
- `prune-db`: Sweeps expired sessions and soft-deleted identities.
- `status`: Outputs operational status (running port, SQLite path, active sessions, tables size).
- `logs`: Dumps real-time terminal audit trails.
- `db-vacuum`: Fires SQLite vacuuming to reclaim disk space.
- `sessions-clear`: Terminates all active global sessions, forcing client re-authentication.
- `list-lounges`: Outputs active community workspaces.
- `risk-report`: Scans transaction logs, reporting anomalies or fraud scores.
- `send-system-wire <user_id> <amount>`: Executes administrative ledger transactions (mints tokens).

---

## 9. Pain Points & Desired Improvements

While Velum's core architecture is robust, several engineering gaps exist for future iterations:
- **Interactive Shell Mode**: The CLI currently runs as a series of one-off bash executions, requiring re-authentication and decrypted load-save cycles for every separate command. Transitioning to an interactive, continuous session shell is highly desirable.
- **File-System Style Navigation**: Creating visual context transitions (e.g., `cd users/`, `ls`) within the CLI to let administrators inspect nodes polymorphic layouts naturally.
- **Reconstructive User Restores**: The soft-deleted user flow works well, but reversing a purge requires automated CLI schema rebuilding tools rather than manual DB re-injection.
- **Seed Overwriting Vulnerability**: Currently, executing `seed` purges existing user records. Seed tasks must be adjusted to run non-destructively, preserving operational accounts.

---

## 10. Investigation Powers Index

This section provides the complete architectural specifications and system workflows for Velum's diagnostic and security monitoring suites.

### Power 1: Session Hijack Detection Pipeline
- **Footprint Identification**: Continuously monitors active sessions for rapid user-agent mutations, unexpected cookie reuse patterns, or session validation requests originating from widely divergent IP blocks within short windows.
- **Client Device Fingerprinting**: To mitigate easily-spoofed IP and user-agent configurations, Velum implements client-side environment fingerprinting. This tracks deep client signatures (such as canvas layout dimensions, WebGL hardware rendering capabilities, audio context performance quirks, and exact JS engine features) to construct a high-entropy device token unique to each user's workstation.
- **Silent Quarantine State**: To prevent sophisticated attackers from detecting interception, the platform executes a *silent quarantine* rather than an immediate logout. The session remains authenticated, but the reverse proxy layer artificially delays database reads and response times to simulate severe server congestion ("artificial latency throttle").
- **Escalation & Ticket Generation**: The detection pipeline instantiates an automated Support Case flagged with `critical` severity. This is instantly rendered on the Login Admin and Support Admin control panels.
- **Strict Key Recovery Containment**: To eliminate the risk of social engineering or admin-intercept scams, Web-based Login Admins and Support Admins are strictly forbidden from directly displaying or sharing active account recovery/decryption keys to the end-user, regardless of UI credibility passes. Recovery keys may only be authorized, generated, and verified through off-line CLI administration following deep forensically-sound diagnostics.
- **SecOps Alerting & Terminal Integration**: A webhook dispatches an urgent alert to the private `#secops` room. To ensure offline CLI administrators are aware of critical active cases, a dedicated terminal utility allows auditing unread SecOps lounge pings directly in bash.

### Power 2: Ledger Transaction Replay Diagnostics
- **Threat Vector**: Protects the core ledger from manual SQLite record modifications or transaction replication/replay attempts designed to inflate wallet balances.
- **Hybrid Verification Engine**:
  1. **Mathematical Audit**: Sequentially accumulates ledger row values (`amount_cents`) from the ledger table and validates that the calculated aggregate mathematically matches the current cached state in the `user_wallets` table.
  2. **Lightweight Cryptographic Checksum**: To avoid heavy cryptographic bottlenecks during standard API transactions, Velum utilizes a rolling SHA-256 or HMAC signature chain across historic blocks. Every new ledger entry incorporates the hash of the preceding entry. Modifying any historical record instantly invalidates the signature chain, locking the ledger.
- **Operational Execution**: Operates as both an **Automated Daemon** (executing daily cron validation sweeps) and a **Manual Command** accessible in the CLI for real-time validation.

### Power 3: IP Correlation and Geo-fencing Audit
- **Multi-Account Correlation**: Scans the active `ip_addresses` registry to identify groups of seemingly unrelated account IDs sharing identical subnets, device configurations, or browser environments.
- **Geographic Velocity Sanity**: Calculates the distance and speed required to travel between consecutive session request IPs. Hits that violate the physical velocity ceiling are flagged.
- **Subnet Filtering**: Integrates standard IP blocklists and subnet routing lists directly into the WebSocket authentication handshake, denying or throttling socket requests on matching nodes.

### Power 4: Polymorphic Node Data-leak Scans
- **Hierarchy Security Verification**: Scans the recursive, polymorphically nested channels and sublounges mapped within the fractal tree structure (`nodes` and `node_closure` tables).
- **Leak Vectors**: Flags channels where parent RBAC permission inheritance is broken, or where configurations incorrectly expose gated/private channels to the public node index.
- **Trigger Profiles**:
  1. **Automated Verification**: Fires instantly upon modifying parent-child mappings or updating role permissions on nested categories.
  2. **Manual Admin Scans**: Can be invoked on-demand to generate audit reports on structural access paths.

### Power 5: Bi-directional Friendship Map Reconstitution
- **Orphan Reconciliation**: Solves relational discrepancies where a friendship row exists for `User A -> Friend B` but the reciprocal `Friend B -> User A` entry is missing, corrupted, or clobbered.
- **Sovereign Endpoint Execution**: Runs strictly through an isolated serving entrypoint (`friendship-reconstruct`) to limit resource contention and database locking.
- **State Repair**: Rebuilds correct bi-directional friendship indices securely, cleaning up orphaned requests and restoring social ledger continuity.
