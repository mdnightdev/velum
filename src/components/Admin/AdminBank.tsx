import React, { useState, useEffect } from 'react';
import { Check, Shield, FileText, AlertTriangle } from 'lucide-react';

interface AdminBankProps {
  adminRole: 'SUPPORT_ADMIN' | 'LOGIN_ADMIN' | 'CLI_ADMIN';
  user?: any;
  adminFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

export default function AdminBank({ adminRole, adminFetch }: AdminBankProps) {
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [bankTransactions, setBankTransactions] = useState<any[]>([]);
  const [bankLoading, setBankLoading] = useState(false);
  const [bankError, setBankError] = useState('');
  const [bankSuccess, setBankSuccess] = useState('');
  const [activeTab, setActiveTab] = useState<'ASSETS' | 'LEDGER'>('ASSETS');
  const [adjustingAccountId, setAdjustingAccountId] = useState<string | null>(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustDesc, setAdjustDesc] = useState('');

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
    } catch (e) {
      setBankError('Network communication failure.');
    } finally {
      setBankLoading(false);
    }
  };

  useEffect(() => {
    fetchBankData();
  }, []);

  const handleAdjustBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingAccountId) return;
    setBankError('');
    setBankSuccess('');
    try {
      const res = await adminFetch(`/api/bank/accounts/${adjustingAccountId}/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount_cents: Math.floor(parseFloat(adjustAmount) * 100),
          description: adjustDesc,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        setBankError(d.error || 'Failed to adjust account reserves.');
      } else {
        setBankSuccess('Ledger adjustment committed.');
        setAdjustingAccountId(null);
        setAdjustAmount('');
        setAdjustDesc('');
        fetchBankData();
      }
    } catch (e) {
      setBankError('Network communication failure.');
    }
  };

  const handleToggleFreeze = async (accountId: string, currentlyFrozen: boolean) => {
    setBankError('');
    setBankSuccess('');
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
        setBankSuccess(currentlyFrozen ? 'Asset un-frozen.' : 'Asset frozen.');
        fetchBankData();
      }
    } catch (e) {
      setBankError('Network communication failure.');
    }
  };

  const totalLiquidityTwd = bankAccounts.reduce((sum, acc) => {
    if (acc.currency_code === 'TWD') {
      return sum + acc.balance_cents / 100;
    }
    return sum;
  }, 0);

  const getBankName = (name: string) => {
    if (name.toUpperCase().includes('MEMBER TRUST') || name.toUpperCase().includes('TRUST BANK')) return 'Velum Trust Bank';
    if (name.toUpperCase().includes('CENTRAL')) return 'Central Liquidity Reserve';
    if (name.toUpperCase().includes('ESCROW')) return 'Escrow Trustee Holdings';
    return name;
  };

  return (
    <div id="admin_bank_view" className="h-full flex flex-col max-w-[1600px] mx-auto w-full animate-in fade-in duration-500">
      <div className="flex gap-8 border-b border-white-5 mb-8 shrink-0 px-2 pt-2">
        <button
          onClick={() => setActiveTab('ASSETS')}
          className={`pb-4 text-[10px] font-bold tracking-widest uppercase transition-colors relative ${
            activeTab === 'ASSETS' ? 'text-white' : 'text-white/40 hover:text-white/70'
          }`}
        >
          Corporate Vaults
          {activeTab === 'ASSETS' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-white" />}
        </button>
        <button
          onClick={() => setActiveTab('LEDGER')}
          className={`pb-4 text-[10px] font-bold tracking-widest uppercase transition-colors relative ${
            activeTab === 'LEDGER' ? 'text-white' : 'text-white/40 hover:text-white/70'
          }`}
        >
          Master Ledger
          {activeTab === 'LEDGER' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-white" />}
        </button>
      </div>

      {bankError && (
        <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-lg flex items-start gap-3 mb-6 shrink-0">
          <AlertTriangle className="w-4 h-4 text-rose-500 mt-0.5" />
          <p className="text-xs font-medium text-rose-500 tracking-wide uppercase">{bankError}</p>
        </div>
      )}
      {bankSuccess && (
        <div className="bg-emerald-400/10 border border-emerald-400/20 p-4 rounded-lg flex items-start gap-3 mb-6 shrink-0 animate-in fade-in duration-300">
          <Check className="w-4 h-4 text-emerald-400 mt-0.5" />
          <p className="text-xs font-medium text-emerald-400 tracking-wide uppercase">{bankSuccess}</p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto scrollbar-none pb-12 px-2">
        {activeTab === 'ASSETS' && (
          <div className="space-y-16">
            <div>
              <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">Consolidated Liquidity</p>
              <div className="flex items-baseline gap-3">
                <span className="text-2xl font-light text-white/40">NT$</span>
                <span className="text-6xl font-light tracking-tight text-white">
                  {totalLiquidityTwd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {bankAccounts.map((acc, idx) => {
                const isFrozen = acc.status === 'frozen';
                const isAdjusting = adjustingAccountId === acc.account_id;
                const displayName = getBankName(acc.account_name);
                
                return (
                  <div key={idx} className="bg-[#050505] border border-white-5 rounded-lg p-8 flex flex-col relative overflow-hidden group">
                    {isFrozen && <div className="absolute inset-0 bg-rose-500/5 backdrop-blur-[1px] pointer-events-none" />}
                    
                    <div className="flex justify-between items-start mb-12 relative z-10">
                      <div>
                        <h3 className="text-lg font-medium text-white tracking-tight mb-1">{displayName}</h3>
                        <p className="text-[10px] text-white/40 font-mono tracking-widest uppercase">{acc.account_id}</p>
                      </div>
                      {isFrozen && <Shield className="w-5 h-5 text-rose-500" />}
                    </div>

                    <div className="mb-12 relative z-10">
                      <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">Available Balance</p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-lg font-medium text-white/40">{acc.currency_code}</span>
                        <span className={`text-3xl font-light tracking-tight ${isFrozen ? 'text-rose-500' : 'text-white'}`}>
                          {(acc.balance_cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-8 relative z-10">
                      <div>
                        <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest mb-1.5">Routing / Account</p>
                        <p className="font-mono text-white/70 text-xs">{acc.routing_number} • {String(acc.account_number).slice(-4)}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest mb-1.5">Beneficiary</p>
                        <p className="text-white/70 text-xs font-medium uppercase tracking-wide truncate pr-2" title={acc.owner_name}>{acc.owner_name}</p>
                      </div>
                    </div>

                    <div className="flex gap-3 pt-6 border-t border-white-5 relative z-10 mt-auto">
                      <button 
                        onClick={() => setAdjustingAccountId(isAdjusting ? null : acc.account_id)}
                        className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white rounded text-[10px] font-bold tracking-widest uppercase transition-colors"
                      >
                        {isAdjusting ? 'Cancel' : 'Adjust'}
                      </button>
                      <button 
                        onClick={() => handleToggleFreeze(acc.account_id, isFrozen)}
                        className={`px-8 py-3 rounded text-[10px] font-bold tracking-widest uppercase transition-colors ${
                          isFrozen ? 'bg-white text-black hover:bg-white/90' : 'bg-rose-500/10 text-rose-500 hover:bg-rose-500/20'
                        }`}
                      >
                        {isFrozen ? 'Unfreeze' : 'Freeze'}
                      </button>
                    </div>

                    {isAdjusting && (
                      <div className="absolute inset-0 bg-[#050505]/95 backdrop-blur-sm p-8 z-20 flex flex-col justify-center animate-in fade-in zoom-in-95 duration-200">
                        <h4 className="text-sm font-medium text-white mb-6 tracking-wide">Adjust Ledger Balance</h4>
                        <form onSubmit={handleAdjustBalance} className="space-y-6">
                          <div>
                            <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">Adjustment Delta ({acc.currency_code})</label>
                            <input
                              type="number"
                              step="0.01"
                              required
                              value={adjustAmount}
                              onChange={(e) => setAdjustAmount(e.target.value)}
                              className="w-full p-3 rounded bg-transparent border-b border-white-20 text-xl font-light text-white focus:border-white transition-all outline-none"
                              placeholder="0.00"
                              autoFocus
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">Audit Reason</label>
                            <input
                              type="text"
                              required
                              value={adjustDesc}
                              onChange={(e) => setAdjustDesc(e.target.value)}
                              className="w-full p-3 rounded bg-transparent border-b border-white-20 text-sm font-light text-white focus:border-white transition-all outline-none"
                              placeholder="Required for ledger clearance..."
                            />
                          </div>
                          <div className="flex gap-3 pt-4">
                            <button 
                              type="button"
                              onClick={() => setAdjustingAccountId(null)}
                              className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold uppercase tracking-widest text-[10px] py-4 rounded transition-colors"
                            >
                              Cancel
                            </button>
                            <button 
                              type="submit" 
                              className="flex-1 bg-white hover:bg-white/90 text-black font-bold uppercase tracking-widest text-[10px] py-4 rounded transition-colors"
                            >
                              Commit
                            </button>
                          </div>
                        </form>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'LEDGER' && (
          <div className="bg-[#050505] border border-white-5 rounded-lg flex flex-col overflow-hidden min-h-[700px]">
            <div className="p-8 border-b border-white-5 flex items-center justify-between shrink-0">
              <h3 className="text-lg font-medium text-white tracking-tight">Consolidated Audit Ledger</h3>
              <span className="px-4 py-1.5 bg-white/5 rounded text-[10px] font-bold text-white/50 tracking-widest uppercase">
                {bankTransactions.length} Records
              </span>
            </div>
            
            <div className="flex-1 overflow-auto scrollbar-none relative">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="sticky top-0 bg-[#050505] border-b border-white-5 z-10">
                  <tr className="text-white/40 text-[9px] font-bold uppercase tracking-widest">
                    <th className="px-8 py-6">TXN ID</th>
                    <th className="px-8 py-6">Routing Context</th>
                    <th className="px-8 py-6">Operation</th>
                    <th className="px-8 py-6 text-right">Reserve Impact</th>
                    <th className="px-8 py-6">Clearance Log</th>
                    <th className="px-8 py-6 text-right">Settlement Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {bankTransactions.map((tx, idx) => {
                    const isDebit = tx.type === 'withdrawal' || tx.type === 'escrow_hold';
                    const amountSign = isDebit ? '-' : '+';
                    const amountColor = isDebit ? 'text-rose-500' : 'text-emerald-400';
                    const accObj = bankAccounts.find((a: any) => a.account_id === tx.account_id);
                    
                    return (
                      <tr key={idx} className="hover:bg-white/[0.02] transition-colors group">
                        <td className="px-8 py-6 font-mono text-xs text-white/40 group-hover:text-white/70 transition-colors">
                          {tx.transaction_id.split('_').pop()?.substring(0, 8) || tx.transaction_id}
                        </td>
                        <td className="px-8 py-6">
                          <div className="font-medium text-white text-xs tracking-wide">
                            {accObj ? getBankName(accObj.account_name) : 'System Escrow Routing'}
                          </div>
                          <div className="text-[10px] text-white/40 font-mono mt-1">
                            {tx.account_id}
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <span className="inline-block text-[9px] font-bold tracking-widest uppercase text-white/50">
                            {tx.type.replace('_', ' ')}
                          </span>
                        </td>
                        <td className={`px-8 py-6 text-right font-mono text-xs ${amountColor}`}>
                          {amountSign}{tx.currency_code} {(tx.amount_cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-8 py-6 text-xs text-white/50 max-w-xs truncate" title={tx.description}>
                          {tx.description}
                        </td>
                        <td className="px-8 py-6 text-right text-white/40 text-[10px] font-mono">
                          {new Date(tx.timestamp).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                  {bankTransactions.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-8 py-24 text-center text-white/40 text-xs font-medium uppercase tracking-widest">
                        No ledger activity recorded
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
