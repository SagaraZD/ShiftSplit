import { useEffect } from 'react';
import { Platform } from 'react-native';

import { unregisterOfficeGeofences, setupGeofencing } from '@/services/geofence-service';
import { addNotificationResponseListener, ensureNotificationSetup, NOTIFICATION_ACTION } from '@/services/notification-service';
import { clockIn, clockOut, getActiveWorkLog } from '@/services/work-log-service';

/**
 * Wires up local notification prompts + background geofencing for the signed-in user.
 * Geofencing and notification categories are native-only capabilities, so this is a
 * no-op on web. Set `enabled` to false (the user's notification preference) to tear
 * down geofencing instead of registering it — there's no point tracking location in
 * the background if the resulting prompts are muted anyway.
 */
export function useShiftTracking(userId: string | undefined, enabled: boolean) {
  useEffect(() => {
    if (!userId || Platform.OS === 'web') return;

    if (!enabled) {
      unregisterOfficeGeofences();
      return;
    }

    let cancelled = false;
    (async () => {
      await ensureNotificationSetup();
      await setupGeofencing();
    })();

    const subscription = addNotificationResponseListener(async (response) => {
      if (cancelled) return;
      const actionId = response.actionIdentifier;
      const { locationId } = (response.notification.request.content.data ?? {}) as { locationId?: string };
      if (!locationId) return;

      try {
        if (actionId === NOTIFICATION_ACTION.CLOCK_IN) {
          await clockIn(userId, locationId);
        } else if (actionId === NOTIFICATION_ACTION.CLOCK_OUT) {
          const active = await getActiveWorkLog(userId);
          if (active) await clockOut(userId, active.id);
        }
      } catch (err) {
        console.warn('[use-shift-tracking] failed to apply notification action', err);
      }
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [userId, enabled]);
}
