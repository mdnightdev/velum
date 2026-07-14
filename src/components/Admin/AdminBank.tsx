import React, { useState, useEffect } from 'react';
import { Landmark, RefreshCw, ShieldCheck, Lock, Globe, CheckCircle, Plus } from 'lucide-react';

interface AdminBankProps {
  adminRole: 'SUPPORT_ADMIN' | 'LOGIN_ADMIN' | 'CLI_ADMIN';
  user?: any;
  adminFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

export default function AdminBank({
  adminRole,
  user,
  adminFetch,
}: AdminBankProps) {
  const [bankStatus, setBankStatus] = useState<any>(null);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [bankTransactions, setBankTransactions] = useState<any[]>([]);
  const [bankLoading, setBankLoading] = useState(false);
  const [bankError, setBankError] = useState('');
  const [bankSuccess, setBankSuccess] = useState('');

  const [showAddAccount, setShowAddAccount] = useState(false);
  const [newAccName, setNewAccName] = useState('');
  const [newAccInst, setNewAccInst] = useState('');
  const [newAccNum, setNewAccNum] = useState('');
  const [newAccRout, setNewAccRout] = useState('');
  const [newAccOwner, setNewAccOwner] = useState('');
  const [newAccBal, setNewAccBal] = useState('');
  const [newAccCurr, setNewAccCurr] = useState('TWD');

  const [adjustingAccountId, setAdjustingAccountId] = useState<string | null>(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustDesc, setAdjustDesc] = useState('');

  const [calcAmount, setCalcAmount] = useState('');
  const [calcFrom, setCalcFrom] = useState('GBP');

  const fetchBankData = async () => {
    setBankLoading(true);
    setBankError('');
    try {
      const statusRes = await adminFetch('/api/bank/status');
      if (statusRes.ok) setBankStatus(await statusRes.json());

      const accRes = await adminFetch('/api/bank/accounts');
      if (accRes.ok) {
        const data = await accRes.json();
        setBankAccounts(data || []);
      }

      const txRes = await adminFetch('/api/bank/transactions');
      if (txRes.ok) {
        const data = await txRes.json();
        setBankTransactions(data || []);
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

  const handleAddBankAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setBankError('');
    setBankSuccess('');
    try {
      const res = await adminFetch('/api/bank/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_name: newAccName,
          institution: newAccInst,
          account_number: newAccNum,
          routing_number: newAccRout,
          owner_name: newAccOwner,
          balance_cents: Math.floor(parseFloat(newAccBal) * 100),
          currency_code: newAccCurr,
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        setBankError(d.error || 'Failed to register bank account.');
      } else {
        setBankSuccess('Registered financial asset account successfully.');
        setShowAddAccount(false);
        setNewAccName('');
        setNewAccInst('');
        setNewAccNum('');
        setNewAccRout('');
        setNewAccOwner('');
        setNewAccBal('');
        fetchBankData();
      }
    } catch (e) {
      setBankError('Network communication failure.');
    }
  };

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
        setBankSuccess('Adjusted account ledger balances.');
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
        setBankSuccess(currentlyFrozen ? 'Unfroze bank account.' : 'Froze bank account.');
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

  const centralReserveAcc = bankAccounts.find((a) =>
    a.account_name.toUpperCase().includes('CENTRAL')
  );
  const centralBalance = centralReserveAcc ? centralReserveAcc.balance_cents / 100 : 18400000000;

  const escrowReserveAcc = bankAccounts.find((a) =>
    a.account_name.toUpperCase().includes('ESCROW')
  );
  const escrowBalance = escrowReserveAcc ? escrowReserveAcc.balance_cents / 100 : 8500000000;

  return (
    <div className="h-full overflow-y-auto pr-2 scrollbar-none space-y-4 animate-fadeIn font-mono text-[11px] max-w-5xl mx-auto w-full">
      <div className="flex justify-between items-center border-b border-white-10 pb-2">
        <div>
          <h1 className="text-xs font-black uppercase tracking-wider text-white">Treasury & Liquidity Management</h1>
          <p className="text-[9px] text-text-secondary mt-0.5">ADMINISTRATION PORTAL | ACTIVE ASSETS AND CLEARING NODES</p>
        </div>
        <button
          type="button"
          onClick={fetchBankData}
          className="p-1.5 bg-velum-800 hover:bg-velum-700 border border-white-5 text-white rounded transition cursor-pointer flex items-center gap-1.5 text-[9px] font-bold"
        >
          <RefreshCw className={`w-3 h-3 ${bankLoading ? 'animate-spin' : ''}`} />
          {bankLoading ? 'SYNCING...' : 'REFRESH LEDGERS'}
        </button>
      </div>

      {bankError && (
        <div className="p-2.5 bg-bank-rose/10 border border-bank-rose/25 text-bank-rose rounded font-bold flex items-center gap-2">
          <span className="w-1 h-1 rounded-full bg-bank-rose animate-ping" />
          ERROR: {bankError}
        </div>
      )}
      {bankSuccess && (
        <div className="p-2.5 bg-bank-emerald/10 border border-bank-emerald/25 text-bank-emerald rounded font-bold flex items-center gap-2">
          <span className="w-1 h-1 rounded-full bg-bank-emerald" />
          SUCCESS: {bankSuccess}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-3.5 rounded bg-[#0b0e14] border border-white-10 shadow-sm flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-[8px] font-black text-text-secondary uppercase tracking-wider">AGGREGATE BALANCES (TWD)</span>
            <Landmark className="w-3.5 h-3.5 text-text-disabled" />
          </div>
          <div className="mt-4">
            <div className="text-base font-black text-white tracking-tight leading-none">
              NT$ {totalLiquidityTwd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        <div className="p-3.5 rounded bg-[#0b0e14] border border-white-10 shadow-sm flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-[8px] font-black text-text-secondary uppercase tracking-wider">CENTRAL RESERVES</span>
            <ShieldCheck className="w-3.5 h-3.5 text-text-disabled" />
          </div>
          <div className="mt-4">
            <div className="text-base font-black text-white tracking-tight leading-none">
              NT$ {centralBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        <div className="p-3.5 rounded bg-[#0b0e14] border border-white-10 shadow-sm flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-[8px] font-black text-text-secondary uppercase tracking-wider">ESCROW RESERVES</span>
            <Lock className="w-3.5 h-3.5 text-text-disabled" />
          </div>
          <div className="mt-4">
            <div className="text-base font-black text-white tracking-tight leading-none">
              NT$ {escrowBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        <div className="p-3.5 rounded bg-[#0b0e14] border border-white-10 shadow-sm flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-[8px] font-black text-text-secondary uppercase tracking-wider">ACTIVE CONNECTIONS</span>
            <Globe className="w-3.5 h-3.5 text-text-disabled" />
          </div>
          <div className="mt-4">
            <div className="text-sm font-black text-emerald-400 tracking-tight flex items-center gap-1.5 leading-none">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {bankAccounts.length} NODES ONLINE
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <div className="lg:col-span-7 p-4 rounded bg-[#0b0e14] border border-white-10 shadow-sm space-y-3">
          <div className="border-b border-white-5 pb-2">
            <h3 className="text-[9px] font-black uppercase tracking-wider text-accent">Active Exchange Rate Index</h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="p-2.5 rounded bg-[#0e121a] border border-white-5 text-center space-y-0.5">
              <span className="text-[7.5px] font-black text-text-secondary uppercase block">GBP / TWD</span>
              <div className="text-xs font-black text-white">36.80</div>
            </div>

            <div className="p-2.5 rounded bg-[#0e121a] border border-white-5 text-center space-y-0.5">
              <span className="text-[7.5px] font-black text-text-secondary uppercase block">USD / TWD</span>
              <div className="text-xs font-black text-white">30.65</div>
            </div>

            <div className="p-2.5 rounded bg-[#0e121a] border border-white-5 text-center space-y-0.5">
              <span className="text-[7.5px] font-black text-text-secondary uppercase block">VLM / TWD</span>
              <div className="text-xs font-black text-accent">36.80</div>
            </div>

            <div className="p-2.5 rounded bg-[#0e121a] border border-white-5 text-center space-y-0.5">
              <span className="text-[7.5px] font-black text-text-secondary uppercase block">VLM / GBP</span>
              <div className="text-xs font-black text-emerald-400">1.0000</div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 p-4 rounded bg-[#0b0e14] border border-white-10 shadow-sm space-y-3">
          <div className="border-b border-white-5 pb-2">
            <h3 className="text-[9px] font-black uppercase tracking-wider text-white">Conversion Utility</h3>
          </div>

          <div className="space-y-2">
            <div className="flex gap-2">
              <div className="flex-1">
                <input
                  type="number"
                  placeholder="Enter volume..."
                  value={calcAmount}
                  onChange={(e) => setCalcAmount(e.target.value)}
                  className="w-full p-2 bg-[#0e121a] border border-white-5 rounded outline-none focus:border-accent text-white font-bold text-xs"
                />
              </div>
              <div className="w-24">
                <select
                  value={calcFrom}
                  onChange={(e) => setCalcFrom(e.target.value)}
                  className="w-full p-2 bg-[#0e121a] border border-white-5 rounded text-white outline-none focus:border-accent font-bold text-xs"
                >
                  <option value="GBP">GBP (£)</option>
                  <option value="TWD">TWD (NT$)</option>
                  <option value="USD">USD ($)</option>
                  <option value="VLM">VLM</option>
                </select>
              </div>
            </div>

            {calcAmount && parseFloat(calcAmount) > 0 ? (
              (() => {
                const amt = parseFloat(calcAmount);
                const rates: Record<string, number> = {
                  TWD: 1.0,
                  GBP: 36.8,
                  USD: 30.65,
                  VLM: 36.8,
                };

                const amtInTwd = amt * rates[calcFrom];

                return (
                  <div className="p-2.5 bg-[#0e121a] border border-white-5 rounded text-[10px] grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[7.5px] text-text-secondary uppercase block font-bold">TWD</span>
                      <span className="text-white font-bold">NT$ {amtInTwd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div>
                      <span className="text-[7.5px] text-text-secondary uppercase block font-bold">GBP</span>
                      <span className="text-white font-bold">£ {(amtInTwd / rates.GBP).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div>
                      <span className="text-[7.5px] text-text-secondary uppercase block font-bold">USD</span>
                      <span className="text-white font-bold">$ {(amtInTwd / rates.USD).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div>
                      <span className="text-[7.5px] text-text-secondary uppercase block font-bold">VLM</span>
                      <span className="text-accent font-bold">{(amtInTwd / rates.VLM).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                );
              })()
            ) : null}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between border-b border-white-5 pb-1">
          <h3 className="text-[9px] font-black uppercase tracking-wider text-white">Reserve Accounts & Connected Nodes</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {bankAccounts.map((acc) => {
            const isCentral = acc.account_name.toUpperCase().includes('CENTRAL');
            const cardBorder = isCentral ? 'border-accent/40 hover:border-accent' : 'border-white-5 hover:border-white-10';

            return (
              <div
                key={acc.account_id}
                className={`p-4 rounded bg-[#0b0e14] border ${cardBorder} flex flex-col justify-between min-h-[145px] shadow-sm transition duration-150`}
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-start gap-3">
                    <div className="min-w-0">
                      <span className="text-[8px] font-black text-accent uppercase block tracking-wider">{acc.institution}</span>
                      <h4 className="text-[11px] font-bold text-white mt-0.5 uppercase truncate">{acc.account_name}</h4>
                    </div>
                    <span
                      className={`text-[8px] font-bold px-1.5 py-0.5 rounded border uppercase shrink-0 ${
                        acc.status === 'active'
                          ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                          : 'bg-red-500/10 border-red-500/25 text-red-400'
                      }`}
                    >
                      {acc.status === 'active' ? 'Active' : 'Frozen'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[8px] text-text-secondary uppercase tracking-wider block">Reserve Balance</span>
                    <div className="text-base font-black text-white mt-1 flex items-baseline truncate">
                      {acc.currency_code === 'TWD' ? 'NT$ ' : ''}
                      {(acc.balance_cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      <span className="text-[9px] text-text-secondary font-bold ml-1 uppercase">{acc.currency_code}</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center border-t border-white-5 pt-3 mt-4 text-[9px] text-text-secondary">
                  <div className="flex flex-col text-[8px] leading-snug min-w-0">
                    <span className="truncate">CODE: {acc.account_number}</span>
                    <span className="truncate font-bold uppercase">OWNER: {acc.beneficiary_owner}</span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setAdjustingAccountId(acc.account_id);
                        setAdjustAmount('');
                        setAdjustDesc('');
                      }}
                      className="px-2 py-1 text-[8.5px] font-black bg-accent/10 border border-accent/20 hover:border-accent hover:bg-accent text-accent hover:text-velum-900 rounded transition uppercase cursor-pointer"
                    >
                      Adjust
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleFreeze(acc.account_id, acc.status === 'frozen')}
                      className={`px-2 py-1 text-[8.5px] font-black border rounded transition uppercase cursor-pointer ${
                        acc.status === 'frozen'
                          ? 'bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500 text-emerald-400 hover:text-velum-900'
                          : 'bg-red-500/10 border-red-500/20 hover:bg-red-500 text-red-400 hover:text-velum-900'
                      }`}
                    >
                      {acc.status === 'frozen' ? 'Unfreeze' : 'Freeze'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {!showAddAccount && (
            <div
              onClick={() => setShowAddAccount(true)}
              className="p-4 rounded border border-dashed border-white-10 hover:border-accent bg-transparent hover:bg-[#0b0e14] flex flex-col items-center justify-center min-h-[145px] cursor-pointer group transition duration-150"
            >
              <div className="p-1.5 bg-white-5 border border-white-10 rounded text-text-secondary group-hover:border-accent group-hover:text-accent transition duration-150">
                <Plus className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-bold text-text-secondary group-hover:text-accent mt-2 transition duration-150 tracking-wider uppercase">
                Add Reserve account
              </span>
            </div>
          )}
        </div>
      </div>

      {adjustingAccountId && (
        (() => {
          const currentAcc = bankAccounts.find((a) => a.account_id === adjustingAccountId);
          if (!currentAcc) return null;

          return (
            <div className="p-4 rounded bg-[#0b0e14] border border-accent border-l-2 max-w-2xl space-y-3 shadow-md">
              <div className="flex items-start justify-between border-b border-white-5 pb-2">
                <div>
                  <h4 className="text-[9px] font-black uppercase tracking-wider text-accent">Reserve Adjustment Desk</h4>
                  <p className="text-[8px] text-text-secondary mt-0.5">TARGET ROUTING: {currentAcc.account_number}</p>
                </div>
                <div className="text-right">
                  <span className="text-[8px] text-text-secondary uppercase block">Audited Value</span>
                  <span className="text-[11px] text-white font-bold block">
                    {currentAcc.currency_code === 'TWD' ? 'NT$ ' : ''}
                    {(currentAcc.balance_cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                    {currentAcc.currency_code}
                  </span>
                </div>
              </div>

              <form onSubmit={handleAdjustBalance} className="space-y-3 text-[10px]">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[8px] font-bold text-text-secondary uppercase mb-1">Adjustment Delta</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none text-text-secondary text-[10px]">
                        {currentAcc.currency_code}
                      </div>
                      <input
                        type="number"
                        step="0.01"
                        required
                        placeholder="0.00"
                        value={adjustAmount}
                        onChange={(e) => setAdjustAmount(e.target.value)}
                        className="w-full pl-10 pr-2 py-1.5 rounded outline-none border border-white-10 focus:border-accent bg-velum-900 text-white font-bold"
                        autoFocus
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[8px] font-bold text-text-secondary uppercase mb-1">Audit Clearance Log Reason</label>
                    <input
                      type="text"
                      required
                      placeholder="Audit note description..."
                      value={adjustDesc}
                      onChange={(e) => setAdjustDesc(e.target.value)}
                      className="w-full p-1.5 rounded border border-white-10 focus:border-accent bg-velum-900 text-white"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2 border-t border-white-5">
                  <button type="submit" className="px-3.5 py-1.5 bg-accent hover:bg-accent-hover text-velum-900 font-extrabold uppercase rounded text-[9px] tracking-wide transition cursor-pointer">
                    Commit Adjustments
                  </button>
                  <button type="button" onClick={() => setAdjustingAccountId(null)} className="px-3.5 py-1.5 bg-[#0e121a] hover:bg-velum-800 text-white border border-white-5 font-extrabold uppercase rounded text-[9px] tracking-wide transition cursor-pointer">
                    Dismiss
                  </button>
                </div>
              </form>
            </div>
          );
        })()
      )}

      {showAddAccount && (
        <div className="p-4 rounded bg-[#0b0e14] border border-[#ffb154]/20 animate-fadeIn space-y-3 shadow-md">
          <div className="border-b border-white-5 pb-2">
            <h4 className="text-[9px] font-black uppercase tracking-wider text-[#ffb154]">Register Asset Vault</h4>
          </div>

          <form onSubmit={handleAddBankAccount} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-[10px]">
            <div>
              <label className="block text-[8px] font-bold text-text-secondary uppercase mb-1">Account Name</label>
              <input type="text" required value={newAccName} onChange={(e) => setNewAccName(e.target.value)} className="w-full p-2 rounded border border-white-10 bg-[#0e121a] text-white" />
            </div>
            <div>
              <label className="block text-[8px] font-bold text-text-secondary uppercase mb-1">Institution</label>
              <input type="text" required value={newAccInst} onChange={(e) => setNewAccInst(e.target.value)} className="w-full p-2 rounded border border-white-10 bg-[#0e121a] text-white" />
            </div>
            <div>
              <label className="block text-[8px] font-bold text-text-secondary uppercase mb-1">Card / Account Code</label>
              <input type="text" required value={newAccNum} onChange={(e) => setNewAccNum(e.target.value)} className="w-full p-2 rounded border border-white-10 bg-[#0e121a] text-white" />
            </div>
            <div>
              <label className="block text-[8px] font-bold text-text-secondary uppercase mb-1">Routing Code / SWIFT</label>
              <input type="text" required value={newAccRout} onChange={(e) => setNewAccRout(e.target.value)} className="w-full p-2 rounded border border-white-10 bg-[#0e121a] text-white" />
            </div>
            <div>
              <label className="block text-[8px] font-bold text-text-secondary uppercase mb-1">Beneficiary Name</label>
              <input type="text" required value={newAccOwner} onChange={(e) => setNewAccOwner(e.target.value)} className="w-full p-2 rounded border border-white-10 bg-[#0e121a] text-white" />
            </div>
            <div>
              <label className="block text-[8px] font-bold text-text-secondary uppercase mb-1">Initial Capital Balance</label>
              <input type="number" step="0.01" required value={newAccBal} onChange={(e) => setNewAccBal(e.target.value)} className="w-full p-2 rounded border border-white-10 bg-[#0e121a] text-white font-bold" />
            </div>
            <div className="md:col-span-2 lg:col-span-1">
              <label className="block text-[8px] font-bold text-text-secondary uppercase mb-1">Currency Code</label>
              <select value={newAccCurr} onChange={(e) => setNewAccCurr(e.target.value)} className="w-full p-2 rounded border border-white-10 bg-[#0e121a] text-white">
                <option value="TWD">TWD (NT$)</option>
                <option value="USD">USD ($)</option>
                <option value="VLM">VLM</option>
              </select>
            </div>

            <div className="md:col-span-2 lg:col-span-3 flex gap-2 pt-2 border-t border-white-5">
              <button type="submit" className="px-4 py-2 bg-accent hover:bg-accent-hover text-velum-900 font-extrabold uppercase rounded text-[9px] tracking-widest transition cursor-pointer">
                Commit Registration
              </button>
              <button type="button" onClick={() => setShowAddAccount(false)} className="px-4 py-2 bg-[#0e121a] hover:bg-velum-800 text-white border border-white-5 font-extrabold uppercase rounded text-[9px] tracking-widest transition cursor-pointer">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="p-4 rounded bg-[#0b0e14] border border-white-10 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-white-5 pb-2">
          <h3 className="text-[9px] font-black uppercase tracking-wider text-accent">General Audit & Ledger Journal</h3>
        </div>

        <div className="overflow-x-auto rounded border border-white-5 bg-[#0e121a]">
          <table className="w-full text-left text-[10px]">
            <thead>
              <tr className="text-text-secondary text-[8px] font-black uppercase tracking-wider border-b border-white-5 bg-[#0b0e14] select-none">
                <th className="p-2.5">ID</th>
                <th className="p-2.5">Routing Account Context</th>
                <th className="p-2.5">Type</th>
                <th className="p-2.5">Reserve Impact</th>
                <th className="p-2.5">Clearance Description Log</th>
                <th className="p-2.5 text-right">Settlement Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03] text-text-primary font-medium">
              {bankTransactions.map((tx, idx) => {
                const isDebit = tx.type === 'withdrawal' || tx.type === 'escrow_hold';
                const amountSign = isDebit ? '-' : '+';
                const amountColor = isDebit ? 'text-bank-rose' : 'text-bank-emerald';
                const accObj = bankAccounts.find((a: any) => a.account_id === tx.account_id);

                return (
                  <tr key={idx} className="hover:bg-text-primary-2 transition duration-75">
                    <td className="p-2.5 font-bold text-accent">
                      #{tx.transaction_id}
                    </td>
                    <td className="p-2.5">
                      <div className="font-bold text-text-primary uppercase text-[10px]">
                        {accObj?.account_name || 'System Escrow Context'}
                      </div>
                      <div className="text-[8px] text-text-secondary uppercase">
                        {accObj?.institution || 'Velum Core Clearing'}
                      </div>
                    </td>
                    <td className="p-2.5">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold bg-white-5 border border-white-5 uppercase tracking-wide">
                        {tx.type.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className={`p-2.5 font-bold ${amountColor}`}>
                      {amountSign}
                      {tx.currency_code === 'TWD' ? 'NT$ ' : ''}
                      {(tx.amount_cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                      <span className="text-[8px] text-text-secondary font-bold">{tx.currency_code}</span>
                    </td>
                    <td className="p-2.5 text-text-secondary max-w-[180px] truncate">
                      {tx.description}
                    </td>
                    <td className="p-2.5 text-right text-text-secondary text-[9px]">
                      {new Date(tx.timestamp).toLocaleString()}
                    </td>
                  </tr>
                );
              })}
              {bankTransactions.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-text-secondary font-mono text-[9px] uppercase tracking-wider">
                    // General ledger transaction journal empty //
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
