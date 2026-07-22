export interface CommandMeta {
  desc: string;
  risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  args?: string[];
  flags?: Record<string, string>;
}

export const COMMAND_REGISTRY: Record<string, Record<string, CommandMeta>> = {
  '/users': {
    list: {
      desc: 'List registered users',
      risk: 'LOW',
      flags: {
        '--status <status>': 'Filter users by status (active, suspended, restricted, deleted)'
      }
    },
    cat: {
      desc: 'View user profile details',
      risk: 'LOW',
      args: ['<uid/username>']
    },
    create: {
      desc: 'Directly instantiate a new user account profile',
      risk: 'HIGH',
      args: ['<username>', '<password>', '[role]']
    },
    override: {
      desc: 'Reset user password and credentials to active state',
      risk: 'HIGH',
      args: ['<uid/username>', '<new_password>']
    },
    set: {
      desc: 'Modify global user role configuration',
      risk: 'HIGH',
      args: ['<uid/username>', '<role>']
    },
    reset: {
      desc: 'Revert avatar violating platform safety policies',
      risk: 'MEDIUM',
      args: ['<uid/username>']
    },
    deactivate: {
      desc: 'Start deactivation grace period for an account',
      risk: 'HIGH',
      args: ['<uid/username>']
    },
    cancel: {
      desc: 'Abort a pending soft deactivation request',
      risk: 'MEDIUM',
      args: ['<uid/username>']
    },
    restore: {
      desc: 'Restore a soft-deleted user back to active',
      risk: 'MEDIUM',
      args: ['<uid/username>']
    },
    pending: {
      desc: 'List accounts scheduled for soft deactivation',
      risk: 'LOW'
    },
    purge: {
      desc: 'Irreversible database purge of user personal markers (GDPR)',
      risk: 'CRITICAL',
      args: ['<uid/username>']
    },
    'release-assets': {
      desc: 'Verify and release financial assets for a deactivating user',
      risk: 'HIGH',
      args: ['<uid/username>']
    }
  },
  '/sanctions': {
    history: {
      desc: 'Trace active/historical sanctions logged for user',
      risk: 'LOW',
      args: ['<uid/username>']
    },
    status: {
      desc: 'Query active restriction, mute, or jail status',
      risk: 'LOW',
      args: ['<uid/username>']
    },
    kick: {
      desc: 'Forcefully sever websocket session for an active user',
      risk: 'MEDIUM',
      args: ['<user_id>']
    },
    ban: {
      desc: 'Apply global ban and flush active user sessions',
      risk: 'MEDIUM',
      args: ['<uid/username>'],
      flags: {
        '--reason <reason>': 'Reason for global ban'
      }
    },
    unban: {
      desc: 'Lift global ban restriction from a user',
      risk: 'MEDIUM',
      args: ['<uid/username>']
    },
    mute: {
      desc: 'Silence user globally (prevent message writes)',
      risk: 'MEDIUM',
      args: ['<uid/username>'],
      flags: {
        '--reason <reason>': 'Reason for mute'
      }
    },
    unmute: {
      desc: 'Unsilence user globally (restore message writes)',
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
      desc: 'Remove restricted status from a user',
      risk: 'MEDIUM',
      args: ['<uid/username>']
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
      args: ['<id>']
    },
    'purge-all': {
      desc: 'Irreversible deletion of all support tickets',
      risk: 'CRITICAL'
    }
  },
  '/db': {
    integrity: {
      desc: 'Audit datastore relational foreign keys and schema health',
      risk: 'LOW'
    },
    orphans: {
      desc: 'Scan relational tables for orphaned entities',
      risk: 'LOW'
    },
    clean: {
      desc: 'Purge orphaned profiles and dead session registries',
      risk: 'HIGH'
    },
    fsync: {
      desc: 'Force flush in-memory database to SQLite disk storage',
      risk: 'HIGH'
    },
    vacuum: {
      desc: 'Compact database and reclaim unused disk space',
      risk: 'HIGH'
    },
    resetn: {
      desc: 'Clear login nonces to invalidate replaying attempts',
      risk: 'HIGH'
    },
    backup: {
      desc: 'Export structural schema configurations JSON backup',
      risk: 'HIGH'
    },
    restore: {
      desc: 'Restore database structural settings from backup',
      risk: 'CRITICAL',
      args: ['<backup_file>']
    },
    seed: {
      desc: 'Non-destructively seed platform configuration tables',
      risk: 'CRITICAL'
    },
    wipe: {
      desc: 'Irreversible database reset (retains admin configs only)',
      risk: 'CRITICAL'
    }
  },
  '/market': {
    list: {
      desc: 'List active marketplace product listings',
      risk: 'LOW'
    },
    cat: {
      desc: 'View detailed inventory, SKU, pricing, and seller details',
      risk: 'LOW',
      args: ['<listing_id>']
    },
    suspend: {
      desc: 'Deactivate a listing from public search indexes',
      risk: 'MEDIUM',
      args: ['<listing_id>']
    },
    unsuspend: {
      desc: 'Re-enable a suspended marketplace listing',
      risk: 'MEDIUM',
      args: ['<listing_id>']
    },
    adjust: {
      desc: 'Manually override inventory stock count for audit correction',
      risk: 'HIGH',
      args: ['<listing_id>', '<stock_count>']
    }
  },
  '/escrow': {
    cat: {
      desc: 'View structural contract details of an escrow transaction',
      risk: 'LOW',
      args: ['<transaction_id>']
    },
    list: {
      desc: 'Audit active escrow locks and check anomaly logs',
      risk: 'MEDIUM'
    },
    release: {
      desc: 'Force-complete escrow and credit VLM funds to seller',
      risk: 'HIGH',
      args: ['<transaction_id>']
    },
    refund: {
      desc: 'Force-cancel escrow and return VLM funds to buyer',
      risk: 'HIGH',
      args: ['<transaction_id>']
    },
    seize: {
      desc: 'Seize escrowed funds to platform account 999',
      risk: 'CRITICAL',
      args: ['<transaction_id>']
    }
  },
  '/devops': {
    config: {
      desc: 'View active limits, fees, tax, and exchange configurations',
      risk: 'LOW'
    },
    token: {
      desc: 'Generate a support admin temporary access code',
      risk: 'HIGH'
    },
    'maint-off': {
      desc: 'Disable platform maintenance mode restrictions',
      risk: 'MEDIUM'
    },
    fee: {
      desc: 'Set platform transaction fee percentage',
      risk: 'HIGH',
      args: ['<percent>']
    },
    tax: {
      desc: 'Set platform transaction tax percentage',
      risk: 'HIGH',
      args: ['<percent>']
    },
    rate: {
      desc: 'Manually update/add currency exchange rate settings',
      risk: 'HIGH',
      args: ['<base_currency>', '<quote_currency>', '<rate_value>']
    },
    'escrow-fee': {
      desc: 'Set the platform escrow fee percentage',
      risk: 'HIGH',
      args: ['<percent>']
    },
    limit: {
      desc: 'Set credit limit configuration parameters per user tier',
      risk: 'HIGH',
      args: ['<tier_name>', '<limit_cents>']
    },
    'main-on': {
      desc: 'Enable global maintenance mode (blocks non-admin actions)',
      risk: 'HIGH',
      flags: {
        '--reason <reason>': 'Reason for maintenance mode'
      }
    }
  },
  '/sys': {
    status: {
      desc: 'Output running port, SQLite path, tables size, and stats',
      risk: 'LOW'
    },
    top: {
      desc: 'View active execution resources and memory usage metrics',
      risk: 'LOW'
    },
    activest: {
      desc: 'Count online socket endpoints and WebSocket metrics',
      risk: 'LOW'
    },
    ccache: {
      desc: 'Flush volatile database caches and memory registries',
      risk: 'MEDIUM'
    },
    kill: {
      desc: 'Forcefully sever a specific user session',
      risk: 'MEDIUM',
      args: ['<session_id>']
    },
    flush: {
      desc: 'Flush all global sessions forcing system-wide re-auth',
      risk: 'HIGH'
    }
  },
  '/bank': {
    bankau: {
      desc: 'Audit centralized liquidity, deposits, and withdrawal delta',
      risk: 'LOW'
    },
    banks: {
      desc: 'Report real-time central account balances',
      risk: 'LOW'
    },
    txlog: {
      desc: 'Output list of recent central bank ledger transactions',
      risk: 'LOW'
    },
    staff: {
      desc: 'List all users carrying bank admin roles',
      risk: 'LOW'
    },
    wire: {
      desc: 'Execute ledger transaction transfer between two accounts',
      risk: 'HIGH',
      args: ['<from_account>', '<to_account>', '<cents>']
    },
    fundc: {
      desc: 'Fund central bank reserve account from platform assets',
      risk: 'CRITICAL',
      args: ['<cents>', '<description>']
    },
    fundt: {
      desc: 'Fund member trust account from central reserve',
      risk: 'CRITICAL',
      args: ['<cents>', '<description>']
    },
    funde: {
      desc: 'Fund escrow reserve account from central reserve',
      risk: 'CRITICAL',
      args: ['<cents>', '<description>']
    },
    bankf: {
      desc: 'Freeze banking services (freeze user wallet account)',
      risk: 'CRITICAL',
      args: ['<uid/username>']
    },
    bankad: {
      desc: 'Manually adjust account balance with compensating ledger entry',
      risk: 'CRITICAL',
      args: ['<account_id>', '<amount_cents>', '<reason>']
    }
  },
  '/cards': {
    cards: {
      desc: 'Show all available cards in Velum',
      risk: 'LOW'
    },
    cardad: {
      desc: 'Set the credit limit for a credit card',
      risk: 'HIGH',
      args: ['<card_or_token>', '<amount_cents>']
    },
    cardl: {
      desc: 'Populate every credit card holder name and balance',
      risk: 'LOW'
    },
    cardu: {
      desc: 'Promote a specific credit limit for a credit card',
      risk: 'HIGH',
      args: ['<card_or_token>', '<amount_cents>']
    }
  },
  '/audits': {
    grep: {
      desc: 'Scan active administrative logs for text pattern',
      risk: 'LOW',
      args: ['<pattern>']
    },
    session: {
      desc: 'Inspect user device fingerprints and geographic velocity metrics',
      risk: 'LOW',
      args: ['<session_id>']
    },
    ledger: {
      desc: 'Execute rolling HMAC transaction verification checks',
      risk: 'LOW'
    },
    hijacks: {
      desc: 'Audit active sessions for browser fingerprint hijack anomalies',
      risk: 'LOW'
    },
    ip: {
      desc: 'Cross-correlate accounts sharing identical subnets',
      risk: 'LOW'
    },
    nodes: {
      desc: 'Scan recursive channel visibility permissions inheritance',
      risk: 'LOW'
    },
    reconstruct: {
      desc: 'Audit and repair unbidirectional friendship discrepancies',
      risk: 'HIGH'
    },
    repair: {
      desc: 'Inject ledger repair correction delta and re-bake hash chain',
      risk: 'HIGH',
      args: ['<uid/username>', '<amount_cents>']
    }
  },
  '/fraud': {
    risklog: {
      desc: 'Show recent security and fraud heuristic log alerts',
      risk: 'LOW'
    },
    freeze: {
      desc: 'Lock user wallet transactions and hold active escrows',
      risk: 'MEDIUM',
      args: ['<uid/username>'],
      flags: {
        '--reason <reason>': 'Reason for wallet freeze'
      }
    },
    unfreeze: {
      desc: 'Restore user financial wallet transactions access',
      risk: 'MEDIUM',
      args: ['<uid/username>']
    },
    seize: {
      desc: 'Transfer all user assets to platform account 999 and purge account',
      risk: 'CRITICAL',
      args: ['<uid/username>'],
      flags: {
        '--reason <reason>': 'Reason for seizure'
      }
    }
  }
};
