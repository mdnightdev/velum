import { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { BiometricAuth, CheckBiometryResult } from '@aparajita/capacitor-biometric-auth';

export function useBiometricAuth() {
  const [isAvailable, setIsAvailable] = useState<boolean>(false);
  const [biometryInfo, setBiometryInfo] = useState<CheckBiometryResult | null>(null);

  useEffect(() => {
    async function checkAvailability() {
      if (!Capacitor.isNativePlatform()) return;
      try {
        const info = await BiometricAuth.checkBiometry();
        setBiometryInfo(info);
        setIsAvailable(info.isAvailable);
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
    biometryInfo,
    authenticate
  };
}
