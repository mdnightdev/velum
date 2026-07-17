const fs = require('fs');
const path = 'src/components/Admin/AdminBank.tsx';

const newCode = `import React, { useState, useEffect } from 'react';
import { Search, Bell, HelpCircle, Database, AlertCircle, CheckCircle2, XCircle, PieChart, Lock, Unlock, RefreshCw, Filter, FileText, FileDown, ShieldAlert, CreditCard } from 'lucide-react';

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
  const [activeTab, setActiveTab] = useState<'BALANCES' | 'LEDGER'>('BALANCES');
  const [selectedTx, setSelectedTx] = useState<any | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<any | null>(null);

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

  return (
    <div id="admin_bank_view" className="flex h-full w-full bg-[#F1F5F9] text-slate-800 font-sans text-sm selection:bg-blue-100 overflow-hidden">
      
      {/* Left Sidebar - Navy Theme */}
      <div className="w-64 bg-[#0F172A] text-slate-300 flex flex-col shrink-0 border-r border-slate-800">
        <div className="p-4 border-b border-slate-800 flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center text-white font-bold tracking-tight">
            V
          </div>
          <div>
            <h1 className="text-white font-semibold text-sm leading-tight tracking-wide">Treasury & Markets</h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-0.5">Operations Command</p>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto py-4">
          <div className="px-4 mb-2 text-[10px] font-bold tracking-widest text-slate-500 uppercase">Liquidity Operations</div>
          <SidebarItem active={activeTab === 'BALANCES'} onClick={() => {setActiveTab('BALANCES'); setSelectedTx(null);}} icon={<PieChart className="w-4 h-4"/>} label="Cash Balances" />
          <SidebarItem disabled icon={<RefreshCw className="w-4 h-4"/>} label="Liquidity Forecast" />
          <SidebarItem disabled icon={<ShieldAlert className="w-4 h-4"/>} label="Collateral Management" />
          
          <div className="px-4 mt-6 mb-2 text-[10px] font-bold tracking-widest text-slate-500 uppercase">Payments & Settlement</div>
          <SidebarItem active={activeTab === 'LEDGER'} onClick={() => {setActiveTab('LEDGER'); setSelectedAccount(null);}} icon={<Database className="w-4 h-4"/>} label="Audit Ledger" />
          <SidebarItem disabled icon={<CreditCard className="w-4 h-4"/>} label="Payment Queue" />
          <SidebarItem disabled icon={<FileDown className="w-4 h-4"/>} label="SWIFT Messages" />
          
          <div className="px-4 mt-6 mb-2 text-[10px] font-bold tracking-widest text-slate-500 uppercase">Risk & Compliance</div>
          <SidebarItem disabled icon={<AlertCircle className="w-4 h-4"/>} label="Limits Monitoring" />
          <SidebarItem disabled icon={<ShieldAlert className="w-4 h-4"/>} label="Fraud Alerts" />
        </div>
        
        <div className="p-4 border-t border-slate-800 text-xs">
          <div className="flex items-center gap-2 text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
            <span className="font-medium">All Systems Operational</span>
          </div>
        </div>
      </div>
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        
        {/* Top Header */}
        <div className="bg-white h-14 border-b border-slate-200 flex items-center justify-between px-6 shrink-0 shadow-sm z-10 relative">
           <div className="flex-1 max-w-xl">
             <div className="relative">
               <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
               <input type="text" placeholder="Search for transactions, accounts, entities... (Ctrl+K)" className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-400" />
             </div>
           </div>
           <div className="flex items-center gap-5 text-slate-500 ml-4">
             <div className="relative cursor-pointer hover:text-slate-700">
               <Bell className="w-5 h-5" />
               {frozenCount > 0 && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>}
             </div>
             <HelpCircle className="w-5 h-5 cursor-pointer hover:text-slate-700" />
             <div className="h-8 border-l border-slate-200 mx-1"></div>
             <div className="flex items-center gap-3">
                <div className="text-right hidden md:block">
                  <div className="text-xs font-semibold text-slate-700 leading-none">Operations Officer</div>
                  <div className="text-[10px] text-slate-500 mt-1">{adminRole}</div>
                </div>
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold border border-blue-200">
                  {adminRole.charAt(0)}
                </div>
             </div>
           </div>
        </div>
        
        {/* Work Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col gap-6">
           
           {/* KPI Ribbon */}
           <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
              <KpiCard title="Consolidated Liquidity" value={\`TWD \${totalLiquidityTwd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\`} subtitle="Total Available Balance" icon={<PieChart className="w-5 h-5 text-blue-600"/>} />
              <KpiCard title="24H Settlement Volume" value={\`TWD \${volume24h.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\`} subtitle={\`\${recentTxs.length} Transactions Settled\`} icon={<RefreshCw className="w-5 h-5 text-emerald-600"/>} />
              <KpiCard title="Active Reserve Accounts" value={bankAccounts.length.toString()} subtitle={\`\${frozenCount} Accounts Frozen\`} icon={<Database className="w-5 h-5 text-amber-600"/>} />
              <KpiCard title="High Priority Alerts" value={frozenCount.toString()} subtitle={frozenCount > 0 ? "Requires Attention" : "No pending alerts"} icon={<AlertCircle className="w-5 h-5 text-red-600"/>} alert={frozenCount > 0} />
           </div>
           
           {/* Error Messages */}
           {bankError && (
              <div className="bg-red-50 border border-red-200 p-3 flex items-center gap-3 rounded shrink-0">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <p className="text-sm font-medium text-red-700">{bankError}</p>
              </div>
           )}

           {/* Data Grid Section */}
           <div className="flex-1 flex gap-6 overflow-hidden min-h-[500px]">
              
              {/* Main Table */}
              <div className="flex-1 bg-white border border-slate-200 rounded-lg shadow-sm flex flex-col overflow-hidden min-w-0">
                 
                 <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
                   <h2 className="font-semibold text-slate-800 text-lg">
                     {activeTab === 'BALANCES' ? 'Cash Balances' : 'Audit Ledger'}
                   </h2>
                   <div className="flex items-center gap-3">
                     <button onClick={fetchBankData} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-100 rounded hover:bg-blue-100 transition-colors">
                       <RefreshCw className="w-3.5 h-3.5" />
                       Refresh
                     </button>
                     <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-300 rounded hover:bg-slate-50 transition-colors shadow-sm">
                       <Filter className="w-3.5 h-3.5" />
                       Filters
                     </button>
                   </div>
                 </div>

                 <div className="flex-1 overflow-auto">
                   {activeTab === 'BALANCES' ? (
                     <table className="w-full text-left whitespace-nowrap">
                       <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                         <tr>
                           <th className="px-5 py-3">Institution / Name</th>
                           <th className="px-5 py-3">Account ID</th>
                           <th className="px-5 py-3">Routing & Account</th>
                           <th className="px-5 py-3 text-right">Available Balance</th>
                           <th className="px-5 py-3 text-center">Status</th>
                         </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100 text-sm">
                         {bankAccounts.map((acc, idx) => (
                           <tr key={idx} 
                               onClick={() => setSelectedAccount(acc)}
                               className={\`cursor-pointer transition-colors \${selectedAccount?.account_id === acc.account_id ? 'bg-blue-50/50' : 'hover:bg-slate-50'}\`}>
                             <td className="px-5 py-3.5">
                               <div className="font-medium text-slate-900">{getBankName(acc.account_name)}</div>
                               <div className="text-xs text-slate-500">{acc.institution}</div>
                             </td>
                             <td className="px-5 py-3.5 font-mono text-xs text-slate-600">
                               {acc.account_id}
                             </td>
                             <td className="px-5 py-3.5 font-mono text-xs text-slate-600">
                               {acc.routing_number} / {String(acc.account_number).slice(-4)}
                             </td>
                             <td className="px-5 py-3.5 text-right font-mono text-slate-900 font-medium">
                               <span className="text-slate-400 font-sans font-normal text-xs mr-1">{acc.currency_code}</span>
                               {(acc.balance_cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                             </td>
                             <td className="px-5 py-3.5 text-center">
                               {acc.status === 'frozen' ? (
                                 <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-red-100 text-red-700 border border-red-200">
                                   Held
                                 </span>
                               ) : (
                                 <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-100 text-emerald-700 border border-emerald-200">
                                   Active
                                 </span>
                               )}
                             </td>
                           </tr>
                         ))}
                       </tbody>
                     </table>
                   ) : (
                     <table className="w-full text-left whitespace-nowrap">
                       <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                         <tr>
                           <th className="px-5 py-3">Txn ID</th>
                           <th className="px-5 py-3">Timestamp</th>
                           <th className="px-5 py-3">Routing Context</th>
                           <th className="px-5 py-3">Operation</th>
                           <th className="px-5 py-3 text-right">Amount</th>
                         </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100 text-sm">
                         {bankTransactions.map((tx, idx) => {
                           const isDebit = tx.type === 'withdrawal' || tx.type === 'escrow_hold';
                           const amountSign = isDebit ? '-' : '+';
                           const amountColor = isDebit ? 'text-red-600' : 'text-emerald-600';
                           const accObj = bankAccounts.find((a: any) => a.account_id === tx.account_id);
                           
                           return (
                             <tr key={idx} 
                                 onClick={() => setSelectedTx(tx)}
                                 className={\`cursor-pointer transition-colors \${selectedTx?.transaction_id === tx.transaction_id ? 'bg-blue-50/50' : 'hover:bg-slate-50'}\`}>
                               <td className="px-5 py-3 font-mono text-xs text-slate-600">
                                 {tx.transaction_id.split('_').pop()?.substring(0, 8)}
                               </td>
                               <td className="px-5 py-3 font-mono text-xs text-slate-600">
                                  {new Date(tx.timestamp).toLocaleString(undefined, {month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second:'2-digit', hour12: false})}
                               </td>
                               <td className="px-5 py-3">
                                 <div className="font-medium text-slate-900 truncate max-w-[200px]">
                                   {accObj ? getBankName(accObj.account_name) : 'System Escrow'}
                                 </div>
                               </td>
                               <td className="px-5 py-3 text-xs">
                                 <span className="capitalize">{tx.type.replace('_', ' ')}</span>
                               </td>
                               <td className={\`px-5 py-3 text-right font-mono font-medium \${amountColor}\`}>
                                 {amountSign} {(tx.amount_cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                 <span className="text-slate-400 font-sans font-normal text-[10px] ml-1">{tx.currency_code}</span>
                               </td>
                             </tr>
                           );
                         })}
                       </tbody>
                     </table>
                   )}
                 </div>
                 
                 <div className="px-5 py-3 border-t border-slate-200 bg-white flex items-center justify-between text-xs text-slate-500 shrink-0">
                   <div>Showing 1 to {activeTab === 'BALANCES' ? bankAccounts.length : bankTransactions.length} entries</div>
                   <div className="flex gap-1">
                     <button className="px-2.5 py-1 border border-slate-200 rounded bg-white text-slate-400 cursor-not-allowed">Previous</button>
                     <button className="px-2.5 py-1 border border-blue-600 rounded bg-blue-600 text-white font-medium shadow-sm">1</button>
                     <button className="px-2.5 py-1 border border-slate-200 rounded bg-white text-slate-400 cursor-not-allowed">Next</button>
                   </div>
                 </div>
              </div>
              
              {/* Right Inspector Panel */}
              {activeTab === 'BALANCES' && selectedAccount && (
                <div className="w-80 bg-white border border-slate-200 rounded-lg shadow-sm flex flex-col shrink-0 animate-in slide-in-from-right-4 duration-200">
                   <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0 rounded-t-lg">
                     <h3 className="font-semibold text-slate-800">Account Details</h3>
                     <button onClick={() => setSelectedAccount(null)} className="text-slate-400 hover:text-slate-600">
                       <XCircle className="w-4 h-4" />
                     </button>
                   </div>
                   <div className="p-5 flex-1 overflow-y-auto">
                     <div className="mb-6">
                       <div className="text-xs font-medium text-slate-500 mb-1.5">Account ID</div>
                       <div className="font-mono text-xs text-slate-700 bg-slate-100 p-2.5 rounded border border-slate-200 break-all">{selectedAccount.account_id}</div>
                     </div>
                     
                     <div className="space-y-4">
                       <DetailRow label="Institution" value={selectedAccount.institution} />
                       <DetailRow label="Account Name" value={selectedAccount.account_name} />
                       <DetailRow label="Routing Number" value={selectedAccount.routing_number} mono />
                       <DetailRow label="Account Number" value={selectedAccount.account_number} mono />
                       <DetailRow label="Beneficiary" value={selectedAccount.owner_name} />
                       <DetailRow label="Currency" value={selectedAccount.currency_code} />
                     </div>
                     
                     <div className="mt-6 pt-5 border-t border-slate-200">
                       <div className="text-xs font-medium text-slate-500 mb-2">Available Balance</div>
                       <div className="text-2xl text-slate-900 font-mono tracking-tight font-medium">
                         <span className="text-slate-400 font-sans text-sm mr-1 font-normal">{selectedAccount.currency_code}</span>
                         {(selectedAccount.balance_cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                       </div>
                     </div>
                     
                     <div className="mt-8 pt-5 border-t border-slate-200">
                       <button onClick={() => handleToggleFreeze(selectedAccount.account_id, selectedAccount.status === 'frozen')} className={\`w-full py-2.5 rounded text-sm font-medium flex items-center justify-center gap-2 transition-colors shadow-sm \${selectedAccount.status === 'frozen' ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-white text-red-600 hover:bg-red-50 border border-red-200'}\`}>
                         {selectedAccount.status === 'frozen' ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                         {selectedAccount.status === 'frozen' ? 'Unfreeze Account' : 'Freeze Account'}
                       </button>
                     </div>
                   </div>
                </div>
              )}

              {activeTab === 'LEDGER' && selectedTx && (
                <div className="w-80 bg-white border border-slate-200 rounded-lg shadow-sm flex flex-col shrink-0 animate-in slide-in-from-right-4 duration-200">
                   <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0 rounded-t-lg">
                     <h3 className="font-semibold text-slate-800">Transaction Details</h3>
                     <button onClick={() => setSelectedTx(null)} className="text-slate-400 hover:text-slate-600">
                       <XCircle className="w-4 h-4" />
                     </button>
                   </div>
                   <div className="p-5 flex-1 overflow-y-auto">
                     <div className="mb-6">
                       <div className="text-xs font-medium text-slate-500 mb-1.5">Payment ID</div>
                       <div className="font-mono text-xs text-slate-700 bg-slate-100 p-2.5 rounded border border-slate-200 break-all">{selectedTx.transaction_id}</div>
                     </div>
                     
                     <div className="space-y-4">
                       <DetailRow label="Payment Type" value={selectedTx.type.replace('_', ' ').toUpperCase()} />
                       <DetailRow label="Value Date" value={new Date(selectedTx.timestamp).toLocaleString()} />
                       <DetailRow label="Routing Context" value={selectedTx.account_id} mono />
                       <DetailRow label="Status" value="Settled" status="success" />
                     </div>
                     
                     <div className="mt-6 pt-5 border-t border-slate-200">
                       <div className="text-xs font-medium text-slate-500 mb-2">Settlement Amount</div>
                       <div className={\`text-2xl font-mono tracking-tight font-medium \${selectedTx.type === 'withdrawal' || selectedTx.type === 'escrow_hold' ? 'text-red-600' : 'text-emerald-600'}\`}>
                         {(selectedTx.type === 'withdrawal' || selectedTx.type === 'escrow_hold') ? '-' : '+'}
                         <span className="text-slate-400 font-sans text-sm mx-1 font-normal">{selectedTx.currency_code}</span>
                         {(selectedTx.amount_cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                       </div>
                     </div>
                     
                     <div className="mt-6 pt-5 border-t border-slate-200">
                       <div className="text-xs font-medium text-slate-500 mb-2">Audit Log Entry</div>
                       <div className="text-sm text-slate-700 bg-slate-50 p-3 rounded border border-slate-200 leading-relaxed">
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
      className={\`w-full flex items-center gap-3 px-6 py-2.5 text-[13px] transition-colors \${
        disabled 
          ? 'opacity-40 cursor-not-allowed text-slate-500' 
          : active 
            ? 'bg-blue-600/10 text-blue-400 font-medium border-r-2 border-blue-500' 
            : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
      }\`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function KpiCard({ title, value, subtitle, icon, alert = false }: any) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm flex items-start justify-between relative overflow-hidden">
      {alert && <div className="absolute top-0 left-0 w-1 h-full bg-red-500" />}
      <div>
        <p className="text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">{title}</p>
        <div className="text-2xl font-semibold text-slate-800 tracking-tight">{value}</div>
        <p className={\`text-xs mt-1.5 \${alert ? 'text-red-600 font-medium' : 'text-slate-500'}\`}>{subtitle}</p>
      </div>
      <div className={\`p-2.5 rounded-md \${alert ? 'bg-red-50' : 'bg-slate-50'}\`}>
        {icon}
      </div>
    </div>
  );
}

function DetailRow({ label, value, mono = false, status }: any) {
  return (
    <div>
      <div className="text-xs font-medium text-slate-500 mb-1">{label}</div>
      {status === 'success' ? (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
          {value}
        </span>
      ) : (
        <div className={\`text-sm text-slate-800 \${mono ? 'font-mono' : ''}\`}>{value}</div>
      )}
    </div>
  );
}
`;

fs.writeFileSync(path, newCode);
