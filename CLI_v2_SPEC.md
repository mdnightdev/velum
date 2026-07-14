# Velum CLI v2 — Design & Specification

**Status:** Approved (Final)  
**Audience:** Platform Engineers, SecOps, Backend Developers  
**Reference File:** `/INVESTIGATION_POWERS.md`  

---

## 1. Introduction

This document defines the second-generation Command Line Interface for the Velum platform. It replaces the existing flat command structure with a secure, discoverable, namespaced shell that is purpose-built for administrative and investigative operations in headless or air-gapped environments.

Key design goals:
* **Safety-First**: Every destructive action is tiered, previewable, and confirmed.
* **Discoverable**: File-system-style navigation with contextual help.
* **Operationally Robust**: Scoped restore points for content operations, immutable ledger integrity, and full audit trail integration.
* **Consistent**: Uniform command patterns, mandatory reasons, and dry-run availability.

---

## 2. Shell Interaction Model

The CLI runs as an interactive, persistent session, eliminating re-authentication between commands. It emulates a standard terminal with a hierarchical namespace structure.

### 2.1 Navigation & Global Commands
* `pwd` — print current namespace path (e.g., `/users`)  
* `ls` — list sub-namespaces or available commands in the current context  
* `cd <namespace>` — change directory into a namespace; `cd ..` goes up one level; `cd /` returns to root  
* `cat` — when available, show details of an entity within the current namespace (e.g., `cat VEL-UID-1234` in `/users`)  
* `exit` / `quit` — end the session  

### 2.2 Contextual Commands
Once inside a namespace (e.g., `/users`), commands are typed as single verbs without the path prefix:
```
velum-cli /users> ban VEL-UID-999 --reason "spam"
```

Absolute paths may be used from any location:
```
velum-cli /lounges> /users/ban VEL-UID-999 --reason "spam"
```

### 2.3 Help & Discovery
Every command supports `-h` and `--help`. If a command is ambiguous or invalid in the current context, the shell provides suggestions:
```
velum-cli /users> delete -h
'delete' is ambiguous. Did you mean:
  deactivate        Start 14-day deletion grace period
  confirm-purge     Final irreversible purge after asset release
  purge-fraudster   Instant fraud deletion with asset seizure
```
`ls` lists all available commands in the current namespace, along with a one-line summary.

---

## 3. Command Inventory

The root directory `/` contains the following namespaces:
* `users/`  
* `lounges/`  
* `support/`  
* `db/`  
* `sys/`  
* `audit/`  
* `fraud/`  

Each command is defined by:
* Risk Tier (see §4)  
* Dry-run support (`--dry-run` flag)  
* Confirmation requirement  
* Auto-restore-point (for scoped destructive content ops)  
* Reason requirement (on all destructive & user-affecting commands)  

### 3.1 `/users` — User Lifecycle & Moderation

| Command (in-context) | Full Path | Risk | Dry-run | Confirm | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `ls`, `list` | `users ls` | read | – | – | filterable with `--status` |
| `cat <uid>` | `users cat` | read | – | – | shows profile, never recovery key |
| `ban <uid> [--reason]` | `users ban` | write | yes | type yes | kills sessions, writes `admin_sanctions` |
| `unban <uid>` | `users unban` | write | yes | type yes | |
| `mute <uid> <lounge_id> [--reason]` | `users mute` | write | yes | type yes | |
| `unmute <uid> <lounge_id>` | `users unmute` | write | yes | type yes | |
| `jail <uid> [--reason]` | `users jail` | write | yes | type yes | quarantines to sandboxed channels |
| `unjail <uid>` | `users unjail` | write | yes | type yes | |
| `reset-avatar <uid> [--reason]` | `users reset-avatar` | write | yes | type yes | |
| `override <uid> <state> [--reason]` | `users override` | destructive | yes | type yes | special containment sandbox |
| `set-role <uid> <role> [--reason]` | `users set-role` | destructive | yes | type yes | diff of old/new permissions shown in dry-run |
| `deactivate <uid> [--reason]` | `users deactivate` | destructive | yes | type yes | starts 14-day grace, revokes credentials |
| `cancel-deactivation <uid>` | `users cancel-deactivation` | write | yes | type yes | reverses pending soft-delete |
| `release-assets <uid> [--reason]` | `users release-assets` | destructive | yes | type yes | triggers 2-day asset release & bank verification |
| `confirm-purge <uid> [--reason]` | `users confirm-purge` | requiresSecondConfirm | yes | type uid + reason | final irrevocable deletion after asset verification |
| `purge-fraudster <uid> [--reason]` | `users purge-fraudster` | requiresSecondConfirm | yes | type uid + reason | instant deletion, asset seizure, optional blacklist |
| `blacklist <id> [--type] [--reason]` | `users blacklist` | destructive | yes | type yes | adds to IP/device/email blacklist |
| `unblacklist <id>` | `users unblacklist` | write | yes | type yes | |
| `pending-deletions` | `users pending-deletions` | read | – | – | lists accounts in grace period with countdown |

### 3.2 `/lounges` — Lounge & Sublounge Management

| Command (in-context) | Full Path | Risk | Dry-run | Confirm | Auto Restore Pt | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `ls`, `list` | `lounges ls` | read | – | – | | |
| `cat <lounge_id>` | `lounges cat` | read | – | – | | |
| `chown <lounge_id> <uid> [--reason]` | `lounges chown` | destructive | yes | type yes | | transfers ownership |
| `clean <lounge_id> [--scope] [--before] [--reason]` | `lounges clean` | destructive | yes | type yes | yes (48h TTL) | purges messages, creates restore point |
| `restore-messages <restore_point_id>` | `lounges restore-messages` | requiresSecondConfirm | yes | type restore point ID | | restores from unexpired restore point |
| `delete <lounge_id> [--reason]` | `lounges delete` | requiresSecondConfirm | yes | type lounge_id + reason | | deletes lounge, sublounges, messages, assets |
| `lock <lounge_id> [--reason]` | `lounges lock` | write | yes | type yes | | read-only, no new messages |
| `unlock <lounge_id>` | `lounges unlock` | write | yes | type yes | | |

### 3.3 `/support` — Support Ticket Operations

| Command (in-context) | Full Path | Risk | Dry-run | Confirm | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `pending` | `support pending` | read | – | – | |
| `token <ticket_id>` | `support token` | read | – | – | masked recovery token |
| `approve <ticket_id> [--reason]` | `support approve` | write | yes | type yes | |
| `reject <ticket_id> [--reason]` | `support reject` | write | yes | type yes | |
| `demote <ticket_id> [--reason]` | `support demote` | write | yes | type yes | |
| `delete <ticket_id> [--reason]` | `support delete` | destructive | yes | type yes | |

### 3.4 `/db` — Database Maintenance

| Command (in-context) | Full Path | Risk | Dry-run | Confirm | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `integrity` | `db integrity` | read | – | – | |
| `orphans scan` | `db orphans scan` | read | – | – | |
| `orphans clean` | `db orphans clean` | destructive | yes | type yes | |
| `backup` | `db backup` | write | yes | type yes | exports structural/config only (no PII) |
| `export <table>` | `db export` | read | – | – | with masked PII unless explicit |
| `vacuum` | `db vacuum` | destructive | yes | type yes | |
| `restore <backup_file>` | `db restore` | requiresSecondConfirm | yes | type backup filename | |
| `seed` | `db seed` | requiresSecondConfirm | yes | type seed | non-destructive (`INSERT OR IGNORE`) |
| `prune` | `db prune` | destructive | yes | type yes | purges expired sessions, soft-deleted accounts past grace |
| `wipe` | `db wipe` | requiresSecondConfirm | yes | type WIPE | full DB reset |

### 3.5 `/sys` — System Operations

| Command (in-context) | Full Path | Risk | Dry-run | Confirm | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `status` | `sys status` | read | – | – | |
| `top` | `sys top` | read | – | – | |
| `risk` | `sys risk` | read | – | – | runs anomaly scan |
| `token` | `sys token` | write | – | – | Generates a 2FA Alpha login token, dynamic 6-digit code, and JWT session |
| `kill <session_id>` | `sys kill` | write | yes | type yes | |
| `clear-sessions` | `sys clear-sessions` | destructive | yes | type yes | forces global re-auth |
| `maintenance enable [--reason]` | `sys maintenance enable` | destructive | yes | type MAINTENANCE | auto-exit after 30 min |
| `maintenance disable` | `sys maintenance disable` | write | yes | type yes | |

### 3.6 `/audit` — Audit & Investigation

| Command (in-context) | Full Path | Risk | Dry-run | Confirm | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `user <uid>` | `audit user` | read | – | – | full audit trail |
| `grep <pattern>` | `audit grep` | read | – | – | search logs |
| `history [--limit]` | `audit history` | read | – | – | |
| `ledger verify [--uid]` | `audit ledger verify` | read | – | – | replay diagnostics (Power 2) |
| `sessions hijack-scan` | `audit sessions hijack-scan` | read | – | – | manual scan (Power 1) |
| `ip correlate [--uid]` | `audit ip correlate` | read | – | – | multi-account correlation (Power 3) |
| `nodes scan` | `audit nodes scan` | read | – | – | permission leak scan (Power 4) |
| `friendships reconstruct [--dry-run]` | `audit friendships reconstruct` | destructive | yes | type yes | rebuilds bidirectional maps (Power 5) |

### 3.7 `/fraud` — Fraud & Asset Seizure

| Command (in-context) | Full Path | Risk | Dry-run | Confirm | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `seize <uid> [--reason]` | `fraud seize` | requiresSecondConfirm | yes | type uid + reason | seizes all tokens/assets; logs `platform_financial_audit_logs` |
| `freeze <uid> [--reason]` | `fraud freeze` | destructive | yes | type yes | freezes wallet & escrow |
| `unfreeze <uid>` | `fraud unfreeze` | write | yes | type yes | |

---

## 4. Risk Tier System

Every command is assigned one of four risk tiers, which control the required confirmation and logging:

| Tier | Meaning | Confirmation Prompt | Auto-Backup / Restore Point |
| :--- | :--- | :--- | :--- |
| `read` | No persistent side effects | None | No |
| `write` | Reversible or low-impact modification | Type `'yes'` to continue | No |
| `destructive` | Irreversible modification with significant blast radius | Type `'yes'` to continue | Only for scoped content deletion (see §6) |
| `requiresSecondConfirm` | Catastrophic or platform-integrity-critical | Type the target identifier and reason to confirm | Restore point if applicable |

The risk tier is displayed in `--help` and enforced uniformly by the command dispatcher.

---

## 5. Confirmation Prompt Specification

* **`write` / `destructive` commands**:  
  > This is a [WRITE/DESTRUCTIVE] operation. Type 'yes' to confirm:  
  (Input must exactly match `yes` to proceed; aborts otherwise.)  
* **`requiresSecondConfirm` commands**:  
  > This is a CRITICAL operation. Type the target identifier and reason to proceed:  
  (Must match the target identifier and supply a non-empty reason; all others fail and are logged.)  

All confirmations, failed or successful, are written to the audit log with actor ID, timestamp, and command context.

---

## 6. Backup & Restore Point Strategy

Velum’s privacy requirements forbid permanent full-DB backups containing user PII. The CLI therefore implements a scoped, ephemeral restore point model for destructive content operations, alongside a structural-only backup.

* **`db backup`**: Exports only structural/configuration data (schemas, roles, seed data, system settings). Contains zero user profiles, messages, or financial data. Safe for long-term storage.  
* **`lounges clean`**: Before execution, automatically serializes only the messages that will be deleted into an encrypted restore point file, stored in a `/restore-points` directory. Each restore point has a 48-hour TTL.  
* **`lounges restore-messages`**: Re-inserts messages from a valid, unexpired restore point. Requires second-confirm.  
* **User hard-deletion (`confirm-purge`, `purge-fraudster`)**: Immediately purges all restore points containing that user’s data.  
* **`db prune`**: Cleans any expired restore points automatically.  

This approach provides operational safety without creating a long-term privacy liability.

---

## 7. Integration of Investigation Powers

The five advanced security diagnostics from the platform manual are exposed as read-only (or repair) commands under `/audit`, with manual invocation available even if automated daemons already run them. This ensures SecOps can double-check any alarm or run ad-hoc scans.

* **Power 1 (Session Hijack Detection)**: `audit sessions hijack-scan`  
* **Power 2 (Ledger Transaction Replay)**: `audit ledger verify`  
* **Power 3 (IP Correlation & Geo-fencing)**: `audit ip correlate`  
* **Power 4 (Polymorphic Node Data-leak Scans)**: `audit nodes scan`  
* **Power 5 (Friendship Map Reconstitution)**: `audit friendships reconstruct` (destructive repair)  

All results are displayed in the terminal and logged to the audit trail.
