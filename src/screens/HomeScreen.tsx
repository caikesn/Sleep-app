import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Switch, Pressable, Platform, Alert } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { theme } from '../theme';
import { loadSettings, saveSettings } from '../storage';
import { cancelNightlyRoutine, ensurePermissions, scheduleNightlyRoutine } from '../notifications';

type Props = {
  onStartRoutine: () => void;
};

function timeToDate(hour: number, minute: number): Date {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d;
}

function formatTime(hour: number, minute: number): string {
  const d = timeToDate(hour, minute);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export default function HomeScreen({ onStartRoutine }: Props) {
  const [hour, setHour] = useState(21);
  const [minute, setMinute] = useState(30);
  const [enabled, setEnabled] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadSettings().then((s) => {
      setHour(s.hour);
      setMinute(s.minute);
      setEnabled(s.enabled);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!loaded) return;
    saveSettings({ hour, minute, enabled });
  }, [hour, minute, enabled, loaded]);

  async function handleToggle(next: boolean) {
    if (next) {
      const granted = await ensurePermissions();
      if (!granted) {
        Alert.alert(
          'Notifications disabled',
          'Enable notifications for this app in Settings so it can remind you at night.'
        );
        return;
      }
      await scheduleNightlyRoutine(hour, minute);
    } else {
      await cancelNightlyRoutine();
    }
    setEnabled(next);
  }

  async function handleTimeChange(event: unknown, date?: Date) {
    setShowPicker(Platform.OS === 'ios');
    if (!date) return;
    const h = date.getHours();
    const m = date.getMinutes();
    setHour(h);
    setMinute(m);
    if (enabled) {
      await scheduleNightlyRoutine(h, m);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Night Routine</Text>
      <Text style={styles.subtitle}>Wind down, switch to red light, stretch it out.</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Reminder time</Text>
        <Pressable onPress={() => setShowPicker(true)}>
          <Text style={styles.time}>{formatTime(hour, minute)}</Text>
        </Pressable>

        {showPicker && (
          <DateTimePicker
            value={timeToDate(hour, minute)}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleTimeChange}
            themeVariant="dark"
          />
        )}

        <View style={styles.row}>
          <Text style={styles.label}>Nightly reminder</Text>
          <Switch value={enabled} onValueChange={handleToggle} />
        </View>
      </View>

      <Pressable style={styles.startButton} onPress={onStartRoutine}>
        <Text style={styles.startButtonText}>Start routine now</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.bg,
    padding: 24,
    paddingTop: 80,
  },
  title: {
    color: theme.text,
    fontSize: 30,
    fontWeight: '700',
  },
  subtitle: {
    color: theme.textDim,
    fontSize: 15,
    marginTop: 6,
    marginBottom: 32,
  },
  card: {
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 20,
  },
  label: {
    color: theme.textDim,
    fontSize: 14,
  },
  time: {
    color: theme.text,
    fontSize: 40,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.textDim,
  },
  startButton: {
    marginTop: 32,
    backgroundColor: theme.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  startButtonText: {
    color: theme.text,
    fontSize: 17,
    fontWeight: '600',
  },
});
