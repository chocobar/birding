'use client';

import { useState } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { Bird, ExternalLink, Sparkles } from 'lucide-react';
import {
  CONSERVATION_STATUS_META,
  parseConservationCode,
} from '@/lib/utils/conservationStatus';

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
  isLiveData?: boolean;
}

export default function BirdCard({ bird, resolvedImageUrl: externalImageUrl, isLiveData }: BirdCardProps) {
  // Use externally-resolved image URL (from batch fetch), fall back to bird.imageUrl
  const displayImageUrl = externalImageUrl ?? bird.imageUrl ?? null;
  const [imageError, setImageError] = useState(false);
  const [isMapOpen, setIsMapOpen] = useState(false);

  // Build outbound link: eBird species page for live data, Wikipedia for mock/fallback
  const learnMoreUrl = isLiveData
    ? `https://ebird.org/species/${bird.id}`
    : `https://en.wikipedia.org/wiki/${bird.scientificName.replace(/ /g, '_')}`;
  const sourceName = isLiveData ? 'eBird' : 'Wikipedia';

  const statusCode = parseConservationCode(bird.conservationStatus);
  const statusMeta = statusCode ? CONSERVATION_STATUS_META[statusCode] : null;

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
        {/* Extinction status badge overlaid on image */}
        {statusCode && statusMeta && (
          <span
            className={`absolute top-3 right-3 px-2 py-0.5 text-xs font-semibold rounded-full backdrop-blur-sm ${statusMeta.chipClassName}`}
            title={`${statusMeta.label} — ${statusMeta.rarityNote}`}
            aria-label={`IUCN status: ${statusMeta.label}`}
          >
            {statusMeta.label}
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

        {/* Rare-find callout for threatened / extinct species */}
        {statusMeta?.rare && (
          <div className="mb-3">
            <span
              className={`inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-md ${statusMeta.chipClassName}`}
              title={`IUCN status: ${statusMeta.label}`}
            >
              <Sparkles className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
              Rare find — {statusMeta.rarityNote}
            </span>
          </div>
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

        {/* Learn more link */}
        <a
          href={learnMoreUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Learn more about ${bird.commonName} on ${sourceName}`}
          className="mt-3 inline-flex items-center gap-1.5 text-sm text-[var(--brand-green)] hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--brand-green)] focus:ring-offset-2 rounded"
        >
          Learn more on {sourceName}
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
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
