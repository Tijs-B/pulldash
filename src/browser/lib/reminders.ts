import { getLastViewed } from "./waiting-prs";

const STORAGE_KEY = "pulldash_reminders";
const MAX_AGE_MS = 60 * 24 * 60 * 60 * 1000;

export interface PRReminder {
  owner: string;
  repo: string;
  number: number;
  title: string;
  authorLogin?: string;
  /** When the reminder should fire (ISO). */
  remindAt: string;
  /** When the reminder fired (ISO). Absent until then. */
  notifiedAt?: string | null;
}

function read(): Record<string, PRReminder> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function write(data: Record<string, PRReminder>): void {
  const cutoff = Date.now() - MAX_AGE_MS;
  for (const [id, r] of Object.entries(data)) {
    if (new Date(r.remindAt).getTime() < cutoff) delete data[id];
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// Reactive version, so consumers (home list) recompute when reminders change.
let version = 0;
const listeners = new Set<() => void>();

export function getRemindersVersion(): number {
  return version;
}

export function subscribeReminders(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify() {
  version++;
  listeners.forEach((l) => l());
}

export function getReminder(prId: string): PRReminder | null {
  return read()[prId] ?? null;
}

export function setReminder(
  prId: string,
  reminder: Omit<PRReminder, "notifiedAt">
): void {
  const data = read();
  data[prId] = { ...reminder, notifiedAt: null };
  write(data);
  notify();
}

export function clearReminder(prId: string): void {
  const data = read();
  delete data[prId];
  write(data);
  notify();
}

/** A reminder is active while it is due and the PR hasn't been viewed since
 *  remindAt — viewing the PR after the reminder means the review happened. */
export function hasActiveReminder(
  prId: string,
  now: number = Date.now()
): boolean {
  const r = read()[prId];
  if (!r) return false;
  if (new Date(r.remindAt).getTime() > now) return false;
  const lastViewed = getLastViewed(prId);
  return (
    !lastViewed ||
    new Date(lastViewed).getTime() < new Date(r.remindAt).getTime()
  );
}

export function getActiveReminders(now: number = Date.now()): PRReminder[] {
  return Object.entries(read())
    .filter(([prId]) => hasActiveReminder(prId, now))
    .map(([, r]) => r);
}

/** Fires each due, not-yet-notified reminder exactly once via `fire`, then
 *  prunes reminders that were viewed after remindAt (review done). Returns
 *  the prIds fired this call. */
export function consumeDueReminders(
  now: number,
  fire: (prId: string, reminder: PRReminder) => void
): string[] {
  const data = read();
  const fired: string[] = [];
  let changed = false;
  for (const [prId, r] of Object.entries(data)) {
    const dueAt = new Date(r.remindAt).getTime();
    const lastViewed = getLastViewed(prId);
    if (lastViewed && new Date(lastViewed).getTime() >= dueAt) {
      // Viewed after the reminder time — the reminder is fulfilled.
      delete data[prId];
      changed = true;
      continue;
    }
    if (dueAt <= now && !r.notifiedAt) {
      fire(prId, r);
      r.notifiedAt = new Date(now).toISOString();
      fired.push(prId);
      changed = true;
    }
  }
  if (changed) {
    write(data);
    notify();
  }
  return fired;
}
