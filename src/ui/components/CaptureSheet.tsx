import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Audio } from 'expo-av';
import * as Location from 'expo-location';
import { Memory } from '../../models/Memory';
import { insertMemory } from '../../storage/database';

interface Props {
  visible: boolean;
  onClose: () => void;
  onMemorySaved: () => void;
}

type Mode = 'choose' | 'text' | 'recording' | 'saving';

export default function CaptureSheet({ visible, onClose, onMemorySaved }: Props) {
  const [mode, setMode] = useState<Mode>('choose');
  const [noteText, setNoteText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const reset = () => {
    setMode('choose');
    setNoteText('');
    setIsRecording(false);
    setRecordingDuration(0);
    recordingRef.current = null;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const getCurrentLocation = async () => {
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const geocoded = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
      const place = geocoded[0];
      const placeName = place
        ? [place.name, place.street, place.city].filter(Boolean).join(', ')
        : `${loc.coords.latitude.toFixed(4)}, ${loc.coords.longitude.toFixed(4)}`;
      return { location: loc, placeName };
    } catch {
      return null;
    }
  };

  const saveTextNote = async () => {
    if (!noteText.trim()) return;
    setMode('saving');
    try {
      const loc = await getCurrentLocation();
      const timestamp = Date.now();
      const memory: Memory = {
        id: `manual-${timestamp}-${Math.random().toString(36).slice(2, 11)}`,
        timestamp,
        latitude: loc?.location.coords.latitude || 0,
        longitude: loc?.location.coords.longitude || 0,
        placeName: loc?.placeName || 'Unknown location',
        placeType: 'manual',
        activityType: 'stationary',
        durationMinutes: 0,
        peopleIds: [],
        note: noteText.trim(),
        importanceScore: 0.85,
        createdAt: timestamp,
      };
      const inserted = await insertMemory(memory);
      if (!inserted) {
        Alert.alert('Memory not saved', 'This note matched a recent memory and was skipped.');
        setMode('text');
        return;
      }
      reset();
      onMemorySaved();
      onClose();
    } catch {
      Alert.alert('Could not save memory');
      setMode('text');
    }
  };

  const startRecording = async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        Alert.alert('Microphone permission required');
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setIsRecording(true);
      setRecordingDuration(0);
      timerRef.current = setInterval(() => setRecordingDuration((d) => d + 1), 1000);
    } catch {
      Alert.alert('Could not start recording');
    }
  };

  const stopRecording = async () => {
    if (!recordingRef.current) return;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
    setMode('saving');
    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      const loc = await getCurrentLocation();
      const timestamp = Date.now();
      const memory: Memory = {
        id: `voice-${timestamp}-${Math.random().toString(36).slice(2, 11)}`,
        timestamp,
        latitude: loc?.location.coords.latitude || 0,
        longitude: loc?.location.coords.longitude || 0,
        placeName: loc?.placeName || 'Unknown location',
        placeType: 'manual',
        activityType: 'stationary',
        durationMinutes: 0,
        peopleIds: [],
        note: `🎙 Voice memo (${recordingDuration}s)${uri ? ' - tap to play' : ''}`,
        importanceScore: 0.9,
        createdAt: timestamp,
      };
      const inserted = await insertMemory(memory);
      if (!inserted) {
        Alert.alert('Memory not saved', 'This recording matched a recent memory and was skipped.');
        reset();
        onClose();
        return;
      }
      reset();
      onMemorySaved();
      onClose();
    } catch {
      Alert.alert('Failed to save recording');
      reset();
    }
  };

  const formatDuration = (s: number) =>
    `${Math.floor(s / 60)
      .toString()
      .padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          {mode === 'choose' && (
            <>
              <Text style={styles.sheetTitle}>Capture a memory</Text>
              <TouchableOpacity style={styles.optionBtn} onPress={() => setMode('text')}>
                <Text style={styles.optionIcon}>Note</Text>
                <View>
                  <Text style={styles.optionLabel}>Quick note</Text>
                  <Text style={styles.optionSub}>Type what&apos;s on your mind</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.optionBtn}
                onPress={() => {
                  setMode('recording');
                  startRecording();
                }}
              >
                <Text style={styles.optionIcon}>Mic</Text>
                <View>
                  <Text style={styles.optionLabel}>Voice memo</Text>
                  <Text style={styles.optionSub}>Record up to 2 minutes</Text>
                </View>
              </TouchableOpacity>
            </>
          )}

          {mode === 'text' && (
            <>
              <Text style={styles.sheetTitle}>Quick note</Text>
              <TextInput
                style={styles.textInput}
                placeholder="What's happening right now?"
                placeholderTextColor="#555570"
                value={noteText}
                onChangeText={setNoteText}
                multiline
                autoFocus
                maxLength={500}
              />
              <TouchableOpacity
                style={[styles.saveBtn, !noteText.trim() && styles.saveBtnDisabled]}
                onPress={saveTextNote}
                disabled={!noteText.trim()}
              >
                <Text style={styles.saveBtnText}>Save memory</Text>
              </TouchableOpacity>
            </>
          )}

          {mode === 'recording' && (
            <>
              <Text style={styles.sheetTitle}>Recording...</Text>
              <View style={styles.recordingCenter}>
                <View style={[styles.recordDot, isRecording && styles.recordDotActive]} />
                <Text style={styles.recordTimer}>{formatDuration(recordingDuration)}</Text>
                <Text style={styles.recordHint}>Tap to stop and save</Text>
              </View>
              <TouchableOpacity style={styles.saveBtn} onPress={stopRecording}>
                <Text style={styles.saveBtnText}>Stop & save</Text>
              </TouchableOpacity>
            </>
          )}

          {mode === 'saving' && (
            <View style={styles.recordingCenter}>
              <ActivityIndicator color="#534AB7" size="large" />
              <Text style={styles.recordHint}>Saving memory...</Text>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
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
    paddingBottom: 48,
    minHeight: 280,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: '#2A2A3A',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  sheetTitle: { fontSize: 18, fontWeight: '600', color: '#FFFFFF', marginBottom: 20 },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    backgroundColor: '#0A0A0F',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: '#2A2A3A',
    marginBottom: 10,
  },
  optionIcon: { fontSize: 18, color: '#FFFFFF', width: 36 },
  optionLabel: { fontSize: 15, fontWeight: '500', color: '#FFFFFF', marginBottom: 2 },
  optionSub: { fontSize: 12, color: '#666680' },
  textInput: {
    backgroundColor: '#0A0A0F',
    borderRadius: 12,
    padding: 14,
    color: '#FFFFFF',
    fontSize: 15,
    minHeight: 100,
    textAlignVertical: 'top',
    borderWidth: 0.5,
    borderColor: '#2A2A3A',
    marginBottom: 16,
  },
  saveBtn: { backgroundColor: '#534AB7', borderRadius: 12, padding: 16, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  recordingCenter: { alignItems: 'center', paddingVertical: 24, gap: 12 },
  recordDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#666680' },
  recordDotActive: { backgroundColor: '#E24B4A' },
  recordTimer: {
    fontSize: 40,
    fontWeight: '300',
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
  },
  recordHint: { fontSize: 13, color: '#666680' },
});
