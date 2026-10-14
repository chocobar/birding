import { NextRequest } from 'next/server';
import {
  countryFromHeaders,
  EVENT_NAMES,
  IncomingEvent,
  isAnalyticsEnabled,
  languageFromHeaders,
  parseUserAgent,
  recordEvents,
  StoredEvent,
} from '@/lib/server/analytics';

/**
 * POST /api/analytics/collect — the single write endpoint for the first-party
 * analytics tracker. Accepts a small JSON batch, validates it strictly,
 * enriches each event server-side (browser/OS/device from the User-Agent,
 * country from standard CDN geo headers, language from Accept-Language) and
 * stores it in SQLite. Bots, oversized payloads and flood traffic are dropped
 * silently — the tracker must never be able to break the page or the server.
 */

const MAX_EVENTS_PER_BATCH = 25;
const MAX_BODY_BYTES = 64 * 1024;

const STRING_LIMITS = {
  path: 300,
  label: 200,
  props: 400,
  referrer: 200,
  id: 64,
} as const;

const ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

// --- Flood protection (transient, in-memory; IPs are never persisted) --------

const RATE_WINDOW_MS = 60_000;
const RATE_MAX_EVENTS = 240;
let rateBuckets = new Map<string, number[]>();
let lastRateSweep = 0;

function overRateLimit(key: string, now: number): boolean {
  sweepRateLimits(now);
  const hits = (rateBuckets.get(key) ?? []).filter((ts) => now - ts < RATE_WINDOW_MS);
  if (hits.length >= RATE_MAX_EVENTS) {
    rateBuckets.set(key, hits);
    return true;
  }
  hits.push(now);
  rateBuckets.set(key, hits);
  return false;
}

function sweepRateLimits(now: number): void {
  if (now - lastRateSweep < RATE_WINDOW_MS) return;
  lastRateSweep = now;
  rateBuckets = new Map(
    Array.from(rateBuckets.entries()).filter(
      ([, hits]) => hits.length > 0 && now - hits[hits.length - 1] < RATE_WINDOW_MS
    )
  );
}

// --- Pageview de-duplication (same visitor + path within 10s) ------------------

const DEDUPE_WINDOW_MS = 10_000;
let recentPageviews = new Map<string, number>();

function isDuplicatePageview(visitorId: string, path: string, now: number): boolean {
  if (recentPageviews.size > 10_000) recentPageviews = new Map();
  const key = `${visitorId}|${path}`;
  const last = recentPageviews.get(key);
  if (last !== undefined && now - last < DEDUPE_WINDOW_MS) return true;
  recentPageviews.set(key, now);
  return false;
}

// --- Validation ----------------------------------------------------------------

function boundedString(value: unknown, limit: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, limit);
}

function parseEvent(raw: unknown, now: number): IncomingEvent | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const source = raw as Record<string, unknown>;

  const name = typeof source.name === 'string' ? source.name : '';
  if (!name || name.length > 32) return null;
  if (!EVENT_NAMES.has(name)) return null;

  const visitorId = boundedString(source.visitorId, STRING_LIMITS.id);
  if (!visitorId || !ID_PATTERN.test(visitorId)) return null;

  const sessionId = boundedString(source.sessionId, STRING_LIMITS.id);
  const path = boundedString(source.path, STRING_LIMITS.path);
  const label = boundedString(source.label, STRING_LIMITS.label);
  const props = boundedString(source.props, STRING_LIMITS.props);
  const referrer = boundedString(source.referrer, STRING_LIMITS.referrer);

  if (name === 'pageview' && visitorId && path && isDuplicatePageview(visitorId, path, now)) {
    return null;
  }

  return { name, path, label, props, visitorId, sessionId, referrer };
}

export async function POST(request: NextRequest) {
  if (!isAnalyticsEnabled()) {
    return new Response(null, { status: 204 });
  }

  let bodyText: string;
  try {
    bodyText = await request.text();
  } catch {
    return Response.json({ error: 'Unreadable body' }, { status: 400 });
  }
  if (bodyText.length > MAX_BODY_BYTES) {
    return Response.json({ error: 'Payload too large' }, { status: 413 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return Response.json({ error: 'Invalid payload' }, { status: 400 });
  }
  const rawEvents = (parsed as Record<string, unknown>).events;
  if (!Array.isArray(rawEvents) || rawEvents.length === 0 || rawEvents.length > MAX_EVENTS_PER_BATCH) {
    return Response.json({ error: 'Invalid events batch' }, { status: 400 });
  }

  const userAgent = request.headers.get('user-agent') ?? '';
  const { browser, browserVersion, os, device, isBot } = parseUserAgent(userAgent);

  // Bots (search crawlers, monitors, headless checks) never contribute data
  if (isBot) {
    return new Response(null, { status: 204 });
  }

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';
  const now = Date.now();
  if (overRateLimit(ip, now)) {
    return new Response(null, { status: 429 });
  }

  const country = countryFromHeaders(request.headers);
  const lang = languageFromHeaders(request.headers);

  const stored: StoredEvent[] = [];
  for (const raw of rawEvents) {
    const event = parseEvent(raw, now);
    if (!event) continue;
    stored.push({
      ...event,
      ts: now,
      country,
      browser,
      browserVersion,
      os,
      device,
      lang,
    });
  }

  if (stored.length > 0) {
    try {
      await recordEvents(stored);
    } catch {
      // Recording failures must never surface to the visitor
    }
  }

  return new Response(null, { status: 204 });
}
