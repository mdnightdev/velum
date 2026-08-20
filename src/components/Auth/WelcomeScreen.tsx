import React from 'react';
import { UserPlus, ArrowRight } from 'lucide-react';
import logoSvg from '../../assets/logo.svg?raw';

interface WelcomeScreenProps {
  onGetStarted: () => void;
  onLogIn: () => void;
}

export default function WelcomeScreen({
  onGetStarted,
  onLogIn,
}: WelcomeScreenProps) {
  return (
    <div className="w-full min-h-dvh flex flex-col justify-between bg-velum-900 text-text-primary px-6 py-12 sm:px-12 sm:py-16 select-none overflow-y-auto">
      {/* Top Spacer */}
      <div className="w-full" />

      {/* Center Hero */}
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

      {/* Bottom Action Area: Clean 2 actions */}
      <footer className="w-full max-w-sm mx-auto flex flex-col gap-3 pt-6">
        {/* Create Account Button */}
        <button
          onClick={onGetStarted}
          className="w-full py-3.5 px-6 rounded-xl bg-accent text-velum-950 font-semibold text-sm tracking-wide hover:opacity-95 active:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-lg shadow-accent/15 cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>Create an Account</span>
        </button>

        {/* Standard Sign In */}
        <button
          onClick={onLogIn}
          className="w-full py-3.5 px-6 rounded-xl bg-white-5 border border-white-10 text-text-primary hover:bg-white-10 active:scale-[0.99] transition-all font-medium text-sm flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>Sign In</span>
          <ArrowRight className="w-4 h-4 text-text-secondary" />
        </button>
      </footer>
    </div>
  );
}
