export interface PostcodeResult {
  postcode: string;
  latitude: number;
  longitude: number;
  country: string;
  region: string;
  adminDistrict?: string;
  parish?: string;
  eastings: number;
  northings: number;
}