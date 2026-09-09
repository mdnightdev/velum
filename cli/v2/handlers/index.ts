import type { CommandHandler } from '../types.js';
import { handleUsers } from './users.js';
import { handleSanctions } from './sanctions.js';
import { handleTickets } from './tickets.js';
import { handleDb } from './db.js';
import { handleMarket } from './market.js';
import { handleEscrow } from './escrow.js';
import { handleDevops } from './devops.js';
import { handleSys } from './sys.js';
import { handleBank } from './bank.js';
import { handleCards } from './cards.js';
import { handleAudits } from './audits.js';
import { handleFraud } from './fraud.js';
import { handleLounges } from './lounges.js';

export const HANDLERS: Record<string, CommandHandler> = {
  '/users': handleUsers,
  '/sanctions': handleSanctions,
  '/tickets': handleTickets,
  '/db': handleDb,
  '/market': handleMarket,
  '/escrow': handleEscrow,
  '/devops': handleDevops,
  '/sys': handleSys,
  '/bank': handleBank,
  '/cards': handleCards,
  '/audits': handleAudits,
  '/fraud': handleFraud,
  '/lounges': handleLounges
};
