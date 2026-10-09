import { NextRequest } from 'next/server';
import { Location, LocationDataSource } from '@/lib/types';
import { dedupeByName, fetchGeoapifyLocations, getGeoapifyApiKey } from '@/lib/api/geoapify';
import { fetchTrailRelations } from '@/lib/api/overpass';

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

// --- Trails (named walking-route relations, from Overpass) ---
// Cached separately from the Geoapify list: route relations change on OSM
// timescales of months (vs weeks for parks), so they are reused for an hour,
// and an Overpass incident must never delay or fail the Geoapify-served list.
// A failed trails load leaves a negative marker that suppresses retries for a
// cooldown, so a cold search during an Overpass outage pays the fetch timeout
// once per grid cell instead of on every request.

const TRAILS_TTL_MS = 60 * 60 * 1000; // fresh results served for 1 hour
const TRAILS_KEEP_MS = 24 * 60 * 60 * 1000;
const TRAILS_COOLDOWN_MS = 5 * 60 * 1000;
const MAX_TRAILS_RADIUS_MILES = 5; // the trails query caps its own radius (relation `around` cost)
const MAX_TRAILS_CACHE_ENTRIES = 500;

interface TrailsCacheEntry {
  locations: Location[];
  freshUntil: number;
  keepUntil: number;
  retryAfter?: number;
}

const trailsCache = new Map<string, TrailsCacheEntry>();
const trailsInflight = new Map<string, Promise<Location[]>>();

function trailsCacheKey(latitude: number, longitude: number, radiusMiles: number): string {
  // Share one entry across search radii at or above the query's own cap
  return `${latitude.toFixed(3)},${longitude.toFixed(3)}:t${Math.min(radiusMiles, MAX_TRAILS_RADIUS_MILES)}`;
}

function startTrailsLoad(key: string, latitude: number, longitude: number, radiusMiles: number): Promise<Location[]> {
  const promise = fetchTrailRelations(latitude, longitude, radiusMiles * MILES_TO_METERS)
    .then((trails) => {
      const now = Date.now();
      trailsCache.set(key, {
        locations: trails,
        freshUntil: now + TRAILS_TTL_MS,
        keepUntil: now + TRAILS_KEEP_MS,
      });
      if (trailsCache.size > MAX_TRAILS_CACHE_ENTRIES) {
        const oldest = trailsCache.keys().next().value;
        if (oldest) trailsCache.delete(oldest);
      }
      return trails;
    })
    .catch((error) => {
      console.warn('Trail relations unavailable (Overpass):', error);
      const now = Date.now();
      const existing = trailsCache.get(key);
      if (existing) {
        // Keep serving the previous list; just pause revalidation for the
        // cooldown so a struggling Overpass is not re-queried on every
        // request.
        trailsCache.set(key, { ...existing, retryAfter: now + TRAILS_COOLDOWN_MS });
      } else {
        // Negative marker: always-stale empty list that blocks revalidation
        // for the cooldown. Callers still see this request's rejection.
        trailsCache.set(key, {
          locations: [],
          freshUntil: now - 1,
          keepUntil: now + TRAILS_COOLDOWN_MS,
          retryAfter: now + TRAILS_COOLDOWN_MS,
        });
      }
      throw error;
    })
    .finally(() => trailsInflight.delete(key));
  trailsInflight.set(key, promise);
  return promise;
}

function revalidateTrailsStale(key: string, latitude: number, longitude: number, radiusMiles: number, entry: TrailsCacheEntry): void {
  if (trailsInflight.has(key)) return;
  if (entry.retryAfter && Date.now() < entry.retryAfter) return;
  startTrailsLoad(key, latitude, longitude, radiusMiles).catch(() => {});
}

/**
 * Trails for a grid cell: hour-fresh reuse, stale-while-revalidate, and a
 * negative marker after failures. Rejects only on a cold load that itself
 * failed; the handler degrades to a trails-less list in that case.
 */
async function getTrailsCached(latitude: number, longitude: number, radiusMiles: number): Promise<Location[]> {
  const key = trailsCacheKey(latitude, longitude, radiusMiles);
  const entry = trailsCache.get(key);

  if (entry) {
    if (Date.now() > entry.keepUntil) {
      trailsCache.delete(key);
    } else {
      if (Date.now() > entry.freshUntil) {
        revalidateTrailsStale(key, latitude, longitude, radiusMiles, entry);
      }
      return entry.locations;
    }
  }

  const inflight = trailsInflight.get(key);
  if (inflight) return inflight;
  return startTrailsLoad(key, latitude, longitude, radiusMiles);
}

/**
 * Trails lead the merged list's trail content; named path ways that share a
 * trail relation's name are that route's member segments and would otherwise
 * appear twice (the relation carries the name; Geoapify returns its fragments
 * individually).
 */
function mergeTrails(locations: Location[], trails: Location[]): Location[] {
  if (trails.length === 0) return locations;
  const trailNames = new Set(trails.map((trail) => trail.name.toLowerCase()));
  const merged = [
    ...trails,
    ...locations.filter((location) => location.type !== 'path' || !trailNames.has(location.name.toLowerCase())),
  ];
  return dedupeByName(merged.sort((a, b) => a.distance - b.distance));
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
    const [{ locations, source }, trails] = await Promise.all([
      getLocationsCached(lat, lng, radius),
      getTrailsCached(lat, lng, radius).catch(() => [] as Location[]),
    ]);
    return Response.json({ locations: mergeTrails(locations, trails), isLiveData: true, source });
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
