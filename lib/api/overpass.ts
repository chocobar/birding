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

interface OverpassElement {
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
}

const RETRY_DELAY_MS = 1500;

/**
 * Fetch an Overpass query, retrying across endpoints. The public Overpass
 * servers intermittently 504 or hang under load, so every attempt is bounded
 * by `timeoutMs` and the whole loop by `deadlineMs`, guaranteeing the caller
 * gets an answer (or an error) within a known time.
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

        return (await response.json()) as OverpassResponse;
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
 * Build the query for parks, water, woodland, reserves, waterways and named paths.
 * A single combined query including route relations reliably 504s on Overpass,
 * while each query alone is fast. Separate `out` budgets also stop dense urban
 * path/footway ways from crowding named routes out of the results.
 */
export function buildElementsQuery(latitude: number, longitude: number, radiusMeters: number): string {
  const around = `around:${radiusMeters},${latitude},${longitude}`;
  return `
    [out:json][timeout:25];
    (
      node["natural"="water"](${around});
      way["natural"="water"](${around});
      node["natural"="wood"](${around});
      way["natural"="wood"](${around});
      node["leisure"="nature_reserve"](${around});
      way["leisure"="nature_reserve"](${around});
      node["leisure"="park"](${around});
      way["leisure"="park"](${around});
      way["waterway"~"river|stream|canal"](${around});
      way["highway"="path"]["name"](${around});
      way["highway"="footway"]["name"](${around});
    );
    out center tags 80;
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
  return elements
    .filter((element) => element.tags?.name) // Only include named locations
    .map((element) => parseOverpassElement(element, userLat, userLon))
    .filter((loc): loc is Location => loc !== null)
    .sort((a, b) => a.distance - b.distance); // Sort by distance
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
  if (tags.waterway) extracted.push(tags.waterway);
  if (tags.route && tags.route !== 'road') extracted.push(tags.route);
  if (tags.network) extracted.push(tags.network);

  return extracted;
}
