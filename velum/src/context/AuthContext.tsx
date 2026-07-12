import React, { createContext, useContext, useState, useEffect } from 'react';

interface AuthUser {
  userId: number;
  username: string;
  role: 'CLI_ADMIN' | 'LOGIN_ADMIN' | 'SUPPORT_ADMIN' | 'USER' | 'SYSTEM';
  status: string;
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
  const [user, setUser] = useState<AuthUser | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(() => {
    return sessionStorage.getItem('velum-sessionId');
  });
  const [deviceId, setDeviceId] = useState<string | null>(() => {
    return sessionStorage.getItem('velum-deviceId');
  });
  const [isLoadingSession, setIsLoadingSession] = useState<boolean>(true);

  const isAuthenticated = !!user && !!sessionId;

  const handleLoginSuccess = (loginUser: AuthUser, sId: string, dId: string, destination: string) => {
    setUser(loginUser);
    setSessionId(sId);
    setDeviceId(dId);
    
    sessionStorage.setItem('velum-user', JSON.stringify(loginUser));
    sessionStorage.setItem('velum-sessionId', sId);
    sessionStorage.setItem('velum-deviceId', dId);

    if (window.velumDebug) {
      window.velumDebug.userId = loginUser.userId;
      window.velumDebug.username = loginUser.username;
    }
  };

  const handleLogout = () => {
    setUser(null);
    setSessionId(null);
    setDeviceId(null);
    sessionStorage.removeItem('velum-user');
    sessionStorage.removeItem('velum-sessionId');
    sessionStorage.removeItem('velum-deviceId');

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
        const res = await fetch('/api/auth/session', {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sId}`,
            'x-session-id': sId
          }
        });

        if (res.ok) {
          const verifiedUser = await res.json();
          setUser(verifiedUser);
          setSessionId(sId);
          setIsLoadingSession(false);
        } else {
          handleLogout();
          setIsLoadingSession(false);
        }
      } catch (err) {
        console.error('[SYS-SECURE] Boot session verification failed, falling closed:', err);
        handleLogout();
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
