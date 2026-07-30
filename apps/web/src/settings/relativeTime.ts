/** Shared "Checked Xm ago" formatting for both Settings tabs — seconds-precision right after a refresh. */
export function formatCheckedAt(timestampMs: number, nowMs: number = Date.now()): string {
  const diffSeconds = Math.max(0, Math.round((nowMs - timestampMs) / 1000));
  if (diffSeconds < 10) return "Checked just now";
  if (diffSeconds < 60) return `Checked ${diffSeconds}s ago`;
  const diffMinutes = Math.round(diffSeconds / 60);
  if (diffMinutes < 60) return `Checked ${diffMinutes}m ago`;
  return `Checked ${Math.round(diffMinutes / 60)}h ago`;
}

/** Longer-range relative time for connection timestamps (e.g. "Verified 3h ago") — minutes-precision, extends to days. */
export function formatRelativeTime(epochMs: number, nowMs: number = Date.now()): string {
  const diffMs = nowMs - epochMs;
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}
