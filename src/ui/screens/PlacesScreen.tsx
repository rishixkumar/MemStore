import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { format, formatDistanceToNow } from 'date-fns';
import { Memory } from '../../models/Memory';
import { getAllPlaces, getMemoriesForPlace, PlaceRow } from '../../storage/database';
import BottomSheetModal, { SheetHeader } from '../components/BottomSheet';
import MemoryDetailSheet from '../components/MemoryDetailSheet';
import ScreenHeader from '../components/ScreenHeader';
import { useTheme } from '../theme';
import { formatMemoryDateTime } from '../../utils/date';

type PlaceSortMode = 'recent-desc' | 'recent-asc' | 'visits-desc' | 'name-asc';
type PlaceGroupMode = 'all' | 'frequent' | 'recent' | 'manual';

export default function PlacesScreen() {
  const { theme } = useTheme();
  const [places, setPlaces] = useState<PlaceRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<PlaceRow | null>(null);
  const [placeMemories, setPlaceMemories] = useState<Memory[]>([]);
  const [placeSheetVisible, setPlaceSheetVisible] = useState(false);
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);
  const [memorySheetVisible, setMemorySheetVisible] = useState(false);
  const [sortMode, setSortMode] = useState<PlaceSortMode>('recent-desc');
  const [groupMode, setGroupMode] = useState<PlaceGroupMode>('all');

  const loadPlaces = useCallback(async () => {
    const all = await getAllPlaces();
    setPlaces(all);
  }, []);

  useEffect(() => {
    loadPlaces();
  }, [loadPlaces]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPlaces();
    setRefreshing(false);
  };

  const selectPlace = async (place: PlaceRow) => {
    setSelectedPlace(place);
    const memories = await getMemoriesForPlace(place.name);
    setPlaceMemories(memories);
    setPlaceSheetVisible(true);
  };

  const refreshSelectedPlace = useCallback(async () => {
    if (!selectedPlace) return;
    const memories = await getMemoriesForPlace(selectedPlace.name);
    setPlaceMemories(memories);
    await loadPlaces();
  }, [loadPlaces, selectedPlace]);

  const maxVisits = Math.max(...places.map((p) => p.visitCount), 1);
  const placeSubtitle = useMemo(() => {
    if (!selectedPlace) return '';
    return `${selectedPlace.visitCount} visit${selectedPlace.visitCount !== 1 ? 's' : ''}`;
  }, [selectedPlace]);

  const displayedPlaces = useMemo(() => {
    const now = Date.now();
    const filtered = places.filter((place) => {
      if (groupMode === 'frequent') return place.visitCount >= 3;
      if (groupMode === 'recent') return now - place.lastVisited < 1000 * 60 * 60 * 24 * 7;
      if (groupMode === 'manual') return place.placeType === 'manual';
      return true;
    });

    return filtered.sort((a, b) => {
      if (sortMode === 'recent-desc') return b.lastVisited - a.lastVisited;
      if (sortMode === 'recent-asc') return a.lastVisited - b.lastVisited;
      if (sortMode === 'visits-desc') return b.visitCount - a.visitCount;
      return a.name.localeCompare(b.name);
    });
  }, [groupMode, places, sortMode]);

  const renderPlace = ({ item }: { item: PlaceRow }) => (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.bg.surface,
          borderColor: theme.colors.border.subtle,
          borderLeftColor: theme.colors.brand.primary,
        },
      ]}
      onPress={() => selectPlace(item)}
      activeOpacity={0.88}
    >
      <View style={styles.placeHeader}>
        <View style={styles.placeInfo}>
          <Text style={[styles.placeName, { color: theme.colors.text.primary }]} numberOfLines={2}>
            {item.name}
          </Text>
          <View style={[styles.visitBar, { backgroundColor: theme.colors.bg.base }]}>
            <View
              style={[
                styles.visitBarFill,
                { backgroundColor: theme.colors.brand.primary },
                { width: `${Math.min(100, (item.visitCount / maxVisits) * 100)}%` },
              ]}
            />
          </View>
          <Text style={[styles.placeMeta, { color: theme.colors.text.tertiary }]}>
            {item.visitCount} visit{item.visitCount !== 1 ? 's' : ''} · Last visited{' '}
            {formatDistanceToNow(new Date(item.lastVisited), { addSuffix: true })}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderControls = () => (
    <View style={styles.controlsWrap}>
      <View style={[styles.segmentedControl, { backgroundColor: theme.colors.bg.overlay }]}>
        {[
          { id: 'all', label: 'All' },
          { id: 'frequent', label: 'Frequent' },
          { id: 'recent', label: 'Recent' },
          { id: 'manual', label: 'Manual' },
        ].map((option) => (
          <TouchableOpacity
            key={option.id}
            style={[
              styles.segment,
              groupMode === option.id && {
                backgroundColor: theme.colors.bg.surface,
                borderColor: theme.colors.border.subtle,
              },
            ]}
            onPress={() => setGroupMode(option.id as PlaceGroupMode)}
            activeOpacity={0.85}
          >
            <Text
              style={[
                styles.segmentText,
                {
                  color:
                    groupMode === option.id ? theme.colors.text.primary : theme.colors.text.secondary,
                },
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.inlineControlsRow}>
        {[
          { id: 'recent-desc', label: 'Latest' },
          { id: 'recent-asc', label: 'Oldest' },
          { id: 'visits-desc', label: 'Most visits' },
          { id: 'name-asc', label: 'A-Z' },
        ].map((option) => (
          <TouchableOpacity
            key={option.id}
            style={[
              styles.chip,
              {
                backgroundColor:
                  sortMode === option.id ? theme.colors.brand.soft : theme.colors.bg.elevated,
                borderColor:
                  sortMode === option.id ? theme.colors.brand.primary : theme.colors.border.subtle,
              },
            ]}
            onPress={() => setSortMode(option.id as PlaceSortMode)}
            activeOpacity={0.85}
          >
            <Text
              style={[
                styles.chipText,
                {
                  color:
                    sortMode === option.id ? theme.colors.brand.primary : theme.colors.text.secondary,
                },
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg.base }]}>
      <ScreenHeader dateLabel={format(new Date(), 'EEEE, MMM d')} title="Places" />
      {places.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: theme.colors.text.primary }]}>No places learned yet</Text>
          <Text style={[styles.emptyText, { color: theme.colors.text.secondary }]}>
            As you move around, the app learns the places you frequent most.
          </Text>
        </View>
      ) : (
        <FlatList
          data={displayedPlaces}
          keyExtractor={(item) => item.id}
          renderItem={renderPlace}
          ListHeaderComponent={renderControls}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.brand.primary}
            />
          }
          contentContainerStyle={styles.list}
        />
      )}

      <BottomSheetModal
        visible={placeSheetVisible}
        onClose={() => setPlaceSheetVisible(false)}
        handleWidth={40}
        panelStyle={styles.modalSheet}
      >
        <SheetHeader
          title={selectedPlace?.name || 'Place'}
          subtitle={placeSubtitle}
          onClose={() => setPlaceSheetVisible(false)}
          titleNumberOfLines={2}
        />

        <FlatList
          data={placeMemories}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.88}
              style={[
                styles.modalMemoryCard,
                { backgroundColor: theme.colors.bg.surface, borderColor: theme.colors.border.subtle },
              ]}
              onPress={() => {
                setSelectedMemory(item);
                setMemorySheetVisible(true);
              }}
            >
              <Text style={[styles.cardTime, { color: theme.colors.text.tertiary }]}>
                {formatMemoryDateTime(item.timestamp)}
              </Text>
              <Text style={[styles.modalMemoryPlace, { color: theme.colors.text.primary }]}>{item.placeName}</Text>
              {item.note ? <Text style={[styles.cardNote, { color: theme.colors.text.secondary }]}>{item.note}</Text> : null}
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: theme.colors.text.secondary }]}>
              No detailed memories yet for this place.
            </Text>
          }
        />
      </BottomSheetModal>

      <MemoryDetailSheet
        visible={memorySheetVisible}
        memory={selectedMemory}
        onClose={() => setMemorySheetVisible(false)}
        onMemoryChanged={refreshSelectedPlace}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 64,
  },
  list: { paddingHorizontal: 24, paddingBottom: 160 },
  controlsWrap: {
    paddingBottom: 18,
    gap: 10,
  },
  segmentedControl: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 14,
    gap: 6,
  },
  segment: {
    flex: 1,
    minHeight: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '600',
  },
  inlineControlsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 0.5,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '500',
  },
  card: {
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginBottom: 2,
    borderWidth: 0.5,
    borderLeftWidth: 2.5,
  },
  placeHeader: { flexDirection: 'row', alignItems: 'center' },
  placeInfo: { flex: 1 },
  placeName: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 8,
  },
  placeMeta: {
    fontSize: 11,
    marginTop: 8,
  },
  visitBar: {
    height: 3,
    borderRadius: 999,
    overflow: 'hidden',
  },
  visitBarFill: {
    height: 3,
    borderRadius: 999,
  },
  cardTime: {
    fontSize: 12,
    marginBottom: 4,
  },
  modalMemoryPlace: {
    fontSize: 14,
    fontWeight: '500',
  },
  cardNote: {
    fontSize: 14,
    marginTop: 8,
    lineHeight: 20,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
  modalSheet: {
    height: '70%',
  },
  modalMemoryCard: {
    borderRadius: 12,
    borderWidth: 0.5,
    padding: 16,
    marginBottom: 8,
  },
});
