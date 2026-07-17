const fs = require('fs');
let code = fs.readFileSync('src/components/Admin/AdminBank.tsx', 'utf8');

// 1. Add tabs to the state
code = code.replace(/const \[activeTab, setActiveTab\] = useState<'BALANCES' \| 'LEDGER' \| 'PAYMENT_QUEUE' \| 'LIMITS_MONITORING'>\('BALANCES'\);/g, 
  "const [activeTab, setActiveTab] = useState<'BALANCES' | 'LEDGER' | 'PAYMENT_QUEUE' | 'LIMITS_MONITORING' | 'LIQUIDITY' | 'DISPUTES'>('BALANCES');");

// 2. Add disputes to state
code = code.replace(/const \[limitsData, setLimitsData\] = useState<any\[\]>\(\[\]\);/g, 
  "const [limitsData, setLimitsData] = useState<any[]>([]);\n  const [disputes, setDisputes] = useState<any[]>([]);\n  const [selectedDispute, setSelectedDispute] = useState<any | null>(null);");

// 3. Fetch disputes
code = code.replace(/const lRes = await adminFetch\('\/api\/bank\/limits'\);\n      if \(lRes\.ok\) \{\n        setLimitsData\(await lRes\.json\(\) \|\| \[\]\);\n      \}/g,
  `const lRes = await adminFetch('/api/bank/limits');
      if (lRes.ok) {
        setLimitsData(await lRes.json() || []);
      }
      const dRes = await adminFetch('/api/marketplace/support-chats');
      if (dRes.ok) {
        setDisputes(await dRes.json() || []);
      }`);

fs.writeFileSync('src/components/Admin/AdminBank.tsx', code);
