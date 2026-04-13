import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Memory } from '../../../models/Memory';
import { THEME } from '../../theme';
import { format } from 'date-fns';

type OnThisDayCardProps = {
  label: string;
  memories: Memory[];
  caption: string;
  onPress: () => void;
};

export default function OnThisDayCard({
  label,
  memories,
  caption,
  onPress,
}: OnThisDayCardProps) {
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.9} onPress={onPress}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.place}>{memories[0].placeName}</Text>
      <Text style={styles.date}>{format(new Date(memories[0].timestamp), 'MMM d, yyyy')}</Text>
      <Text style={styles.caption}>{caption}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: THEME.spacing.xl,
    marginBottom: THEME.spacing.lg,
    backgroundColor: THEME.colors.accent.amberSoft,
    borderRadius: THEME.radius.lg,
    borderWidth: 0.5,
    borderColor: THEME.colors.border.subtle,
    borderLeftWidth: 2.5,
    borderLeftColor: THEME.colors.accent.amber,
    paddingHorizontal: THEME.spacing.lg,
    paddingVertical: THEME.spacing.lg,
  },
  label: {
    color: THEME.colors.accent.amber,
    fontSize: THEME.font.sizes.xs,
    fontWeight: THEME.font.weights.semibold,
    letterSpacing: 2,
    marginBottom: THEME.spacing.sm,
  },
  place: {
    color: THEME.colors.text.primary,
    fontSize: 15,
    fontWeight: THEME.font.weights.medium,
    marginBottom: THEME.spacing.xs,
  },
  date: {
    color: THEME.colors.text.secondary,
    fontSize: THEME.font.sizes.sm,
    marginBottom: THEME.spacing.sm,
  },
  caption: {
    color: THEME.colors.text.primary,
    fontSize: THEME.font.sizes.md,
    lineHeight: 20,
  },
});
