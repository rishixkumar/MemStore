import { format, isToday, isYesterday } from 'date-fns';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  Modal,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Memory } from '../../models/Memory';
import {
  DailyDigestResult,
  LlmProvider,
  generateDailyDigest,
  generateMemoryCaption,
} from '../../intelligence/digestService';
import {
  getAllMemories,
  getDayStreak,
  getMemoriesForDate,
  getMemoryCount,
  getOnThisDayMemories,
  getPlaceCount,
  searchMemories,
} from '../../storage/database';
import MemoryDetailSheet from '../components/MemoryDetailSheet';
import SettingsSheet from '../components/SettingsSheet';
import { GearIcon, NoteIcon, RefreshIcon, SearchIcon, VoiceIcon } from '../components/Icons';
import { THEME } from '../theme';

interface TimelineScreenProps {
  onOpenCapture: () => void;
}

type OnThisDayBucket = 365 | 30 | 7;

type DigestState = DailyDigestResult | null;

type OnThisDayState = {
  daysAgo: OnThisDayBucket;
  label: string;
  memories: Memory[];
  caption: string;
} | null;

type StatCard = {
  id: string;
  label: string;
  value: number;
  suffix: string;
  accentColor: string;
};

type MemorySection = {
  title: string;
  data: Memory[];
};

const ON_THIS_DAY_PRIORITIES: Array<{ daysAgo: OnThisDayBucket; label: string }> = [
  { daysAgo: 365, label: '1 YEAR AGO' },
  { daysAgo: 30, label: '30 DAYS AGO' },
  { daysAgo: 7, label: '1 WEEK AGO' },
];

function getImportanceAccent(score: number) {
  if (score >= 0.9) return THEME.colors.brand.primary;
  if (score >= 0.7) return THEME.colors.accent.teal;
  return THEME.colors.border.medium;
}

function getDayLabel(timestamp: number) {
  const date = new Date(timestamp);
  if (isToday(date)) return 'TODAY';
  if (isYesterday(date)) return 'YESTERDAY';
  return format(date, 'MMMM d').toUpperCase();
}

function groupMemoriesByDay(memories: Memory[]): MemorySection[] {
  const groups = new Map<string, Memory[]>();

  for (const memory of memories) {
    const key = getDayLabel(memory.timestamp);
    const existing = groups.get(key) ?? [];
    existing.push(memory);
    groups.set(key, existing);
  }

  return Array.from(groups.entries()).map(([title, data]) => ({ title, data }));
}

function ProviderBadge({ provider }: { provider: LlmProvider }) {
  const palette =
    provider === 'gemini'
      ? {
          backgroundColor: THEME.colors.provider.geminiBg,
          color: THEME.colors.accent.teal,
          label: 'Gemini',
        }
      : provider === 'ollama'
        ? {
            backgroundColor: THEME.colors.provider.ollamaBg,
            color: THEME.colors.brand.primary,
            label: 'Ollama',
          }
        : {
            backgroundColor: THEME.colors.bg.overlay,
            color: THEME.colors.text.tertiary,
            label: 'Offline',
          };

  return (
    <View style={[styles.providerBadge, { backgroundColor: palette.backgroundColor }]}>
      <Text style={[styles.providerBadgeText, { color: palette.color }]}>{palette.label}</Text>
    </View>
  );
}

function DigestSkeleton({ opacity }: { opacity: Animated.Value }) {
  return (
    <Animated.View style={[styles.digestSkeletonWrap, { opacity }]}>
      <View style={[styles.digestSkeletonLine, { width: '90%' }]} />
      <View style={[styles.digestSkeletonLine, { width: '75%' }]} />
      <View style={[styles.digestSkeletonLine, styles.digestSkeletonShort, { width: '45%' }]} />
    </Animated.View>
  );
}

function MemoryKindTag({ memory }: { memory: Memory }) {
  if (memory.placeType !== 'manual') {
    return null;
  }

  return (
    <View style={styles.manualTag}>
      <Text style={styles.manualTagText}>note</Text>
    </View>
  );
}

function StatCardView({ stat }: { stat: StatCard }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{stat.label}</Text>
      <Text style={[styles.statValue, { color: stat.accentColor }]}>{stat.value}</Text>
      <Text style={styles.statSuffix}>{stat.suffix}</Text>
    </View>
  );
}

export default function TimelineScreen({ onOpenCapture }: TimelineScreenProps) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [digest, setDigest] = useState<DigestState>(null);
  const [digestLoading, setDigestLoading] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);
  const [memorySheetVisible, setMemorySheetVisible] = useState(false);
  const [onThisDay, setOnThisDay] = useState<OnThisDayState>(null);
  const [onThisDayVisible, setOnThisDayVisible] = useState(false);
  const [onThisDayModalMemories, setOnThisDayModalMemories] = useState<Memory[]>([]);
  const [searchText, setSearchText] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [searchResults, setSearchResults] = useState<Memory[]>([]);
  const [searchFocused, setSearchFocused] = useState(false);
  const [stats, setStats] = useState({ streak: 0, places: 0, memories: 0 });
  const shimmer = useRef(new Animated.Value(0.15)).current;

  const today = format(new Date(), 'yyyy-MM-dd');
  const isSearchActive = searchText.trim().length > 0;

  const loadMemories = useCallback(async () => {
    const all = await getAllMemories();
    setMemories(all);
  }, []);

  const loadStats = useCallback(async () => {
    const [streak, places, memoriesCount] = await Promise.all([
      getDayStreak(),
      getPlaceCount(),
      getMemoryCount(),
    ]);

    setStats({ streak, places, memories: memoriesCount });
  }, []);

  const loadDigest = useCallback(
    async (forceRefresh = false) => {
      setDigestLoading(true);
      try {
        const result = await generateDailyDigest(today, forceRefresh);
        setDigest(result);
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
        const caption = await generateMemoryCaption(
          memoriesForDay[0].placeName,
          memoriesForDay[0].timestamp
        );
        setOnThisDay({
          daysAgo: candidate.daysAgo,
          label: candidate.label,
          memories: memoriesForDay,
          caption: caption || 'You were here.',
        });
        return;
      }
    }

    setOnThisDay(null);
  }, []);

  const loadSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    const results = await searchMemories(query);
    setSearchResults(results);
  }, []);

  useEffect(() => {
    loadMemories();
    loadDigest(false);
    loadOnThisDay();
    loadStats();
  }, [loadDigest, loadMemories, loadOnThisDay, loadStats]);

  useEffect(() => {
    const handle = setTimeout(() => {
      setSearchText(searchDraft);
      loadSearch(searchDraft);
    }, 300);

    return () => clearTimeout(handle);
  }, [loadSearch, searchDraft]);

  useEffect(() => {
    if (!digestLoading) {
      shimmer.setValue(0.15);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 0.35,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 0.15,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();

    return () => {
      animation.stop();
      shimmer.setValue(0.15);
    };
  }, [digestLoading, shimmer]);

  const statCards = useMemo<StatCard[]>(
    () => [
      {
        id: 'streak',
        label: 'DAY STREAK',
        value: stats.streak,
        suffix: 'days',
        accentColor: THEME.colors.brand.primary,
      },
      {
        id: 'places',
        label: 'PLACES',
        value: stats.places,
        suffix: 'learned',
        accentColor: THEME.colors.text.primary,
      },
      {
        id: 'memories',
        label: 'MEMORIES',
        value: stats.memories,
        suffix: 'captured',
        accentColor: THEME.colors.text.primary,
      },
    ],
    [stats]
  );

  const displayedMemories = isSearchActive ? searchResults : memories;
  const sections = useMemo(() => groupMemoriesByDay(displayedMemories), [displayedMemories]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadMemories(), loadDigest(true), loadOnThisDay(), loadStats()]);
    if (searchText.trim()) {
      await loadSearch(searchText);
    }
    setRefreshing(false);
  };

  const openOnThisDay = async () => {
    if (!onThisDay) return;
    const dateKey = format(new Date(onThisDay.memories[0].timestamp), 'yyyy-MM-dd');
    const fullDayMemories = await getMemoriesForDate(dateKey);
    setOnThisDayModalMemories(fullDayMemories);
    setOnThisDayVisible(true);
  };

  const openMemory = (memory: Memory) => {
    setSelectedMemory(memory);
    setMemorySheetVisible(true);
  };

  const renderMemoryCard = ({ item }: { item: Memory }) => (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={() => openMemory(item)}
      style={[styles.card, { borderLeftColor: getImportanceAccent(item.importanceScore) }]}
    >
      <View style={styles.cardTopRow}>
        <View style={styles.cardTitleWrap}>
          {item.memoryKind === 'note' && <NoteIcon color={THEME.colors.text.secondary} size={16} />}
          {item.memoryKind === 'voice' && (
            <VoiceIcon color={THEME.colors.text.secondary} size={16} />
          )}
          <Text style={styles.placeName} numberOfLines={2}>
            {item.placeName}
          </Text>
        </View>
        <MemoryKindTag memory={item} />
      </View>
      <Text style={styles.timestamp}>{format(new Date(item.timestamp), 'MMM d, yyyy · h:mm a')}</Text>
      {item.note ? (
        <View style={styles.noteBlock}>
          <Text style={styles.noteText}>{item.note}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );

  const renderSectionHeader = ({ section }: { section: MemorySection }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{section.title}</Text>
    </View>
  );

  const renderListHeader = () => (
    <View style={styles.headerContent}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.dateLabel}>{format(new Date(), 'EEEE, MMM d')}</Text>
          <Text style={styles.headerTitle}>Memories</Text>
        </View>
        <TouchableOpacity
          onPress={() => setSettingsVisible(true)}
          style={styles.settingsButton}
          activeOpacity={0.85}
        >
          <GearIcon />
        </TouchableOpacity>
      </View>

      <FlatList
        data={statCards}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.statsRow}
        renderItem={({ item }) => <StatCardView stat={item} />}
      />

      <View
        style={[
          styles.searchBar,
          { borderColor: searchFocused ? THEME.colors.border.strong : THEME.colors.border.subtle },
        ]}
      >
        <SearchIcon />
        <TextInput
          value={searchDraft}
          onChangeText={setSearchDraft}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          placeholder="Search your memories..."
          placeholderTextColor={THEME.colors.text.tertiary}
          style={styles.searchInput}
        />
      </View>

      {isSearchActive ? (
        <View style={styles.searchMetaRow}>
          <Text style={styles.searchMetaText}>{searchResults.length} memories found</Text>
        </View>
      ) : (
        <>
          <View style={styles.digestCard}>
            <View style={styles.digestAccentLine} />
            <Text style={styles.digestLabel}>TODAY</Text>
            {digestLoading ? (
              <DigestSkeleton opacity={shimmer} />
            ) : (
              <Text style={styles.digestText}>
                {digest?.summary ||
                  'No memories yet today. Walk around and your day will begin to take shape.'}
              </Text>
            )}
            <View style={styles.digestFooter}>
              <ProviderBadge provider={digest?.provider || 'fallback'} />
              <TouchableOpacity
                onPress={() => loadDigest(true)}
                style={styles.refreshButton}
                hitSlop={12}
                activeOpacity={0.85}
              >
                <RefreshIcon />
              </TouchableOpacity>
            </View>
          </View>

          {onThisDay ? (
            <TouchableOpacity style={styles.onThisDayCard} activeOpacity={0.9} onPress={openOnThisDay}>
              <Text style={styles.onThisDayLabel}>{onThisDay.label}</Text>
              <Text style={styles.onThisDayPlace}>{onThisDay.memories[0].placeName}</Text>
              <Text style={styles.onThisDayDate}>
                {format(new Date(onThisDay.memories[0].timestamp), 'MMM d, yyyy')}
              </Text>
              <Text style={styles.onThisDayCaption}>{onThisDay.caption}</Text>
            </TouchableOpacity>
          ) : null}
        </>
      )}
    </View>
  );

  const displayedOnThisDayMemories =
    onThisDayModalMemories.length > 0 ? onThisDayModalMemories : onThisDay?.memories || [];

  return (
    <View style={styles.container}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={renderMemoryCard}
        renderSectionHeader={renderSectionHeader}
        ListHeaderComponent={renderListHeader}
        stickySectionHeadersEnabled
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={THEME.colors.brand.primary}
          />
        }
        contentContainerStyle={[
          styles.listContent,
          sections.length === 0 ? styles.listContentEmpty : undefined,
        ]}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>{isSearchActive ? 'Nothing found' : 'Start your memory'}</Text>
            <Text style={styles.emptySubtitle}>
              {isSearchActive
                ? 'Try a place name, note fragment, or a nearby date.'
                : "Walk somewhere new or capture a moment. Ambient Memory will quietly keep up."}
            </Text>
            {!isSearchActive ? (
              <TouchableOpacity style={styles.captureNowButton} onPress={onOpenCapture}>
                <Text style={styles.captureNowButtonText}>Capture now</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        }
      />

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
                  ? format(new Date(onThisDay.memories[0].timestamp), 'MMMM d, yyyy')
                  : 'On This Day'}
              </Text>
              <TouchableOpacity onPress={() => setOnThisDayVisible(false)}>
                <Text style={styles.closeText}>Close</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={displayedOnThisDayMemories}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.modalMemoryRow}>
                  <Text style={styles.modalTimestamp}>{format(new Date(item.timestamp), 'h:mm a')}</Text>
                  <Text style={styles.modalPlace}>{item.placeName}</Text>
                  {item.note ? <Text style={styles.modalNote}>{item.note}</Text> : null}
                </View>
              )}
            />
          </View>
        </View>
      </Modal>

      <SettingsSheet
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        onDataCleared={async () => {
          setMemories([]);
          setDigest(null);
          setOnThisDay(null);
          setSearchResults([]);
          setSearchDraft('');
          setSearchText('');
          setStats({ streak: 0, places: 0, memories: 0 });
          await loadStats();
        }}
      />

      <MemoryDetailSheet
        visible={memorySheetVisible}
        memory={selectedMemory}
        onClose={() => setMemorySheetVisible(false)}
        onMemoryChanged={async () => {
          await Promise.all([loadMemories(), loadDigest(true), loadOnThisDay(), loadStats()]);
          if (searchText.trim()) {
            await loadSearch(searchText);
          }
        }}
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
  listContent: {
    paddingBottom: 180,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  headerContent: {
    paddingBottom: THEME.spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: THEME.spacing.xl,
    marginBottom: THEME.spacing.lg,
  },
  dateLabel: {
    fontSize: THEME.font.sizes.sm,
    color: THEME.colors.text.tertiary,
    fontWeight: THEME.font.weights.regular,
    marginBottom: THEME.spacing.sm,
  },
  headerTitle: {
    fontSize: THEME.font.sizes.xxxl,
    color: THEME.colors.text.primary,
    fontWeight: THEME.font.weights.bold,
  },
  settingsButton: {
    width: 36,
    height: 36,
    borderRadius: THEME.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.bg.elevated,
    borderWidth: 0.5,
    borderColor: THEME.colors.border.subtle,
  },
  statsRow: {
    paddingHorizontal: THEME.spacing.xl,
    gap: THEME.spacing.md,
    marginBottom: THEME.spacing.lg,
  },
  statCard: {
    width: 100,
    height: 120,
    backgroundColor: THEME.colors.bg.elevated,
    borderRadius: THEME.radius.md,
    borderWidth: 0.5,
    borderColor: THEME.colors.border.subtle,
    paddingHorizontal: THEME.spacing.lg,
    paddingVertical: THEME.spacing.lg,
    justifyContent: 'space-between',
  },
  statLabel: {
    fontSize: 9,
    letterSpacing: 1,
    color: THEME.colors.text.tertiary,
    fontWeight: THEME.font.weights.semibold,
  },
  statValue: {
    fontSize: 28,
    fontWeight: THEME.font.weights.bold,
  },
  statSuffix: {
    fontSize: THEME.font.sizes.sm,
    color: THEME.colors.text.tertiary,
  },
  searchBar: {
    height: 40,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    backgroundColor: THEME.colors.bg.elevated,
    marginHorizontal: THEME.spacing.xl,
    paddingHorizontal: THEME.spacing.lg,
    alignItems: 'center',
    flexDirection: 'row',
    gap: THEME.spacing.md,
    marginBottom: THEME.spacing.lg,
  },
  searchInput: {
    flex: 1,
    color: THEME.colors.text.primary,
    fontSize: THEME.font.sizes.md,
  },
  searchMetaRow: {
    paddingHorizontal: THEME.spacing.xl,
    marginBottom: THEME.spacing.sm,
  },
  searchMetaText: {
    color: THEME.colors.text.tertiary,
    fontSize: THEME.font.sizes.sm,
  },
  digestCard: {
    marginHorizontal: THEME.spacing.xl,
    marginBottom: THEME.spacing.lg,
    backgroundColor: THEME.colors.bg.elevated,
    borderRadius: THEME.radius.lg,
    borderWidth: 0.5,
    borderColor: THEME.colors.border.subtle,
    overflow: 'hidden',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  digestAccentLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 2,
    backgroundColor: THEME.colors.brand.primary,
  },
  digestLabel: {
    color: THEME.colors.brand.primary,
    fontSize: THEME.font.sizes.xs,
    letterSpacing: 2,
    fontWeight: THEME.font.weights.semibold,
    marginBottom: THEME.spacing.md,
  },
  digestText: {
    color: THEME.colors.text.primary,
    fontSize: THEME.font.sizes.lg,
    lineHeight: 26,
    fontWeight: THEME.font.weights.regular,
    minHeight: 104,
  },
  digestFooter: {
    marginTop: THEME.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  providerBadge: {
    borderRadius: THEME.radius.full,
    paddingHorizontal: THEME.spacing.sm,
    paddingVertical: 3,
  },
  providerBadgeText: {
    fontSize: 9,
    fontWeight: THEME.font.weights.medium,
  },
  refreshButton: {
    width: 24,
    height: 24,
    borderRadius: THEME.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digestSkeletonWrap: {
    gap: THEME.spacing.md,
    minHeight: 104,
    justifyContent: 'center',
  },
  digestSkeletonLine: {
    height: 14,
    borderRadius: THEME.radius.full,
    backgroundColor: THEME.colors.bg.overlay,
  },
  digestSkeletonShort: {
    height: 10,
  },
  onThisDayCard: {
    marginHorizontal: THEME.spacing.xl,
    marginBottom: THEME.spacing.lg,
    backgroundColor: THEME.colors.accent.amberSoft,
    borderRadius: THEME.radius.lg,
    borderWidth: 0.5,
    borderColor: THEME.colors.border.subtle,
    borderLeftWidth: 2.5,
    borderLeftColor: THEME.colors.accent.amber,
    paddingHorizontal: THEME.spacing.lg,
    paddingVertical: THEME.spacing.lg,
  },
  onThisDayLabel: {
    color: THEME.colors.accent.amber,
    fontSize: THEME.font.sizes.xs,
    fontWeight: THEME.font.weights.semibold,
    letterSpacing: 2,
    marginBottom: THEME.spacing.sm,
  },
  onThisDayPlace: {
    color: THEME.colors.text.primary,
    fontSize: 15,
    fontWeight: THEME.font.weights.medium,
    marginBottom: THEME.spacing.xs,
  },
  onThisDayDate: {
    color: THEME.colors.text.secondary,
    fontSize: THEME.font.sizes.sm,
    marginBottom: THEME.spacing.sm,
  },
  onThisDayCaption: {
    color: THEME.colors.text.primary,
    fontSize: THEME.font.sizes.md,
    lineHeight: 20,
  },
  sectionHeader: {
    backgroundColor: THEME.colors.bg.base,
    paddingHorizontal: THEME.spacing.xl,
    paddingVertical: THEME.spacing.sm,
  },
  sectionHeaderText: {
    color: THEME.colors.text.tertiary,
    fontSize: 11,
    fontWeight: THEME.font.weights.semibold,
    letterSpacing: 1.5,
  },
  card: {
    backgroundColor: THEME.colors.bg.surface,
    borderRadius: THEME.radius.md,
    borderWidth: 0.5,
    borderColor: THEME.colors.border.subtle,
    borderLeftWidth: 2.5,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginHorizontal: THEME.spacing.xl,
    marginBottom: 2,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: THEME.spacing.sm,
  },
  cardTitleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.sm,
  },
  placeName: {
    flex: 1,
    color: THEME.colors.text.primary,
    fontSize: 15,
    fontWeight: THEME.font.weights.medium,
  },
  timestamp: {
    marginTop: THEME.spacing.xs,
    color: THEME.colors.text.tertiary,
    fontSize: 11,
  },
  noteBlock: {
    borderTopWidth: 0.5,
    borderTopColor: THEME.colors.border.subtle,
    paddingTop: 10,
    marginTop: 10,
  },
  noteText: {
    color: THEME.colors.text.secondary,
    fontSize: 13,
    lineHeight: 19,
  },
  manualTag: {
    backgroundColor: THEME.colors.brand.soft,
    borderRadius: THEME.radius.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  manualTagText: {
    color: THEME.colors.brand.primary,
    fontSize: 9,
    fontWeight: THEME.font.weights.semibold,
    letterSpacing: 0.5,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: THEME.spacing.xxxl,
    paddingTop: THEME.spacing.xxxl,
  },
  emptyTitle: {
    color: THEME.colors.text.primary,
    fontSize: THEME.font.sizes.xl,
    fontWeight: THEME.font.weights.semibold,
    marginBottom: THEME.spacing.sm,
  },
  emptySubtitle: {
    color: THEME.colors.text.secondary,
    fontSize: THEME.font.sizes.md,
    lineHeight: 22,
    textAlign: 'center',
  },
  captureNowButton: {
    marginTop: THEME.spacing.xl,
    backgroundColor: THEME.colors.brand.primary,
    borderRadius: THEME.radius.md,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  captureNowButtonText: {
    color: THEME.colors.text.primary,
    fontSize: THEME.font.sizes.md,
    fontWeight: THEME.font.weights.semibold,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
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
    minHeight: 280,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: THEME.spacing.lg,
  },
  modalTitle: {
    flex: 1,
    marginRight: THEME.spacing.md,
    color: THEME.colors.text.primary,
    fontSize: THEME.font.sizes.xl,
    fontWeight: THEME.font.weights.bold,
  },
  closeText: {
    color: THEME.colors.brand.primary,
    fontSize: THEME.font.sizes.md,
  },
  modalMemoryRow: {
    paddingVertical: THEME.spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: THEME.colors.border.subtle,
  },
  modalTimestamp: {
    color: THEME.colors.text.tertiary,
    fontSize: THEME.font.sizes.sm,
    marginBottom: THEME.spacing.xs,
  },
  modalPlace: {
    color: THEME.colors.text.primary,
    fontSize: THEME.font.sizes.md,
    fontWeight: THEME.font.weights.medium,
  },
  modalNote: {
    color: THEME.colors.text.secondary,
    fontSize: THEME.font.sizes.md,
    marginTop: THEME.spacing.xs,
    lineHeight: 20,
  },
});
