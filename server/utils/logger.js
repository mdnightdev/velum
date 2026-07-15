"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeServerLog = writeServerLog;
var fs_1 = require("fs");
var path_1 = require("path");
function writeServerLog(message) {
    try {
        var logPath = path_1.default.join(process.cwd(), 'data', 'server.log');
        var logDir = path_1.default.dirname(logPath);
        if (!fs_1.default.existsSync(logDir)) {
            fs_1.default.mkdirSync(logDir, { recursive: true });
        }
        var timestamp = new Date().toISOString();
        fs_1.default.appendFileSync(logPath, "[".concat(timestamp, "] ").concat(message, "\n"), 'utf8');
    }
    catch (err) {
        // Fail silently to prevent logging operations from impacting runtime stability
    }
}
