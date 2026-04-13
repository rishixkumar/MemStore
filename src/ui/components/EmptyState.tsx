import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { THEME } from '../theme';

type EmptyStateProps = {
  title: string;
  description: string;
  actionLabel?: string;
  onActionPress?: () => void;
};

export default function EmptyState({
  title,
  description,
  actionLabel,
  onActionPress,
}: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {actionLabel && onActionPress ? (
        <TouchableOpacity style={styles.button} onPress={onActionPress}>
          <Text style={styles.buttonText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: THEME.spacing.xxxl,
    paddingTop: THEME.spacing.xxxl,
  },
  title: {
    color: THEME.colors.text.primary,
    fontSize: THEME.font.sizes.xl,
    fontWeight: THEME.font.weights.semibold,
    marginBottom: THEME.spacing.sm,
  },
  description: {
    color: THEME.colors.text.secondary,
    fontSize: THEME.font.sizes.md,
    lineHeight: 22,
    textAlign: 'center',
  },
  button: {
    marginTop: THEME.spacing.xl,
    backgroundColor: THEME.colors.brand.primary,
    borderRadius: THEME.radius.md,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  buttonText: {
    color: THEME.colors.text.primary,
    fontSize: THEME.font.sizes.md,
    fontWeight: THEME.font.weights.semibold,
  },
});
