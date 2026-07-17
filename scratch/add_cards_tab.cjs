const fs = require('fs');
let code = fs.readFileSync('src/components/Admin/AdminBank.tsx', 'utf8');

const tabButton = `
          <button 
            onClick={() => { setActiveTab('ISSUED_CARDS'); setSelectedTx(null); setSelectedAccount(null); setSelectedWithdrawal(null); }}
            className={\`px-5 py-2.5 text-xs font-bold uppercase tracking-widest rounded-md transition-all flex items-center gap-2 whitespace-nowrap shrink-0 \${
              activeTab === 'ISSUED_CARDS' 
                ? 'bg-velum-750 text-text-primary shadow-sm border border-white-10' 
                : 'text-text-secondary hover:text-text-primary border border-transparent'
            }\`}
          >
            <CreditCard className="w-4 h-4" />
            Issued Cards
          </button>
        </div>
      </div>`;

code = code.replace(/<\/div>\s*<\/div>\s*\{\/\* Data Section \*\/\}/, tabButton + "\n      {/* Data Section */}");

const cardsView = `
              {activeTab === 'ISSUED_CARDS' && (
                <table className="w-full text-left whitespace-nowrap">
                  <thead className="sticky top-0 bg-velum-800/95 backdrop-blur z-10 text-[10px] font-black text-text-secondary uppercase tracking-[0.2em] border-b border-white-5">
                    <tr>
                      <th className="px-6 py-4">User ID</th>
                      <th className="px-6 py-4">Institution / Card</th>
                      <th className="px-6 py-4 text-right">Credit Limit / Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white-5 text-sm">
                    {issuedCards.map((card, idx) => {
                      const limit = card.institution.includes('Titanium') ? (limitsData[0]?.max_limit_cents || 5000000) 
                                   : card.institution.includes('Black') ? (limitsData[0]?.max_limit_cents || 1500000)
                                   : card.institution.includes('Platinum') ? (limitsData[0]?.max_limit_cents || 500000)
                                   : (limitsData[0]?.max_limit_cents || 50000);
                      
                      const usedAmount = limit - card.available_cents;

                      return (
                      <tr key={idx} className="hover:bg-white-2 transition-colors">
                        <td className="px-6 py-5 font-mono text-[12px] text-text-secondary">
                          USR-{card.user_id}
                        </td>
                        <td className="px-6 py-5">
                          <div className="font-bold text-text-primary tracking-wide">{card.institution}</div>
                          <div className="text-[11px] text-text-secondary mt-1">
                            {card.account_kind} • {card.masked_number}
                          </div>
                        </td>
                        <td className="px-6 py-5 text-right font-mono text-[13px] text-text-primary">
                          <div className="text-text-primary">
                            Limit: $\\{ (limit / 100).toFixed(2) }
                          </div>
                          <div className={\`text-[11px] mt-1 \${usedAmount > 0 ? 'text-status-offline font-bold' : 'text-status-online'}\`}>
                            Balance: $\\{ ((card.available_cents - limit) / 100).toFixed(2) }
                          </div>
                        </td>
                      </tr>
                    )})}
                    {issuedCards.length === 0 && !bankLoading && (
                      <tr>
                        <td colSpan={3} className="px-6 py-16 text-center text-text-secondary text-xs uppercase tracking-widest font-bold">
                          No issued cards found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}`;

code = code.replace(/\{activeTab === 'LIMITS_MONITORING' && \(/, cardsView + "\n              {activeTab === 'LIMITS_MONITORING' && (");

if (!code.includes('CreditCard')) {
  code = code.replace(/Activity, /g, "Activity, CreditCard, ");
}

fs.writeFileSync('src/components/Admin/AdminBank.tsx', code);
