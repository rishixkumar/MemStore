import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LlmProvider } from '../../../intelligence/digestService';
import { useTheme } from '../../theme';

export default function ProviderBadge({ provider }: { provider: LlmProvider }) {
  const { theme } = useTheme();

  const palette =
    provider === 'gemini'
      ? {
          backgroundColor: theme.colors.provider.geminiBg,
          color: theme.colors.accent.teal,
          label: 'Gemini',
        }
      : provider === 'ollama'
        ? {
            backgroundColor: theme.colors.provider.ollamaBg,
            color: theme.colors.brand.primary,
            label: 'Ollama',
          }
        : {
            backgroundColor: theme.colors.bg.overlay,
            color: theme.colors.text.tertiary,
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
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  text: {
    fontSize: 9,
    fontWeight: '500',
  },
});
