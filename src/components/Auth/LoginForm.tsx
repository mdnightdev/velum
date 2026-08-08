import React from 'react';
import { User, Lock, Key, Eye, EyeOff } from 'lucide-react';
import PasswordInput from '../PasswordInput';
import { LegalDocType } from '../LegalDocModal';

interface LoginFormProps {
  username: string;
  setUsername: (val: string) => void;
  password: string;
  setPassword: (val: string) => void;
  adminToken: string;
  setAdminToken: (val: string) => void;
  showPassword: boolean;
  setShowPassword: (val: boolean) => void;
  isAdminPortal: boolean;
  requiresRegisterPermanentOtp: boolean;
  isPermanentOtp: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onShowRecovery: () => void;
  onSwitchToRegister: () => void;
  onOpenLegalDoc: (doc: LegalDocType) => void;
}

export default function LoginForm({
  username,
  setUsername,
  password,
  setPassword,
  adminToken,
  setAdminToken,
  showPassword,
  setShowPassword,
  isAdminPortal,
  requiresRegisterPermanentOtp,
  isPermanentOtp,
  onSubmit,
  onShowRecovery,
  onSwitchToRegister,
  onOpenLegalDoc,
}: LoginFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {!isAdminPortal ? (
        <>
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-sans tracking-wider text-white font-semibold block">Username</label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-velum-850 border border-white-5 rounded-xl pl-10 pr-4 py-3 text-xs text-white outline-none focus:border-accent font-sans"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-[10px] uppercase font-sans tracking-wider text-white font-semibold block">Password</label>
              <button
                type="button"
                onClick={onShowRecovery}
                className="text-[9px] uppercase tracking-wider text-accent hover:underline cursor-pointer"
              >
                Recovery
              </button>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-velum-850 border border-white-5 rounded-xl pl-10 pr-10 py-3 text-xs text-white outline-none focus:border-accent font-sans"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="space-y-1 pt-2 animate-fadeIn">
          <label className="text-[10px] uppercase font-sans tracking-wider text-white font-semibold block">
            {requiresRegisterPermanentOtp 
              ? 'Create Passcode' 
              : (isPermanentOtp ? 'Passcode' : 'Passcode')}
          </label>
          <div className="relative">
            <Key className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
            <PasswordInput
              value={adminToken}
              onChange={(e) => setAdminToken(e.target.value)}
              placeholder=""
              className="w-full bg-velum-850 border border-white-5 rounded-xl pl-10 pr-4 py-3 text-xs text-white outline-none focus:border-accent font-sans"
              required
            />
          </div>
        </div>
      )}

      <button
        type="submit"
        className="w-full bg-accent hover:bg-accent-hover text-zinc-950 font-bold uppercase p-3 rounded-xl transition duration-150 text-xs tracking-widest cursor-pointer mt-4"
      >
        {isAdminPortal 
          ? (requiresRegisterPermanentOtp ? 'Save and Verify Passcode' : 'Verify Passcode') 
          : 'Sign In'}
      </button>

      {!isAdminPortal && (
        <div className="text-center mt-3 pt-1 border-t border-white-5">
          <button
            type="button"
            onClick={onSwitchToRegister}
            className="text-[10px] uppercase font-sans tracking-wider text-accent hover:text-accent-hover transition cursor-pointer font-semibold"
          >
            New user? Create an account
          </button>
        </div>
      )}

      <div className="mt-2 pt-2 border-t border-white-5 text-center">
        <button type="button" onClick={() => onOpenLegalDoc('terms')} className="text-[9px] text-text-secondary hover:text-accent underline mr-3 cursor-pointer">Terms of Service</button>
        <button type="button" onClick={() => onOpenLegalDoc('privacy')} className="text-[9px] text-text-secondary hover:text-accent underline cursor-pointer">Privacy Policy</button>
      </div>
    </form>
  );
}
