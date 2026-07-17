const fs = require('fs');

let code = fs.readFileSync('src/components/SidebarTabs/WalletMainDashboard.tsx', 'utf8');

// Fix the total computations
const oldTotalPrimary = `  const totalInPrimary = balances.reduce((sum, b) => {
    return sum + convertAmount(b.balance_cents / 100, b.currency_code, preferredFiat);
  }, 0);`;

const newTotalPrimary = `  const totalInPrimary = balances.reduce((sum, b) => {
    if (b.currency_code === 'VLM') return sum;
    return sum + convertAmount(b.balance_cents / 100, b.currency_code, preferredFiat);
  }, 0);`;

code = code.replace(oldTotalPrimary, newTotalPrimary);

const oldTotalVlm = `  const totalInVLM = balances.reduce((sum, b) => {
    return sum + convertAmount(b.balance_cents / 100, b.currency_code, 'VLM');
  }, 0);`;

const newTotalVlm = `  const totalInVLM = balances.reduce((sum, b) => {
    if (b.currency_code !== 'VLM') return sum;
    return sum + (b.balance_cents / 100);
  }, 0);`;

code = code.replace(oldTotalVlm, newTotalVlm);

// Fix the UI (remove ≈)
code = code.replace(
  /<span className="text-sm font-medium tracking-wide">≈ \{totalInVLM\.toLocaleString\(undefined, \{ maximumFractionDigits: 2 \}\)\} VLM<\/span>/,
  '<span className="text-sm font-medium tracking-wide">{totalInVLM.toLocaleString(undefined, { maximumFractionDigits: 2 })} VLM</span>'
);

// Remove the Accounts List block completely
const accountsListRegex = /\{\/\* Accounts List \*\/\}[\\s\\S]*?<\/div>\s*<\/div>/;
code = code.replace(accountsListRegex, '');

fs.writeFileSync('src/components/SidebarTabs/WalletMainDashboard.tsx', code);
