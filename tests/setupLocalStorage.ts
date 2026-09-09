/** Minimal Web Storage polyfill for Vitest node environment. */
class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(String(key), String(value));
  }
}

const localStoragePolyfill = new MemoryStorage();
const sessionStoragePolyfill = new MemoryStorage();

Object.defineProperty(globalThis, 'localStorage', {
  value: localStoragePolyfill,
  writable: true,
  configurable: true,
});

Object.defineProperty(globalThis, 'sessionStorage', {
  value: sessionStoragePolyfill,
  writable: true,
  configurable: true,
});

if (typeof globalThis.window === 'undefined') {
  Object.defineProperty(globalThis, 'window', {
    value: globalThis,
    writable: true,
    configurable: true,
  });
}

Object.defineProperty(globalThis.window, 'localStorage', {
  value: localStoragePolyfill,
  writable: true,
  configurable: true,
});

Object.defineProperty(globalThis.window, 'sessionStorage', {
  value: sessionStoragePolyfill,
  writable: true,
  configurable: true,
});
