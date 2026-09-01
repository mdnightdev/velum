import { describe, it } from 'node:test';
import assert from 'node:assert';
import crypto from 'node:crypto';
import { hashArgon2id, verifyArgon2id } from '../../server/v2/utils/crypto.js';
import { V2_COMMAND_REGISTRY } from '../../cli/v2/registry.js';
import { stateManager } from '../../cli/v2/state/stateManager.js';
import { parseCommandLine, requireArg, requireIntArg } from '../../cli/v2/parser.js';
import { HANDLERS } from '../../cli/v2/handlers/index.js';
import { VelumV2Shell } from '../../cli/v2/shell.js';
import { isProtectedUser, isProtectedLounge, guardProtectedUser, guardProtectedLounge } from '../../cli/v2/protection.js';
import { printTable } from '../../cli/v2/table.js';

describe('CLI V2 Modular & Security Verifications', () => {
  it('authenticates valid credentials strictly via verifyArgon2id', async () => {
    const salt = crypto.randomBytes(16).toString('hex');
    const password = 'CorrectHorseBatteryStaple99!';
    const passwordHash = await hashArgon2id(password, Buffer.from(salt, 'hex'));

    const isValid = await verifyArgon2id(password, salt, passwordHash);
    assert.strictEqual(isValid, true);

    const isWrongPassword = await verifyArgon2id('WrongPassword123!', salt, passwordHash);
    assert.strictEqual(isWrongPassword, false);
  });

  it('rejects plaintext password attempts against stored hashes', async () => {
    const salt = crypto.randomBytes(16).toString('hex');
    const password = 'TargetPasswordSecure123';
    const passwordHash = await hashArgon2id(password, Buffer.from(salt, 'hex'));

    const emptySaltMatch = await verifyArgon2id(password, '', passwordHash);
    assert.strictEqual(emptySaltMatch, false);
  });

  it('does not expose pg or redis subcommands in /db command registry', () => {
    const dbCommands = V2_COMMAND_REGISTRY['/db'];
    assert.ok(dbCommands);
    assert.strictEqual(dbCommands['pg'], undefined);
    assert.strictEqual(dbCommands['redis'], undefined);

    assert.ok(dbCommands['integrity']);
    assert.ok(dbCommands['orphans']);
    assert.ok(dbCommands['clean']);
    assert.ok(dbCommands['vacuum']);
    assert.ok(dbCommands['backup']);
    assert.ok(dbCommands['restore']);
  });

  it('validates CLI argument constraints correctly', () => {
    assert.strictEqual(requireArg(['alice'], 0, 'usage', { type: 'username' }), 'alice');
    assert.strictEqual(requireArg(['al'], 0, 'usage', { type: 'username' }), null);
    assert.strictEqual(requireIntArg(['123'], 0, 'usage'), 123);
    assert.strictEqual(requireIntArg(['abc'], 0, 'usage'), null);
  });

  it('persists and enforces CLI state configuration flags', async () => {
    const origMaint = stateManager.isMaintenanceMode();
    const origTx = stateManager.getTxFeePercent();
    const origTax = stateManager.getTaxPercent();
    const origEscrow = stateManager.getEscrowFeePercent();

    try {
      await stateManager.setMaintenanceMode(true);
      assert.strictEqual(stateManager.isMaintenanceMode(), true);

      await stateManager.setMaintenanceMode(false);
      assert.strictEqual(stateManager.isMaintenanceMode(), false);

      await stateManager.setTxFeePercent('3.5');
      assert.strictEqual(stateManager.getTxFeePercent(), '3.5');

      await stateManager.setTaxPercent('1.25');
      assert.strictEqual(stateManager.getTaxPercent(), '1.25');

      await stateManager.setEscrowFeePercent('2.0');
      assert.strictEqual(stateManager.getEscrowFeePercent(), '2.0');

      await stateManager.addMuted('bad_actor_99');
      assert.strictEqual(stateManager.isMuted('bad_actor_99'), true);
      await stateManager.removeMuted('bad_actor_99');
      assert.strictEqual(stateManager.isMuted('bad_actor_99'), false);

      await stateManager.addJailed('troll_user_42');
      assert.strictEqual(stateManager.isJailed('troll_user_42'), true);
      await stateManager.removeJailed('troll_user_42');
      assert.strictEqual(stateManager.isJailed('troll_user_42'), false);
    } finally {
      await stateManager.setMaintenanceMode(origMaint);
      await stateManager.setTxFeePercent(origTx);
      await stateManager.setTaxPercent(origTax);
      await stateManager.setEscrowFeePercent(origEscrow);
    }

    await stateManager.addFrozenWallet('wallet_9999');
    assert.strictEqual(stateManager.isWalletFrozen('wallet_9999'), true);
    await stateManager.removeFrozenWallet('wallet_9999');
    assert.strictEqual(stateManager.isWalletFrozen('wallet_9999'), false);
  });

  it('parses command line tokens and flags correctly', () => {
    const cmd = parseCommandLine('wire user1 user2 50.00 --reason "Payment for services" -f');
    assert.ok(cmd);
    assert.strictEqual(cmd.verb, 'wire');
    assert.deepStrictEqual(cmd.args, ['user1', 'user2', '50.00']);
    assert.strictEqual(cmd.flags['reason'], 'Payment for services');
    assert.strictEqual(cmd.flags['f'], true);
  });

  it('registers all 13 modular namespace handlers', () => {
    const expectedNamespaces = [
      '/users', '/sanctions', '/tickets', '/db', '/market',
      '/escrow', '/devops', '/sys', '/bank', '/cards',
      '/audits', '/fraud', '/lounges'
    ];

    for (const ns of expectedNamespaces) {
      assert.ok(HANDLERS[ns], `Handler for ${ns} should be registered`);
      assert.ok(V2_COMMAND_REGISTRY[ns], `Registry for ${ns} should exist`);
    }

    assert.strictEqual(V2_COMMAND_REGISTRY['/users']['deactivate'], undefined);
    assert.strictEqual(V2_COMMAND_REGISTRY['/users']['cancel'], undefined);
    assert.ok(V2_COMMAND_REGISTRY['/users']['restore']);
    assert.ok(V2_COMMAND_REGISTRY['/users']['purge']);

    assert.ok(V2_COMMAND_REGISTRY['/sanctions']['history']);
    assert.ok(V2_COMMAND_REGISTRY['/sanctions']['flags']);
    assert.ok(V2_COMMAND_REGISTRY['/sanctions']['blacklist']);
    assert.ok(V2_COMMAND_REGISTRY['/sanctions']['whitelist']);
    assert.strictEqual(V2_COMMAND_REGISTRY['/sanctions']['ban'], undefined);
    assert.strictEqual(V2_COMMAND_REGISTRY['/sanctions']['mute'], undefined);
    assert.strictEqual(V2_COMMAND_REGISTRY['/sanctions']['jail'], undefined);
  });

  it('instantiates the modular shell orchestrator', () => {
    const shell = new VelumV2Shell();
    assert.strictEqual(shell.getCurrentPath(), '/');
    const [completions] = shell.getCompletions('cd ');
    assert.ok(completions.includes('/users'));
    assert.ok(completions.includes('/bank'));
  });

  it('enforces system service account protection firewall (IDs 1, 2, 999)', () => {
    assert.strictEqual(isProtectedUser(1), true);
    assert.strictEqual(isProtectedUser(2), true);
    assert.strictEqual(isProtectedUser(999), true);
    assert.strictEqual(isProtectedUser('midnight'), true);
    assert.strictEqual(isProtectedUser('lexie'), true);
    assert.strictEqual(isProtectedUser('velum'), true);
    assert.strictEqual(isProtectedUser('system_bot'), true);

    assert.strictEqual(isProtectedUser(42), false);
    assert.strictEqual(isProtectedUser('regular_user'), false);

    assert.strictEqual(guardProtectedUser(1, 'delete'), false);
    assert.strictEqual(guardProtectedUser(2, 'demote'), false);
    assert.strictEqual(guardProtectedUser(999, 'ban'), false);
    assert.strictEqual(guardProtectedUser(55, 'ban'), true);
  });

  it('enforces official Velum lounge protection firewall (IDs 1-11)', () => {
    for (let id = 1; id <= 11; id++) {
      assert.strictEqual(isProtectedLounge(id), true);
      assert.strictEqual(guardProtectedLounge(id, 'delete'), false);
    }
    assert.strictEqual(isProtectedLounge('velum_lounge'), true);
    assert.strictEqual(isProtectedLounge('velum_general'), true);
    assert.strictEqual(isProtectedLounge('velum_executives'), true);

    assert.strictEqual(isProtectedLounge(99), false);
    assert.strictEqual(isProtectedLounge('random_user_lounge'), false);
    assert.strictEqual(guardProtectedLounge(99, 'delete'), true);
  });

  it('detects zero-tolerance keywords accurately', async () => {
    const { moderationService } = await import('../../server/v2/services/moderationService.js');
    assert.strictEqual(moderationService.detectZeroToleranceViolation('Attempting chargeback fraud on escrow'), 'chargeback');
    assert.strictEqual(moderationService.detectZeroToleranceViolation('Check this phishing link'), 'phishing');
    assert.strictEqual(moderationService.detectZeroToleranceViolation('Installing keylogger on target'), 'keylogger');
    assert.strictEqual(moderationService.detectZeroToleranceViolation('Normal friendly message here'), null);
  });

  it('detects and drops malicious executable scripts and payloads', async () => {
    const { moderationService } = await import('../../server/v2/services/moderationService.js');
    assert.ok(moderationService.detectMaliciousPayload('<script>document.cookie</script>'));
    assert.ok(moderationService.detectMaliciousPayload('const x = eval("1+1");'));
    assert.ok(moderationService.detectMaliciousPayload('powershell.exe -enc dGVzdA=='));
    assert.ok(moderationService.detectMaliciousPayload('/bin/sh -i'));
    assert.strictEqual(moderationService.detectMaliciousPayload('Standard safe listing title and description'), null);
  });

  it('generates clean bot message templates without ASCII border noise', async () => {
    const { BotTemplates } = await import('../../server/v2/services/botTemplates.js');
    const msg1 = BotTemplates.strike1Warning({ username: 'testuser', reason: 'Spamming channels', strikeNumber: 1 });
    assert.ok(msg1.includes('Strike 1 Warning'));
    assert.ok(!msg1.includes('━━━━'));

    const msg2 = BotTemplates.instantZeroToleranceBlacklist('testuser', 'FRAUD', 'Chargeback fraud detected');
    assert.ok(msg2.includes('Immediate Permanent Blacklist'));
    assert.ok(!msg2.includes('━━━━'));
  });
});
