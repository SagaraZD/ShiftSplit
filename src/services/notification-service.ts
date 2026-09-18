import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export const NOTIFICATION_CATEGORY = {
  CLOCK_IN: 'shiftsplit-clock-in',
  CLOCK_OUT: 'shiftsplit-clock-out',
} as const;

export const NOTIFICATION_ACTION = {
  CLOCK_IN: 'clock-in',
  CLOCK_OUT: 'clock-out',
  IGNORE: 'ignore',
} as const;

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
  if (status !== 'granted') return false;

  await Notifications.setNotificationCategoryAsync(NOTIFICATION_CATEGORY.CLOCK_IN, [
    { identifier: NOTIFICATION_ACTION.CLOCK_IN, buttonTitle: 'Sign In', options: { opensAppToForeground: true } },
    {
      identifier: NOTIFICATION_ACTION.IGNORE,
      buttonTitle: 'Ignore',
      options: { opensAppToForeground: false, isDestructive: true },
    },
  ]);

  await Notifications.setNotificationCategoryAsync(NOTIFICATION_CATEGORY.CLOCK_OUT, [
    { identifier: NOTIFICATION_ACTION.CLOCK_OUT, buttonTitle: 'Sign Out', options: { opensAppToForeground: true } },
    {
      identifier: NOTIFICATION_ACTION.IGNORE,
      buttonTitle: 'Ignore',
      options: { opensAppToForeground: false, isDestructive: true },
    },
  ]);

  return true;
}

export async function presentClockInPrompt(locationId: string, locationName: string) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `Arrived at ${locationName} Office?`,
      body: 'Tap to Sign In',
      categoryIdentifier: NOTIFICATION_CATEGORY.CLOCK_IN,
      data: { locationId, locationName },
    },
    trigger: null,
  });
}

/** Scheduled `EXIT_CONFIRMATION_DELAY_MS` in the future — cancel it if the user re-enters before it fires. */
export async function scheduleClockOutPrompt(
  locationId: string,
  locationName: string,
  delayMs: number
): Promise<string> {
  return Notifications.scheduleNotificationAsync({
    content: {
      title: `Left ${locationName} Office?`,
      body: 'Tap to Sign Out',
      categoryIdentifier: NOTIFICATION_CATEGORY.CLOCK_OUT,
      data: { locationId, locationName },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: Math.max(1, Math.round(delayMs / 1000)),
    },
  });
}

export async function cancelScheduledNotification(notificationId: string) {
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}

export function addNotificationResponseListener(
  handler: (response: Notifications.NotificationResponse) => void
) {
  return Notifications.addNotificationResponseReceivedListener(handler);
}
