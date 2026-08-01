import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { CompositeNavigationProp } from '@react-navigation/native';
import Screen from '../components/Screen';
import Icon from '../components/Icon';
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
        <View style={styles.cardIcon}>
          <Icon name="stretches" size={22} color={theme.ember} />
        </View>
        <View style={styles.cardText}>
          <Text style={styles.cardTitle}>Yoga & Stretches</Text>
          <Text style={styles.cardBody}>Start one stretch, or pick several to run as a sequence.</Text>
        </View>
        <Icon name="chevron" size={18} color={theme.ember} />
      </Pressable>

      <Pressable style={styles.card} onPress={() => navigation.navigate('Meditation')}>
        <View style={styles.cardIcon}>
          <Icon name="reading" size={22} color={theme.ember} />
        </View>
        <View style={styles.cardText}>
          <Text style={styles.cardTitle}>Reading & Meditation</Text>
          <Text style={styles.cardBody}>A timed session with a Do Not Disturb reminder.</Text>
        </View>
        <Icon name="chevron" size={18} color={theme.ember} />
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
    backgroundColor: theme.emberVeil,
    borderRadius: radius.lg + 6,
    borderWidth: 1,
    borderColor: theme.emberEdge,
    padding: space.lg,
    marginBottom: space.md,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: theme.emberGlow,
    alignItems: 'center',
    justifyContent: 'center',
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
