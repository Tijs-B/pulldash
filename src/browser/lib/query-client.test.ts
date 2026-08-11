import { test, expect } from "bun:test";
import "fake-indexeddb/auto";

// Simulate the broken pre-existing DB seen in production: "pulldash-rq"
// exists at version 1 but has no "data" object store (e.g. a crash during
// the initial upgrade). Module evaluation runs before any openDB call, so
// the persister below must self-heal this state.
await new Promise<void>((resolve, reject) => {
  const req = indexedDB.open("pulldash-rq", 1);
  req.onsuccess = () => {
    req.result.close();
    resolve();
  };
  req.onerror = () => reject(req.error);
});

import { persister } from "./query-client";

test("persister restore self-heals a DB missing the data store", async () => {
  // Must not throw "data is not a known object store name"
  await persister.restoreClient();

  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open("pulldash-rq", 1);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  expect(db.objectStoreNames.contains("data")).toBe(true);
  db.close();
});
