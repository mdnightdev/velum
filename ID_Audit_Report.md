# Velum ID Landscape & Database Audit Report

This report presents a keen, exhaustive analysis of the ID generation, storage, and propagation strategies across the Velum TypeScript + Node.js codebase. During this audit, several critical data-loss bugs, schema mismatches, and collision vulnerabilities were identified.

---

## 1. High-Level Summary of the ID Landscape

The Velum application is built on top of a hybrid database layer using a native Node.js SQLite driver (`node:sqlite`). It employs two main patterns for storing data:
1. **Generic Payload Tables**: Tables like `users`, `profiles`, `sessions`, `messages`, `audit_logs`, etc., are defined as simple key-value stores: `(id TEXT PRIMARY KEY, payload TEXT NOT NULL)`. The application serializes and encrypts the entire entity into the `payload` column, keeping its JavaScript types intact.
2. **Relational Schema Tables**: Tables like `lounges`, `lounge_rooms`, `lounge_members`, `market_listings`, and `escrow_transactions` have explicit column definitions. The save/load routines manually serialize and map fields between the application layer and SQLite table columns.

### ID Generation Strategies
The codebase utilizes three primary strategies to generate identifiers:
* **In-Memory Auto-Increment**: Used solely for primary user keys (`user_id`).
* **Universally Unique Lexicographically Sortable Identifiers (ULIDs)**: A custom Crockford Base32 20-character generator (`generateUlid`) is used for session tokens, payment requests, ledger entries, and KYC verifications.
* **Timestamp-Based Ad-Hoc Identifiers**: Combinations of `Date.now()`, static prefixes/suffixes, and random base36 strings are used for messages, sublounges, and marketplace assets.
* **Pure Timestamp Identifiers**: Several critical audit, security, and administrative entities use *only* a timestamp with no random seed, introducing major collision risks.

---

## 2. Entity-by-Entity Breakdown

Below is the detailed breakdown for each identifiable entity in the Velum system.

### 2.1. Core Identity & User Operations

| Entity Type | DB Table Name | ID Field Name | Generation Strategy | File & Line Reference | SQLite Col Type | Constraints | External Exposure |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **User** | `users` | `user_id` | Auto-incrementing `number` computed by fetching `max(user_id) + 1` | [userRepository.ts:65](file:///root/velum/server/db/userRepository.ts#L65) | `id TEXT` | Primary Key | `userId`, `user_id` |
| **User Public Handle** | `users` | `uid` | `VEL-UID-${Math.floor(100000 + Math.random() * 900000)}` | [authService.ts:176](file:///root/velum/server/services/authService.ts#L176) | Embedded in payload | None | `uid` in payloads |
| **Profile** | `profiles` | `profile_id` | Prefixed `p_` + `user_id` (e.g. `p_1`) | [authService.ts:186](file:///root/velum/server/services/authService.ts#L186) | `id TEXT` | Primary Key | `profile_id` |
| **Session** | `sessions` | `session_id` | 20-char Crockford Base32 ULID | [authService.ts:67](file:///root/velum/server/services/authService.ts#L67) | `id TEXT` | Primary Key | `sessionId` |
| **Device** | `devices` | `device_id` | **Ad-hoc**: `dev_${Date.now()}` | [authService.ts:197](file:///root/velum/server/services/authService.ts#L197) | `id TEXT` | Primary Key | `deviceId` |
| **IP Address** | `ip_addresses`| `ip_id` | **Ad-hoc**: `ip_${Date.now()}` | [authService.ts:209](file:///root/velum/server/services/authService.ts#L209) | `id TEXT` | Primary Key | None |

### 2.2. Social & Relations

| Entity Type | DB Table Name | ID Field Name | Generation Strategy | File & Line Reference | SQLite Col Type | Constraints |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Friend Request** | `friend_requests`| `request_id` | `req_${Date.now()}_${Math.random().toString(36).substr(2, 5)}` | [friends.ts:101](file:///root/velum/server/routes/friends.ts#L101) | `id TEXT` | Primary Key |
| **Peer Relationship**| `peer_relationships`| `id` / `relationship_id` | `rel_${Date.now()}_1` and `rel_${Date.now()}_2` (No random seed) | [friends.ts:196](file:///root/velum/server/routes/friends.ts#L196) | `id TEXT` | Primary Key |
| **User Block** | `user_blocks` | `block_id` | `blk_${Date.now()}_${Math.random().toString(36).substr(2, 5)}` | [profile.ts:191](file:///root/velum/server/routes/profile.ts#L191) | `id TEXT` | Primary Key |
| **User Mute** | `user_mutes` | `mute_id` | `mute_${Date.now()}_${Math.random().toString(36).substr(2, 5)}` | [profile.ts:270](file:///root/velum/server/routes/profile.ts#L270) | `id TEXT` | Primary Key |

### 2.3. Lounges & Communication

| Entity Type | DB Table Name | ID Field Name | Generation Strategy | File & Line Reference | SQLite Col Type | Constraints |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Lounge** | `lounges` | `lounge_id` | `comm_${Date.now()}_${Math.random().toString(36).substr(2, 5)}` | [lounges.ts:290](file:///root/velum/server/controllers/lounges.ts#L290) | `lounge_id TEXT` | Primary Key, `slug TEXT UNIQUE` |
| **Lounge Room** | `lounge_rooms` | `id` | Standard ULID (as fallback in save routine) | [db/index.ts:1154](file:///root/velum/server/db/index.ts#L1154) | `id TEXT` | Primary Key, Foreign Key (lounge_id) |
| **Lounge Member** | `lounge_members`| None | Composite Key: `(lounge_id, user_id)` | [db/index.ts:261](file:///root/velum/server/db/index.ts#L261) | `lounge_id TEXT`, `user_id INTEGER` | Compound Primary Key |
| **Lounge Invite** | `lounge_invites` | `id` | `inv_${Date.now()}_${Math.random().toString(36).substr(2, 4)}` | [lounges.ts:756](file:///root/velum/server/controllers/lounges.ts#L756) | `id TEXT` | Primary Key, `code TEXT UNIQUE` |
| **Lounge Sanction**| `lounge_sanctions`| `id` | `sanc_${Date.now()}_${Math.random().toString(36).substr(2, 5)}` | [lounges.ts:1224](file:///root/velum/server/controllers/lounges.ts#L1224) | `id TEXT` | Primary Key |
| **Join Request** | `lounge_join_requests`| `id` | `req_${Date.now()}_${Math.random().toString(36).substr(2, 4)}` | [lounges.ts:977](file:///root/velum/server/controllers/lounges.ts#L977) | `id TEXT` | Primary Key |
| **Ownership Transfer**| `lounge_ownership_transfers`| `id` | `trans_${Date.now()}_${Math.random().toString(36).substr(2, 4)}` | [lounges.ts:1078](file:///root/velum/server/controllers/lounges.ts#L1078) | `id TEXT` | Primary Key |
| **Lounge Preference**| `user_lounge_preferences`| None | Composite Key: `(user_id, lounge_id)` | [db/index.ts:327](file:///root/velum/server/db/index.ts#L327) | `user_id INTEGER`, `lounge_id TEXT` | Compound Primary Key |
| **Message** | `messages` | `message_id` | `msg_${Date.now()}_${Math.random().toString(36).substr(2, 4/5)}` | [websocket.ts:304](file:///root/velum/server/services/websocket.ts#L304) / [messages.ts:218](file:///root/velum/server/routes/messages.ts#L218) | `id TEXT` | Primary Key |

### 2.4. Marketplace & Listings

| Entity Type | DB Table Name | ID Field Name | Generation Strategy | File & Line Reference | SQLite Col Type | Constraints |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Market Listing** | `market_listings`| `listing_id` | `list_${Date.now()}_${Math.random().toString(36).substr(2, 5)}` | [marketplace.ts:132](file:///root/velum/server/controllers/marketplace.ts#L132) | `listing_id TEXT`| Primary Key |
| **Sku Variant** | `market_sku_variants`| `sku_id` | `sku_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 5)}` | [marketplace.ts:152](file:///root/velum/server/controllers/marketplace.ts#L152) | `id TEXT` | Primary Key |
| **Asset Media** | `market_asset_media`| `media_id` | `med_${Date.now()}_${index/random}` | [marketplace.ts:172](file:///root/velum/server/controllers/marketplace.ts#L172) | `id TEXT` | Primary Key |
| **Listing Coupon** | `market_coupons` | `coupon_id` | `cpn_${Date.now()}_${Math.random().toString(36).substr(2, 5)}` | [marketplace.ts:401](file:///root/velum/server/controllers/marketplace.ts#L401) | `id TEXT` | Primary Key |
| **Discussion** | `market_discussions`| `discussion_id` | `disc_${Date.now()}_${Math.random().toString(36).substr(2, 5)}` | [marketplace.ts:569](file:///root/velum/server/controllers/marketplace.ts#L569) | `id TEXT` | Primary Key |
| **Review** | `market_reviews` | `review_id` | `rev_${Date.now()}_${Math.random().toString(36).substr(2, 5)}` | [marketplace.ts:451](file:///root/velum/server/controllers/marketplace.ts#L451) | `id TEXT` | Primary Key |
| **Escrow Trans.** | `escrow_transactions`| `transaction_id`| `esc_${Date.now()}_${Math.random().toString(36).substr(2, 5)}` | [marketplace.ts:743](file:///root/velum/server/controllers/marketplace.ts#L743) | `transaction_id TEXT`| Primary Key, Foreign Key (listing_id) |
| **Support Chat** | `market_support_chats`| `chat_id` | `chat_${Date.now()}_${Math.random().toString(36).substr(2, 5)}` | [marketplace.ts:1289](file:///root/velum/server/controllers/marketplace.ts#L1289) | `id TEXT` | Primary Key |
| **Verification Check**| `listing_verification_checks`| `check_id` | `chk_${Date.now()}_${Math.floor(Math.random()*1000)}` | [admin.ts:876](file:///root/velum/server/controllers/admin.ts#L876) | `id TEXT` | Primary Key |

### 2.5. Banking, Ledgers & Wallets

| Entity Type | DB Table Name | ID Field Name | Generation Strategy | File & Line Reference | SQLite Col Type | Constraints |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **User Wallet** | `user_wallets` | `user_id` | Same as `user_id` (1:1 mapping) | [walletRepository.ts:22](file:///root/velum/server/db/walletRepository.ts#L22) | `id TEXT` | Primary Key |
| **Wallet Balance** | `wallet_balances`| None (uses balance_id?) | Mapped internally by user + currency code | [walletRepository.ts:59](file:///root/velum/server/db/walletRepository.ts#L59) | `id TEXT` | Primary Key |
| **KYC Verification**| `kyc_verifications`| `kyc_id` | `kyc_${generateUlid()}` | [walletRepository.ts:97](file:///root/velum/server/db/walletRepository.ts#L97) | `id TEXT` | Primary Key |
| **Payment Method** | `payment_methods`| `payment_method_id`| `pm_${generateUlid()}` | [payments.ts:294](file:///root/velum/server/controllers/payments.ts#L294) | `id TEXT` | Primary Key |
| **Ext. Fin. Account**| `external_financial_accounts`| `account_token` | `tok_${generateUlid()}` | [payments.ts:278](file:///root/velum/server/controllers/payments.ts#L278) | `id TEXT` | Primary Key |
| **Processor Event** | `external_processor_events`| `event_id` | `ev_${generateUlid()}` | [payments.ts:398](file:///root/velum/server/controllers/payments.ts#L398) | `id TEXT` | Primary Key |
| **Recharge Request**| `recharge_requests`| `request_id` | `rec_${generateUlid()}` | [payments.ts:383](file:///root/velum/server/controllers/payments.ts#L383) | `id TEXT` | Primary Key |
| **Withdrawal Req.** | `withdrawal_requests`| `request_id` | `wth_${generateUlid()}` | [payments.ts:517](file:///root/velum/server/controllers/payments.ts#L517) | `id TEXT` | Primary Key |
| **Ledger Entry** | `wallet_ledger_entries`| `entry_id` | **Context-based** (Marketplace) or **ULID** (Payments) | [marketplace.ts:721](file:///root/velum/server/controllers/marketplace.ts#L721) / [payments.ts:422](file:///root/velum/server/controllers/payments.ts#L422) | `id TEXT` | Primary Key |
| **Refund Request** | `refund_requests`| `request_id` | `ref_${Date.now()}_${Math.random().toString(36).substr(2, 5)}` | [marketplace.ts:989](file:///root/velum/server/controllers/marketplace.ts#L989) | None | Unsaved table |

### 2.6. Security, Auditing & Administration

| Entity Type | DB Table Name | ID Field Name | Generation Strategy | File & Line Reference | SQLite Col Type | Constraints |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Global Audit Log**| `audit_logs` | `log_id` | **Ad-hoc**: `al_${Date.now()}` | [auth.ts:276](file:///root/velum/server/controllers/auth.ts#L276) | `id TEXT` | Primary Key |
| **Lounge Audit Log**| `lounge_audit_logs`| `id` | **Ad-hoc**: `al_${Date.now()}` | [lounges.ts:1289](file:///root/velum/server/controllers/lounges.ts#L1289) | `id TEXT` | Primary Key, Foreign Key (lounge_id) |
| **System Audit Log**| `system_audit_logs`| `id` | Never populated in controllers | None | `id TEXT` | Primary Key (Unused table) |
| **Suspicious Event**| `suspicious_events`| `event_id` | **Ad-hoc**: `se_${Date.now()}` | [auth.ts:220](file:///root/velum/server/controllers/auth.ts#L220) | `id TEXT` | Primary Key |
| **Recovery Event** | `recovery_events`| `event_id` | **Ad-hoc**: `rec_${Date.now()}` | [admin.ts:330](file:///root/velum/server/controllers/admin.ts#L330) | `id TEXT` | Primary Key |
| **Ticket** | `tickets` | `ticket_id` | **Ad-hoc**: `t_${Date.now()}` | [tickets.ts:105](file:///root/velum/server/routes/tickets.ts#L105) | `id TEXT` | Primary Key |
| **Ticket Tracking** | `tickets` | `tracking_id` | `ticket_t_${crypto.randomUUID()}` | [tickets.ts:106](file:///root/velum/server/routes/tickets.ts#L106) | Embedded in payload | Unique |
| **Platform Admin** | `platform_admins`| `admin_id` | Seeded/loaded directly | None | `id TEXT` | Primary Key |
| **Report** | `reports` | `report_id` | **Ad-hoc**: `rep_${Date.now()}` | [profile.ts:312](file:///root/velum/server/routes/profile.ts#L312) / [tickets.ts:81](file:///root/velum/server/routes/tickets.ts#L81) | `id TEXT` | Primary Key |

---

## 3. Global Patterns and Utilities

### 3.1. The Crockford Base32 ULID (`generateUlid`)
Located in [ulid.ts](file:///root/velum/server/utils/ulid.ts). The generator combines:
1. A **timestamp segment** (10 characters): Encodes `Date.now()` into Crockford Base32.
2. A **random segment** (10 characters): Derived from `crypto.randomBytes(10)` modulo 32.

```typescript
export function generateUlid(seedTime: number = Date.now()): string {
  let timePart = '';
  let timeVal = seedTime;
  for (let i = 0; i < 10; i++) {
    const mod = timeVal % 32;
    timePart = BASE32_CHARS[mod] + timePart;
    timeVal = Math.floor(timeVal / 32);
  }
  let randomPart = '';
  const randBytes = crypto.randomBytes(10);
  for (let i = 0; i < 10; i++) {
    const index = randBytes[i] % 32;
    randomPart += BASE32_CHARS[index];
  }
  return timePart + randomPart;
}
```
*Note*: A standard spec ULID is 26 characters (10 time + 16 random). This custom implementation returns a 20-character string, which is sufficient for uniqueness but diverges from the standard.

### 3.2. Ad-Hoc Timestamp Generators
Ad-hoc IDs are generated inline in routers/controllers using variations of:
```typescript
const id = `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, LENGTH)}`;
```
* `LENGTH` is inconsistent across the application (ranges from 4 to 5).
* Base36 conversion of `Math.random()` can yield variable-length results if trailing zeros are dropped.

---

## 4. Issues & Recommendations (Bugs Found)

### 🔴 BUG 1: Database Race Condition & Overwrite Vulnerability (Collision Risk)
Multiple entity tables generate primary key IDs using **only** `Date.now()` without any random seed:
* **Entities Affected**: `device_id` (`dev_`), `ip_id` (`ip_`), `invite_id` (`inv_`), `sanction_id` (`sanc_`), `ticket_id` (`t_`), `event_id` (`se_` / `rec_`), `log_id` (`al_`), `id` (`al_` / `rel_`).
* **Root Cause**: Lack of randomized suffix. For example, [admin.ts:691](file:///root/velum/server/controllers/admin.ts#L691): `invite_id: "inv_" + Date.now()`.
* **Impact**: Under high traffic, API scripts, or concurrent users, operations happening within the same millisecond will generate the exact same ID. When saved to SQLite via `INSERT OR REPLACE`, the newer record will silently overwrite and destroy the older record. This is a severe threat to security logs (suspicious events can overwrite each other during brute-force loops) and session tracking.
* **Recommendation**: Refactor these to append a random suffix or migrate them to use `generateUlid()`.

### 🔴 BUG 2: 100% Data Loss on Server Restart (Unsaved Tables)
In [db/index.ts](file:///root/velum/server/db/index.ts), three collections present in `DbSchema` are completely missing from the SQLite setup:
* **Entities Affected**: `platform_financial_audit_logs`, `automation_actions`, `refund_requests`.
* **Root Cause**: These tables are not defined in `initSqlite()`'s tables array, and their data is never handled in `executeSaveDb()` or `loadDb()`.
* **Impact**: Any records created (e.g., refund requests submitted via `createRefundRequest`) only exist in-memory and are permanently lost when the Node process restarts.
* **Recommendation**: Add these tables to `initSqlite()`, and add corresponding `saveTable` / `loadPayloadTable` calls in `db/index.ts`.

### 🔴 BUG 3: Metadata Silently Discarded on Save (Partial Data Loss)
When saving relational tables, several columns are omitted from SQL insertion, causing silent data loss on restart:
* **Escrow Transactions**: `coupon_applied`, `sku_variant_id`, `platform_fee`, `payout_amount`, `sandbox_logs`, and `sandbox_state` are completely ignored in `saveEscrowTransactionsDb`.
* **Market Listings**: `discount_price`, `verification_status`, `inventory_count`, `average_rating`, and `review_count` are ignored in `saveMarketListingsDb`.
* **Impact**: Platform fees, applied coupon codes, and listing verification statuses vanish upon server restart.
* **Recommendation**: Expand the SQL columns for these tables in `db/index.ts` to include and persist these fields.

### 🔴 BUG 4: State Inconsistency in Lounge Load Routine
In [db/index.ts:768](file:///root/velum/server/db/index.ts#L768), when loading `lounges` from SQLite, several columns are successfully written to SQL on save but are **omitted when reading**:
* **Omitted Fields**: `type`, `owner_user_id`, `hide_member_list`, `is_locked`, and `last_active_at`.
* **Impact**: Sublounges that were set to private/locked or had hidden member lists will reset to public/unlocked on server restart, presenting a severe security and privacy bypass.
* **Recommendation**: Update the `loungesRows.map()` mapping in `db/index.ts` to include these omitted fields.

### 🟠 BUG 5: Dead / Zombie Database Schemas
* **`lounge_rooms` table**: The database defines a separate `lounge_rooms` table. However, [lounges.ts:740](file:///root/velum/server/controllers/lounges.ts#L740) saves room creations directly as sublounges in the `lounges` table (setting `parent_lounge_id`). The `lounge_rooms` table remains permanently empty, yet various routes still execute queries against it.
* **`account_deletion_requests`** & **`system_audit_logs`**: These tables are set up in SQL and mapped in `db/index.ts` but are never populated by any application controller.
* **Recommendation**: Deprecate the `lounge_rooms` table and clean up unused table code.

### 🟠 BUG 6: Runtime Type Pollution (String vs. Number Mismatch)
* **Entities Affected**: `seller_id` in `MarketListing`, and `buyer_id` / `seller_id` in `EscrowTransaction`.
* **Root Cause**: Defined as `number` in `src/types.ts` but saved as `String(id)` in `db/index.ts`. When loaded, they are read as `string` values directly from SQLite columns.
* **Impact**: Running objects end up with `string` IDs where the compiler expects `number`, risking failing comparisons (like `===`) and compiler confusion.
* **Recommendation**: Explicitly wrap the database values in `Number()` during load mapping inside `db/index.ts`.

### 🟠 BUG 7: Broken `/friends/unblock` Endpoint
* **Root Cause**: [friends.ts:152](file:///root/velum/server/routes/friends.ts#L152) searches `db.peer_relationships` for a relationship with `status === "blocked"`. However, when a user blocks another in [profile.ts:190](file:///root/velum/server/routes/profile.ts#L190), it pushes to `db.user_blocks` and deletes any matching relation from `db.peer_relationships`.
* **Impact**: `/friends/unblock` can never find a blocked record in `peer_relationships` and is completely broken.
* **Recommendation**: Modify `/friends/unblock` to splice the block record out of `db.user_blocks`.

### 🟡 BUG 8: Inconsistent Suffix Lengths & Ledger ID Generation
* **Message ID Suffix**: Normal message router appends a 5-char random base36 string, but websocket appends a 4-char string.
* **Ledger ID Format**: Marketplace transactions use `led_Date.now()_[context]_[random]` but payment transactions use `led_[ULID]`.
* **Recommendation**: Standardize message suffix lengths and ledger formats across the backend.
