const fs = require('fs');
const path = 'src/components/Admin/AdminBank.tsx';

const newCode = `import React, { useState, useEffect } from 'react';
import { Search, Bell, Database, AlertTriangle, CheckCircle2, XCircle, PieChart, Lock, Unlock, RefreshCw, Filter, FileText, FileDown, ShieldAlert, CreditCard, ArrowLeft, Menu, X } from 'lucide-react';

interface AdminBankProps {
  adminRole: 'SUPPORT_ADMIN' | 'LOGIN_ADMIN' | 'CLI_ADMIN';
  user?: any;
  adminFetch: (url: string, options?: RequestInit) => Promise<Response>;
  onBack?: () => void;
}

export default function AdminBank({ adminRole, adminFetch, onBack }: AdminBankProps) {
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [bankTransactions, setBankTransactions] = useState<any[]>([]);
  const [bankLoading, setBankLoading] = useState(false);
  const [bankError, setBankError] = useState('');
  const [activeTab, setActiveTab] = useState<'BALANCES' | 'LEDGER'>('BALANCES');
  const [selectedTx, setSelectedTx] = useState<any | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<any | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  const handleToggleFreeze = async (accountId: string, currentlyFrozen: boolean) => {
    setBankError('');
    try {
      const res = await adminFetch(\`/api/bank/accounts/\${accountId}/freeze\`, {
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

  const totalLiquidityTwd = bankAccounts.reduce((sum, acc) => {
    if (acc.currency_code === 'TWD') {
      return sum + acc.balance_cents / 100;
    }
    return sum;
  }, 0);

  const oneDayAgo = Date.now() - 86400000;
  const recentTxs = bankTransactions.filter(tx => new Date(tx.timestamp).getTime() > oneDayAgo);
  const volume24h = recentTxs.reduce((sum, tx) => sum + tx.amount_cents, 0) / 100;
  const frozenCount = bankAccounts.filter(a => a.status === 'frozen').length;

  const getBankName = (name: string) => {
    if (name.toUpperCase().includes('MEMBER TRUST') || name.toUpperCase().includes('TRUST BANK')) return 'Velum Trust Bank';
    if (name.toUpperCase().includes('CENTRAL')) return 'Central Liquidity Reserve';
    if (name.toUpperCase().includes('ESCROW')) return 'Escrow Trustee Holdings';
    return name;
  };

  const formatAccountId = (id: string) => {
    if (id === 'bank_member_trust') return 'VTB-2938-4821';
    if (id === 'bank_central_reserve') return 'CLR-9921-0012';
    if (id === 'bank_escrow_reserve') return 'ETH-5542-8891';
    return id.toUpperCase();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#050505] text-slate-300 font-sans flex flex-col md:flex-row overflow-hidden selection:bg-emerald-900/50">
      
      {/* Mobile Header (Visible only on small screens) */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-[#1f1f1f] bg-[#0a0a0a] z-40 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-slate-400 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-[#0f0f0f] border border-[#2d2d2d] flex items-center justify-center text-white font-bold tracking-tight text-xs">V</div>
            <h1 className="text-white font-semibold text-sm tracking-wide">Treasury</h1>
          </div>
        </div>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="text-slate-400 hover:text-white transition-colors">
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar - Desktop & Mobile Menu */}
      <div className={\`\${mobileMenuOpen ? 'flex' : 'hidden'} md:flex flex-col absolute md:relative w-full md:w-64 h-[calc(100%-60px)] md:h-full bg-[#0a0a0a] border-r border-[#1f1f1f] z-30 shrink-0 transition-all\`}>
        
        {/* Desktop Header */}
        <div className="hidden md:flex p-5 border-b border-[#1f1f1f] items-start flex-col gap-4 shrink-0">
          <button onClick={onBack} className="flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Admin
          </button>
          <div className="flex items-center gap-3 w-full">
            <div className="w-8 h-8 rounded bg-[#161b22] border border-[#2d2d2d] flex items-center justify-center text-white font-bold tracking-tight">
              V
            </div>
            <div>
              <h1 className="text-white font-semibold text-sm leading-tight tracking-wide">Treasury & Markets</h1>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-0.5">Operations Command</p>
            </div>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto py-4">
          <div className="px-5 mb-2 text-[10px] font-bold tracking-widest text-slate-600 uppercase">Liquidity Operations</div>
          <SidebarItem active={activeTab === 'BALANCES'} onClick={() => {setActiveTab('BALANCES'); setSelectedTx(null); setMobileMenuOpen(false);}} icon={<PieChart className="w-4 h-4"/>} label="Cash Balances" />
          <SidebarItem disabled icon={<RefreshCw className="w-4 h-4"/>} label="Liquidity Forecast" />
          
          <div className="px-5 mt-6 mb-2 text-[10px] font-bold tracking-widest text-slate-600 uppercase">Payments & Settlement</div>
          <SidebarItem active={activeTab === 'LEDGER'} onClick={() => {setActiveTab('LEDGER'); setSelectedAccount(null); setMobileMenuOpen(false);}} icon={<Database className="w-4 h-4"/>} label="Audit Ledger" />
          <SidebarItem disabled icon={<CreditCard className="w-4 h-4"/>} label="Payment Queue" />
          
          <div className="px-5 mt-6 mb-2 text-[10px] font-bold tracking-widest text-slate-600 uppercase">Risk & Compliance</div>
          <SidebarItem disabled icon={<AlertTriangle className="w-4 h-4"/>} label="Limits Monitoring" />
        </div>
        
        <div className="p-5 border-t border-[#1f1f1f] text-xs shrink-0">
          <div className="flex items-center gap-2 text-emerald-500">
            <CheckCircle2 className="w-4 h-4" />
            <span className="font-medium">All Systems Operational</span>
          </div>
        </div>
      </div>
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0 bg-[#050505]">
        
        {/* Top Header */}
        <div className="hidden md:flex h-16 border-b border-[#1f1f1f] items-center justify-between px-6 shrink-0 z-10 relative bg-[#0a0a0a]/80 backdrop-blur-md">
           <div className="flex-1 max-w-xl">
             <div className="relative">
               <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
               <input type="text" placeholder="Search for transactions, accounts, entities..." className="w-full pl-9 pr-4 py-2 bg-[#0f0f0f] border border-[#2d2d2d] rounded-md text-sm focus:outline-none focus:border-[#3fb950] focus:ring-1 focus:ring-[#3fb950] transition-all placeholder:text-slate-600 text-slate-200" />
             </div>
           </div>
           <div className="flex items-center gap-5 text-slate-400 ml-4">
             <div className="relative cursor-pointer hover:text-white transition-colors">
               <Bell className="w-5 h-5" />
               {frozenCount > 0 && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[#0a0a0a]"></span>}
             </div>
             <div className="h-8 border-l border-[#2d2d2d] mx-1"></div>
             <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-xs font-semibold text-slate-300 leading-none">Operations Officer</div>
                  <div className="text-[10px] text-slate-500 mt-1">{adminRole}</div>
                </div>
                <div className="w-8 h-8 rounded-full bg-[#161b22] border border-[#2d2d2d] flex items-center justify-center text-slate-300 font-bold text-xs uppercase">
                  {adminRole.charAt(0)}
                </div>
             </div>
           </div>
        </div>
        
        {/* Work Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col gap-6">
           
           {/* KPI Ribbon */}
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
              <KpiCard title="Consolidated Liquidity" value={\`TWD \${totalLiquidityTwd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\`} subtitle="Total Available Balance" icon={<PieChart className="w-5 h-5 text-slate-400"/>} />
              <KpiCard title="24H Settlement Volume" value={\`TWD \${volume24h.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\`} subtitle={\`\${recentTxs.length} Transactions Settled\`} icon={<RefreshCw className="w-5 h-5 text-[#3fb950]"/>} />
              <KpiCard title="Active Reserve Accounts" value={bankAccounts.length.toString()} subtitle={\`\${frozenCount} Accounts Frozen\`} icon={<Database className="w-5 h-5 text-slate-400"/>} />
              <KpiCard title="High Priority Alerts" value={frozenCount.toString()} subtitle={frozenCount > 0 ? "Requires Attention" : "No pending alerts"} icon={<AlertTriangle className="w-5 h-5 text-red-500"/>} alert={frozenCount > 0} />
           </div>
           
           {/* Error Messages */}
           {bankError && (
              <div className="bg-[#490202] border border-[#f85149]/30 p-3 flex items-center gap-3 rounded shrink-0">
                <AlertTriangle className="w-4 h-4 text-[#f85149]" />
                <p className="text-xs font-mono text-[#f85149] uppercase">{bankError}</p>
              </div>
           )}

           {/* Data Grid Section */}
           <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-[500px]">
              
              {/* Main Table */}
              <div className="flex-1 bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg shadow-sm flex flex-col overflow-hidden min-w-0">
                 
                 <div className="px-4 py-4 border-b border-[#1f1f1f] flex flex-col sm:flex-row items-start sm:items-center justify-between shrink-0 gap-4">
                   <h2 className="font-semibold text-white text-lg flex items-center gap-2">
                     {activeTab === 'BALANCES' ? 'Cash Balances' : 'Audit Ledger'}
                     {bankLoading && <RefreshCw className="w-4 h-4 text-slate-500 animate-spin" />}
                   </h2>
                   <div className="flex items-center gap-3 w-full sm:w-auto">
                     <button onClick={fetchBankData} className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-[#161b22] border border-[#2d2d2d] rounded hover:bg-[#1f242b] transition-colors">
                       <RefreshCw className="w-3.5 h-3.5" />
                       Refresh
                     </button>
                     <button className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-[#161b22] border border-[#2d2d2d] rounded hover:bg-[#1f242b] transition-colors shadow-sm">
                       <Filter className="w-3.5 h-3.5" />
                       Filters
                     </button>
                   </div>
                 </div>

                 <div className="flex-1 overflow-auto">
                   {activeTab === 'BALANCES' ? (
                     <table className="w-full text-left whitespace-nowrap">
                       <thead className="sticky top-0 bg-[#0f0f0f] border-b border-[#1f1f1f] z-10 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                         <tr>
                           <th className="px-5 py-3">Institution / Name</th>
                           <th className="px-5 py-3 hidden md:table-cell">Account ID</th>
                           <th className="px-5 py-3 text-right">Available Balance</th>
                           <th className="px-5 py-3 text-center">Status</th>
                         </tr>
                       </thead>
                       <tbody className="divide-y divide-[#1f1f1f] text-sm">
                         {bankAccounts.map((acc, idx) => (
                           <tr key={idx} 
                               onClick={() => setSelectedAccount(acc)}
                               className={\`cursor-pointer transition-colors \${selectedAccount?.account_id === acc.account_id ? 'bg-[#161b22]' : 'hover:bg-[#0f0f0f]'}\`}>
                             <td className="px-5 py-3.5">
                               <div className="font-medium text-slate-200">{getBankName(acc.account_name)}</div>
                               <div className="text-[11px] text-slate-500 uppercase tracking-wider mt-0.5">{acc.institution}</div>
                               <div className="text-[10px] text-slate-600 font-mono mt-1 md:hidden">{formatAccountId(acc.account_id)}</div>
                             </td>
                             <td className="px-5 py-3.5 font-mono text-[11px] text-slate-400 hidden md:table-cell">
                               {formatAccountId(acc.account_id)}
                             </td>
                             <td className="px-5 py-3.5 text-right font-mono text-white font-medium">
                               <span className="text-slate-500 font-sans font-normal text-xs mr-2">{acc.currency_code}</span>
                               {(acc.balance_cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                             </td>
                             <td className="px-5 py-3.5 text-center">
                               {acc.status === 'frozen' ? (
                                 <span className="inline-flex items-center px-2 py-0.5 rounded-sm text-[10px] font-bold bg-[#490202] text-[#f85149] border border-[#f85149]/30 uppercase tracking-widest">
                                   Frozen
                                 </span>
                               ) : (
                                 <span className="inline-flex items-center px-2 py-0.5 rounded-sm text-[10px] font-bold bg-[#04260f] text-[#3fb950] border border-[#3fb950]/30 uppercase tracking-widest">
                                   Active
                                 </span>
                               )}
                             </td>
                           </tr>
                         ))}
                         {bankAccounts.length === 0 && !bankLoading && (
                           <tr>
                             <td colSpan={4} className="px-5 py-8 text-center text-slate-500 text-xs uppercase tracking-widest font-mono">
                               No account records found
                             </td>
                           </tr>
                         )}
                       </tbody>
                     </table>
                   ) : (
                     <table className="w-full text-left whitespace-nowrap">
                       <thead className="sticky top-0 bg-[#0f0f0f] border-b border-[#1f1f1f] z-10 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                         <tr>
                           <th className="px-5 py-3 hidden md:table-cell">Txn ID</th>
                           <th className="px-5 py-3">Details</th>
                           <th className="px-5 py-3 text-right">Amount</th>
                         </tr>
                       </thead>
                       <tbody className="divide-y divide-[#1f1f1f] text-sm">
                         {bankTransactions.map((tx, idx) => {
                           const isDebit = tx.type === 'withdrawal' || tx.type === 'escrow_hold';
                           const amountSign = isDebit ? '-' : '+';
                           const amountColor = isDebit ? 'text-[#f85149]' : 'text-[#3fb950]';
                           const accObj = bankAccounts.find((a: any) => a.account_id === tx.account_id);
                           const shortTxId = tx.transaction_id.split('_').pop()?.substring(0, 8) || tx.transaction_id;
                           
                           return (
                             <tr key={idx} 
                                 onClick={() => setSelectedTx(tx)}
                                 className={\`cursor-pointer transition-colors \${selectedTx?.transaction_id === tx.transaction_id ? 'bg-[#161b22]' : 'hover:bg-[#0f0f0f]'}\`}>
                               <td className="px-5 py-3 font-mono text-[11px] text-slate-500 hidden md:table-cell">
                                 {shortTxId}
                               </td>
                               <td className="px-5 py-3">
                                 <div className="flex items-center gap-2 mb-1">
                                   <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-[#161b22] px-1.5 py-0.5 rounded">
                                     {tx.type.replace('_', ' ')}
                                   </span>
                                   <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">
                                     {new Date(tx.timestamp).toLocaleString(undefined, {month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second:'2-digit', hour12: false})}
                                   </span>
                                 </div>
                                 <div className="font-medium text-slate-200 text-xs truncate max-w-[200px] sm:max-w-[300px]">
                                   {accObj ? getBankName(accObj.account_name) : 'System Escrow'}
                                 </div>
                                 <div className="text-[10px] text-slate-500 font-mono sm:hidden mt-1">
                                   {new Date(tx.timestamp).toLocaleString(undefined, {month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false})}
                                 </div>
                               </td>
                               <td className={\`px-5 py-3 text-right font-mono font-medium \${amountColor}\`}>
                                 {amountSign} {(tx.amount_cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                 <span className="text-slate-500 font-sans font-normal text-[10px] ml-1">{tx.currency_code}</span>
                               </td>
                             </tr>
                           );
                         })}
                         {bankTransactions.length === 0 && !bankLoading && (
                           <tr>
                             <td colSpan={3} className="px-5 py-8 text-center text-slate-500 text-xs uppercase tracking-widest font-mono">
                               No ledger activity found
                             </td>
                           </tr>
                         )}
                       </tbody>
                     </table>
                   )}
                 </div>
                 
                 <div className="px-4 py-3 border-t border-[#1f1f1f] bg-[#0a0a0a] flex items-center justify-between text-[11px] text-slate-500 shrink-0 font-mono uppercase tracking-widest">
                   <div>Showing 1 - {activeTab === 'BALANCES' ? bankAccounts.length : bankTransactions.length}</div>
                   <div className="flex gap-1">
                     <button className="px-2 py-1 border border-[#2d2d2d] rounded bg-[#0f0f0f] text-slate-600 cursor-not-allowed">PREV</button>
                     <button className="px-2 py-1 border border-[#2d2d2d] rounded bg-[#161b22] text-slate-300">1</button>
                     <button className="px-2 py-1 border border-[#2d2d2d] rounded bg-[#0f0f0f] text-slate-600 cursor-not-allowed">NEXT</button>
                   </div>
                 </div>
              </div>
              
              {/* Right Inspector Panel */}
              {activeTab === 'BALANCES' && selectedAccount && (
                <div className="w-full lg:w-80 bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg shadow-sm flex flex-col shrink-0 animate-in fade-in zoom-in-95 duration-200">
                   <div className="px-5 py-4 border-b border-[#1f1f1f] flex items-center justify-between bg-[#0f0f0f] shrink-0 rounded-t-lg">
                     <h3 className="font-semibold text-white text-sm uppercase tracking-wide">Account Details</h3>
                     <button onClick={() => setSelectedAccount(null)} className="text-slate-500 hover:text-white transition-colors">
                       <XCircle className="w-4 h-4" />
                     </button>
                   </div>
                   <div className="p-5 flex-1 overflow-y-auto">
                     <div className="mb-6">
                       <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">Account ID</div>
                       <div className="font-mono text-[11px] text-slate-300 bg-[#161b22] p-2.5 rounded border border-[#2d2d2d] break-all">{formatAccountId(selectedAccount.account_id)}</div>
                     </div>
                     
                     <div className="space-y-4">
                       <DetailRow label="Institution" value={selectedAccount.institution} />
                       <DetailRow label="Account Name" value={getBankName(selectedAccount.account_name)} />
                       <DetailRow label="Routing Number" value={selectedAccount.routing_number} mono />
                       <DetailRow label="Account Number" value={selectedAccount.account_number} mono />
                       <DetailRow label="Beneficiary" value={selectedAccount.owner_name} />
                       <DetailRow label="Currency" value={selectedAccount.currency_code} />
                     </div>
                     
                     <div className="mt-6 pt-5 border-t border-[#1f1f1f]">
                       <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Available Balance</div>
                       <div className="text-2xl text-white font-mono tracking-tight font-medium">
                         <span className="text-slate-500 font-sans text-sm mr-2 font-normal">{selectedAccount.currency_code}</span>
                         {(selectedAccount.balance_cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                       </div>
                     </div>
                     
                     <div className="mt-8 pt-5 border-t border-[#1f1f1f]">
                       <button onClick={() => handleToggleFreeze(selectedAccount.account_id, selectedAccount.status === 'frozen')} className={\`w-full py-2.5 rounded-sm text-[11px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-colors shadow-sm border \${selectedAccount.status === 'frozen' ? 'bg-[#161b22] text-white border-[#2d2d2d] hover:bg-[#1f242b]' : 'bg-[#490202] text-[#f85149] border-[#f85149]/30 hover:bg-[#490202]/80'}\`}>
                         {selectedAccount.status === 'frozen' ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                         {selectedAccount.status === 'frozen' ? 'Unfreeze Account' : 'Freeze Account'}
                       </button>
                     </div>
                   </div>
                </div>
              )}

              {activeTab === 'LEDGER' && selectedTx && (
                <div className="w-full lg:w-80 bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg shadow-sm flex flex-col shrink-0 animate-in fade-in zoom-in-95 duration-200">
                   <div className="px-5 py-4 border-b border-[#1f1f1f] flex items-center justify-between bg-[#0f0f0f] shrink-0 rounded-t-lg">
                     <h3 className="font-semibold text-white text-sm uppercase tracking-wide">Transaction Details</h3>
                     <button onClick={() => setSelectedTx(null)} className="text-slate-500 hover:text-white transition-colors">
                       <XCircle className="w-4 h-4" />
                     </button>
                   </div>
                   <div className="p-5 flex-1 overflow-y-auto">
                     <div className="mb-6">
                       <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">Payment ID</div>
                       <div className="font-mono text-[11px] text-slate-300 bg-[#161b22] p-2.5 rounded border border-[#2d2d2d] break-all">{selectedTx.transaction_id}</div>
                     </div>
                     
                     <div className="space-y-4">
                       <DetailRow label="Payment Type" value={selectedTx.type.replace('_', ' ').toUpperCase()} />
                       <DetailRow label="Value Date" value={new Date(selectedTx.timestamp).toLocaleString()} />
                       <DetailRow label="Routing Context" value={formatAccountId(selectedTx.account_id)} mono />
                       <DetailRow label="Status" value="Settled" status="success" />
                     </div>
                     
                     <div className="mt-6 pt-5 border-t border-[#1f1f1f]">
                       <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Settlement Amount</div>
                       <div className={\`text-2xl font-mono tracking-tight font-medium \${selectedTx.type === 'withdrawal' || selectedTx.type === 'escrow_hold' ? 'text-[#f85149]' : 'text-[#3fb950]'}\`}>
                         {(selectedTx.type === 'withdrawal' || selectedTx.type === 'escrow_hold') ? '-' : '+'}
                         <span className="text-slate-500 font-sans text-sm mx-2 font-normal">{selectedTx.currency_code}</span>
                         {(selectedTx.amount_cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                       </div>
                     </div>
                     
                     <div className="mt-6 pt-5 border-t border-[#1f1f1f]">
                       <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Audit Log Entry</div>
                       <div className="text-[11px] font-mono text-slate-400 bg-[#161b22] p-3 rounded border border-[#2d2d2d] leading-relaxed break-words">
                         {selectedTx.description}
                       </div>
                     </div>
                   </div>
                </div>
              )}
              
           </div>
        </div>
      </div>
    </div>
  );
}

function SidebarItem({ active, onClick, icon, label, disabled = false }: any) {
  return (
    <button 
      onClick={disabled ? undefined : onClick}
      className={\`w-full flex items-center gap-3 px-6 py-3 text-[12px] transition-colors \${
        disabled 
          ? 'opacity-40 cursor-not-allowed text-slate-600' 
          : active 
            ? 'bg-[#161b22] text-white font-medium border-l-2 border-[#3fb950]' 
            : 'text-slate-400 hover:bg-[#161b22] hover:text-slate-200 border-l-2 border-transparent'
      }\`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function KpiCard({ title, value, subtitle, icon, alert = false }: any) {
  return (
    <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg p-5 flex items-start justify-between relative overflow-hidden">
      {alert && <div className="absolute top-0 left-0 w-1 h-full bg-[#f85149]" />}
      <div>
        <p className="text-[9px] font-bold text-slate-500 mb-2 uppercase tracking-widest">{title}</p>
        <div className="text-xl font-medium text-white tracking-tight font-mono">{value}</div>
        <p className={\`text-[10px] mt-2 \${alert ? 'text-[#f85149] font-medium' : 'text-slate-400'}\`}>{subtitle}</p>
      </div>
      <div className={\`p-2.5 rounded-md border \${alert ? 'bg-[#490202] border-[#f85149]/30' : 'bg-[#161b22] border-[#2d2d2d]'}\`}>
        {icon}
      </div>
    </div>
  );
}

function DetailRow({ label, value, mono = false, status }: any) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">{label}</div>
      {status === 'success' ? (
        <span className="inline-flex items-center px-2 py-0.5 rounded-sm text-[9px] font-bold uppercase tracking-widest bg-[#04260f] text-[#3fb950] border border-[#3fb950]/30">
          {value}
        </span>
      ) : (
        <div className={\`text-xs text-slate-200 \${mono ? 'font-mono text-[11px]' : ''}\`}>{value}</div>
      )}
    </div>
  );
}
`;

fs.writeFileSync(path, newCode);
