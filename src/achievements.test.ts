import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeStats,
  evaluateBadges,
  unseenBadges,
  emptyStats,
  BADGES,
} from './achievements';
import type { SessionSummary } from './achievements';

/** A completed session ending at a local wall-clock time. */
function at(
  kind: string,
  y: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  seconds: number,
  completed = true
): SessionSummary {
  return {
    kind,
    ended_at: new Date(y, month - 1, day, hour, minute).toISOString(),
    completed,
    duration_seconds: seconds,
  };
}

const NOW = new Date(2026, 6, 10, 22, 30);

test('computeStats on an empty log', () => {
  assert.deepEqual(computeStats([], NOW), emptyStats);
});

test('computeStats scores only completed sessions', () => {
  const rows = [
    at('routine', 2026, 7, 10, 21, 40, 1200),
    at('stretch', 2026, 7, 10, 22, 30, 300), // same night, second session
    at('routine', 2026, 7, 9, 21, 0, 1200),
    at('meditation', 2026, 7, 11, 0, 30, 600), // after midnight, still 07-10
    at('routine', 2026, 7, 5, 20, 0, 600, false), // abandoned
  ];
  const stats = computeStats(rows, NOW);

  assert.equal(stats.sessions, 4);
  assert.equal(stats.nights, 2, 'four sessions across two nights');
  assert.equal(stats.minutes, 55);
  assert.equal(stats.streak, 2);
  assert.equal(stats.bestStreak, 2);
  assert.equal(stats.kinds, 3);
  assert.equal(stats.afterMidnight, 1);
  assert.equal(stats.earlyNights, 2);
});

test('an abandoned session contributes nothing at all', () => {
  const stats = computeStats([at('routine', 2026, 7, 10, 21, 0, 1200, false)], NOW);
  assert.equal(stats.minutes, 0);
  assert.equal(stats.sessions, 0);
  assert.equal(stats.streak, 0, 'backing out must not extend a streak');
});

test('early nights are bounded below as well as above', () => {
  // Without the lower bound an afternoon stretch would read as an early night.
  assert.equal(computeStats([at('stretch', 2026, 7, 10, 14, 0, 300)], NOW).earlyNights, 0);
  assert.equal(computeStats([at('stretch', 2026, 7, 10, 19, 0, 300)], NOW).earlyNights, 1);
  assert.equal(computeStats([at('stretch', 2026, 7, 10, 22, 30, 300)], NOW).earlyNights, 0);
});

test('the badge catalog is well formed', () => {
  assert.equal(new Set(BADGES.map((b) => b.id)).size, BADGES.length, 'ids are unique');
  assert.ok(BADGES.every((b) => b.target > 0), 'every target is positive');
  assert.ok(BADGES.every((b) => b.name && b.detail), 'every badge has copy');
});

test('evaluateBadges keeps catalog order regardless of what is earned', () => {
  // Positions have to be learnable, so the case never reshuffles itself.
  const earnedSome = evaluateBadges(computeStats([at('routine', 2026, 7, 10, 21, 0, 1200)], NOW));
  assert.deepEqual(
    earnedSome.map((b) => b.id),
    BADGES.map((b) => b.id)
  );
});

test('nothing is earned on a fresh account', () => {
  assert.equal(evaluateBadges(emptyStats).filter((b) => b.earned).length, 0);
});

test('a locked badge reports how far along it is', () => {
  const badges = evaluateBadges(computeStats([at('routine', 2026, 7, 10, 21, 0, 1200)], NOW));
  const find = (id: string) => badges.find((b) => b.id === id)!;

  assert.equal(find('first-night').earned, true);
  assert.equal(find('sessions-10').earned, false);
  assert.equal(find('sessions-10').value, 1);
  assert.equal(find('minutes-60').value, 20, 'progress is in the badge’s own units');
});

test('progress never overshoots the target', () => {
  const badges = evaluateBadges({ ...emptyStats, sessions: 999 });
  assert.equal(badges.find((b) => b.id === 'sessions-10')!.value, 10);
});

test('a lapsed streak dims the number but never takes the badge back', () => {
  const week = [];
  for (let day = 1; day <= 7; day += 1) week.push(at('routine', 2026, 7, day, 21, 0, 600));

  const stats = computeStats(week, new Date(2026, 6, 20, 22, 0)); // nearly two weeks later
  assert.equal(stats.streak, 0, 'the current streak is gone');
  assert.equal(stats.bestStreak, 7, 'the best one is remembered');

  const badges = evaluateBadges(stats);
  assert.equal(badges.find((b) => b.id === 'streak-7')!.earned, true);
  assert.equal(badges.find((b) => b.id === 'streak-14')!.earned, false);
});

test('unseenBadges announces earned badges once', () => {
  const badges = evaluateBadges({ ...emptyStats, sessions: 12, bestStreak: 3 });
  const earned = badges.filter((b) => b.earned).map((b) => b.id);

  assert.ok(earned.length > 0);
  assert.deepEqual(unseenBadges(badges, []).map((b) => b.id), earned);
  assert.equal(unseenBadges(badges, earned).length, 0, 'seen ones drop out');
  assert.ok(unseenBadges(badges, []).every((b) => b.earned), 'locked ones are never announced');
});
