import React, { createContext, useContext, useState, useEffect, startTransition } from 'react';
import { createLogger } from '../utils/logger';
import { purgeSkippedMessageKeys } from '../services/skippedKeysStore';
import { purgeCryptoVault } from '../services/cryptoDbStore';
import { purgeLocalMessages } from '../utils/indexedDb';
import { doubleRatchetService } from '../services/doubleRatchetService';

const log = createLogger('AuthContext');


interface AuthUser {
  userId: number;
  username: string;
  role: 'CLI_ADMIN' | 'LOGIN_ADMIN' | 'SUPPORT_ADMIN' | 'ADMIN' | 'USER' | 'SYSTEM' | string;
  status: string;
  duress_active?: boolean;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: AuthUser | null;
  sessionId: string | null;
  deviceId: string | null;
  handleLogout: () => void;
  handleLoginSuccess: (user: AuthUser, sessionId: string, deviceId: string, destination: string) => void;
  resetFormStates: () => void;
  isLoadingSession: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const cached = sessionStorage.getItem('velum-user');
      return cached ? JSON.parse(cached) : null;
    } catch (_) { return null; }
  });
  const [sessionId, setSessionId] = useState<string | null>(() => {
    return sessionStorage.getItem('velum-sessionId');
  });
  const [deviceId, setDeviceId] = useState<string | null>(() => {
    return sessionStorage.getItem('velum-deviceId');
  });
  const [isLoadingSession, setIsLoadingSession] = useState<boolean>(() => {
    const hasCachedUser = sessionStorage.getItem('velum-sessionId') &&
                          sessionStorage.getItem('velum-user');
    return !hasCachedUser;
  });

  const isAuthenticated = !!user && !!sessionId;

  const handleLoginSuccess = (loginUser: AuthUser, sId: string, dId: string, destination: string) => {
    if (user && user.userId !== loginUser.userId) {
      log.warn('Cross-identity login detected. Purging crypto vault.');
      purgeCryptoVault().catch(() => {});
    purgeLocalMessages().catch(() => {});
    doubleRatchetService.clearMemoryState();
    }

    setUser(loginUser);
    setSessionId(sId);
    setDeviceId(dId);
    
    try {
      sessionStorage.setItem('velum-user', JSON.stringify(loginUser));
      sessionStorage.setItem('velum-sessionId', sId);
      sessionStorage.setItem('velum-deviceId', dId);
    } catch (e) {
      log.warn('Session storage write warning', { error: (e as Error).message });
    }

    if (window.velumDebug) {
      window.velumDebug.userId = loginUser.userId;
      window.velumDebug.username = loginUser.username;
    }
  };

  const handleLogout = () => {
    // Purge E2EE decryption keys from IndexedDB
    purgeSkippedMessageKeys().catch(() => {});
    purgeCryptoVault().catch(() => {});
    purgeLocalMessages().catch(() => {});
    doubleRatchetService.clearMemoryState();

    // Purge plaintext saved notes from localStorage for vault safety
    if (user?.userId) {
      try {
        localStorage.removeItem(`velum-notes-${user.userId}`);
      } catch (e) {}
    }

    startTransition(() => {
      setUser(null);
      setSessionId(null);
      setDeviceId(null);
    });

    try {
      sessionStorage.removeItem('velum-user');
      sessionStorage.removeItem('velum-sessionId');
      sessionStorage.removeItem('velum-deviceId');
    } catch (e) {
      log.warn('Session storage clear warning', { error: (e as Error).message });
    }

    if (window.velumDebug) {
      window.velumDebug.userId = null;
      window.velumDebug.username = null;
    }
  };

  const resetFormStates = () => {
    // Zero operational overhead form state reset
  };

  // Boot Session Verification Hook
  useEffect(() => {
    const verifySessionOnBoot = async () => {
      const sId = sessionStorage.getItem('velum-sessionId');
      if (!sId) {
        handleLogout();
        setIsLoadingSession(false);
        return;
      }

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const res = await fetch('/v2/auth/me', {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sId}`,
            'x-session-id': sId
          },
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const data = await res.json();
            const verifiedUser = data.user || data;
            setUser(verifiedUser);
            setSessionId(sId);
            try {
              sessionStorage.setItem('velum-user', JSON.stringify(verifiedUser));
            } catch (_) {}
            setIsLoadingSession(false);
            return;
          }
        } else if (res.status === 401 || res.status === 403) {
          handleLogout();
          setIsLoadingSession(false);
          return;
        }
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          log.error('Session verification notice', { error: (err as Error).message });
        }
        // Fall back to cached session user if server is slow or unreachable
        const cachedUserStr = sessionStorage.getItem('velum-user');
        if (cachedUserStr) {
          try {
            const cachedUser = JSON.parse(cachedUserStr);
            setUser(cachedUser);
            setSessionId(sId);
            setIsLoadingSession(false);
            return;
          } catch (_) {}
        }
        setIsLoadingSession(false);
      }
    };

    verifySessionOnBoot();
  }, []);

  // Sync debug states on initial load
  useEffect(() => {
    if (user && window.velumDebug) {
      window.velumDebug.userId = user.userId;
      window.velumDebug.username = user.username;
    }
  }, [user]);

  return (
    <AuthContext.Provider value={{
      isAuthenticated,
      user,
      sessionId,
      deviceId,
      handleLogout,
      handleLoginSuccess,
      resetFormStates,
      isLoadingSession
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
