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
exports.nonceCache = void 0;
exports.hashArgon2id = hashArgon2id;
exports.safeCompare = safeCompare;
exports.isValidUsername = isValidUsername;
exports.normalizeUsername = normalizeUsername;
exports.pruneNonceCache = pruneNonceCache;
exports.generateLoginNonce = generateLoginNonce;
exports.verifyAndConsumeNonce = verifyAndConsumeNonce;
exports.calculateBackoffMs = calculateBackoffMs;
var crypto_1 = require("crypto");
var hash_wasm_1 = require("hash-wasm");
var logger_js_1 = require("./utils/logger.js");
// OWASP ASVS v4.0 Recommended Argon2id Parameters (Memory: 15MiB, Iterations: 3, Parallelism: 1)
var ARGON2_ITERATIONS = 3;
var ARGON2_MEMORY = 15360; // 15 MiB in KiB
var ARGON2_PARALLELISM = 1;
var ARGON2_HASH_LENGTH = 32;
/**
 * Hash a plain text string using Argon2id with standard OWASP configuration.
 */
function hashArgon2id(plainText, saltBuffer) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, (0, hash_wasm_1.argon2id)({
                    password: plainText,
                    salt: new Uint8Array(saltBuffer),
                    parallelism: ARGON2_PARALLELISM,
                    iterations: ARGON2_ITERATIONS,
                    memorySize: ARGON2_MEMORY,
                    hashLength: ARGON2_HASH_LENGTH,
                    outputType: 'hex'
                })];
        });
    });
}
/**
 * Constant-time comparison of two strings to prevent timing leaks.
 */
function safeCompare(a, b) {
    var aBuf = Buffer.from(a, 'utf8');
    var bBuf = Buffer.from(b, 'utf8');
    if (aBuf.length !== bBuf.length) {
        // Perform dummy timing-safe comparison to consume constant time
        crypto_1.default.timingSafeEqual(aBuf, aBuf);
        return false;
    }
    return crypto_1.default.timingSafeEqual(aBuf, bBuf);
}
/**
 * Validate username formatting (Alphanumeric, dots, underscores, length 3-30).
 */
function isValidUsername(username) {
    if (!username)
        return false;
    var clean = username.startsWith('@') ? username.substring(1) : username;
    return /^[a-zA-Z0-9._-]{3,30}$/.test(clean);
}
/**
 * Normalize username for consistent DB lookups.
 */
function normalizeUsername(username) {
    return username.trim().toLowerCase();
}
exports.nonceCache = new Map();
/**
 * Prune expired nonces to prevent memory leaks.
 */
function pruneNonceCache() {
    var now = Date.now();
    var TTL = 90 * 1000; // 90 seconds lifetime
    for (var _i = 0, _a = exports.nonceCache.entries(); _i < _a.length; _i++) {
        var _b = _a[_i], key = _b[0], value = _b[1];
        if (now - value.createdAt > TTL) {
            exports.nonceCache.delete(key);
        }
    }
}
/**
 * Generate a cryptographically secure single-use nonce.
 */
function generateLoginNonce() {
    pruneNonceCache();
    var nonce = crypto_1.default.randomBytes(32).toString('hex');
    exports.nonceCache.set(nonce, {
        nonce: nonce,
        createdAt: Date.now(),
        used: false
    });
    (0, logger_js_1.writeServerLog)("[SYS-SECURE] [NONCE-GEN] Generated secure login nonce: ".concat(nonce));
    return nonce;
}
/**
 * Verify and consume a nonce. Returns true if valid, single-use, and not expired.
 */
function verifyAndConsumeNonce(nonce) {
    pruneNonceCache();
    (0, logger_js_1.writeServerLog)("[SYS-SECURE] [NONCE-VERIFY] Verifying incoming nonce: ".concat(nonce, ". Cache size: ").concat(exports.nonceCache.size));
    var record = exports.nonceCache.get(nonce);
    if (!record) {
        (0, logger_js_1.writeServerLog)("[SYS-SECURE] [NONCE-FAIL] Nonce ".concat(nonce, " not found in cache. Current keys: ").concat(Array.from(exports.nonceCache.keys()).join(', ')));
        return false;
    }
    var TTL = 90 * 1000;
    if (Date.now() - record.createdAt > TTL) {
        exports.nonceCache.delete(nonce);
        return false;
    }
    if (record.used) {
        exports.nonceCache.delete(nonce);
        return false;
    }
    record.used = true;
    exports.nonceCache.delete(nonce);
    return true;
}
/**
 * Calculate progressive exponential backoff lockout milliseconds.
 */
function calculateBackoffMs(attempts) {
    if (attempts <= 5)
        return 0;
    var excess = attempts - 5;
    if (excess === 1)
        return 30 * 1000; // 30 seconds
    if (excess === 2)
        return 120 * 1000; // 2 minutes
    if (excess === 3)
        return 600 * 1000; // 10 minutes
    return 1800 * 1000; // 30 minutes max
}
