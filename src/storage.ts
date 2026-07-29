import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  hour: 'routine_hour',
  minute: 'routine_minute',
  enabled: 'routine_enabled',
};

export type RoutineSettings = {
  hour: number;
  minute: number;
  enabled: boolean;
};

const DEFAULT_SETTINGS: RoutineSettings = { hour: 21, minute: 30, enabled: false };

export async function loadSettings(): Promise<RoutineSettings> {
  const [hour, minute, enabled] = await Promise.all([
    AsyncStorage.getItem(KEYS.hour),
    AsyncStorage.getItem(KEYS.minute),
    AsyncStorage.getItem(KEYS.enabled),
  ]);

  return {
    hour: hour !== null ? parseInt(hour, 10) : DEFAULT_SETTINGS.hour,
    minute: minute !== null ? parseInt(minute, 10) : DEFAULT_SETTINGS.minute,
    enabled: enabled !== null ? enabled === 'true' : DEFAULT_SETTINGS.enabled,
  };
}

export async function saveSettings(settings: RoutineSettings): Promise<void> {
  await Promise.all([
    AsyncStorage.setItem(KEYS.hour, String(settings.hour)),
    AsyncStorage.setItem(KEYS.minute, String(settings.minute)),
    AsyncStorage.setItem(KEYS.enabled, String(settings.enabled)),
  ]);
}
