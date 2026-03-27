'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Bird } from 'lucide-react';

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
  };
}

export default function BirdCard({ bird }: BirdCardProps) {
  const [resolvedImageUrl, setResolvedImageUrl] = useState<string | null>(
    bird.imageUrl || null
  );
  const [imageLoading, setImageLoading] = useState(!bird.imageUrl);
  const [imageError, setImageError] = useState(false);

  // Fetch image from Wikipedia API when no imageUrl is provided (eBird live data)
  // or always try Wikipedia for better quality species-specific photos
  useEffect(() => {
    let cancelled = false;

    async function fetchWikiImage() {
      try {
        const params = new URLSearchParams({ name: bird.commonName });
        if (bird.scientificName) {
          params.set('scientificName', bird.scientificName);
        }
        const res = await fetch(`/api/bird-image?${params.toString()}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data.imageUrl) {
          setResolvedImageUrl(data.imageUrl);
          setImageError(false);
        }
      } catch {
        // Silently fail — fallback image or placeholder will be used
      } finally {
        if (!cancelled) setImageLoading(false);
      }
    }

    fetchWikiImage();
    return () => {
      cancelled = true;
    };
  }, [bird.commonName, bird.scientificName]);

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

  const showPlaceholder = !resolvedImageUrl || imageError;

  return (
    <article className="group bg-[var(--warm-sand)] rounded-xl border border-[var(--border-light)] overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
      {/* Image */}
      <div className="relative w-full h-52 bg-[var(--warm-cream)] overflow-hidden">
        {imageLoading && !resolvedImageUrl && (
          <div className="w-full h-full flex items-center justify-center animate-pulse">
            <Bird className="w-12 h-12 text-[var(--brand-green-light)]" />
          </div>
        )}
        {resolvedImageUrl && !imageError && (
          <Image
            src={resolvedImageUrl}
            alt={`${bird.commonName} — ${bird.scientificName}`}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            priority={false}
            unoptimized={resolvedImageUrl.includes('wikimedia.org')}
            onError={() => setImageError(true)}
          />
        )}
        {showPlaceholder && !imageLoading && (
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
                📍 {bird.locationName}
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
  );
}