'use client';

import { useState } from 'react';
import PostcodeSearch from '@/components/PostcodeSearch';
import BirdList from '@/components/BirdList';
import LocationList from '@/components/LocationList';
import { geocodePostcode } from '@/lib/api/postcodeClient';
import { getBirdsForLocation } from '@/lib/api/birdClient';
import { getNearbyLocations } from '@/lib/api/locationClient';
import { Bird as BirdIcon } from 'lucide-react';

interface SearchState {
  postcode: string;
  birds: any[];
  locations: any[];
  isLoadingBirds: boolean;
  isLoadingLocations: boolean;
  error: string | null;
}

export default function Home() {
  const [searchState, setSearchState] = useState<SearchState>({
    postcode: '',
    birds: [],
    locations: [],
    isLoadingBirds: false,
    isLoadingLocations: false,
    error: null,
  });

  const handleSearch = async (postcode: string) => {
    setSearchState(prev => ({
      ...prev,
      postcode,
      isLoadingBirds: true,
      isLoadingLocations: true,
      error: null,
    }));

    try {
      // Step 1: Geocode the postcode
      const postcodeData = await geocodePostcode(postcode);

      // Step 2: Fetch birds and locations in parallel
      const [birds, locations] = await Promise.all([
        getBirdsForLocation(postcodeData.latitude, postcodeData.longitude, 5),
        getNearbyLocations(postcodeData.latitude, postcodeData.longitude, 5),
      ]);

      setSearchState(prev => ({
        ...prev,
        birds,
        locations,
        isLoadingBirds: false,
        isLoadingLocations: false,
      }));
    } catch (error) {
      console.error('Search error:', error);
      setSearchState(prev => ({
        ...prev,
        isLoadingBirds: false,
        isLoadingLocations: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      }));
    }
  };

  const hasSearched = searchState.postcode !== '';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-green-50 to-emerald-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-green-500 rounded-lg flex items-center justify-center">
              <BirdIcon className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                Birding Discovery
              </h1>
              <p className="text-sm text-gray-600 mt-0.5">
                Discover birds and birding locations anywhere in the world
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Search Section */}
        <section className="mb-12">
          <PostcodeSearch
            onSearch={handleSearch}
            isLoading={searchState.isLoadingBirds || searchState.isLoadingLocations}
          />
        </section>

        {/* Error Message */}
        {searchState.error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 text-center">
              <strong>Error:</strong> {searchState.error}
            </p>
          </div>
        )}

        {/* Results Section */}
        {hasSearched && !searchState.error && (
          <div className="space-y-12">
            {/* Birds Section */}
            <BirdList
              birds={searchState.birds}
              isLoading={searchState.isLoadingBirds}
            />

            {/* Locations Section */}
            <LocationList
              locations={searchState.locations}
              isLoading={searchState.isLoadingLocations}
              postcode={searchState.postcode}
            />
          </div>
        )}

        {/* Welcome Message (before search) */}
        {!hasSearched && (
          <section className="text-center py-16">
            <div className="max-w-2xl mx-auto">
              <BirdIcon className="w-20 h-20 text-blue-500 mx-auto mb-6" />
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                Welcome to Birding Discovery
              </h2>
              <p className="text-lg text-gray-700 mb-6">
                Enter your location above to discover:
              </p>
              <div className="grid sm:grid-cols-2 gap-6 text-left">
                <div className="bg-white p-6 rounded-lg shadow-sm">
                  <h3 className="font-semibold text-gray-900 mb-2">
                    🐦 Common Birds
                  </h3>
                  <p className="text-gray-600 text-sm">
                    See the most frequently observed bird species in your area
                  </p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-sm">
                  <h3 className="font-semibold text-gray-900 mb-2">
                    📍 Birding Locations
                  </h3>
                  <p className="text-gray-600 text-sm">
                    Find nearby parks, woodlands, and nature reserves perfect for birdwatching
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center text-sm text-gray-600 space-y-2">
            <p>
              Postcode data: <a href="https://postcodes.io" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Postcodes.io</a> (UK: Contains OS data © Crown copyright)
              {' • '}
              Location data: © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">OpenStreetMap contributors</a>
              {' • '}
              Photos: <a href="https://unsplash.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Unsplash</a>
            </p>
            <p className="text-xs">
              Currently supporting UK postcodes • Open source project • See <a href="https://github.com/yourusername/birding-3/blob/main/DATA_ATTRIBUTION.md" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">DATA_ATTRIBUTION.md</a> for license details
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}