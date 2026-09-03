import { test, expect } from "bun:test";
import { parsePRUrl, discussionUrl } from "./pr-url";

test("parses plain PR URLs", () => {
  expect(parsePRUrl("https://github.com/o/r/pull/1")).toEqual({
    owner: "o",
    repo: "r",
    number: 1,
  });
  expect(parsePRUrl("http://www.github.com/o/r/pull/42")).toEqual({
    owner: "o",
    repo: "r",
    number: 42,
  });
});

test("parses URLs with trailing paths and fragments", () => {
  expect(parsePRUrl("https://github.com/o/r/pull/1/files")).toEqual({
    owner: "o",
    repo: "r",
    number: 1,
  });
  expect(parsePRUrl("https://github.com/o/r/pull/1#issuecomment-123")).toEqual({
    owner: "o",
    repo: "r",
    number: 1,
  });
});

test("extracts a URL embedded in surrounding text", () => {
  expect(
    parsePRUrl("  check out https://github.com/o/r/pull/7 please  ")
  ).toEqual({ owner: "o", repo: "r", number: 7 });
});

test("rejects non-PR URLs and arbitrary text", () => {
  expect(parsePRUrl("https://github.com/o/r/issues/1")).toBeNull();
  expect(parsePRUrl("https://example.com/github.com/o/r/pull/1")).toEqual({
    owner: "o",
    repo: "r",
    number: 1,
  });
  expect(parsePRUrl("")).toBeNull();
  expect(parsePRUrl("no url here")).toBeNull();
});

test("builds canonical review-thread comment permalinks", () => {
  expect(
    discussionUrl("https://github.com/xcp-ng/xcp-ng-tests/pull/689", 5527080306)
  ).toBe(
    "https://github.com/xcp-ng/xcp-ng-tests/pull/689#discussion_r5527080306"
  );
});
