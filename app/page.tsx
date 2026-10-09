'use client';

import { useState } from 'react';
import Link from 'next/link';
import LocationSearch from '@/components/LocationSearch';
import BirdList from '@/components/BirdList';
import LocationList from '@/components/LocationList';
import NotableSightingsStrip from '@/components/NotableSightingsStrip';
import { useBirdSearch, useLocationSearch, useNotableSightings } from '@/lib/hooks/useBirdSearch';
import { GeocodedLocation } from '@/lib/types';
import {
  DEFAULT_TIME_RANGE_ID,
  getTimeRange,
  TimeRangeId,
} from '@/lib/types/TimeRange';
import { Bird as BirdIcon, Binoculars, MapPin, Feather, Moon, Sun } from 'lucide-react';

interface Coords {
  latitude: number;
  longitude: number;
}

export default function Home() {
  const [locationName, setLocationName] = useState('');
  const [coords, setCoords] = useState<Coords | null>(null);
  const [timeRangeId, setTimeRangeId] = useState<TimeRangeId>(DEFAULT_TIME_RANGE_ID);

  const timeRange = getTimeRange(timeRangeId);
  const birdQuery = useBirdSearch(coords?.latitude ?? null, coords?.longitude ?? null, timeRange.days);
  const locationQuery = useLocationSearch(coords?.latitude ?? null, coords?.longitude ?? null);
  const notableQuery = useNotableSightings(coords?.latitude ?? null, coords?.longitude ?? null);

  const handleSearch = (location: GeocodedLocation) => {
    setLocationName(location.displayName);
    setCoords({ latitude: location.latitude, longitude: location.longitude });
  };

  const isLoadingBirds = birdQuery.isLoading;
  const isLoadingLocations = locationQuery.isLoading;
  const error = birdQuery.error ? String(birdQuery.error) : null;
  const hasSearched = locationName !== '';

  const birds = birdQuery.data?.birds ?? [];
  const isLiveData = birdQuery.data?.isLiveData ?? false;
  const coverageLimited = birdQuery.data?.coverageLimited ?? false;
  const locations = locationQuery.data?.locations ?? [];
  const dataSource = locationQuery.data?.source;
  const notableSightings = notableQuery.data?.sightings ?? [];

  // eBird deserves attribution whenever any of its data is shown
  const hasEbirdData = isLiveData || (notableQuery.data?.isLiveData ?? false);

  const toggleTheme = () => {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  };

  return (
    <div className="min-h-screen bg-[var(--warm-cream)]">
      {/* Header */}
      <header className="bg-[var(--accent-teal)] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3 no-underline text-white hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-white/50 rounded-xl">
            <div className="w-10 h-10 bg-white/15 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <Feather className="w-5 h-5 text-[var(--brand-green-light)]" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
                Birding Discovery
              </h1>
              <p className="text-sm text-white/70 hidden sm:block">
                Find birds and birding spots near you
              </p>
            </div>
          </Link>
          <button
            type="button"
            onClick={toggleTheme}
            className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-white/60"
            aria-label="Toggle dark mode"
            title="Toggle dark mode"
          >
            <Moon className="w-4 h-4 dark:hidden" />
            <Sun className="hidden w-4 h-4 dark:block" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Search Section */}
        <section className="py-10 sm:py-14">
          <LocationSearch
            onSearch={handleSearch}
          />
        </section>

        {/* Error Message */}
        {error && (
          <div className="mb-8 p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl">
            <p className="text-red-800 dark:text-red-200 text-center">
              <strong>Error:</strong> {error}
            </p>
          </div>
        )}

        {/* Results Section */}
        {hasSearched && !error && (
          <div className="space-y-14 pb-16">
            {/* Rare Sightings Strip (self-hiding when unavailable) */}
            {coords && (
              <NotableSightingsStrip
                sightings={notableSightings}
                latitude={coords.latitude}
                longitude={coords.longitude}
                isLoading={notableQuery.isLoading}
              />
            )}

            {/* Birds Section */}
            <BirdList
              birds={birds}
              isLoading={isLoadingBirds}
              isLiveData={isLiveData}
              timeRangeId={timeRangeId}
              onTimeRangeChange={setTimeRangeId}
              coverageLimited={coverageLimited}
              isUpdating={birdQuery.isFetching && !isLoadingBirds}
            />

            {/* Locations Section */}
            <LocationList
              locations={locations}
              isLoading={isLoadingLocations}
              isError={locationQuery.isError}
              isRetrying={locationQuery.isRefetching}
              onRetry={() => locationQuery.refetch()}
              postcode={locationName}
              dataSource={dataSource}
            />
          </div>
        )}

        {/* Welcome Section (before search) */}
        {!hasSearched && (
          <section className="pb-20">
            <div className="max-w-3xl mx-auto text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-[var(--text-primary)] mb-3 tracking-tight">
                Discover the birds around you
              </h2>
              <p className="text-lg text-[var(--text-secondary)] max-w-xl mx-auto">
                Search any location to explore common species and find the best birdwatching spots nearby.
              </p>
            </div>

            <div className="grid sm:grid-cols-3 gap-5 max-w-3xl mx-auto">
              <div className="bg-[var(--warm-sand)] border border-[var(--border-light)] p-6 rounded-xl text-center">
                <div className="w-12 h-12 bg-[var(--brand-green)]/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <BirdIcon className="w-6 h-6 text-[var(--brand-green)]" />
                </div>
                <h3 className="font-semibold text-[var(--text-primary)] mb-1.5">
                  Species Guide
                </h3>
                <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
                  See the most frequently spotted birds in your area with photos
                </p>
              </div>

              <div className="bg-[var(--warm-sand)] border border-[var(--border-light)] p-6 rounded-xl text-center">
                <div className="w-12 h-12 bg-[var(--brand-green)]/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <MapPin className="w-6 h-6 text-[var(--brand-green)]" />
                </div>
                <h3 className="font-semibold text-[var(--text-primary)] mb-1.5">
                  Local Spots
                </h3>
                <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
                  Find parks, woodlands, and nature reserves within 5 miles
                </p>
              </div>

              <div className="bg-[var(--warm-sand)] border border-[var(--border-light)] p-6 rounded-xl text-center">
                <div className="w-12 h-12 bg-[var(--brand-green)]/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <Binoculars className="w-6 h-6 text-[var(--brand-green)]" />
                </div>
                <h3 className="font-semibold text-[var(--text-primary)] mb-1.5">
                  Live Sightings
                </h3>
                <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
                  Recent observations from eBird&apos;s global birding community
                </p>
              </div>
            </div>

            <div className="max-w-3xl mx-auto mt-12 text-center">
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                A free bird finder for every location
              </h3>
              <p className="text-[var(--text-secondary)] text-sm sm:text-base leading-relaxed">
                Birding Discovery is a free online bird guide for birders of every
                level. Search any city, town or postcode to see which birds are in
                your area right now, browse recent sightings from the eBird
                community, and discover the best birdwatching spots near you —
                from local parks and woodlands to national nature reserves.
                Whether you are new to bird identification or planning your next
                birding trip, you can find what is flying nearby in seconds.
              </p>
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--border-light)] mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          {hasEbirdData && (
            <p className="text-center text-xs text-[var(--text-secondary)] mb-2">
              Bird observations provided by{' '}
              <a href="https://ebird.org" target="_blank" rel="noopener noreferrer" className="text-[var(--brand-green)] underline decoration-[var(--brand-green-light)] hover:decoration-[var(--brand-green)]">eBird</a>
              {' — '}
              <a href="https://www.birds.cornell.edu/home/bring-birds-back/" target="_blank" rel="noopener noreferrer" className="text-[var(--brand-green)] underline decoration-[var(--brand-green-light)] hover:decoration-[var(--brand-green)]">Cornell Lab of Ornithology</a>
            </p>
          )}
          <p className="text-center text-xs text-[var(--text-secondary)]">
            Location data ©{' '}
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="text-[var(--brand-green)] underline decoration-[var(--brand-green-light)] hover:decoration-[var(--brand-green)]">OpenStreetMap contributors</a>
            {dataSource === 'geoapify' && (
              <>
                {' · '}
                <a href="https://www.geoapify.com/" target="_blank" rel="noopener noreferrer" className="text-[var(--brand-green)] underline decoration-[var(--brand-green-light)] hover:decoration-[var(--brand-green)]">Powered by Geoapify</a>
              </>
            )}
            {' · '}
            Geocoding by{' '}
            <a href="https://nominatim.openstreetmap.org" target="_blank" rel="noopener noreferrer" className="text-[var(--brand-green)] underline decoration-[var(--brand-green-light)] hover:decoration-[var(--brand-green)]">Nominatim</a>
            {' · '}
            Bird images from{' '}
            <a href="https://commons.wikimedia.org" target="_blank" rel="noopener noreferrer" className="text-[var(--brand-green)] underline decoration-[var(--brand-green-light)] hover:decoration-[var(--brand-green)]">Wikimedia Commons</a>
            {' · '}
            Bird sounds from{' '}
            <a href="https://xeno-canto.org" target="_blank" rel="noopener noreferrer" className="text-[var(--brand-green)] underline decoration-[var(--brand-green-light)] hover:decoration-[var(--brand-green)]">Xeno-canto</a>
          </p>
        </div>
      </footer>
    </div>
  );
}
