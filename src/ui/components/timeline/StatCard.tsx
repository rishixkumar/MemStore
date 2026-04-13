import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme';

type StatCardProps = {
  label: string;
  value: number;
  suffix: string;
  accentColor: string;
};

export default function StatCard({ label, value, suffix, accentColor }: StatCardProps) {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.colors.bg.elevated, borderColor: theme.colors.border.subtle },
      ]}
    >
      <Text style={[styles.label, { color: theme.colors.text.tertiary }]}>{label}</Text>
      <Text style={[styles.value, { color: accentColor }]}>{value}</Text>
      <Text style={[styles.suffix, { color: theme.colors.text.tertiary }]}>{suffix}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 100,
    height: 120,
    borderRadius: 12,
    borderWidth: 0.5,
    paddingHorizontal: 16,
    paddingVertical: 16,
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 9,
    letterSpacing: 1,
    fontWeight: '600',
  },
  value: {
    fontSize: 28,
    fontWeight: '700',
  },
  suffix: {
    fontSize: 12,
  },
});
