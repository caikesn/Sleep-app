import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { theme, space, radius } from '../theme';

const ICONS: Record<string, string> = {
  Tonight: '🌙',
  Modules: '🧘',
  You: '☾',
};

/**
 * Hand-rolled rather than the stock react-navigation bar so the ember accent
 * and warm surfaces carry through — the default bar fights the palette.
 */
export default function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, space.sm) }]}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label = options.title ?? route.name;
        const isFocused = state.index === index;

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
            <View style={[styles.iconWrap, isFocused && styles.iconWrapActive]}>
              <Text style={[styles.icon, !isFocused && styles.iconInactive]}>
                {ICONS[route.name] ?? '•'}
              </Text>
            </View>
            <Text style={[styles.label, isFocused && styles.labelActive]}>{label}</Text>
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
    borderRadius: radius.pill,
    marginBottom: 2,
  },
  iconWrapActive: {
    backgroundColor: theme.emberGlow,
  },
  icon: {
    fontSize: 18,
  },
  iconInactive: {
    opacity: 0.45,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.textFaint,
  },
  labelActive: {
    color: theme.ember,
  },
});
