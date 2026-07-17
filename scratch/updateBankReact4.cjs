const fs = require('fs');
let code = fs.readFileSync('src/components/Admin/AdminBank.tsx', 'utf8');

const additionalTabsCode = `
              {activeTab === 'LIQUIDITY' && (
                <div className="p-6">
                  <div className="max-w-2xl mx-auto">
                    <h2 className="text-xl font-bold mb-6 font-display uppercase tracking-widest text-text-primary">Liquidity Management</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                      <div className="bg-white-5 border border-white-10 rounded-xl p-6 hover:bg-white-10 transition-colors">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="font-bold text-text-primary uppercase tracking-widest text-sm">Mint Currency</h3>
                          <ArrowUpRight className="w-5 h-5 text-status-online" />
                        </div>
                        <p className="text-sm text-text-secondary mb-6">Inject fresh capital directly into the Central Liquidity Reserve.</p>
                        <form onSubmit={async (e) => {
                          e.preventDefault();
                          const amount = Number((e.target as any).amount.value);
                          const desc = (e.target as any).desc.value;
                          const clr = bankAccounts.find(a => a.account_name.includes('CENTRAL'));
                          if (!clr) { setBankError('Central reserve account not found.'); return; }
                          
                          setBankLoading(true);
                          const res = await adminFetch(\`/api/bank/accounts/\${clr.account_id}/adjust\`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ amount_cents: Math.floor(amount * 100), description: desc || 'Administrative Mint' })
                          });
                          if (!res.ok) {
                            const data = await res.json();
                            setBankError(data.error);
                          } else {
                            (e.target as any).reset();
                            fetchBankData();
                          }
                          setBankLoading(false);
                        }}>
                          <div className="mb-4">
                            <label className="block text-[10px] font-black text-text-secondary uppercase tracking-[0.2em] mb-2">Amount (NT$)</label>
                            <input type="number" name="amount" min="1" step="0.01" required className="w-full bg-white-5 border border-white-10 rounded-lg px-4 py-3 text-text-primary font-mono text-sm focus:outline-none focus:border-accent-40" placeholder="e.g. 50000" />
                          </div>
                          <div className="mb-6">
                            <label className="block text-[10px] font-black text-text-secondary uppercase tracking-[0.2em] mb-2">Audit Description</label>
                            <input type="text" name="desc" required className="w-full bg-white-5 border border-white-10 rounded-lg px-4 py-3 text-text-primary text-sm focus:outline-none focus:border-accent-40" placeholder="Reason for minting..." />
                          </div>
                          <button type="submit" disabled={bankLoading} className="w-full py-3 bg-status-online/20 text-status-online hover:bg-status-online/30 border border-status-online/30 rounded-lg font-bold text-xs uppercase tracking-widest transition-colors">
                            Execute Mint
                          </button>
                        </form>
                      </div>
                      
                      <div className="bg-white-5 border border-white-10 rounded-xl p-6 hover:bg-white-10 transition-colors">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="font-bold text-text-primary uppercase tracking-widest text-sm">Burn Currency</h3>
                          <ArrowDownRight className="w-5 h-5 text-status-dnd" />
                        </div>
                        <p className="text-sm text-text-secondary mb-6">Remove capital permanently from the Central Liquidity Reserve.</p>
                        <form onSubmit={async (e) => {
                          e.preventDefault();
                          const amount = Number((e.target as any).amount.value);
                          const desc = (e.target as any).desc.value;
                          const clr = bankAccounts.find(a => a.account_name.includes('CENTRAL'));
                          if (!clr) { setBankError('Central reserve account not found.'); return; }
                          
                          setBankLoading(true);
                          const res = await adminFetch(\`/api/bank/accounts/\${clr.account_id}/adjust\`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ amount_cents: -Math.floor(amount * 100), description: desc || 'Administrative Burn' })
                          });
                          if (!res.ok) {
                            const data = await res.json();
                            setBankError(data.error);
                          } else {
                            (e.target as any).reset();
                            fetchBankData();
                          }
                          setBankLoading(false);
                        }}>
                          <div className="mb-4">
                            <label className="block text-[10px] font-black text-text-secondary uppercase tracking-[0.2em] mb-2">Amount (NT$)</label>
                            <input type="number" name="amount" min="1" step="0.01" required className="w-full bg-white-5 border border-white-10 rounded-lg px-4 py-3 text-text-primary font-mono text-sm focus:outline-none focus:border-accent-40" placeholder="e.g. 10000" />
                          </div>
                          <div className="mb-6">
                            <label className="block text-[10px] font-black text-text-secondary uppercase tracking-[0.2em] mb-2">Audit Description</label>
                            <input type="text" name="desc" required className="w-full bg-white-5 border border-white-10 rounded-lg px-4 py-3 text-text-primary text-sm focus:outline-none focus:border-accent-40" placeholder="Reason for burning..." />
                          </div>
                          <button type="submit" disabled={bankLoading} className="w-full py-3 bg-status-dnd/20 text-status-dnd hover:bg-status-dnd/30 border border-status-dnd/30 rounded-lg font-bold text-xs uppercase tracking-widest transition-colors">
                            Execute Burn
                          </button>
                        </form>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {activeTab === 'DISPUTES' && (
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
                          <span className={\`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-widest border \${dis.status === 'open' ? 'bg-accent-10 text-accent border-accent-20' : 'bg-status-online/10 text-status-online border-status-online/20'}\`}>
                            {dis.status === 'open' ? 'Requires Action' : 'Resolved'}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-right font-mono text-[12px] text-text-secondary">
                          {dis.transaction_id || 'N/A'}
                        </td>
                      </tr>
                    ))}
                    {disputes.length === 0 && !bankLoading && (
                      <tr>
                        <td colSpan={4} className="px-6 py-16 text-center text-text-secondary text-xs uppercase tracking-widest font-bold">
                          No active disputes
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
`;

code = code.replace(/<\/div>\n         <\/div>\n         \n         \{activeTab === 'BALANCES' && selectedAccount && \(/, `${additionalTabsCode}\n            </div>\n         </div>\n         \n         {activeTab === 'BALANCES' && selectedAccount && (`);
fs.writeFileSync('src/components/Admin/AdminBank.tsx', code);
