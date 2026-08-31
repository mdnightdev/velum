import crypto from 'node:crypto';
import { cardRepository } from '../../../server/v2/repositories/cardRepository.js';
import { userRepository } from '../../../server/v2/repositories/userRepository.js';
import { bankRepository } from '../../../server/v2/repositories/bankRepository.js';
import { printTable } from '../table.js';
import { guardProtectedUser } from '../protection.js';
import type { CommandContext } from '../types.js';

function getDefaultLimitForRole(role: string): number {
  const defaults: Record<string, number> = {
    'STANDARD': 500000,
    'PREMIUM': 2500000,
    'VIP': 10000000,
    'ADMIN': 10000000,
    'BANK_ADMIN': 10000000,
    'SUPPORT_ADMIN': 10000000
  };
  return defaults[role] || defaults['STANDARD'];
}

export async function handleCards(ctx: CommandContext): Promise<void> {
  const { sub, rawArgs, resolveUser, logAudit } = ctx;

  if (sub === 'cards' || sub === 'list' || sub === 'ls') {
    const allCards = await cardRepository.getAllCards(100);
    const rows = await Promise.all(allCards.map(async (card) => {
      const user = await userRepository.findById(card.userId);
      return {
        Token: card.cardToken,
        Holder: user?.username || `user_${card.userId}`,
        Type: card.cardType,
        Limit: `$${(card.limitCents / 100).toFixed(2)}`,
        Active: card.isActive ? 'Y' : 'N'
      };
    }));
    printTable(rows);
    return;
  }

  if (sub === 'credit' || sub === 'debit') {
    const cardType = sub.toUpperCase();
    const allCards = await cardRepository.getCardsByType(cardType, 100);
    const rows = await Promise.all(allCards.map(async (card) => {
      const user = await userRepository.findById(card.userId);
      return {
        Token: card.cardToken,
        Holder: user?.username || `user_${card.userId}`,
        Limit: `$${(card.limitCents / 100).toFixed(2)}`,
        Active: card.isActive ? 'Y' : 'N'
      };
    }));
    printTable(rows);
    return;
  }

  if (sub === 'cardad' || sub === 'cardu') {
    const [token, amountCentsStr] = rawArgs;
    if (!token || !amountCentsStr) { console.log('Usage: cardad <card_token_or_username> <amount_cents>'); return; }
    const cents = parseInt(amountCentsStr, 10);
    if (isNaN(cents) || cents <= 0) { console.log('Invalid cents amount.'); return; }
    
    let holderName = token;
    const user = await resolveUser(token.replace(/^CRD-/, ''));
    
    if (user) {
      const card = await cardRepository.findCardByUserId(user.id);
      if (card) {
        await cardRepository.updateLimit(card.id, cents);
        holderName = user.username;
        console.log(`[OK] Updated card ${card.cardToken} for ${user.username} credit limit to ${cents} cents.`);
      } else {
        const newCard = await cardRepository.createCard({
          userId: user.id,
          cardToken: `CRD-${crypto.randomBytes(8).toString('hex').toUpperCase()}`,
          limitCents: cents,
          isActive: true
        });
        holderName = user.username;
        console.log(`[OK] Created card ${newCard.cardToken} for ${user.username} with credit limit ${cents} cents.`);
      }
    } else {
      const card = await cardRepository.findCardByToken(token);
      if (card) {
        await cardRepository.updateLimit(card.id, cents);
        const cardUser = await userRepository.findById(card.userId);
        holderName = cardUser?.username || `user_${card.userId}`;
        console.log(`[OK] Updated card ${card.cardToken} (${holderName}) credit limit to ${cents} cents.`);
      } else {
        console.log(`Card or user "${token}" not found.`);
        return;
      }
    }
    await logAudit('/cards/cardad', token, `Updated card limit to ${cents} cents`);
    return;
  }

  if (sub === 'cardl') {
    const allCards = await cardRepository.getAllCards(100);
    const ledgerRows = await Promise.all(allCards.map(async (card) => {
      const user = await userRepository.findById(card.userId);
      const w = await bankRepository.findWalletByUserId(card.userId);
      const balCents = w ? Math.round(parseFloat(w.balance || '0') * 100) : 0;
      return {
        Token: card.cardToken,
        Name: user?.username || `user_${card.userId}`,
        BalCents: balCents,
        LimitCents: card.limitCents,
        AvailCents: Math.max(0, card.limitCents - balCents)
      };
    }));
    printTable(ledgerRows);
    return;
  }

  if (sub === 'create') {
    const [target, cardType, limitCentsStr] = rawArgs;
    if (!target) { console.log('Usage: create <username> [CREDIT|DEBIT] [limit_cents]'); return; }
    const type = cardType ? cardType.toUpperCase() : 'CREDIT';
    if (type !== 'CREDIT' && type !== 'DEBIT') { console.log('Card type must be CREDIT or DEBIT'); return; }
    const cents = limitCentsStr ? parseInt(limitCentsStr, 10) : getDefaultLimitForRole('STANDARD');
    if (isNaN(cents) || cents <= 0) { console.log('Invalid cents amount.'); return; }
    
    const user = await resolveUser(target);
    if (!user) { console.log(`User "${target}" not found.`); return; }
    
    const existingCard = await cardRepository.findCardByUserId(user.id);
    if (existingCard) {
      console.log(`User ${user.username} already has card ${existingCard.cardToken}.`);
      return;
    }
    
    const newCard = await cardRepository.createCard({
      userId: user.id,
      cardToken: crypto.randomBytes(16).toString('hex'),
      cardType: type,
      limitCents: cents,
      isActive: true
    });
    
    console.log(`[OK] Created ${type} card ${newCard.cardToken} for ${user.username} with limit $${(cents / 100).toFixed(2)}.`);
    await logAudit('/cards/create', user.username, `Created ${type} card ${newCard.cardToken}`);
    return;
  }

  if (sub === 'delete') {
    const [target] = rawArgs;
    if (!target) { console.log('Usage: delete <card_token_or_username>'); return; }
    
    const user = await resolveUser(target.replace(/^CRD-/, ''));
    let card;
    
    if (user) {
      if (!guardProtectedUser(user.id, 'delete card of')) return;
      card = await cardRepository.findCardByUserId(user.id);
    } else {
      card = await cardRepository.findCardByToken(target);
      if (card && !guardProtectedUser(card.userId, 'delete card of')) return;
    }
    
    if (!card) {
      console.log(`Card not found for "${target}".`);
      return;
    }
    
    await cardRepository.deleteCard(card.id);
    console.log(`[OK] Deleted card ${card.cardToken}.`);
    await logAudit('/cards/delete', card.cardToken, `Deleted card ${card.cardToken}`);
    return;
  }
}
