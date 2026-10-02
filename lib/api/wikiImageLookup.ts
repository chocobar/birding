/**
 * Shared Wikipedia image lookup utility.
 *
 * Provides an in-memory cache and a `lookupBirdImage` function that
 * resolves a bird's common (or scientific) name to a Wikimedia Commons
 * thumbnail URL + attribution string.
 */

/** In-memory cache for Wikipedia image lookups. */
export interface BirdImageResult {
  imageUrl: string | null;
  attribution: string | null;
  attributionUrl: string | null;
}

export const imageCache = new Map<string, BirdImageResult>();

/**
 * Convert a bird name to a Wikipedia article title.
 * "European Robin" → "European_Robin"
 */
function toWikiTitle(name: string): string {
  return name.trim().replace(/\s+/g, '_');
}

/**
 * Extract the underlying Commons file name from an upload.wikimedia.org URL.
 * Thumbnails end with /<size>px-<filename>, so the file name is the
 * second-to-last segment; originals end with the file name directly.
 * "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Robin.jpg/500px-Robin.jpg"
 *   → "Robin.jpg"
 */
function extractCommonsFilename(imageUrl: string): string | null {
  try {
    const path = decodeURIComponent(new URL(imageUrl).pathname);
    const segments = path.split('/').filter(Boolean);
    const filename = segments.includes('thumb')
      ? segments[segments.length - 2]
      : segments[segments.length - 1];
    return filename || null;
  } catch {
    return null;
  }
}

/** Strip HTML tags and decode the handful of entities Wikimedia templates emit. */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;|&#8217;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Resolve the author and license of a Commons file so CC BY / CC BY-SA
 * images can be credited as their licenses require. Best effort: when the
 * metadata can't be fetched, the caller falls back to a generic credit.
 */
async function fetchCommonsAttribution(
  filename: string
): Promise<{ attribution: string; attributionUrl: string } | null> {
  try {
    const url =
      'https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2' +
      '&prop=imageinfo&iiprop=extmetadata&titles=File:' +
      encodeURIComponent(filename.replace(/\s+/g, '_'));
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'BirdingDiscovery/1.0 (hobby project)',
      },
    });
    if (!response.ok) return null;

    const data = await response.json();
    const metadata = data?.query?.pages?.[0]?.imageinfo?.[0]?.extmetadata;
    if (!metadata) return null;

    const artist = metadata.Artist?.value
      ? stripHtml(String(metadata.Artist.value))
      : metadata.Attribution?.value
        ? stripHtml(String(metadata.Attribution.value))
        : 'Wikimedia Commons contributor';
    const license = metadata.LicenseShortName?.value
      ? String(metadata.LicenseShortName.value)
      : null;

    const truncatedArtist =
      artist.length > 60 ? `${artist.slice(0, 57).trimEnd()}…` : artist;
    const attribution = `${truncatedArtist}${license ? ` · ${license}` : ''} · via Wikimedia Commons`;

    return {
      attribution,
      attributionUrl: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(filename.replace(/\s+/g, '_'))}`,
    };
  } catch (error) {
    console.error(`Commons attribution fetch failed for "${filename}":`, error);
    return null;
  }
}

/**
 * Fetch the main image for a Wikipedia article via the REST Page Summary API.
 * Returns `{ imageUrl, attribution, attributionUrl }` or `null` if no image is found.
 */
async function fetchWikipediaImage(
  title: string
): Promise<BirdImageResult | null> {
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
    const imageUrl = data.thumbnail?.source
      ? data.thumbnail.source.replace(/\/\d+px-/, '/500px-')
      : data.originalimage?.source ?? null;

    if (!imageUrl) return null;

    const filename = extractCommonsFilename(imageUrl);
    const attributionData = filename ? await fetchCommonsAttribution(filename) : null;

    return {
      imageUrl,
      attribution: attributionData?.attribution ?? 'Via Wikimedia Commons',
      attributionUrl:
        attributionData?.attributionUrl ??
        (filename
          ? `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(filename.replace(/\s+/g, '_'))}`
          : 'https://commons.wikimedia.org'),
    };
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
  scientificName?: string
): Promise<BirdImageResult> {
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

  const response: BirdImageResult = result ?? {
    imageUrl: null,
    attribution: null,
    attributionUrl: null,
  };

  // Cache the result (including null results to avoid repeated failed lookups)
  imageCache.set(cacheKey, response);

  return response;
}