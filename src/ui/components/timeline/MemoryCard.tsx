import * as Haptics from 'expo-haptics';
import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { getMemoryKind, Memory } from '../../../models/Memory';
import { NoteIcon, VoiceIcon } from '../Icons';
import { useTheme } from '../../theme';
import { formatMemoryDateTime } from '../../../utils/date';

function ManualTag({ memory }: { memory: Memory }) {
  const { theme } = useTheme();
  const memoryKind = getMemoryKind(memory);

  if (memoryKind !== 'note') {
    return null;
  }

  return (
    <View style={[styles.manualTag, { backgroundColor: theme.colors.brand.soft }]}>
      <Text style={[styles.manualTagText, { color: theme.colors.brand.primary }]}>note</Text>
    </View>
  );
}

export default function MemoryCard({
  memory,
  accentColor,
  onPress,
  onLongPress,
}: {
  memory: Memory;
  accentColor: string;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const { theme } = useTheme();
  const memoryKind = getMemoryKind(memory);
  const scale = useRef(new Animated.Value(1)).current;
  const longPressHandled = useRef(false);

  const runPressIn = () => {
    longPressHandled.current = false;
  };

  const runLongPress = () => {
    if (!onLongPress) return;
    longPressHandled.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    Animated.spring(scale, {
      toValue: 0.97,
      friction: 6,
      tension: 400,
      useNativeDriver: true,
    }).start();
    onLongPress();
  };

  const runPressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      friction: 6,
      tension: 400,
      useNativeDriver: true,
    }).start();
  };

  const runPress = () => {
    if (!longPressHandled.current) {
      onPress();
    }
    longPressHandled.current = false;
  };

  return (
    <Animated.View style={[styles.outer, { transform: [{ scale }] }]}>
      <Pressable
        onPressIn={runPressIn}
        onPress={runPress}
        onPressOut={runPressOut}
        onLongPress={onLongPress ? runLongPress : undefined}
        delayLongPress={500}
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.bg.surface,
            borderColor: theme.colors.border.subtle,
            borderLeftColor: accentColor,
          },
        ]}
      >
        <View style={styles.cardTopRow}>
          <View style={styles.cardTitleWrap}>
            {memoryKind === 'note' ? (
              <NoteIcon color={theme.colors.text.secondary} size={16} />
            ) : null}
            {memoryKind === 'voice' ? (
              <VoiceIcon color={theme.colors.text.secondary} size={16} />
            ) : null}
            <Text style={[styles.placeName, { color: theme.colors.text.primary }]} numberOfLines={2}>
              {memory.placeName}
            </Text>
          </View>
          <ManualTag memory={memory} />
        </View>
        <Text style={[styles.timestamp, { color: theme.colors.text.tertiary }]}>
          {formatMemoryDateTime(memory.timestamp)}
        </Text>
        {memory.note ? (
          <View style={[styles.noteBlock, { borderTopColor: theme.colors.border.subtle }]}>
            <Text style={[styles.noteText, { color: theme.colors.text.secondary }]}>{memory.note}</Text>
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  outer: {
    marginHorizontal: 24,
    marginBottom: 2,
  },
  card: {
    borderRadius: 12,
    borderWidth: 0.5,
    borderLeftWidth: 2.5,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  cardTitleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  placeName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  timestamp: {
    marginTop: 4,
    fontSize: 11,
  },
  noteBlock: {
    borderTopWidth: 0.5,
    paddingTop: 10,
    marginTop: 10,
  },
  noteText: {
    fontSize: 13,
    lineHeight: 19,
  },
  manualTag: {
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  manualTagText: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
