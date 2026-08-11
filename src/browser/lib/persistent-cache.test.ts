import { test, expect, beforeEach } from "bun:test";
import "fake-indexeddb/auto";
import { get, put, deleteByPRKey, clear } from "./persistent-cache";

// Simulate the broken pre-existing DB state seen in production: "pulldash"
// exists at version 1 but has no "responses" object store (e.g. a crash
// during the initial upgrade). Module evaluation runs before any openDB
// call, so the first operation below must self-heal this state.
await new Promise<void>((resolve, reject) => {
  const req = indexedDB.open("pulldash", 1);
  req.onsuccess = () => {
    req.result.close();
    resolve();
  };
  req.onerror = () => reject(req.error);
});

beforeEach(async () => {
  await clear();
});

test("openDB self-heals a DB missing the responses store", async () => {
  // Must not throw "responses is not a known object store name"
  expect(await get<string>("heal-test-key")).toBeNull();
  await put("heal-test-key", "value", "owner/repo/1");
  expect(await get<string>("heal-test-key")).toBe("value");
});

test("put then get returns the stored value", async () => {
  await put("key1", { data: 42 }, "owner/repo/1");
  const result = await get<{ data: number }>("key1");
  expect(result).toEqual({ data: 42 });
});

test("get on missing key returns null", async () => {
  const result = await get("nonexistent");
  expect(result).toBeNull();
});

test("deleteByPRKey removes only matching entries", async () => {
  await put("key-a", "value-a", "owner/repo/1");
  await put("key-b", "value-b", "owner/repo/1");
  await put("key-c", "value-c", "owner/repo/2");

  await deleteByPRKey("owner/repo/1");

  expect(await get("key-a")).toBeNull();
  expect(await get("key-b")).toBeNull();
  expect(await get<string>("key-c")).toBe("value-c");
});

test("clear empties the store", async () => {
  await put("key1", "value1", "owner/repo/1");
  await put("key2", "value2", "owner/repo/2");

  await clear();

  expect(await get("key1")).toBeNull();
  expect(await get("key2")).toBeNull();
});
