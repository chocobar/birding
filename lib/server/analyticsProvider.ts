/**
 * Which analytics sink is active, resolved from environment variables.
 *
 * The site's own first-party store (SQLite + /analytics dashboard) is the
 * default. Setting any of the SaaS credentials below switches the tracker to
 * forward its events to that provider instead — same engagement
 * instrumentation, same event names, different destination. The credentials
 * are read where the root layout renders (build time for the statically
 * prerendered pages), matching how the existing GOOGLE_SITE_VERIFICATION
 * variable behaves.
 *
 * Env vars:
 * - ANALYTICS_PROVIDER   optional explicit choice: built-in | umami |
 *                        plausible | posthog | ga4
 * - UMAMI_WEBSITE_ID     Umami (cloud or self-hosted). UMAMI_SCRIPT_URL
 *                        overrides the script src for self-hosted instances
 *                        (default: Umami Cloud, eu.umami.is)
 * - PLAUSIBLE_DOMAIN     Plausible (site domain as configured in Plausible)
 * - POSTHOG_API_KEY      PostHog project API key; POSTHOG_API_HOST defaults
 *                        to the EU cloud (https://eu.i.posthog.com)
 * - GA4_MEASUREMENT_ID   Google Analytics 4 measurement id (G-XXXXXXXXXX)
 *
 * ANALYTICS_DISABLED=1 turns all analytics off regardless.
 */

export type AnalyticsProviderId = 'built-in' | 'umami' | 'plausible' | 'posthog' | 'ga4';

export interface AnalyticsProviderConfig {
  provider: AnalyticsProviderId;
  /** Umami: website id from the Umami dashboard */
  websiteId?: string;
  /** Umami: script src (self-hosted instances); defaults to Umami Cloud */
  scriptUrl?: string;
  /** Plausible: the site domain configured in Plausible */
  domain?: string;
  /** PostHog: project API key */
  apiKey?: string;
  /** PostHog: ingest host; defaults to EU cloud */
  apiHost?: string;
  /** GA4: measurement id (G-…) */
  measurementId?: string;
}

const UMAPI_DEFAULT_SCRIPT = 'https://cloud.umami.is/script.js';
const POSTHOG_DEFAULT_HOST = 'https://eu.i.posthog.com';

/** CDN host PostHog serves posthog-js from (derived from the ingest host) */
export function posthogScriptUrl(apiHost: string): string {
  const base = apiHost.replace(/\/+$/, '');
  const assetBase = base.includes('.i.posthog.com')
    ? base.replace('.i.posthog.com', '-assets.i.posthog.com')
    : base;
  return `${assetBase}/static/array.js`;
}

/**
 * Resolve the active provider from the environment. Returns null when
 * analytics is disabled entirely.
 */
export function resolveAnalyticsProvider(): AnalyticsProviderConfig | null {
  if (process.env.ANALYTICS_DISABLED === '1') return null;

  const explicit = process.env.ANALYTICS_PROVIDER?.trim().toLowerCase();
  if (explicit) {
    switch (explicit) {
      case 'built-in':
        return { provider: 'built-in' };
      case 'umami': {
        const websiteId = process.env.UMAMI_WEBSITE_ID?.trim();
        if (!websiteId) {
          console.warn('Analytics: ANALYTICS_PROVIDER=umami but UMAMI_WEBSITE_ID is not set; using built-in analytics.');
          return { provider: 'built-in' };
        }
        return {
          provider: 'umami',
          websiteId,
          scriptUrl: process.env.UMAMI_SCRIPT_URL?.trim() || UMAPI_DEFAULT_SCRIPT,
        };
      }
      case 'plausible': {
        const domain = process.env.PLAUSIBLE_DOMAIN?.trim();
        if (!domain) {
          console.warn('Analytics: ANALYTICS_PROVIDER=plausible but PLAUSIBLE_DOMAIN is not set; using built-in analytics.');
          return { provider: 'built-in' };
        }
        return { provider: 'plausible', domain };
      }
      case 'posthog': {
        const apiKey = process.env.POSTHOG_API_KEY?.trim();
        if (!apiKey) {
          console.warn('Analytics: ANALYTICS_PROVIDER=posthog but POSTHOG_API_KEY is not set; using built-in analytics.');
          return { provider: 'built-in' };
        }
        return {
          provider: 'posthog',
          apiKey,
          apiHost: process.env.POSTHOG_API_HOST?.trim() || POSTHOG_DEFAULT_HOST,
        };
      }
      case 'ga4': {
        const measurementId = process.env.GA4_MEASUREMENT_ID?.trim();
        if (!measurementId) {
          console.warn('Analytics: ANALYTICS_PROVIDER=ga4 but GA4_MEASUREMENT_ID is not set; using built-in analytics.');
          return { provider: 'built-in' };
        }
        return { provider: 'ga4', measurementId };
      }
      default:
        console.warn(`Analytics: unknown ANALYTICS_PROVIDER "${explicit}"; using built-in analytics.`);
        return { provider: 'built-in' };
    }
  }

  // Auto-detect from whichever credential is present
  if (process.env.UMAMI_WEBSITE_ID?.trim()) {
    return {
      provider: 'umami',
      websiteId: process.env.UMAMI_WEBSITE_ID.trim(),
      scriptUrl: process.env.UMAMI_SCRIPT_URL?.trim() || UMAPI_DEFAULT_SCRIPT,
    };
  }
  if (process.env.PLAUSIBLE_DOMAIN?.trim()) {
    return { provider: 'plausible', domain: process.env.PLAUSIBLE_DOMAIN.trim() };
  }
  if (process.env.POSTHOG_API_KEY?.trim()) {
    return {
      provider: 'posthog',
      apiKey: process.env.POSTHOG_API_KEY.trim(),
      apiHost: process.env.POSTHOG_API_HOST?.trim() || POSTHOG_DEFAULT_HOST,
    };
  }
  if (process.env.GA4_MEASUREMENT_ID?.trim()) {
    return { provider: 'ga4', measurementId: process.env.GA4_MEASUREMENT_ID.trim() };
  }

  return { provider: 'built-in' };
}
