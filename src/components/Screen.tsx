import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, StyleProp, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { theme, space, type, gradients } from '../theme';

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
};

/**
 * Every screen's outer shell: warm background, safe-area top inset and an
 * optional header. Keeps padding and header treatment identical everywhere.
 */
export default function Screen({ children, title, action, scroll, style, footer }: Props) {
  const insets = useSafeAreaInsets();
  const Body = scroll ? ScrollView : View;

  return (
    <LinearGradient
      colors={gradients.screen}
      style={[styles.root, { paddingTop: insets.top + space.md }, style]}
    >
      {(title || action) && (
        <View style={styles.header}>
          {title ? <Text style={styles.title}>{title}</Text> : <View />}
          {action && (
            <Pressable onPress={action.onPress} style={styles.action} hitSlop={8}>
              <Text style={styles.actionText}>{action.label}</Text>
            </Pressable>
          )}
        </View>
      )}
      <Body
        style={scroll ? undefined : styles.body}
        contentContainerStyle={scroll ? styles.scrollBody : undefined}
      >
        {children}
      </Body>
      {footer && <View style={styles.footer}>{footer}</View>}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: {
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
