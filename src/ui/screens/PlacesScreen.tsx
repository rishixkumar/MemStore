import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { format, formatDistanceToNow } from 'date-fns';
import { Memory } from '../../models/Memory';
import { getAllPlaces, getMemoriesForPlace, PlaceRow } from '../../storage/database';
import MemoryDetailSheet from '../components/MemoryDetailSheet';
import { THEME } from '../theme';

export default function PlacesScreen() {
  const [places, setPlaces] = useState<PlaceRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<PlaceRow | null>(null);
  const [placeMemories, setPlaceMemories] = useState<Memory[]>([]);
  const [placeSheetVisible, setPlaceSheetVisible] = useState(false);
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);
  const [memorySheetVisible, setMemorySheetVisible] = useState(false);

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

  const renderPlace = ({ item }: { item: PlaceRow }) => (
    <TouchableOpacity style={styles.card} onPress={() => selectPlace(item)} activeOpacity={0.88}>
      <View style={styles.placeHeader}>
        <View style={styles.placeInfo}>
          <Text style={styles.placeName} numberOfLines={2}>
            {item.name}
          </Text>
          <View style={styles.visitBar}>
            <View
              style={[
                styles.visitBarFill,
                { width: `${Math.min(100, (item.visitCount / maxVisits) * 100)}%` },
              ]}
            />
          </View>
          <Text style={styles.placeMeta}>
            {item.visitCount} visit{item.visitCount !== 1 ? 's' : ''} · Last visited{' '}
            {formatDistanceToNow(new Date(item.lastVisited), { addSuffix: true })}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerWrap}>
        <Text style={styles.dateLabel}>{format(new Date(), 'EEEE, MMM d')}</Text>
        <Text style={styles.header}>Places</Text>
      </View>
      {places.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No places learned yet</Text>
          <Text style={styles.emptyText}>
            As you move around, the app learns the places you frequent most.
          </Text>
        </View>
      ) : (
        <FlatList
          data={places}
          keyExtractor={(item) => item.id}
          renderItem={renderPlace}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={THEME.colors.brand.primary}
            />
          }
          contentContainerStyle={styles.list}
        />
      )}

      <Modal
        visible={placeSheetVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPlaceSheetVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setPlaceSheetVisible(false)}
          />
          <View style={styles.modalSheet}>
            <View style={styles.handle} />
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderText}>
                <Text style={styles.modalTitle} numberOfLines={2}>
                  {selectedPlace?.name}
                </Text>
                <Text style={styles.placeSubtitle}>{placeSubtitle}</Text>
              </View>
              <TouchableOpacity onPress={() => setPlaceSheetVisible(false)}>
                <Text style={styles.closeText}>Close</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={placeMemories}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity
                  activeOpacity={0.88}
                  style={styles.modalMemoryCard}
                  onPress={() => {
                    setSelectedMemory(item);
                    setMemorySheetVisible(true);
                  }}
                >
                  <Text style={styles.cardTime}>
                    {format(new Date(item.timestamp), 'MMM d, yyyy · h:mm a')}
                  </Text>
                  <Text style={styles.modalMemoryPlace}>{item.placeName}</Text>
                  {item.note ? <Text style={styles.cardNote}>{item.note}</Text> : null}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No detailed memories yet for this place.</Text>
              }
            />
          </View>
        </View>
      </Modal>

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
    backgroundColor: THEME.colors.bg.base,
    paddingTop: 64,
  },
  headerWrap: {
    paddingHorizontal: THEME.spacing.xl,
    marginBottom: THEME.spacing.xl,
  },
  dateLabel: {
    fontSize: THEME.font.sizes.sm,
    color: THEME.colors.text.tertiary,
    marginBottom: THEME.spacing.sm,
  },
  header: {
    fontSize: THEME.font.sizes.xxxl,
    fontWeight: THEME.font.weights.bold,
    color: THEME.colors.text.primary,
  },
  placeSubtitle: {
    fontSize: THEME.font.sizes.md,
    color: THEME.colors.text.secondary,
    marginTop: THEME.spacing.xs,
  },
  list: { paddingHorizontal: THEME.spacing.xl, paddingBottom: 160 },
  card: {
    backgroundColor: THEME.colors.bg.surface,
    borderRadius: THEME.radius.md,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginBottom: 2,
    borderWidth: 0.5,
    borderColor: THEME.colors.border.subtle,
    borderLeftWidth: 2.5,
    borderLeftColor: THEME.colors.brand.primary,
  },
  placeHeader: { flexDirection: 'row', alignItems: 'center' },
  placeInfo: { flex: 1 },
  placeName: {
    fontSize: 15,
    fontWeight: THEME.font.weights.medium,
    color: THEME.colors.text.primary,
    marginBottom: THEME.spacing.sm,
  },
  placeMeta: {
    fontSize: 11,
    color: THEME.colors.text.tertiary,
    marginTop: THEME.spacing.sm,
  },
  visitBar: {
    height: 3,
    backgroundColor: THEME.colors.bg.base,
    borderRadius: THEME.radius.full,
    overflow: 'hidden',
  },
  visitBarFill: {
    height: 3,
    backgroundColor: THEME.colors.brand.primary,
    borderRadius: THEME.radius.full,
  },
  cardTime: {
    fontSize: THEME.font.sizes.sm,
    color: THEME.colors.text.tertiary,
    marginBottom: THEME.spacing.xs,
  },
  modalMemoryPlace: {
    fontSize: THEME.font.sizes.md,
    color: THEME.colors.text.primary,
    fontWeight: THEME.font.weights.medium,
  },
  cardNote: {
    fontSize: THEME.font.sizes.md,
    color: THEME.colors.text.secondary,
    marginTop: THEME.spacing.sm,
    lineHeight: 20,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: THEME.font.sizes.xl,
    fontWeight: THEME.font.weights.semibold,
    color: THEME.colors.text.primary,
    marginBottom: THEME.spacing.sm,
  },
  emptyText: {
    fontSize: THEME.font.sizes.md,
    color: THEME.colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: THEME.colors.shadow.overlay,
  },
  modalSheet: {
    backgroundColor: THEME.colors.bg.elevated,
    borderTopLeftRadius: THEME.radius.xl,
    borderTopRightRadius: THEME.radius.xl,
    padding: THEME.spacing.xl,
    paddingBottom: THEME.spacing.xxxl,
    height: '70%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: THEME.radius.full,
    backgroundColor: THEME.colors.border.medium,
    alignSelf: 'center',
    marginBottom: THEME.spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: THEME.spacing.lg,
  },
  modalHeaderText: {
    flex: 1,
    marginRight: THEME.spacing.md,
  },
  modalTitle: {
    fontSize: THEME.font.sizes.xl,
    fontWeight: THEME.font.weights.bold,
    color: THEME.colors.text.primary,
  },
  closeText: {
    fontSize: THEME.font.sizes.md,
    color: THEME.colors.brand.primary,
  },
  modalMemoryCard: {
    backgroundColor: THEME.colors.bg.surface,
    borderRadius: THEME.radius.md,
    borderWidth: 0.5,
    borderColor: THEME.colors.border.subtle,
    padding: THEME.spacing.lg,
    marginBottom: THEME.spacing.sm,
  },
});
