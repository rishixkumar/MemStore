import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Svg, { Path } from 'react-native-svg';
import { initializeDatabase } from './src/storage/database';
import { requestPermissionsAndStart } from './src/sensing/locationService';
import { testGeminiConnection } from './src/intelligence/digestService';
import TimelineScreen from './src/ui/screens/TimelineScreen';
import PlacesScreen from './src/ui/screens/PlacesScreen';
import CaptureSheet from './src/ui/components/CaptureSheet';

const Tab = createBottomTabNavigator();

function TabBarIcon({ label, active }: { label: string; active: boolean }) {
  const color = active ? '#534AB7' : '#444460';

  return (
    <View style={styles.tabIconWrap}>
      {label === 'Timeline' ? (
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
          <Path d="M5 7H19" stroke={color} strokeWidth={2} strokeLinecap="round" />
          <Path d="M5 12H16" stroke={color} strokeWidth={2} strokeLinecap="round" />
          <Path d="M5 17H13" stroke={color} strokeWidth={2} strokeLinecap="round" />
        </Svg>
      ) : (
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 21C15.5 17 18 14.3 18 10.8C18 7.05 15.31 4 12 4C8.69 4 6 7.05 6 10.8C6 14.3 8.5 17 12 21Z"
            stroke={color}
            strokeWidth={2}
            strokeLinejoin="round"
          />
          <Path d="M12 13.2C13.3255 13.2 14.4 12.1255 14.4 10.8C14.4 9.47452 13.3255 8.4 12 8.4C10.6745 8.4 9.6 9.47452 9.6 10.8C9.6 12.1255 10.6745 13.2 12 13.2Z" fill={active ? color : 'none'} stroke={color} strokeWidth={1.5} />
        </Svg>
      )}
      <Text
        numberOfLines={1}
        style={[styles.tabLabel, { color, fontWeight: active ? '600' : '400' }]}
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
        const geminiOk = await testGeminiConnection();
        console.log('Gemini startup test result:', geminiOk ? 'success' : 'failed');
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
          {() => <TimelineScreen key={refreshKey} onOpenCapture={() => setCaptureVisible(true)} />}
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
  tabIconWrap: { alignItems: 'center', gap: 4, width: 72 },
  tabLabel: { fontSize: 10, flexShrink: 0 },
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
