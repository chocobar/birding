/** Which upstream service served a set of location data (for attribution). */
export type LocationDataSource = 'geoapify' | 'osm';

/**
 * Location kinds shown in the list:
 * - trail: a named walking-route relation (an OSM hiking/foot route) — a real,
 *   waymarked trail made up of many linked paths
 * - path: a single named OSM path way that carries hiking signals
 * - everything else: area features
 */
export interface Location {
  id: string;
  name: string;
  type: 'water' | 'woodland' | 'park' | 'nature_reserve' | 'trail' | 'path';
  latitude: number;
  longitude: number;
  distance: number; // Distance from the searched location in miles
  description?: string;
  amenities?: {
    parking?: boolean;
    accessible?: boolean;
    facilities?: string[];
  };
  tags?: string[];
  osmRelationId?: number; // OSM relation id, used for on-demand trail geometry fetch
  osmWayId?: number; // OSM way id, used for on-demand line geometry (paths) fetch
  routeGeometry?: [number, number][]; // lat/lng pairs, populated on demand when the map opens
  lengthKm?: number; // Calculated from geometry once fetched
  network?: 'nwn' | 'rwn' | 'lwn'; // OSM walking network: national / regional / local
  surface?: string; // e.g. "paved", "gravel", "dirt"
  website?: string; // Official route website from OSM tags
}