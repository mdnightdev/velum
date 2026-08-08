import React from 'react';
import PasswordInput from '../PasswordInput';
import { LegalDocType } from '../LegalDocModal';

interface RegisterFormProps {
  username: string;
  setUsername: (val: string) => void;
  inviteCode: string;
  setInviteCode: (val: string) => void;
  password: string;
  setPassword: (val: string) => void;
  safeWord: string;
  setSafeWord: (val: string) => void;
  panicPhrase: string;
  setPanicPhrase: (val: string) => void;
  hasAgreedToTerms: boolean;
  setHasAgreedToTerms: (val: boolean) => void;
  onSubmit: (e: React.FormEvent) => void;
  onSwitchToLogin: () => void;
  onOpenLegalDoc: (doc: LegalDocType) => void;
}

export default function RegisterForm({
  username,
  setUsername,
  inviteCode,
  setInviteCode,
  password,
  setPassword,
  safeWord,
  setSafeWord,
  panicPhrase,
  setPanicPhrase,
  hasAgreedToTerms,
  setHasAgreedToTerms,
  onSubmit,
  onSwitchToLogin,
  onOpenLegalDoc,
}: RegisterFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-[10px] uppercase font-sans tracking-wider text-white font-semibold block">Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder=""
            className="w-full bg-velum-850 border border-white-5 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-accent font-sans"
            required
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] uppercase font-sans tracking-wider text-white font-semibold block">Invite Code</label>
          <input
            type="text"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            placeholder=""
            className="w-full bg-velum-850 border border-white-5 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-accent font-sans"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-[10px] uppercase font-sans tracking-wider text-white font-semibold block">Password</label>
        <PasswordInput
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder=""
          className="w-full bg-velum-850 border border-white-5 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-accent font-sans"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-[10px] uppercase font-sans tracking-wider text-white font-semibold block">Security Word</label>
          <input
            type="text"
            value={safeWord}
            onChange={(e) => setSafeWord(e.target.value)}
            placeholder=""
            className="w-full bg-velum-850 border border-white-5 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-accent font-sans"
            required
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] uppercase font-sans tracking-wider text-white font-semibold block">Panic Phrase</label>
          <input
            type="text"
            value={panicPhrase}
            onChange={(e) => setPanicPhrase(e.target.value)}
            placeholder=""
            className="w-full bg-velum-850 border border-white-5 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-accent font-sans"
            required
          />
        </div>
      </div>

      <div className="flex items-center gap-2 mt-2">
        <input
          type="checkbox"
          id="termsAgreement"
          checked={hasAgreedToTerms}
          onChange={(e) => setHasAgreedToTerms(e.target.checked)}
          className="w-4 h-4 rounded border-white-5 bg-velum-850 accent-accent cursor-pointer"
          required
        />
        <label htmlFor="termsAgreement" className="text-[10px] text-text-secondary select-none">
          I agree to the <button type="button" onClick={() => onOpenLegalDoc('terms')} className="text-accent underline cursor-pointer">Terms of Service</button> and <button type="button" onClick={() => onOpenLegalDoc('privacy')} className="text-accent underline cursor-pointer">Privacy Policy</button>
        </label>
      </div>

      <button
        type="submit"
        className="w-full bg-accent hover:bg-accent-hover text-zinc-950 font-bold uppercase p-3 rounded-xl transition duration-150 text-xs tracking-widest cursor-pointer mt-4"
      >
        Register
      </button>

      <div className="text-center mt-3 pt-1 border-t border-white-5">
        <button
          type="button"
          onClick={onSwitchToLogin}
          className="text-[10px] uppercase font-sans tracking-wider text-accent hover:text-accent-hover transition cursor-pointer font-semibold"
        >
          Already registered? Sign In
        </button>
      </div>
    </form>
  );
}
