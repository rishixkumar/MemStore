import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { initializeDatabase } from './src/storage/database';
import { requestPermissionsAndStart } from './src/sensing/locationService';
import TimelineScreen from './src/ui/screens/TimelineScreen';
import PlacesScreen from './src/ui/screens/PlacesScreen';
import CaptureSheet from './src/ui/components/CaptureSheet';

const Tab = createBottomTabNavigator();

function TabBarIcon({ label, active }: { label: string; active: boolean }) {
  const icons: Record<string, string> = { Timeline: 'O', Places: '[]' };
  return (
    <View style={{ alignItems: 'center', gap: 3 }}>
      <Text style={{ fontSize: 18, color: active ? '#534AB7' : '#444460' }}>
        {icons[label]}
      </Text>
      <Text
        style={{
          fontSize: 10,
          color: active ? '#534AB7' : '#444460',
          fontWeight: active ? '600' : '400',
        }}
      >
        {label}
      </Text>
    </View>
  );
}

export default function App() {
  const [captureVisible, setCaptureVisible] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    async function bootstrap() {
      try {
        await initializeDatabase();
        await requestPermissionsAndStart();
      } catch (err: any) {
        Alert.alert('Permission Required', err.message || 'Something went wrong during setup.', [
          { text: 'OK' },
        ]);
      }
    }
    bootstrap();
  }, []);

  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: styles.tabBar,
          tabBarShowLabel: false,
          tabBarIcon: ({ focused }) => <TabBarIcon label={route.name} active={focused} />,
        })}
      >
        <Tab.Screen name="Timeline">
          {() => <TimelineScreen key={refreshKey} />}
        </Tab.Screen>
        <Tab.Screen name="Places" component={PlacesScreen} />
      </Tab.Navigator>

      <TouchableOpacity
        style={styles.fab}
        onPress={() => setCaptureVisible(true)}
        activeOpacity={0.85}
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>

      <CaptureSheet
        visible={captureVisible}
        onClose={() => setCaptureVisible(false)}
        onMemorySaved={() => setRefreshKey((k) => k + 1)}
      />
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#16161E',
    borderTopColor: '#2A2A3A',
    borderTopWidth: 0.5,
    height: 72,
    paddingBottom: 16,
    paddingTop: 10,
  },
  fab: {
    position: 'absolute',
    bottom: 88,
    alignSelf: 'center',
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#534AB7',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#534AB7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  fabIcon: { fontSize: 28, color: '#FFFFFF', lineHeight: 32 },
});
