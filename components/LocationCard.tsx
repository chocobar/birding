'use client';

import { useState } from 'react';
import { MapPin, Trees, Waves, Leaf, Footprints, Map } from 'lucide-react';
import { formatDistance } from '@/lib/utils/distanceCalculator';
import dynamic from 'next/dynamic';

const MapModal = dynamic(() => import('./MapModal'), { ssr: false });

interface LocationCardProps {
  location: {
    id: string;
    name: string;
    type: 'water' | 'woodland' | 'park' | 'nature_reserve' | 'trail';
    distance: number;
    latitude: number;
    longitude: number;
    description?: string;
    tags?: string[];
  };
}

const locationIcons = {
  water: Waves,
  woodland: Trees,
  park: Leaf,
  nature_reserve: Leaf,
  trail: Footprints,
};

const locationColors = {
  water: 'bg-sky-50 text-sky-700 border border-sky-200',
  woodland: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  park: 'bg-green-50 text-green-700 border border-green-200',
  nature_reserve: 'bg-teal-50 text-teal-700 border border-teal-200',
  trail: 'bg-amber-50 text-amber-700 border border-amber-200',
};

const iconContainerColors = {
  water: 'bg-sky-100 text-sky-600',
  woodland: 'bg-emerald-100 text-emerald-600',
  park: 'bg-green-100 text-green-600',
  nature_reserve: 'bg-teal-100 text-teal-600',
  trail: 'bg-amber-100 text-amber-600',
};

const locationTypeLabels = {
  water: 'Water Body',
  woodland: 'Woodland',
  park: 'Park',
  nature_reserve: 'Nature Reserve',
  trail: 'Trail',
};

export default function LocationCard({ location }: LocationCardProps) {
  const [isMapOpen, setIsMapOpen] = useState(false);

  const Icon = locationIcons[location.type];
  const badgeClass = locationColors[location.type];
  const iconClass = iconContainerColors[location.type];
  const typeLabel = locationTypeLabels[location.type];

  return (
    <>
      <article className="group bg-[var(--warm-sand)] rounded-xl border border-[var(--border-light)] p-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
        <div className="flex items-start gap-4">
          <div className={`flex-shrink-0 w-11 h-11 rounded-xl ${iconClass} flex items-center justify-center`}>
            <Icon className="w-5 h-5" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <h3 className="text-base font-semibold text-[var(--text-primary)] leading-tight">
                {location.name}
              </h3>
              <div className="flex-shrink-0 flex items-center gap-1 text-[var(--text-secondary)]">
                <MapPin className="w-3.5 h-3.5" />
                <span className="text-sm font-medium whitespace-nowrap">
                  {formatDistance(location.distance)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 mb-2">
              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${badgeClass}`}>
                {typeLabel}
              </span>
            </div>

            {location.description && (
              <p className="text-sm text-[var(--text-secondary)] mb-2 leading-relaxed">
                {location.description}
              </p>
            )}

            <div className="flex items-center justify-between gap-2">
              {location.tags && location.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {location.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 text-xs bg-[var(--warm-cream)] text-[var(--text-secondary)] rounded-full border border-[var(--border-light)]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              <button
                onClick={() => setIsMapOpen(true)}
                className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--brand-green)] bg-[var(--brand-green)]/5 border border-[var(--brand-green)]/20 rounded-full hover:bg-[var(--brand-green)] hover:text-white hover:border-[var(--brand-green)] transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--brand-green)] focus:ring-offset-1"
                aria-label={`View ${location.name} on map`}
              >
                <Map className="w-3.5 h-3.5" />
                View on map
              </button>
            </div>
          </div>
        </div>
      </article>

      {isMapOpen && (
        <MapModal
          name={location.name}
          type={typeLabel}
          distance={location.distance}
          latitude={location.latitude}
          longitude={location.longitude}
          onClose={() => setIsMapOpen(false)}
        />
      )}
    </>
  );
}