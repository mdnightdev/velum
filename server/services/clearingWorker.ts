import { db, saveDb } from '../db.js';
import { marketRepository } from '../db/marketRepository.js';
import { walletRepository } from '../db/walletRepository.js';
import { generateTrcCode, generate8HexChars } from '../utils/trc.js';
import { writeServerLog } from '../utils/logger.js';

/**
 * 5-Minute Escrow Clearing Guarantee background task.
 * Scans for escrow transactions that have been HELD_IN_ESCROW for >= 5 minutes,
 * verifies there are no active disputes, and automatically releases them.
 */
export async function processEscrowClearingWorker(): Promise<void> {
  try {
    const escrows = marketRepository.findAllEscrows();
    const pendingEscrows = escrows.filter(esc => esc && esc.status === 'HELD_IN_ESCROW');
    
    if (pendingEscrows.length === 0) return;

    const fiveMinutesMs = 5 * 60 * 1000;
    const now = Date.now();
    let releasedCount = 0;

    for (const esc of pendingEscrows) {
      const createdAt = Number(esc.created_at);
      if (now < createdAt + fiveMinutesMs) {
        continue; // Not yet 5 minutes old
      }

      // Check if there is an active, unresolved dispute
      const hasActiveDispute = (db.market_support_chats || []).some(chat => 
        chat && 
        chat.order_id === esc.transaction_id && 
        chat.is_disputed && 
        !chat.resolved_at
      );

      if (hasActiveDispute) {
        console.log(`[SYS-SECURE] Skipping automated clearing for escrow ${esc.transaction_id} due to active unresolved dispute.`);
        continue;
      }

      const { processReleaseEscrow } = await import('./marketplaceService.js');
      const res = await processReleaseEscrow(esc.transaction_id, 999, true);

      if (res.success) {
        // Create automation action log
        marketRepository.createAutomationAction({
          action_id: generateTrcCode('release', 'AST48'),
          escrow_transaction_id: esc.transaction_id,
          action_type: 'AUTO_RELEASE',
          acted_on_behalf_of: 'BUYER',
          trigger_reason: '5-minute automated clearing guarantee met.',
          executed_at: Date.now(),
          human_reviewed: false
        });
        releasedCount++;
      }
    }

    if (releasedCount > 0) {
      console.log(`[SYS-SECURE] Escrow clearing worker released ${releasedCount} escrow(s).`);
      saveDb();
    }
  } catch (error) {
    console.error('[SYS-SECURE] Error in escrow clearing worker:', error);
  }
}

/**
 * Performs a rigorous double-entry ledger integrity reconciliation check.
 * Sums the ledger entries for every active wallet and logs discrepancy alerts.
 */
export function performLedgerReconciliationCheck(): void {
  try {
    writeServerLog('[SYS-SECURE] Starting ledger reconciliation integrity checks...');
    const wallets = db.user_wallets || [];
    let discrepanciesDetected = 0;

    for (const wallet of wallets) {
      if (!wallet) continue;

      const ledgerEntries = (db.wallet_ledger_entries || []).filter(entry => 
        entry && Number(entry.user_id) === Number(wallet.user_id)
      );

      const expectedCents = ledgerEntries.reduce((sum, entry) => sum + (entry.amount_cents || 0), 0);
      const actualCents = wallet.balance_cents;

      if (expectedCents !== actualCents) {
        discrepanciesDetected++;
        writeServerLog(`[SYS-SECURE] INTEGRITY FAULT: Discrepancy found for user ${wallet.user_id}. Wallet: ${actualCents} cents, Ledger: ${expectedCents} cents. Difference: ${actualCents - expectedCents} cents.`);
        
        // Log to platforms financial audit
        marketRepository.createPlatformFinancialAuditLog({
          log_id: `rec_${generate8HexChars()}`,
          acting_admin_id: 'SYSTEM_AUTOMATION',
          action_type: 'RECONCILIATION_DISCREPANCY',
          related_transaction_id: `wallet_${wallet.user_id}`,
          reason: `Discrepancy: Wallet balance is ${actualCents} cents, ledger sum is ${expectedCents} cents.`,
          created_at: Date.now()
        });
      }
    }

    if (discrepanciesDetected === 0) {
      writeServerLog('[SYS-SECURE] Ledger reconciliation checks completed: 100% integrity verified.');
    } else {
      writeServerLog(`[SYS-SECURE] Ledger reconciliation checks completed: ${discrepanciesDetected} discrepancies detected.`);
    }
  } catch (error) {
    writeServerLog(`[SYS-SECURE] Ledger reconciliation check error: ${error}`);
  }
}

let clearingInterval: NodeJS.Timeout | null = null;

/**
 * Starts the automated clearing worker.
 */
export function startClearingWorker(intervalMs = 30000): void {
  if (clearingInterval) {
    clearInterval(clearingInterval);
  }
  
  // Run immediate reconciliation check
  performLedgerReconciliationCheck();

  // Run immediate clearing check
  processEscrowClearingWorker();

  // Start periodic clearing checks
  clearingInterval = setInterval(() => {
    processEscrowClearingWorker();
  }, intervalMs);

  writeServerLog(`[SYS-SECURE] Automated escrow clearing worker started (polling interval: ${intervalMs}ms).`);
}

/**
 * Stops the automated clearing worker.
 */
export function stopClearingWorker(): void {
  if (clearingInterval) {
    clearInterval(clearingInterval);
    clearingInterval = null;
    writeServerLog('[SYS-SECURE] Automated escrow clearing worker stopped.');
  }
}
