/**
 * Persistent cache utility using IndexedDB
 * Allows caching data across sessions with automatic expiration
 */

interface CacheEntry<T> {
  key: string;
  value: T;
  timestamp: number;
  expiresAt?: number;
}

class PersistentCache {
  private dbName = 'clippster-cache';
  private version = 1;
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    if (this.db) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object stores for different cache types
        if (!db.objectStoreNames.contains('projects')) {
          db.createObjectStore('projects', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('rawVideos')) {
          db.createObjectStore('rawVideos', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('thumbnails')) {
          db.createObjectStore('thumbnails', { keyPath: 'key' });
        }
      };
    });
  }

  async get<T>(storeName: string, key: string): Promise<T | null> {
    await this.init();
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const entry = request.result as CacheEntry<T> | undefined;
        
        if (!entry) {
          resolve(null);
          return;
        }

        // Check if entry has expired
        if (entry.expiresAt && Date.now() > entry.expiresAt) {
          // Remove expired entry
          this.delete(storeName, key);
          resolve(null);
          return;
        }

        resolve(entry.value);
      };
    });
  }

  async set<T>(
    storeName: string,
    key: string,
    value: T,
    ttlMs?: number
  ): Promise<void> {
    await this.init();
    if (!this.db) return;

    const entry: CacheEntry<T> = {
      key,
      value,
      timestamp: Date.now(),
      expiresAt: ttlMs ? Date.now() + ttlMs : undefined,
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(entry);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async delete(storeName: string, key: string): Promise<void> {
    await this.init();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async clear(storeName: string): Promise<void> {
    await this.init();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getAll<T>(storeName: string): Promise<T[]> {
    await this.init();
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const entries = request.result as CacheEntry<T>[];
        const now = Date.now();
        
        // Filter out expired entries and return values
        const validEntries = entries
          .filter(entry => !entry.expiresAt || now <= entry.expiresAt)
          .map(entry => entry.value);
        
        resolve(validEntries);
      };
    });
  }

  async has(storeName: string, key: string): Promise<boolean> {
    const value = await this.get(storeName, key);
    return value !== null;
  }

  /**
   * Clean up expired entries from all stores
   */
  async cleanup(): Promise<void> {
    await this.init();
    if (!this.db) return;

    const storeNames = ['projects', 'rawVideos', 'thumbnails'];
    const now = Date.now();

    for (const storeName of storeNames) {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.openCursor();

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result as IDBCursorWithValue | null;
        if (cursor) {
          const entry = cursor.value as CacheEntry<any>;
          if (entry.expiresAt && now > entry.expiresAt) {
            cursor.delete();
          }
          cursor.continue();
        }
      };
    }
  }
}

// Singleton instance
export const persistentCache = new PersistentCache();

// Also export as 'cache' for backwards compatibility
export const cache = persistentCache;

// Run cleanup on initialization
persistentCache.cleanup();
