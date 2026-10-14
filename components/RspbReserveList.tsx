'use client';

import RspbReserveCard from './RspbReserveCard';
import { Birdhouse } from 'lucide-react';
import type { RspbReserve } from '@/lib/api/rspbClient';

interface RspbReserveListProps {
  reserves: RspbReserve[];
  locationName?: string;
}

/**
 * 'RSPB reserves near you' section. Self-hiding: when there is nothing to
 * show (search outside the UK, upstream outage) it renders nothing — no
 * empty state, no error state.
 */
export default function RspbReserveList({ reserves, locationName }: RspbReserveListProps) {
  if (!reserves || reserves.length === 0) return null;

  return (
    <section className="w-full" aria-label="RSPB reserves near you">
      <div className="flex items-center gap-3 mb-8">
        <div className="flex-shrink-0 w-11 h-11 rounded-full bg-gradient-to-br from-teal-500 to-teal-700 dark:from-teal-600 dark:to-teal-800 border-2 border-white/60 dark:border-white/25 shadow-md shadow-teal-800/30 flex items-center justify-center">
          <Birdhouse className="w-6 h-6 text-white" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h2 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
            RSPB reserves near you
          </h2>
          <p className="text-[var(--text-secondary)] mt-1">
            {reserves.length} nearest RSPB reserve{reserves.length !== 1 ? 's' : ''}
            {locationName && ` to ${locationName}`}
          </p>
        </div>
      </div>

      {/* Row 2 of the shared subgrid is left empty to mirror the filter
          chips row in the locations column, keeping both card lists level */}
      <div className="space-y-3 lg:row-start-3">
        {reserves.map((reserve) => (
          <RspbReserveCard key={reserve.id} reserve={reserve} />
        ))}
      </div>
    </section>
  );
}
