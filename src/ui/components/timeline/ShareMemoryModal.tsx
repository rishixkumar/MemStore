import * as Haptics from 'expo-haptics';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ViewShot from 'react-native-view-shot';
import { Memory } from '../../../models/Memory';
import ShareMemoryCard from './ShareMemoryCard';
import { useTheme } from '../../theme';

type Props = {
  visible: boolean;
  memory: Memory | null;
  caption: string;
  onClose: () => void;
};

export default function ShareMemoryModal({ visible, memory, caption, onClose }: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const shotRef = useRef<ViewShot | null>(null);
  const slide = useRef(new Animated.Value(Dimensions.get('window').height)).current;
  const [busy, setBusy] = useState<'share' | 'save' | null>(null);

  useEffect(() => {
    const h = Dimensions.get('window').height;
    if (visible) {
      slide.setValue(h);
      Animated.spring(slide, {
        toValue: 0,
        useNativeDriver: true,
        tension: 56,
        friction: 12,
      }).start();
    } else {
      slide.setValue(h);
    }
  }, [visible, slide]);

  const runClose = useCallback(() => {
    const h = Dimensions.get('window').height;
    Animated.spring(slide, {
      toValue: h,
      useNativeDriver: true,
      tension: 64,
      friction: 14,
    }).start(({ finished }) => {
      if (finished) onClose();
    });
  }, [onClose, slide]);

  const captureUri = useCallback(async () => {
    const ref = shotRef.current;
    if (!ref?.capture) return null;
    return ref.capture();
  }, []);

  const onShare = useCallback(async () => {
    if (!memory || busy) return;
    setBusy('share');
    try {
      const uri = await captureUri();
      if (!uri) {
        Alert.alert('Could not share', 'Unable to capture the memory card.');
        return;
      }
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert('Sharing unavailable', 'Sharing is not available on this device.');
        return;
      }
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: 'Share memory',
        UTI: 'public.png',
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    } catch {
      Alert.alert('Share failed', 'Something went wrong while sharing.');
    } finally {
      setBusy(null);
    }
  }, [busy, captureUri, memory]);

  const onSave = useCallback(async () => {
    if (!memory || busy) return;
    setBusy('save');
    try {
      const perm = await MediaLibrary.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          'Photos access needed',
          'Allow Ambient Memory to save images to your library when you use Save to photos.'
        );
        return;
      }
      const uri = await captureUri();
      if (!uri) {
        Alert.alert('Could not save', 'Unable to capture the memory card.');
        return;
      }
      await MediaLibrary.saveToLibraryAsync(uri);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    } catch {
      Alert.alert('Save failed', 'Could not save to your photo library.');
    } finally {
      setBusy(null);
    }
  }, [busy, captureUri, memory]);

  if (!memory) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={runClose}>
      <Animated.View
        style={[
          styles.sheet,
          {
            backgroundColor: theme.colors.shadow.overlay,
            paddingBottom: Math.max(insets.bottom, 20),
            transform: [{ translateY: slide }],
          },
        ]}
      >
        <Pressable style={styles.backdropTap} onPress={runClose} accessibilityRole="button" />

        <View style={styles.previewWrap} pointerEvents="box-none">
          <ViewShot
            ref={shotRef}
            options={{ format: 'png', quality: 1, result: 'tmpfile' }}
            style={styles.shot}
          >
            <ShareMemoryCard memory={memory} caption={caption} />
          </ViewShot>
        </View>

        <View style={styles.actions}>
          <Pressable
            onPress={onShare}
            disabled={busy !== null}
            style={({ pressed }) => [
              styles.primaryBtn,
              {
                backgroundColor: theme.colors.brand.primary,
                opacity: pressed ? 0.92 : 1,
              },
            ]}
          >
            {busy === 'share' ? (
              <ActivityIndicator color={theme.colors.text.inverse} />
            ) : (
              <Text style={[styles.primaryBtnText, { color: theme.colors.text.inverse }]}>Share</Text>
            )}
          </Pressable>

          <Pressable
            onPress={onSave}
            disabled={busy !== null}
            style={({ pressed }) => [
              styles.secondaryBtn,
              {
                borderColor: theme.colors.border.medium,
                backgroundColor: theme.colors.bg.elevated,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
          >
            {busy === 'save' ? (
              <ActivityIndicator color={theme.colors.text.primary} />
            ) : (
              <Text style={[styles.secondaryBtnText, { color: theme.colors.text.primary }]}>
                Save to photos
              </Text>
            )}
          </Pressable>

          <Pressable onPress={runClose} hitSlop={12} style={styles.cancelWrap}>
            <Text style={[styles.cancelText, { color: theme.colors.text.tertiary }]}>Cancel</Text>
          </Pressable>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    justifyContent: 'space-between',
  },
  backdropTap: {
    ...StyleSheet.absoluteFillObject,
  },
  previewWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 24,
  },
  shot: {
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.45,
    shadowRadius: 32,
    elevation: 20,
  },
  actions: {
    paddingHorizontal: 28,
    gap: 12,
  },
  primaryBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    minHeight: 52,
  },
  secondaryBtnText: {
    fontSize: 16,
    fontWeight: '600',
  },
  cancelWrap: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '500',
  },
});
