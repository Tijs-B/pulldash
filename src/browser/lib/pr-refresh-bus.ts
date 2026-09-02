// Notify mounted PR views that fresh activity landed, so they can refresh
// their data in place (instead of remounting the whole tab).

type Listener = () => void;

const listeners = new Map<string, Set<Listener>>();

function key(owner: string, repo: string, number: number): string {
  return `${owner}/${repo}/${number}`;
}

export function notifyPRRefresh(
  owner: string,
  repo: string,
  number: number
): void {
  const set = listeners.get(key(owner, repo, number));
  if (!set) return;
  for (const listener of set) listener();
}

export function subscribePRRefresh(
  owner: string,
  repo: string,
  number: number,
  listener: Listener
): () => void {
  const k = key(owner, repo, number);
  let set = listeners.get(k);
  if (!set) {
    set = new Set();
    listeners.set(k, set);
  }
  set.add(listener);
  return () => {
    set?.delete(listener);
    if (set && set.size === 0) listeners.delete(k);
  };
}
