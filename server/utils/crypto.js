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
exports.legacyDecryptionSucceeded = exports.DB_CRYPTO_KEY_LEGACY = exports.DB_CRYPTO_KEY = void 0;
exports.setLegacyDecryptionSucceeded = setLegacyDecryptionSucceeded;
exports.encryptData = encryptData;
exports.decryptData = decryptData;
exports.hashArgon2id = hashArgon2id;
exports.verifyArgon2id = verifyArgon2id;
exports.checkCredential = checkCredential;
exports.getStepOTP = getStepOTP;
exports.checkStepOTP = checkStepOTP;
var crypto_1 = require("crypto");
var fs_1 = require("fs");
var path_1 = require("path");
var crypto_js_1 = require("../crypto.js");
// Use environment variable if set, otherwise use secure persisted random key & salt
var keyPath = path_1.default.join(process.cwd(), 'data', '.key');
var loadedKey = '';
var loadedSalt = '';
try {
    if (fs_1.default.existsSync(keyPath)) {
        var rawContent = fs_1.default.readFileSync(keyPath, 'utf8').trim();
        try {
            var parsed = JSON.parse(rawContent);
            if (parsed && parsed.key) {
                loadedKey = parsed.key;
                loadedSalt = parsed.salt || '';
            }
        }
        catch (_) {
            loadedKey = rawContent;
        }
    }
}
catch (err) {
    console.warn('[SYS-SECURE] Failed reading persisted .key file:', err);
}
var encryptionKeySource = process.env.DB_ENCRYPTION_KEY;
var dbCryptoSalt = process.env.DB_ENCRYPTION_SALT || '';
if (!encryptionKeySource || !dbCryptoSalt) {
    if (!encryptionKeySource) {
        if (loadedKey) {
            encryptionKeySource = loadedKey;
        }
        else {
            encryptionKeySource = crypto_1.default.randomBytes(32).toString('hex');
        }
    }
    if (!dbCryptoSalt) {
        if (loadedSalt) {
            dbCryptoSalt = loadedSalt;
        }
        else {
            dbCryptoSalt = crypto_1.default.randomBytes(16).toString('hex');
        }
    }
    try {
        var keyDir = path_1.default.dirname(keyPath);
        if (!fs_1.default.existsSync(keyDir)) {
            fs_1.default.mkdirSync(keyDir, { recursive: true });
        }
        fs_1.default.writeFileSync(keyPath, JSON.stringify({ key: encryptionKeySource, salt: dbCryptoSalt }), 'utf8');
    }
    catch (err) {
        console.error('[SYS-SECURE] Failed to save/update persistent encryption parameters:', err);
    }
}
exports.DB_CRYPTO_KEY = crypto_1.default.scryptSync(encryptionKeySource, dbCryptoSalt, 32);
exports.DB_CRYPTO_KEY_LEGACY = crypto_1.default.scryptSync(encryptionKeySource, 'salt_velum', 32);
// Fallback keys derived from the persisted .key file (even if env overrides are active)
var fileCryptoKey = null;
var fileCryptoKeyLegacy = null;
if (loadedKey) {
    try {
        fileCryptoKey = crypto_1.default.scryptSync(loadedKey, loadedSalt || 'salt_velum', 32);
        fileCryptoKeyLegacy = crypto_1.default.scryptSync(loadedKey, 'salt_velum', 32);
    }
    catch (err) {
        console.error('[SYS-SECURE] Failed to derive fallback keys from file:', err);
    }
}
exports.legacyDecryptionSucceeded = false;
function setLegacyDecryptionSucceeded(val) {
    exports.legacyDecryptionSucceeded = val;
}
var encryptionCache = new Map();
var decryptionCache = new Map();
function encryptData(text) {
    if (encryptionCache.has(text)) {
        return encryptionCache.get(text);
    }
    var iv = crypto_1.default.randomBytes(12);
    var cipher = crypto_1.default.createCipheriv('aes-256-gcm', exports.DB_CRYPTO_KEY, iv);
    var encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    var tag = cipher.getAuthTag().toString('hex');
    var result = "".concat(iv.toString('hex'), ":").concat(encrypted, ":").concat(tag);
    if (encryptionCache.size > 5000) {
        encryptionCache.clear();
    }
    encryptionCache.set(text, result);
    return result;
}
function decryptData(encryptedText) {
    if (!encryptedText) {
        throw new Error('Database decryption error: Empty payload.');
    }
    if (decryptionCache.has(encryptedText)) {
        return decryptionCache.get(encryptedText);
    }
    var parts = encryptedText.split(':');
    if (parts.length !== 3) {
        throw new Error('Database decryption error: Invalid encrypted GCM envelope format.');
    }
    var ivHex = parts[0], encryptedHex = parts[1], tagHex = parts[2];
    var iv = Buffer.from(ivHex, 'hex');
    var tag = Buffer.from(tagHex, 'hex');
    // Try primary key first
    try {
        var decipher = crypto_1.default.createDecipheriv('aes-256-gcm', exports.DB_CRYPTO_KEY, iv);
        decipher.setAuthTag(tag);
        var decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        if (decryptionCache.size > 5000) {
            decryptionCache.clear();
        }
        decryptionCache.set(encryptedText, decrypted);
        return decrypted;
    }
    catch (primaryErr) {
        // Try legacy fallback key (primary source + standard salt)
        try {
            var decipher = crypto_1.default.createDecipheriv('aes-256-gcm', exports.DB_CRYPTO_KEY_LEGACY, iv);
            decipher.setAuthTag(tag);
            var decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            exports.legacyDecryptionSucceeded = true;
            if (decryptionCache.size > 5000) {
                decryptionCache.clear();
            }
            decryptionCache.set(encryptedText, decrypted);
            return decrypted;
        }
        catch (_) {
            // Try fallback to key file (original encryption parameters)
            if (fileCryptoKey && !fileCryptoKey.equals(exports.DB_CRYPTO_KEY)) {
                try {
                    var decipher = crypto_1.default.createDecipheriv('aes-256-gcm', fileCryptoKey, iv);
                    decipher.setAuthTag(tag);
                    var decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
                    decrypted += decipher.final('utf8');
                    exports.legacyDecryptionSucceeded = true;
                    if (decryptionCache.size > 5000) {
                        decryptionCache.clear();
                    }
                    decryptionCache.set(encryptedText, decrypted);
                    return decrypted;
                }
                catch (_) { }
            }
            // Try fallback to key file legacy parameters
            if (fileCryptoKeyLegacy && !fileCryptoKeyLegacy.equals(exports.DB_CRYPTO_KEY_LEGACY)) {
                try {
                    var decipher = crypto_1.default.createDecipheriv('aes-256-gcm', fileCryptoKeyLegacy, iv);
                    decipher.setAuthTag(tag);
                    var decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
                    decrypted += decipher.final('utf8');
                    exports.legacyDecryptionSucceeded = true;
                    if (decryptionCache.size > 5000) {
                        decryptionCache.clear();
                    }
                    decryptionCache.set(encryptedText, decrypted);
                    return decrypted;
                }
                catch (_) { }
            }
            throw primaryErr; // Rethrow primary decryption failure if legacy also fails
        }
    }
}
function hashArgon2id(plainText, saltBuffer) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, (0, crypto_js_1.hashArgon2id)(plainText, saltBuffer)];
        });
    });
}
function verifyArgon2id(plainText, userSalt, storedHash) {
    return __awaiter(this, void 0, void 0, function () {
        var parts, computed, computed;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!storedHash)
                        return [2 /*return*/, false];
                    if (!storedHash.startsWith('argon2id:')) return [3 /*break*/, 4];
                    parts = storedHash.split(':');
                    if (!(parts.length === 2)) return [3 /*break*/, 2];
                    if (!userSalt)
                        return [2 /*return*/, false];
                    return [4 /*yield*/, hashArgon2id(plainText, Buffer.from(userSalt, 'hex'))];
                case 1:
                    computed = _a.sent();
                    return [2 /*return*/, (0, crypto_js_1.safeCompare)(computed, parts[1])];
                case 2:
                    if (!(parts.length === 3)) return [3 /*break*/, 4];
                    return [4 /*yield*/, hashArgon2id(plainText, Buffer.from(parts[1], 'hex'))];
                case 3:
                    computed = _a.sent();
                    return [2 /*return*/, (0, crypto_js_1.safeCompare)(computed, parts[2])];
                case 4: return [2 /*return*/, false];
            }
        });
    });
}
function checkCredential(plainText, user, storedHash) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            if (!storedHash)
                return [2 /*return*/, false];
            if (storedHash.startsWith('argon2id:')) {
                return [2 /*return*/, verifyArgon2id(plainText, user.salt, storedHash)];
            }
            return [2 /*return*/, false];
        });
    });
}
function getStepOTP() {
    var interval = Math.floor(Date.now() / 120000);
    var hash = crypto_1.default.createHash('sha256').update("".concat(interval, "_velum_otp")).digest('hex');
    var numericValue = parseInt(hash.substring(0, 8), 16);
    return String(numericValue % 1000000).padStart(6, '0');
}
function checkStepOTP(token) {
    if (!token)
        return false;
    var currentInterval = Math.floor(Date.now() / 120000);
    for (var offset = -1; offset <= 1; offset++) {
        var val = currentInterval + offset;
        var hash = crypto_1.default.createHash('sha256').update("".concat(val, "_velum_otp")).digest('hex');
        var numericValue = parseInt(hash.substring(0, 8), 16);
        var otp = String(numericValue % 1000000).padStart(6, '0');
        if (token === otp) {
            return true;
        }
    }
    return false;
}
