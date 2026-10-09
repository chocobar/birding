/**
 * Shared Xeno-canto sound lookup utility.
 *
 * Resolves a bird's scientific name to a CC-licensed recording (song or
 * call) playable from the app, plus the attribution Xeno-canto requires
 * (recordist + license).
 *
 * Lookup strategy (best effort, never throws):
 *  1. Xeno-canto API v3 when XENO_CANTO_API_KEY is configured (server-side
 *     only, like EBIRD_API_KEY). API v2 was retired in 2026 and v3 requires
 *     a free key, so without one we fall back to:
 *  2. The public explore page (https://xeno-canto.org/explore?query=...)
 *     which is fetchable server-side with an identifying User-Agent and
 *     carries the same per-recording metadata (recordist, license, quality,
 *     length, cat.no.) in its results table.
 *
 * Successful AND unsuccessful lookups are cached in memory so repeated
 * searches for the same species never re-query Xeno-canto. The species ->
 * recording mapping therefore lives entirely server-side; the client only
 * ever sees a same-origin stream URL (/api/bird-sound/stream?id=...) and
 * the attribution string, never an upstream hotlink.
 */

export interface BirdSoundInfo {
  /** Xeno-canto catalogue number, e.g. "1152299" */
  recordingId: string | null;
  /** Same-origin stream URL for the clip; null when no recording was found */
  audioUrl: string | null;
  /** Recordist name, for the credit line */
  recordist: string | null;
  /** Short license name, e.g. "CC BY-NC-SA 4.0" */
  license: string | null;
  /** License URL (linked from the credit) */
  licenseUrl: string | null;
  /** Recording page on xeno-canto.org (the canonical attribution link) */
  pageUrl: string | null;
}

interface RecordingCandidate {
  recordingId: string;
  type: string | null;
  quality: string | null;
  lengthSeconds: number;
  recordist: string | null;
  licenseUrl: string | null;
}

const XC_BASE = 'https://xeno-canto.org';
const USER_AGENT = 'BirdingDiscovery/1.0 (hobby project)';
const FETCH_TIMEOUT_MS = 10_000;
/** Clip length beyond this only wins when nothing shorter exists */
const MAX_PREFERRED_LENGTH_SECONDS = 180;
/** Clips shorter than this are last resorts — a 1-second blip is no song */
const MIN_PREFERRED_LENGTH_SECONDS = 5;

/** In-memory cache for Xeno-canto sound lookups (incl. negative results). */
export const soundCache = new Map<string, BirdSoundInfo>();

/** Collapses concurrent lookups of the same species into one request. */
const inFlight = new Map<string, Promise<BirdSoundInfo>>();

const NO_SOUND: BirdSoundInfo = {
  recordingId: null,
  audioUrl: null,
  recordist: null,
  license: null,
  licenseUrl: null,
  pageUrl: null,
};

function normalizeScientificName(scientificName: string): string {
  return scientificName.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** "Erithacus rubecula" → "gen:Erithacus sp:rubecula" (binomial only). */
function toXcSpeciesTag(scientificName: string): string | null {
  const parts = scientificName.trim().replace(/\s+/g, ' ').split(' ');
  if (parts.length < 2) return null;
  const [genus, species] = parts;
  if (!/^[A-Za-z-]+$/.test(genus) || !/^[A-Za-z-]+$/.test(species)) return null;
  return `gen:${genus} sp:${species}`;
}

/**
 * Parse "0:18" / "1:05" / "1:02:03" into seconds; Infinity when unparseable
 * so malformed entries sort last rather than first.
 */
function parseLengthSeconds(length: string | null | undefined): number {
  if (!length) return Number.POSITIVE_INFINITY;
  const parts = length.trim().split(':').map((p) => parseInt(p, 10));
  if (parts.some((p) => isNaN(p) || p < 0) || parts.length === 0 || parts.length > 3) {
    return Number.POSITIVE_INFINITY;
  }
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}

/** "https://creativecommons.org/licenses/by-nc-sa/4.0/" → "CC BY-NC-SA 4.0" */
export function licenseShortName(licenseUrl: string | null): string | null {
  if (!licenseUrl) return null;
  try {
    const url = new URL(licenseUrl.startsWith('//') ? `https:${licenseUrl}` : licenseUrl);
    const ccMatch = url.pathname.match(/\/licenses\/([a-z0-9-]+)\/([\d.]+)/i);
    if (ccMatch) {
      // Keep the hyphens — CC license names are "BY-NC-SA", not "BY NC SA".
      return `CC ${ccMatch[1].toUpperCase()} ${ccMatch[2]}`;
    }
    if (/\/publicdomain\/zero/i.test(url.pathname)) return 'CC0 1.0';
    if (/publicdomain|\/licenses\/pd/i.test(url.pathname)) return 'Public domain';
    return null;
  } catch {
    return null;
  }
}

/** Rank sound types: song first, then calls, then anything else. */
function typeRank(type: string | null): number {
  if (!type) return 2;
  const t = type.toLowerCase();
  if (t.includes('song')) return 0;
  if (t.includes('call')) return 1;
  return 2;
}

/** Rank quality A (best) … E (worst); unrated sorts last. */
function qualityRank(quality: string | null): number {
  if (!quality) return 5;
  const index = 'ABCDE'.indexOf(quality.trim().toUpperCase().charAt(0));
  return index === -1 ? 5 : index;
}

/** Rank candidates: song before call, better quality, shorter length. */
function compareCandidates(a: RecordingCandidate, b: RecordingCandidate): number {
  const byType = typeRank(a.type) - typeRank(b.type);
  if (byType !== 0) return byType;
  const byQuality = qualityRank(a.quality) - qualityRank(b.quality);
  if (byQuality !== 0) return byQuality;
  return a.lengthSeconds - b.lengthSeconds;
}

/**
 * Prefer short, good-quality clips: within a sensible length band pick by
 * type → quality → shortest length. Species whose only recordings sit
 * outside the band still get their best available clip.
 */
function pickBest(candidates: RecordingCandidate[]): RecordingCandidate | null {
  if (candidates.length === 0) return null;
  const preferred = candidates.filter(
    (c) =>
      c.lengthSeconds >= MIN_PREFERRED_LENGTH_SECONDS &&
      c.lengthSeconds <= MAX_PREFERRED_LENGTH_SECONDS
  );
  const pool = preferred.length > 0 ? preferred : candidates;
  return [...pool].sort(compareCandidates)[0];
}

function toBirdSoundInfo(candidate: RecordingCandidate): BirdSoundInfo {
  const license = licenseShortName(candidate.licenseUrl);
  return {
    recordingId: candidate.recordingId,
    audioUrl: `/api/bird-sound/stream?id=${encodeURIComponent(candidate.recordingId)}`,
    recordist: candidate.recordist,
    license,
    licenseUrl: candidate.licenseUrl,
    pageUrl: `${XC_BASE}/${candidate.recordingId}`,
  };
}

interface XcApiRecording {
  id?: string;
  type?: string | null;
  q?: string | null;
  length?: string | null;
  rec?: string | null;
  lic?: string | null;
}

async function fetchViaApi(
  speciesTag: string,
  querySuffix: string,
  apiKey: string
): Promise<RecordingCandidate[]> {
  const query = `${speciesTag}${querySuffix ? ` ${querySuffix}` : ''}`;
  const url =
    `${XC_BASE}/api/3/recordings?query=${encodeURIComponent(query)}` +
    `&key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) return [];
  const data = (await response.json()) as { recordings?: XcApiRecording[] };
  const recordings = Array.isArray(data?.recordings) ? data.recordings : [];
  return recordings
    .filter((rec) => typeof rec?.id === 'string' && /^\d+$/.test(rec.id))
    .map((rec) => ({
      recordingId: rec.id as string,
      type: rec.type ?? null,
      quality: rec.q ?? null,
      lengthSeconds: parseLengthSeconds(rec.length),
      recordist: rec.rec?.trim() || null,
      licenseUrl: rec.lic || null,
    }));
}

/** Strip HTML tags and decode the handful of entities XC pages emit. */
function decodeHtml(text: string): string {
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;|&#8217;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(parseInt(code, 10)))
    .trim();
}

/**
 * Parse recording rows out of an explore results page. Each row carries a
 * mini-player (id), recordist link, quality rating, length and license.
 * Best effort: a markup change yields no rows, which callers treat as
 * "no recording found".
 */
export function parseExplorePage(html: string): RecordingCandidate[] {
  const tableStart = html.indexOf("<table class='results'>");
  if (tableStart === -1) return [];
  const tableEnd = html.indexOf('</table>', tableStart);
  if (tableEnd === -1) return [];
  const table = html.slice(tableStart, tableEnd);

  const candidates: RecordingCandidate[] = [];
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  for (const row of table.match(rowRegex) ?? []) {
    const idMatch = row.match(/xc_audio_(\d+)_/) ?? row.match(/rating-(\d+)-\d/);
    if (!idMatch) continue;

    const recordistMatch = row.match(/contributor\/[A-Za-z0-9]+['"][^>]*>([^<]+)</);
    const licenseMatch = row.match(
      /href=["'](https?:\/\/[^"']*?(?:creativecommons\.org\/(?:licenses|publicdomain)|spdx\.org)[^"']*?)["']/
    );
    const qualityMatch = row.match(/rating-\d+-([1-5])['"][^>]*class=['"]selected/);
    const lengthMatch = row.match(/<td>\s*(\d{1,2}:[0-5]\d(?::[0-5]\d)?)\s*<\/td>/);

    // The plain-text type cell (e.g. "song", "call", "dawn song") — the
    // ladder queries usually pin the type anyway; this only ranks the
    // unfiltered fallback query's rows.
    let type: string | null = null;
    for (const cellMatch of row.matchAll(/<td>([^<>]{1,120})<\/td>/g)) {
      const text = decodeHtml(cellMatch[1]).toLowerCase();
      if (text.includes('song') || text.includes('call')) {
        type = text;
        break;
      }
    }

    candidates.push({
      recordingId: idMatch[1],
      type,
      quality: qualityMatch ? 'ABCDE'[parseInt(qualityMatch[1], 10) - 1] : null,
      lengthSeconds: parseLengthSeconds(lengthMatch?.[1] ?? null),
      recordist: recordistMatch ? decodeHtml(recordistMatch[1]) : null,
      licenseUrl: licenseMatch ? decodeHtml(licenseMatch[1]) : null,
    });
  }
  return candidates;
}

async function fetchViaExplorePage(
  speciesTag: string,
  querySuffix: string
): Promise<RecordingCandidate[]> {
  const query = `${speciesTag}${querySuffix ? ` ${querySuffix}` : ''}`;
  const url = `${XC_BASE}/explore?query=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) return [];
  return parseExplorePage(await response.text());
}

/**
 * Look up the best recording for a species.
 *
 * Query ladder — stops at the first step that returns recordings:
 *  1. songs of quality B or better   ({sci} type:song q:">C")
 *  2. any B-or-better sound          ({sci} q:">C")
 *  3. anything at all                ({sci})
 *
 * Both successful and unsuccessful lookups are cached (keyed by lower-cased
 * scientific name) so repeated calls don't re-query Xeno-canto.
 */
export async function lookupBirdSound(
  scientificName: string
): Promise<BirdSoundInfo> {
  const cacheKey = normalizeScientificName(scientificName);
  if (!cacheKey) return NO_SOUND;

  const cached = soundCache.get(cacheKey);
  if (cached) return cached;

  const pending = inFlight.get(cacheKey);
  if (pending) return pending;

  const promise = (async (): Promise<BirdSoundInfo> => {
    const speciesTag = toXcSpeciesTag(scientificName);
    if (!speciesTag) return NO_SOUND;

    const ladder: string[] = ['type:song q:">C"', 'q:">C"', ''];
    const apiKey = process.env.XENO_CANTO_API_KEY;

    for (const querySuffix of ladder) {
      try {
        let candidates: RecordingCandidate[] = [];
        if (apiKey) {
          candidates = await fetchViaApi(speciesTag, querySuffix, apiKey);
        }
        if (candidates.length === 0) {
          // Keyless path, also the fallback when the API call fails or
          // comes back empty (e.g. revoked/expired key).
          candidates = await fetchViaExplorePage(speciesTag, querySuffix);
        }
        const best = pickBest(candidates);
        if (best) return toBirdSoundInfo(best);
      } catch (error) {
        console.error(
          `Xeno-canto lookup failed for "${scientificName}" (query: "${speciesTag} ${querySuffix}"):`,
          error
        );
        // Try the next, less restrictive query before giving up.
      }
    }

    return NO_SOUND;
  })();

  inFlight.set(cacheKey, promise);
  try {
    const result = await promise;
    soundCache.set(cacheKey, result);
    return result;
  } finally {
    inFlight.delete(cacheKey);
  }
}
