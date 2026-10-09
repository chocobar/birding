import { NextRequest } from 'next/server';
import { lookupBirdSound, BirdSoundInfo } from '@/lib/api/xenoCantoLookup';

const MAX_BIRDS_PER_REQUEST = 20;
/** Cap concurrent Xeno-canto lookups to stay gentle with the upstream. */
const LOOKUP_CONCURRENCY = 4;

/**
 * POST /api/bird-sounds
 *
 * Batch endpoint for looking up species recordings from Xeno-canto, keyed
 * by scientific name (mirrors /api/bird-images for images).
 *
 * Request body:
 *   { birds: [{ name: string, scientificName?: string }, ...] }
 *
 * Response:
 *   { sounds: { [scientificName: string]: BirdSoundInfo } }
 *
 * Maximum of 20 birds per request to prevent abuse. Duplicate species are
 * looked up once.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  if (
    !body ||
    typeof body !== 'object' ||
    !('birds' in body) ||
    !Array.isArray((body as { birds: unknown }).birds)
  ) {
    return Response.json(
      { error: 'Request body must include a "birds" array' },
      { status: 400 },
    );
  }

  const birds = (body as { birds: unknown[] }).birds;

  if (birds.length > MAX_BIRDS_PER_REQUEST) {
    return Response.json(
      {
        error: `Too many birds requested. Maximum is ${MAX_BIRDS_PER_REQUEST} per request.`,
      },
      { status: 400 },
    );
  }

  for (const bird of birds) {
    if (
      !bird ||
      typeof bird !== 'object' ||
      typeof (bird as { scientificName: unknown }).scientificName !== 'string'
    ) {
      return Response.json(
        { error: 'Each bird must have a "scientificName" string property' },
        { status: 400 },
      );
    }
  }

  // Dedupe by scientific name; several cards can share a species.
  const names = Array.from(
    new Set(
      (birds as { scientificName: string }[])
        .map((bird) => bird.scientificName)
        .filter((name) => name.trim().length > 0)
    )
  );

  const results = await mapWithLimit(names, LOOKUP_CONCURRENCY, (name) =>
    lookupBirdSound(name)
  );

  const sounds: Record<string, BirdSoundInfo> = {};
  for (let i = 0; i < names.length; i++) {
    sounds[names[i]] = results[i];
  }

  return Response.json({ sounds });
}

/**
 * Run an async mapper over items with at most `limit` promises in flight,
 * preserving order.
 */
async function mapWithLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (true) {
        const index = next++;
        if (index >= items.length) return;
        results[index] = await fn(items[index]);
      }
    }
  );

  await Promise.all(workers);
  return results;
}
