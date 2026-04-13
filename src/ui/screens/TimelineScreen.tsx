import { format } from 'date-fns';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Memory } from '../../models/Memory';
import { generateDailyDigest, generateOnThisDayCaption } from '../../intelligence/digestService';
import {
  clearAllMemories,
  getAllMemories,
  getMemoriesForDate,
  getOnThisDayMemories,
} from '../../storage/database';
import SettingsSheet from '../components/SettingsSheet';

interface TimelineScreenProps {
  onOpenCapture: () => void;
}

type OnThisDayBucket = 365 | 30 | 7;

type OnThisDayState = {
  daysAgo: OnThisDayBucket;
  label: string;
  memories: Memory[];
  caption: string;
} | null;

const ON_THIS_DAY_PRIORITIES: Array<{ daysAgo: OnThisDayBucket; label: string }> = [
  { daysAgo: 365, label: '1 year ago' },
  { daysAgo: 30, label: '30 days ago' },
  { daysAgo: 7, label: '1 week ago' },
];

function getImportanceAccent(score: number) {
  if (score >= 0.9) return '#534AB7';
  if (score >= 0.7) return '#1D9E75';
  return '#2A2A3A';
}

function AudioWave() {
  return (
    <View style={styles.audioWave}>
      <View style={[styles.audioBar, styles.audioBarShort]} />
      <View style={[styles.audioBar, styles.audioBarTall]} />
      <View style={[styles.audioBar, styles.audioBarMid]} />
    </View>
  );
}

export default function TimelineScreen({ onOpenCapture }: TimelineScreenProps) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [digest, setDigest] = useState<string | null>(null);
  const [digestLoading, setDigestLoading] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [onThisDay, setOnThisDay] = useState<OnThisDayState>(null);
  const [onThisDayVisible, setOnThisDayVisible] = useState(false);
  const [onThisDayModalMemories, setOnThisDayModalMemories] = useState<Memory[]>([]);
  const pulse = useRef(new Animated.Value(1)).current;

  const today = format(new Date(), 'yyyy-MM-dd');

  const loadMemories = useCallback(async () => {
    const all = await getAllMemories();
    setMemories(all);
  }, []);

  const loadDigest = useCallback(
    async (forceRefresh = false) => {
      setDigestLoading(true);
      try {
        const summary = await generateDailyDigest(today, forceRefresh);
        setDigest(summary);
      } catch (e) {
        console.warn('Digest error:', e);
      } finally {
        setDigestLoading(false);
      }
    },
    [today]
  );

  const loadOnThisDay = useCallback(async () => {
    for (const candidate of ON_THIS_DAY_PRIORITIES) {
      const memoriesForDay = await getOnThisDayMemories(candidate.daysAgo);
      if (memoriesForDay.length > 0) {
        const caption = await generateOnThisDayCaption(memoriesForDay[0]);
        setOnThisDay({
          daysAgo: candidate.daysAgo,
          label: candidate.label,
          memories: memoriesForDay,
          caption,
        });
        return;
      }
    }

    setOnThisDay(null);
  }, []);

  useEffect(() => {
    loadMemories();
    loadDigest(false);
    loadOnThisDay();
  }, [loadDigest, loadMemories, loadOnThisDay]);

  useEffect(() => {
    if (!digestLoading) {
      pulse.setValue(1);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.4,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();

    return () => {
      animation.stop();
      pulse.setValue(1);
    };
  }, [digestLoading, pulse]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMemories();
    await loadDigest(true);
    await loadOnThisDay();
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
          setOnThisDay(null);
          setSettingsVisible(false);
        },
      },
    ]);
  };

  const emptyStateIcon = useMemo(
    () => (
      <View style={styles.emptyIconOuter}>
        <View style={styles.emptyIconInner}>
          <View style={styles.emptyIconDot} />
        </View>
      </View>
    ),
    []
  );

  const openOnThisDay = async () => {
    if (!onThisDay) return;
    const dateKey = format(new Date(onThisDay.memories[0].timestamp), 'yyyy-MM-dd');
    const fullDayMemories = await getMemoriesForDate(dateKey);
    setOnThisDayModalMemories(fullDayMemories);
    setOnThisDayVisible(true);
  };

  const renderHeader = () => (
    <View>
      <View style={styles.headerMetaRow}>
        <Text style={styles.dateLabel}>{format(new Date(), 'EEEE, MMMM d')}</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => setSettingsVisible(true)} style={styles.iconButton}>
            <Text style={styles.iconButtonText}>⚙</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleClearAll} style={styles.clearBtn}>
            <Text style={styles.clearBtnText}>Clear</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.titleRow}>
        <Text style={styles.header}>Your Memories</Text>
      </View>

      <Animated.View style={[styles.digestCard, digestLoading && { opacity: pulse }]}>
        <Text style={styles.digestLabel}>Today&apos;s digest</Text>
        <Text style={styles.digestText}>
          {digestLoading
            ? 'Reflecting on your day...'
            : digest || 'No memories yet today. Walk around to start capturing.'}
        </Text>
        <View style={styles.digestFooter}>
          <Text style={styles.digestSource}>Generated by Gemini</Text>
        </View>
        <TouchableOpacity onPress={() => loadDigest(true)} style={styles.refreshDigest}>
          <Text style={styles.refreshDigestText}>Refresh digest</Text>
        </TouchableOpacity>
      </Animated.View>

      {onThisDay && (
        <TouchableOpacity style={styles.onThisDayCard} activeOpacity={0.85} onPress={openOnThisDay}>
          <Text style={styles.onThisDayLabel}>{onThisDay.label}</Text>
          <Text style={styles.onThisDayPlace}>{onThisDay.memories[0].placeName}</Text>
          <Text style={styles.onThisDayTimestamp}>
            {format(new Date(onThisDay.memories[0].timestamp), 'MMM d, yyyy · h:mm a')}
          </Text>
          <Text style={styles.onThisDayCaption}>{onThisDay.caption}</Text>
        </TouchableOpacity>
      )}

      {memories.length > 0 && (
        <Text style={styles.sectionLabel}>
          {memories.length} memory{memories.length !== 1 ? ' entries' : ''}
        </Text>
      )}
    </View>
  );

  const renderMemory = ({ item }: { item: Memory }) => (
    <View style={[styles.card, { borderLeftColor: getImportanceAccent(item.importanceScore) }]}>
      <View style={styles.cardHeader}>
        <View style={styles.placeNameRow}>
          {item.placeType === 'manual' && <Text style={styles.manualIcon}>✏</Text>}
          <Text style={styles.placeName} numberOfLines={2}>
            {item.placeName}
          </Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{Math.round(item.importanceScore * 100)}%</Text>
        </View>
      </View>
      <Text style={styles.timestamp}>
        {format(new Date(item.timestamp), 'MMM d, yyyy · h:mm a')}
      </Text>
      {item.note &&
        (item.note.startsWith('🎙') ? (
          <View style={styles.voiceNoteRow}>
            <AudioWave />
            <Text style={styles.voiceNote}>{item.note}</Text>
          </View>
        ) : (
          <Text style={styles.note}>{item.note}</Text>
        ))}
    </View>
  );

  const displayedOnThisDayMemories =
    onThisDayModalMemories.length > 0 ? onThisDayModalMemories : onThisDay?.memories || [];

  return (
    <View style={styles.container}>
      {memories.length === 0 && !digestLoading ? (
        <View style={styles.emptyContainer}>
          {renderHeader()}
          <View style={styles.empty}>
            {emptyStateIcon}
            <Text style={styles.emptyTitle}>Start your memory</Text>
            <Text style={styles.emptySubtitle}>
              Walk somewhere new. The app will quietly remember where you&apos;ve been so you
              never have to.
            </Text>
            <TouchableOpacity style={styles.captureNowButton} onPress={onOpenCapture}>
              <Text style={styles.captureNowButtonText}>Capture now</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <FlatList
          data={memories}
          keyExtractor={(item) => item.id}
          renderItem={renderMemory}
          ListHeaderComponent={renderHeader}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#534AB7" />
          }
          contentContainerStyle={styles.list}
        />
      )}

      <Modal
        visible={onThisDayVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setOnThisDayVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setOnThisDayVisible(false)}
          />
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {onThisDay
                  ? `Your day - ${format(new Date(onThisDay.memories[0].timestamp), 'MMMM d, yyyy')}`
                  : 'Your day'}
              </Text>
              <TouchableOpacity onPress={() => setOnThisDayVisible(false)}>
                <Text style={styles.closeText}>Close</Text>
              </TouchableOpacity>
            </View>
            {displayedOnThisDayMemories.map((memory) => (
              <View key={memory.id} style={styles.modalMemoryRow}>
                <Text style={styles.modalTimestamp}>{format(new Date(memory.timestamp), 'h:mm a')}</Text>
                {memory.note ? (
                  <Text style={styles.modalNote}>{memory.note}</Text>
                ) : (
                  <Text style={styles.modalPlace}>{memory.placeName}</Text>
                )}
              </View>
            ))}
          </View>
        </View>
      </Modal>

      <SettingsSheet
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        onDataCleared={() => {
          setMemories([]);
          setDigest(null);
          setOnThisDay(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F', paddingTop: 60 },
  headerMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 6,
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateLabel: { fontSize: 13, color: '#666680' },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  header: { fontSize: 28, fontWeight: '700', color: '#FFFFFF' },
  iconButton: { padding: 6 },
  iconButtonText: { fontSize: 16, color: '#666680' },
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
  digestFooter: { alignItems: 'flex-end', marginTop: 10 },
  digestSource: { fontSize: 10, color: '#666680' },
  refreshDigest: { marginTop: 12, alignSelf: 'flex-end' },
  refreshDigestText: { fontSize: 12, color: '#534AB7' },
  onThisDayCard: {
    backgroundColor: '#1A1600',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 0.5,
    borderColor: '#2A2200',
  },
  onThisDayLabel: {
    fontSize: 11,
    color: '#BA7517',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  onThisDayPlace: { fontSize: 17, fontWeight: '600', color: '#FFFFFF', marginBottom: 6 },
  onThisDayTimestamp: { fontSize: 12, color: '#9C8B5A', marginBottom: 8 },
  onThisDayCaption: { fontSize: 14, color: '#E9D7A3', lineHeight: 22, fontStyle: 'italic' },
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
    borderLeftWidth: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  placeNameRow: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 },
  manualIcon: { fontSize: 12, marginRight: 6 },
  placeName: { fontSize: 15, fontWeight: '500', color: '#FFFFFF', flex: 1 },
  badge: {
    backgroundColor: '#1E1A3E',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgeText: { fontSize: 11, color: '#AFA9EC', fontWeight: '500' },
  timestamp: { fontSize: 12, color: '#666680' },
  note: { fontSize: 13, color: '#A0A0C0', marginTop: 6, fontStyle: 'italic' },
  voiceNoteRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  voiceNote: { fontSize: 13, color: '#8A8AA3', fontStyle: 'italic', flex: 1 },
  audioWave: { flexDirection: 'row', alignItems: 'flex-end', marginRight: 8, gap: 2 },
  audioBar: { width: 3, borderRadius: 2, backgroundColor: '#6F7090' },
  audioBarShort: { height: 8 },
  audioBarMid: { height: 12 },
  audioBarTall: { height: 16 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
  },
  emptyIconOuter: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 1,
    borderColor: '#2A2A3A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyIconInner: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: '#534AB7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#534AB7',
  },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: '#FFFFFF', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#666680', textAlign: 'center', lineHeight: 22 },
  captureNowButton: {
    marginTop: 18,
    backgroundColor: '#534AB7',
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  captureNowButtonText: { fontSize: 15, color: '#FFFFFF', fontWeight: '600' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  modalSheet: {
    backgroundColor: '#16161E',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    minHeight: 260,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF', flex: 1, marginRight: 12 },
  closeText: { fontSize: 14, color: '#534AB7' },
  modalMemoryRow: {
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#2A2A3A',
  },
  modalTimestamp: { fontSize: 12, color: '#666680', marginBottom: 4 },
  modalNote: { fontSize: 14, color: '#C8C8E0', fontStyle: 'italic' },
  modalPlace: { fontSize: 14, color: '#FFFFFF' },
});
