const fs = require('fs');
let code = fs.readFileSync('src/components/Admin/AdminBank.tsx', 'utf8');

// First, remove the bad insertion from KpiCard
const badInsertion = `
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
        )}`;

code = code.replace(badInsertion, '');

// Now find the end of AdminBank which is just before 'function KpiCard'
const correctInsertionPoint = /<\/div>\n    <\/div>\n  \);\n\}\n\nfunction KpiCard/;
const realContentReplacement = `
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

function KpiCard`;

code = code.replace(correctInsertionPoint, realContentReplacement);
fs.writeFileSync('src/components/Admin/AdminBank.tsx', code);
