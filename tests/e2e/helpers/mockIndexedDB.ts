/**
 * In-Memory IndexedDB Mock Implementation for Vitest/Node E2E Testing
 * Provides full IDBDatabase, IDBTransaction, IDBObjectStore, and IDBCursor support.
 */

interface StoreOptions {
  keyPath?: string;
  autoIncrement?: boolean;
}

class MockCursor {
  private entries: [any, any][];
  private index = 0;
  private store: MockObjectStore;
  private request: MockRequest;

  constructor(entries: [any, any][], store: MockObjectStore, request: MockRequest) {
    this.entries = entries;
    this.store = store;
    this.request = request;
  }

  get key(): any {
    return this.entries[this.index]?.[0];
  }

  get value(): any {
    return this.entries[this.index]?.[1];
  }

  delete(): MockRequest {
    const currentKey = this.key;
    if (currentKey !== undefined) {
      this.store._deleteDirect(currentKey);
    }
    const delReq = new MockRequest();
    queueMicrotask(() => {
      delReq.result = undefined;
      delReq.onsuccess?.({ target: delReq } as any);
    });
    return delReq;
  }

  continue(): void {
    this.index++;
    queueMicrotask(() => {
      if (this.index < this.entries.length) {
        this.request.result = this;
      } else {
        this.request.result = null;
      }
      this.request.onsuccess?.({ target: this.request } as any);
    });
  }
}

class MockRequest {
  public result: any = null;
  public error: Error | null = null;
  public onsuccess: ((ev: any) => void) | null = null;
  public onerror: ((ev: any) => void) | null = null;
}

class MockOpenDBRequest extends MockRequest {
  public onupgradeneeded: ((ev: any) => void) | null = null;
  public onblocked: ((ev: any) => void) | null = null;
}

class MockObjectStore {
  private data: Map<string | number, any> = new Map();
  public name: string;
  public keyPath?: string;
  private tx: MockTransaction;

  constructor(name: string, options: StoreOptions = {}, tx: MockTransaction) {
    this.name = name;
    this.keyPath = options.keyPath;
    this.tx = tx;
  }

  _deleteDirect(key: string | number): void {
    this.data.delete(key);
  }

  put(value: any, optionalKey?: any): MockRequest {
    const req = new MockRequest();
    this.tx._registerRequest(req);

    const key = this.keyPath ? value[this.keyPath] : optionalKey;
    if (key === undefined || key === null) {
      queueMicrotask(() => {
        req.error = new Error(`Key not found in object with keyPath '${this.keyPath}'`);
        req.onerror?.({ target: req } as any);
        this.tx._checkComplete();
      });
      return req;
    }

    this.data.set(key, structuredClone(value));

    queueMicrotask(() => {
      req.result = key;
      req.onsuccess?.({ target: req } as any);
      this.tx._checkComplete();
    });

    return req;
  }

  get(key: any): MockRequest {
    const req = new MockRequest();
    this.tx._registerRequest(req);

    queueMicrotask(() => {
      const val = this.data.get(key);
      req.result = val !== undefined ? structuredClone(val) : undefined;
      req.onsuccess?.({ target: req } as any);
      this.tx._checkComplete();
    });

    return req;
  }

  getAll(): MockRequest {
    const req = new MockRequest();
    this.tx._registerRequest(req);

    queueMicrotask(() => {
      const all = Array.from(this.data.values()).map(v => structuredClone(v));
      req.result = all;
      req.onsuccess?.({ target: req } as any);
      this.tx._checkComplete();
    });

    return req;
  }

  delete(key: any): MockRequest {
    const req = new MockRequest();
    this.tx._registerRequest(req);

    this.data.delete(key);

    queueMicrotask(() => {
      req.result = undefined;
      req.onsuccess?.({ target: req } as any);
      this.tx._checkComplete();
    });

    return req;
  }

  clear(): MockRequest {
    const req = new MockRequest();
    this.tx._registerRequest(req);

    this.data.clear();

    queueMicrotask(() => {
      req.result = undefined;
      req.onsuccess?.({ target: req } as any);
      this.tx._checkComplete();
    });

    return req;
  }

  openCursor(): MockRequest {
    const req = new MockRequest();
    this.tx._registerRequest(req);

    const entries = Array.from(this.data.entries()).map(([k, v]) => [k, structuredClone(v)] as [any, any]);

    queueMicrotask(() => {
      if (entries.length > 0) {
        const cursor = new MockCursor(entries, this, req);
        req.result = cursor;
      } else {
        req.result = null;
      }
      req.onsuccess?.({ target: req } as any);
      this.tx._checkComplete();
    });

    return req;
  }
}

class MockTransaction {
  public db: MockDatabase;
  public mode: string;
  public storeNames: string[];
  public oncomplete: (() => void) | null = null;
  public onerror: ((err: any) => void) | null = null;
  private pendingRequests = 0;
  private stores: Map<string, MockObjectStore> = new Map();

  constructor(db: MockDatabase, storeNames: string | string[], mode: string = 'readonly') {
    this.db = db;
    this.mode = mode;
    this.storeNames = Array.isArray(storeNames) ? storeNames : [storeNames];
  }

  _registerRequest(_req: MockRequest): void {
    this.pendingRequests++;
  }

  _checkComplete(): void {
    this.pendingRequests--;
    if (this.pendingRequests <= 0) {
      queueMicrotask(() => {
        this.oncomplete?.();
      });
    }
  }

  objectStore(name: string): MockObjectStore {
    if (!this.db.objectStoreNames.contains(name)) {
      throw new Error(`NotFoundError: The specified object store '${name}' was not found.`);
    }
    let store = this.stores.get(name);
    if (!store) {
      const schema = this.db._getStoreSchema(name);
      store = new MockObjectStore(name, schema, this);
      // Share storage map with db
      (store as any).data = this.db._getStoreData(name);
      this.stores.set(name, store);
    }
    return store;
  }

  abort(): void {
    // No-op for mock
  }
}

class MockDOMStringList {
  private items: Set<string> = new Set();

  constructor(items?: string[]) {
    if (items) items.forEach(i => this.items.add(i));
  }

  contains(name: string): boolean {
    return this.items.has(name);
  }

  add(name: string): void {
    this.items.add(name);
  }

  remove(name: string): void {
    this.items.delete(name);
  }

  get length(): number {
    return this.items.size;
  }

  item(index: number): string | null {
    return Array.from(this.items)[index] || null;
  }
}

class MockDatabase {
  public name: string;
  public version: number;
  public objectStoreNames: MockDOMStringList = new MockDOMStringList();
  public onversionchange: (() => void) | null = null;
  public onclose: (() => void) | null = null;

  private storeSchemas: Map<string, StoreOptions> = new Map();
  private storeData: Map<string, Map<string | number, any>> = new Map();

  constructor(name: string, version: number) {
    this.name = name;
    this.version = version;
  }

  _getStoreSchema(name: string): StoreOptions {
    return this.storeSchemas.get(name) || {};
  }

  _getStoreData(name: string): Map<string | number, any> {
    let data = this.storeData.get(name);
    if (!data) {
      data = new Map();
      this.storeData.set(name, data);
    }
    return data;
  }

  createObjectStore(name: string, options: StoreOptions = {}): MockObjectStore {
    this.objectStoreNames.add(name);
    this.storeSchemas.set(name, options);
    if (!this.storeData.has(name)) {
      this.storeData.set(name, new Map());
    }
    const dummyTx = new MockTransaction(this, [name], 'readwrite');
    return new MockObjectStore(name, options, dummyTx);
  }

  deleteObjectStore(name: string): void {
    this.objectStoreNames.remove(name);
    this.storeSchemas.delete(name);
    this.storeData.delete(name);
  }

  transaction(storeNames: string | string[], mode: string = 'readonly'): MockTransaction {
    return new MockTransaction(this, storeNames, mode);
  }

  close(): void {
    this.onclose?.();
  }
}

export class MockIndexedDBFactory {
  private databases: Map<string, MockDatabase> = new Map();

  open(name: string, version?: number): MockOpenDBRequest {
    const req = new MockOpenDBRequest();

    queueMicrotask(() => {
      let db = this.databases.get(name);
      const oldVersion = db ? db.version : 0;
      const targetVersion = version || 1;

      if (!db) {
        db = new MockDatabase(name, targetVersion);
        this.databases.set(name, db);
      }

      if (targetVersion > oldVersion) {
        db.version = targetVersion;
        const upgradeEvent = {
          target: { result: db },
          oldVersion,
          newVersion: targetVersion
        };
        req.result = db;
        req.onupgradeneeded?.(upgradeEvent);
      }

      req.result = db;
      req.onsuccess?.({ target: req } as any);
    });

    return req;
  }

  deleteDatabase(name: string): MockOpenDBRequest {
    const req = new MockOpenDBRequest();
    this.databases.delete(name);
    queueMicrotask(() => {
      req.result = undefined;
      req.onsuccess?.({ target: req } as any);
    });
    return req;
  }

  _clearAll(): void {
    this.databases.clear();
  }
}
