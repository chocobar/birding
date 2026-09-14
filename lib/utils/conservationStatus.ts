/**
 * IUCN Red List conservation ("extinction risk") status metadata.
 *
 * Shared between the bird-status API route, BirdCard and BirdList so the
 * wording ("rare find") and colours stay consistent everywhere.
 */

export type ConservationCode = 'LC' | 'NT' | 'VU' | 'EN' | 'CR' | 'EW' | 'EX';

export interface ConservationStatusMeta {
  /** IUCN Red List category name */
  label: string;
  /** Plain-language note on what the status means for a sighting */
  rarityNote: string;
  /** Tailwind classes for status chips/badges */
  chipClassName: string;
  /** True when the species is Near Threatened or rarer — i.e. a rare find */
  rare: boolean;
}

export const CONSERVATION_STATUS_META: Record<ConservationCode, ConservationStatusMeta> = {
  LC: {
    label: 'Least Concern',
    rarityNote: 'Widespread and thriving — not a rare find',
    chipClassName:
      'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-200 dark:border-emerald-800',
    rare: false,
  },
  NT: {
    label: 'Near Threatened',
    rarityNote: 'In decline — an uncommon find',
    chipClassName:
      'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/70 dark:text-amber-200 dark:border-amber-800',
    rare: true,
  },
  VU: {
    label: 'Vulnerable',
    rarityNote: 'Threatened with extinction — a rare find',
    chipClassName:
      'bg-orange-50 text-orange-700 border border-orange-200 dark:bg-orange-950/70 dark:text-orange-200 dark:border-orange-800',
    rare: true,
  },
  EN: {
    label: 'Endangered',
    rarityNote: 'High risk of extinction in the wild — a rare find',
    chipClassName:
      'bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/70 dark:text-red-200 dark:border-red-800',
    rare: true,
  },
  CR: {
    label: 'Critically Endangered',
    rarityNote: 'On the brink of extinction — a very rare find',
    chipClassName:
      'bg-red-100 text-red-800 border border-red-300 dark:bg-red-950 dark:text-red-100 dark:border-red-700',
    rare: true,
  },
  EW: {
    label: 'Extinct in the Wild',
    rarityNote: 'Survives only in managed care — an extraordinary find',
    chipClassName:
      'bg-slate-100 text-slate-700 border border-slate-300 dark:bg-slate-950 dark:text-slate-200 dark:border-slate-700',
    rare: true,
  },
  EX: {
    label: 'Extinct',
    rarityNote: 'No living individuals remain — records are historical',
    chipClassName:
      'bg-zinc-200 text-zinc-900 border border-zinc-400 dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-600',
    rare: true,
  },
};

/**
 * Parse a raw status value (e.g. from JSON) into a valid code,
 * or null if it is missing/unknown.
 */
export function parseConservationCode(value: unknown): ConservationCode | null {
  return typeof value === 'string' && value in CONSERVATION_STATUS_META
    ? (value as ConservationCode)
    : null;
}

/** Resolve the effective status for a bird, preferring a fetched value. */
export function resolveConservationStatus(
  fetched: string | null | undefined,
  fallback: string | null | undefined,
): ConservationCode | null {
  return parseConservationCode(fetched) ?? parseConservationCode(fallback);
}

/** Whether a status marks the bird as a rare find (Near Threatened or rarer). */
export function isRareFind(status: string | null | undefined): boolean {
  const code = resolveConservationStatus(status, null);
  return code !== null && CONSERVATION_STATUS_META[code].rare;
}
