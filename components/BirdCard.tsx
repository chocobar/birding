'use client';

import Image from 'next/image';
import { Bird } from 'lucide-react';

interface BirdCardProps {
  bird: {
    id: string;
    commonName: string;
    scientificName: string;
    imageUrl?: string;
    description?: string;
    conservationStatus?: string;
    frequency?: number;
  };
}

export default function BirdCard({ bird }: BirdCardProps) {
  const conservationColors: Record<string, string> = {
    LC: 'bg-green-100 text-green-800',
    NT: 'bg-yellow-100 text-yellow-800',
    VU: 'bg-orange-100 text-orange-800',
    EN: 'bg-red-100 text-red-800',
    CR: 'bg-red-200 text-red-900',
  };

  const conservationLabels: Record<string, string> = {
    LC: 'Least Concern',
    NT: 'Near Threatened',
    VU: 'Vulnerable',
    EN: 'Endangered',
    CR: 'Critically Endangered',
  };

  return (
    <article className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300">
      <div className="relative w-full h-48 bg-gray-200">
        {bird.imageUrl ? (
          <Image
            src={bird.imageUrl}
            alt={`${bird.commonName} - ${bird.scientificName}`}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            priority={false}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-100 to-green-100">
            <Bird className="w-16 h-16 text-gray-400" />
          </div>
        )}
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="text-lg font-semibold text-gray-900 leading-tight">
            {bird.commonName}
          </h3>
          {bird.conservationStatus && conservationColors[bird.conservationStatus] && (
            <span
              className={`px-2 py-1 text-xs font-medium rounded-full ${
                conservationColors[bird.conservationStatus]
              }`}
              title={conservationLabels[bird.conservationStatus]}
            >
              {bird.conservationStatus}
            </span>
          )}
        </div>

        <p className="text-sm text-gray-600 italic mb-3">
          {bird.scientificName}
        </p>

        {bird.description && (
          <p className="text-sm text-gray-700 line-clamp-3">
            {bird.description}
          </p>
        )}

        {bird.frequency && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <div className="flex items-center justify-between text-xs text-gray-600">
              <span>Observation frequency</span>
              <span className="font-semibold">{Math.round(bird.frequency * 100)}%</span>
            </div>
            <div className="mt-1 w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${bird.frequency * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </article>
  );
}