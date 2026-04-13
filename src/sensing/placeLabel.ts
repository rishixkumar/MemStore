import * as Location from 'expo-location';

export type ResolvedPlace = {
  placeName: string;
  placeType: string;
};

export function getCoordinateFallbackLabel(latitude: number, longitude: number) {
  return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
}

export function formatGeocodedPlace(
  place: Location.LocationGeocodedAddress | null | undefined,
  latitude: number,
  longitude: number
): ResolvedPlace {
  if (!place) {
    return {
      placeName: getCoordinateFallbackLabel(latitude, longitude),
      placeType: 'unknown',
    };
  }

  return {
    placeName: [place.name, place.street, place.city].filter(Boolean).join(', '),
    placeType: place.district || place.subregion || 'unknown',
  };
}

export async function resolvePlaceFromCoordinates(
  latitude: number,
  longitude: number
): Promise<ResolvedPlace> {
  try {
    const geocoded = await Location.reverseGeocodeAsync({ latitude, longitude });
    return formatGeocodedPlace(geocoded[0], latitude, longitude);
  } catch {
    return {
      placeName: getCoordinateFallbackLabel(latitude, longitude),
      placeType: 'unknown',
    };
  }
}
