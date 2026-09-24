import { GeocodedLocation } from '@/lib/types';

const GEOCODE_API_BASE = '/api/geocode';

/**
 * Search for locations by free-text query (city, region, postcode, etc.).
 * Returns a list of geocoded suggestions for the autocomplete dropdown.
 */
export async function searchLocations(
  query: string
): Promise<GeocodedLocation[]> {
  const params = new URLSearchParams({ q: query });

  const response = await fetch(`${GEOCODE_API_BASE}?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`Geocoding search failed: ${response.status}`);
  }

  const data = await response.json();
  return Array.isArray(data.results) ? data.results : [];
}

/**
 * Reverse geocode coordinates into a human-readable place name.
 * Returns null if no name could be resolved.
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      lat: latitude.toString(),
      lng: longitude.toString(),
    });

    const response = await fetch(`${GEOCODE_API_BASE}?${params.toString()}`);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return typeof data.displayName === 'string' ? data.displayName : null;
  } catch (error) {
    console.error('Error reverse geocoding:', error);
    return null;
  }
}
