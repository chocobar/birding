'use client';

import { calculateDistance } from '@/lib/utils/distanceCalculator';
import { formatTimeAgo } from '@/lib/utils/relativeTime';
import type { NotableSighting } from '@/lib/api/notableClient';
import { MapPin, Sparkles } from 'lucide-react';

interface NotableSightingsStripProps {
  sightings: NotableSighting[];
  /** The searched location, used to compute per-sighting distance */
  latitude: number;
  longitude: number;
  isLoading?: boolean;
}

/**
 * Human-readable distance from the search point, e.g. "1.2 mi away".
 */
function formatDistanceAway(
  lat: number,
  lng: number,
  originLat: number,
  originLng: number
): string {
  const miles = calculateDistance(originLat, originLng, lat, lng);
  if (miles < 0.1) {
    const yards = Math.max(1, Math.round(miles * 1760));
    return `${yards} yard${yards === 1 ? '' : 's'} away`;
  }
  return `${miles.toFixed(1)} mi away`;
}

function SkeletonStrip() {
  return (
    <section className="w-full" aria-label="Loading rare sightings">
      <div className="mb-5 flex items-center gap-2">
        <div className="h-6 w-6 rounded-lg bg-[var(--border-light)] animate-pulse" />
        <div className="h-6 w-52 rounded-lg bg-[var(--border-light)] animate-pulse" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="bg-[var(--warm-sand)] border border-[var(--border-light)] rounded-xl p-4 animate-pulse"
          >
            <div className="h-4 bg-[var(--border-light)] rounded-lg w-3/4 mb-2" />
            <div className="h-3 bg-[var(--border-light)]/60 rounded-lg w-1/2 mb-3" />
            <div className="h-3 bg-[var(--border-light)]/60 rounded-lg w-2/3" />
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * Compact strip of recent rare/notable bird sightings reported near the
 * searched location, sourced from eBird's notable observations feed.
 *
 * Best-effort by design: renders nothing when there is no data, so an API
 * failure or missing key can never break the page.
 */
export default function NotableSightingsStrip({
  sightings,
  latitude,
  longitude,
  isLoading = false,
}: NotableSightingsStripProps) {
  if (isLoading) {
    return <SkeletonStrip />;
  }

  // Hide the strip entirely when the feed is empty or unavailable
  if (!sightings || sightings.length === 0) {
    return null;
  }

  return (
    <section className="w-full" aria-label="Rare sightings nearby">
      <div className="mb-5">
        <h2 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-[var(--brand-green)]" aria-hidden="true" />
          Rare sightings nearby
        </h2>
        <p className="text-[var(--text-secondary)] mt-1 text-sm sm:text-base">
          Rare or unusual species recently reported in your area
        </p>
      </div>

      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {sightings.map((sighting) => {
          const timeAgo = formatTimeAgo(sighting.observedAt);
          const distance =
            typeof sighting.latitude === 'number' && typeof sighting.longitude === 'number'
              ? formatDistanceAway(sighting.latitude, sighting.longitude, latitude, longitude)
              : null;

          return (
            <li
              key={sighting.id}
              className="bg-[var(--warm-sand)] border border-[var(--border-light)] rounded-xl p-4 flex flex-col gap-1"
            >
              <p className="font-semibold text-sm text-[var(--text-primary)] leading-snug">
                {sighting.commonName}
              </p>
              <p
                className="text-xs text-[var(--text-secondary)] flex items-center gap-1 min-w-0"
                title={sighting.locationName}
              >
                <MapPin className="w-3 h-3 flex-shrink-0 text-[var(--brand-green)]" aria-hidden="true" />
                <span className="truncate">{sighting.locationName}</span>
              </p>
              <p className="text-xs text-[var(--text-secondary)] mt-auto pt-1">
                {distance}
                {distance && timeAgo ? ' · ' : ''}
                {timeAgo}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
