'use client';

import { useQuery } from '@tanstack/react-query';
import { getBirdsForLocation, BirdResult } from '@/lib/api/birdClient';
import { getNearbyLocations, getRouteGeometry } from '@/lib/api/locationClient';
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
 */
export function useLocationSearch(latitude: number | null, longitude: number | null) {
  return useQuery<Location[]>({
    queryKey: ['locations', latitude, longitude],
    queryFn: () => getNearbyLocations(latitude!, longitude!),
    enabled: latitude !== null && longitude !== null,
  });
}

/**
 * Fetch the polyline geometry of a walking route relation on demand.
 * Cached by relation id so repeat opens are instant.
 */
export function useRouteGeometry(relationId: number | null) {
  return useQuery<[number, number][]>({
    queryKey: ['route-geom', relationId],
    queryFn: () => getRouteGeometry(relationId!),
    enabled: relationId !== null,
    staleTime: 1000 * 60 * 30,
  });
}