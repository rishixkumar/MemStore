import React, { useCallback, useEffect, useState } from 'react';
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

export default function PlacesScreen() {
  const [places, setPlaces] = useState<PlaceRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<PlaceRow | null>(null);
  const [placeMemories, setPlaceMemories] = useState<Memory[]>([]);

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
  };

  if (selectedPlace) {
    return (
      <View style={styles.container}>
        <TouchableOpacity onPress={() => setSelectedPlace(null)} style={styles.backBtn}>
          <Text style={styles.backBtnText}>{'<'} All places</Text>
        </TouchableOpacity>
        <Text style={styles.header} numberOfLines={2}>
          {selectedPlace.name}
        </Text>
        <Text style={styles.placeSubtitle}>
          {selectedPlace.visitCount} visit{selectedPlace.visitCount !== 1 ? 's' : ''}
        </Text>
        <FlatList
          data={placeMemories}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.cardTime}>
                {format(new Date(item.timestamp), 'MMM d, yyyy · h:mm a')}
              </Text>
              {item.note && <Text style={styles.cardNote}>{item.note}</Text>}
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No detailed memories yet for this place.</Text>
          }
        />
      </View>
    );
  }

  const maxVisits = Math.max(...places.map((p) => p.visitCount), 1);

  const renderPlace = ({ item, index }: { item: PlaceRow; index: number }) => (
    <TouchableOpacity style={styles.card} onPress={() => selectPlace(item)} activeOpacity={0.7}>
      <View style={styles.placeHeader}>
        <View style={styles.placeRank}>
          <Text style={styles.placeRankText}>{index + 1}</Text>
        </View>
        <View style={styles.placeInfo}>
          <Text style={styles.placeName} numberOfLines={2}>
            {item.name}
          </Text>
          <Text style={styles.placeMeta}>
            {item.visitCount} visit{item.visitCount !== 1 ? 's' : ''} · last{' '}
            {formatDistanceToNow(new Date(item.lastVisited), { addSuffix: true })}
          </Text>
        </View>
        <Text style={styles.placeArrow}>{'>'}</Text>
      </View>
      <View style={styles.visitBar}>
        <View
          style={[
            styles.visitBarFill,
            { width: `${Math.min(100, (item.visitCount / maxVisits) * 100)}%` },
          ]}
        />
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Your places</Text>
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
              tintColor="#534AB7"
            />
          }
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F', paddingTop: 60 },
  header: {
    fontSize: 28,
    fontWeight: '600',
    color: '#FFFFFF',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  placeSubtitle: {
    fontSize: 14,
    color: '#666680',
    paddingHorizontal: 20,
    marginTop: -14,
    marginBottom: 16,
  },
  backBtn: { paddingHorizontal: 20, marginBottom: 12 },
  backBtnText: { fontSize: 14, color: '#534AB7' },
  list: { paddingHorizontal: 20, paddingBottom: 40 },
  card: {
    backgroundColor: '#16161E',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 0.5,
    borderColor: '#2A2A3A',
  },
  placeHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  placeRank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1E1A3E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeRankText: { fontSize: 12, fontWeight: '600', color: '#AFA9EC' },
  placeInfo: { flex: 1 },
  placeName: { fontSize: 15, fontWeight: '500', color: '#FFFFFF', marginBottom: 3 },
  placeMeta: { fontSize: 12, color: '#666680' },
  placeArrow: { fontSize: 20, color: '#2A2A3A' },
  visitBar: { height: 3, backgroundColor: '#0A0A0F', borderRadius: 2, overflow: 'hidden' },
  visitBarFill: { height: 3, backgroundColor: '#534AB7', borderRadius: 2 },
  cardTime: { fontSize: 13, color: '#666680', marginBottom: 4 },
  cardNote: { fontSize: 14, color: '#C8C8E0', fontStyle: 'italic', marginTop: 4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#FFFFFF', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#666680', textAlign: 'center', lineHeight: 22 },
});
