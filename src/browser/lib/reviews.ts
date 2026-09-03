import type { Review } from "@/api/types";

/**
 * Latest review per user, mirroring how GitHub displays reviewer state (and
 * its `latestOpinionatedReviews` field): the most recent APPROVED or
 * CHANGES_REQUESTED review decides; later COMMENTED reviews do not override
 * the decision. Comment-only reviewers fall back to their latest comment.
 */
export function getLatestReviewByUser(reviews: Review[]): Map<string, Review> {
  const sorted = reviews
    .filter((r) => r.user && r.submitted_at)
    .sort(
      (a, b) =>
        new Date(a.submitted_at!).getTime() -
        new Date(b.submitted_at!).getTime()
    );

  const decisions = new Map<string, Review>();
  const comments = new Map<string, Review>();
  for (const review of sorted) {
    if (!review.user) continue;
    if (review.state === "APPROVED" || review.state === "CHANGES_REQUESTED") {
      decisions.set(review.user.login, review);
    } else if (review.state === "DISMISSED") {
      // Dismissal revokes the user's decision entirely (GitHub's
      // latestOpinionatedReviews only surfaces non-dismissed reviews).
      decisions.delete(review.user.login);
    } else if (review.state === "COMMENTED") {
      comments.set(review.user.login, review);
    }
  }

  // Decisions win; comment-only reviewers fall back to their latest comment.
  const byUser = new Map(decisions);
  for (const [login, review] of comments) {
    if (!byUser.has(login)) byUser.set(login, review);
  }
  return byUser;
}

/** Decision reviews only (no COMMENTED entries) — approvals and change
 *  requests per user, used for approval counts and the merge box. */
export function getLatestReviewsByUser(reviews: Review[]): Review[] {
  return [...getLatestReviewByUser(reviews).values()].filter(
    (r) => r.state === "APPROVED" || r.state === "CHANGES_REQUESTED"
  );
}
