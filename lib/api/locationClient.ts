import { Location } from '@/lib/types';
import { calculateDistance } from '@/lib/utils/distanceCalculator';

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

const OVERPASS_REQUEST_TIMEOUT_MS = 30000;

/**
 * Fetch an Overpass query, retrying across endpoints (and twice per endpoint).
 * The public Overpass server intermittently 504s or hangs under load, and
 * when a query exceeds its server-side timeout it answers 200 with an empty
 * element list plus a `remark` instead of an error status — both cases must
 * retry (and ultimately fall back) rather than render as "no results".
 */
async function fetchOverpass(query: string): Promise<OverpassResponse> {
  let lastError: unknown;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: `data=${encodeURIComponent(query)}`,
          signal: AbortSignal.timeout(OVERPASS_REQUEST_TIMEOUT_MS),
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
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Overpass API unavailable');
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

interface OverpassResponse {
  elements: OverpassElement[];
  remark?: string;
}

/**
 * Fetch nearby locations from OpenStreetMap
 */
export async function getNearbyLocations(
  latitude: number,
  longitude: number,
  radiusMiles: number = 5
): Promise<Location[]> {
  const radiusMeters = radiusMiles * 1609.34; // Convert miles to meters
  const around = `around:${radiusMeters},${latitude},${longitude}`;

  // One query per category, each with its own output budget and its own
  // retry/failure isolation. Overpass prints results in element-id order, not
  // distance order, and evaluates a union's statements sequentially within a
  // single request budget: a shared `out ... 80` cap lets high-volume
  // categories (small water bodies, river segments) crowd nearer parks and
  // woodlands out of the results entirely, and one slow statement can time
  // out a whole union. Splitting means a degraded Overpass can only ever
  // lose one category instead of silently distorting all of them.
  //
  // Category queries are uncapped so the nearest features always make it;
  // payloads stay small because every statement requires a name tag and
  // `out center tags` omits full geometry.
  const greensQuery = `
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

  // Nature reserves sit in their own request: their statements are among the
  // slowest on the public Overpass instances under load, and their failure
  // should not take parks and woodlands down with them.
  const natureReservesQuery = `
    [out:json][timeout:25];
    (
      node["leisure"="nature_reserve"]["name"](${around});
      way["leisure"="nature_reserve"]["name"](${around});
    );
    out center tags;
  `;

  const waterQuery = `
    [out:json][timeout:25];
    (
      node["natural"="water"]["name"](${around});
      way["natural"="water"]["name"](${around});
      way["waterway"~"river|stream|canal"]["name"](${around});
    );
    out center tags;
  `;

  // Large green spaces are often mapped as multipolygon relations (commons,
  // heaths, country parks) which the node/way statements above cannot match.
  // Relation `around` queries are slow on Overpass, so they run as their own
  // request instead of being folded into the other queries.
  const greenRelationsQuery = `
    [out:json][timeout:25];
    (
      relation["leisure"="park"]["name"](${around});
      relation["natural"="wood"]["name"](${around});
      relation["leisure"="nature_reserve"]["name"](${around});
      relation["natural"="water"]["name"](${around});
    );
    out center tags 60;
  `;

  // Named path/footway ways fragment into thousands of tiny segments in urban
  // areas (6,000+ within 5 miles of central London), so they get a capped
  // budget of their own and are de-duplicated by name client-side.
  const trailsQuery = `
    [out:json][timeout:25];
    (
      way["highway"="path"]["name"](${around});
      way["highway"="footway"]["name"](${around});
    );
    out center tags 60;
  `;

  const routesQuery = `
    [out:json][timeout:25];
    relation["type"="route"]["route"~"hiking|foot|walking"]["name"](${around});
    out center tags 30;
  `;

  const fetchElements = async (query: string): Promise<OverpassElement[]> => {
    const data = await fetchOverpass(query);
    return data.elements ?? [];
  };

  const queries = [
    { label: 'greens', query: greensQuery },
    { label: 'nature reserves', query: natureReservesQuery },
    { label: 'water', query: waterQuery },
    { label: 'green space relations', query: greenRelationsQuery },
    { label: 'trails', query: trailsQuery },
    { label: 'walking routes', query: routesQuery },
  ];

  const settled = await Promise.allSettled(queries.map(({ query }) => fetchElements(query)));

  const failures = settled.filter((result) => result.status === 'rejected');
  if (failures.length === settled.length) {
    console.error('Error fetching locations from Overpass API:', failures[0].reason);
    // Return mock data as fallback
    return getMockLocations(latitude, longitude);
  }

  settled.forEach((result, index) => {
    if (result.status === 'rejected') {
      console.error(`Error fetching ${queries[index].label} from Overpass API:`, result.reason);
    }
  });

  const elements: OverpassElement[] = settled.flatMap((result) =>
    result.status === 'fulfilled' ? result.value : []
  );

  const locations: Location[] = elements
    .filter(element => element.tags?.name) // Only include named locations
    .map(element => parseOverpassElement(element, latitude, longitude))
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

/**
 * Fetch the full geometry (polyline points) of a walking route relation.
 * Used on demand when a route's map is opened; points are ordered lat/lng pairs.
 */
export async function getRouteGeometry(relationId: number): Promise<[number, number][]> {
  const query = `[out:json][timeout:25];relation(${relationId});out geom;`;

  const data = await fetchOverpass(query);
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