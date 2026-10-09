/**
 * Result from fetching notable sightings — includes data source indicator.
 * Notable sightings are a best-effort extra: callers should treat an empty
 * result as "hide the strip", never as an error.
 */
export interface NotableResult {
  sightings: NotableSighting[];
  isLiveData: boolean;
}

export interface NotableSighting {
  id: string;
  commonName: string;
  scientificName?: string;
  locationName: string;
  observedAt: string;
  latitude: number;
  longitude: number;
}

/**
 * Fetch recent notable (rare/unusual) observations near a location via the
 * server-side proxy (/api/notable). Best-effort: any failure returns an
 * empty result so the UI can simply hide the strip.
 */
export async function getNotableSightings(
  latitude: number,
  longitude: number
): Promise<NotableResult> {
  try {
    const params = new URLSearchParams({
      lat: latitude.toString(),
      lng: longitude.toString(),
    });

    const response = await fetch(`/api/notable?${params.toString()}`);

    if (!response.ok) {
      console.error(`/api/notable returned ${response.status}`);
      return { sightings: [], isLiveData: false };
    }

    const data: { sightings?: NotableSighting[]; isLiveData?: boolean } = await response.json();

    if (data.isLiveData && Array.isArray(data.sightings) && data.sightings.length > 0) {
      return { sightings: data.sightings, isLiveData: true };
    }

    return { sightings: [], isLiveData: false };
  } catch (error) {
    console.error('Error fetching notable sightings from /api/notable:', error);
    return { sightings: [], isLiveData: false };
  }
}
