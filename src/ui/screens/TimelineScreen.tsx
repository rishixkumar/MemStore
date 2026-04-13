import { format } from 'date-fns';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Memory } from '../../models/Memory';
import { generateDailyDigest } from '../../intelligence/digestService';
import { clearAllMemories, getAllMemories } from '../../storage/database';

export default function TimelineScreen() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [digest, setDigest] = useState<string | null>(null);
  const [digestLoading, setDigestLoading] = useState(false);

  const today = format(new Date(), 'yyyy-MM-dd');

  const loadMemories = useCallback(async () => {
    const all = await getAllMemories();
    setMemories(all);
  }, []);

  const loadDigest = useCallback(async () => {
    setDigestLoading(true);
    try {
      const summary = await generateDailyDigest(today);
      setDigest(summary);
    } catch (e) {
      console.error('Digest error:', e);
    } finally {
      setDigestLoading(false);
    }
  }, [today]);

  useEffect(() => {
    loadMemories();
    loadDigest();
  }, [loadDigest, loadMemories]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMemories();
    await loadDigest();
    setRefreshing(false);
  };

  const handleClearAll = () => {
    Alert.alert('Clear all memories?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          await clearAllMemories();
          setMemories([]);
          setDigest(null);
        },
      },
    ]);
  };

  const renderHeader = () => (
    <View>
      <View style={styles.titleRow}>
        <Text style={styles.header}>Your Memories</Text>
        <TouchableOpacity onPress={handleClearAll} style={styles.clearBtn}>
          <Text style={styles.clearBtnText}>Clear</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.digestCard}>
        <Text style={styles.digestLabel}>Today's digest</Text>
        {digestLoading ? (
          <View style={styles.digestLoading}>
            <ActivityIndicator size="small" color="#534AB7" />
            <Text style={styles.digestLoadingText}>Reflecting on your day...</Text>
          </View>
        ) : (
          <Text style={styles.digestText}>
            {digest || 'No memories yet today. Walk around to start capturing.'}
          </Text>
        )}
        <TouchableOpacity onPress={loadDigest} style={styles.refreshDigest}>
          <Text style={styles.refreshDigestText}>Refresh digest</Text>
        </TouchableOpacity>
      </View>

      {memories.length > 0 && (
        <Text style={styles.sectionLabel}>
          {memories.length} memory{memories.length !== 1 ? ' entries' : ''}
        </Text>
      )}
    </View>
  );

  const renderMemory = ({ item }: { item: Memory }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.placeName} numberOfLines={2}>
          {item.placeName}
        </Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {Math.round(item.importanceScore * 100)}%
          </Text>
        </View>
      </View>
      <Text style={styles.timestamp}>
        {format(new Date(item.timestamp), 'MMM d, yyyy · h:mm a')}
      </Text>
      {item.note && <Text style={styles.note}>{item.note}</Text>}
    </View>
  );

  return (
    <View style={styles.container}>
      {memories.length === 0 && !digestLoading ? (
        <View style={styles.emptyContainer}>
          {renderHeader()}
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No memories yet</Text>
            <Text style={styles.emptySubtitle}>
              Move around with the app running and your day will start appearing here.
            </Text>
          </View>
        </View>
      ) : (
        <FlatList
          data={memories}
          keyExtractor={(item) => item.id}
          renderItem={renderMemory}
          ListHeaderComponent={renderHeader}
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
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  header: { fontSize: 28, fontWeight: '600', color: '#FFFFFF' },
  clearBtn: { padding: 6 },
  clearBtnText: { fontSize: 13, color: '#534AB7' },
  list: { paddingHorizontal: 20, paddingBottom: 40 },
  emptyContainer: { flex: 1, paddingHorizontal: 20 },
  digestCard: {
    backgroundColor: '#16161E',
    borderRadius: 16,
    padding: 18,
    marginBottom: 24,
    borderWidth: 0.5,
    borderColor: '#2A2A3A',
  },
  digestLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#534AB7',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  digestText: { fontSize: 15, color: '#C8C8E0', lineHeight: 24, fontStyle: 'italic' },
  digestLoading: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  digestLoadingText: { fontSize: 14, color: '#666680' },
  refreshDigest: { marginTop: 12, alignSelf: 'flex-end' },
  refreshDigestText: { fontSize: 12, color: '#534AB7' },
  sectionLabel: {
    fontSize: 12,
    color: '#666680',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  card: {
    backgroundColor: '#16161E',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 0.5,
    borderColor: '#2A2A3A',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  placeName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#FFFFFF',
    flex: 1,
    marginRight: 10,
  },
  badge: {
    backgroundColor: '#1E1A3E',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgeText: { fontSize: 11, color: '#AFA9EC', fontWeight: '500' },
  timestamp: { fontSize: 12, color: '#666680' },
  note: { fontSize: 13, color: '#A0A0C0', marginTop: 6, fontStyle: 'italic' },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
  },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: '#FFFFFF', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#666680', textAlign: 'center', lineHeight: 22 },
});
