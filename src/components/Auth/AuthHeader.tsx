import React from 'react';
import { ShieldCheck, EyeOff, Zap, Brain } from 'lucide-react';
import logoSvg from '../../assets/logo.svg?raw';

export default function AuthHeader() {
  return (
    <div className="text-center mb-6 relative">
      <div className="mx-auto mb-3 w-20 h-20 rounded-lg flex items-center justify-center auth-portal-glow">
        <div className="w-16 h-16 flex items-center justify-center rounded-md bg-transparent text-accent">
          <div 
            className="w-16 h-16 transform transition-transform duration-500 [&>svg]:w-full [&>svg]:h-full" 
            dangerouslySetInnerHTML={{ __html: logoSvg }} 
          />
        </div>
      </div>

      <h1 className="text-2xl font-light tracking-[0.28em] uppercase">Velum</h1>
      <p className="text-[12px] text-text-secondary mt-1">Secure conversations, refined.</p>

      <div className="grid grid-cols-4 gap-2 w-full pt-3 max-w-xs mx-auto">
        <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-text-primary/[0.012] border border-white-5">
          <ShieldCheck className="w-3.5 h-3.5 mb-1 text-accent" />
          <span className="text-[9px] uppercase tracking-wider text-text-primary">Secure</span>
        </div>
        <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-text-primary/[0.012] border border-white-5">
          <EyeOff className="w-3.5 h-3.5 mb-1 text-accent" />
          <span className="text-[9px] uppercase tracking-wider text-text-primary">Private</span>
        </div>
        <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-text-primary/[0.012] border border-white-5">
          <Zap className="w-3.5 h-3.5 mb-1 text-accent" />
          <span className="text-[9px] uppercase tracking-wider text-text-primary">Realtime</span>
        </div>
        <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-text-primary/[0.012] border border-white-5">
          <Brain className="w-3.5 h-3.5 mb-1 text-accent" />
          <span className="text-[9px] uppercase tracking-wider text-text-primary">Encrypted</span>
        </div>
      </div>
    </div>
  );
}
