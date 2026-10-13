/**
 * A reserve card rendered in the 'RSPB reserves near you' section. Names and
 * centroids come from the RSPB's official open-data reserves dataset (see
 * DATA_ATTRIBUTION.md); the URL is the reserve's page on rspb.org.uk.
 */
export interface RspbReserve {
  id: string;
  name: string;
  type: string;
  latitude: number;
  longitude: number;
  /** Distance from the searched location, in miles */
  distance: number;
  url: string;
}

/**
 * Fetch RSPB reserves near a location via the server-side proxy
 * (/api/rspb-reserves). Best-effort: any failure returns an empty list so the
 * section is simply hidden — searching outside the UK (where nothing falls in
 * range) and upstream outages look identical to the UI.
 */
export async function getRspbReserves(latitude: number, longitude: number): Promise<RspbReserve[]> {
  try {
    const params = new URLSearchParams({
      lat: latitude.toString(),
      lng: longitude.toString(),
    });

    const response = await fetch(`/api/rspb-reserves?${params.toString()}`);

    if (!response.ok) {
      console.error(`/api/rspb-reserves returned ${response.status}`);
      return [];
    }

    const data: { reserves?: RspbReserve[] } = await response.json();
    return Array.isArray(data.reserves) ? data.reserves : [];
  } catch (error) {
    console.error('Error fetching RSPB reserves from /api/rspb-reserves:', error);
    return [];
  }
}

/**
 * Northern Ireland's reserves fall under the NI mapping-data variant of the
 * RSPB licence, so the footer credit gains an OSNI line when a rendered
 * reserve lies within Northern Ireland. Scotland shares the longitudes, so
 * the box is capped at NI's northern tip (Rathlin, NI's northernmost point,
 * sits at 55.3; the western Scottish islands rendered from this dataset all
 * sit above 55.6). Credit-display heuristic only — not a data filter.
 */
const NI_BOUNDS = { minLat: 53.9, maxLat: 55.45, minLng: -8.3, maxLng: -5.35 };

function isInNorthernIreland(latitude: number, longitude: number): boolean {
  return (
    latitude >= NI_BOUNDS.minLat &&
    latitude <= NI_BOUNDS.maxLat &&
    longitude >= NI_BOUNDS.minLng &&
    longitude <= NI_BOUNDS.maxLng
  );
}

export function hasNorthernIrelandReserves(reserves: RspbReserve[]): boolean {
  return reserves.some((reserve) => isInNorthernIreland(reserve.latitude, reserve.longitude));
}
