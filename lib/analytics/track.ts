/**
 * Client-side helpers for the first-party analytics tracker.
 *
 * Privacy model (mirrors privacy-friendly tools like Plausible/Umami):
 * - No cookies, no cross-site identifiers, no fingerprinting
 * - The visitor id is a random token the browser keeps in its own
 *   localStorage; it is meaningless outside this site and rotates when cleared
 * - A "session" is just a 30-minute activity window, also localStorage-backed
 * - Nothing personal is collected: the closest thing is the location-search
 *   text a visitor typed (truncated to 120 chars)
 * - Raw IP addresses are never sent, stored or logged server-side
 *
 * Every call is fire-and-forget and failure-tolerant: analytics must never
 * break the page, so all storage and network errors are swallowed.
 */

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

let disabledCache: boolean | undefined;
let cachedVisitorId: string | null = null;
let firstPageviewSent = false;
let lastPageviewPath: string | null = null;

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

/**
 * Track an engagement event. `label` names what was interacted with (a bird
 * species, a location, a button); `props` carries small structured extras.
 * Label text is truncated to 200 chars server-side; keep it short here.
 */
export function trackEvent(name: TrackableEvent, label?: string, props?: TrackProps): void {
  if (typeof window === 'undefined') return;

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
  if (typeof window === 'undefined') return;
  if (pathname === lastPageviewPath) return;
  lastPageviewPath = pathname;

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
