/**
 * Client-side analytics forwarding to the configured SaaS provider
 * (Umami, Plausible, PostHog or GA4 — resolved from the environment by the
 * root layout). The site keeps no analytics store of its own.
 *
 * Calls made before the provider's script has loaded are queued and flushed
 * once it is ready, so entry pageviews and early clicks are never lost.
 * Automated browsers (webdriver) are skipped at the source.
 *
 * Every call is fire-and-forget and failure-tolerant: analytics must never
 * break the page, so all errors are swallowed.
 */

import type { AnalyticsProviderId } from '@/lib/server/analyticsProvider';

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

/** One event waiting for the provider's script to load */
interface PendingEvent {
  name: TrackableEvent | 'pageview';
  /** Set for pageviews (site-relative path) */
  pageviewPath?: string;
  label?: string;
  props?: string;
}

let providerId: AnalyticsProviderId | null = null;
let queue: PendingEvent[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;
let queueStartedAt = 0;
let posthogInitialized = false;
let ga4Configured = false;
let ga4FirstPageviewSkipped = false;
let lastPageviewPath: string | null = null;
let disabledCache: boolean | undefined;

// Provider credentials the browser APIs need; injected by configureAnalytics()
let measurementIdCache = '';
let posthogKeyCache = '';
let posthogHostCache = '';

/** Wait at most this long for the provider's script before giving up */
const QUEUE_MAX_AGE_MS = 60_000;
const QUEUE_LIMIT = 50;
const FLUSH_INTERVAL_MS = 500;

type ProviderWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
  umami?: { track: (name?: string | Record<string, unknown>, data?: Record<string, string | number | boolean>) => void };
  plausible?: ((...args: unknown[]) => void) & { q?: unknown[] };
  posthog?: { init: (...args: unknown[]) => void; capture: (name: string, data?: Record<string, unknown>) => void };
};

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

/**
 * Route all tracking to a SaaS provider. Called by <Analytics /> with the
 * layout-resolved config.
 */
export function configureAnalytics(config: {
  provider: AnalyticsProviderId;
  measurementId?: string;
  posthogApiKey?: string;
  posthogApiHost?: string;
}): void {
  measurementIdCache = config.measurementId ?? '';
  posthogKeyCache = config.posthogApiKey ?? '';
  posthogHostCache = config.posthogApiHost ?? '';

  if (providerId === config.provider) return;
  providerId = config.provider;
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
    flushTimer = setInterval(flushQueue, FLUSH_INTERVAL_MS);
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

/** The standard gtag.js shim: pushes into dataLayer, which the loaded script drains */
function ensureGtagShim(): void {
  if (typeof window === 'undefined') return;
  const w = window as ProviderWindow;
  if (!Array.isArray(w.dataLayer)) w.dataLayer = [];
  if (typeof w.gtag !== 'function') {
    w.gtag = function gtagShim(...args: unknown[]) {
      (w as { dataLayer: unknown[] }).dataLayer.push(args);
    };
  }
  if (!ga4Configured) {
    ga4Configured = true;
    w.gtag('js', new Date());
    w.gtag('config', measurementIdCache);
  }
}

/** GA4 event names: letters/digits/underscores, must start with a letter, max 40 chars */
function ga4SafeName(name: string): string {
  const safe = name.replace(/[^A-Za-z0-9_]/g, '_').slice(0, 40);
  return /^[A-Za-z]/.test(safe) ? safe : `ev_${safe}`;
}

function providerReady(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as ProviderWindow;
  switch (providerId) {
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

function dispatch(event: PendingEvent): void {
  const w = window as ProviderWindow;
  const props = parseProps(event.props);

  switch (providerId) {
    case 'umami': {
      if (!w.umami) return;
      if (event.pageviewPath !== undefined) {
        w.umami.track();
      } else {
        const data: Record<string, string | number | boolean> = {};
        if (event.label) data.label = event.label;
        Object.assign(data, props);
        w.umami.track(event.name, data);
      }
      return;
    }
    case 'plausible': {
      if (!w.plausible) return;
      if (event.pageviewPath !== undefined) {
        const url = new URL(event.pageviewPath, window.location.origin).href;
        w.plausible('pageview', { url });
      } else {
        const plausibleProps: Record<string, string | number | boolean> = {};
        if (event.label) plausibleProps.label = event.label;
        Object.assign(plausibleProps, props);
        w.plausible(event.name, { props: plausibleProps });
      }
      return;
    }
    case 'posthog': {
      if (!w.posthog) return;
      if (!posthogInitialized) {
        posthogInitialized = true;
        w.posthog.init(posthogKeyCache, {
          api_host: posthogHostCache,
          capture_pageview: false,
        });
      }
      if (event.pageviewPath !== undefined) {
        w.posthog.capture('$pageview', {
          $current_url: new URL(event.pageviewPath, window.location.origin).href,
        });
      } else {
        const data: Record<string, unknown> = { ...props };
        if (event.label) data.label = event.label;
        w.posthog.capture(event.name, data);
      }
      return;
    }
    case 'ga4': {
      ensureGtagShim();
      if (!w.gtag) return;
      if (event.pageviewPath !== undefined) {
        w.gtag('event', 'page_view', {
          page_path: event.pageviewPath,
          page_location: new URL(event.pageviewPath, window.location.origin).href,
        });
      } else {
        const params: Record<string, unknown> = {};
        if (event.label) params.event_label = event.label;
        Object.assign(params, props);
        w.gtag('event', ga4SafeName(event.name), params);
      }
      return;
    }
    default:
      // No provider configured — nothing to dispatch
      return;
  }
}

function flushQueue(): void {
  if (!providerId) return;

  // Give up on the provider if its script never arrives (blocked, offline);
  // drop the backlog instead of buffering forever.
  if (queue.length > 0 && Date.now() - queueStartedAt > QUEUE_MAX_AGE_MS) {
    queue = [];
  }

  while (queue.length > 0 && providerReady()) {
    const event = queue.shift();
    if (!event) continue;
    try {
      dispatch(event);
    } catch {
      // provider errors must never surface
    }
  }

  if (queue.length === 0 && flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
}

function dispatchOrQueue(event: PendingEvent): void {
  if (providerReady()) {
    try {
      dispatch(event);
      return;
    } catch {
      // fall through to the queue
    }
  }

  queue.push(event);
  if (queue.length > QUEUE_LIMIT) {
    queue.shift();
  }
  if (!flushTimer) {
    queueStartedAt = Date.now();
    flushTimer = setInterval(flushQueue, FLUSH_INTERVAL_MS);
  }
}

// --- Public API ------------------------------------------------------------------

/**
 * Track an engagement event. `label` names what was interacted with (a bird
 * species, a location, a button); `props` carries small structured extras.
 * Label text is truncated to 200 chars; keep it short here.
 */
export function trackEvent(name: TrackableEvent, label?: string, props?: TrackProps): void {
  if (typeof window === 'undefined' || isDisabled() || !providerId) return;

  dispatchOrQueue({
    name,
    label: label?.slice(0, 200),
    props: serializeProps(props),
  });
}

/** Track a pageview. Called by <Analytics /> on load and on route changes. */
export function trackPageview(pathname: string): void {
  if (typeof window === 'undefined' || isDisabled() || !providerId) return;
  if (pathname === lastPageviewPath) return;
  lastPageviewPath = pathname;

  // GA4's gtag('config') already tracks the initial pageview on load;
  // only route changes need a manual page_view event.
  if (providerId === 'ga4' && !ga4FirstPageviewSkipped) {
    ga4FirstPageviewSkipped = true;
    return;
  }

  dispatchOrQueue({ name: 'pageview', pageviewPath: pathname });
}
