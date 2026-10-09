import { NextRequest } from 'next/server';
import { mergeIntoArchive, parseObsDt, readArchivedSightings } from '@/lib/server/sightingArchive';

interface SightingSource {
  speciesCode: string;
  comName: string;
  sciName: string;
  locId: string;
  locName: string;
  obsDt: string;
  howMany?: number;
  lat: number;
  lng: number;
  subId: string;
}

interface BirdResponse {
  id: string;
  speciesCode: string;
  commonName: string;
  scientificName: string;
  description: string;
  locationName: string;
  observationDate: string;
  latitude: number;
  longitude: number;
}

/** Time windows the API accepts, in days (see lib/types/TimeRange.ts) */
const ALLOWED_WINDOWS_DAYS = [30, 90, 180] as const;

/** Live eBird data never reaches further back than this */
const EBIRD_MAX_BACK_DAYS = 30;

/** Search radius for both the live fetch and the archive filter */
const RADIUS_KM = 8;

/** Upper bound on records sent to the browser */
const MAX_RESPONSE_RECORDS = 500;

/** Collapse redundant checklist reports: one sighting per species per location per day */
function dedupeSightings(records: BirdResponse[]): BirdResponse[] {
  const byKey = new Map<string, BirdResponse>();
  for (const record of records) {
    const key = `${record.speciesCode}|${record.locationName}|${record.observationDate.slice(0, 10)}`;
    const existing = byKey.get(key);
    if (!existing || parseObsDt(record.observationDate) > parseObsDt(existing.observationDate)) {
      byKey.set(key, record);
    }
  }
  return Array.from(byKey.values());
}

function toBirdResponse(obs: SightingSource): BirdResponse {
  const count = obs.howMany ? `${obs.howMany} individual${obs.howMany > 1 ? 's' : ''}` : 'observed';
  const dateStr = obs.obsDt.split(' ')[0] || obs.obsDt;

  return {
    id: `${obs.subId}-${obs.speciesCode}`,
    speciesCode: obs.speciesCode,
    commonName: obs.comName,
    scientificName: obs.sciName,
    description: `Observed at ${obs.locName} on ${dateStr} (${count})`,
    locationName: obs.locName,
    observationDate: obs.obsDt,
    latitude: obs.lat,
    longitude: obs.lng,
  };
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const latStr = searchParams.get('lat');
  const lngStr = searchParams.get('lng');
  const backStr = searchParams.get('back');

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

  // Time window: 30 (last month), 90 (last 3 months) or 180 (last 6 months) days
  const windowDays = backStr === null ? 30 : parseInt(backStr, 10);
  if (
    isNaN(windowDays) ||
    !ALLOWED_WINDOWS_DAYS.includes(windowDays as (typeof ALLOWED_WINDOWS_DAYS)[number])
  ) {
    return Response.json(
      {
        birds: [],
        isLiveData: false,
        error: `back must be one of ${ALLOWED_WINDOWS_DAYS.join(', ')} (days)`,
      },
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
    // eBird caps recent observations at 30 days, so every request fetches the
    // maximum live window; the archive extends coverage for longer ranges.
    const params = new URLSearchParams({
      lat: lat.toString(),
      lng: lng.toString(),
      dist: RADIUS_KM.toString(), // ~5 miles
      maxResults: '1000',
      back: EBIRD_MAX_BACK_DAYS.toString(),
    });

    const ebirdResponse = await fetch(
      `https://api.ebird.org/v2/data/obs/geo/recent?${params.toString()}`,
      {
        headers: {
          'X-eBirdApiToken': apiKey,
        },
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!ebirdResponse.ok) {
      console.error(`eBird API error: ${ebirdResponse.status} ${ebirdResponse.statusText}`);
      return Response.json(
        { birds: [], isLiveData: false, error: `eBird API returned ${ebirdResponse.status}` },
        { status: 200 }
      );
    }

    const observations: SightingSource[] = await ebirdResponse.json();

    // Grow the archive before reading it so this response includes fresh data
    await mergeIntoArchive(observations);

    const windowStart = Date.now() - windowDays * 24 * 60 * 60 * 1000;
    const archived = await readArchivedSightings(lat, lng, RADIUS_KM, windowStart);
    const liveResponses = observations.map(toBirdResponse);
    const archivedResponses = archived.map(toBirdResponse);
    const birds = dedupeSightings([...liveResponses, ...archivedResponses])
      .sort((a, b) => parseObsDt(b.observationDate) - parseObsDt(a.observationDate))
      .slice(0, MAX_RESPONSE_RECORDS);

    // Longer windows only have full coverage once the archive has accumulated
    // that much history (eBird serves 30 days live), so tell the client when
    // the returned records don't reach the start of the requested window.
    const oldest = birds.length
      ? parseObsDt(birds[birds.length - 1].observationDate)
      : Date.now();
    const coverageLimited = windowDays > EBIRD_MAX_BACK_DAYS && oldest > windowStart;

    return Response.json({
      birds,
      isLiveData: true,
      windowDays,
      coverageLimited,
    });
  } catch (error) {
    console.error('Error fetching from eBird API:', error);
    return Response.json(
      { birds: [], isLiveData: false, error: 'Failed to fetch from eBird API' },
      { status: 200 }
    );
  }
}
