'use client';

import { useQuery } from '@tanstack/react-query';
import { getBirdsForLocation, BirdResult } from '@/lib/api/birdClient';
import { getNearbyLocations } from '@/lib/api/locationClient';
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