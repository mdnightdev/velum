const fs = require('fs');

const filePath = 'src/views/UserWorkspace/SettingsDrawer.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Replace state definition
content = content.replace(
  "const [activeCategory, setActiveCategory] = useState<SettingCategory>('account');",
  "const [activeView, setActiveView] = useState<SettingCategory | 'menu'>('menu');"
);

// Replace state setters
content = content.replace(/setActiveCategory\(/g, 'setActiveView(');

// Use exact replace for the menu section wrap
content = content.replace(
  '<div className="flex-shrink-0 w-full md:w-72 bg-[#08090C] border-b md:border-b-0 md:border-r border-white/5 overflow-y-auto">',
  `{activeView === 'menu' && (
          <div className="flex-shrink-0 w-full md:w-72 bg-[#08090C] border-b md:border-b-0 md:border-r border-white/5 overflow-y-auto">`
);

// We find the end of the menu div and close the conditional
const menuEndRegex = /<\/div>\n\s*<\/div>\n\s*<div className="flex-1 bg/g;
content = content.replace(menuEndRegex, `</div>\n            </div>\n          )}\n\n          <div className="flex-1 bg`);

// Start the content conditional
content = content.replace(
  '<div className="flex-1 bg-[#050608] p-4 md:p-8 overflow-y-auto">',
  `{activeView !== 'menu' && (
          <div className="flex-1 bg-[#050608] p-4 md:p-8 overflow-y-auto">
            <div className="mb-6 flex items-center">
              <button 
                onClick={() => setActiveView('menu')}
                className="flex items-center gap-2 text-zinc-400 hover:text-white transition cursor-pointer"
              >
                <ChevronRight className="w-4 h-4 rotate-180" />
                <span className="text-[10px] uppercase font-bold font-mono tracking-widest">Back</span>
              </button>
            </div>`
);

// Replace activeCategory reads
content = content.replace(/activeCategory === /g, 'activeView === ');

// Close the content conditional at the end
// Let's find the closing tags of the content div
// "          </div>\n        </div>\n\n      </div>\n    </div>\n  );\n}"
content = content.replace(
  /          <\/div>\n        <\/div>\n\n      <\/div>\n    <\/div>\n  \);\n}/,
  `          </div>\n          )}\n        </div>\n\n      </div>\n    </div>\n  );\n}`
);

fs.writeFileSync(filePath, content);
console.log('Done refactoring');
