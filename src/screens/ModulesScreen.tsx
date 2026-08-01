import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { CompositeNavigationProp } from '@react-navigation/native';
import Screen from '../components/Screen';
import { theme, space, radius } from '../theme';
import type { ModulesStackParamList, RootStackParamList } from '../navigation';

type Nav = CompositeNavigationProp<
  NativeStackNavigationProp<ModulesStackParamList>,
  NativeStackNavigationProp<RootStackParamList>
>;

export default function ModulesScreen() {
  const navigation = useNavigation<Nav>();

  return (
    <Screen title="Modules">
      <Text style={styles.subtitle}>Pick something to wind down with.</Text>

      <Pressable style={styles.card} onPress={() => navigation.navigate('StretchLibrary')}>
        <Text style={styles.cardEmoji}>🧘</Text>
        <View style={styles.cardText}>
          <Text style={styles.cardTitle}>Yoga & Stretches</Text>
          <Text style={styles.cardBody}>Start one stretch, or pick several to run as a sequence.</Text>
        </View>
        <Text style={styles.chevron}>→</Text>
      </Pressable>

      <Pressable style={styles.card} onPress={() => navigation.navigate('Meditation')}>
        <Text style={styles.cardEmoji}>📖</Text>
        <View style={styles.cardText}>
          <Text style={styles.cardTitle}>Reading & Meditation</Text>
          <Text style={styles.cardBody}>A timed session with a Do Not Disturb reminder.</Text>
        </View>
        <Text style={styles.chevron}>→</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    color: theme.textDim,
    fontSize: 15,
    marginBottom: space.lg,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.card,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.cardBorder,
    padding: space.lg,
    marginBottom: space.md,
  },
  cardEmoji: {
    fontSize: 32,
    marginRight: space.md,
  },
  cardText: {
    flex: 1,
  },
  cardTitle: {
    color: theme.text,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 3,
  },
  cardBody: {
    color: theme.textDim,
    fontSize: 13,
    lineHeight: 18,
  },
  chevron: {
    color: theme.ember,
    fontSize: 18,
    marginLeft: space.sm,
  },
});
