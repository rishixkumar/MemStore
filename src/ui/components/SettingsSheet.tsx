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
import { THEME } from '../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  onDataCleared: () => void;
}

function InfoRow({ label, value, destructive = false }: { label: string; value: string; destructive?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, destructive && styles.destructiveText]}>{label}</Text>
      <Text style={[styles.rowValue, destructive && styles.destructiveText]}>{value}</Text>
    </View>
  );
}

export default function SettingsSheet({ visible, onClose, onDataCleared }: Props) {
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

      <Text style={styles.sectionTitle}>Sensing</Text>
      <TouchableOpacity style={styles.buttonRow} onPress={handleOpenSettings}>
        <Text style={styles.rowLabel}>Background location</Text>
        <Text style={styles.rowValue}>{permissionStatus}</Text>
      </TouchableOpacity>
      <InfoRow label="Capture distance threshold" value={`${LOCATION_DISTANCE_INTERVAL_METERS}m`} />
      <InfoRow
        label="Min time between captures"
        value={`${Math.round(MEMORY_DEDUP_WINDOW_MS / 60000)} min`}
      />

      <Text style={styles.sectionTitle}>Data</Text>
      <InfoRow label="Total memories" value={`${summary.totalMemories}`} />
      <InfoRow label="Places learned" value={`${summary.totalPlaces}`} />
      <TouchableOpacity style={styles.destructiveButton} onPress={handleClearAll}>
        <Text style={styles.destructiveButtonText}>Clear all data</Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>About</Text>
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
    color: THEME.colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 8,
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
  rowLabel: { fontSize: 15, color: THEME.colors.text.primary },
  rowValue: { fontSize: 14, color: THEME.colors.text.secondary },
  destructiveButton: {
    marginTop: 6,
    backgroundColor: THEME.colors.bg.overlay,
    borderRadius: THEME.radius.md,
    padding: 14,
    alignItems: 'center',
  },
  destructiveButtonText: {
    fontSize: 15,
    fontWeight: THEME.font.weights.semibold,
    color: THEME.colors.semantic.danger,
  },
  destructiveText: { color: THEME.colors.semantic.danger },
});
