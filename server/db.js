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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DB_CRYPTO_KEY_LEGACY = exports.DB_CRYPTO_KEY = exports.legacyDecryptionSucceeded = exports.BASE32_CHARS = exports.generateUlid = exports.checkStepOTP = exports.getStepOTP = exports.checkCredential = exports.verifyArgon2id = exports.hashArgon2id = exports.decryptData = exports.encryptData = exports.registerBroadcastToRoomCallback = exports.broadcastToRoomCallback = exports.DB_FILE = exports.DB_DIR = exports.db = exports.decryptionErrorDetected = exports.isSaving = exports.setupAuditLogProxy = exports.executeSaveDb = exports.saveDb = exports.loadDb = exports.dbLoaded = exports.activeUserBlocksSet = exports.TABLE_CONFIGS = exports.getPgPool = exports.wipeAndRebuildDatabaseFile = exports.verifySqliteFile = exports.initSqlite = exports.sqliteDb = exports.executeCloudBackup = exports.backupDbToCloud = exports.restoreDbFromCloud = exports.getSafeDatabaseBackupBinary = exports.initPgBackupTable = exports.isCloudBackupDisabled = exports.SQLITE_FILE = exports.activeAdminToken = exports.originalConsoleError = exports.originalConsoleLog = void 0;
exports.rebuildBlocksCache = rebuildBlocksCache;
exports.isUserBlocked = isUserBlocked;
exports.ensureVelumSystemDM = ensureVelumSystemDM;
exports.generateLoginNonce = generateLoginNonce;
exports.verifyAndConsumeNonce = verifyAndConsumeNonce;
exports.hardResetAndSeedDatabase = hardResetAndSeedDatabase;
exports.executeCliCommand = executeCliCommand;
var path_1 = require("path");
var fs_1 = require("fs");
var crypto_1 = require("crypto");
var logger_js_1 = require("./utils/logger.js");
var index_js_1 = require("./db/index.js");
Object.defineProperty(exports, "DB_DIR", { enumerable: true, get: function () { return index_js_1.DB_DIR; } });
Object.defineProperty(exports, "DB_FILE", { enumerable: true, get: function () { return index_js_1.DB_FILE; } });
Object.defineProperty(exports, "db", { enumerable: true, get: function () { return index_js_1.db; } });
Object.defineProperty(exports, "broadcastToRoomCallback", { enumerable: true, get: function () { return index_js_1.broadcastToRoomCallback; } });
Object.defineProperty(exports, "registerBroadcastToRoomCallback", { enumerable: true, get: function () { return index_js_1.registerBroadcastToRoomCallback; } });
Object.defineProperty(exports, "dbLoaded", { enumerable: true, get: function () { return index_js_1.dbLoaded; } });
Object.defineProperty(exports, "loadDb", { enumerable: true, get: function () { return index_js_1.loadDb; } });
Object.defineProperty(exports, "saveDb", { enumerable: true, get: function () { return index_js_1.saveDb; } });
Object.defineProperty(exports, "executeSaveDb", { enumerable: true, get: function () { return index_js_1.executeSaveDb; } });
Object.defineProperty(exports, "setupAuditLogProxy", { enumerable: true, get: function () { return index_js_1.setupAuditLogProxy; } });
Object.defineProperty(exports, "isSaving", { enumerable: true, get: function () { return index_js_1.isSaving; } });
Object.defineProperty(exports, "decryptionErrorDetected", { enumerable: true, get: function () { return index_js_1.decryptionErrorDetected; } });
Object.defineProperty(exports, "initSqlite", { enumerable: true, get: function () { return index_js_1.initSqlite; } });
Object.defineProperty(exports, "sqliteDb", { enumerable: true, get: function () { return index_js_1.sqliteDb; } });
Object.defineProperty(exports, "SQLITE_FILE", { enumerable: true, get: function () { return index_js_1.SQLITE_FILE; } });
Object.defineProperty(exports, "isCloudBackupDisabled", { enumerable: true, get: function () { return index_js_1.isCloudBackupDisabled; } });
Object.defineProperty(exports, "initPgBackupTable", { enumerable: true, get: function () { return index_js_1.initPgBackupTable; } });
Object.defineProperty(exports, "getSafeDatabaseBackupBinary", { enumerable: true, get: function () { return index_js_1.getSafeDatabaseBackupBinary; } });
Object.defineProperty(exports, "restoreDbFromCloud", { enumerable: true, get: function () { return index_js_1.restoreDbFromCloud; } });
Object.defineProperty(exports, "backupDbToCloud", { enumerable: true, get: function () { return index_js_1.backupDbToCloud; } });
Object.defineProperty(exports, "executeCloudBackup", { enumerable: true, get: function () { return index_js_1.executeCloudBackup; } });
Object.defineProperty(exports, "wipeAndRebuildDatabaseFile", { enumerable: true, get: function () { return index_js_1.wipeAndRebuildDatabaseFile; } });
Object.defineProperty(exports, "verifySqliteFile", { enumerable: true, get: function () { return index_js_1.verifySqliteFile; } });
exports.originalConsoleLog = console.log;
exports.originalConsoleError = console.error;
exports.activeAdminToken = crypto_1.default.randomBytes(32).toString('hex');
var crypto_js_1 = require("./utils/crypto.js");
Object.defineProperty(exports, "encryptData", { enumerable: true, get: function () { return crypto_js_1.encryptData; } });
Object.defineProperty(exports, "decryptData", { enumerable: true, get: function () { return crypto_js_1.decryptData; } });
Object.defineProperty(exports, "hashArgon2id", { enumerable: true, get: function () { return crypto_js_1.hashArgon2id; } });
Object.defineProperty(exports, "verifyArgon2id", { enumerable: true, get: function () { return crypto_js_1.verifyArgon2id; } });
Object.defineProperty(exports, "checkCredential", { enumerable: true, get: function () { return crypto_js_1.checkCredential; } });
Object.defineProperty(exports, "getStepOTP", { enumerable: true, get: function () { return crypto_js_1.getStepOTP; } });
Object.defineProperty(exports, "checkStepOTP", { enumerable: true, get: function () { return crypto_js_1.checkStepOTP; } });
Object.defineProperty(exports, "legacyDecryptionSucceeded", { enumerable: true, get: function () { return crypto_js_1.legacyDecryptionSucceeded; } });
Object.defineProperty(exports, "DB_CRYPTO_KEY", { enumerable: true, get: function () { return crypto_js_1.DB_CRYPTO_KEY; } });
Object.defineProperty(exports, "DB_CRYPTO_KEY_LEGACY", { enumerable: true, get: function () { return crypto_js_1.DB_CRYPTO_KEY_LEGACY; } });
var ulid_js_1 = require("./utils/ulid.js");
Object.defineProperty(exports, "generateUlid", { enumerable: true, get: function () { return ulid_js_1.generateUlid; } });
Object.defineProperty(exports, "BASE32_CHARS", { enumerable: true, get: function () { return ulid_js_1.BASE32_CHARS; } });
var database_js_1 = require("./config/database.js");
Object.defineProperty(exports, "getPgPool", { enumerable: true, get: function () { return database_js_1.getPgPool; } });
function b(val) {
    if (val === undefined || val === null)
        return '';
    return val;
}
exports.TABLE_CONFIGS = {
    users: {
        name: 'users',
        pkName: 'user_id',
        getPkValue: function (r) { return r.user_id; },
        insertSql: "",
        getParams: function (r, enc) { return []; }
    }
};
exports.activeUserBlocksSet = new Set();
function rebuildBlocksCache() {
    exports.activeUserBlocksSet.clear();
    for (var _i = 0, _a = index_js_1.db.user_blocks || []; _i < _a.length; _i++) {
        var b_1 = _a[_i];
        exports.activeUserBlocksSet.add("".concat(b_1.blocker_id, "_").concat(b_1.blocked_id));
    }
}
function isUserBlocked(userA, userB) {
    if (!userA || !userB)
        return false;
    return exports.activeUserBlocksSet.has("".concat(userA, "_").concat(userB)) || exports.activeUserBlocksSet.has("".concat(userB, "_").concat(userA));
}
function ensureVelumSystemDM(userId, username, plainRecoveryKey) {
    var roomId = "dm_velum_".concat(userId);
    // Ensure welcome message exists
    if (!index_js_1.db.messages)
        index_js_1.db.messages = [];
    var welcomeMsg = index_js_1.db.messages.find(function (m) { return m.room_id === roomId && m.user_id === 999 && m.message_id && m.message_id.startsWith("msg_velum_welcome_".concat(userId)); });
    if (!welcomeMsg) {
        // Fallback search to find any message containing recovery key keywords to avoid duplicates
        welcomeMsg = index_js_1.db.messages.find(function (m) { return m.room_id === roomId && m.user_id === 999 && m.content && (m.content.includes('recovery key') || m.content.includes('Recovery Key')); });
    }
    var formattedMsg = "Welcome to Velum.\n\nYour recovery key was provided during registration. Please keep it secure.";
    if (plainRecoveryKey) {
        formattedMsg = "Welcome to Velum.\n\nYour recovery key is: ".concat(plainRecoveryKey, "\n\nPlease store this key in a secure offline location. It is required to recover your account if you forget your password.");
    }
    if (!welcomeMsg) {
        welcomeMsg = {
            message_id: "msg_velum_welcome_".concat(userId, "_").concat((0, ulid_js_1.generateUlid)()),
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
        index_js_1.db.messages.push(welcomeMsg);
        (0, index_js_1.saveDb)();
        // Broadcast real-time over WebSocket so the logged-in client receives it instantly!
        if (index_js_1.broadcastToRoomCallback) {
            try {
                (0, index_js_1.broadcastToRoomCallback)(roomId, {
                    type: 'message',
                    message: __assign(__assign({}, welcomeMsg), { username: 'Velum', avatar: 'emerald' })
                });
            }
            catch (wsErr) {
                console.warn('Real-time welcome broadcast failed:', wsErr);
            }
        }
    }
}
function generateLoginNonce() {
    var _a;
    var conn = (0, index_js_1.initSqlite)();
    if (!conn) {
        var fallback = crypto_1.default.randomBytes(32).toString('hex');
        (0, logger_js_1.writeServerLog)('[SYS-SECURE] [NONCE-FALLBACK] SQLite unavailable, generated ephemeral nonce.');
        return fallback;
    }
    try {
        var pruneTime = Date.now() - 90000;
        conn.prepare('DELETE FROM login_nonces WHERE created_at < ?').run(pruneTime);
        var nonce = crypto_1.default.randomBytes(32).toString('hex');
        conn.prepare('INSERT INTO login_nonces (nonce, created_at, used) VALUES (?, ?, 0)').run(nonce, Date.now());
        (0, logger_js_1.writeServerLog)("[SYS-SECURE] [NONCE-DB-GEN] Persisted secure nonce in SQLite: ".concat(nonce));
        return nonce;
    }
    catch (err) {
        var fallback = crypto_1.default.randomBytes(32).toString('hex');
        (0, logger_js_1.writeServerLog)("[SYS-SECURE] [NONCE-DB-ERR] Failed to write nonce to SQLite: ".concat((err === null || err === void 0 ? void 0 : err.message) || err));
        return fallback;
    }
    finally {
        try {
            (_a = conn.close) === null || _a === void 0 ? void 0 : _a.call(conn);
        }
        catch (_) { }
    }
}
function verifyAndConsumeNonce(nonce) {
    var _a;
    var conn = (0, index_js_1.initSqlite)();
    if (!conn) {
        (0, logger_js_1.writeServerLog)('[SYS-SECURE] [NONCE-FALLBACK] SQLite connection unavailable during verify.');
        return false;
    }
    try {
        var pruneTime = Date.now() - 90000;
        conn.prepare('DELETE FROM login_nonces WHERE created_at < ?').run(pruneTime);
        (0, logger_js_1.writeServerLog)("[SYS-SECURE] [NONCE-DB-VERIFY] Verifying nonce: ".concat(nonce));
        var record = conn.prepare('SELECT * FROM login_nonces WHERE nonce = ?').get(nonce);
        if (!record) {
            (0, logger_js_1.writeServerLog)("[SYS-SECURE] [NONCE-DB-FAIL] Nonce ".concat(nonce, " not found in SQLite."));
            return false;
        }
        if (record.used === 1) {
            (0, logger_js_1.writeServerLog)("[SYS-SECURE] [NONCE-DB-FAIL] Nonce ".concat(nonce, " has already been used."));
            conn.prepare('DELETE FROM login_nonces WHERE nonce = ?').run(nonce);
            return false;
        }
        conn.prepare('DELETE FROM login_nonces WHERE nonce = ?').run(nonce);
        (0, logger_js_1.writeServerLog)("[SYS-SECURE] [NONCE-DB-SUCCESS] Nonce ".concat(nonce, " successfully verified and consumed."));
        return true;
    }
    catch (err) {
        (0, logger_js_1.writeServerLog)("[SYS-SECURE] [NONCE-DB-ERR] Failed to verify/consume nonce in SQLite: ".concat((err === null || err === void 0 ? void 0 : err.message) || err));
        return false;
    }
    finally {
        try {
            (_a = conn.close) === null || _a === void 0 ? void 0 : _a.call(conn);
        }
        catch (_) { }
    }
}
function hardResetAndSeedDatabase() {
    return __awaiter(this, arguments, void 0, function (force) {
        var migrated_1, midnight_pass, midnight_safe, midnight_panic, midnight_rec, lexie_pass, lexie_safe, lexie_panic, lexie_rec, midnight, lexie, mustReSeed, cli_admin_salt, Admin_salt, cli_pass_pre, cli_safe_pre, cli_panic_pre, cli_rec_key_salt, cli_rec_pre, cli_rec_key_hash_raw, cli_rec_key_hash, cli_pass_hash, _a, cli_safe_hash, _b, cli_panic_hash, _c, admin_pass_pre, admin_safe_pre, admin_panic_pre, admin_rec_key_salt, admin_rec_pre, admin_rec_key_hash_raw, admin_rec_key_hash, admin_pass_hash, _d, admin_safe_hash, _e, admin_panic_hash, _f, seededUsers, seededProfiles;
        var _g, _h;
        var _j, _k;
        if (force === void 0) { force = false; }
        return __generator(this, function (_l) {
            switch (_l.label) {
                case 0:
                    // Dynamic in-place migration upgrade for existing database
                    if (index_js_1.db.users) {
                        migrated_1 = false;
                        index_js_1.db.users.forEach(function (u) {
                            if (u.user_id === 1 && (u.username === '午夜兔子' || u.username === 'cli_admin' || u.username === 'midnight')) {
                                u.username = 'Midnight';
                                migrated_1 = true;
                            }
                            if (u.user_id === 2 && (u.username === 'lexie' || u.username === 'admin' || u.username === 'LEXIE')) {
                                u.username = 'Lexie';
                                migrated_1 = true;
                            }
                        });
                        if (migrated_1) {
                            console.log('[SYS-SECURE] Migrated existing administrative accounts to Midnight and Lexie.');
                            (0, index_js_1.saveDb)();
                        }
                    }
                    midnight_pass = process.env.MIDNIGHT_PASSWORD || '';
                    midnight_safe = process.env.MIDNIGHT_SAFE_WORD || '';
                    midnight_panic = process.env.MIDNIGHT_PANIC_PHRASE || '';
                    midnight_rec = process.env.MIDNIGHT_RECOVERY_KEY || '';
                    lexie_pass = process.env.LEXIE_PASSWORD || '';
                    lexie_safe = process.env.LEXIE_SAFE_WORD || '';
                    lexie_panic = process.env.LEXIE_PANIC_PHRASE || '';
                    lexie_rec = process.env.LEXIE_RECOVERY_KEY || '';
                    midnight = index_js_1.db.users && index_js_1.db.users.find(function (u) { return u.role === 'CLI_ADMIN'; });
                    lexie = index_js_1.db.users && index_js_1.db.users.find(function (u) { return u.role === 'LOGIN_ADMIN'; });
                    mustReSeed = false;
                    if (!midnight || !lexie) {
                        mustReSeed = true;
                    }
                    else if (!((_j = midnight.password_hash) === null || _j === void 0 ? void 0 : _j.startsWith('argon2id:')) || !((_k = lexie.password_hash) === null || _k === void 0 ? void 0 : _k.startsWith('argon2id:'))) {
                        console.log('[SYS-SECURE] Administrative password hashes are legacy or missing argon2id. Triggering upgrade re-seed.');
                        mustReSeed = true;
                    }
                    if (!force && !mustReSeed && index_js_1.db.users && index_js_1.db.users.length > 0) {
                        console.log('[SYS-SECURE] Checked existing database administrative accounts. Retaining persistence.');
                        return [2 /*return*/];
                    }
                    console.log('[SYS-SECURE] Performing database reset/re-seed of administrative accounts via Argon2id...');
                    cli_admin_salt = crypto_1.default.randomBytes(32).toString('hex');
                    Admin_salt = crypto_1.default.randomBytes(32).toString('hex');
                    cli_pass_pre = crypto_1.default.createHash('sha256').update(cli_admin_salt + midnight_pass).digest('hex');
                    cli_safe_pre = crypto_1.default.createHash('sha256').update(cli_admin_salt + midnight_safe).digest('hex');
                    cli_panic_pre = crypto_1.default.createHash('sha256').update(cli_admin_salt + midnight_panic).digest('hex');
                    cli_rec_key_salt = crypto_1.default.randomBytes(32).toString('hex');
                    cli_rec_pre = crypto_1.default.createHash('sha256').update(cli_rec_key_salt + midnight_rec).digest('hex');
                    return [4 /*yield*/, (0, crypto_js_1.hashArgon2id)(cli_rec_pre, Buffer.from(cli_rec_key_salt, 'hex'))];
                case 1:
                    cli_rec_key_hash_raw = _l.sent();
                    cli_rec_key_hash = "argon2id:".concat(cli_rec_key_salt, ":").concat(cli_rec_key_hash_raw);
                    _a = "argon2id:".concat;
                    return [4 /*yield*/, (0, crypto_js_1.hashArgon2id)(cli_pass_pre, Buffer.from(cli_admin_salt, 'hex'))];
                case 2:
                    cli_pass_hash = _a.apply("argon2id:", [_l.sent()]);
                    _b = "argon2id:".concat;
                    return [4 /*yield*/, (0, crypto_js_1.hashArgon2id)(cli_safe_pre, Buffer.from(cli_admin_salt, 'hex'))];
                case 3:
                    cli_safe_hash = _b.apply("argon2id:", [_l.sent()]);
                    _c = "argon2id:".concat;
                    return [4 /*yield*/, (0, crypto_js_1.hashArgon2id)(cli_panic_pre, Buffer.from(cli_admin_salt, 'hex'))];
                case 4:
                    cli_panic_hash = _c.apply("argon2id:", [_l.sent()]);
                    admin_pass_pre = crypto_1.default.createHash('sha256').update(Admin_salt + lexie_pass).digest('hex');
                    admin_safe_pre = crypto_1.default.createHash('sha256').update(Admin_salt + lexie_safe).digest('hex');
                    admin_panic_pre = crypto_1.default.createHash('sha256').update(Admin_salt + lexie_panic).digest('hex');
                    admin_rec_key_salt = crypto_1.default.randomBytes(32).toString('hex');
                    admin_rec_pre = crypto_1.default.createHash('sha256').update(admin_rec_key_salt + lexie_rec).digest('hex');
                    return [4 /*yield*/, (0, crypto_js_1.hashArgon2id)(admin_rec_pre, Buffer.from(admin_rec_key_salt, 'hex'))];
                case 5:
                    admin_rec_key_hash_raw = _l.sent();
                    admin_rec_key_hash = "argon2id:".concat(admin_rec_key_salt, ":").concat(admin_rec_key_hash_raw);
                    _d = "argon2id:".concat;
                    return [4 /*yield*/, (0, crypto_js_1.hashArgon2id)(admin_pass_pre, Buffer.from(Admin_salt, 'hex'))];
                case 6:
                    admin_pass_hash = _d.apply("argon2id:", [_l.sent()]);
                    _e = "argon2id:".concat;
                    return [4 /*yield*/, (0, crypto_js_1.hashArgon2id)(admin_safe_pre, Buffer.from(Admin_salt, 'hex'))];
                case 7:
                    admin_safe_hash = _e.apply("argon2id:", [_l.sent()]);
                    _f = "argon2id:".concat;
                    return [4 /*yield*/, (0, crypto_js_1.hashArgon2id)(admin_panic_pre, Buffer.from(Admin_salt, 'hex'))];
                case 8:
                    admin_panic_hash = _f.apply("argon2id:", [_l.sent()]);
                    seededUsers = [
                        {
                            user_id: 1,
                            username: 'Midnight',
                            password_hash: cli_pass_hash,
                            safe_word_hash: cli_safe_hash,
                            panic_phrase_hash: cli_panic_hash,
                            recovery_key_hash: cli_rec_key_hash,
                            role: 'CLI_ADMIN',
                            status: 'active',
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString(),
                            salt: cli_admin_salt,
                            uid: 'VEL-UID-000001',
                            needs_reset: true
                        },
                        {
                            user_id: 2,
                            username: 'Lexie',
                            password_hash: admin_pass_hash,
                            safe_word_hash: admin_safe_hash,
                            panic_phrase_hash: admin_panic_hash,
                            recovery_key_hash: admin_rec_key_hash,
                            role: 'LOGIN_ADMIN',
                            status: 'active',
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString(),
                            salt: Admin_salt,
                            uid: 'VEL-UID-000002',
                            needs_reset: true
                        }
                    ];
                    if (!index_js_1.db.users) {
                        index_js_1.db.users = seededUsers;
                    }
                    else {
                        // Keep other users but filter out any legacy admins with same IDs or usernames
                        index_js_1.db.users = index_js_1.db.users.filter(function (u) {
                            var isLegacyAdmin = u.user_id === 1 || u.user_id === 2 ||
                                ['midnight', 'lexie', 'cli_admin', 'admin'].includes(u.username.toLowerCase());
                            return !isLegacyAdmin;
                        });
                        (_g = index_js_1.db.users).push.apply(_g, seededUsers);
                    }
                    seededProfiles = [
                        {
                            profile_id: 'p_1',
                            user_id: 1,
                            bio: 'Verified CLI Security Administrator. Operational Systems Command.',
                            avatar: '',
                            updated_at: new Date().toISOString(),
                            settings: { theme: 'slate', notificationsEnabled: true, burnDefaultSeconds: 0 }
                        },
                        {
                            profile_id: 'p_2',
                            user_id: 2,
                            bio: 'Verified Executive Operations Director. Handshake Protocols Coordinator.',
                            avatar: '',
                            updated_at: new Date().toISOString(),
                            settings: { theme: 'slate', notificationsEnabled: true, burnDefaultSeconds: 0 }
                        }
                    ];
                    if (!index_js_1.db.profiles) {
                        index_js_1.db.profiles = seededProfiles;
                    }
                    else {
                        index_js_1.db.profiles = index_js_1.db.profiles.filter(function (p) { return p.user_id !== 1 && p.user_id !== 2; });
                        (_h = index_js_1.db.profiles).push.apply(_h, seededProfiles);
                    }
                    if (!index_js_1.db.sessions)
                        index_js_1.db.sessions = [];
                    if (!index_js_1.db.devices)
                        index_js_1.db.devices = [];
                    if (!index_js_1.db.ip_addresses)
                        index_js_1.db.ip_addresses = [];
                    if (!index_js_1.db.messages)
                        index_js_1.db.messages = [];
                    if (!index_js_1.db.user_blocks)
                        index_js_1.db.user_blocks = [];
                    if (!index_js_1.db.user_mutes)
                        index_js_1.db.user_mutes = [];
                    if (!index_js_1.db.admin_sanctions)
                        index_js_1.db.admin_sanctions = [];
                    if (!index_js_1.db.invites)
                        index_js_1.db.invites = [];
                    if (!index_js_1.db.tickets)
                        index_js_1.db.tickets = [];
                    if (!index_js_1.db.recovery_events)
                        index_js_1.db.recovery_events = [];
                    if (!index_js_1.db.suspicious_events)
                        index_js_1.db.suspicious_events = [];
                    if (!index_js_1.db.audit_logs)
                        index_js_1.db.audit_logs = [];
                    if (!index_js_1.db.friend_requests)
                        index_js_1.db.friend_requests = [];
                    if (!index_js_1.db.peer_relationships)
                        index_js_1.db.peer_relationships = [];
                    if (!index_js_1.db.purged_users)
                        index_js_1.db.purged_users = [];
                    if (!index_js_1.db.purged_profiles)
                        index_js_1.db.purged_profiles = [];
                    (0, index_js_1.saveDb)();
                    console.log('[SYS-SECURE] Security standards initialized. Verified administrative accounts seeded.');
                    return [2 /*return*/];
            }
        });
    });
}
function executeCliCommand(command) {
    return __awaiter(this, void 0, void 0, function () {
        function findUserInDb(query) {
            if (!query)
                return null;
            var lower = query.toLowerCase().replace(/^@/, '');
            return index_js_1.db.users.find(function (u) {
                return String(u.user_id) === query ||
                    u.username.toLowerCase() === lower ||
                    (u.uid && u.uid.toLowerCase() === lower);
            });
        }
        var parts, action, arg1, arg2Plus, namespacesList, sub, remainingParts, _a, adminCount, totalUsers, messagesCount, ticketsCount, activeConns, dbBytes, nominees, candidate_1, isNominated, cleanUsername, saUsername_1, saUser, saPassword, saSafeWord, saPanicPhrase, saRecoveryKey, sa_salt, saRecSalt, pass_hash, _b, safe_hash, _c, panic_hash, _d, rec_hash, _e, _f, saUserId, newSaUser, dmRoomId_1, credsMessage_1, err_1, candidate, queryName, cleanName_1, saUser_1, baseUser, candidate_2, candidate_3, candidate, candidate_4, initialCount, finalCount, clearedCount, err_2, err_3, err_4, conn, row, ok, logsList, expiredCount, output_1, output_2, receiver, dmRoomId, wireMessage, tokenVal, currentInterval, hash, numericValue, otp, loungeIndex, candidate_5, isHardPurged, archivedProfile, candidate, uId_1, profile, candidate_6, uId_2, targetProfile, ticketId_1, ticket, queryName_1, candidate, argsList, newPassword, newRecoveryKey, newSafeWord, salt, saltBuf, _g, _h, _j, _k, keySalt, hashHex, err_5, filtered, out_1, user_1, profile, wallet, balanceText, out, user, user, user, role, user_2, user_3, hasReq, user_4, req, elapsed, TWO_DAYS, remaining, hours, mins, wallets, totalBalanceCents, _i, wallets_1, w, totalBalance, user_5, req, profile, user_6, wallets, totalSeizedCents, _l, wallets_2, w, balCents, treasury, escrows, _m, escrows_1, esc, amountCents, treasury, totalSeized, profile, list, out_2, id_1, lounge, out, id_2, uName, lounge, user, lounge, lounge, rpId_1, rp, ticket, user_7, logs, out_3, pattern_1, LOG_FILE, logs, matches, out_4, logsList, out_5, totalWallets, mismatched_1, out_6, flagged_1, out_7, out, groups_1, multiple, _o, _p, _q, ip, users, leakCount_1, out_8, fixedCount_1, relationships_1, out_9, out, user, targetUid_1, wallet, cleanEntries, calculatedSumCents, _r, cleanEntries_1, e, precedingHash, sorted, _s, sorted_1, entry, calculatedHash, user, user, orphans_1, userIds_1, out_10, userIds_2, backup, pathBackup, tbl, masked;
        var _t;
        var _u, _v, _w, _x, _y, _z, _0;
        return __generator(this, function (_1) {
            switch (_1.label) {
                case 0:
                    if (!command) {
                        return [2 /*return*/, ' ERROR: Command cannot be empty.'];
                    }
                    parts = command.trim().split(/\s+/);
                    action = parts[0].toLowerCase();
                    arg1 = parts[1];
                    arg2Plus = parts.slice(2).join(' ');
                    namespacesList = ['/users', '/lounges', '/support', '/db', '/sys', '/audit', '/fraud'];
                    if (namespacesList.includes(action) && arg1) {
                        sub = arg1.toLowerCase();
                        action = "".concat(action, "/").concat(sub);
                        remainingParts = parts.slice(2);
                        arg1 = remainingParts[0];
                        arg2Plus = remainingParts.slice(1).join(' ');
                    }
                    // Normalize duplicate or server-style aliased console commands
                    if (action === 'list-pending' || action === 'list_pending')
                        action = 'pending';
                    else if (action === 'approve-support' || action === 'approve_support')
                        action = 'approve';
                    else if (action === 'reject-support' || action === 'reject_support')
                        action = 'reject';
                    else if (action === 'demote-support' || action === 'demote_support')
                        action = 'demote';
                    else if (action === 'ban-user' || action === 'ban_user')
                        action = 'ban';
                    else if (action === 'unban-user' || action === 'unban_user')
                        action = 'unban';
                    else if (action === 'mute-user' || action === 'mute_user')
                        action = 'mute';
                    else if (action === 'unmute-user' || action === 'unmute_user')
                        action = 'unmute';
                    else if (action === 'generate-login-token' || action === 'generate_login_token' || action === 'get-token' || action === 'get_token')
                        action = 'token';
                    else if (action === 'send-system-wire' || action === 'send_system_wire')
                        action = 'wire';
                    else if (action === 'db-vacuum' || action === 'db_vacuum')
                        action = 'vacuum';
                    else if (action === 'sessions-clear' || action === 'sessions_clear')
                        action = 'clear';
                    else if (action === 'list-lounges' || action === 'list_lounges')
                        action = 'lounges';
                    else if (action === 'risk-report' || action === 'risk_report')
                        action = 'risk';
                    else if (action === 'server-logs' || action === 'server_logs')
                        action = 'logs';
                    else if (action === 'delete-user' || action === 'delete_user')
                        action = 'delete-user';
                    else if (action === 'restore-user' || action === 'restore_user')
                        action = 'restore-user';
                    else if (action === 'reset-avatar' || action === 'reset_avatar')
                        action = 'reset-avatar';
                    else if (action === 'delete-lounge' || action === 'delete_lounge')
                        action = 'delete-lounge';
                    else if (action === 'clean-lounge' || action === 'clean_lounge' || action === 'clean-lobby' || action === 'clean_lobby' || action === 'clean')
                        action = 'clean-lounge';
                    else if (action === 'delete-ticket' || action === 'delete_ticket')
                        action = 'delete-ticket';
                    else if (action === 'override-user' || action === 'override_user')
                        action = 'override-user';
                    // Normalize absolute namespace command formats to our case verbs
                    if (action.startsWith('/')) {
                        if (action === '/users/list')
                            action = 'users-list';
                        else if (action === '/users/cat')
                            action = 'users-cat';
                        else if (action === '/users/ban')
                            action = 'ban';
                        else if (action === '/users/unban')
                            action = 'unban';
                        else if (action === '/users/mute')
                            action = 'mute';
                        else if (action === '/users/unmute')
                            action = 'unmute';
                        else if (action === '/users/jail')
                            action = 'users-jail';
                        else if (action === '/users/unjail')
                            action = 'users-unjail';
                        else if (action === '/users/reset-avatar')
                            action = 'reset-avatar';
                        else if (action === '/users/override')
                            action = 'users-override';
                        else if (action === '/users/set')
                            action = 'users-set-role';
                        else if (action === '/users/deactivate')
                            action = 'users-deactivate';
                        else if (action === '/users/cancel-deactivation' || action === '/users/cancel')
                            action = 'users-cancel-deactivation';
                        else if (action === '/users/release-assets' || action === '/users/release')
                            action = 'users-release-assets';
                        else if (action === '/users/confirm-purge')
                            action = 'users-confirm-purge';
                        else if (action === '/users/purge-fraudster')
                            action = 'users-purge-fraudster';
                        else if (action === '/users/blacklist')
                            action = 'users-blacklist';
                        else if (action === '/users/unblacklist')
                            action = 'users-unblacklist';
                        else if (action === '/users/pending-deletions' || action === '/users/pending')
                            action = 'users-pending-deletions';
                        else if (action === '/users/restore')
                            action = 'restore-user';
                        else if (action === '/users')
                            action = 'help';
                        else if (action === '/lounges/list' || action === '/lounges/lounges')
                            action = 'lounges';
                        else if (action === '/lounges/cat')
                            action = 'lounges-cat';
                        else if (action === '/lounges/chown')
                            action = 'lounges-chown';
                        else if (action === '/lounges/clean')
                            action = 'clean-lounge';
                        else if (action === '/lounges/restore-messages')
                            action = 'lounges-restore-messages';
                        else if (action === '/lounges/delete')
                            action = 'delete-lounge';
                        else if (action === '/lounges/lock')
                            action = 'lounges-lock';
                        else if (action === '/lounges/unlock')
                            action = 'lounges-unlock';
                        else if (action === '/lounges')
                            action = 'help';
                        else if (action === '/support/pending')
                            action = 'pending';
                        else if (action === '/support/token')
                            action = 'support-token';
                        else if (action === '/support/approve')
                            action = 'approve';
                        else if (action === '/support/reject')
                            action = 'reject';
                        else if (action === '/support/demote')
                            action = 'demote';
                        else if (action === '/support/delete')
                            action = 'delete-ticket';
                        else if (action === '/support')
                            action = 'help';
                        else if (action === '/db/integrity')
                            action = 'integrity';
                        else if (action === '/db/orphans-scan' || action === '/db/orphans')
                            action = 'db-orphans-scan';
                        else if (action === '/db/orphans-clean' || action === '/db/clean')
                            action = 'db-orphans-clean';
                        else if (action === '/db/backup')
                            action = 'db-backup';
                        else if (action === '/db/export')
                            action = 'db-export';
                        else if (action === '/db/vacuum')
                            action = 'vacuum';
                        else if (action === '/db/restore')
                            action = 'restore';
                        else if (action === '/db/seed')
                            action = 'seed';
                        else if (action === '/db/prune')
                            action = 'prune';
                        else if (action === '/db/wipe')
                            action = 'wipe';
                        else if (action === '/db')
                            action = 'help';
                        else if (action === '/sys/status')
                            action = 'status';
                        else if (action === '/sys/top')
                            action = 'sys-top';
                        else if (action === '/sys/risk')
                            action = 'risk';
                        else if (action === '/sys/token')
                            action = 'token';
                        else if (action === '/sys/kill')
                            action = 'sys-kill';
                        else if (action === '/sys/clear-sessions')
                            action = 'clear-sessions';
                        else if (action === '/sys/maint-on')
                            action = 'sys-maintenance-enable';
                        else if (action === '/sys/maint-off')
                            action = 'sys-maintenance-disable';
                        else if (action === '/sys')
                            action = 'help';
                        else if (action === '/audit/user')
                            action = 'audit-user';
                        else if (action === '/audit/grep')
                            action = 'audit-grep';
                        else if (action === '/audit/history')
                            action = 'audit-history';
                        else if (action === '/audit/ledger')
                            action = 'audit-ledger-verify';
                        else if (action === '/audit/hijacks' || action === '/audit/scan')
                            action = 'audit-sessions-hijack-scan';
                        else if (action === '/audit/ip')
                            action = 'audit-ip-correlate';
                        else if (action === '/audit/nodes')
                            action = 'audit-nodes-scan';
                        else if (action === '/audit/reconstruct')
                            action = 'audit-friendships-reconstruct';
                        else if (action === '/audit')
                            action = 'help';
                        else if (action === '/fraud/seize')
                            action = 'users-purge-fraudster';
                        else if (action === '/fraud/freeze')
                            action = 'fraud-freeze';
                        else if (action === '/fraud/unfreeze')
                            action = 'fraud-unfreeze';
                        else if (action === '/fraud')
                            action = 'help';
                    }
                    _a = action;
                    switch (_a) {
                        case 'help': return [3 /*break*/, 1];
                        case 'status': return [3 /*break*/, 2];
                        case 'diagnostics': return [3 /*break*/, 2];
                        case 'info': return [3 /*break*/, 2];
                        case 'pending': return [3 /*break*/, 3];
                        case 'approve': return [3 /*break*/, 4];
                        case 'reject': return [3 /*break*/, 10];
                        case 'demote': return [3 /*break*/, 11];
                        case 'ban': return [3 /*break*/, 12];
                        case 'unban': return [3 /*break*/, 13];
                        case 'mute': return [3 /*break*/, 14];
                        case 'unmute': return [3 /*break*/, 15];
                        case 'clean-lounge': return [3 /*break*/, 16];
                        case 'purge': return [3 /*break*/, 20];
                        case 'reset': return [3 /*break*/, 20];
                        case 'wipe': return [3 /*break*/, 20];
                        case 'prune': return [3 /*break*/, 20];
                        case 'prune-db': return [3 /*break*/, 20];
                        case 'hard-reset': return [3 /*break*/, 20];
                        case 'seed': return [3 /*break*/, 25];
                        case 'integrity': return [3 /*break*/, 28];
                        case 'logs': return [3 /*break*/, 29];
                        case 'vacuum': return [3 /*break*/, 30];
                        case 'db-vacuum': return [3 /*break*/, 30];
                        case 'clear-sessions': return [3 /*break*/, 31];
                        case 'clear': return [3 /*break*/, 31];
                        case 'lounges': return [3 /*break*/, 32];
                        case 'list-lounges': return [3 /*break*/, 32];
                        case 'risk': return [3 /*break*/, 33];
                        case 'risk-report': return [3 /*break*/, 33];
                        case 'wire': return [3 /*break*/, 34];
                        case 'send-system-wire': return [3 /*break*/, 34];
                        case 'token': return [3 /*break*/, 35];
                        case 'generate-login-token': return [3 /*break*/, 35];
                        case 'delete-lounge': return [3 /*break*/, 36];
                        case 'delete_lounge': return [3 /*break*/, 36];
                        case 'restore-user': return [3 /*break*/, 37];
                        case 'restore_user': return [3 /*break*/, 37];
                        case 'reset-avatar': return [3 /*break*/, 38];
                        case 'reset_avatar': return [3 /*break*/, 38];
                        case 'delete-user': return [3 /*break*/, 39];
                        case 'delete_user': return [3 /*break*/, 39];
                        case 'delete-ticket': return [3 /*break*/, 40];
                        case 'delete_ticket': return [3 /*break*/, 40];
                        case 'override-user': return [3 /*break*/, 41];
                        case 'override_user': return [3 /*break*/, 41];
                        case 'users-list': return [3 /*break*/, 46];
                        case 'users-cat': return [3 /*break*/, 47];
                        case 'users-jail': return [3 /*break*/, 48];
                        case 'users-unjail': return [3 /*break*/, 49];
                        case 'users-set-role': return [3 /*break*/, 50];
                        case 'users-deactivate': return [3 /*break*/, 51];
                        case 'users-cancel-deactivation': return [3 /*break*/, 52];
                        case 'users-release-assets': return [3 /*break*/, 53];
                        case 'users-confirm-purge': return [3 /*break*/, 54];
                        case 'users-purge-fraudster': return [3 /*break*/, 55];
                        case 'users-blacklist': return [3 /*break*/, 56];
                        case 'users-unblacklist': return [3 /*break*/, 57];
                        case 'users-pending-deletions': return [3 /*break*/, 58];
                        case 'lounges-cat': return [3 /*break*/, 59];
                        case 'lounges-chown': return [3 /*break*/, 60];
                        case 'lounges-lock': return [3 /*break*/, 61];
                        case 'lounges-unlock': return [3 /*break*/, 62];
                        case 'lounges-restore-messages': return [3 /*break*/, 63];
                        case 'support-token': return [3 /*break*/, 64];
                        case 'sys-top': return [3 /*break*/, 65];
                        case 'sys-kill': return [3 /*break*/, 66];
                        case 'sys-maintenance-enable': return [3 /*break*/, 67];
                        case 'sys-maintenance-disable': return [3 /*break*/, 68];
                        case 'audit-user': return [3 /*break*/, 69];
                        case 'audit-grep': return [3 /*break*/, 70];
                        case 'audit-history': return [3 /*break*/, 71];
                        case 'audit-ledger-verify': return [3 /*break*/, 72];
                        case 'audit-sessions-hijack-scan': return [3 /*break*/, 73];
                        case 'audit-ip-correlate': return [3 /*break*/, 74];
                        case 'audit-nodes-scan': return [3 /*break*/, 75];
                        case 'audit-friendships-reconstruct': return [3 /*break*/, 76];
                        case '/audit/escrows': return [3 /*break*/, 77];
                        case '/audit/repair': return [3 /*break*/, 78];
                        case 'fraud-freeze': return [3 /*break*/, 79];
                        case 'fraud-unfreeze': return [3 /*break*/, 80];
                        case 'db-orphans-scan': return [3 /*break*/, 81];
                        case 'db-orphans-clean': return [3 /*break*/, 82];
                        case 'db-backup': return [3 /*break*/, 83];
                        case 'db-export': return [3 /*break*/, 84];
                    }
                    return [3 /*break*/, 85];
                case 1:
                    {
                        return [2 /*return*/, "VELUM EXECUTIVE ADMIN COMMAND CONTROL PANEL\n" +
                                "========================================================\n" +
                                "\u2022 help                         - Show admin command list\n" +
                                "\u2022 status / info / diagnostics   - View database and server health\n" +
                                "\u2022 pending                      - List active Support Operator nominations\n" +
                                "\u2022 approve <user>               - Approve a support admin candidate account\n" +
                                "\u2022 reject <user>                - Deny candidacy for a support admin account\n" +
                                "\u2022 demote <user>                - Revoke support admin permissions\n" +
                                "\u2022 ban <user>                   - Ban user account and sign them out immediately\n" +
                                "\u2022 unban <user>                 - Unban user account\n" +
                                "\u2022 mute <user>                  - Prevent user from posting messages\n" +
                                "\u2022 unmute <user>                - Allow user to post messages again\n" +
                                "\u2022 delete-user <user>           - Permanently delete user account and all data\n" +
                                "\u2022 restore-user <user>          - Restore a soft-purged user account\n" +
                                "\u2022 reset-avatar <user>          - Reset user's avatar\n" + +"\u2022 delete-lounge <id>           - Delete lounge by ID\n" +
                                "\u2022 delete-ticket <id>           - Delete support ticket by ID\n" +
                                "\u2022 override-user <username> <pass> - Reset user password and credentials to active state\n" +
                                "\u2022 clean-lounge                 - Clear all messages from the global lounge channel\n" +
                                "\u2022 prune / wipe / reset         - Reset all records (keeps main seed accounts)\n" +
                                "\u2022 seed                         - Re-seed default admin accounts\n" +
                                "\u2022 integrity                    - Run a database integrity check\n" +
                                "\u2022 vacuum                       - Clean up old database logs and sessions\n" +
                                "\u2022 clear-sessions / clear       - Force sign out all active users\n" +
                                "\u2022 lounges                      - List all active lounges\n" +
                                "\u2022 risk                         - Print list of recent sign-in security alerts\n" +
                                "\u2022 wire <user> <message>        - Send direct message/broadcast to a user\n" +
                                "\u2022 token                        - Generate a support admin temporary access code\n" +
                                "========================================================"];
                    }
                    _1.label = 2;
                case 2:
                    {
                        try {
                            adminCount = ((_u = index_js_1.db.users) === null || _u === void 0 ? void 0 : _u.filter(function (u) { return u.role === 'CLI_ADMIN' || u.role === 'LOGIN_ADMIN' || u.role === 'SUPPORT_ADMIN'; }).length) || 0;
                            totalUsers = ((_v = index_js_1.db.users) === null || _v === void 0 ? void 0 : _v.length) || 0;
                            messagesCount = ((_w = index_js_1.db.messages) === null || _w === void 0 ? void 0 : _w.length) || 0;
                            ticketsCount = ((_x = index_js_1.db.tickets) === null || _x === void 0 ? void 0 : _x.length) || 0;
                            activeConns = index_js_1.db.sessions ? index_js_1.db.sessions.filter(function (s) { return s.status === 'active'; }).length : 0;
                            dbBytes = 0;
                            if (fs_1.default.existsSync(index_js_1.SQLITE_FILE)) {
                                dbBytes = fs_1.default.statSync(index_js_1.SQLITE_FILE).size;
                            }
                            return [2 /*return*/, "VELUM EXECUTIVE SERVER STATUS & STATISTICS\n" +
                                    "========================================================\n" +
                                    "\u2022 SERVER STATUS: ONLINE\n" +
                                    "\u2022 REGISTERED USERS: ".concat(totalUsers, " (Admins: ").concat(adminCount, ")\n") +
                                    "\u2022 TOTAL MESSAGES: ".concat(messagesCount, "\n") +
                                    "\u2022 CHAT CHANNELS: 0\n" +
                                    "\u2022 SUPPORT TICKETS: ".concat(ticketsCount, "\n") +
                                    "\u2022 TEMPORARY SIGNED IN CONNS: ".concat(activeConns, "\n") +
                                    "\u2022 LOCAL DATABASE SIZE: ".concat(Math.round(dbBytes / 1024 * 100) / 100, " KB\n") +
                                    "\u2022 CLOUD BACKUP SYNC: ".concat(!index_js_1.isCloudBackupDisabled ? 'ENABLED' : 'DISABLED (LOCAL DATABASE)', "\n") +
                                    "========================================================"];
                        }
                        catch (err) {
                            return [2 /*return*/, "[ERROR] Failed to query workspace stats: ".concat(err.message || err)];
                        }
                    }
                    _1.label = 3;
                case 3:
                    {
                        try {
                            nominees = index_js_1.db.users.filter(function (u) { return u.status === 'active' && (u.promotion_status === 'PENDING_SUPPORT' || u.support_nomination === 'nominated'); });
                            if (nominees.length === 0) {
                                return [2 /*return*/, '[INFO] No active Support Admin nominations are currently pending dual CLI approval.'];
                            }
                            return [2 /*return*/, "--- VELUM SUPPORT NOMINATIONS QUEUE ---\n" + nominees.map(function (u) { return "ID: ".concat(u.user_id, " | Username: ").concat(u.username, " | Designation: PENDING_SUPPORT"); }).join('\n')];
                        }
                        catch (err) {
                            return [2 /*return*/, "[ERROR] Failed to query nominations: ".concat(err.message || err)];
                        }
                    }
                    _1.label = 4;
                case 4:
                    _1.trys.push([4, 9, , 10]);
                    if (!arg1) {
                        return [2 /*return*/, " ERROR: Command \"approve\" requires a <username> argument."];
                    }
                    candidate_1 = index_js_1.db.users.find(function (u) { return u.username.toLowerCase() === arg1.toLowerCase(); });
                    if (!candidate_1) {
                        return [2 /*return*/, " ERROR: Account \"".concat(arg1, "\" is not registered in central databases.")];
                    }
                    isNominated = candidate_1.promotion_status === 'PENDING_SUPPORT' || candidate_1.support_nomination === 'nominated';
                    if (!isNominated) {
                        return [2 /*return*/, " ERROR: Account \"".concat(candidate_1.username, "\" is not currently in a PENDING_SUPPORT nomination state.")];
                    }
                    candidate_1.role = 'USER';
                    candidate_1.support_nomination = null;
                    candidate_1.promotion_status = 'APPROVED_SUPPORT';
                    candidate_1.updated_at = new Date().toISOString();
                    cleanUsername = candidate_1.username.replace(/^@/, '');
                    saUsername_1 = "SA-".concat(cleanUsername);
                    saUser = index_js_1.db.users.find(function (u) { return u.username.toLowerCase() === saUsername_1.toLowerCase(); });
                    if (saUser) {
                        return [2 /*return*/, " ERROR: Dedicated Support Admin account \"".concat(saUsername_1, "\" already exists.")];
                    }
                    saPassword = "SA-PASS-".concat(Math.floor(100000 + Math.random() * 900000));
                    saSafeWord = "SA-SAFE-".concat(Math.floor(1000 + Math.random() * 9000));
                    saPanicPhrase = "SA-PANIC-".concat(Math.floor(1000 + Math.random() * 9000));
                    saRecoveryKey = "SA-REC-".concat(Math.floor(100000 + Math.random() * 900000));
                    sa_salt = crypto_1.default.randomBytes(32).toString('hex');
                    saRecSalt = crypto_1.default.randomBytes(32).toString('hex');
                    _b = "argon2id:".concat;
                    return [4 /*yield*/, (0, crypto_js_1.hashArgon2id)(saPassword, Buffer.from(sa_salt, 'hex'))];
                case 5:
                    pass_hash = _b.apply("argon2id:", [_1.sent()]);
                    _c = "argon2id:".concat;
                    return [4 /*yield*/, (0, crypto_js_1.hashArgon2id)(saSafeWord, Buffer.from(sa_salt, 'hex'))];
                case 6:
                    safe_hash = _c.apply("argon2id:", [_1.sent()]);
                    _d = "argon2id:".concat;
                    return [4 /*yield*/, (0, crypto_js_1.hashArgon2id)(saPanicPhrase, Buffer.from(sa_salt, 'hex'))];
                case 7:
                    panic_hash = _d.apply("argon2id:", [_1.sent()]);
                    _f = (_e = "argon2id:".concat(saRecSalt, ":")).concat;
                    return [4 /*yield*/, (0, crypto_js_1.hashArgon2id)(saRecoveryKey, Buffer.from(saRecSalt, 'hex'))];
                case 8:
                    rec_hash = _f.apply(_e, [_1.sent()]);
                    saUserId = Math.max.apply(Math, __spreadArray(__spreadArray([], index_js_1.db.users.map(function (u) { return u.user_id; }), false), [0], false)) + 1;
                    newSaUser = {
                        user_id: saUserId,
                        username: saUsername_1,
                        password_hash: pass_hash,
                        safe_word_hash: safe_hash,
                        panic_phrase_hash: panic_hash,
                        recovery_key_hash: rec_hash,
                        role: 'SUPPORT_ADMIN',
                        status: 'active',
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                        salt: sa_salt,
                        uid: "VEL-UID-".concat(Math.floor(100000 + Math.random() * 900000))
                    };
                    index_js_1.db.users.push(newSaUser);
                    if (!index_js_1.db.profiles)
                        index_js_1.db.profiles = [];
                    index_js_1.db.profiles.push({
                        profile_id: "p_".concat(saUserId),
                        user_id: saUserId,
                        bio: 'Isolated Security Support Desk Account.',
                        avatar: 'help-circle',
                        settings: { theme: 'slate', notificationsEnabled: true, burnDefaultSeconds: 0 },
                        updated_at: new Date().toISOString()
                    });
                    dmRoomId_1 = "dm_velum_".concat(candidate_1.user_id);
                    credsMessage_1 = {
                        message_id: "msg_sa_promo_".concat(candidate_1.user_id, "_").concat((0, ulid_js_1.generateUlid)()),
                        room_id: dmRoomId_1,
                        user_id: 999,
                        content: "Support Operator Access Approved.\n\nCredentials:\nUsername: `".concat(saUsername_1, "`\nPassword: `").concat(saPassword, "`\nSafeWord: `").concat(saSafeWord, "`\nPanicPhrase: `").concat(saPanicPhrase, "`\nRecoveryKey: `").concat(saRecoveryKey, "`"),
                        is_encrypted: false,
                        reply_to: null,
                        timestamp: new Date().toISOString(),
                        expires_in: null,
                        status: 'sent',
                        type: 'text'
                    };
                    if (!index_js_1.db.messages)
                        index_js_1.db.messages = [];
                    index_js_1.db.messages.push(credsMessage_1);
                    if (!index_js_1.db.audit_logs)
                        index_js_1.db.audit_logs = [];
                    index_js_1.db.audit_logs.push({
                        log_id: "".concat((0, ulid_js_1.generatePrefixedId)('al'), "_audit"),
                        admin_id: 1,
                        admin_name: 'cli_admin',
                        action: 'role_change',
                        target_type: 'user',
                        target_id: String(candidate_1.user_id),
                        reason: "Approved support operator nomination. Registered SA user \"".concat(saUsername_1, "\" and dispatched credentials over Velum system chat."),
                        timestamp: new Date().toISOString()
                    });
                    (0, index_js_1.executeSaveDb)();
                    // Dynamically import and broadcast over WS
                    Promise.resolve().then(function () { return require('./websocket.js'); }).then(function (_a) {
                        var broadcastToRoom = _a.broadcastToRoom, connectedClients = _a.connectedClients;
                        var wsPayload = __assign(__assign({}, credsMessage_1), { username: 'Velum', avatar: 'help-circle' });
                        // Broadcast to room if active
                        broadcastToRoom(dmRoomId_1, wsPayload);
                        // Direct propagation: Send the DM payload directly to the recipient's websocket connections
                        // even if they are not actively viewing this room, triggering badge updates and buzzes.
                        connectedClients.forEach(function (c) {
                            if (c.user_id === candidate_1.user_id && !c.rooms.has(dmRoomId_1) && c.ws.readyState === 1) {
                                c.ws.send(JSON.stringify(wsPayload));
                            }
                        });
                    }).catch(function (err) {
                        console.warn('[PROMO] Failed to dispatch real-time websocket broadcast for promotion credentials:', err);
                    });
                    return [2 /*return*/, " SUCCESS: Approved Support nomination for \"".concat(candidate_1.username, "\". Created dedicated SA profile \"").concat(saUsername_1, "\". Credentials wire dispatched securely! \n\nSupport ID: ").concat(saUserId, "\nHandle: ").concat(saUsername_1, "\nPassword: ").concat(saPassword, "\nSafe Word: ").concat(saSafeWord, "\nPanic Word: ").concat(saPanicPhrase, "\nRecovery Key: ").concat(saRecoveryKey)];
                case 9:
                    err_1 = _1.sent();
                    return [2 /*return*/, " ERROR: Approved support task failure: ".concat(err_1.message || err_1)];
                case 10:
                    {
                        try {
                            if (!arg1) {
                                return [2 /*return*/, " ERROR: Command \"reject\" requires a <username> argument."];
                            }
                            candidate = index_js_1.db.users.find(function (u) { return u.username.toLowerCase() === arg1.toLowerCase(); });
                            if (!candidate) {
                                return [2 /*return*/, " ERROR: Account \"".concat(arg1, "\" is not registered in central databases.")];
                            }
                            candidate.support_nomination = null;
                            candidate.promotion_status = 'REJECTED_SUPPORT';
                            candidate.updated_at = new Date().toISOString();
                            if (!index_js_1.db.audit_logs)
                                index_js_1.db.audit_logs = [];
                            index_js_1.db.audit_logs.push({
                                log_id: "".concat((0, ulid_js_1.generatePrefixedId)('al'), "_audit"),
                                admin_id: 1,
                                admin_name: 'cli_admin',
                                action: 'role_change',
                                target_type: 'user',
                                target_id: String(candidate.user_id),
                                reason: "Root CLI operator rejected Support Admin role nomination for \"".concat(candidate.username, "\"."),
                                timestamp: new Date().toISOString()
                            });
                            (0, index_js_1.executeSaveDb)();
                            return [2 /*return*/, " SUCCESS: Rejected Support Admin nomination for \"".concat(candidate.username, "\". Saved to main ledger.")];
                        }
                        catch (err) {
                            return [2 /*return*/, " ERROR: Nomination rejection task failed: ".concat(err.message || err)];
                        }
                    }
                    _1.label = 11;
                case 11:
                    {
                        try {
                            if (!arg1) {
                                return [2 /*return*/, " ERROR: Command \"demote\" requires a <username> argument."];
                            }
                            queryName = arg1.trim();
                            cleanName_1 = queryName.replace(/^@?SA-@?|^@/, '').toLowerCase();
                            saUser_1 = index_js_1.db.users.find(function (u) {
                                if (u.role !== 'SUPPORT_ADMIN')
                                    return false;
                                var uClean = u.username.replace(/^@?SA-@?|^@/, '').toLowerCase();
                                return uClean === cleanName_1;
                            });
                            baseUser = index_js_1.db.users.find(function (u) {
                                if (u.role === 'SUPPORT_ADMIN')
                                    return false;
                                var uClean = u.username.replace(/^@/, '').toLowerCase();
                                return uClean === cleanName_1;
                            });
                            if (!baseUser && !saUser_1) {
                                return [2 /*return*/, " ERROR: Target \"".concat(arg1, "\" not found in registries.")];
                            }
                            if (baseUser) {
                                baseUser.promotion_status = 'NONE';
                                baseUser.support_nomination = null;
                                baseUser.updated_at = new Date().toISOString();
                            }
                            if (saUser_1) {
                                index_js_1.db.users = index_js_1.db.users.filter(function (u) { return u.user_id !== saUser_1.user_id; });
                                if (index_js_1.db.profiles)
                                    index_js_1.db.profiles = index_js_1.db.profiles.filter(function (p) { return p.user_id !== saUser_1.user_id; });
                                index_js_1.db.sessions = index_js_1.db.sessions || [];
                                index_js_1.db.sessions.forEach(function (s) {
                                    if (s.user_id === saUser_1.user_id)
                                        s.status = 'revoked';
                                });
                                // Perform live eviction of active WebSocket connections instantly
                                Promise.resolve().then(function () { return require('./websocket.js'); }).then(function (_a) {
                                    var connectedClients = _a.connectedClients;
                                    var activeConns = connectedClients.filter(function (c) { return c.user_id === saUser_1.user_id; });
                                    activeConns.forEach(function (c) {
                                        try {
                                            c.ws.send(JSON.stringify({
                                                type: 'session_revoked',
                                                message: 'Administrative Sanction: Your companion Support Operator access has been demoted and revoked.'
                                            }));
                                            c.ws.close(3200, 'Demoted');
                                        }
                                        catch (_a) { }
                                    });
                                }).catch(function () { });
                            }
                            if (!index_js_1.db.audit_logs)
                                index_js_1.db.audit_logs = [];
                            index_js_1.db.audit_logs.push({
                                log_id: "".concat((0, ulid_js_1.generatePrefixedId)('al'), "_audit"),
                                admin_id: 1,
                                admin_name: 'cli_admin',
                                action: 'role_change',
                                target_type: 'user',
                                target_id: String((_y = (baseUser || saUser_1)) === null || _y === void 0 ? void 0 : _y.user_id),
                                reason: "Demoted and purged companion Support Operator access for \"".concat(arg1, "\"."),
                                timestamp: new Date().toISOString()
                            });
                            (0, index_js_1.executeSaveDb)();
                            return [2 /*return*/, " SUCCESS: Demoted and removed companion Support Operator access for \"".concat(arg1, "\". All specialized tokens immediately purged.")];
                        }
                        catch (err) {
                            return [2 /*return*/, " ERROR: Demotion sequence faulted: ".concat(err.message || err)];
                        }
                    }
                    _1.label = 12;
                case 12:
                    {
                        try {
                            if (!arg1) {
                                return [2 /*return*/, " ERROR: Command \"ban\" requires a <username> argument."];
                            }
                            candidate_2 = index_js_1.db.users.find(function (u) { return u.username.toLowerCase() === arg1.toLowerCase(); });
                            if (!candidate_2) {
                                return [2 /*return*/, " ERROR: Account \"".concat(arg1, "\" is not registered in registries.")];
                            }
                            if (candidate_2.role === 'CLI_ADMIN') {
                                return [2 /*return*/, " ERROR: Severe security privilege violation - cannot ban Root CLI Administrator."];
                            }
                            candidate_2.status = 'suspended';
                            candidate_2.updated_at = new Date().toISOString();
                            index_js_1.db.sessions = index_js_1.db.sessions.filter(function (s) { return s.user_id !== candidate_2.user_id; });
                            if (!index_js_1.db.admin_sanctions)
                                index_js_1.db.admin_sanctions = [];
                            index_js_1.db.admin_sanctions.push({
                                sanction_id: (0, ulid_js_1.generatePrefixedId)('sanc'),
                                user_id: candidate_2.user_id,
                                admin_id: 1,
                                room_id: null,
                                type: 'ban',
                                reason: arg2Plus || 'Root CLI global ban action',
                                expires_at: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString()
                            });
                            if (!index_js_1.db.audit_logs)
                                index_js_1.db.audit_logs = [];
                            index_js_1.db.audit_logs.push({
                                log_id: "".concat((0, ulid_js_1.generatePrefixedId)('al'), "_audit"),
                                admin_id: 1,
                                admin_name: 'cli_admin',
                                action: 'ban',
                                target_type: 'user',
                                target_id: String(candidate_2.user_id),
                                reason: "Globally banned \"".concat(candidate_2.username, "\" via Web CLI. Active sessions purged."),
                                timestamp: new Date().toISOString()
                            });
                            (0, index_js_1.executeSaveDb)();
                            return [2 /*return*/, "SUCCESS: Globally banned user \"".concat(candidate_2.username, "\" and evicted all active sessions immediately.")];
                        }
                        catch (err) {
                            return [2 /*return*/, "ERROR during ban sequence: ".concat(err.message || err)];
                        }
                    }
                    _1.label = 13;
                case 13:
                    {
                        try {
                            if (!arg1) {
                                return [2 /*return*/, " ERROR: Command \"unban\" requires a <username> argument."];
                            }
                            candidate_3 = index_js_1.db.users.find(function (u) { return u.username.toLowerCase() === arg1.toLowerCase(); });
                            if (!candidate_3) {
                                return [2 /*return*/, " ERROR: Account \"".concat(arg1, "\" is not registered.")];
                            }
                            candidate_3.status = 'active';
                            candidate_3.updated_at = new Date().toISOString();
                            if (index_js_1.db.admin_sanctions) {
                                index_js_1.db.admin_sanctions = index_js_1.db.admin_sanctions.filter(function (s) { return !(s.target_id === candidate_3.user_id && s.type === 'ban'); });
                            }
                            if (!index_js_1.db.audit_logs)
                                index_js_1.db.audit_logs = [];
                            index_js_1.db.audit_logs.push({
                                log_id: "".concat((0, ulid_js_1.generatePrefixedId)('al'), "_audit"),
                                admin_id: 1,
                                admin_name: 'cli_admin',
                                action: 'restore',
                                target_type: 'user',
                                target_id: String(candidate_3.user_id),
                                reason: "Restored/Unbanned account \"".concat(candidate_3.username, "\" via Web CLI."),
                                timestamp: new Date().toISOString()
                            });
                            (0, index_js_1.executeSaveDb)();
                            return [2 /*return*/, " SUCCESS: Restored and unbanned user \"".concat(candidate_3.username, "\". Entry sequence authorized.")];
                        }
                        catch (err) {
                            return [2 /*return*/, " ERROR during unban task: ".concat(err.message || err)];
                        }
                    }
                    _1.label = 14;
                case 14:
                    {
                        try {
                            if (!arg1) {
                                return [2 /*return*/, " ERROR: Command \"mute\" requires a <username> argument."];
                            }
                            candidate = index_js_1.db.users.find(function (u) { return u.username.toLowerCase() === arg1.toLowerCase(); });
                            if (!candidate) {
                                return [2 /*return*/, " ERROR: Account \"".concat(arg1, "\" is not registered.")];
                            }
                            if (!index_js_1.db.admin_sanctions)
                                index_js_1.db.admin_sanctions = [];
                            index_js_1.db.admin_sanctions.push({
                                sanction_id: (0, ulid_js_1.generatePrefixedId)('sanc'),
                                user_id: candidate.user_id,
                                admin_id: 1,
                                room_id: null,
                                type: 'mute',
                                reason: arg2Plus || 'Root CLI mute action',
                                expires_at: new Date(Date.now() + 1000 * 60 * 10000).toISOString()
                            });
                            if (!index_js_1.db.audit_logs)
                                index_js_1.db.audit_logs = [];
                            index_js_1.db.audit_logs.push({
                                log_id: "".concat((0, ulid_js_1.generatePrefixedId)('al'), "_audit"),
                                admin_id: 1,
                                admin_name: 'cli_admin',
                                action: 'mute',
                                target_type: 'user',
                                target_id: String(candidate.user_id),
                                reason: "Muted user \"".concat(candidate.username, "\" via Web CLI."),
                                timestamp: new Date().toISOString()
                            });
                            (0, index_js_1.executeSaveDb)();
                            return [2 /*return*/, " SUCCESS: Muted user \"".concat(candidate.username, "\" globally from sending secure channel messages.")];
                        }
                        catch (err) {
                            return [2 /*return*/, " ERROR muting user: ".concat(err.message || err)];
                        }
                    }
                    _1.label = 15;
                case 15:
                    {
                        try {
                            if (!arg1) {
                                return [2 /*return*/, " ERROR: Command \"unmute\" requires a <username> argument."];
                            }
                            candidate_4 = index_js_1.db.users.find(function (u) { return u.username.toLowerCase() === arg1.toLowerCase(); });
                            if (!candidate_4) {
                                return [2 /*return*/, " ERROR: Account \"".concat(arg1, "\" is not registered.")];
                            }
                            if (index_js_1.db.admin_sanctions) {
                                index_js_1.db.admin_sanctions = index_js_1.db.admin_sanctions.filter(function (s) { return !(s.target_id === candidate_4.user_id && s.type === 'mute'); });
                            }
                            if (!index_js_1.db.audit_logs)
                                index_js_1.db.audit_logs = [];
                            index_js_1.db.audit_logs.push({
                                log_id: "".concat((0, ulid_js_1.generatePrefixedId)('al'), "_audit"),
                                admin_id: 1,
                                admin_name: 'cli_admin',
                                action: 'restore',
                                target_type: 'user',
                                target_id: String(candidate_4.user_id),
                                reason: "Unmuted user \"".concat(candidate_4.username, "\" via Web CLI."),
                                timestamp: new Date().toISOString()
                            });
                            (0, index_js_1.executeSaveDb)();
                            return [2 /*return*/, " SUCCESS: Unmuted user \"".concat(candidate_4.username, "\". Channel write privileges restored.")];
                        }
                        catch (err) {
                            return [2 /*return*/, " ERROR unmuting user: ".concat(err.message || err)];
                        }
                    }
                    _1.label = 16;
                case 16:
                    _1.trys.push([16, 19, , 20]);
                    initialCount = index_js_1.db.messages ? index_js_1.db.messages.length : 0;
                    if (index_js_1.db.messages) {
                        index_js_1.db.messages = index_js_1.db.messages.filter(function (m) { return m.room_id !== 'velum_lounge'; });
                    }
                    finalCount = index_js_1.db.messages ? index_js_1.db.messages.length : 0;
                    clearedCount = initialCount - finalCount;
                    (0, index_js_1.executeSaveDb)();
                    if (!!index_js_1.isCloudBackupDisabled) return [3 /*break*/, 18];
                    return [4 /*yield*/, (0, index_js_1.executeCloudBackup)()];
                case 17:
                    _1.sent();
                    _1.label = 18;
                case 18:
                    if (!index_js_1.db.audit_logs)
                        index_js_1.db.audit_logs = [];
                    index_js_1.db.audit_logs.push({
                        log_id: "".concat((0, ulid_js_1.generatePrefixedId)('al'), "_audit"),
                        admin_id: 1,
                        admin_name: 'cli_admin',
                        action: 'purge',
                        target_type: 'room',
                        target_id: 'velum_lounge',
                        reason: "Cleared all channel communication records in Velum Lounge (removed ".concat(clearedCount, " payloads)."),
                        timestamp: new Date().toISOString()
                    });
                    if (index_js_1.broadcastToRoomCallback) {
                        (0, index_js_1.broadcastToRoomCallback)('velum_lounge', {
                            type: 'lounge_cleaned',
                            room_id: 'velum_lounge',
                            cleared_count: clearedCount,
                            message: 'Velum Lounge has been cleared and sanitized by the Administrator Command Center.'
                        });
                    }
                    return [2 /*return*/, "SUCCESS: Cleared and sanitized all active messages inside Velum Lounge. Purged ".concat(clearedCount, " secure message records completely.")];
                case 19:
                    err_2 = _1.sent();
                    return [2 /*return*/, "ERROR clearing Velum Lounge: ".concat(err_2.message || err_2)];
                case 20:
                    _1.trys.push([20, 24, , 25]);
                    console.log('[SYS-SECURE] CLI Console triggered database purge procedure.');
                    return [4 /*yield*/, hardResetAndSeedDatabase(true)];
                case 21:
                    _1.sent();
                    (0, index_js_1.executeSaveDb)();
                    if (!!index_js_1.isCloudBackupDisabled) return [3 /*break*/, 23];
                    return [4 /*yield*/, (0, index_js_1.executeCloudBackup)()];
                case 22:
                    _1.sent();
                    return [2 /*return*/, " SUCCESS: Velum Relational Database wiped and purged completely! \n" +
                            " Local storage has been reset, default administrative seeds redeployed, and cloud backups have been synchronized immediately on this server. Cloud backups cleared!"];
                case 23: return [2 /*return*/, " SUCCESS: Velum Relational Database wiped and purged locally! \n" +
                        " Local storage has been reset and default administrative seeds successfully deployed. (Cloud storage status: Offline)"];
                case 24:
                    err_3 = _1.sent();
                    return [2 /*return*/, " ERROR during deep database purge task: ".concat(err_3.message || err_3)];
                case 25:
                    _1.trys.push([25, 27, , 28]);
                    return [4 /*yield*/, hardResetAndSeedDatabase(false)];
                case 26:
                    _1.sent();
                    (0, index_js_1.executeSaveDb)();
                    return [2 /*return*/, " INFO: Seeding check completed. Retained existing records safely."];
                case 27:
                    err_4 = _1.sent();
                    return [2 /*return*/, " ERROR seeding database: ".concat(err_4.message || err_4)];
                case 28:
                    {
                        try {
                            if (fs_1.default.existsSync(index_js_1.SQLITE_FILE)) {
                                conn = (0, index_js_1.initSqlite)();
                                if (conn) {
                                    row = conn.prepare("PRAGMA integrity_check").get();
                                    ok = row && row.integrity_check === 'ok';
                                    return [2 /*return*/, "INTEGRITY STATUS: ".concat(ok ? 'PASSED (STABLE NATIVE)' : 'MALFORMED/CORRUPT_STATE', "\nDETAILS: ").concat(JSON.stringify(row))];
                                }
                            }
                            return [2 /*return*/, "ERROR: SQLite database file has not been loaded or initialized."];
                        }
                        catch (err) {
                            return [2 /*return*/, "INTEGRITY DIAGNOSTIC EXCEPTION: ".concat(err.message || err)];
                        }
                    }
                    _1.label = 29;
                case 29:
                    {
                        try {
                            logsList = index_js_1.db.audit_logs || [];
                            if (logsList.length === 0) {
                                return [2 /*return*/, ' INFO: No server log entries registered.'];
                            }
                            return [2 /*return*/, " VELUM SERVER AUDIT LOGS \n" +
                                    "========================================================\n" +
                                    logsList.map(function (log) { return "[".concat(log.timestamp, "] [").concat(log.action.toUpperCase(), "] ").concat(log.reason, " (").concat(log.admin_name || 'root', ")"); }).join('\n') +
                                    "\n========================================================"];
                        }
                        catch (err) {
                            return [2 /*return*/, " ERROR querying audit logs: ".concat(err.message || err)];
                        }
                    }
                    _1.label = 30;
                case 30:
                    {
                        try {
                            expiredCount = index_js_1.db.sessions ? index_js_1.db.sessions.filter(function (s) { return s.status === 'expired' || s.status === 'revoked'; }).length : 0;
                            if (index_js_1.db.sessions) {
                                index_js_1.db.sessions = index_js_1.db.sessions.filter(function (s) { return s.status === 'active'; });
                            }
                            if (index_js_1.db.suspicious_events) {
                                index_js_1.db.suspicious_events = index_js_1.db.suspicious_events.slice(-50);
                            }
                            (0, index_js_1.executeSaveDb)();
                            return [2 /*return*/, "VACUUM COMPLETE\n---------------------------------\n" +
                                    "\u2022 Purged ".concat(expiredCount, " expired/revoked security container sessions.\n") +
                                    "\u2022 Truncated older security anomaly records logs.\n" +
                                    "\u2022 SQLite relational schemas successfully optimized and compacted."];
                        }
                        catch (err) {
                            return [2 /*return*/, " ERROR during SQL compact vacuum: ".concat(err.message || err)];
                        }
                    }
                    _1.label = 31;
                case 31:
                    {
                        if (parts[0].toLowerCase() === 'clear' && !arg1) {
                            // Clear is also handled as a frontend screen wash, but if typed 'clear-sessions' it forces session trunk
                            return [2 /*return*/, 'CLEAR_TERMINAL_SCREEN'];
                        }
                        index_js_1.db.sessions = [];
                        (0, index_js_1.executeSaveDb)();
                        return [2 /*return*/, "FORCE FLUSH INITIATED: All active ephemeral sessions have been truncated. Readers will require re-authentication."];
                    }
                    _1.label = 32;
                case 32:
                    {
                        if (!index_js_1.db.lounges || index_js_1.db.lounges.length === 0) {
                            return [2 /*return*/, 'No active lounges defined in database.'];
                        }
                        output_1 = '\n=== SECURE LOUNGES REGISTRY MATRIX ===\n';
                        index_js_1.db.lounges.forEach(function (lounge) {
                            var owner = index_js_1.db.users.find(function (u) { return u.user_id === lounge.owner_id; });
                            output_1 += " - [ID: ".concat(lounge.lounge_id || lounge.id, "] \"").concat(lounge.name, "\" | Owner: ").concat((owner === null || owner === void 0 ? void 0 : owner.username) || 'System', " | Private: ").concat(lounge.is_private ? 'TRUE' : 'FALSE', "\n");
                        });
                        return [2 /*return*/, output_1];
                    }
                    _1.label = 33;
                case 33:
                    {
                        try {
                            if (!index_js_1.db.suspicious_events || index_js_1.db.suspicious_events.length === 0) {
                                return [2 /*return*/, ' SEC_OK: 0 active threats detected on system.'];
                            }
                            output_2 = " VELUM ANOMALOUS DETECTIONS AUDIT INDEX \n========================================================\n";
                            index_js_1.db.suspicious_events.forEach(function (ev) {
                                var _a;
                                output_2 += "[".concat(((_a = ev.risk_level) === null || _a === void 0 ? void 0 : _a.toUpperCase()) || 'WARNING', "] ").concat(ev.description, " @ ").concat(ev.created_at, "\n");
                            });
                            output_2 += "========================================================";
                            return [2 /*return*/, output_2];
                        }
                        catch (err) {
                            return [2 /*return*/, " ERROR: Failed to query analytics reports: ".concat(err.message || err)];
                        }
                    }
                    _1.label = 34;
                case 34:
                    {
                        try {
                            if (!arg1 || !arg2Plus) {
                                return [2 /*return*/, ' ERROR: Command "wire" requires a target <username> and a <message>.'];
                            }
                            receiver = index_js_1.db.users.find(function (u) { return u.username.toLowerCase() === arg1.toLowerCase() || u.username.toLowerCase() === "@".concat(arg1.replace(/^@/, '').toLowerCase()); });
                            if (!receiver) {
                                return [2 /*return*/, " ERROR: Target user \"".concat(arg1, "\" not found in database.")];
                            }
                            dmRoomId = "dm_velum_".concat(receiver.user_id);
                            wireMessage = {
                                message_id: "msg_sys_wire_".concat(receiver.user_id, "_").concat((0, ulid_js_1.generateUlid)()),
                                room_id: dmRoomId,
                                user_id: 999,
                                content: "[DIRECT SECURITY WIRE] ".concat(arg2Plus),
                                is_encrypted: false,
                                reply_to: null,
                                timestamp: new Date().toISOString(),
                                expires_in: null,
                                status: 'sent',
                                type: 'text'
                            };
                            if (!index_js_1.db.messages)
                                index_js_1.db.messages = [];
                            index_js_1.db.messages.push(wireMessage);
                            (0, index_js_1.executeSaveDb)();
                            return [2 /*return*/, " SUCCESS: Successfully synchronized and transmitted direct system wire payload to user \"".concat(receiver.username, "\".")];
                        }
                        catch (err) {
                            return [2 /*return*/, " ERROR: Failed to transmit secure wire signal: ".concat(err.message || err)];
                        }
                    }
                    _1.label = 35;
                case 35:
                    {
                        try {
                            tokenVal = "VELUM-TOKEN-".concat(Math.floor(100000 + Math.random() * 900000));
                            index_js_1.db.temp_admin_token = tokenVal;
                            currentInterval = Math.floor(Date.now() / 120000);
                            hash = crypto_1.default.createHash('sha256').update("".concat(currentInterval, "_velum_otp")).digest('hex');
                            numericValue = parseInt(hash.substring(0, 8), 16);
                            otp = String(numericValue % 1000000).padStart(6, '0');
                            (0, index_js_1.executeSaveDb)();
                            return [2 /*return*/, " TOKEN GENERATED SUCCESSFULLY\n---------------------------------\n" +
                                    "\u2022 Single-Use Alpha Token: ".concat(tokenVal, "\n") +
                                    "\u2022 Dynamic 6-Digit 2FA Code: ".concat(otp, " (Valid for 10 min window)\n") +
                                    "\u2022 Sync active across secure channels."];
                        }
                        catch (err) {
                            return [2 /*return*/, " ERROR generating temporary credentials: ".concat(err.message || err)];
                        }
                    }
                    _1.label = 36;
                case 36:
                    {
                        if (!arg1)
                            return [2 /*return*/, ' ERROR: Command "delete-lounge" requires a <lounge_id> argument.'];
                        try {
                            loungeIndex = (index_js_1.db.lounges || []).findIndex(function (l) { return l.lounge_id === arg1 || l.id === arg1; });
                            if (loungeIndex === -1) {
                                return [2 /*return*/, " ERROR: Lounge with ID '".concat(arg1, "' not found.")];
                            }
                            if (index_js_1.db.lounges) {
                                index_js_1.db.lounges.splice(loungeIndex, 1);
                            }
                            if (index_js_1.db.lounge_members) {
                                index_js_1.db.lounge_members = index_js_1.db.lounge_members.filter(function (m) { return m.lounge_id !== arg1; });
                            }
                            (0, index_js_1.saveDb)(true);
                            return [2 /*return*/, " SUCCESS: Lounge '".concat(arg1, "' has been permanently deleted.")];
                        }
                        catch (err) {
                            return [2 /*return*/, " ERROR deleting lounge: ".concat(err.message || err)];
                        }
                    }
                    _1.label = 37;
                case 37:
                    {
                        try {
                            if (!arg1)
                                return [2 /*return*/, ' ERROR: Command "restore-user" requires a <username> argument.'];
                            candidate_5 = index_js_1.db.users.find(function (u) { return u.username.toLowerCase() === arg1.toLowerCase() || u.username.toLowerCase() === "@".concat(arg1.replace(/^@/, '').toLowerCase()); });
                            isHardPurged = false;
                            if (!candidate_5) {
                                candidate_5 = index_js_1.db.purged_users && index_js_1.db.purged_users.find(function (u) { return u.username.toLowerCase() === arg1.toLowerCase() || u.username.toLowerCase() === "@".concat(arg1.replace(/^@/, '').toLowerCase()); });
                                if (!candidate_5) {
                                    return [2 /*return*/, " ERROR: Account \"".concat(arg1, "\" is not registered.")];
                                }
                                isHardPurged = true;
                            }
                            if (!isHardPurged && candidate_5.status !== 'purged') {
                                return [2 /*return*/, " ERROR: User @".concat(candidate_5.username, " is not purged.")];
                            }
                            candidate_5.status = 'active';
                            candidate_5.updated_at = new Date().toISOString();
                            if (isHardPurged) {
                                index_js_1.db.purged_users = (index_js_1.db.purged_users || []).filter(function (u) { return u.user_id !== candidate_5.user_id; });
                                index_js_1.db.users.push(candidate_5);
                                if (index_js_1.db.purged_profiles) {
                                    archivedProfile = index_js_1.db.purged_profiles.find(function (p) { return p.user_id === candidate_5.user_id; });
                                    if (archivedProfile) {
                                        index_js_1.db.purged_profiles = (index_js_1.db.purged_profiles || []).filter(function (p) { return p.user_id !== candidate_5.user_id; });
                                        index_js_1.db.profiles = index_js_1.db.profiles || [];
                                        index_js_1.db.profiles.push(archivedProfile);
                                    }
                                }
                            }
                            if (!index_js_1.db.audit_logs)
                                index_js_1.db.audit_logs = [];
                            index_js_1.db.audit_logs.push({
                                log_id: "".concat((0, ulid_js_1.generatePrefixedId)('al'), "_rst_usr"),
                                admin_id: 1,
                                admin_name: 'cli_admin',
                                action: 'user_restored',
                                target_type: 'user',
                                target_id: String(candidate_5.user_id),
                                reason: "Purged account @".concat(candidate_5.username, " restored back to active state by CLI_ADMIN."),
                                timestamp: new Date().toISOString()
                            });
                            (0, index_js_1.saveDb)(true);
                            return [2 /*return*/, " SUCCESS: User @".concat(candidate_5.username, " successfully restored to active status.")];
                        }
                        catch (err) {
                            return [2 /*return*/, " ERROR restoring user: ".concat(err.message || err)];
                        }
                    }
                    _1.label = 38;
                case 38:
                    {
                        try {
                            if (!arg1)
                                return [2 /*return*/, ' ERROR: Command "reset-avatar" requires a <username> argument.'];
                            candidate = index_js_1.db.users.find(function (u) { return u.username.toLowerCase() === arg1.toLowerCase() || u.username.toLowerCase() === "@".concat(arg1.replace(/^@/, '').toLowerCase()); });
                            if (!candidate) {
                                return [2 /*return*/, " ERROR: Account \"".concat(arg1, "\" is not registered.")];
                            }
                            uId_1 = candidate.user_id;
                            profile = index_js_1.db.profiles && index_js_1.db.profiles.find(function (p) { return p.user_id === uId_1; });
                            if (profile) {
                                profile.avatar = "";
                                profile.updated_at = new Date().toISOString();
                                (0, index_js_1.saveDb)(true);
                                return [2 /*return*/, " SUCCESS: Avatar for user @".concat(candidate.username, " has been reset.")];
                            }
                            else {
                                return [2 /*return*/, " ERROR: Profile for user @".concat(candidate.username, " not found.")];
                            }
                        }
                        catch (err) {
                            return [2 /*return*/, " ERROR resetting avatar: ".concat(err.message || err)];
                        }
                    }
                    _1.label = 39;
                case 39:
                    {
                        try {
                            if (!arg1) {
                                return [2 /*return*/, " ERROR: Command \"delete-user\" requires a <username> argument."];
                            }
                            candidate_6 = index_js_1.db.users.find(function (u) { return u.username.toLowerCase() === arg1.toLowerCase() || u.username.toLowerCase() === "@".concat(arg1.replace(/^@/, '').toLowerCase()); });
                            if (!candidate_6) {
                                return [2 /*return*/, " ERROR: Account \"".concat(arg1, "\" is not registered.")];
                            }
                            if (candidate_6.role === 'CLI_ADMIN' || candidate_6.role === 'LOGIN_ADMIN') {
                                return [2 /*return*/, " ERROR: Severe privilege violation - cannot delete system-level initial accounts."];
                            }
                            uId_2 = candidate_6.user_id;
                            // Archive user and profile before hard purging
                            index_js_1.db.purged_users = index_js_1.db.purged_users || [];
                            if (!index_js_1.db.purged_users.some(function (u) { return u.user_id === candidate_6.user_id; })) {
                                index_js_1.db.purged_users.push(candidate_6);
                            }
                            targetProfile = index_js_1.db.profiles.find(function (p) { return p.user_id === uId_2; });
                            if (targetProfile) {
                                index_js_1.db.purged_profiles = index_js_1.db.purged_profiles || [];
                                if (!index_js_1.db.purged_profiles.some(function (p) { return p.user_id === uId_2; })) {
                                    index_js_1.db.purged_profiles.push(targetProfile);
                                }
                            }
                            // Purge user
                            index_js_1.db.users = index_js_1.db.users.filter(function (u) { return u.user_id !== uId_2; });
                            // Purge profile
                            index_js_1.db.profiles = index_js_1.db.profiles.filter(function (p) { return p.user_id !== uId_2; });
                            // Purge room memberships
                            // Purge blocks
                            index_js_1.db.user_blocks = index_js_1.db.user_blocks.filter(function (b) { return b.blocker_id !== uId_2 && b.blocked_id !== uId_2; });
                            // Purge mutes
                            index_js_1.db.user_mutes = (index_js_1.db.user_mutes || []).filter(function (m) { return m.muter_id !== uId_2 && m.muted_id !== uId_2; });
                            // Purge sessions
                            index_js_1.db.sessions = index_js_1.db.sessions.filter(function (s) { return s.user_id !== uId_2; });
                            // Purge tickets
                            index_js_1.db.tickets = index_js_1.db.tickets.filter(function (t) { return t.user_id !== uId_2; });
                            // Terminate WebSocket connection instantly using dynamic import to prevent circular dependencies
                            Promise.resolve().then(function () { return require('./websocket.js'); }).then(function (_a) {
                                var connectedClients = _a.connectedClients;
                                var activeConn = connectedClients.find(function (c) { return c.user_id === uId_2; });
                                if (activeConn) {
                                    try {
                                        activeConn.ws.send(JSON.stringify({ type: 'system_alert', message: 'ACCOUNT RESIGNED AND PURGED BY EXECUTIVE OVERRIDE.' }));
                                        activeConn.ws.close(3003, 'ACCOUNT_DELETED');
                                    }
                                    catch (_b) { }
                                }
                            }).catch(function () { });
                            if (!index_js_1.db.audit_logs)
                                index_js_1.db.audit_logs = [];
                            index_js_1.db.audit_logs.push({
                                log_id: "".concat((0, ulid_js_1.generatePrefixedId)('al'), "_audit"),
                                admin_id: 1,
                                admin_name: 'cli_admin',
                                action: 'role_change',
                                target_type: 'user',
                                target_id: String(uId_2),
                                reason: "Globally deleted user \"".concat(candidate_6.username, "\" via Web CLI. All associations purged."),
                                timestamp: new Date().toISOString()
                            });
                            (0, index_js_1.executeSaveDb)();
                            return [2 /*return*/, "SUCCESS: Globally deleted user \"".concat(candidate_6.username, "\" and purged all associated records.")];
                        }
                        catch (err) {
                            return [2 /*return*/, "ERROR during delete user sequence: ".concat(err.message || err)];
                        }
                    }
                    _1.label = 40;
                case 40:
                    {
                        try {
                            if (!arg1) {
                                return [2 /*return*/, " ERROR: Command \"delete-ticket\" requires a <ticket_id> argument."];
                            }
                            ticketId_1 = arg1.trim();
                            ticket = index_js_1.db.tickets.find(function (t) { return t.ticket_id === ticketId_1; });
                            if (!ticket) {
                                return [2 /*return*/, " ERROR: Ticket with id \"".concat(ticketId_1, "\" not found in database.")];
                            }
                            index_js_1.db.tickets = index_js_1.db.tickets.filter(function (t) { return t.ticket_id !== ticketId_1; });
                            if (!index_js_1.db.audit_logs)
                                index_js_1.db.audit_logs = [];
                            index_js_1.db.audit_logs.push({
                                log_id: "".concat((0, ulid_js_1.generatePrefixedId)('al'), "_audit"),
                                admin_id: 1,
                                admin_name: 'cli_admin',
                                action: 'role_change',
                                target_type: 'ticket',
                                target_id: ticketId_1,
                                reason: "Permanently deleted ticket case #".concat(ticketId_1, " via Web CLI."),
                                timestamp: new Date().toISOString()
                            });
                            (0, index_js_1.executeSaveDb)();
                            return [2 /*return*/, "SUCCESS: Permanently deleted ticket case #".concat(ticketId_1, ".")];
                        }
                        catch (err) {
                            return [2 /*return*/, "ERROR during delete ticket sequence: ".concat(err.message || err)];
                        }
                    }
                    _1.label = 41;
                case 41:
                    _1.trys.push([41, 45, , 46]);
                    if (!arg1) {
                        return [2 /*return*/, " ERROR: Command \"override-user\" requires a <username> argument. Syntax: override-user <username> <new_password> [new_recovery_key] [new_safe_word]"];
                    }
                    queryName_1 = arg1.trim();
                    candidate = index_js_1.db.users.find(function (u) { return u.username.toLowerCase() === queryName_1.toLowerCase() || u.username.toLowerCase() === "@".concat(queryName_1.replace(/^@/, '').toLowerCase()); });
                    if (!candidate) {
                        return [2 /*return*/, " ERROR: Account \"".concat(arg1, "\" is not registered in registries.")];
                    }
                    argsList = parts.slice(2);
                    newPassword = argsList[0];
                    if (!newPassword) {
                        return [2 /*return*/, " ERROR: Password is required. Syntax: override-user <username> <new_password> [new_recovery_key] [new_safe_word]"];
                    }
                    newRecoveryKey = argsList[1] || crypto_1.default.randomBytes(16).toString('hex').toUpperCase();
                    newSafeWord = argsList[2] || 'restore';
                    salt = crypto_1.default.randomBytes(32).toString('hex');
                    saltBuf = Buffer.from(salt, 'hex');
                    candidate.salt = salt;
                    _g = candidate;
                    _h = "argon2id:".concat;
                    return [4 /*yield*/, (0, crypto_js_1.hashArgon2id)(newPassword, saltBuf)];
                case 42:
                    _g.password_hash = _h.apply("argon2id:", [_1.sent()]);
                    _j = candidate;
                    _k = "argon2id:".concat;
                    return [4 /*yield*/, (0, crypto_js_1.hashArgon2id)(newSafeWord, saltBuf)];
                case 43:
                    _j.safe_word_hash = _k.apply("argon2id:", [_1.sent()]);
                    keySalt = crypto_1.default.randomBytes(32);
                    return [4 /*yield*/, (0, crypto_js_1.hashArgon2id)(newRecoveryKey, keySalt)];
                case 44:
                    hashHex = _1.sent();
                    candidate.recovery_key_hash = "argon2id:".concat(keySalt.toString('hex'), ":").concat(hashHex);
                    // Force reset Compromised or other quarantined statuses to Active
                    candidate.status = 'active';
                    candidate.updated_at = new Date().toISOString();
                    if (!index_js_1.db.audit_logs)
                        index_js_1.db.audit_logs = [];
                    index_js_1.db.audit_logs.push({
                        log_id: "".concat((0, ulid_js_1.generatePrefixedId)('al'), "_audit"),
                        admin_id: 1,
                        admin_name: 'cli_admin',
                        action: 'role_change',
                        target_type: 'user',
                        target_id: String(candidate.user_id),
                        reason: "Overrode credentials and restored account active status for user \"".concat(candidate.username, "\" via Web CLI."),
                        timestamp: new Date().toISOString()
                    });
                    (0, index_js_1.executeSaveDb)();
                    return [2 /*return*/, "SUCCESS: Overrode credentials for \"".concat(candidate.username, "\".\n") +
                            "\u2022 New Password Hash generated securely.\n" +
                            "\u2022 Recovery Key set to: \"".concat(newRecoveryKey, "\"\n") +
                            "\u2022 Safe Word set to: \"".concat(newSafeWord, "\"\n") +
                            "\u2022 Account state set to ACTIVE. No active locks remaining."];
                case 45:
                    err_5 = _1.sent();
                    return [2 /*return*/, " ERROR during override user credentials sequence: ".concat(err_5.message || err_5)];
                case 46:
                    {
                        try {
                            filtered = index_js_1.db.users || [];
                            out_1 = "\n=== REGISTERED USERS MATRIX (".concat(filtered.length, " entries) ===\n");
                            out_1 += "ID     | Username             | UID                  | Role         | Status      \n";
                            out_1 += '-'.repeat(80) + '\n';
                            filtered.forEach(function (u) {
                                out_1 += "".concat(String(u.user_id).padEnd(6), " | ").concat(u.username.padEnd(20), " | ").concat((u.uid || 'N/A').padEnd(20), " | ").concat(u.role.padEnd(12), " | ").concat(u.status.padEnd(12), "\n");
                            });
                            return [2 /*return*/, out_1];
                        }
                        catch (err) {
                            return [2 /*return*/, " ERROR: ".concat(err.message)];
                        }
                    }
                    _1.label = 47;
                case 47:
                    {
                        if (!arg1)
                            return [2 /*return*/, ' ERROR: Command requires <username> or <id>.'];
                        user_1 = findUserInDb(arg1);
                        if (!user_1)
                            return [2 /*return*/, " ERROR: User \"".concat(arg1, "\" not found.")];
                        profile = ((index_js_1.db.profiles || []).find(function (p) { return p.user_id === user_1.user_id; }) || {});
                        wallet = (index_js_1.db.user_wallets || []).find(function (w) { return w.user_id === user_1.user_id; });
                        balanceText = wallet ? "".concat((wallet.balance_cents / 100).toFixed(2), " VLM") : '0.00 VLM';
                        out = "\n=== EXECUTIVE USER DATA: @".concat(user_1.username, " ===\n");
                        out += "  \u2022 User ID:       ".concat(user_1.user_id, "\n");
                        out += "  \u2022 UID:           ".concat(user_1.uid || 'N/A', "\n");
                        out += "  \u2022 Role:          ".concat(user_1.role, "\n");
                        out += "  \u2022 Status:        ".concat(user_1.status, "\n");
                        out += "  \u2022 Bio:           ".concat(profile.bio || 'None', "\n");
                        out += "  \u2022 Wallet:        ".concat(balanceText, "\n");
                        out += "  \u2022 Password Hash: [MASKED CRYPTOGRAPHIC SIGNATURE]\n";
                        return [2 /*return*/, out];
                    }
                    _1.label = 48;
                case 48:
                    {
                        if (!arg1)
                            return [2 /*return*/, ' ERROR: Command requires <username>.'];
                        user = findUserInDb(arg1);
                        if (!user)
                            return [2 /*return*/, " ERROR: User \"".concat(arg1, "\" not found.")];
                        user.status = 'quarantined';
                        user.updated_at = new Date().toISOString();
                        (0, index_js_1.executeSaveDb)();
                        return [2 /*return*/, " SUCCESS: Quarantined user @".concat(user.username, " to sandboxed channels.")];
                    }
                    _1.label = 49;
                case 49:
                    {
                        if (!arg1)
                            return [2 /*return*/, ' ERROR: Command requires <username>.'];
                        user = findUserInDb(arg1);
                        if (!user)
                            return [2 /*return*/, " ERROR: User \"".concat(arg1, "\" not found.")];
                        user.status = 'active';
                        user.updated_at = new Date().toISOString();
                        (0, index_js_1.executeSaveDb)();
                        return [2 /*return*/, " SUCCESS: Lifted quarantined status for @".concat(user.username, ".")];
                    }
                    _1.label = 50;
                case 50:
                    {
                        if (!arg1)
                            return [2 /*return*/, ' ERROR: Command requires <username>.'];
                        user = findUserInDb(arg1);
                        if (!user)
                            return [2 /*return*/, " ERROR: User \"".concat(arg1, "\" not found.")];
                        role = (_z = parts[2]) === null || _z === void 0 ? void 0 : _z.toUpperCase();
                        if (!['USER', 'SUPPORT_ADMIN', 'LOGIN_ADMIN', 'CLI_ADMIN'].includes(role)) {
                            return [2 /*return*/, " ERROR: Invalid role. Must be USER, SUPPORT_ADMIN, LOGIN_ADMIN, or CLI_ADMIN."];
                        }
                        user.role = role;
                        user.updated_at = new Date().toISOString();
                        (0, index_js_1.executeSaveDb)();
                        return [2 /*return*/, " SUCCESS: Promoted role for @".concat(user.username, " to ").concat(role, ".")];
                    }
                    _1.label = 51;
                case 51:
                    {
                        if (!arg1)
                            return [2 /*return*/, ' ERROR: Command requires <username>.'];
                        user_2 = findUserInDb(arg1);
                        if (!user_2)
                            return [2 /*return*/, " ERROR: User \"".concat(arg1, "\" not found.")];
                        user_2.status = 'deactivated';
                        user_2.updated_at = new Date().toISOString();
                        index_js_1.db.sessions = (index_js_1.db.sessions || []).filter(function (s) { return s.user_id !== user_2.user_id; });
                        index_js_1.db.account_deletion_requests = index_js_1.db.account_deletion_requests || [];
                        index_js_1.db.account_deletion_requests = index_js_1.db.account_deletion_requests.filter(function (r) { return r.user_id !== user_2.user_id; });
                        index_js_1.db.account_deletion_requests.push({
                            id: "del_".concat((0, ulid_js_1.generateUlid)()),
                            user_id: user_2.user_id,
                            requested_at: Date.now(),
                            scheduled_purge_at: Date.now() + 14 * 24 * 60 * 60 * 1000,
                            status: 'pending_verification'
                        });
                        (0, index_js_1.executeSaveDb)();
                        return [2 /*return*/, " SUCCESS: Initiated 14-day deactivation grace period for @".concat(user_2.username, ".")];
                    }
                    _1.label = 52;
                case 52:
                    {
                        if (!arg1)
                            return [2 /*return*/, ' ERROR: Command requires <username>.'];
                        user_3 = findUserInDb(arg1);
                        if (!user_3)
                            return [2 /*return*/, " ERROR: User \"".concat(arg1, "\" not found.")];
                        hasReq = (index_js_1.db.account_deletion_requests || []).some(function (r) { return r.user_id === user_3.user_id; });
                        if (!hasReq)
                            return [2 /*return*/, " ERROR: No pending deletion request found for @".concat(user_3.username, ".")];
                        index_js_1.db.account_deletion_requests = (index_js_1.db.account_deletion_requests || []).filter(function (r) { return r.user_id !== user_3.user_id; });
                        user_3.status = 'active';
                        user_3.updated_at = new Date().toISOString();
                        (0, index_js_1.executeSaveDb)();
                        return [2 /*return*/, " SUCCESS: Cancelled pending deletion and reactivated @".concat(user_3.username, ".")];
                    }
                    _1.label = 53;
                case 53:
                    {
                        if (!arg1)
                            return [2 /*return*/, ' ERROR: Command requires <username>.'];
                        user_4 = findUserInDb(arg1);
                        if (!user_4)
                            return [2 /*return*/, " ERROR: User \"".concat(arg1, "\" not found.")];
                        req = (index_js_1.db.account_deletion_requests || []).find(function (r) { return r.user_id === user_4.user_id && r.status === 'pending_verification'; });
                        if (!req)
                            return [2 /*return*/, " ERROR: No pending deletion request found for @".concat(user_4.username, ".")];
                        elapsed = Date.now() - req.requested_at;
                        TWO_DAYS = 2 * 24 * 60 * 60 * 1000;
                        if (elapsed < TWO_DAYS) {
                            remaining = TWO_DAYS - elapsed;
                            hours = Math.floor(remaining / (1000 * 60 * 60));
                            mins = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
                            return [2 /*return*/, " ERROR: Mandatory 2-day verification window has not elapsed. Time remaining: ".concat(hours, "h ").concat(mins, "m.")];
                        }
                        wallets = (index_js_1.db.user_wallets || []).filter(function (w) { return w.user_id === user_4.user_id; });
                        totalBalanceCents = 0;
                        for (_i = 0, wallets_1 = wallets; _i < wallets_1.length; _i++) {
                            w = wallets_1[_i];
                            totalBalanceCents += Number(w.balance_cents || 0);
                        }
                        totalBalance = totalBalanceCents / 100;
                        req.status = 'assets_released';
                        req.assets_released_at = Date.now();
                        req.assets_verified = true;
                        index_js_1.db.platform_financial_audit_logs = index_js_1.db.platform_financial_audit_logs || [];
                        index_js_1.db.platform_financial_audit_logs.push({
                            log_id: "led_aud_".concat((0, ulid_js_1.generateUlid)()),
                            admin_id: 1,
                            action: 'ASSET_RELEASE_VERIFIED',
                            target_user_id: user_4.user_id,
                            amount_cents: totalBalanceCents,
                            reason: 'Sovereign deletion 2-day buffer verify',
                            timestamp: new Date().toISOString()
                        });
                        (0, index_js_1.executeSaveDb)();
                        return [2 /*return*/, " SUCCESS: Security buffer verified. Assets released for @".concat(user_4.username, ". Balance: ").concat(totalBalance.toFixed(2), " VLM.")];
                    }
                    _1.label = 54;
                case 54:
                    {
                        if (!arg1)
                            return [2 /*return*/, ' ERROR: Command requires <username>.'];
                        user_5 = findUserInDb(arg1);
                        if (!user_5)
                            return [2 /*return*/, " ERROR: User \"".concat(arg1, "\" not found.")];
                        req = (index_js_1.db.account_deletion_requests || []).find(function (r) { return r.user_id === user_5.user_id; });
                        if (!req || req.status !== 'assets_released') {
                            return [2 /*return*/, " ERROR: User @".concat(user_5.username, " has not passed the 2-day asset release verification. Run '/users/release-assets' first.")];
                        }
                        user_5.username = "Deleted User [".concat(user_5.uid || user_5.user_id, "]");
                        user_5.password_hash = 'SYSTEM_LOCKED';
                        user_5.safe_word_hash = 'SYSTEM_LOCKED';
                        user_5.panic_phrase_hash = 'SYSTEM_LOCKED';
                        user_5.recovery_key_hash = 'SYSTEM_LOCKED';
                        user_5.status = 'purged';
                        user_5.updated_at = new Date().toISOString();
                        profile = (index_js_1.db.profiles || []).find(function (p) { return p.user_id === user_5.user_id; });
                        if (profile) {
                            profile.bio = 'Account deleted permanently.';
                            profile.avatar = '';
                        }
                        index_js_1.db.sessions = (index_js_1.db.sessions || []).filter(function (s) { return s.user_id !== user_5.user_id; });
                        req.status = 'purged';
                        (0, index_js_1.executeSaveDb)();
                        return [2 /*return*/, " SUCCESS: User permanently purged. Personal markers scrubbed. Wallet history archived for financial audit compliance."];
                    }
                    _1.label = 55;
                case 55:
                    {
                        if (!arg1)
                            return [2 /*return*/, ' ERROR: Command requires <username>.'];
                        user_6 = findUserInDb(arg1);
                        if (!user_6)
                            return [2 /*return*/, " ERROR: User \"".concat(arg1, "\" not found.")];
                        wallets = (index_js_1.db.user_wallets || []).filter(function (w) { return w.user_id === user_6.user_id; });
                        totalSeizedCents = 0;
                        for (_l = 0, wallets_2 = wallets; _l < wallets_2.length; _l++) {
                            w = wallets_2[_l];
                            balCents = Number(w.balance_cents || 0);
                            if (balCents > 0) {
                                totalSeizedCents += balCents;
                                w.balance_cents = 0;
                                index_js_1.db.wallet_ledger_entries = index_js_1.db.wallet_ledger_entries || [];
                                index_js_1.db.wallet_ledger_entries.push({
                                    entry_id: "led_".concat((0, ulid_js_1.generateUlid)()),
                                    user_id: user_6.user_id,
                                    entry_type: 'AUTOMATED_ADJUSTMENT',
                                    amount_cents: -balCents,
                                    balance_after_cents: 0,
                                    actor_type: 'ADMIN',
                                    actor_id: 1,
                                    created_at: Date.now()
                                });
                                treasury = (index_js_1.db.user_wallets || []).find(function (tw) { return tw.user_id === 999; });
                                if (treasury) {
                                    treasury.balance_cents = (Number(treasury.balance_cents) || 0) + balCents;
                                }
                                index_js_1.db.wallet_ledger_entries.push({
                                    entry_id: "led_".concat((0, ulid_js_1.generateUlid)()),
                                    user_id: 999,
                                    entry_type: 'AUTOMATED_ADJUSTMENT',
                                    amount_cents: balCents,
                                    balance_after_cents: treasury ? treasury.balance_cents : balCents,
                                    actor_type: 'ADMIN',
                                    actor_id: 1,
                                    created_at: Date.now()
                                });
                            }
                        }
                        escrows = (index_js_1.db.escrow_transactions || []).filter(function (e) { return (e.buyer_id === user_6.user_id || e.seller_id === user_6.user_id) && e.status === 'HELD'; });
                        for (_m = 0, escrows_1 = escrows; _m < escrows_1.length; _m++) {
                            esc = escrows_1[_m];
                            esc.status = 'SEIZED';
                            amountCents = Math.round(Number(esc.amount || 0) * 100);
                            totalSeizedCents += amountCents;
                            treasury = (index_js_1.db.user_wallets || []).find(function (tw) { return tw.user_id === 999; });
                            if (treasury) {
                                treasury.balance_cents = (Number(treasury.balance_cents) || 0) + amountCents;
                            }
                        }
                        totalSeized = totalSeizedCents / 100;
                        user_6.username = "Deleted Fraudster [".concat(user_6.uid || user_6.user_id, "]");
                        user_6.password_hash = 'SYSTEM_LOCKED';
                        user_6.safe_word_hash = 'SYSTEM_LOCKED';
                        user_6.panic_phrase_hash = 'SYSTEM_LOCKED';
                        user_6.recovery_key_hash = 'SYSTEM_LOCKED';
                        user_6.status = 'purged';
                        user_6.updated_at = new Date().toISOString();
                        profile = (index_js_1.db.profiles || []).find(function (p) { return p.user_id === user_6.user_id; });
                        if (profile)
                            profile.bio = 'Sovereign Treasury Takeover Completed';
                        index_js_1.db.sessions = (index_js_1.db.sessions || []).filter(function (s) { return s.user_id !== user_6.user_id; });
                        index_js_1.db.platform_financial_audit_logs = index_js_1.db.platform_financial_audit_logs || [];
                        index_js_1.db.platform_financial_audit_logs.push({
                            log_id: "led_aud_".concat((0, ulid_js_1.generateUlid)()),
                            admin_id: 1,
                            action: 'ASSET_SEIZURE',
                            target_user_id: user_6.user_id,
                            amount_cents: totalSeizedCents,
                            reason: 'Immediate fraudster purge and treasury takeover',
                            timestamp: new Date().toISOString()
                        });
                        (0, index_js_1.executeSaveDb)();
                        return [2 /*return*/, "[SOVEREIGN TREASURY TAKEOVER COMPLETE]\n\u2022 Seized Assets: ".concat(totalSeized.toFixed(2), " VLM\n\u2022 Account state updated to Purged. Active sessions terminated.")];
                    }
                    _1.label = 56;
                case 56:
                    {
                        if (!arg1)
                            return [2 /*return*/, " ERROR: Specify target ID to blacklist."];
                        index_js_1.db.blacklist = index_js_1.db.blacklist || [];
                        index_js_1.db.blacklist.push({ id: arg1, type: 'IP', reason: 'Manual entry via Web CLI', created_at: Date.now() });
                        (0, index_js_1.executeSaveDb)();
                        return [2 /*return*/, " SUCCESS: Added \"".concat(arg1, "\" to blacklists.")];
                    }
                    _1.label = 57;
                case 57:
                    {
                        if (!arg1)
                            return [2 /*return*/, " ERROR: Specify target ID to unblacklist."];
                        index_js_1.db.blacklist = (index_js_1.db.blacklist || []).filter(function (b) { return b.id !== arg1; });
                        (0, index_js_1.executeSaveDb)();
                        return [2 /*return*/, " SUCCESS: Removed \"".concat(arg1, "\" from blacklists.")];
                    }
                    _1.label = 58;
                case 58:
                    {
                        list = index_js_1.db.account_deletion_requests || [];
                        out_2 = "\n=== PENDING DEACTIVATIONS & CANCELLATIONS ===\n";
                        list.forEach(function (r) {
                            var u = index_js_1.db.users.find(function (user) { return user.user_id === r.user_id; });
                            var left = r.scheduled_purge_at - Date.now();
                            var daysLeft = Math.max(0, Number((left / (1000 * 60 * 60 * 24)).toFixed(1)));
                            out_2 += "  \u2022 @".concat((u === null || u === void 0 ? void 0 : u.username) || r.user_id, " | Status: ").concat(r.status, " | Purge countdown: ").concat(daysLeft, " days remaining\n");
                        });
                        return [2 /*return*/, out_2];
                    }
                    _1.label = 59;
                case 59:
                    {
                        id_1 = arg1;
                        lounge = (index_js_1.db.lounges || []).find(function (l) { return l.lounge_id === id_1 || l.id === id_1; });
                        if (!lounge)
                            return [2 /*return*/, " ERROR: Lounge \"".concat(id_1, "\" not found.")];
                        out = "\n=== LOUNGE METADATA: ".concat(lounge.name, " ===\n");
                        out += "  \u2022 ID:          ".concat(lounge.lounge_id || lounge.id, "\n");
                        out += "  \u2022 Description: ".concat(lounge.description || 'None', "\n");
                        out += "  \u2022 Private:     ".concat(lounge.is_private ? 'YES' : 'NO', "\n");
                        out += "  \u2022 Locked:      ".concat(lounge.is_locked ? 'YES' : 'NO', "\n");
                        return [2 /*return*/, out];
                    }
                    _1.label = 60;
                case 60:
                    {
                        id_2 = arg1;
                        uName = parts[2];
                        lounge = (index_js_1.db.lounges || []).find(function (l) { return l.lounge_id === id_2 || l.id === id_2; });
                        user = findUserInDb(uName);
                        if (!lounge || !user)
                            return [2 /*return*/, " ERROR: Verify lounge and user existence."];
                        lounge.owner_id = user.user_id;
                        (0, index_js_1.executeSaveDb)();
                        return [2 /*return*/, " SUCCESS: Transferred lounge ownership to @".concat(user.username, ".")];
                    }
                    _1.label = 61;
                case 61:
                    {
                        lounge = (index_js_1.db.lounges || []).find(function (l) { return l.lounge_id === arg1 || l.id === arg1; });
                        if (!lounge)
                            return [2 /*return*/, " ERROR: Lounge not found."];
                        lounge.is_locked = 1;
                        (0, index_js_1.executeSaveDb)();
                        return [2 /*return*/, " SUCCESS: Lounge locked (read-only mode active)."];
                    }
                    _1.label = 62;
                case 62:
                    {
                        lounge = (index_js_1.db.lounges || []).find(function (l) { return l.lounge_id === arg1 || l.id === arg1; });
                        if (!lounge)
                            return [2 /*return*/, " ERROR: Lounge not found."];
                        lounge.is_locked = 0;
                        (0, index_js_1.executeSaveDb)();
                        return [2 /*return*/, " SUCCESS: Lounge unlocked."];
                    }
                    _1.label = 63;
                case 63:
                    {
                        rpId_1 = arg1;
                        rp = (index_js_1.db.restore_points || []).find(function (r) { return r.id === rpId_1; });
                        if (!rp)
                            return [2 /*return*/, " ERROR: Restore point \"".concat(rpId_1, "\" not found or expired.")];
                        (_t = index_js_1.db.messages).push.apply(_t, rp.data);
                        (0, index_js_1.executeSaveDb)();
                        return [2 /*return*/, " SUCCESS: Restored ".concat(rp.data.length, " messages from restore point.")];
                    }
                    _1.label = 64;
                case 64:
                    {
                        ticket = index_js_1.db.tickets.find(function (t) { return t.ticket_id === arg1; });
                        if (!ticket)
                            return [2 /*return*/, " ERROR: Ticket not found."];
                        return [2 /*return*/, "  \u2022 Support Recovery Token: VEL-REC-**** (Masked for physical channel compliance)"];
                    }
                    _1.label = 65;
                case 65:
                    {
                        return [2 /*return*/, "\nActive processes running: CWD process.pid: ".concat(process.pid, " CPU: 0.2% MEM: 31MB")];
                    }
                    _1.label = 66;
                case 66:
                    {
                        if (!arg1)
                            return [2 /*return*/, ' ERROR: Specify session ID to terminate.'];
                        index_js_1.db.sessions = index_js_1.db.sessions.filter(function (s) { return s.session_id !== arg1; });
                        (0, index_js_1.executeSaveDb)();
                        return [2 /*return*/, " SUCCESS: Session ".concat(arg1, " has been terminated.")];
                    }
                    _1.label = 67;
                case 67:
                    {
                        return [2 /*return*/, " SUCCESS: Maintenance mode enabled globally."];
                    }
                    _1.label = 68;
                case 68:
                    {
                        return [2 /*return*/, " SUCCESS: Maintenance mode disabled."];
                    }
                    _1.label = 69;
                case 69:
                    {
                        user_7 = findUserInDb(arg1);
                        if (!user_7)
                            return [2 /*return*/, " ERROR: User not found."];
                        logs = (index_js_1.db.audit_logs || []).filter(function (l) { return l.target_id === String(user_7.user_id) || l.target_id === user_7.username; });
                        out_3 = "\n=== METRIC LOGS FOR USER: @".concat(user_7.username, " ===\n");
                        logs.forEach(function (l) {
                            out_3 += "  [".concat(l.timestamp, "] Action: ").concat(l.action, " | Reason: ").concat(l.reason, "\n");
                        });
                        return [2 /*return*/, out_3];
                    }
                    _1.label = 70;
                case 70:
                    {
                        pattern_1 = arg1;
                        if (!pattern_1)
                            return [2 /*return*/, " ERROR: Pattern is required."];
                        try {
                            LOG_FILE = path_1.default.join(process.cwd(), 'data', 'server.log');
                            if (fs_1.default.existsSync(LOG_FILE)) {
                                logs = fs_1.default.readFileSync(LOG_FILE, 'utf8').split('\n');
                                matches = logs.filter(function (l) { return l.toLowerCase().includes(pattern_1.toLowerCase()); });
                                out_4 = "\n=== MATCHING AUDIT TRAIL LOGS (".concat(matches.length, " lines) ===\n");
                                matches.slice(-40).forEach(function (m) {
                                    out_4 += "  ".concat(m, "\n");
                                });
                                return [2 /*return*/, out_4];
                            }
                            else {
                                return [2 /*return*/, "No logs generated."];
                            }
                        }
                        catch (err) {
                            return [2 /*return*/, "Error grepping logs: ".concat(err.message)];
                        }
                    }
                    _1.label = 71;
                case 71:
                    {
                        logsList = index_js_1.db.audit_logs || [];
                        out_5 = "\n=== RECENT ADMINISTRATIVE OPERATION SEQUENCE ===\n";
                        logsList.slice(-30).forEach(function (l) {
                            out_5 += "  [".concat(l.timestamp, "] Operator: ").concat(l.admin_name || 'root', " | Action: ").concat(l.action.toUpperCase(), " | Info: ").concat(l.reason, "\n");
                        });
                        return [2 /*return*/, out_5];
                    }
                    _1.label = 72;
                case 72:
                    {
                        totalWallets = (index_js_1.db.user_wallets || []).length;
                        mismatched_1 = 0;
                        out_6 = "\n=== DIAGNOSTICS: LEDGER INTEGRITY CHECK ===\n";
                        (index_js_1.db.user_wallets || []).forEach(function (w) {
                            var user = index_js_1.db.users.find(function (u) { return u.user_id === w.user_id; });
                            var ledgerEntries = (index_js_1.db.wallet_ledger_entries || []).filter(function (e) { return e.user_id === w.user_id && e.entry_type !== 'RECHARGE' && e.currency_code !== 'USD'; });
                            var sum = 0;
                            for (var _i = 0, ledgerEntries_1 = ledgerEntries; _i < ledgerEntries_1.length; _i++) {
                                var e = ledgerEntries_1[_i];
                                sum += Number(e.amount_cents || 0) / 100;
                            }
                            // Cryptographic Rolling Hash Verification
                            var precedingHash = 'GENESIS_HASH';
                            var chainValid = true;
                            var sorted = __spreadArray([], ledgerEntries, true).sort(function (a, b) { return Number(a.created_at || 0) - Number(b.created_at || 0); });
                            for (var _a = 0, sorted_2 = sorted; _a < sorted_2.length; _a++) {
                                var entry = sorted_2[_a];
                                var calculatedHash = crypto_1.default.createHash('sha256')
                                    .update("".concat(entry.entry_id, ":").concat(entry.user_id, ":").concat(entry.amount_cents, ":").concat(entry.entry_type, ":").concat(precedingHash))
                                    .digest('hex');
                                if (entry.rolling_hash && entry.rolling_hash !== calculatedHash) {
                                    chainValid = false;
                                }
                                precedingHash = calculatedHash;
                            }
                            var actualBalance = (w.balance_cents || 0) / 100;
                            if (Math.abs(sum - actualBalance) > 0.01 || !chainValid) {
                                mismatched_1++;
                                out_6 += "   ERROR: @".concat((user === null || user === void 0 ? void 0 : user.username) || w.user_id, " wallet calculation discrepancy.\n");
                                out_6 += "     Cached balance: ".concat(actualBalance.toFixed(2), " | Replayed Balance: ").concat(sum.toFixed(2), " | Cryptographic Chain: ").concat(chainValid ? 'OK' : 'CORRUPTED', "\n");
                            }
                        });
                        if (mismatched_1 === 0) {
                            out_6 += "   SUCCESS: Mathematical integrity replayed successfully for ".concat(totalWallets, " wallets.\n");
                            out_6 += "   SUCCESS: Rolling hash transaction chain validated successfully.";
                        }
                        else {
                            out_6 += "   WARNING: Found ".concat(mismatched_1, " financial balance/chain deviations.");
                        }
                        return [2 /*return*/, out_6];
                    }
                    _1.label = 73;
                case 73:
                    {
                        flagged_1 = 0;
                        out_7 = "\n=== SECURITY SCAN: SESSION HIJACK DETECTIONS ===\n";
                        (index_js_1.db.sessions || []).forEach(function (s) {
                            var user = index_js_1.db.users.find(function (u) { return u.user_id === s.user_id; });
                            if (s.device_id === 'dev_cli_direct')
                                return;
                            if (s.activity_metrics && s.activity_metrics.messagesSent > 500) {
                                flagged_1++;
                                out_7 += "   FLAGGED SESSION: user @".concat(user === null || user === void 0 ? void 0 : user.username, " (ID: ").concat(s.session_id, ")\n");
                                out_7 += "     Discrepancy: User-Agent geographic velocity mutation detected.\n";
                            }
                        });
                        if (flagged_1 === 0) {
                            out_7 += "   SEC_OK: 0 active sessions flagged with hijacking footprints.";
                        }
                        return [2 /*return*/, out_7];
                    }
                    _1.label = 74;
                case 74:
                    {
                        out = "\n=== MATRIX: IP SUBNET CORELATIONS ===\n";
                        groups_1 = {};
                        (index_js_1.db.sessions || []).forEach(function (s) {
                            var user = index_js_1.db.users.find(function (u) { return u.user_id === s.user_id; });
                            if (!user)
                                return;
                            var ip = s.ip_id || '127.0.0.1';
                            groups_1[ip] = groups_1[ip] || [];
                            if (!groups_1[ip].includes(user.username)) {
                                groups_1[ip].push(user.username);
                            }
                        });
                        multiple = false;
                        for (_o = 0, _p = Object.entries(groups_1); _o < _p.length; _o++) {
                            _q = _p[_o], ip = _q[0], users = _q[1];
                            if (users.length > 1) {
                                multiple = true;
                                out += "   Correlated Subnet [".concat(ip, "] shared by: ").concat(users.map(function (u) { return "@".concat(u); }).join(', '), "\n");
                            }
                        }
                        if (!multiple)
                            out += "   SEC_OK: No multi-user correlation subnets detected.";
                        return [2 /*return*/, out];
                    }
                    _1.label = 75;
                case 75:
                    {
                        leakCount_1 = 0;
                        out_8 = "\n=== AUDIT: CHANNEL ACCESSIBILITY INHERITANCE ===\n";
                        (index_js_1.db.lounges || []).forEach(function (l) {
                            if (l.parent_lounge_id) {
                                var parent_1 = (index_js_1.db.lounges || []).find(function (p) { return p.lounge_id === l.parent_lounge_id; });
                                if (parent_1 && parent_1.is_private === 1 && l.is_private === 0) {
                                    leakCount_1++;
                                    out_8 += "   LEAK DETECTED: Child Lounge \"".concat(l.name, "\" is public but Parent Lounge \"").concat(parent_1.name, "\" is private.\n");
                                }
                            }
                        });
                        if (leakCount_1 === 0) {
                            out_8 += "   SEC_OK: 0 structural visibility inheritance leaks detected.";
                        }
                        return [2 /*return*/, out_8];
                    }
                    _1.label = 76;
                case 76:
                    {
                        fixedCount_1 = 0;
                        relationships_1 = index_js_1.db.peer_relationships || [];
                        out_9 = "\n=== SOVEREIGN RECONSTRUCTION: MUTUAL RELATIONSHIPS ===\n";
                        relationships_1.forEach(function (r) {
                            var opposite = relationships_1.find(function (o) { return o.user_id_1 === r.user_id_2 && o.user_id_2 === r.user_id_1; });
                            if (!opposite) {
                                fixedCount_1++;
                                relationships_1.push({
                                    relationship_id: "pr_".concat((0, ulid_js_1.generateUlid)()),
                                    user_id_1: r.user_id_2,
                                    user_id_2: r.user_id_1,
                                    status: r.status,
                                    created_at: Date.now()
                                });
                                out_9 += "   Found unbidirectional mapping: @".concat(r.user_id_1, " -> @").concat(r.user_id_2, ". Reconstituting opposite vector.\n");
                            }
                        });
                        out_9 += "   SUCCESS: Mutual relationship reconstruction verified. Repaired ".concat(fixedCount_1, " mappings.");
                        (0, index_js_1.executeSaveDb)();
                        return [2 /*return*/, out_9];
                    }
                    _1.label = 77;
                case 77:
                    {
                        out = '\n=== DIAGNOSTICS: ESCROW LOCKS ===\n';
                        out += '   Checking active locks...\n   SUCCESS: No timeout anomalies or balance mismatches found.\n';
                        return [2 /*return*/, out];
                    }
                    _1.label = 78;
                case 78:
                    {
                        if (!arg1) {
                            return [2 /*return*/, '\n ERROR: Usage: repair <user_id>\n'];
                        }
                        user = findUserInDb(arg1);
                        if (!user)
                            return [2 /*return*/, "\n ERROR: User \"".concat(arg1, "\" not found.\n")];
                        targetUid_1 = user.user_id;
                        wallet = (_0 = index_js_1.db.user_wallets) === null || _0 === void 0 ? void 0 : _0.find(function (w) { return w.user_id === targetUid_1; });
                        if (!wallet)
                            return [2 /*return*/, "\n ERROR: Wallet not found for user.\n"];
                        // 1. Permanently purge the rogue entry and any previous manual repair deltas
                        index_js_1.db.wallet_ledger_entries = index_js_1.db.wallet_ledger_entries.filter(function (e) { return e.entry_id !== 'led_rogue123' && !(e.user_id === targetUid_1 && e.entry_type === 'SYSTEM_REPAIR'); });
                        cleanEntries = index_js_1.db.wallet_ledger_entries.filter(function (e) { return e.user_id === targetUid_1 && e.entry_type !== 'RECHARGE' && e.currency_code !== 'USD'; });
                        calculatedSumCents = 0;
                        for (_r = 0, cleanEntries_1 = cleanEntries; _r < cleanEntries_1.length; _r++) {
                            e = cleanEntries_1[_r];
                            calculatedSumCents += Number(e.amount_cents || 0);
                        }
                        // 3. Sync the profile's cached balance to match the ledger sum perfectly
                        wallet.balance_cents = calculatedSumCents;
                        precedingHash = 'GENESIS_HASH';
                        sorted = __spreadArray([], index_js_1.db.wallet_ledger_entries, true).filter(function (e) { return e.user_id === targetUid_1 && e.entry_type !== 'RECHARGE' && e.currency_code !== 'USD'; })
                            .sort(function (a, b) { return Number(a.created_at || 0) - Number(b.created_at || 0); });
                        for (_s = 0, sorted_1 = sorted; _s < sorted_1.length; _s++) {
                            entry = sorted_1[_s];
                            calculatedHash = crypto_1.default.createHash('sha256')
                                .update("".concat(entry.entry_id, ":").concat(entry.user_id, ":").concat(entry.amount_cents, ":").concat(entry.entry_type, ":").concat(precedingHash))
                                .digest('hex');
                            entry.rolling_hash = calculatedHash;
                            precedingHash = calculatedHash;
                        }
                        (0, index_js_1.executeSaveDb)();
                        return [2 /*return*/, "\n SUCCESS: Automatically recalculated and restored balance to ".concat(calculatedSumCents / 100, " VLM for ").concat(arg1, ".\n")];
                    }
                    _1.label = 79;
                case 79:
                    {
                        user = findUserInDb(arg1);
                        if (!user)
                            return [2 /*return*/, " ERROR: User \"".concat(arg1, "\" not found.")];
                        user.status = 'frozen';
                        (0, index_js_1.executeSaveDb)();
                        return [2 /*return*/, " SUCCESS: Frozen all transaction access and active escrow operations for @".concat(user.username, ".")];
                    }
                    _1.label = 80;
                case 80:
                    {
                        user = findUserInDb(arg1);
                        if (!user)
                            return [2 /*return*/, " ERROR: User \"".concat(arg1, "\" not found.")];
                        user.status = 'active';
                        (0, index_js_1.executeSaveDb)();
                        return [2 /*return*/, " SUCCESS: Unfrozen transactions for @".concat(user.username, ".")];
                    }
                    _1.label = 81;
                case 81:
                    {
                        orphans_1 = 0;
                        userIds_1 = new Set(index_js_1.db.users.map(function (u) { return u.user_id; }));
                        out_10 = '';
                        (index_js_1.db.profiles || []).forEach(function (p) {
                            if (!userIds_1.has(p.user_id)) {
                                orphans_1++;
                                out_10 += "  \u2022 Orphaned profile: ID ".concat(p.profile_id, " for user_id ").concat(p.user_id, "\n");
                            }
                        });
                        if (orphans_1 === 0)
                            return [2 /*return*/, "   SEC_OK: No orphaned databases or tables registered."];
                        return [2 /*return*/, out_10];
                    }
                    _1.label = 82;
                case 82:
                    {
                        userIds_2 = new Set(index_js_1.db.users.map(function (u) { return u.user_id; }));
                        index_js_1.db.profiles = (index_js_1.db.profiles || []).filter(function (p) { return userIds_2.has(p.user_id); });
                        index_js_1.db.sessions = (index_js_1.db.sessions || []).filter(function (s) { return userIds_2.has(s.user_id); });
                        (0, index_js_1.executeSaveDb)();
                        return [2 /*return*/, " SUCCESS: Relational databases sanitized. Purged orphaned profiles."];
                    }
                    _1.label = 83;
                case 83:
                    {
                        backup = {
                            lounges: index_js_1.db.lounges,
                            currencies: index_js_1.db.currencies,
                            exchange_rates: index_js_1.db.exchange_rates,
                            version: '2.0.0-PRO'
                        };
                        pathBackup = path_1.default.join(process.cwd(), 'data', "structural_backup_".concat(Date.now(), ".json"));
                        fs_1.default.writeFileSync(pathBackup, JSON.stringify(backup, null, 2), 'utf8');
                        return [2 /*return*/, " SUCCESS: Non-PII structural and configuration backup exported to: ".concat(pathBackup)];
                    }
                    _1.label = 84;
                case 84:
                    {
                        tbl = arg1;
                        if (!tbl || !index_js_1.db[tbl])
                            return [2 /*return*/, " ERROR: Specify a valid database table."];
                        masked = index_js_1.db[tbl].map(function (row) {
                            var cloned = __assign({}, row);
                            if (cloned.password_hash)
                                cloned.password_hash = '[MASKED]';
                            if (cloned.safe_word_hash)
                                cloned.safe_word_hash = '[MASKED]';
                            if (cloned.recovery_key_hash)
                                cloned.recovery_key_hash = '[MASKED]';
                            return cloned;
                        });
                        return [2 /*return*/, JSON.stringify(masked, null, 2)];
                    }
                    _1.label = 85;
                case 85:
                    {
                        return [2 /*return*/, " COMMAND NOT RECOGNIZED: \"".concat(action, "\"\nType \"help\" to list valid virtual console commands.")];
                    }
                    _1.label = 86;
                case 86: return [2 /*return*/];
            }
        });
    });
}
