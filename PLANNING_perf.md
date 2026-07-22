# Planning: Database Write-Delete Performance Refactor

## Phase 1: Implement Differential Sync for Custom Tables
* In [persistence.ts](file:///root/velum/server/db/persistence.ts):
  * Refactor all custom save functions (`saveLoungesDb`, `saveLoungeRoomsDb`, `saveMarketListingsDb`, `saveEscrowTransactionsDb`, etc.) to use differential synchronization instead of dropping and recreating the tables:
    * Construct a list of IDs to keep from the memory array.
    * Execute a `DELETE` statement targeting only the rows not in that list (e.g. `DELETE FROM table WHERE id NOT IN (...)`).
    * For composite keys (like `lounge_members` and `user_lounge_preferences`), use concatenated values (e.g. `DELETE FROM lounge_members WHERE (lounge_id || '_' || user_id) NOT IN (...)`).
    * Use `INSERT OR REPLACE` instead of raw `INSERT` to update modified rows and insert new rows.
  * This completely eliminates the write-amplification bottlenecks and prevents SQLite from choking on write operations.
