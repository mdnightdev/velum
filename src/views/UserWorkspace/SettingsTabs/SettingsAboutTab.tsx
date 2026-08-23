import React from 'react';
import logoSvg from '../../../assets/logo.svg?raw';
import { FULL_BUILD_VERSION } from '../../../version';

export function SettingsAboutTab() {
  return (
    <div className="w-full max-w-4xl space-y-8">
      <h3 className="text-xs font-bold uppercase tracking-widest text-accent font-mono">
        About Velum
      </h3>
      <div className="p-8 rounded-xl border border-white-5 bg-velum-750/50 flex flex-col items-center text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-velum-800 border border-white/10 flex items-center justify-center">
          <div 
            className="w-9 h-9 [&>svg]:w-full [&>svg]:h-full text-accent" 
            dangerouslySetInnerHTML={{ __html: logoSvg }} 
          />
        </div>
        <div>
          <div className="text-xl font-bold tracking-[0.2em] text-text-primary">VELUM</div>
          <div className="text-[10px] text-text-secondary font-mono tracking-widest mt-1">
            Secure conversations, refined.
          </div>
        </div>

        <div className="pt-2 w-full">
          <div className="text-[10px] text-text-secondary font-mono">Version {FULL_BUILD_VERSION || '2.2.0'}</div>
          <div className="text-[10px] text-text-secondary font-mono mt-1">© 2026 Velum Network. All rights reserved.</div>
        </div>
      </div>
    </div>
  );
}
