# Planning: Codebase-Level Database Synchronization

## Phase 1: Implement user_version Cache Coherency Protocol
* In [persistence.ts](file:///root/velum/server/db/persistence.ts):
  * Define a global `localDbVersion` counter.
  * In `loadDb`, query `PRAGMA user_version` from SQLite and sync it to `localDbVersion`.
  * In `executeSaveDb`, increment the database `user_version` inside SQLite transaction (`PRAGMA user_version = X`) and update `localDbVersion`.
  * Implement and export `checkDatabaseSync()`. It queries `PRAGMA user_version` and, if it is different from `localDbVersion`, automatically triggers `loadDb(true)` to reload tables from SQLite.

## Phase 2: Intercept global db Access via Proxy Live-Bindings
* In [index.ts](file:///root/velum/server/db/index.ts):
  * Import `checkDatabaseSync` from `persistence.js`.
  * Rename the private cache object to `internalDb`.
  * Expose `db` as a custom ES Proxy. On property reads, call `checkDatabaseSync()` to ensure any database updates written by other processes (e.g., in a PM2 cluster) are instantly reloaded before data access.
