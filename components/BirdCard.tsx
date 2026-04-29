'use client';

import { useState } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { Bird } from 'lucide-react';

const MapModal = dynamic(() => import('./MapModal'), { ssr: false });

interface BirdCardProps {
  bird: {
    id: string;
    commonName: string;
    scientificName: string;
    imageUrl?: string;
    description?: string;
    conservationStatus?: string;
    frequency?: number;
    locationName?: string;
    observationDate?: string;
    latitude?: number;
    longitude?: number;
  };
  resolvedImageUrl?: string | null;
}

export default function BirdCard({ bird, resolvedImageUrl: externalImageUrl }: BirdCardProps) {
  // Use externally-resolved image URL (from batch fetch), fall back to bird.imageUrl
  const displayImageUrl = externalImageUrl ?? bird.imageUrl ?? null;
  const [imageError, setImageError] = useState(false);
  const [isMapOpen, setIsMapOpen] = useState(false);

  const conservationColors: Record<string, string> = {
    LC: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    NT: 'bg-amber-50 text-amber-700 border border-amber-200',
    VU: 'bg-orange-50 text-orange-700 border border-orange-200',
    EN: 'bg-red-50 text-red-700 border border-red-200',
    CR: 'bg-red-100 text-red-800 border border-red-300',
  };

  const conservationLabels: Record<string, string> = {
    LC: 'Least Concern',
    NT: 'Near Threatened',
    VU: 'Vulnerable',
    EN: 'Endangered',
    CR: 'Critically Endangered',
  };

  const showPlaceholder = !displayImageUrl || imageError;

  return (
    <>
    <article className="group bg-[var(--warm-sand)] rounded-xl border border-[var(--border-light)] overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
      {/* Image */}
      <div className="relative w-full h-52 bg-[var(--warm-cream)] overflow-hidden">
        {displayImageUrl && !imageError && (
          <Image
            src={displayImageUrl}
            alt={`${bird.commonName} — ${bird.scientificName}`}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            priority={false}
            unoptimized={displayImageUrl.includes('wikimedia.org')}
            onError={() => setImageError(true)}
          />
        )}
        {showPlaceholder && (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[var(--brand-green-light)]/20 to-[var(--accent-amber)]/20">
            <Bird className="w-14 h-14 text-[var(--brand-green)]/40" />
          </div>
        )}
        {/* Conservation badge overlaid on image */}
        {bird.conservationStatus &&
          conservationColors[bird.conservationStatus] && (
            <span
              className={`absolute top-3 right-3 px-2 py-0.5 text-xs font-semibold rounded-full backdrop-blur-sm ${conservationColors[bird.conservationStatus]}`}
              title={conservationLabels[bird.conservationStatus]}
            >
              {conservationLabels[bird.conservationStatus] ??
                bird.conservationStatus}
            </span>
          )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="text-lg font-bold text-[var(--text-primary)] leading-tight mb-0.5">
          {bird.commonName}
        </h3>
        <p className="text-sm text-[var(--text-secondary)] italic mb-2">
          {bird.scientificName}
        </p>

        {bird.description && (
          <p className="text-sm text-[var(--text-secondary)] line-clamp-2 mb-3">
            {bird.description}
          </p>
        )}

        {(bird.locationName || bird.observationDate) && (
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--text-secondary)] mb-3">
            {bird.locationName && (
              <span className="flex items-center gap-1">
                {bird.latitude != null && bird.longitude != null ? (
                  <button
                    onClick={() => setIsMapOpen(true)}
                    className="inline-flex items-center gap-1 text-[var(--brand-green)] hover:underline focus:outline-none"
                    aria-label={`View ${bird.locationName} on map`}
                  >
                    📍 {bird.locationName} ({bird.latitude.toFixed(3)}, {bird.longitude.toFixed(3)})
                  </button>
                ) : (
                  <>📍 {bird.locationName}</>
                )}
              </span>
            )}
            {bird.observationDate && (
              <span className="flex items-center gap-1">
                🕐 {bird.observationDate.split(' ')[0]}
              </span>
            )}
          </div>
        )}

        {bird.frequency != null && bird.frequency > 0 && (
          <div className="pt-3 border-t border-[var(--border-light)]">
            <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] mb-1.5">
              <span>Observation frequency</span>
              <span className="font-semibold text-[var(--text-primary)]">
                {Math.round(bird.frequency * 100)}%
              </span>
            </div>
            <div className="w-full bg-[var(--warm-cream)] rounded-full h-1.5">
              <div
                className="bg-[var(--brand-green)] h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${bird.frequency * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </article>
    {isMapOpen && bird.latitude != null && bird.longitude != null && (
      <MapModal
        name={bird.locationName ?? bird.commonName}
        type="Bird Sighting"
        distance={0}
        latitude={bird.latitude}
        longitude={bird.longitude}
        onClose={() => setIsMapOpen(false)}
      />
    )}
    </>
  );
}