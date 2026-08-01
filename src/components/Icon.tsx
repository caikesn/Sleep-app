import React from 'react';
import Feather from '@expo/vector-icons/Feather';
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
} as const;

export type IconName = keyof typeof GLYPHS;

type Props = {
  name: IconName;
  size?: number;
  color?: string;
};

export default function Icon({ name, size = 20, color = theme.text }: Props) {
  return <Feather name={GLYPHS[name]} size={size} color={color} />;
}
