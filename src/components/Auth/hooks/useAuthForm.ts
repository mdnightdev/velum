import { useState, useEffect } from 'react';
import { collectDeviceFingerprint } from '../../../utils/deviceFingerprint.js';
import { computeClientHash, checkPasswordStrength } from '../utils/crypto';
import { LegalDocType } from '../../LegalDocModal';
import { RecoveryViewMode } from '../AccountRecovery';

interface UseAuthFormOptions {
  onLoginSuccess: (user: any, sessionId: string, deviceId: string, activeView: string) => void;
  onMigrationRequired?: (userId: number, username: string) => void;
}

export function useAuthForm({ onLoginSuccess, onMigrationRequired }: UseAuthFormOptions) {
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const [isAdminPortal, setIsAdminPortal] = useState(false);
  const [requiresRegisterPermanentOtp, setRequiresRegisterPermanentOtp] = useState(false);
  const [isPermanentOtp, setIsPermanentOtp] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [adminToken, setAdminToken] = useState('');
  const [safeWord, setSafeWord] = useState('');
  const [panicPhrase, setPanicPhrase] = useState('');
  const [isCompromised, setIsCompromised] = useState(false);
  const [compromiseTicketId, setCompromiseTicketId] = useState('');
  const [showCompromisedFlow, setShowCompromisedFlow] = useState(false);
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
  const [recoveryView, setRecoveryView] = useState<RecoveryViewMode>('options');
  const [redeemUsername, setRedeemUsername] = useState('');
  const [redeemCode, setRedeemCode] = useState('');
  const [redeemNewPassword, setRedeemNewPassword] = useState('');
  const [deviceFingerprint, setDeviceFingerprint] = useState('');
  const [activeLegalDoc, setActiveLegalDoc] = useState<LegalDocType | null>(null);

  useEffect(() => {
    collectDeviceFingerprint().then(({ deviceId }) => {
      setDeviceFingerprint(deviceId);
    });
  }, []);

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
      const saltRes = await fetch(`/v2/auth/user-salt?username=${encodeURIComponent(username.trim())}`);
      if (!saltRes.ok) {
        setAuthError('Connection error resolving security salt.');
        return;
      }
      const { salt } = await saltRes.json();
      if (!salt) {
        setAuthError('Cryptographic handshake failed.');
        return;
      }

      const nonceRes = await fetch('/v2/auth/login-nonce');
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
        const res = await fetch('/v2/auth/register-permanent-otp', {
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
          else if (data.user?.role === 'LOGIN_ADMIN' || data.user?.role === 'SUPPORT_ADMIN' || data.user?.role === 'ADMIN') destination = 'admin';
          onLoginSuccess(data.user, data.sessionId, data.deviceId, destination);
        } else {
          setAuthError(data.error || 'Identity verification rejected.');
        }
        return;
      }

      const payload = {
        username: username.trim(),
        password: password,
        panicPhrase: panicPhrase.trim() || undefined,
        fingerprint: deviceFingerprint,
        token: isAdminPortal ? adminToken.trim() : undefined,
        nonce,
      };

      const res = await fetch('/v2/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        if (data.compromised) {
          setIsCompromised(true);
          setCompromiseTicketId(data.ticketId);
          setShowCompromisedFlow(true);
          return;
        }
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
        else if (data.user?.role === 'LOGIN_ADMIN' || data.user?.role === 'SUPPORT_ADMIN' || data.user?.role === 'ADMIN') destination = 'admin';
        
        const deviceId = data.deviceId || (await collectDeviceFingerprint()).deviceId;
        
        onLoginSuccess(data.user, data.token || data.sessionId, deviceId, destination);
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
      const saltRes = await fetch('/v2/auth/pre-signup-salt');
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

      const res = await fetch('/v2/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: formattedUsername,
          password: password,
          safeWord: hashedSafeWord,
          panicPhrase: hashedPanicPhrase,
          inviteCode: inviteCode.trim() || undefined,
          deviceFingerprint: 'Velum-Secure-Client-v3',
          salt: salt,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setRecoverySuccessMessage('Registration complete. Check your Velum Bot DM for your recovery key.');
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
      const saltRes = await fetch(`/v2/auth/recovery-salt?username=${encodeURIComponent(recoveryUsername.trim())}`);
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

      const res = await fetch('/v2/auth/restore-account', {
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
      const saltRes = await fetch(`/v2/auth/recovery-salt?username=${encodeURIComponent(redeemUsername.trim())}`);
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

      const res = await fetch('/v2/auth/redeem-restore-code', {
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
      const res = await fetch(`/v2/public/tickets/${encodeURIComponent(ticketTrackingId.trim())}`);
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
      const res = await fetch(`/v2/public/tickets/${activeTicket.ticket_id}/reply`, {
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

  const resetCompromisedState = () => {
    setShowCompromisedFlow(false);
    setIsCompromised(false);
    setCompromiseTicketId('');
    setAuthTab('login');
  };

  const resetRecoveryState = () => {
    setShowRecoveryOptions(false);
    setActiveTicket(null);
  };

  return {
    authTab,
    setAuthTab,
    isAdminPortal,
    requiresRegisterPermanentOtp,
    isPermanentOtp,
    username,
    setUsername,
    password,
    setPassword,
    adminToken,
    setAdminToken,
    safeWord,
    setSafeWord,
    panicPhrase,
    setPanicPhrase,
    isCompromised,
    compromiseTicketId,
    showCompromisedFlow,
    inviteCode,
    setInviteCode,
    showPassword,
    setShowPassword,
    authError,
    setAuthError,
    recoverySuccessMessage,
    showRecoveryOptions,
    setShowRecoveryOptions,
    recoveryUsername,
    setRecoveryUsername,
    recoverySafeWord,
    setRecoverySafeWord,
    recoveryCodeInput,
    setRecoveryCodeInput,
    recoveryNewPassword,
    setRecoveryNewPassword,
    ticketTrackingId,
    setTicketTrackingId,
    activeTicket,
    hasAgreedToTerms,
    setHasAgreedToTerms,
    ticketReplyText,
    setTicketReplyText,
    recoveryView,
    setRecoveryView,
    redeemUsername,
    setRedeemUsername,
    redeemCode,
    setRedeemCode,
    redeemNewPassword,
    setRedeemNewPassword,
    activeLegalDoc,
    setActiveLegalDoc,
    handleLoginSubmit,
    handleRegisterSubmit,
    handleRestoreAccountSubmit,
    handleRedeemRestoreCode,
    handleQueryTicket,
    handleTicketReplySubmit,
    resetCompromisedState,
    resetRecoveryState,
  };
}
