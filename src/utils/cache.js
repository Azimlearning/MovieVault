const DB_NAME = "MovieVaultRequestCache";
const DB_VERSION = 1;
const STORE_NAME = "cache";

function getDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

export const requestCache = {
  async get(key) {
    try {
      const db = await getDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(key);
        req.onsuccess = () => {
          const res = req.result;
          if (res) {
            // Update last accessed time for LRU tracking
            this._touch(key);
            resolve(res);
          } else {
            resolve(null);
          }
        };
        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  },

  async set(key, data, expiresAt) {
    try {
      const db = await getDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const entry = {
          key,
          data,
          expiresAt,
          updatedAt: Date.now(),
        };
        const req = store.put(entry);
        req.onsuccess = () => {
          resolve();
          // Prune asynchronously to avoid blocking the write
          this.prune(50);
        };
        req.onerror = () => resolve();
      });
    } catch {}
  },

  async clear() {
    try {
      const db = await getDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      });
    } catch {}
  },

  async _touch(key) {
    try {
      const db = await getDB();
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => {
        const entry = req.result;
        if (entry) {
          entry.updatedAt = Date.now();
          store.put(entry);
        }
      };
    } catch {}
  },

  async prune(maxSizeMB = 50) {
    try {
      const db = await getDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => {
          const items = req.result;
          let totalSize = 0;
          const itemsWithSize = items.map((item) => {
            const str = JSON.stringify(item);
            const size = str.length * 2; // Rough byte size estimate for strings in JS
            totalSize += size;
            return { key: item.key, size, updatedAt: item.updatedAt };
          });

          const maxSizeBytes = maxSizeMB * 1024 * 1024;
          if (totalSize <= maxSizeBytes) {
            resolve();
            return;
          }

          // Sort by updatedAt ASC (oldest first)
          itemsWithSize.sort((a, b) => a.updatedAt - b.updatedAt);

          const txDelete = db.transaction(STORE_NAME, "readwrite");
          const storeDelete = txDelete.objectStore(STORE_NAME);

          let bytesToFree = totalSize - maxSizeBytes;
          for (const item of itemsWithSize) {
            if (bytesToFree <= 0) break;
            storeDelete.delete(item.key);
            bytesToFree -= item.size;
          }
          txDelete.oncomplete = () => resolve();
          txDelete.onerror = () => resolve();
        };
        req.onerror = () => resolve();
      });
    } catch {}
  },
};
