import { Location } from '@/lib/types';
import { calculateDistance } from '@/lib/utils/distanceCalculator';

/**
 * Geoapify client. Geoapify serves OpenStreetMap-derived data through a
 * keyed, managed API without the public Nominatim servers' queueing, 504s
 * and usage-policy throttling. All functions here throw on
 * failure; the routes that call them surface the error so the UI can show
 * its retry state instead of fabricating results.
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

// Category selection for the Places queries:
// - greens: parks (the parent key includes the garden and nature_reserve child
//   categories), forests, heath/moor and other protected areas
// - water: open water bodies and wetlands
// - trails: named paths, capped like the trails query
// (Named hiking-route relations have no Places category; highway.footway is
// deliberately excluded: footways are urban pavements and passages, not trails.)
const GREENS_CATEGORIES = 'leisure.park,natural.forest,natural.heath_moor,natural.protected_area';
const WATER_CATEGORIES = 'natural.water,natural.wetland';
const TRAIL_CATEGORIES = 'highway.path';
const GREENS_LIMIT = 500;
const TRAILS_LIMIT = 100;

/** Collapse consecutive results that share a type and name (rivers and named
 * paths arrive as many short segments from the Places API). */
export function dedupeByName(locations: Location[]): Location[] {
  const seen = new Map<string, Location>();

  for (const location of locations) {
    const key = `${location.type}:${location.name.toLowerCase()}`;
    if (!seen.has(key)) {
      seen.set(key, location);
    }
  }

  return Array.from(seen.values());
}

export function generateDescription(tags: Record<string, string> | undefined, type: Location['type']): string {
  const descriptions: Record<Location['type'], string> = {
    water: 'Natural water body - ideal for waterfowl and wetland bird species',
    woodland: 'Wooded area - great for woodland birds and wildlife',
    nature_reserve: 'Protected nature reserve with diverse habitats',
    park: 'Public park with green spaces and nature areas',
    trail: 'Walking trail - good for bird watching on foot',
    route: 'Named walking route made up of linked paths',
  };

  let description = descriptions[type];

  if (!tags) return description;

  if (type === 'route') {
    if (tags.network === 'nwn') {
      description = 'National Trail - long-distance waymarked walking route';
    } else if (tags.network === 'rwn') {
      description = 'Regional walking route - waymarked, typically a day-long walk';
    } else if (tags.network === 'lwn') {
      description = 'Local waymarked walk - often a circular route';
    }
  }

  if (tags.access === 'yes' || tags.access === 'permissive') {
    description += '. Public access available';
  }

  return description;
}

interface GeoapifyPlaceProperties {
  name?: string;
  lat?: number;
  lon?: number;
  categories?: string[];
  place_id?: string;
  datasource?: {
    osm_id?: number | string;
    osm_type?: string;
    /** Places API nests the source record's own fields under `raw` */
    raw?: {
      osm_id?: number | string;
      osm_type?: string;
      [key: string]: unknown;
    };
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
    // features are the ones kept.
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

/**
 * The OSM object a place was built from, normalized across Geoapify's
 * response shapes: the Places API nests `osm_type`/`osm_id` inside
 * `datasource.raw` with single-letter values ("n"/"w"/"r"), while other
 * Geoapify surfaces have used top-level long forms and negative relation
 * ids. Returns the positive OSM id so links and geometry lookups work.
 */
function extractOsmRef(properties: GeoapifyPlaceProperties): { type: 'node' | 'way' | 'relation'; id: number } | null {
  const datasource = properties.datasource;
  if (!datasource) return null;

  for (const candidate of [datasource.raw, datasource]) {
    if (!candidate) continue;
    const value = candidate.osm_type?.trim().toLowerCase();
    const type = value === 'n' || value === 'node'
      ? 'node' as const
      : value === 'w' || value === 'way'
        ? 'way' as const
        : value === 'r' || value === 'relation'
          ? 'relation' as const
          : null;
    if (!type) continue;
    const id = Number(candidate.osm_id);
    if (!Number.isInteger(id) || id === 0) continue;
    return { type, id: Math.abs(id) };
  }

  return null;
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
  const osmRef = extractOsmRef(properties);

  return {
    id: properties.place_id ? `geoapify-${properties.place_id}` : `geoapify-${lat.toFixed(5)},${lon.toFixed(5)}`,
    name: properties.name,
    type,
    latitude: lat,
    longitude: lon,
    distance: calculateDistance(userLat, userLon, lat, lon),
    description: generateDescription(undefined, type),
    tags: leaf ? [leaf] : undefined,
    osmRelationId: osmRef?.type === 'relation' ? osmRef.id : undefined,
    osmWayId: osmRef?.type === 'way' ? osmRef.id : undefined,
  };
}

/**
 * Load nearby birding locations via three parallel Places requests (greens,
 * water, trails), sorted by distance and name-deduplicated. Parks and water
 * are the critical content of the list; a circle that genuinely contains
 * neither returns an empty list rather than an error, which the UI renders
 * as its "no locations found" state.
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
