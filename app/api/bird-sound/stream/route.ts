import { NextRequest } from 'next/server';

const VALID_ID = /^\d{1,9}$/;
const USER_AGENT = 'BirdingDiscovery/1.0 (hobby project)';
const STREAM_TIMEOUT_MS = 30_000;
/** Headers from the upstream file response worth passing through. */
const PASSTHROUGH_HEADERS = [
  'content-type',
  'content-length',
  'content-range',
  'accept-ranges',
] as const;

/**
 * GET /api/bird-sound/stream?id=1152299
 *
 * Streams a Xeno-canto recording through the app. Client audio elements
 * play from this same-origin URL, which sidesteps CORS/hotlinking concerns
 * with the upstream file host. Range requests are forwarded so seeking
 * works, and successful responses are cacheable (a recording's bytes never
 * change for a given catalogue number).
 */
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id') ?? '';

  // Only bare catalogue numbers are accepted — the id is interpolated into
  // the upstream URL, so anything else is rejected outright.
  if (!VALID_ID.test(id)) {
    return new Response('Invalid recording id', { status: 400 });
  }

  const range = request.headers.get('range');

  try {
    const upstream = await fetch(`https://xeno-canto.org/${id}/download`, {
      headers: {
        'User-Agent': USER_AGENT,
        ...(range ? { Range: range } : {}),
      },
      redirect: 'follow',
      cache: 'no-store',
      signal: AbortSignal.timeout(STREAM_TIMEOUT_MS),
    });

    if (!upstream.ok || !upstream.body) {
      return new Response('Upstream audio unavailable', {
        status: upstream.status === 404 ? 404 : 502,
      });
    }

    const headers = new Headers();
    for (const header of PASSTHROUGH_HEADERS) {
      const value = upstream.headers.get(header);
      if (value) headers.set(header, value);
    }
    headers.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    headers.set('Content-Disposition', 'inline');

    return new Response(upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch (error) {
    console.error(`Xeno-canto audio stream failed for recording ${id}:`, error);
    return new Response('Upstream audio unavailable', { status: 502 });
  }
}
