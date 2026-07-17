const fs = require('fs');
let code = fs.readFileSync('src/components/SidebarTabs/WalletMainDashboard.tsx', 'utf8');

const startIndex = code.indexOf('{/* Accounts List */}');
if (startIndex !== -1) {
  // Find the closing div for the activeTab === 'overview'
  // There is a '</div>' that closes the overview, and then a ')}' 
  // Let's just find `        </div>\n      )}\n\n      {activeTab === 'methods'`
  
  const endIndex = code.indexOf('        </div>\n      )}\n\n      {activeTab === \'methods\'', startIndex);
  if (endIndex !== -1) {
    code = code.substring(0, startIndex) + code.substring(endIndex);
    fs.writeFileSync('src/components/SidebarTabs/WalletMainDashboard.tsx', code);
    console.log("Successfully removed accounts list");
  } else {
    console.log("Could not find endIndex");
  }
} else {
  console.log("Could not find startIndex");
}
