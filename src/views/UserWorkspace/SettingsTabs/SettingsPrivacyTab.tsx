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

  const handleAccountWipe = async () => {
    if (!window.confirm('Are you sure you want to delete account data and reset this session?')) {
      return;
    }

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
      // Continue cleanup regardless
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

        <form onSubmit={handlePasswordReset} className="space-y-3 max-w-md">
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-text-secondary">Current Password</label>
            <PasswordInput
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full bg-velum-750 border border-white-10 rounded-xl px-3.5 py-2.5 text-xs text-text-primary outline-none focus:border-accent"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-text-secondary">New Password</label>
            <PasswordInput
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full bg-velum-750 border border-white-10 rounded-xl px-3.5 py-2.5 text-xs text-text-primary outline-none focus:border-accent"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-text-secondary">Confirm New Password</label>
            <PasswordInput
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-velum-750 border border-white-10 rounded-xl px-3.5 py-2.5 text-xs text-text-primary outline-none focus:border-accent"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="px-4 py-2 bg-white-10 hover:bg-white-15 border border-white-10 text-text-primary rounded-xl text-xs font-semibold transition cursor-pointer"
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

        <div className="p-4 bg-red-500/5 rounded-xl  flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-xs font-medium text-text-primary block">DELETE ACCOUNT</span>
           
          </div>
          <button
            type="button"
            onClick={handleAccountWipe}
            className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg text-xs font-medium transition cursor-pointer shrink-0"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </section>
    </div>
  );
}
