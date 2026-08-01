import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BELL_SETTINGS,
  GUIDED_SESSIONS,
  MEDITATION_DURATIONS,
  bellTimes,
  cueAt,
  guidedById,
  guidedSeconds,
  guidedTimeline,
  isFinalBell,
} from './meditationData';

const bodyScan = guidedById('body-scan')!;

test('every guided session is well formed', () => {
  const ids = GUIDED_SESSIONS.map((session) => session.id);
  assert.equal(new Set(ids).size, ids.length);

  for (const session of GUIDED_SESSIONS) {
    assert.ok(session.segments.length >= 5, `${session.id} is too short to be a session`);
    assert.ok(session.segments.every((segment) => segment.seconds > 0));
    assert.ok(session.segments.every((segment) => segment.text.trim().length > 10));
  }
});

test('a timeline covers the whole session and starts at zero', () => {
  const cues = guidedTimeline(bodyScan, 600);
  assert.equal(cues.length, bodyScan.segments.length);
  assert.equal(cues[0].at, 0);
  assert.ok(cues[cues.length - 1].at < 600, 'the last line must start before time is up');
});

test('cue times only ever move forwards', () => {
  for (const session of GUIDED_SESSIONS) {
    for (const minutes of MEDITATION_DURATIONS) {
      const cues = guidedTimeline(session, minutes * 60);
      for (let i = 1; i < cues.length; i += 1) {
        assert.ok(cues[i].at > cues[i - 1].at, `${session.id} at ${minutes}m, cue ${i}`);
      }
    }
  }
});

test('the same script stretches to fill whatever duration is chosen', () => {
  const short = guidedTimeline(bodyScan, 180);
  const long = guidedTimeline(bodyScan, 1200);

  assert.equal(short.length, long.length);
  assert.deepEqual(
    short.map((cue) => cue.text),
    long.map((cue) => cue.text)
  );
  // Same places, slower.
  assert.ok(long[1].at > short[1].at);
});

test('guidedTimeline refuses to divide by a zero-length script', () => {
  assert.deepEqual(guidedTimeline({ ...bodyScan, segments: [] }, 300), []);
  assert.deepEqual(guidedTimeline(bodyScan, 0), []);
});

test('cueAt holds the current line until the next one is due', () => {
  const cues = guidedTimeline(bodyScan, 600);
  assert.equal(cueAt(cues, 0)?.text, cues[0].text);
  assert.equal(cueAt(cues, cues[1].at - 1)?.text, cues[0].text);
  assert.equal(cueAt(cues, cues[1].at)?.text, cues[1].text);
  // Past the end, the last line stays put rather than blanking the screen.
  assert.equal(cueAt(cues, 10_000)?.text, cues[cues.length - 1].text);
});

test('cueAt on an empty timeline is null, not a crash', () => {
  assert.equal(cueAt([], 30), null);
});

test('guidedSeconds is the natural length of the script', () => {
  assert.equal(
    guidedSeconds(bodyScan),
    bodyScan.segments.reduce((sum, segment) => sum + segment.seconds, 0)
  );
});

test('bells off means no bells at all', () => {
  assert.deepEqual(bellTimes('off', 600), []);
});

test('every setting other than off opens and closes the session', () => {
  for (const { id } of BELL_SETTINGS.filter((setting) => setting.id !== 'off')) {
    const times = bellTimes(id, 600);
    assert.equal(times[0], 0, id);
    assert.equal(times[times.length - 1], 600, id);
  }
});

test('interval bells land between the ends', () => {
  assert.deepEqual(bellTimes('every-2', 600), [0, 120, 240, 360, 480, 600]);
  assert.deepEqual(bellTimes('every-5', 900), [0, 300, 600, 900]);
});

test('an interval that lands on the end does not ring twice', () => {
  // 300s at every-5 would otherwise emit 300 as both an interval and the end.
  assert.deepEqual(bellTimes('every-5', 300), [0, 300]);
  assert.deepEqual(bellTimes('every-2', 120), [0, 120]);
});

test('an interval longer than the session still gets its two ends', () => {
  assert.deepEqual(bellTimes('every-5', 180), [0, 180]);
});

test('bell times are strictly increasing for every offered duration', () => {
  for (const { id } of BELL_SETTINGS) {
    for (const minutes of MEDITATION_DURATIONS) {
      const times = bellTimes(id, minutes * 60);
      for (let i = 1; i < times.length; i += 1) {
        assert.ok(times[i] > times[i - 1], `${id} at ${minutes}m`);
      }
    }
  }
});

test('only the last bell is the final one', () => {
  const times = bellTimes('every-2', 600);
  assert.ok(isFinalBell(times, 600));
  assert.ok(!isFinalBell(times, 0));
  assert.ok(!isFinalBell(times, 480));
  assert.ok(!isFinalBell([], 0));
});
