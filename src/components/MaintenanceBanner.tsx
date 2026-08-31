import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function MaintenanceBanner() {
  const { user, isAuthenticated, handleLogout } = useAuth();
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [gracePeriodEndsAt, setGracePeriodEndsAt] = useState<number>(0);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0);

  const isWhitelisted = user && (
    [1, 2, 999].includes(user.userId) ||
    ['CLI_ADMIN', 'LOGIN_ADMIN', 'SUPPORT_ADMIN', 'ADMIN', 'BANK_ADMIN'].includes(user.role)
  );

  useEffect(() => {
    const checkStatus = () => {
      fetch('/v2/public/system-status')
        .then(res => res.json())
        .then(data => {
          if (data && data.maintenanceMode) {
            setIsMaintenance(true);
            setGracePeriodEndsAt(data.gracePeriodEndsAt || 0);
          } else {
            setIsMaintenance(false);
            setGracePeriodEndsAt(0);
          }
        })
        .catch(() => {});
    };

    checkStatus();
    const interval = setInterval(checkStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!isMaintenance || !gracePeriodEndsAt) {
      setSecondsRemaining(0);
      return;
    }

    const updateTimer = () => {
      const remainingMs = gracePeriodEndsAt - Date.now();
      const secs = Math.max(0, Math.ceil(remainingMs / 1000));
      setSecondsRemaining(secs);

      if (secs === 0 && isAuthenticated && !isWhitelisted) {
        // Grace period expired for non-admin user
        handleLogout();
      }
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [isMaintenance, gracePeriodEndsAt, isAuthenticated, isWhitelisted, handleLogout]);

  if (!isMaintenance) return null;

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const formattedTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  return (
    <div className="fixed top-4 right-4 z-50 animate-fadeIn pointer-events-auto select-none">
      <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500/10 border border-amber-500/25 backdrop-blur-md shadow-lg text-amber-400 text-xs font-medium">
        <Clock className="w-3.5 h-3.5 flex-shrink-0 animate-pulse text-amber-400" />
        {secondsRemaining > 0 ? (
          <span>System maintenance starting in <strong className="font-mono">{formattedTime}</strong></span>
        ) : (
          <span>System maintenance in progress</span>
        )}
      </div>
    </div>
  );
}
