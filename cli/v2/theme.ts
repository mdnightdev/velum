export const theme = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[90m',
  white: '\x1b[37m',
  boldWhite: '\x1b[1m\x1b[37m',
  teal: '\x1b[38;2;45;180;170m',
  boldTeal: '\x1b[1m\x1b[38;2;45;180;170m',
  amber: '\x1b[38;2;215;170;90m',
  boldAmber: '\x1b[1m\x1b[38;2;215;170;90m',
  green: '\x1b[38;2;75;190;130m',
  red: '\x1b[38;2;235;85;85m',
  criticalRed: '\x1b[1m\x1b[38;2;245;65;65m'
};

export function riskColor(risk: string): string {
  switch (risk) {
    case 'LOW': return theme.dim;
    case 'MEDIUM': return theme.amber;
    case 'HIGH': return theme.red;
    case 'CRITICAL': return theme.criticalRed;
    default: return theme.white;
  }
}
