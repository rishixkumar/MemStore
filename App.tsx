import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, Alert } from 'react-native';
import { initializeDatabase } from './src/storage/database';
import { requestPermissionsAndStart } from './src/sensing/locationService';
import TimelineScreen from './src/ui/screens/TimelineScreen';

export default function App() {
  useEffect(() => {
    async function bootstrap() {
      try {
        await initializeDatabase();
        await requestPermissionsAndStart();
      } catch (err: any) {
        Alert.alert(
          'Permission Required',
          err.message || 'Something went wrong during setup.',
          [{ text: 'OK' }]
        );
      }
    }
    bootstrap();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <TimelineScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
});
