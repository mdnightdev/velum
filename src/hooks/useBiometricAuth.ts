import { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { BiometricAuth, CheckBiometryResult } from '@aparajita/capacitor-biometric-auth';

const BIOMETRIC_SESSION_KEY = 'velum_biometric_session';

export interface SavedBiometricSession {
  user: any;
  token: string;
  deviceId: string;
  savedAt: number;
}

export function saveBiometricSession(user: any, token: string, deviceId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: SavedBiometricSession = {
      user,
      token,
      deviceId,
      savedAt: Date.now()
    };
    localStorage.setItem(BIOMETRIC_SESSION_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn('[Biometrics] Failed to persist session:', err);
  }
}

export function getBiometricSession(): SavedBiometricSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(BIOMETRIC_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.token && parsed.user) {
      return parsed as SavedBiometricSession;
    }
  } catch (err) {
    console.warn('[Biometrics] Failed to read session:', err);
  }
  return null;
}

export function clearBiometricSession(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(BIOMETRIC_SESSION_KEY);
  } catch {}
}

export function hasSavedBiometrics(): boolean {
  return !!getBiometricSession();
}

export function useBiometricAuth() {
  const [isAvailable, setIsAvailable] = useState<boolean>(false);
  const [biometryInfo, setBiometryInfo] = useState<CheckBiometryResult | null>(null);
  const [hasSavedSession, setHasSavedSession] = useState<boolean>(false);

  useEffect(() => {
    setHasSavedSession(hasSavedBiometrics());
  }, []);

  useEffect(() => {
    async function checkAvailability() {
      if (!Capacitor.isNativePlatform()) return;
      try {
        const info = await BiometricAuth.checkBiometry();
        setBiometryInfo(info);
        setIsAvailable(info.isAvailable || info.deviceIsSecure);
      } catch (err) {
        console.error('[Biometrics] Check error:', err);
        setIsAvailable(false);
      }
    }
    checkAvailability();
  }, []);

  const authenticate = useCallback(async (reason: string = 'Confirm identity to proceed'): Promise<boolean> => {
    if (!Capacitor.isNativePlatform()) return false;
    try {
      await BiometricAuth.authenticate({
        reason,
        cancelTitle: 'Cancel',
        allowDeviceCredential: true
      });
      return true;
    } catch (err) {
      console.warn('[Biometrics] Authentication failed/cancelled:', err);
      return false;
    }
  }, []);

  return {
    isNative: Capacitor.isNativePlatform(),
    isAvailable,
    hasSavedSession,
    biometryInfo,
    authenticate,
    saveSession: saveBiometricSession,
    getSession: getBiometricSession,
    clearSession: clearBiometricSession
  };
}
