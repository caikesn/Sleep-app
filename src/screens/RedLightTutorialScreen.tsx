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
        <Text style={[styles.cardBody, styles.paragraph]}>
          An app can only paint its own screen. That doesn't dim the room, and a bright red screen held
          close to your face is still a bright light — so we'd be selling you the feeling of doing
          something about it rather than the thing itself.
        </Text>
        <Text style={styles.cardBody}>
          Your phone can do better than an app can: it has a system-wide red filter that covers every
          screen, and it's below. But the lamp beside you matters more than either.
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
        <Text style={styles.cardTitle}>Turn your whole screen red</Text>
        <Text style={styles.cardBody}>
          Hidden in accessibility settings is a proper red filter — far stronger than the warm modes
          below, because it takes out the blue and most of the green rather than just cooling them down.
          It takes a minute to set up once, and after that it's three presses of the side button.
        </Text>

        <Text style={styles.platformLabel}>
          {Platform.OS === 'ios' ? '▸ ON THIS IPHONE' : 'ON IPHONE'}
        </Text>
        <Text style={styles.step}>
          1. Settings → Accessibility → Display & Text Size → Colour Filters
        </Text>
        <Text style={styles.step}>2. Turn Colour Filters on, then pick "Colour Tint"</Text>
        <Text style={styles.step}>
          3. Drag Hue all the way to the red end, and Intensity most of the way up
        </Text>
        <Text style={styles.step}>
          4. Back in Accessibility, scroll to the very bottom → Accessibility Shortcut → tick Colour
          Filters
        </Text>
        <Text style={styles.step}>
          5. Now triple-press the side button to flip red on and off. On an iPhone with a Home button,
          triple-press that instead.
        </Text>

        <Text style={styles.platformLabel}>
          {Platform.OS === 'android' ? '▸ ON THIS ANDROID' : 'ON ANDROID'}
        </Text>
        <Text style={styles.step}>
          1. Samsung: Settings → Accessibility → Vision enhancements → Colour adjustment, then drag the
          wheel to red
        </Text>
        <Text style={styles.step}>
          2. On most other Androids the Colour correction setting only offers colour-blindness modes and
          greyscale, with no red — greyscale is still a real improvement at night
        </Text>
        <Text style={styles.step}>
          3. Android 12 and up also has "Extra dim", which goes darker than the brightness slider allows
        </Text>
        <Text style={styles.step}>
          4. Whichever you use, add it to the accessibility shortcut so it's one gesture away
        </Text>
        <Text style={styles.note}>
          Android varies a lot by manufacturer, so these paths may sit under slightly different names on
          your phone.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Or just warm the screen up</Text>
        <Text style={styles.cardBody}>
          Gentler than the red filter and easier to read by, if full red is too much. Neither one can be
          turned on by this app — they both live in system settings.
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
  /** Separates stacked paragraphs inside one card. */
  paragraph: {
    marginBottom: space.sm + 2,
  },
  /**
   * A caveat under a list of steps. Dimmer than the steps themselves, because
   * it qualifies them rather than adding one.
   */
  note: {
    color: theme.textFaint,
    fontSize: 13,
    lineHeight: 19,
    marginTop: space.sm,
  },
});
