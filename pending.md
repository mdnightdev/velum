
## CLI Terminal Upgrade (Planned)
- **Interactive Shell Mode:** A continuous interactive session so the admin doesn't need to re-authenticate per command.
- **File-System Style Navigation:** Use standard terminal commands like `ls` (list categories/entities), `cd` (move between contexts like `cd users` or `cd db`), `pwd`, and `clear`.
- **Command Categories:**
  - `system/`: `status`, `logs`, `metrics` (CPU/RAM).
  - `users/`: `ban`, `unban`, `mute`, `approve`, `override`, `reset-avatar`.
  - `db/`: `backup`, `restore`, `repair`, `vacuum`, `integrity`, `prune`.
  - `secops/`: `risk`, `wire`, `tickets`.
- **Advanced DB Operations:** `repair` (fix orphaned records), `backup` (dump JSON state to a backup file), `restore` (load from backup).
- **Batch Processing:** Ability to apply actions to multiple targets (e.g., `ban user1 user2`).
- **Data Exporting:** Commands to export user lists, lounges, or audit logs to CSV/JSON.
