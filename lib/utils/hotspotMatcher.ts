import { Location } from '@/lib/types';
import { HotspotRichness } from '@/lib/api/hotspotClient';
import { calculateDistance } from '@/lib/utils/distanceCalculator';

const PROXIMITY_MILES = 0.093;

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function nameMatches(locationName: string, hotspotName: string): boolean {
  const a = normalizeName(locationName);
  const b = normalizeName(hotspotName);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

export function matchHotspotsToLocations(
  locations: Location[],
  hotspots: HotspotRichness[]
): Map<string, number> {
  const counts = new Map<string, number>();

  if (locations.length === 0 || hotspots.length === 0) return counts;

  for (const location of locations) {
    const byName = hotspots.filter((hotspot) => nameMatches(location.name, hotspot.locName));
    if (byName.length > 0) {
      const nearest = byName.reduce((best, hotspot) =>
        Math.abs(hotspot.distanceMiles - location.distance) <
        Math.abs(best.distanceMiles - location.distance)
          ? hotspot
          : best
      );
      counts.set(location.id, nearest.speciesCount);
      continue;
    }

    const nearby = hotspots
      .filter(
        (hotspot) =>
          calculateDistance(location.latitude, location.longitude, hotspot.lat, hotspot.lng) <=
          PROXIMITY_MILES
      )
      .sort(
        (a, b) =>
          calculateDistance(location.latitude, location.longitude, a.lat, a.lng) -
          calculateDistance(location.latitude, location.longitude, b.lat, b.lng)
      );
    if (nearby.length > 0) {
      counts.set(location.id, nearby[0].speciesCount);
    }
  }

  return counts;
}
