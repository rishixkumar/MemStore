import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Audio } from 'expo-av';
import { Memory } from '../../models/Memory';
import { deleteMemory, updateMemory } from '../../storage/database';
import BottomSheetModal, { SheetHeader } from './BottomSheet';
import { NoteIcon, PauseIcon, PlayIcon, TrashIcon, VoiceIcon } from './Icons';
import { useTheme } from '../theme';
import { formatMemoryDateTime } from '../../utils/date';

interface Props {
  visible: boolean;
  memory: Memory | null;
  onClose: () => void;
  onMemoryChanged: () => void;
}

export default function MemoryDetailSheet({
  visible,
  memory,
  onClose,
  onMemoryChanged,
}: Props) {
  const { theme } = useTheme();
  const [draftNote, setDraftNote] = useState('');
  const [editing, setEditing] = useState(false);
  const [playing, setPlaying] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    setDraftNote(memory?.note || '');
    setEditing(false);
  }, [memory]);

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  const stopPlayback = async () => {
    if (soundRef.current) {
      await soundRef.current.stopAsync().catch(() => undefined);
      await soundRef.current.unloadAsync().catch(() => undefined);
      soundRef.current = null;
    }
    setPlaying(false);
  };

  const handlePlayPause = async () => {
    if (!memory?.audioUri) return;

    if (playing) {
      await stopPlayback();
      return;
    }

    try {
      await stopPlayback();
      const { sound } = await Audio.Sound.createAsync(
        { uri: memory.audioUri },
        { shouldPlay: true }
      );
      soundRef.current = sound;
      setPlaying(true);
      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded || status.didJustFinish) {
          setPlaying(false);
        }
      });
    } catch {
      Alert.alert('Playback failed', 'This voice memo could not be played back.');
    }
  };

  const handleSave = async () => {
    if (!memory) return;
    await updateMemory(memory.id, { note: draftNote.trim() || null });
    setEditing(false);
    onMemoryChanged();
  };

  const handleDelete = () => {
    if (!memory) return;
    Alert.alert('Delete memory?', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await stopPlayback();
          await deleteMemory(memory.id);
          onClose();
          onMemoryChanged();
        },
      },
    ]);
  };

  if (!memory) return null;

  return (
    <BottomSheetModal visible={visible} onClose={onClose} panelStyle={styles.sheet}>
      <SheetHeader
        title={memory.memoryKind === 'voice' ? 'Voice memo' : 'Quick note'}
        onClose={onClose}
        left={<View style={styles.kindIcon}>{memory.memoryKind === 'voice' ? <VoiceIcon /> : <NoteIcon />}</View>}
      />

      <Text style={[styles.placeName, { color: theme.colors.text.primary }]}>{memory.placeName}</Text>
      <Text style={[styles.timestamp, { color: theme.colors.text.tertiary }]}>
        {formatMemoryDateTime(memory.timestamp)}
      </Text>

      {editing ? (
        <TextInput
          style={[
            styles.editor,
            {
              backgroundColor: theme.colors.bg.base,
              borderColor: theme.colors.border.medium,
              color: theme.colors.text.primary,
            },
          ]}
          multiline
          autoFocus
          value={draftNote}
          onChangeText={setDraftNote}
          placeholder="Add context to this memory"
          placeholderTextColor={theme.colors.text.secondary}
        />
      ) : (
        <View
          style={[
            styles.noteCard,
            {
              backgroundColor: theme.colors.bg.base,
              borderColor: theme.colors.border.subtle,
            },
          ]}
        >
          <Text style={[styles.noteText, { color: theme.colors.text.secondary }]}>
            {memory.note || 'No additional note saved.'}
          </Text>
        </View>
      )}

      <View style={styles.actionsRow}>
        {memory.memoryKind === 'voice' && memory.audioUri && (
          <TouchableOpacity
            style={[styles.primaryAction, { backgroundColor: theme.colors.brand.primary }]}
            onPress={handlePlayPause}
          >
            {playing ? <PauseIcon color={theme.colors.text.inverse} /> : <PlayIcon color={theme.colors.text.inverse} />}
            <Text style={[styles.primaryActionText, { color: theme.colors.text.inverse }]}>
              {playing ? 'Pause' : 'Play'}
            </Text>
          </TouchableOpacity>
        )}

        {editing ? (
          <TouchableOpacity
            style={[styles.secondaryAction, { backgroundColor: theme.colors.bg.overlay }]}
            onPress={handleSave}
          >
            <Text style={[styles.secondaryActionText, { color: theme.colors.text.primary }]}>
              Save changes
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.secondaryAction, { backgroundColor: theme.colors.bg.overlay }]}
            onPress={() => setEditing(true)}
          >
            <NoteIcon />
            <Text style={[styles.secondaryActionText, { color: theme.colors.text.primary }]}>Edit</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.destructiveAction, { backgroundColor: theme.colors.bg.overlay }]}
          onPress={handleDelete}
        >
          <TrashIcon />
          <Text style={[styles.destructiveActionText, { color: theme.colors.semantic.danger }]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    paddingBottom: 38,
  },
  kindIcon: { alignItems: 'center', justifyContent: 'center' },
  placeName: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 6,
  },
  timestamp: { fontSize: 13, marginBottom: 18 },
  noteCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 0.5,
    minHeight: 110,
  },
  noteText: { fontSize: 15, lineHeight: 24 },
  editor: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 0.5,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 20,
  },
  primaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  primaryActionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  secondaryActionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  destructiveAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  destructiveActionText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
