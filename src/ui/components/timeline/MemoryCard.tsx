import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Memory } from '../../../models/Memory';
import { NoteIcon, VoiceIcon } from '../Icons';
import { THEME } from '../../theme';
import { formatMemoryDateTime } from '../../../utils/date';

function ManualTag({ memory }: { memory: Memory }) {
  if (memory.placeType !== 'manual') {
    return null;
  }

  return (
    <View style={styles.manualTag}>
      <Text style={styles.manualTagText}>note</Text>
    </View>
  );
}

export default function MemoryCard({
  memory,
  accentColor,
  onPress,
}: {
  memory: Memory;
  accentColor: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onPress}
      style={[styles.card, { borderLeftColor: accentColor }]}
    >
      <View style={styles.cardTopRow}>
        <View style={styles.cardTitleWrap}>
          {memory.memoryKind === 'note' ? (
            <NoteIcon color={THEME.colors.text.secondary} size={16} />
          ) : null}
          {memory.memoryKind === 'voice' ? (
            <VoiceIcon color={THEME.colors.text.secondary} size={16} />
          ) : null}
          <Text style={styles.placeName} numberOfLines={2}>
            {memory.placeName}
          </Text>
        </View>
        <ManualTag memory={memory} />
      </View>
      <Text style={styles.timestamp}>{formatMemoryDateTime(memory.timestamp)}</Text>
      {memory.note ? (
        <View style={styles.noteBlock}>
          <Text style={styles.noteText}>{memory.note}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: THEME.colors.bg.surface,
    borderRadius: THEME.radius.md,
    borderWidth: 0.5,
    borderColor: THEME.colors.border.subtle,
    borderLeftWidth: 2.5,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginHorizontal: THEME.spacing.xl,
    marginBottom: 2,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: THEME.spacing.sm,
  },
  cardTitleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.sm,
  },
  placeName: {
    flex: 1,
    color: THEME.colors.text.primary,
    fontSize: 15,
    fontWeight: THEME.font.weights.medium,
  },
  timestamp: {
    marginTop: THEME.spacing.xs,
    color: THEME.colors.text.tertiary,
    fontSize: 11,
  },
  noteBlock: {
    borderTopWidth: 0.5,
    borderTopColor: THEME.colors.border.subtle,
    paddingTop: 10,
    marginTop: 10,
  },
  noteText: {
    color: THEME.colors.text.secondary,
    fontSize: 13,
    lineHeight: 19,
  },
  manualTag: {
    backgroundColor: THEME.colors.brand.soft,
    borderRadius: THEME.radius.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  manualTagText: {
    color: THEME.colors.brand.primary,
    fontSize: 9,
    fontWeight: THEME.font.weights.semibold,
    letterSpacing: 0.5,
  },
});
