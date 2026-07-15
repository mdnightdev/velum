"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.broadcastToRoomCallback = exports.lastSavedDbJson = exports.decryptionErrorDetected = exports.isSaving = exports.dbLoaded = exports.sqliteDb = exports.db = exports.SQLITE_FILE = exports.DB_FILE = exports.DB_DIR = exports.setCloudBackupDisabled = exports.BACKUP_COOLDOWN_MS = exports.backupTimer = exports.lastBackupAttemptTime = exports.isCloudBackupDisabled = exports.executeCloudBackup = exports.backupDbToCloud = exports.restoreDbFromCloud = exports.getSafeDatabaseBackupBinary = exports.initPgBackupTable = void 0;
exports.registerBroadcastToRoomCallback = registerBroadcastToRoomCallback;
exports.initSqlite = initSqlite;
exports.verifySqliteFile = verifySqliteFile;
exports.wipeAndRebuildDatabaseFile = wipeAndRebuildDatabaseFile;
exports.ensureSeededIntegrity = ensureSeededIntegrity;
exports.loadDb = loadDb;
exports.saveDb = saveDb;
exports.executeSaveDb = executeSaveDb;
exports.setupAuditLogProxy = setupAuditLogProxy;
exports.setDecryptionErrorDetected = setDecryptionErrorDetected;
exports.setIsSaving = setIsSaving;
var path_1 = require("path");
var fs_1 = require("fs");
var crypto_1 = require("crypto");
// @ts-ignore
var node_sqlite_1 = require("node:sqlite");
var schema_js_1 = require("./schema.js");
var crypto_js_1 = require("../utils/crypto.js");
var ulid_js_1 = require("../utils/ulid.js");
var db_js_1 = require("../db.js");
var sync_js_1 = require("../services/sync.js");
Object.defineProperty(exports, "initPgBackupTable", { enumerable: true, get: function () { return sync_js_1.initPgBackupTable; } });
Object.defineProperty(exports, "getSafeDatabaseBackupBinary", { enumerable: true, get: function () { return sync_js_1.getSafeDatabaseBackupBinary; } });
Object.defineProperty(exports, "restoreDbFromCloud", { enumerable: true, get: function () { return sync_js_1.restoreDbFromCloud; } });
Object.defineProperty(exports, "backupDbToCloud", { enumerable: true, get: function () { return sync_js_1.backupDbToCloud; } });
Object.defineProperty(exports, "executeCloudBackup", { enumerable: true, get: function () { return sync_js_1.executeCloudBackup; } });
Object.defineProperty(exports, "isCloudBackupDisabled", { enumerable: true, get: function () { return sync_js_1.isCloudBackupDisabled; } });
Object.defineProperty(exports, "lastBackupAttemptTime", { enumerable: true, get: function () { return sync_js_1.lastBackupAttemptTime; } });
Object.defineProperty(exports, "backupTimer", { enumerable: true, get: function () { return sync_js_1.backupTimer; } });
Object.defineProperty(exports, "BACKUP_COOLDOWN_MS", { enumerable: true, get: function () { return sync_js_1.BACKUP_COOLDOWN_MS; } });
Object.defineProperty(exports, "setCloudBackupDisabled", { enumerable: true, get: function () { return sync_js_1.setCloudBackupDisabled; } });
var DatabaseSync = node_sqlite_1.default === null || node_sqlite_1.default === void 0 ? void 0 : node_sqlite_1.default.DatabaseSync;
exports.DB_DIR = path_1.default.join(process.cwd(), 'data');
exports.DB_FILE = path_1.default.join(exports.DB_DIR, 'velum_state_v3.bin');
exports.SQLITE_FILE = path_1.default.join(exports.DB_DIR, 'velum_db.sqlite');
if (!fs_1.default.existsSync(exports.DB_DIR)) {
    fs_1.default.mkdirSync(exports.DB_DIR, { recursive: true });
}
exports.db = __assign({}, schema_js_1.defaultDb);
exports.sqliteDb = null;
exports.dbLoaded = false;
exports.isSaving = false;
var saveTimeout = null;
exports.decryptionErrorDetected = false;
exports.lastSavedDbJson = '';
exports.broadcastToRoomCallback = null;
function registerBroadcastToRoomCallback(cb) {
    exports.broadcastToRoomCallback = cb;
}
function initSqlite() {
    if (!DatabaseSync) {
        console.error('[SYS-SECURE] Native SQLite DatabaseSync class is not available in this environment.');
        return null;
    }
    try {
        var conn = new DatabaseSync(exports.SQLITE_FILE);
        // Drop incompatible node_overwrites table if it exists with old schema
        try {
            var needsDrop = false;
            try {
                conn.prepare("SELECT id FROM node_overwrites LIMIT 1").get();
            }
            catch (e) {
                if (!e.message.includes("no such table")) {
                    needsDrop = true;
                }
            }
            if (needsDrop) {
                conn.exec("DROP TABLE IF EXISTS node_overwrites");
            }
        }
        catch (_) { }
        // Main relational database schemas
        var tables = [
            'users', 'profiles', 'sessions', 'devices', 'ip_addresses',
            'messages', 'user_blocks', 'user_mutes', 'admin_sanctions',
            'invites', 'tickets', 'reports', 'recovery_events', 'suspicious_events', 'audit_logs',
            'friend_requests', 'peer_relationships', 'join_requests', 'node_overwrites',
            // New banking/payments tables
            'user_wallets', 'wallet_ledger_entries', 'recharge_requests', 'withdrawal_requests',
            'kyc_verifications', 'payment_methods', 'external_financial_accounts', 'external_processor_events',
            'wallet_balances', 'currencies', 'exchange_rates', 'platform_admins',
            // New marketplace tables
            'market_assets', 'market_sku_variants', 'market_asset_media', 'market_reviews',
            'market_coupons', 'market_discussions', 'market_support_chats', 'listing_verification_checks',
            // Missing tables to avoid data loss
            'platform_financial_audit_logs', 'automation_actions', 'refund_requests'
        ];
        for (var _i = 0, tables_1 = tables; _i < tables_1.length; _i++) {
            var table = tables_1[_i];
            conn.exec("CREATE TABLE IF NOT EXISTS ".concat(table, " (\n        id TEXT PRIMARY KEY,\n        payload TEXT NOT NULL,\n        updated_at TEXT DEFAULT CURRENT_TIMESTAMP\n      )"));
        }
        // Persistent login nonces table schema for challenge-response replay protection
        conn.exec("CREATE TABLE IF NOT EXISTS login_nonces (\n        nonce TEXT PRIMARY KEY,\n        created_at INTEGER NOT NULL,\n        used INTEGER DEFAULT 0\n    )");
        // Lounges table schema (with icon_url, is_official, last_message_at)
        conn.exec("CREATE TABLE IF NOT EXISTS lounges (\n        lounge_id TEXT PRIMARY KEY,\n        name TEXT NOT NULL,\n        description TEXT,\n        owner_id TEXT NOT NULL,\n        created_at INTEGER NOT NULL,\n        is_private INTEGER DEFAULT 0,\n        is_official INTEGER DEFAULT 0,\n        last_message_at INTEGER,\n        icon_url TEXT,\n        invite_code TEXT,\n        \n        -- New architecture columns\n        id TEXT,\n        slug TEXT UNIQUE,\n        creator_id TEXT,\n        parent_lounge_id TEXT REFERENCES lounges(lounge_id) ON DELETE CASCADE,\n        updated_at INTEGER,\n        is_system INTEGER DEFAULT 0,\n        visibility TEXT DEFAULT 'public',\n        status TEXT DEFAULT 'active'\n    )");
        // Ensure icon_url column exists in lounges if table was already created
        try {
            conn.exec("ALTER TABLE lounges ADD COLUMN icon_url TEXT");
        }
        catch (_) {
            // Column may already exist
        }
        // Ensure new columns exist
        try {
            conn.exec("ALTER TABLE lounges ADD COLUMN is_official INTEGER DEFAULT 0");
        }
        catch (_) { }
        try {
            conn.exec("ALTER TABLE lounges ADD COLUMN last_message_at INTEGER");
        }
        catch (_) { }
        try {
            conn.exec("ALTER TABLE lounges ADD COLUMN invite_code TEXT");
        }
        catch (_) { }
        try {
            conn.exec("ALTER TABLE lounges ADD COLUMN id TEXT");
        }
        catch (_) { }
        try {
            conn.exec("ALTER TABLE lounges ADD COLUMN slug TEXT");
        }
        catch (_) { }
        try {
            conn.exec("ALTER TABLE lounges ADD COLUMN creator_id TEXT");
        }
        catch (_) { }
        try {
            conn.exec("ALTER TABLE lounges ADD COLUMN parent_lounge_id TEXT");
        }
        catch (_) { }
        try {
            conn.exec("ALTER TABLE lounges ADD COLUMN updated_at INTEGER");
        }
        catch (_) { }
        try {
            conn.exec("ALTER TABLE lounges ADD COLUMN is_system INTEGER DEFAULT 0");
        }
        catch (_) { }
        try {
            conn.exec("ALTER TABLE lounges ADD COLUMN visibility TEXT DEFAULT 'public'");
        }
        catch (_) { }
        try {
            conn.exec("ALTER TABLE lounges ADD COLUMN status TEXT DEFAULT 'active'");
        }
        catch (_) { }
        try {
            conn.exec("ALTER TABLE lounges ADD COLUMN type TEXT");
        }
        catch (_) { }
        try {
            conn.exec("ALTER TABLE lounges ADD COLUMN owner_user_id INTEGER");
        }
        catch (_) { }
        try {
            conn.exec("ALTER TABLE lounges ADD COLUMN hide_member_list INTEGER DEFAULT 0");
        }
        catch (_) { }
        try {
            conn.exec("ALTER TABLE lounges ADD COLUMN is_locked INTEGER DEFAULT 0");
        }
        catch (_) { }
        try {
            conn.exec("ALTER TABLE lounges ADD COLUMN last_active_at INTEGER");
        }
        catch (_) { }
        // Ensure new columns exist for market_listings
        try {
            conn.exec("ALTER TABLE market_listings ADD COLUMN seller_username TEXT");
        }
        catch (_) { }
        try {
            conn.exec("ALTER TABLE market_listings ADD COLUMN discount_price REAL");
        }
        catch (_) { }
        try {
            conn.exec("ALTER TABLE market_listings ADD COLUMN verification_status TEXT");
        }
        catch (_) { }
        try {
            conn.exec("ALTER TABLE market_listings ADD COLUMN inventory_count INTEGER");
        }
        catch (_) { }
        // Ensure new columns exist for escrow_transactions
        try {
            conn.exec("ALTER TABLE escrow_transactions ADD COLUMN coupon_applied TEXT");
        }
        catch (_) { }
        try {
            conn.exec("ALTER TABLE escrow_transactions ADD COLUMN sku_variant_id TEXT");
        }
        catch (_) { }
        try {
            conn.exec("ALTER TABLE escrow_transactions ADD COLUMN platform_fee REAL");
        }
        catch (_) { }
        try {
            conn.exec("ALTER TABLE escrow_transactions ADD COLUMN payout_amount REAL");
        }
        catch (_) { }
        try {
            conn.exec("ALTER TABLE escrow_transactions ADD COLUMN sandbox_logs TEXT");
        }
        catch (_) { }
        try {
            conn.exec("ALTER TABLE escrow_transactions ADD COLUMN sandbox_state TEXT");
        }
        catch (_) { }
        // Parent Index
        try {
            conn.exec("CREATE INDEX IF NOT EXISTS idx_lounges_parent ON lounges(parent_lounge_id)");
        }
        catch (_) { }
        // Lounge Rooms table schema: DEPRECATED (lounge_rooms are represented as sublounges in lounges table)
        // Nodes (polymorphic fractal tree nodes representing channels, workspaces, sub-spaces)
        conn.exec("CREATE TABLE IF NOT EXISTS nodes (\n        node_id TEXT PRIMARY KEY,\n        lounge_id TEXT NOT NULL,\n        parent_id TEXT,\n        name TEXT NOT NULL,\n        configuration_json TEXT NOT NULL DEFAULT '{}',\n        created_at INTEGER NOT NULL,\n        FOREIGN KEY(lounge_id) REFERENCES lounges(lounge_id) ON DELETE CASCADE,\n        FOREIGN KEY(parent_id) REFERENCES nodes(node_id) ON DELETE CASCADE\n    )");
        // Precomputed closure paths table for O(1) subtree operations and ancestry querying
        conn.exec("CREATE TABLE IF NOT EXISTS node_closure (\n        ancestor_id TEXT NOT NULL,\n        descendant_id TEXT NOT NULL,\n        depth INTEGER NOT NULL CHECK (depth >= 0),\n        PRIMARY KEY (ancestor_id, descendant_id),\n        FOREIGN KEY(ancestor_id) REFERENCES nodes(node_id) ON DELETE CASCADE,\n        FOREIGN KEY(descendant_id) REFERENCES nodes(node_id) ON DELETE CASCADE\n    )");
        // Polymorphic custom view settings for any node space (e.g. Chat, Forum, Store)
        conn.exec("CREATE TABLE IF NOT EXISTS node_views (\n        view_id TEXT PRIMARY KEY,\n        node_id TEXT NOT NULL,\n        view_type TEXT NOT NULL CHECK (view_type IN ('chat', 'forum', 'marketplace_embedded', 'voice')),\n        display_order INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0),\n        FOREIGN KEY(node_id) REFERENCES nodes(node_id) ON DELETE CASCADE\n    )");
        // Inter-lounge space sharing router
        conn.exec("CREATE TABLE IF NOT EXISTS node_federation (\n        federation_id TEXT PRIMARY KEY,\n        origin_node_id TEXT NOT NULL,\n        target_lounge_id TEXT NOT NULL,\n        mounted_parent_id TEXT,\n        status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REVOKED')),\n        FOREIGN KEY(origin_node_id) REFERENCES nodes(node_id) ON DELETE CASCADE,\n        FOREIGN KEY(target_lounge_id) REFERENCES lounges(lounge_id) ON DELETE CASCADE,\n        FOREIGN KEY(mounted_parent_id) REFERENCES nodes(node_id) ON DELETE SET NULL\n    )");
        // Lounge 64-Bit Bitwise RBAC Roles Config
        conn.exec("CREATE TABLE IF NOT EXISTS lounge_roles (\n        role_id TEXT PRIMARY KEY,\n        lounge_id TEXT NOT NULL,\n        name TEXT NOT NULL,\n        position INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0),\n        permissions_bitfield INTEGER NOT NULL DEFAULT 0,\n        FOREIGN KEY(lounge_id) REFERENCES lounges(lounge_id) ON DELETE CASCADE\n    )");
        // High performance compound indexes for prefix scans
        conn.exec("CREATE INDEX IF NOT EXISTS idx_closure_lookup ON node_closure (ancestor_id, descendant_id, depth)");
        conn.exec("CREATE INDEX IF NOT EXISTS idx_closure_reverse ON node_closure (descendant_id, ancestor_id, depth)");
        conn.exec("CREATE INDEX IF NOT EXISTS idx_nodes_hierarchy ON nodes (lounge_id, parent_id)");
        // Market listings table schema
        conn.exec("CREATE TABLE IF NOT EXISTS market_listings (\n        listing_id TEXT PRIMARY KEY,\n        seller_id TEXT NOT NULL,\n        title TEXT NOT NULL,\n        description TEXT,\n        price REAL NOT NULL,\n        status TEXT DEFAULT 'ACTIVE',\n        created_at INTEGER NOT NULL\n    )");
        // Escrow transactions table schema
        conn.exec("CREATE TABLE IF NOT EXISTS escrow_transactions (\n        transaction_id TEXT PRIMARY KEY,\n        listing_id TEXT NOT NULL,\n        buyer_id TEXT NOT NULL,\n        seller_id TEXT NOT NULL,\n        amount REAL NOT NULL,\n        status TEXT NOT NULL,\n        created_at INTEGER NOT NULL,\n        updated_at INTEGER NOT NULL,\n        FOREIGN KEY(listing_id) REFERENCES market_listings(listing_id) ON DELETE CASCADE\n    )");
        // New architecture tables
        conn.exec("CREATE TABLE IF NOT EXISTS lounge_members (\n        lounge_id TEXT NOT NULL,\n        user_id INTEGER NOT NULL,\n        role TEXT NOT NULL,\n        status TEXT NOT NULL,\n        joined_via TEXT NOT NULL,\n        joined_at INTEGER NOT NULL,\n        PRIMARY KEY (lounge_id, user_id),\n        FOREIGN KEY(lounge_id) REFERENCES lounges(lounge_id) ON DELETE CASCADE\n    )");
        conn.exec("CREATE TABLE IF NOT EXISTS lounge_invites (\n        id TEXT PRIMARY KEY,\n        lounge_id TEXT NOT NULL,\n        code TEXT NOT NULL UNIQUE,\n        created_by INTEGER NOT NULL,\n        max_uses INTEGER DEFAULT 1,\n        uses_count INTEGER DEFAULT 0,\n        expires_at INTEGER,\n        revoked_at INTEGER,\n        FOREIGN KEY(lounge_id) REFERENCES lounges(lounge_id) ON DELETE CASCADE\n    )");
        conn.exec("CREATE TABLE IF NOT EXISTS lounge_sanctions (\n        id TEXT PRIMARY KEY,\n        lounge_id TEXT NOT NULL,\n        user_id INTEGER NOT NULL,\n        type TEXT NOT NULL,\n        applied_by INTEGER NOT NULL,\n        applied_by_type TEXT NOT NULL,\n        applied_at INTEGER NOT NULL,\n        lifted_at INTEGER,\n        reason TEXT,\n        FOREIGN KEY(lounge_id) REFERENCES lounges(lounge_id) ON DELETE CASCADE\n    )");
        conn.exec("CREATE TABLE IF NOT EXISTS lounge_join_requests (\n        id TEXT PRIMARY KEY,\n        lounge_id TEXT NOT NULL,\n        user_id INTEGER NOT NULL,\n        message TEXT,\n        status TEXT NOT NULL,\n        reviewed_by INTEGER,\n        reviewed_at INTEGER,\n        FOREIGN KEY(lounge_id) REFERENCES lounges(lounge_id) ON DELETE CASCADE\n    )");
        conn.exec("CREATE TABLE IF NOT EXISTS lounge_ownership_transfers (\n        id TEXT PRIMARY KEY,\n        lounge_id TEXT NOT NULL,\n        from_user_id INTEGER NOT NULL,\n        to_user_id INTEGER NOT NULL,\n        status TEXT NOT NULL,\n        initiated_at INTEGER NOT NULL,\n        resolved_at INTEGER,\n        FOREIGN KEY(lounge_id) REFERENCES lounges(lounge_id) ON DELETE CASCADE\n    )");
        conn.exec("CREATE TABLE IF NOT EXISTS account_deletion_requests (\n        id TEXT PRIMARY KEY,\n        user_id INTEGER NOT NULL,\n        requested_at INTEGER NOT NULL,\n        scheduled_purge_at INTEGER NOT NULL,\n        status TEXT NOT NULL\n    )");
        conn.exec("CREATE TABLE IF NOT EXISTS user_lounge_preferences (\n        user_id INTEGER NOT NULL,\n        lounge_id TEXT NOT NULL,\n        notifications_muted INTEGER DEFAULT 0,\n        pinned INTEGER DEFAULT 0,\n        pin_order INTEGER,\n        PRIMARY KEY (user_id, lounge_id),\n        FOREIGN KEY(lounge_id) REFERENCES lounges(lounge_id) ON DELETE CASCADE\n    )");
        conn.exec("CREATE TABLE IF NOT EXISTS lounge_audit_logs (\n        id TEXT PRIMARY KEY,\n        lounge_id TEXT NOT NULL,\n        actor_id INTEGER NOT NULL,\n        actor_type TEXT NOT NULL,\n        action TEXT NOT NULL,\n        target_type TEXT NOT NULL,\n        target_id TEXT NOT NULL,\n        metadata TEXT,\n        created_at INTEGER NOT NULL,\n        FOREIGN KEY(lounge_id) REFERENCES lounges(lounge_id) ON DELETE CASCADE\n    )");
        conn.exec("CREATE TABLE IF NOT EXISTS system_audit_logs (\n        id TEXT PRIMARY KEY,\n        actor_id INTEGER NOT NULL,\n        actor_type TEXT NOT NULL,\n        action TEXT NOT NULL,\n        target_type TEXT NOT NULL,\n        target_id TEXT NOT NULL,\n        metadata TEXT,\n        created_at INTEGER NOT NULL\n    )");
        // ==========================================
        // HIGH-PERFORMANCE SECONDARY INDEXES
        // ==========================================
        try {
            // Lounges Table Indexes
            conn.exec("CREATE INDEX IF NOT EXISTS idx_lounges_owner ON lounges (owner_id)");
            conn.exec("CREATE INDEX IF NOT EXISTS idx_lounges_official ON lounges (is_official)");
            conn.exec("CREATE INDEX IF NOT EXISTS idx_lounges_invite_code ON lounges (invite_code)");
            // Lounge Rooms Table Index: DEPRECATED
            // Node Views Table Index
            conn.exec("CREATE INDEX IF NOT EXISTS idx_node_views_node ON node_views (node_id)");
            // Node Federation Table Indexes
            conn.exec("CREATE INDEX IF NOT EXISTS idx_node_federation_origin ON node_federation (origin_node_id)");
            conn.exec("CREATE INDEX IF NOT EXISTS idx_node_federation_target ON node_federation (target_lounge_id)");
            conn.exec("CREATE INDEX IF NOT EXISTS idx_node_federation_mounted ON node_federation (mounted_parent_id)");
            // Lounge Roles Table Index
            conn.exec("CREATE INDEX IF NOT EXISTS idx_lounge_roles_lounge ON lounge_roles (lounge_id)");
            // Market Listings Table Index
            conn.exec("CREATE INDEX IF NOT EXISTS idx_market_listings_seller ON market_listings (seller_id, status)");
            // Escrow Transactions Table Indexes
            conn.exec("CREATE INDEX IF NOT EXISTS idx_escrow_transactions_listing ON escrow_transactions (listing_id)");
            conn.exec("CREATE INDEX IF NOT EXISTS idx_escrow_transactions_buyer ON escrow_transactions (buyer_id, status)");
            conn.exec("CREATE INDEX IF NOT EXISTS idx_escrow_transactions_seller ON escrow_transactions (seller_id, status)");
            // Lounge Members Table Index (Compound PK is indexed, add index on user_id)
            conn.exec("CREATE INDEX IF NOT EXISTS idx_lounge_members_user ON lounge_members (user_id)");
            // Lounge Invites Table Index
            conn.exec("CREATE INDEX IF NOT EXISTS idx_lounge_invites_lounge ON lounge_invites (lounge_id)");
            // Lounge Sanctions Table Indexes
            conn.exec("CREATE INDEX IF NOT EXISTS idx_lounge_sanctions_lounge ON lounge_sanctions (lounge_id)");
            conn.exec("CREATE INDEX IF NOT EXISTS idx_lounge_sanctions_user ON lounge_sanctions (user_id)");
            // Lounge Join Requests Table Indexes
            conn.exec("CREATE INDEX IF NOT EXISTS idx_lounge_join_reqs_lounge ON lounge_join_requests (lounge_id, status)");
            conn.exec("CREATE INDEX IF NOT EXISTS idx_lounge_join_reqs_user ON lounge_join_requests (user_id)");
            // Lounge Ownership Transfers Table Index
            conn.exec("CREATE INDEX IF NOT EXISTS idx_lounge_transfers_lounge ON lounge_ownership_transfers (lounge_id, status)");
            // Account Deletion Requests Table Index
            conn.exec("CREATE INDEX IF NOT EXISTS idx_account_deletions_user ON account_deletion_requests (user_id, status)");
            // User Lounge Preferences Table Index (Compound PK is indexed, add index on lounge_id)
            conn.exec("CREATE INDEX IF NOT EXISTS idx_user_lounge_prefs_lounge ON user_lounge_preferences (lounge_id)");
            // Lounge Audit Logs Table Index
            conn.exec("CREATE INDEX IF NOT EXISTS idx_lounge_audit_logs_lounge ON lounge_audit_logs (lounge_id)");
            // System Audit Logs Table Index
            conn.exec("CREATE INDEX IF NOT EXISTS idx_system_audit_logs_actor ON system_audit_logs (actor_id)");
        }
        catch (idxErr) {
            console.warn('[SYS-SECURE] Secondary indexes initialization warning:', idxErr);
        }
        return conn;
    }
    catch (err) {
        console.error('[SYS-SECURE] SQLite database connection init fault:', (err === null || err === void 0 ? void 0 : err.message) || err);
        return null;
    }
}
function verifySqliteFile(filePath) {
    var _a, _b;
    if (!DatabaseSync)
        return false;
    var testDb = null;
    try {
        if (!fs_1.default.existsSync(filePath))
            return false;
        var size = fs_1.default.statSync(filePath).size;
        if (size === 0)
            return true;
        testDb = new DatabaseSync(filePath);
        var row = testDb.prepare("PRAGMA integrity_check").get();
        var ok = row && row.integrity_check === 'ok';
        try {
            (_a = testDb.close) === null || _a === void 0 ? void 0 : _a.call(testDb);
        }
        catch (_) { }
        return ok;
    }
    catch (err) {
        console.error("[SYS-SECURE] SQLite verification failed for ".concat(filePath, ":"), err);
        if (testDb) {
            try {
                (_b = testDb.close) === null || _b === void 0 ? void 0 : _b.call(testDb);
            }
            catch (_) { }
        }
        return false;
    }
}
function wipeAndRebuildDatabaseFile() {
    try {
        if (fs_1.default.existsSync(exports.SQLITE_FILE)) {
            fs_1.default.unlinkSync(exports.SQLITE_FILE);
        }
        if (fs_1.default.existsSync(exports.DB_FILE)) {
            fs_1.default.unlinkSync(exports.DB_FILE);
        }
    }
    catch (_) { }
}
function ensureSeededIntegrity() {
    if (!exports.db)
        exports.db = __assign({}, schema_js_1.defaultDb);
    if (!exports.db.users)
        exports.db.users = [];
    if (!exports.db.profiles)
        exports.db.profiles = [];
    if (!exports.db.sessions)
        exports.db.sessions = [];
    if (!exports.db.devices)
        exports.db.devices = [];
    if (!exports.db.ip_addresses)
        exports.db.ip_addresses = [];
    if (!exports.db.messages)
        exports.db.messages = [];
    if (!exports.db.user_blocks)
        exports.db.user_blocks = [];
    if (!exports.db.user_mutes)
        exports.db.user_mutes = [];
    if (!exports.db.admin_sanctions)
        exports.db.admin_sanctions = [];
    if (!exports.db.invites)
        exports.db.invites = [];
    if (!exports.db.tickets)
        exports.db.tickets = [];
    if (!exports.db.reports)
        exports.db.reports = [];
    if (!exports.db.recovery_events)
        exports.db.recovery_events = [];
    if (!exports.db.suspicious_events)
        exports.db.suspicious_events = [];
    if (!exports.db.audit_logs)
        exports.db.audit_logs = [];
    if (!exports.db.friend_requests)
        exports.db.friend_requests = [];
    if (!exports.db.peer_relationships)
        exports.db.peer_relationships = [];
    if (!exports.db.join_requests)
        exports.db.join_requests = [];
    if (!exports.db.lounge_rooms)
        exports.db.lounge_rooms = [];
    if (!exports.db.node_overwrites)
        exports.db.node_overwrites = [];
    if (!exports.db.lounge_members)
        exports.db.lounge_members = [];
    if (!exports.db.lounge_invites)
        exports.db.lounge_invites = [];
    if (!exports.db.lounge_sanctions)
        exports.db.lounge_sanctions = [];
    if (!exports.db.lounge_join_requests)
        exports.db.lounge_join_requests = [];
    if (!exports.db.lounge_ownership_transfers)
        exports.db.lounge_ownership_transfers = [];
    if (!exports.db.account_deletion_requests)
        exports.db.account_deletion_requests = [];
    if (!exports.db.user_lounge_preferences)
        exports.db.user_lounge_preferences = [];
    if (!exports.db.lounge_audit_logs)
        exports.db.lounge_audit_logs = [];
    if (!exports.db.system_audit_logs)
        exports.db.system_audit_logs = [];
    if (!exports.db.lounges || exports.db.lounges.length === 0) {
        exports.db.lounges = [
            {
                lounge_id: 'velum_lounge',
                name: 'Velum Lounge',
                description: 'System default lounge',
                owner_id: '2',
                created_at: Date.now(),
                is_private: 0,
                is_official: 1,
                last_message_at: Date.now(),
                invite_code: 'VELUM1',
                id: 'velum_lounge',
                slug: 'velum-lounge',
                creator_id: '2',
                parent_lounge_id: null,
                updated_at: Date.now(),
                is_system: 1
            },
            {
                lounge_id: 'secops',
                name: 'SecOps Executive Coordinates',
                description: 'Private administration lounge',
                owner_id: '2',
                created_at: Date.now(),
                is_private: 1,
                is_official: 1,
                last_message_at: Date.now(),
                invite_code: 'SECOPS',
                id: 'secops',
                slug: 'secops',
                creator_id: '2',
                parent_lounge_id: null,
                updated_at: Date.now(),
                is_system: 0
            }
        ];
    }
    else {
        var hasVelum = exports.db.lounges.some(function (l) { return l && l.lounge_id === 'velum_lounge'; });
        if (!hasVelum) {
            exports.db.lounges.push({
                lounge_id: 'velum_lounge',
                name: 'Velum Lounge',
                description: 'System default lounge',
                owner_id: '2',
                created_at: Date.now(),
                is_private: 0,
                is_official: 1,
                last_message_at: Date.now(),
                invite_code: 'VELUM1',
                id: 'velum_lounge',
                slug: 'velum-lounge',
                creator_id: '2',
                parent_lounge_id: null,
                updated_at: Date.now(),
                is_system: 1
            });
        }
    }
    if (!exports.db.market_listings)
        exports.db.market_listings = [];
    if (!exports.db.escrow_transactions)
        exports.db.escrow_transactions = [];
    // Initialize new banking and marketplace arrays
    if (!exports.db.user_wallets)
        exports.db.user_wallets = [];
    if (!exports.db.wallet_ledger_entries)
        exports.db.wallet_ledger_entries = [];
    if (!exports.db.recharge_requests)
        exports.db.recharge_requests = [];
    if (!exports.db.withdrawal_requests)
        exports.db.withdrawal_requests = [];
    if (!exports.db.kyc_verifications)
        exports.db.kyc_verifications = [];
    if (!exports.db.payment_methods)
        exports.db.payment_methods = [];
    if (!exports.db.external_financial_accounts)
        exports.db.external_financial_accounts = [];
    if (!exports.db.external_processor_events)
        exports.db.external_processor_events = [];
    if (!exports.db.wallet_balances)
        exports.db.wallet_balances = [];
    if (!exports.db.currencies)
        exports.db.currencies = [];
    if (!exports.db.exchange_rates)
        exports.db.exchange_rates = [];
    if (!exports.db.platform_admins)
        exports.db.platform_admins = [];
    if (!exports.db.market_assets)
        exports.db.market_assets = [];
    if (!exports.db.market_sku_variants)
        exports.db.market_sku_variants = [];
    if (!exports.db.market_asset_media)
        exports.db.market_asset_media = [];
    if (!exports.db.market_reviews)
        exports.db.market_reviews = [];
    if (!exports.db.market_coupons)
        exports.db.market_coupons = [];
    if (!exports.db.market_discussions)
        exports.db.market_discussions = [];
    if (!exports.db.market_support_chats)
        exports.db.market_support_chats = [];
    if (!exports.db.listing_verification_checks)
        exports.db.listing_verification_checks = [];
    // Overwrite currencies and exchange rates to ensure we use clean global major currencies
    var rawCurrencies = [
        { code: 'VLM', name: 'Velum Token', native: true, usdVal: 0.67 },
        { code: 'TWD', name: 'New Taiwan Dollar', native: false, usdVal: 0.031 },
        { code: 'USD', name: 'US Dollar', native: false, usdVal: 1.0 },
        { code: 'EUR', name: 'Euro', native: false, usdVal: 1.08 },
        { code: 'GBP', name: 'Pound Sterling', native: false, usdVal: 1.28 },
        { code: 'JPY', name: 'Japanese Yen', native: false, usdVal: 0.0062 },
        { code: 'CAD', name: 'Canadian Dollar', native: false, usdVal: 0.73 },
        { code: 'AUD', name: 'Australian Dollar', native: false, usdVal: 0.66 },
        { code: 'CHF', name: 'Swiss Franc', native: false, usdVal: 1.11 },
        { code: 'CNY', name: 'Chinese Yuan', native: false, usdVal: 0.14 },
        { code: 'SGD', name: 'Singapore Dollar', native: false, usdVal: 0.74 },
        { code: 'HKD', name: 'Hong Kong Dollar', native: false, usdVal: 0.13 }
    ];
    exports.db.currencies = rawCurrencies.map(function (c) { return ({
        currency_code: c.code,
        display_name: c.name,
        is_platform_native: c.native,
        redeemable_for_cash: !c.native,
        decimal_places: 2,
        active: true
    }); });
    var generatedRates = [];
    for (var _i = 0, rawCurrencies_1 = rawCurrencies; _i < rawCurrencies_1.length; _i++) {
        var base = rawCurrencies_1[_i];
        for (var _a = 0, rawCurrencies_2 = rawCurrencies; _a < rawCurrencies_2.length; _a++) {
            var quote = rawCurrencies_2[_a];
            if (base.code !== quote.code) {
                var rateVal = base.usdVal / quote.usdVal;
                generatedRates.push({
                    rate_id: "rate_".concat(base.code.toLowerCase(), "_").concat(quote.code.toLowerCase()),
                    base_currency: base.code,
                    quote_currency: quote.code,
                    rate: Number(rateVal.toFixed(6)),
                    simulated_source: 'INTERBANK_FEED',
                    effective_at: Date.now()
                });
            }
        }
    }
    exports.db.exchange_rates = generatedRates;
    // Ensure system account
    if (exports.db && exports.db.users && !exports.db.users.some(function (u) { return u.user_id === 999; })) {
        exports.db.users.push({
            user_id: 999,
            username: 'Velum',
            password_hash: 'SYSTEM_LOCKED',
            safe_word_hash: 'SYSTEM_LOCKED',
            panic_phrase_hash: 'SYSTEM_LOCKED',
            recovery_key_hash: 'SYSTEM_LOCKED',
            role: 'SYSTEM',
            status: 'active',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            salt: 'SYSTEM_LOCKED',
            uid: 'VEL-UID-VELUM'
        });
    }
}
function loadDb(force) {
    var _this = this;
    var _a, _b;
    if (force === void 0) { force = false; }
    if (exports.dbLoaded && !force)
        return;
    try {
        var sqliteLoaded = false;
        // 1. Try to load directly from the relational SQLite database SQLITE_FILE
        if (fs_1.default.existsSync(exports.SQLITE_FILE)) {
            //      console.log('[SYS-SECURE] SQLITE_FILE found. Loading state from local relational SQLite database...');
            var conn_1 = null;
            try {
                conn_1 = new DatabaseSync(exports.SQLITE_FILE);
                var loadPayloadTable = function (tableName, idField) {
                    try {
                        // Check if table exists
                        var tableCheck = conn_1.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(tableName);
                        if (!tableCheck)
                            return [];
                        var rows = conn_1.prepare("SELECT id, payload FROM ".concat(tableName)).all();
                        return rows.map(function (r) {
                            try {
                                var obj = JSON.parse((0, crypto_js_1.decryptData)(r.payload));
                                if (idField && (obj[idField] === undefined || obj[idField] === null || obj[idField] === '')) {
                                    obj[idField] = r.id;
                                }
                                return obj;
                            }
                            catch (decErr) {
                                console.error("[SYS-SECURE] CRITICAL DECRYPTION FAILURE in ".concat(tableName, ":"), decErr);
                                exports.decryptionErrorDetected = true;
                                return null;
                            }
                        }).filter(Boolean);
                    }
                    catch (err) {
                        //    console.warn(`[SYS-SECURE] Error loading table ${tableName}:`, err);
                        return [];
                    }
                };
                exports.db.users = loadPayloadTable('users', 'user_id');
                exports.db.profiles = loadPayloadTable('profiles', 'profile_id');
                exports.db.sessions = loadPayloadTable('sessions', 'session_id');
                exports.db.devices = loadPayloadTable('devices', 'device_id');
                exports.db.ip_addresses = loadPayloadTable('ip_addresses', 'ip_id');
                exports.db.messages = loadPayloadTable('messages', 'message_id');
                exports.db.user_blocks = loadPayloadTable('user_blocks', 'block_id');
                exports.db.user_mutes = loadPayloadTable('user_mutes', 'mute_id');
                exports.db.admin_sanctions = loadPayloadTable('admin_sanctions', 'sanction_id');
                exports.db.invites = loadPayloadTable('invites', 'invite_id');
                exports.db.tickets = loadPayloadTable('tickets', 'ticket_id');
                exports.db.reports = loadPayloadTable('reports', 'report_id');
                exports.db.recovery_events = loadPayloadTable('recovery_events', 'event_id');
                exports.db.suspicious_events = loadPayloadTable('suspicious_events', 'event_id');
                exports.db.audit_logs = loadPayloadTable('audit_logs', 'log_id');
                exports.db.friend_requests = loadPayloadTable('friend_requests', 'request_id');
                exports.db.peer_relationships = loadPayloadTable('peer_relationships', 'id');
                exports.db.join_requests = loadPayloadTable('join_requests', 'id');
                exports.db.node_overwrites = loadPayloadTable('node_overwrites', 'overwrite_id');
                // Banking & Payment Tables
                exports.db.user_wallets = loadPayloadTable('user_wallets', 'user_id');
                exports.db.wallet_ledger_entries = loadPayloadTable('wallet_ledger_entries', 'entry_id');
                exports.db.recharge_requests = loadPayloadTable('recharge_requests', 'request_id');
                exports.db.withdrawal_requests = loadPayloadTable('withdrawal_requests', 'request_id');
                exports.db.kyc_verifications = loadPayloadTable('kyc_verifications', 'kyc_id');
                exports.db.payment_methods = loadPayloadTable('payment_methods', 'payment_method_id');
                exports.db.external_financial_accounts = loadPayloadTable('external_financial_accounts', 'account_token');
                exports.db.external_processor_events = loadPayloadTable('external_processor_events', 'event_id');
                exports.db.wallet_balances = loadPayloadTable('wallet_balances', 'balance_id');
                exports.db.currencies = loadPayloadTable('currencies', 'currency_code');
                exports.db.exchange_rates = loadPayloadTable('exchange_rates', 'rate_id');
                exports.db.platform_admins = loadPayloadTable('platform_admins', 'admin_id');
                // Marketplace Tables
                exports.db.market_assets = loadPayloadTable('market_assets', 'listing_id');
                exports.db.market_sku_variants = loadPayloadTable('market_sku_variants', 'sku_id');
                exports.db.market_asset_media = loadPayloadTable('market_asset_media', 'media_id');
                exports.db.market_reviews = loadPayloadTable('market_reviews', 'review_id');
                exports.db.market_coupons = loadPayloadTable('market_coupons', 'coupon_id');
                exports.db.market_discussions = loadPayloadTable('market_discussions', 'discussion_id');
                exports.db.market_support_chats = loadPayloadTable('market_support_chats', 'chat_id');
                exports.db.listing_verification_checks = loadPayloadTable('listing_verification_checks', 'check_id');
                // Load Missing Tables
                exports.db.platform_financial_audit_logs = loadPayloadTable('platform_financial_audit_logs', 'log_id');
                exports.db.automation_actions = loadPayloadTable('automation_actions', 'action_id');
                exports.db.refund_requests = loadPayloadTable('refund_requests', 'request_id');
                // Load structured tables
                var loadTableRows = function (tableName) {
                    try {
                        var tableCheck = conn_1.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(tableName);
                        if (!tableCheck)
                            return null;
                        return conn_1.prepare("SELECT * FROM ".concat(tableName)).all();
                    }
                    catch (err) {
                        console.warn("[SYS-SECURE] Error loading structured table ".concat(tableName, ":"), err);
                        return null;
                    }
                };
                var loungesRows = loadTableRows('lounges');
                if (loungesRows) {
                    exports.db.lounges = loungesRows.map(function (r) { return ({
                        lounge_id: r.lounge_id,
                        name: r.name,
                        description: r.description,
                        owner_id: r.owner_id,
                        created_at: Number(r.created_at),
                        is_private: Number(r.is_private),
                        is_official: Number(r.is_official),
                        last_message_at: Number(r.last_message_at),
                        icon_url: r.icon_url,
                        invite_code: r.invite_code,
                        id: r.id || r.lounge_id,
                        slug: r.slug || r.lounge_id,
                        creator_id: r.creator_id || String(r.owner_id),
                        parent_lounge_id: r.parent_lounge_id || null,
                        updated_at: r.updated_at ? Number(r.updated_at) : Number(r.created_at),
                        is_system: r.is_system !== undefined ? Number(r.is_system) : (Number(r.is_official) === 1 ? 1 : 0),
                        visibility: r.visibility || (Number(r.is_private) === 1 ? 'private' : 'public'),
                        status: r.status || 'active',
                        type: r.type || (Number(r.is_system || r.is_official) === 1 ? 'official' : 'user_created'),
                        owner_user_id: r.owner_user_id !== null && r.owner_user_id !== undefined ? Number(r.owner_user_id) : Number(r.owner_id),
                        hide_member_list: r.hide_member_list ? Number(r.hide_member_list) : 0,
                        is_locked: r.is_locked ? Number(r.is_locked) : 0,
                        last_active_at: r.last_active_at ? Number(r.last_active_at) : Number(r.last_message_at || r.created_at)
                    }); });
                }
                var loungeRoomsRows = loadTableRows('lounge_rooms');
                if (loungeRoomsRows) {
                    exports.db.lounge_rooms = loungeRoomsRows.map(function (r) { return ({
                        id: r.id,
                        lounge_id: r.lounge_id,
                        name: r.name,
                        is_locked: !!r.is_locked,
                        invite_code: r.invite_code,
                        created_by: r.created_by ? Number(r.created_by) : undefined,
                        created_at: Number(r.created_at)
                    }); });
                }
                var loungeMembersRows = loadTableRows('lounge_members');
                if (loungeMembersRows) {
                    exports.db.lounge_members = loungeMembersRows.map(function (r) { return ({
                        lounge_id: r.lounge_id,
                        user_id: Number(r.user_id),
                        role: r.role,
                        status: r.status,
                        joined_via: r.joined_via,
                        joined_at: Number(r.joined_at)
                    }); });
                }
                var loungeInvitesRows = loadTableRows('lounge_invites');
                if (loungeInvitesRows) {
                    exports.db.lounge_invites = loungeInvitesRows.map(function (r) { return ({
                        id: r.id,
                        lounge_id: r.lounge_id,
                        code: r.code,
                        created_by: Number(r.created_by),
                        max_uses: Number(r.max_uses),
                        uses_count: Number(r.uses_count),
                        expires_at: r.expires_at ? Number(r.expires_at) : null,
                        revoked_at: r.revoked_at ? Number(r.revoked_at) : null
                    }); });
                }
                var loungeSanctionsRows = loadTableRows('lounge_sanctions');
                if (loungeSanctionsRows) {
                    exports.db.lounge_sanctions = loungeSanctionsRows.map(function (r) { return ({
                        id: r.id,
                        lounge_id: r.lounge_id,
                        user_id: Number(r.user_id),
                        type: r.type,
                        applied_by: Number(r.applied_by),
                        applied_by_type: r.applied_by_type,
                        applied_at: Number(r.applied_at),
                        lifted_at: r.lifted_at ? Number(r.lifted_at) : null,
                        reason: r.reason
                    }); });
                }
                var loungeJoinRequestsRows = loadTableRows('lounge_join_requests');
                if (loungeJoinRequestsRows) {
                    exports.db.lounge_join_requests = loungeJoinRequestsRows.map(function (r) { return ({
                        id: r.id,
                        lounge_id: r.lounge_id,
                        user_id: Number(r.user_id),
                        message: r.message,
                        status: r.status,
                        reviewed_by: r.reviewed_by ? Number(r.reviewed_by) : null,
                        reviewed_at: r.reviewed_at ? Number(r.reviewed_at) : null
                    }); });
                }
                var loungeTransfersRows = loadTableRows('lounge_ownership_transfers');
                if (loungeTransfersRows) {
                    exports.db.lounge_ownership_transfers = loungeTransfersRows.map(function (r) { return ({
                        id: r.id,
                        lounge_id: r.lounge_id,
                        from_user_id: Number(r.from_user_id),
                        to_user_id: Number(r.to_user_id),
                        status: r.status,
                        initiated_at: Number(r.initiated_at),
                        resolved_at: r.resolved_at ? Number(r.resolved_at) : null
                    }); });
                }
                var accountDeletionsRows = loadTableRows('account_deletion_requests');
                if (accountDeletionsRows) {
                    exports.db.account_deletion_requests = accountDeletionsRows.map(function (r) { return ({
                        id: r.id,
                        user_id: Number(r.user_id),
                        requested_at: Number(r.requested_at),
                        scheduled_purge_at: Number(r.scheduled_purge_at),
                        status: r.status
                    }); });
                }
                var userPrefsRows = loadTableRows('user_lounge_preferences');
                if (userPrefsRows) {
                    exports.db.user_lounge_preferences = userPrefsRows.map(function (r) { return ({
                        user_id: Number(r.user_id),
                        lounge_id: r.lounge_id,
                        notifications_muted: Number(r.notifications_muted),
                        pinned: Number(r.pinned),
                        pin_order: r.pin_order !== null ? Number(r.pin_order) : null
                    }); });
                }
                var loungeAuditRows = loadTableRows('lounge_audit_logs');
                if (loungeAuditRows) {
                    exports.db.lounge_audit_logs = loungeAuditRows.map(function (r) { return ({
                        id: r.id,
                        lounge_id: r.lounge_id,
                        actor_id: Number(r.actor_id),
                        actor_type: r.actor_type,
                        action: r.action,
                        target_type: r.target_type,
                        target_id: r.target_id,
                        metadata: r.metadata,
                        created_at: Number(r.created_at)
                    }); });
                }
                var systemAuditRows = loadTableRows('system_audit_logs');
                if (systemAuditRows) {
                    exports.db.system_audit_logs = systemAuditRows.map(function (r) { return ({
                        id: r.id,
                        actor_id: Number(r.actor_id),
                        actor_type: r.actor_type,
                        action: r.action,
                        target_type: r.target_type,
                        target_id: r.target_id,
                        metadata: r.metadata,
                        created_at: Number(r.created_at)
                    }); });
                }
                var marketListingsRows = loadTableRows('market_listings');
                if (marketListingsRows) {
                    exports.db.market_listings = marketListingsRows.map(function (r) { return ({
                        listing_id: r.listing_id,
                        seller_id: Number(r.seller_id),
                        title: r.title,
                        description: r.description,
                        price: Number(r.price),
                        status: r.status,
                        created_at: Number(r.created_at),
                        seller_username: r.seller_username || undefined,
                        discount_price: r.discount_price !== null && r.discount_price !== undefined ? Number(r.discount_price) : undefined,
                        verification_status: r.verification_status || undefined,
                        inventory_count: r.inventory_count !== null && r.inventory_count !== undefined ? Number(r.inventory_count) : undefined
                    }); });
                }
                var escrowTransactionsRows = loadTableRows('escrow_transactions');
                if (escrowTransactionsRows) {
                    exports.db.escrow_transactions = escrowTransactionsRows.map(function (r) { return ({
                        transaction_id: r.transaction_id,
                        listing_id: r.listing_id,
                        buyer_id: Number(r.buyer_id),
                        seller_id: Number(r.seller_id),
                        amount: Number(r.amount),
                        status: r.status,
                        created_at: Number(r.created_at),
                        updated_at: Number(r.updated_at),
                        coupon_applied: r.coupon_applied || undefined,
                        sku_variant_id: r.sku_variant_id || undefined,
                        platform_fee: r.platform_fee !== null && r.platform_fee !== undefined ? Number(r.platform_fee) : undefined,
                        payout_amount: r.payout_amount !== null && r.payout_amount !== undefined ? Number(r.payout_amount) : undefined,
                        sandbox_logs: r.sandbox_logs || undefined,
                        sandbox_state: r.sandbox_state || undefined
                    }); });
                }
                // console.log('[SYS-SECURE] Local relational SQLite database successfully loaded.');
                sqliteLoaded = true;
            }
            catch (err) {
                console.error('[SYS-SECURE] Failed loading from SQLITE_FILE directly:', err.message || err);
            }
            finally {
                if (conn_1) {
                    try {
                        (_a = conn_1.close) === null || _a === void 0 ? void 0 : _a.call(conn_1);
                    }
                    catch (_) { }
                }
            }
        }
        // 2. Fallback to DB_FILE (legacy migration) if SQLITE_FILE was not found or failed to load
        if (!sqliteLoaded) {
            if (fs_1.default.existsSync(exports.DB_FILE)) {
                var fileContent = fs_1.default.readFileSync(exports.DB_FILE);
                if (fileContent.length > 15 && fileContent.toString('utf8', 0, 15) === "SQLite format 3") {
                    // console.log('[SYS-SECURE] DB_FILE has SQLite format. Performing schema load...');
                    try {
                        var conn_2 = new DatabaseSync(exports.DB_FILE);
                        var loadTable = function (tableName) {
                            var rows = conn_2.prepare("SELECT payload FROM ".concat(tableName)).all();
                            return rows.map(function (r) {
                                try {
                                    return JSON.parse((0, crypto_js_1.decryptData)(r.payload));
                                }
                                catch (decErr) {
                                    console.error("[SYS-SECURE] CRITICAL DECRYPTION FAILURE in legacy table ".concat(tableName, ":"), decErr);
                                    exports.decryptionErrorDetected = true;
                                    return null;
                                }
                            }).filter(Boolean);
                        };
                        exports.db.users = loadTable('users');
                        exports.db.profiles = loadTable('profiles');
                        exports.db.sessions = loadTable('sessions');
                        exports.db.devices = loadTable('devices');
                        exports.db.ip_addresses = loadTable('ip_addresses');
                        exports.db.messages = loadTable('messages');
                        exports.db.user_blocks = loadTable('user_blocks');
                        exports.db.user_mutes = loadTable('user_mutes') || [];
                        exports.db.admin_sanctions = loadTable('admin_sanctions');
                        exports.db.invites = loadTable('invites');
                        exports.db.tickets = loadTable('tickets');
                        exports.db.reports = loadTable('reports') || [];
                        exports.db.recovery_events = loadTable('recovery_events');
                        exports.db.suspicious_events = loadTable('suspicious_events');
                        exports.db.audit_logs = loadTable('audit_logs');
                        exports.db.peer_relationships = loadTable('peer_relationships') || [];
                        exports.db.friend_requests = loadTable('friend_requests') || [];
                        exports.db.join_requests = loadTable('join_requests') || [];
                        try {
                            (_b = conn_2.close) === null || _b === void 0 ? void 0 : _b.call(conn_2);
                        }
                        catch (_) { }
                        // console.log('[SYS-SECURE] Successfully extracted tables. Converting to clean SQLite system database.');
                        sqliteLoaded = true;
                        executeSaveDb();
                    }
                    catch (err) {
                        console.error('[SYS-SECURE] Extraction failed from DB_FILE SQLite format:', err);
                    }
                }
                else {
                    // It's raw JSON
                    try {
                        var decryptedData = (0, crypto_js_1.decryptData)(fileContent.toString('utf8').trim());
                        if (!decryptedData) {
                            throw new Error('Decrypted content is empty.');
                        }
                        exports.db = JSON.parse(decryptedData);
                        // console.log('[SYS-SECURE] Migrating local encrypted State Engine JSON to relational SQLite database.');
                        sqliteLoaded = true;
                        executeSaveDb(); // This will save directly to SQLite SQLITE_FILE
                    }
                    catch (err) {
                        console.warn('[SYS-SECURE] Local state DB file cannot be decrypted or parsed. Initiating clean state recovery:', err.message || err);
                        try {
                            var backupPath = "".concat(exports.DB_FILE, ".corrupt_").concat(Date.now());
                            fs_1.default.renameSync(exports.DB_FILE, backupPath);
                            // console.log(`[SYS-SECURE] Corrupt DB_FILE renamed to ${backupPath}`);
                        }
                        catch (_) { }
                    }
                }
            }
        }
        if (!sqliteLoaded) {
            // console.log('[SYS-SECURE] Relational databases absent. Generating default seeds...');
            exports.db = __assign({}, schema_js_1.defaultDb);
            executeSaveDb();
        }
        ensureSeededIntegrity();
        setupAuditLogProxy();
        // Clear any conversational messages users had with Velum system bot
        if (exports.db.messages) {
            var originalCount = exports.db.messages.length;
            exports.db.messages = exports.db.messages.filter(function (m) {
                var isVelumDm = m.room_id && m.room_id.startsWith('dm_velum_');
                if (!isVelumDm)
                    return true;
                var isWelcome = m.message_id && m.message_id.startsWith('msg_velum_welcome_');
                var isSaPromo = m.message_id && m.message_id.startsWith('msg_sa_promo_');
                return isWelcome || isSaPromo;
            });
            if (exports.db.messages.length !== originalCount) {
                console.log("[CLEANUP] Pruned ".concat(originalCount - exports.db.messages.length, " conversational messages from Velum bot DMs."));
                executeSaveDb();
            }
        }
        // Migration: Update existing users who have generic welcome messages to have generated recovery keys
        if (exports.db.users && exports.db.messages) {
            var hashArgon2idLocal_1 = function (plainText, saltBuffer) { return __awaiter(_this, void 0, void 0, function () {
                var hashArgon2id;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../crypto.js'); })];
                        case 1:
                            hashArgon2id = (_a.sent()).hashArgon2id;
                            return [2 /*return*/, hashArgon2id(plainText, saltBuffer)];
                    }
                });
            }); };
            Promise.all(exports.db.users.map(function (u) { return __awaiter(_this, void 0, void 0, function () {
                var roomId, welcomeMsg, hasShortKey, chars, code, i, rawKey, keySalt, hashHex, formattedMsg, newWelcomeMsg;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (u.user_id === 999 || u.role === 'CLI_ADMIN')
                                return [2 /*return*/, null];
                            roomId = "dm_velum_".concat(u.user_id);
                            welcomeMsg = exports.db.messages.find(function (m) { return m.room_id === roomId && m.user_id === 999 && m.message_id && m.message_id.startsWith("msg_velum_welcome_".concat(u.user_id)); });
                            if (!welcomeMsg) {
                                welcomeMsg = exports.db.messages.find(function (m) { return m.room_id === roomId && m.user_id === 999 && m.content && (m.content.includes('recovery key') || m.content.includes('Recovery Key')); });
                            }
                            hasShortKey = welcomeMsg && welcomeMsg.content && welcomeMsg.content.includes('Your recovery key is: VEL-REC-');
                            if (!(!welcomeMsg || !hasShortKey)) return [3 /*break*/, 2];
                            chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
                            code = '';
                            for (i = 0; i < 4; i++) {
                                code += chars.charAt(Math.floor(Math.random() * chars.length));
                            }
                            rawKey = "VEL-REC-".concat(code);
                            keySalt = crypto_1.default.randomBytes(32);
                            return [4 /*yield*/, hashArgon2idLocal_1(rawKey, keySalt)];
                        case 1:
                            hashHex = _a.sent();
                            u.recovery_key_hash = "argon2id:".concat(keySalt.toString('hex'), ":").concat(hashHex);
                            formattedMsg = "Welcome to Velum.\n\nYour recovery key is: ".concat(rawKey, "\n\nPlease store this key in a secure offline location. It is required to recover your account if you forget your password.");
                            if (welcomeMsg) {
                                welcomeMsg.content = formattedMsg;
                            }
                            else {
                                newWelcomeMsg = {
                                    message_id: "msg_velum_welcome_".concat(u.user_id, "_").concat(Date.now()),
                                    room_id: roomId,
                                    user_id: 999,
                                    content: formattedMsg,
                                    is_encrypted: false,
                                    reply_to: null,
                                    timestamp: new Date().toISOString(),
                                    expires_in: null,
                                    status: 'sent',
                                    type: 'text'
                                };
                                exports.db.messages.push(newWelcomeMsg);
                            }
                            return [2 /*return*/, { username: u.username, rawKey: rawKey }];
                        case 2: return [2 /*return*/, null];
                    }
                });
            }); })).then(function (results) {
                var migrated = results.filter(Boolean);
                if (migrated.length > 0) {
                    console.log("[MIGRATION] Regenerated recovery keys for ".concat(migrated.length, " existing users:"), migrated.map(function (m) { return m === null || m === void 0 ? void 0 : m.username; }));
                    executeSaveDb();
                }
            }).catch(function (err) {
                console.error('[MIGRATION] Error migrating recovery keys:', err);
            });
        }
        exports.dbLoaded = true;
        exports.lastSavedDbJson = JSON.stringify(exports.db);
        try {
            (0, db_js_1.rebuildBlocksCache)();
        }
        catch (_) { }
    }
    catch (error) {
        console.error('[SYS-SECURE] Failed loading state database. Falling back to fresh seed:', error);
        exports.db = __assign({}, schema_js_1.defaultDb);
        ensureSeededIntegrity();
        setupAuditLogProxy();
        try {
            executeSaveDb();
        }
        catch (_) { }
        exports.dbLoaded = true;
        exports.lastSavedDbJson = JSON.stringify(exports.db);
        try {
            (0, db_js_1.rebuildBlocksCache)();
        }
        catch (_) { }
    }
}
function saveDb(force) {
    if (force === void 0) { force = false; }
    if (force) {
        if (saveTimeout) {
            clearTimeout(saveTimeout);
            saveTimeout = null;
        }
        executeSaveDb();
    }
    else {
        if (saveTimeout)
            return;
        saveTimeout = setTimeout(function () {
            saveTimeout = null;
            executeSaveDb();
        }, 1000);
    }
}
function executeSaveDb() {
    var _a;
    if (exports.isSaving)
        return;
    if (exports.decryptionErrorDetected) {
        console.error('[SYS-SECURE] CRITICAL: Database write aborted. Decryption errors were detected during load, saving would cause data purge.');
        return;
    }
    var plainJson = JSON.stringify(exports.db);
    if (plainJson === exports.lastSavedDbJson && !crypto_js_1.legacyDecryptionSucceeded) {
        return;
    }
    exports.isSaving = true;
    try {
        var conn_3 = initSqlite();
        if (conn_3) {
            conn_3.exec('BEGIN');
            var saveTable = function (tableName, rows, idField) {
                try {
                    conn_3.exec("DELETE FROM ".concat(tableName));
                    var stmt = conn_3.prepare("INSERT OR REPLACE INTO ".concat(tableName, " (id, payload) VALUES (?, ?)"));
                    for (var _i = 0, _a = rows || []; _i < _a.length; _i++) {
                        var row = _a[_i];
                        var rawId = row[idField];
                        var id = (rawId !== undefined && rawId !== null && rawId !== '') ? String(rawId) : (0, ulid_js_1.generateUlid)();
                        if (row[idField] === undefined || row[idField] === null || row[idField] === '') {
                            row[idField] = id;
                        }
                        var encryptedPayload = (0, crypto_js_1.encryptData)(JSON.stringify(row));
                        stmt.run(id, encryptedPayload);
                    }
                }
                catch (err) {
                    console.error("[SYS-SECURE] Save Table ".concat(tableName, " SQLite failed:"), err);
                }
            };
            saveTable('users', exports.db.users, 'user_id');
            saveTable('profiles', exports.db.profiles, 'profile_id');
            saveTable('sessions', exports.db.sessions, 'session_id');
            saveTable('devices', exports.db.devices, 'device_id');
            saveTable('ip_addresses', exports.db.ip_addresses, 'ip_id');
            saveTable('messages', exports.db.messages, 'message_id');
            saveTable('user_blocks', exports.db.user_blocks, 'block_id');
            saveTable('user_mutes', exports.db.user_mutes || [], 'mute_id');
            saveTable('admin_sanctions', exports.db.admin_sanctions, 'sanction_id');
            saveTable('invites', exports.db.invites, 'invite_id');
            saveTable('tickets', exports.db.tickets, 'ticket_id');
            saveTable('reports', exports.db.reports || [], 'report_id');
            saveTable('recovery_events', exports.db.recovery_events, 'event_id');
            saveTable('suspicious_events', exports.db.suspicious_events, 'event_id');
            saveTable('audit_logs', exports.db.audit_logs, 'log_id');
            saveTable('friend_requests', exports.db.friend_requests || [], 'request_id');
            saveTable('peer_relationships', exports.db.peer_relationships || [], 'id');
            saveTable('join_requests', exports.db.join_requests || [], 'id');
            saveTable('node_overwrites', exports.db.node_overwrites || [], 'overwrite_id');
            // Save Banking Tables
            saveTable('user_wallets', exports.db.user_wallets || [], 'user_id');
            saveTable('wallet_ledger_entries', exports.db.wallet_ledger_entries || [], 'entry_id');
            saveTable('recharge_requests', exports.db.recharge_requests || [], 'request_id');
            saveTable('withdrawal_requests', exports.db.withdrawal_requests || [], 'request_id');
            saveTable('kyc_verifications', exports.db.kyc_verifications || [], 'kyc_id');
            saveTable('payment_methods', exports.db.payment_methods || [], 'payment_method_id');
            saveTable('external_financial_accounts', exports.db.external_financial_accounts || [], 'account_token');
            saveTable('external_processor_events', exports.db.external_processor_events || [], 'event_id');
            saveTable('wallet_balances', exports.db.wallet_balances || [], 'balance_id');
            saveTable('currencies', exports.db.currencies || [], 'currency_code');
            saveTable('exchange_rates', exports.db.exchange_rates || [], 'rate_id');
            saveTable('platform_admins', exports.db.platform_admins || [], 'admin_id');
            // Save Marketplace Tables
            saveTable('market_assets', exports.db.market_assets || [], 'listing_id');
            saveTable('market_sku_variants', exports.db.market_sku_variants || [], 'sku_id');
            saveTable('market_asset_media', exports.db.market_asset_media || [], 'media_id');
            saveTable('market_reviews', exports.db.market_reviews || [], 'review_id');
            saveTable('market_coupons', exports.db.market_coupons || [], 'coupon_id');
            saveTable('market_discussions', exports.db.market_discussions || [], 'discussion_id');
            saveTable('market_support_chats', exports.db.market_support_chats || [], 'chat_id');
            saveTable('listing_verification_checks', exports.db.listing_verification_checks || [], 'check_id');
            // Save Missing Tables
            saveTable('platform_financial_audit_logs', exports.db.platform_financial_audit_logs || [], 'log_id');
            saveTable('automation_actions', exports.db.automation_actions || [], 'action_id');
            saveTable('refund_requests', exports.db.refund_requests || [], 'request_id');
            var saveLoungesDb = function () {
                try {
                    conn_3.exec("DELETE FROM lounges");
                    var stmt = conn_3.prepare("INSERT OR REPLACE INTO lounges (lounge_id, name, description, owner_id, created_at, is_private, is_official, last_message_at, icon_url, invite_code, id, slug, creator_id, parent_lounge_id, updated_at, is_system, visibility, status, type, owner_user_id, hide_member_list, is_locked, last_active_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
                    for (var _i = 0, _a = exports.db.lounges || []; _i < _a.length; _i++) {
                        var c = _a[_i];
                        var idVal = c.id || c.lounge_id;
                        var slugVal = c.slug || c.lounge_id;
                        var creatorIdVal = c.creator_id || String(c.owner_id);
                        var parentLoungeIdVal = c.parent_lounge_id || null;
                        var updatedAtVal = c.updated_at || Number(c.created_at || Date.now());
                        var isSystemVal = c.is_system !== undefined ? Number(c.is_system) : (Number(c.is_official) === 1 ? 1 : 0);
                        var visibilityVal = c.visibility || (Number(c.is_private) === 1 ? 'private' : 'public');
                        var statusVal = c.status || 'active';
                        var typeVal = c.type || (Number(c.is_system || c.is_official) === 1 ? 'official' : 'user_created');
                        var ownerUserIdVal = c.owner_user_id ? Number(c.owner_user_id) : Number(c.owner_id);
                        var hideMemberListVal = c.hide_member_list ? 1 : 0;
                        var isLockedVal = c.is_locked ? 1 : 0;
                        var lastActiveAtVal = c.last_active_at ? Number(c.last_active_at) : Number(c.last_message_at || c.created_at);
                        stmt.run(c.lounge_id, c.name, c.description || '', String(c.owner_id), Number(c.created_at || Date.now()), Number(c.is_private || 0), Number(c.is_official || 0), Number(c.last_message_at || 0), c.icon_url || null, c.invite_code || null, idVal, slugVal, creatorIdVal, parentLoungeIdVal, updatedAtVal, isSystemVal, visibilityVal, statusVal, typeVal, ownerUserIdVal, hideMemberListVal, isLockedVal, lastActiveAtVal);
                    }
                }
                catch (err) {
                    console.error('[SYS-SECURE] Save lounges SQLite failed:', err);
                }
            };
            var saveLoungeRoomsDb = function () {
                try {
                    conn_3.exec("DELETE FROM lounge_rooms");
                    var stmt = conn_3.prepare("INSERT OR REPLACE INTO lounge_rooms (id, lounge_id, name, is_locked, invite_code, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)");
                    for (var _i = 0, _a = exports.db.lounge_rooms || []; _i < _a.length; _i++) {
                        var lr = _a[_i];
                        stmt.run(lr.id, lr.lounge_id, lr.name, Number(lr.is_locked || 0), lr.invite_code || null, String(lr.created_by), Number(lr.created_at || Date.now()));
                    }
                }
                catch (err) {
                    console.error('[SYS-SECURE] Save lounge_rooms SQLite failed:', err);
                }
            };
            var saveMarketListingsDb = function () {
                try {
                    conn_3.exec("DELETE FROM market_listings");
                    var stmt = conn_3.prepare("INSERT OR REPLACE INTO market_listings (listing_id, seller_id, title, description, price, status, created_at, seller_username, discount_price, verification_status, inventory_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
                    for (var _i = 0, _a = exports.db.market_listings || []; _i < _a.length; _i++) {
                        var l = _a[_i];
                        stmt.run(l.listing_id, String(l.seller_id), l.title, l.description || '', Number(l.price || 0), l.status || 'ACTIVE', Number(l.created_at || Date.now()), l.seller_username || null, l.discount_price !== undefined && l.discount_price !== null ? Number(l.discount_price) : null, l.verification_status || null, l.inventory_count !== undefined && l.inventory_count !== null ? Number(l.inventory_count) : null);
                    }
                }
                catch (err) {
                    console.error('[SYS-SECURE] Save market_listings SQLite failed:', err);
                }
            };
            var saveEscrowTransactionsDb = function () {
                try {
                    conn_3.exec("DELETE FROM escrow_transactions");
                    var stmt = conn_3.prepare("INSERT OR REPLACE INTO escrow_transactions (transaction_id, listing_id, buyer_id, seller_id, amount, status, created_at, updated_at, coupon_applied, sku_variant_id, platform_fee, payout_amount, sandbox_logs, sandbox_state) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
                    for (var _i = 0, _a = exports.db.escrow_transactions || []; _i < _a.length; _i++) {
                        var t = _a[_i];
                        stmt.run(t.transaction_id, t.listing_id, String(t.buyer_id), String(t.seller_id), Number(t.amount || 0), t.status, Number(t.created_at || Date.now()), Number(t.updated_at || Date.now()), t.coupon_applied || null, t.sku_variant_id || null, t.platform_fee !== undefined && t.platform_fee !== null ? Number(t.platform_fee) : null, t.payout_amount !== undefined && t.payout_amount !== null ? Number(t.payout_amount) : null, t.sandbox_logs ? JSON.stringify(t.sandbox_logs) : null, t.sandbox_state ? JSON.stringify(t.sandbox_state) : null);
                    }
                }
                catch (err) {
                    console.error('[SYS-SECURE] Save escrow_transactions SQLite failed:', err);
                }
            };
            var saveLoungeMembersDb = function () {
                try {
                    conn_3.exec("DELETE FROM lounge_members");
                    var stmt = conn_3.prepare("INSERT OR REPLACE INTO lounge_members (lounge_id, user_id, role, status, joined_via, joined_at) VALUES (?, ?, ?, ?, ?, ?)");
                    for (var _i = 0, _a = exports.db.lounge_members || []; _i < _a.length; _i++) {
                        var m = _a[_i];
                        stmt.run(m.lounge_id, Number(m.user_id), m.role, m.status, m.joined_via, Number(m.joined_at));
                    }
                }
                catch (err) {
                    console.error('[SYS-SECURE] Save lounge_members SQLite failed:', err);
                }
            };
            var saveLoungeInvitesDb = function () {
                try {
                    conn_3.exec("DELETE FROM lounge_invites");
                    var stmt = conn_3.prepare("INSERT OR REPLACE INTO lounge_invites (id, lounge_id, code, created_by, max_uses, uses_count, expires_at, revoked_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
                    for (var _i = 0, _a = exports.db.lounge_invites || []; _i < _a.length; _i++) {
                        var i = _a[_i];
                        stmt.run(i.id, i.lounge_id, i.code, Number(i.created_by), Number(i.max_uses), Number(i.uses_count), i.expires_at, i.revoked_at);
                    }
                }
                catch (err) {
                    console.error('[SYS-SECURE] Save lounge_invites SQLite failed:', err);
                }
            };
            var saveLoungeSanctionsDb = function () {
                try {
                    conn_3.exec("DELETE FROM lounge_sanctions");
                    var stmt = conn_3.prepare("INSERT OR REPLACE INTO lounge_sanctions (id, lounge_id, user_id, type, applied_by, applied_by_type, applied_at, lifted_at, reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
                    for (var _i = 0, _a = exports.db.lounge_sanctions || []; _i < _a.length; _i++) {
                        var s = _a[_i];
                        stmt.run(s.id, s.lounge_id, Number(s.user_id), s.type, Number(s.applied_by), s.applied_by_type, Number(s.applied_at), s.lifted_at, s.reason);
                    }
                }
                catch (err) {
                    console.error('[SYS-SECURE] Save lounge_sanctions SQLite failed:', err);
                }
            };
            var saveLoungeJoinRequestsDb = function () {
                try {
                    conn_3.exec("DELETE FROM lounge_join_requests");
                    var stmt = conn_3.prepare("INSERT OR REPLACE INTO lounge_join_requests (id, lounge_id, user_id, message, status, reviewed_by, reviewed_at) VALUES (?, ?, ?, ?, ?, ?, ?)");
                    for (var _i = 0, _a = exports.db.lounge_join_requests || []; _i < _a.length; _i++) {
                        var r = _a[_i];
                        stmt.run(r.id, r.lounge_id, Number(r.user_id), r.message || '', r.status, r.reviewed_by, r.reviewed_at);
                    }
                }
                catch (err) {
                    console.error('[SYS-SECURE] Save lounge_join_requests SQLite failed:', err);
                }
            };
            var saveLoungeOwnershipTransfersDb = function () {
                try {
                    conn_3.exec("DELETE FROM lounge_ownership_transfers");
                    var stmt = conn_3.prepare("INSERT OR REPLACE INTO lounge_ownership_transfers (id, lounge_id, from_user_id, to_user_id, status, initiated_at, resolved_at) VALUES (?, ?, ?, ?, ?, ?, ?)");
                    for (var _i = 0, _a = exports.db.lounge_ownership_transfers || []; _i < _a.length; _i++) {
                        var t = _a[_i];
                        stmt.run(t.id, t.lounge_id, Number(t.from_user_id), Number(t.to_user_id), t.status, Number(t.initiated_at), t.resolved_at);
                    }
                }
                catch (err) {
                    console.error('[SYS-SECURE] Save lounge_ownership_transfers SQLite failed:', err);
                }
            };
            var saveAccountDeletionRequestsDb = function () {
                try {
                    conn_3.exec("DELETE FROM account_deletion_requests");
                    var stmt = conn_3.prepare("INSERT OR REPLACE INTO account_deletion_requests (id, user_id, requested_at, scheduled_purge_at, status) VALUES (?, ?, ?, ?, ?)");
                    for (var _i = 0, _a = exports.db.account_deletion_requests || []; _i < _a.length; _i++) {
                        var d = _a[_i];
                        stmt.run(d.id, Number(d.user_id), Number(d.requested_at), Number(d.scheduled_purge_at), d.status);
                    }
                }
                catch (err) {
                    console.error('[SYS-SECURE] Save account_deletion_requests SQLite failed:', err);
                }
            };
            var saveUserLoungePreferencesDb = function () {
                try {
                    conn_3.exec("DELETE FROM user_lounge_preferences");
                    var stmt = conn_3.prepare("INSERT OR REPLACE INTO user_lounge_preferences (user_id, lounge_id, notifications_muted, pinned, pin_order) VALUES (?, ?, ?, ?, ?)");
                    for (var _i = 0, _a = exports.db.user_lounge_preferences || []; _i < _a.length; _i++) {
                        var p = _a[_i];
                        stmt.run(Number(p.user_id), p.lounge_id, p.notifications_muted ? 1 : 0, p.pinned ? 1 : 0, p.pin_order);
                    }
                }
                catch (err) {
                    console.error('[SYS-SECURE] Save user_lounge_preferences SQLite failed:', err);
                }
            };
            var saveLoungeAuditLogsDb = function () {
                try {
                    conn_3.exec("DELETE FROM lounge_audit_logs");
                    var stmt = conn_3.prepare("INSERT OR REPLACE INTO lounge_audit_logs (id, lounge_id, actor_id, actor_type, action, target_type, target_id, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
                    for (var _i = 0, _a = exports.db.lounge_audit_logs || []; _i < _a.length; _i++) {
                        var l = _a[_i];
                        stmt.run(l.id, l.lounge_id, Number(l.actor_id), l.actor_type, l.action, l.target_type, l.target_id, typeof l.metadata === 'string' ? l.metadata : JSON.stringify(l.metadata), Number(l.created_at));
                    }
                }
                catch (err) {
                    console.error('[SYS-SECURE] Save lounge_audit_logs SQLite failed:', err);
                }
            };
            var saveSystemAuditLogsDb = function () {
                try {
                    conn_3.exec("DELETE FROM system_audit_logs");
                    var stmt = conn_3.prepare("INSERT OR REPLACE INTO system_audit_logs (id, actor_id, actor_type, action, target_type, target_id, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
                    for (var _i = 0, _a = exports.db.system_audit_logs || []; _i < _a.length; _i++) {
                        var l = _a[_i];
                        stmt.run(l.id, Number(l.actor_id), l.actor_type, l.action, l.target_type, l.target_id, typeof l.metadata === 'string' ? l.metadata : JSON.stringify(l.metadata), Number(l.created_at));
                    }
                }
                catch (err) {
                    console.error('[SYS-SECURE] Save system_audit_logs SQLite failed:', err);
                }
            };
            saveLoungesDb();
            saveLoungeRoomsDb();
            saveLoungeMembersDb();
            saveLoungeInvitesDb();
            saveLoungeSanctionsDb();
            saveLoungeJoinRequestsDb();
            saveLoungeOwnershipTransfersDb();
            saveAccountDeletionRequestsDb();
            saveUserLoungePreferencesDb();
            saveLoungeAuditLogsDb();
            saveSystemAuditLogsDb();
            saveMarketListingsDb();
            saveEscrowTransactionsDb();
            conn_3.exec('COMMIT');
            try {
                (_a = conn_3.close) === null || _a === void 0 ? void 0 : _a.call(conn_3);
            }
            catch (_) { }
            var plainJson_1 = JSON.stringify(exports.db);
            var encryptedData = (0, crypto_js_1.encryptData)(plainJson_1);
            fs_1.default.writeFileSync(exports.DB_FILE, encryptedData, 'utf8');
        }
        else {
            var plainJson_2 = JSON.stringify(exports.db);
            var encryptedData = (0, crypto_js_1.encryptData)(plainJson_2);
            fs_1.default.writeFileSync(exports.DB_FILE, encryptedData, 'utf8');
        }
        exports.lastSavedDbJson = plainJson;
        (0, db_js_1.rebuildBlocksCache)();
        (0, crypto_js_1.setLegacyDecryptionSucceeded)(false);
        exports.isSaving = false;
        (0, sync_js_1.backupDbToCloud)().catch(function (err) {
            console.error('[SYS-SECURE] Failed background syncing database state to Neon PostgreSQL:', err);
        });
    }
    catch (err) {
        exports.isSaving = false;
        console.error('[SYS-SECURE] Critical SQLite save fail:', err);
    }
}
function setupAuditLogProxy() { }
function setDecryptionErrorDetected(val) {
    exports.decryptionErrorDetected = val;
}
function setIsSaving(val) {
    exports.isSaving = val;
}
// Ensure any pending throttled saves are flushed to disk before the container exits
process.on('SIGTERM', function () {
    if (saveTimeout) {
        clearTimeout(saveTimeout);
        saveTimeout = null;
        executeSaveDb();
    }
});
// Auto-initialize the database on startup
loadDb();
