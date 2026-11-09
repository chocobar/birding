export interface HotspotRichness {
  locId: string;
  locName: string;
  lat: number;
  lng: number;
  speciesCount: number;
  distanceMiles: number;
}

export async function getHotspotRichness(
  latitude: number,
  longitude: number,
  radiusMiles: number = 5
): Promise<HotspotRichness[]> {
  try {
    const params = new URLSearchParams({
      lat: latitude.toString(),
      lng: longitude.toString(),
      radius: radiusMiles.toString(),
    });

    const response = await fetch(`/api/hotspots?${params.toString()}`);

    if (!response.ok) {
      console.error(`/api/hotspots returned ${response.status}`);
      return [];
    }

    const data: { hotspots?: HotspotRichness[]; isLiveData?: boolean } = await response.json();

    if (data.isLiveData && Array.isArray(data.hotspots)) {
      return data.hotspots;
    }

    return [];
  } catch (error) {
    console.error('Error fetching hotspot richness from /api/hotspots:', error);
    return [];
  }
}
