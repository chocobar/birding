import { NextRequest } from 'next/server';
import { calculateDistance, milesToKilometers } from '@/lib/utils/distanceCalculator';

interface EBirdHotspot {
  locId: string;
  locName: string;
  lat: number;
  lng: number;
}

interface EBirdHotspotObservation {
  speciesCode: string;
}

export interface HotspotRichnessResult {
  locId: string;
  locName: string;
  lat: number;
  lng: number;
  speciesCount: number;
  distanceMiles: number;
}

const DEFAULT_RADIUS_MILES = 5;
const MAX_RADIUS_MILES = 20;
const EBIRD_MAX_DIST_KM = 50;

const MAX_HOTSPOTS = 12;
const OBS_WINDOW_DAYS = 7;
const OBS_FETCH_CONCURRENCY = 4;
const MIN_SPECIES_COUNT = 1;

const HOTSPOTS_TTL_MS = 30 * 60 * 1000;
const HOTSPOTS_KEEP_MS = 24 * 60 * 60 * 1000;
const HOTSPOTS_COOLDOWN_MS = 5 * 60 * 1000;
const MAX_HOTSPOTS_CACHE_ENTRIES = 500;

interface HotspotsCacheEntry {
  hotspots: HotspotRichnessResult[];
  freshUntil: number;
  keepUntil: number;
  retryAfter?: number;
}

const hotspotsCache = new Map<string, HotspotsCacheEntry>();
const hotspotsInflight = new Map<string, Promise<HotspotRichnessResult[]>>();

function hotspotsCacheKey(latitude: number, longitude: number, radiusMiles: number): string {
  return `${latitude.toFixed(3)},${longitude.toFixed(3)}:h${radiusMiles}`;
}

function fetchEbird(path: string, params: URLSearchParams): Promise<Response> {
  return fetch(`https://api.ebird.org/v2/${path}?${params.toString()}`, {
    headers: { 'X-eBirdApiToken': process.env.EBIRD_API_KEY ?? '' },
    signal: AbortSignal.timeout(10000),
  });
}

async function fetchHotspotObservationCount(locId: string): Promise<number> {
  const response = await fetchEbird(
    `data/obs/${encodeURIComponent(locId)}/recent`,
    new URLSearchParams({ back: OBS_WINDOW_DAYS.toString() })
  );
  if (response.status === 404) return 0;
  if (!response.ok) throw new Error(`eBird hotspot obs ${locId} returned ${response.status}`);
  const observations: EBirdHotspotObservation[] = await response.json();
  return new Set(observations.map((obs) => obs.speciesCode)).size;
}

async function fetchWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function runOne(): Promise<void> {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runOne));
  return results;
}

async function loadHotspotRichness(
  latitude: number,
  longitude: number,
  radiusMiles: number
): Promise<HotspotRichnessResult[]> {
  const distKm = Math.min(milesToKilometers(radiusMiles), EBIRD_MAX_DIST_KM);
  const hotspotResponse = await fetchEbird(
    'ref/hotspot/geo',
    new URLSearchParams({
      lat: latitude.toString(),
      lng: longitude.toString(),
      dist: distKm.toString(),
      fmt: 'json',
    })
  );
  if (!hotspotResponse.ok) {
    throw new Error(`eBird hotspot geo returned ${hotspotResponse.status}`);
  }

  const hotspots: EBirdHotspot[] = await hotspotResponse.json();
  const nearest = hotspots
    .filter((hotspot) => typeof hotspot.lat === 'number' && typeof hotspot.lng === 'number')
    .map((hotspot) => ({
      ...hotspot,
      distanceMiles: calculateDistance(latitude, longitude, hotspot.lat, hotspot.lng),
    }))
    .sort((a, b) => a.distanceMiles - b.distanceMiles)
    .slice(0, MAX_HOTSPOTS);

  const counts = await fetchWithConcurrency(nearest, OBS_FETCH_CONCURRENCY, (hotspot) =>
    fetchHotspotObservationCount(hotspot.locId)
  );

  return nearest
    .map((hotspot, index) => ({
      locId: hotspot.locId,
      locName: hotspot.locName,
      lat: hotspot.lat,
      lng: hotspot.lng,
      speciesCount: counts[index],
      distanceMiles: hotspot.distanceMiles,
    }))
    .filter((hotspot) => hotspot.speciesCount >= MIN_SPECIES_COUNT);
}

function startHotspotsLoad(
  key: string,
  latitude: number,
  longitude: number,
  radiusMiles: number
): Promise<HotspotRichnessResult[]> {
  const promise = loadHotspotRichness(latitude, longitude, radiusMiles)
    .then((hotspots) => {
      const now = Date.now();
      hotspotsCache.set(key, {
        hotspots,
        freshUntil: now + HOTSPOTS_TTL_MS,
        keepUntil: now + HOTSPOTS_KEEP_MS,
      });
      if (hotspotsCache.size > MAX_HOTSPOTS_CACHE_ENTRIES) {
        const oldest = hotspotsCache.keys().next().value;
        if (oldest) hotspotsCache.delete(oldest);
      }
      return hotspots;
    })
    .catch((error) => {
      console.warn('Hotspot richness unavailable (eBird):', error);
      const now = Date.now();
      const existing = hotspotsCache.get(key);
      if (existing) {
        hotspotsCache.set(key, { ...existing, retryAfter: now + HOTSPOTS_COOLDOWN_MS });
      } else {
        hotspotsCache.set(key, {
          hotspots: [],
          freshUntil: now - 1,
          keepUntil: now + HOTSPOTS_COOLDOWN_MS,
          retryAfter: now + HOTSPOTS_COOLDOWN_MS,
        });
      }
      throw error;
    })
    .finally(() => hotspotsInflight.delete(key));
  hotspotsInflight.set(key, promise);
  return promise;
}

function revalidateHotspotsStale(
  key: string,
  latitude: number,
  longitude: number,
  radiusMiles: number,
  entry: HotspotsCacheEntry
): void {
  if (hotspotsInflight.has(key)) return;
  if (entry.retryAfter && Date.now() < entry.retryAfter) return;
  startHotspotsLoad(key, latitude, longitude, radiusMiles).catch(() => {});
}

async function getHotspotsCached(
  latitude: number,
  longitude: number,
  radiusMiles: number
): Promise<HotspotRichnessResult[]> {
  const key = hotspotsCacheKey(latitude, longitude, radiusMiles);
  const entry = hotspotsCache.get(key);

  if (entry) {
    if (Date.now() > entry.keepUntil) {
      hotspotsCache.delete(key);
    } else {
      if (Date.now() > entry.freshUntil) {
        revalidateHotspotsStale(key, latitude, longitude, radiusMiles, entry);
      }
      return entry.hotspots;
    }
  }

  const inflight = hotspotsInflight.get(key);
  if (inflight) return inflight;
  return startHotspotsLoad(key, latitude, longitude, radiusMiles);
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const latStr = searchParams.get('lat');
  const lngStr = searchParams.get('lng');

  if (!latStr || !lngStr) {
    return Response.json(
      { hotspots: [], isLiveData: false, error: 'Missing required parameters: lat and lng' },
      { status: 400 }
    );
  }

  const lat = parseFloat(latStr);
  const lng = parseFloat(lngStr);

  if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return Response.json(
      { hotspots: [], isLiveData: false, error: 'lat and lng must be valid coordinates' },
      { status: 400 }
    );
  }

  const radiusStr = searchParams.get('radius');
  let radius = DEFAULT_RADIUS_MILES;
  if (radiusStr) {
    const parsed = parseFloat(radiusStr);
    if (isNaN(parsed) || parsed < 1 || parsed > MAX_RADIUS_MILES) {
      return Response.json(
        { hotspots: [], isLiveData: false, error: `radius must be between 1 and ${MAX_RADIUS_MILES} miles` },
        { status: 400 }
      );
    }
    radius = parsed;
  }

  if (!process.env.EBIRD_API_KEY) {
    console.warn('EBIRD_API_KEY is not set. Returning no hotspot richness.');
    return Response.json({ hotspots: [], isLiveData: false, error: 'eBird API key not configured' });
  }

  try {
    const hotspots = await getHotspotsCached(lat, lng, radius);
    return Response.json({ hotspots, isLiveData: true });
  } catch (error) {
    console.error('Failed to load hotspot richness:', error);
    return Response.json(
      { hotspots: [], isLiveData: false, error: 'Hotspot data is temporarily unavailable' }
    );
  }
}
