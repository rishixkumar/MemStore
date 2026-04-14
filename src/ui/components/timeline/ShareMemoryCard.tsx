import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { Memory } from '../../../models/Memory';
import { THEMES } from '../../theme';
import { formatMemoryDateTime } from '../../../utils/date';

const DARK = THEMES.dark.colors;
const CARD_W = 390;
const CARD_H = 520;

function AmbientMark() {
  return (
    <View style={styles.markRow}>
      <View style={[styles.dot, { backgroundColor: DARK.brand.primary }]} />
      <Text style={[styles.appName, { color: DARK.text.secondary }]}>Ambient Memory</Text>
    </View>
  );
}

function GrainOverlay() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <View
          key={i}
          style={[
            styles.grainStripe,
            {
              left: -80 + i * 64,
              opacity: 0.04 + (i % 3) * 0.015,
              backgroundColor: DARK.text.primary,
            },
          ]}
        />
      ))}
    </View>
  );
}

function CardOrnament() {
  return (
    <View style={styles.ornamentWrap} pointerEvents="none">
      <Svg width={220} height={160} viewBox="0 0 220 160">
        <Defs>
          <LinearGradient id="ornGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={DARK.brand.primary} stopOpacity="0.45" />
            <Stop offset="100%" stopColor={DARK.accent.teal} stopOpacity="0.2" />
          </LinearGradient>
        </Defs>
        <Path
          d="M180 140 C 120 130, 60 100, 40 50 C 28 24, 52 8, 78 18 C 104 28, 118 58, 108 88 C 98 118, 68 132, 38 124"
          stroke="url(#ornGrad)"
          strokeWidth={1.2}
          fill="none"
          strokeLinecap="round"
        />
        <Circle cx={168} cy={128} r={3} fill={DARK.brand.primary} opacity={0.5} />
        <Circle cx={142} cy={112} r={2} fill={DARK.accent.teal} opacity={0.35} />
      </Svg>
    </View>
  );
}

export default function ShareMemoryCard({
  memory,
  caption,
}: {
  memory: Memory;
  caption: string;
}) {
  const trimmedCaption = caption.trim();
  const showCaption = trimmedCaption.length > 0;

  return (
    <View style={styles.root}>
      <View style={[styles.card, { backgroundColor: '#0B0B0F', borderColor: 'rgba(255,255,255,0.06)' }]}>
        <View style={[styles.glowBlob, { backgroundColor: DARK.brand.primary }]} />
        <View style={[styles.glowBlobSecondary, { backgroundColor: DARK.accent.teal }]} />
        <GrainOverlay />
        <CardOrnament />

        <View style={styles.inner}>
          <AmbientMark />

          <View style={styles.placeBlock}>
            <Text style={[styles.placeName, { color: DARK.text.primary }]} numberOfLines={2}>
              {memory.placeName}
            </Text>
          </View>

          {showCaption ? (
            <Text style={[styles.caption, { color: DARK.text.secondary }]} numberOfLines={4}>
              {trimmedCaption}
            </Text>
          ) : null}

          <Text style={[styles.when, { color: DARK.text.tertiary }]} numberOfLines={1}>
            {formatMemoryDateTime(memory.timestamp)}
          </Text>

          {memory.note ? (
            <Text style={[styles.note, { color: DARK.text.secondary }]} numberOfLines={2}>
              {memory.note}
            </Text>
          ) : null}

          <View style={styles.footer}>
            <Text style={[styles.tagline, { color: DARK.text.tertiary }]}>Remember everything.</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: CARD_W,
    height: CARD_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
  },
  glowBlob: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 200,
    opacity: 0.12,
    top: -120,
    right: -80,
  },
  glowBlobSecondary: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 120,
    opacity: 0.08,
    bottom: -60,
    left: -70,
  },
  grainStripe: {
    position: 'absolute',
    top: -40,
    bottom: -40,
    width: 1,
    transform: [{ rotate: '12deg' }],
  },
  ornamentWrap: {
    position: 'absolute',
    right: -24,
    bottom: 72,
    opacity: 0.9,
  },
  inner: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 26,
    paddingBottom: 22,
    justifyContent: 'flex-start',
  },
  markRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  appName: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  placeBlock: {
    marginTop: 36,
    minHeight: 88,
    justifyContent: 'center',
  },
  placeName: {
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 38,
    letterSpacing: -0.5,
  },
  caption: {
    marginTop: 18,
    fontSize: 15,
    lineHeight: 24,
    fontWeight: '400',
  },
  when: {
    marginTop: 16,
    fontSize: 12,
    letterSpacing: 0.3,
  },
  note: {
    marginTop: 14,
    fontSize: 13,
    lineHeight: 20,
    fontStyle: 'italic',
    opacity: 0.92,
  },
  footer: {
    marginTop: 'auto',
    paddingTop: 20,
  },
  tagline: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
});

