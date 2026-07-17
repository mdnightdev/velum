import React, { useState, useEffect } from 'react';
import { Database, AlertTriangle, PieChart, Lock, Unlock, RefreshCw, XCircle, ArrowUpRight, ArrowDownRight, ShieldAlert, CheckCircle2, ListChecks, Activity, CreditCard } from 'lucide-react';

interface AdminBankProps {
  adminRole: 'SUPPORT_ADMIN' | 'LOGIN_ADMIN' | 'CLI_ADMIN';
  user?: any;
  adminFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

export default function AdminBank({ adminRole, adminFetch }: AdminBankProps) {
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [bankTransactions, setBankTransactions] = useState<any[]>([]);
  const [withdrawalQueue, setWithdrawalQueue] = useState<any[]>([]);
  const [limitsData, setLimitsData] = useState<any[]>([]);
  const [issuedCards, setIssuedCards] = useState<any[]>([]);
  
  const [bankLoading, setBankLoading] = useState(false);
  const [bankError, setBankError] = useState('');
  const [activeTab, setActiveTab] = useState<'BALANCES' | 'LEDGER' | 'PAYMENT_QUEUE' | 'LIMITS_MONITORING' | 'LIQUIDITY' | 'ISSUED_CARDS'>('BALANCES');
  const [selectedTx, setSelectedTx] = useState<any | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<any | null>(null);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<any | null>(null);

  const fetchBankData = async () => {
    setBankLoading(true);
    setBankError('');
    try {
      const accRes = await adminFetch('/api/bank/accounts');
      if (accRes.ok) {
        const data = await accRes.json();
        setBankAccounts(data || []);
      }
      const txRes = await adminFetch('/api/bank/transactions');
      if (txRes.ok) {
        const data = await txRes.json();
        const sorted = (data || []).sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setBankTransactions(sorted);
      }
      
      const qRes = await adminFetch('/api/bank/withdrawals');
      if (qRes.ok) {
        setWithdrawalQueue(await qRes.json() || []);
      }
      
      
      const lRes = await adminFetch('/api/bank/limits');
      if (lRes.ok) {
        setLimitsData(await lRes.json() || []);
      }
      const cRes = await adminFetch('/api/bank/issued-cards');
      if (cRes.ok) {
        setIssuedCards(await cRes.json() || []);
      }

      
    } catch (e) {
      setBankError('Network communication failure.');
    } finally {
      setBankLoading(false);
    }
  };

  useEffect(() => {
    fetchBankData();
  }, []);

  const handleToggleFreeze = async (accountId: string, currentlyFrozen: boolean) => {
    setBankError('');
    try {
      const res = await adminFetch(`/api/bank/accounts/${accountId}/freeze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frozen: !currentlyFrozen }),
      });
      if (!res.ok) {
        const d = await res.json();
        setBankError(d.error || 'Failed to update freeze status.');
      } else {
        fetchBankData();
        setSelectedAccount((prev: any) => prev ? { ...prev, status: currentlyFrozen ? 'active' : 'frozen' } : null);
      }
    } catch (e) {
      setBankError('Network communication failure.');
    }
  };

  const totalLiquidity = bankAccounts.reduce((sum, acc) => sum + (acc.balance_cents / 100), 0);

  const oneDayAgo = Date.now() - 86400000;
  const recentTxs = bankTransactions.filter(tx => new Date(tx.timestamp).getTime() > oneDayAgo);
  const volume24h = recentTxs.reduce((sum, tx) => sum + tx.amount_cents, 0) / 100;
  const frozenCount = bankAccounts.filter(a => a.status === 'frozen').length;

  const getBankName = (name: string) => {
    return name;
  };

  const formatAccountId = (id: string) => {
    if (!id) return '';
    return id.toUpperCase();
  };

  const handleReviewWithdrawal = async (requestId: string, action: 'APPROVE' | 'REJECT') => {
    setBankError('');
    try {
      // The payments review endpoint acts as SYSTEM_AUTO_ADMIN when called, 
      // but requires user auth in theory. Let's assume adminFetch includes the right token.
      const res = await adminFetch(`/api/payments/withdraw/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, action }),
      });
      if (!res.ok) {
        const d = await res.json();
        setBankError(d.error || 'Failed to review withdrawal.');
      } else {
        fetchBankData();
        setSelectedWithdrawal(null);
      }
    } catch (e) {
      setBankError('Network communication failure.');
    }
  };

  return (
    <div className="flex flex-col h-full text-text-primary max-w-7xl mx-auto w-full">
      
      {/* Header & Tabs */}
      <div className="flex justify-end mb-6 shrink-0 w-full overflow-hidden">
        <div className="flex items-center gap-1.5 bg-velum-850 p-1.5 rounded-lg border border-white-5 shadow-inner overflow-x-auto scrollbar-none max-w-full">
          <button 
            onClick={() => { setActiveTab('BALANCES'); setSelectedTx(null); setSelectedAccount(null); setSelectedWithdrawal(null); }}
            className={`px-5 py-2.5 text-xs font-bold uppercase tracking-widest rounded-md transition-all flex items-center gap-2 whitespace-nowrap shrink-0 ${
              activeTab === 'BALANCES' 
                ? 'bg-velum-750 text-text-primary shadow-sm border border-white-10' 
                : 'text-text-secondary hover:text-text-primary border border-transparent'
            }`}
          >
            <PieChart className="w-4 h-4" />
            Balances
          </button>
          <button 
            onClick={() => { setActiveTab('LEDGER'); setSelectedTx(null); setSelectedAccount(null); setSelectedWithdrawal(null); }}
            className={`px-5 py-2.5 text-xs font-bold uppercase tracking-widest rounded-md transition-all flex items-center gap-2 whitespace-nowrap shrink-0 ${
              activeTab === 'LEDGER' 
                ? 'bg-velum-750 text-text-primary shadow-sm border border-white-10' 
                : 'text-text-secondary hover:text-text-primary border border-transparent'
            }`}
          >
            <Database className="w-4 h-4" />
            Audit Ledger
          </button>
          <button 
            onClick={() => { setActiveTab('PAYMENT_QUEUE'); setSelectedTx(null); setSelectedAccount(null); setSelectedWithdrawal(null); }}
            className={`px-5 py-2.5 text-xs font-bold uppercase tracking-widest rounded-md transition-all flex items-center gap-2 whitespace-nowrap shrink-0 ${
              activeTab === 'PAYMENT_QUEUE' 
                ? 'bg-velum-750 text-text-primary shadow-sm border border-white-10' 
                : 'text-text-secondary hover:text-text-primary border border-transparent'
            }`}
          >
            <ListChecks className="w-4 h-4" />
            Payment Queue
          </button>
          
          <button 
            onClick={() => { setActiveTab('LIMITS_MONITORING'); setSelectedTx(null); setSelectedAccount(null); setSelectedWithdrawal(null); }}
            className={`px-5 py-2.5 text-xs font-bold uppercase tracking-widest rounded-md transition-all flex items-center gap-2 whitespace-nowrap shrink-0 ${
              activeTab === 'LIMITS_MONITORING' 
                ? 'bg-velum-750 text-text-primary shadow-sm border border-white-10' 
                : 'text-text-secondary hover:text-text-primary border border-transparent'
            }`}
          >
            <Activity className="w-4 h-4" />
            Limits
          </button>
          <button 
            onClick={() => { setActiveTab('LIQUIDITY'); setSelectedTx(null); setSelectedAccount(null); setSelectedWithdrawal(null); }}
            className={`px-5 py-2.5 text-xs font-bold uppercase tracking-widest rounded-md transition-all flex items-center gap-2 whitespace-nowrap shrink-0 ${
              activeTab === 'LIQUIDITY' 
                ? 'bg-velum-750 text-text-primary shadow-sm border border-white-10' 
                : 'text-text-secondary hover:text-text-primary border border-transparent'
            }`}
          >
            <PieChart className="w-4 h-4" />
            Mint / Burn
          </button>
          
          <button 
            onClick={() => { setActiveTab('ISSUED_CARDS'); setSelectedTx(null); setSelectedAccount(null); setSelectedWithdrawal(null); }}
            className={`px-5 py-2.5 text-xs font-bold uppercase tracking-widest rounded-md transition-all flex items-center gap-2 whitespace-nowrap shrink-0 ${
              activeTab === 'ISSUED_CARDS' 
                ? 'bg-velum-750 text-text-primary shadow-sm border border-white-10' 
                : 'text-text-secondary hover:text-text-primary border border-transparent'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            Issued Cards
          </button>

        </div>
      </div>
      
      {/* KPI Ribbon */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 shrink-0">
         <KpiCard title="Consolidated Liquidity" value={`NT$ ${totalLiquidity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} subtitle="Total Available Balance" />
         <KpiCard title="24H Settlement Volume" value={`NT$ ${volume24h.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} subtitle={`${recentTxs.length} Transactions Settled`} />
         <KpiCard title="Active Reserves" value={bankAccounts.length.toString()} subtitle={`${frozenCount} Accounts Frozen`} />
         <KpiCard title="System Alerts" value={frozenCount.toString()} subtitle={frozenCount > 0 ? "Requires Attention" : "All Clear"} alert={frozenCount > 0} />
      </div>
      
      {/* Error Messages */}
      {bankError && (
         <div className="bg-status-dnd/10 border border-status-dnd/30 p-4 mb-8 flex items-center gap-3 rounded-lg shrink-0 text-status-dnd shadow-sm">
           <ShieldAlert className="w-5 h-5 shrink-0" />
           <p className="text-xs font-bold tracking-wide uppercase">{bankError}</p>
         </div>
      )}

      {/* Data Section */}
      <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">
         
         {/* Main View */}
         <div className="flex-1 bg-velum-850 border border-white-5 rounded-xl flex flex-col overflow-hidden min-w-0 shadow-sm relative">
            
            <div className="px-6 py-5 border-b border-white-5 flex items-center justify-between shrink-0 bg-velum-850/50">
              <h2 className="font-bold text-text-primary text-sm uppercase tracking-widest flex items-center gap-2">
                {activeTab === 'BALANCES' ? 'Cash Balances' : 'Consolidated Ledger'}
              </h2>
              <button onClick={fetchBankData} disabled={bankLoading} className="p-2 rounded bg-white-5 border border-white-5 text-text-secondary hover:text-text-primary hover:bg-white-10 transition-colors disabled:opacity-50">
                <RefreshCw className={`w-4 h-4 ${bankLoading ? 'animate-spin text-accent' : ''}`} />
              </button>
            </div>

            <div className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-white-10 scrollbar-track-transparent">
              {activeTab === 'BALANCES' && (
                <table className="w-full text-left whitespace-nowrap">
                  <thead className="sticky top-0 bg-velum-800/95 backdrop-blur z-10 text-[10px] font-black text-text-secondary uppercase tracking-[0.2em] border-b border-white-5">
                    <tr>
                      <th className="px-6 py-4">Institution / Name</th>
                      <th className="px-6 py-4 hidden md:table-cell">Account ID</th>
                      <th className="px-6 py-4 text-right">Available Balance</th>
                      <th className="px-6 py-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white-5 text-sm">
                    {bankAccounts.map((acc, idx) => (
                      <tr key={idx} 
                          onClick={() => setSelectedAccount(acc)}
                          className={`cursor-pointer transition-colors group ${selectedAccount?.account_id === acc.account_id ? 'bg-white-5' : 'hover:bg-white-2'}`}>
                        <td className="px-6 py-5">
                          <div className="font-bold text-text-primary tracking-wide group-hover:text-accent transition-colors">{getBankName(acc.account_name)}</div>
                          <div className="text-[11px] text-text-secondary uppercase tracking-wider mt-1">{acc.institution}</div>
                          <div className="text-[11px] text-text-secondary font-mono mt-1.5 md:hidden">{formatAccountId(acc.account_id)}</div>
                        </td>
                        <td className="px-6 py-5 font-mono text-[12px] text-text-secondary hidden md:table-cell">
                          {formatAccountId(acc.account_id)}
                        </td>
                        <td className="px-6 py-5 text-right font-mono text-text-primary font-medium text-[15px]">
                          <span className="text-text-secondary font-sans font-normal text-xs mr-2">NT$</span>
                          {(acc.balance_cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-5 text-center">
                          {acc.status === 'frozen' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold bg-status-dnd/10 text-status-dnd uppercase tracking-widest border border-status-dnd/20">
                              <Lock className="w-3 h-3" />
                              Frozen
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold bg-status-online/10 text-status-online uppercase tracking-widest border border-status-online/20">
                              <CheckCircle2 className="w-3 h-3" />
                              Active
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {bankAccounts.length === 0 && !bankLoading && (
                      <tr>
                        <td colSpan={4} className="px-6 py-16 text-center text-text-secondary text-xs uppercase tracking-widest font-bold">
                          No account records found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
              {activeTab === 'LEDGER' && (
                <table className="w-full text-left whitespace-nowrap">
                  <thead className="sticky top-0 bg-velum-800/95 backdrop-blur z-10 text-[10px] font-black text-text-secondary uppercase tracking-[0.2em] border-b border-white-5">
                    <tr>
                      <th className="px-6 py-4 hidden md:table-cell">Txn ID</th>
                      <th className="px-6 py-4">Details</th>
                      <th className="px-6 py-4 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white-5 text-sm">
                    {bankTransactions.map((tx, idx) => {
                      const isDebit = tx.type === 'withdrawal' || tx.type === 'escrow_hold';
                      const amountSign = isDebit ? '-' : '+';
                      const amountColor = isDebit ? 'text-status-dnd' : 'text-status-online';
                      const accObj = bankAccounts.find((a: any) => a.account_id === tx.account_id);
                      const shortTxId = tx.transaction_id.split('_').pop()?.substring(0, 8) || tx.transaction_id;
                      
                      return (
                        <tr key={idx} 
                            onClick={() => setSelectedTx(tx)}
                            className={`cursor-pointer transition-colors group ${selectedTx?.transaction_id === tx.transaction_id ? 'bg-white-5' : 'hover:bg-white-2'}`}>
                          <td className="px-6 py-5 font-mono text-[12px] text-text-secondary hidden md:table-cell">
                            {shortTxId}
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-[9px] font-black uppercase tracking-[0.15em] text-text-secondary bg-white-5 border border-white-5 px-2 py-0.5 rounded">
                                {tx.type.replace('_', ' ')}
                              </span>
                              <span className="text-[11px] text-text-secondary font-mono hidden sm:inline opacity-70">
                                {new Date(tx.timestamp).toLocaleString(undefined, {month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second:'2-digit', hour12: false})}
                              </span>
                            </div>
                            <div className="font-bold text-text-primary text-sm truncate max-w-[200px] sm:max-w-[300px] group-hover:text-accent transition-colors">
                              {accObj ? getBankName(accObj.account_name) : 'System Escrow'}
                            </div>
                            <div className="text-[10px] text-text-secondary font-mono sm:hidden mt-1.5">
                              {new Date(tx.timestamp).toLocaleString(undefined, {month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false})}
                            </div>
                          </td>
                          <td className={`px-6 py-5 text-right font-mono font-medium text-[15px] ${amountColor}`}>
                            <div className="flex items-center justify-end gap-1.5">
                              {isDebit ? <ArrowDownRight className="w-4 h-4 opacity-70" /> : <ArrowUpRight className="w-4 h-4 opacity-70" />}
                              <span>{amountSign} {(tx.amount_cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className="text-text-secondary font-sans font-normal text-[10px] uppercase tracking-widest mt-1">NT$ Settled</div>
                          </td>
                        </tr>
                      );
                    })}
                    {bankTransactions.length === 0 && !bankLoading && (
                      <tr>
                        <td colSpan={3} className="px-6 py-16 text-center text-text-secondary text-xs uppercase tracking-widest font-bold">
                          No ledger activity found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
              {activeTab === 'PAYMENT_QUEUE' && (
                <table className="w-full text-left whitespace-nowrap">
                  <thead className="sticky top-0 bg-velum-800/95 backdrop-blur z-10 text-[10px] font-black text-text-secondary uppercase tracking-[0.2em] border-b border-white-5">
                    <tr>
                      <th className="px-6 py-4">Request ID</th>
                      <th className="px-6 py-4">User ID</th>
                      <th className="px-6 py-4 text-right">Amount</th>
                      <th className="px-6 py-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white-5 text-sm">
                    {withdrawalQueue.map((req, idx) => (
                      <tr key={idx} 
                          onClick={() => setSelectedWithdrawal(req)}
                          className={`cursor-pointer transition-colors group ${selectedWithdrawal?.request_id === req.request_id ? 'bg-white-5' : 'hover:bg-white-2'}`}>
                        <td className="px-6 py-5 font-mono text-[12px] text-text-primary">
                          {req.request_id.split('_').pop()?.substring(0, 8) || req.request_id}
                          <div className="text-[10px] text-text-secondary font-sans tracking-widest mt-1">{new Date(req.created_at).toLocaleString()}</div>
                        </td>
                        <td className="px-6 py-5 font-mono text-[12px] text-text-secondary">
                          USR-{req.user_id}
                        </td>
                        <td className="px-6 py-5 text-right font-mono font-medium text-[15px] text-text-primary">
                          <span className="text-text-secondary font-sans font-normal text-xs mr-2">NT$</span>
                          {(req.amount_cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-5 text-center">
                          {req.status === 'PENDING_REVIEW' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold bg-accent-10 text-accent uppercase tracking-widest border border-accent-20">
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              Pending
                            </span>
                          ) : req.status === 'COMPLETED' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold bg-status-online/10 text-status-online uppercase tracking-widest border border-status-online/20">
                              <CheckCircle2 className="w-3 h-3" />
                              Completed
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold bg-status-dnd/10 text-status-dnd uppercase tracking-widest border border-status-dnd/20">
                              <XCircle className="w-3 h-3" />
                              {req.status.replace('REJECTED_REFUNDED', 'Refunded').replace('REJECTED', 'Rejected')}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {withdrawalQueue.length === 0 && !bankLoading && (
                      <tr>
                        <td colSpan={4} className="px-6 py-16 text-center text-text-secondary text-xs uppercase tracking-widest font-bold">
                          No pending withdrawals
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
              
              {activeTab === 'ISSUED_CARDS' && (
                <table className="w-full text-left whitespace-nowrap">
                  <thead className="sticky top-0 bg-velum-800/95 backdrop-blur z-10 text-[10px] font-black text-text-secondary uppercase tracking-[0.2em] border-b border-white-5">
                    <tr>
                      <th className="px-6 py-4">User ID</th>
                      <th className="px-6 py-4">Institution / Card</th>
                      <th className="px-6 py-4 text-right">Credit Limit / Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white-5 text-sm">
                    {issuedCards.map((card, idx) => {
                      const limit = card.institution.includes('Titanium') ? (limitsData[0]?.max_limit_cents || 5000000) 
                                   : card.institution.includes('Black') ? (limitsData[0]?.max_limit_cents || 1500000)
                                   : card.institution.includes('Platinum') ? (limitsData[0]?.max_limit_cents || 500000)
                                   : (limitsData[0]?.max_limit_cents || 50000);
                      
                      const usedAmount = limit - card.available_cents;

                      return (
                      <tr key={idx} className="hover:bg-white-2 transition-colors">
                        <td className="px-6 py-5 font-mono text-[12px] text-text-secondary">
                          USR-{card.user_id}
                        </td>
                        <td className="px-6 py-5">
                          <div className="font-bold text-text-primary tracking-wide">{card.institution}</div>
                          <div className="text-[11px] text-text-secondary mt-1">
                            {card.account_kind} • {card.masked_number}
                          </div>
                        </td>
                        <td className="px-6 py-5 text-right font-mono text-[13px] text-text-primary">
                          <div className="text-text-primary">
                            Limit: $\{ (limit / 100).toFixed(2) }
                          </div>
                          <div className={`text-[11px] mt-1 ${usedAmount > 0 ? 'text-status-offline font-bold' : 'text-status-online'}`}>
                            Balance: $\{ ((card.available_cents - limit) / 100).toFixed(2) }
                          </div>
                        </td>
                      </tr>
                    )})}
                    {issuedCards.length === 0 && !bankLoading && (
                      <tr>
                        <td colSpan={3} className="px-6 py-16 text-center text-text-secondary text-xs uppercase tracking-widest font-bold">
                          No issued cards found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
              {activeTab === 'LIMITS_MONITORING' && (
                <table className="w-full text-left whitespace-nowrap">
                  <thead className="sticky top-0 bg-velum-800/95 backdrop-blur z-10 text-[10px] font-black text-text-secondary uppercase tracking-[0.2em] border-b border-white-5">
                    <tr>
                      <th className="px-6 py-4">User</th>
                      <th className="px-6 py-4 text-center">KYC Level</th>
                      <th className="px-6 py-4 text-right">24H Usage / Limit</th>
                      <th className="px-6 py-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white-5 text-sm">
                    {limitsData.map((data, idx) => {
                      const usagePct = data.max_limit_cents > 0 ? (data.used_24h_cents / data.max_limit_cents) * 100 : 0;
                      return (
                        <tr key={idx} className="hover:bg-white-2 transition-colors">
                          <td className="px-6 py-5">
                            <div className="font-bold text-text-primary tracking-wide">{data.username}</div>
                            <div className="text-[11px] text-text-secondary font-mono mt-1.5">USR-{data.user_id}</div>
                          </td>
                          <td className="px-6 py-5 text-center">
                            <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border ${
                              data.kyc_level === 'FULL' ? 'bg-status-online/10 text-status-online border-status-online/20' :
                              data.kyc_level === 'BASIC' ? 'bg-accent-10 text-accent border-accent-20' :
                              'bg-white-5 text-text-secondary border-white-10'
                            }`}>
                              {data.kyc_level}
                            </span>
                          </td>
                          <td className="px-6 py-5 text-right font-mono text-[13px] text-text-primary">
                            <div className="flex flex-col items-end gap-1.5">
                              <div>
                                <span className={usagePct >= 100 ? 'text-status-dnd' : usagePct >= 80 ? 'text-status-idle' : 'text-text-primary'}>
                                  ${(data.used_24h_cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </span>
                                <span className="text-text-secondary mx-1">/</span>
                                <span className="text-text-secondary">
                                  {data.max_limit_cents > 0 ? `$${(data.max_limit_cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '∞'}
                                </span>
                              </div>
                              {data.max_limit_cents > 0 && (
                                <div className="w-32 h-1.5 bg-white-5 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full ${usagePct >= 100 ? 'bg-status-dnd' : usagePct >= 80 ? 'bg-status-idle' : 'bg-status-online'}`} 
                                    style={{ width: `${Math.min(usagePct, 100)}%` }} 
                                  />
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-5 text-center">
                            {data.status === 'LIMIT_REACHED' ? (
                              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-status-dnd uppercase tracking-widest">
                                <AlertTriangle className="w-3 h-3" /> Limit Reached
                              </span>
                            ) : data.status === 'WARNING' ? (
                              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-status-idle uppercase tracking-widest">
                                <AlertTriangle className="w-3 h-3" /> High Usage
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-status-online uppercase tracking-widest">
                                <CheckCircle2 className="w-3 h-3" /> Nominal
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {limitsData.length === 0 && !bankLoading && (
                      <tr>
                        <td colSpan={4} className="px-6 py-16 text-center text-text-secondary text-xs uppercase tracking-widest font-bold">
                          No limits data available
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
         </div>
         
         {/* Right Inspector Panel */}
         {activeTab === 'BALANCES' && selectedAccount && (
           <div className="w-full lg:w-[360px] bg-velum-850 border border-white-5 rounded-xl flex flex-col shrink-0 shadow-lg">
              <div className="px-6 py-5 border-b border-white-5 flex items-center justify-between shrink-0 bg-white-2 rounded-t-xl">
                <h3 className="font-bold text-text-primary text-sm uppercase tracking-widest">Account Details</h3>
                <button onClick={() => setSelectedAccount(null)} className="text-text-secondary hover:text-text-primary transition-colors p-1 bg-white-5 rounded-full hover:bg-white-10 border border-transparent hover:border-white-5">
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
              <div className="p-6 flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white-10 scrollbar-track-transparent">
                <div className="mb-8">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-text-secondary mb-2">Account ID</div>
                  <div className="font-mono text-[12px] text-accent bg-accent-10 p-3 rounded-lg border border-accent-20 break-all font-medium">
                    {formatAccountId(selectedAccount.account_id)}
                  </div>
                </div>
                
                <div className="space-y-5">
                  <DetailRow label="Institution" value={selectedAccount.institution} />
                  <DetailRow label="Account Name" value={getBankName(selectedAccount.account_name)} />
                  <DetailRow label="Routing Number" value={selectedAccount.routing_number} mono />
                  <DetailRow label="Account Number" value={selectedAccount.account_number} mono />
                  <DetailRow label="Beneficiary" value={selectedAccount.owner_name} />
                  <DetailRow label="Currency" value="New Taiwan Dollar (NT$)" />
                </div>
                
                <div className="mt-8 pt-6 border-t border-white-5 bg-white-2 -mx-6 px-6 -mb-6 pb-6 rounded-b-xl">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-text-secondary mb-3">Available Balance</div>
                  <div className="text-3xl text-text-primary font-mono tracking-tight font-medium mb-6">
                    <span className="text-text-secondary font-sans text-sm mr-2 font-normal">NT$</span>
                    {(selectedAccount.balance_cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  
                  <button 
                    onClick={() => handleToggleFreeze(selectedAccount.account_id, selectedAccount.status === 'frozen')} 
                    className={`w-full py-3.5 rounded-lg text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2.5 transition-all shadow-sm border ${
                      selectedAccount.status === 'frozen' 
                        ? 'bg-velum-750 text-text-primary border-white-10 hover:bg-velum-700 hover:border-white-20' 
                        : 'bg-status-dnd/10 text-status-dnd border-status-dnd/20 hover:bg-status-dnd/20'
                    }`}
                  >
                    {selectedAccount.status === 'frozen' ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                    {selectedAccount.status === 'frozen' ? 'Unfreeze Account' : 'Freeze Account'}
                  </button>
                </div>
              </div>
           </div>
         )}

         {activeTab === 'LEDGER' && selectedTx && (
           <div className="w-full lg:w-[360px] bg-velum-850 border border-white-5 rounded-xl flex flex-col shrink-0 shadow-lg">
              <div className="px-6 py-5 border-b border-white-5 flex items-center justify-between shrink-0 bg-white-2 rounded-t-xl">
                <h3 className="font-bold text-text-primary text-sm uppercase tracking-widest">Transaction Details</h3>
                <button onClick={() => setSelectedTx(null)} className="text-text-secondary hover:text-text-primary transition-colors p-1 bg-white-5 rounded-full hover:bg-white-10 border border-transparent hover:border-white-5">
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
              <div className="p-6 flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white-10 scrollbar-track-transparent">
                <div className="mb-8">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-text-secondary mb-2">Payment ID</div>
                  <div className="font-mono text-[12px] text-text-primary bg-white-5 p-3 rounded-lg border border-white-10 break-all font-medium">
                    {selectedTx.transaction_id}
                  </div>
                </div>
                
                <div className="space-y-5">
                  <DetailRow label="Payment Type" value={selectedTx.type.replace('_', ' ').toUpperCase()} />
                  <DetailRow label="Value Date" value={new Date(selectedTx.timestamp).toLocaleString()} />
                  <DetailRow label="Routing Context" value={formatAccountId(selectedTx.account_id)} mono />
                  <DetailRow label="Status" value="Settled" status="success" />
                </div>
                
                <div className="mt-8 pt-6 border-t border-white-5 bg-white-2 -mx-6 px-6 -mb-6 pb-6 rounded-b-xl">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-text-secondary mb-3">Settlement Amount</div>
                  <div className={`text-3xl font-mono tracking-tight font-medium ${selectedTx.type === 'withdrawal' || selectedTx.type === 'escrow_hold' ? 'text-status-dnd' : 'text-status-online'}`}>
                    {(selectedTx.type === 'withdrawal' || selectedTx.type === 'escrow_hold') ? '-' : '+'}
                    <span className="text-text-secondary font-sans text-sm mx-2 font-normal">NT$</span>
                    {(selectedTx.amount_cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  
                  <div className="mt-8">
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-text-secondary mb-2">Audit Log Entry</div>
                    <div className="text-[12px] font-mono text-text-secondary bg-velum-900 p-4 rounded-lg border border-white-5 leading-relaxed break-words shadow-inner">
                      {selectedTx.description}
                    </div>
                  </div>
                </div>
              </div>
           </div>
         )}
         
         {activeTab === 'PAYMENT_QUEUE' && selectedWithdrawal && (
           <div className="w-full lg:w-[360px] bg-velum-850 border border-white-5 rounded-xl flex flex-col shrink-0 shadow-lg">
              <div className="px-6 py-5 border-b border-white-5 flex items-center justify-between shrink-0 bg-white-2 rounded-t-xl">
                <h3 className="font-bold text-text-primary text-sm uppercase tracking-widest">Withdrawal Request</h3>
                <button onClick={() => setSelectedWithdrawal(null)} className="text-text-secondary hover:text-text-primary transition-colors p-1 bg-white-5 rounded-full hover:bg-white-10 border border-transparent hover:border-white-5">
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
              <div className="p-6 flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white-10 scrollbar-track-transparent">
                <div className="mb-8">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-text-secondary mb-2">Request ID</div>
                  <div className="font-mono text-[12px] text-text-primary bg-white-5 p-3 rounded-lg border border-white-10 break-all font-medium">
                    {selectedWithdrawal.request_id}
                  </div>
                </div>
                
                <div className="space-y-5">
                  <DetailRow label="User ID" value={`USR-${selectedWithdrawal.user_id}`} mono />
                  <DetailRow label="Payout Method" value={selectedWithdrawal.payout_method_id} mono />
                  <DetailRow label="Created At" value={new Date(selectedWithdrawal.created_at).toLocaleString()} />
                  <DetailRow label="Status" value={selectedWithdrawal.status.replace('_', ' ')} status={selectedWithdrawal.status === 'COMPLETED' ? 'success' : undefined} />
                </div>
                
                <div className="mt-8 pt-6 border-t border-white-5 bg-white-2 -mx-6 px-6 -mb-6 pb-6 rounded-b-xl">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-text-secondary mb-3">Amount</div>
                  <div className={`text-3xl font-mono tracking-tight font-medium ${selectedWithdrawal.status === 'PENDING_REVIEW' ? 'text-accent' : 'text-text-primary'}`}>
                    <span className="text-text-secondary font-sans text-sm mr-2 font-normal">NT$</span>
                    {(selectedWithdrawal.amount_cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  
                  {selectedWithdrawal.status === 'PENDING_REVIEW' && (
                    <div className="flex gap-3 mt-6">
                      <button 
                        onClick={() => handleReviewWithdrawal(selectedWithdrawal.request_id, 'REJECT')} 
                        className="flex-1 py-3.5 rounded-lg text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-sm border bg-status-dnd/10 text-status-dnd border-status-dnd/20 hover:bg-status-dnd/20"
                      >
                        <XCircle className="w-4 h-4" /> Reject
                      </button>
                      <button 
                        onClick={() => handleReviewWithdrawal(selectedWithdrawal.request_id, 'APPROVE')} 
                        className="flex-1 py-3.5 rounded-lg text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-sm border bg-status-online/10 text-status-online border-status-online/20 hover:bg-status-online/20"
                      >
                        <CheckCircle2 className="w-4 h-4" /> Approve
                      </button>
                    </div>
                  )}
                </div>
              </div>
           </div>
         )}
         
      
         
         
      </div>

    </div>
  );
}

function KpiCard({ title, value, subtitle, trend, alert = false }: any) {
  return (
    <div className="bg-velum-850 border border-white-5 rounded-xl p-5 flex flex-col justify-between shadow-sm relative overflow-hidden min-w-0">
      {alert && <div className="absolute top-0 right-0 w-16 h-16 bg-status-dnd/10 rounded-bl-full pointer-events-none" />}
      <div className="flex items-start justify-between mb-4">
        <p className="text-[10px] font-black text-text-secondary uppercase tracking-[0.15em] leading-snug w-2/3 truncate">{title}</p>
        {alert && <ShieldAlert className="w-4 h-4 text-status-dnd shrink-0" />}
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-medium text-text-primary tracking-tight font-mono mb-1 flex items-baseline gap-2 truncate" title={value}>
          <span className="truncate">{value}</span>
          {trend && <span className="text-[10px] font-sans text-text-secondary tracking-widest uppercase shrink-0">{trend}</span>}
        </div>
        <p className={`text-[11px] uppercase tracking-wider font-bold truncate ${alert ? 'text-status-dnd' : 'text-text-secondary'}`} title={subtitle}>{subtitle}</p>
      
      </div>
    </div>
  );
}


function DetailRow({ label, value, mono = false, status }: any) {
  return (
    <div>
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-text-secondary mb-1.5">{label}</div>
      {status === 'success' ? (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-widest bg-status-online/10 text-status-online border border-status-online/20">
          <CheckCircle2 className="w-3 h-3" />
          {value}
        </span>
      ) : (
        <div className={`text-sm text-text-primary font-medium tracking-wide ${mono ? 'font-mono text-[13px]' : ''}`}>{value}</div>
      )}
    </div>
  );
}
