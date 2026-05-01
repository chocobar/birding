'use client';

import { useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { X } from 'lucide-react';
import { formatDistance } from '@/lib/utils/distanceCalculator';

const LocationMap = dynamic(() => import('./LocationMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-[var(--warm-cream)]">
      <div className="text-[var(--text-secondary)] text-sm animate-pulse">Loading map…</div>
    </div>
  ),
});

interface MapModalProps {
  name: string;
  type: string;
  distance: number;
  latitude: number;
  longitude: number;
  onClose: () => void;
}

export default function MapModal({ name, type, distance, latitude, longitude, onClose }: MapModalProps) {
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [handleEscape]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`Map showing ${name}`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Modal panel */}
      <div className="relative z-10 w-full max-w-4xl h-[85vh] sm:h-[80vh] bg-[var(--warm-sand)] rounded-2xl border border-[var(--border-light)] shadow-2xl flex flex-col overflow-hidden animate-fade-in-up">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-[var(--border-light)] bg-[var(--warm-cream)]">
          <div className="min-w-0 flex-1">
            <h2 className="text-base sm:text-lg font-semibold text-[var(--text-primary)] truncate">
              {name}
            </h2>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
              {type} · {formatDistance(distance)} away
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 ml-3 w-9 h-9 flex items-center justify-center rounded-full hover:bg-[var(--border-light)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--brand-green)] focus:ring-offset-2"
            aria-label="Close map"
          >
            <X className="w-5 h-5 text-[var(--text-secondary)]" />
          </button>
        </div>

        {/* Map */}
        <div className="flex-1 relative">
          <LocationMap
            latitude={latitude}
            longitude={longitude}
            name={name}
            typeLabel={type}
            distance={distance}
          />
        </div>
      </div>
    </div>
  );
}