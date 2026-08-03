import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import Candle from '../components/Candle';
import { BADGES } from '../achievements';
import { WAX, VESSELS, type Vessel } from '../candles';
import { theme, space } from '../theme';

/**
 * Every candle, at every state worth judging. Preview-only — nothing in the app
 * imports this.
 *
 *   http://localhost:8081/?preview=candles
 *   npm run shoot -- candles
 *
 * The badge grid can only ever show you one fill per candle, and which one
 * depends on how the fixture's log happens to score. Design work needs the
 * opposite: the same thirteen objects side by side at a shared fill, and one
 * object walked through its whole range. Both are here.
 */

/** The states a candle is actually seen in, in the order they happen. */
const FILLS = [0, 0.25, 0.6, 0.9, 1];

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.shelf}>{children}</View>
    </View>
  );
}

export default function CandleSheet() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>The case</Text>
      {FILLS.map((fill) => (
        <Row key={fill} label={fill === 1 ? 'earned — lit' : `${Math.round(fill * 100)}%`}>
          {BADGES.map((badge) => (
            <Candle
              key={badge.id}
              vessel={badge.vessel}
              wax={WAX[badge.wax]}
              fill={fill}
              lit={fill >= 1}
              />
          ))}
        </Row>
      ))}

      <Text style={styles.heading}>Every vessel, one wax</Text>
      {/* Shape isolated from colour. Two silhouettes that only look distinct
          because their wax differs are two versions of the same candle, and
          this is the row that catches it. */}
      <Row label="unlit">
        {(Object.keys(VESSELS) as Vessel[]).map((vessel) => (
          <Candle key={vessel} vessel={vessel} wax={WAX.honey} fill={0.65} />
        ))}
      </Row>
      <Row label="lit">
        {(Object.keys(VESSELS) as Vessel[]).map((vessel) => (
          <Candle key={vessel} vessel={vessel} wax={WAX.honey} fill={1} lit />
        ))}
      </Row>

      <Text style={styles.heading}>Every wax, one vessel</Text>
      <Row label="pillar">
        {(Object.keys(WAX) as (keyof typeof WAX)[]).map((name) => (
          <Candle key={name} vessel="pillar" wax={WAX[name]} fill={0.8} />
        ))}
      </Row>

      <Text style={styles.heading}>At size</Text>
      {/* The grid draws these at 1. Anything smaller is a guess until it's
          looked at — a wick two points tall stops being a wick. */}
      <Row label="0.7 / 1 / 1.6">
        <Candle vessel="jar" wax={WAX.terracotta} fill={1} lit size={0.7} />
        <Candle vessel="jar" wax={WAX.terracotta} fill={1} lit size={1} />
        <Candle vessel="jar" wax={WAX.terracotta} fill={1} lit size={1.6} />
      </Row>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  content: { padding: space.md, paddingBottom: space.xxl },
  heading: {
    color: theme.text,
    fontSize: 16,
    fontWeight: '700',
    marginTop: space.lg,
    marginBottom: space.sm,
  },
  row: { marginBottom: space.md },
  label: { color: theme.textFaint, fontSize: 11, fontWeight: '600', marginBottom: space.xs },
  shelf: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    gap: space.sm,
    // A ground line, so the candles are standing on something rather than
    // floating in a row — which is how they read in a tile with text under them.
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.cardBorder,
    paddingBottom: space.xs,
  },
});
