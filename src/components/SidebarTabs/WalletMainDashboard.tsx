import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowRightLeft, CreditCard, Upload, Trash2, Building, 
  Plus, ArrowDownToLine, ChevronDown, Check, X, Landmark, ArrowUpRight,
  Activity, Menu
} from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { getSessionId } from '../../utils/auth';

interface WalletMainDashboardProps {
  isDark?: boolean;
  currentUserId: number;
  onToggleSidebar?: () => void;
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
        className="bg-velum-750 border border-velum-600 rounded-lg px-2.5 py-1.5 flex items-center justify-between cursor-pointer h-full text-xs text-text-primary"
        onClick={() => setIsOpen(!isOpen)}
      >
        {selected ? (
          <div className="flex items-center gap-1.5">
            {selected.icon}
            <span className="text-xs font-medium">{selected.label}</span>
          </div>
        ) : (
          <span className="text-xs text-text-secondary">{placeholder || 'Select...'}</span>
        )}
        <ChevronDown className={`w-3.5 h-3.5 text-text-secondary transition-transform duration-200 ${isOpen ? 'rotate-180 text-accent' : ''}`} />
      </div>
      
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-velum-800 border border-velum-600 p-1 z-50 max-h-60 overflow-y-auto rounded-lg shadow-xl">
          {options.map(opt => (
            <div 
              key={opt.value}
              className={`flex items-center gap-2 px-2.5 py-1.5 cursor-pointer rounded-md text-xs transition-colors ${value === opt.value ? 'bg-accent/15 text-accent' : 'text-text-primary hover:bg-velum-750'}`}
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
            >
              {opt.icon}
              <span className="font-medium">{opt.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const DEBIT_ISSUERS = ['Visa', 'Mastercard', 'UnionPay', 'Discover', 'JCB', 'Maestro'];
const CREDIT_ISSUERS = ['Velum Black', 'Velum Platinum', 'Velum Titanium', 'American Express', 'Capital One', 'Chase Sapphire'];
const BANK_ISSUERS = ['Bank of Taiwan', 'CTBC Bank', 'Cathay United Bank', 'E.SUN Bank', 'HSBC', 'Chase Bank', 'Barclays', 'Citibank', 'Standard Chartered', 'Bank of America', 'Wells Fargo', 'Santander', 'UBS'];

export default function WalletMainDashboard({ currentUserId, isDark, onToggleSidebar }: WalletMainDashboardProps) {
  const { t } = useLanguage();
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
  const [exchangeAmount, setExchangeAmount] = useState('0.00');
  const [exchangeError, setExchangeError] = useState('');
  const [exchangeSuccess, setExchangeSuccess] = useState('');

  // Funding Form State
  const [fundingAmount, setFundingAmount] = useState('0.00');
  const [fundingMethod, setFundingMethod] = useState('');
  const [fundingMsg, setFundingMsg] = useState('');

  // Method Form State
  const [isMethodModalOpen, setIsMethodModalOpen] = useState(false);
  const [newMethodCategory, setNewMethodCategory] = useState<'DEBIT'|'CREDIT'|'BANK'>('DEBIT');
  const [newMethodIssuer, setNewMethodIssuer] = useState('Visa');
  const [addMethodError, setAddMethodError] = useState('');

  const loadData = async () => {
    try {
      const sId = getSessionId();
      const headers = { 'Authorization': `Bearer ${sId}` };
      
      const [balRes, curRes, ratesRes, methodsRes] = await Promise.all([
        fetch('/v2/payments/balances', { headers }),
        fetch('/v2/payments/currencies', { headers }),
        fetch('/v2/payments/rates', { headers }),
        fetch('/v2/payments/methods', { headers })
      ]);
      
      if (balRes.ok) {
        const data = await balRes.json();
        setBalances(Array.isArray(data) ? data : (data?.balances || (data?.wallet ? [data.wallet] : [])));
      }
      if (curRes.ok) {
        const data = await curRes.json();
        setCurrencies(Array.isArray(data) ? data : (data?.currencies || []));
      }
      if (ratesRes.ok) {
        const data = await ratesRes.json();
        setRates(Array.isArray(data) ? data : (data?.rates || []));
      }
      if (methodsRes.ok) {
        const data = await methodsRes.json();
        setPaymentMethods(Array.isArray(data) ? data : (data?.methods || data?.payment_methods || []));
      }
    } catch (e) {
      console.error('Failed to load wallet data', e);
    } finally {
      setLoading(false);
    }
  };

  const handleAmountMaskChange = (value: string, setter: (val: string) => void) => {
    const digits = value.replace(/\D/g, '');
    if (!digits || parseInt(digits, 10) === 0) {
      setter('0.00');
      return;
    }
    const cents = parseInt(digits, 10);
    setter((cents / 100).toFixed(2));
  };

  useEffect(() => {
    loadData();
  }, []);

  const getConversionRate = (from: string, to: string): number => {
    if (from === to) return 1;
    const ratesList = Array.isArray(rates) ? rates : [];
    
    const findRate = (f: string, t: string): number | null => {
      if (f === t) return 1;
      let rateObj = ratesList.find(r => r.base_currency === f && r.quote_currency === t);
      if (rateObj) return parseFloat(rateObj.rate);
      rateObj = ratesList.find(r => r.base_currency === t && r.quote_currency === f);
      if (rateObj) return 1 / parseFloat(rateObj.rate);
      return null;
    };

    const direct = findRate(from, to);
    if (direct !== null) return direct;

    // Convert through USD bridge
    const fromToUsd = findRate(from, 'USD');
    const usdToTo = findRate('USD', to);
    if (fromToUsd !== null && usdToTo !== null) {
      return fromToUsd * usdToTo;
    }

    return 0;
  };

  const convertAmount = (amount: number, from: string, to: string) => {
    return amount * getConversionRate(from, to);
  };

  const balancesList = Array.isArray(balances) ? balances : [];
  const currenciesList = Array.isArray(currencies) ? currencies : [];
  const methodsList = Array.isArray(paymentMethods) ? paymentMethods : [];

  const totalInPrimary = balancesList.reduce((sum, b) => {
    return sum + convertAmount(b.balance_cents / 100, b.currency_code, preferredFiat);
  }, 0);

  const [animatedBalance, setAnimatedBalance] = useState(0);

  useEffect(() => {
    const end = totalInPrimary;
    if (end <= 0) {
      setAnimatedBalance(0);
      return;
    }
    
    const endCents = Math.round(end * 100);
    const steps: number[] = [];
    const centsStr = endCents.toString();
    for (let i = 1; i <= centsStr.length; i++) {
      const stepVal = parseInt(centsStr.slice(0, i), 10);
      steps.push(stepVal / 100);
    }

    let currentStep = 0;
    const intervalTime = Math.max(40, Math.min(100, 300 / steps.length));
    
    const timer = setInterval(() => {
      if (currentStep < steps.length) {
        setAnimatedBalance(steps[currentStep]);
        currentStep++;
      } else {
        setAnimatedBalance(end);
        clearInterval(timer);
      }
    }, intervalTime);

    return () => clearInterval(timer);
  }, [totalInPrimary]);

  const totalInVLM = balancesList.reduce((sum, b) => {
    return sum + convertAmount(b.balance_cents / 100, b.currency_code, 'VLM');
  }, 0);

  const formatCurrency = (amount: number, currencyCode?: string) => {
    const code = (currencyCode || 'USD').replace('_SIM', '');
    try {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).format(amount);
    } catch (e) {
      return `${Number(amount || 0).toFixed(2)} ${code}`;
    }
  };

  const handleExchange = async (e: React.FormEvent) => {
    e.preventDefault();
    setExchangeError(''); setExchangeSuccess('');
    try {
      const sId = getSessionId();
      const res = await fetch('/v2/payments/exchange', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${sId}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromCurrency: exchangeFrom,
          toCurrency: exchangeTo,
          amountCents: Math.floor(parseFloat(exchangeAmount.replace(/[^0-9.]/g, '')) * 100)
        })
      });
      const data = await res.json();
      if (!res.ok) setExchangeError(data.error || 'Exchange failed');
      else {
        setExchangeSuccess(`Exchanged successfully.`);
        loadData(); 
        setExchangeAmount('0.00');
        setTimeout(() => setIsExchangeModalOpen(false), 1500);
      }
    } catch (e) { setExchangeError('Network error'); }
  };

  const handleFunding = async (e: React.FormEvent) => {
    e.preventDefault();
    setFundingMsg('');
    try {
      const sId = getSessionId();
      const endpoint = fundingType === 'RECHARGE' ? '/v2/payments/recharge' : '/v2/payments/withdraw';
      const bodyPayload: any = { 
        amount_cents: Math.floor(parseFloat(fundingAmount.replace(/[^0-9.]/g, '')) * 100),
        currency: preferredFiat
      };
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
        setFundingAmount('0.00'); 
        setTimeout(() => setIsFundingModalOpen(false), 1500);
      }
    } catch (e) { setFundingMsg('Network error'); }
  };

  const handleAddMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddMethodError('');
    try {
      const sId = getSessionId();
      const methodTypeMap = newMethodCategory === 'BANK' ? 'BANK_ACCOUNT' : 'CARD';
      const res = await fetch('/v2/payments/methods', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${sId}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ methodType: methodTypeMap, institution: newMethodIssuer, methodCategory: newMethodCategory })
      });
      if (res.ok) { 
        loadData(); 
        setIsMethodModalOpen(false);
      } else {
        const d = await res.json();
        setAddMethodError(d.error || 'Failed to add method');
      }
    } catch (e: any) { setAddMethodError(e.message || 'Unknown error'); }
  };

  const handleRemoveMethod = async (methodId: string) => {
    try {
      const sId = getSessionId();
      const res = await fetch(`/v2/payments/methods/${methodId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${sId}` }
      });
      if (res.ok) { loadData(); }
    } catch (e) { console.error(e); }
  };

  const activeBalances = balancesList.filter(b => b.balance_cents > 0 || b.currency_code === preferredFiat || b.currency_code === 'VLM');

  const currencyOptions = currenciesList.map(c => {
    const code = typeof c === 'string' ? c : (c?.currency_code || '');
    return {
      value: code,
      label: code.replace('_SIM', '')
    };
  });

  const fiatOptions = currenciesList.filter(c => {
    const isPlatformNative = typeof c === 'string' ? (c === 'VLM') : !!c?.is_platform_native;
    return !isPlatformNative;
  }).map(c => {
    const code = typeof c === 'string' ? c : (c?.currency_code || '');
    return {
      value: code,
      label: code.replace('_SIM', '')
    };
  });

  const fundingMethodOptions = methodsList.map(m => ({
    value: m.payment_method_id,
    label: `${m.display_label} (•••• ${m.display_label.slice(-4) || '1234'})`,
    icon: m.method_type === 'CARD' ? <CreditCard className="w-4 h-4 opacity-70" /> : <Landmark className="w-4 h-4 opacity-70" />
  }));

  const vlmBalanceObj = balancesList.find(b => b.currency_code === 'VLM');
  const vlmBalanceCents = vlmBalanceObj ? vlmBalanceObj.balance_cents : 0;

  const mainFiatBalanceObj = balancesList.find(b => b.currency_code === preferredFiat);
  const mainFiatBalanceCents = mainFiatBalanceObj ? mainFiatBalanceObj.balance_cents : 0;

  const secondaryBalanceObj = balancesList.find(b => b.currency_code !== 'VLM' && b.currency_code !== preferredFiat && b.balance_cents > 0);
  const secondaryCurrency = secondaryBalanceObj ? secondaryBalanceObj.currency_code : (preferredFiat === 'EUR' ? 'USD' : 'EUR');
  const secondaryBalanceCents = secondaryBalanceObj ? secondaryBalanceObj.balance_cents : 0;

  return (
    <div className="flex-1 bg-transparent p-3 sm:p-4 select-none font-sans overflow-y-auto max-w-4xl mx-auto w-full text-text-primary">
      
      {/* Top Nav */}
      <div className="flex justify-between items-center mb-4">
        <div>
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className="md:hidden p-1.5 rounded-lg border border-velum-600 text-text-secondary hover:text-text-primary hover:bg-velum-750 transition cursor-pointer"
              aria-label="Open sidebar menu"
              title="Open Navigation"
            >
              <Menu className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="flex bg-velum-800 border border-velum-600 p-1 rounded-lg shrink-0">
          <button 
            onClick={() => setActiveTab('overview')} 
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer ${activeTab === 'overview' ? 'bg-accent/15 text-accent border border-accent/30' : 'text-text-secondary hover:text-text-primary'}`}
          >
            {t('wallet.accounts', 'Accounts')}
          </button>
          <button 
            onClick={() => setActiveTab('methods')} 
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer ${activeTab === 'methods' ? 'bg-accent/15 text-accent border border-accent/30' : 'text-text-secondary hover:text-text-primary'}`}
          >
            {t('wallet.cards_banks', 'Cards & Banks')}
          </button>
        </div>
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-4">
          
          {/* Hero Balance */}
          <div className="flex flex-col items-center justify-center py-6 bg-velum-800 border border-velum-600 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium text-text-secondary">Balance</span>
              <div className="w-24 h-7">
                <CustomDropdown 
                  options={fiatOptions} 
                  value={preferredFiat} 
                  onChange={setPreferredFiat}
                />
              </div>
            </div>
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tight mb-2 text-text-primary">
              {formatCurrency(animatedBalance, preferredFiat)}
            </h2>
            <div className="flex items-center gap-1.5 text-text-secondary bg-velum-750 px-3 py-1 rounded-full border border-velum-600">
              <span className="w-2 h-2 rounded-full bg-accent"></span>
              <span className="text-xs font-medium">{totalInVLM.toLocaleString(undefined, { maximumFractionDigits: 2 })} VLM</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <button 
              onClick={() => { setFundingType('RECHARGE'); setIsFundingModalOpen(true); }}
              className="flex flex-col items-center justify-center p-3 bg-velum-800 border border-velum-600 rounded-xl hover:border-accent/40 transition-colors gap-1.5 cursor-pointer"
            >
              <div className="w-9 h-9 bg-accent/15 rounded-full flex items-center justify-center text-accent">
                <Plus className="w-4 h-4" />
              </div>
              <span className="text-xs font-medium text-text-primary">Deposit</span>
            </button>
            <button 
              onClick={() => { setFundingType('WITHDRAW'); setIsFundingModalOpen(true); }}
              className="flex flex-col items-center justify-center p-3 bg-velum-800 border border-velum-600 rounded-xl hover:border-accent/40 transition-colors gap-1.5 cursor-pointer"
            >
              <div className="w-9 h-9 bg-accent/15 rounded-full flex items-center justify-center text-accent">
                <ArrowUpRight className="w-4 h-4" />
              </div>
              <span className="text-xs font-medium text-text-primary">Withdraw</span>
            </button>
            <button 
              onClick={() => setIsExchangeModalOpen(true)}
              className="flex flex-col items-center justify-center p-3 bg-velum-800 border border-velum-600 rounded-xl hover:border-accent/40 transition-colors gap-1.5 cursor-pointer"
            >
              <div className="w-9 h-9 bg-accent/15 rounded-full flex items-center justify-center text-accent">
                <ArrowRightLeft className="w-4 h-4" />
              </div>
              <span className="text-xs font-medium text-text-primary">Exchange</span>
            </button>
          </div>

          {/* Asset Wallets Section */}
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {/* Box 1: VLM */}
              <div className="p-3 rounded-xl border border-velum-600 bg-velum-800 flex flex-col justify-between h-24">
                <div className="flex justify-between items-start">
                  <span className="text-xs text-text-secondary font-medium">
                    Velum
                  </span>
                  <div className="p-1 bg-accent/10 rounded-md text-accent">
                    <Activity className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="flex flex-col">
                  <span className="text-base sm:text-lg font-bold text-text-primary truncate font-mono">
                    {(vlmBalanceCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-xs text-text-secondary">
                    VLM
                  </span>
                </div>
              </div>

              {/* Box 2: Main Fiat */}
              <div className="p-3 rounded-xl border border-velum-600 bg-velum-800 flex flex-col justify-between h-24">
                <div className="flex justify-between items-start">
                  <span className="text-xs text-text-secondary font-medium">
                    Primary
                  </span>
                  <div className="p-1 bg-velum-750 rounded-md text-text-primary">
                    <Landmark className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="flex flex-col">
                  <span className="text-base sm:text-lg font-bold text-text-primary truncate font-mono">
                    {formatCurrency(mainFiatBalanceCents / 100, preferredFiat)}
                  </span>
                  <span className="text-xs text-text-secondary">
                    {(preferredFiat || 'USD').replace('_SIM', '')}
                  </span>
                </div>
              </div>

              {/* Box 3: Secondary Fiat */}
              <div className="p-3 rounded-xl border border-velum-600 bg-velum-800 flex flex-col justify-between h-24">
                <div className="flex justify-between items-start">
                  <span className="text-xs text-text-secondary font-medium">
                    Secondary
                  </span>
                  <div className="p-1 bg-velum-750 rounded-md text-text-primary">
                    <Building className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="flex flex-col">
                  <span className="text-base sm:text-lg font-bold text-text-primary truncate font-mono">
                    {formatCurrency(secondaryBalanceCents / 100, secondaryCurrency)}
                  </span>
                  <span className="text-xs text-text-secondary">
                    {(secondaryCurrency || 'EUR').replace('_SIM', '')}
                  </span>
                </div>
              </div>
            </div>
          </div>

        </div>
      )}

      {activeTab === 'methods' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-semibold text-text-primary">Payment Methods</h3>
            <button 
              onClick={() => setIsMethodModalOpen(true)}
              className="text-xs font-medium px-3 py-1.5 bg-accent text-black rounded-lg hover:bg-accent-hover transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Add Method
            </button>
          </div>
          
          {methodsList.length === 0 ? (
            <div className="text-center py-12 bg-velum-800 border border-velum-600 rounded-xl">
              <CreditCard className="w-8 h-8 mx-auto mb-2 text-text-secondary opacity-50" />
              <p className="text-text-secondary text-xs">No payment methods linked.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {methodsList.map(m => {
                const isBank = m.method_type === 'BANK_ACCOUNT';
                
                return (
                  <div key={m.payment_method_id} className="p-4 rounded-xl border border-velum-600 bg-velum-800 relative group">
                    <div className="absolute top-2.5 right-2.5">
                      <button onClick={() => handleRemoveMethod(m.payment_method_id)} className="p-1 text-text-secondary hover:text-status-dnd rounded-lg transition-colors cursor-pointer">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    
                    <div className="flex items-center gap-2 mb-3">
                      {isBank ? <Landmark className="w-4 h-4 text-accent" /> : <CreditCard className="w-4 h-4 text-accent" />}
                      <span className="text-xs font-medium text-text-secondary">{isBank ? 'Bank Account' : 'Card'}</span>
                    </div>
                    <div className="text-sm font-mono tracking-widest mb-1 text-text-primary">
                      •••• {m.display_label.slice(-4) || '1234'}
                    </div>
                    <div className="text-xs text-text-secondary">{m.display_label.split(' ')[0]}</div>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop p-4">
          <div className="bg-velum-850 border border-velum-600 rounded-xl w-full max-w-md p-4 sm:p-5 shadow-2xl relative">
            <button onClick={() => setIsExchangeModalOpen(false)} className="absolute top-4 right-4 p-1.5 text-text-secondary hover:text-text-primary rounded-lg transition-colors cursor-pointer">
              <X className="w-4 h-4" />
            </button>
            <h3 className="text-sm font-semibold mb-4 text-text-primary">Exchange Currency</h3>
            
            {exchangeError && <div className="p-2.5 mb-3 text-xs text-status-dnd bg-status-dnd/10 rounded-lg border border-status-dnd/30">{exchangeError}</div>}
            {exchangeSuccess && <div className="p-2.5 mb-3 text-xs text-status-online bg-status-online/10 rounded-lg border border-status-online/30">{exchangeSuccess}</div>}
            
            <form onSubmit={handleExchange} className="space-y-3">
              <div className="p-3 bg-velum-750 border border-velum-600 rounded-lg">
                <div className="flex justify-between mb-2 items-center">
                  <span className="text-xs text-text-secondary">From</span>
                  <div className="w-28 h-7">
                    <CustomDropdown options={currencyOptions} value={exchangeFrom} onChange={setExchangeFrom} />
                  </div>
                </div>
                <input 
                  type="text" 
                  value={exchangeAmount} onChange={e => handleAmountMaskChange(e.target.value, setExchangeAmount)} 
                  className="w-full bg-transparent text-2xl font-bold outline-none text-text-primary font-mono" 
                />
              </div>

              <div className="flex justify-center -my-1 relative z-10">
                <div className="bg-velum-800 p-1 rounded-full border border-velum-600">
                  <ArrowDownToLine className="w-3.5 h-3.5 text-accent" />
                </div>
              </div>

              <div className="p-3 bg-velum-750 border border-velum-600 rounded-lg">
                <div className="flex justify-between mb-2 items-center">
                  <span className="text-xs text-text-secondary">To</span>
                  <div className="w-28 h-7">
                    <CustomDropdown options={currencyOptions} value={exchangeTo} onChange={setExchangeTo} />
                  </div>
                </div>
                <div className="text-2xl font-bold text-text-primary font-mono truncate">
                  {exchangeAmount && !isNaN(parseFloat(exchangeAmount.replace(/[^0-9.]/g, ''))) 
                    ? convertAmount(parseFloat(exchangeAmount.replace(/[^0-9.]/g, '')), exchangeFrom, exchangeTo).toFixed(2)
                    : '0.00'}
                </div>
              </div>

              <div className="pt-2">
                <button type="submit" disabled={parseFloat(exchangeAmount.replace(/[^0-9.]/g, '')) === 0} className="w-full py-2.5 rounded-lg text-xs font-semibold bg-accent text-black hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">Exchange</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Funding Modal */}
      {isFundingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop p-4">
          <div className="bg-velum-850 border border-velum-600 rounded-xl w-full max-w-md p-4 sm:p-5 shadow-2xl relative">
            <button onClick={() => setIsFundingModalOpen(false)} className="absolute top-4 right-4 p-1.5 text-text-secondary hover:text-text-primary rounded-lg transition-colors cursor-pointer">
              <X className="w-4 h-4" />
            </button>
            <h3 className="text-sm font-semibold mb-4 text-text-primary">{fundingType === 'RECHARGE' ? 'Deposit' : 'Withdraw'}</h3>
            
            {fundingMsg && (
              <div className={`p-2.5 mb-3 text-xs rounded-lg border ${fundingMsg.includes('Success') ? 'bg-status-online/10 text-status-online border-status-online/30' : 'bg-status-dnd/10 text-status-dnd border-status-dnd/30'}`}>
                {fundingMsg}
              </div>
            )}
            
            <form onSubmit={handleFunding} className="space-y-3">
              <div className="p-3 bg-velum-750 border border-velum-600 rounded-lg">
                <span className="text-xs text-text-secondary block mb-1">Amount ({preferredFiat})</span>
                <input 
                  type="text" 
                  value={fundingAmount} onChange={e => handleAmountMaskChange(e.target.value, setFundingAmount)} 
                  className="w-full bg-transparent text-2xl font-bold outline-none text-text-primary font-mono" 
                />
              </div>

              <div className="space-y-1">
                <span className="text-xs text-text-secondary block">{fundingType === 'RECHARGE' ? 'Source' : 'Destination'}</span>
                <div className="h-9">
                  <CustomDropdown 
                    options={fundingMethodOptions} 
                    value={fundingMethod} 
                    onChange={setFundingMethod} 
                    placeholder="Select payment method"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button type="submit" disabled={!fundingMethod || parseFloat(fundingAmount.replace(/[^0-9.]/g, '')) === 0} className="w-full py-2.5 rounded-lg text-xs font-semibold bg-accent text-black hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
                  {fundingType === 'RECHARGE' ? 'Confirm Deposit' : 'Confirm Withdrawal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Method Modal */}
      {isMethodModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop p-4">
          <div className="bg-velum-850 border border-velum-600 rounded-xl w-full max-w-md p-4 sm:p-5 shadow-2xl relative">
            <button onClick={() => setIsMethodModalOpen(false)} className="absolute top-4 right-4 p-1.5 text-text-secondary hover:text-text-primary rounded-lg transition-colors cursor-pointer">
              <X className="w-4 h-4" />
            </button>
            <h3 className="text-sm font-semibold mb-4 text-text-primary">Add Payment Method</h3>
            
            <form onSubmit={handleAddMethod} className="space-y-3">
              
              {/* Category Selector */}
              <div className="grid grid-cols-3 gap-2">
                <button 
                  type="button" 
                  onClick={() => { setNewMethodCategory('DEBIT'); setNewMethodIssuer('Visa'); }}
                  className={`p-2.5 rounded-lg border flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${newMethodCategory === 'DEBIT' ? 'border-accent bg-accent/15 text-accent' : 'border-velum-600 bg-velum-750 text-text-secondary hover:text-text-primary'}`}
                >
                  <CreditCard className="w-4 h-4" />
                  <span className="text-xs font-medium">Debit</span>
                </button>
                <button 
                  type="button" 
                  onClick={() => { setNewMethodCategory('CREDIT'); setNewMethodIssuer('Velum Black'); }}
                  className={`p-2.5 rounded-lg border flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${newMethodCategory === 'CREDIT' ? 'border-accent bg-accent/15 text-accent' : 'border-velum-600 bg-velum-750 text-text-secondary hover:text-text-primary'}`}
                >
                  <CreditCard className="w-4 h-4" />
                  <span className="text-xs font-medium">Credit</span>
                </button>
                <button 
                  type="button" 
                  onClick={() => { setNewMethodCategory('BANK'); setNewMethodIssuer('HSBC'); }}
                  className={`p-2.5 rounded-lg border flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${newMethodCategory === 'BANK' ? 'border-accent bg-accent/15 text-accent' : 'border-velum-600 bg-velum-750 text-text-secondary hover:text-text-primary'}`}
                >
                  <Landmark className="w-4 h-4" />
                  <span className="text-xs font-medium">Bank</span>
                </button>
              </div>

              <div className="space-y-1">
                <label className="block text-xs text-text-secondary">Provider / Issuer</label>
                <div className="h-9">
                  <CustomDropdown 
                    options={(newMethodCategory === 'DEBIT' ? DEBIT_ISSUERS : newMethodCategory === 'CREDIT' ? CREDIT_ISSUERS : BANK_ISSUERS).map(i => ({value: i, label: i}))}
                    value={newMethodIssuer}
                    onChange={setNewMethodIssuer}
                  />
                </div>
              </div>

              {addMethodError && (
                <div className="p-2.5 bg-status-dnd/10 border border-status-dnd/30 rounded-lg text-status-dnd text-xs">
                  {addMethodError}
                </div>
              )}

              <div className="pt-2">
                <button type="submit" className="w-full py-2.5 rounded-lg text-xs font-semibold bg-accent text-black hover:bg-accent-hover transition-colors cursor-pointer">
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
