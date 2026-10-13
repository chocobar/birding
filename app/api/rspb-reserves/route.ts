import { NextRequest } from 'next/server';
import { getRspbReservesSnapshot } from '@/lib/server/rspbReserves';
import { isInsideUk } from '@/lib/server/ukBoundary';
import { calculateDistance } from '@/lib/utils/distanceCalculator';
import { displayCaseReserveName, rspbReserveUrl } from '@/lib/utils/rspbReserveNames';

const DEFAULT_RADIUS_MILES = 30;
const MIN_RADIUS_MILES = 1;
const MAX_RADIUS_MILES = 200;
const MAX_RESULTS = 10;

/**
 * Nearest RSPB reserves to a point, from the cached snapshot of the RSPB's
 * official open-data reserves dataset. SENSITIVE sites are deliberately
 * excluded: the RSPB withholds those sites' details, and so do we. This route
 * never fails on upstream problems — the snapshot loader serves whatever it
 * has and an unexpected error still returns an empty list, so the UI can hide
 * the section instead of breaking the page.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const latStr = searchParams.get('lat');
  const lngStr = searchParams.get('lng');

  if (!latStr || !lngStr) {
    return Response.json(
      { reserves: [], error: 'Missing required parameters: lat and lng' },
      { status: 400 }
    );
  }

  const lat = parseFloat(latStr);
  const lng = parseFloat(lngStr);

  if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return Response.json(
      { reserves: [], error: 'lat and lng must be valid coordinates' },
      { status: 400 }
    );
  }

  const radiusStr = searchParams.get('radius');
  const parsedRadius = radiusStr ? parseFloat(radiusStr) : NaN;
  const radius = Number.isFinite(parsedRadius)
    ? Math.min(Math.max(parsedRadius, MIN_RADIUS_MILES), MAX_RADIUS_MILES)
    : DEFAULT_RADIUS_MILES;

  try {
    // The RSPB dataset covers the UK only: searches outside the UK (even
    // foreign coastlines that fall inside the radius window) never see
    // reserves. An empty list keeps this route's never-fail contract and the
    // UI hides the section.
    if (!isInsideUk(lat, lng)) {
      return Response.json({ reserves: [], isLiveData: true });
    }

    const snapshot = await getRspbReservesSnapshot();

    const reserves = snapshot.reserves
      .filter((reserve) => reserve.sensitive !== 'SENSITIVE')
      .map((reserve) => ({
        reserve,
        distance: calculateDistance(lat, lng, reserve.latitude, reserve.longitude),
      }))
      .filter(({ distance }) => distance <= radius)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, MAX_RESULTS)
      .map(({ reserve, distance }) => ({
        id: `rspb-${reserve.objectid}`,
        name: displayCaseReserveName(reserve.name),
        type: reserve.type ?? '',
        latitude: reserve.latitude,
        longitude: reserve.longitude,
        distance: Math.round(distance * 1000) / 1000,
        url: rspbReserveUrl(reserve.name),
      }));

    return Response.json({ reserves, isLiveData: true });
  } catch (error) {
    console.error('Failed to load RSPB reserves:', error);
    return Response.json({ reserves: [], isLiveData: false });
  }
}
