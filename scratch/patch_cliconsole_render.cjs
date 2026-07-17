const fs = require('fs');
const path = 'src/components/CliConsole.tsx';
let code = fs.readFileSync(path, 'utf8');

// 1. Change terminalLogs to store command differently, maybe? No, let's just parse the string in render if it starts with 'admin@velum:'
const replaceRender = `
            {terminalLogs.map((log, idx) => {
              if (log.type === 'cmd') {
                const parts = log.text.split(' ');
                const prompt = parts[0];
                const cmdString = parts.slice(1).join(' ');
                
                // Parse prompt: admin@velum:~ or /sys etc
                const dirPart = prompt.split(':')[1]?.replace('$', '') || '~';
                
                return (
                  <div key={idx} className="whitespace-pre-wrap leading-relaxed">
                    <span className="text-emerald-400 font-semibold">admin@velum</span>
                    <span className="text-white/40 font-semibold">:</span>
                    <span className="text-sky-400 font-semibold">{dirPart}</span>
                    <span className="text-white/40 font-semibold mr-2">$</span>
                    <span className="text-text-primary font-medium">{cmdString}</span>
                  </div>
                );
              }
              
              return (
                <div key={idx} className="whitespace-pre-wrap leading-relaxed">
                  {log.type === 'error' ? (
                    <span className="text-rose-400 font-mono block bg-rose-950/20 px-3 py-2 rounded-md border border-rose-900/30">
                      {log.text}
                    </span>
                  ) : (
                    <span className="text-text-primary/90 block px-1">{log.text}</span>
                  )}
                </div>
              );
            })}
`;

code = code.replace(/\{terminalLogs\.map\(\(log, idx\) => \([\s\S]*?<\span className="text-text-primary opacity-95">\{log\.text\}<\/span>\n                \)\}\n              <\/div>\n            \)\)\}/, replaceRender.trim());

// 2. Change the input label
const replaceInput = `
            <label htmlFor="terminal-input" className="font-mono text-xs font-semibold whitespace-nowrap select-none flex items-center">
              <span className="text-emerald-400">admin@velum</span>
              <span className="text-white/40">:</span>
              <span className="text-sky-400">{currentDir === '/' ? '~' : currentDir}</span>
              <span className="text-white/40 mr-2">$</span>
            </label>
`;

code = code.replace(/<label htmlFor="terminal-input" className="text-accent font-bold whitespace-nowrap">\n              \{getPromptLabel\(\)\}&nbsp;\n            <\/label>/, replaceInput.trim());

// 3. Make the main terminal container sleeker
code = code.replace(/<div \n            ref=\{terminalScrollRef\}\n            className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-xs text-text-primary bg-black\/10 min-h-\[300px\]"\n          >/, `<div \n            ref={terminalScrollRef}\n            className="flex-1 overflow-y-auto p-5 space-y-2.5 font-mono text-xs sm:text-[13px] text-text-primary bg-[#0d1117] min-h-[300px]"\n          >`);

// 4. Make input form sleeker
code = code.replace(/<form \n            onSubmit=\{executeCommand\}\n            className="flex items-center gap-2 p-3 bg-black\/20 border-t border-white-5"\n          >/, `<form \n            onSubmit={executeCommand}\n            className="flex items-center px-5 py-4 bg-[#0d1117] border-t border-white-5"\n          >`);

// 5. Change input focus ring and text
code = code.replace(/className="flex-1 bg-transparent text-text-primary font-mono text-xs border-none outline-none focus:ring-0"/, `className="flex-1 bg-transparent text-text-primary font-mono text-xs sm:text-[13px] font-medium border-none outline-none focus:ring-0 placeholder:text-white/20"`);

// Remove the second autoComplete
code = code.replace(/autoComplete="off"\n            \/>/, `/>`);

fs.writeFileSync(path, code);
