import React from 'react';
import { User, Lock, Key, Eye, EyeOff, KeyRound, HelpCircle, LifeBuoy } from 'lucide-react';
import PasswordInput from '../PasswordInput';

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
  onShowHelpDesk?: () => void;
  onSwitchToRegister: () => void;
  onPasskeyLogin?: () => void;
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
  onShowHelpDesk,
  onSwitchToRegister,
  onPasskeyLogin
}: LoginFormProps) {
  return (
    <form onSubmit={onSubmit} className="w-full space-y-4">
      {!isAdminPortal ? (
        <>
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

          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-medium text-text-secondary block">
                Password
              </label>
              <button
                type="button"
                onClick={onShowRecovery}
                className="text-xs text-accent hover:underline cursor-pointer"
              >
                Forgot password?
              </button>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white-5 border border-white-10 rounded-xl pl-10 pr-10 py-3.5 text-sm text-text-primary outline-none focus:border-accent transition-colors"
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary cursor-pointer p-1"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="space-y-1.5 pt-2 animate-fadeIn">
          <label className="text-xs font-medium text-text-secondary block">
            {requiresRegisterPermanentOtp 
              ? 'Create Passcode' 
              : (isPermanentOtp ? 'Passcode' : 'Passcode')}
          </label>
          <div className="relative">
            <Key className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary" />
            <PasswordInput
              value={adminToken}
              onChange={(e) => setAdminToken(e.target.value)}
              className="w-full bg-white-5 border border-white-10 rounded-xl pl-10 pr-4 py-3.5 text-sm text-text-primary outline-none focus:border-accent transition-colors"
              required
            />
          </div>
        </div>
      )}

      {/* Primary Submit Button */}
      <button
        type="submit"
        className="w-full bg-accent hover:opacity-95 text-velum-950 font-semibold py-3.5 px-6 rounded-xl transition-all text-sm tracking-wide cursor-pointer mt-6 shadow-lg shadow-accent/10 active:scale-[0.99]"
      >
        {isAdminPortal 
          ? (requiresRegisterPermanentOtp ? 'Save and Verify Passcode' : 'Verify Passcode') 
          : 'Sign In'}
      </button>

      {/* Passkey Alternative */}
      {onPasskeyLogin && !isAdminPortal && (
        <button
          type="button"
          onClick={onPasskeyLogin}
          className="w-full bg-white-5 hover:bg-white-10 border border-white-10 text-text-primary font-medium py-3 px-6 rounded-xl transition-all text-xs flex items-center justify-center gap-2 cursor-pointer mt-2"
        >
          <KeyRound className="w-3.5 h-3.5 text-accent" />
          <span>Sign In with Passkey / Face ID</span>
        </button>
      )}

      {!isAdminPortal && (
        <div className="flex flex-col gap-2 mt-6 pt-4 border-t border-white-5 text-center">
          <button
            type="button"
            onClick={onSwitchToRegister}
            className="text-xs text-accent hover:underline transition cursor-pointer font-medium"
          >
            New user? Create an account
          </button>

          <div className="flex items-center justify-center gap-4 pt-1">
            <button
              type="button"
              onClick={onShowRecovery}
              className="text-xs text-text-secondary hover:text-text-primary flex items-center gap-1 cursor-pointer transition-colors"
            >
              <HelpCircle className="w-3 h-3 text-text-secondary" />
              <span>Account Recovery</span>
            </button>
            <span className="text-white-10">·</span>
            <button
              type="button"
              onClick={onShowHelpDesk || onShowRecovery}
              className="text-xs text-text-secondary hover:text-text-primary flex items-center gap-1 cursor-pointer transition-colors"
            >
              <LifeBuoy className="w-3 h-3 text-text-secondary" />
              <span>Support Desk</span>
            </button>
          </div>
        </div>
      )}

         </form>
  );
}
