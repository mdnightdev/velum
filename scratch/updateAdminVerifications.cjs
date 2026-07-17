const fs = require('fs');
let code = fs.readFileSync('src/components/AdminVerificationView.tsx', 'utf8');

const replacement = `
import React, { useState, useEffect } from 'react';
import { ShieldCheck, Search, Filter, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

interface AdminVerificationViewProps {
  adminRole: 'SUPPORT_ADMIN' | 'LOGIN_ADMIN' | 'CLI_ADMIN';
  c: any;
}

export default function AdminVerificationView({ adminRole, c }: AdminVerificationViewProps) {
  const [activeTab, setActiveTab] = useState<'LISTINGS' | 'DISPUTES'>('LISTINGS');
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'PENDING_REVIEW' | 'APPROVED' | 'REJECTED'>('PENDING_REVIEW');
  const [search, setSearch] = useState('');
  
  // Disputes state
  const [disputes, setDisputes] = useState<any[]>([]);
  const [selectedDispute, setSelectedDispute] = useState<any | null>(null);

  const loadVerificationQueue = async () => {
    try {
      setLoading(true);
      const sId = sessionStorage.getItem('velum-sessionId');
      const res = await fetch('/api/admin/verifications', {
        headers: { 'Authorization': \`Bearer \${sId}\` }
      });
      if (res.ok) {
        const data = await res.json();
        setListings(data);
      }
      
      const dRes = await fetch('/api/marketplace/support-chats', {
        headers: { 'Authorization': \`Bearer \${sId}\` }
      });
      if (dRes.ok) {
        setDisputes(await dRes.json() || []);
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
    if (!window.confirm(\`Are you sure you want to mark this listing as \${decision}?\`)) return;
    try {
      const sId = sessionStorage.getItem('velum-sessionId');
      const res = await fetch(\`/api/admin/verifications/\${listingId}/review\`, {
        method: 'POST',
        headers: { 'Authorization': \`Bearer \${sId}\`, 'Content-Type': 'application/json' },
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

  const handleResolveDispute = async (chatId: string, resolution: string, penalty: string) => {
    try {
      setLoading(true);
      const sId = sessionStorage.getItem('velum-sessionId');
      const res = await fetch(\`/api/marketplace/support-chats/\${chatId}/resolve\`, {
        method: 'POST',
        headers: { 'Authorization': \`Bearer \${sId}\`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolution, penalty_applied_to: penalty })
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Failed to resolve dispute');
      } else {
        loadVerificationQueue();
        setSelectedDispute(null);
      }
    } catch (e) {
      console.error(e);
      alert('Network error resolving dispute');
    } finally {
      setLoading(false);
    }
  };

  const filteredListings = listings
    .filter(l => l.verification_status === filter)
    .filter(l => l.title.toLowerCase().includes(search.toLowerCase()) || l.listing_id.toLowerCase().includes(search.toLowerCase()));

  if (adminRole !== 'LOGIN_ADMIN' && adminRole !== 'CLI_ADMIN') {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4">
        <ShieldCheck className="w-16 h-16 text-text-disabled" />
        <p className="text-sm font-mono text-text-secondary">Insufficient clearance for this module.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex justify-end shrink-0">
        <div className="flex items-center gap-1.5 bg-velum-850 p-1.5 rounded-lg border border-white-5 shadow-inner">
          <button 
            onClick={() => setActiveTab('LISTINGS')}
            className={\`px-5 py-2.5 text-xs font-bold uppercase tracking-widest rounded-md transition-all flex items-center gap-2 \${
              activeTab === 'LISTINGS' 
                ? 'bg-velum-750 text-text-primary shadow-sm border border-white-10' 
                : 'text-text-secondary hover:text-text-primary border border-transparent'
            }\`}
          >
            <ShieldCheck className="w-4 h-4" />
            Verifications
          </button>
          <button 
            onClick={() => setActiveTab('DISPUTES')}
            className={\`px-5 py-2.5 text-xs font-bold uppercase tracking-widest rounded-md transition-all flex items-center gap-2 \${
              activeTab === 'DISPUTES' 
                ? 'bg-velum-750 text-text-primary shadow-sm border border-white-10' 
                : 'text-text-secondary hover:text-text-primary border border-transparent'
            }\`}
          >
            <AlertTriangle className="w-4 h-4" />
            Escrow Disputes
          </button>
        </div>
      </div>

      {activeTab === 'LISTINGS' && (
        <>
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
          <div className={c.bgCard + " flex-1 overflow-auto scrollbar-thin scrollbar-thumb-white-10 scrollbar-track-transparent"}>
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
                          <span>Price: \${(listing.price / 100).toFixed(2)}</span>
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
        </>
      )}
      
      {activeTab === 'DISPUTES' && (
        <div className="flex gap-6 h-full min-h-0 overflow-hidden">
          <div className="flex-1 bg-velum-900 border border-white-5 rounded-xl flex flex-col min-h-0">
             <div className="px-6 py-5 border-b border-white-5 shrink-0">
                <h2 className="font-bold text-text-primary text-sm uppercase tracking-widest flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-accent" /> Active Escrow Disputes</h2>
             </div>
             <div className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-white-10 scrollbar-track-transparent">
                <table className="w-full text-left whitespace-nowrap">
                  <thead className="sticky top-0 bg-velum-800/95 backdrop-blur z-10 text-[10px] font-black text-text-secondary uppercase tracking-[0.2em] border-b border-white-5">
                    <tr>
                      <th className="px-6 py-4">Dispute ID</th>
                      <th className="px-6 py-4">Created</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Escrow ID</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white-5 text-sm">
                    {disputes.map((dis, idx) => (
                      <tr key={idx} 
                          onClick={() => setSelectedDispute(dis)}
                          className={\`cursor-pointer transition-colors group \${selectedDispute?.chat_id === dis.chat_id ? 'bg-white-5' : 'hover:bg-white-2'}\`}>
                        <td className="px-6 py-5 font-mono text-[12px] text-text-primary">
                          {dis.chat_id}
                          <div className="text-[10px] text-text-secondary font-sans tracking-widest mt-1">Listing: {dis.listing_id}</div>
                        </td>
                        <td className="px-6 py-5 text-text-secondary text-xs">
                          {new Date(dis.created_at).toLocaleString()}
                        </td>
                        <td className="px-6 py-5">
                          <span className={\`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-widest border \${dis.status === 'open' ? 'bg-accent-10 text-accent border-accent-20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'}\`}>
                            {dis.status === 'open' ? 'Requires Action' : 'Resolved'}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-right font-mono text-[12px] text-text-secondary">
                          {dis.transaction_id || 'N/A'}
                        </td>
                      </tr>
                    ))}
                    {disputes.length === 0 && !loading && (
                      <tr>
                        <td colSpan={4} className="px-6 py-16 text-center text-text-secondary text-xs uppercase tracking-widest font-bold">
                          No active disputes
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
             </div>
          </div>
          
          {selectedDispute && (
           <div className="w-full lg:w-[360px] bg-velum-850 border border-white-5 rounded-xl flex flex-col shrink-0 shadow-lg min-h-0">
              <div className="px-6 py-5 border-b border-white-5 flex items-center justify-between shrink-0 bg-white-2 rounded-t-xl">
                <h3 className="font-bold text-text-primary text-sm uppercase tracking-widest">Dispute Resolution</h3>
                <button onClick={() => setSelectedDispute(null)} className="text-text-secondary hover:text-text-primary transition-colors p-1 bg-white-5 rounded-full hover:bg-white-10 border border-transparent hover:border-white-5">
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
              <div className="p-6 flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white-10 scrollbar-track-transparent">
                <div className="mb-8">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-text-secondary mb-2">Dispute Chat ID</div>
                  <div className="font-mono text-[12px] text-text-primary bg-white-5 p-3 rounded-lg border border-white-10 break-all font-medium">
                    {selectedDispute.chat_id}
                  </div>
                </div>
                
                <div className="space-y-5">
                  <div className="flex justify-between">
                    <span className="text-xs text-text-secondary font-bold uppercase tracking-widest">Listing ID</span>
                    <span className="text-[12px] font-mono text-text-primary">{selectedDispute.listing_id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-text-secondary font-bold uppercase tracking-widest">Escrow Tx</span>
                    <span className="text-[12px] font-mono text-text-primary">{selectedDispute.transaction_id || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-text-secondary font-bold uppercase tracking-widest">Status</span>
                    <span className="text-[12px] font-mono text-text-primary">{selectedDispute.status}</span>
                  </div>
                  {selectedDispute.resolution && (
                    <div className="flex justify-between">
                      <span className="text-xs text-text-secondary font-bold uppercase tracking-widest">Resolution</span>
                      <span className="text-[12px] font-mono text-text-primary">{selectedDispute.resolution.replace('_', ' ')}</span>
                    </div>
                  )}
                </div>
                
                {selectedDispute.status === 'open' && selectedDispute.transaction_id && (
                  <div className="mt-8 pt-6 border-t border-white-5 bg-white-2 -mx-6 px-6 -mb-6 pb-6 rounded-b-xl">
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-text-secondary mb-3">Resolution Actions</div>
                    
                    <div className="flex flex-col gap-3">
                      <button 
                        onClick={() => handleResolveDispute(selectedDispute.chat_id, 'RELEASE_TO_SELLER', 'BUYER')}
                        disabled={loading}
                        className="w-full py-3 rounded-lg text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-sm border bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20 disabled:opacity-50"
                      >
                        <CheckCircle className="w-4 h-4" /> Favor Seller (Release)
                      </button>
                      
                      <button 
                        onClick={() => handleResolveDispute(selectedDispute.chat_id, 'REFUND_TO_BUYER', 'SELLER')}
                        disabled={loading}
                        className="w-full py-3 rounded-lg text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-sm border bg-rose-500/10 text-rose-500 border-rose-500/20 hover:bg-rose-500/20 disabled:opacity-50"
                      >
                        <XCircle className="w-4 h-4" /> Favor Buyer (Refund)
                      </button>
                    </div>
                  </div>
                )}
              </div>
           </div>
          )}
        </div>
      )}
    </div>
  );
}
`;

fs.writeFileSync('src/components/AdminVerificationView.tsx', replacement);
