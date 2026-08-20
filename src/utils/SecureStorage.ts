/**
 * Type-safe, isolated Session Storage Manager
 * Strictly isolated per browser tab/window without global prototype mutation.
 */

export class SecureStorage {
  private static readonly SESSION_TOKEN_KEY = 'velum-sessionId';
  private static readonly USER_KEY = 'velum-user';
  private static readonly DEVICE_ID_KEY = 'velum-deviceId';

  public static getSessionToken(): string | null {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem(this.SESSION_TOKEN_KEY);
  }

  public static setSessionToken(token: string): void {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem(this.SESSION_TOKEN_KEY, token);
  }

  public static getUser(): any | null {
    if (typeof window === 'undefined') return null;
    const raw = sessionStorage.getItem(this.USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  public static setUser(user: any): void {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem(this.USER_KEY, JSON.stringify(user));
  }

  public static getDeviceId(): string | null {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem(this.DEVICE_ID_KEY);
  }

  public static setDeviceId(deviceId: string): void {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem(this.DEVICE_ID_KEY, deviceId);
  }

  public static clearSession(): void {
    if (typeof window === 'undefined') return;
    sessionStorage.removeItem(this.SESSION_TOKEN_KEY);
    sessionStorage.removeItem(this.USER_KEY);
    sessionStorage.removeItem(this.DEVICE_ID_KEY);
  }
}
