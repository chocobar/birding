import { Location } from '@/lib/types';
import { fetchOverpass } from '@/lib/api/overpass';

const LOCATIONS_API_BASE = '/api/locations';

/**
 * Fetch nearby locations for a geocoded position via the server-side proxy
 * (/api/locations), which caches results and bounds Overpass latency.
 * Falls back to mock data if the API is unavailable.
 */
export async function getNearbyLocations(
  latitude: number,
  longitude: number,
  radiusMiles: number = 5
): Promise<Location[]> {
  try {
    const params = new URLSearchParams({
      lat: latitude.toString(),
      lng: longitude.toString(),
      radius: radiusMiles.toString(),
    });

    const response = await fetch(`${LOCATIONS_API_BASE}?${params.toString()}`);

    if (!response.ok) {
      console.error(`/api/locations returned ${response.status}`);
      return getMockLocations(latitude, longitude);
    }

    const data = await response.json();

    // Server couldn't reach Overpass — use mock data
    if (!data.isLiveData || !Array.isArray(data.locations)) {
      return getMockLocations(latitude, longitude);
    }

    return data.locations as Location[];
  } catch (error) {
    console.error('Error fetching locations from /api/locations:', error);
    return getMockLocations(latitude, longitude);
  }
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

/**
 * Mock locations as fallback when API is unavailable
 */
function getMockLocations(latitude: number, longitude: number): Location[] {
  return [
    {
      id: 'mock-1',
      name: 'Local Nature Reserve',
      type: 'nature_reserve',
      latitude: latitude + 0.01,
      longitude: longitude + 0.01,
      distance: 1.2,
      description: 'Protected nature reserve with diverse habitats',
      tags: ['nature_reserve'],
    },
    {
      id: 'mock-2',
      name: 'River Walk',
      type: 'water',
      latitude: latitude + 0.02,
      longitude: longitude - 0.01,
      distance: 1.8,
      description: 'Natural water body - ideal for waterfowl and wetland bird species',
      tags: ['river', 'water'],
    },
    {
      id: 'mock-3',
      name: 'Community Woodland',
      type: 'woodland',
      latitude: latitude - 0.01,
      longitude: longitude + 0.02,
      distance: 2.3,
      description: 'Wooded area - great for woodland birds and wildlife',
      tags: ['woodland', 'forest'],
    },
    {
      id: 'mock-4',
      name: 'City Park',
      type: 'park',
      latitude: latitude + 0.015,
      longitude: longitude + 0.015,
      distance: 1.5,
      description: 'Public park with green spaces and nature areas',
      tags: ['park'],
    },
    {
      id: 'mock-5',
      name: 'Woodland Trail',
      type: 'trail',
      latitude: latitude - 0.02,
      longitude: longitude - 0.02,
      distance: 3.1,
      description: 'Walking trail - good for bird watching on foot',
      tags: ['footway', 'trail'],
    },
    {
      id: 'mock-6',
      name: 'Riverside Circular Walk',
      type: 'route',
      latitude: latitude + 0.005,
      longitude: longitude - 0.005,
      distance: 2.7,
      description: 'Local waymarked walk - often a circular route',
      tags: ['hiking', 'lwn'],
      osmRelationId: 5223120,
      network: 'lwn',
    },
  ];
}
