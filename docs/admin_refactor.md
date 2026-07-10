# Technical Audit & Refactoring Blueprint: `AdminPanel.tsx`

This document details the refactoring, cleanup, and decoupling plan for the admin panel monolith ([AdminPanel.tsx](file:///root/velum/src/components/AdminPanel.tsx)).

---

## 1. Initial Priority Phase: Real-Time WebSockets & Overview Cleanup

We will refactor the data flow and UI of the **Overview** dashboard first, resolving database polling stress and removing mock data:

### A. Real-Time WebSockets Migration (Replacing HTTP Polling)
* **Current Issue**: The admin panel polls `/api/admin/tickets` and `/api/admin/diagnostics` every 4 seconds using HTTP requests, which places continuous lock pressure on SQLite.
* **Refactor Plan**:
  1. Perform a **single HTTP fetch** when the admin dashboard mounts to load the initial database snapshot (active tickets, user lists, and logs).
  2. Subscribe the admin panel client to the existing WebSocket connection (`/ws`).
  3. When database mutations occur (e.g. a user files a support ticket, logs in, or submits a report), the backend will push a real-time event (e.g., `TICKET_UPDATE`, `AUDIT_LOG_ENTRY`) to the admin socket.
  4. The admin panel will update its local React state dynamically upon receiving WebSocket events, completely eliminating the 4-second database polling loop.

### B. Overview Tab Pruning & Redesign
* **Removals (Boilerplate & Mock Data)**:
  * Remove the **Channel Traffic Vector Chart** (static mock SVG line).
  * Remove the **System Health checklist** (static mock list).
  * Remove the **Messages (24h) Card** (fake count, highly database-intensive).
* **Simplified Layout**:
  * Consolidate the stats cards into a clean, 3-card header row: **Total Users**, **Active Rooms**, and **Open Incidents** (Support Tickets).
  * Retain the **Recent System Incidents table** (displays the 5 most recent real support tickets from the database).

### C. Unified Glassmorphic UI Shell (Eliminating Tab Padding)
* **Goal**: Eradicate double-nested margins and repetitive padded borders around individual tabs, unifying the cockpit appearance.
* **Refactor Plan**:
  1. Define `.glass-panel`, `.glass-card`, and `.glass-input` classes globally in `src/index.css`.
  2. Wrap the main view body of `AdminPanel.tsx` in a single, outer `.glass-panel` layout box.
  3. Individual tabs will no longer render separate outer `bgPanel` boxes. Instead, they will render directly onto the unified glass canvas.
  4. Form controls, metrics, and nested components will use `.glass-card` and `.glass-input` for consistent design semantics across all views.


---

## 2. Tab Navigation & Decoupling Scheme

The admin panel sidebar navigation will be renamed using simple, single-word terms:

| Old Tab Name | New Tab Name | Access Control | Primary Icon |
|---|---|---|---|
| Overview Desk | **Overview** | `LOGIN_ADMIN`, `CLI_ADMIN` | `Activity` |
| User Directory | **Users** | `LOGIN_ADMIN`, `CLI_ADMIN` | `Users` |
| Moderation Sanctions | **Sanctions** | All Admins | `Ban` |
| Dispute Cases | **Tickets** | All Admins | `HelpCircle` |
| Escalated Reports | **Reports** | All Admins | `FileText` |
| Feed Broadcasts | **Broadcasts** | `LOGIN_ADMIN`, `CLI_ADMIN` | `Megaphone` |
| Central Bank | **Bank** | All Admins (restricted view per role) | `Landmark` |
| System Sentinel | **System** | `LOGIN_ADMIN`, `CLI_ADMIN` | `Sliders` |
| Audit Registry | **Logs** | `LOGIN_ADMIN`, `CLI_ADMIN` | `BookOpen` |
| Security Settings | **Profile** | All Admins | `User` |


---

## 3. Directory & Sanction Separation Design

To resolve layout clutter and functional overlap, user listings and sanctions are split into two distinct contexts:

### A. The Users Tab (Account Lifecycle Directory)
* **Purpose**: Serves as the database directory of all registered accounts.
* **Layout**: A clean, data-dense table showing username, role, join date, last-seen state, and account status.
* **Status Icons**:
  * **Active**: Green check circle (`CheckCircle2`) or simple status dot.
  * **Suspended/Deactivated**: Red shield/alert icon (`ShieldAlert`).
  * **Online/Idle status**: Live presence dot matching `DESIGN.md`.
* **Quick Actions (Icon-Only)**:
  * **Promote**: ArrowUp/UserCheck icon (`UserCheck`) to nominate or elevate permissions.
  * **Deactivate**: Power/Lock icon (`Lock`) to suspend logins.
  * **Delete**: Trash icon (`Trash2`) to initiate account purge.

### B. The Sanctions Tab (Active Enforcement Hub)
* **Purpose**: The central dashboard for viewing and applying sanctions (bans, mutes, kicks).
* **Layout**:
  * **Top Section**: Active Sanctions Log (table of currently banned/muted users, remaining time, operator who applied it, and inline "Lift Sanction" action).
  * **Bottom Section**: Apply Sanctions Form (input username/ID, select sanction type, set duration/expiration date, enter operational reason).

---

## 4. Database Schema Split: Tickets vs. Reports

To prevent support queues from being spammed with user complaints or suggestions, database records are separated:

### A. Tickets (User Help Desk)
* **Schema**: Retains the `tickets` database table.
* **Fields**: `ticket_id`, `user_id`, `issue_type` (restricted to: `account_lockout`, `payment_issue`, `compromise_recovery`, `marketplace_dispute`), `status`, `credibility_score`, `messages` (active chat history between user & admin).
* **Audit Rule**: Restricted to direct two-way conversations between users and support operators.

### B. Reports (Misconduct, Bug, and Suggestion Logs)
* **Schema**: Extracted to a new `reports` database table (and corresponding backend endpoints).
* **Fields**: `report_id`, `reporter_id`, `target_user_id` (optional), `target_message_id` (optional), `type` (`user_misconduct`, `bug_report`, `suggestion`), `priority` (`LOW`, `MEDIUM`, `HIGH`), `reason`, `status` (`pending`, `reviewed`, `closed`), `created_at`.
* **Flows**:
  * **Scam/Fraud Priority**: Misconduct reports categorized as `scam` or `fraud` automatically compute as `HIGH` priority, highlighting the row in orange/red inside the Admin **Reports** desk.
  * **Message Reporting**: Adds a "Report Message" action in the chat bubble popover to log the raw message reference into the database.

---

## 5. Deletion and Purge Governance

### A. Administrative Purges (Direct Punishment)
* **Trigger**: Extreme offenses (scams, fraud, failure to comply with system policies).
* **Requirements**: Admin must enter a mandatory "Reason for Purge" input before confirming.
* **Authority Levels**:
  * **`LOGIN_ADMIN` Purge (Soft-Purge)**: The target user's status is changed to `'purged'`. Access is immediately revoked, sessions terminated, and records are hidden from standard directory views. However, the rows are retained in SQLite.
  * **`CLI_ADMIN` Override**: CLI_ADMIN can view soft-purged accounts and restore them back to `'active'` if they were deleted by mistake.
  * **`CLI_ADMIN` Direct Purge (Hard-Purge)**: Skips the soft-delete layer and immediately cleans all user records and database mappings.

### B. Self-Purges (User Deletion)
* **Trigger**: User requests deletion from their settings dashboard.
* **Rule**: Follows a 7-day grace period. Active escrow balances belonging to the user are automatically refunded to their nominated financial account upon completion (unlike administrative fraud purges, where funds remain frozen/seized).

---

## 6. System Sentinel & Settings Tab Consolidation

To remove redundant tabs and unify security tools, the **System Sentinel** and **Security Settings** tabs are merged and restructured:

### A. The Profile Tab (`profile`)
* **Purpose**: Personal administrative identity, rotation, and customization dashboard.
* **Features**:
  * **Custom Avatar Upload**: Allows admins to upload custom avatars (persisted in database/filesystem and displayed in lounges).
  * **Rotate Credentials**: Rename handle and change password (calling `/api/admin/rename-executive`).
  * **Identity Credentials**: Configure/modify personal **Safe Word** and **Panic Phrase**.
* **Icon**: `User`

### B. The System Tab (`system`)
* **Purpose**: Infrastructure management and operational security.
* **Features**:
  * **Gateway Lockdown**: Emergency security lockdown toggle.
  * **Manual Account Restore**: Bypass/restore quarantine accounts.
  * **Issue Entry Codes**: Invite generation and status tracking.
* **Icon**: `Sliders`

### C. Database Seeding Persistence Fix (`server/db.ts`)
* **Issue**: The server automatically overrides rotated credentials on reboot back to the default `.env` seeds because of a mismatch verification in `hardResetAndSeedDatabase`.
* **Fix**: Modify `server/db.ts` to check if `Midnight` and `Lexie` accounts are already present in the database. If they exist with valid Argon2id password hashes, skip re-seeding their passwords/usernames on startup so that rotations persist.

---

## 7. Extraction & Decoupling Strategy

The refactoring will be performed incrementally, extracting views into individual files inside a new directory `src/components/Admin/`:

```
src/components/Admin/
  ├── AdminOverview.tsx
  ├── AdminUsers.tsx
  ├── AdminSanctions.tsx
  ├── AdminTickets.tsx
  ├── AdminReports.tsx
  ├── AdminBroadcasts.tsx
  ├── AdminBank.tsx
  ├── AdminSystem.tsx
  ├── AdminLogs.tsx
  └── AdminProfile.tsx
```

`AdminPanel.tsx` will be refactored into a routing shell that dynamically loads these components based on the active tab state.

