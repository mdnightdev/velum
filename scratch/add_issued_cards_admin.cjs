const fs = require('fs');
let code = fs.readFileSync('src/components/Admin/AdminBank.tsx', 'utf8');

// Add state
code = code.replace(/const \[limitsData, setLimitsData\] = useState<any\[\]>\(\[\]\);/, "const [limitsData, setLimitsData] = useState<any[]>([]);\n  const [issuedCards, setIssuedCards] = useState<any[]>([]);");

// Add to fetchBankData
const fetchReplacement = `
      const lRes = await adminFetch('/api/bank/limits');
      if (lRes.ok) {
        setLimitsData(await lRes.json() || []);
      }
      const cRes = await adminFetch('/api/bank/issued-cards');
      if (cRes.ok) {
        setIssuedCards(await cRes.json() || []);
      }
`;
code = code.replace(/const lRes = await adminFetch\('\/api\/bank\/limits'\);\n      if \(lRes\.ok\) \{\n        setLimitsData\(await lRes\.json\(\) \|\| \[\]\);\n      \}/, fetchReplacement);

// Add Tab
code = code.replace(/setActiveTab\] = useState<'BALANCES' \| 'LEDGER' \| 'PAYMENT_QUEUE' \| 'LIMITS_MONITORING' \| 'LIQUIDITY'>\('BALANCES'\);/, "setActiveTab] = useState<'BALANCES' | 'LEDGER' | 'PAYMENT_QUEUE' | 'LIMITS_MONITORING' | 'LIQUIDITY' | 'ISSUED_CARDS'>('BALANCES');");

const tabReplacement = `
          <button 
            onClick={() => setActiveTab('LIQUIDITY')} 
            className={\`px-4 py-2 font-medium text-sm transition-colors \${activeTab === 'LIQUIDITY' ? 'text-accent border-b-2 border-accent' : 'text-text-secondary hover:text-white'}\`}
          >
            Liquidity
          </button>
          <button 
            onClick={() => setActiveTab('ISSUED_CARDS')} 
            className={\`px-4 py-2 font-medium text-sm transition-colors \${activeTab === 'ISSUED_CARDS' ? 'text-accent border-b-2 border-accent' : 'text-text-secondary hover:text-white'}\`}
          >
            Issued Cards
          </button>
`;
code = code.replace(/<button \n            onClick=\{\(\) => setActiveTab\('LIQUIDITY'\)\} \n            className=\{`px-4 py-2 font-medium text-sm transition-colors \$\{activeTab === 'LIQUIDITY' \? 'text-accent border-b-2 border-accent' : 'text-text-secondary hover:text-white'\}`\}\n          >\n            Liquidity\n          <\/button>/, tabReplacement);

// Add content for ISSUED_CARDS tab
const contentReplacement = `
        {activeTab === 'ISSUED_CARDS' && (
          <div className="bg-surface border border-white-10 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-white-10">
              <h2 className="font-semibold">Issued Credit & Debit Cards</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-white-5 text-text-secondary">
                  <tr>
                    <th className="p-4 font-medium">User ID</th>
                    <th className="p-4 font-medium">Institution</th>
                    <th className="p-4 font-medium">Kind</th>
                    <th className="p-4 font-medium">Number</th>
                    <th className="p-4 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {issuedCards.map((card, i) => (
                    <tr key={i} className="border-b border-white-5 hover:bg-white-5 transition-colors">
                      <td className="p-4 font-mono">{card.user_id}</td>
                      <td className="p-4">{card.institution}</td>
                      <td className="p-4">{card.account_kind}</td>
                      <td className="p-4 font-mono">{card.masked_number}</td>
                      <td className="p-4 text-text-secondary">{new Date(card.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                  {issuedCards.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-text-secondary">No issued cards found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
`;
code = code.replace(/<\/div>\n    <\/div>\n  \);\n\}/, contentReplacement);

fs.writeFileSync('src/components/Admin/AdminBank.tsx', code);
