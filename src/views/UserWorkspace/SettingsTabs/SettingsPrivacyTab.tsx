import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertTriangle, KeyRound, Trash2, Plus, Fingerprint } from 'lucide-react';
import PasswordInput from '../../../components/PasswordInput';
import { startRegistration } from '@simplewebauthn/browser';

interface PasskeyItem {
  id: number;
  credentialId: string;
  nickname: string;
  deviceType?: string;
  createdAt?: string;
  lastUsedAt?: string;
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
}: any) {
  const [passkeys, setPasskeys] = useState<PasskeyItem[]>([]);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [passkeyMsg, setPasskeyMsg] = useState<string | null>(null);
  const [passkeyErr, setPasskeyErr] = useState<string | null>(null);

  const getSessionToken = () => {
    return sessionStorage.getItem('velum-sessionId') || '';
  };

  const fetchPasskeys = async () => {
    const token = getSessionToken();
    if (!token) return;
    try {
      const res = await fetch('/api/v2/webauthn/passkeys', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPasskeys(data.passkeys || []);
      }
    } catch {
      // Ignored
    }
  };

  useEffect(() => {
    fetchPasskeys();
  }, []);

  const handleAddPasskey = async () => {
    setPasskeyMsg(null);
    setPasskeyErr(null);
    setPasskeyLoading(true);

    try {
      const token = getSessionToken();
      if (!token) throw new Error('Not authenticated. Please sign in again.');

      // 1. Get registration options
      const optRes = await fetch('/api/v2/webauthn/register/options', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (!optRes.ok) {
        const data = await optRes.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to initialize passkey registration');
      }

      const options = await optRes.json();

      // 2. Prompt native hardware biometrics / passkey creation
      const regResponse = await startRegistration({ optionsJSON: options });

      // 3. Verify on server
      const verifyRes = await fetch('/api/v2/webauthn/register/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          response: regResponse,
          nickname: `Device Passkey (${new Date().toLocaleDateString()})`
        })
      });

      const verifyData = await verifyRes.json().catch(() => ({}));
      if (!verifyRes.ok || !verifyData.verified) {
        throw new Error(verifyData.error || 'Passkey verification failed');
      }

      setPasskeyMsg('Passkey added successfully! You can now sign in using Touch ID / Face ID.');
      await fetchPasskeys();
    } catch (err: any) {
      if (err.name !== 'NotAllowedError') {
        setPasskeyErr(err.message || 'Failed to add passkey');
      }
    } finally {
      setPasskeyLoading(false);
    }
  };

  const handleDeletePasskey = async (credentialId: string) => {
    if (!window.confirm('Delete this passkey? You will no longer be able to sign in with this biometric key.')) return;
    try {
      const token = getSessionToken();
      const res = await fetch(`/api/v2/webauthn/passkeys/${encodeURIComponent(credentialId)}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setPasskeys(prev => prev.filter(p => p.credentialId !== credentialId));
        setPasskeyMsg('Passkey removed.');
      }
    } catch {
      setPasskeyErr('Failed to delete passkey.');
    }
  };

  return (
    <div className="w-full max-w-4xl space-y-8 select-none">
      {accountMsg && (
        <div className="p-3.5 bg-status-online-bg text-status-online rounded-xl text-[10px] font-mono uppercase font-bold flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />
          <span>{accountMsg}</span>
        </div>
      )}
      {accountError && (
        <div className="p-3.5 bg-status-dnd-bg text-status-dnd rounded-xl text-[10px] font-mono uppercase font-bold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          <span>{accountError}</span>
        </div>
      )}

      {/* 1. Passkeys & Biometrics */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-accent font-mono">Passkeys & Hardware Biometrics</h3>
            <p className="text-[11px] text-text-secondary mt-0.5">Sign in instantly without passwords using Touch ID, Face ID, or Windows Hello.</p>
          </div>
          <button
            type="button"
            onClick={handleAddPasskey}
            disabled={passkeyLoading}
            className="px-4 py-2 bg-accent hover:opacity-95 text-velum-950 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
          >
            {passkeyLoading ? (
              <span>Registering...</span>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5" />
                <span>Add Passkey</span>
              </>
            )}
          </button>
        </div>

        {passkeyMsg && (
          <div className="p-3 bg-status-online-bg text-status-online rounded-xl text-xs font-medium flex items-center gap-2">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            <span>{passkeyMsg}</span>
          </div>
        )}
        {passkeyErr && (
          <div className="p-3 bg-status-dnd-bg text-status-dnd rounded-xl text-xs font-medium flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{passkeyErr}</span>
          </div>
        )}

        <div className="space-y-2">
          {passkeys.length === 0 ? (
            <div className="p-4 bg-white-5 rounded-xl border border-white-5 text-center text-xs text-text-secondary">
              No passkeys registered on this account yet. Tap <strong>Add Passkey</strong> to enable biometric sign in.
            </div>
          ) : (
            passkeys.map(pk => (
              <div key={pk.credentialId} className="p-3.5 bg-white-5 border border-white-10 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-accent/10 text-accent flex items-center justify-center">
                    <Fingerprint className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-text-primary">{pk.nickname || 'Hardware Passkey'}</div>
                    <div className="text-[10px] text-text-secondary font-mono">
                      {pk.createdAt ? `Created ${new Date(pk.createdAt).toLocaleDateString()}` : 'Active'}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeletePasskey(pk.credentialId)}
                  className="p-1.5 text-text-secondary hover:text-status-dnd transition-colors cursor-pointer"
                  title="Delete passkey"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 2. Password Reset */}
      <form onSubmit={handlePasswordReset} className="space-y-4 pt-6 border-t border-white-5">
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

      {/* 3. Panic Protocol */}
      <div className="pt-8 border-t border-white-5 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-alert-error font-mono">Dures & Danger Zone</h3>
        <div className="p-4 bg-status-dnd-bg rounded-xl flex items-center justify-between border border-alert-error/30">
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-white">DURES</span>
            <span className="text-xs text-text-secondary">Executes instant WAL cascade deletion of sensitive messages, prekeys, and sessions.</span>
          </div>
          <button 
            type="button" 
            onClick={async () => {
              if (window.confirm('CRITICAL WARNING: This will Wipe your data')) {
                try {
                  const token = sessionStorage.getItem('velum-sessionId');
                  const res = await fetch('/api/v2/auth/panic', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                    }
                  });
                  if (res.ok) {
                    alert('Panic executed. Session ended.');
                    sessionStorage.clear();
                    localStorage.clear();
                    window.location.reload();
                  }
                } catch (e) {
                  alert('Panic trigger request sent.');
                }
              }
            }}
            className="px-4 py-2 bg-alert-error hover:bg-alert-error/80 text-white rounded-lg text-xs font-bold uppercase font-mono transition cursor-pointer"
          >
            Trigger Panic
          </button>
        </div>
      </div>
    </div>
  );
}
