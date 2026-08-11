import { QueryClient } from "@tanstack/react-query";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";

// Separate DB from PersistentCache (pulldash/responses) to avoid collisions
const DB_NAME = "pulldash-rq";
const STORE_NAME = "data";
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
        req.result.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      if (db.objectStoreNames.contains(STORE_NAME)) {
        resolve(db);
        return;
      }
      // Self-heal: a DB created before the "data" store existed (e.g. by a
      // crash during upgrade) has no usable store, and `transaction("data")`
      // would throw. Delete it and reopen so a fresh store is created.
      console.warn(
        `[query-client] IndexedDB "${DB_NAME}" is missing store "${STORE_NAME}"; recreating it`
      );
      db.close();
      const del = indexedDB.deleteDatabase(DB_NAME);
      del.onsuccess = () => {
        dbPromise = null;
        resolve(openDB());
      };
      del.onerror = () => {
        dbPromise = null;
        reject(del.error);
      };
      del.onblocked = () => {
        dbPromise = null;
        reject(
          del.error ??
            new Error(
              `IndexedDB: could not delete "${DB_NAME}" (blocked by another connection)`
            )
        );
      };
    };
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

const idbStorage = {
  getItem: async (key: string): Promise<string | null> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const req = db.transaction(STORE_NAME).objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve((req.result as string | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
  },
  setItem: async (key: string, value: string): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const req = db
        .transaction(STORE_NAME, "readwrite")
        .objectStore(STORE_NAME)
        .put(value, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },
  removeItem: async (key: string): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const req = db
        .transaction(STORE_NAME, "readwrite")
        .objectStore(STORE_NAME)
        .delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: ({ meta }) => meta?.immutable !== true,
      retry: 1,
    },
  },
});

export const persister = createAsyncStoragePersister({
  storage: idbStorage,
});
