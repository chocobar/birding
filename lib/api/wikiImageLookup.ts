/**
 * Shared Wikipedia image lookup utility.
 *
 * Provides an in-memory cache and a `lookupBirdImage` function that
 * resolves a bird's common (or scientific) name to a Wikimedia Commons
 * thumbnail URL + attribution string.
 */

/** In-memory cache for Wikipedia image lookups. */
export const imageCache = new Map<
  string,
  { imageUrl: string | null; attribution: string | null }
>();

/**
 * Convert a bird name to a Wikipedia article title.
 * "European Robin" → "European_Robin"
 */
function toWikiTitle(name: string): string {
  return name.trim().replace(/\s+/g, '_');
}

/**
 * Fetch the main image for a Wikipedia article via the REST Page Summary API.
 * Returns `{ imageUrl, attribution }` or `null` if no image is found.
 */
async function fetchWikipediaImage(
  title: string,
): Promise<{ imageUrl: string; attribution: string } | null> {
  try {
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'BirdingDiscovery/1.0 (hobby project)',
      },
    });

    if (!response.ok) return null;

    const data = await response.json();

    // Prefer thumbnail at a reasonable size; fall back to originalimage
    if (data.thumbnail?.source) {
      const imageUrl = data.thumbnail.source.replace(/\/\d+px-/, '/500px-');
      const attribution = `Image: Wikimedia Commons — ${data.title}`;
      return { imageUrl, attribution };
    }

    if (data.originalimage?.source) {
      return {
        imageUrl: data.originalimage.source,
        attribution: `Image: Wikimedia Commons — ${data.title}`,
      };
    }

    return null;
  } catch (error) {
    console.error(`Wikipedia image fetch failed for "${title}":`, error);
    return null;
  }
}

/**
 * Look up a bird image from Wikipedia.
 *
 * Resolution order:
 *  1. In-memory cache (keyed by lower-cased, trimmed common name)
 *  2. Wikipedia page summary for the common name
 *  3. Wikipedia page summary for the scientific name (if provided)
 *  4. Wikipedia page summary for `"<name> (bird)"` (disambiguation fallback)
 *
 * Both successful and unsuccessful lookups are cached so that repeated
 * calls for the same bird don't hit Wikipedia again.
 */
export async function lookupBirdImage(
  name: string,
  scientificName?: string,
): Promise<{ imageUrl: string | null; attribution: string | null }> {
  const cacheKey = name.toLowerCase().trim();

  if (imageCache.has(cacheKey)) {
    return imageCache.get(cacheKey)!;
  }

  // Attempt 1: common name
  const commonTitle = toWikiTitle(name);
  let result = await fetchWikipediaImage(commonTitle);

  // Attempt 2: scientific name (if provided)
  if (!result && scientificName) {
    const sciTitle = toWikiTitle(scientificName);
    result = await fetchWikipediaImage(sciTitle);
  }

  // Attempt 3: common name + "(bird)" disambiguation
  if (!result) {
    const disambigTitle = toWikiTitle(`${name} (bird)`);
    result = await fetchWikipediaImage(disambigTitle);
  }

  const response = result
    ? { imageUrl: result.imageUrl, attribution: result.attribution }
    : { imageUrl: null, attribution: null };

  // Cache the result (including null results to avoid repeated failed lookups)
  imageCache.set(cacheKey, response);

  return response;
}