import { bankStore, getSystemAccount } from '../../services/bankStore.js';

export const bankingCommands = {
  fundc: async (amountCents: number, description: string) => {
    const accounts = await bankStore.getAccounts();
    const centralReserve = await getSystemAccount('CENTRAL');
    if (!centralReserve) return 'ERROR: central reserve account not found.';
    centralReserve.balance_cents += amountCents;
    await bankStore.saveAccounts(accounts);
    
    const transactions = await bankStore.getTransactions();
    transactions.push({
      transaction_id: `bank_tx_${Date.now()}`,
      account_id: centralReserve.account_id,
      type: 'deposit',
      amount_cents: Math.abs(amountCents),
      currency_code: 'TWD',
      description: `Central Reserve Funding: ${description}`,
      timestamp: Date.now(),
      status: 'completed'
    });
    await bankStore.saveTransactions(transactions);
    return `SUCCESS: Added ${amountCents/100} TWD to Central Reserve.`;
  },

  fundt: async (amountCents: number, description: string) => {
    const accounts = await bankStore.getAccounts();
    const memberTrust = await getSystemAccount('MEMBER');
    const centralReserve = await getSystemAccount('CENTRAL');
    if (!memberTrust || !centralReserve) return 'ERROR: Required bank accounts not found.';
    
    memberTrust.balance_cents += amountCents;
    centralReserve.balance_cents -= amountCents;
    await bankStore.saveAccounts(accounts);
    
    const transactions = await bankStore.getTransactions();
    transactions.push({
      transaction_id: `bank_tx_${Date.now()}`,
      account_id: memberTrust.account_id,
      type: 'deposit',
      amount_cents: Math.abs(amountCents),
      currency_code: 'TWD',
      description: `Transfer from Central Reserve: ${description}`,
      timestamp: Date.now(),
      status: 'completed'
    });
    transactions.push({
      transaction_id: `bank_tx_${Date.now()+1}`,
      account_id: centralReserve.account_id,
      type: 'withdrawal',
      amount_cents: Math.abs(amountCents),
      currency_code: 'TWD',
      description: `Transfer to Member Trust: ${description}`,
      timestamp: Date.now(),
      status: 'completed'
    });
    await bankStore.saveTransactions(transactions);
    return `SUCCESS: Transferred ${amountCents/100} TWD to Member Trust.`;
  },

  funde: async (amountCents: number, description: string) => {
    const accounts = await bankStore.getAccounts();
    const escrowReserve = await getSystemAccount('ESCROW');
    const centralReserve = await getSystemAccount('CENTRAL');
    if (!escrowReserve || !centralReserve) return 'ERROR: Required bank accounts not found.';
    
    escrowReserve.balance_cents += amountCents;
    centralReserve.balance_cents -= amountCents;
    await bankStore.saveAccounts(accounts);
    return `SUCCESS: Transferred ${amountCents/100} TWD to Escrow Reserve.`;
  }
};
