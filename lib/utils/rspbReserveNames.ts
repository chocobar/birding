/**
 * RSPB reserve names arrive from the ArcGIS open-data feed in UPPERCASE
 * ('OUSE WASHES'). These helpers turn them into display names and deep-link
 * slugs for the RSPB website's reserve pages.
 */

const RSPB_RESERVES_BASE_URL = 'https://www.rspb.org.uk/days-out/reserves';

/** Small words kept lowercase mid-name ('Ouse Washes', 'The Lodge'). */
const SMALL_WORDS = new Set(['of', 'the', 'and', 'a', 'an', 'on', 'in', 'at', 'for', 'to', 'by']);

function capitalizeWord(word: string): string {
  // Capitalize the first letter and any letter after a hyphen ('Ynys-hir'
  // feed spelling aside, hyphenated parts lead their own word)
  let result = '';
  let capitalizeNext = true;
  for (const char of word) {
    result += capitalizeNext ? char.toUpperCase() : char;
    capitalizeNext = char === '-';
  }
  return result;
}

/**
 * 'OUSE WASHES' -> 'Ouse Washes'; 'THE LOONS & LOCH OF BANKS' ->
 * 'The Loons & Loch of Banks'. The first and last words always capitalize.
 */
export function displayCaseReserveName(rawName: string): string {
  const normalized = rawName.trim().replace(/\s+/g, ' ');
  if (!normalized) return rawName;

  const words = normalized.toLowerCase().split(' ');
  return words
    .map((word, index) => {
      if (index > 0 && index < words.length - 1 && SMALL_WORDS.has(word)) return word;
      return capitalizeWord(word);
    })
    .join(' ');
}

/**
 * Deep link to the reserve's page on the RSPB website:
 * name lowercased, 'rspb' removed, non-alphanumerics collapsed to '-',
 * trimmed. Verified pattern: https://www.rspb.org.uk/days-out/reserves/<slug>
 * (arne, the-lodge, minsmere, leighton-moss, bempton-cliffs, ouse-washes,
 * fen-drayton-lakes, fairburn-ings). Falls back to the reserves index.
 */
export function rspbReserveUrl(rawName: string): string {
  const slug = rawName
    .toLowerCase()
    .replace(/\brspb\b/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug ? `${RSPB_RESERVES_BASE_URL}/${slug}` : RSPB_RESERVES_BASE_URL;
}
