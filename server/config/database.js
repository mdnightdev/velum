"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPgPool = getPgPool;
var pg_1 = require("pg");
require("dotenv/config");
var databaseUrl = process.env.DATABASE_URL;
var pgPool = null;
function getPgPool() {
    if (!pgPool) {
        pgPool = new pg_1.default.Pool({
            connectionString: databaseUrl,
            ssl: databaseUrl && databaseUrl.includes('sslmode=require') ? { rejectUnauthorized: false } : false
        });
    }
    return pgPool;
}
