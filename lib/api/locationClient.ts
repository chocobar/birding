import { Location, LocationDataSource } from '@/lib/types';

const LOCATIONS_API_BASE = '/api/locations';

export interface NearbyLocationsResult {
  locations: Location[];
  /** Which upstream served the results — drives the Geoapify attribution */
  source: LocationDataSource;
}

/**
 * Fetch nearby locations for a geocoded position via the server-side proxy
 * (/api/locations), which caches results and bounds upstream latency.
 * Throws on failure so the UI can show an error state: fabricated "nearby"
 * places are worse than no results.
 */
export async function getNearbyLocations(
  latitude: number,
  longitude: number,
  radiusMiles: number = 5
): Promise<NearbyLocationsResult> {
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

  // Server could not reach the location service — surface the failure rather than faking results
  if (!data.isLiveData || !Array.isArray(data.locations)) {
    throw new Error('Nearby location data is temporarily unavailable. Please try again shortly.');
  }

  return {
    locations: data.locations as Location[],
    source: data.source === 'geoapify' ? 'geoapify' : 'osm',
  };
}

/**
 * Fetch the full geometry (polyline points) of a line-like OSM feature — a
 * walking-route relation or a trail way. Served by the server-side proxy
 * (/api/geometry), which proxies the Geoapify Place Details API and
 * hides the API key from the browser. Points are ordered lat/lng pairs.
 */
export async function getOsmLineGeometry(
  kind: 'relation' | 'way',
  id: number
): Promise<[number, number][]> {
  const params = new URLSearchParams({ kind, id: String(id) });

  let response: Response;
  try {
    response = await fetch(`/api/geometry?${params.toString()}`);
  } catch (error) {
    console.error(`Error fetching ${kind} ${id} geometry from /api/geometry:`, error);
    throw new Error('Could not load the map geometry. Please check your connection and try again.');
  }

  if (!response.ok) {
    console.error(`/api/geometry returned ${response.status} for ${kind} ${id}`);
    throw new Error('Map geometry is temporarily unavailable.');
  }

  const data = await response.json();
  if (!Array.isArray(data.geometry) || data.geometry.length < 2) {
    throw new Error(`No usable geometry for ${kind} ${id}`);
  }

  return data.geometry as [number, number][];
}
