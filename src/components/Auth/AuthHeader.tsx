import React from 'react';
import logoSvg from '../../assets/logo.svg?raw';

export default function AuthHeader() {
  return (
    <div className="text-center mb-6 relative">
      <div 
        className="w-12 h-12 mx-auto mb-3 text-accent flex items-center justify-center [&>svg]:w-full [&>svg]:h-full"
        dangerouslySetInnerHTML={{ __html: logoSvg }}
      />
      <h1 className="text-2xl font-light tracking-[0.24em] uppercase text-text-primary">
        Velum
      </h1>
      <p className="text-xs text-text-secondary mt-1 tracking-wide">
        Private conversations.
      </p>
    </div>
  );
}
