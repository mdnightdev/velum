const fs = require('fs');
let code = fs.readFileSync('src/components/SidebarTabs/WalletMainDashboard.tsx', 'utf8');

code = code.replace(/Math\.floor\(parseFloat\(fundingAmount\) \* 100\)/, "Math.floor(parseFloat(fundingAmount.replace(/,/g, '')) * 100)");
code = code.replace(/Math\.floor\(parseFloat\(exchangeAmount\) \* 100\)/, "Math.floor(parseFloat(exchangeAmount.replace(/,/g, '')) * 100)");

fs.writeFileSync('src/components/SidebarTabs/WalletMainDashboard.tsx', code);
