import React, { useState } from 'react';
import { MarketListing } from '../../types';

interface ListingCreatorProps {
  onSuccess: (listing: MarketListing) => void;
  onCancel: () => void;
  fetchSessionId: () => string;
}

interface SkuInput {
  attribute_name: string;
  attribute_value: string;
  additional_cost: string;
  inventory_count: string;
  file_payload_path: string;
}

export function ListingCreator({ onSuccess, onCancel, fetchSessionId }: ListingCreatorProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [discountAmount, setDiscountAmount] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [displayOrder, setDisplayOrder] = useState('1');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // SKU Variants state
  const [skus, setSkus] = useState<SkuInput[]>([]);

  const handleAddSku = () => {
    setSkus([...skus, {
      attribute_name: 'license_tier',
      attribute_value: 'enterprise_unlimited',
      additional_cost: '0.00',
      inventory_count: '100',
      file_payload_path: ''
    }]);
  };

  const handleRemoveSku = (index: number) => {
    setSkus(skus.filter((_, i) => i !== index));
  };

  const handleSkuChange = (index: number, field: keyof SkuInput, val: string) => {
    const updated = [...skus];
    updated[index][field] = val;
    setSkus(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !price) return;
    setIsSubmitting(true);
    setError('');

    try {
      const sId = fetchSessionId();
      
      // Map SKUs to cent-based objects for the server
      const formattedSkus = skus.map(s => ({
        attribute_name: s.attribute_name,
        attribute_value: s.attribute_value,
        additional_cost_cents: Math.round((parseFloat(s.additional_cost) || 0) * 100),
        inventory_count: parseInt(s.inventory_count, 10) || 0,
        file_payload_path: s.file_payload_path
      }));

      const res = await fetch('/api/marketplace/listings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sId}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title,
          description,
          price: parseFloat(price),
          discount_price: discountAmount ? (parseFloat(price) - parseFloat(discountAmount)) : undefined,
          sku_variants: formattedSkus,
          media_list: mediaUrl.trim() ? [{
            url: mediaUrl,
            is_banner: true,
            display_order: parseInt(displayOrder) || 1,
            file_size: 409600,
            aspect_ratio: aspectRatio
          }] : []
        })
      });

      if (res.ok) {
        const created: MarketListing = await res.json();
        onSuccess(created);
      } else {
        const errData = await res.json();
        setError(errData.error || 'Failed to create listing.');
      }
    } catch (err) {
      console.warn('Creation failed:', err);
      setError('An error occurred. Check system status.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form id="create_listing_form" onSubmit={handleSubmit} className="bg-velum-850 border border-white-5 p-6 rounded-2xl space-y-5 animate-in slide-in-from-top-4 duration-300">
      <div className="flex justify-between items-center pb-3 border-b border-white-5">
        <h3 className="text-[11px] font-sans font-black tracking-widest text-white uppercase">
          New Listing
        </h3>
        <button type="button" onClick={onCancel} className="text-text-secondary hover:text-white text-xs uppercase font-bold tracking-wider">
          Cancel
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs font-mono">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="block text-[9px] uppercase tracking-wider font-bold text-text-secondary font-mono">Title</label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-black/40 border border-white-5 rounded-xl px-4 py-2.5 text-xs text-white focus:border-accent focus:outline-none"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-[9px] uppercase tracking-wider font-bold text-text-secondary font-mono">Description</label>
          <textarea
            required
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-black/40 border border-white-5 rounded-xl px-4 py-2.5 text-xs text-white focus:border-accent focus:outline-none resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-[9px] uppercase tracking-wider font-bold text-text-secondary font-mono">Base Price ($)</label>
            <input
              type="number"
              step="0.01"
              required
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full bg-black/40 border border-white-5 rounded-xl px-4 py-2.5 text-xs text-white focus:border-accent focus:outline-none"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-[9px] uppercase tracking-wider font-bold text-text-secondary font-mono">Discount ($ off)</label>
            <input
              type="number"
              step="0.01"
              value={discountAmount}
              onChange={(e) => setDiscountAmount(e.target.value)}
              className="w-full bg-black/40 border border-white-5 rounded-xl px-4 py-2.5 text-xs text-white focus:border-accent focus:outline-none"
            />
          </div>
        </div>

        {/* Media parameters */}
        <div className="border border-white-5 rounded-xl p-4 space-y-3 bg-white/2">
          <span className="block text-[9px] uppercase tracking-widest font-black text-white font-mono">Rich Media Banner</span>
          
          <div className="space-y-1.5">
            <label className="block text-[9px] uppercase tracking-wider font-bold text-text-secondary font-mono">Banner Image URL</label>
            <input
              type="url"
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
              className="w-full bg-black/40 border border-white-5 rounded-xl px-4 py-2.5 text-xs text-white focus:border-accent focus:outline-none"
            />
          </div>

          {mediaUrl.trim() && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-[9px] uppercase tracking-wider font-bold text-text-secondary font-mono">Aspect Ratio</label>
                <select
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value)}
                  className="w-full bg-black/60 border border-white-5 rounded-xl px-3 py-2.5 text-xs text-white focus:border-accent focus:outline-none"
                >
                  <option value="16:9">16:9 (Default Banner)</option>
                  <option value="4:3">4:3 (Traditional Card)</option>
                  <option value="1:1">1:1 (Square Profile)</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="block text-[9px] uppercase tracking-wider font-bold text-text-secondary font-mono">Display Order</label>
                <input
                  type="number"
                  min="1"
                  value={displayOrder}
                  onChange={(e) => setDisplayOrder(e.target.value)}
                  className="w-full bg-black/40 border border-white-5 rounded-xl px-4 py-2.5 text-xs text-white focus:border-accent focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* SKU Variants Pillar A section */}
        <div className="border border-white-5 rounded-xl p-4 space-y-4 bg-white/2">
          <div className="flex justify-between items-center">
            <span className="block text-[9px] uppercase tracking-widest font-black text-white font-mono">SKU Product Variants</span>
            <button
              type="button"
              onClick={handleAddSku}
              className="px-3 py-1 bg-white/5 hover:bg-white/10 border border-white-10 rounded-lg text-[9px] font-mono uppercase tracking-wider text-accent cursor-pointer"
            >
              + Add Variant
            </button>
          </div>

          {skus.length === 0 ? (
            <p className="text-[10px] font-mono text-text-secondary italic">No custom variants created. Buyers will receive default core package asset.</p>
          ) : (
            <div className="space-y-4 max-h-64 overflow-y-auto pr-1">
              {skus.map((sku, index) => (
                <div key={index} className="p-3 bg-black/30 border border-white-5 rounded-xl space-y-3 relative">
                  <button
                    type="button"
                    onClick={() => handleRemoveSku(index)}
                    className="absolute top-2 right-2 text-[9px] font-mono text-red-400 hover:text-red-300 font-bold uppercase"
                  >
                    Remove
                  </button>
                  <div className="text-[9px] font-mono font-black text-text-secondary uppercase">Variant #{index + 1}</div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[8px] uppercase tracking-wider font-mono text-text-secondary">Attribute (e.g. license_tier)</label>
                      <input
                        type="text"
                        required
                        value={sku.attribute_name}
                        onChange={(e) => handleSkuChange(index, 'attribute_name', e.target.value)}
                        className="w-full bg-black/50 border border-white-5 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] uppercase tracking-wider font-mono text-text-secondary">Value (e.g. enterprise)</label>
                      <input
                        type="text"
                        required
                        value={sku.attribute_value}
                        onChange={(e) => handleSkuChange(index, 'attribute_value', e.target.value)}
                        className="w-full bg-black/50 border border-white-5 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[8px] uppercase tracking-wider font-mono text-text-secondary">Additional Cost ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={sku.additional_cost}
                        onChange={(e) => handleSkuChange(index, 'additional_cost', e.target.value)}
                        className="w-full bg-black/50 border border-white-5 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] uppercase tracking-wider font-mono text-text-secondary">Inventory Count</label>
                      <input
                        type="number"
                        required
                        value={sku.inventory_count}
                        onChange={(e) => handleSkuChange(index, 'inventory_count', e.target.value)}
                        className="w-full bg-black/50 border border-white-5 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[8px] uppercase tracking-wider font-mono text-text-secondary">Secure File Payload Path (Optional)</label>
                    <input
                      type="text"
                      value={sku.file_payload_path}
                      onChange={(e) => handleSkuChange(index, 'file_payload_path', e.target.value)}
                      className="w-full bg-black/50 border border-white-5 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full py-3.5 bg-accent hover:bg-accent-hover disabled:opacity-50 text-velum-900 text-[10px] font-sans font-black uppercase tracking-widest rounded-xl transition cursor-pointer"
      >
        {isSubmitting ? 'Saving...' : 'Save'}
      </button>
    </form>
  );
}
