'use client';

import LocationCard from './LocationCard';
import { MapPin } from 'lucide-react';

interface LocationListProps {
  locations: Array<{
    id: string;
    name: string;
    type: 'water' | 'woodland' | 'park' | 'nature_reserve' | 'trail';
    distance: number;
    description?: string;
    tags?: string[];
  }>;
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

export default function LocationList({ locations, isLoading = false, postcode }: LocationListProps) {
  if (isLoading) {
    return (
      <section className="w-full" aria-label="Loading location results">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
            Nearby Birding Locations
          </h2>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
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

  return (
    <section className="w-full" aria-label="Nearby birding locations">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
          Nearby Birding Locations
        </h2>
        <p className="text-[var(--text-secondary)] mt-1">
          {locations.length} location{locations.length !== 1 ? 's' : ''} within 5 miles
          {postcode && ` of ${postcode}`}
        </p>
      </div>

      <div className="space-y-3">
        {locations.map((location) => (
          <LocationCard key={location.id} location={location} />
        ))}
      </div>
    </section>
  );
}