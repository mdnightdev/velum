import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function MaintenanceBanner() {
  const { user, isAuthenticated, handleLogout } = useAuth();
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [gracePeriodEndsAt, setGracePeriodEndsAt] = useState<number>(0);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0);

  const userId = user ? Number((user as any).userId ?? (user as any).id ?? 0) : 0;
  const userRole = user?.role || '';
  const isWhitelisted = [1, 2, 999].includes(userId) ||
    ['CLI_ADMIN', 'LOGIN_ADMIN', 'SUPPORT_ADMIN', 'ADMIN', 'BANK_ADMIN'].includes(userRole);

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
    const interval = setInterval(checkStatus, 5000);
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

      if (secs <= 0 && isAuthenticated && !isWhitelisted) {
        handleLogout();
      }
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [isMaintenance, gracePeriodEndsAt, isAuthenticated, isWhitelisted, handleLogout]);

  // If maintenance is off, or if user is on the login page (not logged in), hide the sticky top banner
  if (!isMaintenance || !isAuthenticated) return null;

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const formattedTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 animate-fadeIn pointer-events-auto select-none max-w-md w-auto">
      <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-velum-800/95 border border-white-10 backdrop-blur-md shadow-2xl text-text-primary text-xs font-medium tracking-tight">
        <Clock className="w-3.5 h-3.5 flex-shrink-0 text-text-secondary animate-pulse" />
        {isWhitelisted ? (
          <span className="text-text-secondary">Maintenance Active · <span className="text-text-primary font-mono">Whitelisted</span></span>
        ) : secondsRemaining > 0 ? (
          <span className="text-text-secondary">Maintenance in <span className="text-text-primary font-mono font-semibold">{formattedTime}</span> · Wrap up session</span>
        ) : (
          <span className="text-text-secondary">Maintenance active · <span className="text-text-primary">Session ending</span></span>
        )}
      </div>
    </div>
  );
}
