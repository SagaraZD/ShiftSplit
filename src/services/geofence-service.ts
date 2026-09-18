import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { EXIT_CONFIRMATION_DELAY_MS, getOfficeGeofence, OFFICE_GEOFENCES } from '@/constants/locations';

import { cancelScheduledNotification, presentClockInPrompt, scheduleClockOutPrompt } from './notification-service';

export const GEOFENCE_TASK_NAME = 'shiftsplit-geofence-task';

const PENDING_EXIT_KEY_PREFIX = 'shiftsplit:pending-exit-notification:';

// Region monitoring (geofencing) is handled entirely by the OS — there is no
// JS polling loop here, so there's nothing to throttle with
// `pausesLocationUpdatesAutomatically` (that option only applies to
// `startLocationUpdatesAsync`'s continuous GPS updates, which this app
// deliberately avoids). Enter/Exit events wake this task on demand, and the
// exit confirmation below relies on a scheduled notification timer rather
// than an active background loop.
TaskManager.defineTask(GEOFENCE_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.warn('[geofence-service] task error', error.message);
    return;
  }
  const { eventType, region } = (data ?? {}) as {
    eventType?: Location.GeofencingEventType;
    region?: Location.LocationRegion;
  };
  if (!region?.identifier) return;

  const office = getOfficeGeofence(region.identifier);
  if (!office) return;

  const pendingKey = `${PENDING_EXIT_KEY_PREFIX}${office.id}`;

  if (eventType === Location.GeofencingEventType.Enter) {
    // Re-entered before the exit grace period elapsed — the pending "did you
    // leave?" prompt is now stale, so cancel it instead of confusing the user.
    const pendingNotificationId = await AsyncStorage.getItem(pendingKey);
    if (pendingNotificationId) {
      await cancelScheduledNotification(pendingNotificationId);
      await AsyncStorage.removeItem(pendingKey);
    }
    await presentClockInPrompt(office.id, office.name);
    return;
  }

  if (eventType === Location.GeofencingEventType.Exit) {
    const notificationId = await scheduleClockOutPrompt(office.id, office.name, EXIT_CONFIRMATION_DELAY_MS);
    await AsyncStorage.setItem(pendingKey, notificationId);
  }
});

export async function requestGeofencingPermissions(): Promise<boolean> {
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== 'granted') return false;

  const background = await Location.requestBackgroundPermissionsAsync();
  return background.status === 'granted';
}

export async function isGeofencingActive(): Promise<boolean> {
  return TaskManager.isTaskRegisteredAsync(GEOFENCE_TASK_NAME);
}

export async function registerOfficeGeofences(): Promise<void> {
  const regions: Location.LocationRegion[] = OFFICE_GEOFENCES.map((office) => ({
    identifier: office.id,
    latitude: office.latitude,
    longitude: office.longitude,
    radius: office.radius,
    notifyOnEnter: true,
    notifyOnExit: true,
  }));

  await Location.startGeofencingAsync(GEOFENCE_TASK_NAME, regions);
}

export async function unregisterOfficeGeofences(): Promise<void> {
  if (await isGeofencingActive()) {
    await Location.stopGeofencingAsync(GEOFENCE_TASK_NAME);
  }
}

/** Requests permissions and starts geofencing; safe to call every app start. */
export async function setupGeofencing(): Promise<{ granted: boolean }> {
  try {
    const granted = await requestGeofencingPermissions();
    if (!granted) return { granted: false };

    if (!(await isGeofencingActive())) {
      await registerOfficeGeofences();
    }
    return { granted: true };
  } catch (err) {
    // Permission requests or region monitoring can fail for reasons outside
    // our control (e.g. the iOS Simulator, which lacks real GPS hardware, or
    // a misconfigured Info.plist) — clock-in/out prompts just won't fire in
    // that case, which shouldn't surface as an app-level error.
    console.warn('[geofence-service] geofencing unavailable', err instanceof Error ? err.message : err);
    return { granted: false };
  }
}
