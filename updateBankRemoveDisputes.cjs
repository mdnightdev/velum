const fs = require('fs');
let code = fs.readFileSync('src/components/Admin/AdminBank.tsx', 'utf8');

code = code.replace(/const \[activeTab, setActiveTab\] = useState<'BALANCES' \| 'LEDGER' \| 'PAYMENT_QUEUE' \| 'LIMITS_MONITORING' \| 'LIQUIDITY' \| 'DISPUTES'>\('BALANCES'\);/g, 
  "const [activeTab, setActiveTab] = useState<'BALANCES' | 'LEDGER' | 'PAYMENT_QUEUE' | 'LIMITS_MONITORING' | 'LIQUIDITY'>('BALANCES');");

code = code.replace(/const \[disputes, setDisputes\] = useState<any\[\]>\(\[\]\);\n  const \[selectedDispute, setSelectedDispute\] = useState<any \| null>\(null\);/g, "");

code = code.replace(/const dRes = await adminFetch\('\/api\/marketplace\/support-chats'\);\n      if \(dRes\.ok\) \{\n        setDisputes\(await dRes\.json\(\) \|\| \[\]\);\n      \}/g, "");

code = code.replace(/<button \s*onClick=\{\(\) => \{ setActiveTab\('DISPUTES'\); setSelectedTx\(null\); setSelectedAccount\(null\); setSelectedWithdrawal\(null\); setSelectedDispute\(null\); \}\}[\s\S]*?<\/button>/, "");

// also remove setSelectedDispute(null); from other tab buttons
code = code.replace(/setSelectedDispute\(null\); /g, "");

fs.writeFileSync('src/components/Admin/AdminBank.tsx', code);
