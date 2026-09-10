import { describe, expect, it } from 'vitest';
import { formatRoleLabel } from '../../src/utils/formatRoleLabel';

describe('formatRoleLabel', () => {
  it('maps known wire roles to short labels', () => {
    expect(formatRoleLabel('CLI_ADMIN')).toBe('Cli');
    expect(formatRoleLabel('LOGIN_ADMIN')).toBe('Login');
    expect(formatRoleLabel('SUPPORT_ADMIN')).toBe('Support');
    expect(formatRoleLabel('SUPPORT_OPERATOR')).toBe('Support');
    expect(formatRoleLabel('ADMIN')).toBe('Admin');
    expect(formatRoleLabel('BANK_ADMIN')).toBe('Bank');
    expect(formatRoleLabel('USER')).toBe('User');
    expect(formatRoleLabel('MEMBER')).toBe('User');
    expect(formatRoleLabel('BLOCKED')).toBe('Blocked');
    expect(formatRoleLabel('SYSTEM')).toBe('System');
  });

  it('is case-insensitive on wire values', () => {
    expect(formatRoleLabel('cli_admin')).toBe('Cli');
    expect(formatRoleLabel('Login_Admin')).toBe('Login');
  });

  it('defaults empty or missing to User', () => {
    expect(formatRoleLabel(null)).toBe('User');
    expect(formatRoleLabel(undefined)).toBe('User');
    expect(formatRoleLabel('')).toBe('User');
    expect(formatRoleLabel('   ')).toBe('User');
  });

  it('uses the first segment for unknown multi-part roles', () => {
    expect(formatRoleLabel('FOO_BAR_BAZ')).toBe('Foo');
  });
});
