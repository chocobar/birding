import { NextRequest } from 'next/server';
import { Location } from '@/lib/types';
import { fetchGeoapifyLocations, getGeoapifyApiKey } from '@/lib/api/geoapify';
import {
  fetchOverpass,
  buildGreensQuery,
  buildWaterQuery,
  buildReservesAndTrailsQuery,
  buildRelationsQuery,
  parseOverpassElements,
  OverpassElement,
  OverpassFetchOptions,
} from '@/lib/api/overpass';

const DEFAULT_RADIUS_MILES = 5;
const MAX_RADIUS_MILES = 20;
const MILES_TO_METERS = 1609.34;

// Greens and water are the critical content of the list; everything else is
// best-effort decoration that must never delay rendering.
//
// Under load the public Overpass instances queue a query for 10-20s before it
// starts executing, so a 15s per-attempt timeout kills requests that would
// have succeeded seconds later (queries observed succeeding at 21-28s). The
// attempt window is therefore generous; the overall deadline still bounds the
// caller's wait.
const CRITICAL_OPTS: OverpassFetchOptions = { timeoutMs: 30000, attemptsPerEndpoint: 2, deadlineMs: 35000 };
const BEST_EFFORT_OPTS: OverpassFetchOptions = { timeoutMs: 15000, attemptsPerEndpoint: 2, deadlineMs: 25000 };
// Never delay the results list for the best-effort group longer than this.
const BEST_EFFORT_GRACE_MS = 12000;

// The public Overpass instances cap clients at a handful of concurrent
// requests (overpass-api.de currently allows 4 per IP) and reply "too busy"
// 504s beyond that. A burst of six parallel queries self-inflicts those 504s
// even when each query would succeed on its own, so all Overpass work is
// funneled through this global two-slot gate.
const MAX_OVERPASS_CONCURRENCY = 2;

let activeSlots = 0;
const slotWaiters: Array<{
  resolve: (release: () => void) => void;
  reject: (reason?: unknown) => void;
  onAbort: () => void;
}> = [];

function releaseSlot(): void {
  const next = slotWaiters.shift();
  if (next) {
    next.resolve(releaseSlot);
  } else {
    activeSlots -= 1;
  }
}

async function acquireOverpassSlot(signal?: AbortSignal): Promise<() => void> {
  if (signal?.aborted) throw abortError();

  if (activeSlots < MAX_OVERPASS_CONCURRENCY) {
    activeSlots += 1;
    return releaseSlot;
  }

  return new Promise((resolve, reject) => {
    const onAbort = () => {
      const index = slotWaiters.findIndex((waiter) => waiter.onAbort === onAbort);
      if (index >= 0) slotWaiters.splice(index, 1);
      reject(signal!.reason ?? abortError());
    };
    slotWaiters.push({
      resolve: (release) => {
        signal?.removeEventListener('abort', onAbort);
        resolve(release);
      },
      reject,
      onAbort,
    });
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

const CACHE_TTL_MS = 10 * 60 * 1000; // fresh results served for 10 minutes
const STALE_TTL_MS = 24 * 60 * 60 * 1000; // stale results served while revalidating or if Overpass fails
const MAX_CACHE_ENTRIES = 500;
// After a failed background revalidation, wait this long before trying again:
// a struggling Overpass must not receive a fresh query on every request.
const REVALIDATE_COOLDOWN_MS = 60 * 1000;

interface CacheEntry {
  locations: Location[];
  freshUntil: number;
  keepUntil: number;
  /** Until this time a failed background refresh suppresses further revalidation */
  retryAfter?: number;
}

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<Location[]>>();

function abortError(): Error {
  return new DOMException('Aborted', 'AbortError');
}

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
  // Geoapify Places is the primary source when an API key is configured: it
  // serves the same OSM-derived greens/water/trails through a keyed, managed
  // API and answers in ~1s, without the public Overpass queueing that the
  // pipeline below works around. The Overpass pipeline stays as the fallback
  // for an absent key or a Geoapify failure, so neither outage mode loses the
  // list. Both paths share the stale-while-revalidate cache above.
  if (getGeoapifyApiKey()) {
    try {
      return await fetchGeoapifyLocations(latitude, longitude, radiusMiles * MILES_TO_METERS);
    } catch (error) {
      console.warn(`Geoapify Places failed for ${latitude},${longitude}; falling back to Overpass:`, error);
    }
  }

  const radiusMeters = radiusMiles * MILES_TO_METERS;

  const fetchElements = async (
    query: string,
    opts: OverpassFetchOptions,
    signal?: AbortSignal
  ): Promise<OverpassElement[]> => {
    const release = await acquireOverpassSlot(signal);
    try {
      const data = await fetchOverpass(query, { ...opts, signal });
      return data.elements ?? [];
    } finally {
      release();
    }
  };

  // Greens and water are the core of the list and are awaited; reserves,
  // trails, green-space relations and walking routes are decoration that is
  // fragile and/or high-latency on the public Overpass servers, so their two
  // consolidated queries (see overpass.ts for why the critical pair stays
  // separate and the decoration pair is shared) are raced against a short
  // grace timer: if they have not finished in time the list is served
  // without them instead of blocking on them. All queries share the
  // two-slot Overpass gate, critical first, so the burst of concurrent
  // requests that used to trip the servers' per-client limits is gone; the
  // grace timer and critical failure abort whatever best-effort work is
  // still queued or in flight so abandoned queries never hold Overpass slots.
  const bestEffortAbort = new AbortController();

  const criticalPromise = Promise.all([
    fetchElements(buildGreensQuery(latitude, longitude, radiusMeters), CRITICAL_OPTS),
    fetchElements(buildWaterQuery(latitude, longitude, radiusMeters), CRITICAL_OPTS),
  ]);
  // The critical queries are awaited below, but if they reject while the
  // grace race is still pending nobody is attached yet — silence the
  // resulting unhandled-rejection warning.
  criticalPromise.catch(() => {});

  const bestEffortSignal = bestEffortAbort.signal;
  const bestEffortPromise = Promise.allSettled([
    // Cheapest scan first: slot hand-off order decides what fits inside the
    // grace window.
    fetchElements(buildReservesAndTrailsQuery(latitude, longitude, radiusMeters), BEST_EFFORT_OPTS, bestEffortSignal),
    fetchElements(buildRelationsQuery(latitude, longitude, radiusMeters), BEST_EFFORT_OPTS, bestEffortSignal),
  ]).then((results) =>
    results.flatMap((result) => (result.status === 'fulfilled' ? result.value : []))
  );

  const bestEffort = await Promise.race([
    bestEffortPromise,
    new Promise<OverpassElement[]>((resolve) =>
      setTimeout(() => {
        bestEffortAbort.abort();
        resolve([]);
      }, BEST_EFFORT_GRACE_MS)
    ),
  ]);

  let critical: OverpassElement[][];
  try {
    critical = await criticalPromise;
  } catch (error) {
    // Both critical queries failed. If some best-effort data did arrive in
    // time, serve that rather than discarding real results for mock data.
    bestEffortAbort.abort();
    if (bestEffort.length === 0) {
      throw error;
    }
    console.warn(
      `Greens/water queries failed for ${latitude},${longitude}; serving best-effort categories only`
    );
    return parseOverpassElements(bestEffort, latitude, longitude);
  }

  return parseOverpassElements(
    [...critical.flat(), ...bestEffort],
    latitude,
    longitude
  );
}

/**
 * Start (or join) an Overpass load for a cache key and store the result on
 * success. A failed refresh stamps a cooldown on the existing entry so
 * stale-while-revalidate callers stop re-querying a struggling Overpass on
 * every request until it has had time to recover.
 */
function startRefresh(key: string, latitude: number, longitude: number, radiusMiles: number): Promise<Location[]> {
  const existing = inflight.get(key);
  if (existing) return existing;

  const promise = loadLocations(latitude, longitude, radiusMiles)
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

async function getLocationsCached(latitude: number, longitude: number, radiusMiles: number): Promise<Location[]> {
  const key = cacheKey(latitude, longitude, radiusMiles);
  const entry = getCached(key);

  if (entry && Date.now() <= entry.freshUntil) {
    return entry.locations;
  }

  if (entry) {
    // Stale-while-revalidate: parks, water and trails change on OSM
    // timescales (weeks), so a stale list served instantly beats a fresh
    // one that costs 10-35s of public-server queueing. Revalidate in the
    // background unless a recent refresh failed.
    revalidateStale(key, latitude, longitude, radiusMiles, entry);
    return entry.locations;
  }

  try {
    return await startRefresh(key, latitude, longitude, radiusMiles);
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
    // No data and no stale cache to serve: report the outage honestly so the
    // client shows an error state instead of fabricating results.
    return Response.json(
      { locations: [], isLiveData: false, error: 'Location data is temporarily unavailable' },
      { status: 502 }
    );
  }
}
