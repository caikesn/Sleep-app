import React from 'react';
import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';
import { theme } from '../theme';

/**
 * Every icon in the app goes through this map.
 *
 * Screens name the *concept*, not the glyph, so swapping icon sets later (or
 * dropping in custom ember artwork) is a change to this file alone. Feather is
 * the current set: single-weight monochrome line icons that take a tint, which
 * is what keeps the no-blue rule intact — emoji are drawn by the platform's own
 * font, so they were multicolour and looked different on every device.
 */
const GLYPHS = {
  tonight: 'moon',
  modules: 'grid',
  you: 'user',
  stretches: 'activity',
  reading: 'book-open',
  chevron: 'chevron-right',
  check: 'check',
  clock: 'clock',
  bell: 'bell',
  settings: 'settings',

  // Routine builder. Reordering is two arrows rather than a drag handle: a
  // handle promises a gesture this list doesn't implement, and arrows are the
  // only version of this that a screen reader can drive.
  routines: 'list',
  plus: 'plus',
  up: 'chevron-up',
  down: 'chevron-down',
  close: 'x',
  trash: 'trash-2',

  // Achievements. Streaks get an upward line rather than the usual flame —
  // there isn't one in this set, and a flame would be the only warm-coloured
  // pictogram in an interface that gets its warmth from the tint instead.
  award: 'award',
  star: 'star',
  streak: 'trending-up',
  layers: 'layers',
  sunset: 'sunset',

  // Stretches. These describe the *movement* — a direction, a rotation, a
  // repetition — rather than trying to depict a pose, which no line-icon set
  // can do honestly.
  breathe: 'wind',
  rotate: 'rotate-cw',
  twist: 'rotate-ccw',
  arch: 'repeat',
  fold: 'chevrons-down',
  reach: 'corner-right-down',
  cross: 'crosshair',
  elevate: 'corner-right-up',
  tilt: 'corner-left-down',
  open: 'maximize-2',
  draw: 'minimize-2',
  lift: 'chevrons-up',
  rest: 'moon',
} as const;

export type IconName = keyof typeof GLYPHS;

/**
 * The few concepts that can also be drawn solid, for showing which page you are
 * on. Feather is single-weight line art with no filled variants anywhere in the
 * set, so these come from Ionicons — and so does the hollow state, because a
 * Feather outline swapping to an Ionicons solid would change the *shape* under
 * your thumb as well as the fill, which reads as the icon being replaced rather
 * than lit.
 *
 * That is why the opt-in is passing `filled` at all, rather than passing `true`:
 * omit it and you get the Feather glyph above, as every other screen does. Only
 * pass it where both states sit together and no Feather icon is beside them —
 * Ionicons outlines are the thinner of the two and would look washed out in a
 * row of Feather ones.
 */
const SOLID: Partial<Record<IconName, readonly [hollow: string, solid: string]>> = {
  tonight: ['moon-outline', 'moon'],
  modules: ['grid-outline', 'grid'],
  you: ['person-outline', 'person'],
};

type Props = {
  name: IconName;
  size?: number;
  color?: string;
  /** Draw the solid form. Omit entirely to keep the usual line icon. */
  filled?: boolean;
};

export default function Icon({ name, size = 20, color = theme.text, filled }: Props) {
  const pair = SOLID[name];
  if (pair && filled !== undefined) {
    return <Ionicons name={pair[filled ? 1 : 0] as any} size={size} color={color} />;
  }
  return <Feather name={GLYPHS[name]} size={size} color={color} />;
}
