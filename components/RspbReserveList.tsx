'use client';

import RspbReserveCard from './RspbReserveCard';
import { Birdhouse, ExternalLink } from 'lucide-react';
import { RSPB_EVENTS_URL } from '@/lib/utils/rspbReserveNames';
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
      <div className="flex flex-wrap items-center gap-3 mb-8">
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
        {/* UK-only by construction: this section renders only when the
            reserves API returned reserves, and reserves exist only in the UK */}
        <a
          href={RSPB_EVENTS_URL}
          target="_blank"
          rel="noopener noreferrer"
          data-analytics="rspb-events-finder"
          aria-label="Find an RSPB event near you on the RSPB events website (opens in a new tab)"
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--brand-green)] bg-[var(--brand-green)]/5 border border-[var(--brand-green)]/20 rounded-full hover:bg-[var(--brand-green)] hover:text-white hover:border-[var(--brand-green)] transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--brand-green)] focus:ring-offset-1 focus:ring-offset-[var(--warm-cream)]"
        >
          Find an RSPB event near you
          <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
        </a>
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
