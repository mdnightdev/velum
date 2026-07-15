"use strict";
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
exports.BACKUP_COOLDOWN_MS = exports.backupTimer = exports.lastBackupAttemptTime = exports.isCloudBackupDisabled = void 0;
exports.setCloudBackupDisabled = setCloudBackupDisabled;
exports.initPgBackupTable = initPgBackupTable;
exports.getSafeDatabaseBackupBinary = getSafeDatabaseBackupBinary;
exports.restoreDbFromCloud = restoreDbFromCloud;
exports.backupDbToCloud = backupDbToCloud;
exports.executeCloudBackup = executeCloudBackup;
var fs_1 = require("fs");
var zlib_1 = require("zlib");
var database_js_1 = require("../config/database.js");
var index_js_1 = require("../db/index.js");
var crypto_js_1 = require("../utils/crypto.js");
exports.isCloudBackupDisabled = true;
exports.lastBackupAttemptTime = 0;
exports.backupTimer = null;
exports.BACKUP_COOLDOWN_MS = 60 * 1000;
function setCloudBackupDisabled(val) {
    exports.isCloudBackupDisabled = val;
}
function initPgBackupTable() {
    return __awaiter(this, void 0, void 0, function () {
        var pool, err_1, errStr;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (exports.isCloudBackupDisabled)
                        return [2 /*return*/];
                    pool = (0, database_js_1.getPgPool)();
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, pool.query("\n      CREATE TABLE IF NOT EXISTS velum_backups (\n        id VARCHAR(255) PRIMARY KEY,\n        sqlite_base64 TEXT NOT NULL,\n        gzip BOOLEAN DEFAULT TRUE,\n        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n      )\n    ")];
                case 2:
                    _a.sent();
                    console.log('[SYS-SECURE] Neon PostgreSQL backups table verified/created.');
                    return [3 /*break*/, 4];
                case 3:
                    err_1 = _a.sent();
                    errStr = String((err_1 === null || err_1 === void 0 ? void 0 : err_1.message) || err_1);
                    console.warn("[SYS-SECURE] Neon PostgreSQL connection/setup failed: ".concat(errStr, ". Disabling cloud backups for this session."));
                    exports.isCloudBackupDisabled = true;
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function getSafeDatabaseBackupBinary() {
    try {
        if (fs_1.default.existsSync(index_js_1.DB_FILE)) {
            return fs_1.default.readFileSync(index_js_1.DB_FILE);
        }
        var plainJson = JSON.stringify(index_js_1.db);
        var encryptedData = (0, crypto_js_1.encryptData)(plainJson);
        return Buffer.from(encryptedData, 'utf8');
    }
    catch (err) {
        console.error('[SYS-SECURE] Error reading state database for cloud backup:', err);
        return null;
    }
}
function restoreDbFromCloud() {
    return __awaiter(this, void 0, void 0, function () {
        var pool, res, row, base64, binData, err_2, errStr;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (process.env.DISABLE_CLOUD_BACKUP === '1' || exports.isCloudBackupDisabled) {
                        console.log('[SYS-SECURE] Cloud persistence offline or disabled. Skipping cloud restore.');
                        return [2 /*return*/];
                    }
                    console.log('[SYS-SECURE] Querying Neon PostgreSQL for latest persistent database backup...');
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, , 5]);
                    return [4 /*yield*/, initPgBackupTable()];
                case 2:
                    _a.sent();
                    if (exports.isCloudBackupDisabled)
                        return [2 /*return*/];
                    pool = (0, database_js_1.getPgPool)();
                    return [4 /*yield*/, pool.query('SELECT sqlite_base64, gzip FROM velum_backups ORDER BY updated_at DESC LIMIT 1')];
                case 3:
                    res = _a.sent();
                    row = res.rows[0];
                    if (!row) {
                        console.log('[SYS-SECURE] No previous cloud backup found in Neon PostgreSQL. Initializing zero-state system.');
                        return [2 /*return*/];
                    }
                    base64 = row.sqlite_base64;
                    if (base64) {
                        binData = Buffer.from(base64, 'base64');
                        if (row.gzip === true) {
                            try {
                                binData = zlib_1.default.gunzipSync(binData);
                                console.log('[SYS-SECURE] Successfully decompressed Neon PostgreSQL database backup using gzip.');
                            }
                            catch (decompErr) {
                                console.error('[SYS-SECURE] Failed to decompress gzip backup:', decompErr.message || decompErr);
                            }
                        }
                        try {
                            fs_1.default.writeFileSync(index_js_1.DB_FILE, binData);
                            if (fs_1.default.existsSync(index_js_1.SQLITE_FILE)) {
                                try {
                                    fs_1.default.unlinkSync(index_js_1.SQLITE_FILE);
                                    console.log('[SYS-SECURE] Stale local SQLite file invalidated to apply fresh cloud backup state.');
                                }
                                catch (unlinkErr) {
                                    console.error('[SYS-SECURE] Failed to unlink stale SQLite file during cloud restoration:', unlinkErr);
                                }
                            }
                            console.log("[SYS-SECURE] Database successfully restored from Neon PostgreSQL. Size: ".concat(Math.round(binData.length / 1024), " KB."));
                        }
                        catch (fileErr) {
                            console.error('[SYS-SECURE] Failed during database restoration write step:', fileErr);
                        }
                    }
                    else {
                        console.log('[SYS-SECURE] Neon PostgreSQL backup found but empty. Initializing new storage.');
                    }
                    return [3 /*break*/, 5];
                case 4:
                    err_2 = _a.sent();
                    errStr = String((err_2 === null || err_2 === void 0 ? void 0 : err_2.message) || err_2);
                    console.warn("[SYS-SECURE] Neon PostgreSQL restore failed: ".concat(errStr, ". Disabling cloud backups."));
                    exports.isCloudBackupDisabled = true;
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    });
}
function backupDbToCloud() {
    return __awaiter(this, void 0, void 0, function () {
        var now, timeSinceLastBackup, delay;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (exports.isCloudBackupDisabled)
                        return [2 /*return*/];
                    if (exports.backupTimer)
                        return [2 /*return*/]; // Already queued to backup
                    now = Date.now();
                    timeSinceLastBackup = now - exports.lastBackupAttemptTime;
                    if (!(timeSinceLastBackup < exports.BACKUP_COOLDOWN_MS)) return [3 /*break*/, 1];
                    delay = exports.BACKUP_COOLDOWN_MS - timeSinceLastBackup;
                    exports.backupTimer = setTimeout(function () { return __awaiter(_this, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    exports.backupTimer = null;
                                    return [4 /*yield*/, executeCloudBackup()];
                                case 1:
                                    _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); }, delay);
                    return [3 /*break*/, 3];
                case 1: return [4 /*yield*/, executeCloudBackup()];
                case 2:
                    _a.sent();
                    _a.label = 3;
                case 3: return [2 /*return*/];
            }
        });
    });
}
function executeCloudBackup() {
    return __awaiter(this, void 0, void 0, function () {
        var binary, compressedBinary, base64, pool, id, pgErr_1, errStr, err_3, errStr;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (exports.isCloudBackupDisabled || process.env.DISABLE_CLOUD_BACKUP === '1')
                        return [2 /*return*/];
                    exports.lastBackupAttemptTime = Date.now();
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 7, , 8]);
                    binary = getSafeDatabaseBackupBinary();
                    if (!binary)
                        return [2 /*return*/];
                    compressedBinary = zlib_1.default.gzipSync(binary);
                    base64 = compressedBinary.toString('base64');
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 5, , 6]);
                    return [4 /*yield*/, initPgBackupTable()];
                case 3:
                    _a.sent();
                    if (exports.isCloudBackupDisabled)
                        return [2 /*return*/];
                    pool = (0, database_js_1.getPgPool)();
                    id = "backup_".concat(Date.now());
                    return [4 /*yield*/, pool.query('INSERT INTO velum_backups (id, sqlite_base64, gzip, updated_at) VALUES ($1, $2, $3, NOW())', [id, base64, true])];
                case 4:
                    _a.sent();
                    console.log("[SYS-SECURE] Neon PostgreSQL backup created. Original: ".concat(Math.round(binary.length / 1024), " KB, Compressed: ").concat(Math.round(compressedBinary.length / 1024), " KB"));
                    return [3 /*break*/, 6];
                case 5:
                    pgErr_1 = _a.sent();
                    errStr = String((pgErr_1 === null || pgErr_1 === void 0 ? void 0 : pgErr_1.message) || pgErr_1);
                    console.warn("[SYS-SECURE] Neon PostgreSQL backup failed: ".concat(errStr, ". Disabling cloud backups."));
                    exports.isCloudBackupDisabled = true;
                    return [3 /*break*/, 6];
                case 6: return [3 /*break*/, 8];
                case 7:
                    err_3 = _a.sent();
                    errStr = String((err_3 === null || err_3 === void 0 ? void 0 : err_3.message) || err_3);
                    console.warn("[SYS-SECURE] CLOUD BACKUP SEQUENCE FAILURE: ".concat(errStr, ". Disabling cloud backups."));
                    exports.isCloudBackupDisabled = true;
                    return [3 /*break*/, 8];
                case 8: return [2 /*return*/];
            }
        });
    });
}
