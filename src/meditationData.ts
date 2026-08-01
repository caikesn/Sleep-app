export const MEDITATION_DURATIONS = [3, 5, 10, 15, 20];

export const MEDITATION_PROMPTS = [
  'Notice your breath, in and out.',
  'Relax your shoulders and jaw.',
  'Let your thoughts pass by, without following them.',
  'Feel the weight of your body settling down.',
  'Soften your forehead and eyes.',
  'Slow the exhale a little more than the inhale.',
];

export const READING_PROMPT =
  'Keep the lights dim and, if you can, read something physical rather than a screen — the light and stimulation from screens can make it harder to fall asleep.';

/* ── Guided sessions ────────────────────────────────────────────────────── */

/**
 * A guided session is a script that advances on its own, one line at a time,
 * with a bell at each change.
 *
 * There is no narration. Recorded audio is the obvious other half of this and
 * the running screen is built to take it — `GuidedSession` has room for a track
 * and the timeline is already the cue sheet — but the voice has to be recorded
 * by someone, so what ships is the paced text.
 *
 * `seconds` is the segment's natural length. A session runs for whatever
 * duration you pick and the whole script is stretched to fit, so a five-minute
 * body scan and a twenty-minute one visit the same places at different speeds.
 */
export type GuidedSegment = { seconds: number; text: string };

export type GuidedSession = {
  id: string;
  name: string;
  detail: string;
  segments: GuidedSegment[];
  /** Reserved for narration. Nothing reads this yet. */
  track?: string;
};

export const UNGUIDED_ID = 'unguided';

export const GUIDED_SESSIONS: GuidedSession[] = [
  {
    id: 'body-scan',
    name: 'Body scan',
    detail: 'Attention down through the body, a piece at a time',
    segments: [
      { seconds: 40, text: 'Lie back and let the bed take your weight. Nothing to do but notice.' },
      { seconds: 40, text: 'Start at the top of your head. Let the scalp go soft.' },
      { seconds: 40, text: 'Your forehead, your eyes, the space between your brows.' },
      { seconds: 40, text: 'Unclench your jaw. Let your tongue rest away from the roof of your mouth.' },
      { seconds: 40, text: 'Your neck and throat. Let your head be heavy.' },
      { seconds: 45, text: 'Both shoulders — let them drop further than you think they can.' },
      { seconds: 40, text: 'Down your arms, through the elbows, into your hands. Let the fingers uncurl.' },
      { seconds: 45, text: 'Your chest, rising and falling. You do not have to help it.' },
      { seconds: 40, text: 'Your belly, soft. Your lower back, releasing into the bed.' },
      { seconds: 45, text: 'Your hips, then your thighs. Heavy and warm.' },
      { seconds: 40, text: 'Knees, calves, ankles. Let the feet fall open.' },
      { seconds: 45, text: 'Now the whole body at once. Nothing left holding on.' },
    ],
  },
  {
    id: 'breath-awareness',
    name: 'Breath awareness',
    detail: 'Following the breath without changing it',
    segments: [
      { seconds: 45, text: 'Settle in. Let the breath be exactly as it is.' },
      { seconds: 45, text: 'Find where you feel it most clearly — the nose, the chest, the belly.' },
      { seconds: 50, text: 'Rest your attention there. Follow one breath all the way in.' },
      { seconds: 50, text: 'And all the way out. Notice the small pause at the end.' },
      { seconds: 50, text: 'When your mind wanders, that is the practice, not a failure. Come back.' },
      { seconds: 50, text: 'Let the exhale get a little longer than the inhale.' },
      { seconds: 50, text: 'Count if it helps. In, two, three, four. Out, two, three, four, five, six.' },
      { seconds: 50, text: 'Stop counting. Just the feeling of air moving.' },
      { seconds: 50, text: 'Let the breath get slower on its own. Do not push it.' },
      { seconds: 50, text: 'Stay here. There is nowhere else to be tonight.' },
    ],
  },
  {
    id: 'letting-go',
    name: 'Letting the day go',
    detail: 'For a mind that is still at work',
    segments: [
      { seconds: 45, text: 'Bring the day to mind — all of it, in one go. Do not sort through it.' },
      { seconds: 50, text: 'Notice what your mind keeps returning to.' },
      { seconds: 50, text: 'Whatever it is, it will still be there tomorrow. It does not need you now.' },
      { seconds: 50, text: 'If something needs doing, name it once, and let tomorrow have it.' },
      { seconds: 50, text: 'Now something from today that went well. However small.' },
      { seconds: 50, text: 'Stay with that for a moment. Let it be the last thing.' },
      { seconds: 50, text: 'Feel your body against the bed. The day is behind you.' },
      { seconds: 50, text: 'Breathe out slowly. Let the day go with it.' },
      { seconds: 55, text: 'Nothing more is required of you today.' },
    ],
  },
];

export function guidedById(id: string): GuidedSession | undefined {
  return GUIDED_SESSIONS.find((session) => session.id === id);
}

export function guidedSeconds(session: GuidedSession): number {
  return session.segments.reduce((sum, segment) => sum + segment.seconds, 0);
}

export type GuidedCue = { at: number; text: string };

/**
 * The script laid out against the clock, stretched or compressed to fill the
 * chosen duration. Cues are cumulative start times, so finding the current one
 * is a scan rather than a running countdown that could drift.
 */
export function guidedTimeline(session: GuidedSession, totalSeconds: number): GuidedCue[] {
  const natural = guidedSeconds(session);
  if (natural <= 0 || totalSeconds <= 0) return [];

  const scale = totalSeconds / natural;
  const cues: GuidedCue[] = [];
  let at = 0;

  for (const segment of session.segments) {
    cues.push({ at: Math.round(at), text: segment.text });
    at += segment.seconds * scale;
  }

  return cues;
}

/** The line that should be showing at `elapsed` seconds. */
export function cueAt(cues: GuidedCue[], elapsed: number): GuidedCue | null {
  let current: GuidedCue | null = null;
  for (const cue of cues) {
    if (cue.at > elapsed) break;
    current = cue;
  }
  return current;
}

/* ── Bells ──────────────────────────────────────────────────────────────── */

export type BellSetting = 'off' | 'ends' | 'every-2' | 'every-5';

/**
 * Kept short deliberately: "Start & end / Every 2 min / Every 5 min" is a few
 * pixels too wide for one row on a 390pt screen and wraps to a lonely fourth
 * chip. The footnote on the screen carries the meaning instead.
 */
export const BELL_SETTINGS: { id: BellSetting; name: string }[] = [
  { id: 'off', name: 'Off' },
  { id: 'ends', name: 'Ends' },
  { id: 'every-2', name: 'Every 2m' },
  { id: 'every-5', name: 'Every 5m' },
];

const INTERVALS: Partial<Record<BellSetting, number>> = {
  'every-2': 120,
  'every-5': 300,
};

/**
 * The seconds at which a bell should ring, always in order.
 *
 * Start and end are included in every setting other than off: an interval bell
 * that doesn't open or close the session leaves you watching the clock for both
 * ends of it. Interval marks that land on the final bell are dropped rather
 * than ringing twice a second apart.
 */
export function bellTimes(setting: BellSetting, totalSeconds: number): number[] {
  if (setting === 'off' || totalSeconds <= 0) return [];

  const times = [0];
  const every = INTERVALS[setting];

  if (every) {
    for (let at = every; at < totalSeconds; at += every) times.push(at);
  }

  times.push(totalSeconds);
  return times;
}

/** True for the last bell, which is the lower of the two sounds. */
export function isFinalBell(times: number[], at: number): boolean {
  return times.length > 0 && at === times[times.length - 1];
}
