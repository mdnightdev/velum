"use strict";
// VELUM CORE TS TYPES DECLARATION FILE
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripAt = stripAt;
function stripAt(username) {
    if (!username)
        return '';
    return username.startsWith('@') ? username.slice(1) : username;
}
