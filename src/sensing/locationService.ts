import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { insertMemory } from '../storage/database';
import { Memory } from '../models/Memory';
import {
  LOCATION_DEFERRED_INTERVAL_MS,
  LOCATION_DISTANCE_INTERVAL_METERS,
  LOCATION_NOTIFICATION_COLOR,
} from '../config/app';
import { resolvePlaceFromCoordinates } from './placeLabel';
import { logger } from '../utils/logger';

export const LOCATION_TASK = 'AMBIENT_MEMORY_LOCATION_TASK';

TaskManager.defineTask(LOCATION_TASK, async ({ data, error }: any) => {
  if (error) {
    logger.error('Location', 'Background location task failed.', error);
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
    const { placeName, placeType } = await resolvePlaceFromCoordinates(latitude, longitude);

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

    await insertMemory(memory);
  } catch (err) {
    logger.error('Location', 'Failed to process location update.', err);
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
        distanceInterval: LOCATION_DISTANCE_INTERVAL_METERS,
        deferredUpdatesInterval: LOCATION_DEFERRED_INTERVAL_MS,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: 'Ambient Memory',
          notificationBody: 'Capturing your day quietly in the background.',
          notificationColor: LOCATION_NOTIFICATION_COLOR,
        },
      });
      logger.info('Location', 'Background location tracking started.');
    }
  } else {
    logger.info('Location', 'Expo Go fallback active. Capturing one preview location.');
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
