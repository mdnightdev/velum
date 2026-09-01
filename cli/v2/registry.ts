export interface CommandMeta {
  desc: string;
  risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  args?: string[];
  flags?: Record<string, string>;
}

export const V2_COMMAND_REGISTRY: Record<string, Record<string, CommandMeta>> = {
  '/users': {
    list: {
      desc: 'List registered users',
      risk: 'LOW',
      flags: {
        '--role <role>': 'Filter users by role',
        '--page <page>': 'Page number (50 per page)'
      }
    },
    create: {
      desc: 'Create a new user account',
      risk: 'HIGH',
      args: ['<username>', '<password>', '[role]']
    },
    override: {
      desc: 'Reset user password and credentials',
      risk: 'HIGH',
      args: ['<uid/username>', '<new_password>']
    },
    set: {
      desc: 'Update user role',
      risk: 'HIGH',
      args: ['<uid/username>', '<role>']
    },
    reset: {
      desc: 'Reset user avatar',
      risk: 'MEDIUM',
      args: ['<uid/username>']
    },
    restore: {
      desc: 'Restore account from pending deletion to active',
      risk: 'MEDIUM',
      args: ['<uid/username>']
    },
    pending: {
      desc: 'List accounts pending deactivation',
      risk: 'LOW'
    },
    purge: {
      desc: 'Permanently delete user record',
      risk: 'CRITICAL',
      args: ['<uid/username>']
    },
    'release-assets': {
      desc: 'Verify user wallet balance for release',
      risk: 'HIGH',
      args: ['<uid/username>']
    },
    flags: {
      desc: 'Query security flags and audit records for user',
      risk: 'LOW',
      args: ['[uid/username]']
    },
    nominations: {
      desc: 'List support admin nominations',
      risk: 'LOW'
    },
    approve: {
      desc: 'Approve support admin nomination',
      risk: 'HIGH',
      args: ['<nomination_id>']
    },
    reject: {
      desc: 'Reject support admin nomination',
      risk: 'HIGH',
      args: ['<nomination_id>', '[reason]']
    },
    demote: {
      desc: 'Revoke support admin access',
      risk: 'HIGH',
      args: ['<uid/username>']
    }
  },
  '/sanctions': {
    history: {
      desc: 'Query user sanction and punishment history',
      risk: 'LOW',
      args: ['<uid/username>']
    },
    flags: {
      desc: 'Query and investigate escalated user reports (14-day resolution lifecycle)',
      risk: 'LOW',
      args: ['[report_id/username/resolve]', '[args]']
    },
    blacklist: {
      desc: 'View automated ecosystem blacklist table',
      risk: 'LOW'
    },
    whitelist: {
      desc: 'Pardon and remove an entity or user ecosystem from blacklist',
      risk: 'HIGH',
      args: ['<uid/username/ip/device_id>', '[reason]']
    }
  },
  '/tickets': {
    list: {
      desc: 'List all support tickets',
      risk: 'LOW'
    },
    delete: {
      desc: 'Delete support ticket by ID',
      risk: 'MEDIUM',
      args: ['<ticket_id>']
    },
    'purge-all': {
      desc: 'Delete all support tickets',
      risk: 'CRITICAL'
    }
  },
  '/db': {
    integrity: {
      desc: 'Check table record counts and schema health',
      risk: 'LOW'
    },
    orphans: {
      desc: 'Scan relational tables for orphaned records',
      risk: 'LOW'
    },
    clean: {
      desc: 'Purge orphaned records and expired sessions',
      risk: 'HIGH'
    },
    vacuum: {
      desc: 'Compact database and reclaim unused disk space',
      risk: 'HIGH'
    },
    backup: {
      desc: 'Export full database snapshot backup to JSON',
      risk: 'HIGH',
      args: ['[filename]']
    },
    restore: {
      desc: 'Restore database from snapshot JSON file',
      risk: 'CRITICAL',
      args: ['<backup_file>']
    },
    seed: {
      desc: 'Seed default platform settings',
      risk: 'CRITICAL'
    },
    wipe: {
      desc: 'Reset user and application data (retains admin accounts)',
      risk: 'CRITICAL'
    }
  },
  '/market': {
    list: {
      desc: 'List marketplace listings',
      risk: 'LOW',
      flags: {
        '--page <page>': 'Page number (50 per page)'
      }
    },
    suspend: {
      desc: 'Suspend a marketplace listing',
      risk: 'MEDIUM',
      args: ['<listing_id>']
    },
    unsuspend: {
      desc: 'Reactivate a suspended listing',
      risk: 'MEDIUM',
      args: ['<listing_id>']
    },
    adjust: {
      desc: 'Update listing inventory stock count',
      risk: 'HIGH',
      args: ['<listing_id>', '<stock_count>']
    }
  },
  '/escrow': {
    list: {
      desc: 'List active escrows',
      risk: 'MEDIUM'
    },
    outbox: {
      desc: 'View outbox events log',
      risk: 'LOW',
      args: ['[event_id]']
    },
    release: {
      desc: 'Release escrow funds to seller',
      risk: 'HIGH',
      args: ['<escrow_id>']
    },
    refund: {
      desc: 'Refund escrow funds to buyer',
      risk: 'HIGH',
      args: ['<escrow_id>']
    },
    seize: {
      desc: 'Seize escrow funds to reserve (dispute)',
      risk: 'CRITICAL',
      args: ['<escrow_id>']
    }
  },
  '/devops': {
    set: {
      desc: 'Set system config (fee, tax, escrow-fee, rate, maint)',
      risk: 'HIGH',
      args: ['<fee|tax|escrow-fee|rate|maint>', '<value...>']
    },
    config: {
      desc: 'Detailed runtime environment, database, and rate overview',
      risk: 'LOW'
    },
    token: {
      desc: 'Generate temporary support admin access code',
      risk: 'HIGH'
    }
  },
  '/sys': {
    status: {
      desc: 'Show database connection and system status',
      risk: 'LOW'
    },
    top: {
      desc: 'Show process memory and uptime metrics',
      risk: 'LOW'
    },
    activest: {
      desc: 'Count active sessions',
      risk: 'LOW'
    },
    ccache: {
      desc: 'Clear in-memory caches',
      risk: 'MEDIUM'
    },
    kill: {
      desc: 'Terminate a session by ID',
      risk: 'MEDIUM',
      args: ['<session_id>']
    },
    flush: {
      desc: 'Clear all active sessions',
      risk: 'HIGH'
    }
  },
  '/bank': {
    audit: {
      desc: 'Reconcile user deposits and bank balances',
      risk: 'LOW'
    },
    wallets: {
      desc: 'List user wallets and bank balances',
      risk: 'LOW'
    },
    tx: {
      desc: 'List recent ledger transaction statements',
      risk: 'LOW',
      args: ['[wallet_id]']
    },
    staff: {
      desc: 'List users with admin or staff roles',
      risk: 'LOW'
    },
    fund: {
      desc: 'Fund bank account (c: Central Bank, t: Sentry Bank, e: Trading Account)',
      risk: 'CRITICAL',
      args: ['<c|t|e>', '<cents>', '[description]']
    },
    grant: {
      desc: 'Award funds to one or multiple users atomically',
      risk: 'CRITICAL',
      args: ['<user1:amount>', '[user2:amount...]', '[reason]']
    }
  },
  '/cards': {
    cards: {
      desc: 'List all cards',
      risk: 'LOW'
    },
    credit: {
      desc: 'List credit cards',
      risk: 'LOW'
    },
    debit: {
      desc: 'List debit cards',
      risk: 'LOW'
    },
    cat: {
      desc: 'Inspect detailed card and balance record',
      risk: 'LOW',
      args: ['<card_token_or_username>']
    },
    cardad: {
      desc: 'Set card limit',
      risk: 'HIGH',
      args: ['<card_token_or_username>', '<amount_cents>']
    },
    cardl: {
      desc: 'List cardholders and available balances',
      risk: 'LOW'
    },
    freeze: {
      desc: 'Freeze/deactivate card',
      risk: 'HIGH',
      args: ['<card_token_or_username>']
    },
    unfreeze: {
      desc: 'Unfreeze/activate card',
      risk: 'HIGH',
      args: ['<card_token_or_username>']
    },
    create: {
      desc: 'Create card for user',
      risk: 'HIGH',
      args: ['<username>', '[CREDIT|DEBIT]', '[limit_cents]']
    },
    delete: {
      desc: 'Delete card',
      risk: 'HIGH',
      args: ['<card_token_or_username>']
    }
  },
  '/audits': {
    grep: {
      desc: 'Search audit logs by pattern',
      risk: 'LOW',
      args: ['<pattern>']
    },
    session: {
      desc: 'Inspect session details by session or user ID',
      risk: 'LOW',
      args: ['<session_id_or_user_id>']
    },
    ledger: {
      desc: 'Verify ledger transactions',
      risk: 'LOW'
    },
    hijacks: {
      desc: 'Scan for multi-IP concurrent sessions',
      risk: 'LOW'
    },
    ip: {
      desc: 'Group active sessions by IP with hardware model and location',
      risk: 'LOW'
    },
    devices: {
      desc: 'List registered hardware devices and fingerprints for a user',
      risk: 'LOW',
      args: ['<user_id_or_username>']
    },
    export: {
      desc: 'Export recent audit trail to JSON',
      risk: 'MEDIUM'
    }
  },
  '/fraud': {
    risklog: {
      desc: 'View recent security risk alerts',
      risk: 'LOW'
    },
    flags: {
      desc: 'List all active account restrictions',
      risk: 'LOW'
    },
    duress: {
      desc: 'List accounts with active duress alerts',
      risk: 'HIGH'
    },
    freeze: {
      desc: 'Freeze wallet and restrict user channels',
      risk: 'CRITICAL',
      args: ['<uid/username>', '[reason]']
    },
    unfreeze: {
      desc: 'Restore wallet and clear channel restrictions',
      risk: 'CRITICAL',
      args: ['<uid/username>']
    },
    seize: {
      desc: 'Seize user wallet funds to treasury',
      risk: 'CRITICAL',
      args: ['<uid/username>', '[reason]']
    }
  },
  '/lounges': {
    list: {
      desc: 'List all chat lounges and sublounges',
      risk: 'LOW'
    },
    clean: {
      desc: 'Purge messages older than N days',
      risk: 'HIGH',
      args: ['[days]']
    },
    delete: {
      desc: 'Delete a channel and all associated messages',
      risk: 'CRITICAL',
      args: ['<channel_id>']
    }
  }
};
