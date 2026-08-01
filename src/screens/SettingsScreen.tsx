import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Switch, Pressable, Platform, Alert } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Screen from '../components/Screen';
import { theme, space, radius, type } from '../theme';
import { loadSettings, saveSettings } from '../storage';
import { cancelNightlyRoutine, ensurePermissions, scheduleNightlyRoutine } from '../notifications';
import { useAuth } from '../lib/AuthContext';
import type { RootStackParamList } from '../navigation';

function timeToDate(hour: number, minute: number): Date {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d;
}

function formatTime(hour: number, minute: number): string {
  return timeToDate(hour, minute).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export default function SettingsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, signOut } = useAuth();

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
    setHour(date.getHours());
    setMinute(date.getMinutes());
    if (enabled) {
      await scheduleNightlyRoutine(date.getHours(), date.getMinutes());
    }
  }

  return (
    <Screen title="You" scroll>
      <Text style={styles.sectionLabel}>WIND-DOWN REMINDER</Text>
      <View style={styles.card}>
        <Pressable onPress={() => setShowPicker(true)}>
          <Text style={styles.caption}>Reminder time</Text>
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
          <Text style={styles.rowLabel}>Remind me nightly</Text>
          <Switch
            value={enabled}
            onValueChange={handleToggle}
            trackColor={{ false: theme.cardBorder, true: theme.emberDeep }}
            thumbColor={enabled ? theme.ember : theme.textFaint}
          />
        </View>
      </View>

      <Text style={styles.sectionLabel}>LIGHT</Text>
      <Pressable style={styles.linkRow} onPress={() => navigation.navigate('RedLightTutorial')}>
        <View style={styles.linkText}>
          <Text style={styles.rowLabel}>Setting up red light</Text>
          <Text style={styles.caption}>Real bulbs, Night Shift and Night Light</Text>
        </View>
        <Text style={styles.chevron}>→</Text>
      </Pressable>

      <Text style={styles.sectionLabel}>ACCOUNT</Text>
      <View style={styles.card}>
        <Text style={styles.caption}>Signed in as</Text>
        <Text style={styles.email}>{user?.email ?? '—'}</Text>
        <Pressable
          style={styles.signOutRow}
          onPress={() =>
            Alert.alert('Sign out?', 'Your routines and history stay saved to your account.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign out', style: 'destructive', onPress: signOut },
            ])
          }
        >
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    color: theme.textFaint,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: space.sm,
    marginTop: space.lg,
  },
  card: {
    backgroundColor: theme.card,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.cardBorder,
    padding: space.lg,
  },
  caption: {
    color: theme.textDim,
    ...type.label,
    fontWeight: '400',
  },
  time: {
    color: theme.text,
    fontSize: 40,
    fontWeight: '600',
    marginTop: space.xs,
    marginBottom: space.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.cardBorder,
  },
  rowLabel: {
    color: theme.text,
    fontSize: 15,
    fontWeight: '600',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.card,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.cardBorder,
    padding: space.lg,
  },
  linkText: {
    flex: 1,
  },
  chevron: {
    color: theme.ember,
    fontSize: 18,
    marginLeft: space.md,
  },
  email: {
    color: theme.text,
    fontSize: 16,
    fontWeight: '600',
    marginTop: space.xs,
    marginBottom: space.md,
  },
  signOutRow: {
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.cardBorder,
  },
  signOutText: {
    color: theme.danger,
    fontSize: 15,
    fontWeight: '600',
  },
});
