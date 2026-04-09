import { format } from 'date-fns';
import React, { useEffect, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Memory } from '../../models/Memory';
import { getAllMemories } from '../../storage/database';

export default function TimelineScreen() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadMemories = async () => {
    const all = await getAllMemories();
    setMemories(all);
  };

  useEffect(() => {
    loadMemories();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMemories();
    setRefreshing(false);
  };

  const renderMemory = ({ item }: { item: Memory }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.placeName}>{item.placeName}</Text>
        <Text style={styles.activityBadge}>{item.activityType}</Text>
      </View>
      <Text style={styles.timestamp}>
        {format(new Date(item.timestamp), 'MMM d, yyyy · h:mm a')}
      </Text>
      {item.note && <Text style={styles.note}>{item.note}</Text>}
      <View style={styles.cardFooter}>
        <Text style={styles.score}>
          Importance: {Math.round(item.importanceScore * 100)}%
        </Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Your Memories</Text>
      {memories.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No memories yet</Text>
          <Text style={styles.emptySubtitle}>
            Move around with the app running and your day will start appearing
            here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={memories}
          keyExtractor={(item) => item.id}
          renderItem={renderMemory}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
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
    marginBottom: 16,
  },
  list: { paddingHorizontal: 20, paddingBottom: 40 },
  card: {
    backgroundColor: '#16161E',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 0.5,
    borderColor: '#2A2A3A',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  placeName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#FFFFFF',
    flex: 1,
    marginRight: 8,
  },
  activityBadge: {
    fontSize: 11,
    color: '#AFA9EC',
    backgroundColor: '#26215C',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  timestamp: { fontSize: 12, color: '#666680', marginBottom: 6 },
  note: { fontSize: 13, color: '#A0A0C0', marginTop: 4, fontStyle: 'italic' },
  cardFooter: { marginTop: 8, flexDirection: 'row', justifyContent: 'flex-end' },
  score: { fontSize: 11, color: '#534AB7' },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666680',
    textAlign: 'center',
    lineHeight: 22,
  },
});
