import { test, expect } from "bun:test";
import { extractIssueLinkRefs } from "./markdown";

test("extracts refs from relative PR hrefs", () => {
  const html = `<a class="issue-link js-issue-link" data-id="1" href="/xcp-ng/xcp/pull/838">#838</a>`;
  expect(extractIssueLinkRefs(html)).toEqual([
    { owner: "xcp-ng", repo: "xcp", number: 838 },
  ]);
});

test("extracts refs from absolute hrefs and issues, deduped", () => {
  const html = [
    `<a class="issue-link" href="https://github.com/o/r/pull/1">#1</a>`,
    `<a class="issue-link" href="/o/r/pull/1">#1</a>`,
    `<a class="issue-link" href="/o/r/issues/2">#2</a>`,
  ].join("\n");
  expect(extractIssueLinkRefs(html)).toEqual([
    { owner: "o", repo: "r", number: 1 },
    { owner: "o", repo: "r", number: 2 },
  ]);
});

test("ignores anchors without the issue-link class", () => {
  const html = `<a href="/o/r/pull/1">docs</a><a class="other" href="/o/r/pull/2">#2</a>`;
  expect(extractIssueLinkRefs(html)).toEqual([]);
});

test("returns empty for html without issue links", () => {
  expect(extractIssueLinkRefs("<p>nothing here</p>")).toEqual([]);
});
