export interface Bird {
  id: string;
  commonName: string;
  scientificName: string;
  imageUrl?: string;
  description?: string;
  frequency?: number; // Observation frequency (0-1)
  conservationStatus?: 'LC' | 'NT' | 'VU' | 'EN' | 'CR' | 'EW' | 'EX';
  season?: 'year-round' | 'summer' | 'winter' | 'passage';
  locationName?: string; // eBird: where the bird was observed
  observationDate?: string; // eBird: when the bird was observed
  latitude?: number;
  longitude?: number;
}