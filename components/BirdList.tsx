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
  }>;
  isLoading?: boolean;
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden animate-pulse">
      <div className="w-full h-48 bg-gray-300" />
      <div className="p-4">
        <div className="h-6 bg-gray-300 rounded w-3/4 mb-2" />
        <div className="h-4 bg-gray-200 rounded w-1/2 mb-3" />
        <div className="h-4 bg-gray-200 rounded w-full mb-2" />
        <div className="h-4 bg-gray-200 rounded w-5/6" />
      </div>
    </div>
  );
}

export default function BirdList({ birds, isLoading = false }: BirdListProps) {
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
          <Bird className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">
            No birds found
          </h3>
          <p className="text-gray-600">
            No bird data available for this area. Try a different postcode.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="w-full" aria-label="Bird results">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          Common Birds in Your Area
        </h2>
        <p className="text-gray-600 mt-1">
          {birds.length} species frequently observed in this location
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {birds.map((bird) => (
          <BirdCard key={bird.id} bird={bird} />
        ))}
      </div>
    </section>
  );
}