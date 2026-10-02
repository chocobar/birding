import { NextRequest } from 'next/server';
import { getGeoapifyApiKey } from '@/lib/api/geoapify';

/**
 * On-demand line geometry for the map modal. The list endpoint deliberately
 * serves only centre points (keeps payloads small), so the full shape of a
 * line-like feature — a walking-route relation or a trail way — is fetched
 * when its map is opened, via the Geoapify Place Details API.
 */

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
 * carries no line geometry.
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

export async function GET(request: NextRequest) {
  const parsed = parseParams(request);
  if ('error' in parsed) {
    return Response.json({ geometry: [], error: parsed.error }, { status: 400 });
  }

  const geometry = await fetchGeometryFromGeoapify(parsed.kind, parsed.id);
  if (!geometry) {
    return Response.json(
      { geometry: [], error: 'Geometry data is temporarily unavailable' },
      { status: 502 }
    );
  }

  return Response.json({ geometry });
}
