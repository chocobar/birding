import { Location } from '@/lib/types';
import { calculateDistance } from '@/lib/utils/distanceCalculator';
import { dedupeByName, generateDescription } from '@/lib/api/overpass';

/**
 * Geoapify client. Geoapify serves the same OpenStreetMap-derived data the app
 * previously fetched directly from the public Nominatim/Overpass servers, but
 * through a keyed, managed API without their queueing, 504s and usage-policy
 * throttling. All functions here throw on failure; the routes that call them
 * fall back to the public services, so an empty/invalid key or a Geoapify
 * outage degrades to today's behavior instead of breaking the app.
 */

/**
 * Server-side only (no NEXT_PUBLIC_ prefix, same convention as EBIRD_API_KEY).
 * Read per call so a key added after server start is picked up without a
 * rebuild.
 */
export function getGeoapifyApiKey(): string | null {
  const key = process.env.GEOAPIFY_API_KEY?.trim();
  return key ? key : null;
}

const PLACES_ENDPOINT = 'https://api.geoapify.com/v2/places';
const GEOCODE_ENDPOINT = 'https://api.geoapify.com/v1/geocode';

const PLACES_TIMEOUT_MS = 10000;
const GEOCODE_TIMEOUT_MS = 8000;

// Category selection mirrors the Overpass queries in overpass.ts:
// - greens: parks (the parent key includes the garden and nature_reserve child
//   categories), forests, heath/moor and other protected areas
// - water: open water bodies and wetlands
// - trails: named paths/footways, capped like the Overpass trails statement
// (Named hiking-route relations have no Places category and are the one thing
// this loses versus the Overpass relations query; they were best-effort
// decoration there too.)
const GREENS_CATEGORIES = 'leisure.park,natural.forest,natural.heath_moor,natural.protected_area';
const WATER_CATEGORIES = 'natural.water,natural.wetland';
const TRAIL_CATEGORIES = 'highway.path,highway.footway';
const GREENS_LIMIT = 500;
const TRAILS_LIMIT = 100;

interface GeoapifyPlaceProperties {
  name?: string;
  lat?: number;
  lon?: number;
  categories?: string[];
  place_id?: string;
  datasource?: {
    osm_id?: number;
    osm_type?: string;
  };
}

interface GeoapifyPlaceFeature {
  properties?: GeoapifyPlaceProperties;
  geometry?: {
    coordinates?: [number, number];
  };
}

interface GeoapifyPlacesResponse {
  features?: GeoapifyPlaceFeature[];
}

interface GeoapifyGeocodeFeature {
  properties?: {
    formatted?: string;
    lat?: number;
    lon?: number;
  };
}

interface GeoapifyGeocodeResponse {
  features?: GeoapifyGeocodeFeature[];
}

async function fetchPlaces(
  apiKey: string,
  categories: string,
  latitude: number,
  longitude: number,
  radiusMeters: number,
  limit: number
): Promise<GeoapifyPlaceFeature[]> {
  const params = new URLSearchParams({
    categories,
    filter: `circle:${longitude},${latitude},${radiusMeters}`,
    // Distance-ordered results: if a cap truncates the list, the nearest
    // features are the ones kept (parseOverpassElements relied on the same
    // property of the Overpass queries).
    bias: `proximity:${longitude},${latitude}`,
    limit: String(limit),
    lang: 'en',
    apiKey,
  });

  const response = await fetch(`${PLACES_ENDPOINT}?${params.toString()}`, {
    signal: AbortSignal.timeout(PLACES_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Geoapify Places API error: ${response.status}`);
  }

  const data = (await response.json()) as GeoapifyPlacesResponse;
  return Array.isArray(data.features) ? data.features : [];
}

/**
 * Map a green-space feature's categories onto the app's Location types.
 * Checked from most to least specific so a feature carrying both
 * `leisure.park` and `leisure.park.nature_reserve` classifies as a reserve.
 */
function classifyGreenFeature(categories: string[]): Location['type'] {
  if (categories.includes('leisure.park.nature_reserve') || categories.includes('natural.protected_area')) {
    return 'nature_reserve';
  }
  if (categories.some((category) => category === 'natural.wetland' || category.startsWith('natural.wetland.'))) {
    return 'water';
  }
  if (categories.includes('natural.forest') || categories.includes('natural.heath_moor')) {
    return 'woodland';
  }
  return 'park';
}

/** Leaf word of the first specific category, e.g. "leisure.park" → "park". */
function categoryLeaf(categories: string[]): string | undefined {
  for (const category of categories) {
    if (/^(natural|leisure|highway)\./.test(category)) {
      return category.split('.').pop();
    }
  }
  return undefined;
}

function featureToLocation(
  feature: GeoapifyPlaceFeature,
  type: Location['type'],
  userLat: number,
  userLon: number
): Location | null {
  const properties = feature.properties;
  if (!properties?.name) return null;

  let lat = properties.lat;
  let lon = properties.lon;
  if ((lat === undefined || lon === undefined) && feature.geometry?.coordinates) {
    [lon, lat] = feature.geometry.coordinates;
  }
  if (lat === undefined || lon === undefined) return null;

  const categories = properties.categories ?? [];
  const leaf = categoryLeaf(categories);
  const osmType = properties.datasource?.osm_type;
  const osmId = properties.datasource?.osm_id;

  return {
    id: properties.place_id ? `geoapify-${properties.place_id}` : `geoapify-${lat.toFixed(5)},${lon.toFixed(5)}`,
    name: properties.name,
    type,
    latitude: lat,
    longitude: lon,
    distance: calculateDistance(userLat, userLon, lat, lon),
    description: generateDescription(undefined, type),
    tags: leaf ? [leaf] : undefined,
    osmRelationId: osmType === 'relation' && osmId ? osmId : undefined,
  };
}

/**
 * Load the same nearby birding locations the Overpass pipeline produces, via
 * three parallel Places requests (greens, water, trails). Named parks and
 * water are the critical content of the list: if the circle genuinely contains
 * neither, that is treated as a failure so the caller falls back to Overpass
 * instead of caching an empty list for 24 hours.
 */
export async function fetchGeoapifyLocations(
  latitude: number,
  longitude: number,
  radiusMeters: number
): Promise<Location[]> {
  const apiKey = getGeoapifyApiKey();
  if (!apiKey) throw new Error('Geoapify API key is not configured');

  const [greens, water, trails] = await Promise.all([
    fetchPlaces(apiKey, GREENS_CATEGORIES, latitude, longitude, radiusMeters, GREENS_LIMIT),
    fetchPlaces(apiKey, WATER_CATEGORIES, latitude, longitude, radiusMeters, GREENS_LIMIT),
    fetchPlaces(apiKey, TRAIL_CATEGORIES, latitude, longitude, radiusMeters, TRAILS_LIMIT),
  ]);

  const locations = [
    ...greens.map((feature) => featureToLocation(feature, classifyGreenFeature(feature.properties?.categories ?? []), latitude, longitude)),
    ...water.map((feature) => featureToLocation(feature, 'water', latitude, longitude)),
    ...trails.map((feature) => featureToLocation(feature, 'trail', latitude, longitude)),
  ].filter((location): location is Location => location !== null);

  const critical = locations.filter((location) => location.type !== 'trail');
  if (critical.length === 0) {
    throw new Error('Geoapify returned no parks, greens or water features');
  }

  // Same invariants as parseOverpassElements: distance order, then collapse
  // name-duplicated segments (rivers and named paths are many short ways).
  return dedupeByName(locations.sort((a, b) => a.distance - b.distance));
}

/**
 * Forward geocoding via Geoapify. Same result shape as the Nominatim path in
 * the geocode route.
 */
export async function geoapifyForwardGeocode(
  query: string,
  limit = 5
): Promise<Array<{ displayName: string; latitude: number; longitude: number }>> {
  const apiKey = getGeoapifyApiKey();
  if (!apiKey) throw new Error('Geoapify API key is not configured');

  const params = new URLSearchParams({ text: query, limit: String(limit), lang: 'en', apiKey });
  const response = await fetch(`${GEOCODE_ENDPOINT}/search?${params.toString()}`, {
    signal: AbortSignal.timeout(GEOCODE_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Geoapify geocoding API error: ${response.status}`);
  }

  const data = (await response.json()) as GeoapifyGeocodeResponse;
  return (data.features ?? [])
    .map((feature) => feature.properties)
    .filter(
      (properties): properties is { formatted: string; lat: number; lon: number } =>
        !!properties?.formatted && typeof properties.lat === 'number' && typeof properties.lon === 'number'
    )
    .map((properties) => ({
      displayName: properties.formatted,
      latitude: properties.lat,
      longitude: properties.lon,
    }));
}

/**
 * Reverse geocoding via Geoapify. Returns null when nothing matches — the
 * route treats that the same as the Nominatim path's null displayName.
 */
export async function geoapifyReverseGeocode(latitude: number, longitude: number): Promise<string | null> {
  const apiKey = getGeoapifyApiKey();
  if (!apiKey) throw new Error('Geoapify API key is not configured');

  const params = new URLSearchParams({ lat: String(latitude), lon: String(longitude), lang: 'en', apiKey });
  const response = await fetch(`${GEOCODE_ENDPOINT}/reverse?${params.toString()}`, {
    signal: AbortSignal.timeout(GEOCODE_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Geoapify geocoding API error: ${response.status}`);
  }

  const data = (await response.json()) as GeoapifyGeocodeResponse;
  return data.features?.[0]?.properties?.formatted ?? null;
}
