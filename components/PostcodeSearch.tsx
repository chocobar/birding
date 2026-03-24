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
      setValidationError('Please enter a valid postcode (UK format currently supported, e.g., SW1A 1AA, M1 1AE)');
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
          
          // Use Postcodes.io reverse geocoding to find nearest postcode
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
            // Automatically search with the detected postcode
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
        <div className="relative">
          <input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Enter your postcode or location"
            disabled={isLoading}
            className={`w-full px-4 py-3 pr-12 text-lg font-bold text-black border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${
              validationError
                ? 'border-red-500 focus:ring-red-500'
                : 'border-gray-300 focus:border-blue-500'
            } ${isLoading ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
            aria-label="Location search"
            aria-invalid={!!validationError}
            aria-describedby={validationError ? 'postcode-error' : undefined}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
            <button
              type="button"
              onClick={handleGetLocation}
              disabled={isLoading || isGettingLocation}
              className="p-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
              aria-label="Use my location"
              title="Use my location"
            >
              {isGettingLocation ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <MapPin className="w-5 h-5" />
              )}
            </button>
            <button
              type="submit"
              disabled={isLoading || !inputValue.trim() || isGettingLocation}
              className="p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
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
            className="mt-2 text-sm text-red-600"
            role="alert"
          >
            {validationError}
          </p>
        )}
      </form>

      <div className="mt-4 text-center text-sm text-gray-600">
        <p>Enter your location or click <MapPin className="w-4 h-4 inline" /> to auto-detect (UK postcodes currently supported)</p>
      </div>
    </div>
  );
}