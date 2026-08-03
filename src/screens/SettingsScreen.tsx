import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Switch, Pressable, Platform, Alert } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Screen from '../components/Screen';
import Icon from '../components/Icon';
import NightStrip from '../components/NightStrip';
import LevelRow from '../components/LevelRow';
import { theme, space, radius, type } from '../theme';
import { type Reminders, defaultReminders, loadReminders, saveReminders } from '../storage';
import { type DimLevel, type Lighting, DEFAULT_LIGHTING, DIM_COPY, DIM_LEVELS, describeDim } from '../lighting';
import { loadLighting, saveLighting } from '../lightingStorage';
import { SETTINGS_LINK_COPY, openAccessibilitySettings, openDisplaySettings } from '../systemSettings';
import {
  type Reminder,
  type ReminderId,
  type Weekday,
  REMINDER_COPY,
  REMINDER_IDS,
  describeNights,
  minutesBetween,
  toggleNight,
} from '../reminders';
import { applyReminder, ensurePermissions } from '../notifications';
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

/** "1h 15m", "45m" — the length of the gap between the two reminders. */
function formatGap(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

/**
 * Beyond this, lights out is almost certainly set *before* wind-down rather
 * than a very long evening after it — `minutesBetween` counts forward through
 * midnight, so 9pm after a 10pm wind-down reads as twenty-three hours.
 */
const IMPLAUSIBLE_GAP_MINUTES = 12 * 60;

export default function SettingsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, signOut } = useAuth();

  const [reminders, setReminders] = useState<Reminders>(defaultReminders);
  const [picking, setPicking] = useState<ReminderId | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [lighting, setLighting] = useState<Lighting>(DEFAULT_LIGHTING);

  useEffect(() => {
    loadReminders().then((r) => {
      setReminders(r);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    loadLighting().then(setLighting);
  }, []);

  /**
   * Lighting is written straight through, like `commit` above and for the same
   * reason — but with nothing to schedule and nothing to push, since it never
   * leaves the device. See `lightingStorage.ts` for why it doesn't.
   *
   * Nothing here changes the screen now. The level applies inside a session and
   * only there, so tapping "Dark" in a lit room at midday does not black out the
   * screen you are tapping it on.
   */
  function commitLighting(patch: Partial<Lighting>) {
    const next = { ...lighting, ...patch };
    setLighting(next);
    saveLighting(next);
  }

  /**
   * Every edit goes through here: state, cache and the OS in one place.
   *
   * Written explicitly rather than as an effect on the state, because the OS
   * call is not idempotent bookkeeping — it cancels and re-registers — and an
   * effect would fire it once on mount for no reason. Kept out of the `setState`
   * updater for the same reason: an updater can be replayed, and rescheduling
   * twice from one tap is exactly the kind of thing that goes unnoticed.
   */
  function commit(id: ReminderId, patch: Partial<Reminder>) {
    const next = { ...reminders, [id]: { ...reminders[id], ...patch } };
    setReminders(next);
    saveReminders(next);
    // Only the reminder that changed. Touching the other one would put it
    // through a cancel-and-reschedule it did not need.
    applyReminder(next[id]);
  }

  async function handleToggle(id: ReminderId, next: boolean) {
    if (next) {
      const granted = await ensurePermissions();
      if (!granted) {
        Alert.alert(
          'Notifications are off',
          'Turn on notifications for Wick in your phone’s settings, so it can reach you at night.'
        );
        return;
      }
    }
    commit(id, { enabled: next });
  }

  function handleTimeChange(id: ReminderId, event: unknown, date?: Date) {
    // On Android the picker is a dialog that dismisses itself; on iOS it is an
    // inline spinner that stays until it is closed.
    setPicking(Platform.OS === 'ios' ? id : null);
    if (!date) return;
    commit(id, { hour: date.getHours(), minute: date.getMinutes() });
  }

  const windDown = reminders['wind-down'];
  const lightsOut = reminders['lights-out'];
  const gap = minutesBetween(windDown, lightsOut);
  const bothOn = windDown.enabled && lightsOut.enabled;

  return (
    <Screen
      title="Settings"
      action={{ label: 'Done', onPress: () => navigation.goBack() }}
      scroll
    >
      <Text style={styles.sectionLabel}>REMINDERS</Text>

      {REMINDER_IDS.map((id) => {
        const reminder = reminders[id];
        const copy = REMINDER_COPY[id];
        const off = !reminder.enabled;

        return (
          <View key={id} style={styles.card}>
            <View style={styles.head}>
              <View style={styles.headText}>
                <Text style={styles.rowLabel}>{copy.name}</Text>
                <Text style={styles.caption}>{copy.caption}</Text>
              </View>
              <Switch
                value={reminder.enabled}
                onValueChange={(next) => handleToggle(id, next)}
                accessibilityLabel={copy.name}
                trackColor={{ false: theme.cardBorder, true: theme.emberDeep }}
                thumbColor={reminder.enabled ? theme.ember : theme.textFaint}
              />
            </View>

            <Pressable
              onPress={() => setPicking(picking === id ? null : id)}
              accessibilityRole="button"
              accessibilityLabel={`${copy.name} time, ${formatTime(reminder.hour, reminder.minute)}`}
            >
              <Text style={[styles.time, off && styles.dimmed]}>
                {formatTime(reminder.hour, reminder.minute)}
              </Text>
            </Pressable>

            {picking === id && (
              <DateTimePicker
                value={timeToDate(reminder.hour, reminder.minute)}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event, date) => handleTimeChange(id, event, date)}
                themeVariant="dark"
              />
            )}

            <View style={styles.nights}>
              <NightStrip
                value={reminder.nights}
                onToggle={(night: Weekday) =>
                  commit(id, { nights: toggleNight(reminder.nights, night) })
                }
                disabled={off}
              />
              <Text style={[styles.nightsLabel, off && styles.dimmed]}>
                {describeNights(reminder.nights)}
              </Text>
            </View>
          </View>
        );
      })}

      {bothOn && (
        <Text style={styles.note}>
          {gap === 0
            ? 'Both reminders are set for the same time.'
            : gap > IMPLAUSIBLE_GAP_MINUTES
              ? 'Lights out comes before wind-down, so it lands the night before.'
              : `${formatGap(gap)} of wind-down between them.`}
        </Text>
      )}

      <Text style={styles.sectionLabel}>LIGHT</Text>

      <View style={styles.card}>
        <Text style={styles.rowLabel}>Screen dim</Text>
        <Text style={styles.caption}>While a session is running</Text>
        <View style={styles.levels}>
          <LevelRow
            label="Screen dim"
            options={DIM_LEVELS.map((id) => ({ id, name: DIM_COPY[id].name }))}
            value={lighting.dim}
            onChange={(dim: DimLevel) => commitLighting({ dim })}
          />
        </View>
        <Text style={styles.levelCaption}>{describeDim(lighting.dim)}</Text>
        {lighting.dim !== 'off' && (
          // The promise this feature lives or dies on, so it is written down
          // rather than assumed. See `screenDim.ts`.
          <Text style={styles.cardNote}>Your brightness is put back when the session ends.</Text>
        )}

        <View style={styles.divider} />

        <View style={styles.head}>
          <View style={styles.headText}>
            <Text style={styles.rowLabel}>Warm light</Text>
            <Text style={styles.caption}>An amber wash over session screens</Text>
          </View>
          <Switch
            value={lighting.warm}
            onValueChange={(warm) => commitLighting({ warm })}
            accessibilityLabel="Warm light"
            trackColor={{ false: theme.cardBorder, true: theme.emberDeep }}
            thumbColor={lighting.warm ? theme.ember : theme.textFaint}
          />
        </View>
      </View>

      <Pressable style={styles.linkRow} onPress={() => navigation.navigate('RedLightTutorial')}>
        <View style={styles.linkText}>
          <Text style={styles.rowLabel}>Setting up red light</Text>
          <Text style={styles.caption}>Real bulbs, and a red filter for your screen</Text>
        </View>
        <Icon name="chevron" size={18} color={theme.ember} />
      </Pressable>

      {/* Neither of these can be switched on from in here — they are system
          settings, and this is the shortcut to them, not a remote control.
          What a tap actually reaches differs by platform; the captions say
          which. See `systemSettings.ts`. */}
      <Pressable style={[styles.linkRow, styles.linkRowStacked]} onPress={openAccessibilitySettings}>
        <View style={styles.linkText}>
          <Text style={styles.rowLabel}>Phone's accessibility settings</Text>
          <Text style={styles.caption}>{SETTINGS_LINK_COPY.accessibility}</Text>
        </View>
        <Icon name="chevron" size={18} color={theme.ember} />
      </Pressable>

      <Pressable style={[styles.linkRow, styles.linkRowStacked]} onPress={openDisplaySettings}>
        <View style={styles.linkText}>
          <Text style={styles.rowLabel}>Phone's display settings</Text>
          <Text style={styles.caption}>{SETTINGS_LINK_COPY.display}</Text>
        </View>
        <Icon name="chevron" size={18} color={theme.ember} />
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
    marginBottom: space.sm,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  headText: {
    flex: 1,
  },
  caption: {
    color: theme.textDim,
    ...type.label,
    fontWeight: '400',
  },
  time: {
    color: theme.text,
    // Smaller than the 40pt it was, now that two of these sit on one screen
    // above a row of seven controls each.
    fontSize: 34,
    fontWeight: '600',
    marginTop: space.sm,
  },
  /**
   * A disabled reminder is dimmed rather than hidden. The time and the nights
   * are what you came to change, and a card that empties itself when you switch
   * it off makes you turn it back on to find out what it was set to.
   */
  dimmed: {
    opacity: 0.45,
  },
  nights: {
    marginTop: space.md,
  },
  nightsLabel: {
    color: theme.textDim,
    ...type.label,
    fontWeight: '400',
    marginTop: space.sm,
  },
  note: {
    color: theme.textFaint,
    ...type.label,
    fontWeight: '400',
    marginTop: space.xs,
    marginLeft: space.xs,
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
  /** Second and subsequent links in a run of them. */
  linkRowStacked: {
    marginTop: space.sm,
  },
  levels: {
    marginTop: space.md,
  },
  /**
   * The line that changes as you step through the levels. Sized like a caption
   * but held one step brighter, because it is the only feedback the control
   * gives — nothing on this screen actually dims while you set it.
   */
  levelCaption: {
    color: theme.textDim,
    ...type.label,
    fontWeight: '400',
    marginTop: space.sm + 2,
  },
  /**
   * Like `note`, but for one sitting *inside* a card. `note` carries a small
   * left margin that lines it up with the rounded corner of the card above it;
   * in here that same margin reads as the line being indented by mistake.
   */
  cardNote: {
    color: theme.textFaint,
    ...type.label,
    fontWeight: '400',
    marginTop: space.xs,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.cardBorder,
    marginVertical: space.lg,
  },
  linkText: {
    flex: 1,
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
