import { test, expect, beforeEach } from "bun:test";
import {
  setReminder,
  clearReminder,
  getReminder,
  hasActiveReminder,
  getActiveReminders,
  consumeDueReminders,
  getRemindersVersion,
  subscribeReminders,
} from "./reminders";

// Minimal in-memory localStorage stub (Bun has no localStorage)
const store = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => store.set(k, v),
  removeItem: (k: string) => store.delete(k),
  clear: () => store.clear(),
} as unknown as Storage;

const now = Date.parse("2026-09-03T12:00:00Z");
const reminder = {
  owner: "o",
  repo: "r",
  number: 1,
  title: "A PR",
  remindAt: "2026-09-03T11:00:00Z", // one hour ago relative to `now`
};

beforeEach(() => {
  store.clear();
});

test("set/get/clear round-trip, set replaces and resets notifiedAt", () => {
  expect(getReminder("o/r#1")).toBeNull();
  setReminder("o/r#1", reminder);
  expect(getReminder("o/r#1")?.title).toBe("A PR");
  setReminder("o/r#1", { ...reminder, title: "Another PR" });
  expect(getReminder("o/r#1")?.title).toBe("Another PR");
  expect(getReminder("o/r#1")?.notifiedAt).toBeNull();
  clearReminder("o/r#1");
  expect(getReminder("o/r#1")).toBeNull();
});

test("active only when due and unviewed since remindAt", () => {
  setReminder("o/r#1", reminder);
  // Not due yet
  expect(hasActiveReminder("o/r#1", Date.parse("2026-09-03T10:30:00Z"))).toBe(
    false
  );
  // Due, never viewed
  expect(hasActiveReminder("o/r#1", now)).toBe(true);
  // Viewed before the reminder time — still active
  store.set(
    "pulldash_viewed_prs",
    JSON.stringify({ "o/r#1": "2026-09-03T10:00:00Z" })
  );
  expect(hasActiveReminder("o/r#1", now)).toBe(true);
  // Viewed after the reminder time — no longer active
  store.set(
    "pulldash_viewed_prs",
    JSON.stringify({ "o/r#1": "2026-09-03T11:30:00Z" })
  );
  expect(hasActiveReminder("o/r#1", now)).toBe(false);
});

test("getActiveReminders filters non-active entries", () => {
  setReminder("o/r#1", reminder);
  setReminder("o/r#2", {
    ...reminder,
    number: 2,
    remindAt: "2026-09-03T13:00:00Z",
  });
  const active = getActiveReminders(now);
  expect(active).toHaveLength(1);
  expect(active[0].number).toBe(1);
});

test("consumeDueReminders fires once, then marks notifiedAt", () => {
  setReminder("o/r#1", reminder);
  const fired: string[] = [];
  expect(consumeDueReminders(now, (id) => fired.push(id))).toEqual(["o/r#1"]);
  expect(fired).toEqual(["o/r#1"]);
  expect(consumeDueReminders(now, (id) => fired.push(id))).toEqual([]);
  expect(fired).toEqual(["o/r#1"]);
  expect(getReminder("o/r#1")?.notifiedAt).not.toBeNull();
});

test("consumeDueReminders prunes reminders viewed after remindAt", () => {
  setReminder("o/r#1", reminder);
  store.set(
    "pulldash_viewed_prs",
    JSON.stringify({ "o/r#1": "2026-09-03T11:30:00Z" })
  );
  const fired: string[] = [];
  consumeDueReminders(now, (id) => fired.push(id));
  expect(fired).toEqual([]);
  expect(getReminder("o/r#1")).toBeNull();
});

test("writes bump version and notify subscribers", () => {
  let events = 0;
  const unsubscribe = subscribeReminders(() => events++);
  const v0 = getRemindersVersion();
  setReminder("o/r#1", reminder);
  expect(getRemindersVersion()).toBeGreaterThan(v0);
  expect(events).toBe(1);
  clearReminder("o/r#1");
  expect(events).toBe(2);
  unsubscribe();
  setReminder("o/r#1", reminder);
  expect(events).toBe(2);
  clearReminder("o/r#1");
});
