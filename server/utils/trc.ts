import crypto from 'crypto';

export function generate8HexChars(): string {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

export function generateTrcCode(
  type: 'recharge' | 'withdrawal' | 'hold' | 'release' | 'refund' | 'penalty',
  option?: string
): string {
  const hex = generate8HexChars();
  switch (type) {
    case 'recharge': {
      const surchargeType = option || 'INST';
      return `DEP-VLM-${surchargeType}-${hex}`;
    }
    case 'withdrawal': {
      const kycLevel = option || 'BASIC';
      return `WTH-VLM-${kycLevel}-${hex}`;
    }
    case 'hold': {
      const assetPrefix = option || 'AST48';
      return `ESC-HLD-${assetPrefix}-${hex}`;
    }
    case 'release': {
      const assetPrefix = option || 'AST48';
      return `ESC-REL-${assetPrefix}-${hex}`;
    }
    case 'refund': {
      const assetPrefix = option || 'AST48';
      return `ESC-RFD-${assetPrefix}-${hex}`;
    }
    case 'penalty': {
      const violatorRole = option || 'BUYER';
      return `PEN-HRM-${violatorRole}-${hex}`;
    }
    default:
      return `TRC-VLM-${hex}`;
  }
}
