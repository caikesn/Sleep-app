import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useScreenLoad } from '../screenLoad';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Screen from '../components/Screen';
import Icon, { IconName } from '../components/Icon';
import WeekStrip from '../components/WeekStrip';
import Candle from '../components/Candle';
import { WAX } from '../candles';
import { useReduceMotion } from '../reduceMotion';
import { theme, space, radius } from '../theme';
import { formatTotal } from '../format';
import { nightDate, nightOf, addDays } from '../streak';
import { loadProgress, markBadgesSeen, emptyProgress } from '../sessions';
import type { LoggedSession, Progress } from '../sessions';
import type { BadgeState } from '../achievements';
import type { YouStackParamList } from '../navigation';

const KIND_ICONS: Record<string, IconName> = {
  routine: 'tonight',
  stretch: 'stretches',
  meditation: 'breathe',
  reading: 'reading',
};

function formatLength(seconds: number): string {
  return seconds >= 60 ? `${Math.round(seconds / 60)}m` : `${seconds}s`;
}

function nightLabel(key: string, tonight: string): string {
  if (key === tonight) return 'Tonight';
  if (key === addDays(tonight, -1)) return 'Last night';
  return nightDate(key).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' });
}

/** Groups sessions under the night they belong to, newest night first. */
function groupByNight(history: LoggedSession[]): { night: string; sessions: LoggedSession[] }[] {
  const groups: { night: string; sessions: LoggedSession[] }[] = [];
  for (const session of history) {
    const night = nightOf(session.ended_at);
    const last = groups[groups.length - 1];
    if (last && last.night === night) last.sessions.push(session);
    else groups.push({ night, sessions: [session] });
  }
  return groups;
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function BadgeTile({ badge, isNew, still }: { badge: BadgeState; isNew: boolean; still: boolean }) {
  const { earned, value, target } = badge;

  return (
    <View style={[styles.badge, earned && styles.badgeEarned]}>
      {/* A locked badge is its own candle, unlit and part-filled — not a
          padlock. Thirteen identical locks read as a wall; thirteen candles at
          thirteen different levels read as a collection you are partway
          through, and the fill says how far without being read. */}
      <Candle
        vessel={badge.vessel}
        wax={WAX[badge.wax]}
        fill={value / target}
        lit={earned}
        still={still}
        style={styles.badgeCandle}
      />
      <Text style={[styles.badgeName, earned && styles.badgeNameEarned]} numberOfLines={1}>
        {badge.name}
      </Text>
      <Text style={styles.badgeDetail} numberOfLines={2}>
        {badge.detail}
      </Text>

      {earned ? (
        <Text style={styles.badgeEarnedLabel}>{isNew ? 'NEW' : 'EARNED'}</Text>
      ) : (
        <View style={styles.progress}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${(value / target) * 100}%` }]} />
          </View>
          <Text style={styles.progressText}>
            {value} / {target}
          </Text>
        </View>
      )}
    </View>
  );
}

export default function ProgressScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<YouStackParamList>>();
  const [progress, setProgress] = useState<Progress>(emptyProgress);
  // Held separately from `progress` so the NEW flags survive being marked seen —
  // the badge should still read NEW for the visit that revealed it.
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const still = useReduceMotion();

  useScreenLoad(
    useCallback(() => {
      let active = true;
      loadProgress().then((next) => {
        if (!active) return;
        setProgress(next);
        if (next.unseen.length === 0) return;
        setNewIds(new Set(next.unseen.map((b) => b.id)));
        // Viewing the case is the acknowledgement, so Tonight stops announcing.
        void markBadgesSeen(next.unseen.map((b) => b.id));
      });
      return () => {
        active = false;
      };
    }, [])
  );

  const { stats, badges, history } = progress;
  const nights = new Set(history.filter((s) => s.completed).map((s) => nightOf(s.ended_at)));
  const earned = badges.filter((b) => b.earned).length;
  const tonight = nightOf(new Date());
  const groups = groupByNight(history.slice(0, 40));

  return (
    <Screen
      title="You"
      action={{ label: 'Settings', onPress: () => navigation.navigate('Settings') }}
      scroll
    >
      <View style={styles.hero}>
        {/* A 72pt zero is the first thing a new account would see, and it reads
            as failure before you've had the chance to do anything. Below one,
            the hero says what to do instead of scoring you on it. */}
        {stats.streak > 0 ? (
          <>
            <Text style={styles.streakValue}>{stats.streak}</Text>
            <Text style={styles.streakLabel}>
              {stats.streak === 1 ? 'night in a row' : 'nights in a row'}
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.heroPhrase}>{stats.sessions === 0 ? 'Night one' : 'Tonight'}</Text>
            <Text style={styles.streakLabel}>
              {stats.sessions === 0
                ? 'your first wind-down starts tonight'
                : 'a streak begins with one night'}
            </Text>
          </>
        )}
        <View style={styles.week}>
          <WeekStrip nights={nights} />
        </View>
      </View>

      <View style={styles.statRow}>
        <Stat value={String(stats.nights)} label="nights" />
        <Stat value={formatTotal(stats.minutes)} label="wound down" />
        <Stat value={String(stats.bestStreak)} label="best streak" />
      </View>

      <View style={styles.sectionHead}>
        <Text style={styles.sectionLabel}>ACHIEVEMENTS</Text>
        <Text style={styles.sectionCount}>
          {earned} of {badges.length}
        </Text>
      </View>
      <View style={styles.badgeGrid}>
        {badges.map((badge) => (
          <BadgeTile key={badge.id} badge={badge} isNew={newIds.has(badge.id)} still={still} />
        ))}
      </View>

      <Text style={styles.sectionLabel}>HISTORY</Text>
      {groups.length === 0 ? (
        <Text style={styles.empty}>
          Nothing here yet. Finish a wind-down and it'll show up the same night.
        </Text>
      ) : (
        groups.map((group) => (
          <View key={group.night} style={styles.nightGroup}>
            <Text style={styles.nightLabel}>{nightLabel(group.night, tonight)}</Text>
            {group.sessions.map((session) => (
              <View key={`${session.started_at}-${session.kind}`} style={styles.historyRow}>
                <View style={styles.historyIcon}>
                  <Icon
                    name={KIND_ICONS[session.kind] ?? 'tonight'}
                    size={16}
                    color={session.completed ? theme.ember : theme.textFaint}
                  />
                </View>
                <Text
                  style={[styles.historyTitle, !session.completed && styles.historyTitleDim]}
                  numberOfLines={1}
                >
                  {session.title ?? session.kind}
                </Text>
                {!session.completed && <Text style={styles.historyTag}>left early</Text>}
                <Text style={styles.historyTime}>{formatLength(session.duration_seconds)}</Text>
              </View>
            ))}
          </View>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    paddingTop: space.sm,
    paddingBottom: space.lg,
  },
  streakValue: {
    color: theme.ember,
    fontSize: 72,
    fontWeight: '300',
    letterSpacing: -2,
    fontVariant: ['tabular-nums'],
  },
  heroPhrase: {
    color: theme.text,
    fontSize: 38,
    fontWeight: '300',
    letterSpacing: -0.5,
    // Sits where the numeral's optical centre would be, so the week strip
    // below doesn't shift when the first streak lands.
    paddingVertical: space.md,
  },
  streakLabel: {
    color: theme.textDim,
    fontSize: 14,
    marginTop: -space.xs,
  },
  week: {
    alignSelf: 'stretch',
    marginTop: space.lg,
  },
  statRow: {
    flexDirection: 'row',
    backgroundColor: theme.card,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.cardBorder,
    paddingVertical: space.md,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    color: theme.text,
    fontSize: 20,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    color: theme.textFaint,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    color: theme.textFaint,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginTop: space.xl,
    marginBottom: space.sm,
  },
  sectionCount: {
    color: theme.textDim,
    fontSize: 12,
    fontWeight: '600',
    marginTop: space.xl,
  },
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: space.sm,
  },
  badge: {
    // Fixed width with space-between rather than flexGrow: the catalog has an
    // odd number of badges, and a growing tile stretches the last one across
    // the full width like a broken row.
    width: '48.5%',
    backgroundColor: theme.card,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.cardBorder,
    padding: space.md,
  },
  badgeEarned: {
    backgroundColor: theme.emberVeil,
    borderColor: theme.emberEdge,
  },
  badgeCandle: {
    // Nudged out to the tile's left edge: the candle's box is wider than any
    // candle in it, so padding it flush leaves the wax looking indented.
    marginLeft: -space.xs,
    marginBottom: space.sm,
  },
  badgeName: {
    color: theme.textDim,
    fontSize: 14,
    fontWeight: '700',
  },
  badgeNameEarned: {
    color: theme.text,
  },
  badgeDetail: {
    color: theme.textFaint,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
    marginBottom: space.sm,
    minHeight: 30,
  },
  badgeEarnedLabel: {
    color: theme.ember,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  progress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  progressTrack: {
    flex: 1,
    height: 3,
    borderRadius: radius.pill,
    backgroundColor: theme.cardBorder,
    overflow: 'hidden',
  },
  progressFill: {
    height: 3,
    borderRadius: radius.pill,
    backgroundColor: theme.emberDeep,
  },
  progressText: {
    color: theme.textFaint,
    fontSize: 10,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  empty: {
    color: theme.textFaint,
    fontSize: 14,
    lineHeight: 20,
  },
  nightGroup: {
    marginBottom: space.md,
  },
  nightLabel: {
    color: theme.textDim,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: space.xs,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.cardBorder,
  },
  historyIcon: {
    width: 26,
  },
  historyTitle: {
    flex: 1,
    color: theme.text,
    fontSize: 15,
  },
  historyTitleDim: {
    color: theme.textDim,
  },
  historyTag: {
    color: theme.textFaint,
    fontSize: 11,
    fontWeight: '600',
    marginRight: space.sm,
  },
  historyTime: {
    color: theme.textDim,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
});
