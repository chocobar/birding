import { NextRequest } from 'next/server';
import { Location, LocationDataSource } from '@/lib/types';
import { fetchGeoapifyLocations, getGeoapifyApiKey } from '@/lib/api/geoapify';

const DEFAULT_RADIUS_MILES = 5;
const MAX_RADIUS_MILES = 20;
const MILES_TO_METERS = 1609.34;

const CACHE_TTL_MS = 10 * 60 * 1000; // fresh results served for 10 minutes
const STALE_TTL_MS = 24 * 60 * 60 * 1000; // stale results served while revalidating or if Geoapify fails
const MAX_CACHE_ENTRIES = 500;
// After a failed background revalidation, wait this long before trying again:
// a struggling upstream must not receive a fresh query on every request.
const REVALIDATE_COOLDOWN_MS = 60 * 1000;

interface CacheEntry {
  locations: Location[];
  /** Which upstream served these results — drives the "Powered by Geoapify" attribution */
  source: LocationDataSource;
  freshUntil: number;
  keepUntil: number;
  /** Until this time a failed background refresh suppresses further revalidation */
  retryAfter?: number;
}

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<{ locations: Location[]; source: LocationDataSource }>>();

function cacheKey(lat: number, lng: number, radiusMiles: number): string {
  // ~110m grid: near-identical searches share a cache entry
  return `${lat.toFixed(3)},${lng.toFixed(3)}:${radiusMiles}`;
}

function getCached(key: string): CacheEntry | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.keepUntil) {
    cache.delete(key);
    return undefined;
  }
  return entry;
}

async function loadLocations(
  latitude: number,
  longitude: number,
  radiusMiles: number
): Promise<{ locations: Location[]; source: LocationDataSource }> {
  const locations = await fetchGeoapifyLocations(latitude, longitude, radiusMiles * MILES_TO_METERS);
  return { locations, source: 'geoapify' };
}

/**
 * Start (or join) a load for a cache key and store the result on success.
 * A failed refresh stamps a cooldown on the existing entry so
 * stale-while-revalidate callers stop re-querying a struggling upstream on
 * every request until it has had time to recover.
 */
function startRefresh(
  key: string,
  latitude: number,
  longitude: number,
  radiusMiles: number
): Promise<{ locations: Location[]; source: LocationDataSource }> {
  const existing = inflight.get(key);
  if (existing) return existing;

  const promise = loadLocations(latitude, longitude, radiusMiles)
    .then(({ locations, source }) => {
      const now = Date.now();
      cache.set(key, {
        locations,
        source,
        freshUntil: now + CACHE_TTL_MS,
        keepUntil: now + STALE_TTL_MS,
      });
      if (cache.size > MAX_CACHE_ENTRIES) {
        const oldest = cache.keys().next().value;
        if (oldest) cache.delete(oldest);
      }
      return { locations, source };
    })
    .catch((error) => {
      const entry = cache.get(key);
      if (entry) cache.set(key, { ...entry, retryAfter: Date.now() + REVALIDATE_COOLDOWN_MS });
      throw error;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}

function revalidateStale(key: string, latitude: number, longitude: number, radiusMiles: number, entry: CacheEntry): void {
  if (inflight.has(key)) return;
  if (entry.retryAfter && Date.now() < entry.retryAfter) return;
  // Fire-and-forget: startRefresh rejects are handled here; the cold path
  // below awaits its own refresh directly.
  startRefresh(key, latitude, longitude, radiusMiles).catch(() => {});
}

async function getLocationsCached(
  latitude: number,
  longitude: number,
  radiusMiles: number
): Promise<{ locations: Location[]; source: LocationDataSource }> {
  const key = cacheKey(latitude, longitude, radiusMiles);
  const entry = getCached(key);

  if (entry && Date.now() <= entry.freshUntil) {
    return { locations: entry.locations, source: entry.source };
  }

  if (entry) {
    // Stale-while-revalidate: parks, water and trails change on OSM
    // timescales (weeks), so a stale list served instantly beats a fresh
    // one that costs an upstream round trip. Revalidate in the background
    // unless a recent refresh failed.
    revalidateStale(key, latitude, longitude, radiusMiles, entry);
    return { locations: entry.locations, source: entry.source };
  }

  try {
    return await startRefresh(key, latitude, longitude, radiusMiles);
  } catch (error) {
    console.error('Error fetching locations from Geoapify:', error);
    // Serve stale data rather than nothing when Geoapify is unavailable
    const stale = getCached(key);
    if (stale) return { locations: stale.locations, source: stale.source };
    throw error;
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const latStr = searchParams.get('lat');
  const lngStr = searchParams.get('lng');

  if (!latStr || !lngStr) {
    return Response.json(
      { locations: [], isLiveData: false, error: 'Missing required parameters: lat and lng' },
      { status: 400 }
    );
  }

  const lat = parseFloat(latStr);
  const lng = parseFloat(lngStr);

  if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return Response.json(
      { locations: [], isLiveData: false, error: 'lat and lng must be valid coordinates' },
      { status: 400 }
    );
  }

  const radiusStr = searchParams.get('radius');
  let radius = DEFAULT_RADIUS_MILES;
  if (radiusStr) {
    const parsed = parseFloat(radiusStr);
    if (isNaN(parsed) || parsed < 1 || parsed > MAX_RADIUS_MILES) {
      return Response.json(
        { locations: [], isLiveData: false, error: `radius must be between 1 and ${MAX_RADIUS_MILES} miles` },
        { status: 400 }
      );
    }
    radius = parsed;
  }

  if (!getGeoapifyApiKey()) {
    return Response.json(
      {
        locations: [],
        isLiveData: false,
        error: 'Location data requires a Geoapify API key. Set GEOAPIFY_API_KEY on the server.',
      },
      { status: 502 }
    );
  }

  try {
    const { locations, source } = await getLocationsCached(lat, lng, radius);
    return Response.json({ locations, isLiveData: true, source });
  } catch (error) {
    console.error('Failed to load nearby locations:', error);
    // No data and no stale cache to serve: report the outage honestly so the
    // client shows an error state instead of fabricating results.
    return Response.json(
      { locations: [], isLiveData: false, error: 'Location data is temporarily unavailable' },
      { status: 502 }
    );
  }
}
