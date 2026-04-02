'use client';

import { useState, useEffect } from 'react';
import BirdCard from './BirdCard';
import { Bird, ChevronDown } from 'lucide-react';

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

interface BirdListProps {
  birds: BirdData[];
  isLoading?: boolean;
  isLiveData?: boolean;
}

/** How many birds to show per page */
const PAGE_SIZE = 6;

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

/**
 * Fetch image URLs for a list of birds in a single batch request.
 */
async function fetchBirdImages(
  birds: BirdData[]
): Promise<Record<string, string | null>> {
  if (birds.length === 0) return {};

  try {
    const payload = birds.map((b) => ({
      name: b.commonName,
      scientificName: b.scientificName,
    }));

    const res = await fetch('/api/bird-images', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ birds: payload }),
    });

    if (!res.ok) return {};

    const data: {
      images: Record<string, { imageUrl: string | null; attribution: string | null }>;
    } = await res.json();

    // Flatten to name → imageUrl map
    const map: Record<string, string | null> = {};
    for (const [name, info] of Object.entries(data.images)) {
      map[name] = info.imageUrl;
    }
    return map;
  } catch {
    return {};
  }
}

export default function BirdList({ birds, isLoading = false, isLiveData }: BirdListProps) {
  const [imageMap, setImageMap] = useState<Record<string, string | null>>({});
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Batch-fetch images whenever the bird list changes
  useEffect(() => {
    if (!birds || birds.length === 0) return;

    let cancelled = false;

    fetchBirdImages(birds).then((map) => {
      if (!cancelled) setImageMap(map);
    });

    return () => {
      cancelled = true;
    };
  }, [birds]);

  // Reset visible count when bird list changes (new search)
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [birds]);

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
            No bird data available for this area. Try a different postcode.
          </p>
        </div>
      </section>
    );
  }

  const visibleBirds = birds.slice(0, visibleCount);
  const hasMore = visibleCount < birds.length;

  return (
    <section className="w-full" aria-label="Bird results">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
          {isLiveData ? 'Recent Bird Sightings' : 'Common Birds in Your Area'}
        </h2>
        <p className="text-[var(--text-secondary)] mt-1">
          {birds.length} species {isLiveData ? 'recently observed near this location' : 'frequently observed in this location'}
        </p>
        {isLiveData !== undefined && (
          <span
            className={`mt-2 inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
              isLiveData
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isLiveData ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            {isLiveData ? 'Live data from eBird' : 'Sample data (eBird unavailable)'}
          </span>
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
              resolvedImageUrl={imageMap[bird.commonName] ?? undefined}
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
            Show more birds
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