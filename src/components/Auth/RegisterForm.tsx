import React from 'react';
import { User, Lock, Ticket, Shield, AlertTriangle, Fingerprint } from 'lucide-react';
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
  enableBiometrics?: boolean;
  setEnableBiometrics?: (val: boolean) => void;
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
  enableBiometrics = true,
  setEnableBiometrics,
  onSubmit,
  onSwitchToLogin,
  onOpenLegalDoc,
}: RegisterFormProps) {
  return (
    <form onSubmit={onSubmit} className="w-full space-y-4">
      {/* Username */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-text-secondary block">
          Username
        </label>
        <div className="relative">
          <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary" />
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full bg-white-5 border border-white-10 rounded-xl pl-10 pr-4 py-3.5 text-sm text-text-primary outline-none focus:border-accent transition-colors"
            required
            autoComplete="username"
          />
        </div>
      </div>

      {/* Password */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-text-secondary block">
          Password
        </label>
        <div className="relative">
          <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary" />
          <PasswordInput
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-white-5 border border-white-10 rounded-xl pl-10 pr-4 py-3.5 text-sm text-text-primary outline-none focus:border-accent transition-colors"
            required
          />
        </div>
      </div>

      {/* Invite Code */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-text-secondary block">
          Invite Code <span className="text-text-disabled font-normal">(Optional)</span>
        </label>
        <div className="relative">
          <Ticket className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary" />
          <input
            type="text"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            className="w-full bg-white-5 border border-white-10 rounded-xl pl-10 pr-4 py-3.5 text-sm text-text-primary outline-none focus:border-accent transition-colors font-mono"
          />
        </div>
      </div>

      {/* Recovery Safe Word */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 text-xs font-medium text-text-secondary">
          <Shield className="w-3.5 h-3.5 text-accent" />
          <span>Recovery Safe Word</span>
        </div>
        <input
          type="text"
          value={safeWord}
          onChange={(e) => setSafeWord(e.target.value)}
          className="w-full bg-white-5 border border-white-10 rounded-xl px-4 py-3.5 text-sm text-text-primary outline-none focus:border-accent transition-colors"
          required
        />
      </div>

      {/* Panic Phrase */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 text-xs font-medium text-text-secondary">
          <AlertTriangle className="w-3.5 h-3.5 text-status-dnd" />
          <span>Duress Panic Phrase</span>
        </div>
        <input
          type="text"
          value={panicPhrase}
          onChange={(e) => setPanicPhrase(e.target.value)}
          className="w-full bg-white-5 border border-white-10 rounded-xl px-4 py-3.5 text-sm text-text-primary outline-none focus:border-accent transition-colors font-mono"
          required
        />
      </div>

      {/* Biometrics Opt-in */}
      {setEnableBiometrics && (
        <div className="p-3 bg-white-5 rounded-xl border border-white-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Fingerprint className="w-4 h-4 text-accent" />
            <div className="text-xs text-text-primary font-medium">Enable Face ID / Biometrics</div>
          </div>
          <input
            type="checkbox"
            checked={enableBiometrics}
            onChange={(e) => setEnableBiometrics(e.target.checked)}
            className="w-4 h-4 rounded border-white-10 bg-white-5 accent-accent cursor-pointer"
          />
        </div>
      )}

      {/* Terms Agreement */}
      <div className="flex items-start gap-2.5 pt-1">
        <input
          type="checkbox"
          id="termsAgreement"
          checked={hasAgreedToTerms}
          onChange={(e) => setHasAgreedToTerms(e.target.checked)}
          className="w-4 h-4 rounded border-white-10 bg-white-5 accent-accent cursor-pointer mt-0.5"
          required
        />
        <label htmlFor="termsAgreement" className="text-xs text-text-secondary select-none leading-relaxed">
          I agree to the <button type="button" onClick={() => onOpenLegalDoc('terms')} className="text-accent underline cursor-pointer">Terms of Service</button> and <button type="button" onClick={() => onOpenLegalDoc('privacy')} className="text-accent underline cursor-pointer">Privacy Policy</button>
        </label>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        className="w-full bg-accent hover:opacity-95 text-velum-950 font-semibold py-3.5 px-6 rounded-xl transition-all text-sm tracking-wide cursor-pointer mt-4 shadow-lg shadow-accent/10 active:scale-[0.99]"
      >
        Create Account
      </button>

      {/* Switch to Login */}
      <div className="text-center mt-6 pt-4 border-t border-white-5">
        <button
          type="button"
          onClick={onSwitchToLogin}
          className="text-xs text-accent hover:underline transition cursor-pointer font-medium"
        >
          Already have an account? Sign In
        </button>
      </div>

      <div className="mt-4 pt-2 text-center text-[11px] text-text-disabled">
        <button type="button" onClick={() => onOpenLegalDoc('terms')} className="hover:text-text-secondary underline mr-3 cursor-pointer">Terms of Service</button>
        <button type="button" onClick={() => onOpenLegalDoc('privacy')} className="hover:text-text-secondary underline cursor-pointer">Privacy Policy</button>
      </div>
    </form>
  );
}
