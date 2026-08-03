import React from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { MaterialTopTabBarProps } from '@react-navigation/material-top-tabs';
import { theme, space, radius } from '../theme';
import Icon, { IconName } from './Icon';

const ICONS: Record<string, IconName> = {
  Tonight: 'tonight',
  Modules: 'modules',
  You: 'you',
};

const ICON_SIZE = 19;

/**
 * Hand-rolled rather than the stock bar so the ember accent and warm surfaces
 * carry through — the default bar fights the palette.
 *
 * Everything here hangs off `position`, the pager's offset in tabs, rather than
 * off `state.index`. The difference only shows when you swipe: index is a step
 * that lands when you let go, so a bar driven by it would sit inert under your
 * thumb and then snap. Position is continuous, so the pill, the tint and the
 * fill all cross the gap with the page.
 *
 * Which means the states are *drawn twice and dissolved*, not swapped. A solid
 * glyph and a hollow one are different artwork and a tint is a colour, and
 * neither can be interpolated — but two stacked copies at opposite opacities
 * can, and opacity is the one thing the native driver can carry. `position`
 * comes off the pager natively, so a swipe animates this bar without waking
 * JavaScript at all.
 */
export default function TabBar({ state, descriptors, navigation, position }: MaterialTopTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, space.sm) }]}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label = options.title ?? route.name;
        const isFocused = state.index === index;

        /**
         * 1 when this tab holds the page, 0 when a neighbour does, and part-way
         * between while the pager is between the two. Clamped, so tabs further
         * off than one page stay at 0 rather than running negative.
         */
        const active = position.interpolate({
          inputRange: [index - 1, index, index + 1],
          outputRange: [0, 1, 0],
          extrapolate: 'clamp',
        });
        const inactive = Animated.subtract(1, active);

        function onPress() {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        }

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            style={styles.tab}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={label}
          >
            <View style={styles.iconWrap}>
              <Animated.View
                style={[styles.pill, StyleSheet.absoluteFill, { opacity: active }]}
              />
              <View style={styles.icon}>
                <Animated.View style={[StyleSheet.absoluteFill, { opacity: inactive }]}>
                  <Icon name={ICONS[route.name] ?? 'tonight'} size={ICON_SIZE} color={theme.textFaint} filled={false} />
                </Animated.View>
                <Animated.View style={[StyleSheet.absoluteFill, { opacity: active }]}>
                  <Icon name={ICONS[route.name] ?? 'tonight'} size={ICON_SIZE} color={theme.ember} filled />
                </Animated.View>
              </View>
            </View>

            {/* The dim copy is the one in flow, so the row's height is set by
                text that is always drawn and never by an opacity. */}
            <View>
              <Animated.Text style={[styles.label, { opacity: inactive }]}>{label}</Animated.Text>
              <Animated.Text style={[styles.label, styles.labelActive, { opacity: active }]}>
                {label}
              </Animated.Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: theme.bgRaised,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.cardBorder,
    paddingTop: space.sm,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: space.xs,
  },
  iconWrap: {
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    marginBottom: 2,
  },
  pill: {
    backgroundColor: theme.emberGlow,
    borderRadius: radius.pill,
  },
  icon: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.textFaint,
  },
  labelActive: {
    // Stacked on the dim copy rather than replacing it, so the two can dissolve
    // into each other as the pager moves.
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    color: theme.ember,
  },
});
