import { DatabaseSync } from 'node:sqlite';
import { createHash, timingSafeEqual } from 'node:crypto';
import { mkdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/**
 * First-party, privacy-friendly analytics.
 *
 * Events arrive from the browser tracker (components/Analytics.tsx + the
 * client helper in lib/analytics/track.ts) via POST /api/analytics/collect.
 * The server enriches each event with what the browser can't be trusted to
 * classify itself — browser, OS, device class, bot status, country (from
 * standard CDN geo headers when the hosting platform provides them) — and
 * stores it in SQLite.
 *
 * Storage mirrors lib/server/rspbReserves.ts: the shared birding.sqlite in
 * the Helix web-service data dir (persistent volume across redeploys), with a
 * .data/ fallback next to the app for local development. The database is
 * opened lazily on first use — never at build time. When no writable location
 * exists the module degrades to a no-op and the dashboard reports no data.
 *
 * Privacy: no cookies, no IP addresses and no identifiers beyond a random
 * per-browser id kept in the visitor's own localStorage. The raw IP is used
 * transiently for rate limiting and is never persisted.
 */

// --- Configuration -----------------------------------------------------------

const DB_FILE = 'birding.sqlite';
const BUSY_TIMEOUT_MS = 5000;

/** Keep at most this many events — the dashboard only needs coarse history */
const MAX_EVENTS = 500_000;
/** Events older than this are pruned (matches the sighting archive window) */
const RETENTION_DAYS = 180;
const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;
/** How often the retention prune runs (at most once per day of traffic) */
const PRUNE_INTERVAL_MS = 24 * 60 * 60 * 1000;

const PRUNED_AT_KEY = 'analytics_pruned_at';

export const ANALYTICS_COOKIE_NAME = 'bd_dashboard';

/** Only these event names are accepted from the browser */
export const EVENT_NAMES = new Set([
  'pageview',
  'click',
  'outbound',
  'search',
  'geolocate',
  'map_open',
  'audio_play',
  'time_range',
]);

// --- Types -------------------------------------------------------------------

/** One event as received from the browser (already shape-validated) */
export interface IncomingEvent {
  name: string;
  path: string | null;
  label: string | null;
  props: string | null;
  visitorId: string | null;
  sessionId: string | null;
  referrer: string | null;
}

/** One event as stored, after server-side enrichment */
export interface StoredEvent extends IncomingEvent {
  ts: number;
  country: string | null;
  browser: string | null;
  browserVersion: string | null;
  os: string | null;
  device: string | null;
  lang: string | null;
}

export interface UserAgentInfo {
  browser: string | null;
  browserVersion: string | null;
  os: string | null;
  device: 'mobile' | 'tablet' | 'desktop' | null;
  isBot: boolean;
}

// --- User-agent parsing -------------------------------------------------------

const BOT_PATTERN =
  /\b(bot|crawl|spider|slurp|headless|lighthouse|phantomjs|puppeteer|playwright|selenium|curl|wget|python|java\/|okhttp|go-http-client|axios|node-fetch|postman|insomnia|libwww|urllib|scrapy|httpclient|monitor|uptime|pingdom|statuscake|betteruptime|preview|screenshot|facebookexternalhit|feedfetcher|whatsapp|twitterbot|linkedinbot|slackbot|discordbot|telegrambot|skypeuripreview|applebot|bingbot|googlebot|adsbot|adsense|yandexbot|yandeximages|duckduckbot|baiduspider|sogou|semrush|ahrefs|mj12bot|dotbot|petalbot|amazonbot|gptbot|oai-searchbot|chatgpt-user|claudebot|claude-web|anthropic-ai|perplexitybot|bytespider|meta-externalagent|facebookbot|ia_archiver|archive\.org\.bot)\b/i;

/**
 * Classify a User-Agent string into browser / OS / device. Deliberately
 * dependency-free and approximate — the dashboard only needs coarse buckets
 * ("Chrome", "Safari", "mobile vs desktop"), not per-build detail.
 */
export function parseUserAgent(ua: string): UserAgentInfo {
  if (!ua || !ua.trim()) {
    return { browser: null, browserVersion: null, os: null, device: null, isBot: true };
  }

  const isBot = BOT_PATTERN.test(ua);
  const version = (marker: string): string | null => {
    const idx = ua.indexOf(marker);
    if (idx === -1) return null;
    const match = ua.slice(idx + marker.length).match(/^[\d.]+/);
    return match ? match[0] : null;
  };

  let browser: string | null = null;
  let browserVersion: string | null = null;

  // Order matters: derivative browsers embed Chrome/Safari tokens too
  if (version('Edg/') || version('Edge/')) {
    browser = 'Edge';
    browserVersion = version('Edg/') ?? version('Edge/');
  } else if (version('OPR/') || version('Opera')) {
    browser = 'Opera';
    browserVersion = version('OPR/');
  } else if (version('SamsungBrowser/')) {
    browser = 'Samsung Internet';
    browserVersion = version('SamsungBrowser/');
  } else if (version('Firefox/') || version('FxiOS/')) {
    browser = 'Firefox';
    browserVersion = version('Firefox/') ?? version('FxiOS/');
  } else if (version('CriOS/')) {
    browser = 'Chrome';
    browserVersion = version('CriOS/');
  } else if (version('Chrome/')) {
    browser = 'Chrome';
    browserVersion = version('Chrome/');
  } else if (version('Safari/')) {
    browser = 'Safari';
    browserVersion = version('Version/');
  } else if (/MSIE |Trident\//.test(ua)) {
    browser = 'Internet Explorer';
    browserVersion = version('MSIE ');
  }

  let os: string | null = null;
  if (/Windows Phone/i.test(ua)) {
    os = 'Windows Phone';
  } else if (/Windows NT/.test(ua)) {
    os = 'Windows';
  } else if (/CrOS /.test(ua)) {
    os = 'ChromeOS';
  } else if (/Android/.test(ua)) {
    os = 'Android';
  } else if (/iPhone|iPod/.test(ua)) {
    os = 'iOS';
  } else if (/iPad/.test(ua)) {
    os = 'iPadOS';
  } else if (/Mac OS X|Macintosh/.test(ua)) {
    os = 'macOS';
  } else if (/Linux/.test(ua)) {
    os = 'Linux';
  }

  let device: UserAgentInfo['device'] = null;
  if (/iPad|Tablet|PlayBook|Silk|Kindle/i.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua))) {
    device = 'tablet';
  } else if (/Mobi|iPhone|iPod|Windows Phone|BlackBerry|Opera Mini|IEMobile/i.test(ua)) {
    device = 'mobile';
  } else if (os) {
    device = 'desktop';
  }

  return { browser, browserVersion, os, device, isBot };
}

/**
 * Country code from the standard geo headers reverse proxies and CDNs set
 * (Cloudflare, Vercel, Fastly, Netlify, Google App Engine…). First match
 * wins; anything that isn't a 2-letter code is ignored.
 */
const COUNTRY_HEADERS = [
  'cf-ipcountry',
  'x-vercel-ip-country',
  'fastly-client-country',
  'x-geo-country',
  'x-country-code',
  'x-country',
  'x-appengine-country',
];

export function countryFromHeaders(headers: Headers): string | null {
  for (const name of COUNTRY_HEADERS) {
    const value = headers.get(name);
    if (value && /^[A-Za-z]{2}$/.test(value.trim())) {
      return value.trim().toUpperCase();
    }
  }
  return null;
}

export function languageFromHeaders(headers: Headers): string | null {
  const accept = headers.get('accept-language');
  if (!accept) return null;
  const primary = accept.split(',')[0]?.trim();
  const tag = primary?.split(';')[0]?.trim().toLowerCase();
  return tag && /^[a-z-]{2,10}$/.test(tag) ? tag : null;
}

// --- Storage ------------------------------------------------------------------

// `db === undefined` means "not attempted yet"; null means "no usable SQLite"
let db: DatabaseSync | null | undefined;
let lastPruneAt = 0;
// Inserts are serialized per process so concurrent requests can't interleave
let writeQueue: Promise<unknown> = Promise.resolve();

/**
 * Ensure `dirPath` exists and is writable. Missing parents are created one
 * level at a time with non-recursive mkdir — a plain recursive mkdirSync can
 * retry forever (pinning the event loop at 100% CPU) when a path segment sits
 * on a kernel filesystem like /proc or /sys. Same pattern as the other
 * server modules.
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
    const probe = path.join(dirPath, `.analytics-probe-${process.pid}-${Date.now()}`);
    writeFileSync(probe, '');
    unlinkSync(probe);
    return true;
  } catch {
    return false;
  }
}

function dbPath(): string | null {
  const dataDir = process.env.HELIX_WEB_SERVICE_DATA_DIR;
  if (dataDir && ensureWritableDir(dataDir)) return path.join(dataDir, DB_FILE);
  // Local-dev fallback next to the app (gitignored)
  const localDir = path.join(process.cwd(), '.data');
  if (ensureWritableDir(localDir)) return path.join(localDir, DB_FILE);
  return null;
}

function openDb(): DatabaseSync | null {
  if (db !== undefined) return db;
  db = null;

  const filePath = dbPath();
  if (!filePath) {
    console.warn('Analytics: no writable data dir found; analytics storage disabled.');
    return db;
  }

  try {
    const database = new DatabaseSync(filePath);
    database.exec('PRAGMA journal_mode = WAL;');
    database.exec(`PRAGMA busy_timeout = ${BUSY_TIMEOUT_MS};`);
    database.exec(`
      CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS analytics_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ts INTEGER NOT NULL,
        name TEXT NOT NULL,
        path TEXT,
        label TEXT,
        props TEXT,
        visitor_id TEXT,
        session_id TEXT,
        referrer TEXT,
        country TEXT,
        browser TEXT,
        browser_version TEXT,
        os TEXT,
        device TEXT,
        lang TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_analytics_ts ON analytics_events (ts);
      CREATE INDEX IF NOT EXISTS idx_analytics_name_ts ON analytics_events (name, ts);
      CREATE INDEX IF NOT EXISTS idx_analytics_visitor ON analytics_events (visitor_id, ts);
      CREATE INDEX IF NOT EXISTS idx_analytics_path_ts ON analytics_events (path, ts);
    `);
    db = database;
  } catch (error) {
    console.warn('Analytics: SQLite unavailable; analytics storage disabled.', error);
    db = null;
  }
  return db;
}

/**
 * Is analytics collection enabled? An explicit ANALYTICS_DISABLED=1 env turns
 * the collector into a silent no-op (the endpoint still answers 204).
 */
export function isAnalyticsEnabled(): boolean {
  return process.env.ANALYTICS_DISABLED !== '1';
}

/** Queue `events` for insert; resolves once they are durably written (or dropped). */
export async function recordEvents(events: StoredEvent[]): Promise<void> {
  writeQueue = writeQueue
    .then(() => doRecord(events))
    .catch((error) => {
      console.warn('Analytics: failed to record events.', error);
    });
  await writeQueue;
}

function doRecord(events: StoredEvent[]): void {
  const database = openDb();
  if (!database || events.length === 0) return;

  const insert = database.prepare(`
    INSERT INTO analytics_events
      (ts, name, path, label, props, visitor_id, session_id, referrer,
       country, browser, browser_version, os, device, lang)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  database.exec('BEGIN');
  try {
    for (const event of events) {
      insert.run(
        event.ts,
        event.name,
        event.path,
        event.label,
        event.props,
        event.visitorId,
        event.sessionId,
        event.referrer,
        event.country,
        event.browser,
        event.browserVersion,
        event.os,
        event.device,
        event.lang
      );
    }
    database.exec('COMMIT');
  } catch (error) {
    try {
      database.exec('ROLLBACK');
    } catch {
      // connection already unwound — nothing to roll back
    }
    throw error;
  }

  pruneIfNeeded(database);
}

function pruneIfNeeded(database: DatabaseSync): void {
  const now = Date.now();
  if (now - lastPruneAt < PRUNE_INTERVAL_MS) return;
  lastPruneAt = now;

  try {
    const cutoff = now - RETENTION_MS;
    database.prepare('DELETE FROM analytics_events WHERE ts < ?').run(cutoff);
    // Hard size cap as a second guard against unbounded growth
    database
      .prepare(
        `DELETE FROM analytics_events WHERE id IN (
           SELECT id FROM analytics_events ORDER BY id DESC LIMIT -1 OFFSET ?
         )`,
      )
      .run(MAX_EVENTS);
    database
      .prepare(
        'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      )
      .run(PRUNED_AT_KEY, String(now));
  } catch (error) {
    console.warn('Analytics: retention prune failed.', error);
  }
}

// --- Dashboard auth -----------------------------------------------------------

/** Derive the cookie value from the configured dashboard key (never store the key itself) */
export function dashboardCookieToken(key: string): string {
  return createHash('sha256').update(`birding-analytics:${key}`).digest('hex');
}

/** Constant-time comparison of the presented key against the configured one */
export function dashboardKeyMatches(presented: string): boolean {
  const expected = process.env.ANALYTICS_DASHBOARD_KEY;
  if (!expected) return false;
  const a = createHash('sha256').update(presented).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

// --- Dashboard aggregates ------------------------------------------------------

export const DASHBOARD_RANGES = [1, 7, 30, 90] as const;
export type DashboardRangeDays = (typeof DASHBOARD_RANGES)[number];

export function isDashboardRange(value: unknown): value is DashboardRangeDays {
  return typeof value === 'number' && (DASHBOARD_RANGES as readonly number[]).includes(value);
}

export interface DashboardData {
  dbEnabled: boolean;
  days: DashboardRangeDays;
  startTs: number;
  endTs: number;
  summary: {
    visitors: number;
    pageviews: number;
    sessions: number;
    events: number;
    searches: number;
  };
  daily: { day: string; visitors: number; pageviews: number }[];
  devices: { key: string; visitors: number }[];
  browsers: { key: string; visitors: number }[];
  countries: { key: string; visitors: number }[];
  pages: { key: string; views: number }[];
  referrers: { key: string; views: number }[];
  events: { name: string; label: string | null; count: number }[];
  searches: { label: string; count: number }[];
}

function tsWindow(days: DashboardRangeDays): { startTs: number; endTs: number } {
  const endTs = Date.now();
  // Range includes today; start at the beginning (UTC) of the day `days - 1` days ago
  const startTs = Math.floor((endTs - (days - 1) * 24 * 60 * 60 * 1000) / 86400000) * 86400000;
  return { startTs, endTs };
}

/** Everything the /analytics dashboard renders, in one round of queries */
export function getDashboardData(days: DashboardRangeDays): DashboardData {
  const { startTs, endTs } = tsWindow(days);
  const database = openDb();
  const base: DashboardData = {
    dbEnabled: database !== null,
    days,
    startTs,
    endTs,
    summary: { visitors: 0, pageviews: 0, sessions: 0, events: 0, searches: 0 },
    daily: [],
    devices: [],
    browsers: [],
    countries: [],
    pages: [],
    referrers: [],
    events: [],
    searches: [],
  };

  if (!database) return base;

  const window = 'ts >= ? AND ts < ?';

  try {
    const summaryRow = database
      .prepare(
        `SELECT
           COUNT(DISTINCT visitor_id) AS visitors,
           SUM(CASE WHEN name = 'pageview' THEN 1 ELSE 0 END) AS pageviews,
           COUNT(DISTINCT session_id) AS sessions,
           SUM(CASE WHEN name != 'pageview' THEN 1 ELSE 0 END) AS events,
           SUM(CASE WHEN name = 'search' THEN 1 ELSE 0 END) AS searches
         FROM analytics_events WHERE ${window}`,
      )
      .get(startTs, endTs) as Record<string, unknown>;

    base.summary = {
      visitors: Number(summaryRow?.visitors) || 0,
      pageviews: Number(summaryRow?.pageviews) || 0,
      sessions: Number(summaryRow?.sessions) || 0,
      events: Number(summaryRow?.events) || 0,
      searches: Number(summaryRow?.searches) || 0,
    };

    const dayRows = database
      .prepare(
        `SELECT ts / 86400000 AS bucket,
                COUNT(DISTINCT visitor_id) AS visitors,
                SUM(CASE WHEN name = 'pageview' THEN 1 ELSE 0 END) AS pageviews
         FROM analytics_events WHERE ${window}
         GROUP BY bucket ORDER BY bucket`,
      )
      .all(startTs, endTs) as Record<string, unknown>[];

    const byBucket = new Map<number, { visitors: number; pageviews: number }>();
    for (const row of dayRows) {
      byBucket.set(Number(row.bucket), {
        visitors: Number(row.visitors) || 0,
        pageviews: Number(row.pageviews) || 0,
      });
    }
    // Fill the full range so the chart has no gaps
    const startBucket = Math.floor(startTs / 86400000);
    const endBucket = Math.floor(endTs / 86400000);
    for (let bucket = startBucket; bucket <= endBucket; bucket++) {
      const day = new Date(bucket * 86400000).toISOString().slice(0, 10);
      const hit = byBucket.get(bucket) ?? { visitors: 0, pageviews: 0 };
      base.daily.push({ day, visitors: hit.visitors, pageviews: hit.pageviews });
    }

    base.devices = distinctBy('device', database, startTs, endTs, true);
    base.browsers = distinctBy('browser', database, startTs, endTs, true);
    base.countries = distinctBy('country', database, startTs, endTs, false);

    const pageRows = database
      .prepare(
        `SELECT path AS key, COUNT(*) AS views FROM analytics_events
         WHERE ${window} AND name = 'pageview' AND path IS NOT NULL
         GROUP BY path ORDER BY views DESC LIMIT 10`,
      )
      .all(startTs, endTs) as Record<string, unknown>[];
    base.pages = pageRows.map((row) => ({ key: String(row.key), views: Number(row.views) || 0 }));

    const referrerRows = database
      .prepare(
        `SELECT COALESCE(referrer, 'Direct / none') AS key, COUNT(*) AS views
         FROM analytics_events
         WHERE ${window} AND name = 'pageview'
         GROUP BY COALESCE(referrer, 'Direct / none') ORDER BY views DESC LIMIT 10`,
      )
      .all(startTs, endTs) as Record<string, unknown>[];
    base.referrers = referrerRows.map((row) => ({ key: String(row.key), views: Number(row.views) || 0 }));

    const eventRows = database
      .prepare(
        `SELECT name, label, COUNT(*) AS count FROM analytics_events
         WHERE ${window} AND name != 'pageview'
         GROUP BY name, label ORDER BY count DESC LIMIT 15`,
      )
      .all(startTs, endTs) as Record<string, unknown>[];
    base.events = eventRows.map((row) => ({
      name: String(row.name),
      label: row.label === null || row.label === undefined ? null : String(row.label),
      count: Number(row.count) || 0,
    }));

    const searchRows = database
      .prepare(
        `SELECT label, COUNT(*) AS count FROM analytics_events
         WHERE ${window} AND name = 'search' AND label IS NOT NULL
         GROUP BY label ORDER BY count DESC LIMIT 10`,
      )
      .all(startTs, endTs) as Record<string, unknown>[];
    base.searches = searchRows.map((row) => ({ label: String(row.label), count: Number(row.count) || 0 }));
  } catch (error) {
    console.warn('Analytics: dashboard queries failed.', error);
  }

  return base;
}

/**
 * Distinct visitors grouped by a dimension, over the window. When
 * `pageviewsOnly` is set, only pageview rows count (device/browser/country are
 * constant per visitor; pageviews are the natural place they were enriched).
 */
function distinctBy(
  column: 'device' | 'browser' | 'country',
  database: DatabaseSync,
  startTs: number,
  endTs: number,
  pageviewsOnly: boolean
): { key: string; visitors: number }[] {
  const coalesce =
    column === 'country' ? "COALESCE(country, 'Unknown')" : `COALESCE(${column}, 'Unknown')`;
  const rows = database
    .prepare(
      `SELECT ${coalesce} AS key, COUNT(DISTINCT visitor_id) AS visitors
       FROM analytics_events
       WHERE ts >= ? AND ts < ? AND visitor_id IS NOT NULL${pageviewsOnly ? " AND name = 'pageview'" : ''}
       GROUP BY key ORDER BY visitors DESC LIMIT 10`,
    )
    .all(startTs, endTs) as Record<string, unknown>[];
  return rows.map((row) => ({ key: String(row.key), visitors: Number(row.visitors) || 0 }));
}
