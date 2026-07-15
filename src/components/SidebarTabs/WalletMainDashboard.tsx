import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowRightLeft, CreditCard, Upload, Trash2, Building, 
  Plus, ArrowDownToLine, ChevronDown, Check, X, Landmark, ArrowUpRight
} from 'lucide-react';

interface WalletMainDashboardProps {
  isDark?: boolean;
  currentUserId: number;
}

// Custom Dropdown Component to replace <select>
const CustomDropdown = ({ 
  options, 
  value, 
  onChange, 
  placeholder,
  className = ""
}: { 
  options: {value: string, label: string, icon?: React.ReactNode}[], 
  value: string, 
  onChange: (val: string) => void,
  placeholder?: string,
  className?: string
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selected = options.find(o => o.value === value);

  return (
    <div className={`relative ${className}`} ref={ref}>
      <div 
        className="glass-input flex items-center justify-between cursor-pointer h-full"
        onClick={() => setIsOpen(!isOpen)}
      >
        {selected ? (
          <div className="flex items-center gap-2">
            {selected.icon}
            <span className="text-sm font-medium">{selected.label}</span>
          </div>
        ) : (
          <span className="text-sm text-text-secondary">{placeholder || 'Select...'}</span>
        )}
        <ChevronDown className={`w-4 h-4 text-text-secondary transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </div>
      
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 glass-panel p-1.5 z-50 max-h-60 overflow-y-auto rounded-lg shadow-xl animate-in fade-in zoom-in-95 duration-100">
          {options.map(opt => (
            <div 
              key={opt.value}
              className={`flex items-center gap-2 px-3 py-2 cursor-pointer rounded-md transition-colors ${value === opt.value ? 'bg-white-10' : 'hover:bg-white-5'}`}
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
            >
              {opt.icon}
              <span className="text-sm font-medium">{opt.label}</span>
              {value === opt.value && <Check className="w-4 h-4 ml-auto text-accent" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const DEBIT_ISSUERS = ['Visa', 'Mastercard', 'UnionPay'];
const CREDIT_ISSUERS = ['Velum Black', 'Velum Platinum', 'Velum Titanium'];
const BANK_ISSUERS = ['HSBC', 'Chase Bank', 'Barclays', 'Citibank', 'Standard Chartered'];

export default function WalletMainDashboard({ currentUserId, isDark }: WalletMainDashboardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'methods'>('overview');
  
  const [balances, setBalances] = useState<any[]>([]);
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [rates, setRates] = useState<any[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [preferredFiat, setPreferredFiat] = useState('USD');
  
  // Modal states
  const [isExchangeModalOpen, setIsExchangeModalOpen] = useState(false);
  const [isFundingModalOpen, setIsFundingModalOpen] = useState(false);
  const [fundingType, setFundingType] = useState<'RECHARGE'|'WITHDRAW'>('RECHARGE');
  
  // Exchange Form State
  const [exchangeFrom, setExchangeFrom] = useState('USD');
  const [exchangeTo, setExchangeTo] = useState('VLM');
  const [exchangeAmount, setExchangeAmount] = useState('');
  const [exchangeError, setExchangeError] = useState('');
  const [exchangeSuccess, setExchangeSuccess] = useState('');

  // Funding Form State
  const [fundingAmount, setFundingAmount] = useState('');
  const [fundingMethod, setFundingMethod] = useState('');
  const [fundingMsg, setFundingMsg] = useState('');

  // Method Form State
  const [isMethodModalOpen, setIsMethodModalOpen] = useState(false);
  const [newMethodCategory, setNewMethodCategory] = useState<'DEBIT'|'CREDIT'|'BANK'>('DEBIT');
  const [newMethodIssuer, setNewMethodIssuer] = useState('Visa');
  const [newMethodNumber, setNewMethodNumber] = useState('');

  const loadData = async () => {
    try {
      const sId = sessionStorage.getItem('velum-sessionId');
      const headers = { 'Authorization': `Bearer ${sId}` };
      
      const [balRes, curRes, ratesRes, methodsRes] = await Promise.all([
        fetch('/api/payments/balances', { headers }),
        fetch('/api/payments/currencies', { headers }),
        fetch('/api/payments/rates', { headers }),
        fetch('/api/payments/methods', { headers })
      ]);
      
      if (balRes.ok) setBalances(await balRes.json());
      if (curRes.ok) setCurrencies(await curRes.json());
      if (ratesRes.ok) setRates(await ratesRes.json());
      if (methodsRes.ok) setPaymentMethods(await methodsRes.json());
    } catch (e) {
      console.error('Failed to load wallet data', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getConversionRate = (from: string, to: string) => {
    if (from === to) return 1;
    let rateObj = rates.find(r => r.base_currency === from && r.quote_currency === to);
    if (rateObj) return parseFloat(rateObj.rate);
    rateObj = rates.find(r => r.base_currency === to && r.quote_currency === from);
    if (rateObj) return 1 / parseFloat(rateObj.rate);
    return 0;
  };

  const convertAmount = (amount: number, from: string, to: string) => {
    return amount * getConversionRate(from, to);
  };

  const totalInPrimary = balances.reduce((sum, b) => {
    return sum + convertAmount(b.balance_cents / 100, b.currency_code, preferredFiat);
  }, 0);

  const totalInVLM = balances.reduce((sum, b) => {
    return sum + convertAmount(b.balance_cents / 100, b.currency_code, 'VLM');
  }, 0);

  const formatCurrency = (amount: number, currencyCode: string) => {
    const code = currencyCode.replace('_SIM', '');
    try {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).format(amount);
    } catch (e) {
      return `${amount.toFixed(2)} ${code}`;
    }
  };

  const handleExchange = async (e: React.FormEvent) => {
    e.preventDefault();
    setExchangeError(''); setExchangeSuccess('');
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
        setExchangeSuccess(`Exchanged successfully.`);
        loadData(); 
        setExchangeAmount('');
        setTimeout(() => setIsExchangeModalOpen(false), 1500);
      }
    } catch (e) { setExchangeError('Network error'); }
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
      else { 
        setFundingMsg(`Success.`); 
        loadData(); 
        setFundingAmount(''); 
        setTimeout(() => setIsFundingModalOpen(false), 1500);
      }
    } catch (e) { setFundingMsg('Network error'); }
  };

  const handleAddMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const sId = sessionStorage.getItem('velum-sessionId');
      const methodTypeMap = newMethodCategory === 'BANK' ? 'BANK_ACCOUNT' : 'CARD';
      const res = await fetch('/api/payments/methods', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${sId}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ methodType: methodTypeMap, institution: newMethodIssuer, maskedNumber: newMethodNumber })
      });
      if (res.ok) { 
        loadData(); 
        setNewMethodNumber(''); 
        setIsMethodModalOpen(false);
      }
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

  const activeBalances = balances.filter(b => b.balance_cents > 0 || b.currency_code === preferredFiat || b.currency_code === 'VLM');

  const currencyOptions = currencies.map(c => ({
    value: c.currency_code,
    label: c.currency_code.replace('_SIM', '')
  }));

  const fiatOptions = currencies.filter(c => !c.is_platform_native).map(c => ({
    value: c.currency_code,
    label: c.currency_code.replace('_SIM', '')
  }));

  const fundingMethodOptions = paymentMethods.map(m => ({
    value: m.payment_method_id,
    label: `${m.display_label} (•••• ${m.display_label.slice(-4) || '1234'})`,
    icon: m.method_type === 'CARD' ? <CreditCard className="w-4 h-4 opacity-70" /> : <Landmark className="w-4 h-4 opacity-70" />
  }));

  return (
    <div className="flex-1 bg-transparent p-6 md:p-10 select-none font-sans overflow-y-auto max-w-5xl mx-auto w-full min-h-[100dvh] text-text-primary">
      
      {/* Top Nav (Removed Header "Wallet" as requested) */}
      <div className="flex justify-end items-center mb-8">
        <div className="flex glass-panel p-1 rounded-full shrink-0">
          <button 
            onClick={() => setActiveTab('overview')} 
            className={`px-5 py-2 text-sm font-medium rounded-full transition-all duration-200 ${activeTab === 'overview' ? 'bg-white-10 text-white shadow-sm' : 'text-text-secondary hover:text-white'}`}
          >
            Accounts
          </button>
          <button 
            onClick={() => setActiveTab('methods')} 
            className={`px-5 py-2 text-sm font-medium rounded-full transition-all duration-200 ${activeTab === 'methods' ? 'bg-white-10 text-white shadow-sm' : 'text-text-secondary hover:text-white'}`}
          >
            Cards & Banks
          </button>
        </div>
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-8 animate-in fade-in duration-300 slide-in-from-bottom-2">
          
          {/* Hero Balance */}
          <div className="flex flex-col items-center justify-center py-12">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-sm font-medium text-text-secondary">Main Balance</span>
              <div className="w-24 h-8">
                <CustomDropdown 
                  options={fiatOptions} 
                  value={preferredFiat} 
                  onChange={setPreferredFiat}
                />
              </div>
            </div>
            <h2 className="text-5xl md:text-7xl font-medium tracking-tighter mb-4 text-white">
              {formatCurrency(totalInPrimary, preferredFiat)}
            </h2>
            <div className="flex items-center gap-2 text-text-secondary bg-white-5 px-4 py-1.5 rounded-full border border-white-5">
              <span className="w-2 h-2 rounded-full bg-accent/80"></span>
              <span className="text-sm font-medium tracking-wide">≈ {totalInVLM.toLocaleString(undefined, { maximumFractionDigits: 2 })} VLM</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-3 gap-3 md:gap-5 max-w-xl mx-auto mb-12">
            <button 
              onClick={() => { setFundingType('RECHARGE'); setIsFundingModalOpen(true); }}
              className="flex flex-col items-center justify-center p-5 glass-card hover:bg-white-10 transition-colors gap-3 group"
            >
              <div className="w-12 h-12 bg-white-5 rounded-full flex items-center justify-center text-text-primary group-hover:bg-white text-white group-hover:text-black transition-all">
                <Plus className="w-5 h-5" />
              </div>
              <span className="text-sm font-medium text-text-secondary group-hover:text-white transition-colors">Add Money</span>
            </button>
            <button 
              onClick={() => { setFundingType('WITHDRAW'); setIsFundingModalOpen(true); }}
              className="flex flex-col items-center justify-center p-5 glass-card hover:bg-white-10 transition-colors gap-3 group"
            >
              <div className="w-12 h-12 bg-white-5 rounded-full flex items-center justify-center text-text-primary group-hover:bg-white text-white group-hover:text-black transition-all">
                <ArrowUpRight className="w-5 h-5" />
              </div>
              <span className="text-sm font-medium text-text-secondary group-hover:text-white transition-colors">Withdraw</span>
            </button>
            <button 
              onClick={() => setIsExchangeModalOpen(true)}
              className="flex flex-col items-center justify-center p-5 glass-card hover:bg-white-10 transition-colors gap-3 group"
            >
              <div className="w-12 h-12 bg-white-5 rounded-full flex items-center justify-center text-text-primary group-hover:bg-accent text-white transition-all">
                <ArrowRightLeft className="w-5 h-5" />
              </div>
              <span className="text-sm font-medium text-text-secondary group-hover:text-white transition-colors">Exchange</span>
            </button>
          </div>

          {/* Accounts List */}
          <div className="pt-4">
            <h3 className="text-lg font-medium mb-6 text-white px-2">Your Accounts</h3>
            <div className="space-y-3">
              {activeBalances.map(b => (
                <div key={b.currency_code} className="flex items-center justify-between p-5 glass-card hover:bg-white-5 transition-colors">
                  <div className="flex items-center gap-5">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-sm text-lg font-medium ${b.currency_code === 'VLM' ? 'bg-accent text-velum-900' : 'bg-white-10 text-white'}`}>
                      {b.currency_code === 'VLM' ? 'V' : b.currency_code.substring(0,2)}
                    </div>
                    <div>
                      <h4 className="font-medium text-white text-base">{b.currency_code.replace('_SIM', '')} Account</h4>
                      <p className="text-sm text-text-secondary mt-0.5">Available Balance</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-xl text-white">{b.currency_code === 'VLM' ? (b.balance_cents/100).toLocaleString() : formatCurrency(b.balance_cents / 100, b.currency_code)}</div>
                    {b.currency_code !== preferredFiat && b.currency_code !== 'VLM' && (
                       <div className="text-sm text-text-secondary mt-0.5">
                         ≈ {formatCurrency(convertAmount(b.balance_cents/100, b.currency_code, preferredFiat), preferredFiat)}
                       </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'methods' && (
        <div className="space-y-8 animate-in fade-in duration-300 slide-in-from-bottom-2">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-medium text-white">Linked Payment Methods</h3>
            <button 
              onClick={() => setIsMethodModalOpen(true)}
              className="text-sm font-medium px-5 py-2.5 bg-white text-velum-900 rounded-full hover:bg-white/90 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add Method
            </button>
          </div>
          
          {paymentMethods.length === 0 ? (
            <div className="text-center py-20 glass-card">
              <CreditCard className="w-12 h-12 mx-auto mb-4 text-text-secondary opacity-50" />
              <p className="text-text-secondary font-medium">No payment methods linked.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {paymentMethods.map(m => {
                const isVelum = m.display_label.includes('Velum');
                const isBank = m.method_type === 'BANK_ACCOUNT';
                
                return (
                  <div key={m.payment_method_id} className={`p-6 rounded-2xl relative overflow-hidden group border ${isVelum ? 'bg-gradient-to-br from-velum-800 to-velum-900 border-accent/30' : isBank ? 'bg-gradient-to-br from-slate-800 to-slate-900 border-white-10' : 'bg-gradient-to-br from-zinc-800 to-zinc-900 border-white-10'}`}>
                    {/* Decorative Elements */}
                    <div className="absolute top-0 right-0 p-4 z-10">
                      <button onClick={() => handleRemoveMethod(m.payment_method_id)} className="p-2 bg-black/40 hover:bg-red-500/80 text-white rounded-full transition-colors opacity-0 group-hover:opacity-100">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    {isVelum && (
                      <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-accent/10 rounded-full blur-2xl pointer-events-none"></div>
                    )}
                    
                    <div className="flex items-center justify-between mb-8 relative z-10">
                      <div className="flex items-center gap-2">
                        {isBank ? <Landmark className="w-5 h-5 text-text-secondary" /> : <CreditCard className="w-5 h-5 text-text-secondary" />}
                        <span className="text-xs font-medium tracking-widest text-text-secondary uppercase">{isBank ? 'Bank Account' : (isVelum ? 'Credit Card' : 'Debit Card')}</span>
                      </div>
                      {isVelum && <span className="text-[10px] uppercase font-bold tracking-widest text-accent bg-accent/10 px-2 py-0.5 rounded">Premium</span>}
                    </div>
                    <div className="text-lg font-mono tracking-[0.2em] mb-4 text-white opacity-90 relative z-10">
                      •••• •••• •••• {m.display_label.slice(-4) || '1234'}
                    </div>
                    <div className="text-sm font-medium tracking-wide text-white relative z-10">{m.display_label.split(' ')[0]} {isVelum ? 'Card' : ''}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      
      {/* Exchange Modal */}
      {isExchangeModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="glass-panel w-full max-w-md p-6 shadow-2xl relative">
            <button onClick={() => setIsExchangeModalOpen(false)} className="absolute top-5 right-5 p-2 hover:bg-white-10 rounded-full transition-colors">
              <X className="w-4 h-4 text-text-secondary" />
            </button>
            <h3 className="text-xl font-medium mb-6 text-white">Exchange Currency</h3>
            
            {exchangeError && <div className="p-3 mb-5 text-sm text-red-400 bg-red-400/10 rounded-lg border border-red-400/20">{exchangeError}</div>}
            {exchangeSuccess && <div className="p-3 mb-5 text-sm text-emerald-400 bg-emerald-400/10 rounded-lg border border-emerald-400/20">{exchangeSuccess}</div>}
            
            <form onSubmit={handleExchange} className="space-y-4">
              <div className="p-4 glass-card rounded-xl">
                <div className="flex justify-between mb-3 items-center">
                  <span className="text-sm font-medium text-text-secondary">Pay from</span>
                  <div className="w-28 h-8">
                    <CustomDropdown options={currencyOptions} value={exchangeFrom} onChange={setExchangeFrom} />
                  </div>
                </div>
                <input 
                  type="number" min="0.01" step="0.01" 
                  value={exchangeAmount} onChange={e => setExchangeAmount(e.target.value)} 
                  placeholder="0.00" 
                  className="w-full bg-transparent text-3xl font-medium outline-none text-white placeholder:text-white/20" 
                />
              </div>

              <div className="flex justify-center -my-3 relative z-10">
                <div className="bg-velum-800 p-1 rounded-full border border-white-5">
                  <div className="bg-white-5 p-2 rounded-full">
                    <ArrowDownToLine className="w-4 h-4 text-text-secondary" />
                  </div>
                </div>
              </div>

              <div className="p-4 glass-card rounded-xl">
                <div className="flex justify-between mb-3 items-center">
                  <span className="text-sm font-medium text-text-secondary">Receive</span>
                  <div className="w-28 h-8">
                    <CustomDropdown options={currencyOptions} value={exchangeTo} onChange={setExchangeTo} />
                  </div>
                </div>
                <div className="text-3xl font-medium text-white opacity-90 overflow-hidden text-ellipsis">
                  {exchangeAmount && !isNaN(parseFloat(exchangeAmount)) 
                    ? convertAmount(parseFloat(exchangeAmount), exchangeFrom, exchangeTo).toFixed(2)
                    : '0.00'}
                </div>
              </div>

              <div className="pt-6">
                <button type="submit" className="w-full py-3.5 rounded-xl font-medium bg-white text-velum-900 hover:bg-white/90 transition-colors">Complete Exchange</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Funding Modal */}
      {isFundingModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="glass-panel w-full max-w-md p-6 shadow-2xl relative">
            <button onClick={() => setIsFundingModalOpen(false)} className="absolute top-5 right-5 p-2 hover:bg-white-10 rounded-full transition-colors">
              <X className="w-4 h-4 text-text-secondary" />
            </button>
            <h3 className="text-xl font-medium mb-6 text-white">{fundingType === 'RECHARGE' ? 'Add Money' : 'Withdraw Funds'}</h3>
            
            {fundingMsg && (
              <div className={`p-3 mb-5 text-sm font-medium rounded-lg border ${fundingMsg.includes('Success') ? 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20' : 'bg-red-400/10 text-red-400 border-red-400/20'}`}>
                {fundingMsg}
              </div>
            )}
            
            <form onSubmit={handleFunding} className="space-y-5">
              <div className="p-4 glass-card rounded-xl transition-colors focus-within:border-accent/40">
                <span className="text-sm font-medium text-text-secondary block mb-3">Amount ({preferredFiat})</span>
                <input 
                  type="number" min="0.01" step="0.01" 
                  value={fundingAmount} onChange={e => setFundingAmount(e.target.value)} 
                  placeholder="0.00" 
                  className="w-full bg-transparent text-4xl font-medium outline-none text-white placeholder:text-white/20" 
                />
              </div>

              <div className="space-y-2">
                <span className="text-sm font-medium text-text-secondary px-1 block">{fundingType === 'RECHARGE' ? 'From Method' : 'To Method'}</span>
                <div className="h-12">
                  <CustomDropdown 
                    options={fundingMethodOptions} 
                    value={fundingMethod} 
                    onChange={setFundingMethod} 
                    placeholder="Select payment method"
                  />
                </div>
              </div>

              <div className="pt-4">
                <button type="submit" disabled={!fundingMethod || !fundingAmount} className="w-full py-3.5 rounded-xl font-medium bg-white text-velum-900 hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  Confirm {fundingType === 'RECHARGE' ? 'Deposit' : 'Withdrawal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Method Modal */}
      {isMethodModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="glass-panel w-full max-w-lg p-6 md:p-8 shadow-2xl relative">
            <button onClick={() => setIsMethodModalOpen(false)} className="absolute top-5 right-5 p-2 hover:bg-white-10 rounded-full transition-colors">
              <X className="w-4 h-4 text-text-secondary" />
            </button>
            <h3 className="text-xl font-medium mb-6 text-white">Link New Account</h3>
            
            <form onSubmit={handleAddMethod} className="space-y-6">
              
              {/* Category Selector */}
              <div className="grid grid-cols-3 gap-3">
                <button 
                  type="button" 
                  onClick={() => { setNewMethodCategory('DEBIT'); setNewMethodIssuer('Visa'); }}
                  className={`p-4 rounded-xl border flex flex-col items-center justify-center gap-2 transition-colors ${newMethodCategory === 'DEBIT' ? 'border-white bg-white-10 text-white' : 'border-white-10 text-text-secondary hover:text-white hover:bg-white-5'}`}
                >
                  <CreditCard className="w-5 h-5" />
                  <span className="text-xs font-medium">Debit Card</span>
                </button>
                <button 
                  type="button" 
                  onClick={() => { setNewMethodCategory('CREDIT'); setNewMethodIssuer('Velum Black'); }}
                  className={`p-4 rounded-xl border flex flex-col items-center justify-center gap-2 transition-colors ${newMethodCategory === 'CREDIT' ? 'border-accent bg-accent/10 text-accent' : 'border-white-10 text-text-secondary hover:text-accent hover:bg-accent/5'}`}
                >
                  <CreditCard className="w-5 h-5" />
                  <span className="text-xs font-medium">Velum Credit</span>
                </button>
                <button 
                  type="button" 
                  onClick={() => { setNewMethodCategory('BANK'); setNewMethodIssuer('HSBC'); }}
                  className={`p-4 rounded-xl border flex flex-col items-center justify-center gap-2 transition-colors ${newMethodCategory === 'BANK' ? 'border-white bg-white-10 text-white' : 'border-white-10 text-text-secondary hover:text-white hover:bg-white-5'}`}
                >
                  <Landmark className="w-5 h-5" />
                  <span className="text-xs font-medium">Bank Account</span>
                </button>
              </div>

              <div className="space-y-2 relative z-20">
                <label className="block text-sm font-medium text-text-secondary px-1">Provider / Issuer</label>
                <div className="h-12">
                  <CustomDropdown 
                    options={(newMethodCategory === 'DEBIT' ? DEBIT_ISSUERS : newMethodCategory === 'CREDIT' ? CREDIT_ISSUERS : BANK_ISSUERS).map(i => ({value: i, label: i}))}
                    value={newMethodIssuer}
                    onChange={setNewMethodIssuer}
                  />
                </div>
              </div>

              <div className="space-y-2 relative z-10">
                <label className="block text-sm font-medium text-text-secondary px-1">Account Number</label>
                <input 
                  type="text" 
                  placeholder={newMethodCategory === 'BANK' ? 'Bank Account Number' : 'Card Number'} 
                  required value={newMethodNumber} onChange={e => setNewMethodNumber(e.target.value)} 
                  className="glass-input w-full px-4 py-3.5 tracking-widest font-mono text-lg"
                />
              </div>

              <div className="pt-2">
                <button type="submit" disabled={!newMethodNumber} className="w-full py-4 rounded-xl font-medium bg-white text-velum-900 hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  Link Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
