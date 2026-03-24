'use client';

import { useState, FormEvent, ChangeEvent } from 'react';
import { Search } from 'lucide-react';
import { validatePostcode, normalizePostcode } from '@/lib/utils/postcodeValidator';

interface PostcodeSearchProps {
  onSearch: (postcode: string) => void;
  isLoading?: boolean;
}

export default function PostcodeSearch({ onSearch, isLoading = false }: PostcodeSearchProps) {
  const [inputValue, setInputValue] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

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
      setValidationError('Please enter a valid UK postcode (e.g., SW1A 1AA, M1 1AE)');
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

  return (
    <div className="w-full max-w-2xl mx-auto">
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative">
          <input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Enter UK postcode (e.g., SW1A 1AA)"
            disabled={isLoading}
            className={`w-full px-4 py-3 pr-12 text-lg font-bold text-black border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${
              validationError
                ? 'border-red-500 focus:ring-red-500'
                : 'border-gray-300 focus:border-blue-500'
            } ${isLoading ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
            aria-label="UK postcode search"
            aria-invalid={!!validationError}
            aria-describedby={validationError ? 'postcode-error' : undefined}
          />
          <button
            type="submit"
            disabled={isLoading || !inputValue.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            aria-label="Search"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Search className="w-5 h-5" />
            )}
          </button>
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
        <p>Find common birds and nearby birding locations in the UK</p>
      </div>
    </div>
  );
}