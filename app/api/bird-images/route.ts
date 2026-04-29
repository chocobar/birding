import { NextRequest } from 'next/server';
import { lookupBirdImage } from '@/lib/api/wikiImageLookup';

const MAX_BIRDS_PER_REQUEST = 20;

/**
 * POST /api/bird-images
 *
 * Batch endpoint for looking up bird images from Wikipedia.
 *
 * Request body:
 *   { birds: [{ name: string, scientificName?: string }, ...] }
 *
 * Response:
 *   { images: { [name: string]: { imageUrl: string | null, attribution: string | null } } }
 *
 * Maximum of 20 birds per request to prevent abuse.
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

  // Validate each entry has at least a name string
  for (const bird of birds) {
    if (!bird || typeof bird !== 'object' || typeof (bird as { name: unknown }).name !== 'string') {
      return Response.json(
        { error: 'Each bird must have a "name" string property' },
        { status: 400 },
      );
    }
  }

  const typedBirds = birds as { name: string; scientificName?: string }[];

  const results = await Promise.allSettled(
    typedBirds.map((bird) =>
      lookupBirdImage(bird.name, bird.scientificName),
    ),
  );

  const images: Record<string, { imageUrl: string | null; attribution: string | null }> = {};

  for (let i = 0; i < typedBirds.length; i++) {
    const settled = results[i];
    if (settled.status === 'fulfilled') {
      images[typedBirds[i].name] = settled.value;
    } else {
      images[typedBirds[i].name] = { imageUrl: null, attribution: null };
    }
  }

  return Response.json({ images });
}