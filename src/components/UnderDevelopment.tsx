import React from 'react';

interface UnderDevelopmentProps {
  title: string;
}

export default function UnderDevelopment({ title }: UnderDevelopmentProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-2 px-8 text-center">
      <h2 className="text-base font-semibold text-text-primary">{title}</h2>
      <p className="text-sm text-text-secondary">Still being built. Check back soon.</p>
    </div>
  );
}
