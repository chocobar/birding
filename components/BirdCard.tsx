'use client';

import { useState } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { Bird, ExternalLink, Pause, Play, LoaderCircle } from 'lucide-react';
import { useMapOpen } from './MapOpenContext';
import { BirdSoundInfo } from '@/lib/api/xenoCantoLookup';

const MapModal = dynamic(() => import('./MapModal'), { ssr: false });

interface BirdCardProps {
  bird: {
    id: string;
    speciesCode?: string;
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
  imageAttribution?: string | null;
  imageAttributionUrl?: string | null;
  isLiveData?: boolean;
  /** Recording for this species; absent/null when nothing was found */
  sound?: BirdSoundInfo | null;
  /** True while this card's clip is the active one (playing or paused) */
  isSoundActive?: boolean;
  isSoundPlaying?: boolean;
  isSoundLoading?: boolean;
  onToggleSound?: (sound: BirdSoundInfo) => void;
}

export default function BirdCard({
  bird,
  resolvedImageUrl: externalImageUrl,
  imageAttribution,
  imageAttributionUrl,
  isLiveData,
  sound,
  isSoundActive = false,
  isSoundPlaying = false,
  isSoundLoading = false,
  onToggleSound,
}: BirdCardProps) {
  // Use externally-resolved image URL (from batch fetch), fall back to bird.imageUrl
  const displayImageUrl = externalImageUrl ?? bird.imageUrl ?? null;
  const [imageError, setImageError] = useState(false);
  const { openMapId, openMap, closeMap } = useMapOpen();
  const mapKey = `bird:${bird.id}`;
  const isMapOpen = openMapId === mapKey;

  // Build outbound link: eBird species page for live data, Wikipedia for mock/fallback.
  // Live records get a unique per-sighting id, so the species code is what
  // points at the eBird species page.
  const learnMoreUrl = isLiveData
    ? `https://ebird.org/species/${bird.speciesCode ?? bird.id}`
    : `https://en.wikipedia.org/wiki/${bird.scientificName.replace(/ /g, '_')}`;
  const sourceName = isLiveData ? 'eBird' : 'Wikipedia';

  const conservationColors: Record<string, string> = {
    LC: 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-200 dark:border-emerald-800',
    NT: 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/70 dark:text-amber-200 dark:border-amber-800',
    VU: 'bg-orange-50 text-orange-700 border border-orange-200 dark:bg-orange-950/70 dark:text-orange-200 dark:border-orange-800',
    EN: 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/70 dark:text-red-200 dark:border-red-800',
    CR: 'bg-red-100 text-red-800 border border-red-300 dark:bg-red-950 dark:text-red-100 dark:border-red-700',
  };

  const conservationLabels: Record<string, string> = {
    LC: 'Least Concern',
    NT: 'Near Threatened',
    VU: 'Vulnerable',
    EN: 'Endangered',
    CR: 'Critically Endangered',
  };

  const showPlaceholder = !displayImageUrl || imageError;

  const canPlaySound = Boolean(sound?.audioUrl && sound?.recordingId && onToggleSound);

  // CC BY / CC BY-SA images require author + license credit; the batch fetch
  // resolves both from the Commons file metadata. Photos served straight from
  // the mock data's Unsplash URLs get an Unsplash credit instead.
  const isWikimediaImage = Boolean(externalImageUrl);
  const creditText = isWikimediaImage ? imageAttribution : 'Photo via Unsplash';
  const creditUrl = isWikimediaImage
    ? imageAttributionUrl
    : 'https://unsplash.com';

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
        {!showPlaceholder && creditText && (
          <div className="absolute bottom-1.5 left-1.5 right-1.5 flex justify-start">
            {creditUrl ? (
              <a
                href={creditUrl}
                target="_blank"
                rel="noopener noreferrer"
                title={creditText}
                className="max-w-full truncate rounded bg-black/40 px-1.5 py-0.5 text-[10px] leading-tight text-white/85 backdrop-blur-[2px] hover:bg-black/60 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/60 transition-colors"
              >
                © {creditText}
              </a>
            ) : (
              <span
                title={creditText}
                className="max-w-full truncate rounded bg-black/40 px-1.5 py-0.5 text-[10px] leading-tight text-white/85 backdrop-blur-[2px]"
              >
                © {creditText}
              </span>
            )}
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
                    onClick={() => openMap(mapKey)}
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

        {/* Play sound + learn more link */}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          {canPlaySound && (
            <button
              type="button"
              onClick={() => onToggleSound?.(sound!)}
              aria-label={`${isSoundPlaying ? 'Pause' : 'Play'} ${bird.commonName} audio`}
              title={
                isSoundPlaying
                  ? `Pause ${bird.commonName} audio`
                  : `Play ${bird.commonName} audio`
              }
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--brand-green)] focus:ring-offset-2 ${
                isSoundPlaying
                  ? 'bg-[var(--brand-green)] text-white border-[var(--brand-green)]'
                  : 'bg-[var(--warm-sand)] text-[var(--brand-green)] border-[var(--border-light)] hover:bg-[var(--brand-green)] hover:text-white hover:border-[var(--brand-green)]'
              }`}
            >
              {isSoundLoading ? (
                <LoaderCircle className="w-4 h-4 animate-spin" aria-hidden="true" />
              ) : isSoundPlaying ? (
                <Pause className="w-4 h-4" aria-hidden="true" />
              ) : (
                <Play className="w-4 h-4" aria-hidden="true" />
              )}
              <span>{isSoundPlaying ? 'Pause' : 'Play'}</span>
            </button>
          )}
          <a
            href={learnMoreUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Learn more about ${bird.commonName} on ${sourceName}`}
            className="inline-flex items-center gap-1.5 text-sm text-[var(--brand-green)] hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--brand-green)] focus:ring-offset-2 rounded"
          >
            Learn more on {sourceName}
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* Xeno-canto requires crediting the recordist and license; the
            credit shows while this card's clip is the active one. */}
        {sound && isSoundActive && (
          <p className="mt-2 text-xs text-[var(--text-secondary)] leading-snug">
            {sound.pageUrl ? (
              <a
                href={sound.pageUrl}
                target="_blank"
                rel="noopener noreferrer"
                title={`Recording page: ${sound.pageUrl}`}
                className="underline decoration-[var(--border-light)] hover:decoration-[var(--brand-green)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-green)] focus:ring-offset-2 rounded"
              >
                © {sound.recordist ?? 'Xeno-canto contributor'}
                {sound.license ? ` · ${sound.license}` : ''} · via Xeno-canto
              </a>
            ) : (
              <span>
                © {sound.recordist ?? 'Xeno-canto contributor'}
                {sound.license ? ` · ${sound.license}` : ''} · via Xeno-canto
              </span>
            )}
          </p>
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
        onClose={closeMap}
      />
    )}
    </>
  );
}
