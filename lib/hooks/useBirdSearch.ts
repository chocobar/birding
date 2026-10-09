'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getBirdsForLocation, BirdResult } from '@/lib/api/birdClient';
import { getNearbyLocations, getOsmLineGeometry, NearbyLocationsResult } from '@/lib/api/locationClient';

/**
 * Fetch birds for a geocoded location within a time window. Cached by
 * lat/lng/window; switching windows keeps the previous list on screen until
 * the new one arrives.
 */
export function useBirdSearch(
  latitude: number | null,
  longitude: number | null,
  backDays: number
) {
  return useQuery<BirdResult>({
    queryKey: ['birds', latitude, longitude, backDays],
    queryFn: () => getBirdsForLocation(latitude!, longitude!, backDays),
    enabled: latitude !== null && longitude !== null,
    placeholderData: keepPreviousData,
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
