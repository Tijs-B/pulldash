import { test, expect } from "bun:test";
import { getLatestReviewByUser, getLatestReviewsByUser } from "./reviews";
import type { Review } from "@/api/types";

function review(
  login: string,
  state: Review["state"],
  submitted_at: string,
  id: number
): Review {
  return {
    id,
    state,
    submitted_at,
    user: { login, avatar_url: "", html_url: "" },
  } as unknown as Review;
}

// Real-world shape of a PR where approvals are followed by comment reviews:
// comments must not mask the earlier approval decision.
const fixture: Review[] = [
  review("gduperrey", "APPROVED", "2026-08-27T14:46:13Z", 1),
  review("rzr", "COMMENTED", "2026-08-31T15:26:13Z", 2),
  review("olivierh-pro", "APPROVED", "2026-09-03T08:19:11Z", 3),
  review("glehmann", "COMMENTED", "2026-09-03T08:23:09Z", 4),
  review("rzr", "APPROVED", "2026-09-03T08:31:25Z", 5),
  review("gduperrey", "COMMENTED", "2026-09-03T08:48:58Z", 6),
  review("olivierh-pro", "COMMENTED", "2026-09-03T12:18:21Z", 7),
  review("glehmann", "COMMENTED", "2026-09-03T15:41:52Z", 8),
];

test("comment reviews after an approval do not mask it", () => {
  const decisions = getLatestReviewsByUser(fixture);
  expect(decisions.map((r) => r.user!.login).sort()).toEqual([
    "gduperrey",
    "olivierh-pro",
    "rzr",
  ]);
  expect(decisions.every((r) => r.state === "APPROVED")).toBe(true);
});

test("comment-only reviewers fall back to their latest comment", () => {
  const byUser = getLatestReviewByUser(fixture);
  expect(byUser.get("glehmann")?.state).toBe("COMMENTED");
  expect(byUser.get("glehmann")?.id).toBe(8);
});

test("requesting changes overrides an earlier approval", () => {
  const reviews = [
    review("a", "APPROVED", "2026-01-01T00:00:00Z", 1),
    review("a", "CHANGES_REQUESTED", "2026-01-02T00:00:00Z", 2),
  ];
  expect(getLatestReviewsByUser(reviews)[0].state).toBe("CHANGES_REQUESTED");
});

test("dismissed reviews are not treated as decisions", () => {
  const reviews = [
    review("a", "APPROVED", "2026-01-01T00:00:00Z", 1),
    review("a", "DISMISSED", "2026-01-02T00:00:00Z", 2),
  ];
  expect(getLatestReviewsByUser(reviews)).toEqual([]);
  expect(getLatestReviewByUser(reviews).has("a")).toBe(false);
});
