import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Svg, { Circle, Path } from 'react-native-svg';
import { initializeDatabase } from './src/storage/database';
import { requestPermissionsAndStart } from './src/sensing/locationService';
import TimelineScreen from './src/ui/screens/TimelineScreen';
import PlacesScreen from './src/ui/screens/PlacesScreen';
import CaptureSheet from './src/ui/components/CaptureSheet';
import { ThemeProvider, useTheme } from './src/ui/theme';

const Tab = createBottomTabNavigator();

function TabBarIcon({ label, active }: { label: string; active: boolean }) {
  const { theme } = useTheme();
  const color = active ? theme.colors.brand.primary : theme.colors.text.tertiary;

  return (
    <View style={styles.tabIconWrap}>
      {active && <View style={[styles.activeDot, { backgroundColor: theme.colors.brand.primary }]} />}
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
            fill={active ? theme.colors.bg.base : 'none'}
            stroke={active ? theme.colors.bg.base : color}
            strokeWidth={1.6}
          />
        </Svg>
      )}
    </View>
  );
}

function AppShell() {
  const [captureVisible, setCaptureVisible] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const { theme } = useTheme();
  const navigationTheme = theme.isDark ? DarkTheme : DefaultTheme;

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
    <NavigationContainer
      theme={{
        ...navigationTheme,
        dark: theme.isDark,
        colors: {
          ...navigationTheme.colors,
          primary: theme.colors.brand.primary,
          background: theme.colors.bg.base,
          card: theme.colors.bg.base,
          text: theme.colors.text.primary,
          border: theme.colors.border.subtle,
          notification: theme.colors.brand.primary,
        },
      }}
    >
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: [
            styles.tabBar,
            {
              backgroundColor: theme.colors.bg.base,
              borderTopColor: theme.colors.border.subtle,
            },
          ],
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
        style={[
          styles.fab,
          {
            backgroundColor: theme.colors.brand.primary,
            shadowColor: theme.colors.brand.glow,
          },
        ]}
        onPress={() => setCaptureVisible(true)}
        activeOpacity={0.85}
      >
        <Text style={[styles.fabIcon, { color: theme.colors.text.inverse }]}>+</Text>
        <Text style={[styles.fabText, { color: theme.colors.text.inverse }]}>Memory</Text>
      </TouchableOpacity>

      <CaptureSheet
        visible={captureVisible}
        onClose={() => setCaptureVisible(false)}
        onMemorySaved={() => setRefreshKey((k) => k + 1)}
      />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  tabIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 72,
    height: 40,
    gap: 4,
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 999,
    marginBottom: 4,
  },
  tabBar: {
    borderTopWidth: 0.5,
    height: 80,
    paddingBottom: 24,
    paddingTop: 12,
  },
  fab: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    width: 120,
    height: 52,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  fabIcon: {
    fontSize: 24,
    lineHeight: 26,
    fontWeight: '400',
  },
  fabText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
