import React from 'react';
import { KeyRound, UserPlus, Lock } from 'lucide-react';
import logoSvg from '../../assets/logo.svg?raw';

interface WelcomeScreenProps {
  onGetStarted: () => void;
  onLogIn: () => void;
  onPasskeyAuth?: () => void;
  onOpenLegalDoc?: (doc: 'terms' | 'privacy') => void;
}

export default function WelcomeScreen({
  onGetStarted,
  onLogIn,
  onPasskeyAuth,
  onOpenLegalDoc
}: WelcomeScreenProps) {
  return (
    <div className="w-full min-h-dvh flex flex-col justify-between bg-velum-900 text-text-primary px-6 py-12 sm:px-12 sm:py-16 select-none overflow-y-auto">
      {/* Top Spacer */}
      <div className="w-full" />

      {/* Center Hero: Zero-theatre, pure brand presence */}
      <main className="flex flex-col items-center justify-center my-auto w-full max-w-sm mx-auto text-center">
        <div 
          className="w-20 h-20 mb-6 text-accent flex items-center justify-center [&>svg]:w-full [&>svg]:h-full"
          dangerouslySetInnerHTML={{ __html: logoSvg }}
        />

        <h1 className="text-3xl sm:text-4xl font-light tracking-[0.24em] uppercase text-text-primary mb-2">
          Velum
        </h1>
        <p className="text-sm text-text-secondary font-normal tracking-wide">
          Private conversations.
        </p>
      </main>

      {/* Bottom Action Area: Thumb-zone ergonomics */}
      <footer className="w-full max-w-sm mx-auto flex flex-col gap-3 pt-6">
        {/* Passkey / Biometrics Button */}
        <button
          onClick={onPasskeyAuth || onLogIn}
          className="w-full py-3.5 px-6 rounded-xl bg-accent text-velum-950 font-semibold text-sm tracking-wide hover:opacity-95 active:scale-[0.99] transition-all flex items-center justify-center gap-2.5 shadow-lg shadow-accent/15 cursor-pointer"
        >
          <KeyRound className="w-4 h-4" />
          <span>Sign In with Passkey</span>
        </button>

        {/* Create Account Button */}
        <button
          onClick={onGetStarted}
          className="w-full py-3.5 px-6 rounded-xl bg-white-5 border border-white-10 text-text-primary hover:bg-white-10 active:scale-[0.99] transition-all font-medium text-sm flex items-center justify-center gap-2 cursor-pointer"
        >
          <UserPlus className="w-4 h-4 text-text-secondary" />
          <span>Create an Account</span>
        </button>

        {/* Standard Password Login */}
        <button
          onClick={onLogIn}
          className="w-full py-2.5 text-xs text-text-secondary hover:text-text-primary transition-colors flex items-center justify-center gap-1.5 cursor-pointer mt-1"
        >
          <Lock className="w-3.5 h-3.5" />
          <span>Sign in with password</span>
        </button>

        {/* Minimal Legal Links */}
        <div className="mt-4 text-center text-[11px] text-text-disabled leading-tight">
          <span>By continuing, you agree to the </span>
          <button
            onClick={() => onOpenLegalDoc?.('terms')}
            className="text-text-secondary hover:underline underline-offset-2"
          >
            Terms of Service
          </button>
          <span> & </span>
          <button
            onClick={() => onOpenLegalDoc?.('privacy')}
            className="text-text-secondary hover:underline underline-offset-2"
          >
            Privacy Policy
          </button>
        </div>
      </footer>
    </div>
  );
}
