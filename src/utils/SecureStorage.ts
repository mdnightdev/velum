export class SecureStorage {
  private static VELUM_KEYS = ['velum-user', 'velum-sessionId', 'velum-deviceId'];

  /**
   * Derives a simple deterministic checksum for a given string value.
   * Note: In a browser environment, synchronous Web Crypto isn't available for hashing,
   * so we use a fast non-cryptographic hash for structural integrity checks against corruption.
   */
  private static checksum(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0; // Convert to 32bit integer
    }
    return hash.toString(16);
  }

  private static pack(value: string): string {
    const sum = this.checksum(value);
    return JSON.stringify({ v: value, c: sum });
  }

  private static unpack(payload: string | null): string | null {
    if (!payload) return null;
    try {
      const parsed = JSON.parse(payload);
      if (parsed && typeof parsed.v === 'string' && typeof parsed.c === 'string') {
        if (this.checksum(parsed.v) === parsed.c) {
          return parsed.v;
        } else {
          console.error('[SecureStorage] Checksum mismatch detected! Data corrupted.');
          return null;
        }
      }
      // Backwards compatibility if it wasn't packed yet
      return payload;
    } catch (e) {
      // If it fails to parse as JSON, it might be raw legacy data.
      return payload;
    }
  }

  public static initializeOverrides(): void {
    // 1. Initial sync
    for (const key of this.VELUM_KEYS) {
      try {
        const localVal = localStorage.getItem(key);
        const sessionVal = sessionStorage.getItem(key);

        const unpackedLocal = this.unpack(localVal);
        const unpackedSession = this.unpack(sessionVal);

        if (unpackedLocal && !unpackedSession) {
          sessionStorage.setItem(key, this.pack(unpackedLocal));
        } else if (unpackedSession && !unpackedLocal) {
          localStorage.setItem(key, this.pack(unpackedSession));
        }
      } catch (_) {}
    }

    // 2. Override Storage prototype for setItem, getItem, removeItem
    try {
      const originalSessionSetItem = sessionStorage.setItem;
      const originalSessionGetItem = sessionStorage.getItem;
      const originalSessionRemoveItem = sessionStorage.removeItem;
      
      const originalLocalSetItem = localStorage.setItem;
      const originalLocalGetItem = localStorage.getItem;
      const originalLocalRemoveItem = localStorage.removeItem;

      const self = this;

      // Override SessionStorage
      sessionStorage.setItem = function(key: string, value: string) {
        if (self.VELUM_KEYS.includes(key)) {
          const packed = self.pack(value);
          originalSessionSetItem.call(sessionStorage, key, packed);
          originalLocalSetItem.call(localStorage, key, packed);
        } else {
          originalSessionSetItem.call(sessionStorage, key, value);
        }
      };

      sessionStorage.getItem = function(key: string) {
        const raw = originalSessionGetItem.call(sessionStorage, key);
        if (self.VELUM_KEYS.includes(key)) {
          return self.unpack(raw);
        }
        return raw;
      };

      sessionStorage.removeItem = function(key: string) {
        originalSessionRemoveItem.call(sessionStorage, key);
        if (self.VELUM_KEYS.includes(key)) {
          originalLocalRemoveItem.call(localStorage, key);
        }
      };

      // Override LocalStorage (Read)
      localStorage.getItem = function(key: string) {
        const raw = originalLocalGetItem.call(localStorage, key);
        if (self.VELUM_KEYS.includes(key)) {
          return self.unpack(raw);
        }
        return raw;
      };
      
      // Override LocalStorage (Write)
      localStorage.setItem = function(key: string, value: string) {
        if (self.VELUM_KEYS.includes(key)) {
          const packed = self.pack(value);
          originalLocalSetItem.call(localStorage, key, packed);
          originalSessionSetItem.call(sessionStorage, key, packed);
        } else {
          originalLocalSetItem.call(localStorage, key, value);
        }
      };
      
      localStorage.removeItem = function(key: string) {
        originalLocalRemoveItem.call(localStorage, key);
        if (self.VELUM_KEYS.includes(key)) {
          originalSessionRemoveItem.call(sessionStorage, key);
        }
      };

    } catch (_) {}
  }

  public static clearAll(): void {
    localStorage.clear();
    sessionStorage.clear();
  }
}
