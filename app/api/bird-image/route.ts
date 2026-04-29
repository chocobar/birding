import { NextRequest } from 'next/server';
import { lookupBirdImage } from '@/lib/api/wikiImageLookup';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const name = searchParams.get('name');
  const scientificName = searchParams.get('scientificName');

  if (!name) {
    return Response.json(
      { imageUrl: null, attribution: null, error: 'Missing required parameter: name' },
      { status: 400 }
    );
  }

  const result = await lookupBirdImage(name, scientificName ?? undefined);
  return Response.json(result);
}