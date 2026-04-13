import React, { useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { LOCATION_DISTANCE_INTERVAL_METERS, MEMORY_DEDUP_WINDOW_MS } from '../../config/app';
import { clearAllMemories, getDataSummary } from '../../storage/database';
import BottomSheetModal, { SheetHeader } from './BottomSheet';
import { useTheme } from '../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  onDataCleared: () => void;
}

function InfoRow({ label, value, destructive = false }: { label: string; value: string; destructive?: boolean }) {
  const { theme } = useTheme();

  return (
    <View style={styles.row}>
      <Text
        style={[
          styles.rowLabel,
          { color: destructive ? theme.colors.semantic.danger : theme.colors.text.primary },
        ]}
      >
        {label}
      </Text>
      <Text
        style={[
          styles.rowValue,
          { color: destructive ? theme.colors.semantic.danger : theme.colors.text.secondary },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

export default function SettingsSheet({ visible, onClose, onDataCleared }: Props) {
  const { theme, mode, setMode } = useTheme();
  const [permissionStatus, setPermissionStatus] = useState('Checking...');
  const [summary, setSummary] = useState({ totalMemories: 0, totalPlaces: 0 });

  useEffect(() => {
    if (!visible) return;

    async function load() {
      const foreground = await Location.getForegroundPermissionsAsync();
      setPermissionStatus(foreground.status === 'granted' ? 'Allowed' : 'Not allowed');
      setSummary(await getDataSummary());
    }

    load();
  }, [visible]);

  const handleOpenSettings = async () => {
    await Linking.openSettings();
  };

  const handleClearAll = () => {
    Alert.alert('Clear all memories?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          await clearAllMemories();
          onDataCleared();
          onClose();
        },
      },
    ]);
  };

  return (
    <BottomSheetModal visible={visible} onClose={onClose} panelStyle={styles.sheet}>
      <SheetHeader title="Settings" onClose={onClose} />

      <Text style={[styles.sectionTitle, { color: theme.colors.text.tertiary }]}>Appearance</Text>
      <View style={[styles.segmentedControl, { backgroundColor: theme.colors.bg.overlay }]}>
        <TouchableOpacity
          style={[
            styles.segment,
            mode === 'dark' && { backgroundColor: theme.colors.bg.surface, borderColor: theme.colors.border.subtle },
          ]}
          onPress={() => setMode('dark')}
          activeOpacity={0.85}
        >
          <Text
            style={[
              styles.segmentText,
              { color: mode === 'dark' ? theme.colors.text.primary : theme.colors.text.secondary },
            ]}
          >
            Dark
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.segment,
            mode === 'light' && { backgroundColor: theme.colors.bg.surface, borderColor: theme.colors.border.subtle },
          ]}
          onPress={() => setMode('light')}
          activeOpacity={0.85}
        >
          <Text
            style={[
              styles.segmentText,
              { color: mode === 'light' ? theme.colors.text.primary : theme.colors.text.secondary },
            ]}
          >
            Light
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={[styles.sectionTitle, { color: theme.colors.text.tertiary }]}>Sensing</Text>
      <TouchableOpacity style={styles.buttonRow} onPress={handleOpenSettings}>
        <Text style={[styles.rowLabel, { color: theme.colors.text.primary }]}>Background location</Text>
        <Text style={[styles.rowValue, { color: theme.colors.text.secondary }]}>{permissionStatus}</Text>
      </TouchableOpacity>
      <InfoRow label="Capture distance threshold" value={`${LOCATION_DISTANCE_INTERVAL_METERS}m`} />
      <InfoRow
        label="Min time between captures"
        value={`${Math.round(MEMORY_DEDUP_WINDOW_MS / 60000)} min`}
      />

      <Text style={[styles.sectionTitle, { color: theme.colors.text.tertiary }]}>Data</Text>
      <InfoRow label="Total memories" value={`${summary.totalMemories}`} />
      <InfoRow label="Places learned" value={`${summary.totalPlaces}`} />
      <TouchableOpacity
        style={[styles.destructiveButton, { backgroundColor: theme.colors.bg.overlay }]}
        onPress={handleClearAll}
      >
        <Text style={[styles.destructiveButtonText, { color: theme.colors.semantic.danger }]}>
          Clear all data
        </Text>
      </TouchableOpacity>

      <Text style={[styles.sectionTitle, { color: theme.colors.text.tertiary }]}>About</Text>
      <InfoRow label="Version" value="0.1.0" />
      <InfoRow label="Built with" value="Expo + Gemini + Ollama" />
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    paddingBottom: 42,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 8,
  },
  segmentedControl: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 14,
    gap: 6,
  },
  segment: {
    flex: 1,
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  rowLabel: { fontSize: 15 },
  rowValue: { fontSize: 14 },
  destructiveButton: {
    marginTop: 6,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  destructiveButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
