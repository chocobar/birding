import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import {
  ANALYTICS_COOKIE_NAME,
  dashboardCookieToken,
  dashboardKeyMatches,
} from '@/lib/server/analytics';

/**
 * POST /api/analytics/auth — unlock the private /analytics dashboard.
 * Takes the dashboard key from a plain HTML form, compares it in constant
 * time against ANALYTICS_DASHBOARD_KEY, and on success sets an httpOnly
 * session cookie (the cookie holds a hash of the key, never the key itself).
 * The dashboard is disabled entirely when the env var is unset.
 */

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export async function POST(request: NextRequest) {
  if (!process.env.ANALYTICS_DASHBOARD_KEY) {
    return new Response('Not found', { status: 404 });
  }

  let presented = '';
  try {
    const form = await request.formData();
    presented = String(form.get('key') ?? '');
  } catch {
    presented = '';
  }

  if (!presented || !dashboardKeyMatches(presented)) {
    return Response.redirect(new URL('/analytics?error=1', request.nextUrl.origin), 303);
  }

  const cookieStore = await cookies();
  cookieStore.set(ANALYTICS_COOKIE_NAME, dashboardCookieToken(process.env.ANALYTICS_DASHBOARD_KEY), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/analytics',
    maxAge: COOKIE_MAX_AGE,
  });

  return Response.redirect(new URL('/analytics', request.nextUrl.origin), 303);
}
