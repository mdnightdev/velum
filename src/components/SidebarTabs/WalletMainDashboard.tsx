import React, { useState, useEffect } from 'react';
import { Wallet, RefreshCw, ArrowRightLeft, ShieldCheck, Activity, CreditCard, Download, Upload, Trash2, ArrowRight } from 'lucide-react';

interface WalletMainDashboardProps {
  currentUserId: number;
  isDark?: boolean;
}

export default function WalletMainDashboard({ currentUserId, isDark = true }: WalletMainDashboardProps) {
  const [activeTab, setActiveTab] = useState<'exchange' | 'funding'>('exchange');
  const [balances, setBalances] = useState<any[]>([]);
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [rates, setRates] = useState<any[]>([]);
  
  // KYC & Methods
  const [kyc, setKyc] = useState<any>(null);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  
  // Preferred conversion currency for the hero card (defaults to New Taiwan Dollar NT$)
  const [preferredFiat, setPreferredFiat] = useState('TWD');

  // Exchange Form State
  const [exchangeFrom, setExchangeFrom] = useState('TWD');
  const [exchangeTo, setExchangeTo] = useState('VLM');
  const [exchangeAmount, setExchangeAmount] = useState('');
  const [exchangeError, setExchangeError] = useState('');
  const [exchangeSuccess, setExchangeSuccess] = useState('');

  // Forms
  const [kycName, setKycName] = useState('');
  const [kycDoc, setKycDoc] = useState('PASSPORT_SIM');
  
  const [newMethodType, setNewMethodType] = useState('CARD');
  const [newMethodIssuer, setNewMethodIssuer] = useState('Visa');
  const [newMethodNumber, setNewMethodNumber] = useState('');
  
  const [fundingType, setFundingType] = useState<'RECHARGE'|'WITHDRAW'>('RECHARGE');
  const [fundingAmount, setFundingAmount] = useState('');
  const [fundingMethod, setFundingMethod] = useState('');
  const [fundingMsg, setFundingMsg] = useState('');
  
  const loadData = async () => {
    try {
      const sId = sessionStorage.getItem('velum-sessionId');
      const headers = { 'Authorization': `Bearer ${sId}` };
      
      const [balRes, curRes, ratesRes, walletRes, methodsRes] = await Promise.all([
        fetch('/api/payments/balances', { headers }),
        fetch('/api/payments/currencies', { headers }),
        fetch('/api/payments/rates', { headers }),
        fetch('/api/payments/wallet', { headers }),
        fetch('/api/payments/methods', { headers })
      ]);
      
      if (balRes.ok) setBalances(await balRes.json());
      if (curRes.ok) setCurrencies(await curRes.json());
      if (ratesRes.ok) setRates(await ratesRes.json());
      if (walletRes.ok) {
        const data = await walletRes.json();
        setKyc(data.kyc);
      }
      if (methodsRes.ok) setPaymentMethods(await methodsRes.json());
    } catch (e) {
      console.error('Failed to load financial secure enclave data', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleExchange = async (e: React.FormEvent) => {
    e.preventDefault();
    setExchangeError(''); setExchangeSuccess('');
    if (!exchangeFrom || !exchangeTo || !exchangeAmount) {
      setExchangeError('Please fill all fields'); return;
    }
    if (exchangeFrom === exchangeTo) {
      setExchangeError('Source and target currencies must differ'); return;
    }
    try {
      const sId = sessionStorage.getItem('velum-sessionId');
      const res = await fetch('/api/payments/exchange', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${sId}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromCurrency: exchangeFrom,
          toCurrency: exchangeTo,
          amountCents: Math.floor(parseFloat(exchangeAmount) * 100)
        })
      });
      const data = await res.json();
      if (!res.ok) setExchangeError(data.error || 'Exchange failed');
      else {
        setExchangeSuccess(`Successfully exchanged! Rate: 1 ${exchangeFrom} = ${data.rate_used} ${exchangeTo}`);
        loadData(); setExchangeAmount('');
      }
    } catch (e) { setExchangeError('Network error during exchange'); }
  };

  const handleKycSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const sId = sessionStorage.getItem('velum-sessionId');
      const res = await fetch('/api/payments/kyc', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${sId}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ submittedName: kycName, submittedDocumentType: kycDoc })
      });
      if (res.ok) { loadData(); }
    } catch (e) { console.error(e); }
  };

  const handleAddMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const sId = sessionStorage.getItem('velum-sessionId');
      const res = await fetch('/api/payments/methods', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${sId}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ methodType: newMethodType, simulatedInstitution: newMethodIssuer, maskedNumber: newMethodNumber })
      });
      if (res.ok) { loadData(); setNewMethodNumber(''); }
    } catch (e) { console.error(e); }
  };
  
  const handleRemoveMethod = async (methodId: string) => {
    try {
      const sId = sessionStorage.getItem('velum-sessionId');
      const res = await fetch(`/api/payments/methods/${methodId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${sId}` }
      });
      if (res.ok) { loadData(); }
    } catch (e) { console.error(e); }
  };

  const handleFunding = async (e: React.FormEvent) => {
    e.preventDefault();
    setFundingMsg('');
    try {
      const sId = sessionStorage.getItem('velum-sessionId');
      const endpoint = fundingType === 'RECHARGE' ? '/api/payments/recharge' : '/api/payments/withdraw';
      const bodyPayload: any = { amount_cents: Math.floor(parseFloat(fundingAmount) * 100) };
      if (fundingType === 'RECHARGE') bodyPayload.payment_method_id = fundingMethod;
      else bodyPayload.payout_method_id = fundingMethod;
      
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${sId}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload)
      });
      const data = await res.json();
      if (!res.ok) setFundingMsg(`Error: ${data.error}`);
      else { setFundingMsg(`Success! Status: ${data.status}`); loadData(); setFundingAmount(''); }
    } catch (e) { setFundingMsg('Network error'); }
  };

  // Helper: Quick-fill Stripe test credentials
  const fillTestCredentials = (type: 'VISA' | 'MC' | 'AMEX' | 'BANK') => {
    if (type === 'VISA') {
      setNewMethodType('CARD');
      setNewMethodIssuer('Visa');
      setNewMethodNumber('4222 2222 2222 4242');
    } else if (type === 'MC') {
      setNewMethodType('CARD');
      setNewMethodIssuer('Mastercard');
      setNewMethodNumber('5105 1051 0510 5105');
    } else if (type === 'AMEX') {
      setNewMethodType('CARD');
      setNewMethodIssuer('American Express');
      setNewMethodNumber('3782 8224 6310 005');
    } else if (type === 'BANK') {
      setNewMethodType('BANK_ACCOUNT');
      setNewMethodIssuer('Taiwan Cooperative Bank');
      setNewMethodNumber('7000 0012 3456 7890');
    }
  };

  // Calculate live dynamic FX preview
  const getLivePreview = () => {
    if (!exchangeFrom || !exchangeTo || !exchangeAmount) return null;
    const amountVal = parseFloat(exchangeAmount);
    if (isNaN(amountVal) || amountVal <= 0) return null;

    const rateObj = rates.find(r => r.base_currency === exchangeFrom && r.quote_currency === exchangeTo);
    if (!rateObj) return null;

    const rate = parseFloat(rateObj.rate);
    const grossConverted = amountVal * rate;
    const spreadPct = 0.015; // 1.5% platform spread
    const spreadCents = grossConverted * spreadPct;
    const netConverted = grossConverted - spreadCents;

    return {
      gross: grossConverted.toFixed(4),
      net: netConverted.toFixed(2),
      rate: rate.toFixed(4),
      spread: spreadCents.toFixed(4)
    };
  };

  // Extract VLM (native Token) Balance
  const vlmBalanceObj = balances.find(b => b.currency_code === 'VLM');
  const vlmCents = vlmBalanceObj ? vlmBalanceObj.balance_cents : 0;
  const vlmTokens = vlmCents / 100;

  // Extract dynamic preferred fiat currency rate (VLM to preferredFiat)
  const vlmToFiatRateObj = rates.find(r => r.base_currency === 'VLM' && r.quote_currency === preferredFiat);
  const vlmToFiatRate = vlmToFiatRateObj ? parseFloat(vlmToFiatRateObj.rate) : 1;
  const preferredFiatEquivalent = vlmTokens * vlmToFiatRate;

  // Filter out currencies with zero balance to clean up clutter (except VLM and preferredFiat)
  const activeBalances = balances.filter(b => {
    if (b.currency_code === 'VLM' || b.currency_code === preferredFiat) return true;
    return b.balance_cents > 0;
  });

  const preview = getLivePreview();

  return (
    <div id="wallet_dashboard" className="flex-1 bg-transparent p-6 lg:p-8 pb-24 lg:pb-8 space-y-6 select-none font-sans">
      
      {/* Page Header */}
      <div className="flex justify-between items-center border-b border-white-5 pb-4">
        <div>
          <h1 className="text-xs font-semibold uppercase tracking-widest text-text-primary">Multi-Currency Wallet</h1>
          <p className="text-[10px] text-text-secondary font-mono mt-0.5">SECURE ENCLAVE BALANCES & EXCHANGE</p>
        </div>
        <div className="flex bg-velum-800 rounded p-1">
          <button onClick={() => setActiveTab('exchange')} className={`px-4 py-1.5 text-[10px] font-bold tracking-wider font-mono uppercase rounded transition ${activeTab === 'exchange' ? 'bg-white-10 text-white' : 'text-text-secondary hover:text-white'}`}>Balances</button>
          <button onClick={() => setActiveTab('funding')} className={`px-4 py-1.5 text-[10px] font-bold tracking-wider font-mono uppercase rounded transition ${activeTab === 'funding' ? 'bg-white-10 text-white' : 'text-text-secondary hover:text-white'}`}>Identity & Funding</button>
        </div>
      </div>

      {activeTab === 'exchange' && (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Balances & Dynamic FX feeds */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Hero Premium Unified Balance Card */}
          <div className="glass-card relative overflow-hidden p-6 shadow-xl flex flex-col justify-between h-[180px] group">
            {/* Background glowing circle */}
            <div className="absolute top-[-50px] right-[-50px] w-40 h-40 rounded-full bg-accent/5 blur-3xl pointer-events-none group-hover:bg-accent/10 transition-all duration-500" />
            
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[9px] font-bold font-mono text-accent uppercase tracking-widest flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                  Primary Vault Ledger
                </span>
                <div className="text-3xl font-mono font-black text-white mt-2">
                  {vlmTokens.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-sm font-semibold text-text-secondary">VLM</span>
                </div>
              </div>

              {/* Currency Equivalent Selector (TWD default) */}
              <div className="flex flex-col items-end">
                <span className="text-[9px] font-bold font-mono text-text-secondary uppercase">Local Equivalent</span>
                <select 
                  value={preferredFiat}
                  onChange={(e) => setPreferredFiat(e.target.value)}
                  className="bg-velum-900/60 border border-white-10 rounded px-2 py-1 text-[10px] font-bold text-white mt-1.5 outline-none hover:border-accent cursor-pointer"
                >
                  {currencies.filter(c => !c.is_platform_native).map(c => (
                    <option key={c.currency_code} value={c.currency_code}>
                      {c.currency_code} ({c.currency_code === 'TWD' ? 'NT$' : c.currency_code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Equivalent calculation block */}
            <div className="border-t border-white-5 pt-4 flex justify-between items-center">
              <div>
                <div className="text-[10px] font-bold font-mono text-text-secondary uppercase">Estimated Cash Equivalent</div>
                <div className="text-lg font-mono font-bold text-white mt-0.5">
                  {preferredFiat === 'TWD' ? 'NT$ ' : ''}
                  {preferredFiatEquivalent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  {` ${preferredFiat}`}
                </div>
              </div>
              <div className="text-right text-[10px] font-mono text-text-secondary">
                1 VLM = {vlmToFiatRate.toFixed(4)} {preferredFiat}
              </div>
            </div>
          </div>

          {/* Cleaned Account Balances List (Hides zeroes to avoid clutter) */}
          <div className="glass-card p-5 space-y-4 shadow-md">
            <div className="flex justify-between items-center">
              <h3 className="text-[10px] uppercase tracking-wider font-bold text-accent font-mono flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-accent" />
                <span>Active Ledger Balances</span>
              </h3>
              <span className="text-[9px] text-text-secondary font-mono bg-text-primary-5 px-2 py-0.5 rounded uppercase">Zero-Balances Hidden</span>
            </div>
            
            {loading ? (
              <div className="text-[10px] text-text-secondary font-mono animate-pulse">Accessing secure enclave balances...</div>
            ) : activeBalances.length === 0 ? (
              <div className="text-[10px] text-text-secondary font-mono py-2">// Secure asset ledger 100% empty //</div>
            ) : (
              <div className="space-y-2.5">
                {activeBalances.map(b => {
                  const curr = currencies.find(c => c.currency_code === b.currency_code);
                  const isNative = b.currency_code === 'VLM';
                  return (
                    <div key={b.currency_code} className="flex justify-between items-center p-3 bg-velum-900/40 border border-white-5 rounded-xl hover:border-white-10 transition duration-150">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${isNative ? 'bg-accent/10 text-accent' : 'bg-white-5 text-text-secondary'}`}>
                          {b.currency_code.substring(0, 3)}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white">{curr ? curr.display_name : b.currency_code}</div>
                          <div className="text-[9px] text-text-secondary font-mono tracking-wider">
                            {isNative ? 'SECURE BLOCKCHAIN ASSET' : 'LOCAL BANK RESERVES'}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-mono font-black text-white">
                          {b.currency_code === 'TWD' ? 'NT$ ' : ''}
                          {(b.balance_cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          <span className="text-[10px] text-text-secondary font-bold ml-1">{b.currency_code}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          
          {/* Live Exchange Rate Feeds */}
          <div className="glass-card p-5 space-y-3.5 shadow-md">
            <h3 className="text-[10px] uppercase tracking-wider font-bold text-accent font-mono flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-accent" />
              <span>Real-Time FX Feeds</span>
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {rates.filter(r => r.base_currency === 'VLM' || r.quote_currency === 'VLM' || r.base_currency === 'TWD' || r.quote_currency === 'TWD').slice(0, 6).map(r => (
                <div key={r.rate_id} className="p-2.5 bg-velum-900/40 border border-white-5 rounded-xl flex flex-col justify-between h-[52px]">
                  <div className="text-[9px] font-bold text-text-secondary font-mono tracking-wider">{r.base_currency} → {r.quote_currency}</div>
                  <div className="text-xs font-mono font-bold text-accent mt-1 flex justify-between items-center">
                    <span>{parseFloat(r.rate).toFixed(4)}</span>
                    <span className="text-[8px] text-status-online uppercase bg-emerald-400/10 px-1 rounded">FEED</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Clean Exchange Form */}
        <form onSubmit={handleExchange} className="glass-card lg:col-span-5 p-5 space-y-4 shadow-xl">
          <h3 className="text-[10px] uppercase tracking-wider font-bold text-accent font-mono flex items-center gap-1.5">
            <ArrowRightLeft className="w-3.5 h-3.5 text-accent" />
            <span>Instant FX Exchange</span>
          </h3>
          
          {exchangeError && (
            <div className="text-[10px] text-red-400 bg-red-400/10 p-2 rounded border border-red-400/20 font-mono">
              {exchangeError}
            </div>
          )}
          {exchangeSuccess && (
            <div className="text-[10px] text-emerald-400 bg-emerald-400/10 p-2 rounded border border-emerald-400/20 font-mono">
              {exchangeSuccess}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-[9px] uppercase tracking-wider font-bold text-text-secondary font-mono">
              Source Asset
            </label>
            <select
              value={exchangeFrom}
              onChange={(e) => setExchangeFrom(e.target.value)}
              className="w-full bg-velum-900 border border-white-10 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-accent"
              required
            >
              {currencies.filter(c => c.active).map(c => (
                <option key={c.currency_code} value={c.currency_code}>{c.currency_code} ({c.display_name})</option>
              ))}
            </select>
          </div>
          
          <div className="space-y-1.5">
            <label className="block text-[9px] uppercase tracking-wider font-bold text-text-secondary font-mono">
              Destination Asset
            </label>
            <select
              value={exchangeTo}
              onChange={(e) => setExchangeTo(e.target.value)}
              className="w-full bg-velum-900 border border-white-10 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-accent"
              required
            >
              {currencies.filter(c => c.active).map(c => (
                <option key={c.currency_code} value={c.currency_code}>{c.currency_code} ({c.display_name})</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[9px] uppercase tracking-wider font-bold text-text-secondary font-mono">
              Amount to Sell
            </label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={exchangeAmount}
              onChange={(e) => setExchangeAmount(e.target.value)}
              placeholder="0.00"
              required
              className="w-full bg-velum-900 border border-white-10 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-accent placeholder:text-white-10 font-mono font-bold"
            />
          </div>

          {/* Dynamic Interactive FX Preview */}
          {preview && (
            <div className="bg-velum-900/50 border border-white-5 rounded-xl p-3.5 space-y-1.5 font-mono text-[10px] text-text-secondary">
              <div className="flex justify-between items-center text-white font-bold">
                <span>FX Conversion Estimate</span>
                <span className="text-accent">1 {exchangeFrom} = {preview.rate} {exchangeTo}</span>
              </div>
              <div className="flex justify-between items-center border-t border-white-5 pt-1.5 mt-1.5">
                <span>Gross Value:</span>
                <span>{preview.gross} {exchangeTo}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Spread Fee (1.5%):</span>
                <span>-{preview.spread} {exchangeTo}</span>
              </div>
              <div className="flex justify-between items-center text-white font-black pt-1 border-t border-dashed border-white-5 text-xs">
                <span>Net Credited:</span>
                <span className="text-status-online">{preview.net} {exchangeTo}</span>
              </div>
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-accent hover:bg-accent-hover text-velum-900 text-[10px] font-extrabold uppercase py-3 rounded-xl transition font-sans tracking-wider mt-2 flex items-center justify-center gap-2 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Execute Exchange
          </button>
        </form>
      </div>
      )}
      
      {activeTab === 'funding' && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        
        {/* Left Column: KYC and saved Methods */}
        <div className="space-y-6">
          
          {/* Identity Verification (KYC) */}
          <div className="glass-card p-5 space-y-4 shadow-md">
            <h3 className="text-[10px] uppercase tracking-wider font-bold text-accent font-mono flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-accent" />
              <span>Identity Verification (KYC)</span>
            </h3>
            {kyc ? (
              <div className="p-4 bg-velum-900/40 border border-white-5 rounded-xl space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">Status</span>
                  <span className={`text-[9px] font-bold font-mono px-2 py-0.5 rounded-full ${kyc.status === 'VERIFIED' ? 'bg-emerald-400/10 text-emerald-400 border border-emerald-400/20' : 'bg-yellow-400/10 text-yellow-400 border border-yellow-400/20'}`}>
                    {kyc.status}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1.5 border-t border-white-5">
                  <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">Verification Level</span>
                  <span className="text-[10px] font-mono font-bold text-white uppercase">{kyc.verification_level}</span>
                </div>
              </div>
            ) : (
              <form onSubmit={handleKycSubmit} className="space-y-3 p-4 bg-velum-900/40 border border-white-5 rounded-xl">
                <input type="text" placeholder="Full Legal Name" required value={kycName} onChange={e => setKycName(e.target.value)} className="w-full bg-velum-800 border border-white-10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-accent" />
                <select value={kycDoc} onChange={e => setKycDoc(e.target.value)} className="w-full bg-velum-800 border border-white-10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-accent">
                  <option value="PASSPORT_SIM">Passport</option>
                  <option value="DRIVERS_LICENSE_SIM">Driver's License</option>
                  <option value="NATIONAL_ID_SIM">National ID</option>
                </select>
                <button type="submit" className="w-full bg-accent hover:bg-accent-hover text-velum-900 text-[10px] font-extrabold uppercase py-2.5 rounded-xl transition cursor-pointer">Submit Identity Data</button>
              </form>
            )}
          </div>
          
          {/* Saved Payment Methods */}
          <div className="glass-card p-5 space-y-4 shadow-md">
            <h3 className="text-[10px] uppercase tracking-wider font-bold text-accent font-mono flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-accent" />
              <span>Saved Accounts / Cards</span>
            </h3>

            {/* Quick-fill mock credentials (Stripe style) */}
            <div className="bg-velum-900/50 border border-white-5 rounded-xl p-3 space-y-2">
              <span className="text-[8px] font-bold font-mono text-text-secondary uppercase tracking-wider">Stripe-style Quick Fill Credentials</span>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => fillTestCredentials('VISA')} className="px-2 py-1.5 bg-white-5 hover:bg-white-10 text-[9px] font-mono text-white rounded transition border border-white-5 text-left">
                   Visa (4222)
                </button>
                <button type="button" onClick={() => fillTestCredentials('MC')} className="px-2 py-1.5 bg-white-5 hover:bg-white-10 text-[9px] font-mono text-white rounded transition border border-white-5 text-left">
                   Mastercard (5105)
                </button>
                <button type="button" onClick={() => fillTestCredentials('AMEX')} className="px-2 py-1.5 bg-white-5 hover:bg-white-10 text-[9px] font-mono text-white rounded transition border border-white-5 text-left">
                   Amex (3782)
                </button>
                <button type="button" onClick={() => fillTestCredentials('BANK')} className="px-2 py-1.5 bg-white-5 hover:bg-white-10 text-[9px] font-mono text-white rounded transition border border-white-5 text-left">
                   TCB Bank (7000)
                </button>
              </div>
            </div>

            {paymentMethods.length > 0 ? (
              <div className="space-y-2">
                {paymentMethods.map(m => (
                  <div key={m.payment_method_id} className="flex justify-between items-center p-3 bg-velum-900/40 border border-white-5 rounded-xl">
                    <div>
                      <div className="text-xs font-bold text-white">{m.display_label}</div>
                      <div className="text-[9px] text-text-secondary font-mono tracking-wider">{m.method_type} METHOD</div>
                    </div>
                    <button onClick={() => handleRemoveMethod(m.payment_method_id)} className="p-1.5 hover:bg-red-500/10 text-red-400 rounded-lg transition cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[10px] text-text-secondary font-mono">No financial methods registered.</div>
            )}

            <form onSubmit={handleAddMethod} className="pt-3 border-t border-white-5 space-y-2.5">
              <div className="flex gap-2">
                <select value={newMethodType} onChange={e => { setNewMethodType(e.target.value); setNewMethodIssuer(e.target.value === 'CARD' ? 'Visa' : 'Taiwan Cooperative Bank'); }} className="bg-velum-900 border border-white-10 rounded-xl px-2.5 py-2 text-xs text-white outline-none">
                  <option value="CARD">Card</option>
                  <option value="BANK_ACCOUNT">Bank Account</option>
                </select>
                <select value={newMethodIssuer} onChange={e => setNewMethodIssuer(e.target.value)} className="bg-velum-900 border border-white-10 rounded-xl px-2.5 py-2 text-xs text-white outline-none flex-1">
                  {newMethodType === 'CARD' ? (
                    <>
                      <option value="Visa">Visa</option>
                      <option value="Mastercard">Mastercard</option>
                      <option value="American Express">American Express</option>
                      <option value="Discover">Discover</option>
                    </>
                  ) : (
                    <>
                      <option value="Taiwan Cooperative Bank">Taiwan Cooperative Bank</option>
                      <option value="Chase Bank">Chase Bank</option>
                      <option value="Wells Fargo">Wells Fargo</option>
                      <option value="Bank of America">Bank of America</option>
                      <option value="Citibank">Citibank</option>
                    </>
                  )}
                </select>
              </div>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder={newMethodType === 'CARD' ? 'Simulate 16-digit Card Number' : 'Simulate 16-digit Bank Account'} 
                  required 
                  value={newMethodNumber} 
                  onChange={e => setNewMethodNumber(e.target.value)} 
                  className="flex-1 bg-velum-900 border border-white-10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-accent font-mono font-bold" 
                />
                <button type="submit" className="bg-accent hover:bg-accent-hover text-velum-900 text-[10px] font-extrabold uppercase px-4 rounded-xl transition cursor-pointer">Register</button>
              </div>
            </form>
          </div>
        </div>
        
        {/* Right Column: Funding Operations */}
        <div className="glass-card p-5 space-y-4 shadow-md">
          <h3 className="text-[10px] uppercase tracking-wider font-bold text-accent font-mono flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-accent" />
            <span>Fund Allocation Operations</span>
          </h3>
          <div className="flex bg-velum-900 rounded-xl p-1 mb-4 border border-white-5">
            <button onClick={() => setFundingType('RECHARGE')} className={`flex-1 py-2 text-[10px] font-bold tracking-wider uppercase rounded-lg flex justify-center items-center gap-1.5 transition ${fundingType === 'RECHARGE' ? 'bg-white-10 text-white' : 'text-text-secondary'}`}><Download className="w-3.5 h-3.5"/> Deposit / Recharge</button>
            <button onClick={() => setFundingType('WITHDRAW')} className={`flex-1 py-2 text-[10px] font-bold tracking-wider uppercase rounded-lg flex justify-center items-center gap-1.5 transition ${fundingType === 'WITHDRAW' ? 'bg-white-10 text-white' : 'text-text-secondary'}`}><Upload className="w-3.5 h-3.5"/> Payout / Withdraw</button>
          </div>
          
          {fundingMsg && <div className="text-[10px] text-accent bg-accent/10 p-2.5 rounded-xl border border-accent/20 font-mono mb-4">{fundingMsg}</div>}
          
          <form onSubmit={handleFunding} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-[9px] uppercase tracking-wider font-bold text-text-secondary font-mono">Amount (USD)</label>
              <input type="number" min="0.01" step="0.01" value={fundingAmount} onChange={e => setFundingAmount(e.target.value)} placeholder="0.00" required className="w-full bg-velum-900 border border-white-10 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-accent font-mono font-bold" />
            </div>
            <div className="space-y-1.5">
              <label className="block text-[9px] uppercase tracking-wider font-bold text-text-secondary font-mono">Selected Method Source</label>
              <select value={fundingMethod} onChange={e => setFundingMethod(e.target.value)} required className="w-full bg-velum-900 border border-white-10 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-accent cursor-pointer">
                <option value="">Select registered method...</option>
                {paymentMethods.map(m => <option key={m.payment_method_id} value={m.payment_method_id}>{m.display_label}</option>)}
              </select>
            </div>
            <button type="submit" className="w-full bg-accent hover:bg-accent-hover text-velum-900 text-[10px] font-extrabold uppercase py-3 rounded-xl transition tracking-wider font-bold cursor-pointer">
              {fundingType === 'RECHARGE' ? 'Authorize Secure Deposit' : 'Request Secure Withdrawal'}
            </button>
            {fundingType === 'WITHDRAW' && <p className="text-[9px] text-text-secondary text-center mt-2 font-mono uppercase tracking-wide">Requires full verified KYC level. Withdrawals subject to admin review.</p>}
          </form>
        </div>
      </div>
      )}
    </div>
  );
}
