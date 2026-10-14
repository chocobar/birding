'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { trackEvent, trackPageview } from '@/lib/analytics/track';

/**
 * The analytics mount point, rendered once from the root layout. Renders
 * nothing; it (a) sends pageviews on load and on client-side navigation and
 * (b) auto-captures clicks on elements marked with a `data-analytics`
 * attribute plus outbound link navigation, so individual components can opt
 * into click tracking with a single attribute.
 *
 * The dashboard itself (anything under /analytics) is excluded — the owner's
 * own visits shouldn't pollute the numbers.
 */

const UNTRACKED_PREFIX = '/analytics';

export default function Analytics() {
  const pathname = usePathname();
  const lastTrackedPath = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || pathname.startsWith(UNTRACKED_PREFIX)) return;
    if (lastTrackedPath.current === pathname) return;
    lastTrackedPath.current = pathname;
    trackPageview(pathname);
  }, [pathname]);

  useEffect(() => {
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
  }, []);

  return null;
}
