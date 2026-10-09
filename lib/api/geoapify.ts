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
// - paths: named, publicly accessible path ways. highway.footway is
//   deliberately excluded: footways are urban pavements and passages, not
//   walking paths.
// Path ways are demoted below trail route relations and only surface when
// their OSM tags carry hiking signals (see isTrailLikePath) — plain
// highway=path includes countless short connector links between roads that
// are not trails anyone would set out to walk.
const GREENS_CATEGORIES = 'leisure.park,natural.forest,natural.heath_moor,natural.protected_area';
const WATER_CATEGORIES = 'natural.water,natural.wetland';
const PATH_CATEGORIES = 'highway.path';
// Server-side conditions for the path query: require a name (so unnamed
// segments stop consuming the result cap) and public access (excludes
// access=private/no and access_limited places).
const PATH_CONDITIONS = 'named,access';
const GREENS_LIMIT = 500;
const PATHS_LIMIT = 100;

/** Unpaved OSM surface values that mark a way as a walking surface rather
 * than an urban pavement. */
const UNPAVED_SURFACES = new Set([
  'grass', 'ground', 'dirt', 'earth', 'gravel', 'fine_gravel', 'compacted',
  'wood', 'woodchips', 'sand', 'mud', 'pebblestone', 'rock', 'unpaved',
]);

/**
 * Raw OSM tags of the place (Geoapify nests the source record's fields under
 * datasource.raw). Trail signals live there, not in the derived categories.
 */
function rawTag(raw: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = raw?.[key];
  return typeof value === 'string' ? value : undefined;
}

/**
 * Would a walker set out to walk this named path way? Connectors between
 * roads are named like trails but carry none of the tags mappers put on real
 * walking paths, so a way qualifies only when the raw OSM tags show hiking
 * intent: difficulty grading, waymarking, a designated right of way, formal
 * status, or an unpaved walking surface. Ways without usable raw tags
 * (a Geoapify response format change) are rejected — silently reverting to
 * connector spam would be the exact regression this filter exists to stop.
 */
export function isTrailLikePath(raw: Record<string, unknown> | undefined): boolean {
  if (!raw) return false;

  const access = rawTag(raw, 'access');
  if (access === 'private' || access === 'no') return false;
  const foot = rawTag(raw, 'foot');
  if (foot === 'private' || foot === 'no') return false;

  return (
    !!rawTag(raw, 'sac_scale') ||
    !!rawTag(raw, 'trail_visibility') ||
    !!rawTag(raw, 'designation') ||
    rawTag(raw, 'informal') === 'no' ||
    UNPAVED_SURFACES.has(rawTag(raw, 'surface') ?? '')
  );
}

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

export function generateDescription(
  tags: Record<string, string | undefined> | undefined,
  type: Location['type']
): string {
  const descriptions: Record<Location['type'], string> = {
    water: 'Natural water body - ideal for waterfowl and wetland bird species',
    woodland: 'Wooded area - great for woodland birds and wildlife',
    nature_reserve: 'Protected nature reserve with diverse habitats',
    park: 'Public park with green spaces and nature areas',
    trail: 'Named walking route made up of linked paths',
    path: 'Named path - a single walking path, possibly a link between roads',
  };

  let description = descriptions[type];

  if (!tags) return description;

  if (type === 'trail') {
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
  limit: number,
  conditions?: string
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
  if (conditions) params.set('conditions', conditions);

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

  // Path ways must show hiking intent in their raw OSM tags; without that
  // they are indistinguishable from road connectors (see isTrailLikePath).
  const raw = properties.datasource?.raw as Record<string, unknown> | undefined;
  if (type === 'path' && !isTrailLikePath(raw)) return null;

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
    description: generateDescription(
      type === 'path' ? (raw as Record<string, string | undefined> | undefined) : undefined,
      type
    ),
    tags: leaf ? [leaf] : undefined,
    osmRelationId: osmRef?.type === 'relation' ? osmRef.id : undefined,
    osmWayId: osmRef?.type === 'way' ? osmRef.id : undefined,
  };
}

/**
 * Load nearby area features (greens, water) plus named hiking-signal path
 * ways via three parallel Places requests, sorted by distance and
 * name-deduplicated. Parks and water are the critical content of the list —
 * their failure fails the whole load. The paths query is best-effort: it is
 * the experimental tail (conditions + raw-tag filtering), and losing it must
 * not blank the parks a birder came for. A circle that genuinely contains
 * nothing returns an empty list rather than an error, which the UI renders
 * as its "no locations found" state.
 *
 * Real trails (named walking-route relations) come from the Overpass client
 * (lib/api/overpass.ts) and are merged downstream.
 */
export async function fetchGeoapifyLocations(
  latitude: number,
  longitude: number,
  radiusMeters: number
): Promise<Location[]> {
  const apiKey = getGeoapifyApiKey();
  if (!apiKey) throw new Error('Geoapify API key is not configured');

  const [greensResult, waterResult, pathsResult] = await Promise.allSettled([
    fetchPlaces(apiKey, GREENS_CATEGORIES, latitude, longitude, radiusMeters, GREENS_LIMIT),
    fetchPlaces(apiKey, WATER_CATEGORIES, latitude, longitude, radiusMeters, GREENS_LIMIT),
    fetchPlaces(apiKey, PATH_CATEGORIES, latitude, longitude, radiusMeters, PATHS_LIMIT, PATH_CONDITIONS),
  ]);

  if (greensResult.status === 'rejected') throw greensResult.reason;
  if (waterResult.status === 'rejected') throw waterResult.reason;
  if (pathsResult.status === 'rejected') {
    console.warn('Geoapify path query failed; serving the list without paths:', pathsResult.reason);
  }

  const greens = greensResult.status === 'fulfilled' ? greensResult.value : [];
  const water = waterResult.status === 'fulfilled' ? waterResult.value : [];
  const paths = pathsResult.status === 'fulfilled' ? pathsResult.value : [];

  const locations = [
    ...greens.map((feature) => featureToLocation(feature, classifyGreenFeature(feature.properties?.categories ?? []), latitude, longitude)),
    ...water.map((feature) => featureToLocation(feature, 'water', latitude, longitude)),
    ...paths.map((feature) => featureToLocation(feature, 'path', latitude, longitude)),
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
