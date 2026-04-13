import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Audio } from 'expo-av';
import { format } from 'date-fns';
import Svg, { Path } from 'react-native-svg';
import { Memory } from '../../models/Memory';
import { deleteMemory, updateMemory } from '../../storage/database';

interface Props {
  visible: boolean;
  memory: Memory | null;
  onClose: () => void;
  onMemoryChanged: () => void;
}

function ActionIcon({ type }: { type: 'edit' | 'trash' | 'play' | 'pause' | 'note' | 'voice' }) {
  const color = type === 'trash' ? '#F08F92' : '#FFFFFF';

  if (type === 'note') {
    return (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Path
          d="M4 17.5V20h2.5L17.8 8.7l-2.5-2.5L4 17.5Z"
          stroke={color}
          strokeWidth={1.8}
          strokeLinejoin="round"
        />
        <Path d="M13.8 4.7 16.3 7.2" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      </Svg>
    );
  }

  if (type === 'voice') {
    return (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Path
          d="M12 4a2.5 2.5 0 0 1 2.5 2.5v4a2.5 2.5 0 1 1-5 0v-4A2.5 2.5 0 0 1 12 4Z"
          stroke={color}
          strokeWidth={1.8}
        />
        <Path d="M8 10.5a4 4 0 1 0 8 0" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
        <Path d="M12 15v4" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      </Svg>
    );
  }

  if (type === 'play') {
    return (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Path d="M8 6.5v11l9-5.5-9-5.5Z" fill={color} />
      </Svg>
    );
  }

  if (type === 'pause') {
    return (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Path d="M8 6h3v12H8zM13 6h3v12h-3z" fill={color} />
      </Svg>
    );
  }

  if (type === 'edit') {
    return (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Path
          d="M4 17.5V20h2.5L17.8 8.7l-2.5-2.5L4 17.5Z"
          stroke={color}
          strokeWidth={1.8}
          strokeLinejoin="round"
        />
        <Path d="M13.8 4.7 16.3 7.2" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      </Svg>
    );
  }

  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 7h12M9 7V5h6v2M9.5 10.5v5M14.5 10.5v5M7.5 7l.7 11.2a1 1 0 0 0 1 .8h5.6a1 1 0 0 0 1-.8L16.5 7"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
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
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <View style={styles.kindRow}>
              <ActionIcon type={memory.memoryKind === 'voice' ? 'voice' : 'note'} />
              <Text style={styles.headerTitle}>
                {memory.memoryKind === 'voice' ? 'Voice memo' : 'Quick note'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeText}>Close</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.placeName}>{memory.placeName}</Text>
          <Text style={styles.timestamp}>
            {format(new Date(memory.timestamp), 'MMM d, yyyy · h:mm a')}
          </Text>

          {editing ? (
            <TextInput
              style={styles.editor}
              multiline
              autoFocus
              value={draftNote}
              onChangeText={setDraftNote}
              placeholder="Add context to this memory"
              placeholderTextColor="#666680"
            />
          ) : (
            <View style={styles.noteCard}>
              <Text style={styles.noteText}>{memory.note || 'No additional note saved.'}</Text>
            </View>
          )}

          <View style={styles.actionsRow}>
            {memory.memoryKind === 'voice' && memory.audioUri && (
              <TouchableOpacity style={styles.primaryAction} onPress={handlePlayPause}>
                <ActionIcon type={playing ? 'pause' : 'play'} />
                <Text style={styles.primaryActionText}>{playing ? 'Pause' : 'Play'}</Text>
              </TouchableOpacity>
            )}

            {editing ? (
              <TouchableOpacity style={styles.secondaryAction} onPress={handleSave}>
                <Text style={styles.secondaryActionText}>Save changes</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.secondaryAction} onPress={() => setEditing(true)}>
                <ActionIcon type="edit" />
                <Text style={styles.secondaryActionText}>Edit</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.destructiveAction} onPress={handleDelete}>
              <ActionIcon type="trash" />
              <Text style={styles.destructiveActionText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: '#16161E',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 38,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#2A2A3A',
    alignSelf: 'center',
    marginBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  kindRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#FFFFFF' },
  closeText: { fontSize: 14, color: '#534AB7' },
  placeName: { fontSize: 22, fontWeight: '700', color: '#FFFFFF', marginBottom: 6 },
  timestamp: { fontSize: 13, color: '#666680', marginBottom: 18 },
  noteCard: {
    backgroundColor: '#0A0A0F',
    borderRadius: 16,
    padding: 16,
    borderWidth: 0.5,
    borderColor: '#2A2A3A',
    minHeight: 110,
  },
  noteText: { fontSize: 15, lineHeight: 24, color: '#C8C8E0' },
  editor: {
    backgroundColor: '#0A0A0F',
    borderRadius: 16,
    padding: 16,
    borderWidth: 0.5,
    borderColor: '#2A2A3A',
    minHeight: 120,
    color: '#FFFFFF',
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
    backgroundColor: '#534AB7',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  primaryActionText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  secondaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1E2130',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  secondaryActionText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  destructiveAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#251417',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  destructiveActionText: { fontSize: 14, fontWeight: '600', color: '#F08F92' },
});
