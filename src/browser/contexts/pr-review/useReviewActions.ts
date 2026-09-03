import type { ReviewComment } from "@/api/types";
import {
  useGitHub,
  type Review,
  type TimelineEvent,
} from "@/browser/contexts/github";
import { usePRReviewStore, usePRReviewSelector } from ".";
import { setLastViewed } from "@/browser/lib/waiting-prs";
import { markSelfActivity } from "@/browser/lib/notifications";

export function useReviewActions() {
  const store = usePRReviewStore();
  const github = useGitHub();
  const owner = usePRReviewSelector((s) => s.owner);
  const repo = usePRReviewSelector((s) => s.repo);
  const pr = usePRReviewSelector((s) => s.pr);
  const currentUser = usePRReviewSelector((s) => s.currentUser);

  const submitReview = async (
    event: "APPROVE" | "REQUEST_CHANGES" | "COMMENT"
  ) => {
    const state = store.getSnapshot();
    store.setSubmittingReview(true);

    let newReview: Review | null = null;

    try {
      // Get the pending review node ID (from GraphQL)
      const reviewNodeId = store.getPendingReviewNodeId();
      const reviewSha = store.getReviewSha() ?? pr.head.sha;

      // Track whether GraphQL submission succeeded
      let submittedViaGraphQL = false;

      if (reviewNodeId) {
        try {
          const submitted = await github.submitPendingReview(
            reviewNodeId,
            event,
            state.reviewBody
          );
          if (submitted) {
            // Build the review from server identity so the UI can show it
            // immediately, even if the refetch below is stale.
            newReview = {
              id: submitted.databaseId,
              user: currentUser
                ? {
                    login: currentUser,
                    avatar_url: `https://avatars.githubusercontent.com/${currentUser}`,
                  }
                : null,
              state:
                event === "APPROVE"
                  ? "APPROVED"
                  : event === "REQUEST_CHANGES"
                    ? "CHANGES_REQUESTED"
                    : "COMMENTED",
              submitted_at: submitted.submittedAt,
            } as Review;
          }
          submittedViaGraphQL = true;
        } catch {
          // GraphQL failed (e.g. pending review was already submitted).
          // Fall through to REST fallback below.
        }
      }

      if (!submittedViaGraphQL) {
        if (state.pendingComments.length > 0) {
          // REST fallback: create a new review with all comments
          // Redirect :commit metadata comments to a valid line in the first real file
          const firstFile = state.files[0];
          const firstFilename = firstFile?.filename;
          const firstHunkLine = firstFile?.patch?.match(
            /^@@ -\d+(?:,\d+)? \+(\d+)/m
          )?.[1];
          const metadataLine = firstHunkLine ? parseInt(firstHunkLine, 10) : 1;
          newReview = await github.createPRReview(owner, repo, pr.number, {
            commit_id: reviewSha,
            event,
            body: state.reviewBody,
            comments: state.pendingComments.map(
              ({ path, line, body, side, start_line }) => {
                const isMetadata = path === ":commit" && firstFilename;
                return {
                  path: isMetadata ? firstFilename : path,
                  line: isMetadata ? metadataLine : line,
                  body,
                  side: side as "LEFT" | "RIGHT",
                  start_line: isMetadata ? undefined : start_line,
                };
              }
            ),
          });
        } else {
          // Just submitting a review with no comments (APPROVE, etc)
          newReview = await github.createPRReview(owner, repo, pr.number, {
            commit_id: reviewSha,
            event,
            body: state.reviewBody,
            comments: [],
          });
        }
      }

      github.invalidatePR(owner, repo, pr.number);
      setLastViewed(`${owner}/${repo}#${pr.number}`);
      // The GraphQL submit path can't be marked centrally — the resulting
      // activity is ours and must not notify.
      markSelfActivity(`${owner}/${repo}#${pr.number}`);

      // Refresh comments, reviews, and timeline
      const [newComments, reviews, timeline] = await Promise.all([
        github.getPRComments(owner, repo, pr.number),
        github.getPRReviews(owner, repo, pr.number),
        github.getPRTimeline(owner, repo, pr.number),
      ]);

      // If the review we just submitted isn't in the re-fetched data yet
      // (eventual consistency), add it manually so it appears immediately.
      // The timeline is ascending, so a just-created review goes last.
      if (newReview?.id && !reviews.some((r) => r.id === newReview!.id)) {
        reviews.unshift(newReview);
        timeline.push({
          id: newReview.id,
          event: "reviewed",
          actor: { login: currentUser ?? "", avatar_url: "" },
          created_at: newReview.submitted_at ?? new Date().toISOString(),
        } as TimelineEvent);
      }

      store.setComments(newComments as ReviewComment[]);
      store.setReviews(reviews);
      store.setTimeline(timeline);
      store.setOverviewLoading(false);

      // If we got the review ID from REST, use it; otherwise find the latest review
      let scrollTarget: string | undefined;
      if (newReview?.id) {
        scrollTarget = `pullrequestreview-${newReview.id}`;
      } else if (reviews.length > 0) {
        // Find the most recent review (likely the one we just submitted)
        const sortedReviews = [...reviews].sort(
          (a, b) =>
            new Date(b.submitted_at ?? 0).getTime() -
            new Date(a.submitted_at ?? 0).getTime()
        );
        if (sortedReviews[0]) {
          scrollTarget = `pullrequestreview-${sortedReviews[0].id}`;
        }
      }

      store.clearReviewState();

      // Navigate to overview page and scroll to the new review
      store.selectOverview(scrollTarget);
    } catch (error) {
      console.error("Failed to submit review:", error);
      // Re-throw so the UI can surface the error to the user
      throw error;
    } finally {
      store.setSubmittingReview(false);
    }
  };

  return { submitReview };
}
