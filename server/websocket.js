"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupCloudMessageSync = exports.handleVelumBotReply = exports.broadcastToRoom = exports.connectedClients = exports.wss = void 0;
var websocket_js_1 = require("./services/websocket.js");
Object.defineProperty(exports, "wss", { enumerable: true, get: function () { return websocket_js_1.wss; } });
Object.defineProperty(exports, "connectedClients", { enumerable: true, get: function () { return websocket_js_1.connectedClients; } });
Object.defineProperty(exports, "broadcastToRoom", { enumerable: true, get: function () { return websocket_js_1.broadcastToRoom; } });
Object.defineProperty(exports, "handleVelumBotReply", { enumerable: true, get: function () { return websocket_js_1.handleVelumBotReply; } });
Object.defineProperty(exports, "setupCloudMessageSync", { enumerable: true, get: function () { return websocket_js_1.setupCloudMessageSync; } });
