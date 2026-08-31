import { V2_COMMAND_REGISTRY } from './registry.js';

export const theme = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[90m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  red: '\x1b[91m',
  criticalRed: '\x1b[31m\x1b[1m'
};

export function riskColor(risk: string): string {
  switch (risk) {
    case 'MEDIUM': return theme.yellow;
    case 'HIGH': return theme.red;
    case 'CRITICAL': return theme.criticalRed;
    default: return theme.green;
  }
}

export function namespaceMaxRisk(nsPath: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  const order = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  const cmds = V2_COMMAND_REGISTRY[nsPath];
  if (!cmds) return 'LOW';
  let max = 0;
  for (const meta of Object.values(cmds)) {
    max = Math.max(max, order.indexOf(meta.risk));
  }
  return order[max] as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}
