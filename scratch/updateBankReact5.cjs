const fs = require('fs');
let code = fs.readFileSync('src/components/Admin/AdminBank.tsx', 'utf8');

const disputeDetailsCode = `
         {activeTab === 'DISPUTES' && selectedDispute && (
           <div className="w-full lg:w-[360px] bg-velum-850 border border-white-5 rounded-xl flex flex-col shrink-0 shadow-lg">
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
                  <DetailRow label="Listing ID" value={selectedDispute.listing_id} mono />
                  <DetailRow label="Escrow Tx" value={selectedDispute.transaction_id || 'N/A'} mono />
                  <DetailRow label="Status" value={selectedDispute.status} />
                  {selectedDispute.resolution && (
                    <DetailRow label="Resolution" value={selectedDispute.resolution.replace('_', ' ')} />
                  )}
                </div>
                
                {selectedDispute.status === 'open' && selectedDispute.transaction_id && (
                  <div className="mt-8 pt-6 border-t border-white-5 bg-white-2 -mx-6 px-6 -mb-6 pb-6 rounded-b-xl">
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-text-secondary mb-3">Resolution Actions</div>
                    
                    <div className="flex flex-col gap-3">
                      <button 
                        onClick={async () => {
                          setBankLoading(true);
                          const res = await adminFetch(\`/api/marketplace/support-chats/\${selectedDispute.chat_id}/resolve\`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ resolution: 'RELEASE_TO_SELLER', penalty_applied_to: 'BUYER' })
                          });
                          if (!res.ok) {
                            const data = await res.json();
                            setBankError(data.error);
                          } else {
                            fetchBankData();
                            setSelectedDispute(null);
                          }
                          setBankLoading(false);
                        }}
                        className="w-full py-3 rounded-lg text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-sm border bg-status-online/10 text-status-online border-status-online/20 hover:bg-status-online/20"
                      >
                        <CheckCircle2 className="w-4 h-4" /> Favor Seller (Release)
                      </button>
                      
                      <button 
                        onClick={async () => {
                          setBankLoading(true);
                          const res = await adminFetch(\`/api/marketplace/support-chats/\${selectedDispute.chat_id}/resolve\`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ resolution: 'REFUND_TO_BUYER', penalty_applied_to: 'SELLER' })
                          });
                          if (!res.ok) {
                            const data = await res.json();
                            setBankError(data.error);
                          } else {
                            fetchBankData();
                            setSelectedDispute(null);
                          }
                          setBankLoading(false);
                        }}
                        className="w-full py-3 rounded-lg text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-sm border bg-status-dnd/10 text-status-dnd border-status-dnd/20 hover:bg-status-dnd/20"
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
`;

code = code.replace(/<\/div>\n    <\/div>\n  \);\n\}/, `${disputeDetailsCode}\n    </div>\n  );\n}`);
fs.writeFileSync('src/components/Admin/AdminBank.tsx', code);
