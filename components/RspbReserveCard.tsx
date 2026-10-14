'use client';

import { Feather, MapPin, ExternalLink } from 'lucide-react';
import { formatDistance } from '@/lib/utils/distanceCalculator';
import type { RspbReserve } from '@/lib/api/rspbClient';

interface RspbReserveCardProps {
  reserve: RspbReserve;
}

export default function RspbReserveCard({ reserve }: RspbReserveCardProps) {
  return (
    <article className="group bg-[var(--warm-sand)] rounded-xl border border-[var(--border-light)] p-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-teal-100 text-teal-600 dark:bg-teal-950 dark:text-teal-300 flex items-center justify-center">
          <Feather className="w-5 h-5" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <h3 className="text-base font-semibold text-[var(--text-primary)] leading-tight">
              {reserve.name}
            </h3>
            <div className="flex-shrink-0 flex items-center gap-1 text-[var(--text-secondary)]">
              <MapPin className="w-3.5 h-3.5" />
              <span className="text-sm font-medium whitespace-nowrap">
                {formatDistance(reserve.distance)}
              </span>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2 mb-2">
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-teal-50 text-teal-700 border border-teal-200 dark:bg-teal-950/70 dark:text-teal-200 dark:border-teal-800">
              RSPB Reserve
            </span>
          </div>

          <div className="flex items-center justify-between gap-2">
            <a
              href={reserve.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--brand-green)] bg-[var(--brand-green)]/5 border border-[var(--brand-green)]/20 rounded-full hover:bg-[var(--brand-green)] hover:text-white hover:border-[var(--brand-green)] transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--brand-green)] focus:ring-offset-1"
              aria-label={`Events and visiting information for ${reserve.name} on the RSPB website`}
              data-analytics={`rspb-reserve:${reserve.name}`}
            >
              Events &amp; visiting
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>
    </article>
  );
}
