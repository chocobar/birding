'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import type { AnalyticsProviderId } from '@/lib/server/analyticsProvider';
import { configureAnalytics, trackEvent, trackPageview } from '@/lib/analytics/track';

/**
 * The analytics mount point, rendered once from the root layout when a SaaS
 * analytics provider is configured. Renders nothing; it (a) sends pageviews
 * on load and on client-side navigation and (b) auto-captures clicks on
 * elements marked with a `data-analytics` attribute plus outbound link
 * navigation, so individual components can opt into click tracking with a
 * single attribute. Everything is forwarded to the configured provider.
 *
 * PostHog keeps its own autocapture for raw clicks, so the generic
 * click/outbound listener is skipped in that mode — only the named
 * engagement events (searches, map opens, audio, …) are explicitly sent.
 */

export interface AnalyticsProps {
  provider: AnalyticsProviderId;
  measurementId?: string;
  posthogApiKey?: string;
  posthogApiHost?: string;
}

export default function Analytics({
  provider,
  measurementId,
  posthogApiKey,
  posthogApiHost,
}: AnalyticsProps) {
  const pathname = usePathname();
  const lastTrackedPath = useRef<string | null>(null);

  useEffect(() => {
    configureAnalytics({ provider, measurementId, posthogApiKey, posthogApiHost });
  }, [provider, measurementId, posthogApiKey, posthogApiHost]);

  useEffect(() => {
    if (!pathname) return;
    if (lastTrackedPath.current === pathname) return;
    lastTrackedPath.current = pathname;
    trackPageview(pathname);
  }, [pathname]);

  useEffect(() => {
    if (provider === 'posthog') return; // autocapture handles raw clicks

    const handleClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;

      // Named interactions opt in via data-analytics="label"
      const marked = target.closest('[data-analytics]');
      if (marked) {
        const label = marked.getAttribute('data-analytics');
        if (label) trackEvent('click', label);
        return;
      }

      // Un-marked outbound links are still worth counting as engagement
      const anchor = target.closest('a[href]');
      if (anchor) {
        const href = anchor.getAttribute('href') ?? '';
        if (/^https?:\/\//i.test(href)) {
          try {
            const destination = new URL(href, window.location.href);
            if (destination.host !== window.location.host) {
              trackEvent('outbound', `${destination.host}${destination.pathname}`.slice(0, 200));
            }
          } catch {
            // malformed href — nothing to track
          }
        }
      }
    };

    document.addEventListener('click', handleClick, { capture: true, passive: true });
    return () => document.removeEventListener('click', handleClick, { capture: true });
  }, [provider]);

  return null;
}
