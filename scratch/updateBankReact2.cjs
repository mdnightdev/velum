const fs = require('fs');
let code = fs.readFileSync('src/components/Admin/AdminBank.tsx', 'utf8');

const tabButtons = `
          <button 
            onClick={() => { setActiveTab('LIMITS_MONITORING'); setSelectedTx(null); setSelectedAccount(null); setSelectedWithdrawal(null); setSelectedDispute(null); }}
            className={\`px-5 py-2.5 text-xs font-bold uppercase tracking-widest rounded-md transition-all flex items-center gap-2 whitespace-nowrap shrink-0 \${
              activeTab === 'LIMITS_MONITORING' 
                ? 'bg-velum-750 text-text-primary shadow-sm border border-white-10' 
                : 'text-text-secondary hover:text-text-primary border border-transparent'
            }\`}
          >
            <Activity className="w-4 h-4" />
            Limits
          </button>
          <button 
            onClick={() => { setActiveTab('LIQUIDITY'); setSelectedTx(null); setSelectedAccount(null); setSelectedWithdrawal(null); setSelectedDispute(null); }}
            className={\`px-5 py-2.5 text-xs font-bold uppercase tracking-widest rounded-md transition-all flex items-center gap-2 whitespace-nowrap shrink-0 \${
              activeTab === 'LIQUIDITY' 
                ? 'bg-velum-750 text-text-primary shadow-sm border border-white-10' 
                : 'text-text-secondary hover:text-text-primary border border-transparent'
            }\`}
          >
            <PieChart className="w-4 h-4" />
            Mint / Burn
          </button>
          <button 
            onClick={() => { setActiveTab('DISPUTES'); setSelectedTx(null); setSelectedAccount(null); setSelectedWithdrawal(null); setSelectedDispute(null); }}
            className={\`px-5 py-2.5 text-xs font-bold uppercase tracking-widest rounded-md transition-all flex items-center gap-2 whitespace-nowrap shrink-0 \${
              activeTab === 'DISPUTES' 
                ? 'bg-velum-750 text-text-primary shadow-sm border border-white-10' 
                : 'text-text-secondary hover:text-text-primary border border-transparent'
            }\`}
          >
            <AlertTriangle className="w-4 h-4" />
            Escrow Disputes
          </button>
`;

code = code.replace(/<button \s*onClick=\{\(\) => \{ setActiveTab\('LIMITS_MONITORING'\);[\s\S]*?<\/button>/, tabButtons);
fs.writeFileSync('src/components/Admin/AdminBank.tsx', code);
