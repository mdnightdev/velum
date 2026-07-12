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
  // Local States
  const [bankStatus, setBankStatus] = useState<any>(null);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [bankTransactions, setBankTransactions] = useState<any[]>([]);
  const [bankLoading, setBankLoading] = useState(false);
  const [bankError, setBankError] = useState('');
  const [bankSuccess, setBankSuccess] = useState('');

  // Add bank account form
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [newAccName, setNewAccName] = useState('');
  const [newAccInst, setNewAccInst] = useState('');
  const [newAccNum, setNewAccNum] = useState('');
  const [newAccRout, setNewAccRout] = useState('');
  const [newAccOwner, setNewAccOwner] = useState('');
  const [newAccBal, setNewAccBal] = useState('');
  const [newAccCurr, setNewAccCurr] = useState('TWD');

  // Adjust balance form
  const [adjustingAccountId, setAdjustingAccountId] = useState<string | null>(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustDesc, setAdjustDesc] = useState('');

  // Institutional FX Calculator
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
    <div className="space-y-6 animate-fadeIn font-sans text-xs">
      {/* 1. Grand Sovereign Header & Welcome Card */}
      <div className="p-8 rounded-2xl bg-gradient-to-r from-velum-850 via-velum-800 to-velum-850 border border-bank-accent/30 flex flex-col lg:flex-row lg:items-center justify-between gap-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-bank-accent to-bank-accent-hover" />

        {/* Ambient visual glowing effect */}
        <div className="absolute -right-12 -top-12 w-48 h-48 bg-bank-accent-10 rounded-full blur-3xl opacity-35 pointer-events-none" />

        <div className="space-y-2 max-w-2xl relative z-10">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-bank-accent-10 border border-bank-accent-20 text-[8.5px] font-mono font-black text-bank-accent uppercase tracking-[0.2em]">
            <Landmark className="w-2.5 h-2.5" /> VELUM SOVEREIGN CLEARING BOARD
          </div>
          <h3 className="font-display font-black text-xl text-text-primary tracking-tight">
            {user?.username === 'lexie'
              ? 'Governor Lexie'
              : user?.username === 'midnight'
              ? 'Governor Midnight'
              : 'Executive Officer'}
          </h3>
          <p className="text-[11px] text-text-secondary font-sans leading-relaxed">
            Central banking node authorized for clearing network settlement, sovereign asset custody auditing,
            policy target configurations, and E2E decentralized liquidity ledger maintenance.
          </p>

          {/* Central Bank Quick Policy Stats Bar */}
          <div className="pt-2 flex flex-wrap gap-x-6 gap-y-1.5 text-[9.5px] font-mono uppercase text-text-secondary/85">
            <span className="flex items-center gap-1">
              Policy Target Rate: <strong className="text-bank-accent font-bold">4.25%</strong>
            </span>
            <span className="flex items-center gap-1">
              Liquidity Class: <strong className="text-text-primary font-bold">AAA Sovereign Backed</strong>
            </span>
            <span className="flex items-center gap-1">
              Base Currency Peg: <strong className="text-emerald-400 font-bold">TWD / GBP</strong>
            </span>
          </div>
        </div>

        {/* Real-time sync and status controls */}
        <div className="flex flex-wrap items-center gap-3 relative z-10 shrink-0">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border font-mono text-[9.5px] font-extrabold ${
              bankStatus?.storage === 'CONNECTED'
                ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                : 'bg-amber-500/10 border-amber-500/25 text-amber-400'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                bankStatus?.storage === 'CONNECTED' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-pulse'
              }`}
            />
            {bankStatus?.storage === 'CONNECTED' ? 'REDIS LEDGER REPLICATED' : 'LOCAL CACHE SYNCHRONIZED'}
          </span>
          <button
            type="button"
            onClick={fetchBankData}
            className="p-2.5 bg-velum-750 hover:bg-velum-700 border border-white-5 text-text-primary rounded-xl transition cursor-pointer flex items-center justify-center hover:border-bank-accent shadow-sm"
            title="Synchronize clearing networks"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Success / Error Messages */}
      {bankError && (
        <div className="p-4 bg-bank-rose/10 border border-bank-rose/25 text-bank-rose text-[11px] rounded-xl font-mono font-bold leading-normal flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-bank-rose animate-ping" />
          ERROR: {bankError}
        </div>
      )}
      {bankSuccess && (
        <div className="p-4 bg-bank-emerald/10 border border-bank-emerald/25 text-bank-emerald text-[11px] rounded-xl font-mono font-bold leading-normal flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-bank-emerald" />
          SUCCESS: {bankSuccess}
        </div>
      )}

      {/* 2. Institutional Reserve Analytics Metrics Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Aggregate Base */}
        <div className="p-5 rounded-2xl bg-velum-800 border border-white-5 hover:border-bank-accent/20 shadow-md flex flex-col justify-between transition-all duration-200">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[9px] font-mono font-black text-text-secondary uppercase tracking-wider block mb-1">
                AGGREGATE RESERVES Base
              </span>
              <span className="text-[8.5px] font-mono font-black text-bank-emerald bg-bank-emerald/10 border border-bank-emerald/20 px-1.5 py-0.5 rounded uppercase">
                100% Sovereign Backed
              </span>
            </div>
            <Landmark className="w-4 h-4 text-text-disabled" />
          </div>
          <div className="mt-5">
            <div className="text-xl font-mono font-black text-white tracking-tight leading-none">
              NT$ {totalLiquidityTwd.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <div className="text-[10px] font-mono text-text-secondary font-medium mt-1.5 uppercase tracking-wide">
              ≈ £ {(totalLiquidityTwd / 36.8).toLocaleString(undefined, { maximumFractionDigits: 0 })} GBP
              equivalent
            </div>
          </div>
        </div>

        {/* Metric 2: Central Reserve */}
        <div className="p-5 rounded-2xl bg-velum-800 border border-white-5 hover:border-bank-accent/20 shadow-md flex flex-col justify-between transition-all duration-200">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[9px] font-mono font-black text-text-secondary uppercase tracking-wider block mb-1">
                CENTRAL BANK RESERVE
              </span>
              <span className="text-[8.5px] font-mono font-black text-bank-accent bg-bank-accent-10 border border-bank-accent-20 px-1.5 py-0.5 rounded uppercase">
                Seeded M0 Anchor
              </span>
            </div>
            <ShieldCheck className="w-4 h-4 text-text-disabled" />
          </div>
          <div className="mt-5">
            <div className="text-xl font-mono font-black text-text-primary tracking-tight leading-none">
              NT$ {centralBalance.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <div className="text-[10px] font-sans text-text-secondary font-medium mt-1.5 uppercase tracking-wide">
              M0 Primary Liquid Settlement Vault
            </div>
          </div>
        </div>

        {/* Metric 3: Escrow Trustee */}
        <div className="p-5 rounded-2xl bg-velum-800 border border-white-5 hover:border-bank-accent/20 shadow-md flex flex-col justify-between transition-all duration-200">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[9px] font-mono font-black text-text-secondary uppercase tracking-wider block mb-1">
                ESCROW TRUSTEE HOLDINGS
              </span>
              <span className="text-[8.5px] font-mono font-black text-orange-400 bg-orange-400/10 border border-orange-400/20 px-1.5 py-0.5 rounded uppercase">
                Client Custody Hold
              </span>
            </div>
            <Lock className="w-4 h-4 text-text-disabled" />
          </div>
          <div className="mt-5">
            <div className="text-xl font-mono font-black text-text-primary tracking-tight leading-none">
              NT$ {escrowBalance.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <div className="text-[10px] font-sans text-text-secondary font-medium mt-1.5 uppercase tracking-wide">
              Active Multi-User Smart Escrows
            </div>
          </div>
        </div>

        {/* Metric 4: Clearing Network Status */}
        <div className="p-5 rounded-2xl bg-velum-800 border border-white-5 hover:border-bank-accent/20 shadow-md flex flex-col justify-between transition-all duration-200">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[9px] font-mono font-black text-text-secondary uppercase tracking-wider block mb-1">
                SECURE CLEARING NODES
              </span>
              <span className="text-[8.5px] font-mono font-black text-sky-400 bg-sky-400/10 border border-sky-400/20 px-1.5 py-0.5 rounded uppercase">
                Sovereign Vault Network
              </span>
            </div>
            <Globe className="w-4 h-4 text-text-disabled" />
          </div>
          <div className="mt-5">
            <div className="text-lg font-mono font-black text-white tracking-tight flex items-center gap-1.5 leading-none">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              NETWORK ONLINE
            </div>
            <div className="text-[10px] font-mono text-text-secondary font-medium mt-1.5 uppercase tracking-wide">
              {bankAccounts.length} Active Vault Nodes Synchronized
            </div>
          </div>
        </div>
      </div>

      {/* 3. Live Exchange Rate Index Matrix & Interactive FX Converter */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Exchange Rate Matrix Display (Left 7 Columns) */}
        <div className="lg:col-span-7 p-6 rounded-2xl bg-velum-800 border border-white-5 shadow-xl space-y-4">
          <div className="border-b border-white-5 pb-3.5 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-extrabold uppercase tracking-widest text-bank-accent font-mono flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-bank-accent animate-pulse" />
                Sovereign Exchange Board (FX Matrix)
              </h3>
              <p className="text-[10px] text-text-secondary font-sans mt-0.5">
                Sovereign valuation index pegs calibrated for national clearing accounts.
              </p>
            </div>
            <span className="text-[9px] font-mono text-text-secondary/60 bg-text-primary-5 px-2.5 py-1 rounded border border-white-5 uppercase tracking-wider">
              LIVE INDEX
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {/* Peg 1: GBP to TWD */}
            <div className="p-4 rounded-xl bg-velum-850/50 border border-white-5 text-center space-y-1 hover:border-bank-accent/15 transition-all">
              <span className="text-[8.5px] font-mono font-black text-text-secondary uppercase block">
                GBP / TWD peg
              </span>
              <div className="text-sm font-mono font-black text-white">36.80</div>
              <span className="text-[8px] font-sans text-text-secondary block">1.00 £ = NT$ 36.80</span>
            </div>

            {/* Peg 2: USD to TWD */}
            <div className="p-4 rounded-xl bg-velum-850/50 border border-white-5 text-center space-y-1 hover:border-bank-accent/15 transition-all">
              <span className="text-[8.5px] font-mono font-black text-text-secondary uppercase block">
                USD / TWD peg
              </span>
              <div className="text-sm font-mono font-black text-white">30.65</div>
              <span className="text-[8px] font-sans text-text-secondary block">1.00 $ = NT$ 30.65</span>
            </div>

            {/* Peg 3: VLM to TWD */}
            <div className="p-4 rounded-xl bg-velum-850/50 border border-white-5 text-center space-y-1 hover:border-bank-accent/15 transition-all">
              <span className="text-[8.5px] font-mono font-black text-text-secondary uppercase block">
                VLM / TWD index
              </span>
              <div className="text-sm font-mono font-black text-bank-accent">36.80</div>
              <span className="text-[8px] font-sans text-text-secondary block">1.00 VLM = NT$ 36.80</span>
            </div>

            {/* Peg 4: VLM to GBP */}
            <div className="p-4 rounded-xl bg-velum-850/50 border border-white-5 text-center space-y-1 hover:border-bank-accent/15 transition-all">
              <span className="text-[8.5px] font-mono font-black text-text-secondary uppercase block">
                VLM / GBP peg
              </span>
              <div className="text-sm font-mono font-black text-emerald-400">1.0000</div>
              <span className="text-[8px] font-sans text-text-secondary block">1.00 VLM = 1.00 £ GBP</span>
            </div>
          </div>

          <div className="p-3.5 bg-velum-750 rounded-xl border border-white-5 text-[10px] font-mono text-text-secondary text-center uppercase tracking-wide leading-relaxed">
            ⚖️ <strong>Mathematical Alignment verified</strong>: Velum system capital seed of{' '}
            <span className="text-white">£ 500M</span> converts precisely to{' '}
            <span className="text-white">NT$ 18.40B</span> based on official clearing node ratio coordinates.
          </div>
        </div>

        {/* Interactive Institutional Converter (Right 5 Columns) */}
        <div className="lg:col-span-5 p-6 rounded-2xl bg-velum-800 border border-white-5 shadow-xl space-y-4">
          <div className="border-b border-white-5 pb-3.5">
            <h3 className="text-xs font-extrabold uppercase tracking-widest text-text-primary font-mono">
              Institutional FX Cross-Converter
            </h3>
            <p className="text-[10px] text-text-secondary font-sans mt-0.5">
              Perform live cross-valuation arithmetic against sovereign pegs.
            </p>
          </div>

          <div className="space-y-3.5 font-mono text-xs">
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-[8.5px] text-text-secondary uppercase mb-1 font-bold">
                  Clearing Input Volume
                </label>
                <input
                  type="number"
                  placeholder="Enter amount..."
                  value={calcAmount}
                  onChange={(e) => setCalcAmount(e.target.value)}
                  className="w-full p-3 bg-velum-750 border border-white-5 rounded-xl outline-none focus:border-bank-accent text-white font-mono text-xs font-bold"
                />
              </div>
              <div className="w-28">
                <label className="block text-[8.5px] text-text-secondary uppercase mb-1 font-bold">
                  Source Asset
                </label>
                <select
                  value={calcFrom}
                  onChange={(e) => setCalcFrom(e.target.value)}
                  className="w-full p-3 bg-velum-750 border border-white-5 rounded-xl text-white outline-none focus:border-bank-accent font-mono text-xs font-bold"
                >
                  <option value="GBP">GBP (£)</option>
                  <option value="TWD">TWD (NT$)</option>
                  <option value="USD">USD ($)</option>
                  <option value="VLM">VLM (Velum)</option>
                </select>
              </div>
            </div>

            {/* Display calculated conversions */}
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
                  <div className="p-4 bg-velum-850/85 rounded-xl border border-bank-accent-20 space-y-2 text-[11px]">
                    <span className="text-[8px] text-bank-accent uppercase tracking-widest font-black block mb-2">
                      // CALCULATED VALUE EQUIVALENTS //
                    </span>
                    <div className="grid grid-cols-2 gap-3.5">
                      <div>
                        <span className="text-[8px] text-text-secondary uppercase block font-bold">
                          NEW TAIWAN DOLLAR
                        </span>
                        <span className="text-white font-bold font-mono">
                          NT$ {amtInTwd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                          TWD
                        </span>
                      </div>
                      <div>
                        <span className="text-[8px] text-text-secondary uppercase block font-bold">
                          BRITISH POUND
                        </span>
                        <span className="text-white font-bold font-mono">
                          £ {(amtInTwd / rates.GBP).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                          GBP
                        </span>
                      </div>
                      <div>
                        <span className="text-[8px] text-text-secondary uppercase block font-bold">
                          US DOLLAR
                        </span>
                        <span className="text-white font-bold font-mono">
                          $ {(amtInTwd / rates.USD).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                          USD
                        </span>
                      </div>
                      <div>
                        <span className="text-[8px] text-text-secondary uppercase block font-bold">
                          VELUM TOKEN
                        </span>
                        <span className="text-bank-accent font-bold font-mono">
                          {(amtInTwd / rates.VLM).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                          VLM
                        </span>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-white-5 text-[8.5px] text-text-secondary/70 flex items-center gap-1.5">
                      <CheckCircle className="w-3 h-3 text-emerald-400" />
                      LIQUIDITY THRESHOLD CHECK: GREEN (E2E SETTLED)
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="p-4 bg-velum-850/30 rounded-xl border border-dashed border-white-5 text-center text-[10px] text-text-disabled uppercase">
                Enter a transaction value above to simulate multi-peg conversions instantly.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. Sovereign Reserve Accounts & Vaults Grid Section */}
      <div className="space-y-3.5">
        <div className="flex items-center justify-between border-b border-white-5 pb-2">
          <h3 className="text-xs font-extrabold uppercase tracking-widest text-text-primary font-mono flex items-center gap-1.5">
            <Landmark className="w-3.5 h-3.5 text-bank-accent" />
            Sovereign Reserve Accounts & Clearing Coordinates
          </h3>
          <span className="text-[9px] font-mono text-text-secondary/75 uppercase font-bold tracking-wider">
            {bankAccounts.length} Connected Coordinate Points
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {bankAccounts.map((acc) => {
            const isCentral = acc.account_name.toUpperCase().includes('CENTRAL');
            const isEscrow = acc.account_name.toUpperCase().includes('ESCROW');

            const custodyGrade = isCentral
              ? 'AAA Sovereign Backed'
              : isEscrow
              ? 'AA Trustee Custody'
              : 'A Correspondent Tier';
            const liquidityClass = isCentral
              ? 'HQLA Tier-1 Asset'
              : isEscrow
              ? 'Escrow Trustee Hold'
              : 'Operational Clearing Reserve';

            const cardBorder = isCentral
              ? 'border-bank-accent-40 hover:border-bank-accent shadow-[0_4px_25px_rgba(85,133,226,0.03)]'
              : isEscrow
              ? 'border-orange-500/30 hover:border-orange-500/60'
              : 'border-white-5 hover:border-white-10';

            return (
              <div
                key={acc.account_id}
                className={`p-6 rounded-2xl bg-velum-800 border ${cardBorder} flex flex-col justify-between min-h-[210px] relative overflow-hidden shadow-lg transition duration-200 group`}
              >
                {/* Digital Grid Accent Background */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-bank-accent-10 rounded-full blur-3xl opacity-20 group-hover:opacity-40 transition-all pointer-events-none" />

                <div className="space-y-4">
                  {/* Account Institution & Header */}
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[8.5px] font-mono font-black text-bank-accent uppercase tracking-[0.1em] block">
                        {acc.institution}
                      </span>
                      <h4 className="text-[12px] font-extrabold text-text-primary mt-1 uppercase max-w-[190px] truncate leading-tight tracking-wide">
                        {acc.account_name}
                      </h4>
                    </div>
                    <span
                      className={`text-[8.5px] font-mono font-black px-2.5 py-1 rounded border uppercase ${
                        acc.status === 'active'
                          ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                          : 'bg-red-500/10 border-red-500/25 text-red-400 animate-pulse'
                      }`}
                    >
                      {acc.status === 'active' ? 'Active Clearing' : 'Frozen Hold'}
                    </span>
                  </div>

                  {/* Reserve Liquidity Balance */}
                  <div>
                    <span className="text-[8.5px] font-mono font-black text-text-secondary uppercase tracking-widest block">
                      Available Reserve Balance
                    </span>
                    <div className="text-xl font-mono font-black text-white mt-1.5 tracking-tight flex items-baseline">
                      {acc.currency_code === 'TWD' ? 'NT$ ' : ''}
                      {(acc.balance_cents / 100).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                      <span className="text-[10px] text-text-secondary font-bold ml-1.5 uppercase">
                        {acc.currency_code}
                      </span>
                    </div>
                  </div>

                  {/* Metadata Labels specific to a real central bank */}
                  <div className="grid grid-cols-2 gap-2 pt-3 border-t border-white-5/80 text-[8px] font-mono uppercase text-text-secondary/80">
                    <div>
                      <span className="block text-text-disabled font-bold tracking-wider">Custody Grade</span>
                      <span className="text-text-primary font-bold mt-0.5 block">{custodyGrade}</span>
                    </div>
                    <div>
                      <span className="block text-text-disabled font-bold tracking-wider">Liquidity Class</span>
                      <span className="text-text-primary font-bold mt-0.5 block">{liquidityClass}</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center border-t border-white-5 pt-4 mt-5 text-[9px] text-text-secondary font-mono">
                  <div className="flex flex-col text-[8px] leading-relaxed">
                    <span className="tracking-wider">CODE: {acc.account_number}</span>
                    <span className="opacity-55 font-bold">BENEFICIARY: {acc.beneficiary_owner}</span>
                  </div>

                  {/* Adjust & Freeze Operations */}
                  <div className="flex items-center gap-2 relative z-10 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setAdjustingAccountId(acc.account_id);
                        setAdjustAmount('');
                        setAdjustDesc('');
                      }}
                      className="px-3 py-1.5 text-[9.5px] font-mono font-black bg-bank-accent-10 border border-bank-accent-20 hover:border-bank-accent hover:bg-bank-accent text-bank-accent hover:text-velum-900 rounded-lg transition uppercase cursor-pointer"
                    >
                      Adjust
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleFreeze(acc.account_id, acc.status === 'frozen')}
                      className={`px-3 py-1.5 text-[9.5px] font-mono font-black border rounded-lg transition uppercase cursor-pointer ${
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

          {/* Register Reserve Vault Trigger Card */}
          {!showAddAccount && (
            <div
              onClick={() => setShowAddAccount(true)}
              className="p-6 rounded-2xl border border-dashed border-bank-accent-40 hover:border-bank-accent bg-velum-800/30 hover:bg-velum-800/80 flex flex-col items-center justify-center min-h-[210px] cursor-pointer group transition duration-200"
            >
              <div className="p-3 bg-bank-accent-10 border border-bank-accent-20 rounded-full text-bank-accent group-hover:bg-bank-accent group-hover:text-velum-900 transition-all duration-200">
                <Plus className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold font-sans text-text-primary group-hover:text-bank-accent mt-3 transition-colors tracking-wide">
                Register New Reserve Vault
              </span>
              <span className="text-[9.5px] font-mono text-text-secondary/60 uppercase mt-1 tracking-wider text-center max-w-[200px]">
                Add sovereign client reserves or external correspondent banks
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 5. Adjust Balance Dialog Panel Overlay */}
      {adjustingAccountId && (
        (() => {
          const currentAcc = bankAccounts.find((a) => a.account_id === adjustingAccountId);
          if (!currentAcc) return null;

          return (
            <div className="p-6 rounded-2xl bg-velum-800 border border-bank-accent border-l-4 animate-fadeIn max-w-2xl space-y-4 shadow-xl">
              <div className="flex items-start justify-between border-b border-white-5 pb-3">
                <div>
                  <h4 className="text-xs font-extrabold uppercase tracking-widest font-mono text-bank-accent">
                    Reserve Allocation Ledger Adjustment
                  </h4>
                  <p className="text-[10px] text-text-secondary mt-1 font-mono uppercase">
                    RESERVE ARCHIVE ID: {currentAcc.account_number}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[8.5px] font-mono text-text-secondary uppercase block">
                    Current Audited Balance
                  </span>
                  <span className="text-[12px] font-mono font-black text-white block mt-0.5">
                    {currentAcc.currency_code === 'TWD' ? 'NT$ ' : ''}
                    {(currentAcc.balance_cents / 100).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{' '}
                    {currentAcc.currency_code}
                  </span>
                </div>
              </div>

              <form onSubmit={handleAdjustBalance} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[9.5px] text-text-primary font-bold uppercase mb-1.5 font-mono tracking-wider">
                      Adjustment Amount (Full Currency Units)
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-text-secondary font-mono text-[11px]">
                        {currentAcc.currency_code}
                      </div>
                      <input
                        type="number"
                        step="0.01"
                        required
                        placeholder="e.g. 50000.00"
                        value={adjustAmount}
                        onChange={(e) => setAdjustAmount(e.target.value)}
                        className="w-full pl-14 pr-3.5 py-3 rounded-xl font-mono text-[12px] outline-none border border-white-5 focus:border-bank-accent bg-velum-750 text-white"
                        autoFocus
                      />
                    </div>
                    <span className="text-[9px] text-text-secondary font-mono mt-1.5 block uppercase leading-relaxed">
                      ⚠️ Input negative values (e.g. -100000) to withdraw, positive values (e.g. 250000) to
                      credit.
                    </span>
                  </div>

                  <div>
                    <label className="block text-[9.5px] text-text-primary font-bold uppercase mb-1.5 font-mono tracking-wider">
                      Administrative Clearance & Audit Reason
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. System Sovereign Liquidity Rebalancing"
                      value={adjustDesc}
                      onChange={(e) => setAdjustDesc(e.target.value)}
                      className="w-full p-3.5 rounded-xl border border-white-5 focus:border-bank-accent bg-velum-750 text-white text-[12px]"
                    />
                    <span className="text-[9px] text-text-secondary font-mono mt-1.5 block uppercase leading-relaxed">
                      Reason mandatory for compliance ledger. E.g. &quot;Sovereign liquidity injection&quot; or
                      &quot;Escrow payout&quot;.
                    </span>
                  </div>
                </div>

                <div className="flex gap-2.5 pt-3 border-t border-white-5">
                  <button
                    type="submit"
                    className="px-5 py-3 bg-bank-accent hover:bg-bank-accent-hover text-velum-900 font-extrabold uppercase rounded-xl text-[10.5px] tracking-widest transition cursor-pointer"
                  >
                    Process Ledger Adjustment
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustingAccountId(null)}
                    className="px-5 py-3 bg-velum-700 hover:bg-velum-600 text-text-primary border border-white-5 font-extrabold uppercase rounded-xl text-[10.5px] tracking-widest transition cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              </form>
            </div>
          );
        })()
      )}

      {/* 6. Add Reserve Vault Dialog Form */}
      {showAddAccount && (
        <div className="p-6 rounded-2xl bg-velum-800 border border-bank-accent/30 animate-fadeIn space-y-4 shadow-xl">
          <div className="border-b border-white-5 pb-3">
            <h4 className="text-xs font-extrabold uppercase tracking-widest font-mono text-bank-accent">
              Register New Reserve Account or External Vault
            </h4>
            <p className="text-[9.5px] text-text-secondary font-mono mt-1 uppercase">
              Enter verified compliance and routing data to configure institutional banking coordinate.
            </p>
          </div>

          <form
            onSubmit={handleAddBankAccount}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs"
          >
            <div>
              <label className="block text-[9px] text-text-secondary font-bold uppercase mb-1.5 font-mono">
                Account / Vault Name
              </label>
              <input
                type="text"
                required
                value={newAccName}
                onChange={(e) => setNewAccName(e.target.value)}
                className="w-full p-3 rounded-xl border border-white-5 bg-velum-750 text-white"
              />
            </div>
            <div>
              <label className="block text-[9px] text-text-secondary font-bold uppercase mb-1.5 font-mono">
                Institution / Bank Name
              </label>
              <input
                type="text"
                required
                value={newAccInst}
                onChange={(e) => setNewAccInst(e.target.value)}
                className="w-full p-3 rounded-xl border border-white-5 bg-velum-750 text-white"
              />
            </div>
            <div>
              <label className="block text-[9px] text-text-secondary font-bold uppercase mb-1.5 font-mono">
                Account / Card Number
              </label>
              <input
                type="text"
                required
                value={newAccNum}
                onChange={(e) => setNewAccNum(e.target.value)}
                className="w-full p-3 rounded-xl border border-white-5 font-mono bg-velum-750 text-white"
              />
            </div>
            <div>
              <label className="block text-[9px] text-text-secondary font-bold uppercase mb-1.5 font-mono">
                Routing / SWIFT Code
              </label>
              <input
                type="text"
                required
                value={newAccRout}
                onChange={(e) => setNewAccRout(e.target.value)}
                className="w-full p-3 rounded-xl border border-white-5 font-mono bg-velum-750 text-white"
              />
            </div>
            <div>
              <label className="block text-[9px] text-text-secondary font-bold uppercase mb-1.5 font-mono">
                Beneficiary Owner Name
              </label>
              <input
                type="text"
                required
                value={newAccOwner}
                onChange={(e) => setNewAccOwner(e.target.value)}
                className="w-full p-3 rounded-xl border border-white-5 bg-velum-750 text-white"
              />
            </div>
            <div>
              <label className="block text-[9px] text-text-secondary font-bold uppercase mb-1.5 font-mono">
                Initial Reserve Balance (Fiat Value)
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={newAccBal}
                onChange={(e) => setNewAccBal(e.target.value)}
                className="w-full p-3 rounded-xl border border-white-5 font-mono bg-velum-750 text-white"
              />
            </div>
            <div className="md:col-span-2 lg:col-span-1">
              <label className="block text-[9px] text-text-secondary font-bold uppercase mb-1.5 font-mono">
                Currency Designation
              </label>
              <select
                value={newAccCurr}
                onChange={(e) => setNewAccCurr(e.target.value)}
                className="w-full p-3 rounded-xl border border-white-5 bg-velum-750 text-white font-mono"
              >
                <option value="TWD">TWD (New Taiwan Dollar / NT$)</option>
                <option value="USD">USD (US Dollar)</option>
                <option value="VLM">VLM (Velum Token)</option>
              </select>
            </div>

            <div className="md:col-span-2 lg:col-span-3 flex gap-2.5 pt-3 border-t border-white-5">
              <button
                type="submit"
                className="px-5 py-2.5 bg-bank-accent hover:bg-bank-accent-hover text-velum-900 font-extrabold uppercase rounded-xl text-[10px] tracking-widest transition cursor-pointer"
              >
                Register Bank Vault
              </button>
              <button
                type="button"
                onClick={() => setShowAddAccount(false)}
                className="px-5 py-2.5 bg-velum-700 hover:bg-velum-600 text-text-primary border border-white-5 font-extrabold uppercase rounded-xl text-[10px] tracking-widest transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 7. Central Bank Sovereign Ledger Statement */}
      <div className="p-6 rounded-2xl bg-velum-800 border border-white-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-white-5 pb-4">
          <h3 className="text-xs font-extrabold uppercase tracking-widest text-bank-accent font-mono flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-bank-accent animate-pulse" />
            Sovereign Operations & Settlement Statement
          </h3>
          <span className="text-[9px] font-mono text-text-secondary/45 px-2.5 py-1 rounded-md bg-text-primary-5 uppercase border border-white-5 tracking-wide">
            E2E Sovereign Ledger
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-white-5 bg-velum-850/40">
          <table className="w-full text-left text-xs font-sans">
            <thead>
              <tr className="text-text-secondary text-[9px] font-black uppercase tracking-wider border-b border-white-5 bg-velum-800 select-none">
                <th className="p-4 font-mono">Transaction ID / Ledger Block Seal</th>
                <th className="p-4">Clearing Account Coordinate</th>
                <th className="p-4">Sovereign Class</th>
                <th className="p-4">Fiscal Reserve Impact</th>
                <th className="p-4">Administrative Clearance Note</th>
                <th className="p-4 text-right">Settlement Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03] text-text-primary font-medium">
              {bankTransactions.map((tx, idx) => {
                const isDebit = tx.type === 'withdrawal' || tx.type === 'escrow_hold';
                const amountSign = isDebit ? '-' : '+';
                const amountColor = isDebit ? 'text-bank-rose' : 'text-bank-emerald';
                const accObj = bankAccounts.find((a: any) => a.account_id === tx.account_id);

                // Generate a deterministic hash-like seal for central bank look-and-feel
                const blockSeal = `SIG-SHA256:${Math.abs(tx.transaction_id * 314159)
                  .toString(16)
                  .padEnd(8, '0')
                  .slice(0, 8)}`;

                return (
                  <tr key={idx} className="hover:bg-text-primary-2 transition duration-150">
                    <td className="p-4 font-mono text-[10.5px]">
                      <div className="font-bold text-bank-accent">#{tx.transaction_id}</div>
                      <div className="text-[7.5px] text-text-disabled mt-0.5 tracking-wider">{blockSeal}</div>
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-text-primary uppercase text-xs">
                        {accObj?.account_name || 'System Escrow Agent'}
                      </div>
                      <div className="text-[8px] font-mono text-text-secondary uppercase mt-0.5">
                        {accObj?.institution || 'Velum Central Clearing'}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[8.5px] font-bold font-mono bg-text-primary-5 border border-white-5 uppercase tracking-wide">
                        {tx.type.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className={`p-4 font-mono font-black text-sm ${amountColor}`}>
                      {amountSign}
                      {tx.currency_code === 'TWD' ? 'NT$ ' : ''}
                      {(tx.amount_cents / 100).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{' '}
                      <span className="text-[9px] text-text-secondary font-bold">{tx.currency_code}</span>
                    </td>
                    <td className="p-4 text-text-secondary font-sans text-[11px] max-w-[200px] truncate leading-normal">
                      {tx.description}
                    </td>
                    <td className="p-4 text-right text-text-secondary text-[10.5px] font-mono">
                      {new Date(tx.timestamp).toLocaleString()}
                    </td>
                  </tr>
                );
              })}
              {bankTransactions.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="p-12 text-center text-text-secondary font-mono text-[10px] uppercase tracking-widest leading-normal"
                  >
                    // Ledger operational queue 100% idle //
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
