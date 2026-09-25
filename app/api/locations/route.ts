import { NextRequest } from 'next/server';
import { Location } from '@/lib/types';
import {
  fetchOverpass,
  buildElementsQuery,
  buildRoutesQuery,
  parseOverpassElements,
  OverpassResponse,
} from '@/lib/api/overpass';

const DEFAULT_RADIUS_MILES = 5;
const MAX_RADIUS_MILES = 20;
const MILES_TO_METERS = 1609.34;

// Elements query is the critical one; routes are best-effort decoration.
const ELEMENTS_OPTS = { timeoutMs: 15000, attemptsPerEndpoint: 2, deadlineMs: 30000 };
const ROUTES_OPTS = { timeoutMs: 8000, attemptsPerEndpoint: 1, deadlineMs: 15000 };
// Never delay the results list for the routes query longer than this.
const ROUTES_GRACE_MS = 12000;

const CACHE_TTL_MS = 10 * 60 * 1000; // fresh results served for 10 minutes
const STALE_TTL_MS = 24 * 60 * 60 * 1000; // stale results served if Overpass fails
const MAX_CACHE_ENTRIES = 500;

interface CacheEntry {
  locations: Location[];
  freshUntil: number;
  keepUntil: number;
}

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<Location[]>>();

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

async function loadLocations(latitude: number, longitude: number, radiusMiles: number): Promise<Location[]> {
  const radiusMeters = radiusMiles * MILES_TO_METERS;

  const fetchElements = async (query: string, opts: typeof ELEMENTS_OPTS | typeof ROUTES_OPTS) => {
    const data: OverpassResponse = await fetchOverpass(query, opts);
    return data.elements ?? [];
  };

  // Run both queries in parallel. The routes query is the one most likely to
  // 504 or hang on the public Overpass servers (relation lookups are expensive),
  // so it is raced against a short grace timer: if it hasn't finished in time,
  // the list is served without routes instead of blocking on it.
  const elementsPromise = fetchElements(buildElementsQuery(latitude, longitude, radiusMeters), ELEMENTS_OPTS);
  const routesPromise = fetchElements(buildRoutesQuery(latitude, longitude, radiusMeters), ROUTES_OPTS);

  const routes = await Promise.race([
    routesPromise.then(
      (elements) => elements,
      () => []
    ),
    new Promise<null>((resolve) => setTimeout(resolve, ROUTES_GRACE_MS)),
  ]);

  const elements = await elementsPromise;

  if (routes === null) {
    // Swallow a late rejection so the abandoned promise can't crash the process
    routesPromise.catch(() => undefined);
    console.warn(`Routes query exceeded ${ROUTES_GRACE_MS}ms grace for ${latitude},${longitude}; serving without routes`);
  }

  return parseOverpassElements([...elements, ...(routes ?? [])], latitude, longitude);
}

async function getLocationsCached(latitude: number, longitude: number, radiusMiles: number): Promise<Location[]> {
  const key = cacheKey(latitude, longitude, radiusMiles);
  const entry = getCached(key);

  if (entry && Date.now() <= entry.freshUntil) {
    return entry.locations;
  }

  let promise = inflight.get(key);
  if (!promise) {
    promise = loadLocations(latitude, longitude, radiusMiles)
      .then((locations) => {
        const now = Date.now();
        cache.set(key, {
          locations,
          freshUntil: now + CACHE_TTL_MS,
          keepUntil: now + STALE_TTL_MS,
        });
        if (cache.size > MAX_CACHE_ENTRIES) {
          const oldest = cache.keys().next().value;
          if (oldest) cache.delete(oldest);
        }
        return locations;
      })
      .finally(() => inflight.delete(key));
    inflight.set(key, promise);
  }

  try {
    return await promise;
  } catch (error) {
    console.error('Error fetching locations from Overpass API:', error);
    // Serve stale data rather than nothing when Overpass is unavailable
    const stale = getCached(key);
    if (stale) return stale.locations;
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

  try {
    const locations = await getLocationsCached(lat, lng, radius);
    return Response.json({ locations, isLiveData: true });
  } catch (error) {
    console.error('Failed to load nearby locations:', error);
    // Graceful degradation: the client falls back to mock data on isLiveData=false
    return Response.json({ locations: [], isLiveData: false }, { status: 200 });
  }
}
