import React from 'react';

export default function LoadingFallback() {
  return (
    <div className="w-full h-dvh overflow-hidden flex flex-col bg-velum-900 items-center justify-center font-mono select-none relative">
      {/* Background ambient glow */}
      <div className="absolute w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none animate-pulse" />

      <div className="flex flex-col items-center gap-3 z-10">
        {/* Brand Header with pulse indicator */}
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
          </span>
          <span className="text-xs font-bold tracking-widest text-text-secondary uppercase">
            VELUM
          </span>
        </div>

        {/* Minimal loading bar */}
        <div className="w-24 h-0.5 bg-white/10 rounded-full overflow-hidden relative mt-1">
          <div className="w-full h-full bg-cyan-400/80 rounded-full animate-pulse" />
        </div>
      </div>
    </div>
  );
}
