import React from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { THEME } from '../../theme';

export default function DigestSkeleton({ opacity }: { opacity: Animated.Value }) {
  return (
    <Animated.View style={[styles.wrap, { opacity }]}>
      <View style={[styles.line, { width: '90%' }]} />
      <View style={[styles.line, { width: '75%' }]} />
      <View style={[styles.line, styles.shortLine, { width: '45%' }]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: THEME.spacing.md,
    minHeight: 104,
    justifyContent: 'center',
  },
  line: {
    height: 14,
    borderRadius: THEME.radius.full,
    backgroundColor: THEME.colors.bg.overlay,
  },
  shortLine: {
    height: 10,
  },
});
