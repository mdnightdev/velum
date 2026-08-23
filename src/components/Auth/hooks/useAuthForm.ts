import { useState, useEffect } from 'react';
import { collectDeviceFingerprint } from '../../../utils/deviceFingerprint.js';
import { computeClientHash, checkPasswordStrength } from '../utils/crypto';
import { LegalDocType } from '../../LegalDocModal';
import { RecoveryViewMode } from '../AccountRecovery';
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';

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
  const [enableBiometrics, setEnableBiometrics] = useState(true);
  const [ticketReplyText, setTicketReplyText] = useState('');
  const [recoveryView, setRecoveryView] = useState<RecoveryViewMode>('options');
  const [redeemUsername, setRedeemUsername] = useState('');
  const [redeemCode, setRedeemCode] = useState('');
  const [deviceFingerprint, setDeviceFingerprint] = useState('');
  const [activeLegalDoc, setActiveLegalDoc] = useState<LegalDocType | null>(null);

  // Security: Wipe unsubmitted credentials if user switches apps or minimizes the tab
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        setUsername('');
        setPassword('');
        setAdminToken('');
        setSafeWord('');
        setPanicPhrase('');
        setInviteCode('');
        setRecoveryUsername('');
        setRecoverySafeWord('');
        setRecoveryCodeInput('');
        setRecoveryNewPassword('');
        setRedeemUsername('');
        setRedeemCode('');
        setRedeemNewPassword('');
        setAuthError(null);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const handlePasskeyLogin = async () => {
    setAuthError(null);
    try {
      const optsRes = await fetch('/api/v2/webauthn/authenticate/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim() || undefined }),
      });
  
      if (!optsRes.ok) {
        const data = await optsRes.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to get passkey options');
      }
  
      const options = await optsRes.json();
      if (options.allowCredentials && options.allowCredentials.length === 0 && username.trim()) {
        throw new Error(`No passkey registered for ${username.trim()}. Please sign in with password first to add a Passkey in Settings.`);
      }

      const authResp = await startAuthentication({ optionsJSON: options });
  
      const verifyRes = await fetch('/api/v2/webauthn/authenticate/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          response: authResp,
          username: username.trim() || undefined,
        }),
      });
  
      const verifyData = await verifyRes.json().catch(() => ({}));
      if (!verifyRes.ok || !verifyData.verified) {
        throw new Error(verifyData.error || 'Passkey authentication failed');
      }
  
      const sessionToken = verifyData.sessionId || verifyData.sessionToken || '';
      const deviceId = verifyData.deviceId || deviceFingerprint || 'passkey-auth';
      onLoginSuccess(verifyData.user, sessionToken, deviceId, 'main');
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        setAuthError('Passkey prompt cancelled. If you have not registered a Passkey yet, sign in with your password and add one in Settings -> Privacy.');
      } else {
        setAuthError(err.message || 'Passkey verification failed');
      }
    }
  };

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
    setShowRecoveryOptions(false);
    setIsAdminPortal(false);
  }, [authTab]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setRecoverySuccessMessage(null);

    try {
      let nonce = '';
      try {
        const challengeRes = await fetch('/v2/auth/login-nonce');
        if (challengeRes.ok) {
          const data = await challengeRes.json();
          nonce = data.nonce || '';
        }
      } catch {
        nonce = `fallback_${Date.now()}`;
      }

      if (requiresRegisterPermanentOtp) {
        const res = await fetch('/v2/auth/register-permanent-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: username.trim(),
            password: password.trim(),
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
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (res.ok) {
        if (data.showCompromisedFlow) {
          setShowCompromisedFlow(true);
          setCompromiseTicketId(data.compromiseTicketId || '');
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
        setAuthError('Setup failed.');
        return;
      }

      const res = await fetch('/v2/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: formattedUsername,
          password: password,
          safeWord: safeWord.trim(),
          panicPhrase: panicPhrase.trim(),
          inviteCode: inviteCode.trim() || undefined,
          deviceFingerprint: 'Velum-Web-v3',
          salt: salt,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        // Automatic login after registration
        const loginPayload = {
          username: formattedUsername,
          password: password,
          fingerprint: deviceFingerprint,
          nonce: data.nonce || `reg_${Date.now()}`
        };

        const loginRes = await fetch('/v2/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(loginPayload)
        });

        if (loginRes.ok) {
          const loginData = await loginRes.json();
          const sessionToken = loginData.token || loginData.sessionId;

          // If biometrics/passkey requested, register hardware passkey immediately
          if (enableBiometrics && sessionToken) {
            try {
              const optRes = await fetch('/api/v2/webauthn/register/options', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${sessionToken}`
                }
              });

              if (optRes.ok) {
                const options = await optRes.json();
                const regResponse = await startRegistration({ optionsJSON: options });
                await fetch('/api/v2/webauthn/register/verify', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionToken}`
                  },
                  body: JSON.stringify({
                    response: regResponse,
                    nickname: `Primary Passkey (${new Date().toLocaleDateString()})`
                  })
                });
              }
            } catch (bioErr) {
              console.warn('[WebAuthn] Initial biometric enrollment skipped or cancelled:', bioErr);
            }
          }

          const deviceId = loginData.deviceId || (await collectDeviceFingerprint()).deviceId;
          onLoginSuccess(loginData.user, sessionToken, deviceId, 'chat');
          return;
        }

        setRecoverySuccessMessage('Registration complete. You can now sign in.');
        setAuthTab('login');
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
      const res = await fetch('/v2/auth/restore-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: recoveryUsername.trim(),
          safeWord: recoverySafeWord.trim(),
          recoveryKey: recoveryCodeInput.trim(),
          newPassword: recoveryNewPassword.trim(),
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
      const res = await fetch('/v2/auth/redeem-restore-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: redeemUsername.trim(),
          restoreCode: redeemCode.trim(),
          newPassword: redeemNewPassword.trim()
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
        setActiveTicket(data.ticket || data);
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

    const targetId = activeTicket.tracking_id || activeTicket.trackingId || activeTicket.ticket_id || activeTicket.id;

    try {
      const res = await fetch(`/v2/public/tickets/${targetId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderName: activeTicket.username || 'Client',
          content: ticketReplyText.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setActiveTicket(data.ticket || data);
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
    enableBiometrics,
    setEnableBiometrics,
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
    handlePasskeyLogin,
    handleRegisterSubmit,
    handleRestoreAccountSubmit,
    handleRedeemRestoreCode,
    handleQueryTicket,
    handleTicketReplySubmit,
    resetCompromisedState,
    resetRecoveryState,
  };
}
