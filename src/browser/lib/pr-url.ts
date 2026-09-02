/**
 * Parse a GitHub PR URL (e.g. https://github.com/o/r/pull/1) from arbitrary
 * text, tolerating www., trailing paths, and hash fragments.
 */
export function parsePRUrl(
  url: string
): { owner: string; repo: string; number: number } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (!match) return null;
  return {
    owner: match[1],
    repo: match[2],
    number: parseInt(match[3], 10),
  };
}
