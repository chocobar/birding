'use client';

import { useState } from 'react';
import LocationCard from './LocationCard';
import { MapPin, ChevronDown } from 'lucide-react';
import { Location } from '@/lib/types';

const PAGE_SIZE = 5;

type FilterKey = 'all' | 'route' | 'park' | 'water' | 'woodland' | 'nature_reserve' | 'trail';

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'route', label: 'Routes' },
  { key: 'park', label: 'Parks' },
  { key: 'water', label: 'Water' },
  { key: 'woodland', label: 'Woodland' },
  { key: 'nature_reserve', label: 'Reserves' },
  { key: 'trail', label: 'Trails' },
];

interface LocationListProps {
  locations: Location[];
  isLoading?: boolean;
  postcode?: string;
}

function SkeletonCard() {
  return (
    <div className="bg-[var(--warm-sand)] rounded-xl border border-[var(--border-light)] p-4 animate-pulse">
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 bg-[var(--border-light)] rounded-xl" />
        <div className="flex-1">
          <div className="h-5 bg-[var(--border-light)] rounded-lg w-3/4 mb-2" />
          <div className="h-4 bg-[var(--border-light)]/60 rounded-full w-1/4 mb-3" />
          <div className="h-4 bg-[var(--border-light)]/60 rounded-lg w-full mb-2" />
          <div className="h-4 bg-[var(--border-light)]/60 rounded-lg w-5/6" />
        </div>
      </div>
    </div>
  );
}

function FilterChips({
  active,
  counts,
  onChange,
}: {
  active: FilterKey;
  counts: Record<FilterKey, number>;
  onChange: (key: FilterKey) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Filter locations by type">
      {FILTERS.map(({ key, label }) => {
        if (key !== 'all' && counts[key] === 0) return null;
        const isActive = active === key;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            aria-pressed={isActive}
            className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--brand-green)] focus:ring-offset-1 ${
              isActive
                ? 'bg-[var(--brand-green)] text-white border-[var(--brand-green)]'
                : 'bg-[var(--warm-sand)] text-[var(--text-secondary)] border-[var(--border-light)] hover:border-[var(--brand-green)] hover:text-[var(--brand-green)]'
            }`}
          >
            {label} ({counts[key]})
          </button>
        );
      })}
    </div>
  );
}

export default function LocationList({ locations, isLoading = false, postcode }: LocationListProps) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [prevLocations, setPrevLocations] = useState(locations);

  if (prevLocations !== locations) {
    setPrevLocations(locations);
    setVisibleCount(PAGE_SIZE);
    setFilter('all');
  }

  if (isLoading) {
    return (
      <section className="w-full" aria-label="Loading location results">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
            Nearby Birding Locations
          </h2>
        </div>
        <div className="space-y-3">
          {Array.from({ length: PAGE_SIZE }).map((_, index) => (
            <SkeletonCard key={index} />
          ))}
        </div>
      </section>
    );
  }

  if (!locations || locations.length === 0) {
    return (
      <section className="w-full py-12 text-center" aria-label="No locations found">
        <div className="max-w-md mx-auto">
          <MapPin className="w-14 h-14 text-[var(--brand-green-light)] mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
            No nearby locations found
          </h3>
          <p className="text-[var(--text-secondary)]">
            No birding locations found within 5 miles. Try a different postcode or check back later.
          </p>
        </div>
      </section>
    );
  }

  const counts = FILTERS.reduce(
    (acc, { key }) => {
      acc[key] = key === 'all'
        ? locations.length
        : locations.filter((location) => location.type === key).length;
      return acc;
    },
    {} as Record<FilterKey, number>,
  );

  const filtered = filter === 'all'
    ? locations
    : locations.filter((location) => location.type === filter);

  const visibleLocations = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  const handleFilterChange = (key: FilterKey) => {
    setFilter(key);
    setVisibleCount(PAGE_SIZE);
  };

  return (
    <section className="w-full" aria-label="Nearby birding locations">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
          Nearby Birding Locations
        </h2>
        <p className="text-[var(--text-secondary)] mt-1">
          {filtered.length} location{filtered.length !== 1 ? 's' : ''} within 5 miles
          {postcode && ` of ${postcode}`}
          {filter !== 'all' && ` (${FILTERS.find((f) => f.key === filter)?.label})`}
        </p>
      </div>

      <div className="mb-6">
        <FilterChips active={filter} counts={counts} onChange={handleFilterChange} />
      </div>

      <div className="space-y-3">
        {visibleLocations.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)] py-6 text-center">
            No locations of this type were found nearby.
          </p>
        ) : (
          visibleLocations.map((location, index) => (
            <div
              key={location.id}
              className={index >= PAGE_SIZE ? 'animate-fade-in-up' : ''}
            >
              <LocationCard location={location} />
            </div>
          ))
        )}
      </div>

      {hasMore && (
        <div className="flex flex-col items-center mt-6 gap-1">
          <button
            onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
            className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-[var(--brand-green)] bg-[var(--warm-sand)] border border-[var(--border-light)] rounded-full hover:bg-[var(--brand-green)] hover:text-white hover:border-[var(--brand-green)] transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--brand-green)] focus:ring-offset-2"
          >
            Show more locations
            <ChevronDown className="w-4 h-4" />
          </button>
          <p className="text-xs text-[var(--text-secondary)]">
            Showing {visibleLocations.length} of {filtered.length}
          </p>
        </div>
      )}
    </section>
  );
}
