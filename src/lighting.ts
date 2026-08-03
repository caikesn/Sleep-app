/**
 * How dark the app makes itself, and how warm it looks doing it.
 *
 * The pure half: levels, the brightness each one asks for, and the copy that
 * names them. Nothing here imports a platform module, so it can be tested —
 * `screenDim.ts` holds the part that actually touches the screen.
 *
 * The premise the whole app rests on is that ambient light matters more than
 * what the phone shows, and this is the one feature that could quietly
 * contradict it: a wind-down screen at full brightness is a torch held at
 * reading distance. So the dim is not a nicety, it's the app taking its own
 * advice — and it stays scoped to a running session, because dimming a phone
 * someone is still browsing on is a fault, not a feature.
 */

export const DIM_LEVELS = ['off', 'soft', 'dim', 'dark'] as const;

export type DimLevel = (typeof DIM_LEVELS)[number];

/**
 * The most light each level will leave on screen, as a fraction of full.
 *
 * A ceiling rather than a multiplier. A multiplier gives a different result on
 * every phone — 40% of someone's already-dim screen is a different room to 40%
 * of a screen at full — whereas a ceiling means "no brighter than this", which
 * is the sentence the level names actually promise.
 *
 * `off` is absent rather than set to 1: there is a difference between asking
 * for full brightness and not asking for anything, and only the second one
 * leaves the phone alone.
 */
const CEILING: Record<Exclude<DimLevel, 'off'>, number> = {
  soft: 0.35,
  dim: 0.15,
  // Low enough to be unreadable in daylight, which is fine — nothing here is
  // meant to be used in daylight. Not zero: a black screen reads as a crash.
  dark: 0.04,
};

/**
 * The brightness a level wants, given what the screen is on now, or `null` for
 * "don't touch it".
 *
 * Never brightens. Someone who keeps their phone at 5% has already made this
 * decision more aggressively than we would, and raising them to 15% because
 * they picked "Dim" would be the app overriding a preference in the name of
 * respecting it.
 */
export function brightnessFor(level: DimLevel, current: number): number | null {
  if (level === 'off') return null;
  const ceiling = CEILING[level];
  // A brightness the OS couldn't read (web returns nothing useful, and an error
  // path may hand us a NaN) means we have nothing to compare against, so the
  // ceiling stands on its own rather than being silently discarded.
  if (!Number.isFinite(current)) return ceiling;
  return Math.min(clamp(current), ceiling);
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export const DIM_COPY: Record<DimLevel, { name: string; caption: string }> = {
  off: { name: 'Off', caption: 'Wick leaves your brightness alone.' },
  soft: { name: 'Soft', caption: 'A little under half, for a lit room.' },
  dim: { name: 'Dim', caption: 'Low enough to read by in the dark.' },
  dark: { name: 'Dark', caption: 'Barely lit. For a room with the lamp already off.' },
};

export type Lighting = {
  /** How far down the screen goes while a session runs. */
  dim: DimLevel;
  /** The amber wash over session screens. */
  warm: boolean;
};

/**
 * Soft, and warm.
 *
 * Not `off`. This app's one job is the hour before bed, and shipping the light
 * feature switched off by default would mean the people who most need it — the
 * ones who never open Settings — never get it. Soft is the gentlest step that
 * does anything, it only ever applies inside a session, and the session screen
 * names it on the banner, so nobody meets a dark screen they can't explain.
 */
export const DEFAULT_LIGHTING: Lighting = { dim: 'soft', warm: true };

function isDimLevel(value: unknown): value is DimLevel {
  return typeof value === 'string' && (DIM_LEVELS as readonly string[]).includes(value);
}

/**
 * Reads whatever is on disk into a whole `Lighting`, falling back per field.
 *
 * Per field rather than all-or-nothing: a build that adds a third preference
 * shouldn't reset the two someone has already set, and a level this build
 * doesn't recognise shouldn't cost them their warm-light choice.
 */
export function normaliseLighting(raw: unknown): Lighting {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_LIGHTING };
  const value = raw as Record<string, unknown>;
  return {
    dim: isDimLevel(value.dim) ? value.dim : DEFAULT_LIGHTING.dim,
    warm: typeof value.warm === 'boolean' ? value.warm : DEFAULT_LIGHTING.warm,
  };
}

/**
 * The line under the level pills, and the same line the session banner shows.
 *
 * One function so the two can't drift. A banner that says the screen is dimmed
 * while Settings says it isn't is worse than neither saying anything.
 */
export function describeDim(level: DimLevel): string {
  return DIM_COPY[level].caption;
}

/**
 * The next level round, for the single pill on the session banner.
 *
 * A cycling control is normally a bad one — it hides where the other values are
 * and makes you tap blind to find them. It earns its place here because both of
 * the things that usually make it bad are absent: the pill always shows the
 * level it is on, and every tap changes the actual screen brightness
 * immediately, so the feedback is the room rather than a label.
 *
 * The alternative was four pills across a screen that is already carrying a
 * pose, a timer and three transport controls, or leaving the level unchangeable
 * once the session starts — which is the complaint the meditation volume
 * control has earned, and not one worth repeating here.
 */
export function nextDimLevel(level: DimLevel): DimLevel {
  const index = DIM_LEVELS.indexOf(level);
  return DIM_LEVELS[(index + 1) % DIM_LEVELS.length];
}
