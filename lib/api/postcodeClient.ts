import { PostcodeResult } from '@/lib/types';

const POSTCODES_API_BASE = 'https://api.postcodes.io';

export interface PostcodeApiResponse {
  status: number;
  result: {
    postcode: string;
    latitude: number;
    longitude: number;
    country: string;
    region: string;
    admin_district?: string;
    parish?: string;
    eastings: number;
    northings: number;
  } | null;
}

/**
 * Fetch geographic data for a UK postcode
 */
export async function geocodePostcode(
  postcode: string
): Promise<PostcodeResult> {
  const cleanPostcode = postcode.replace(/\s/g, '').toUpperCase();
  
  try {
    const response = await fetch(
      `${POSTCODES_API_BASE}/postcodes/${encodeURIComponent(cleanPostcode)}`
    );

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Postcode not found');
      }
      throw new Error(`API error: ${response.status}`);
    }

    const data: PostcodeApiResponse = await response.json();

    if (!data.result) {
      throw new Error('No data returned for postcode');
    }

    return {
      postcode: data.result.postcode,
      latitude: data.result.latitude,
      longitude: data.result.longitude,
      country: data.result.country,
      region: data.result.region,
      adminDistrict: data.result.admin_district,
      parish: data.result.parish,
      eastings: data.result.eastings,
      northings: data.result.northings,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to geocode postcode');
  }
}

/**
 * Validate a postcode exists (lightweight check)
 */
export async function validatePostcodeExists(
  postcode: string
): Promise<boolean> {
  const cleanPostcode = postcode.replace(/\s/g, '').toUpperCase();
  
  try {
    const response = await fetch(
      `${POSTCODES_API_BASE}/postcodes/${encodeURIComponent(cleanPostcode)}/validate`
    );

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    return data.result === true;
  } catch (error) {
    return false;
  }
}

/**
 * Get nearest postcodes to a coordinate (for reference)
 */
export async function getNearestPostcodes(
  latitude: number,
  longitude: number,
  limit: number = 10
): Promise<string[]> {
  try {
    const response = await fetch(
      `${POSTCODES_API_BASE}/postcodes?lon=${longitude}&lat=${latitude}&limit=${limit}`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch nearest postcodes');
    }

    const data = await response.json();
    
    if (!data.result || !Array.isArray(data.result)) {
      return [];
    }

    return data.result.map((item: any) => item.postcode);
  } catch (error) {
    console.error('Error fetching nearest postcodes:', error);
    return [];
  }
}