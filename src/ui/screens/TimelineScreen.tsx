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
import { getMemoryKind } from '../../models/Memory';
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
import ShareMemoryModal from '../components/timeline/ShareMemoryModal';
import ProviderBadge from '../components/timeline/ProviderBadge';
import StatCard from '../components/timeline/StatCard';
import { useTheme } from '../theme';
import {
  formatMemoryTime,
  getNextTenMinuteBoundary,
  groupItemsByDay,
  SectionedItems,
} from '../../utils/date';
import { logger } from '../../utils/logger';

interface TimelineScreenProps {
  onOpenCapture: () => void;
}

type OnThisDayBucket = 365 | 30 | 7;

type DigestState = DailyDigestResult | null;
type TimelineLayoutMode = 'days' | 'places';

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

type PlaceTimelineSection = {
  title: string;
  data: Memory[];
  key: string;
  latestTimestamp: number;
  placeType: string;
};

const ON_THIS_DAY_PRIORITIES: Array<{ daysAgo: OnThisDayBucket; label: string }> = [
  { daysAgo: 365, label: '1 YEAR AGO' },
  { daysAgo: 30, label: '30 DAYS AGO' },
  { daysAgo: 7, label: '1 WEEK AGO' },
];

function buildPlaceSections(memories: Memory[], order: 'asc' | 'desc') {
  const grouped = memories.reduce<Record<string, PlaceTimelineSection>>((acc, memory) => {
    if (!acc[memory.placeName]) {
      acc[memory.placeName] = {
        key: memory.placeName,
        title: memory.placeName,
        data: [],
        latestTimestamp: memory.timestamp,
        placeType: memory.placeType,
      };
    }

    acc[memory.placeName].data.push(memory);
    acc[memory.placeName].latestTimestamp = Math.max(acc[memory.placeName].latestTimestamp, memory.timestamp);
    return acc;
  }, {});

  return Object.values(grouped)
    .map((section) => ({
      ...section,
      data: [...section.data].sort((a, b) =>
        order === 'asc' ? a.timestamp - b.timestamp : b.timestamp - a.timestamp
      ),
    }))
    .sort((a, b) =>
      order === 'asc' ? a.latestTimestamp - b.latestTimestamp : b.latestTimestamp - a.latestTimestamp
    );
}

export default function TimelineScreen({ onOpenCapture }: TimelineScreenProps) {
  const { theme } = useTheme();
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
  const [timelineMode, setTimelineMode] = useState<TimelineLayoutMode>('days');
  const [placeSortOrder, setPlaceSortOrder] = useState<'desc' | 'asc'>('desc');
  const [collapsedPlaces, setCollapsedPlaces] = useState<Record<string, boolean>>({});
  const [shareMemory, setShareMemory] = useState<Memory | null>(null);
  const [shareCaption, setShareCaption] = useState('');
  const shimmer = useRef(new Animated.Value(0.15)).current;

  const getImportanceAccent = useCallback(
    (_score: number, memoryKind: ReturnType<typeof getMemoryKind>) => {
      if (memoryKind === 'note') return theme.colors.accent.teal;
      if (memoryKind === 'voice') return theme.colors.accent.amber;
      return theme.colors.brand.primary;
    },
    [theme]
  );

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
        logger.error('Timeline', 'Digest loading failed.', e);
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

  useEffect(() => {
    const msUntilNextBoundary = Math.max(1000, getNextTenMinuteBoundary() - Date.now());
    const timeout = setTimeout(() => {
      loadDigest(false);
    }, msUntilNextBoundary);

    return () => clearTimeout(timeout);
  }, [digest?.summary, loadDigest]);

  const statCards = useMemo<StatCard[]>(
    () => [
      {
        id: 'streak',
        label: 'DAY STREAK',
        value: stats.streak,
        suffix: 'days',
        accentColor: theme.colors.brand.primary,
      },
      {
        id: 'places',
        label: 'PLACES',
        value: stats.places,
        suffix: 'learned',
        accentColor: theme.colors.text.primary,
      },
      {
        id: 'memories',
        label: 'MEMORIES',
        value: stats.memories,
        suffix: 'captured',
        accentColor: theme.colors.text.primary,
      },
    ],
    [stats, theme]
  );

  const displayedMemories = isSearchActive ? searchResults : memories;
  const daySections = useMemo<SectionedItems<Memory>[]>(
    () => groupItemsByDay(displayedMemories),
    [displayedMemories]
  );
  const placeSections = useMemo<PlaceTimelineSection[]>(
    () => buildPlaceSections(displayedMemories, placeSortOrder),
    [displayedMemories, placeSortOrder]
  );
  const sections = timelineMode === 'places' ? placeSections : daySections;

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadMemories(), loadDigest(false), loadOnThisDay(), loadStats()]);
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

  const openShareForMemory = useCallback(async (memory: Memory) => {
    const caption = await Promise.race([
      generateMemoryCaption(memory.placeName, memory.timestamp).catch(() => ''),
      new Promise<string>((resolve) => {
        setTimeout(() => resolve(''), 3000);
      }),
    ]);
    setShareCaption(typeof caption === 'string' ? caption : '');
    setShareMemory(memory);
  }, []);

  const closeShareMemory = useCallback(() => {
    setShareMemory(null);
    setShareCaption('');
  }, []);

  const togglePlaceCollapsed = (placeName: string) => {
    setCollapsedPlaces((current) => ({
      ...current,
      [placeName]: !current[placeName],
    }));
  };

  const renderMemoryCard = ({ item }: { item: Memory }) => (
    <MemoryCard
      memory={item}
      accentColor={getImportanceAccent(item.importanceScore, getMemoryKind(item))}
      onPress={() => openMemory(item)}
      onLongPress={() => {
        void openShareForMemory(item);
      }}
    />
  );

  const renderSectionHeader = ({
    section,
  }: {
    section: SectionedItems<Memory> | PlaceTimelineSection;
  }) => {
    if (timelineMode === 'places') {
      const placeSection = section as PlaceTimelineSection;
      const isCollapsed = Boolean(collapsedPlaces[placeSection.key]);
      return (
        <TouchableOpacity
          style={[styles.sectionHeader, { backgroundColor: theme.colors.bg.base }]}
          onPress={() => togglePlaceCollapsed(placeSection.key)}
          activeOpacity={0.85}
        >
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionHeaderMeta}>
              <Text style={[styles.sectionHeaderText, { color: theme.colors.text.secondary }]}>
                {placeSection.title}
              </Text>
              <Text style={[styles.sectionHeaderCount, { color: theme.colors.text.tertiary }]}>
                {placeSection.data.length} memories
              </Text>
            </View>
            <Text style={[styles.sectionHeaderAction, { color: theme.colors.brand.primary }]}>
              {isCollapsed ? 'Expand' : 'Collapse'}
            </Text>
          </View>
        </TouchableOpacity>
      );
    }

    return (
      <View style={[styles.sectionHeader, { backgroundColor: theme.colors.bg.base }]}>
        <Text style={[styles.sectionHeaderText, { color: theme.colors.text.tertiary }]}>
          {(section as SectionedItems<Memory>).title}
        </Text>
      </View>
    );
  };

  const renderTimelineControls = () => (
    <View style={styles.controlsWrap}>
      <View style={[styles.segmentedControl, { backgroundColor: theme.colors.bg.overlay }]}>
        <TouchableOpacity
          style={[
            styles.segment,
            timelineMode === 'days' && {
              backgroundColor: theme.colors.bg.surface,
              borderColor: theme.colors.border.subtle,
            },
          ]}
          onPress={() => setTimelineMode('days')}
          activeOpacity={0.85}
        >
          <Text
            style={[
              styles.segmentText,
              { color: timelineMode === 'days' ? theme.colors.text.primary : theme.colors.text.secondary },
            ]}
          >
            By day
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.segment,
            timelineMode === 'places' && {
              backgroundColor: theme.colors.bg.surface,
              borderColor: theme.colors.border.subtle,
            },
          ]}
          onPress={() => setTimelineMode('places')}
          activeOpacity={0.85}
        >
          <Text
            style={[
              styles.segmentText,
              { color: timelineMode === 'places' ? theme.colors.text.primary : theme.colors.text.secondary },
            ]}
          >
            By place
          </Text>
        </TouchableOpacity>
      </View>

      {timelineMode === 'places' ? (
        <View style={styles.inlineControlsRow}>
          <TouchableOpacity
            style={[styles.chip, { backgroundColor: theme.colors.bg.elevated, borderColor: theme.colors.border.subtle }]}
            onPress={() => setPlaceSortOrder((current) => (current === 'desc' ? 'asc' : 'desc'))}
            activeOpacity={0.85}
          >
            <Text style={[styles.chipText, { color: theme.colors.text.primary }]}>
              {placeSortOrder === 'desc' ? 'Newest first' : 'Oldest first'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.chip, { backgroundColor: theme.colors.bg.elevated, borderColor: theme.colors.border.subtle }]}
            onPress={() =>
              setCollapsedPlaces(
                Object.fromEntries(placeSections.map((section) => [section.key, true]))
              )
            }
            activeOpacity={0.85}
          >
            <Text style={[styles.chipText, { color: theme.colors.text.secondary }]}>Collapse all</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.chip, { backgroundColor: theme.colors.bg.elevated, borderColor: theme.colors.border.subtle }]}
            onPress={() => setCollapsedPlaces({})}
            activeOpacity={0.85}
          >
            <Text style={[styles.chipText, { color: theme.colors.text.secondary }]}>Expand all</Text>
          </TouchableOpacity>
        </View>
      ) : null}
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
          style={[
            styles.settingsButton,
            {
              backgroundColor: theme.colors.bg.elevated,
              borderColor: theme.colors.border.subtle,
            },
          ]}
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
          {
            borderColor: searchFocused ? theme.colors.border.strong : theme.colors.border.subtle,
            backgroundColor: theme.colors.bg.elevated,
          },
        ]}
      >
        <SearchIcon />
        <TextInput
          value={searchDraft}
          onChangeText={setSearchDraft}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          placeholder="Search your memories..."
          placeholderTextColor={theme.colors.text.tertiary}
          style={[styles.searchInput, { color: theme.colors.text.primary }]}
        />
      </View>

      {isSearchActive ? null : renderTimelineControls()}

      {isSearchActive ? (
        <View style={styles.searchMetaRow}>
          <Text style={[styles.searchMetaText, { color: theme.colors.text.tertiary }]}>
            {searchResults.length} memories found
          </Text>
        </View>
      ) : (
        <>
          <View
            style={[
              styles.digestCard,
              {
                backgroundColor: theme.colors.bg.elevated,
                borderColor: theme.colors.border.subtle,
              },
            ]}
          >
            <View style={[styles.digestAccentLine, { backgroundColor: theme.colors.brand.primary }]} />
            <Text style={[styles.digestLabel, { color: theme.colors.brand.primary }]}>TODAY</Text>
            {digestLoading ? (
              <DigestSkeleton opacity={shimmer} />
            ) : (
              <Text style={[styles.digestText, { color: theme.colors.text.primary }]}>
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
    <View style={[styles.container, { backgroundColor: theme.colors.bg.base }]}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item, section }) => {
          if (timelineMode === 'places' && collapsedPlaces[(section as PlaceTimelineSection).key]) {
            return null;
          }

          return renderMemoryCard({ item });
        }}
        renderSectionHeader={renderSectionHeader}
        ListHeaderComponent={renderListHeader}
        stickySectionHeadersEnabled
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.brand.primary}
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
              <Text style={[styles.modalTimestamp, { color: theme.colors.text.tertiary }]}>
                {formatMemoryTime(item.timestamp)}
              </Text>
              <Text style={[styles.modalPlace, { color: theme.colors.text.primary }]}>{item.placeName}</Text>
              {item.note ? (
                <Text style={[styles.modalNote, { color: theme.colors.text.secondary }]}>{item.note}</Text>
              ) : null}
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
          await Promise.all([loadMemories(), loadDigest(false), loadOnThisDay(), loadStats()]);
          if (searchText.trim()) {
            await loadSearch(searchText);
          }
        }}
      />

      <ShareMemoryModal
        visible={shareMemory !== null}
        memory={shareMemory}
        caption={shareCaption}
        onClose={closeShareMemory}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 64,
  },
  listContent: {
    paddingBottom: 180,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  headerContent: {
    paddingBottom: 12,
  },
  settingsButton: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
  },
  statsRow: {
    paddingHorizontal: 24,
    gap: 12,
    marginBottom: 16,
  },
  searchBar: {
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  controlsWrap: {
    paddingHorizontal: 24,
    gap: 10,
    marginBottom: 18,
  },
  segmentedControl: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 14,
    gap: 6,
  },
  segment: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentText: {
    fontSize: 14,
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
  searchMetaRow: {
    paddingHorizontal: 24,
    marginBottom: 8,
  },
  searchMetaText: {
    fontSize: 12,
  },
  digestCard: {
    marginHorizontal: 24,
    marginBottom: 16,
    borderRadius: 16,
    borderWidth: 0.5,
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
  },
  digestLabel: {
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: '600',
    marginBottom: 12,
  },
  digestText: {
    fontSize: 16,
    lineHeight: 26,
    fontWeight: '400',
    minHeight: 104,
  },
  digestFooter: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  refreshButton: {
    width: 24,
    height: 24,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeader: {
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  sectionHeaderMeta: {
    flex: 1,
  },
  sectionHeaderText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.5,
  },
  sectionHeaderCount: {
    fontSize: 11,
    marginTop: 2,
  },
  sectionHeaderAction: {
    fontSize: 12,
    fontWeight: '600',
  },
  modalSheet: {
    minHeight: 280,
    maxHeight: '70%',
  },
  modalMemoryRow: {
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#00000000',
  },
  modalTimestamp: {
    fontSize: 12,
    marginBottom: 4,
  },
  modalPlace: {
    fontSize: 14,
    fontWeight: '500',
  },
  modalNote: {
    fontSize: 14,
    marginTop: 4,
    lineHeight: 20,
  },
});
