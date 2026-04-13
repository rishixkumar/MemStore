import { format } from 'date-fns';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
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
import BottomSheetModal, { SheetHeader } from '../components/BottomSheet';
import EmptyState from '../components/EmptyState';
import MemoryDetailSheet from '../components/MemoryDetailSheet';
import ScreenHeader from '../components/ScreenHeader';
import SettingsSheet from '../components/SettingsSheet';
import { GearIcon, RefreshIcon, SearchIcon } from '../components/Icons';
import DigestSkeleton from '../components/timeline/DigestSkeleton';
import MemoryCard from '../components/timeline/MemoryCard';
import OnThisDayCard from '../components/timeline/OnThisDayCard';
import ProviderBadge from '../components/timeline/ProviderBadge';
import StatCard from '../components/timeline/StatCard';
import { THEME } from '../theme';
import {
  formatMemoryTime,
  groupItemsByDay,
  SectionedItems,
} from '../../utils/date';

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
  const sections = useMemo<SectionedItems<Memory>[]>(
    () => groupItemsByDay(displayedMemories),
    [displayedMemories]
  );

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
    <MemoryCard
      memory={item}
      accentColor={getImportanceAccent(item.importanceScore)}
      onPress={() => openMemory(item)}
    />
  );

  const renderSectionHeader = ({ section }: { section: SectionedItems<Memory> }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{section.title}</Text>
    </View>
  );

  const renderListHeader = () => (
    <View style={styles.headerContent}>
      <ScreenHeader
        dateLabel={format(new Date(), 'EEEE, MMM d')}
        title="Memories"
        right={
        <TouchableOpacity
          onPress={() => setSettingsVisible(true)}
          style={styles.settingsButton}
          activeOpacity={0.85}
        >
          <GearIcon />
        </TouchableOpacity>
        }
      />

      <FlatList
        data={statCards}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.statsRow}
        renderItem={({ item }) => <StatCard {...item} />}
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
            <OnThisDayCard
              label={onThisDay.label}
              memories={onThisDay.memories}
              caption={onThisDay.caption}
              onPress={openOnThisDay}
            />
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
          <EmptyState
            title={isSearchActive ? 'Nothing found' : 'Start your memory'}
            description={
              isSearchActive
                ? 'Try a place name, note fragment, or a nearby date.'
                : 'Walk somewhere new or capture a moment. Ambient Memory will quietly keep up.'
            }
            actionLabel={isSearchActive ? undefined : 'Capture now'}
            onActionPress={isSearchActive ? undefined : onOpenCapture}
          />
        }
      />

      <BottomSheetModal
        visible={onThisDayVisible}
        onClose={() => setOnThisDayVisible(false)}
        panelStyle={styles.modalSheet}
      >
        <SheetHeader
          title={onThisDay ? format(new Date(onThisDay.memories[0].timestamp), 'MMMM d, yyyy') : 'On This Day'}
          onClose={() => setOnThisDayVisible(false)}
        />
        <FlatList
          data={displayedOnThisDayMemories}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.modalMemoryRow}>
              <Text style={styles.modalTimestamp}>{formatMemoryTime(item.timestamp)}</Text>
              <Text style={styles.modalPlace}>{item.placeName}</Text>
              {item.note ? <Text style={styles.modalNote}>{item.note}</Text> : null}
            </View>
          )}
        />
      </BottomSheetModal>

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
  refreshButton: {
    width: 24,
    height: 24,
    borderRadius: THEME.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
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
  modalSheet: {
    minHeight: 280,
    maxHeight: '70%',
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
