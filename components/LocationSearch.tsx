'use client';

import { useState, useRef, useEffect, ChangeEvent, KeyboardEvent } from 'react';
import { Search, MapPin } from 'lucide-react';
import { GeocodedLocation } from '@/lib/types';
import { searchLocations, reverseGeocode } from '@/lib/api/geocodeClient';

interface LocationSearchProps {
  onSearch: (location: GeocodedLocation) => void;
  isLoading?: boolean;
}

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 3;
const LISTBOX_ID = 'location-suggestions';

export default function LocationSearch({ onSearch, isLoading = false }: LocationSearchProps) {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<GeocodedLocation[]>([]);
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSeqRef = useRef(0);

  // Close the dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsSuggestionsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Clear pending debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  const clearSuggestions = () => {
    setSuggestions([]);
    setIsSuggestionsOpen(false);
    setActiveIndex(-1);
    setIsSuggesting(false);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    setSearchError(null);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const trimmed = value.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      clearSuggestions();
      return;
    }

    setIsSuggesting(true);
    debounceTimerRef.current = setTimeout(async () => {
      const seq = ++requestSeqRef.current;
      try {
        const results = await searchLocations(trimmed);
        if (seq !== requestSeqRef.current) return; // stale response
        setSuggestions(results);
        setActiveIndex(-1);
        setIsSuggestionsOpen(true);
      } catch {
        if (seq !== requestSeqRef.current) return;
        clearSuggestions();
      } finally {
        if (seq === requestSeqRef.current) {
          setIsSuggesting(false);
        }
      }
    }, DEBOUNCE_MS);
  };

  const selectSuggestion = (location: GeocodedLocation) => {
    setInputValue(location.displayName);
    clearSuggestions();
    setSearchError(null);
    onSearch(location);
  };

  const submitFreeText = async () => {
    const query = inputValue.trim();

    if (!query) {
      setSearchError('Please enter a location');
      return;
    }

    setIsSuggestionsOpen(false);
    setIsGeocoding(true);
    setSearchError(null);

    try {
      const results = await searchLocations(query);
      if (results.length === 0) {
        setSearchError(`No location found for "${query}"`);
        return;
      }
      const best = results[0];
      setInputValue(best.displayName);
      onSearch(best);
    } catch {
      setSearchError('Failed to find that location. Please try again.');
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (isSuggestionsOpen && !isSuggesting && suggestions.length > 0) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setActiveIndex((prev) => (prev + 1) % suggestions.length);
          return;
        case 'ArrowUp':
          e.preventDefault();
          setActiveIndex((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
          return;
        case 'Escape':
          e.preventDefault();
          setIsSuggestionsOpen(false);
          return;
        case 'Enter':
          if (activeIndex >= 0) {
            e.preventDefault();
            selectSuggestion(suggestions[activeIndex]);
            return;
          }
          break;
      }
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      submitFreeText();
    }
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setSearchError('Geolocation is not supported by your browser');
      return;
    }

    setIsGettingLocation(true);
    setSearchError(null);
    setIsSuggestionsOpen(false);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;

        let displayName = 'My location';
        try {
          const name = await reverseGeocode(latitude, longitude);
          if (name) displayName = name;
        } catch {
          // keep fallback name — coordinates still work for the search
        }

        setInputValue(displayName);
        setIsGettingLocation(false);
        onSearch({ displayName, latitude, longitude });
      },
      (error) => {
        setIsGettingLocation(false);
        let errorMessage = 'Failed to get your location';

        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location permission denied. Please enable location access.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information unavailable.';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out.';
            break;
        }

        setSearchError(errorMessage);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  const isBusy = isLoading || isGeocoding;
  const hasSelectableSuggestions = isSuggestionsOpen && !isSuggesting && suggestions.length > 0;

  return (
    <div ref={containerRef} className="relative w-full max-w-2xl mx-auto">
      <form onSubmit={(e) => { e.preventDefault(); submitFreeText(); }} className="relative">
        <div className="relative shadow-sm rounded-full">
          <input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Search any location…"
            disabled={isLoading}
            role="combobox"
            aria-expanded={isSuggestionsOpen}
            aria-controls={LISTBOX_ID}
            aria-activedescendant={
              hasSelectableSuggestions && activeIndex >= 0
                ? `${LISTBOX_ID}-option-${activeIndex}`
                : undefined
            }
            aria-autocomplete="list"
            aria-label="Location search"
            aria-invalid={!!searchError}
            aria-describedby={searchError ? 'location-error' : undefined}
            autoComplete="off"
            className={`w-full px-6 py-4 pr-28 text-base font-medium text-[var(--text-primary)] border rounded-full focus:outline-none focus:ring-2 transition-all ${
              searchError
                ? 'border-red-400 focus:ring-red-300'
                : 'border-[var(--border-light)] focus:border-[var(--brand-green)] focus:ring-[var(--brand-green-light)]'
            } ${isLoading ? 'bg-[var(--warm-sand)] cursor-not-allowed' : 'bg-[var(--warm-cream)]'}`}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1.5">
            <button
              type="button"
              onClick={handleGetLocation}
              disabled={isBusy || isGettingLocation}
              className="p-2.5 bg-[var(--warm-sand)] text-[var(--brand-green)] rounded-full hover:bg-[var(--brand-green-light)]/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--brand-green)] focus:ring-offset-2"
              aria-label="Use my location"
              title="Use my location"
            >
              {isGettingLocation ? (
                <div className="w-5 h-5 border-2 border-[var(--brand-green)] border-t-transparent rounded-full animate-spin" />
              ) : (
                <MapPin className="w-5 h-5" />
              )}
            </button>
            <button
              type="submit"
              disabled={isBusy || !inputValue.trim() || isGettingLocation}
              className="p-2.5 bg-[var(--brand-green)] text-white rounded-full hover:bg-[var(--brand-green-dark)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--brand-green)] focus:ring-offset-2"
              aria-label="Search"
            >
              {isBusy ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Search className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {isSuggestionsOpen && (
          <ul
            id={LISTBOX_ID}
            role="listbox"
            aria-label="Location suggestions"
            className="absolute z-20 w-full mt-2 bg-[var(--warm-cream)] border border-[var(--border-light)] rounded-2xl shadow-lg overflow-hidden max-h-80 overflow-y-auto"
          >
            {isSuggesting ? (
              <li
                role="option"
                aria-selected={false}
                aria-disabled="true"
                className="px-6 py-3.5 text-sm text-[var(--text-secondary)] flex items-center gap-2.5"
              >
                <div className="w-4 h-4 border-2 border-[var(--brand-green)] border-t-transparent rounded-full animate-spin shrink-0" />
                Searching locations…
              </li>
            ) : suggestions.length === 0 ? (
              <li
                role="option"
                aria-selected={false}
                aria-disabled="true"
                className="px-6 py-3.5 text-sm text-[var(--text-secondary)]"
              >
                No locations found
              </li>
            ) : (
              suggestions.map((suggestion, index) => (
                <li
                  key={`${suggestion.latitude},${suggestion.longitude}`}
                  id={`${LISTBOX_ID}-option-${index}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectSuggestion(suggestion)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={`px-6 py-3.5 text-sm cursor-pointer flex items-center gap-2.5 transition-colors ${
                    index === activeIndex
                      ? 'bg-[var(--warm-sand)] text-[var(--text-primary)]'
                      : 'bg-[var(--warm-cream)] text-[var(--text-primary)]'
                  }`}
                >
                  <MapPin className="w-4 h-4 text-[var(--brand-green)] shrink-0" />
                  <span className="truncate">{suggestion.displayName}</span>
                </li>
              ))
            )}
          </ul>
        )}

        {searchError && (
          <p
            id="location-error"
            className="mt-2 ml-4 text-sm text-red-600"
            role="alert"
          >
            {searchError}
          </p>
        )}
      </form>

      <p className="mt-3 text-center text-sm text-[var(--text-secondary)]">
        Type a city, region or postcode, or tap <MapPin className="w-3.5 h-3.5 inline -mt-0.5" /> to auto-detect
      </p>
    </div>
  );
}
