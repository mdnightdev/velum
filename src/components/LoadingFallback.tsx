import React from 'react';
import logoSvg from '../assets/logo.svg?raw';

export default function LoadingFallback() {
  return (
    <div className="w-full h-dvh overflow-hidden flex flex-col bg-velum-900 items-center justify-center select-none relative animate-fadeIn">
      {/* Ambient backlight */}
      <div className="absolute w-64 h-64 bg-accent/10 rounded-full blur-3xl pointer-events-none animate-pulse" />

      <div className="flex flex-col items-center gap-5 z-10">
        {/* Velum Logo Brandmark */}
        <div 
          className="w-16 h-16 text-accent flex items-center justify-center [&>svg]:w-full [&>svg]:h-full animate-bounce-slow"
          dangerouslySetInnerHTML={{ __html: logoSvg }}
        />

        {/* Brand Name */}
        <h1 className="text-xl font-light tracking-[0.3em] uppercase text-text-primary">
          VELUM
        </h1>

        {/* Minimal progress line */}
        <div className="w-24 h-0.5 bg-white-10 rounded-full overflow-hidden relative mt-2">
          <div className="absolute inset-y-0 w-1/3 bg-accent rounded-full animate-loading-sweep" />
        </div>
      </div>
    </div>
  );
}
