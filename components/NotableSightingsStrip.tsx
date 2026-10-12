'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { calculateDistance } from '@/lib/utils/distanceCalculator';
import { formatTimeAgo } from '@/lib/utils/relativeTime';
import type { NotableSighting } from '@/lib/api/notableClient';
import { Bird, Clock, MapPin, Sparkles } from 'lucide-react';

interface NotableSightingsStripProps {
  sightings: NotableSighting[];
  /** The searched location, used to compute per-sighting distance */
  latitude: number;
  longitude: number;
  isLoading?: boolean;
}

interface BirdImageInfo {
  imageUrl: string | null;
  attribution: string | null;
  attributionUrl: string | null;
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

/** /api/bird-images accepts at most 20 birds per request */
const BATCH_SIZE = 20;

/**
 * Fetch photo URLs for the notable species, batching into requests of at
 * most BATCH_SIZE entries. Best effort: failures simply leave cards on
 * their placeholder artwork.
 */
async function fetchBirdImages(
  sightings: NotableSighting[]
): Promise<Record<string, BirdImageInfo>> {
  if (sightings.length === 0) return {};

  const batches: NotableSighting[][] = [];
  for (let i = 0; i < sightings.length; i += BATCH_SIZE) {
    batches.push(sightings.slice(i, i + BATCH_SIZE));
  }

  const emptyResult: BirdImageInfo = {
    imageUrl: null,
    attribution: null,
    attributionUrl: null,
  };

  const settled = await Promise.allSettled(
    batches.map(async (batch) => {
      const res = await fetch('/api/bird-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          birds: batch.map((s) => ({
            name: s.commonName,
            scientificName: s.scientificName,
          })),
        }),
      });

      if (!res.ok) return {};
      const data: { images: Record<string, BirdImageInfo> } = await res.json();
      return data.images ?? {};
    })
  );

  // Flatten to name → image info map (imageUrl + attribution kept together
  // so each photo can be credited as its Commons license requires)
  const map: Record<string, BirdImageInfo> = {};
  for (const result of settled) {
    if (result.status === 'fulfilled') {
      for (const [name, info] of Object.entries(result.value)) {
        map[name] = info ?? emptyResult;
      }
    }
  }
  return map;
}

function SkeletonStrip() {
  return (
    <section className="w-full" aria-label="Loading rare sightings">
      <div className="rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 p-5 sm:p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-amber-200/70 dark:bg-amber-900/60 animate-pulse" />
          <div className="h-6 w-64 rounded-lg bg-amber-200/70 dark:bg-amber-900/60 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="bg-white/80 dark:bg-[var(--warm-sand)] border border-amber-200/80 dark:border-amber-900/60 rounded-xl overflow-hidden animate-pulse"
            >
              <div className="w-full h-40 bg-amber-100/80 dark:bg-amber-950/40" />
              <div className="p-3.5">
                <div className="h-4 bg-amber-200/70 dark:bg-amber-900/60 rounded-lg w-3/4 mb-2" />
                <div className="h-3 bg-amber-200/50 dark:bg-amber-900/40 rounded-lg w-1/2 mb-3" />
                <div className="h-3 bg-amber-200/50 dark:bg-amber-900/40 rounded-lg w-2/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * Highlighted strip of recent rare/notable bird sightings reported near the
 * searched location, sourced from eBird's notable observations feed.
 *
 * Deliberately eye-catching — rare sightings are the headline feature — with
 * photo previews resolved from Wikimedia Commons via /api/bird-images.
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
  const [imageMap, setImageMap] = useState<Record<string, BirdImageInfo>>({});

  // Batch-fetch photos for the visible species, skipping names resolved
  // before so refetches only look up new arrivals
  useEffect(() => {
    if (!sightings || sightings.length === 0) return;

    const seen = new Set<string>();
    const unique = sightings.filter((s) => {
      if (seen.has(s.commonName)) return false;
      seen.add(s.commonName);
      return true;
    });
    const missing = unique.filter((s) => !(s.commonName in imageMap));
    if (missing.length === 0) return;

    let cancelled = false;

    fetchBirdImages(missing).then((map) => {
      if (!cancelled && Object.keys(map).length > 0) {
        setImageMap((prev) => ({ ...prev, ...map }));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [sightings, imageMap]);

  if (isLoading) {
    return <SkeletonStrip />;
  }

  // Hide the strip entirely when the feed is empty or unavailable
  if (!sightings || sightings.length === 0) {
    return null;
  }

  return (
    <section
      className="w-full rounded-2xl border border-amber-300/70 dark:border-amber-900/70 bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100 dark:from-amber-950/40 dark:via-orange-950/25 dark:to-amber-950/30 shadow-md shadow-amber-200/40 dark:shadow-black/30 overflow-hidden"
      aria-label="Rare sightings nearby"
    >
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-amber-400/30 dark:bg-amber-500/20 border border-amber-400/60 dark:border-amber-500/40 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] tracking-tight">
                Rare sightings nearby
              </h2>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide rounded-full bg-amber-400 text-amber-950 dark:bg-amber-500 dark:text-amber-950 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-950/80 animate-pulse" aria-hidden="true" />
                Rare bird alert
              </span>
            </div>
            <p className="text-[var(--text-secondary)] mt-1 text-sm sm:text-base">
              The birds birders chase — rare or unusual species reported in your area
            </p>
          </div>
        </div>

        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {sightings.map((sighting) => {
            const timeAgo = formatTimeAgo(sighting.observedAt);
            const distance =
              typeof sighting.latitude === 'number' && typeof sighting.longitude === 'number'
                ? formatDistanceAway(sighting.latitude, sighting.longitude, latitude, longitude)
                : null;
            const image = imageMap[sighting.commonName];
            const imageUrl = image?.imageUrl ?? null;
            const showPlaceholder = !imageUrl;

            return (
              <li
                key={sighting.id}
                className="group bg-white dark:bg-[var(--warm-sand)] rounded-xl border border-amber-200 dark:border-amber-900/70 overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
              >
                {/* Photo preview */}
                <div className="relative w-full h-40 bg-[var(--warm-cream)] overflow-hidden">
                  {imageUrl && (
                    <Image
                      src={imageUrl}
                      alt={sighting.commonName}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      unoptimized={imageUrl.includes('wikimedia.org')}
                    />
                  )}
                  {showPlaceholder && (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-200/40 to-orange-200/30 dark:from-amber-900/30 dark:to-orange-900/20">
                      <Bird className="w-12 h-12 text-amber-500/50 dark:text-amber-600/50" aria-hidden="true" />
                    </div>
                  )}
                  {/* Rare badge overlaid on photo */}
                  <span className="absolute top-2.5 right-2.5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-amber-400 text-amber-950 backdrop-blur-sm shadow-sm">
                    Rare
                  </span>
                  {/* Wikimedia license requires a credit next to the photo */}
                  {imageUrl && image?.attribution && (
                    <div className="absolute bottom-1.5 left-1.5 right-1.5 flex justify-start">
                      {image.attributionUrl ? (
                        <a
                          href={image.attributionUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={image.attribution}
                          className="max-w-full truncate rounded bg-black/40 px-1.5 py-0.5 text-[10px] leading-tight text-white/85 backdrop-blur-[2px] hover:bg-black/60 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/60 transition-colors"
                        >
                          © {image.attribution}
                        </a>
                      ) : (
                        <span
                          title={image.attribution}
                          className="max-w-full truncate rounded bg-black/40 px-1.5 py-0.5 text-[10px] leading-tight text-white/85 backdrop-blur-[2px]"
                        >
                          © {image.attribution}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="p-3.5 flex flex-col gap-1">
                  <p className="font-bold text-sm text-[var(--text-primary)] leading-snug">
                    {sighting.scientificName ? (
                      <span
                        className="block text-xs font-medium italic text-[var(--text-secondary)]"
                        title={sighting.scientificName}
                      >
                        {sighting.scientificName}
                      </span>
                    ) : null}
                    {sighting.commonName}
                  </p>
                  <p
                    className="text-xs text-[var(--text-secondary)] flex items-center gap-1 min-w-0"
                    title={sighting.locationName}
                  >
                    <MapPin className="w-3 h-3 flex-shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                    <span className="truncate">{sighting.locationName}</span>
                  </p>
                  <p className="text-xs text-[var(--text-secondary)] mt-auto pt-1 flex items-center gap-1">
                    <Clock className="w-3 h-3 flex-shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                    {distance}
                    {distance && timeAgo ? ' · ' : ''}
                    {timeAgo}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
