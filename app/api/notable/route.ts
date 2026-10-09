import { NextRequest } from 'next/server';

interface EBirdNotableObservation {
  speciesCode: string;
  comName: string;
  sciName: string;
  locId?: string;
  locName: string;
  obsDt: string;
  howMany?: number;
  lat: number;
  lng: number;
  obsValid?: boolean;
  obsReviewed?: boolean;
  locationPrivate?: boolean;
  subId?: string;
}

interface NotableSightingResponse {
  id: string;
  commonName: string;
  scientificName: string;
  locationName: string;
  observedAt: string;
  latitude: number;
  longitude: number;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const latStr = searchParams.get('lat');
  const lngStr = searchParams.get('lng');

  // Validate required params
  if (!latStr || !lngStr) {
    return Response.json(
      { sightings: [], isLiveData: false, error: 'Missing required parameters: lat and lng' },
      { status: 400 }
    );
  }

  const lat = parseFloat(latStr);
  const lng = parseFloat(lngStr);

  // Validate numeric and in range
  if (isNaN(lat) || isNaN(lng)) {
    return Response.json(
      { sightings: [], isLiveData: false, error: 'lat and lng must be valid numbers' },
      { status: 400 }
    );
  }

  if (lat < -90 || lat > 90) {
    return Response.json(
      { sightings: [], isLiveData: false, error: 'lat must be between -90 and 90' },
      { status: 400 }
    );
  }

  if (lng < -180 || lng > 180) {
    return Response.json(
      { sightings: [], isLiveData: false, error: 'lng must be between -180 and 180' },
      { status: 400 }
    );
  }

  // Check for API key (server-only, never exposed to the browser)
  const apiKey = process.env.EBIRD_API_KEY;
  if (!apiKey) {
    console.warn('EBIRD_API_KEY is not set. Returning empty notable sightings.');
    return Response.json(
      { sightings: [], isLiveData: false, error: 'eBird API key not configured' },
      { status: 200 }
    );
  }

  try {
    const params = new URLSearchParams({
      lat: lat.toString(),
      lng: lng.toString(),
      dist: '8', // ~5 miles, consistent with the recent-observations route
      back: '14', // last 14 days
      maxResults: '50', // fetch enough for dedup, display up to 8
    });

    const ebirdResponse = await fetch(
      `https://api.ebird.org/v2/data/obs/geo/recent/notable?${params.toString()}`,
      {
        headers: {
          'X-eBirdApiToken': apiKey,
        },
        next: { revalidate: 900 }, // cache notable data server-side for 15 minutes
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!ebirdResponse.ok) {
      console.error(`eBird notable API error: ${ebirdResponse.status} ${ebirdResponse.statusText}`);
      return Response.json(
        { sightings: [], isLiveData: false, error: `eBird API returned ${ebirdResponse.status}` },
        { status: 200 }
      );
    }

    const observations: EBirdNotableObservation[] = await ebirdResponse.json();

    if (!Array.isArray(observations)) {
      return Response.json({ sightings: [], isLiveData: false }, { status: 200 });
    }

    // Deduplicate by speciesCode, keeping the most recent observation per species
    const speciesMap = new Map<string, EBirdNotableObservation>();
    for (const obs of observations) {
      if (!obs.speciesCode || !obs.comName || !obs.obsDt) continue;
      const existing = speciesMap.get(obs.speciesCode);
      if (!existing || obs.obsDt > existing.obsDt) {
        speciesMap.set(obs.speciesCode, obs);
      }
    }

    // Most recent first, compact strip limit
    const sightings: NotableSightingResponse[] = Array.from(speciesMap.values())
      .sort((a, b) => (a.obsDt > b.obsDt ? -1 : 1))
      .slice(0, 8)
      .map((obs) => ({
        // subId identifies the checklist, so combine with speciesCode for uniqueness
        id: `${obs.speciesCode}-${obs.subId || obs.obsDt}`,
        commonName: obs.comName,
        scientificName: obs.sciName,
        locationName: obs.locName,
        observedAt: obs.obsDt,
        latitude: obs.lat,
        longitude: obs.lng,
      }));

    return Response.json({ sightings, isLiveData: true });
  } catch (error) {
    console.error('Error fetching notable observations from eBird API:', error);
    return Response.json(
      { sightings: [], isLiveData: false, error: 'Failed to fetch notable observations from eBird API' },
      { status: 200 }
    );
  }
}
