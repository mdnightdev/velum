import React from 'react';

export const OutlinedSeal = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" className="opacity-70 text-text-secondary shrink-0">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

export const FilledSeal = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="1.5" fill="currentColor" strokeLinecap="round" strokeLinejoin="round" className="text-accent shrink-0">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

export const LockedSeal = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="opacity-45 text-text-disabled shrink-0">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <rect x="9" y="11" width="6" height="5" rx="1" strokeWidth="1" />
    <path d="M10 11V9a2 2 0 0 1 4 0v2" strokeWidth="1" />
  </svg>
);

export const cleanRoomName = (name: string): string => {
  return name.replace(/^#\s*/, '').trim();
};
