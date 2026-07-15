"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BASE32_CHARS = void 0;
exports.generateUlid = generateUlid;
exports.generatePrefixedId = generatePrefixedId;
var crypto_1 = require("crypto");
exports.BASE32_CHARS = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
function generateUlid(seedTime) {
    if (seedTime === void 0) { seedTime = Date.now(); }
    var timePart = '';
    var timeVal = seedTime;
    for (var i = 0; i < 10; i++) {
        var mod = timeVal % 32;
        timePart = exports.BASE32_CHARS[mod] + timePart;
        timeVal = Math.floor(timeVal / 32);
    }
    var randomPart = '';
    var randBytes = crypto_1.default.randomBytes(10);
    for (var i = 0; i < 10; i++) {
        var index = randBytes[i] % 32;
        randomPart += exports.BASE32_CHARS[index];
    }
    return timePart + randomPart;
}
function generatePrefixedId(prefix) {
    return "".concat(prefix, "_").concat(generateUlid());
}
