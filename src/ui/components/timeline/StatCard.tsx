import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { THEME } from '../../theme';

type StatCardProps = {
  label: string;
  value: number;
  suffix: string;
  accentColor: string;
};

export default function StatCard({ label, value, suffix, accentColor }: StatCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color: accentColor }]}>{value}</Text>
      <Text style={styles.suffix}>{suffix}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 100,
    height: 120,
    backgroundColor: THEME.colors.bg.elevated,
    borderRadius: THEME.radius.md,
    borderWidth: 0.5,
    borderColor: THEME.colors.border.subtle,
    paddingHorizontal: THEME.spacing.lg,
    paddingVertical: THEME.spacing.lg,
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 9,
    letterSpacing: 1,
    color: THEME.colors.text.tertiary,
    fontWeight: THEME.font.weights.semibold,
  },
  value: {
    fontSize: 28,
    fontWeight: THEME.font.weights.bold,
  },
  suffix: {
    fontSize: THEME.font.sizes.sm,
    color: THEME.colors.text.tertiary,
  },
});
