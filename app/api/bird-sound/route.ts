import { NextRequest } from 'next/server';
import { lookupBirdSound } from '@/lib/api/xenoCantoLookup';

/**
 * GET /api/bird-sound?scientificName=Erithacus rubecula
 *
 * Resolves a species' scientific name to a playable CC-licensed recording
 * from Xeno-canto. Results are cached server-side (species → recording).
 * Best effort: when no recording is found (or Xeno-canto is unreachable)
 * every field is null and the client hides the play button.
 */
export async function GET(request: NextRequest) {
  const scientificName = request.nextUrl.searchParams.get('scientificName');

  if (!scientificName?.trim()) {
    return Response.json(
      {
        ...emptyResult(),
        error: 'Missing required parameter: scientificName',
      },
      { status: 400 }
    );
  }

  const result = await lookupBirdSound(scientificName);
  return Response.json(result);
}

function emptyResult() {
  return {
    recordingId: null,
    audioUrl: null,
    recordist: null,
    license: null,
    licenseUrl: null,
    pageUrl: null,
  };
}
