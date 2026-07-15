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
exports.connectedClients = exports.wss = void 0;
exports.broadcastToRoom = broadcastToRoom;
exports.handleVelumBotReply = handleVelumBotReply;
exports.setupCloudMessageSync = setupCloudMessageSync;
var ws_1 = require("ws");
var path_1 = require("path");
var fs_1 = require("fs");
var db_js_1 = require("../db.js");
var auth_js_1 = require("../middlewares/auth.js");
var sync_js_1 = require("./sync.js");
var presence_js_1 = require("./presence.js");
var ulid_js_1 = require("../utils/ulid.js");
var url_1 = require("url");
var __filename = (0, url_1.fileURLToPath)(import.meta.url);
var __dirname = path_1.default.dirname(__filename);
exports.wss = new ws_1.WebSocketServer({ noServer: true });
var wsLogStream = fs_1.default.createWriteStream(path_1.default.join(__dirname, 'ws.log'), { flags: 'a' });
var logWS = function (msg) { return wsLogStream.write("[".concat(new Date().toLocaleTimeString(), "] ").concat(msg, "\n")); };
exports.connectedClients = [];
exports.wss.on('connection', function (ws, req) {
    var _a;
    // Sync the latest state from SQLite relational tables on new socket handshake
    (0, db_js_1.loadDb)();
    // Try to read user session parameters or headers
    var urlParams = new URLSearchParams(((_a = req.url) === null || _a === void 0 ? void 0 : _a.split('?')[1]) || '');
    var userId = parseInt(urlParams.get('userId') || '0', 10);
    if (!userId) {
        ws.close(3000, 'Unauthorized user ID missing');
        return;
    }
    var rawToken = urlParams.get('token') || urlParams.get('sessionId') || '';
    var decoded = (0, auth_js_1.verifySessionToken)(rawToken);
    // If JWT verification fails, reject connection immediately
    if (!decoded) {
        ws.close(3003, 'Unauthorized: Invalid or expired session token.');
        return;
    }
    var sessionId = decoded.session_id;
    var userObj = db_js_1.db.users.find(function (u) { return u.user_id === userId; });
    if (!userObj || userObj.status !== 'active') {
        ws.close(3001, 'Unauthorized: User account suspended, quarantined, or not found.');
        return;
    }
    // If user is a SUPPORT_ADMIN, check if their base user has approved promotion status
    if (userObj.role === 'SUPPORT_ADMIN') {
        var baseCleanName_1 = userObj.username.replace(/^SA-/, '');
        var baseUser = db_js_1.db.users.find(function (u) { return u.username.replace(/^@/, '').toLowerCase() === baseCleanName_1.toLowerCase(); });
        if (!baseUser || baseUser.promotion_status !== 'APPROVED_SUPPORT') {
            ws.close(3200, 'Unauthorized: Security credentials revoked.');
            return;
        }
    }
    // Ensure active session exists in db.sessions
    var session = db_js_1.db.sessions.find(function (s) {
        return s.user_id === userId &&
            s.session_id === sessionId &&
            s.status === 'active';
    });
    if (!session) {
        ws.close(3002, 'Unauthorized: Active session expired or revoked.');
        return;
    }
    var client = {
        ws: ws,
        user_id: userId,
        session_id: sessionId || undefined,
        rooms: new Set(['velum_lounge']) // automatically join lobby
    };
    exports.connectedClients.push(client);
    logWS("WebSocket connected: User ".concat(userId, " (Total clients: ").concat(exports.connectedClients.length, ")"));
    // Update presence on connect
    (0, presence_js_1.updateUserPresence)(userId, 'online');
    // Handle messages
    ws.on('message', function (rawData) { return __awaiter(void 0, void 0, void 0, function () {
        var currentUserObj, baseCleanName_2, baseUser, currentSessionObj, payload_1, currentBan, roomId_1, ticketId_1, ticket, isAdmin, parts, isStandardDM, isVelumDM, isLounge, isPrivate, profile, isJoined, isOwner, isAdmin, isRoom_1, pLounge, profile, isJoined, isOwner, isAdmin, filteredHistory, targetRoomId_1, msgContent, isGloballyMuted, isRoom, activeMuteLoungeId_1, parts, p1_1, p2_1, user1, user2, blocked, msgId, userObjInfo, newMsg, responsePayload, parts, recipientId_1, recipientOnline_1, targetRoomId, msgObj, userObj_1, reactUser, targetRoomId, msgObj, userObj_2, reactUser_1, list, msgObj, senderUser, msgObj, senderUser, isAdmin, targetRoomId, ticketId_2, userObj_3, isAdmin, ticket, ticketId_3, userObj_4, isAdmin, ticket;
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        return __generator(this, function (_k) {
            try {
                // Synchronize transient database state from SQLite to prevent packet handling or authorization on stale data
                (0, db_js_1.loadDb)();
                currentUserObj = db_js_1.db.users.find(function (u) { return u.user_id === userId; });
                if (!currentUserObj || currentUserObj.status !== 'active') {
                    ws.send(JSON.stringify({ type: 'error', message: 'SESSION_TERMINATED: Account suspended, quarantined, or deleted.' }));
                    ws.close(3001, 'Account suspended, quarantined, or deleted.');
                    return [2 /*return*/];
                }
                // If user is a SUPPORT_ADMIN, check if their base user has approved promotion status
                if (currentUserObj.role === 'SUPPORT_ADMIN') {
                    baseCleanName_2 = currentUserObj.username.replace(/^SA-/, '');
                    baseUser = db_js_1.db.users.find(function (u) { return u.username.replace(/^@/, '').toLowerCase() === baseCleanName_2.toLowerCase(); });
                    if (!baseUser || baseUser.promotion_status !== 'APPROVED_SUPPORT') {
                        ws.send(JSON.stringify({ type: 'error', message: 'SESSION_TERMINATED: Security credentials revoked.' }));
                        ws.close(3200, 'Security credentials revoked.');
                        return [2 /*return*/];
                    }
                }
                currentSessionObj = db_js_1.db.sessions.find(function (s) {
                    return s.user_id === userId &&
                        s.session_id === sessionId &&
                        s.status === 'active';
                });
                if (!currentSessionObj) {
                    ws.send(JSON.stringify({ type: 'error', message: 'SESSION_TERMINATED: Active session expired or revoked.' }));
                    ws.close(3002, 'Active session expired or revoked.');
                    return [2 /*return*/];
                }
                payload_1 = JSON.parse(rawData.toString());
                if (payload_1 && payload_1.type === 'ping') {
                    if (ws.readyState === ws_1.WebSocket.OPEN) {
                        ws.send(JSON.stringify({ type: 'pong', sentAt: payload_1.sentAt }));
                    }
                    return [2 /*return*/];
                }
                currentBan = db_js_1.db.admin_sanctions.find(function (s) {
                    return s.user_id === userId &&
                        s.type === 'ban' &&
                        new Date(s.expires_at || 0).getTime() > Date.now();
                });
                if (currentBan) {
                    ws.send(JSON.stringify({ type: 'error', message: "BANNED: Access denied. Reason: ".concat(currentBan.reason) }));
                    ws.close(3001, 'Banned');
                    return [2 /*return*/];
                }
                // 1. Join room event
                if (payload_1.type === 'join_room') {
                    roomId_1 = payload_1.room_id;
                    // Security checks: if private or support tickets, verify ownership/membership
                    if (roomId_1.startsWith('ticket_')) {
                        ticketId_1 = roomId_1.replace('ticket_', '');
                        ticket = db_js_1.db.tickets.find(function (t) { return t.ticket_id === ticketId_1; });
                        isAdmin = currentUserObj.role === 'CLI_ADMIN' || currentUserObj.role === 'LOGIN_ADMIN' || currentUserObj.role === 'SUPPORT_ADMIN';
                        if (!ticket || (ticket.user_id !== userId && !isAdmin)) {
                            ws.send(JSON.stringify({ type: 'error', message: 'Forbidden: Ticket room access rejected.' }));
                            return [2 /*return*/];
                        }
                    }
                    else if (roomId_1.startsWith('dm_')) {
                        parts = roomId_1.split('_');
                        isStandardDM = parts.length === 3 && (parts[1] === String(userId) || parts[2] === String(userId));
                        isVelumDM = roomId_1 === "dm_velum_".concat(userId);
                        if (!isStandardDM && !isVelumDM) {
                            ws.send(JSON.stringify({ type: 'error', message: 'Forbidden: Private DM room access rejected.' }));
                            return [2 /*return*/];
                        }
                    }
                    else {
                        isLounge = (_a = db_js_1.db.lounges) === null || _a === void 0 ? void 0 : _a.find(function (l) { return l.lounge_id === roomId_1; });
                        if (isLounge) {
                            isPrivate = isLounge.visibility === 'private' || isLounge.visibility === 'invite_only' || isLounge.is_private === 1;
                            if (isPrivate) {
                                profile = (_b = db_js_1.db.profiles) === null || _b === void 0 ? void 0 : _b.find(function (p) { return p.user_id === userId; });
                                isJoined = (_c = profile === null || profile === void 0 ? void 0 : profile.joined_lounges) === null || _c === void 0 ? void 0 : _c.includes(roomId_1);
                                isOwner = String(isLounge.creator_id || isLounge.owner_id) === String(userId);
                                isAdmin = currentUserObj.role === 'CLI_ADMIN' || currentUserObj.role === 'LOGIN_ADMIN';
                                if (!isJoined && !isOwner && !isAdmin) {
                                    ws.send(JSON.stringify({ type: 'error', message: 'Forbidden: Private Lounge room access rejected.' }));
                                    return [2 /*return*/];
                                }
                            }
                        }
                        else {
                            isRoom_1 = (_d = db_js_1.db.lounge_rooms) === null || _d === void 0 ? void 0 : _d.find(function (r) { return r.id === roomId_1; });
                            if (isRoom_1) {
                                pLounge = (_e = db_js_1.db.lounges) === null || _e === void 0 ? void 0 : _e.find(function (l) { return l.lounge_id === isRoom_1.lounge_id; });
                                if (pLounge && (pLounge.visibility === 'private' || pLounge.visibility === 'invite_only' || pLounge.is_private === 1)) {
                                    profile = (_f = db_js_1.db.profiles) === null || _f === void 0 ? void 0 : _f.find(function (p) { return p.user_id === userId; });
                                    isJoined = (_g = profile === null || profile === void 0 ? void 0 : profile.joined_lounges) === null || _g === void 0 ? void 0 : _g.includes(pLounge.lounge_id);
                                    isOwner = String(pLounge.creator_id || pLounge.owner_id) === String(userId);
                                    isAdmin = currentUserObj.role === 'CLI_ADMIN' || currentUserObj.role === 'LOGIN_ADMIN';
                                    if (!isJoined && !isOwner && !isAdmin) {
                                        ws.send(JSON.stringify({ type: 'error', message: 'Forbidden: Private Lounge room access rejected.' }));
                                        return [2 /*return*/];
                                    }
                                }
                            }
                        }
                    }
                    client.rooms.add(roomId_1);
                    logWS("User ".concat(userId, " joined room/channel: ").concat(roomId_1));
                    filteredHistory = (db_js_1.db.messages || []).filter(function (msg) {
                        if (!msg)
                            return false;
                        if (msg.room_id === roomId_1 || msg.lounge_id === roomId_1) {
                            // Block verification: if DM, verify recipient hasn't blocked sender or vice versa
                            if (roomId_1.startsWith('dm_')) {
                                var parts = roomId_1.split('_');
                                if (parts.length === 3) {
                                    var p1 = parseInt(parts[1], 10);
                                    var p2 = parseInt(parts[2], 10);
                                    if (!isNaN(p1) && !isNaN(p2) && (0, db_js_1.isUserBlocked)(p1, p2)) {
                                        return false;
                                    }
                                }
                            }
                            return true;
                        }
                        return false;
                    }).map(function (msg) {
                        var sender = db_js_1.db.users.find(function (u) { return u.user_id === msg.user_id; });
                        var senderProfile = db_js_1.db.profiles.find(function (p) { return p.user_id === msg.user_id; });
                        return __assign(__assign({}, msg), { username: sender ? sender.username : 'User', avatar: senderProfile ? senderProfile.avatar : '' });
                    });
                    ws.send(JSON.stringify({
                        type: 'history',
                        room_id: roomId_1,
                        messages: filteredHistory
                    }));
                }
                // 2. Send message event
                if (payload_1.type === 'send_message') {
                    targetRoomId_1 = payload_1.room_id;
                    msgContent = payload_1.content;
                    if (!msgContent || msgContent.trim() === '')
                        return [2 /*return*/];
                    isGloballyMuted = false;
                    isRoom = (_h = db_js_1.db.lounge_rooms) === null || _h === void 0 ? void 0 : _h.find(function (r) { return r.id === targetRoomId_1; });
                    activeMuteLoungeId_1 = isRoom ? isRoom.lounge_id : targetRoomId_1;
                    isGloballyMuted = db_js_1.db.admin_sanctions.some(function (s) {
                        return s.user_id === userId &&
                            s.type === 'mute' &&
                            (s.room_id === null || s.room_id === activeMuteLoungeId_1) &&
                            new Date(s.expires_at || 0).getTime() > Date.now();
                    });
                    if (isGloballyMuted) {
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: 'MUTED: Your administrative broadcast privilege is suspended.'
                        }));
                        return [2 /*return*/];
                    }
                    // Block lists: DM blocks check
                    if (targetRoomId_1.startsWith('dm_')) {
                        parts = targetRoomId_1.split('_');
                        p1_1 = parseInt(parts[1], 10);
                        p2_1 = parseInt(parts[2], 10);
                        if (!isNaN(p1_1) && !isNaN(p2_1)) {
                            user1 = db_js_1.db.users.find(function (u) { return u.user_id === p1_1; });
                            user2 = db_js_1.db.users.find(function (u) { return u.user_id === p2_1; });
                            if (user1 && user2) {
                                blocked = (0, db_js_1.isUserBlocked)(p1_1, p2_1);
                                if (blocked) {
                                    ws.send(JSON.stringify({ type: 'error', message: 'Communication blocked by recipient.' }));
                                    return [2 /*return*/];
                                }
                            }
                        }
                    }
                    msgId = (0, ulid_js_1.generatePrefixedId)('msg');
                    userObjInfo = db_js_1.db.users.find(function (u) { return u.user_id === userId; });
                    newMsg = {
                        message_id: msgId,
                        room_id: targetRoomId_1,
                        lounge_id: activeMuteLoungeId_1,
                        user_id: userId,
                        content: msgContent,
                        is_encrypted: !!payload_1.is_encrypted,
                        reply_to: payload_1.reply_to || null,
                        timestamp: new Date().toISOString(),
                        expires_in: payload_1.expires_in ? Number(payload_1.expires_in) : null,
                        status: 'sent',
                        reactions: {}
                    };
                    db_js_1.db.messages.push(newMsg);
                    (0, db_js_1.saveDb)();
                    responsePayload = __assign(__assign({}, newMsg), { username: userObjInfo ? userObjInfo.username : 'User', avatar: ((_j = db_js_1.db.profiles.find(function (p) { return p.user_id === userId; })) === null || _j === void 0 ? void 0 : _j.avatar) || '' });
                    // Emit message to everyone in the room
                    broadcastToRoom(targetRoomId_1, responsePayload);
                    // Ensure offline direct messages are queued or flagged appropriately for push notification fallback
                    if (targetRoomId_1.startsWith('dm_')) {
                        parts = targetRoomId_1.split('_');
                        recipientId_1 = parts[1] === String(userId) ? parseInt(parts[2], 10) : parseInt(parts[1], 10);
                        recipientOnline_1 = false;
                        db_js_1.db.sessions.forEach(function (s) {
                            if (s.user_id === recipientId_1 && s.status === 'active') {
                                // check active websocket
                                var wsConn = exports.connectedClients.some(function (c) { return c.user_id === recipientId_1 && c.ws && c.ws.readyState === ws_1.WebSocket.OPEN; });
                                if (wsConn)
                                    recipientOnline_1 = true;
                            }
                        });
                        if (!recipientOnline_1) {
                            console.log("[SYS-SECURE] DM recipient User ".concat(recipientId_1, " is currently offline. Message queued in sqlite WAL state."));
                        }
                    }
                    // Check if message is directed to Velum Bot
                    if (targetRoomId_1.startsWith('dm_velum_') || (targetRoomId_1 === 'velum_lounge' && msgContent.includes('@Velum'))) {
                        handleVelumBotReply(userId, targetRoomId_1, msgContent);
                    }
                }
                // 3. Add reaction event
                if (payload_1.type === 'add_reaction') {
                    targetRoomId = payload_1.room_id;
                    msgObj = db_js_1.db.messages.find(function (m) { return m.message_id === payload_1.message_id && (m.room_id === payload_1.room_id || m.lounge_id === payload_1.room_id); });
                    if (msgObj) {
                        msgObj.reactions = msgObj.reactions || {};
                        msgObj.reactions[payload_1.emoji] = msgObj.reactions[payload_1.emoji] || [];
                        userObj_1 = db_js_1.db.users.find(function (u) { return u.user_id === userId; });
                        reactUser = userObj_1 ? userObj_1.username : 'User';
                        if (!msgObj.reactions[payload_1.emoji].includes(reactUser)) {
                            msgObj.reactions[payload_1.emoji].push(reactUser);
                            (0, db_js_1.saveDb)();
                            broadcastToRoom(targetRoomId, {
                                type: 'reaction_update',
                                message_id: payload_1.message_id,
                                room_id: targetRoomId,
                                reactions: msgObj.reactions
                            });
                        }
                    }
                }
                // 4. Remove reaction event
                if (payload_1.type === 'remove_reaction') {
                    targetRoomId = payload_1.room_id;
                    msgObj = db_js_1.db.messages.find(function (m) { return m.message_id === payload_1.message_id && (m.room_id === payload_1.room_id || m.lounge_id === payload_1.room_id); });
                    if (msgObj && msgObj.reactions && msgObj.reactions[payload_1.emoji]) {
                        userObj_2 = db_js_1.db.users.find(function (u) { return u.user_id === userId; });
                        reactUser_1 = userObj_2 ? userObj_2.username : 'User';
                        list = msgObj.reactions[payload_1.emoji];
                        msgObj.reactions[payload_1.emoji] = list.filter(function (u) { return u !== reactUser_1; });
                        if (msgObj.reactions[payload_1.emoji].length === 0) {
                            delete msgObj.reactions[payload_1.emoji];
                        }
                        (0, db_js_1.saveDb)();
                        broadcastToRoom(targetRoomId, {
                            type: 'reaction_update',
                            message_id: payload_1.message_id,
                            room_id: targetRoomId,
                            reactions: msgObj.reactions
                        });
                    }
                }
                // 5. Edit message event
                if (payload_1.type === 'edit_message') {
                    msgObj = db_js_1.db.messages.find(function (m) { return m.message_id === payload_1.message_id; });
                    if (msgObj) {
                        if (msgObj.user_id !== userId) {
                            ws.send(JSON.stringify({ type: 'error', message: 'Forbidden: You do not own this message.' }));
                            return [2 /*return*/];
                        }
                        msgObj.content = payload_1.content;
                        msgObj.edited_at = new Date().toISOString();
                        (0, db_js_1.saveDb)();
                        senderUser = db_js_1.db.users.find(function (u) { return u.user_id === userId; });
                        broadcastToRoom(msgObj.room_id, {
                            type: 'message_edit',
                            message_id: msgObj.message_id,
                            room_id: msgObj.room_id,
                            content: msgObj.content,
                            edited_at: msgObj.edited_at,
                            username: senderUser ? senderUser.username : 'User'
                        });
                    }
                }
                // 6. Delete message event
                if (payload_1.type === 'delete_message') {
                    msgObj = db_js_1.db.messages.find(function (m) { return m.message_id === payload_1.message_id; });
                    if (msgObj) {
                        senderUser = db_js_1.db.users.find(function (u) { return u.user_id === userId; });
                        isAdmin = (senderUser === null || senderUser === void 0 ? void 0 : senderUser.role) === 'CLI_ADMIN' || (senderUser === null || senderUser === void 0 ? void 0 : senderUser.role) === 'LOGIN_ADMIN' || (senderUser === null || senderUser === void 0 ? void 0 : senderUser.role) === 'SUPPORT_ADMIN';
                        if (msgObj.user_id !== userId && !isAdmin) {
                            ws.send(JSON.stringify({ type: 'error', message: 'Forbidden: You do not have permission to delete this message.' }));
                            return [2 /*return*/];
                        }
                        targetRoomId = msgObj.room_id;
                        db_js_1.db.messages = db_js_1.db.messages.filter(function (m) { return m.message_id !== payload_1.message_id; });
                        (0, db_js_1.saveDb)();
                        broadcastToRoom(targetRoomId, {
                            type: 'message_delete',
                            message_id: payload_1.message_id,
                            room_id: targetRoomId
                        });
                    }
                }
                // 7. Support Ticket live updates channel join
                if (payload_1.type === 'join_ticket') {
                    ticketId_2 = payload_1.ticket_id;
                    userObj_3 = db_js_1.db.users.find(function (u) { return u.user_id === userId; });
                    isAdmin = (userObj_3 === null || userObj_3 === void 0 ? void 0 : userObj_3.role) === 'CLI_ADMIN' || (userObj_3 === null || userObj_3 === void 0 ? void 0 : userObj_3.role) === 'LOGIN_ADMIN' || (userObj_3 === null || userObj_3 === void 0 ? void 0 : userObj_3.role) === 'SUPPORT_ADMIN';
                    ticket = db_js_1.db.tickets.find(function (t) { return t.ticket_id === ticketId_2; });
                    if (ticket && (ticket.user_id === userId || isAdmin)) {
                        client.rooms.add("ticket_".concat(ticketId_2));
                        console.log("User ".concat(userId, " joined Live Ticket Stream: ticket_").concat(ticketId_2));
                    }
                    else {
                        ws.send(JSON.stringify({ type: 'error', message: 'Access denied to live ticket support stream.' }));
                    }
                }
                // 8. Support Ticket reply send event
                if (payload_1.type === 'ticket_reply') {
                    ticketId_3 = payload_1.ticket_id;
                    userObj_4 = db_js_1.db.users.find(function (u) { return u.user_id === userId; });
                    isAdmin = (userObj_4 === null || userObj_4 === void 0 ? void 0 : userObj_4.role) === 'CLI_ADMIN' || (userObj_4 === null || userObj_4 === void 0 ? void 0 : userObj_4.role) === 'LOGIN_ADMIN' || (userObj_4 === null || userObj_4 === void 0 ? void 0 : userObj_4.role) === 'SUPPORT_ADMIN';
                    ticket = db_js_1.db.tickets.find(function (t) { return t.ticket_id === ticketId_3; });
                    if (ticket && (ticket.user_id === userId || isAdmin)) {
                        ticket.messages = ticket.messages || [];
                        ticket.messages.push({
                            sender_id: userId,
                            sender_name: userObj_4 ? userObj_4.username : 'Client',
                            content: payload_1.content,
                            timestamp: new Date().toISOString()
                        });
                        ticket.status = isAdmin ? 'pending' : 'open';
                        (0, db_js_1.saveDb)();
                        broadcastToRoom("ticket_".concat(ticketId_3), {
                            type: 'ticket_update',
                            ticket_id: ticketId_3,
                            messages: ticket.messages,
                            status: ticket.status
                        });
                    }
                    else {
                        ws.send(JSON.stringify({ type: 'error', message: 'Ticket context not found or unauthorized.' }));
                    }
                }
            }
            catch (err) {
                console.error('Error handling WebSocket message:', err);
            }
            return [2 /*return*/];
        });
    }); });
    ws.on('close', function () {
        var index = exports.connectedClients.findIndex(function (c) { return c.ws === ws; });
        if (index !== -1) {
            var client_1 = exports.connectedClients[index];
            exports.connectedClients.splice(index, 1);
            (0, presence_js_1.updateUserPresence)(client_1.user_id, new Date().toISOString());
        }
        logWS("WebSocket disconnected. Total clients remaining: ".concat(exports.connectedClients.length));
    });
});
function broadcastToRoom(room, object) {
    if (!object)
        return;
    exports.connectedClients.forEach(function (c) {
        if (c.rooms.has(room) && c.ws && c.ws.readyState === ws_1.WebSocket.OPEN) {
            try {
                c.ws.send(JSON.stringify(object));
            }
            catch (err) {
                console.error("Error broadcasting to client in room ".concat(room, ":"), err);
            }
        }
    });
}
// Register WS broadcast callback in database module
(0, db_js_1.registerBroadcastToRoomCallback)(function (roomId, object) {
    broadcastToRoom(roomId, object);
});
function handleVelumBotReply(userId, roomId, userText) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/];
        });
    });
}
function setupCloudMessageSync() {
    if (typeof sync_js_1.isCloudBackupDisabled !== 'undefined' && sync_js_1.isCloudBackupDisabled) {
        console.log('[SYNC] Cloud sync disabled; skipping cloud message synchronization.');
        return;
    }
    console.log('[SYNC] Cloud backup provider present but realtime message synchronization via Neon PostgreSQL is not configured. Skipping realtime sync.');
    return;
}
