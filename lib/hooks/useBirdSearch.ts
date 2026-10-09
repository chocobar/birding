'use client';

import { useQuery } from '@tanstack/react-query';
import { getBirdsForLocation, BirdResult } from '@/lib/api/birdClient';
import { getNotableSightings, NotableResult } from '@/lib/api/notableClient';
import { getNearbyLocations, getOsmLineGeometry, NearbyLocationsResult } from '@/lib/api/locationClient';

/**
 * Fetch birds for a geocoded location. Cached by lat/lng.
 */
export function useBirdSearch(latitude: number | null, longitude: number | null) {
  return useQuery<BirdResult>({
    queryKey: ['birds', latitude, longitude],
    queryFn: () => getBirdsForLocation(latitude!, longitude!),
    enabled: latitude !== null && longitude !== null,
  });
}

/**
 * Fetch nearby locations for a geocoded position. Cached by lat/lng.
 *
 * No automatic retry: the server caches results and bounds its own worst
 * case, so a client-side retry would only double the skeleton-screen wait
 * before the error state (which has its own explicit "Try again" button)
 * appears.
 */
export function useLocationSearch(latitude: number | null, longitude: number | null) {
  return useQuery<NearbyLocationsResult>({
    queryKey: ['locations', latitude, longitude],
    queryFn: () => getNearbyLocations(latitude!, longitude!),
    enabled: latitude !== null && longitude !== null,
    retry: 0,
  });
}

/**
 * Fetch recent notable (rare/unusual) sightings for a geodedic position.
 * Cached by lat/lng. Best-effort: failures resolve to an empty list so the
 * strip can be hidden without surfacing an error.
 */
export function useNotableSightings(latitude: number | null, longitude: number | null) {
  return useQuery<NotableResult>({
    queryKey: ['notable-sightings', latitude, longitude],
    queryFn: () => getNotableSightings(latitude!, longitude!),
    enabled: latitude !== null && longitude !== null,
    retry: 0,
    staleTime: 1000 * 60 * 15,
  });
}

/**
 * The OSM feature whose full shape the map modal should draw: a walking-route
 * relation, or a trail way.
 */
export interface OsmGeometryTarget {
  kind: 'relation' | 'way';
  id: number;
}

/**
 * Fetch the polyline geometry of an OSM relation or way on demand.
 * Cached by kind + id so repeat opens are instant.
 */
export function useOsmLineGeometry(target: OsmGeometryTarget | null) {
  return useQuery<[number, number][]>({
    queryKey: ['osm-line-geometry', target?.kind, target?.id],
    queryFn: () => getOsmLineGeometry(target!.kind, target!.id),
    enabled: target !== null,
    staleTime: 1000 * 60 * 30,
  });
}
