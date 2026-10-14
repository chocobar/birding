import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { Feather } from 'lucide-react';
import {
  ANALYTICS_COOKIE_NAME,
  DASHBOARD_RANGES,
  dashboardCookieToken,
  DashboardData,
  DashboardRangeDays,
  getDashboardData,
  isDashboardRange,
} from '@/lib/server/analytics';
import { resolveAnalyticsProvider } from '@/lib/server/analyticsProvider';

/**
 * Private analytics dashboard for birding.live.
 *
 * Server-rendered straight from SQLite (no client-side data fetching). Access
 * is gated on ANALYTICS_DASHBOARD_KEY: when the env var is unset the route
 * 404s; when set, a key entered once unlocks an httpOnly cookie for 30 days.
 */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Analytics',
  robots: { index: false, follow: false },
};

interface AnalyticsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AnalyticsPage({ searchParams }: AnalyticsPageProps) {
  const configuredKey = process.env.ANALYTICS_DASHBOARD_KEY;
  if (!configuredKey) notFound();

  const params = await searchParams;
  const authError = params.error === '1';

  const cookieStore = await cookies();
  const authorized =
    cookieStore.get(ANALYTICS_COOKIE_NAME)?.value === dashboardCookieToken(configuredKey);
  if (!authorized) {
    return <AuthGate error={authError} />;
  }

  const rangeParam = Array.isArray(params.range) ? params.range[0] : params.range;
  const parsedRange = Number(rangeParam);
  const days: DashboardRangeDays = isDashboardRange(parsedRange) ? parsedRange : 30;
  const data = getDashboardData(days);
  const provider = resolveAnalyticsProvider();

  return (
    <div className="min-h-screen bg-[var(--warm-cream)] text-[var(--text-primary)]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        {/* Header */}
        <header className="flex items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[var(--brand-green)]/10 rounded-xl flex items-center justify-center">
              <Feather className="w-5 h-5 text-[var(--brand-green)]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Site analytics</h1>
              <p className="text-sm text-[var(--text-secondary)]">birding.live — first-party, cookieless</p>
            </div>
          </div>
          <nav aria-label="Time range" className="flex gap-1.5">
            {DASHBOARD_RANGES.map((range) => (
              <Link
                key={range}
                href={`/analytics?range=${range}`}
                aria-current={range === days ? 'page' : undefined}
                className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${
                  range === days
                    ? 'bg-[var(--brand-green)] text-white'
                    : 'bg-[var(--warm-sand)] text-[var(--text-secondary)] border border-[var(--border-light)] hover:text-[var(--brand-green)]'
                }`}
              >
                {range}d
              </Link>
            ))}
          </nav>
        </header>

        {provider && provider.provider !== 'built-in' && (
          <p className="mb-6 p-4 rounded-xl bg-sky-50 border border-sky-200 text-sky-900 text-sm">
            Tracking currently goes to the {provider.provider === 'ga4' ? 'Google Analytics 4' : provider.provider}{' '}
            integration — that provider&apos;s own dashboard is authoritative. This page only shows
            data collected before the switch (or since, if the built-in collector is still active).
          </p>
        )}

        {!data.dbEnabled && (
          <p className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
            Analytics storage is unavailable (no writable data directory) — events are being
            dropped. Set <code>HELIX_WEB_SERVICE_DATA_DIR</code> to a writable path.
          </p>
        )}

        {data.summary.visitors === 0 ? (
          <section className="bg-[var(--warm-sand)] border border-[var(--border-light)] rounded-2xl p-12 text-center">
            <p className="text-lg font-semibold mb-1">No traffic recorded yet</p>
            <p className="text-sm text-[var(--text-secondary)]">
              Visits will appear here as people use the site. Tracking is live once this
              dashboard&apos;s build is deployed.
            </p>
          </section>
        ) : (
          <div className="space-y-10">
            {/* Summary cards */}
            <section aria-label="Summary" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <StatCard label="Unique visitors" value={data.summary.visitors} />
              <StatCard label="Pageviews" value={data.summary.pageviews} />
              <StatCard label="Visits (sessions)" value={data.summary.sessions} />
              <StatCard label="Engagement events" value={data.summary.events} />
              <StatCard label="Location searches" value={data.summary.searches} />
            </section>

            {/* Daily chart */}
            <section aria-label="Daily traffic">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-secondary)] mb-3">
                Visitors &amp; pageviews per day
              </h2>
              <DailyChart daily={data.daily} />
            </section>

            {/* Audience */}
            <section aria-label="Audience" className="grid gap-8 md:grid-cols-2">
              <StatTable
                title="Devices"
                unit="visitors"
                rows={data.devices.map((d) => ({ key: d.key, value: d.visitors }))}
              />
              <StatTable
                title="Browsers"
                unit="visitors"
                rows={data.browsers.map((b) => ({ key: b.key, value: b.visitors }))}
              />
              <StatTable
                title="Countries / regions"
                unit="visitors"
                rows={data.countries.map((c) => ({ key: c.key, value: c.visitors }))}
              />
              <StatTable
                title="Traffic sources"
                unit="views"
                rows={data.referrers.map((r) => ({ key: r.key, value: r.views }))}
              />
            </section>

            {/* Content */}
            <section aria-label="Content and engagement" className="grid gap-8 md:grid-cols-2">
              <StatTable
                title="Top pages"
                unit="views"
                rows={data.pages.map((p) => ({ key: p.key, value: p.views }))}
              />
              <StatTable
                title="Engagement"
                unit="count"
                rows={data.events.map((e) => ({
                  key: e.label ? `${eventName(e.name)} — ${e.label}` : eventName(e.name),
                  value: e.count,
                }))}
              />
              {data.searches.length > 0 && (
                <StatTable
                  title="Top location searches"
                  unit="searches"
                  rows={data.searches.map((s) => ({ key: s.label, value: s.count }))}
                />
              )}
            </section>

            <footer className="text-xs text-[var(--text-secondary)] pt-4 border-t border-[var(--border-light)]">
              <p>
                Cookieless first-party analytics. Visitor ids are random tokens kept in each
                visitor&apos;s own browser storage; IP addresses are never stored. Events older
                than 180 days are pruned automatically.
              </p>
            </footer>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Auth gate -----------------------------------------------------------------

function AuthGate({ error }: { error: boolean }) {
  return (
    <div className="min-h-screen bg-[var(--warm-cream)] text-[var(--text-primary)] flex items-center justify-center px-4">
      <form
        action="/api/analytics/auth"
        method="post"
        className="bg-[var(--warm-sand)] border border-[var(--border-light)] rounded-2xl p-8 max-w-sm w-full"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-[var(--brand-green)]/10 rounded-xl flex items-center justify-center">
            <Feather className="w-5 h-5 text-[var(--brand-green)]" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Site analytics</h1>
        </div>
        <p className="text-sm text-[var(--text-secondary)] mb-5">
          This dashboard is private. Enter the analytics key
          (the <code>ANALYTICS_DASHBOARD_KEY</code> value) to unlock it for 30 days.
        </p>
        {error && (
          <p role="alert" className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            That key didn&apos;t match. Try again.
          </p>
        )}
        <label htmlFor="analytics-key" className="block text-sm font-medium mb-1.5">
          Analytics key
        </label>
        <input
          id="analytics-key"
          name="key"
          type="password"
          required
          autoComplete="off"
          className="w-full px-4 py-2.5 text-sm border border-[var(--border-light)] rounded-full bg-[var(--warm-cream)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-green)]"
        />
        <button
          type="submit"
          className="mt-4 w-full px-4 py-2.5 text-sm font-semibold text-white bg-[var(--brand-green)] rounded-full hover:bg-[var(--brand-green-dark)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--brand-green)] focus:ring-offset-2"
        >
          Unlock dashboard
        </button>
      </form>
    </div>
  );
}

// --- Small building blocks -------------------------------------------------------

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-[var(--warm-sand)] border border-[var(--border-light)] rounded-xl p-4">
      <p className="text-2xl font-bold tabular-nums">{value.toLocaleString('en-GB')}</p>
      <p className="text-xs text-[var(--text-secondary)] mt-0.5">{label}</p>
    </div>
  );
}

function StatTable({
  title,
  unit,
  rows,
}: {
  title: string;
  unit: string;
  rows: { key: string; value: number }[];
}) {
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  return (
    <div>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-secondary)] mb-3">
        {title}
      </h2>
      {rows.length === 0 ? (
        <p className="text-sm text-[var(--text-secondary)]">No data in this period.</p>
      ) : (
        <ul className="bg-[var(--warm-sand)] border border-[var(--border-light)] rounded-xl divide-y divide-[var(--border-light)] overflow-hidden">
          {rows.map((row) => (
            <li key={row.key} className="px-4 py-2.5 flex items-center gap-3 text-sm">
              <span className="flex-1 min-w-0 truncate" title={row.key}>
                {row.key}
              </span>
              <span className="text-xs text-[var(--text-secondary)] tabular-nums w-10 text-right">
                {total > 0 ? `${Math.round((row.value / total) * 100)}%` : ''}
              </span>
              <span className="tabular-nums font-medium w-14 text-right">
                {row.value.toLocaleString('en-GB')}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-1.5 text-[11px] text-[var(--text-secondary)]">{unit}, top {rows.length}</p>
    </div>
  );
}

/** Human-readable event names for the engagement table */
function eventName(name: string): string {
  const labels: Record<string, string> = {
    click: 'Click',
    outbound: 'Outbound link',
    search: 'Location search',
    geolocate: 'Geolocate',
    map_open: 'Map opened',
    audio_play: 'Bird audio played',
    time_range: 'Time range changed',
  };
  return labels[name] ?? name;
}

function DailyChart({ daily }: { daily: DashboardData['daily'] }) {
  const width = 720;
  const height = 210;
  const pad = { top: 14, right: 10, bottom: 26, left: 10 };
  const innerWidth = width - pad.left - pad.right;
  const innerHeight = height - pad.top - pad.bottom;

  const maxPageviews = Math.max(1, ...daily.map((d) => d.pageviews));
  const maxVisitors = Math.max(1, ...daily.map((d) => d.visitors));
  const step = daily.length > 0 ? innerWidth / daily.length : innerWidth;
  const barWidth = Math.max(2, Math.min(26, step * 0.72));

  const visitorPoints = daily
    .map((d, i) => {
      const x = pad.left + i * step + step / 2;
      const y = pad.top + innerHeight - (d.visitors / maxVisitors) * innerHeight;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const labelIndexes =
    daily.length <= 8
      ? daily.map((_, i) => i)
      : [0, Math.floor(daily.length / 2), daily.length - 1];

  return (
    <figure className="bg-[var(--warm-sand)] border border-[var(--border-light)] rounded-xl p-4">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto"
        role="img"
        aria-label={`Daily visitors and pageviews for the last ${daily.length} days`}
      >
        {daily.map((d, i) => {
          const barHeight = Math.max(d.pageviews > 0 ? 2 : 0, (d.pageviews / maxPageviews) * innerHeight);
          const x = pad.left + i * step + (step - barWidth) / 2;
          const y = pad.top + innerHeight - barHeight;
          return (
            <rect key={d.day} x={x} y={y} width={barWidth} height={barHeight} rx={Math.min(3, barWidth / 2)} fill="var(--brand-green)" opacity={0.85}>
              <title>{`${d.day} — ${d.pageviews.toLocaleString('en-GB')} pageviews, ${d.visitors.toLocaleString('en-GB')} visitors`}</title>
            </rect>
          );
        })}
        {daily.length > 1 && (
          <polyline
            points={visitorPoints}
            fill="none"
            stroke="var(--accent-teal)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
        <line
          x1={pad.left}
          y1={pad.top + innerHeight}
          x2={pad.left + innerWidth}
          y2={pad.top + innerHeight}
          stroke="var(--border-light)"
          strokeWidth={1}
        />
        {labelIndexes.map((i) => {
          const x = pad.left + i * step + step / 2;
          return (
            <text
              key={daily[i]?.day ?? i}
              x={x}
              y={height - 8}
              textAnchor={i === 0 ? 'start' : i === daily.length - 1 ? 'end' : 'middle'}
              fontSize={11}
              fill="var(--text-secondary)"
            >
              {daily[i]?.day.slice(5)}
            </text>
          );
        })}
      </svg>
      <figcaption className="flex gap-4 mt-2 text-xs text-[var(--text-secondary)]">
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block w-3 h-3 rounded-sm" style={{ background: 'var(--brand-green)' }} />
          Pageviews
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block w-4 h-0.5 rounded" style={{ background: 'var(--accent-teal)' }} />
          Visitors
        </span>
        <span className="ml-auto">
          Peak: {maxPageviews.toLocaleString('en-GB')} views / {maxVisitors.toLocaleString('en-GB')} visitors
        </span>
      </figcaption>
    </figure>
  );
}
