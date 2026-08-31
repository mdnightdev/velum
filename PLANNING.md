# Master Plan: Exact Implementation of `/sanctions` Commands

## 1. `history [uid/username]`
- **Purpose**: Displays user-focused sanction history and count metrics.
- **Output**:
  - Shows target User ID, Username, Total Sanction Count, and a clean table of all historical sanctions applied to them (Mutes, Jails, Bans, Restrictions, Freezes, Blacklists, Purges) with specific reasons, admin issuer, and timestamps.

## 2. `flags [uid/username]`
- **Purpose**: Strictly User Risk Behavior & Incoming Abuse Reports (distinct from `/users flags`).
- **Data**: Queries the `reports` table (user misconduct, fraud, harassment, scam reports) and aggregates report counts, priority, and risk status.
- **Output**: Table of reported users, report counts, report types, reasons, and risk status.

## 3. `blacklist` (Automatic Table Store)
- **Purpose**: Fully automated, read-only audit library table of blacklisted entities (Usernames, IPs, Device IDs, Hardware Fingerprints) populated automatically by the system.
- **Behavior**:
  - `blacklist` (no manual add): Renders the populated automated library store.
  - `blacklist <user>`: Automated cascading ecosystem sweep (ingests username, IPs, device IDs, fingerprints automatically).

## 4. `whitelist <target> [reason]`
- **Purpose**: The manual pardon command to remove an entity or user's ecosystem from the automatic blacklist table.

---

## Phases
- **Phase 1:** Update `cli/v2/handlers/sanctions.ts` and `cli/v2/registry.ts`.
- **Phase 2:** Verify with test suite.
