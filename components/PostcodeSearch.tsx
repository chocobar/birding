'use client';

import { useState, FormEvent, ChangeEvent } from 'react';
import { Search, MapPin } from 'lucide-react';
import { validatePostcode, normalizePostcode } from '@/lib/utils/postcodeValidator';

interface PostcodeSearchProps {
  onSearch: (postcode: string) => void;
  isLoading?: boolean;
}

export default function PostcodeSearch({ onSearch, isLoading = false }: PostcodeSearchProps) {
  const [inputValue, setInputValue] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    
    // Clear error on input change
    if (validationError) {
      setValidationError(null);
    }
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    const trimmedValue = inputValue.trim();
    
    if (!trimmedValue) {
      setValidationError('Please enter a postcode');
      return;
    }

    if (!validatePostcode(trimmedValue)) {
      setValidationError('Please enter a valid UK postcode (e.g. SW1A 1AA, M1 1AE)');
      return;
    }

    const normalized = normalizePostcode(trimmedValue);
    setValidationError(null);
    onSearch(normalized);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  const handleGetLocation = async () => {
    if (!navigator.geolocation) {
      setValidationError('Geolocation is not supported by your browser');
      return;
    }

    setIsGettingLocation(true);
    setValidationError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          
          const response = await fetch(
            `https://api.postcodes.io/postcodes?lon=${longitude}&lat=${latitude}&limit=1`
          );

          if (!response.ok) {
            throw new Error('Failed to find postcode for your location');
          }

          const data = await response.json();
          
          if (data.result && data.result.length > 0) {
            const postcode = data.result[0].postcode;
            setInputValue(postcode);
            setIsGettingLocation(false);
            onSearch(postcode);
          } else {
            throw new Error('No postcode found for your location');
          }
        } catch (error) {
          setIsGettingLocation(false);
          setValidationError(
            error instanceof Error 
              ? error.message 
              : 'Failed to get your location'
          );
        }
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
        
        setValidationError(errorMessage);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative shadow-sm rounded-full">
          <input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Enter your UK postcode…"
            disabled={isLoading}
            className={`w-full px-6 py-4 pr-28 text-base font-medium text-[var(--text-primary)] border rounded-full focus:outline-none focus:ring-2 transition-all ${
              validationError
                ? 'border-red-400 focus:ring-red-300'
                : 'border-[var(--border-light)] focus:border-[var(--brand-green)] focus:ring-[var(--brand-green-light)]'
            } ${isLoading ? 'bg-[var(--warm-sand)] cursor-not-allowed' : 'bg-white'}`}
            aria-label="Location search"
            aria-invalid={!!validationError}
            aria-describedby={validationError ? 'postcode-error' : undefined}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1.5">
            <button
              type="button"
              onClick={handleGetLocation}
              disabled={isLoading || isGettingLocation}
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
              disabled={isLoading || !inputValue.trim() || isGettingLocation}
              className="p-2.5 bg-[var(--brand-green)] text-white rounded-full hover:bg-[var(--brand-green-dark)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--brand-green)] focus:ring-offset-2"
              aria-label="Search"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Search className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
        
        {validationError && (
          <p
            id="postcode-error"
            className="mt-2 ml-4 text-sm text-red-600"
            role="alert"
          >
            {validationError}
          </p>
        )}
      </form>

      <p className="mt-3 text-center text-sm text-[var(--text-secondary)]">
        Enter a postcode or tap <MapPin className="w-3.5 h-3.5 inline -mt-0.5" /> to auto-detect
      </p>
    </div>
  );
}