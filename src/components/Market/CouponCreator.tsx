import React, { useState } from 'react';

interface CouponCreatorProps {
  onSuccess: () => void;
  onCancel: () => void;
  fetchSessionId: () => string;
}

interface TierRuleInput {
  min_value: string; // In dollars
  deduction: string; // In dollars
}

export function CouponCreator({ onSuccess, onCancel, fetchSessionId }: CouponCreatorProps) {
  const [code, setCode] = useState('');
  const [type, setType] = useState<'PERCENTAGE' | 'FIXED' | 'TIERED'>('PERCENTAGE');
  const [value, setValue] = useState(''); // dollar or percent value
  const [limit, setLimit] = useState('100');
  const [minOrderValue, setMinOrderValue] = useState('0.00');
  const [expirationDays, setExpirationDays] = useState('7');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Tier rules state
  const [tierRules, setTierRules] = useState<TierRuleInput[]>([]);

  const handleAddTier = () => {
    setTierRules([...tierRules, { min_value: '100.00', deduction: '15.00' }]);
  };

  const handleRemoveTier = (index: number) => {
    setTierRules(tierRules.filter((_, i) => i !== index));
  };

  const handleTierChange = (index: number, field: keyof TierRuleInput, val: string) => {
    const updated = [...tierRules];
    updated[index][field] = val;
    setTierRules(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !limit) return;
    setIsSubmitting(true);
    setError('');

    try {
      const sId = fetchSessionId();

      // Format tier rules to integer cents
      const formattedTiers = tierRules.map(t => ({
        min_cents: Math.round((parseFloat(t.min_value) || 0) * 100),
        deduction_cents: Math.round((parseFloat(t.deduction) || 0) * 100)
      }));

      const finalValueCentsOrPct = type === 'PERCENTAGE' 
        ? Math.round(parseFloat(value) || 0)
        : Math.round((parseFloat(value) || 0) * 100);

      const res = await fetch('/api/marketplace/coupons', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sId}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          code,
          discount_type: type,
          value_cents_or_pct: type === 'TIERED' ? 0 : finalValueCentsOrPct,
          tier_rules: type === 'TIERED' ? formattedTiers : [],
          usage_limit: parseInt(limit, 10),
          minimum_order_value_cents: Math.round((parseFloat(minOrderValue) || 0) * 100),
          expiration_days: parseInt(expirationDays, 10) || 7
        })
      });

      if (res.ok) {
        onSuccess();
      } else {
        const errData = await res.json();
        setError(errData.error || 'Failed to create promotion coupon.');
      }
    } catch (err) {
      console.warn('Coupon creation failed:', err);
      setError('An error occurred. Check server status.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-velum-850 border border-white-5 p-5 rounded-2xl space-y-4 max-w-xl animate-in fade-in duration-300">
      <div className="flex justify-between items-center pb-2 border-b border-white-5">
        <span className="text-[10px] font-mono font-bold text-accent uppercase tracking-wider">Create Coupon (Pillar B)</span>
        <button type="button" onClick={onCancel} className="text-text-secondary hover:text-white text-xs uppercase font-bold tracking-wider">
          Cancel
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs font-mono">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="block text-[8.5px] uppercase tracking-wider font-bold text-text-secondary font-mono">Code</label>
          <input
            type="text"
            required
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="VELUMSUMMER"
            className="w-full bg-black/40 border border-white-5 rounded-xl px-3.5 py-2 text-xs text-white focus:border-accent focus:outline-none font-mono"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-[8.5px] uppercase tracking-wider font-bold text-text-secondary font-mono">Type</label>
          <div className="flex bg-black/40 border border-white-5 rounded-xl p-1 gap-1">
            <button
              type="button"
              onClick={() => setType('PERCENTAGE')}
              className={`flex-1 py-1.5 text-[8px] uppercase font-bold rounded-lg transition ${type === 'PERCENTAGE' ? 'bg-accent text-velum-900' : 'text-text-secondary hover:text-white'}`}
            >
              Percent
            </button>
            <button
              type="button"
              onClick={() => setType('FIXED')}
              className={`flex-1 py-1.5 text-[8px] uppercase font-bold rounded-lg transition ${type === 'FIXED' ? 'bg-accent text-velum-900' : 'text-text-secondary hover:text-white'}`}
            >
              Fixed
            </button>
            <button
              type="button"
              onClick={() => setType('TIERED')}
              className={`flex-1 py-1.5 text-[8px] uppercase font-bold rounded-lg transition ${type === 'TIERED' ? 'bg-accent text-velum-900' : 'text-text-secondary hover:text-white'}`}
            >
              Tiered
            </button>
          </div>
        </div>

        {type !== 'TIERED' && (
          <div className="space-y-1.5">
            <label className="block text-[8.5px] uppercase tracking-wider font-bold text-text-secondary font-mono">
              {type === 'PERCENTAGE' ? 'Discount Percentage (%)' : 'Discount Value ($)'}
            </label>
            <input
              type="number"
              step="0.01"
              required
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={type === 'PERCENTAGE' ? '15' : '10.00'}
              className="w-full bg-black/40 border border-white-5 rounded-xl px-3.5 py-2 text-xs text-white focus:border-accent focus:outline-none"
            />
          </div>
        )}

        <div className="space-y-1.5">
          <label className="block text-[8.5px] uppercase tracking-wider font-bold text-text-secondary font-mono">Usage Limit</label>
          <input
            type="number"
            required
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            className="w-full bg-black/40 border border-white-5 rounded-xl px-3.5 py-2 text-xs text-white focus:border-accent focus:outline-none font-mono"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-[8.5px] uppercase tracking-wider font-bold text-text-secondary font-mono">Min Order Value ($)</label>
          <input
            type="number"
            step="0.01"
            required
            value={minOrderValue}
            onChange={(e) => setMinOrderValue(e.target.value)}
            className="w-full bg-black/40 border border-white-5 rounded-xl px-3.5 py-2 text-xs text-white focus:border-accent focus:outline-none font-mono"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-[8.5px] uppercase tracking-wider font-bold text-text-secondary font-mono">Expiration Days</label>
          <input
            type="number"
            required
            value={expirationDays}
            onChange={(e) => setExpirationDays(e.target.value)}
            className="w-full bg-black/40 border border-white-5 rounded-xl px-3.5 py-2 text-xs text-white focus:border-accent focus:outline-none font-mono"
          />
        </div>
      </div>

      {type === 'TIERED' && (
        <div className="border border-white-5 rounded-xl p-4 bg-white/2 space-y-3">
          <div className="flex justify-between items-center">
            <span className="block text-[9px] uppercase tracking-widest font-black text-white font-mono">Promotion Discount Tiers</span>
            <button
              type="button"
              onClick={handleAddTier}
              className="px-3 py-1 bg-white/5 hover:bg-white/10 border border-white-10 rounded-lg text-[9px] font-mono uppercase tracking-wider text-accent cursor-pointer"
            >
              + Add Tier
            </button>
          </div>

          {tierRules.length === 0 ? (
            <p className="text-[10px] font-mono text-text-secondary italic">No tiers created. Please configure at least one discount tier rule.</p>
          ) : (
            <div className="space-y-3 max-h-48 overflow-y-auto">
              {tierRules.map((rule, index) => (
                <div key={index} className="grid grid-cols-3 gap-3 items-center p-2.5 bg-black/20 border border-white-5 rounded-xl">
                  <div className="space-y-1">
                    <label className="text-[7.5px] uppercase font-mono text-text-secondary">If order is over ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={rule.min_value}
                      onChange={(e) => handleTierChange(index, 'min_value', e.target.value)}
                      className="w-full bg-black/40 border border-white-5 rounded-lg px-2 py-1 text-xs text-white focus:outline-none font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[7.5px] uppercase font-mono text-text-secondary">Deduct ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={rule.deduction}
                      onChange={(e) => handleTierChange(index, 'deduction', e.target.value)}
                      className="w-full bg-black/40 border border-white-5 rounded-lg px-2 py-1 text-xs text-white focus:outline-none font-mono"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveTier(index)}
                    className="mt-4 px-2 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 rounded-lg text-[9px] font-mono text-red-400 uppercase tracking-wider cursor-pointer"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting || (type === 'TIERED' && tierRules.length === 0)}
        className="w-full py-2.5 bg-accent hover:bg-accent-hover disabled:opacity-50 text-velum-900 text-[10px] font-sans font-bold uppercase rounded-xl tracking-wider cursor-pointer"
      >
        {isSubmitting ? 'Saving...' : 'Save Promotion Code'}
      </button>
    </form>
  );
}
