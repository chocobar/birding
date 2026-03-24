import { Bird } from '@/lib/types';

/**
 * Mock data for common UK birds — used as fallback when eBird API is unavailable
 */
const UK_COMMON_BIRDS: Bird[] = [
  {
    id: 'robin',
    commonName: 'European Robin',
    scientificName: 'Erithacus rubecula',
    description: 'A small, plump bird with an orange-red breast and face. One of the UK\'s most beloved garden birds.',
    imageUrl: 'https://images.unsplash.com/photo-1551525812-dbf728fe4e1f?w=400&h=300&fit=crop',
    frequency: 0.95,
    conservationStatus: 'LC',
    season: 'year-round'
  },
  {
    id: 'blackbird',
    commonName: 'Common Blackbird',
    scientificName: 'Turdus merula',
    description: 'Males are all black with a bright orange-yellow beak. Females are brown. Famous for their melodious song.',
    imageUrl: 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=400&h=300&fit=crop',
    frequency: 0.92,
    conservationStatus: 'LC',
    season: 'year-round'
  },
  {
    id: 'blue-tit',
    commonName: 'Blue Tit',
    scientificName: 'Cyanistes caeruleus',
    description: 'A colourful small bird with blue and yellow plumage. Often seen at bird feeders.',
    imageUrl: 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=400&h=300&fit=crop',
    frequency: 0.90,
    conservationStatus: 'LC',
    season: 'year-round'
  },
  {
    id: 'great-tit',
    commonName: 'Great Tit',
    scientificName: 'Parus major',
    description: 'The largest UK tit with distinctive black head, white cheeks, and yellow breast with black stripe.',
    imageUrl: 'https://images.unsplash.com/photo-1605475463168-81c5c76e3e5b?w=400&h=300&fit=crop',
    frequency: 0.88,
    conservationStatus: 'LC',
    season: 'year-round'
  },
  {
    id: 'woodpigeon',
    commonName: 'Wood Pigeon',
    scientificName: 'Columba palumbus',
    description: 'Large pigeon with white neck patches. Common in gardens, parks, and woodlands.',
    imageUrl: 'https://images.unsplash.com/photo-1518384401463-2e2f9c3c8d9e?w=400&h=300&fit=crop',
    frequency: 0.87,
    conservationStatus: 'LC',
    season: 'year-round'
  },
  {
    id: 'house-sparrow',
    commonName: 'House Sparrow',
    scientificName: 'Passer domesticus',
    description: 'Familiar brown and grey bird found near human habitation. Males have grey crowns and black bibs.',
    imageUrl: 'https://images.unsplash.com/photo-1597090104331-43c1bb42e72d?w=400&h=300&fit=crop',
    frequency: 0.85,
    conservationStatus: 'LC',
    season: 'year-round'
  },
  {
    id: 'starling',
    commonName: 'European Starling',
    scientificName: 'Sturnus vulgaris',
    description: 'Glossy black birds with iridescent plumage. Famous for their murmurations in winter.',
    imageUrl: 'https://images.unsplash.com/photo-1568454537842-d933259bb258?w=400&h=300&fit=crop',
    frequency: 0.82,
    conservationStatus: 'LC',
    season: 'year-round'
  },
  {
    id: 'magpie',
    commonName: 'Eurasian Magpie',
    scientificName: 'Pica pica',
    description: 'Striking black and white bird with a long tail. Intelligent and adaptable.',
    imageUrl: 'https://images.unsplash.com/photo-1589798977949-2c19f1e89779?w=400&h=300&fit=crop',
    frequency: 0.78,
    conservationStatus: 'LC',
    season: 'year-round'
  },
  {
    id: 'carrion-crow',
    commonName: 'Carrion Crow',
    scientificName: 'Corvus corone',
    description: 'All-black bird, larger than a blackbird. Highly intelligent and adaptable.',
    imageUrl: 'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?w=400&h=300&fit=crop',
    frequency: 0.75,
    conservationStatus: 'LC',
    season: 'year-round'
  },
  {
    id: 'chaffinch',
    commonName: 'Common Chaffinch',
    scientificName: 'Fringilla coelebs',
    description: 'Colourful finch with pinkish breast and blue-grey cap in males. Common in woodlands and gardens.',
    imageUrl: 'https://images.unsplash.com/photo-1589656966895-2f33e7653819?w=400&h=300&fit=crop',
    frequency: 0.73,
    conservationStatus: 'LC',
    season: 'year-round'
  },
  {
    id: 'goldfinch',
    commonName: 'European Goldfinch',
    scientificName: 'Carduelis carduelis',
    description: 'Beautiful finch with red face and yellow wing bars. Often seen on thistles and feeders.',
    imageUrl: 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=400&h=300&fit=crop',
    frequency: 0.70,
    conservationStatus: 'LC',
    season: 'year-round'
  },
  {
    id: 'wren',
    commonName: 'Eurasian Wren',
    scientificName: 'Troglodytes troglodytes',
    description: 'Tiny brown bird with a cocked tail. Has a surprisingly loud song for its size.',
    imageUrl: 'https://images.unsplash.com/photo-1597090104331-43c1bb42e72d?w=400&h=300&fit=crop',
    frequency: 0.68,
    conservationStatus: 'LC',
    season: 'year-round'
  },
  {
    id: 'dunnock',
    commonName: 'Dunnock',
    scientificName: 'Prunella modularis',
    description: 'Small brown and grey bird, often mistaken for a sparrow. Secretive hedgerow dweller.',
    imageUrl: 'https://images.unsplash.com/photo-1589798977949-2c19f1e89779?w=400&h=300&fit=crop',
    frequency: 0.65,
    conservationStatus: 'LC',
    season: 'year-round'
  },
  {
    id: 'long-tailed-tit',
    commonName: 'Long-tailed Tit',
    scientificName: 'Aegithalos caudatus',
    description: 'Tiny, fluffy bird with a very long tail. Pink, black and white plumage.',
    imageUrl: 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=400&h=300&fit=crop',
    frequency: 0.62,
    conservationStatus: 'LC',
    season: 'year-round'
  },
  {
    id: 'greenfinch',
    commonName: 'European Greenfinch',
    scientificName: 'Chloris chloris',
    description: 'Stocky finch with green and yellow plumage. Common at bird feeders.',
    imageUrl: 'https://images.unsplash.com/photo-1589656966895-2f33e7653819?w=400&h=300&fit=crop',
    frequency: 0.58,
    conservationStatus: 'LC',
    season: 'year-round'
  }
];

/**
 * Result from fetching birds — includes data source indicator
 */
export interface BirdResult {
  birds: Bird[];
  isLiveData: boolean;
}

/**
 * Fetch birds for a given location via the server-side proxy (/api/birds).
 * Falls back to mock data if the API is unavailable or returns no results.
 */
export async function getBirdsForLocation(
  latitude: number,
  longitude: number,
  radiusMiles: number = 5
): Promise<BirdResult> {
  try {
    const params = new URLSearchParams({
      lat: latitude.toString(),
      lng: longitude.toString(),
    });

    const response = await fetch(`/api/birds?${params.toString()}`);

    if (!response.ok) {
      console.error(`/api/birds returned ${response.status}`);
      return { birds: UK_COMMON_BIRDS.slice(0, 12), isLiveData: false };
    }

    const data = await response.json();

    // If the server returned live data with results, use it
    if (data.isLiveData && Array.isArray(data.birds) && data.birds.length > 0) {
      return { birds: data.birds, isLiveData: true };
    }

    // Server couldn't get live data (missing key, eBird error, etc.) — use mock
    return { birds: UK_COMMON_BIRDS.slice(0, 12), isLiveData: false };
  } catch (error) {
    console.error('Error fetching birds from /api/birds:', error);
    return { birds: UK_COMMON_BIRDS.slice(0, 12), isLiveData: false };
  }
}

/**
 * Search birds by name (uses mock data only)
 */
export async function searchBirds(query: string): Promise<Bird[]> {
  const lowerQuery = query.toLowerCase();
  return UK_COMMON_BIRDS.filter(
    bird =>
      bird.commonName.toLowerCase().includes(lowerQuery) ||
      bird.scientificName.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Get a single bird by ID (uses mock data only)
 */
export async function getBirdById(id: string): Promise<Bird | null> {
  const bird = UK_COMMON_BIRDS.find(b => b.id === id);
  return bird || null;
}

/**
 * Get all available birds (mock data for reference)
 */
export async function getAllBirds(): Promise<Bird[]> {
  return [...UK_COMMON_BIRDS];
}