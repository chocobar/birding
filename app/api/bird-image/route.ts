import { NextRequest } from 'next/server';

/**
 * In-memory cache for Wikipedia image lookups.
 * Key: normalised bird name, Value: { imageUrl, attribution } or null
 */
const imageCache = new Map<
  string,
  { imageUrl: string | null; attribution: string | null }
>();

/**
 * Convert a bird name to a Wikipedia article title.
 * "European Robin" → "European_robin"
 * Wikipedia titles are case-sensitive on first char, lowercase rest for species.
 */
function toWikiTitle(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, '_');
}

/**
 * Fetch the main image for a Wikipedia article via the REST Page Summary API.
 * Returns { imageUrl, attribution } or null if no image found.
 */
async function fetchWikipediaImage(
  title: string
): Promise<{ imageUrl: string; attribution: string } | null> {
  try {
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
    const response = await fetch(url, {
      headers: {
        // Wikipedia asks for a User-Agent with contact info
        'User-Agent': 'BirdingDiscovery/1.0 (hobby project)',
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    // Prefer thumbnail at a reasonable size; fall back to originalimage
    if (data.thumbnail?.source) {
      // Wikimedia thumb URLs can be resized by changing the width in the path
      // e.g. /thumb/.../330px-Foo.jpg → /thumb/.../500px-Foo.jpg
      const imageUrl = data.thumbnail.source.replace(
        /\/\d+px-/,
        '/500px-'
      );
      const attribution = data.description
        ? `Image: Wikimedia Commons — ${data.title}`
        : `Image: Wikimedia Commons — ${data.title}`;
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
 * GET /api/bird-image?name=European+Robin
 *
 * Looks up a bird image from Wikipedia. Tries the common name first,
 * then the scientific name as fallback. Results are cached in memory.
 *
 * Query params:
 *   - name (required): The bird's common name, e.g. "European Robin"
 *   - scientificName (optional): Fallback scientific name, e.g. "Erithacus rubecula"
 *
 * Returns: { imageUrl: string | null, attribution: string | null }
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const name = searchParams.get('name');
  const scientificName = searchParams.get('scientificName');

  if (!name) {
    return Response.json(
      { imageUrl: null, attribution: null, error: 'Missing required parameter: name' },
      { status: 400 }
    );
  }

  // Check cache first (keyed by common name)
  const cacheKey = name.toLowerCase().trim();
  if (imageCache.has(cacheKey)) {
    return Response.json(imageCache.get(cacheKey)!);
  }

  // Attempt 1: Look up by common name
  const commonTitle = toWikiTitle(name);
  let result = await fetchWikipediaImage(commonTitle);

  // Attempt 2: If common name failed and we have a scientific name, try that
  if (!result && scientificName) {
    const sciTitle = toWikiTitle(scientificName);
    result = await fetchWikipediaImage(sciTitle);
  }

  // Attempt 3: Try appending "(bird)" to the common name — disambiguates
  // cases like "Wren" which may go to a disambiguation page
  if (!result) {
    const disambigTitle = toWikiTitle(`${name} (bird)`);
    result = await fetchWikipediaImage(disambigTitle);
  }

  const response = result
    ? { imageUrl: result.imageUrl, attribution: result.attribution }
    : { imageUrl: null, attribution: null };

  // Cache the result (including null results to avoid repeated failed lookups)
  imageCache.set(cacheKey, response);

  return Response.json(response);
}