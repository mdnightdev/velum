import React, { useState, useEffect } from 'react';
import { ShieldCheck, Search, Filter, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

interface AdminVerificationViewProps {
  adminRole: 'SUPPORT_ADMIN' | 'LOGIN_ADMIN';
  c: any;
}

export default function AdminVerificationView({ adminRole, c }: AdminVerificationViewProps) {
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'PENDING_REVIEW' | 'APPROVED' | 'REJECTED'>('PENDING_REVIEW');
  const [search, setSearch] = useState('');

  const loadVerificationQueue = async () => {
    try {
      setLoading(true);
      const sId = sessionStorage.getItem('velum-sessionId');
      // Assume we use a new admin endpoint or existing market endpoint to get all listings for admin
      const res = await fetch('/api/admin/verifications', {
        headers: { 'Authorization': `Bearer ${sId}` }
      });
      if (res.ok) {
        const data = await res.json();
        setListings(data);
      }
    } catch (e) {
      console.error('Failed to load verification queue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVerificationQueue();
  }, []);

  const handleReview = async (listingId: string, decision: 'APPROVED' | 'REJECTED') => {
    if (!window.confirm(`Are you sure you want to mark this listing as ${decision}?`)) return;
    try {
      const sId = sessionStorage.getItem('velum-sessionId');
      const res = await fetch(`/api/admin/verifications/${listingId}/review`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${sId}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ result: decision === 'APPROVED' ? 'PASS' : 'FAIL', notes: 'Manual admin review' })
      });
      if (res.ok) {
        loadVerificationQueue();
      } else {
        alert('Failed to submit review');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const filteredListings = listings
    .filter(l => l.verification_status === filter)
    .filter(l => l.title.toLowerCase().includes(search.toLowerCase()) || l.listing_id.toLowerCase().includes(search.toLowerCase()));

  if (adminRole !== 'LOGIN_ADMIN') {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4">
        <ShieldCheck className="w-16 h-16 text-text-disabled" />
        <p className="text-sm font-mono text-text-secondary">Insufficient clearance for this module.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className={c.bgCard}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-sans font-black tracking-tight text-white uppercase flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Listing Verification Queue
            </h2>
            <p className="text-[10px] font-mono text-text-secondary mt-1">
              REVIEW AND AUDIT MARKETPLACE ASSETS
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
              <input
                type="text"
                placeholder="Search listings..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-4 py-1.5 text-xs bg-velum-900 border border-white-10 rounded-xl text-white outline-none focus:border-accent w-48"
              />
            </div>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="px-3 py-1.5 text-xs bg-velum-900 border border-white-10 rounded-xl text-white outline-none focus:border-accent"
            >
              <option value="PENDING_REVIEW">Pending Review</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
        </div>
      </div>

      <div className={c.bgCard}>
        {loading ? (
          <div className="p-8 text-center text-xs font-mono text-text-secondary animate-pulse">Loading queue...</div>
        ) : filteredListings.length === 0 ? (
          <div className="p-8 text-center text-xs font-mono text-text-secondary">No listings match the current filters.</div>
        ) : (
          <div className="space-y-4">
            {filteredListings.map(listing => (
              <div key={listing.listing_id} className="p-4 bg-velum-900 border border-white-5 rounded-xl">
                <div className="flex flex-col md:flex-row justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-text-secondary">#{listing.listing_id.substring(0, 8)}</span>
                      {listing.verification_status === 'PENDING_REVIEW' && <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-amber-400/10 text-amber-400 border border-amber-400/20">PENDING</span>}
                      {listing.verification_status === 'APPROVED' && <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-400/10 text-emerald-400 border border-emerald-400/20">APPROVED</span>}
                      {listing.verification_status === 'REJECTED' && <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-rose-400/10 text-rose-400 border border-rose-400/20">REJECTED</span>}
                    </div>
                    <h3 className="text-sm font-bold text-white">{listing.title}</h3>
                    <p className="text-xs text-text-secondary line-clamp-2">{listing.description}</p>
                    <div className="flex gap-4 text-[10px] font-mono text-text-secondary">
                      <span>Price: ${(listing.price / 100).toFixed(2)}</span>
                      <span>Inventory: {listing.inventory_count}</span>
                      <span>Seller ID: {listing.seller_id}</span>
                    </div>
                  </div>
                  
                  {listing.verification_status === 'PENDING_REVIEW' && (
                    <div className="flex md:flex-col gap-2 shrink-0 justify-center">
                      <button
                        onClick={() => handleReview(listing.listing_id, 'APPROVED')}
                        className="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 text-[10px] font-bold uppercase rounded-xl border border-emerald-500/20 transition-colors flex items-center gap-1.5"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        Approve
                      </button>
                      <button
                        onClick={() => handleReview(listing.listing_id, 'REJECTED')}
                        className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 text-[10px] font-bold uppercase rounded-xl border border-rose-500/20 transition-colors flex items-center gap-1.5"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
