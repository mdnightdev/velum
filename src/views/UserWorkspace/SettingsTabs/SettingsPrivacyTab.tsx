import React from 'react';
import { CheckCircle, AlertTriangle } from 'lucide-react';
import PasswordInput from '../../../components/PasswordInput';

export function SettingsPrivacyTab({
  accountMsg,
  accountError,
  handlePasswordReset,
  currentPassword,
  setCurrentPassword,
  newPassword,
  setNewPassword,
  confirmPassword,
  setConfirmPassword
}: any) {
  return (
    <div className="w-full max-w-4xl space-y-8">
      {accountMsg && (
        <div className="p-3.5 bg-emerald-500/5 border border-emerald-500/10 text-emerald-400 rounded-xl text-[10px] font-mono uppercase font-bold flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />
          <span>{accountMsg}</span>
        </div>
      )}
      {accountError && (
        <div className="p-3.5 bg-red-500/5 border border-red-500/10 text-red-500 rounded-xl text-[10px] font-mono uppercase font-bold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          <span>{accountError}</span>
        </div>
      )}
      <h3 className="text-xs font-bold uppercase tracking-widest text-accent font-mono">Privacy & Safety</h3>
      <form onSubmit={handlePasswordReset} className="space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-text-secondary font-mono">Password</h3>
        <div className="space-y-1.5">
          <label className="text-[10px] uppercase font-mono font-bold text-text-secondary">Current Password</label>
          <PasswordInput
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full bg-velum-750 border border-white-5 rounded-xl px-4 py-3 text-sm text-text-primary outline-none focus:border-accent"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] uppercase font-mono font-bold text-text-secondary">New Password</label>
          <PasswordInput
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full bg-velum-750 border border-white-5 rounded-xl px-4 py-3 text-sm text-text-primary outline-none focus:border-accent"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] uppercase font-mono font-bold text-text-secondary">Confirm New Password</label>
          <PasswordInput
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full bg-velum-750 border border-white-5 rounded-xl px-4 py-3 text-sm text-text-primary outline-none focus:border-accent"
          />
        </div>
        <div className="pt-2">
          <button
            type="submit"
            className="bg-accent/10 hover:bg-accent/20 border border-accent/20 text-accent px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition flex items-center justify-center cursor-pointer"
          >
            Update Password
          </button>
        </div>
      </form>

      <div className="pt-8 border-t border-white-5 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-red-500 font-mono">Danger Zone</h3>
        <div className="p-4 border border-red-500/20 bg-red-500/5 rounded-xl flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-white">Delete Account</span>
            <span className="text-xs text-text-secondary">Permanently delete your account and all data</span>
          </div>
          <button type="button" className="px-4 py-2 bg-red-500 text-white rounded-lg text-xs font-bold uppercase font-mono opacity-50 cursor-not-allowed">
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
