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

  // Securely format insanely huge numbers so they stay clean on compact devices
  const formatValue = (value: number) => {
    if (value === 0 || isNaN(value)) return '0.00';
    const absVal = Math.abs(value);
    if (absVal >= 1e27) return `${(value / 1e27).toFixed(2)} Octillion`;
    if (absVal >= 1e24) return `${(value / 1e24).toFixed(2)} Septillion`;
    if (absVal >= 1e21) return `${(value / 1e21).toFixed(2)} Sextillion`;
    if (absVal >= 1e18) return `${(value / 1e18).toFixed(2)} Quintillion`;
    if (absVal >= 1e15) return `${(value / 1e15).toFixed(2)} Quadrillion`;
    if (absVal >= 1e12) return `${(value / 1e12).toFixed(2)} Trillion`;
    if (absVal >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
    if (absVal >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
    return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

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

  const getLivePreview = () => {
    if (!exchangeFrom || !exchangeTo || !exchangeAmount) return null;
    const amountVal = parseFloat(exchangeAmount);
    if (isNaN(amountVal) || amountVal <= 0) return null;

    const rateObj = rates.find(r => r.base_currency === exchangeFrom && r.quote_currency === exchangeTo);
    if (!rateObj) return null;

    const rate = parseFloat(rateObj.rate);
    const grossConverted = amountVal * rate;
    const spreadPct = 0.015;
    const spreadCents = grossConverted * spreadPct;
    const netConverted = grossConverted - spreadCents;

    return {
      gross: formatValue(grossConverted * 100 / 100),
      net: formatValue(netConverted * 100 / 100),
      rate: rate.toFixed(4),
      spread: formatValue(spreadCents * 100 / 100)
    };
  };

  const vlmBalanceObj = balances.find(b => b.currency_code === 'VLM');
  const vlmCents = vlmBalanceObj ? vlmBalanceObj.balance_cents : 0;
  const vlmTokens = vlmCents / 100;

  const vlmToFiatRateObj = rates.find(r => r.base_currency === 'VLM' && r.quote_currency === preferredFiat);
  const vlmToFiatRate = vlmToFiatRateObj ? parseFloat(vlmToFiatRateObj.rate) : 1;
  const preferredFiatEquivalent = vlmTokens * vlmToFiatRate;

  const activeBalances = balances.filter(b => {
    if (b.currency_code === 'VLM' || b.currency_code === preferredFiat) return true;
    return b.balance_cents > 0;
  });

  const preview = getLivePreview();

  return (
    <div id="wallet_dashboard" className="flex-1 bg-[#06080d] p-4 md:p-6 pb-20 md:pb-6 select-none font-sans overflow-y-auto max-w-5xl mx-auto w-full">
      
      {/* Dense Terminal Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-white-10 pb-3 mb-4 gap-3">
        <div>
          <h1 className="text-[10px] font-bold uppercase tracking-widest text-accent flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            VELUM INTERNAL CENTRAL CLEARING
          </h1>
          <p className="text-[9px] text-text-secondary font-mono tracking-wide mt-0.5">SECURE PORTAL | USER: #{currentUserId}</p>
        </div>
        
        {/* Toggle Switches */}
        <div className="flex bg-velum-900 border border-white-5 rounded p-0.5">
          <button 
            onClick={() => setActiveTab('exchange')} 
            className={`px-3 py-1 text-[9px] font-bold tracking-wider font-mono uppercase rounded transition ${activeTab === 'exchange' ? 'bg-white-10 text-white' : 'text-text-secondary hover:text-white'}`}
          >
            Terminal Ledgers
          </button>
          <button 
            onClick={() => setActiveTab('funding')} 
            className={`px-3 py-1 text-[9px] font-bold tracking-wider font-mono uppercase rounded transition ${activeTab === 'funding' ? 'bg-white-10 text-white' : 'text-text-secondary hover:text-white'}`}
          >
            Identity & Funding
          </button>
        </div>
      </div>

      {activeTab === 'exchange' && (
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
        
        {/* Left Hand: Secure Enclave Balance Matrix */}
        <div className="md:col-span-7 space-y-4 max-w-full overflow-hidden">
          
          {/* Snug Institutional Vault Balance Sheet */}
          <div className="bg-[#0b0e14] border border-white-10 rounded-lg p-4 relative overflow-hidden flex flex-col justify-between min-h-[130px] shadow-sm max-w-full">
            <div className="flex justify-between items-start gap-4">
              <div className="min-w-0 flex-1">
                <span className="text-[8px] font-bold font-mono text-accent uppercase tracking-wider flex items-center gap-1">
                  SECURE PLATFORM RESERVES (VLM)
                </span>
                <div className="text-xl md:text-2xl font-mono font-black text-white mt-1 break-all tracking-tight">
                  {formatValue(vlmTokens)} <span className="text-xs font-semibold text-text-secondary">VLM</span>
                </div>
              </div>

              {/* Fiat Converter Selection */}
              <div className="flex flex-col items-end shrink-0">
                <span className="text-[8px] font-bold font-mono text-text-secondary uppercase">Equivalent Index</span>
                <select 
                  value={preferredFiat}
                  onChange={(e) => setPreferredFiat(e.target.value)}
                  className="bg-velum-900 border border-white-10 rounded px-1.5 py-0.5 text-[9px] font-bold text-white mt-1 outline-none hover:border-accent cursor-pointer"
                >
                  {currencies.filter(c => !c.is_platform_native).map(c => (
                    <option key={c.currency_code} value={c.currency_code}>
                      {c.currency_code} ({c.currency_code === 'TWD' ? 'NT$' : c.currency_code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="border-t border-white-5 pt-3 mt-3 flex justify-between items-center gap-4">
              <div className="min-w-0">
                <div className="text-[8px] font-bold font-mono text-text-secondary uppercase">CONVERTED CASH INDEX</div>
                <div className="text-sm md:text-base font-mono font-bold text-white mt-0.5 break-all tracking-tight">
                  {preferredFiat === 'TWD' ? 'NT$ ' : ''}
                  {formatValue(preferredFiatEquivalent)}
                  {` ${preferredFiat}`}
                </div>
              </div>
              <div className="text-right text-[8px] font-mono text-text-secondary shrink-0">
                1 VLM = {vlmToFiatRate.toFixed(4)} {preferredFiat}
              </div>
            </div>
          </div>

          {/* Densified Ledger Balances Panel */}
          <div className="bg-[#0b0e14] border border-white-10 rounded-lg p-4 space-y-3 max-w-full overflow-hidden">
            <div className="flex justify-between items-center">
              <h3 className="text-[9px] uppercase tracking-wider font-bold text-accent font-mono flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-accent" />
                <span>LEDGER BALANCES</span>
              </h3>
              <span className="text-[8px] text-text-secondary font-mono bg-white-5 px-1.5 py-0.5 rounded tracking-wide uppercase">NON-ZERO ONLY</span>
            </div>
            
            {loading ? (
              <div className="text-[9px] text-text-secondary font-mono animate-pulse">Accessing secure crypt-ledger...</div>
            ) : activeBalances.length === 0 ? (
              <div className="text-[9px] text-text-secondary font-mono py-1">// LEDGER IS EMPTY //</div>
            ) : (
              <div className="space-y-1.5 max-w-full">
                {activeBalances.map(b => {
                  const curr = currencies.find(c => c.currency_code === b.currency_code);
                  const isNative = b.currency_code === 'VLM';
                  return (
                    <div key={b.currency_code} className="flex justify-between items-center p-2.5 bg-[#0e121a] border border-white-5 rounded hover:border-white-10 transition duration-100 gap-4 max-w-full overflow-hidden">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-7 h-7 rounded flex items-center justify-center font-mono font-black text-[10px] shrink-0 ${isNative ? 'bg-accent/10 text-accent' : 'bg-white-5 text-text-secondary'}`}>
                          {b.currency_code.substring(0, 3)}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate">{curr ? curr.display_name : b.currency_code}</div>
                          <div className="text-[8px] text-text-secondary font-mono tracking-wider uppercase truncate">
                            {isNative ? 'Platform Crypto' : 'Reserve Liquidity'}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0 max-w-[50%] overflow-hidden">
                        <div className="text-xs font-mono font-bold text-white break-all">
                          {b.currency_code === 'TWD' ? 'NT$ ' : ''}
                          {formatValue(b.balance_cents / 100)}
                          <span className="text-[9px] text-text-secondary font-semibold ml-1">{b.currency_code}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          
          {/* Dense Market Feeds Grid */}
          <div className="bg-[#0b0e14] border border-white-10 rounded-lg p-4 space-y-3.5 max-w-full">
            <h3 className="text-[9px] uppercase tracking-wider font-bold text-accent font-mono flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-accent" />
              <span>FX EXCHANGE INDEX FEED</span>
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {rates.filter(r => r.base_currency === 'VLM' || r.quote_currency === 'VLM' || r.base_currency === 'TWD' || r.quote_currency === 'TWD').slice(0, 6).map(r => (
                <div key={r.rate_id} className="p-2 bg-[#0e121a] border border-white-5 rounded flex flex-col justify-between h-[45px]">
                  <div className="text-[8px] font-bold text-text-secondary font-mono tracking-wide">{r.base_currency} / {r.quote_currency}</div>
                  <div className="text-[10px] font-mono font-black text-accent mt-0.5 flex justify-between items-center">
                    <span>{parseFloat(r.rate).toFixed(4)}</span>
                    <span className="text-[7px] text-emerald-400 uppercase bg-emerald-400/10 px-0.5 rounded font-bold tracking-tight">LIVE</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Hand: Structured Interactive Exchange Desk */}
        <form onSubmit={handleExchange} className="bg-[#0b0e14] border border-white-10 rounded-lg md:col-span-5 p-4 space-y-3 shadow-md max-w-full">
          <h3 className="text-[9px] uppercase tracking-wider font-bold text-accent font-mono flex items-center gap-1.5">
            <ArrowRightLeft className="w-3.5 h-3.5 text-accent" />
            <span>FX CONVERSION DESK</span>
          </h3>
          
          {exchangeError && (
            <div className="text-[9px] text-red-400 bg-red-400/10 p-2 rounded border border-red-400/20 font-mono break-all">
              {exchangeError}
            </div>
          )}
          {exchangeSuccess && (
            <div className="text-[9px] text-emerald-400 bg-emerald-400/10 p-2 rounded border border-emerald-400/20 font-mono break-all">
              {exchangeSuccess}
            </div>
          )}

          <div className="space-y-1">
            <label className="block text-[8px] uppercase tracking-wider font-bold text-text-secondary font-mono">
              SELL ASSET CLASS
            </label>
            <select
              value={exchangeFrom}
              onChange={(e) => setExchangeFrom(e.target.value)}
              className="w-full bg-velum-900 border border-white-10 rounded px-2.5 py-1.5 text-xs text-white outline-none focus:border-accent"
              required
            >
              {currencies.filter(c => c.active).map(c => (
                <option key={c.currency_code} value={c.currency_code}>{c.currency_code} - {c.display_name}</option>
              ))}
            </select>
          </div>
          
          <div className="space-y-1">
            <label className="block text-[8px] uppercase tracking-wider font-bold text-text-secondary font-mono">
              BUY ASSET CLASS
            </label>
            <select
              value={exchangeTo}
              onChange={(e) => setExchangeTo(e.target.value)}
              className="w-full bg-velum-900 border border-white-10 rounded px-2.5 py-1.5 text-xs text-white outline-none focus:border-accent"
              required
            >
              {currencies.filter(c => c.active).map(c => (
                <option key={c.currency_code} value={c.currency_code}>{c.currency_code} - {c.display_name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-[8px] uppercase tracking-wider font-bold text-text-secondary font-mono">
              TRANSACTION VOLUME
            </label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={exchangeAmount}
              onChange={(e) => setExchangeAmount(e.target.value)}
              placeholder="0.00"
              required
              className="w-full bg-velum-900 border border-white-10 rounded px-2.5 py-1.5 text-xs text-white outline-none focus:border-accent placeholder:text-white-10 font-mono font-bold"
            />
          </div>

          {/* Sleek FX Receipt Slate */}
          {preview && (
            <div className="bg-[#0e121a] border border-white-5 rounded p-2.5 space-y-1 font-mono text-[9px] text-text-secondary max-w-full overflow-hidden">
              <div className="flex justify-between items-center text-white font-bold gap-2">
                <span>ESTIMATED RATE:</span>
                <span className="text-accent break-all">1 {exchangeFrom} = {preview.rate} {exchangeTo}</span>
              </div>
              <div className="flex justify-between items-center border-t border-white-5 pt-1 mt-1 gap-2">
                <span>GROSS:</span>
                <span className="break-all">{preview.gross} {exchangeTo}</span>
              </div>
              <div className="flex justify-between items-center gap-2">
                <span>SPREAD COST (1.5%):</span>
                <span className="break-all">-{preview.spread} {exchangeTo}</span>
              </div>
              <div className="flex justify-between items-center text-white font-black pt-1 border-t border-dashed border-white-5 text-[10px] gap-2">
                <span>NET SETTLED:</span>
                <span className="text-emerald-400 break-all">{preview.net} {exchangeTo}</span>
              </div>
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-accent hover:bg-accent-hover text-velum-900 text-[9px] font-extrabold uppercase py-2.5 rounded transition font-sans tracking-widest mt-2 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3 h-3 animate-spin-slow" />
            EXECUTE LEDGER SWAP
          </button>
        </form>
      </div>
      )}
      
      {activeTab === 'funding' && (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        
        {/* Left Column: KYC and saved Methods */}
        <div className="space-y-4 max-w-full">
          
          {/* Identity Verification (KYC) */}
          <div className="bg-[#0b0e14] border border-white-10 rounded-lg p-4 space-y-3">
            <h3 className="text-[9px] uppercase tracking-wider font-bold text-accent font-mono flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-accent" />
              <span>COMPLIANCE & VERIFICATION (KYC)</span>
            </h3>
            {kyc ? (
              <div className="p-3 bg-[#0e121a] border border-white-5 rounded space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-white uppercase tracking-wider">COMPLIANCE STATUS</span>
                  <span className={`text-[8px] font-bold font-mono px-1.5 py-0.5 rounded-full ${kyc.status === 'VERIFIED' ? 'bg-emerald-400/10 text-emerald-400 border border-emerald-400/20' : 'bg-yellow-400/10 text-yellow-400 border border-yellow-400/20'}`}>
                    {kyc.status}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1.5 border-t border-white-5">
                  <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">ENCLAVE CLEARING LEVEL</span>
                  <span className="text-[9px] font-mono font-bold text-white uppercase">{kyc.verification_level}</span>
                </div>
              </div>
            ) : (
              <form onSubmit={handleKycSubmit} className="space-y-2 p-3 bg-[#0e121a] border border-white-5 rounded">
                <input type="text" placeholder="Full Legal Name" required value={kycName} onChange={e => setKycName(e.target.value)} className="w-full bg-velum-800 border border-white-10 rounded px-2.5 py-1.5 text-xs text-white outline-none focus:border-accent" />
                <select value={kycDoc} onChange={e => setKycDoc(e.target.value)} className="w-full bg-velum-800 border border-white-10 rounded px-2.5 py-1.5 text-xs text-white outline-none focus:border-accent">
                  <option value="PASSPORT_SIM">International Passport</option>
                  <option value="DRIVERS_LICENSE_SIM">Driver's License</option>
                  <option value="NATIONAL_ID_SIM">National ID Card</option>
                </select>
                <button type="submit" className="w-full bg-accent hover:bg-accent-hover text-velum-900 text-[9px] font-extrabold uppercase py-2 rounded transition cursor-pointer font-bold tracking-wider">SECURE FILE KYC</button>
              </form>
            )}
          </div>
          
          {/* Saved Payment Methods */}
          <div className="bg-[#0b0e14] border border-white-10 rounded-lg p-4 space-y-3">
            <h3 className="text-[9px] uppercase tracking-wider font-bold text-accent font-mono flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-accent" />
              <span>SAVED ACCOUNTS / SOURCE LEDGERS</span>
            </h3>

            {/* Micro Quick-fill panel */}
            <div className="bg-[#0e121a] border border-white-5 rounded p-2.5 space-y-2">
              <span className="text-[8px] font-bold font-mono text-text-secondary uppercase tracking-wider block">Stripe-style Quick Fill Credentials</span>
              <div className="grid grid-cols-2 gap-1.5">
                <button type="button" onClick={() => fillTestCredentials('VISA')} className="px-2 py-1 bg-white-5 hover:bg-white-10 text-[8px] font-mono text-white rounded transition border border-white-5 text-left">
                   Visa (4222)
                </button>
                <button type="button" onClick={() => fillTestCredentials('MC')} className="px-2 py-1 bg-white-5 hover:bg-white-10 text-[8px] font-mono text-white rounded transition border border-white-5 text-left">
                   Mastercard (5105)
                </button>
                <button type="button" onClick={() => fillTestCredentials('AMEX')} className="px-2 py-1 bg-white-5 hover:bg-white-10 text-[8px] font-mono text-white rounded transition border border-white-5 text-left">
                   Amex (3782)
                </button>
                <button type="button" onClick={() => fillTestCredentials('BANK')} className="px-2 py-1 bg-white-5 hover:bg-white-10 text-[8px] font-mono text-white rounded transition border border-white-5 text-left">
                   TCB Bank (7000)
                </button>
              </div>
            </div>

            {paymentMethods.length > 0 ? (
              <div className="space-y-1.5">
                {paymentMethods.map(m => (
                  <div key={m.payment_method_id} className="flex justify-between items-center p-2.5 bg-[#0e121a] border border-white-5 rounded">
                    <div>
                      <div className="text-xs font-mono font-bold text-white">{m.display_label}</div>
                      <div className="text-[8px] text-text-secondary font-mono tracking-wider uppercase">{m.method_type} GATEWAY</div>
                    </div>
                    <button onClick={() => handleRemoveMethod(m.payment_method_id)} className="p-1 hover:bg-red-500/10 text-red-400 rounded transition cursor-pointer"><Trash2 className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[9px] text-text-secondary font-mono py-1">// NO SAVED METHOD CONSTRAINTS //</div>
            )}

            <form onSubmit={handleAddMethod} className="pt-2 border-t border-white-5 space-y-2">
              <div className="flex gap-1.5">
                <select value={newMethodType} onChange={e => { setNewMethodType(e.target.value); setNewMethodIssuer(e.target.value === 'CARD' ? 'Visa' : 'Taiwan Cooperative Bank'); }} className="bg-velum-900 border border-white-10 rounded px-2 py-1 text-xs text-white outline-none">
                  <option value="CARD">Card</option>
                  <option value="BANK_ACCOUNT">Bank Account</option>
                </select>
                <select value={newMethodIssuer} onChange={e => setNewMethodIssuer(e.target.value)} className="bg-velum-900 border border-white-10 rounded px-2 py-1 text-xs text-white outline-none flex-1">
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
              <div className="flex gap-1.5">
                <input 
                  type="text" 
                  placeholder={newMethodType === 'CARD' ? '16-digit Card Number' : '16-digit Account Number'} 
                  required 
                  value={newMethodNumber} 
                  onChange={e => setNewMethodNumber(e.target.value)} 
                  className="flex-1 bg-velum-900 border border-white-10 rounded px-2.5 py-1 text-xs text-white outline-none focus:border-accent font-mono font-bold" 
                />
                <button type="submit" className="bg-accent hover:bg-accent-hover text-velum-900 text-[8px] font-extrabold uppercase px-3 rounded transition cursor-pointer font-sans tracking-wide">Add Link</button>
              </div>
            </form>
          </div>
        </div>
        
        {/* Right Column: Funding Operations */}
        <div className="bg-[#0b0e14] border border-white-10 rounded-lg p-4 space-y-3">
          <h3 className="text-[9px] uppercase tracking-wider font-bold text-accent font-mono flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-accent" />
            <span>LIQUIDITY ROUTING</span>
          </h3>
          <div className="flex bg-velum-900 rounded p-0.5 border border-white-5 mb-2">
            <button onClick={() => setFundingType('RECHARGE')} className={`flex-1 py-1 text-[8px] font-bold tracking-wider uppercase rounded flex justify-center items-center gap-1 transition ${fundingType === 'RECHARGE' ? 'bg-white-10 text-white' : 'text-text-secondary'}`}><Download className="w-3 h-3"/> DEPOSIT</button>
            <button onClick={() => setFundingType('WITHDRAW')} className={`flex-1 py-1 text-[8px] font-bold tracking-wider uppercase rounded flex justify-center items-center gap-1 transition ${fundingType === 'WITHDRAW' ? 'bg-white-10 text-white' : 'text-text-secondary'}`}><Upload className="w-3 h-3"/> PAYOUT</button>
          </div>
          
          {fundingMsg && <div className="text-[9px] text-accent bg-accent/10 p-2 rounded border border-accent/20 font-mono mb-2 break-all">{fundingMsg}</div>}
          
          <form onSubmit={handleFunding} className="space-y-3">
            <div className="space-y-1">
              <label className="block text-[8px] uppercase tracking-wider font-bold text-text-secondary font-mono">TRANSACTION VOLUME (USD)</label>
              <input type="number" min="0.01" step="0.01" value={fundingAmount} onChange={e => setFundingAmount(e.target.value)} placeholder="0.00" required className="w-full bg-velum-900 border border-white-10 rounded px-2.5 py-1.5 text-xs text-white outline-none focus:border-accent font-mono font-bold" />
            </div>
            <div className="space-y-1">
              <label className="block text-[8px] uppercase tracking-wider font-bold text-text-secondary font-mono">ROUTING CONTEXT</label>
              <select value={fundingMethod} onChange={e => setFundingMethod(e.target.value)} required className="w-full bg-velum-900 border border-white-10 rounded px-2.5 py-1.5 text-xs text-white outline-none focus:border-accent cursor-pointer">
                <option value="">Select source gateway...</option>
                {paymentMethods.map(m => <option key={m.payment_method_id} value={m.payment_method_id}>{m.display_label}</option>)}
              </select>
            </div>
            <button type="submit" className="w-full bg-accent hover:bg-accent-hover text-velum-900 text-[9px] font-extrabold uppercase py-2.5 rounded transition tracking-widest font-bold cursor-pointer font-sans">
              {fundingType === 'RECHARGE' ? 'AUTHORIZE SECURE DEPOSIT' : 'AUTHORIZE LIQUIDITY WITHDRAWAL'}
            </button>
            {fundingType === 'WITHDRAW' && <p className="text-[8px] text-text-secondary text-center mt-1 font-mono uppercase tracking-wide">// Requires KYC verification level. Subject to strict ledger auditing. //</p>}
          </form>
        </div>
      </div>
      )}
    </div>
  );
}
