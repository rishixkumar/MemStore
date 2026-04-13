import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Svg, { Circle, Path } from 'react-native-svg';
import { initializeDatabase } from './src/storage/database';
import { requestPermissionsAndStart } from './src/sensing/locationService';
import {
  getActiveLlmProvider,
  testGeminiConnection,
  testOllamaConnection,
} from './src/intelligence/digestService';
import TimelineScreen from './src/ui/screens/TimelineScreen';
import PlacesScreen from './src/ui/screens/PlacesScreen';
import CaptureSheet from './src/ui/components/CaptureSheet';
import { THEME } from './src/ui/theme';

const Tab = createBottomTabNavigator();

function TabBarIcon({ label, active }: { label: string; active: boolean }) {
  const color = active ? THEME.colors.brand.primary : THEME.colors.text.tertiary;

  return (
    <View style={styles.tabIconWrap}>
      {active && <View style={styles.activeDot} />}
      {label === 'Timeline' ? (
        <Svg width={28} height={28} viewBox="0 0 28 28" fill="none">
          <Path d="M5 9.5h18" stroke={color} strokeWidth={2.5} strokeLinecap="round" />
          <Path d="M5 14h14" stroke={color} strokeWidth={2.5} strokeLinecap="round" />
          <Path d="M5 18.5h10" stroke={color} strokeWidth={2.5} strokeLinecap="round" />
        </Svg>
      ) : (
        <Svg width={28} height={28} viewBox="0 0 28 28" fill="none">
          <Path
            d="M14 6.5c-2.9 0-5.25 2.35-5.25 5.25 0 3.8 5.25 9.75 5.25 9.75s5.25-5.95 5.25-9.75c0-2.9-2.35-5.25-5.25-5.25Z"
            fill={active ? color : 'none'}
            stroke={color}
            strokeWidth={2}
            strokeLinejoin="round"
          />
          <Circle
            cx={14}
            cy={11.75}
            r={2.75}
            fill={active ? THEME.colors.bg.base : 'none'}
            stroke={active ? THEME.colors.bg.base : color}
            strokeWidth={1.6}
          />
        </Svg>
      )}
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
        const ollamaOk = await testOllamaConnection();
        console.log('Ollama startup test result:', ollamaOk ? 'success' : 'failed');
        console.log('Active LLM provider after startup:', getActiveLlmProvider());
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
        <Text style={styles.fabText}>Memory</Text>
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
  tabIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 72,
    height: 40,
    gap: THEME.spacing.xs,
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: THEME.radius.full,
    backgroundColor: THEME.colors.brand.primary,
    marginBottom: THEME.spacing.xs,
  },
  tabBar: {
    backgroundColor: THEME.colors.bg.base,
    borderTopColor: THEME.colors.border.subtle,
    borderTopWidth: 0.5,
    height: 80,
    paddingBottom: 24,
    paddingTop: THEME.spacing.md,
  },
  fab: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    width: 120,
    height: 52,
    borderRadius: THEME.radius.full,
    backgroundColor: THEME.colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: THEME.spacing.sm,
    shadowColor: THEME.colors.brand.glow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  fabIcon: {
    fontSize: 24,
    lineHeight: 26,
    color: THEME.colors.text.primary,
    fontWeight: THEME.font.weights.regular,
  },
  fabText: {
    fontSize: THEME.font.sizes.md,
    color: THEME.colors.text.primary,
    fontWeight: THEME.font.weights.medium,
  },
});
