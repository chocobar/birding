import { Location } from '@/lib/types';
import { calculateDistance } from '@/lib/utils/distanceCalculator';

const OVERPASS_API_BASE = 'https://overpass-api.de/api/interpreter';

interface OverpassElement {
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
  
  // Overpass query to find natural features and parks
  const query = `
    [out:json][timeout:25];
    (
      node["natural"="water"](around:${radiusMeters},${latitude},${longitude});
      way["natural"="water"](around:${radiusMeters},${latitude},${longitude});
      node["natural"="wood"](around:${radiusMeters},${latitude},${longitude});
      way["natural"="wood"](around:${radiusMeters},${latitude},${longitude});
      node["leisure"="nature_reserve"](around:${radiusMeters},${latitude},${longitude});
      way["leisure"="nature_reserve"](around:${radiusMeters},${latitude},${longitude});
      node["leisure"="park"](around:${radiusMeters},${latitude},${longitude});
      way["leisure"="park"](around:${radiusMeters},${latitude},${longitude});
      way["waterway"~"river|stream|canal"](around:${radiusMeters},${latitude},${longitude});
      way["highway"="path"]["name"](around:${radiusMeters},${latitude},${longitude});
      way["highway"="footway"]["name"](around:${radiusMeters},${latitude},${longitude});
    );
    out center tags 100;
  `;

  try {
    const response = await fetch(OVERPASS_API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!response.ok) {
      throw new Error(`Overpass API error: ${response.status}`);
    }

    const data: OverpassResponse = await response.json();

    const locations: Location[] = data.elements
      .filter(element => element.tags?.name) // Only include named locations
      .map(element => parseOverpassElement(element, latitude, longitude))
      .filter((loc): loc is Location => loc !== null)
      .sort((a, b) => a.distance - b.distance) // Sort by distance
      .slice(0, 10); // Limit to 10 results

    return locations;
  } catch (error) {
    console.error('Error fetching locations from Overpass API:', error);
    // Return mock data as fallback
    return getMockLocations(latitude, longitude);
  }
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

  return {
    id: `osm-${element.type}-${element.id}`,
    name: element.tags.name,
    type,
    latitude: lat,
    longitude: lon,
    distance,
    description: generateDescription(element.tags, type),
    tags: extractTags(element.tags),
  };
}

/**
 * Determine location type from OSM tags
 */
function determineLocationType(tags: OverpassElement['tags']): Location['type'] {
  if (!tags) return 'park';

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
  };

  let description = descriptions[type];

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

  return extracted;
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
  ];
}