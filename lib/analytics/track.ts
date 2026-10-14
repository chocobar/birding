/**
 * Client-side analytics routing.
 *
 * Two sinks, selected at runtime by the root layout:
 *
 * 1. Built-in (default) — events POST to the site's own collector
 *    (/api/analytics/collect) and land in SQLite, viewable at /analytics.
 *    Visitor id: a random token in the visitor's own localStorage (not a
 *    cookie); sessions are 30-minute activity windows.
 *
 * 2. SaaS provider (umami | plausible | posthog | ga4) — the same events are
 *    forwarded to the provider's browser API. Calls made before the
 *    provider's script has loaded are queued and flushed once it is ready, so
 *    entry pageviews and early clicks are never lost.
 *
 * Privacy model for the built-in sink: no cookies, no cross-site identifiers,
 * no fingerprinting, nothing personal beyond the location-search text a
 * visitor typed (truncated to 120 chars). Raw IP addresses are never sent,
 * stored or logged server-side.
 *
 * Every call is fire-and-forget and failure-tolerant: analytics must never
 * break the page, so all storage and network errors are swallowed.
 */

import type { AnalyticsProviderId } from '@/lib/server/analyticsProvider';

const COLLECT_URL = '/api/analytics/collect';
const VISITOR_KEY = 'bd_vid';
const SESSION_KEY = 'bd_sid';
const SESSION_TS_KEY = 'bd_sid_ts';
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

export type TrackableEvent =
  | 'click'
  | 'outbound'
  | 'search'
  | 'geolocate'
  | 'map_open'
  | 'audio_play'
  | 'time_range';

export interface TrackProps {
  [key: string]: string | number | boolean | null | undefined;
}

interface OutgoingEvent {
  name: TrackableEvent | 'pageview';
  path?: string;
  label?: string;
  props?: string;
  visitorId: string;
  sessionId: string;
  referrer?: string;
}

/** One event waiting for an external provider's script to load */
interface PendingExternal {
  name: TrackableEvent | 'pageview';
  /** Set for pageviews (site-relative path) */
  pageviewPath?: string;
  label?: string;
  props?: string;
}

// --- Built-in sink state -------------------------------------------------------

let disabledCache: boolean | undefined;
let cachedVisitorId: string | null = null;
let firstPageviewSent = false;
let lastPageviewPath: string | null = null;

// --- External provider state ----------------------------------------------------

let externalProvider: AnalyticsProviderId | null = null;
let externalQueue: PendingExternal[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;
let queueStartedAt = 0;
let posthogInitialized = false;
let ga4Configured = false;
let ga4FirstPageviewSkipped = false;

/** Wait at most this long for an external provider's script before giving up */
const EXTERNAL_QUEUE_MAX_AGE_MS = 60_000;
const EXTERNAL_QUEUE_LIMIT = 50;
const FLUSH_INTERVAL_MS = 500;

// --- Built-in ids ----------------------------------------------------------------

function randomId(): string {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
  } catch {
    // fall through to the manual generator
  }
  // Fallback for non-secure contexts without crypto.randomUUID
  return `v${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}-${Math.random()
    .toString(36)
    .slice(2, 12)}`;
}

function storageGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Private mode etc. — in-memory ids keep the session usable
  }
}

/** Stable random per-browser id (kept in the visitor's own localStorage) */
function getVisitorId(): string {
  if (cachedVisitorId) return cachedVisitorId;
  let id = storageGet(VISITOR_KEY);
  if (!id || !/^[A-Za-z0-9_-]{8,64}$/.test(id)) {
    id = randomId();
    storageSet(VISITOR_KEY, id);
  }
  cachedVisitorId = id;
  return id;
}

/**
 * Session id: a fresh id whenever the last tracked activity is older than 30
 * minutes, so dashboard "sessions" approximate visits.
 */
function getSessionId(): string {
  const now = Date.now();
  const existing = storageGet(SESSION_KEY);
  const lastActivity = Number(storageGet(SESSION_TS_KEY)) || 0;
  if (existing && /^[A-Za-z0-9_-]{8,64}$/.test(existing) && now - lastActivity < SESSION_TIMEOUT_MS) {
    storageSet(SESSION_TS_KEY, String(now));
    return existing;
  }
  const id = randomId();
  storageSet(SESSION_KEY, id);
  storageSet(SESSION_TS_KEY, String(now));
  return id;
}

/** Automated browsers (webdriver) are excluded at the source */
function isDisabled(): boolean {
  if (disabledCache === undefined) {
    try {
      disabledCache = typeof navigator !== 'undefined' && Boolean(navigator.webdriver);
    } catch {
      disabledCache = false;
    }
  }
  return disabledCache;
}

function send(event: OutgoingEvent): void {
  if (typeof window === 'undefined' || isDisabled()) return;

  const body = JSON.stringify({ events: [event] });
  try {
    if (typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' });
      if (navigator.sendBeacon(COLLECT_URL, blob)) return;
    }
  } catch {
    // fall through to fetch
  }

  try {
    void fetch(COLLECT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    });
  } catch {
    // Analytics must never break the page
  }
}

// --- External provider plumbing ---------------------------------------------------

/**
 * Route all tracking to a SaaS provider. Called by <Analytics /> when the
 * root layout resolved an external provider.
 */
export function configureAnalytics(config: {
  provider: AnalyticsProviderId;
  measurementId?: string;
  posthogApiKey?: string;
  posthogApiHost?: string;
}): void {
  externalMeasurementIdCache = config.measurementId ?? '';
  externalPosthogKeyCache = config.posthogApiKey ?? '';
  externalPosthogHostCache = config.posthogApiHost ?? '';

  if (externalProvider === config.provider) return;
  externalProvider = config.provider;
  posthogInitialized = false;
  ga4Configured = false;
  ga4FirstPageviewSkipped = false;
  queueStartedAt = Date.now();

  // GA4 works entirely through the dataLayer queue, which is available
  // immediately — push the setup events now so the auto pageview from
  // gtag('config') fires as early as possible.
  if (config.provider === 'ga4') {
    ensureGtagShim();
  }

  if (!flushTimer) {
    flushTimer = setInterval(flushExternalQueue, FLUSH_INTERVAL_MS);
  }
}

function serializeProps(props?: TrackProps): string | undefined {
  if (!props) return undefined;
  try {
    const json = JSON.stringify(props);
    return json && json !== '{}' ? json.slice(0, 400) : undefined;
  } catch {
    return undefined;
  }
}

function parseProps(json?: string): Record<string, string | number | boolean> {
  if (!json) return {};
  try {
    const parsed = JSON.parse(json) as Record<string, unknown>;
    const clean: Record<string, string | number | boolean> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        clean[key] = value;
      }
    }
    return clean;
  } catch {
    return {};
  }
}

type GaWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
  umami?: { track: (name?: string | Record<string, unknown>, data?: Record<string, string | number | boolean>) => void };
  plausible?: ((...args: unknown[]) => void) & { q?: unknown[] };
  posthog?: { init: (...args: unknown[]) => void; capture: (name: string, data?: Record<string, unknown>) => void };
};

/** The standard gtag.js shim: pushes into dataLayer, which the loaded script drains */
function ensureGtagShim(): void {
  if (typeof window === 'undefined') return;
  const w = window as GaWindow;
  if (!Array.isArray(w.dataLayer)) w.dataLayer = [];
  if (typeof w.gtag !== 'function') {
    w.gtag = function gtagShim(...args: unknown[]) {
      (w as { dataLayer: unknown[] }).dataLayer.push(args);
    };
  }
  if (!ga4Configured) {
    ga4Configured = true;
    w.gtag('js', new Date());
    w.gtag('config', externalMeasurementIdCache);
  }
}

// External provider credentials the browser APIs need; injected by
// configureAnalytics() from the layout-resolved config.
let externalMeasurementIdCache = '';
let externalPosthogKeyCache = '';
let externalPosthogHostCache = '';

function externalPosthogKey(): string {
  return externalPosthogKeyCache;
}

function externalPosthogHost(): string {
  return externalPosthogHostCache;
}

function providerReady(): boolean {  if (typeof window === 'undefined') return false;
  const w = window as GaWindow;
  switch (externalProvider) {
    case 'umami':
      return typeof w.umami?.track === 'function';
    case 'plausible':
      // The pre-load shim (rendered next to the script tag) already queues
      return typeof w.plausible === 'function';
    case 'posthog':
      return typeof w.posthog?.capture === 'function';
    case 'ga4':
      return Array.isArray(w.dataLayer);
    default:
      return false;
  }
}

function dispatchExternal(item: PendingExternal): void {
  const w = window as GaWindow;
  const props = parseProps(item.props);

  switch (externalProvider) {
    case 'umami': {
      if (!w.umami) return;
      if (item.pageviewPath !== undefined) {
        w.umami.track();
      } else {
        const data: Record<string, string | number | boolean> = {};
        if (item.label) data.label = item.label;
        Object.assign(data, props);
        w.umami.track(item.name, data);
      }
      return;
    }
    case 'plausible': {
      if (!w.plausible) return;
      if (item.pageviewPath !== undefined) {
        const url = new URL(item.pageviewPath, window.location.origin).href;
        w.plausible('pageview', { url });
      } else {
        const plausibleProps: Record<string, string | number | boolean> = {};
        if (item.label) plausibleProps.label = item.label;
        Object.assign(plausibleProps, props);
        w.plausible(item.name, { props: plausibleProps });
      }
      return;
    }
    case 'posthog': {
      if (!w.posthog) return;
      if (!posthogInitialized) {
        posthogInitialized = true;
        w.posthog.init(
          externalPosthogKey(),
          typeof externalPosthogHost() === 'string' ? { api_host: externalPosthogHost(), capture_pageview: false } : {}
        );
      }
      if (item.pageviewPath !== undefined) {
        w.posthog.capture('$pageview', {
          $current_url: new URL(item.pageviewPath, window.location.origin).href,
        });
      } else {
        const data: Record<string, unknown> = { ...props };
        if (item.label) data.label = item.label;
        w.posthog.capture(item.name, data);
      }
      return;
    }
    case 'ga4': {
      ensureGtagShim();
      if (!w.gtag) return;
      if (item.pageviewPath !== undefined) {
        w.gtag('event', 'page_view', {
          page_path: item.pageviewPath,
          page_location: new URL(item.pageviewPath, window.location.origin).href,
        });
      } else {
        const params: Record<string, unknown> = {};
        if (item.label) params.event_label = item.label;
        Object.assign(params, props);
        w.gtag('event', ga4SafeName(item.name), params);
      }
      return;
    }
    default:
      // No external provider configured — nothing to dispatch
      return;
  }
}

/** GA4 event names: letters/digits/underscores, must start with a letter, max 40 chars */
function ga4SafeName(name: string): string {
  const safe = name.replace(/[^A-Za-z0-9_]/g, '_').slice(0, 40);
  return /^[A-Za-z]/.test(safe) ? safe : `ev_${safe}`;
}

function flushExternalQueue(): void {
  if (!externalProvider) return;

  // Give up on the provider if its script never arrives (blocked, offline);
  // drop the backlog instead of buffering forever.
  if (externalQueue.length > 0 && Date.now() - queueStartedAt > EXTERNAL_QUEUE_MAX_AGE_MS) {
    externalQueue = [];
  }

  while (externalQueue.length > 0 && providerReady()) {
    const item = externalQueue.shift();
    if (!item) continue;
    try {
      dispatchExternal(item);
    } catch {
      // provider errors must never surface
    }
  }

  if (externalQueue.length === 0 && flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
}

function dispatchOrQueue(item: PendingExternal): void {
  if (providerReady()) {
    try {
      dispatchExternal(item);
      return;
    } catch {
      // fall through to the queue
    }
  }

  externalQueue.push(item);
  if (externalQueue.length > EXTERNAL_QUEUE_LIMIT) {
    externalQueue.shift();
  }
  if (!flushTimer) {
    queueStartedAt = Date.now();
    flushTimer = setInterval(flushExternalQueue, FLUSH_INTERVAL_MS);
  }
}

// --- Public API ------------------------------------------------------------------

/**
 * Track an engagement event. `label` names what was interacted with (a bird
 * species, a location, a button); `props` carries small structured extras.
 * Label text is truncated to 200 chars server-side; keep it short here.
 */
export function trackEvent(name: TrackableEvent, label?: string, props?: TrackProps): void {
  if (typeof window === 'undefined' || isDisabled()) return;

  if (externalProvider) {
    dispatchOrQueue({
      name,
      label: label?.slice(0, 200),
      props: serializeProps(props),
    });
    return;
  }

  const event: OutgoingEvent = {
    name,
    visitorId: getVisitorId(),
    sessionId: getSessionId(),
  };
  if (label) event.label = label.slice(0, 200);
  if (props) {
    try {
      const json = JSON.stringify(props);
      if (json && json !== '{}') event.props = json.slice(0, 400);
    } catch {
      // non-serialisable props are simply dropped
    }
  }
  send(event);
}

/** Track a pageview. Called by <Analytics /> on load and on route changes. */
export function trackPageview(pathname: string): void {
  if (typeof window === 'undefined' || isDisabled()) return;
  if (pathname === lastPageviewPath) return;
  lastPageviewPath = pathname;

  if (externalProvider) {
    // GA4's gtag('config') already tracks the initial pageview on load;
    // only route changes need a manual page_view event.
    if (externalProvider === 'ga4' && !ga4FirstPageviewSkipped) {
      ga4FirstPageviewSkipped = true;
      return;
    }
    dispatchOrQueue({ name: 'pageview', pageviewPath: pathname });
    return;
  }

  const event: OutgoingEvent = {
    name: 'pageview',
    path: pathname.slice(0, 300),
    visitorId: getVisitorId(),
    sessionId: getSessionId(),
  };

  if (!firstPageviewSent) {
    firstPageviewSent = true;
    // The external referrer (if any) only applies to the entry pageview
    try {
      const ref = document.referrer;
      if (ref) {
        const refUrl = new URL(ref, window.location.href);
        if (refUrl.host !== window.location.host) {
          event.referrer = refUrl.origin.slice(0, 200);
        }
      }
    } catch {
      // referrer stays unset
    }
    // Landing campaign attribution, when the URL carries UTM params
    try {
      const params = new URLSearchParams(window.location.search);
      const utm: TrackProps = {};
      for (const key of ['utm_source', 'utm_medium', 'utm_campaign']) {
        const value = params.get(key);
        if (value) utm[key] = value.slice(0, 100);
      }
      if (Object.keys(utm).length > 0) {
        utm.landingQuery = window.location.search.slice(0, 150);
        event.props = JSON.stringify(utm);
      }
    } catch {
      // props stay unset
    }
  }

  send(event);
}
