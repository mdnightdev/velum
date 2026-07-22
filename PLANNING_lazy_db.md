# Planning: Codebase-Level Lazy Loading & Sync Protocol

## Phase 1: Implement On-Demand Table Decryption (Lazy Loading)
* In [persistence.ts](file:///root/velum/server/db/persistence.ts):
  * Define `localDbVersion` to track SQLite `user_version` state.
  * Extract `loadPayloadTable` and `loadCustomTable` to the module level.
  * Define `loadedTables` as an in-memory cache registry.
  * Implement `loadTableOnDemand(tableName: string)`. If the table is already loaded in `loadedTables`, return it. Otherwise, initialize the SQLite connection, call `loadPayloadTable` or `loadCustomTable`, and cache the result.
  * Implement `clearTableCaches()`. It empties the `loadedTables` registry.
  * Refactor `loadDb()` to be instantaneous: it only initializes SQLite, retrieves the starting `user_version` header, and sets `dbLoaded = true`. It does not load or decrypt any tables.
  * Implement `checkDatabaseSync()`. It queries `PRAGMA user_version` from SQLite. If it differs from `localDbVersion`, it clears the table caches via `clearTableCaches()` and updates `localDbVersion`.
  * Update `executeSaveDb()` to increment `PRAGMA user_version` inside the transaction and update `localDbVersion`.

## Phase 2: Integrate db Proxy Getter
* In [index.ts](file:///root/velum/server/db/index.ts):
  * Expose `db` as a Proxy wrapper targeting `ALL_TABLE_NAMES`.
  * For property reads, call `checkDatabaseSync()` to see if another process wrote to SQLite, then call `loadTableOnDemand(prop)`.
  * This guarantees that startup is instantaneous, refreshes are extremely fast, memory leaks are resolved, and PM2 load-balancing cluster nodes never experience data desync.
