'use client';

import { useEffect, useMemo, useState } from 'react';
import BirdCard from './BirdCard';
import TimeRangeFilter from './TimeRangeFilter';
import { Bird, ChevronDown } from 'lucide-react';
import { getTimeRange, TimeRangeId } from '@/lib/types/TimeRange';

interface BirdData {
  id: string;
  commonName: string;
  scientificName: string;
  imageUrl?: string;
  description?: string;
  conservationStatus?: string;
  frequency?: number;
  locationName?: string;
  observationDate?: string;
}

interface BirdImageInfo {
  imageUrl: string | null;
  attribution: string | null;
  attributionUrl: string | null;
}

interface BirdListProps {
  birds: BirdData[];
  isLoading?: boolean;
  isLiveData?: boolean;
  timeRangeId?: TimeRangeId;
  onTimeRangeChange?: (id: TimeRangeId) => void;
  coverageLimited?: boolean;
  isUpdating?: boolean;
}

/** How many birds to show per page */
const PAGE_SIZE = 6;

/** /api/bird-images accepts at most 20 birds per request */
const IMAGE_BATCH_SIZE = 20;

function SkeletonCard() {
  return (
    <div className="bg-[var(--warm-sand)] rounded-xl border border-[var(--border-light)] overflow-hidden animate-pulse">
      <div className="w-full h-52 bg-[var(--warm-cream)]" />
      <div className="p-4">
        <div className="h-5 bg-[var(--border-light)] rounded-lg w-3/4 mb-2" />
        <div className="h-4 bg-[var(--border-light)]/60 rounded-lg w-1/2 mb-3" />
        <div className="h-4 bg-[var(--border-light)]/60 rounded-lg w-full mb-2" />
        <div className="h-4 bg-[var(--border-light)]/60 rounded-lg w-5/6" />
      </div>
    </div>
  );
}

/** Distinct species within a set of sighting records (image lookups are per species) */
function uniqueSpecies(birds: BirdData[]): BirdData[] {
  const seen = new Set<string>();
  return birds.filter((b) => {
    if (seen.has(b.commonName)) return false;
    seen.add(b.commonName);
    return true;
  });
}

/**
 * Fetch image URLs for a list of birds, batching into requests of at most
 * IMAGE_BATCH_SIZE entries.
 */
async function fetchBirdImages(
  birds: BirdData[]
): Promise<Record<string, BirdImageInfo>> {
  if (birds.length === 0) return {};

  const batches: BirdData[][] = [];
  for (let i = 0; i < birds.length; i += IMAGE_BATCH_SIZE) {
    batches.push(birds.slice(i, i + IMAGE_BATCH_SIZE));
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
          birds: batch.map((b) => ({
            name: b.commonName,
            scientificName: b.scientificName,
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

export default function BirdList({
  birds,
  isLoading = false,
  isLiveData,
  timeRangeId,
  onTimeRangeChange,
  coverageLimited = false,
  isUpdating = false,
}: BirdListProps) {
  const [imageMap, setImageMap] = useState<Record<string, BirdImageInfo>>({});
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [prevBirds, setPrevBirds] = useState(birds);

  if (prevBirds !== birds) {
    setPrevBirds(birds);
    setVisibleCount(PAGE_SIZE);
  }

  const visibleBirds = useMemo(
    () => birds.slice(0, visibleCount),
    [birds, visibleCount]
  );

  // Batch-fetch images for the species currently on screen, skipping names
  // that were resolved before so paging deeper only looks up new arrivals
  useEffect(() => {
    if (!visibleBirds || visibleBirds.length === 0) return;

    const missing = uniqueSpecies(visibleBirds).filter(
      (b) => !(b.commonName in imageMap)
    );
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
  }, [visibleBirds, imageMap]);

  if (isLoading) {
    return (
      <section className="w-full" aria-label="Loading bird results">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: PAGE_SIZE }).map((_, index) => (
            <SkeletonCard key={index} />
          ))}
        </div>
      </section>
    );
  }

  if (!birds || birds.length === 0) {
    return (
      <section className="w-full py-12 text-center" aria-label="No birds found">
        <div className="max-w-md mx-auto">
          <Bird className="w-14 h-14 text-[var(--brand-green-light)] mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
            No birds found
          </h3>
          <p className="text-[var(--text-secondary)]">
            No bird data available for this area. Try a different location.
          </p>
        </div>
      </section>
    );
  }

  const windowLabel = timeRangeId ? getTimeRange(timeRangeId).label.toLowerCase() : null;
  const hasMore = visibleCount < birds.length;

  return (
    <section className="w-full" aria-label="Bird results">
      <div className="mb-8">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
          <div>
            <h2 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
              {isLiveData ? 'Recent Bird Sightings' : 'Common Birds in Your Area'}
            </h2>
            <p className="text-[var(--text-secondary)] mt-1">
              {isLiveData
                ? `${birds.length} sightings ${windowLabel ? `in the ${windowLabel}` : 'recently observed'} near this location`
                : `${birds.length} species frequently observed in this location`}
              {isUpdating && (
                <span className="ml-2 inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand-green)] animate-pulse" />
                  Updating…
                </span>
              )}
            </p>
            {isLiveData !== undefined && (
              isLiveData ? (
                <a
                  href="https://ebird.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-950 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Powered by eBird
                </a>
              ) : (
                <span className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/70 dark:text-amber-200 dark:border-amber-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Sample data (eBird unavailable)
                </span>
              )
            )}
          </div>
          {isLiveData && timeRangeId && onTimeRangeChange && (
            <TimeRangeFilter
              value={timeRangeId}
              onChange={onTimeRangeChange}
              disabled={isUpdating}
            />
          )}
        </div>
        {isLiveData && coverageLimited && (
          <p className="mt-3 text-xs text-[var(--text-secondary)] max-w-2xl">
            eBird serves live data for the last 30 days. Sightings from earlier
            in this period appear here as our archive builds up over time.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {visibleBirds.map((bird, index) => (
          <div
            key={bird.id}
            className={index >= PAGE_SIZE ? 'animate-fade-in-up' : ''}
          >
            <BirdCard
              bird={bird}
              resolvedImageUrl={imageMap[bird.commonName]?.imageUrl ?? undefined}
              imageAttribution={imageMap[bird.commonName]?.attribution ?? undefined}
              imageAttributionUrl={imageMap[bird.commonName]?.attributionUrl ?? undefined}
              isLiveData={isLiveData}
            />
          </div>
        ))}
      </div>

      {hasMore && (
        <div className="mt-8 text-center">
          <button
            onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
            className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-[var(--brand-green)] bg-[var(--warm-sand)] border border-[var(--border-light)] rounded-full hover:bg-[var(--brand-green)] hover:text-white hover:border-[var(--brand-green)] transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--brand-green)] focus:ring-offset-2"
          >
            Show more sightings
            <ChevronDown className="w-4 h-4" />
          </button>
          <p className="mt-2 text-xs text-[var(--text-secondary)]">
            Showing {visibleBirds.length} of {birds.length}
          </p>
        </div>
      )}
    </section>
  );
}
