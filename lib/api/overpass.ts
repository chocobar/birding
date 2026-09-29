import { Location } from '@/lib/types';
import { calculateDistance } from '@/lib/utils/distanceCalculator';

/**
 * Query endpoints, tried in order. OVERPASS_ENDPOINTS (comma-separated full
 * interpreter URLs) overrides the defaults, e.g. to point at a private
 * instance; anything configured always takes priority and the public
 * instances stay listed as fallbacks so an outage on either side degrades
 * to the other.
 */
const DEFAULT_OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

function loadOverpassEndpoints(): string[] {
  const configured = (process.env.OVERPASS_ENDPOINTS ?? '')
    .split(',')
    .map((url) => url.trim())
    .filter((url) => /^https?:\/\//.test(url));
  if (configured.length === 0) return DEFAULT_OVERPASS_ENDPOINTS;
  return [...new Set([...configured, ...DEFAULT_OVERPASS_ENDPOINTS])];
}

export const OVERPASS_ENDPOINTS = loadOverpassEndpoints();

// Overpass usage policy: identify the application
const OVERPASS_USER_AGENT = 'BirdingDiscovery/0.1.0 (https://github.com/chocobar/birding)';

export interface OverpassFetchOptions {
  /** Per-attempt timeout */
  timeoutMs?: number;
  /** Attempts per endpoint before moving to the next one */
  attemptsPerEndpoint?: number;
  /** Overall budget across all attempts and endpoints */
  deadlineMs?: number;
  /** Cooperative cancellation: stops retrying and in-flight attempts immediately */
  signal?: AbortSignal;
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
  osm3s?: {
    timestamp_osm_base?: string;
    [key: string]: unknown;
  };
}

/**
 * A healthy Overpass instance reports the snapshot date of its OSM data.
 * Responses without a plausible one come from broken or stub datasets, whose
 * empty element lists would otherwise be indistinguishable from a genuine
 * "nothing mapped here" answer and get cached as such.
 */
const MAX_DATA_SNAPSHOT_AGE_MS = 45 * 24 * 60 * 60 * 1000;

function isHealthyOverpassResponse(data: OverpassResponse): boolean {
  const timestamp = data.osm3s?.timestamp_osm_base;
  if (!timestamp || !/^\d{4}-\d{2}-\d{2}T/.test(timestamp)) return false;
  const snapshot = Date.parse(timestamp);
  if (Number.isNaN(snapshot)) return false;
  return Date.now() - snapshot <= MAX_DATA_SNAPSHOT_AGE_MS;
}

const RETRY_DELAY_MS = 1500;
const MAX_RETRY_DELAY_MS = 6000;

/**
 * Circuit breaker for the public mirrors. A mirror that accepts connections
 * but never answers (as overpass.kumi.systems has done for extended periods)
 * costs every failed query its full per-attempt timeout, stretching one user
 * request across the whole deadline. Endpoints are skipped for a cooldown
 * after repeated zero-response attempts; HTTP status errors prove the
 * endpoint is alive and do not count towards the threshold.
 */
const BREAKER_HANG_THRESHOLD = 2;
const BREAKER_COOLDOWN_MS = 5 * 60 * 1000;

interface EndpointHealth {
  consecutiveHangs: number;
  blockedUntil: number;
}

const endpointHealth = new Map<string, EndpointHealth>();

function isEndpointBlocked(endpoint: string): boolean {
  const health = endpointHealth.get(endpoint);
  return !!health && health.blockedUntil > Date.now();
}

function noteEndpointSuccess(endpoint: string): void {
  endpointHealth.delete(endpoint);
}

function noteEndpointHttpError(endpoint: string): void {
  const health = endpointHealth.get(endpoint);
  if (health) health.consecutiveHangs = 0;
}

function noteEndpointHang(endpoint: string): void {
  const health = endpointHealth.get(endpoint) ?? { consecutiveHangs: 0, blockedUntil: 0 };
  health.consecutiveHangs += 1;
  if (health.consecutiveHangs >= BREAKER_HANG_THRESHOLD) {
    health.blockedUntil = Date.now() + BREAKER_COOLDOWN_MS;
  }
  endpointHealth.set(endpoint, health);
}

/** A timeout or connection-level failure means the endpoint never answered. */
function isHang(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'TimeoutError' || error.name === 'TypeError' || error.name === 'AbortError')
  );
}

/** 429-style rejection carrying the server's own retry guidance. */
class OverpassRateLimitError extends Error {
  constructor(
    readonly status: number,
    readonly retryAfterMs: number | undefined
  ) {
    super(`Overpass API rate limited: ${status}`);
  }
}

function parseRetryAfter(headerValue: string | null): number | undefined {
  if (!headerValue) return undefined;
  const seconds = Number.parseInt(headerValue, 10);
  if (Number.isNaN(seconds) || seconds <= 0) return undefined;
  return seconds * 1000;
}

function abortError(): Error {
  return new DOMException('Aborted', 'AbortError');
}

/**
 * Fetch an Overpass query, retrying across endpoints. The public Overpass
 * servers intermittently 504 or hang under load, so every attempt is bounded
 * by `timeoutMs` and the whole loop by `deadlineMs`, guaranteeing the caller
 * gets an answer (or an error) within a known time. Retries back off
 * exponentially, and rate-limit responses wait out the server's `Retry-After`
 * before moving to the next endpoint. Endpoints that repeatedly hang without
 * responding are skipped for a cooldown (see the circuit breaker). When a
 * query exceeds its server-side timeout Overpass answers 200 with an empty
 * element list plus a `remark` instead of an error status; that must retry
 * (and ultimately fail) rather than return empty results that would get
 * cached.
 */
export async function fetchOverpass(
  query: string,
  options: OverpassFetchOptions = {}
): Promise<OverpassResponse> {
  const {
    timeoutMs = 15000,
    attemptsPerEndpoint = 2,
    deadlineMs = Number.POSITIVE_INFINITY,
    signal,
  } = options;

  if (signal?.aborted) throw abortError();

  const start = Date.now();
  let lastError: unknown;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    if (isEndpointBlocked(endpoint)) continue;

    for (let attempt = 0; attempt < attemptsPerEndpoint; attempt++) {
      if (signal?.aborted) throw abortError();

      const remaining = deadlineMs - (Date.now() - start);
      if (remaining <= 0) {
        throw lastError instanceof Error
          ? lastError
          : new Error('Overpass API deadline exceeded');
      }

      try {
        const attemptSignal = AbortSignal.any([
          AbortSignal.timeout(Math.min(timeoutMs, remaining)),
          ...(signal ? [signal] : []),
        ]);

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': OVERPASS_USER_AGENT,
          },
          body: `data=${encodeURIComponent(query)}`,
          signal: attemptSignal,
        });

        if (!response.ok) {
          if (response.status === 429 || response.status === 503) {
            throw new OverpassRateLimitError(
              response.status,
              parseRetryAfter(response.headers.get('retry-after'))
            );
          }
          throw new Error(`Overpass API error: ${response.status}`);
        }

        const data = (await response.json()) as OverpassResponse;

        // A server-side timeout arrives as a 200 with a `remark` rather than
        // an error status. Overpass prints every statement that completed
        // before the timeout, so a non-empty element list is usable partial
        // data: discarding it would not only throw away 25-30s of server
        // work but also trigger retries that re-queue equally slow queries
        // behind a server that just proved it cannot run them. Empty
        // responses are still failures — they would otherwise be cached as a
        // genuine "nothing mapped here" answer.
        if (data.remark?.includes('runtime error')) {
          if ((data.elements?.length ?? 0) > 0) {
            console.warn(`Overpass returned partial results (server-side timeout): ${data.remark}`);
            noteEndpointSuccess(endpoint);
            return data;
          }
          throw new Error(`Overpass query failed: ${data.remark}`);
        }

        if (!isHealthyOverpassResponse(data)) {
          throw new Error('Overpass endpoint returned a response without a valid data snapshot timestamp');
        }

        noteEndpointSuccess(endpoint);
        return data;
      } catch (error) {
        // Cancellation is not an endpoint failure: stop immediately and do
        // not let it trigger the circuit breaker.
        if (signal?.aborted) {
          throw error instanceof Error && error.name === 'AbortError'
            ? error
            : abortError();
        }

        lastError = error;

        if (isHang(error)) noteEndpointHang(endpoint);
        else noteEndpointHttpError(endpoint);

        if (error instanceof OverpassRateLimitError) {
          // The endpoint is alive but out of slots for us; wait out its
          // guidance if it fits the deadline, then try the next one.
          const remainingAfter = deadlineMs - (Date.now() - start);
          const wait = error.retryAfterMs
            ? Math.min(error.retryAfterMs, remainingAfter)
            : Math.min(RETRY_DELAY_MS, remainingAfter);
          if (wait > 0) {
            await new Promise((resolve) => setTimeout(resolve, wait));
          }
          break;
        }

        const remainingAfter = deadlineMs - (Date.now() - start);
        if (remainingAfter <= 0) break;

        const backoff = Math.min(
          RETRY_DELAY_MS * 2 ** attempt,
          MAX_RETRY_DELAY_MS,
          remainingAfter
        );
        await new Promise((resolve) => setTimeout(resolve, backoff));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Overpass API unavailable');
}

/**
 * Greens and water stay in separate requests because they are the critical
 * content of the list. Overpass prints results in element-id order, not
 * distance order, and a shared `out ... N` cap would let high-volume
 * categories fill it with arbitrarily-picked elements, crowding nearer
 * parks and woodlands out of the results entirely — so the critical queries
 * are uncapped and carry no statement that can be slow enough to time the
 * whole request out. Slower or purely decorative categories are consolidated
 * into fewer, capped requests (see buildReservesAndTrailsQuery and
 * buildRelationsQuery) to limit the number of round trips through the
 * congested public servers; their caps are safe because each prints through
 * its own `out` statement.
 *
 * The critical queries are uncapped so the nearest features always make it;
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
 * Nature reserves and named paths share one request: both are decorative
 * categories whose failure must not delay the list. Reserves are a cheap
 * scan (few matches at any radius) and print first; named path/footway ways
 * fragment into thousands of tiny segments in urban areas (6,000+ within
 * 5 miles of central London) so they are capped and de-duplicated by name
 * in parseOverpassElements. If the trails statement times out, the reserve
 * block still arrives as a partial result, which fetchOverpass accepts.
 */
export function buildReservesAndTrailsQuery(latitude: number, longitude: number, radiusMeters: number): string {
  const around = `around:${radiusMeters},${latitude},${longitude}`;
  return `
    [out:json][timeout:25];
    (
      node["leisure"="nature_reserve"]["name"](${around});
      way["leisure"="nature_reserve"]["name"](${around});
    );
    out center tags 200;
    (
      way["highway"="path"]["name"](${around});
      way["highway"="footway"]["name"](${around});
    );
    out center tags 100;
  `;
}

/**
 * All relation queries share one request. Relation `around` is the most
 * expensive kind of Overpass lookup (it resolves member geometry), so these
 * are the queries most likely to time out or 504 on the public instances;
 * they are best-effort, grace-raced by the caller, and capped. Large green
 * spaces are often mapped as multipolygon relations (commons, heaths,
 * country parks) which the node/way statements cannot match, and named
 * walking routes are pure decoration. If the route statement times out, the
 * green-space block still arrives as a partial result, which fetchOverpass
 * accepts.
 */
export function buildRelationsQuery(latitude: number, longitude: number, radiusMeters: number): string {
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
    relation["type"="route"]["route"~"hiking|foot|walking"]["name"](${around});
    out center tags 30;
  `;
}

export function buildWaterQuery(latitude: number, longitude: number, radiusMeters: number): string {
  const around = `around:${radiusMeters},${latitude},${longitude}`;
  // Exact key=value statements instead of a waterway value regex: Overpass
  // answers each from its (key,value) index directly, whereas a regex has to
  // fetch every waterway=* element in the radius before filtering — enough
  // extra work to push the query past the public servers' timeout under load.
  return `
    [out:json][timeout:25];
    (
      node["natural"="water"]["name"](${around});
      way["natural"="water"]["name"](${around});
      way["waterway"="river"]["name"](${around});
      way["waterway"="stream"]["name"](${around});
      way["waterway"="canal"]["name"](${around});
    );
    out center tags;
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
