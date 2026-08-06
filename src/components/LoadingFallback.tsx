import React from 'react';

export default function LoadingFallback() {
  return (
    <div className="w-full h-dvh overflow-hidden flex flex-col bg-velum-900 items-center justify-center font-mono select-none relative">
      {/* Ambient glow — token accent instead of stray cyan */}
      <div className="absolute w-72 h-72 bg-accent/10 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute w-56 h-56 bg-accent-secondary/5 rounded-full blur-3xl pointer-events-none translate-x-20 translate-y-10" />

      <div className="flex flex-col items-center gap-4 z-10">
        {/* Logo mark — breathing scale instead of a static dot */}
        <div className="relative flex items-center justify-center w-10 h-10">
          <span className="absolute inline-flex h-full w-full rounded-full bg-accent/20 animate-ping" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-accent" />
        </div>

        {/* Brand */}
        <span className="text-xs font-bold tracking-[0.3em] text-text-secondary uppercase">
          VELUM
        </span>

        {/* Sweeping loading bar instead of a flat pulse */}
        <div className="w-28 h-0.5 bg-white-10 rounded-full overflow-hidden relative mt-1">
          <div className="absolute inset-y-0 w-1/3 bg-accent rounded-full animate-loading-sweep" />
        </div>
      </div>
    </div>
  );
}
