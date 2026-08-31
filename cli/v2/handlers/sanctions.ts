import { db } from '../../../server/v2/db/client.js';
import { users } from '../../../server/v2/db/schema/users.js';
import { userRepository } from '../../../server/v2/repositories/userRepository.js';
import { stateManager } from '../state/stateManager.js';
import { printTable } from '../table.js';
import { guardProtectedUser } from '../protection.js';
import type { CommandContext } from '../types.js';

export async function handleSanctions(ctx: CommandContext): Promise<void> {
  const { sub, rawArgs, resolveUser } = ctx;

  if (sub === 'history' || sub === 'list') {
    const allUsers = await db.select().from(users).limit(100);
    const bannedUsers = allUsers.filter(u => u.role === 'BANNED' || u.role === 'DEACTIVATED' || stateManager.isMuted(u.username) || stateManager.isJailed(u.username));
    printTable(bannedUsers.map(u => ({
      ID: u.id,
      Username: u.username,
      Role: u.role,
      Muted: stateManager.isMuted(u.username) ? 'Y' : 'N',
      Jailed: stateManager.isJailed(u.username) ? 'Y' : 'N',
      Created: u.createdAt ? new Date(u.createdAt).toISOString().split('T')[0] : '-'
    })));
    return;
  }

  if (sub === 'status') {
    const target = rawArgs[0];
    if (!target) { console.log('Usage: status <id_or_username>'); return; }
    const user = await resolveUser(target);
    if (!user) { console.log(`User "${target}" not found.`); return; }
    console.log(`Account Role: ${user.role}`);
    console.log(`Muted: ${stateManager.isMuted(user.username)}`);
    console.log(`Restricted: ${stateManager.isJailed(user.username)}`);
    return;
  }

  if (sub === 'kick') {
    const target = rawArgs[0];
    if (!target) { console.log('Usage: kick <id_or_username>'); return; }
    const user = await resolveUser(target);
    if (user && !guardProtectedUser(user.id, 'kick')) return;
    console.log(`[OK] Disconnected user ${target}.`);
    return;
  }

  if (sub === 'ban') {
    const target = rawArgs[0];
    if (!target) { console.log('Usage: ban <id_or_username>'); return; }
    const user = await resolveUser(target);
    if (!user) { console.log(`User "${target}" not found.`); return; }
    if (!guardProtectedUser(user.id, 'ban')) return;
    await userRepository.update(user.id, { role: 'BANNED' });
    console.log(`[OK] Banned user ${user.username}.`);
    return;
  }

  if (sub === 'unban') {
    const target = rawArgs[0];
    if (!target) { console.log('Usage: unban <id_or_username>'); return; }
    const user = await resolveUser(target);
    if (!user) { console.log(`User "${target}" not found.`); return; }
    await userRepository.update(user.id, { role: 'USER' });
    console.log(`[OK] Unbanned user ${user.username}.`);
    return;
  }

  if (sub === 'mute') {
    const target = rawArgs[0];
    if (!target) { console.log('Usage: mute <id_or_username>'); return; }
    const user = await resolveUser(target);
    if (!user) { console.log(`User "${target}" not found.`); return; }
    if (!guardProtectedUser(user.id, 'mute')) return;
    await stateManager.addMuted(user.username);
    console.log(`[OK] Muted user ${user.username}.`);
    return;
  }

  if (sub === 'unmute') {
    const target = rawArgs[0];
    if (!target) { console.log('Usage: unmute <id_or_username>'); return; }
    const user = await resolveUser(target);
    if (!user) { console.log(`User "${target}" not found.`); return; }
    await stateManager.removeMuted(user.username);
    console.log(`[OK] Unmuted user ${user.username}.`);
    return;
  }

  if (sub === 'jail') {
    const target = rawArgs[0];
    if (!target) { console.log('Usage: jail <id_or_username>'); return; }
    const user = await resolveUser(target);
    if (!user) { console.log(`User "${target}" not found.`); return; }
    if (!guardProtectedUser(user.id, 'jail/restrict')) return;
    await stateManager.addJailed(user.username);
    console.log(`[OK] Restricted user ${user.username}.`);
    return;
  }

  if (sub === 'unjail') {
    const target = rawArgs[0];
    if (!target) { console.log('Usage: unjail <id_or_username>'); return; }
    const user = await resolveUser(target);
    if (!user) { console.log(`User "${target}" not found.`); return; }
    await stateManager.removeJailed(user.username);
    console.log(`[OK] Removed restrictions for ${user.username}.`);
    return;
  }

  if (sub === 'flags') {
    const target = rawArgs[0];
    if (target) {
      const user = await resolveUser(target);
      if (!user) { console.log(`User "${target}" not found.`); return; }
      console.log(`Role: ${user.role}`);
      console.log(`Muted: ${stateManager.isMuted(user.username)}`);
      console.log(`Restricted: ${stateManager.isJailed(user.username)}`);
      return;
    }
    const allUsers = await db.select().from(users).limit(100);
    const sanctioned = allUsers.filter(u =>
      ['BANNED', 'SUSPENDED', 'RESTRICTED', 'DEACTIVATED'].includes(u.role) ||
      stateManager.isMuted(u.username) ||
      stateManager.isJailed(u.username)
    );
    if (sanctioned.length > 0) {
      printTable(sanctioned.map(u => ({
        ID: u.id,
        Username: u.username,
        Role: u.role,
        Muted: stateManager.isMuted(u.username) ? 'Y' : 'N',
        Jailed: stateManager.isJailed(u.username) ? 'Y' : 'N',
        Status: u.role === 'BANNED' ? 'BANNED' : stateManager.isMuted(u.username) ? 'MUTED' : stateManager.isJailed(u.username) ? 'RESTRICTED' : u.role
      })));
    } else {
      console.log('No active moderation flags.');
    }
    return;
  }
}
