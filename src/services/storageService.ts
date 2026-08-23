/**
 * Unified Storage Service - Single Source of Truth
 */

type StorageType = 'local' | 'session';

interface StoragePolicy {
  storageType: StorageType;
  ttl?: number; // Time to live in milliseconds
  encrypted?: boolean;
}

// Storage policies for different data types
const STORAGE_POLICIES: Record<string, StoragePolicy> = {
  // Authentication - localStorage for persistence across app switches, tabs, and reloads
  'session_token': { storageType: 'local' },
  'velum-sessionId': { storageType: 'local' },
  'velum_sessionId': { storageType: 'local' },
  'velum-user': { storageType: 'local' },
  'velum_user': { storageType: 'local' },
  'velum-deviceId': { storageType: 'local' },
  'auth_state': { storageType: 'local' },
  'oauth_state': { storageType: 'session' },
  'webauthn_challenge': { storageType: 'session' },
  
  // User preferences - localStorage for persistence
  'user_preferences': { storageType: 'local' },
  'theme': { storageType: 'local' },
  'language': { storageType: 'local' },
  'notifications_enabled': { storageType: 'local' },
  'velum-cart': { storageType: 'local' },
  'velum-last-vault-rotation': { storageType: 'local' },
  
  // Security keys - localStorage (needed across sessions)
  'encryption_key': { storageType: 'local', encrypted: true },
  'private_key': { storageType: 'local', encrypted: true },
  'device_key': { storageType: 'local' },
  
  // Cache - localStorage for persistence
  'cache_': { storageType: 'local', ttl: 3600000 }, // 1 hour default
  'api_cache_': { storageType: 'local', ttl: 300000 }, // 5 minutes
  'velum_cached_lounges': { storageType: 'local', ttl: 3600000 },
  'velum_cache_lounge_': { storageType: 'local', ttl: 3600000 },
  
  // Temporary state - sessionStorage
  'temp_': { storageType: 'session' },
  'ui_state_': { storageType: 'session' },
  'form_draft_': { storageType: 'session' },
};

class StorageService {
  private getStorage(policy: StoragePolicy): Storage {
    return policy.storageType === 'local' ? localStorage : sessionStorage;
  }

  private getPolicyForKey(key: string): StoragePolicy {
    // Check for exact match
    if (STORAGE_POLICIES[key]) {
      return STORAGE_POLICIES[key];
    }
    
    // Check for prefix matches
    for (const [pattern, policy] of Object.entries(STORAGE_POLICIES)) {
      if (pattern.endsWith('_') && key.startsWith(pattern)) {
        return policy;
      }
    }
    
    // Default: localStorage for unknown keys (safer default)
    return { storageType: 'local' };
  }

  setItem(key: string, value: any, options?: { storageType?: StorageType; ttl?: number }): void {
    const policy = options?.storageType 
      ? { ...this.getPolicyForKey(key), storageType: options.storageType }
      : this.getPolicyForKey(key);
    
    const storage = this.getStorage(policy);
    
    const item = {
      value,
      timestamp: Date.now(),
      ttl: options?.ttl || policy.ttl
    };
    
    try {
      storage.setItem(key, JSON.stringify(item));
    } catch (error) {
      console.error(`Storage set failed for key: ${key}`, error);
      // Handle quota exceeded
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        this.cleanupExpired(policy.storageType);
        // Retry once
        try {
          storage.setItem(key, JSON.stringify(item));
        } catch (retryError) {
          console.error('Storage retry failed', retryError);
        }
      }
    }
  }

  getItem<T = any>(key: string): T | null {
    const policy = this.getPolicyForKey(key);
    const storage = this.getStorage(policy);
    
    try {
      const item = storage.getItem(key);
      if (item === null || item === undefined) return null;
      
      let parsed: any;
      try {
        parsed = JSON.parse(item);
      } catch {
        return item as unknown as T;
      }
      
      // If structured envelope with value, timestamp, and optional ttl
      if (parsed && typeof parsed === 'object' && 'value' in parsed && 'timestamp' in parsed) {
        if (parsed.ttl && Date.now() - parsed.timestamp > parsed.ttl) {
          this.removeItem(key);
          return null;
        }
        return parsed.value as T;
      }
      
      return parsed as T;
    } catch (error) {
      console.error(`Storage get failed for key: ${key}`, error);
      return null;
    }
  }

  removeItem(key: string): void {
    const policy = this.getPolicyForKey(key);
    const storage = this.getStorage(policy);
    storage.removeItem(key);
  }

  clear(storageType?: StorageType): void {
    if (storageType === 'local') {
      localStorage.clear();
    } else if (storageType === 'session') {
      sessionStorage.clear();
    } else {
      localStorage.clear();
      sessionStorage.clear();
    }
  }

  // Clear only Velum-related items (preserves other app data)
  clearVelumData(): void {
    const keysToRemove: string[] = [];
    
    // Collect all keys that match our patterns
    const allKeys = [
      ...Object.keys(localStorage),
      ...Object.keys(sessionStorage)
    ];
    
    for (const key of allKeys) {
      const policy = this.getPolicyForKey(key);
      if (this.isVelumKey(key)) {
        keysToRemove.push(key);
      }
    }
    
    // Remove from appropriate storage
    for (const key of keysToRemove) {
      const policy = this.getPolicyForKey(key);
      const storage = this.getStorage(policy);
      storage.removeItem(key);
    }
  }

  private isVelumKey(key: string): boolean {
    // Keys that are definitely ours
    const velumPatterns = [
      'session_token',
      'velum-sessionId',
      'velum-user',
      'velum-deviceId',
      'velum-notes-',
      'auth_state',
      'oauth_state',
      'webauthn_challenge',
      'user_preferences',
      'theme',
      'language',
      'encryption_key',
      'private_key',
      'device_key',
      'cache_',
      'api_cache_',
      'temp_',
      'ui_state_',
      'form_draft_'
    ];
    
    return velumPatterns.some(pattern => 
      key === pattern || key.startsWith(pattern)
    );
  }

  private cleanupExpired(storageType: StorageType): void {
    const storage = storageType === 'local' ? localStorage : sessionStorage;
    const now = Date.now();
    
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (!key) continue;
      
      try {
        const item = storage.getItem(key);
        if (!item) continue;
        
        const parsed = JSON.parse(item);
        if (parsed.ttl && now - parsed.timestamp > parsed.ttl) {
          storage.removeItem(key);
        }
      } catch (error) {
        // Invalid JSON, remove it
        storage.removeItem(key);
      }
    }
  }

  // Get all keys for a storage type
  getKeys(storageType: StorageType): string[] {
    const storage = storageType === 'local' ? localStorage : sessionStorage;
    const keys: string[] = [];
    
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key) keys.push(key);
    }
    
    return keys;
  }

  // Get storage usage info
  getStorageInfo(): { local: number; session: number } {
    const getStorageSize = (storage: Storage): number => {
      let total = 0;
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key) {
          const value = storage.getItem(key);
          if (value) {
            total += key.length + value.length;
          }
        }
      }
      return total;
    };
    
    return {
      local: getStorageSize(localStorage),
      session: getStorageSize(sessionStorage)
    };
  }
}

// Singleton instance
export const storageService = new StorageService();

// Convenience methods for common operations
export const storage = {
  // Generic operations (delegated to storageService)
  getItem: <T = any>(key: string): T | null => storageService.getItem<T>(key),
  setItem: (key: string, value: any, options?: { storageType?: StorageType; ttl?: number }): void =>
    storageService.setItem(key, value, options),
  removeItem: (key: string): void => storageService.removeItem(key),

  // Authentication (sessionStorage)
  setSessionToken: (token: string) => {
    storageService.setItem('velum-sessionId', token);
    storageService.setItem('session_token', token);
  },
  getSessionToken: () => storageService.getItem<string>('velum-sessionId') || storageService.getItem<string>('session_token'),
  clearSession: () => {
    storageService.removeItem('session_token');
    storageService.removeItem('velum-sessionId');
    storageService.removeItem('velum_sessionId');
    storageService.removeItem('velum-user');
    storageService.removeItem('velum_user');
    storageService.removeItem('velum-deviceId');
  },
  
  // User preferences (localStorage)
  setPreferences: (prefs: any) => storageService.setItem('user_preferences', prefs),
  getPreferences: () => storageService.getItem('user_preferences'),
  
  // Theme (localStorage)
  setTheme: (theme: string) => storageService.setItem('theme', theme),
  getTheme: () => storageService.getItem<string>('theme') || 'dark',
  
  // Cache (localStorage with TTL)
  setCache: (key: string, value: any, ttl?: number) => 
    storageService.setItem(key.startsWith('cache_') || key.startsWith('velum_') ? key : `cache_${key}`, value, { ttl }),
  getCache: <T = any>(key: string): T | null => 
    storageService.getItem<T>(key.startsWith('cache_') || key.startsWith('velum_') ? key : `cache_${key}`),
  
  // Temporary state (sessionStorage)
  setTempState: (key: string, value: any) => 
    storageService.setItem(key.startsWith('temp_') || key.startsWith('ui_') ? key : `temp_${key}`, value),
  getTempState: <T = any>(key: string): T | null => 
    storageService.getItem<T>(key.startsWith('temp_') || key.startsWith('ui_') ? key : `temp_${key}`),
  
  // Utility
  clear: () => storageService.clearVelumData(),
  clearAll: () => storageService.clear(),
  getInfo: () => storageService.getStorageInfo()
};
