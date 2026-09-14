import { NextRequest } from 'next/server';
import { lookupConservationStatuses } from '@/lib/api/conservationStatusLookup';

const MAX_BIRDS_PER_REQUEST = 20;

/**
 * POST /api/bird-status
 *
 * Batch endpoint for looking up a bird's IUCN conservation ("extinction")
 * status from Wikidata (property P141). Powers the rare-find indicator.
 *
 * Request body:
 *   { birds: [{ name: string, scientificName?: string }, ...] }
 *
 * Response:
 *   { statuses: { [name: string]: { conservationStatus: 'LC'|'NT'|'VU'|'EN'|'CR'|'EW'|'EX'|null } } }
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

  const resolved = await lookupConservationStatuses(typedBirds);

  const statuses: Record<string, { conservationStatus: string | null }> = {};
  for (const bird of typedBirds) {
    statuses[bird.name] = { conservationStatus: resolved[bird.name] ?? null };
  }

  return Response.json({ statuses });
}
