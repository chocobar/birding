'use client';

import RspbReserveCard from './RspbReserveCard';
import { Bird } from 'lucide-react';
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
        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-teal-400/30 dark:bg-teal-500/20 border border-teal-400/60 dark:border-teal-500/40 flex items-center justify-center">
          <Bird className="w-5 h-5 text-teal-700 dark:text-teal-300" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
              RSPB reserves near you
            </h2>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide rounded-full bg-teal-400 text-teal-950 dark:bg-teal-500 dark:text-teal-950 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-950/80" aria-hidden="true" />
              UK reserves
            </span>
          </div>
          <p className="text-[var(--text-secondary)] mt-1">
            {reserves.length} nearest RSPB reserve{reserves.length !== 1 ? 's' : ''}
            {locationName && ` to ${locationName}`}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {reserves.map((reserve) => (
          <RspbReserveCard key={reserve.id} reserve={reserve} />
        ))}
      </div>
    </section>
  );
}
