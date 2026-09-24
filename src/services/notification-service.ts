import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Fixed identifier so re-scheduling replaces the pending alert instead of
// stacking a second one, and cancelling needs no stored id.
const DAILY_TARGET_NOTIFICATION_ID = 'shiftsplit-daily-target';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function ensureNotificationSetup(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'ShiftSplit alerts',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }
  return status === 'granted';
}

/** Schedules (or moves) the one "8 hours done" alert to fire at `fireAt`. */
export async function scheduleDailyTargetAlert(fireAt: Date): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    identifier: DAILY_TARGET_NOTIFICATION_ID,
    content: {
      title: "You've worked 8 hours today",
      body: 'Daily target reached (after the 30 min lunch break). Remember to sign out.',
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt },
  });
}

export async function cancelDailyTargetAlert(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(DAILY_TARGET_NOTIFICATION_ID);
}
