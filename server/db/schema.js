"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TABLE_CONFIGS = exports.defaultDb = exports.adminUsers = void 0;
// Validate admin credentials configuration
exports.adminUsers = (function () {
    var users = [];
    // CLI_ADMIN configuration
    if (process.env.CLI_ADMIN_USERNAME && process.env.CLI_ADMIN_PASSWORD_HASH) {
        if (!process.env.CLI_ADMIN_SAFE_WORD_HASH || !process.env.CLI_ADMIN_PANIC_PHRASE_HASH || !process.env.CLI_ADMIN_RECOVERY_KEY_HASH) {
            throw new Error('SECURITY ERROR: CLI_ADMIN configured but missing required hash fields (SAFE_WORD, PANIC_PHRASE, or RECOVERY_KEY)');
        }
        users.push({
            user_id: 1,
            username: process.env.CLI_ADMIN_USERNAME,
            password_hash: process.env.CLI_ADMIN_PASSWORD_HASH,
            safe_word_hash: process.env.CLI_ADMIN_SAFE_WORD_HASH,
            panic_phrase_hash: process.env.CLI_ADMIN_PANIC_PHRASE_HASH,
            recovery_key_hash: process.env.CLI_ADMIN_RECOVERY_KEY_HASH,
            role: 'CLI_ADMIN',
            status: 'active',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        });
    }
    // LOGIN_ADMIN configuration
    if (process.env.LOGIN_ADMIN_USERNAME && process.env.LOGIN_ADMIN_PASSWORD_HASH) {
        if (!process.env.LOGIN_ADMIN_SAFE_WORD_HASH || !process.env.LOGIN_ADMIN_PANIC_PHRASE_HASH || !process.env.LOGIN_ADMIN_RECOVERY_KEY_HASH) {
            throw new Error('SECURITY ERROR: LOGIN_ADMIN configured but missing required hash fields (SAFE_WORD, PANIC_PHRASE, or RECOVERY_KEY)');
        }
        users.push({
            user_id: users.length > 0 ? 2 : 1,
            username: process.env.LOGIN_ADMIN_USERNAME,
            password_hash: process.env.LOGIN_ADMIN_PASSWORD_HASH,
            safe_word_hash: process.env.LOGIN_ADMIN_SAFE_WORD_HASH,
            panic_phrase_hash: process.env.LOGIN_ADMIN_PANIC_PHRASE_HASH,
            recovery_key_hash: process.env.LOGIN_ADMIN_RECOVERY_KEY_HASH,
            role: 'LOGIN_ADMIN',
            status: 'active',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        });
    }
    return users;
})();
exports.defaultDb = {
    users: exports.adminUsers,
    profiles: exports.adminUsers.map(function (admin) { return ({
        profile_id: "p_".concat(admin.user_id),
        user_id: admin.user_id,
        bio: admin.role === 'CLI_ADMIN' ? 'Verified CLI Security Administrator. Operational Systems Command.' : 'Verified Executive Director.',
        avatar: '',
        updated_at: new Date().toISOString(),
        settings: { theme: 'slate', notificationsEnabled: true, burnDefaultSeconds: 0 }
    }); }),
    sessions: [],
    devices: [],
    ip_addresses: [],
    messages: [],
    user_blocks: [],
    user_mutes: [],
    admin_sanctions: [],
    invites: [],
    tickets: [],
    reports: [],
    recovery_events: [],
    suspicious_events: [],
    audit_logs: [],
    peer_relationships: [],
    join_requests: [],
    lounges: [],
    lounge_rooms: [],
    lounge_members: [],
    lounge_invites: [],
    lounge_sanctions: [],
    lounge_join_requests: [],
    lounge_ownership_transfers: [],
    account_deletion_requests: [],
    user_lounge_preferences: [],
    lounge_audit_logs: [],
    system_audit_logs: [],
    user_wallets: [],
    wallet_ledger_entries: [],
    recharge_requests: [],
    withdrawal_requests: [],
    kyc_verifications: [],
    payment_methods: [],
    external_financial_accounts: [],
    external_processor_events: [],
    wallet_balances: [],
    currencies: [],
    exchange_rates: [],
    platform_admins: [],
    platform_financial_audit_logs: [],
    automation_actions: [],
    refund_requests: [],
    listing_verification_checks: [],
    verified_sellers: [],
    market_assets: []
};
exports.TABLE_CONFIGS = {
    users: {
        name: 'users',
        pkName: 'user_id',
        getPkValue: function (r) { return r.user_id; },
        insertSql: "",
        getParams: function (r, enc) { return []; }
    }
};
