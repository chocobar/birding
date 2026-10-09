import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { calculateDistance } from '@/lib/utils/distanceCalculator';

/**
 * A single bird sighting stored in the server-side archive.
 * Mirrors the fields eBird's recent-observations API returns, which is the
 * only place archive records come from.
 */
export interface ArchivedSighting {
  speciesCode: string;
  comName: string;
  sciName: string;
  locId: string;
  locName: string;
  /** eBird format: "YYYY-MM-DD HH:mm" or "YYYY-MM-DD" */
  obsDt: string;
  howMany?: number;
  lat: number;
  lng: number;
  subId: string;
}

/**
 * eBird's data API only exposes the last 30 days of observations, so longer
 * time ranges (3/6 months) can't be fetched from the upstream API. Instead,
 * every live fetch is merged into this file-backed archive; windows beyond
 * 30 days draw on what has accumulated here and grow over time as the site
 * is used.
 *
 * The file lives next to the app by default so self-hosted deployments keep
 * their history; on read-only filesystems (e.g. serverless) it falls back to
 * the OS temp dir, which is best-effort. Set SIGHTINGS_ARCHIVE_PATH to pin
 * the location.
 */

const ARCHIVE_VERSION = 1;
/** Keep at most this many records so the JSON file stays manageable */
const MAX_RECORDS = 20000;
/** Archive never holds anything older than the longest time range */
const RETENTION_DAYS = 180;

interface ArchiveFile {
  version: number;
  sightings: ArchivedSighting[];
}

function recordKey(s: ArchivedSighting): string {
  return `${s.speciesCode}|${s.locId}|${s.obsDt.slice(0, 10)}`;
}

/** Parse an eBird obsDt string to a timestamp. eBird dates carry no timezone. */
export function parseObsDt(obsDt: string): number {
  const iso = obsDt.includes('T') ? obsDt : obsDt.replace(' ', 'T');
  return Date.parse(`${iso}Z`);
}

let resolvedPath: string | null = null;

function archivePath(): string | null {
  if (resolvedPath !== null) return resolvedPath;

  const configured = process.env.SIGHTINGS_ARCHIVE_PATH;
  const candidates = [
    ...(configured ? [configured] : []),
    path.join(process.cwd(), '.data', 'sightings-archive.json'),
    path.join(os.tmpdir(), 'birding-sightings-archive.json'),
  ];

  for (const candidate of candidates) {
    try {
      mkdirSync(path.dirname(candidate), { recursive: true });
      resolvedPath = candidate;
      return candidate;
    } catch {
      // Directory not creatable — try the next candidate
    }
  }
  resolvedPath = '';
  return null;
}

function loadArchive(filePath: string): ArchiveFile {
  try {
    const raw = readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw) as ArchiveFile;
    if (parsed && parsed.version === ARCHIVE_VERSION && Array.isArray(parsed.sightings)) {
      return parsed;
    }
  } catch {
    // Missing or corrupt archive — start fresh
  }
  return { version: ARCHIVE_VERSION, sightings: [] };
}

function saveArchive(filePath: string, archive: ArchiveFile): void {
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmpPath, JSON.stringify(archive), 'utf8');
  renameSync(tmpPath, filePath);
}

/**
 * Merge freshly fetched eBird observations into the archive, pruning records
 * past the retention window and capping the total size. Best-effort: failures
 * are logged and never break the request that triggered the merge.
 */
export function mergeIntoArchive(sightings: ArchivedSighting[]): void {
  const filePath = archivePath();
  if (!filePath || sightings.length === 0) return;

  try {
    const archive = loadArchive(filePath);
    const byKey = new Map<string, ArchivedSighting>();
    for (const existing of archive.sightings) {
      byKey.set(recordKey(existing), existing);
    }
    for (const incoming of sightings) {
      const key = recordKey(incoming);
      const existing = byKey.get(key);
      if (!existing || parseObsDt(incoming.obsDt) >= parseObsDt(existing.obsDt)) {
        byKey.set(key, incoming);
      }
    }

    const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const kept = Array.from(byKey.values())
      .filter((s) => parseObsDt(s.obsDt) >= cutoff)
      .sort((a, b) => parseObsDt(a.obsDt) - parseObsDt(b.obsDt));

    if (kept.length > MAX_RECORDS) {
      kept.splice(0, kept.length - MAX_RECORDS);
    }

    saveArchive(filePath, { version: ARCHIVE_VERSION, sightings: kept });
  } catch (error) {
    console.warn('Sighting archive unavailable:', error);
  }
}

/**
 * Archived sightings within `radiusKm` of the given point and newer than
 * `windowStart`, newest first.
 */
export function readArchivedSightings(
  latitude: number,
  longitude: number,
  radiusKm: number,
  windowStart: number
): ArchivedSighting[] {
  const filePath = archivePath();
  if (!filePath) return [];

  try {
    const archive = loadArchive(filePath);
    return archive.sightings
      .filter((s) => {
        if (parseObsDt(s.obsDt) < windowStart) return false;
        const miles = calculateDistance(latitude, longitude, s.lat, s.lng);
        return miles * 1.60934 <= radiusKm;
      })
      .sort((a, b) => parseObsDt(b.obsDt) - parseObsDt(a.obsDt));
  } catch (error) {
    console.warn('Sighting archive unavailable:', error);
    return [];
  }
}
