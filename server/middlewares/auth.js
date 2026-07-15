"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifySessionToken = exports.generateSessionToken = exports.authenticateAdmin = exports.authenticateUser = exports.authRateLimiter = exports.rateLimiterCache = void 0;
var crypto_1 = require("crypto");
var db_js_1 = require("../db.js");
exports.rateLimiterCache = new Map();
// Enhanced rate limiter with IP and user-based tracking
var authRateLimiter = function (req, res, next) {
    var ip = req.ip || '127.0.0.1';
    var now = Date.now();
    // Prune expired entries from cache to avoid memory leaks
    for (var _i = 0, _a = exports.rateLimiterCache.entries(); _i < _a.length; _i++) {
        var _b = _a[_i], key = _b[0], value = _b[1];
        if (value.expiresAt && now > value.expiresAt) {
            exports.rateLimiterCache.delete(key);
        }
        else if (value.blockUntil && now > value.blockUntil) {
            exports.rateLimiterCache.delete(key);
        }
    }
    var record = exports.rateLimiterCache.get(ip);
    if (record) {
        if (now > record.expiresAt) {
            exports.rateLimiterCache.set(ip, { count: 1, expiresAt: now + 60000 });
            next();
        }
        else {
            record.count += 1;
            // Stricter limit for auth endpoints: 20 requests per minute
            if (record.count > 20) {
                return res.status(429).json({ error: 'Too many authentication attempts. Please wait.' });
            }
            next();
        }
    }
    else {
        exports.rateLimiterCache.set(ip, { count: 1, expiresAt: now + 60000 });
        next();
    }
};
exports.authRateLimiter = authRateLimiter;
var authenticateUser = function (req, res, next) {
    var _a;
    try {
        var authHeader = req.headers.authorization;
        var xSessionId = req.headers['x-session-id'];
        var sessionId = '';
        if (authHeader && authHeader.startsWith('Bearer ')) {
            sessionId = authHeader.substring(7);
        }
        else if (xSessionId) {
            sessionId = xSessionId;
        }
        if (!sessionId) {
            return res.status(401).json({ error: 'Unauthorized: Session security token missing.' });
        }
        var hashedSessionId_1 = crypto_1.default.createHash('sha256').update(sessionId).digest('hex');
        var sess_1 = (db_js_1.db.sessions || []).find(function (s) { return s && s.session_id === hashedSessionId_1; });
        if (!sess_1) {
            return res.status(401).json({ error: 'Unauthorized: Session expired or invalid.' });
        }
        if (sess_1.expires_at) {
            var expiresTime = new Date(sess_1.expires_at).getTime();
            var now_1 = Date.now();
            if (now_1 > expiresTime) {
                return res.status(401).json({ error: 'Unauthorized: Session expired. Please log in again.' });
            }
        }
        // OWASP Session Management: 30-minute Idle Timeout
        var IDLE_TIMEOUT_MS = 30 * 60 * 1000;
        var now = Date.now();
        var lastPingTime = ((_a = sess_1.activity_metrics) === null || _a === void 0 ? void 0 : _a.lastPing) ? new Date(sess_1.activity_metrics.lastPing).getTime() : 0;
        if (lastPingTime && (now - lastPingTime > IDLE_TIMEOUT_MS)) {
            sess_1.status = 'expired';
            (0, db_js_1.saveDb)();
            return res.status(401).json({ error: 'Unauthorized: Session idle timeout exceeded. Please log in again.' });
        }
        // Slide activity window only if more than 30 seconds have elapsed to throttle DB writes
        if (!lastPingTime || (now - lastPingTime > 30000)) {
            if (!sess_1.activity_metrics) {
                sess_1.activity_metrics = { messagesSent: 0, lastPing: new Date().toISOString() };
            }
            else {
                sess_1.activity_metrics.lastPing = new Date().toISOString();
            }
            (0, db_js_1.saveDb)();
        }
        var u = (db_js_1.db.users || []).find(function (user) { return user && Number(user.user_id) === Number(sess_1.user_id); });
        if (!u) {
            return res.status(401).json({ error: 'Unauthorized: User not found.' });
        }
        req.user = u;
        req.sessionId = sessionId;
        next();
    }
    catch (err) {
        console.error('Authentication Error:', err);
        res.status(501).json({ error: 'Authentication protocol exception.' });
    }
};
exports.authenticateUser = authenticateUser;
// Secondary administrator authentication constraint gates
var authenticateAdmin = function (req, res, next) {
    (0, exports.authenticateUser)(req, res, function () {
        var user = req.user;
        if (!user || (user.role !== 'CLI_ADMIN' && user.role !== 'LOGIN_ADMIN' && user.role !== 'SUPPORT_ADMIN')) {
            return res.status(403).json({ error: 'Forbidden: Security authorization escalated clearance required.' });
        }
        req.adminUser = user;
        next();
    });
};
exports.authenticateAdmin = authenticateAdmin;
// Create a secure cryptographic random session token
var generateSessionToken = function (userId, username, role, deviceId, sessionId) {
    return sessionId || crypto_1.default.randomBytes(32).toString('hex');
};
exports.generateSessionToken = generateSessionToken;
// Verify session tokens during websocket handshakes
var verifySessionToken = function (token) {
    if (!token)
        return null;
    (0, db_js_1.loadDb)();
    var hashedSessionId = crypto_1.default.createHash('sha256').update(token).digest('hex');
    var sess = (db_js_1.db.sessions || []).find(function (s) { return s && s.session_id === hashedSessionId && s.status === 'active'; });
    if (!sess)
        return null;
    if (sess.expires_at) {
        var expiresTime = new Date(sess.expires_at).getTime();
        var now = Date.now();
        if (now > expiresTime) {
            return null;
        }
    }
    return { session_id: sess.session_id };
};
exports.verifySessionToken = verifySessionToken;
