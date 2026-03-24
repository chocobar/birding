'use client';

import { MapPin, Trees, Waves, Leaf, Footprints } from 'lucide-react';
import { formatDistance } from '@/lib/utils/distanceCalculator';

interface LocationCardProps {
  location: {
    id: string;
    name: string;
    type: 'water' | 'woodland' | 'park' | 'nature_reserve' | 'trail';
    distance: number;
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
  water: 'bg-blue-100 text-blue-700',
  woodland: 'bg-green-100 text-green-700',
  park: 'bg-emerald-100 text-emerald-700',
  nature_reserve: 'bg-teal-100 text-teal-700',
  trail: 'bg-amber-100 text-amber-700',
};

const locationTypeLabels = {
  water: 'Water Body',
  woodland: 'Woodland',
  park: 'Park',
  nature_reserve: 'Nature Reserve',
  trail: 'Trail',
};

export default function LocationCard({ location }: LocationCardProps) {
  const Icon = locationIcons[location.type];
  const colorClass = locationColors[location.type];
  const typeLabel = locationTypeLabels[location.type];

  return (
    <article className="bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow duration-300">
      <div className="flex items-start gap-4">
        <div className={`flex-shrink-0 w-12 h-12 rounded-lg ${colorClass} flex items-center justify-center`}>
          <Icon className="w-6 h-6" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="text-lg font-semibold text-gray-900 leading-tight">
              {location.name}
            </h3>
            <div className="flex-shrink-0 flex items-center gap-1 text-gray-600">
              <MapPin className="w-4 h-4" />
              <span className="text-sm font-medium whitespace-nowrap">
                {formatDistance(location.distance)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-2">
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${colorClass}`}>
              {typeLabel}
            </span>
          </div>

          {location.description && (
            <p className="text-sm text-gray-700 mb-2">
              {location.description}
            </p>
          )}

          {location.tags && location.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {location.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}