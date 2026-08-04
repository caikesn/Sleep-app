import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import {
  type Reminder,
  type ReminderId,
  type ScheduleSpec,
  REMINDER_COPY,
  REMINDER_IDS,
  expandSchedules,
  expoWeekday,
  ownsKey,
} from './reminders';

/**
 * The platform half of reminders. `reminders.ts` decides *what* should be
 * scheduled; this registers it with the OS.
 *
 * The one rule here: **nothing ever calls
 * `cancelAllScheduledNotificationsAsync`.** The previous version opened every
 * schedule with it, which meant the app could only ever hold one pending
 * notification — a second reminder silently deleted the first, and a morning
 * alarm was impossible to add at all. Everything is registered under a key it
 * owns, and cancelled by that key.
 */

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

/**
 * One Android channel per reminder, not one for the app.
 *
 * A channel is the only handle Android gives someone to change how a
 * notification behaves, and it cannot be changed after it is created. Sharing a
 * channel would mean silencing "lights out" also silences the wind-down
 * reminder — which is exactly the pair someone would want to treat differently.
 */
const CHANNELS: Record<ReminderId, { name: string; importance: number }> = {
  'wind-down': {
    name: 'Wind-down reminder',
    importance: Notifications.AndroidImportance.HIGH,
  },
  'lights-out': {
    // Below HIGH on purpose: this one is a nudge, not a summons. It should be
    // there when the phone is picked up, not shove itself in front of whatever
    // is on screen at a quarter to eleven.
    name: 'Lights out',
    importance: Notifications.AndroidImportance.DEFAULT,
  },
  wake: {
    // HIGH, like wind-down: this one is asking to be acted on, and it arrives
    // at a time when the phone is face down on a bedside table. It is still an
    // ordinary notification channel and not an alarm one — `USE_EXACT_ALARM`
    // and a full-screen intent are a different feature with a different Play
    // Store review, and the copy in `REMINDER_COPY` promises accordingly.
    name: 'Morning reminder',
    importance: Notifications.AndroidImportance.HIGH,
  },
};

async function ensureChannel(id: ReminderId): Promise<void> {
  if (Platform.OS !== 'android') return;
  const channel = CHANNELS[id];
  await Notifications.setNotificationChannelAsync(id, {
    name: channel.name,
    importance: channel.importance,
    sound: 'default',
  });
}

/**
 * Per-reminder serialisation.
 *
 * Every change is cancel-then-schedule, so two of them interleaving can cancel
 * a schedule that the earlier call had not yet written — dragging the time
 * picker fires a change per tick, which is exactly that race. Chaining per id
 * keeps the last write correct without making one reminder wait on another.
 *
 * This is the same lesson as the audio bug: an in-flight async operation needs
 * something guarding the gap, and the guard belongs to the thing it protects.
 */
const queues = new Map<ReminderId, Promise<unknown>>();

function serialise<T>(id: ReminderId, work: () => Promise<T>): Promise<T> {
  const prior = queues.get(id) ?? Promise.resolve();
  // `work` runs whether the previous call resolved or threw — a failed
  // schedule must not wedge the queue for the rest of the session.
  const next = prior.then(work, work);
  queues.set(
    id,
    next.catch(() => undefined)
  );
  return next;
}

function triggerFor(spec: ScheduleSpec): Notifications.NotificationTriggerInput {
  if (spec.kind === 'daily') {
    return {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: spec.hour,
      minute: spec.minute,
    };
  }
  return {
    type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
    weekday: expoWeekday(spec.weekday),
    hour: spec.hour,
    minute: spec.minute,
  };
}

/**
 * Drops every schedule this reminder owns, including keys from a previous
 * configuration — deselecting Friday has to remove `…n5`, and only reading back
 * what is actually registered can know that it was ever there.
 */
async function cancelOwnedKeys(id: ReminderId): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((request) => ownsKey(id, request.identifier))
      .map((request) => Notifications.cancelScheduledNotificationAsync(request.identifier))
  );
}

/**
 * Makes the OS match this reminder, leaving every other reminder alone.
 *
 * Safe to call with a disabled reminder — that cancels its schedules and
 * registers nothing, which is what turning it off means.
 */
export async function applyReminder(reminder: Reminder): Promise<void> {
  return serialise(reminder.id, async () => {
    const specs = expandSchedules(reminder);

    // Before cancelling, so a reminder is never briefly unscheduled *and*
    // missing the channel it is about to need.
    if (specs.length > 0) await ensureChannel(reminder.id);

    await cancelOwnedKeys(reminder.id);

    const copy = REMINDER_COPY[reminder.id];
    for (const spec of specs) {
      await Notifications.scheduleNotificationAsync({
        identifier: spec.key,
        content: {
          // No emoji — the platform draws those in its own multicolour font,
          // and this app replaced every one of them with a line icon.
          title: copy.title,
          body: copy.body,
          data: { reminder: reminder.id },
          sound: 'default',
          ...(Platform.OS === 'android' ? { channelId: reminder.id } : null),
        },
        trigger: triggerFor(spec),
      });
    }
  });
}

export async function applyReminders(reminders: Reminder[]): Promise<void> {
  await Promise.all(reminders.map(applyReminder));
}

export async function cancelReminder(id: ReminderId): Promise<void> {
  return serialise(id, () => cancelOwnedKeys(id));
}

/**
 * Which keys are currently registered. Nothing in the app needs this — it is
 * how a schedule can be checked from outside, the way `check:audio` counts
 * players, since a screenshot of a scheduled notification shows nothing.
 */
export async function scheduledKeys(): Promise<string[]> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  return scheduled.map((request) => request.identifier).sort();
}

/** The reminder a tapped notification came from, or null if it isn't ours. */
export function reminderFromResponse(response: Notifications.NotificationResponse): ReminderId | null {
  const data = response.notification.request.content.data;
  const id = data?.reminder;
  // Checked against the registry rather than a literal union written out here.
  // The literal version silently returned null for every new reminder id, so a
  // tap on one did nothing and looked like a navigation bug.
  return REMINDER_IDS.includes(id as ReminderId) ? (id as ReminderId) : null;
}
