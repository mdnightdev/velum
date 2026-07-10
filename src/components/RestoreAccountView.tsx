import React, { useState } from 'react';
import { ShieldCheck, HelpCircle, AlertCircle, RefreshCw } from 'lucide-react';

async function computeClientHash(secret: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(salt + secret);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function checkPasswordStrength(password: string): string | null {
  if (password.length < 8) {
    return 'Password must be at least 8 characters long.';
  }
  if (password.length > 128) {
    return 'Password must not exceed 128 characters.';
  }
  const weakPasswords = ['password', '12345678', '123456789', 'qwertyuiop', 'password123', 'admin123'];
  if (weakPasswords.includes(password.toLowerCase())) {
    return 'The password chosen is too common or weak.';
  }
  return null;
}

interface RestoreAccountViewProps {
  isDark?: boolean;
}

export default function RestoreAccountView({ isDark = true }: RestoreAccountViewProps) {
  const [username, setUsername] = useState('');
  const [recoveryKey, setRecoveryKey] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isRestoring, setIsRestoring] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleRestoreSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !recoveryKey || !newPassword) {
      setStatusMsg({ type: 'error', text: 'All credentials are required to reconstruct identity.' });
      return;
    }

    const strengthError = checkPasswordStrength(newPassword);
    if (strengthError) {
      setStatusMsg({ type: 'error', text: strengthError });
      return;
    }

    setIsRestoring(true);
    setStatusMsg(null);

    try {
      const saltRes = await fetch(`/api/auth/recovery-salt?username=${encodeURIComponent(username.trim())}`);
      if (!saltRes.ok) {
        setStatusMsg({ type: 'error', text: 'Fail: Cryptographic credentials map not found for account.' });
        setIsRestoring(false);
        return;
      }
      const { salt } = await saltRes.json();
      if (!salt) {
        setStatusMsg({ type: 'error', text: 'Fail: Cryptographic parameters trace invalid.' });
        setIsRestoring(false);
        return;
      }

      const hashedRecoveryKey = await computeClientHash(recoveryKey.trim(), salt);

      const array = new Uint8Array(32);
      window.crypto.getRandomValues(array);
      const newSalt = Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');

      const hashedPassword = await computeClientHash(newPassword.trim(), newSalt);

      const res = await fetch('/api/auth/restore-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          safeWord: '', // Fallback empty safeword since field is not present in this view
          recoveryKey: hashedRecoveryKey,
          newPassword: hashedPassword,
          salt: newSalt
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setStatusMsg({
          type: 'success',
          text: 'Security system synced. Account has been fully restored and credentials upgraded successfully.'
        });
        // Redirect home after 3 seconds
        setTimeout(() => {
          window.location.pathname = '/';
        }, 3000);
      } else {
        setStatusMsg({ type: 'error', text: data.error || 'Identity keys verification failed.' });
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: 'Network handshake incident occurred.' });
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="w-full h-full bg-velum-900 flex items-center justify-center font-sans select-none p-4 overflow-y-auto">
      <div className="bg-velum-800 border border-white-5 w-full max-w-md rounded p-6 shadow-2xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-accent/10 text-accent rounded">
            <RefreshCw className="w-5 h-5 animate-spin" />
          </div>
          <div>
            <h1 className="text-xs font-semibold uppercase tracking-widest text-text-primary">
              Identity Recovery Suite
            </h1>
            <p className="text-[10px] text-text-secondary font-mono mt-0.5">
              VELUM SECURE HANDSHAKE RECOVERY
            </p>
          </div>
        </div>

        <p className="text-[11px] text-text-secondary leading-relaxed">
          Provide your unique username and private recovery key to reset your local passphrase and restore access to your secure direct channel metrics.
        </p>

        {statusMsg && (
          <div className={`p-3 rounded text-[10px] font-mono leading-relaxed border ${
            statusMsg.type === 'success' ? 'bg-status-online/10 border-emerald-950/40 text-emerald-400' : 'bg-rose-500/10 border-rose-950/40 text-rose-400'
          }`}>
            {statusMsg.text}
          </div>
        )}

        <form onSubmit={handleRestoreSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-[9px] uppercase tracking-wider font-bold text-text-secondary font-mono">
              USER HANDLE (WHO ARE YOU?)
            </label>
            <input
              id="restore_username"
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. Midnight"
              className="w-full bg-velum-900 border border-white-5 rounded px-3 py-2 text-xs text-text-primary placeholder:text-text-disabled focus:border-accent focus:outline-none transition font-sans"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-[9px] uppercase tracking-wider font-bold text-text-secondary font-mono">
              PRIVATE SECURE RECOVERY KEY
            </label>
            <input
              id="restore_key"
              type="password"
              required
              value={recoveryKey}
              onChange={(e) => setRecoveryKey(e.target.value)}
              placeholder="e.g. VEL-REC-XXXXXX"
              className="w-full bg-velum-900 border border-white-5 rounded px-3 py-2 text-xs text-text-primary placeholder:text-text-disabled focus:border-accent focus:outline-none transition font-sans"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-[9px] uppercase tracking-wider font-bold text-text-secondary font-mono">
              NEW SECURE PASSPHRASE
            </label>
            <input
              id="restore_password"
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Choose a strong new access code"
              className="w-full bg-velum-900 border border-white-5 rounded px-3 py-2 text-xs text-text-primary placeholder:text-text-disabled focus:border-accent focus:outline-none transition font-sans"
            />
          </div>

          <div className="pt-2 flex gap-3">
            <button
              id="restore_cancel"
              type="button"
              onClick={() => { window.location.pathname = '/'; }}
              className="flex-1 py-1.5 border border-white-5 hover:bg-velum-800 text-text-secondary text-[9px] uppercase font-bold tracking-wider rounded transition cursor-pointer font-sans"
            >
              Back To Handshake
            </button>
            <button
              id="restore_submit"
              type="submit"
              disabled={isRestoring}
              className="flex-1 py-1.5 bg-accent hover:bg-accent-hover text-velum-900 text-[9px] uppercase font-bold tracking-wider rounded transition flex items-center justify-center gap-1.5 cursor-pointer font-sans"
            >
              <span>{isRestoring ? 'Restoring System...' : 'Recover Identity'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
