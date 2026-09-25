import { NextRequest } from 'next/server';

const NOMINATIM_API_BASE = 'https://nominatim.openstreetmap.org';

// Nominatim usage policy: identify the application with a User-Agent
const USER_AGENT = 'BirdingDiscovery/0.1.0 (https://github.com/chocobar/birding)';

// Nominatim usage policy: maximum 1 request per second (per server instance)
const MIN_REQUEST_INTERVAL_MS = 1050;
// Bound every upstream call so a hung Nominatim can't hang the search bar
const UPSTREAM_TIMEOUT_MS = 10000;
let lastRequestAt = 0;

async function throttledFetch(url: string): Promise<Response> {
  const now = Date.now();
  const waitMs = Math.max(0, lastRequestAt + MIN_REQUEST_INTERVAL_MS - now);
  if (waitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
  lastRequestAt = Date.now();
  return fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept-Language': 'en',
    },
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
}

interface NominatimSearchResult {
  display_name: string;
  lat: string;
  lon: string;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');
  const latStr = searchParams.get('lat');
  const lngStr = searchParams.get('lng');

  try {
    // Forward geocoding: ?q=<place name or postcode>
    if (query) {
      const trimmed = query.trim();
      if (trimmed.length < 2) {
        return Response.json({ results: [] });
      }

      const upstream = await throttledFetch(
        `${NOMINATIM_API_BASE}/search?q=${encodeURIComponent(trimmed)}&format=jsonv2&limit=5`
      );

      if (!upstream.ok) {
        console.error(`Nominatim search error: ${upstream.status}`);
        return Response.json(
          { results: [], error: `Geocoding service returned ${upstream.status}` },
          { status: 502 }
        );
      }

      const data: NominatimSearchResult[] = await upstream.json();

      const results = (Array.isArray(data) ? data : [])
        .filter((item) => item.display_name && item.lat && item.lon)
        .map((item) => ({
          displayName: item.display_name,
          latitude: parseFloat(item.lat),
          longitude: parseFloat(item.lon),
        }));

      return Response.json({ results });
    }

    // Reverse geocoding: ?lat=<lat>&lng=<lng>
    if (latStr && lngStr) {
      const lat = parseFloat(latStr);
      const lng = parseFloat(lngStr);

      if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return Response.json({ displayName: null, error: 'Invalid coordinates' }, { status: 400 });
      }

      const upstream = await throttledFetch(
        `${NOMINATIM_API_BASE}/reverse?lat=${lat}&lon=${lng}&format=jsonv2&zoom=14`
      );

      if (!upstream.ok) {
        console.error(`Nominatim reverse error: ${upstream.status}`);
        return Response.json({ displayName: null }, { status: 200 });
      }

      const data = await upstream.json();
      return Response.json({ displayName: data.display_name ?? null });
    }

    return Response.json(
      { error: 'Missing required parameters: q (search) or lat and lng (reverse)' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error fetching from Nominatim API:', error);
    return Response.json({ error: 'Failed to fetch from geocoding service' }, { status: 502 });
  }
}
