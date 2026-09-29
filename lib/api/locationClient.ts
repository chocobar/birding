import { Location } from '@/lib/types';
import { fetchOverpass } from '@/lib/api/overpass';

const LOCATIONS_API_BASE = '/api/locations';

/**
 * Fetch nearby locations for a geocoded position via the server-side proxy
 * (/api/locations), which caches results and bounds Overpass latency.
 * Throws on failure so the UI can show an error state: fabricated "nearby"
 * places are worse than no results.
 */
export async function getNearbyLocations(
  latitude: number,
  longitude: number,
  radiusMiles: number = 5
): Promise<Location[]> {
  const params = new URLSearchParams({
    lat: latitude.toString(),
    lng: longitude.toString(),
    radius: radiusMiles.toString(),
  });

  let response: Response;
  try {
    response = await fetch(`${LOCATIONS_API_BASE}?${params.toString()}`);
  } catch (error) {
    console.error('Error fetching locations from /api/locations:', error);
    throw new Error('Could not load nearby locations. Please check your connection and try again.');
  }

  if (!response.ok) {
    console.error(`/api/locations returned ${response.status}`);
    throw new Error('Nearby location data is temporarily unavailable. Please try again shortly.');
  }

  const data = await response.json();

  // Server could not reach Overpass — surface the failure rather than faking results
  if (!data.isLiveData || !Array.isArray(data.locations)) {
    throw new Error('Nearby location data is temporarily unavailable. Please try again shortly.');
  }

  return data.locations as Location[];
}

/**
 * Fetch the full geometry (polyline points) of a walking route relation.
 * Used on demand when a route's map is opened; points are ordered lat/lng pairs.
 */
export async function getRouteGeometry(relationId: number): Promise<[number, number][]> {
  const query = `[out:json][timeout:25];relation(${relationId});out geom;`;

  const data = await fetchOverpass(query, { timeoutMs: 30000, attemptsPerEndpoint: 2 });
  const relation = data.elements?.[0];

  if (!relation?.members) {
    throw new Error(`No geometry found for relation ${relationId}`);
  }

  const points: [number, number][] = [];
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
