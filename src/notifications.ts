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
    await Notifications.setNotificationChannelAsync('night-routine', {
      name: 'Night Routine',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    });
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🔴 Time to wind down',
      body: 'Switch on red light mode and start your night routine.',
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
