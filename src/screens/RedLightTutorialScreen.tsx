import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Screen from '../components/Screen';
import { theme, space, radius } from '../theme';
import type { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'RedLightTutorial'>;

export default function RedLightTutorialScreen({ navigation }: Props) {
  return (
    <Screen title="Red light" action={{ label: 'Close', onPress: () => navigation.goBack() }} scroll>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Why this app doesn't glow red</Text>
        <Text style={styles.cardBody}>
          A phone screen painted red still shines full brightness through a thin panel — it doesn't dim
          the room, and it can still suppress melatonin and strain your eyes. A real red bulb changes the
          actual light in the room, which is what your body responds to.
        </Text>
      </View>

      <View style={[styles.card, styles.emphasisCard]}>
        <Text style={styles.cardTitle}>Use a real red light</Text>
        <Text style={styles.cardBody}>
          About an hour before bed, switch your lamp to a red bulb (or a warm salt-lamp style light)
          instead of overhead white light. This is the single biggest thing you can do — everything else
          here is a backup for when you still need to use your phone.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Warm up your phone screen</Text>
        <Text style={styles.cardBody}>
          Your phone has a built-in warm-screen mode that this app can't turn on for you — you'll need to
          enable it in system settings.
        </Text>

        <Text style={styles.platformLabel}>
          {Platform.OS === 'ios' ? '▸ ON THIS IPHONE' : 'ON IPHONE'}
        </Text>
        <Text style={styles.step}>1. Settings → Display & Brightness → Night Shift</Text>
        <Text style={styles.step}>2. Turn on "Scheduled" and drag the colour slider warmer</Text>
        <Text style={styles.step}>
          3. Or open Control Center, press and hold the brightness slider, then tap Night Shift
        </Text>

        <Text style={styles.platformLabel}>
          {Platform.OS === 'android' ? '▸ ON THIS ANDROID' : 'ON ANDROID'}
        </Text>
        <Text style={styles.step}>1. Settings → Display → Night Light</Text>
        <Text style={styles.step}>2. Turn it on and drag the intensity slider warmer</Text>
        <Text style={styles.step}>3. Or swipe down twice for Quick Settings and tap the Night Light tile</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.card,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.cardBorder,
    padding: space.lg,
    marginBottom: space.md,
  },
  emphasisCard: {
    borderColor: theme.emberDeep,
    backgroundColor: theme.emberGlow,
  },
  cardTitle: {
    color: theme.text,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: space.sm + 2,
  },
  cardBody: {
    color: theme.textDim,
    fontSize: 15,
    lineHeight: 21,
  },
  platformLabel: {
    color: theme.ember,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginTop: space.md + 2,
    marginBottom: space.xs + 2,
  },
  step: {
    color: theme.textDim,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: space.xs + 1,
  },
});
