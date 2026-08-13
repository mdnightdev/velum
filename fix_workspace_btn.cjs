const fs = require('fs');

let code = fs.readFileSync('src/components/SidebarTabs/LoungeWorkspace.tsx', 'utf8');

// 1. Update canCreateSublounge
code = code.replace(
  'const canCreateSublounge = isOfficialLounge ? loungeData.isSystemAdmin : (loungeData.isParentAdmin || isLoungeCreator);',
  'const canCreateSublounge = !isOfficialLounge && (loungeData.isParentAdmin || isLoungeCreator);'
);

// 2. Hide create button in mobile view
code = code.replace(
  `<button\n                onClick={() => {\n                  loungeData.setStatusMessage('');\n                  loungeData.setShowCreateModal(true);\n                }}\n                className="p-2.5 bg-white-5 border border-white-5 hover:bg-white-10 text-text-secondary hover:text-white rounded-xl transition cursor-pointer"\n                title="Create Room"\n              >\n                <Plus className="w-4 h-4" />\n              </button>`,
  `{canCreateSublounge && (\n              <button\n                onClick={() => {\n                  loungeData.setStatusMessage('');\n                  loungeData.setShowCreateModal(true);\n                }}\n                className="p-2.5 bg-white-5 border border-white-5 hover:bg-white-10 text-text-secondary hover:text-white rounded-xl transition cursor-pointer"\n                title="Create Room"\n              >\n                <Plus className="w-4 h-4" />\n              </button>\n              )}`
);

fs.writeFileSync('src/components/SidebarTabs/LoungeWorkspace.tsx', code);
