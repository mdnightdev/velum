/**
 * Type-safe, isolated Session Storage Manager
 * Strictly isolated per browser tab/window without global prototype mutation.
 * Now uses unified storage service for single source of truth.
 */

import { storage } from '../services/storageService';

export class SecureStorage {
  private static readonly SESSION_TOKEN_KEY = 'velum-sessionId';
  private static readonly USER_KEY = 'velum-user';
  private static readonly DEVICE_ID_KEY = 'velum-deviceId';

  public static getSessionToken(): string | null {
    if (typeof window === 'undefined') return null;
    return storage.getItem(this.SESSION_TOKEN_KEY);
  }

  public static setSessionToken(token: string): void {
    if (typeof window === 'undefined') return;
    storage.setItem(this.SESSION_TOKEN_KEY, token);
  }

  public static getUser(): any | null {
    if (typeof window === 'undefined') return null;
    return storage.getItem(this.USER_KEY);
  }

  public static setUser(user: any): void {
    if (typeof window === 'undefined') return;
    storage.setItem(this.USER_KEY, user);
  }

  public static getDeviceId(): string | null {
    if (typeof window === 'undefined') return null;
    return storage.getItem(this.DEVICE_ID_KEY);
  }

  public static setDeviceId(deviceId: string): void {
    if (typeof window === 'undefined') return;
    storage.setItem(this.DEVICE_ID_KEY, deviceId);
  }

  public static clearSession(): void {
    if (typeof window === 'undefined') return;
    storage.removeItem(this.SESSION_TOKEN_KEY);
    storage.removeItem(this.USER_KEY);
    storage.removeItem(this.DEVICE_ID_KEY);
  }
}
