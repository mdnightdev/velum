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
        '--status <status>': 'Filter users by status (e.g. active, suspended, quarantined)'
      }
    },
    cat: {
      desc: 'View profile details of a user',
      risk: 'LOW',
      args: ['<uid/username>']
    },
    ban: {
      desc: 'Terminate active sessions and apply a global ban',
      risk: 'MEDIUM',
      args: ['<uid/username>'],
      flags: {
        '--reason <reason>': 'Administrative audit reason'
      }
    },
    unban: {
      desc: 'Restore active status to a banned user',
      risk: 'MEDIUM',
      args: ['<uid/username>']
    },
    mute: {
      desc: 'Silence user globally (prevent channel message posts)',
      risk: 'MEDIUM',
      args: ['<uid/username>'],
      flags: {
        '--reason <reason>': 'Reason for muting'
      }
    },
    unmute: {
      desc: 'Unsilence user globally (restore write privileges)',
      risk: 'MEDIUM',
      args: ['<uid/username>']
    },
    jail: {
      desc: 'Quarantine user to sandboxed channels',
      risk: 'MEDIUM',
      args: ['<uid/username>'],
      flags: {
        '--reason <reason>': 'Reason for quarantine'
      }
    },
    unjail: {
      desc: 'Lift quarantined status from a user',
      risk: 'MEDIUM',
      args: ['<uid/username>']
    },
    'reset': {
      desc: 'Revert user profile avatar',
      risk: 'MEDIUM',
      args: ['<uid/username>'],
      flags: {
        '--reason <reason>': 'Reason for resetting avatar'
      }
    },
    override: {
      desc: 'Reset user password and credentials to active state',
      risk: 'HIGH',
      args: ['<uid/username>', '<new_password>', '[new_recovery_key]', '[new_safe_word]'],
      flags: {
        '--reason <reason>': 'Override authorization reason'
      }
    },
    'set': {
      desc: 'Change global user role (USER, SUPPORT_ADMIN, LOGIN_ADMIN, CLI_ADMIN)',
      risk: 'HIGH',
      args: ['<uid/username>', '<role>'],
      flags: {
        '--reason <reason>': 'Role modification reason'
      }
    },
    deactivate: {
      desc: 'Start 14-day deactivation grace period',
      risk: 'HIGH',
      args: ['<uid/username>'],
      flags: {
        '--reason <reason>': 'Deactivation audit reason'
      }
    },
    'cancel': {
      desc: 'Reverse pending soft-deletion',
      risk: 'MEDIUM',
      args: ['<uid/username>']
    },
    'release': {
      desc: 'Trigger 2-day verification & asset release',
      risk: 'HIGH',
      args: ['<uid/username>'],
      flags: {
        '--reason <reason>': 'Verification audit reason'
      }
    },
    'purge': {
      desc: 'Irreversible final database purge (requires release-assets first)',
      risk: 'CRITICAL',
      args: ['<uid/username>'],
      flags: {
        '--reason <reason>': 'Purge verification audit reason'
      }
    },
    'nuke': {
      desc: 'Instant purge & immediate treasury asset takeover',
      risk: 'CRITICAL',
      args: ['<uid/username>'],
      flags: {
        '--reason <reason>': 'Fraud audit reason'
      }
    },
    blacklist: {
      desc: 'Add target ID to system blacklist',
      risk: 'HIGH',
      args: ['<id>'],
      flags: {
        '--type <type>': 'Blacklist type (e.g. IP, DEVICE, EMAIL). Defaults to IP',
        '--reason <reason>': 'Blacklist reason'
      }
    },
    unblacklist: {
      desc: 'Remove target ID from system blacklist',
      risk: 'HIGH',
      args: ['<id>']
    },
    'pending': {
      desc: 'View users in deactivation grace periods',
      risk: 'LOW'
    },
    restore: {
      desc: 'Restore a soft-purged user to active status',
      risk: 'MEDIUM',
      args: ['<uid/username>']
    }
  },
  '/lounges': {
    list: {
      desc: 'List active lounges',
      risk: 'LOW'
    },
    cat: {
      desc: 'View detailed metadata of a lounge',
      risk: 'LOW',
      args: ['<lounge_id>']
    },
    chown: {
      desc: 'Transfer ownership of a lounge',
      risk: 'HIGH',
      args: ['<lounge_id>', '<uid/username>'],
      flags: {
        '--reason <reason>': 'Ownership transfer reason'
      }
    },
    clean: {
      desc: 'Wipe all message history inside the public velum_lounge channel',
      risk: 'HIGH',
      flags: {
        '--reason <reason>': 'Clean logic audit reason'
      }
    },
    'restore': {
      desc: 'Restore messages from an encrypted restore point',
      risk: 'CRITICAL',
      args: ['<restore_point_id>']
    },
    delete: {
      desc: 'Delete lounge, sublounges, and messages',
      risk: 'CRITICAL',
      args: ['<lounge_id>'],
      flags: {
        '--reason <reason>': 'Delete logic audit reason'
      }
    },
    lock: {
      desc: 'Put lounge in read-only lock state',
      risk: 'MEDIUM',
      args: ['<lounge_id>'],
      flags: {
        '--reason <reason>': 'Lock reason'
      }
    },
    unlock: {
      desc: 'Unlock a locked lounge',
      risk: 'MEDIUM',
      args: ['<lounge_id>']
    }
  },
  '/support': {
    pending: {
      desc: 'List open or pending Support Operator promotion nominations',
      risk: 'LOW'
    },
    token: {
      desc: 'Reveal support recovery token (masked)',
      risk: 'LOW',
      args: ['<ticket_id>']
    },
    approve: {
      desc: 'Approve support candidate and generate SA credentials',
      risk: 'MEDIUM',
      args: ['<username>'],
      flags: {
        '--reason <reason>': 'Approval audit reason'
      }
    },
    reject: {
      desc: 'Reject Support Operator role nomination for user',
      risk: 'MEDIUM',
      args: ['<username>'],
      flags: {
        '--reason <reason>': 'Rejection reason'
      }
    },
    demote: {
      desc: 'Demote Support Admin access and revoke SA account',
      risk: 'MEDIUM',
      args: ['<username>'],
      flags: {
        '--reason <reason>': 'Demotion reason'
      }
    },
    delete: {
      desc: 'Purge a support ticket record',
      risk: 'HIGH',
      args: ['<ticket_id>'],
      flags: {
        '--reason <reason>': 'Delete ticket reason'
      }
    }
  },
  '/db': {
    integrity: {
      desc: 'Audit foreign keys and database coherence',
      risk: 'LOW'
    },
    'orphans': {
      desc: 'Scan for orphaned relational records',
      risk: 'LOW'
    },
    'clean': {
	      desc: 'Clean orphaned relational profiles and sessions',
      risk: 'HIGH'
    },
    backup: {
      desc: 'Export structural and configuration backup (no PII)',
      risk: 'HIGH'
    },
    export: {
      desc: 'Export raw records of a table (masked PII)',
      risk: 'LOW',
      args: ['<table>']
    },
    vacuum: {
      desc: 'Optimize, compact, and reclaim SQLite disk space',
      risk: 'HIGH'
    },
    restore: {
      desc: 'Restore database structural settings',
      risk: 'CRITICAL',
      args: ['<backup_file>']
    },
    seed: {
      desc: 'Seed platform non-destructively (retains existing records)',
      risk: 'CRITICAL'
    },
    prune: {
      desc: 'Deep database purge and hard structural reset (deletes PII)',
      risk: 'HIGH'
    },
    wipe: {
      desc: 'Irreversible deep full-database reset',
      risk: 'CRITICAL'
    }
  },
  '/sys': {
    status: {
      desc: 'Check system daemon and network health',
      risk: 'LOW'
    },
    top: {
      desc: 'View active resources and execution metrics',
      risk: 'LOW'
    },
    risk: {
      desc: 'Scan active logs for security threats',
      risk: 'LOW'
    },
    token: {
      desc: 'Generate dynamic 2FA operator token and OTP',
      risk: 'MEDIUM'
    },
    kill: {
      desc: 'Force terminate a specific session',
      risk: 'MEDIUM',
      args: ['<session_id>']
    },
    'flush': {
      desc: 'Flush all active sessions, forcing global re-auth',
      risk: 'HIGH'
    },
    'main-on': {
      desc: 'Put server in maintenance mode',
      risk: 'HIGH',
      flags: {
        '--reason <reason>': 'Maintenance reason'
      }
    },
    'maint-off': {
      desc: 'Lift maintenance mode restrictions',
      risk: 'MEDIUM'
    }
  },
  '/audit': {
    user: {
      desc: 'Trace administrative audit logs for user',
      risk: 'LOW',
      args: ['<uid/username>']
    },
    grep: {
      desc: 'Search logs for a text pattern',
      risk: 'LOW',
      args: ['<pattern>']
    },
    history: {
      desc: 'Display recent administrative audit logs sequence',
      risk: 'LOW'
    },
    'ledger': {
      desc: 'Execute HMAC rolling hash & mathematical verification (Power 2)',
      risk: 'LOW'
    },
    'hijacks': {
      desc: 'Evaluate active sessions for hijacked footprints (Power 1)',
      risk: 'LOW'
    },
    'ip': {
      desc: 'Cross-correlate accounts sharing identical subnets/profiles (Power 3)',
      risk: 'LOW'
    },
    'nodes': {
      desc: 'Scan fractal categories for RBAC inheritance leaks (Power 4)',
      risk: 'LOW'
    },
    'reconstruct': {
      desc: 'Rebuild broken mutual friend relationships (Power 5)',
      risk: 'HIGH'
    },
    'scan': {
        desc: 'Evaluate active sessions for hijacked footprints (Power 1)',
        risk: 'LOW'
    },
    'escrows': {
        desc: 'Audit active escrow locks for timeout anomalies and balance mismatches',
        risk: 'MEDIUM'
    }
  },
  '/fraud': {
    seize: {
      desc: 'Seize all user ledger assets & escrows to treasury',
      risk: 'CRITICAL',
      args: ['<uid/username>'],
      flags: {
        '--reason <reason>': 'Seizure reason'
      }
    },
    freeze: {
      desc: 'Lock user wallets and escrows',
      risk: 'MEDIUM',
      args: ['<uid/username>'],
      flags: {
        '--reason <reason>': 'Freeze reason'
      }
    },
    unfreeze: {
      desc: 'Restore financial transactions access',
      risk: 'MEDIUM',
      args: ['<uid/username>']
    }
  }
};
