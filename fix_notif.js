const fs = require('fs');
let code = fs.readFileSync('src/components/SidebarTabs/NotificationsMainDashboard.tsx', 'utf-8');
code = code.replace(/VELUM NODE TRANSACTION MESSAGES\s*<\/p>\s*<\/div>/, '<div id="notifications_dashboard" className="flex-1 overflow-y-auto bg-velum-900 p-6 lg:p-8 space-y-6 select-none">');
fs.writeFileSync('src/components/SidebarTabs/NotificationsMainDashboard.tsx', code);
