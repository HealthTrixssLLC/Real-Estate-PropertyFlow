import { aiConfig } from "./aiConfig";

export interface GeocodeResult {
  lat: number;
  lng: number;
  placeId: string | null;
  formattedAddress: string | null;
}

function getApiKey(): string | null {
  return aiConfig.googleMapsApiKey || process.env.GOOGLE_MAPS_API_KEY || null;
}

export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const key = getApiKey();
  if (!key || !address.trim()) return null;
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${encodeURIComponent(key)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      status: string;
      results?: Array<{
        place_id: string;
        formatted_address: string;
        geometry: { location: { lat: number; lng: number } };
      }>;
    };
    if ((data.status !== "OK" && data.status !== "ROOFTOP") || !data.results?.length) return null;
    const r = data.results[0];
    return {
      lat: r.geometry.location.lat,
      lng: r.geometry.location.lng,
      placeId: r.place_id ?? null,
      formattedAddress: r.formatted_address ?? null,
    };
  } catch {
    return null;
  }
}

export function isGeocodeAvailable(): boolean {
  return !!getApiKey();
}
