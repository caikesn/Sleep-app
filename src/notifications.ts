import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export const NIGHT_ROUTINE_CATEGORY = 'night-routine';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function ensurePermissions(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

export async function scheduleNightlyRoutine(hour: number, minute: number): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();

  if (Platform.OS === 'android') {
    // The channel *id* stays `night-routine` — it is the identifier Android
    // keys a channel by, and it names the reminder, not the app. The `name` is
    // the string the user reads in system settings, so that one is the app's.
    await Notifications.setNotificationChannelAsync('night-routine', {
      name: 'Wind-down reminder',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    });
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      // No emoji. The app replaced every emoji with line icons because the
      // platform draws them in its own multicolour font, and this notification
      // now carries the Wick flame as its own monochrome icon anyway.
      title: 'Time to wind down',
      body: 'Dim the lights and start your night routine.',
      data: { type: NIGHT_ROUTINE_CATEGORY },
      sound: 'default',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
}

export async function cancelNightlyRoutine(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
