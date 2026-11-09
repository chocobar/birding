'use client';

import { useSyncExternalStore } from 'react';
import { Binoculars, ExternalLink } from 'lucide-react';
import { RSPB_BGB_URL } from '@/lib/utils/rspbReserveNames';

/**
 * Seasonal 'Big Garden Birdwatch' call-to-action, deep-linked to the RSPB's
 * campaign page. Shown only in December and January; the month is read
 * client-side via useSyncExternalStore so the prerendered HTML (server
 * snapshot: hidden) never disagrees with the client (no hydration mismatch).
 * Best-effort: a plain anchor, nothing to break if the RSPB URL changes.
 */

const subscribe = () => () => {};

function getMonth(): number {
  return new Date().getMonth();
}

function getServerMonth(): number | null {
  return null;
}

export default function BigGardenBirdwatchBanner() {
  const month = useSyncExternalStore(subscribe, getMonth, getServerMonth);

  if (month === null || !(month === 11 || month === 0)) return null;

  return (
    <div className="mt-4 bg-[var(--warm-sand)] border border-[var(--border-light)] rounded-xl p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-[var(--brand-green)]/10 text-[var(--brand-green)] flex items-center justify-center">
          <Binoculars className="w-5 h-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-[var(--text-primary)] leading-tight">
            Big Garden Birdwatch is coming
          </h2>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
            Spend an hour counting the birds in your garden this winter.
          </p>
        </div>
        <a
          href={RSPB_BGB_URL}
          target="_blank"
          rel="noopener noreferrer"
          data-analytics="bgb-banner-cta"
          aria-label="Find out more about Big Garden Birdwatch on the RSPB website (opens in a new tab)"
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-[var(--brand-green)] bg-[var(--brand-green)]/5 border border-[var(--brand-green)]/20 rounded-full hover:bg-[var(--brand-green)] hover:text-white hover:border-[var(--brand-green)] transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--brand-green)] focus:ring-offset-1 focus:ring-offset-[var(--warm-cream)]"
        >
          Find out more
          <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}
