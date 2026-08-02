/**
 * Warm dusk / ember.
 *
 * Rule for this app: no blue, anywhere. Every neutral is warm-shifted, so the
 * interface reads like lamplight rather than a screen. This is what ties the
 * UI to the red-light premise instead of leaving it as a single feature.
 */
export const theme = {
  // Surfaces — warm near-blacks, not neutral greys.
  bg: '#14100c',
  bgRaised: '#1c1611',
  card: '#1f1813',
  cardBorder: '#2e241c',

  // Type — warm whites through to a dim clay.
  text: '#f7ede2',
  textDim: '#a89482',
  textFaint: '#6b5c4e',

  // Ember accent.
  ember: '#ff9d5c',
  emberDeep: '#e8703a',
  emberGlow: 'rgba(255, 157, 92, 0.14)',

  // The wash applied during a routine when warm light is on.
  warmLight: '#241a10',

  // Translucent ember for selectable surfaces — sits over the gradient rather
  // than punching a flat card into it.
  emberVeil: 'rgba(255, 157, 92, 0.07)',
  emberEdge: 'rgba(255, 157, 92, 0.22)',

  /**
   * A hotter ember, used only for specks drifting over a lit surface. The
   * standard `ember` is tuned to read on the app's near-black; on the warm
   * header of a promoted card it disappears into the background it came from.
   */
  emberBright: '#ffb782',

  /** Darker than `bg`: the night closing over Tonight as the wick burns down. */
  nightVeil: '#0d0a07',

  danger: '#ff5c47',
};

/**
 * The two ember tints as components, because a glow is drawn as a stack of
 * layers that each need their own alpha. See `components/Glow.tsx`.
 */
export const EMBER_RGB = [255, 157, 92] as const;
export const EMBER_DEEP_RGB = [232, 112, 58] as const;

/**
 * Screen grounds. A single flat fill reads like a dark rectangle; a slow warm
 * gradient reads like a room lit from one side.
 *
 * These stay deliberately dark. The reference apps this borrows from run bright
 * mid-tone gradients because they're used in daylight — this one is opened in
 * bed with the lights off, where the same values would be a flashlight.
 */
export const gradients = {
  /** Default screen ground: a faint warm lift at the top. */
  screen: ['#1d1610', '#14100c'] as const,
  /** Session screens — a touch more ember, still far below reading brightness. */
  session: ['#241a10', '#16110c'] as const,
  /**
   * Tonight, while the wick burns. Session warmth with the falloff pulled up to
   * `WICK_FALLOFF`: the flame shrinks *down* the screen through the evening, and
   * a gradient that ran the full height would go darkest exactly where it ends up.
   */
  wick: ['#241a10', '#14100c'] as const,
};

/** Where `gradients.wick` reaches its dark end. Flat from there down. */
export const WICK_FALLOFF = [0, 0.55] as const;

/** Shared spacing scale so screens stop inventing their own margins. */
export const space = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 8,
  md: 14,
  lg: 20,
  /** Cards big enough that `lg` starts to look like a square. */
  xl: 22,
  xxl: 26,
  pill: 999,
};

/** Type scale. `display` is for hero numerals (timers, clock times). */
export const type = {
  display: { fontSize: 56, fontWeight: '300' as const },
  title: { fontSize: 30, fontWeight: '700' as const },
  heading: { fontSize: 20, fontWeight: '700' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  label: { fontSize: 13, fontWeight: '600' as const },
};
