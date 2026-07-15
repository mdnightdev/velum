"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateUserPresence = updateUserPresence;
var db_js_1 = require("../db.js");
var websocket_js_1 = require("./websocket.js");
function updateUserPresence(userId, lastSeen) {
    var userObj = db_js_1.db.users.find(function (u) { return u.user_id === userId; });
    if (userObj) {
        userObj.last_seen_at = lastSeen;
        (0, db_js_1.saveDb)();
        (0, websocket_js_1.broadcastToRoom)('velum_lounge', {
            type: 'presence_update',
            user_id: userId,
            last_seen_at: lastSeen
        });
    }
}
