# CLI Terminal & System Upgrades (Completed)

### 1. Terminal Shell Upgrades - **[COMPLETED]**
- **Interactive Shell Mode:** A continuous interactive session so the admin doesn't need to re-authenticate per command.
- **File-System Style Navigation:** Use standard terminal commands like `ls` (list categories/entities), `cd` (move between contexts like `cd users` or `cd db`), `pwd`, and `clear`.
- **Command Categories:**
  - `/sys` (formerly `system/`): `status`, `top`, `risk`, `token`, `kill`, `clear-sessions`, `maintenance-enable`, `maintenance-disable`
  - `/users` (formerly `users/`): `list`, `cat`, `ban`, `unban`, `mute`, `unmute`, `jail`, `unjail`, `reset-avatar`, `override`, `set-role`, `deactivate`, `cancel-deactivation`, `release-assets`, `confirm-purge`, `purge-fraudster`, `blacklist`, `unblacklist`, `pending-deletions`, `restore`
  - `/db` (formerly `db/`): `integrity`, `orphans-scan`, `orphans-clean`, `backup`, `export`, `vacuum`, `restore`, `seed`, `prune`, `wipe`
  - `/support`: `pending`, `token`, `approve`, `reject`, `demote`, `delete`
  - `/audit`: `user`, `grep`, `history`, `ledger-verify`, `sessions-hijack-scan`, `ip-correlate`, `nodes-scan`, `friendships-reconstruct`
  - `/fraud`: `seize`, `freeze`, `unfreeze`
- **Advanced DB Operations:** `orphans-clean` (fix orphaned records), `backup` (dump JSON state to a backup file), `restore` (load from backup).
- **Batch Processing:** Ability to apply actions to multiple targets seamlessly.
- **Data Exporting:** Command `/db/export` to export raw records of a table with fully masked PII.

### 2. Operational Security & Core Enhancements (Completed)
- **Real Client IP & Geolocation Resolution:** - **[COMPLETED]**
  - **The Problem:** Geolocation was formerly hardcoded to "Poland, Warsaw" (fake placeholder data).
  - **The Solution:** Implemented robust header extraction (`x-forwarded-for`, `x-real-ip`) inside `/server/utils.ts` and integrated a dynamic, cached IP-to-Geo asynchronous locator via `ip-api.com` with a 1.8s connection timeout and graceful fallback.
- **SecOps Alerts CLI Terminal Command:** - **[COMPLETED]**
  - Added `/sys/risk` command to scan and audit active security deviations, alongside a direct terminal logger.
- **Client Device Fingerprinting:** - **[COMPLETED]**
  - Expanded session device metrics checks within `/audit/sessions-hijack-scan` to identify browser hardware inconsistencies.
- **Silent Quarantine with Artificial Latency Throttling:** - **[COMPLETED]**
  - Implemented `/users/jail` and `/users/override` to safely quarantine suspicious actors with customized sandboxed access.
- **Hybrid Ledger Verification Engine:** - **[COMPLETED]**
  - Deployed dynamic transaction rolling-link SHA-256 integrity chains verified via `/audit/ledger-verify` to mathematical audits of wallet balances against ledger logs.
- **Sovereign Friendship Reconstruction:** - **[COMPLETED]**
  - Implemented `/audit/friendships-reconstruct` to automatically scan, repair, and reconstitute missing bidirectional friendship mappings.
- **Two-Day Deletion Asset Release Verification Buffer:** - **[COMPLETED]**
  - Implemented a mandatory 2-day verification block within `/users/release-assets` to verify and release ledger funds before any user accounts are allowed to undergo the final hard-purge (/users/confirm-purge).
- **Immediate Fraudster Purge & Treasury Asset Takeover:** - **[COMPLETED]**
  - Integrated `/users/purge-fraudster` (and `/fraud/seize`) to instantly sever all active sessions, scrub identity records, and automatically capture all suspect wallet balances and active escrow funds into the secure Treasury (User 999).


# Pending Tasks

1. **Revert User Purge (CLI Command)** - **[COMPLETED]**
   - **Context:** Login Admins currently have the ability to purge user accounts.
   - **Task:** Add a CLI command that allows CLI Admins to reverse this decision and restore the purged account. Implemented as `/users/restore` and integrated in real-time.

2. **Persistent User Data on Seeding Accounts** - **[COMPLETED]**
   - **Context:** Currently, when the CLI `seed` command is run, it wipes user data clean.
   - **Task:** Override the seed behavior so that existing user data remains persistent in the database. Implemented in `/db/seed` which validates and retains user database files non-destructively.

3. **Session Hijack Detection Pipeline (Investigation Power 1)** - **[COMPLETED]**
   - **Context:** Detection of concurrent sessions, stolen cookies, or suspicious authentication flows.
   - **Task:** Implement automated pipeline analytics to flag potential session hijacking attempts. Implemented in `/audit/sessions-hijack-scan`.

4. **Ledger Transaction Replay Diagnostics (Investigation Power 2)** - **[COMPLETED]**
   - **Context:** Validating the immutability of the financial ledger and detecting transaction replay or double-spending attempts.
   - **Task:** Formulate a diagnostic engine to trace, replay, and verify the integrity of sequential ledger entries. Implemented in `/audit/ledger-verify` using a dynamic SHA-256 rolling-link signature.

5. **IP Correlation and Geo-fencing Audit (Investigation Power 3)** - **[COMPLETED]**
   - **Context:** Tracking accounts linked by common IP addresses or analyzing location discrepancies.
   - **Task:** Add diagnostic utilities to correlate user sessions against IP subnets and geography. Implemented in `/audit/ip-correlate`.

6. **Bi-directional Friendship Map Reconstitution (Investigation Power 5)** - **[COMPLETED]**
   - **Context:** Repairing or reconciling disconnected or corrupted peer relations after an unexpected database state loss.
   - **Task:** Reconstitute mutual relationships cleanly by scanning and matching bi-directional peer entries. Implemented in `/audit/friendships-reconstruct`.

7. **CLI Admin 2FA Token-based Login Authentication Reintroduction** - **[COMPLETED]**
   - **Context:** Secure administrative session control requires robust, multi-channel authentication.
   - **Task:** Bring back/reintroduce CLI login with a generated token from the terminal (MFA/2FA single-use Alpha token and 6-digit OTP code). Implemented in `/sys/token` with dual dynamic OTP drift verification.
