'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import BirdCard from './BirdCard';
import { Bird, ChevronDown } from 'lucide-react';
import { BirdSoundInfo } from '@/lib/api/xenoCantoLookup';

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
): Promise<Record<string, BirdImageInfo>> {
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

    const data: { images: Record<string, BirdImageInfo> } = await res.json();

    // Flatten to name → image info map (imageUrl + attribution kept together
    // so each photo can be credited as its Commons license requires)
    const map: Record<string, BirdImageInfo> = {};
    for (const [name, info] of Object.entries(data.images)) {
      map[name] = info;
    }
    return map;
  } catch {
    return {};
  }
}

/**
 * Fetch sound recordings for a list of birds in a single batch request,
 * keyed by scientific name. Best effort: any failure yields an empty map
 * (cards simply show no play button).
 */
async function fetchBirdSounds(
  birds: BirdData[]
): Promise<Record<string, BirdSoundInfo>> {
  const withNames = birds.filter((b) => b.scientificName?.trim());
  if (withNames.length === 0) return {};

  try {
    const res = await fetch('/api/bird-sounds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        birds: withNames.map((b) => ({
          name: b.commonName,
          scientificName: b.scientificName,
        })),
      }),
    });

    if (!res.ok) return {};

    const data: { sounds?: Record<string, BirdSoundInfo> } = await res.json();
    return data.sounds ?? {};
  } catch {
    return {};
  }
}

export default function BirdList({ birds, isLoading = false, isLiveData }: BirdListProps) {
  const [imageMap, setImageMap] = useState<Record<string, BirdImageInfo>>({});
  const [soundMap, setSoundMap] = useState<Record<string, BirdSoundInfo>>({});
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [prevBirds, setPrevBirds] = useState(birds);

  // Playback lives here so only one card's clip can ever play at a time:
  // a single shared <audio> element is retargeted whenever another card
  // plays, which stops the previous clip automatically.
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [activeRecordingId, setActiveRecordingId] = useState<string | null>(null);
  const [isSoundPlaying, setIsSoundPlaying] = useState(false);
  const [isSoundLoading, setIsSoundLoading] = useState(false);

  if (prevBirds !== birds) {
    setPrevBirds(birds);
    setVisibleCount(PAGE_SIZE);
  }

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

  // Batch-fetch recordings for the birds currently visible. The server
  // caches species → recording lookups, so paging ("Show more") only
  // queries the newly revealed species.
  useEffect(() => {
    if (!birds || birds.length === 0) return;

    let cancelled = false;

    fetchBirdSounds(birds.slice(0, visibleCount)).then((map) => {
      if (!cancelled && Object.keys(map).length > 0) {
        setSoundMap((prev) => ({ ...prev, ...map }));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [birds, visibleCount]);

  /** Stop the current clip and reset playback state (no-op when idle). */
  const stopPlayback = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    setActiveRecordingId(null);
    setIsSoundPlaying(false);
    setIsSoundLoading(false);
  }, []);

  // Stop playback when a new search swaps the list in, and never leave
  // audio running after the list unmounts.
  useEffect(() => {
    return () => {
      stopPlayback();
    };
  }, [birds, stopPlayback]);

  const ensureAudioElement = (): HTMLAudioElement => {
    if (!audioRef.current) {
      const audio = new Audio();
      audio.preload = 'auto';
      audio.addEventListener('playing', () => {
        setIsSoundPlaying(true);
        setIsSoundLoading(false);
      });
      audio.addEventListener('pause', () => setIsSoundPlaying(false));
      audio.addEventListener('ended', () => stopPlayback());
      audio.addEventListener('error', () => stopPlayback());
      audioRef.current = audio;
    }
    return audioRef.current;
  };

  const toggleSoundPlayback = (sound: BirdSoundInfo) => {
    if (!sound.audioUrl || !sound.recordingId) return;

    const audio = ensureAudioElement();

    // Same clip: pause/resume in place, keeping it "active" so the
    // attribution stays visible.
    if (activeRecordingId === sound.recordingId) {
      if (audio.paused) {
        setIsSoundLoading(true);
        audio.play().catch(() => stopPlayback());
      } else {
        audio.pause();
        setIsSoundPlaying(false);
      }
      return;
    }

    // Different clip: retarget the shared element, which stops the previous one.
    audio.pause();
    setActiveRecordingId(sound.recordingId);
    setIsSoundPlaying(false);
    setIsSoundLoading(true);
    audio.src = sound.audioUrl;
    audio.play().catch(() => stopPlayback());
  };

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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {visibleBirds.map((bird, index) => {
          const sound = soundMap[bird.scientificName];
          const soundKey = sound?.recordingId ?? null;
          return (
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
                sound={sound}
                isSoundActive={soundKey !== null && activeRecordingId === soundKey}
                isSoundPlaying={soundKey !== null && isSoundPlaying && activeRecordingId === soundKey}
                isSoundLoading={soundKey !== null && isSoundLoading && activeRecordingId === soundKey}
                onToggleSound={toggleSoundPlayback}
              />
            </div>
          );
        })}
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
