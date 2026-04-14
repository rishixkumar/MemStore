import { useFocusEffect } from '@react-navigation/native';
import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { EdgePadding, Marker } from 'react-native-maps';
import type { Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Memory } from '../../models/Memory';
import { getAllMemoriesWithCoords } from '../../storage/database';
import { formatMemoryDateTime } from '../../utils/date';
import { clusterMemoriesByProximity, MemoryCluster } from '../../utils/mapClustering';
import BottomSheetModal, { SheetHeader } from '../components/BottomSheet';
import { darkMapStyle } from '../map/darkMapStyle';
import { AppTheme, useTheme } from '../theme';

type TimeFilter = 'today' | 'week' | 'month' | 'all';

const FILTER_LABELS: { key: TimeFilter; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
  { key: 'all', label: 'All time' },
];

const DEFAULT_REGION: Region = {
  latitude: 37.78,
  longitude: -122.4,
  latitudeDelta: 8,
  longitudeDelta: 8,
};

function filterRange(filter: TimeFilter): { start: number; end: number } | null {
  const now = new Date();
  switch (filter) {
    case 'today':
      return { start: startOfDay(now).getTime(), end: endOfDay(now).getTime() };
    case 'week':
      return {
        start: startOfWeek(now, { weekStartsOn: 1 }).getTime(),
        end: endOfWeek(now, { weekStartsOn: 1 }).getTime(),
      };
    case 'month':
      return { start: startOfMonth(now).getTime(), end: endOfMonth(now).getTime() };
    default:
      return null;
  }
}

function maxImportance(memories: Memory[]): number {
  return memories.reduce((m, x) => Math.max(m, x.importanceScore ?? 0), 0);
}

function markerPalette(score: number, theme: AppTheme): { core: string; glow: string } {
  if (score >= 0.65) {
    return { core: theme.colors.brand.primary, glow: theme.colors.brand.glow };
  }
  if (score >= 0.35) {
    return { core: theme.colors.accent.teal, glow: 'rgba(45, 212, 160, 0.45)' };
  }
  return { core: theme.colors.text.tertiary, glow: 'rgba(142, 142, 154, 0.35)' };
}

function MemoryMarkerView({
  count,
  colors,
  theme,
}: {
  count: number;
  colors: { core: string; glow: string };
  theme: AppTheme;
}) {
  const isCluster = count > 1;
  const outer = isCluster ? 40 : 36;
  const glowSize = isCluster ? 30 : 26;
  const coreSize = isCluster ? 22 : 14;

  return (
    <View style={[styles.markerHit, { width: outer, height: outer }]}>
      <View
        style={[
          styles.markerGlow,
          {
            width: glowSize,
            height: glowSize,
            borderRadius: glowSize / 2,
            backgroundColor: colors.glow,
          },
        ]}
      />
      <View
        style={[
          styles.markerCore,
          {
            width: coreSize,
            height: coreSize,
            borderRadius: coreSize / 2,
            backgroundColor: colors.core,
            borderColor: colors.glow,
          },
        ]}
      >
        {isCluster ? (
          <Text style={[styles.clusterCount, { color: theme.colors.text.primary }]}>{count}</Text>
        ) : null}
      </View>
    </View>
  );
}

function fitVisibleMap(
  mapRef: React.RefObject<MapView | null>,
  clusters: MemoryCluster[],
  padding: EdgePadding
) {
  if (!mapRef.current || clusters.length === 0) {
    return;
  }
  const coords = clusters.map((c) => ({
    latitude: c.latitude,
    longitude: c.longitude,
  }));
  if (coords.length === 1) {
    mapRef.current.animateToRegion(
      {
        latitude: coords[0].latitude,
        longitude: coords[0].longitude,
        latitudeDelta: 0.06,
        longitudeDelta: 0.06,
      },
      380
    );
    return;
  }
  mapRef.current.fitToCoordinates(coords, {
    edgePadding: padding,
    animated: true,
  });
}

export default function MapScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView | null>(null);
  const [rawMemories, setRawMemories] = useState<Memory[]>([]);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [mapReady, setMapReady] = useState(false);
  const [selected, setSelected] = useState<MemoryCluster | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const load = useCallback(async () => {
    const rows = await getAllMemoriesWithCoords();
    setRawMemories(rows);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const filteredMemories = useMemo(() => {
    const range = filterRange(timeFilter);
    if (!range) {
      return rawMemories;
    }
    return rawMemories.filter((m) => m.timestamp >= range.start && m.timestamp <= range.end);
  }, [rawMemories, timeFilter]);

  const clusters = useMemo(
    () => clusterMemoriesByProximity(filteredMemories),
    [filteredMemories]
  );

  const edgePadding = useMemo<EdgePadding>(
    () => ({
      top: insets.top + 88,
      right: 28,
      bottom: 168,
      left: 28,
    }),
    [insets.top]
  );

  const runFit = useCallback(() => {
    if (!mapReady) {
      return;
    }
    if (clusters.length === 0) {
      mapRef.current?.animateToRegion(DEFAULT_REGION, 300);
      return;
    }
    requestAnimationFrame(() => {
      fitVisibleMap(mapRef, clusters, edgePadding);
    });
  }, [clusters, edgePadding, mapReady]);

  useEffect(() => {
    runFit();
  }, [runFit]);

  const openCluster = (c: MemoryCluster) => {
    setSelected(c);
    setSheetOpen(true);
  };

  const sheetTitle =
    selected && selected.memories.length === 1
      ? selected.memories[0].placeName
      : selected
        ? `${selected.memories.length} memories`
        : '';

  const sheetSubtitle = useMemo(() => {
    if (!selected) {
      return '';
    }
    const names = [...new Set(selected.memories.map((m) => m.placeName))];
    if (names.length === 1) {
      return `${selected.memories.length} visit${selected.memories.length !== 1 ? 's' : ''}`;
    }
    return `${names.length} places`;
  }, [selected]);

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.bg.base }]}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={DEFAULT_REGION}
        customMapStyle={darkMapStyle}
        mapType={Platform.OS === 'ios' ? 'mutedStandard' : 'standard'}
        rotateEnabled={false}
        pitchEnabled={false}
        onMapReady={() => setMapReady(true)}
      >
        {clusters.map((c) => {
          const score = maxImportance(c.memories);
          const colors = markerPalette(score, theme);
          return (
            <Marker
              key={c.id}
              coordinate={{ latitude: c.latitude, longitude: c.longitude }}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
              onPress={() => openCluster(c)}
            >
              <MemoryMarkerView
                count={c.memories.length}
                colors={colors}
                theme={theme}
              />
            </Marker>
          );
        })}
      </MapView>

      <View
        pointerEvents="box-none"
        style={[styles.filterWrap, { paddingTop: insets.top + theme.spacing.sm }]}
      >
        <View
          style={[
            styles.filterRow,
            {
              backgroundColor: theme.colors.bg.surface,
              borderColor: theme.colors.border.subtle,
            },
          ]}
        >
          {FILTER_LABELS.map(({ key, label }) => {
            const active = timeFilter === key;
            return (
              <TouchableOpacity
                key={key}
                onPress={() => setTimeFilter(key)}
                activeOpacity={0.85}
                style={[
                  styles.filterChip,
                  active && { backgroundColor: theme.colors.bg.overlay },
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    { color: active ? theme.colors.text.primary : theme.colors.text.tertiary },
                  ]}
                  numberOfLines={1}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <BottomSheetModal visible={sheetOpen} onClose={() => setSheetOpen(false)}>
        {selected ? (
          <>
            <SheetHeader title={sheetTitle} subtitle={sheetSubtitle} onClose={() => setSheetOpen(false)} />
            <ScrollView
              style={styles.sheetScroll}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {selected.memories.map((m) => (
                <View
                  key={m.id}
                  style={[
                    styles.visitCard,
                    {
                      backgroundColor: theme.colors.bg.surface,
                      borderColor: theme.colors.border.subtle,
                    },
                  ]}
                >
                  <Text style={[styles.visitPlace, { color: theme.colors.text.primary }]}>
                    {m.placeName}
                  </Text>
                  <Text style={[styles.visitWhen, { color: theme.colors.text.secondary }]}>
                    {formatMemoryDateTime(m.timestamp)}
                  </Text>
                  {m.note?.trim() ? (
                    <Text style={[styles.visitNote, { color: theme.colors.text.secondary }]}>
                      {m.note.trim()}
                    </Text>
                  ) : null}
                </View>
              ))}
            </ScrollView>
          </>
        ) : null}
      </BottomSheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  filterWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  filterRow: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 0.5,
    padding: 4,
    gap: 2,
    maxWidth: 400,
  },
  filterChip: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  markerHit: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerGlow: {
    position: 'absolute',
    opacity: 0.55,
  },
  markerCore: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
    elevation: 3,
  },
  clusterCount: {
    fontSize: 12,
    fontWeight: '700',
  },
  sheetScroll: {
    maxHeight: 360,
  },
  visitCard: {
    borderRadius: 12,
    borderWidth: 0.5,
    padding: 14,
    marginBottom: 10,
  },
  visitPlace: {
    fontSize: 16,
    fontWeight: '600',
  },
  visitWhen: {
    marginTop: 4,
    fontSize: 13,
  },
  visitNote: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 20,
  },
});
