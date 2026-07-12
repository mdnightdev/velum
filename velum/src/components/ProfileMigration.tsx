import React, { useState } from 'react';
import { ShieldAlert, LogIn, Lock, HelpCircle } from 'lucide-react';

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

interface ProfileMigrationProps {
  migrationUserId: number | null;
  migrationUsername: string;
  onComplete: () => void;
  onCancel: () => void;
}

export default function ProfileMigration({
  migrationUserId,
  migrationUsername,
  onComplete,
  onCancel
}: ProfileMigrationProps) {
  const [password, setPassword] = useState('');
  const [safeWord, setSafeWord] = useState('');
  const [panicPhrase, setPanicPhrase] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleMigrationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || !safeWord || !panicPhrase) {
      setErrorMsg('All fields must be completely populated to update the cryptographic key state.');
      return;
    }

    const strengthError = checkPasswordStrength(password);
    if (strengthError) {
      setErrorMsg(strengthError);
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const saltRes = await fetch(`/api/auth/user-salt?username=${encodeURIComponent(migrationUsername.trim())}`);
      if (!saltRes.ok) {
        setErrorMsg('Fail: Cryptographic credentials map not found for account.');
        setIsSubmitting(false);
        return;
      }
      const { salt } = await saltRes.json();
      if (!salt) {
        setErrorMsg('Fail: Cryptographic parameters trace invalid.');
        setIsSubmitting(false);
        return;
      }

      const hashedPassword = await computeClientHash(password.trim(), salt);
      const hashedSafeWord = await computeClientHash(safeWord.trim(), salt);
      const hashedPanicPhrase = await computeClientHash(panicPhrase.trim(), salt);

      const res = await fetch('/api/auth/migrate-legacy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: migrationUserId,
          username: migrationUsername,
          password: hashedPassword,
          safeWord: hashedSafeWord,
          panicPhrase: hashedPanicPhrase
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        onComplete();
      } else {
        setErrorMsg(data.error || 'Failed to complete credentials transition.');
      }
    } catch (err) {
      setErrorMsg('Connection incident while migrating profile.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full h-full bg-velum-900 flex items-center justify-center font-sans select-none p-4 overflow-y-auto">
      <div className="bg-velum-800 border border-white-5 w-full max-w-md rounded p-6 shadow-2xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/10 text-status-away rounded">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xs font-semibold uppercase tracking-widest text-text-primary">
              Identity Transition Required
            </h1>
            <p className="text-[10px] text-text-secondary font-mono mt-0.5">
              ACCOUNT: @{migrationUsername} (ID: {migrationUserId})
            </p>
          </div>
        </div>

        <p className="text-[11px] text-text-secondary leading-relaxed">
          Velum requires transition of your database footprint. All client secrets (passphrase, SafeWord, and Panic Phrase) will be converted to high-security zero-knowledge Argon2id hashes.
        </p>

        {errorMsg && (
          <div className="p-3 bg-rose-500/10 border border-rose-950/40 text-rose-450 rounded text-[10px] font-mono leading-relaxed">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleMigrationSubmit} className="space-y-4">
          <div className="space-y-1.5ClassName">
            <label className="block text-[9px] uppercase tracking-wider font-bold text-text-secondary font-mono">
              NEW SECURE PASSPHRASE
            </label>
            <div className="relative">
              <input
                id="migration_password_input"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Required for standard handshakes"
                className="w-full bg-velum-900 border border-white-5 rounded px-3 py-2 text-xs text-text-primary placeholder:text-text-disabled focus:border-accent focus:outline-none transition font-sans"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[9px] uppercase tracking-wider font-bold text-text-secondary font-mono">
              SAFEWORD RESPONSE
            </label>
            <div className="relative">
              <input
                id="migration_safeword_input"
                type="password"
                required
                value={safeWord}
                onChange={(e) => setSafeWord(e.target.value)}
                placeholder="Safeword to sign out of terminal instantly"
                className="w-full bg-velum-900 border border-white-5 rounded px-3 py-2 text-xs text-text-primary placeholder:text-text-disabled focus:border-accent focus:outline-none transition font-sans"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[9px] uppercase tracking-wider font-bold text-text-secondary font-mono">
              PANIC PHRASE
            </label>
            <div className="relative">
              <input
                id="migration_panic_input"
                type="password"
                required
                value={panicPhrase}
                onChange={(e) => setPanicPhrase(e.target.value)}
                placeholder="Panic phrase triggers instant storage purge"
                className="w-full bg-velum-900 border border-white-5 rounded px-3 py-2 text-xs text-text-primary placeholder:text-text-disabled focus:border-accent focus:outline-none transition font-sans"
              />
            </div>
          </div>

          <div className="pt-2 flex gap-3">
            <button
              id="migration_cancel_button"
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="flex-1 py-2 border border-white-5 hover:bg-velum-800 text-text-secondary text-[9px] uppercase font-bold tracking-wider rounded transition cursor-pointer font-sans"
            >
              Cancel
            </button>
            <button
              id="migration_submit_button"
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-1.5 bg-accent hover:bg-accent-hover text-velum-900 text-[9px] uppercase font-bold tracking-wider rounded transition flex items-center justify-center gap-1.5 cursor-pointer font-sans"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Hashing...' : 'Authorize Upgrade'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
