import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { get, put } from '@vercel/blob';
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
 * every live fetch is merged into a persistent archive; windows beyond 30
 * days draw on what has accumulated here and grow over time as the site is
 * used.
 *
 * Storage backends:
 * - "vercel-blob": durable across deployments — used by default when
 *   BLOB_READ_WRITE_TOKEN is configured (a Vercel Blob store is connected).
 * - "file": a JSON file next to the app (falling back to the OS temp dir on
 *   read-only filesystems) — the default for self-hosted servers, but the
 *   file does not survive serverless redeploys.
 *
 * Set SIGHTINGS_ARCHIVE_BACKEND=file|vercel-blob to override the choice.
 * All archive operations are best-effort: failures are logged and never
 * break the bird request that triggered them.
 */

const ARCHIVE_VERSION = 1;
/** Keep at most this many records so the archive stays manageable */
const MAX_RECORDS = 20000;
/** Archive never holds anything older than the longest time range */
const RETENTION_DAYS = 180;

const BLOB_PATHNAME = 'sightings-archive.json';

type BackendId = 'file' | 'vercel-blob';

interface ArchiveStore {
  /** Raw archive contents, or null when no archive exists yet */
  read(): Promise<string | null>;
  write(text: string): Promise<void>;
}

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

function fileStore(): ArchiveStore {
  let resolvedPath: string | null | undefined;

  const resolve = (): string | null => {
    if (resolvedPath !== undefined) return resolvedPath;

    const configured = process.env.SIGHTINGS_ARCHIVE_PATH;
    const candidates = [
      ...(configured ? [configured] : []),
      path.join(process.cwd(), '.data', 'sightings-archive.json'),
      path.join(os.tmpdir(), 'birding-sightings-archive.json'),
    ];

    resolvedPath = null;
    for (const candidate of candidates) {
      try {
        mkdirSync(path.dirname(candidate), { recursive: true });
        resolvedPath = candidate;
        break;
      } catch {
        // Directory not creatable — try the next candidate
      }
    }
    return resolvedPath;
  };

  return {
    async read() {
      const filePath = resolve();
      if (!filePath) return null;
      try {
        return readFileSync(filePath, 'utf8');
      } catch {
        return null;
      }
    },
    async write(text) {
      const filePath = resolve();
      if (!filePath) throw new Error('no writable archive path');
      const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
      writeFileSync(tmpPath, text, 'utf8');
      renameSync(tmpPath, filePath);
    },
  };
}

function blobStore(): ArchiveStore {
  return {
    async read() {
      // useCache: false — the archive changes on every merge, so reads must
      // not be served stale from the CDN
      const result = await get(BLOB_PATHNAME, { access: 'public', useCache: false });
      if (!result || result.statusCode !== 200) return null;
      return new Response(result.stream).text();
    },
    async write(text) {
      await put(BLOB_PATHNAME, text, {
        access: 'public',
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: 'application/json',
      });
    },
  };
}

let cachedBackend: { id: BackendId; store: ArchiveStore } | undefined;

function backend(): { id: BackendId; store: ArchiveStore } {
  if (!cachedBackend) {
    const configured = process.env.SIGHTINGS_ARCHIVE_BACKEND;
    const id: BackendId =
      configured === 'file' || configured === 'vercel-blob'
        ? configured
        : process.env.BLOB_READ_WRITE_TOKEN
          ? 'vercel-blob'
          : 'file';
    cachedBackend = { id, store: id === 'vercel-blob' ? blobStore() : fileStore() };
  }
  return cachedBackend;
}

function parseArchive(raw: string | null): ArchiveFile {
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as ArchiveFile;
      if (parsed && parsed.version === ARCHIVE_VERSION && Array.isArray(parsed.sightings)) {
        return parsed;
      }
    } catch {
      // Corrupt archive — start fresh
    }
  }
  return { version: ARCHIVE_VERSION, sightings: [] };
}

// Merge operations are serialized per process so concurrent requests can't
// overwrite each other's records with a stale snapshot. They never reject:
// an unavailable archive just logs a warning.
let mergeQueue: Promise<unknown> = Promise.resolve();

/**
 * Merge freshly fetched eBird observations into the archive, pruning records
 * past the retention window and capping the total size. Best-effort.
 */
export function mergeIntoArchive(sightings: ArchivedSighting[]): Promise<void> {
  const run = mergeQueue
    .then(() => doMerge(sightings))
    .catch((error) => {
      console.warn('Sighting archive unavailable:', error);
    });
  mergeQueue = run;
  return run;
}

async function doMerge(sightings: ArchivedSighting[]): Promise<void> {
  if (sightings.length === 0) return;

  const { store } = backend();
  const raw = await store.read();
  const existing = parseArchive(raw);

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

  // Skip identical writes so quiet periods don't hammer the store
  if (text !== raw) {
    await store.write(text);
  }
}

/**
 * Archived sightings within `radiusKm` of the given point and newer than
 * `windowStart`, newest first. Best-effort: an unavailable archive yields [].
 */
export async function readArchivedSightings(
  latitude: number,
  longitude: number,
  radiusKm: number,
  windowStart: number
): Promise<ArchivedSighting[]> {
  try {
    const { store } = backend();
    const archive = parseArchive(await store.read());
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
