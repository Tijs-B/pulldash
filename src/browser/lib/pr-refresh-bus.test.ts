import { test, expect } from "bun:test";
import { notifyPRRefresh, subscribePRRefresh } from "./pr-refresh-bus";

test("notify delivers to the matching subscriber", () => {
  let called = 0;
  const unsub = subscribePRRefresh("o", "r", 1, () => {
    called++;
  });
  notifyPRRefresh("o", "r", 1);
  expect(called).toBe(1);
  unsub();
});

test("other keys are not notified", () => {
  let called = 0;
  const unsub = subscribePRRefresh("o", "r", 1, () => {
    called++;
  });
  notifyPRRefresh("o", "r", 2);
  notifyPRRefresh("other", "r", 1);
  notifyPRRefresh("o", "other", 1);
  expect(called).toBe(0);
  unsub();
});

test("unsubscribe stops delivery", () => {
  let called = 0;
  const unsub = subscribePRRefresh("o", "r", 1, () => {
    called++;
  });
  unsub();
  notifyPRRefresh("o", "r", 1);
  expect(called).toBe(0);
});

test("multiple subscribers are all notified", () => {
  let a = 0;
  let b = 0;
  const unsubA = subscribePRRefresh("o", "r", 1, () => {
    a++;
  });
  const unsubB = subscribePRRefresh("o", "r", 1, () => {
    b++;
  });
  notifyPRRefresh("o", "r", 1);
  expect(a).toBe(1);
  expect(b).toBe(1);
  unsubA();
  unsubB();
});
