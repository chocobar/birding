/**
 * Format how long ago an observation was made, e.g. "just now",
 * "45 minutes ago", "3 days ago".
 *
 * Accepts eBird-style timestamps ("2026-10-09 08:15") and plain dates
 * ("2026-10-09"). Returns an empty string for unparseable input so callers
 * can omit the fragment.
 */
export function formatTimeAgo(obsDt: string): string {
  if (!obsDt) return '';

  const normalized = obsDt.includes('T') ? obsDt : obsDt.replace(' ', 'T');
  const date = new Date(normalized.length === 10 ? `${normalized}T00:00:00` : normalized);

  if (isNaN(date.getTime())) return '';

  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0) return 'just now';

  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';

  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }

  const days = Math.floor(hours / 24);
  if (days < 30) {
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }

  const months = Math.floor(days / 30);
  if (months < 12) {
    return `${months} month${months === 1 ? '' : 's'} ago`;
  }

  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? '' : 's'} ago`;
}
