'use client';

import { useQuery } from '@tanstack/react-query';
import { getBirdsForLocation, BirdResult } from '@/lib/api/birdClient';
import { getNearbyLocations, getOsmLineGeometry } from '@/lib/api/locationClient';
import { Location } from '@/lib/types';

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
 * No automatic retry: the server already retries across Overpass endpoints
 * and bounds its own worst case at ~35s, so a client-side retry would only
 * double the skeleton-screen wait before the error state (which has its own
 * explicit "Try again" button) appears.
 */
export function useLocationSearch(latitude: number | null, longitude: number | null) {
  return useQuery<Location[]>({
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
