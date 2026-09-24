export interface Location {
  id: string;
  name: string;
  type: 'water' | 'woodland' | 'park' | 'nature_reserve' | 'trail' | 'route';
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
  osmRelationId?: number; // Overpass relation id, used for on-demand geometry fetch
  routeGeometry?: [number, number][]; // lat/lng pairs, populated on demand when the map opens
  lengthKm?: number; // Calculated from geometry once fetched
  network?: 'nwn' | 'rwn' | 'lwn'; // OSM walking network: national / regional / local
  surface?: string; // e.g. "paved", "gravel", "dirt"
  website?: string; // Official route website from OSM tags
}