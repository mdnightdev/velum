const fs = require('fs');

let code = fs.readFileSync('src/components/SidebarTabs/LoungeWorkspace.tsx', 'utf8');

if (!code.includes('import LoungeOverview')) {
  code = code.replace(
    "import { LoungeWorkspaceProps } from '../Lounge/types';",
    "import { LoungeWorkspaceProps } from '../Lounge/types';\nimport LoungeOverview from '../Lounge/LoungeOverview';"
  );
}

// Update Desktop empty state
code = code.replace(
  `<div className="flex-1 flex items-center justify-center text-text-secondary text-xs uppercase tracking-widest min-h-0 select-none">\n                Select a room to join the conversation\n              </div>`,
  `<LoungeOverview\n                loungeName={effectiveLoungeName}\n                loungeDetails={loungeData.loungeDetails}\n                memberCount={loungeData.members.length}\n                isDark={props.isDark}\n                isLoungeCreator={isLoungeCreator}\n                handleCopyInvite={handleCopyInvite}\n                copiedInvite={copiedInvite}\n              />`
);

// Update Mobile about tab
code = code.replace(
  `<div className="p-6 flex flex-col gap-6">\n              <div className="text-center text-text-secondary text-xs uppercase tracking-widest">About {props.loungeName}</div>\n              {isLoungeCreator && loungeData.loungeDetails?.invite_code && (\n                <div className="p-4 bg-velum-800 border border-white-5 rounded-2xl flex flex-col gap-2 max-w-sm mx-auto w-full shadow-lg">\n                  <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-secondary select-none">Lounge Invite Code</div>\n                  <div className="flex items-center justify-between gap-3">\n                    <span className="font-mono text-sm font-bold text-accent tracking-widest select-all">{loungeData.loungeDetails.invite_code}</span>\n                    <button\n                      onClick={handleCopyInvite}\n                      className="px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-widest bg-accent-10 hover:bg-accent-20 text-accent rounded-xl transition active:scale-95 cursor-pointer shrink-0"\n                    >\n                      {copiedInvite ? 'Copied' : 'Copy'}\n                    </button>\n                  </div>\n                </div>\n              )}\n            </div>`,
  `<LoungeOverview\n              loungeName={effectiveLoungeName}\n              loungeDetails={loungeData.loungeDetails}\n              memberCount={loungeData.members.length}\n              isDark={props.isDark}\n              isLoungeCreator={isLoungeCreator}\n              handleCopyInvite={handleCopyInvite}\n              copiedInvite={copiedInvite}\n            />`
);

fs.writeFileSync('src/components/SidebarTabs/LoungeWorkspace.tsx', code);
