import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { insertMemory } from '../storage/database';
import { Memory } from '../models/Memory';

export const LOCATION_TASK = 'AMBIENT_MEMORY_LOCATION_TASK';

TaskManager.defineTask(LOCATION_TASK, async ({ data, error }: any) => {
  if (error) {
    console.error('Location task error:', error);
    return;
  }
  if (data) {
    const { locations } = data;
    for (const location of locations) {
      await handleLocationUpdate(location);
    }
  }
});

async function handleLocationUpdate(location: Location.LocationObject) {
  try {
    const { latitude, longitude } = location.coords;

    let placeName = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
    let placeType = 'unknown';

    try {
      const geocoded = await Location.reverseGeocodeAsync({ latitude, longitude });
      const place = geocoded[0];
      if (place) {
        placeName = [place.name, place.street, place.city]
          .filter(Boolean)
          .join(', ');
        placeType = place.district || place.subregion || 'unknown';
      }
    } catch {
      // Geocoding failed - use coordinates as fallback
    }

    const memory: Memory = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: location.timestamp,
      latitude,
      longitude,
      placeName,
      placeType,
      activityType: 'unknown',
      durationMinutes: 0,
      peopleIds: [],
      note: null,
      importanceScore: calculateImportanceScore(location),
      createdAt: Date.now(),
    };

    const inserted = await insertMemory(memory);
    if (inserted) {
      console.log('Memory captured:', placeName);
    }
  } catch (err) {
    console.error('Error handling location update:', err);
  }
}

function calculateImportanceScore(location: Location.LocationObject): number {
  const accuracyScore = location.coords.accuracy
    ? Math.max(0, 1 - location.coords.accuracy / 100)
    : 0.5;
  return Math.round(accuracyScore * 100) / 100;
}

export async function requestPermissionsAndStart() {
  // Step 1: request foreground permission
  const { status: foreground } = await Location.requestForegroundPermissionsAsync();
  if (foreground !== 'granted') {
    throw new Error('Location permission is required for Ambient Memory to work. Please allow location access when prompted.');
  }

  // Step 2: attempt background permission - gracefully skip if unavailable (Expo Go)
  let hasBackground = false;
  try {
    const { status: background } = await Location.requestBackgroundPermissionsAsync();
    hasBackground = background === 'granted';
  } catch {
    hasBackground = false;
  }

  // Step 3: start tracking
  if (hasBackground) {
    // Full background tracking - production mode
    const isRegistered = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false);
    if (!isRegistered) {
      await Location.startLocationUpdatesAsync(LOCATION_TASK, {
        accuracy: Location.Accuracy.Balanced,
        distanceInterval: 200,
        deferredUpdatesInterval: 60000,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: 'Ambient Memory',
          notificationBody: 'Capturing your day quietly in the background.',
          notificationColor: '#534AB7',
        },
      });
    }
  } else {
    // Expo Go fallback - capture current location once as a test memory
    console.log('Background location unavailable (Expo Go). Capturing single location for preview.');
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    await handleLocationUpdate(location);
  }
}

export async function stopLocationTracking() {
  const isRegistered = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false);
  if (isRegistered) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  }
}
