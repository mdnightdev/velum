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
      desc: 'List sanction audit history',
      risk: 'LOW',
      args: ['[uid/username]']
    },
    status: {
      desc: 'Check mute, jail, or ban status',
      risk: 'LOW',
      args: ['<uid/username>']
    },
    kick: {
      desc: 'Disconnect user session',
      risk: 'MEDIUM',
      args: ['<user_id>']
    },
    ban: {
      desc: 'Ban user account',
      risk: 'MEDIUM',
      args: ['<uid/username>'],
      flags: {
        '--reason <reason>': 'Reason for ban'
      }
    },
    unban: {
      desc: 'Remove ban from user account',
      risk: 'MEDIUM',
      args: ['<uid/username>']
    },
    mute: {
      desc: 'Mute user globally',
      risk: 'MEDIUM',
      args: ['<uid/username>'],
      flags: {
        '--reason <reason>': 'Reason for mute'
      }
    },
    unmute: {
      desc: 'Unmute user globally',
      risk: 'MEDIUM',
      args: ['<uid/username>']
    },
    jail: {
      desc: 'Restrict user to limited channels',
      risk: 'MEDIUM',
      args: ['<uid/username>'],
      flags: {
        '--reason <reason>': 'Reason for restriction'
      }
    },
    unjail: {
      desc: 'Remove channel restriction from user',
      risk: 'MEDIUM',
      args: ['<uid/username>']
    },
    flags: {
      desc: 'Query active sanction flags across users',
      risk: 'LOW',
      args: ['[uid/username]']
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
      desc: 'Export system configuration backup to JSON',
      risk: 'HIGH'
    },
    restore: {
      desc: 'Restore system configuration from backup JSON',
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
    config: {
      desc: 'View active limits, fees, tax, and rates',
      risk: 'LOW'
    },
    flags: {
      desc: 'View active configuration flags',
      risk: 'LOW'
    },
    token: {
      desc: 'Generate temporary support admin access code',
      risk: 'HIGH'
    },
    maint: {
      desc: 'Toggle maintenance mode',
      risk: 'HIGH',
      args: ['<on|off>']
    },
    fee: {
      desc: 'Set transaction fee percentage',
      risk: 'HIGH',
      args: ['<percent>']
    },
    tax: {
      desc: 'Set transaction tax percentage',
      risk: 'HIGH',
      args: ['<percent>']
    },
    rate: {
      desc: 'Set currency exchange rate',
      risk: 'HIGH',
      args: ['<base_currency>', '<quote_currency>', '<rate_value>']
    },
    'escrow-fee': {
      desc: 'Set escrow fee percentage',
      risk: 'HIGH',
      args: ['<percent>']
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
    bankau: {
      desc: 'Audit liquidity, deposits, and withdrawals',
      risk: 'LOW'
    },
    wallets: {
      desc: 'List user wallets and reserve balances',
      risk: 'LOW'
    },
    tx: {
      desc: 'List recent ledger transactions',
      risk: 'LOW',
      args: ['[wallet_id]']
    },
    staff: {
      desc: 'List users with admin or staff roles',
      risk: 'LOW'
    },
    wire: {
      desc: 'Transfer funds between two users',
      risk: 'HIGH',
      args: ['<from_username>', '<to_username>', '<amount>']
    },
    fundc: {
      desc: 'Fund card settlement reserve',
      risk: 'CRITICAL',
      args: ['<cents>', '[description]']
    },
    fundt: {
      desc: 'Fund treasury reserve',
      risk: 'CRITICAL',
      args: ['<cents>', '[description]']
    },
    funde: {
      desc: 'Fund escrow buffer reserve',
      risk: 'CRITICAL',
      args: ['<cents>', '[description]']
    },
    bankf: {
      desc: 'Freeze user wallet',
      risk: 'CRITICAL',
      args: ['<uid/username>']
    },
    bankad: {
      desc: 'Adjust user wallet balance',
      risk: 'CRITICAL',
      args: ['<uid/username>', '<new_balance>', '[reason]']
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
    cardad: {
      desc: 'Set card limit',
      risk: 'HIGH',
      args: ['<card_token_or_username>', '<amount_cents>']
    },
    cardl: {
      desc: 'List cardholders and available balances',
      risk: 'LOW'
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
      desc: 'Group active sessions by IP address',
      risk: 'LOW'
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
