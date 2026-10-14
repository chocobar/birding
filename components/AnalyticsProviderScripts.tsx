import type { AnalyticsProviderConfig } from '@/lib/server/analyticsProvider';
import { posthogScriptUrl } from '@/lib/server/analyticsProvider';

/**
 * Server-rendered script tags for the configured external analytics provider.
 * Renders nothing for the built-in provider (which needs no third-party
 * script). The credential values are public by design — the same values are
 * visible in the page source of any site using these providers.
 */
export default function AnalyticsProviderScripts({ config }: { config: AnalyticsProviderConfig }) {
  switch (config.provider) {
    case 'umami':
      return (
        // data-auto-track="false": pageviews are sent explicitly on load and
        // on route change, so Umami's own auto-tracking would double-count
        <script
          async
          src={config.scriptUrl}
          data-website-id={config.websiteId}
          data-auto-track="false"
        />
      );
    case 'plausible':
      return (
        <>
          {/* Official pre-load shim: manual-mode calls made before the script
              loads are queued in .q and drained by the script on arrival */}
          <script
            dangerouslySetInnerHTML={{
              __html:
                'window.plausible=window.plausible||function(){(window.plausible.q=window.plausible.q||[]).push(arguments)}',
            }}
          />
          <script
            async
            defer
            src="https://plausible.io/js/script.manual.js"
            data-domain={config.domain}
          />
        </>
      );
    case 'posthog':
      // posthog-js appears on window once this loads; the tracker queues all
      // events until then and runs init() with capture_pageview disabled
      return <script async src={posthogScriptUrl(config.apiHost ?? '')} />;
    case 'ga4':
      // The gtag.js dataLayer shim is created by the tracker itself, so
      // setup calls can be queued before this script arrives
      return (
        <script
          async
          src={`https://www.googletagmanager.com/gtag/js?id=${config.measurementId ?? ''}`}
        />
      );
    default:
      return null;
  }
}
