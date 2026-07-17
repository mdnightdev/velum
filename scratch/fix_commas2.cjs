const fs = require('fs');
let code = fs.readFileSync('src/components/SidebarTabs/WalletMainDashboard.tsx', 'utf8');

code = code.replace(/parseFloat\(fundingAmount\.replace\(\/,\/g, ''\)\)/, "parseFloat(fundingAmount.replace(/[^0-9.]/g, ''))");
code = code.replace(/parseFloat\(exchangeAmount\.replace\(\/,\/g, ''\)\)/, "parseFloat(exchangeAmount.replace(/[^0-9.]/g, ''))");

fs.writeFileSync('src/components/SidebarTabs/WalletMainDashboard.tsx', code);
