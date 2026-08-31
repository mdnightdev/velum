import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertTriangle, Trash2, Plus, Fingerprint } from 'lucide-react';
import PasswordInput from '../../../components/PasswordInput';
import { startRegistration } from '@simplewebauthn/browser';
import { getSessionId } from '../../../utils/auth';
import { storage } from '../../../services/storageService';

interface PasskeyItem {
  id: number;
  credentialId: string;
  nickname: string;
  deviceType?: string;
  createdAt?: string;
  lastUsedAt?: string;
}

interface SettingsPrivacyTabProps {
  accountMsg: string | null;
  accountError: string | null;
  handlePasswordReset: (e: React.FormEvent) => void;
  currentPassword: string;
  setCurrentPassword: (val: string) => void;
  newPassword: string;
  setNewPassword: (val: string) => void;
  confirmPassword: string;
  setConfirmPassword: (val: string) => void;
}

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
}: SettingsPrivacyTabProps) {
  const [passkeys, setPasskeys] = useState<PasskeyItem[]>([]);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [passkeyMsg, setPasskeyMsg] = useState<string | null>(null);
  const [passkeyErr, setPasskeyErr] = useState<string | null>(null);

  const getSessionToken = () => getSessionId();

  const fetchPasskeys = async () => {
    try {
      const token = getSessionToken();
      if (!token) return;

      const res = await fetch('/api/v2/webauthn/passkeys', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPasskeys(data.passkeys || []);
      }
    } catch {
      // Ignore background fetch failure
    }
  };

  useEffect(() => {
    fetchPasskeys();
  }, []);

  const handleAddPasskey = async () => {
    setPasskeyLoading(true);
    setPasskeyMsg(null);
    setPasskeyErr(null);

    try {
      const token = getSessionToken();
      if (!token) throw new Error('Not authenticated');

      const optRes = await fetch('/api/v2/webauthn/register/options', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });

      if (!optRes.ok) {
        const err = await optRes.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to initialize passkey');
      }

      const options = await optRes.json();
      const regResponse = await startRegistration({ optionsJSON: options });

      const verifyRes = await fetch('/api/v2/webauthn/register/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          response: regResponse,
          nickname: `Passkey (${new Date().toLocaleDateString()})`
        })
      });

      const verifyData = await verifyRes.json().catch(() => ({}));
      if (!verifyRes.ok || !verifyData.verified) {
        throw new Error(verifyData.error || 'Passkey verification failed');
      }

      setPasskeyMsg('Passkey successfully added.');
      await fetchPasskeys();
    } catch (err: any) {
      if (err.name !== 'NotAllowedError') {
        setPasskeyErr(err.message || 'Failed to register passkey');
      }
    } finally {
      setPasskeyLoading(false);
    }
  };

  const handleDeletePasskey = async (credentialId: string) => {
    try {
      const token = getSessionToken();
      const res = await fetch(`/api/v2/webauthn/passkeys/${encodeURIComponent(credentialId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setPasskeys((prev) => prev.filter((p) => p.credentialId !== credentialId));
        setPasskeyMsg('Passkey removed.');
      }
    } catch {
      setPasskeyErr('Failed to delete passkey');
    }
  };

  // Modal confirmation states (no browser popups)
  const [confirmCompromiseOpen, setConfirmCompromiseOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const handleMarkCompromised = async () => {
    setActionLoading(true);
    try {
      const token = getSessionToken();
      await fetch('/api/v2/auth/panic', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });
    } catch {
      // Proceed with cleanup
    } finally {
      storage.clear();
      window.location.reload();
    }
  };

  const handleScheduleDeletion = async () => {
    setActionLoading(true);
    try {
      const token = getSessionToken();
      await fetch('/api/v2/user/deactivate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ reason: 'Self-deactivation' })
      });
    } catch {
      // Proceed with cleanup
    } finally {
      storage.clear();
      window.location.reload();
    }
  };

  return (
    <div className="space-y-8 p-1">
      {/* Passkeys */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-mono font-bold tracking-wider uppercase text-text-primary">
              Passkeys
            </h3>
          </div>
          <button
            type="button"
            onClick={handleAddPasskey}
            disabled={passkeyLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white-5 hover:bg-white-10 border border-white-10 text-text-primary text-xs font-medium transition cursor-pointer disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{passkeyLoading ? 'Registering...' : 'Add Passkey'}</span>
          </button>
        </div>

        {passkeyMsg && (
          <div className="p-3 bg-status-online/10 border border-status-online/20 text-status-online text-xs rounded-lg flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{passkeyMsg}</span>
          </div>
        )}

        {passkeyErr && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-lg flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{passkeyErr}</span>
          </div>
        )}

        <div className="space-y-2">
          {passkeys.length === 0 ? (
            <div className="p-4 rounded-xl border border-white-5 bg-white-5/30 text-center text-xs text-text-secondary">
              No passkeys configured.
            </div>
          ) : (
            passkeys.map((pk) => (
              <div
                key={pk.credentialId}
                className="p-3 bg-white-5 border border-white-10 rounded-xl flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-white-5 flex items-center justify-center text-text-primary">
                    <Fingerprint className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-medium text-text-primary block">
                      {pk.nickname || 'Device Passkey'}
                    </span>
                    <span className="text-[10px] text-text-secondary font-mono">
                      {pk.createdAt ? new Date(pk.createdAt).toLocaleDateString() : 'Active'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeletePasskey(pk.credentialId)}
                  className="p-1.5 text-text-secondary hover:text-red-400 hover:bg-white-5 rounded-lg transition cursor-pointer"
                  title="Remove passkey"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Password Update */}
      <section className="space-y-4 pt-6 border-t border-white-5">
        <div>
          <h3 className="text-xs font-mono font-bold tracking-wider uppercase text-text-primary">
            Change Password
          </h3>
        </div>

        {accountMsg && (
          <div className="p-3 bg-status-online/10 border border-status-online/20 text-status-online text-xs rounded-lg flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{accountMsg}</span>
          </div>
        )}

        {accountError && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-lg flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{accountError}</span>
          </div>
        )}

        <form onSubmit={handlePasswordReset} className="space-y-4">
          <div className="bg-velum-900 border border-white-10 rounded-2xl overflow-hidden divide-y divide-white-5 shadow-sm">
            <div className="p-3.5 flex flex-col gap-1 focus-within:bg-white-5/30 transition">
              <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-text-secondary">
                Current Password
              </label>
              <PasswordInput
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full bg-transparent border-none text-xs text-text-primary outline-none p-0 focus:ring-0"
                placeholder="••••••••"
              />
            </div>

            <div className="p-3.5 flex flex-col gap-1 focus-within:bg-white-5/30 transition">
              <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-text-secondary">
                New Password
              </label>
              <PasswordInput
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-transparent border-none text-xs text-text-primary outline-none p-0 focus:ring-0"
                
              />
            </div>

            <div className="p-3.5 flex flex-col gap-1 focus-within:bg-white-5/30 transition">
              <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-text-secondary">
                Confirm New Password
              </label>
              <PasswordInput
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-transparent border-none text-xs text-text-primary outline-none p-0 focus:ring-0"
               
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              className="px-4 py-2.5 bg-accent text-velum-950 font-semibold rounded-xl text-xs hover:opacity-90 transition cursor-pointer"
            >
              Update Password
            </button>
          </div>
        </form>

      </section>

      {/* Danger Zone */}
      <section className="space-y-3 pt-6 border-t border-white-5">
        <div>
          <h3 className="text-xs font-mono font-bold tracking-wider uppercase text-red-400">
            Danger Zone
          </h3>
        </div>

        <div className="space-y-3">
          <div className="p-3.5 bg-red-500/5 border border-red-500/15 rounded-xl flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-text-primary">Account Compromise</div>
              <div className="text-[11px] text-text-secondary">Flag account and terminate active sessions</div>
            </div>
            <button
              type="button"
              onClick={() => setConfirmCompromiseOpen(true)}
              className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg text-xs font-medium transition cursor-pointer"
            >
              Report Compromised
            </button>
          </div>

          <div className="p-3.5 bg-red-500/5 border border-red-500/15 rounded-xl flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-text-primary">Account Deletion</div>
              <div className="text-[11px] text-text-secondary">Schedule permanent deletion (7-day grace period)</div>
            </div>
            <button
              type="button"
              onClick={() => setConfirmDeleteOpen(true)}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
            >
              Delete Account
            </button>
          </div>
        </div>
      </section>

      {/* Confirmation Modal - Compromised Account */}
      {confirmCompromiseOpen && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-velum-900 border border-white-10 rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h4 className="text-sm font-semibold text-text-primary">Report Compromised Account</h4>
            </div>
            <p className="text-xs text-text-secondary leading-relaxed">
              Your account will be flagged as compromised and all active sessions will be terminated immediately.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => setConfirmCompromiseOpen(false)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-white-5 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleMarkCompromised}
                className="px-4 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-semibold transition cursor-pointer disabled:opacity-50"
              >
                {actionLoading ? 'Flagging...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal - 7-Day Account Deletion */}
      {confirmDeleteOpen && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-velum-900 border border-white-10 rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h4 className="text-sm font-semibold text-text-primary">Delete Account</h4>
            </div>
            <p className="text-xs text-text-secondary leading-relaxed">
              Your account will be deactivated and scheduled for permanent deletion in 7 days. You can cancel this before the deadline.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => setConfirmDeleteOpen(false)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-white-5 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleScheduleDeletion}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold transition cursor-pointer disabled:opacity-50"
              >
                {actionLoading ? 'Scheduling...' : 'Confirm Deletion'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
