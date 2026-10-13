import ukBoundary from './data/uk-boundary.json';

/**
 * UK membership test for a coordinate, used to gate the RSPB reserves
 * feature: the reserves dataset only covers the UK, and the RSPB data must
 * not be served for searches outside it (nearby foreign searches like Dublin
 * or Calais can fall inside the API's radius window).
 *
 * The boundary is Natural Earth's 10m-resolution United Kingdom polygon
 * (admin-0 countries), embedded as a compact ring list in
 * data/uk-boundary.json — Natural Earth data is public domain, so it carries
 * no attribution obligation. It includes Great Britain, Northern Ireland and
 * the UK's islands (Isle of Wight, Anglesey, Hebrides, Orkney, Shetland, …)
 * and excludes the Isle of Man, the Channel Islands and the Republic of
 * Ireland.
 */

type Ring = [number, number][]; // [longitude, latitude]

const RINGS = (ukBoundary as { rings: Ring[] }).rings;

/** Bounding box of all rings — cheap reject for coordinates far from the UK */
const BOUNDS = RINGS.reduce(
  (bounds, ring) => {
    for (const [lng, lat] of ring) {
      if (lng < bounds.minLng) bounds.minLng = lng;
      if (lng > bounds.maxLng) bounds.maxLng = lng;
      if (lat < bounds.minLat) bounds.minLat = lat;
      if (lat > bounds.maxLat) bounds.maxLat = lat;
    }
    return bounds;
  },
  { minLng: Infinity, maxLng: -Infinity, minLat: Infinity, maxLat: -Infinity }
);

/**
 * The Natural Earth outline is simplified, so a geocoded point sitting right
 * on a UK beach can land just outside the drawn coast. Points within this
 * many degrees (~1.3 km) of the boundary still count as inside; it is far too
 * small to reach any neighbouring jurisdiction — the tightest gap is the
 * Lough Foyle border, where the nearest Republic of Ireland settlement
 * (Greencastle) sits ~1.9 km outside the line.
 */
const COASTAL_TOLERANCE_DEG = 0.012;

function pointInRing(lng: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function squaredDistanceToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared));
  const ex = px - (ax + t * dx);
  const ey = py - (ay + t * dy);
  return ex * ex + ey * ey;
}

/**
 * True when the coordinate is inside the United Kingdom (or within a small
 * coastal tolerance of its outline). Uses ray casting per ring plus a
 * distance-to-boundary fallback for the simplified coast.
 */
export function isInsideUk(latitude: number, longitude: number): boolean {
  if (
    latitude < BOUNDS.minLat - COASTAL_TOLERANCE_DEG ||
    latitude > BOUNDS.maxLat + COASTAL_TOLERANCE_DEG ||
    longitude < BOUNDS.minLng - COASTAL_TOLERANCE_DEG ||
    longitude > BOUNDS.maxLng + COASTAL_TOLERANCE_DEG
  ) {
    return false;
  }

  for (const ring of RINGS) {
    if (pointInRing(longitude, latitude, ring)) return true;
  }

  const toleranceSquared = COASTAL_TOLERANCE_DEG * COASTAL_TOLERANCE_DEG;
  for (const ring of RINGS) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (squaredDistanceToSegment(longitude, latitude, xi, yi, xj, yj) <= toleranceSquared) {
        return true;
      }
    }
  }

  return false;
}
