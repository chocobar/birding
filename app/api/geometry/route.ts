import { NextRequest } from 'next/server';
import { fetchOverpass, OverpassElement } from '@/lib/api/overpass';
import { getGeoapifyApiKey } from '@/lib/api/geoapify';

/**
 * On-demand line geometry for the map modal. The list endpoint deliberately
 * serves only centre points (`out center tags` keeps payloads small), so the
 * full shape of a line-like feature — a walking-route relation or a trail
 * way — is fetched when its map is opened, exactly like the relation flow
 * this route generalises.
 *
 * Both kinds prefer the Geoapify Place Details API when a key is configured
 * (it answers in ~1s without the public Overpass queueing) and fall back to
 * Overpass when Geoapify has no key, fails, or carries no line geometry for
 * the object. Overpass stays the last resort rather than the primary: the
 * public instances' queueing is what the Geoapify switch exists to avoid.
 */

// Same per-attempt window the client-side geometry fetch used before this
// route existed: under congestion the public instances have been observed
// answering single-object queries as slowly as ~20s.
const OVERPASS_OPTS = { timeoutMs: 30000, attemptsPerEndpoint: 2 };
const PLACE_DETAILS_TIMEOUT_MS = 10000;

const PLACE_DETAILS_ENDPOINT = 'https://api.geoapify.com/v2/place-details';

type GeometryKind = 'relation' | 'way';
type Point = [number, number]; // [lat, lng]

interface PlaceDetailsFeature {
  geometry?: {
    type?: string;
    /** GeoJSON positions are [lon, lat] pairs */
    coordinates?: unknown;
  };
}

function parseParams(request: NextRequest): { kind: GeometryKind; id: number } | { error: string } {
  const kind = request.nextUrl.searchParams.get('kind');
  const idStr = request.nextUrl.searchParams.get('id');

  if (kind !== 'relation' && kind !== 'way') {
    return { error: "kind must be 'relation' or 'way'" };
  }

  const id = Number(idStr);
  if (!idStr || !Number.isInteger(id) || id <= 0) {
    return { error: 'id must be a positive integer OSM id' };
  }

  return { kind, id };
}

/** GeoJSON geometry (LineString | MultiLineString | Polygon ring) → lat/lng pairs */
function geojsonToPoints(geometry: PlaceDetailsFeature['geometry']): Point[] | null {
  const coordinates = geometry?.coordinates;
  if (!Array.isArray(coordinates)) return null;

  let rings: unknown[] = [];
  switch (geometry?.type) {
    case 'LineString':
      rings = [coordinates];
      break;
    case 'MultiLineString':
    case 'Polygon':
      rings = coordinates;
      break;
    default:
      return null;
  }

  const points: Point[] = [];
  for (const ring of rings) {
    if (!Array.isArray(ring)) continue;
    for (const position of ring) {
      if (!Array.isArray(position) || position.length < 2) continue;
      const [lon, lat] = position as [number, number];
      if (typeof lat !== 'number' || typeof lon !== 'number') continue;
      points.push([lat, lon]);
    }
  }

  return points.length >= 2 ? points : null;
}

/**
 * Full geometry of an OSM relation or way via Geoapify Place Details.
 * Returns null when no key is configured, the lookup fails, or the place
 * carries no line geometry — all three fall back to Overpass.
 */
async function fetchGeometryFromGeoapify(kind: GeometryKind, osmId: number): Promise<Point[] | null> {
  const apiKey = getGeoapifyApiKey();
  if (!apiKey) return null;

  const params = new URLSearchParams({
    osm_type: kind === 'relation' ? 'r' : 'w',
    osm_id: String(osmId),
    features: 'details',
    apiKey,
  });

  try {
    const response = await fetch(`${PLACE_DETAILS_ENDPOINT}?${params.toString()}`, {
      signal: AbortSignal.timeout(PLACE_DETAILS_TIMEOUT_MS),
    });
    if (!response.ok) {
      console.warn(`Geoapify Place Details error for ${kind} ${osmId}: ${response.status}`);
      return null;
    }

    const data = (await response.json()) as { features?: PlaceDetailsFeature[] };
    for (const feature of data.features ?? []) {
      const points = geojsonToPoints(feature.geometry);
      if (points) return points;
    }
    return null;
  } catch (error) {
    console.warn(`Geoapify Place Details failed for ${kind} ${osmId}:`, error);
    return null;
  }
}

/** Member-way geometry of a route relation, flattened into one polyline. */
async function fetchRelationGeometryFromOverpass(relationId: number): Promise<Point[]> {
  const query = `[out:json][timeout:25];relation(${relationId});out geom;`;
  const data = await fetchOverpass(query, OVERPASS_OPTS);
  const relation = data.elements?.[0];

  if (!relation?.members) {
    throw new Error(`No geometry found for relation ${relationId}`);
  }

  const points: Point[] = [];
  for (const member of relation.members) {
    if (member.type !== 'way' || !member.geometry) continue;
    for (const point of member.geometry) {
      if (point) {
        points.push([point.lat, point.lon]);
      }
    }
  }

  if (points.length < 2) {
    throw new Error(`Route ${relationId} has no usable geometry`);
  }

  return points;
}

/** Node geometry of a single way. */
async function fetchWayGeometryFromOverpass(wayId: number): Promise<Point[]> {
  const query = `[out:json][timeout:25];way(${wayId});out geom;`;
  const data = await fetchOverpass(query, OVERPASS_OPTS);
  const way: OverpassElement | undefined = data.elements?.[0];

  const points: Point[] = [];
  for (const point of way?.geometry ?? []) {
    if (point) {
      points.push([point.lat, point.lon]);
    }
  }

  if (points.length < 2) {
    throw new Error(`Way ${wayId} has no usable geometry`);
  }

  return points;
}

export async function GET(request: NextRequest) {
  const parsed = parseParams(request);
  if ('error' in parsed) {
    return Response.json({ geometry: [], error: parsed.error }, { status: 400 });
  }

  try {
    let geometry: Point[] | null = await fetchGeometryFromGeoapify(parsed.kind, parsed.id);
    if (!geometry) {
      geometry = parsed.kind === 'relation'
        ? await fetchRelationGeometryFromOverpass(parsed.id)
        : await fetchWayGeometryFromOverpass(parsed.id);
    }
    return Response.json({ geometry });
  } catch (error) {
    console.error(`Failed to load ${parsed.kind} ${parsed.id} geometry:`, error);
    return Response.json(
      { geometry: [], error: 'Geometry data is temporarily unavailable' },
      { status: 502 }
    );
  }
}
