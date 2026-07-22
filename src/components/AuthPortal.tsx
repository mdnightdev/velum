import React, { useState, useEffect } from 'react';
import { ShieldCheck, ShieldAlert, Key, Lock, User, Eye, EyeOff, ChevronLeft, HelpCircle, Zap, Brain } from 'lucide-react';
import PasswordInput from './PasswordInput';
import logoSvg from '../assets/logo.svg?raw';
import { LegalDocModal, LegalDocType } from './LegalDocModal';

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

interface AuthPortalProps {
  isDark: boolean;
  setIsDark: (dark: boolean) => void;
  onLoginSuccess: (user: any, sessionId: string, deviceId: string, activeView: string) => void;
  onMigrationRequired?: (userId: number, username: string) => void;
  tabPrefix: string;
}

export default function AuthPortal({ isDark, onLoginSuccess, onMigrationRequired }: AuthPortalProps) {
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const [isAdminPortal, setIsAdminPortal] = useState(false);
  const [requiresRegisterPermanentOtp, setRequiresRegisterPermanentOtp] = useState(false);
  const [isPermanentOtp, setIsPermanentOtp] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [adminToken, setAdminToken] = useState('');
  const [safeWord, setSafeWord] = useState('');
  const [panicPhrase, setPanicPhrase] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [recoverySuccessMessage, setRecoverySuccessMessage] = useState<string | null>(null);
  const [showRecoveryOptions, setShowRecoveryOptions] = useState(false);
  const [recoveryUsername, setRecoveryUsername] = useState('');
  const [recoverySafeWord, setRecoverySafeWord] = useState('');
  const [recoveryCodeInput, setRecoveryCodeInput] = useState('');
  const [recoveryNewPassword, setRecoveryNewPassword] = useState('');
  const [ticketTrackingId, setTicketTrackingId] = useState('');
  const [activeTicket, setActiveTicket] = useState<any | null>(null);
  const [hasAgreedToTerms, setHasAgreedToTerms] = useState(false);
  const [ticketReplyText, setTicketReplyText] = useState('');
  const [recoveryView, setRecoveryView] = useState<'options' | 'reset' | 'redeem' | 'track'>('options');
  const [redeemUsername, setRedeemUsername] = useState('');
  const [redeemCode, setRedeemCode] = useState('');
  const [redeemNewPassword, setRedeemNewPassword] = useState('');
  const [activeLegalDoc, setActiveLegalDoc] = useState<LegalDocType | null>(null);

  useEffect(() => {
    setUsername('');
    setPassword('');
    setAdminToken('');
    setSafeWord('');
    setPanicPhrase('');
    setInviteCode('');
    setAuthError(null);
    setRecoverySuccessMessage(null);
    setIsAdminPortal(false);
    setRequiresRegisterPermanentOtp(false);
    setIsPermanentOtp(false);
    setRecoveryView('options');
    setRedeemUsername('');
    setRedeemCode('');
    setRedeemNewPassword('');
  }, [authTab, showRecoveryOptions]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (!username.trim() || !password.trim()) {
      setAuthError('Please fill in all standard credentials.');
      return;
    }

    try {
      const saltRes = await fetch(`/api/auth/user-salt?username=${encodeURIComponent(username.trim())}`);
      if (!saltRes.ok) {
        setAuthError('Connection error resolving security salt.');
        return;
      }
      const { salt } = await saltRes.json();
      if (!salt) {
        setAuthError('Cryptographic handshake failed.');
        return;
      }

      // Fetch dynamic single-use login nonce for challenge-response (OWASP ASVS Replay Protection)
      const nonceRes = await fetch('/api/auth/login-nonce');
      if (!nonceRes.ok) {
        setAuthError('Connection error fetching security challenge.');
        return;
      }
      const { nonce } = await nonceRes.json();
      if (!nonce) {
        setAuthError('Cryptographic challenge handshake failed.');
        return;
      }

      const hashedPassword = await computeClientHash(password.trim(), salt);

      if (requiresRegisterPermanentOtp) {
        const res = await fetch('/api/auth/register-permanent-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: username.trim(),
            password: hashedPassword,
            permanentOtp: adminToken.trim()
          })
        });
        const data = await res.json();
        if (res.ok) {
          let destination = 'chat';
          if (data.user?.role === 'CLI_ADMIN') destination = 'cli';
          else if (data.user?.role === 'LOGIN_ADMIN') destination = 'admin';
          onLoginSuccess(data.user, data.sessionId, data.deviceId, destination);
        } else {
          setAuthError(data.error || 'Identity verification rejected.');
        }
        return;
      }

      const payload = {
        username: username.trim(),
        password: hashedPassword,
        fingerprint: 'Velum-Secure-Client-v3',
        token: isAdminPortal ? adminToken.trim() : undefined,
        nonce,
      };

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        if (data.needsMigration) {
          if (onMigrationRequired) {
            onMigrationRequired(data.userId, data.username);
          }
          return;
        }
        if (data.requiresRegisterPermanentOtp) {
          setRequiresRegisterPermanentOtp(true);
          setIsAdminPortal(true);
          return;
        }
        if (data.requiresAdminToken) {
          setIsAdminPortal(true);
          setIsPermanentOtp(!!data.isPermanentOtp);
          return;
        }
        let destination = 'chat';
        if (data.user?.role === 'CLI_ADMIN') destination = 'cli';
        else if (data.user?.role === 'LOGIN_ADMIN') destination = 'admin';
        onLoginSuccess(data.user, data.sessionId, data.deviceId, destination);
      } else {
        if (data.compromisedPortalActive && data.ticket) {
          setAuthError(data.error);
          setActiveTicket(data.ticket);
          setShowRecoveryOptions(true);
        } else {
          setAuthError(data.error || 'Identity verification rejected.');
        }
      }
    } catch {
      setAuthError('Connection handshake failure.');
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setRecoverySuccessMessage(null);

    const formattedUsername = username.trim();
    if (formattedUsername.includes(' ')) {
      setAuthError('Username must not contain any spaces.');
      return;
    }

    if (!password || !safeWord.trim() || !panicPhrase.trim()) {
      setAuthError('Please provide password, security word, and panic phrase.');
      return;
    }

    if (!hasAgreedToTerms) {
      setAuthError('You must agree to the Terms of Service and Privacy Policy to register.');
      return;
    }

    const strengthError = checkPasswordStrength(password);
    if (strengthError) {
      setAuthError(strengthError);
      return;
    }

    try {
      const saltRes = await fetch('/api/auth/pre-signup-salt');
      if (!saltRes.ok) {
        setAuthError('Connection error resolving sign-up parameters.');
        return;
      }
      const { salt } = await saltRes.json();
      if (!salt) {
        setAuthError('Cryptographic setup handshake failed.');
        return;
      }

      const hashedPassword = await computeClientHash(password.trim(), salt);
      const hashedSafeWord = await computeClientHash(safeWord.trim(), salt);
      const hashedPanicPhrase = await computeClientHash(panicPhrase.trim(), salt);

      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: formattedUsername,
          password: hashedPassword,
          safeWord: hashedSafeWord,
          panicPhrase: hashedPanicPhrase,
          inviteCode: inviteCode.trim() || undefined,
          deviceFingerprint: 'Velum-Secure-Client-v3',
          salt: salt,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        const keyMsg = data.recoveryKey 
          ? `Registration complete. Save your recovery key securely: ${data.recoveryKey}`
          : 'Registration complete. Proceed to sign in.';
        setRecoverySuccessMessage(keyMsg);
        setUsername('');
        setPassword('');
        setSafeWord('');
        setPanicPhrase('');
        setInviteCode('');
      } else {
        setAuthError(data.error || 'Registration failed.');
      }
    } catch {
      setAuthError('Connection failure.');
    }
  };

  const handleRestoreAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setRecoverySuccessMessage(null);

    if (!recoveryUsername || !recoverySafeWord || !recoveryCodeInput || !recoveryNewPassword) {
      setAuthError('Verify all required recovery credentials are provided.');
      return;
    }

    const strengthError = checkPasswordStrength(recoveryNewPassword);
    if (strengthError) {
      setAuthError(strengthError);
      return;
    }

    try {
      // Fetch user specific pre-signup recovery salt to hash the recoveryKey prior to submit
      const saltRes = await fetch(`/api/auth/recovery-salt?username=${encodeURIComponent(recoveryUsername.trim())}`);
      if (!saltRes.ok) {
        setAuthError('Fail: Cryptographic credentials map not found for account.');
        return;
      }
      const { salt } = await saltRes.json();
      if (!salt) {
        setAuthError('Fail: Cryptographic parameters trace invalid.');
        return;
      }

      const hashedRecoveryKey = await computeClientHash(recoveryCodeInput.trim(), salt);

      const array = new Uint8Array(32);
      window.crypto.getRandomValues(array);
      const newSalt = Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');

      const hashedPassword = await computeClientHash(recoveryNewPassword.trim(), newSalt);
      const hashedSafeWord = await computeClientHash(recoverySafeWord.trim(), newSalt);

      const res = await fetch('/api/auth/restore-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: recoveryUsername.trim(),
          safeWord: hashedSafeWord,
          recoveryKey: hashedRecoveryKey,
          newPassword: hashedPassword,
          salt: newSalt,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setRecoverySuccessMessage('Account recovered successfully. Please proceed to sign in.');
        setRecoveryUsername('');
        setRecoverySafeWord('');
        setRecoveryCodeInput('');
        setRecoveryNewPassword('');
      } else {
        setAuthError(data.error || 'Password recovery failed.');
      }
    } catch {
      setAuthError('Connection timed out. Please try again.');
    }
  };

  const handleRedeemRestoreCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setRecoverySuccessMessage(null);

    if (!redeemUsername.trim() || !redeemCode.trim() || !redeemNewPassword.trim()) {
      setAuthError('Please verify all fields are provided.');
      return;
    }

    const strengthError = checkPasswordStrength(redeemNewPassword);
    if (strengthError) {
      setAuthError(strengthError);
      return;
    }

    try {
      const saltRes = await fetch(`/api/auth/recovery-salt?username=${encodeURIComponent(redeemUsername.trim())}`);
      if (!saltRes.ok) {
        setAuthError('Fail: Cryptographic parameters invalid.');
        return;
      }
      const { salt } = await saltRes.json();
      if (!salt) {
        setAuthError('Fail: Cryptographic parameters trace invalid.');
        return;
      }

      const hashedPassword = await computeClientHash(redeemNewPassword.trim(), salt);

      const res = await fetch('/api/auth/redeem-restore-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: redeemUsername.trim(),
          restoreCode: redeemCode.trim(),
          newPassword: hashedPassword
        })
      });

      const data = await res.json();
      if (res.ok) {
        setRecoverySuccessMessage('Account recovered successfully. Please proceed to sign in.');
        setRedeemUsername('');
        setRedeemCode('');
        setRedeemNewPassword('');
        setRecoveryView('options');
        setShowRecoveryOptions(false);
      } else {
        setAuthError(data.error || 'Failed to redeem restore code.');
      }
    } catch {
      setAuthError('Failed to execute account restoration.');
    }
  };

  const handleQueryTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (!ticketTrackingId.trim()) return;

    try {
      const res = await fetch(`/api/public/tickets/${encodeURIComponent(ticketTrackingId.trim())}`);
      const data = await res.json();
      if (res.ok) {
        setActiveTicket(data.ticket);
      } else {
        setAuthError(data.error || 'Ticket not found.');
      }
    } catch {
      setAuthError('Failed to load support ticket details.');
    }
  };

  const handleTicketReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketReplyText.trim() || !activeTicket) return;

    try {
      const res = await fetch(`/api/public/tickets/${activeTicket.ticket_id}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          replierName: activeTicket.username || 'Client',
          content: ticketReplyText.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setActiveTicket(data.ticket);
        setTicketReplyText('');
      } else {
        setAuthError(data.error);
      }
    } catch {
      setAuthError('Failed to send reply. Please try again.');
    }
  };

  return (
    <div className={`h-full flex items-center justify-center p-4 font-sans ${isDark ? 'bg-velum-850 text-text-primary' : 'bg-velum-900 text-text-disabled'}`}>
      <div className={`w-full max-w-md p-6 rounded-2xl border shadow-2xl relative overflow-hidden transition-all duration-300 ${isDark ? 'bg-velum-800 border-white-5' : 'bg-text-primary border-gray-200'}`}>
        
        {/* Absolute Bottom-Right corners build version info */}
        <div className="absolute bottom-3 right-3 text-[9px] font-mono font-bold tracking-wider text-text-secondary/25 select-none">
        </div>
        
        {/* Brand Header — premium minimalist */}
        <div className="text-center mb-6 relative">
          <div className="mx-auto mb-3 w-20 h-20 rounded-lg flex items-center justify-center" style={{ background: 'radial-gradient(40% 40% at 30% 30%, rgba(212,131,106,0.06), transparent 30%)' }}>
            <div className="w-16 h-16 flex items-center justify-center rounded-md bg-transparent text-accent">
              {/* Premium Earth Ochre brand mark (same as StartupSplash) */}
              <div 
                className="w-16 h-16 transform transition-transform duration-500 [&>svg]:w-full [&>svg]:h-full" 
                dangerouslySetInnerHTML={{ __html: logoSvg }} 
              />
            </div>
          </div>

          <h1 className="text-2xl font-light tracking-[0.28em] uppercase">Velum</h1>
          <p className="text-[12px] text-text-secondary mt-1">Secure conversations, refined.</p>

          <div className="grid grid-cols-4 gap-2 w-full pt-3 max-w-xs mx-auto">
            <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-text-primary/[0.012] border border-white-5">
              <ShieldCheck className="w-3.5 h-3.5 mb-1 text-accent" />
              <span className="text-[9px] uppercase tracking-wider text-text-primary">Secure</span>
            </div>
            <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-text-primary/[0.012] border border-white-5">
              <EyeOff className="w-3.5 h-3.5 mb-1 text-accent" />
              <span className="text-[9px] uppercase tracking-wider text-text-primary">Private</span>
            </div>
            <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-text-primary/[0.012] border border-white-5">
              <Zap className="w-3.5 h-3.5 mb-1 text-accent" />
              <span className="text-[9px] uppercase tracking-wider text-text-primary">Realtime</span>
            </div>
            <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-text-primary/[0.012] border border-white-5">
              <Brain className="w-3.5 h-3.5 mb-1 text-accent" />
              <span className="text-[9px] uppercase tracking-wider text-text-primary">Encrypted</span>
            </div>
          </div>
        </div>

        {authError && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-mono flex items-start gap-2 animate-fadeIn">
            <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{authError}</span>
          </div>
        )}

        {recoverySuccessMessage && (
          <div className="mb-6 p-4 rounded-xl bg-status-online/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono flex items-start gap-2 animate-fadeIn">
            <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p className="font-semibold select-text">{recoverySuccessMessage}</p>
              <button
                onClick={() => {
                  setRecoverySuccessMessage(null);
                  setAuthTab('login');
                  setShowRecoveryOptions(false);
                }}
                className="text-[9px] uppercase tracking-wider underline cursor-pointer font-bold block"
              >
                Proceed to Login
              </button>
            </div>
          </div>
        )}

        {/* View Selection Route logic */}
        {!showRecoveryOptions ? (
          <>
            {/* Tabs Selector list */}
            <div className="flex border-b border-white-5 mb-6">
              <button
                onClick={() => setAuthTab('login')}
                className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest transition-all ${authTab === 'login' ? 'text-accent border-b-2 border-accent' : 'text-text-secondary hover:text-text-primary'}`}
              >
                Sign In
              </button>
              <button
                onClick={() => setAuthTab('register')}
                className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest transition-all ${authTab === 'register' ? 'text-accent border-b-2 border-accent' : 'text-text-secondary hover:text-text-primary'}`}
              >
                Registration
              </button>
            </div>

            {authTab === 'login' ? (
              <form onSubmit={handleLoginSubmit} className="space-y-4">
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
                          onClick={() => setShowRecoveryOptions(true)}
                          className="text-[9px] uppercase tracking-wider text-accent hover:underline"
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
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
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
                      onClick={() => setAuthTab('register')}
                      className="text-[10px] uppercase font-sans tracking-wider text-accent hover:text-accent-hover transition cursor-pointer font-semibold"
                    >
                      New user? Create an account
                    </button>
                  </div>
                )}
                <div className="mt-2 pt-2 border-t border-white-5 text-center">
                  <button type="button" onClick={() => setActiveLegalDoc('terms')} className="text-[9px] text-text-secondary hover:text-accent underline mr-3 cursor-pointer">Terms of Service</button>
                  <button type="button" onClick={() => setActiveLegalDoc('privacy')} className="text-[9px] text-text-secondary hover:text-accent underline cursor-pointer">Privacy Policy</button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleRegisterSubmit} className="space-y-4">
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
                    I agree to the <button type="button" onClick={() => setActiveLegalDoc('terms')} className="text-accent underline cursor-pointer">Terms of Service</button> and <button type="button" onClick={() => setActiveLegalDoc('privacy')} className="text-accent underline cursor-pointer">Privacy Policy</button>
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
                    onClick={() => setAuthTab('login')}
                    className="text-[10px] uppercase font-sans tracking-wider text-accent hover:text-accent-hover transition cursor-pointer font-semibold"
                  >
                    Already registered? Sign In
                  </button>
                </div>
              </form>
            )}
          </>
        ) : (
          <div className="space-y-6 animate-fadeIn font-sans text-xs">
            <div className="flex items-center gap-2 mb-4 font-mono">
              <button
                onClick={() => {
                  if (recoveryView !== 'options') {
                    setRecoveryView('options');
                  } else {
                    setShowRecoveryOptions(false);
                    setActiveTicket(null);
                  }
                }}
                className="text-text-secondary hover:text-text-primary cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <h2 className="text-sm font-bold uppercase tracking-widest text-accent">
                {recoveryView === 'options' ? 'Account Recovery' : (recoveryView === 'reset' ? 'Reset Password' : (recoveryView === 'redeem' ? 'Redeem Restoration Code' : 'Track Support Ticket'))}
              </h2>
            </div>

            {activeTicket ? (
              <div className="space-y-4">
                <div className="bg-velum-850 border border-white-5 rounded-xl p-4 space-y-4">
                  <div className="flex justify-between items-center pb-2 border-b border-white-5">
                    <div>
                      <p className="text-[9px] uppercase text-text-secondary font-mono">Ticket ID</p>
                      <p className="font-bold text-white text-xs">{activeTicket.ticket_id.slice(0, 8)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] uppercase text-text-secondary font-mono">Status</p>
                      <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${activeTicket.status === 'open' ? 'bg-amber-500/10 text-amber-400' : 'bg-status-online/10 text-emerald-400'}`}>
                        {activeTicket.status}
                      </span>
                    </div>
                  </div>

                  <p className="text-[10px] uppercase text-text-secondary font-bold font-mono">Ticket Messages</p>
                  <div className="max-h-48 overflow-y-auto space-y-2 pr-2">
                    {activeTicket.messages?.map((msg: any, idx: number) => {
                      const isOp = msg.sender_name === 'Support operator';
                      const isSys = msg.sender_name === 'System' || msg.sender_name === 'SYSTEM';

                      if (isSys) {
                        return (
                          <div key={idx} className="text-center py-1">
                            <span className="text-[8px] font-mono text-text-secondary bg-velum-900 px-2 py-0.5 rounded">
                              {msg.content}
                            </span>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={idx}
                          className={`flex flex-col max-w-[85%] rounded-lg p-2.5 text-[10px] space-y-1 ${
                            isOp 
                              ? 'bg-accent/5 border-l-2 border-l-accent mr-auto' 
                              : 'bg-white-5 ml-auto border-r-2 border-r-text-secondary/50'
                          }`}
                        >
                          <div className="flex justify-between gap-4 text-[8px] text-text-secondary font-mono">
                            <span className="font-bold uppercase">{msg.sender_name}</span>
                            <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
                          </div>
                          <p className="text-text-primary font-sans break-words">{msg.content}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <form onSubmit={handleTicketReplySubmit} className="flex gap-2">
                  <input
                    type="text"
                    value={ticketReplyText}
                    onChange={(e) => setTicketReplyText(e.target.value)}
                    placeholder="Type your reply here..."
                    className="flex-grow bg-velum-850 border border-white-5 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-accent"
                    required
                  />
                  <button
                    type="submit"
                    className="bg-accent hover:bg-accent-hover text-zinc-950 font-bold uppercase px-4 rounded-xl text-xs tracking-wider transition cursor-pointer"
                  >
                    Send
                  </button>
                </form>
              </div>
            ) : (
              <div className="space-y-6">
                {recoveryView === 'options' && (
                  <div className="border border-white-5 rounded-xl p-4 bg-text-primary/[0.01] space-y-4">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <HelpCircle className="w-4 h-4 text-accent" />
                      <span>Choose a recovery option</span>
                    </h3>

                    <div className="grid grid-cols-1 gap-2.5">
                      <button
                        onClick={() => setRecoveryView('reset')}
                        className="w-full text-left p-3.5 bg-text-primary/[0.02] hover:bg-text-primary/[0.04] rounded-xl border border-white-5 hover:border-accent/50 transition text-text-primary cursor-pointer"
                      >
                        <p className="text-sm font-semibold text-white">Option A: Reset Password</p>
                        <p className="text-[12px] text-text-secondary mt-1">Use your recovery key (VEL-REC-XXXX) and secret word to set a new password.</p>
                      </button>

                      <button
                        onClick={() => setRecoveryView('redeem')}
                        className="w-full text-left p-3.5 bg-text-primary/[0.02] hover:bg-text-primary/[0.04] rounded-xl border border-white-5 hover:border-accent/50 transition text-text-primary cursor-pointer"
                      >
                        <p className="text-sm font-semibold text-white">Option B: Redeem Restoration Code</p>
                        <p className="text-[12px] text-text-secondary mt-1">If support administrators approved your request and issued a restoration code (LGN-REC-XXXX), redeem it here.</p>
                      </button>

                      <button
                        onClick={() => setRecoveryView('track')}
                        className="w-full text-left p-3.5 bg-text-primary/[0.02] hover:bg-text-primary/[0.04] rounded-xl border border-white-5 hover:border-accent/50 transition text-text-primary cursor-pointer"
                      >
                        <p className="text-sm font-semibold text-white">Option C: Track Support Ticket</p>
                        <p className="text-[12px] text-text-secondary mt-1">Enter your ticket ID to view status and chat with support operators.</p>
                      </button>
                    </div>
                  </div>
                )}

                {recoveryView === 'reset' && (
                  <form onSubmit={handleRestoreAccountSubmit} className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-sm text-text-secondary font-medium block">Username</label>
                      <input
                        type="text"
                        value={recoveryUsername}
                        onChange={(e) => setRecoveryUsername(e.target.value)}
                        placeholder="Enter your username"
                        className="w-full bg-velum-850 border border-white-5 rounded-xl px-4 py-3 text-xs text-white align-middle focus:border-accent focus:outline-none"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-sm text-text-secondary font-medium block">Secret Word</label>
                      <input
                        type="text"
                        value={recoverySafeWord}
                        onChange={(e) => setRecoverySafeWord(e.target.value)}
                        placeholder="Enter your secret word"
                        className="w-full bg-velum-850 border border-white-5 rounded-xl px-4 py-3 text-xs text-white align-middle focus:border-accent focus:outline-none"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-sm text-text-secondary font-medium block">Recovery Key</label>
                      <input
                        type="text"
                        value={recoveryCodeInput}
                        onChange={(e) => setRecoveryCodeInput(e.target.value)}
                        placeholder="VEL-REC-XXXX"
                        className="w-full bg-velum-850 border border-white-5 rounded-xl px-4 py-3 text-xs text-white align-middle focus:border-accent focus:outline-none"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-sm text-text-secondary font-medium block">New Password</label>
                      <PasswordInput
                        value={recoveryNewPassword}
                        onChange={(e) => setRecoveryNewPassword(e.target.value)}
                        placeholder="Choose a strong new password"
                        className="w-full bg-velum-850 border border-white-5 rounded-xl px-4 py-3 text-xs text-white align-middle focus:border-accent focus:outline-none"
                        required
                      />
                    </div>

                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setRecoveryView('options')}
                        className="flex-1 border border-white-5 hover:bg-white-5 text-white font-bold uppercase p-3 rounded-xl transition duration-150 text-xs tracking-wider cursor-pointer"
                      >
                        Back
                      </button>
                      <button
                        type="submit"
                        className="flex-1 bg-accent hover:bg-accent-hover text-zinc-950 font-bold uppercase p-3 rounded-xl transition duration-150 text-xs tracking-wider cursor-pointer"
                      >
                        Reset Password
                      </button>
                    </div>
                  </form>
                )}

                {recoveryView === 'redeem' && (
                  <form onSubmit={handleRedeemRestoreCode} className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-sm text-text-secondary font-medium block">Username</label>
                      <input
                        type="text"
                        value={redeemUsername}
                        onChange={(e) => setRedeemUsername(e.target.value)}
                        placeholder="Enter your username"
                        className="w-full bg-velum-850 border border-white-5 rounded-xl px-4 py-3 text-xs text-white align-middle focus:border-accent focus:outline-none"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-sm text-text-secondary font-medium block">Restoration Code</label>
                      <input
                        type="text"
                        value={redeemCode}
                        onChange={(e) => setRedeemCode(e.target.value)}
                        placeholder="LGN-REC-XXXX"
                        className="w-full bg-velum-850 border border-white-5 rounded-xl px-4 py-3 text-xs text-white align-middle focus:border-accent focus:outline-none"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-sm text-text-secondary font-medium block">New Password</label>
                      <PasswordInput
                        value={redeemNewPassword}
                        onChange={(e) => setRedeemNewPassword(e.target.value)}
                        placeholder="Choose a strong new password"
                        className="w-full bg-velum-850 border border-white-5 rounded-xl px-4 py-3 text-xs text-white align-middle focus:border-accent focus:outline-none"
                        required
                      />
                    </div>

                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setRecoveryView('options')}
                        className="flex-1 border border-white-5 hover:bg-white-5 text-white font-bold uppercase p-3 rounded-xl transition duration-150 text-xs tracking-wider cursor-pointer"
                      >
                        Back
                      </button>
                      <button
                        type="submit"
                        className="flex-1 bg-accent hover:bg-accent-hover text-zinc-950 font-bold uppercase p-3 rounded-xl transition duration-150 text-xs tracking-wider cursor-pointer"
                      >
                        Redeem Code
                      </button>
                    </div>
                  </form>
                )}

                {recoveryView === 'track' && (
                  <form onSubmit={handleQueryTicket} className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-sm text-text-secondary font-medium block">Ticket ID / Tracking ID</label>
                      <input
                        type="text"
                        value={ticketTrackingId}
                        onChange={(e) => setTicketTrackingId(e.target.value)}
                        placeholder="Enter ticket ID"
                        className="w-full bg-velum-850 border border-white-5 rounded-xl px-4 py-3 text-xs text-white align-middle focus:border-accent focus:outline-none"
                        required
                      />
                    </div>

                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setRecoveryView('options')}
                        className="flex-1 border border-white-5 hover:bg-white-5 text-white font-bold uppercase p-3 rounded-xl transition duration-150 text-xs tracking-wider cursor-pointer"
                      >
                        Back
                      </button>
                      <button
                        type="submit"
                        className="flex-1 bg-accent hover:bg-accent-hover text-zinc-950 font-bold uppercase p-3 rounded-xl transition duration-150 text-xs tracking-wider cursor-pointer"
                      >
                        Track Ticket
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <LegalDocModal docType={activeLegalDoc} onClose={() => setActiveLegalDoc(null)} />
    </div>
  );
}
