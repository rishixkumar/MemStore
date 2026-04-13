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
import { THEME } from '../theme';
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

      <Text style={styles.placeName}>{memory.placeName}</Text>
      <Text style={styles.timestamp}>{formatMemoryDateTime(memory.timestamp)}</Text>

      {editing ? (
        <TextInput
          style={styles.editor}
          multiline
          autoFocus
          value={draftNote}
          onChangeText={setDraftNote}
          placeholder="Add context to this memory"
          placeholderTextColor={THEME.colors.text.secondary}
        />
      ) : (
        <View style={styles.noteCard}>
          <Text style={styles.noteText}>{memory.note || 'No additional note saved.'}</Text>
        </View>
      )}

      <View style={styles.actionsRow}>
        {memory.memoryKind === 'voice' && memory.audioUri && (
          <TouchableOpacity style={styles.primaryAction} onPress={handlePlayPause}>
            {playing ? <PauseIcon /> : <PlayIcon />}
            <Text style={styles.primaryActionText}>{playing ? 'Pause' : 'Play'}</Text>
          </TouchableOpacity>
        )}

        {editing ? (
          <TouchableOpacity style={styles.secondaryAction} onPress={handleSave}>
            <Text style={styles.secondaryActionText}>Save changes</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.secondaryAction} onPress={() => setEditing(true)}>
            <NoteIcon />
            <Text style={styles.secondaryActionText}>Edit</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.destructiveAction} onPress={handleDelete}>
          <TrashIcon />
          <Text style={styles.destructiveActionText}>Delete</Text>
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
    fontWeight: THEME.font.weights.bold,
    color: THEME.colors.text.primary,
    marginBottom: 6,
  },
  timestamp: { fontSize: 13, color: THEME.colors.text.tertiary, marginBottom: 18 },
  noteCard: {
    backgroundColor: THEME.colors.bg.base,
    borderRadius: THEME.radius.lg,
    padding: THEME.spacing.lg,
    borderWidth: 0.5,
    borderColor: THEME.colors.border.subtle,
    minHeight: 110,
  },
  noteText: { fontSize: 15, lineHeight: 24, color: THEME.colors.text.secondary },
  editor: {
    backgroundColor: THEME.colors.bg.base,
    borderRadius: THEME.radius.lg,
    padding: THEME.spacing.lg,
    borderWidth: 0.5,
    borderColor: THEME.colors.border.medium,
    minHeight: 120,
    color: THEME.colors.text.primary,
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
    backgroundColor: THEME.colors.brand.primary,
    borderRadius: THEME.radius.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  primaryActionText: {
    fontSize: 14,
    fontWeight: THEME.font.weights.semibold,
    color: THEME.colors.text.primary,
  },
  secondaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: THEME.colors.bg.overlay,
    borderRadius: THEME.radius.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  secondaryActionText: {
    fontSize: 14,
    fontWeight: THEME.font.weights.semibold,
    color: THEME.colors.text.primary,
  },
  destructiveAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: THEME.colors.bg.overlay,
    borderRadius: THEME.radius.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  destructiveActionText: {
    fontSize: 14,
    fontWeight: THEME.font.weights.semibold,
    color: THEME.colors.semantic.danger,
  },
});
