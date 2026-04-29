'use client';

import { useState } from 'react';
import Link from 'next/link';
import PostcodeSearch from '@/components/PostcodeSearch';
import BirdList from '@/components/BirdList';
import LocationList from '@/components/LocationList';
import { geocodePostcode } from '@/lib/api/postcodeClient';
import { useBirdSearch, useLocationSearch } from '@/lib/hooks/useBirdSearch';
import { Bird as BirdIcon, Binoculars, MapPin, Feather } from 'lucide-react';

interface Coords {
  latitude: number;
  longitude: number;
}

export default function Home() {
  const [postcode, setPostcode] = useState('');
  const [coords, setCoords] = useState<Coords | null>(null);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);

  const birdQuery = useBirdSearch(coords?.latitude ?? null, coords?.longitude ?? null);
  const locationQuery = useLocationSearch(coords?.latitude ?? null, coords?.longitude ?? null);

  const handleSearch = async (searchPostcode: string) => {
    setPostcode(searchPostcode);
    setGeocodeError(null);
    setCoords(null);
    setIsGeocoding(true);

    try {
      const postcodeData = await geocodePostcode(searchPostcode);
      setCoords({ latitude: postcodeData.latitude, longitude: postcodeData.longitude });
    } catch (error) {
      setGeocodeError(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setIsGeocoding(false);
    }
  };

  const isLoadingBirds = isGeocoding || birdQuery.isLoading;
  const isLoadingLocations = isGeocoding || locationQuery.isLoading;
  const isLoading = isLoadingBirds || isLoadingLocations;
  const error = geocodeError
    || (birdQuery.error ? String(birdQuery.error) : null)
    || (locationQuery.error ? String(locationQuery.error) : null);
  const hasSearched = postcode !== '';

  const birds = birdQuery.data?.birds ?? [];
  const isLiveData = birdQuery.data?.isLiveData ?? false;
  const locations = locationQuery.data ?? [];

  return (
    <div className="min-h-screen bg-[var(--warm-cream)]">
      {/* Header */}
      <header className="bg-[var(--accent-teal)] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
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
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Search Section */}
        <section className="py-10 sm:py-14">
          <PostcodeSearch
            onSearch={handleSearch}
            isLoading={isLoading}
          />
        </section>

        {/* Error Message */}
        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-red-800 text-center">
              <strong>Error:</strong> {error}
            </p>
          </div>
        )}

        {/* Results Section */}
        {hasSearched && !error && (
          <div className="space-y-14 pb-16">
            {/* Birds Section */}
            <BirdList
              birds={birds}
              isLoading={isLoadingBirds}
              isLiveData={isLiveData}
            />

            {/* Locations Section */}
            <LocationList
              locations={locations}
              isLoading={isLoadingLocations}
              postcode={postcode}
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
                Enter your postcode to explore common species and find the best birdwatching spots nearby.
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
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--border-light)] mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <p className="text-center text-xs text-[var(--text-secondary)]">
            Data from{' '}
            <a href="https://postcodes.io" target="_blank" rel="noopener noreferrer" className="text-[var(--brand-green)] underline decoration-[var(--brand-green-light)] hover:decoration-[var(--brand-green)]">Postcodes.io</a>
            {' · '}
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="text-[var(--brand-green)] underline decoration-[var(--brand-green-light)] hover:decoration-[var(--brand-green)]">OpenStreetMap</a>
            {' · '}
            Bird images from{' '}
            <a href="https://commons.wikimedia.org" target="_blank" rel="noopener noreferrer" className="text-[var(--brand-green)] underline decoration-[var(--brand-green-light)] hover:decoration-[var(--brand-green)]">Wikimedia Commons</a>
            {' · '}
            UK postcodes currently supported
          </p>
        </div>
      </footer>
    </div>
  );
}