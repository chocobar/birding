/**
 * Time windows the bird-sightings list can be filtered to. 6 months is the
 * longest — eBird only serves live data for the last 30 days, so longer
 * windows are filled from the server-side sighting archive as it accumulates.
 */
export type TimeRangeId = 'month' | '3months' | '6months';

export interface TimeRange {
  id: TimeRangeId;
  /** Length of the window in days */
  days: number;
  /** Short label for the filter control */
  label: string;
}

export const TIME_RANGES: TimeRange[] = [
  { id: 'month', days: 30, label: 'Last month' },
  { id: '3months', days: 90, label: 'Last 3 months' },
  { id: '6months', days: 180, label: 'Last 6 months' },
];

export const DEFAULT_TIME_RANGE_ID: TimeRangeId = 'month';

export function getTimeRange(id: TimeRangeId): TimeRange {
  return TIME_RANGES.find((r) => r.id === id) ?? TIME_RANGES[0];
}
