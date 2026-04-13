import React, { useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { clearAllMemories, getDataSummary } from '../../storage/database';

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
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <Text style={styles.title}>Settings</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeText}>Close</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionTitle}>Sensing</Text>
          <TouchableOpacity style={styles.buttonRow} onPress={handleOpenSettings}>
            <Text style={styles.rowLabel}>Background location</Text>
            <Text style={styles.rowValue}>{permissionStatus}</Text>
          </TouchableOpacity>
          <InfoRow label="Capture distance threshold" value="200m" />
          <InfoRow label="Min time between captures" value="10 min" />

          <Text style={styles.sectionTitle}>Data</Text>
          <InfoRow label="Total memories" value={`${summary.totalMemories}`} />
          <InfoRow label="Places learned" value={`${summary.totalPlaces}`} />
          <TouchableOpacity style={styles.destructiveButton} onPress={handleClearAll}>
            <Text style={styles.destructiveButtonText}>Clear all data</Text>
          </TouchableOpacity>

          <Text style={styles.sectionTitle}>About</Text>
          <InfoRow label="Version" value="0.1.0" />
          <InfoRow label="Built with" value="Expo + Gemini" />
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
    paddingBottom: 42,
    gap: 12,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#2A2A3A',
    alignSelf: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: { fontSize: 22, fontWeight: '700', color: '#FFFFFF' },
  closeText: { fontSize: 14, color: '#534AB7' },
  sectionTitle: {
    fontSize: 12,
    color: '#666680',
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
  rowLabel: { fontSize: 15, color: '#FFFFFF' },
  rowValue: { fontSize: 14, color: '#666680' },
  destructiveButton: {
    marginTop: 6,
    backgroundColor: '#251417',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  destructiveButtonText: { fontSize: 15, fontWeight: '600', color: '#F08F92' },
  destructiveText: { color: '#F08F92' },
});
