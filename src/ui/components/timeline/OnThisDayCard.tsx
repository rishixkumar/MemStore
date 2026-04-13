import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Memory } from '../../../models/Memory';
import { useTheme } from '../../theme';
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
  const { theme } = useTheme();

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.accent.amberSoft,
          borderColor: theme.colors.border.subtle,
          borderLeftColor: theme.colors.accent.amber,
        },
      ]}
      activeOpacity={0.9}
      onPress={onPress}
    >
      <Text style={[styles.label, { color: theme.colors.accent.amber }]}>{label}</Text>
      <Text style={[styles.place, { color: theme.colors.text.primary }]}>{memories[0].placeName}</Text>
      <Text style={[styles.date, { color: theme.colors.text.secondary }]}>
        {format(new Date(memories[0].timestamp), 'MMM d, yyyy')}
      </Text>
      <Text style={[styles.caption, { color: theme.colors.text.primary }]}>{caption}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 24,
    marginBottom: 16,
    borderRadius: 16,
    borderWidth: 0.5,
    borderLeftWidth: 2.5,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    marginBottom: 8,
  },
  place: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 4,
  },
  date: {
    fontSize: 12,
    marginBottom: 8,
  },
  caption: {
    fontSize: 14,
    lineHeight: 20,
  },
});
