import { mkdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
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
 * Storage location, in order of preference:
 * 1. SIGHTINGS_ARCHIVE_PATH, when set
 * 2. The Helix web-service data dir (HELIX_WEB_SERVICE_DATA_DIR, typically
 *    /data) — a persistent volume that the platform remounts across restarts
 *    and redeploys, so the archive survives deployments on Helix hosting
 * 3. .data/sightings-archive.json next to the app
 * 4. The OS temp dir
 *
 * The first writable candidate wins. All archive operations are best-effort:
 * failures are logged and never break the bird request that triggered them.
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

function candidatePaths(): string[] {
  const configured = process.env.SIGHTINGS_ARCHIVE_PATH;
  const dataDir = process.env.HELIX_WEB_SERVICE_DATA_DIR;
  return [
    ...(configured ? [configured] : []),
    ...(dataDir ? [path.join(dataDir, 'sightings-archive.json')] : []),
    path.join(process.cwd(), '.data', 'sightings-archive.json'),
    path.join(os.tmpdir(), 'birding-sightings-archive.json'),
  ];
}

/**
 * Ensure `dirPath` exists and is writable. Missing parents are created one
 * level at a time with non-recursive mkdir — a plain recursive mkdirSync can
 * retry forever (pinning the event loop at 100% CPU) when a path segment sits
 * on a kernel filesystem like /proc or /sys.
 */
function ensureWritableDir(dirPath: string): boolean {
  let current = path.isAbsolute(dirPath) ? path.sep : '';
  for (const segment of dirPath.split(path.sep)) {
    if (!segment) continue;
    current = path.join(current, segment);
    try {
      if (!statSync(current).isDirectory()) return false;
    } catch {
      try {
        mkdirSync(current);
      } catch {
        return false;
      }
      try {
        if (!statSync(current).isDirectory()) return false;
      } catch {
        return false;
      }
    }
  }

  try {
    const probe = path.join(dirPath, `.archive-probe-${process.pid}-${Date.now()}`);
    writeFileSync(probe, '');
    unlinkSync(probe);
    return true;
  } catch {
    return false;
  }
}

/** Is the file's parent directory usable for create + replace? */
function isWritableDir(filePath: string): boolean {
  return ensureWritableDir(path.dirname(filePath));
}

let resolvedPath: string | null | undefined;

function archivePath(): string | null {
  if (resolvedPath !== undefined) return resolvedPath;

  resolvedPath = null;
  for (const candidate of candidatePaths()) {
    if (isWritableDir(candidate)) {
      resolvedPath = candidate;
      break;
    }
  }
  if (!resolvedPath) {
    console.warn('Sighting archive: no writable location found; archive disabled.');
  }
  return resolvedPath;
}

function loadArchive(): ArchiveFile {
  const filePath = archivePath();
  if (!filePath) return { version: ARCHIVE_VERSION, sightings: [] };

  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as ArchiveFile;
    if (parsed && parsed.version === ARCHIVE_VERSION && Array.isArray(parsed.sightings)) {
      return parsed;
    }
  } catch {
    // Missing or corrupt archive — start fresh
  }
  return { version: ARCHIVE_VERSION, sightings: [] };
}

// Merge operations are serialized per process so concurrent requests can't
// overwrite each other's records with a stale snapshot. They never reject.
let mergeQueue: Promise<unknown> = Promise.resolve();

/**
 * Merge freshly fetched eBird observations into the archive, pruning records
 * past the retention window and capping the total size. Best-effort.
 */
export function mergeIntoArchive(sightings: ArchivedSighting[]): void {
  mergeQueue = mergeQueue
    .then(() => doMerge(sightings))
    .catch((error) => {
      console.warn('Sighting archive unavailable:', error);
    });
}

function doMerge(sightings: ArchivedSighting[]): void {
  if (sightings.length === 0) return;

  const filePath = archivePath();
  if (!filePath) return;

  const existing = loadArchive();

  const byKey = new Map<string, ArchivedSighting>();
  for (const record of existing.sightings) {
    byKey.set(recordKey(record), record);
  }
  for (const incoming of sightings) {
    const key = recordKey(incoming);
    const record = byKey.get(key);
    if (!record || parseObsDt(incoming.obsDt) >= parseObsDt(record.obsDt)) {
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

  const text = JSON.stringify({ version: ARCHIVE_VERSION, sightings: kept } satisfies ArchiveFile);

  const raw = readFileSyncSafe(filePath);
  if (text === raw) return; // skip identical writes during quiet periods

  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmpPath, text, 'utf8');
  renameSync(tmpPath, filePath);
}

function readFileSyncSafe(filePath: string): string | null {
  try {
    return readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

/**
 * Archived sightings within `radiusKm` of the given point and newer than
 * `windowStart`, newest first. Best-effort: an unavailable archive yields [].
 */
export function readArchivedSightings(
  latitude: number,
  longitude: number,
  radiusKm: number,
  windowStart: number
): ArchivedSighting[] {
  const archive = loadArchive();
  return archive.sightings
    .filter((s) => {
      if (parseObsDt(s.obsDt) < windowStart) return false;
      const miles = calculateDistance(latitude, longitude, s.lat, s.lng);
      return miles * 1.60934 <= radiusKm;
    })
    .sort((a, b) => parseObsDt(b.obsDt) - parseObsDt(a.obsDt));
}
