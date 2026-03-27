'use client';

import BirdCard from './BirdCard';
import { Bird } from 'lucide-react';

interface BirdListProps {
  birds: Array<{
    id: string;
    commonName: string;
    scientificName: string;
    imageUrl?: string;
    description?: string;
    conservationStatus?: string;
    frequency?: number;
    locationName?: string;
    observationDate?: string;
  }>;
  isLoading?: boolean;
  isLiveData?: boolean;
}

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

export default function BirdList({ birds, isLoading = false, isLiveData }: BirdListProps) {
  if (isLoading) {
    return (
      <section className="w-full" aria-label="Loading bird results">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, index) => (
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
        {birds.map((bird) => (
          <BirdCard key={bird.id} bird={bird} />
        ))}
      </div>
    </section>
  );
}