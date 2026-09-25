import { Location } from '@/lib/types';
import { calculateDistance } from '@/lib/utils/distanceCalculator';

export const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

// Overpass usage policy: identify the application
const OVERPASS_USER_AGENT = 'BirdingDiscovery/0.1.0 (https://github.com/chocobar/birding)';

export interface OverpassFetchOptions {
  /** Per-attempt timeout */
  timeoutMs?: number;
  /** Attempts per endpoint before moving to the next one */
  attemptsPerEndpoint?: number;
  /** Overall budget across all attempts and endpoints */
  deadlineMs?: number;
}

export interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: {
    lat: number;
    lon: number;
  };
  members?: Array<{
    type: string;
    ref: number;
    role?: string;
    geometry?: Array<{ lat: number; lon: number } | null>;
  }>;
  tags?: {
    name?: string;
    natural?: string;
    leisure?: string;
    landuse?: string;
    waterway?: string;
    highway?: string;
    [key: string]: string | undefined;
  };
}

export interface OverpassResponse {
  elements?: OverpassElement[];
  remark?: string;
}

const RETRY_DELAY_MS = 1500;

/**
 * Fetch an Overpass query, retrying across endpoints. The public Overpass
 * servers intermittently 504 or hang under load, so every attempt is bounded
 * by `timeoutMs` and the whole loop by `deadlineMs`, guaranteeing the caller
 * gets an answer (or an error) within a known time. When a query exceeds its
 * server-side timeout Overpass answers 200 with an empty element list plus a
 * `remark` instead of an error status; that must retry (and ultimately fail)
 * rather than return empty results that would get cached.
 */
export async function fetchOverpass(
  query: string,
  options: OverpassFetchOptions = {}
): Promise<OverpassResponse> {
  const {
    timeoutMs = 15000,
    attemptsPerEndpoint = 2,
    deadlineMs = Number.POSITIVE_INFINITY,
  } = options;

  const start = Date.now();
  let lastError: unknown;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    for (let attempt = 0; attempt < attemptsPerEndpoint; attempt++) {
      const remaining = deadlineMs - (Date.now() - start);
      if (remaining <= 0) {
        throw lastError instanceof Error
          ? lastError
          : new Error('Overpass API deadline exceeded');
      }

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': OVERPASS_USER_AGENT,
          },
          body: `data=${encodeURIComponent(query)}`,
          signal: AbortSignal.timeout(Math.min(timeoutMs, remaining)),
        });

        if (!response.ok) {
          throw new Error(`Overpass API error: ${response.status}`);
        }

        const data = (await response.json()) as OverpassResponse;

        if (data.remark?.includes('runtime error')) {
          throw new Error(`Overpass query failed: ${data.remark}`);
        }

        return data;
      } catch (error) {
        lastError = error;
        const remainingAfter = deadlineMs - (Date.now() - start);
        if (remainingAfter <= 0) break;
        await new Promise((resolve) =>
          setTimeout(resolve, Math.min(RETRY_DELAY_MS, remainingAfter))
        );
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Overpass API unavailable');
}

/**
 * One query per feature category. Overpass prints results in element-id
 * order, not distance order, and evaluates a union's statements sequentially
 * within a single request budget: a shared `out ... 80` cap lets high-volume
 * categories (small water bodies, river segments) fill it with
 * arbitrarily-picked elements and crowd nearer parks and woodlands out of the
 * results entirely, and one slow statement can time out a whole union.
 * Splitting gives each category its own budget and its own failure isolation
 * on the public servers.
 *
 * Category queries are uncapped so the nearest features always make it;
 * payloads stay small because every statement requires a name tag and
 * `out center tags` omits full geometry.
 */
export function buildGreensQuery(latitude: number, longitude: number, radiusMeters: number): string {
  const around = `around:${radiusMeters},${latitude},${longitude}`;
  return `
    [out:json][timeout:25];
    (
      node["leisure"="park"]["name"](${around});
      way["leisure"="park"]["name"](${around});
      node["natural"="wood"]["name"](${around});
      way["natural"="wood"]["name"](${around});
      way["landuse"="forest"]["name"](${around});
    );
    out center tags;
  `;
}

/**
 * Nature reserves sit in their own request: their statements are among the
 * slowest on the public Overpass instances under load, and their failure
 * should not take parks and woodlands down with them.
 */
export function buildNatureReservesQuery(latitude: number, longitude: number, radiusMeters: number): string {
  const around = `around:${radiusMeters},${latitude},${longitude}`;
  return `
    [out:json][timeout:25];
    (
      node["leisure"="nature_reserve"]["name"](${around});
      way["leisure"="nature_reserve"]["name"](${around});
    );
    out center tags;
  `;
}

export function buildWaterQuery(latitude: number, longitude: number, radiusMeters: number): string {
  const around = `around:${radiusMeters},${latitude},${longitude}`;
  return `
    [out:json][timeout:25];
    (
      node["natural"="water"]["name"](${around});
      way["natural"="water"]["name"](${around});
      way["waterway"~"river|stream|canal"]["name"](${around});
    );
    out center tags;
  `;
}

/**
 * Large green spaces are often mapped as multipolygon relations (commons,
 * heaths, country parks) which the node/way statements cannot match.
 * Relation `around` queries are slow on Overpass, so they run as their own
 * capped request instead of being folded into the other queries.
 */
export function buildGreenRelationsQuery(latitude: number, longitude: number, radiusMeters: number): string {
  const around = `around:${radiusMeters},${latitude},${longitude}`;
  return `
    [out:json][timeout:25];
    (
      relation["leisure"="park"]["name"](${around});
      relation["natural"="wood"]["name"](${around});
      relation["leisure"="nature_reserve"]["name"](${around});
      relation["natural"="water"]["name"](${around});
    );
    out center tags 60;
  `;
}

/**
 * Named path/footway ways fragment into thousands of tiny segments in urban
 * areas (6,000+ within 5 miles of central London), so they get a capped
 * budget of their own and are de-duplicated by name in parseOverpassElements.
 */
export function buildTrailsQuery(latitude: number, longitude: number, radiusMeters: number): string {
  const around = `around:${radiusMeters},${latitude},${longitude}`;
  return `
    [out:json][timeout:25];
    (
      way["highway"="path"]["name"](${around});
      way["highway"="footway"]["name"](${around});
    );
    out center tags 60;
  `;
}

/**
 * Build the best-effort query for named walking route relations.
 * `around` on relations is expensive on Overpass (it resolves member geometry)
 * and this query is the most likely to 504, so callers must treat it as optional.
 */
export function buildRoutesQuery(latitude: number, longitude: number, radiusMeters: number): string {
  return `
    [out:json][timeout:25];
    relation["type"="route"]["route"~"hiking|foot|walking"]["name"](around:${radiusMeters},${latitude},${longitude});
    out center tags 30;
  `;
}

/**
 * Parse Overpass elements into Location objects sorted by distance
 */
export function parseOverpassElements(
  elements: OverpassElement[],
  userLat: number,
  userLon: number
): Location[] {
  const locations = elements
    .filter((element) => element.tags?.name) // Only include named locations
    .map((element) => parseOverpassElement(element, userLat, userLon))
    .filter((loc): loc is Location => loc !== null)
    .sort((a, b) => a.distance - b.distance); // Sort by distance

  return dedupeByName(locations);
}

/**
 * Collapse features that share a name and type into their nearest instance.
 * Rivers, canals and named paths are mapped as many short way segments
 * sharing one name (40+ segments for a single canal); parks mapped both as a
 * way and a relation would otherwise appear twice. Locations must already be
 * sorted by distance so the nearest segment is kept.
 */
function dedupeByName(locations: Location[]): Location[] {
  const seen = new Map<string, Location>();

  for (const location of locations) {
    const key = `${location.type}:${location.name.toLowerCase()}`;
    if (!seen.has(key)) {
      seen.set(key, location);
    }
  }

  return Array.from(seen.values());
}

/**
 * Parse an Overpass element into a Location object
 */
function parseOverpassElement(
  element: OverpassElement,
  userLat: number,
  userLon: number
): Location | null {
  if (!element.tags?.name) return null;

  const lat = element.lat || element.center?.lat;
  const lon = element.lon || element.center?.lon;

  if (!lat || !lon) return null;

  const distance = calculateDistance(userLat, userLon, lat, lon);
  const type = determineLocationType(element.tags);
  const tags = element.tags;

  const network =
    tags?.network === 'nwn' || tags?.network === 'rwn' || tags?.network === 'lwn'
      ? tags.network
      : undefined;

  return {
    id: `osm-${element.type}-${element.id}`,
    name: tags!.name!,
    type,
    latitude: lat,
    longitude: lon,
    distance,
    description: generateDescription(tags, type),
    tags: extractTags(tags),
    osmRelationId: element.type === 'relation' ? element.id : undefined,
    network,
    surface: tags?.surface || undefined,
    website: tags?.website || undefined,
  };
}

/**
 * Determine location type from OSM tags
 */
function determineLocationType(tags: OverpassElement['tags']): Location['type'] {
  if (!tags) return 'park';

  if (tags.type === 'route' && tags.route) {
    return 'route';
  }

  if (tags.natural === 'water' || tags.waterway) {
    return 'water';
  }

  if (tags.natural === 'wood' || tags.landuse === 'forest') {
    return 'woodland';
  }

  if (tags.leisure === 'nature_reserve') {
    return 'nature_reserve';
  }

  if (tags.highway === 'path' || tags.highway === 'footway') {
    return 'trail';
  }

  if (tags.leisure === 'park') {
    return 'park';
  }

  return 'park';
}

/**
 * Generate a description based on location type and tags
 */
function generateDescription(tags: OverpassElement['tags'], type: Location['type']): string {
  if (!tags) return '';

  const descriptions: Record<Location['type'], string> = {
    water: 'Natural water body - ideal for waterfowl and wetland bird species',
    woodland: 'Wooded area - great for woodland birds and wildlife',
    nature_reserve: 'Protected nature reserve with diverse habitats',
    park: 'Public park with green spaces and nature areas',
    trail: 'Walking trail - good for bird watching on foot',
    route: 'Named walking route made up of linked paths',
  };

  let description = descriptions[type];

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

/**
 * Extract relevant tags from OSM data
 */
function extractTags(tags: OverpassElement['tags']): string[] {
  if (!tags) return [];

  const extracted: string[] = [];

  if (tags.natural) extracted.push(tags.natural);
  if (tags.leisure) extracted.push(tags.leisure);
  if (tags.landuse) extracted.push(tags.landuse);
  if (tags.waterway) extracted.push(tags.waterway);
  if (tags.route && tags.route !== 'road') extracted.push(tags.route);
  if (tags.network) extracted.push(tags.network);

  return extracted;
}
