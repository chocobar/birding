import { NextRequest } from 'next/server';

interface EBirdObservation {
  speciesCode: string;
  comName: string;
  sciName: string;
  locName: string;
  obsDt: string;
  howMany?: number;
  lat: number;
  lng: number;
  subId: string;
}

interface BirdResponse {
  id: string;
  commonName: string;
  scientificName: string;
  description: string;
  locationName: string;
  observationDate: string;
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
      { birds: [], isLiveData: false, error: 'Missing required parameters: lat and lng' },
      { status: 400 }
    );
  }

  const lat = parseFloat(latStr);
  const lng = parseFloat(lngStr);

  // Validate numeric and in range
  if (isNaN(lat) || isNaN(lng)) {
    return Response.json(
      { birds: [], isLiveData: false, error: 'lat and lng must be valid numbers' },
      { status: 400 }
    );
  }

  if (lat < -90 || lat > 90) {
    return Response.json(
      { birds: [], isLiveData: false, error: 'lat must be between -90 and 90' },
      { status: 400 }
    );
  }

  if (lng < -180 || lng > 180) {
    return Response.json(
      { birds: [], isLiveData: false, error: 'lng must be between -180 and 180' },
      { status: 400 }
    );
  }

  // Check for API key (server-only, never exposed to the browser)
  const apiKey = process.env.EBIRD_API_KEY;
  if (!apiKey) {
    console.warn('EBIRD_API_KEY is not set. Returning empty results.');
    return Response.json(
      { birds: [], isLiveData: false, error: 'eBird API key not configured' },
      { status: 200 }
    );
  }

  try {
    const params = new URLSearchParams({
      lat: lat.toString(),
      lng: lng.toString(),
      dist: '8', // ~5 miles in km
      maxResults: '20', // fetch enough for dedup, display up to 12
      back: '14', // last 14 days
    });

    const ebirdResponse = await fetch(
      `https://api.ebird.org/v2/data/obs/geo/recent?${params.toString()}`,
      {
        headers: {
          'X-eBirdApiToken': apiKey,
        },
      }
    );

    if (!ebirdResponse.ok) {
      console.error(`eBird API error: ${ebirdResponse.status} ${ebirdResponse.statusText}`);
      return Response.json(
        { birds: [], isLiveData: false, error: `eBird API returned ${ebirdResponse.status}` },
        { status: 200 }
      );
    }

    const observations: EBirdObservation[] = await ebirdResponse.json();

    // Deduplicate by speciesCode, keeping the most recent observation per species
    const speciesMap = new Map<string, EBirdObservation>();
    for (const obs of observations) {
      const existing = speciesMap.get(obs.speciesCode);
      if (!existing || obs.obsDt > existing.obsDt) {
        speciesMap.set(obs.speciesCode, obs);
      }
    }

    // Map to Bird type and limit to 12 results
    const birds: BirdResponse[] = Array.from(speciesMap.values())
      .slice(0, 12)
      .map((obs) => {
        const count = obs.howMany ? `${obs.howMany} individual${obs.howMany > 1 ? 's' : ''}` : 'observed';
        const dateParts = obs.obsDt.split(' ');
        const dateStr = dateParts[0] || obs.obsDt;

        return {
          id: obs.speciesCode,
          commonName: obs.comName,
          scientificName: obs.sciName,
          description: `Observed at ${obs.locName} on ${dateStr} (${count})`,
          locationName: obs.locName,
          observationDate: obs.obsDt,
          latitude: obs.lat,
          longitude: obs.lng,
        };
      });

    return Response.json({ birds, isLiveData: true });
  } catch (error) {
    console.error('Error fetching from eBird API:', error);
    return Response.json(
      { birds: [], isLiveData: false, error: 'Failed to fetch from eBird API' },
      { status: 200 }
    );
  }
}