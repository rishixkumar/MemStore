import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
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
import Svg, { Circle } from 'react-native-svg';
import { Memory } from '../../models/Memory';
import { insertMemory } from '../../storage/database';
import { NoteIcon, VoiceIcon } from './Icons';
import { THEME } from '../theme';

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
  const [inputFocused, setInputFocused] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulse = useRef(new Animated.Value(1)).current;

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

  useEffect(() => {
    if (!isRecording) {
      pulse.setValue(1);
      return;
    }

    const animation = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1.6,
        duration: 1000,
        useNativeDriver: true,
      })
    );

    animation.start();

    return () => {
      animation.stop();
      pulse.setValue(1);
    };
  }, [isRecording, pulse]);

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
        memoryKind: 'note',
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
        note: `Voice memo (${recordingDuration}s)`,
        importanceScore: 0.9,
        createdAt: timestamp,
        audioUri: uri || null,
        memoryKind: 'voice',
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
                <View style={styles.optionIconWrap}>
                  <NoteIcon />
                </View>
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
                <View style={styles.optionIconWrap}>
                  <VoiceIcon />
                </View>
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
                style={[
                  styles.textInput,
                  {
                    borderColor: inputFocused
                      ? THEME.colors.border.medium
                      : THEME.colors.border.subtle,
                  },
                ]}
                placeholder="What's happening right now?"
                placeholderTextColor={THEME.colors.text.tertiary}
                value={noteText}
                onChangeText={setNoteText}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
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
                <View style={styles.recordPulseWrap}>
                  <Animated.View
                    style={[
                      styles.recordPulseRing,
                      {
                        transform: [{ scale: pulse }],
                        opacity: pulse.interpolate({
                          inputRange: [1, 1.6],
                          outputRange: [1, 0],
                        }),
                      },
                    ]}
                  />
                  <Svg width={28} height={28} viewBox="0 0 28 28" fill="none">
                    <Circle cx={14} cy={14} r={13} stroke={THEME.colors.border.medium} />
                    <Circle
                      cx={14}
                      cy={14}
                      r={8}
                      fill={isRecording ? THEME.colors.semantic.danger : THEME.colors.text.secondary}
                    />
                  </Svg>
                </View>
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
              <ActivityIndicator color={THEME.colors.brand.primary} size="large" />
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
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: THEME.colors.shadow.overlay },
  sheet: {
    backgroundColor: THEME.colors.bg.elevated,
    borderTopLeftRadius: THEME.radius.xl,
    borderTopRightRadius: THEME.radius.xl,
    padding: THEME.spacing.xl,
    paddingBottom: THEME.spacing.xxxl,
    minHeight: 280,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: THEME.colors.border.medium,
    borderRadius: THEME.radius.full,
    alignSelf: 'center',
    marginBottom: THEME.spacing.xl,
  },
  sheetTitle: {
    fontSize: THEME.font.sizes.xl,
    fontWeight: THEME.font.weights.semibold,
    color: THEME.colors.text.primary,
    marginBottom: THEME.spacing.xl,
  },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: THEME.spacing.lg,
    backgroundColor: THEME.colors.bg.overlay,
    borderRadius: 14,
    marginBottom: THEME.spacing.sm,
  },
  optionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: THEME.radius.full,
    backgroundColor: THEME.colors.brand.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: THEME.font.weights.medium,
    color: THEME.colors.text.primary,
    marginBottom: 2,
  },
  optionSub: { fontSize: THEME.font.sizes.sm, color: THEME.colors.text.secondary },
  textInput: {
    backgroundColor: THEME.colors.bg.base,
    borderRadius: 14,
    padding: 14,
    color: THEME.colors.text.primary,
    fontSize: 15,
    minHeight: 100,
    textAlignVertical: 'top',
    borderWidth: 1,
    marginBottom: THEME.spacing.lg,
  },
  saveBtn: {
    backgroundColor: THEME.colors.brand.primary,
    borderRadius: 14,
    padding: THEME.spacing.lg,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: {
    color: THEME.colors.text.primary,
    fontSize: 16,
    fontWeight: THEME.font.weights.semibold,
  },
  recordingCenter: { alignItems: 'center', paddingVertical: 24, gap: 12 },
  recordPulseWrap: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordPulseRing: {
    position: 'absolute',
    width: 52,
    height: 52,
    borderRadius: THEME.radius.full,
    borderWidth: 2,
    borderColor: THEME.colors.semantic.danger,
  },
  recordTimer: {
    fontSize: 40,
    fontWeight: '300',
    color: THEME.colors.text.primary,
    fontVariant: ['tabular-nums'],
  },
  recordHint: { fontSize: 13, color: THEME.colors.text.secondary },
});
