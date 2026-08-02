import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Animated,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { theme, space, type, gradients } from '../theme';
import { duration, easing, ENTER_RISE } from '../motion';

type Props = {
  children: React.ReactNode;
  title?: string;
  /** Renders a text action in the header, e.g. Close / End. */
  action?: { label: string; onPress: () => void };
  scroll?: boolean;
  /** Screens that fill edge-to-edge (timers) opt out of the horizontal padding. */
  style?: StyleProp<ViewStyle>;
  /** Pinned to the bottom, outside the scroll area — for a primary CTA. */
  footer?: React.ReactNode;
  /** Overrides the screen ground. Defaults to `gradients.screen`. */
  ground?: readonly [string, string, ...string[]];
  /** Where each `ground` colour lands, 0–1. */
  groundStops?: readonly [number, number, ...number[]];
  /**
   * Full-bleed decoration drawn between the ground and the content — glows,
   * veils, drifting embers. Ignores the horizontal padding, never takes a
   * touch, and deliberately sits outside the entrance animation with the
   * gradient, so moving between tabs reads as the light staying on.
   */
  background?: React.ReactNode;
};

/**
 * Every screen's outer shell: warm background, safe-area top inset and an
 * optional header. Keeps padding and header treatment identical everywhere.
 */
export default function Screen({
  children,
  title,
  action,
  scroll,
  style,
  footer,
  ground = gradients.screen,
  groundStops,
  background,
}: Props) {
  const insets = useSafeAreaInsets();
  const Body = scroll ? ScrollView : View;

  /**
   * Content fades up as the screen mounts. It is one animation defined once,
   * which is the reason it lives here rather than in each screen: the gradient
   * ground stays put and only what sits on it arrives, so moving between tabs
   * reads as the light staying on while the contents change.
   *
   * The gradient is deliberately outside it. Fading the background too would
   * flash the app's near-black against whatever is behind it on every mount.
   */
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: duration.enter,
      easing: easing.settle,
      useNativeDriver: true,
    }).start();
  }, [enter]);

  const arriving = {
    opacity: enter,
    transform: [
      { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [ENTER_RISE, 0] }) },
    ],
  };

  return (
    <LinearGradient colors={ground} locations={groundStops} style={styles.root}>
      {/* Outside the padded column, so a glow can run to the screen edge — and
          the safe-area inset lives on `content`, not here, which keeps
          absolutely positioned decoration measured from the true top edge
          rather than from wherever the notch happens to end. */}
      {background && (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {background}
        </View>
      )}
      <View style={[styles.content, { paddingTop: insets.top + space.md }, style]}>
        {(title || action) && (
          <Animated.View style={[styles.header, arriving]}>
            {title ? <Text style={styles.title}>{title}</Text> : <View />}
            {action && (
              <Pressable onPress={action.onPress} style={styles.action} hitSlop={8}>
                <Text style={styles.actionText}>{action.label}</Text>
              </Pressable>
            )}
          </Animated.View>
        )}
        <Animated.View style={[styles.fill, arriving]}>
          <Body
            style={scroll ? undefined : styles.body}
            contentContainerStyle={scroll ? styles.scrollBody : undefined}
          >
            {children}
          </Body>
        </Animated.View>
        {footer && <Animated.View style={[styles.footer, arriving]}>{footer}</Animated.View>}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  /**
   * The wrapper the body's entrance animation is applied to. It has to carry
   * `flex: 1` itself — an Animated.View inserted between the gradient and a
   * scrolling body would otherwise collapse to its content height and the
   * screen would stop scrolling.
   */
  fill: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    marginBottom: space.md,
  },
  title: {
    ...type.title,
    color: theme.text,
  },
  action: {
    padding: space.sm,
  },
  actionText: {
    color: theme.ember,
    fontSize: 15,
    fontWeight: '600',
  },
  body: {
    flex: 1,
    paddingHorizontal: space.lg,
  },
  scrollBody: {
    paddingHorizontal: space.lg,
    paddingBottom: space.xl,
  },
  footer: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.md,
  },
});
