import React from 'react';

export default function LoadingFallback() {
  return (
    <div className="w-full h-dvh overflow-hidden flex flex-col bg-velum-900 items-center justify-center font-mono text-[10px] text-text-secondary/60 uppercase tracking-widest gap-2 select-none">
      <div className="animate-pulse">Initializing System...</div>
      <div className="text-text-secondary/30 text-[8px]">Establishing secure session</div>
    </div>
  );
}
