import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/**
 * RSPB public reserves, from the RSPB's official ArcGIS open-data portal
 * (opendata-rspb.opendata.arcgis.com, item 6076715cb76d4c388fa38b87db7d9d24).
 *
 * The upstream FeatureServer serves polygon geometry in British National Grid;
 * we only take per-reserve centroids (outSR=4326 converts server-side), which
 * is all the cards need. Boundary polygons are deliberately NOT fetched: the
 * RSPB Geographic Data End User Agreement requires prior written permission
 * from their Conservation Data Management Unit before publishing the data in
 * publicly available internet mapping services, so until that exists we render
 * reserve cards only (see DATA_ATTRIBUTION.md).
 *
 * Storage: the full snapshot is cached in SQLite at
 * $HELIX_WEB_SERVICE_DATA_DIR/birding.sqlite so it survives redeploys on Helix
 * (fresh sandbox per deploy, persistent data volume). The database is opened
 * lazily on the first request — never at build time. When there is no writable
 * data dir (local dev, restricted filesystem), the module degrades to an
 * in-memory snapshot and still serves. The snapshot is refreshed from ArcGIS
 * when older than 30 days; refreshes share one inflight promise, and an
 * upstream failure never fails a request — the existing snapshot keeps being
 * served.
 */

const QUERY_URL =
  'https://services1.arcgis.com/h1C9f6qsGKmqXsVs/arcgis/rest/services/RSPB_Public_Reserves/FeatureServer/0/query';

/** One page of features per request; paginate via resultOffset */
const PAGE_SIZE = 2000;
const FETCH_TIMEOUT_MS = 20_000;
const USER_AGENT = 'BirdingDiscovery/0.1.0 (https://github.com/chocobar/birding)';

/** Refresh from ArcGIS when the stored snapshot is older than this */
const REFRESH_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000;
/** After a failed refresh, wait before trying again on a later request */
const FAILURE_COOLDOWN_MS = 5 * 60 * 1000;

const DB_FILE = 'birding.sqlite';
const META_UPDATED_AT_KEY = 'rspb_reserves_updated_at';
const BUSY_TIMEOUT_MS = 5000;

export interface RspbReserveRecord {
  objectid: number;
  /** Raw feed name, UPPERCASE ('OUSE WASHES') */
  name: string;
  type: string | null;
  access: string | null;
  /** 'OPEN' | 'SENSITIVE' | null — SENSITIVE sites are withheld downstream */
  sensitive: string | null;
  latitude: number;
  longitude: number;
  /** Epoch ms, or null when the feed has none */
  lastUpdate: number | null;
}

export interface RspbReservesSnapshot {
  reserves: RspbReserveRecord[];
  /** Epoch ms of the last successful upstream refresh; 0 when empty */
  updatedAt: number;
}

interface ArcgisFeature {
  attributes?: Record<string, unknown> | null;
  centroid?: { x?: unknown; y?: unknown } | null;
}

interface ArcgisQueryResponse {
  features?: ArcgisFeature[];
  error?: { message?: string };
}

// --- Module state -----------------------------------------------------------
// `db === undefined` means "not attempted yet"; null means "no usable SQLite"
let db: DatabaseSync | null | undefined;
let cachedSnapshot: RspbReservesSnapshot | undefined;
let inflightRefresh: Promise<RspbReservesSnapshot | null> | null = null;
let lastFailedAt = 0;

// --- Storage ----------------------------------------------------------------

/**
 * Ensure `dirPath` exists and is writable. Missing parents are created one
 * level at a time with non-recursive mkdir — a plain recursive mkdirSync can
 * retry forever (pinning the event loop at 100% CPU) when a path segment sits
 * on a kernel filesystem like /proc or /sys. Same pattern as sightingArchive.
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
    const probe = path.join(dirPath, `.rspb-probe-${process.pid}-${Date.now()}`);
    writeFileSync(probe, '');
    unlinkSync(probe);
    return true;
  } catch {
    return false;
  }
}

function openDb(): DatabaseSync | null {
  if (db !== undefined) return db;
  db = null;

  const dataDir = process.env.HELIX_WEB_SERVICE_DATA_DIR;
  if (!dataDir) {
    console.warn('RSPB reserves: HELIX_WEB_SERVICE_DATA_DIR not set; using in-memory snapshot.');
    return db;
  }
  if (!ensureWritableDir(dataDir)) {
    console.warn('RSPB reserves: data dir not writable; using in-memory snapshot.');
    return db;
  }

  try {
    const database = new DatabaseSync(path.join(dataDir, DB_FILE));
    database.exec('PRAGMA journal_mode = WAL;');
    database.exec(`PRAGMA busy_timeout = ${BUSY_TIMEOUT_MS};`);
    database.exec(`
      CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS rspb_reserves (
        objectid INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT,
        access TEXT,
        sensitive TEXT,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        last_update INTEGER
      );
    `);
    db = database;
  } catch (error) {
    console.warn('RSPB reserves: SQLite unavailable; using in-memory snapshot.', error);
    db = null;
  }
  return db;
}

interface ReserveRow {
  objectid: unknown;
  name: unknown;
  type: unknown;
  access: unknown;
  sensitive: unknown;
  latitude: unknown;
  longitude: unknown;
  last_update: unknown;
}

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readSnapshotFromDb(database: DatabaseSync): RspbReservesSnapshot {
  try {
    const rows = database
      .prepare('SELECT objectid, name, type, access, sensitive, latitude, longitude, last_update FROM rspb_reserves')
      .all() as ReserveRow[];

    const reserves: RspbReserveRecord[] = [];
    for (const row of rows) {
      const objectid = Number(row.objectid);
      const name = typeof row.name === 'string' ? row.name.trim() : '';
      const latitude = Number(row.latitude);
      const longitude = Number(row.longitude);
      if (!Number.isInteger(objectid) || !name || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        continue;
      }
      // Number(null) is 0, which is finite — check for null first
      const lastUpdate = row.last_update === null || row.last_update === undefined ? null : Number(row.last_update);
      reserves.push({
        objectid,
        name,
        type: optionalString(row.type),
        access: optionalString(row.access),
        sensitive: optionalString(row.sensitive),
        latitude,
        longitude,
        lastUpdate: lastUpdate !== null && Number.isFinite(lastUpdate) ? lastUpdate : null,
      });
    }

    const metaRow = database
      .prepare('SELECT value FROM meta WHERE key = ?')
      .get(META_UPDATED_AT_KEY) as { value?: unknown } | undefined;
    const updatedAt = Number(metaRow?.value);

    return { reserves, updatedAt: Number.isFinite(updatedAt) ? updatedAt : 0 };
  } catch (error) {
    console.warn('RSPB reserves: failed to read snapshot from SQLite.', error);
    return { reserves: [], updatedAt: 0 };
  }
}

/**
 * Replace the stored snapshot in one transaction: upsert every reserve
 * (objectid is the natural key) and prune rows the feed no longer contains,
 * then stamp the refresh time into meta. Throws on database failure so the
 * caller can decide whether the in-memory snapshot is still usable.
 */
function persistSnapshot(database: DatabaseSync, reserves: RspbReserveRecord[], updatedAt: number): void {
  const upsert = database.prepare(`
    INSERT INTO rspb_reserves (objectid, name, type, access, sensitive, latitude, longitude, last_update)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(objectid) DO UPDATE SET
      name = excluded.name,
      type = excluded.type,
      access = excluded.access,
      sensitive = excluded.sensitive,
      latitude = excluded.latitude,
      longitude = excluded.longitude,
      last_update = excluded.last_update
  `);
  const setUpdatedAt = database.prepare(
    'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  );
  const prune = database.prepare(
    `DELETE FROM rspb_reserves WHERE objectid NOT IN (${reserves.map(() => '?').join(', ')})`
  );

  database.exec('BEGIN IMMEDIATE');
  try {
    const keepIds: number[] = [];
    for (const reserve of reserves) {
      keepIds.push(reserve.objectid);
      upsert.run(
        reserve.objectid,
        reserve.name,
        reserve.type,
        reserve.access,
        reserve.sensitive,
        reserve.latitude,
        reserve.longitude,
        reserve.lastUpdate
      );
    }
    if (keepIds.length > 0) prune.run(...keepIds);
    setUpdatedAt.run(META_UPDATED_AT_KEY, String(updatedAt));
    database.exec('COMMIT');
  } catch (error) {
    try {
      database.exec('ROLLBACK');
    } catch {
      // Already rolled back or connection broken — nothing to recover
    }
    throw error;
  }
}

// --- Upstream fetch ---------------------------------------------------------

function optionalAttr(attrs: Record<string, unknown> | null | undefined, key: string): string | null {
  const value = attrs?.[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function toReserve(feature: ArcgisFeature): RspbReserveRecord | null {
  const attrs = feature.attributes;
  const objectid = Number(attrs?.OBJECTID);
  const name = typeof attrs?.Name === 'string' ? attrs.Name.trim() : '';
  const latitude = Number(feature.centroid?.y);
  const longitude = Number(feature.centroid?.x);

  if (!Number.isInteger(objectid) || !name || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  const rawLastUpdate = attrs?.LastUpdate;
  return {
    objectid,
    name,
    type: optionalAttr(attrs, 'Type'),
    access: optionalAttr(attrs, 'Access'),
    sensitive: optionalAttr(attrs, 'Sensitive'),
    latitude,
    longitude,
    lastUpdate: typeof rawLastUpdate === 'number' ? rawLastUpdate : null,
  };
}

/**
 * Fetch every publicised reserve, paginating defensively via resultOffset
 * (the server's maxRecordCount caps each page). Centroids come back as
 * { x: longitude, y: latitude } in WGS84 thanks to outSR=4326.
 */
async function fetchAllReserves(): Promise<RspbReserveRecord[]> {
  const reserves: RspbReserveRecord[] = [];
  let offset = 0;

  while (true) {
    const url = new URL(QUERY_URL);
    url.searchParams.set('where', "Access='Publicised'");
    url.searchParams.set('outFields', 'OBJECTID,Name,Type,Access,Sensitive,LastUpdate');
    url.searchParams.set('returnCentroid', 'true');
    url.searchParams.set('returnGeometry', 'false');
    url.searchParams.set('outSR', '4326');
    url.searchParams.set('orderByFields', 'OBJECTID');
    url.searchParams.set('resultOffset', String(offset));
    url.searchParams.set('resultRecordCount', String(PAGE_SIZE));
    url.searchParams.set('f', 'json');

    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`ArcGIS query failed with status ${response.status}`);
    }

    const data = (await response.json()) as ArcgisQueryResponse;
    if (data.error) {
      throw new Error(`ArcGIS query error: ${data.error.message ?? 'unknown'}`);
    }

    const features = data.features ?? [];
    for (const feature of features) {
      const reserve = toReserve(feature);
      if (reserve) reserves.push(reserve);
    }

    if (features.length < PAGE_SIZE) break;
    offset += features.length;
  }

  return reserves;
}

// --- Refresh ----------------------------------------------------------------

async function doRefresh(): Promise<RspbReservesSnapshot | null> {
  try {
    const reserves = await fetchAllReserves();
    if (reserves.length === 0) {
      throw new Error('ArcGIS returned no publicised reserves');
    }

    const updatedAt = Date.now();
    const database = openDb();
    if (database) {
      try {
        persistSnapshot(database, reserves, updatedAt);
      } catch (error) {
        // The fresh data is still good in memory; the DB copy stays stale
        console.warn('RSPB reserves: failed to persist snapshot to SQLite.', error);
      }
    }

    cachedSnapshot = { reserves, updatedAt };
    console.info(`RSPB reserves: refreshed ${reserves.length} reserves from ArcGIS.`);
    return cachedSnapshot;
  } catch (error) {
    console.error('RSPB reserves: refresh failed; serving the existing snapshot.', error);
    lastFailedAt = Date.now();
    return null;
  }
}

/**
 * Start (or join) a refresh. Concurrent callers share one promise, so
 * simultaneous requests never double-fetch.
 */
function startRefresh(): Promise<RspbReservesSnapshot | null> {
  if (!inflightRefresh) {
    inflightRefresh = doRefresh().finally(() => {
      inflightRefresh = null;
    });
  }
  return inflightRefresh;
}

/**
 * Current reserves snapshot. Opens the database lazily on first call, loads
 * any stored snapshot, and refreshes from ArcGIS when it is missing or older
 * than 30 days. Never throws: on upstream failure the stored snapshot (or an
 * empty list) is returned so callers can still serve.
 */
export async function getRspbReservesSnapshot(): Promise<RspbReservesSnapshot> {
  if (cachedSnapshot === undefined) {
    const database = openDb();
    cachedSnapshot = database ? readSnapshotFromDb(database) : { reserves: [], updatedAt: 0 };
    if (cachedSnapshot.reserves.length > 0) {
      console.info(`RSPB reserves: loaded ${cachedSnapshot.reserves.length} reserves from SQLite.`);
    }
  }

  const snapshot = cachedSnapshot;
  const needsRefresh =
    snapshot.updatedAt === 0 || Date.now() - snapshot.updatedAt > REFRESH_INTERVAL_MS;

  if (!needsRefresh || Date.now() - lastFailedAt < FAILURE_COOLDOWN_MS) {
    return snapshot;
  }

  const refreshed = await startRefresh();
  return refreshed ?? snapshot;
}
