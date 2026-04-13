import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LlmProvider } from '../../../intelligence/digestService';
import { THEME } from '../../theme';

export default function ProviderBadge({ provider }: { provider: LlmProvider }) {
  const palette =
    provider === 'gemini'
      ? {
          backgroundColor: THEME.colors.provider.geminiBg,
          color: THEME.colors.accent.teal,
          label: 'Gemini',
        }
      : provider === 'ollama'
        ? {
            backgroundColor: THEME.colors.provider.ollamaBg,
            color: THEME.colors.brand.primary,
            label: 'Ollama',
          }
        : {
            backgroundColor: THEME.colors.bg.overlay,
            color: THEME.colors.text.tertiary,
            label: 'Offline',
          };

  return (
    <View style={[styles.badge, { backgroundColor: palette.backgroundColor }]}>
      <Text style={[styles.text, { color: palette.color }]}>{palette.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: THEME.radius.full,
    paddingHorizontal: THEME.spacing.sm,
    paddingVertical: 3,
  },
  text: {
    fontSize: 9,
    fontWeight: THEME.font.weights.medium,
  },
});
