export interface Location {
  id: string;
  name: string;
  type: 'water' | 'woodland' | 'park' | 'nature_reserve' | 'trail';
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
}