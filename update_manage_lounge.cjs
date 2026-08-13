const fs = require('fs');

let code = fs.readFileSync('src/components/Lounge/ManageLoungeModal.tsx', 'utf8');

const regexPreview = /\{\/\* Live Preview Card \*\/\}.*?\{\/\* Editable Fields \*\/\}/s;

const newHeader = `{/* Premium Vetting Settings Layout */}
              <div className="relative rounded-2xl bg-velum-800 border border-white-10 overflow-hidden shadow-xl mb-6">
                {/* Banner Area */}
                <div className="h-28 relative bg-gradient-to-r from-accent/30 via-accent/10 to-transparent">
                  <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
                  {/* Banner Image could go here if Lounge had one */}
                </div>
                
                {/* Profile Details Bar */}
                <div className="px-6 pb-5 pt-0 relative flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-10">
                  <div className="flex items-end gap-4">
                    <div className="relative group shrink-0">
                      <div className="w-20 h-20 rounded-2xl border-4 border-velum-850 bg-velum-800 flex items-center justify-center font-bold text-3xl text-accent overflow-hidden shadow-2xl">
                        {(croppingIcon?.src || editIconUrl || loungeIconFile) ? (
                          <img
                            src={croppingIcon ? croppingIcon.src : (loungeIconFile ? URL.createObjectURL(loungeIconFile) : editIconUrl)}
                            alt="Lounge Icon"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span>{(editName || loungeName || 'L').slice(0, 2).toUpperCase()}</span>
                        )}
                      </div>
                      
                      <label className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 rounded-2xl transition-opacity cursor-pointer">
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/gif,image/webp"
                          className="hidden"
                          onChange={handleIconFileSelect}
                          disabled={isUploadingIcon}
                        />
                        {isUploadingIcon ? (
                          <Loader2 className="w-5 h-5 animate-spin text-accent" />
                        ) : (
                          <Upload className="w-5 h-5 text-text-primary" />
                        )}
                      </label>
                    </div>
                    
                    <div className="mb-1">
                      <h4 className="text-lg font-bold text-text-primary leading-none tracking-widest uppercase">{editName || loungeName || 'Unnamed Lounge'}</h4>
                      <p className="text-xs font-mono text-accent mt-1">Workspace Configuration</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Editable Fields */}`;

code = code.replace(regexPreview, newHeader);

const regexIconField = /<div>\s*<label className="block text-\[10px\] font-bold uppercase tracking-widest mb-1\.5 text-text-secondary">\s*Icon\s*<\/label>[\s\S]*?<\/div>[\s\S]*?\{uploadError && \([\s\S]*?<\/div>\s*\)\}/;

code = code.replace(regexIconField, `
                {uploadError && (
                  <div className="text-[10px] text-alert-error font-mono mt-1">{uploadError}</div>
                )}
`);

fs.writeFileSync('src/components/Lounge/ManageLoungeModal.tsx', code);
