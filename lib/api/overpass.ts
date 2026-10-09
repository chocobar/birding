import { Location } from '@/lib/types';
import { calculateDistance } from '@/lib/utils/distanceCalculator';
import { generateDescription } from '@/lib/api/geoapify';

/**
 * Overpass client, scoped to one job: discovering real trails. Named
 * walking-route relations (OSM route=hiking/foot/walking with lwn/rwn/nwn
 * network grades) are the curated, waymarked trails people actually set out
 * to walk — something no Geoapify Places category exposes (its highway.*
 * categories return raw path way segments, road connectors included).
 *
 * The Geoapify-only architecture removed this client because the public
 * Overpass instances intermittently 504 or hang under load. The reintroduction
 * is therefore deliberately narrow: ONE capped query (centre points only, no
 * member geometry), served behind the locations route's own trails cache, and
 * merged best-effort — an Overpass outage hides the trails but never fails
 * the list, whose parks and water still come from Geoapify.
 */

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

interface OverpassFetchOptions {
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
  tags?: {
    name?: string;
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
  } = options;

  const start = Date.now();
  let lastError: unknown;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    if (isEndpointBlocked(endpoint)) continue;

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
        // data: discarding it would not only throw away server work but also
        // trigger retries that re-queue equally slow queries behind a server
        // that just proved it cannot run them. Empty responses are still
        // failures — they would otherwise be cached as a genuine "nothing
        // mapped here" answer.
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
        lastError = error;

        if (isHang(error)) noteEndpointHang(endpoint);
        else noteEndpointHttpError(endpoint);

        if (error instanceof OverpassRateLimitError) {
          // The endpoint is alive but out of slots for us; wait out its
          // guidance if it fits the deadline, then try the next endpoint.
          const remainingAfter = deadlineMs - (Date.now() - start);
          const wait = error.retryAfterMs
            ? Math.min(error.retryAfterMs, remainingAfter)
            : Math.min(RETRY_DELAY_MS, remainingAfter);
          if (wait > 0) {
            await new Promise((resolve) => setTimeout(resolve, wait));
          }
          break;
        }

        // No retry follows (last attempt on this endpoint): move straight to
        // the next endpoint instead of sleeping into the deadline.
        if (attempt + 1 >= attemptsPerEndpoint) break;

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

// --- Trails (named walking-route relations) ---

/**
 * Relation `around` is the most expensive Overpass lookup (it resolves member
 * geometry to test containment), so the trails query runs on a capped radius
 * regardless of the user's search radius, prints centre points only (never
 * member geometry — the map modal fetches the full shape on demand via
 * Geoapify Place Details), and orders results by quadtile (`qt`) so the
 * in-query cap keeps spatially local routes rather than an arbitrary id slice.
 */
const MAX_TRAILS_RADIUS_METERS = 8047; // 5 miles
const QUERY_RESULT_CAP = 300;
/** Nearest trail relations kept after client-side distance sorting. */
const TRAIL_RELATIONS_LIMIT = 60;

// One attempt per endpoint: trails are enrichment, and burning two attempts
// per endpoint on a struggling server would hold the locations response
// hostage to a service the list does not depend on. The 7s per-attempt
// timeout covers the 6-7s a healthy-but-busy instance needs for the
// relations-around print; the leftover budget gives the fallback endpoint a
// short window.
const TRAIL_FETCH_OPTS = { timeoutMs: 7000, attemptsPerEndpoint: 1, deadlineMs: 9000 };

function buildTrailRelationsQuery(latitude: number, longitude: number, radiusMeters: number): string {
  const radius = Math.min(radiusMeters, MAX_TRAILS_RADIUS_METERS);
  const around = `around:${radius},${latitude},${longitude}`;
  return `
    [out:json][timeout:25];
    relation["type"="route"]["route"~"hiking|foot|walking"]["name"](${around});
    out center tags qt ${QUERY_RESULT_CAP};
  `;
}

/**
 * Parse Overpass route-relation elements into trail Locations, nearest first.
 * Relations arrive in quadtile order (not distance order), so the distance
 * sort decides which ones survive the cap.
 */
export function parseTrailRelations(
  elements: OverpassElement[],
  userLat: number,
  userLon: number
): Location[] {
  return elements
    .filter(
      (element) =>
        element.type === 'relation' &&
        !!element.tags?.name &&
        !!(element.center ?? (element.lat !== undefined && element.lon !== undefined))
    )
    .map((element): Location => {
      const lat = element.center?.lat ?? element.lat!;
      const lon = element.center?.lon ?? element.lon!;
      const tags = element.tags!;
      const network =
        tags.network === 'nwn' || tags.network === 'rwn' || tags.network === 'lwn'
          ? tags.network
          : undefined;

      const extracted: string[] = [];
      if (tags.route) extracted.push(tags.route);
      if (network) extracted.push(network);

      return {
        id: `osm-relation-${element.id}`,
        name: tags.name!,
        type: 'trail',
        latitude: lat,
        longitude: lon,
        distance: calculateDistance(userLat, userLon, lat, lon),
        description: generateDescription(tags, 'trail'),
        tags: extracted.length > 0 ? extracted : undefined,
        osmRelationId: element.id,
        network,
        surface: tags.surface || undefined,
        website: tags.website || undefined,
      };
    })
    .sort((a, b) => a.distance - b.distance)
    .slice(0, TRAIL_RELATIONS_LIMIT);
}

/**
 * Discover nearby real trails: named walking-route relations within the
 * radius. Throws on failure — callers treat trails as best-effort enrichment
 * and must not fail the list over it.
 */
export async function fetchTrailRelations(
  latitude: number,
  longitude: number,
  radiusMeters: number
): Promise<Location[]> {
  const data = await fetchOverpass(
    buildTrailRelationsQuery(latitude, longitude, radiusMeters),
    TRAIL_FETCH_OPTS
  );
  return parseTrailRelations(data.elements ?? [], latitude, longitude);
}
