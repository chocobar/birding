'use client';

import { TIME_RANGES, TimeRangeId } from '@/lib/types/TimeRange';

interface TimeRangeFilterProps {
  value: TimeRangeId;
  onChange: (id: TimeRangeId) => void;
  disabled?: boolean;
}

/** Pill group for picking the sightings time window */
export default function TimeRangeFilter({ value, onChange, disabled }: TimeRangeFilterProps) {
  return (
    <div
      role="group"
      aria-label="Filter sightings by time period"
      className="flex flex-wrap gap-2"
    >
      {TIME_RANGES.map((range) => {
        const selected = range.id === value;
        return (
          <button
            key={range.id}
            type="button"
            aria-pressed={selected}
            disabled={disabled}
            onClick={() => onChange(range.id)}
            className={`px-3.5 py-1.5 text-sm font-medium rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--brand-green)] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
              selected
                ? 'bg-[var(--brand-green)] text-white border border-[var(--brand-green)]'
                : 'bg-[var(--warm-sand)] text-[var(--text-secondary)] border border-[var(--border-light)] hover:bg-[var(--brand-green)]/10 hover:text-[var(--brand-green)] hover:border-[var(--brand-green)]/40'
            }`}
          >
            {range.label}
          </button>
        );
      })}
    </div>
  );
}
