import React from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme';

export default function DigestSkeleton({ opacity }: { opacity: Animated.Value }) {
  const { theme } = useTheme();

  return (
    <Animated.View style={[styles.wrap, { opacity }]}>
      <View style={[styles.line, { width: '90%', backgroundColor: theme.colors.bg.overlay }]} />
      <View style={[styles.line, { width: '75%', backgroundColor: theme.colors.bg.overlay }]} />
      <View
        style={[styles.line, styles.shortLine, { width: '45%', backgroundColor: theme.colors.bg.overlay }]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 12,
    minHeight: 104,
    justifyContent: 'center',
  },
  line: {
    height: 14,
    borderRadius: 999,
  },
  shortLine: {
    height: 10,
  },
});
