import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { endOfWeek, format, startOfWeek } from 'date-fns';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { Memory } from '../../models/Memory';
import {
  getHourlyDistribution,
  getMemoryCount,
  getTopMemoriesByImportance,
  getTopPlacesByVisits,
  getWeeklyNewPlaces,
  PlaceVisitStat,
  WeeklyNewPlaceBucket,
} from '../../storage/database';
import EmptyState from '../components/EmptyState';
import MemoryDetailSheet from '../components/MemoryDetailSheet';
import ScreenHeader from '../components/ScreenHeader';
import { useTheme } from '../theme';
import { formatMemoryDateTime } from '../../utils/date';

const CHART_DURATION_MS = 400;
const STAGGER_MS = 45;
const MIN_MEMORIES_FOR_INSIGHTS = 5;
const HISTOGRAM_LABEL_HOURS = [6, 12, 18, 0];
const HIGHLIGHT_CARD_WIDTH = 220;
const HIGHLIGHT_CARD_GAP = 12;

type RootTabParamList = {
  Timeline: undefined;
  Places: { openPlaceName?: string } | undefined;
  Insights: undefined;
  Archive: undefined;
};

function useStaggeredBarAnimation(
  count: number,
  runToken: number,
  enabled: boolean
): Animated.Value[] {
  const refs = useRef<Animated.Value[]>([]);
  if (refs.current.length !== count) {
    refs.current = Array.from({ length: count }, () => new Animated.Value(0));
  }
  const values = refs.current;

  useEffect(() => {
    if (!enabled || count === 0) {
      return;
    }
    values.forEach((v) => v.setValue(0));
    const animations = values.map((v) =>
      Animated.timing(v, {
        toValue: 1,
        duration: CHART_DURATION_MS,
        useNativeDriver: false,
      })
    );
    Animated.stagger(STAGGER_MS, animations).start();
  }, [count, enabled, runToken]);

  return values;
}

function SectionTitle({ children }: { children: string }) {
  const { theme } = useTheme();
  return (
    <Text style={[styles.sectionTitle, { color: theme.colors.text.primary }]}>{children}</Text>
  );
}

function SectionSubtitle({ children }: { children: string }) {
  const { theme } = useTheme();
  return (
    <Text style={[styles.sectionSubtitle, { color: theme.colors.text.secondary }]}>{children}</Text>
  );
}

export default function InsightsScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();
  const [memoryCount, setMemoryCount] = useState(0);
  const [topPlacesWeek, setTopPlacesWeek] = useState<PlaceVisitStat[]>([]);
  const [hourly, setHourly] = useState<number[]>(new Array(24).fill(0));
  const [topMemories, setTopMemories] = useState<Memory[]>([]);
  const [weeklyNew, setWeeklyNew] = useState<WeeklyNewPlaceBucket[]>([]);
  const [animToken, setAnimToken] = useState(0);
  const [barTrackWidth, setBarTrackWidth] = useState(0);
  const [weekChartWidth, setWeekChartWidth] = useState(0);
  const [selectedWeekStart, setSelectedWeekStart] = useState<number | null>(null);
  const [activeHighlightIndex, setActiveHighlightIndex] = useState(0);

  const [detailMemory, setDetailMemory] = useState<Memory | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const hasEnoughData = memoryCount >= MIN_MEMORIES_FOR_INSIGHTS;

  const maxPlaceVisits = useMemo(
    () => Math.max(1, ...topPlacesWeek.map((p) => p.visitCount)),
    [topPlacesWeek]
  );
  const maxHourly = useMemo(() => Math.max(1, ...hourly), [hourly]);
  const maxWeeklyNew = useMemo(
    () => Math.max(1, ...weeklyNew.map((w) => w.newPlaceCount)),
    [weeklyNew]
  );
  const selectedWeekBucket = useMemo(
    () => weeklyNew.find((bucket) => bucket.weekStart === selectedWeekStart) ?? weeklyNew[weeklyNew.length - 1] ?? null,
    [selectedWeekStart, weeklyNew]
  );
  const activeHighlight = topMemories[activeHighlightIndex] ?? null;

  const placeBarAnims = useStaggeredBarAnimation(topPlacesWeek.length, animToken, hasEnoughData);
  const hourAnims = useStaggeredBarAnimation(24, animToken, hasEnoughData);
  const weekColAnims = useStaggeredBarAnimation(weeklyNew.length, animToken, hasEnoughData);

  const load = useCallback(async () => {
    const now = new Date();
    const wStart = startOfWeek(now, { weekStartsOn: 1 });
    const wEnd = endOfWeek(now, { weekStartsOn: 1 });
    const startTs = wStart.getTime();
    const endTs = wEnd.getTime();

    const [count, places, hours, highlights, weeks] = await Promise.all([
      getMemoryCount(),
      getTopPlacesByVisits(5, startTs, endTs),
      getHourlyDistribution(),
      getTopMemoriesByImportance(3),
      getWeeklyNewPlaces(8),
    ]);

    setMemoryCount(count);
    setTopPlacesWeek(places);
    setHourly(hours);
    setTopMemories(highlights);
    setWeeklyNew(weeks);
    setSelectedWeekStart((current) => {
      if (weeks.length === 0) {
        return null;
      }
      if (current && weeks.some((bucket) => bucket.weekStart === current)) {
        return current;
      }
      return weeks[weeks.length - 1].weekStart;
    });
    setActiveHighlightIndex((current) => {
      if (highlights.length === 0) {
        return 0;
      }
      return Math.min(current, highlights.length - 1);
    });
    setAnimToken((t) => t + 1);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const onBarTrackLayout = useCallback((e: LayoutChangeEvent) => {
    setBarTrackWidth(e.nativeEvent.layout.width);
  }, []);

  const onWeekChartLayout = useCallback((e: LayoutChangeEvent) => {
    setWeekChartWidth(e.nativeEvent.layout.width);
  }, []);

  const openPlace = useCallback(
    (placeName: string) => {
      navigation.navigate('Places', { openPlaceName: placeName });
    },
    [navigation]
  );

  const onHighlightsMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (topMemories.length === 0) {
        return;
      }
      const nextIndex = Math.round(event.nativeEvent.contentOffset.x / (HIGHLIGHT_CARD_WIDTH + HIGHLIGHT_CARD_GAP));
      const boundedIndex = Math.min(Math.max(nextIndex, 0), topMemories.length - 1);
      setActiveHighlightIndex(boundedIndex);
    },
    [topMemories.length]
  );

  const weekRangeLabel = useMemo(() => {
    const now = new Date();
    const wStart = startOfWeek(now, { weekStartsOn: 1 });
    const wEnd = endOfWeek(now, { weekStartsOn: 1 });
    return `${format(wStart, 'MMM d')}–${format(wEnd, 'MMM d')}`;
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg.base }]}>
      <ScreenHeader dateLabel={format(new Date(), 'EEEE, MMM d')} title="Insights" />

      {!hasEnoughData ? (
        <EmptyState
          title="A few more memories"
          description="Once you have at least five saved moments, this space fills in with gentle patterns from your week—where you went, when you tend to pause, and what stood out."
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.block}>
            <SectionTitle>Your week in places</SectionTitle>
            <SectionSubtitle>{`Top spots by visits · ${weekRangeLabel}`}</SectionSubtitle>
            <View style={styles.cardWrap}>
              <View style={[styles.card, { backgroundColor: theme.colors.bg.surface, borderColor: theme.colors.border.subtle }]}>
                {topPlacesWeek.length === 0 ? (
                  <Text style={[styles.muted, { color: theme.colors.text.secondary }]}>
                    No visits logged this week yet—carry the app and check back.
                  </Text>
                ) : (
                  <View style={styles.placeBars}>
                    {topPlacesWeek.map((row, i) => {
                      const targetW =
                        barTrackWidth > 0
                          ? (row.visitCount / maxPlaceVisits) * barTrackWidth
                          : 0;
                      const anim = placeBarAnims[i] ?? new Animated.Value(1);
                      const widthAnim = anim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, Math.max(6, targetW)],
                      });
                      return (
                        <TouchableOpacity
                          key={`${row.placeName}-${i}`}
                          style={styles.placeRow}
                          onPress={() => openPlace(row.placeName)}
                          activeOpacity={0.85}
                        >
                          <Text
                            style={[styles.placeLabel, { color: theme.colors.text.secondary }]}
                            numberOfLines={1}
                          >
                            {row.placeName}
                          </Text>
                          <View style={styles.barTrack} onLayout={i === 0 ? onBarTrackLayout : undefined}>
                            <Animated.View
                              style={[
                                styles.barFill,
                                {
                                  width: widthAnim,
                                  backgroundColor: theme.colors.brand.primary,
                                },
                              ]}
                            />
                          </View>
                          <Text style={[styles.placeCount, { color: theme.colors.text.tertiary }]}>
                            {row.visitCount}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            </View>
          </View>

          <View style={styles.block}>
            <SectionTitle>Time of day patterns</SectionTitle>
            <SectionSubtitle>When your memories tend to land (local time)</SectionSubtitle>
            <View style={[styles.card, { backgroundColor: theme.colors.bg.surface, borderColor: theme.colors.border.subtle }]}>
              <View style={styles.histogram}>
                {hourly.map((c, h) => {
                  const targetH = (c / maxHourly) * 112;
                  const anim = hourAnims[h] ?? new Animated.Value(1);
                  const hAnim = anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, Math.max(4, targetH)],
                  });
                  return (
                    <View key={h} style={styles.histCol}>
                      <Animated.View
                        style={[
                          styles.histBar,
                          {
                            height: hAnim,
                            backgroundColor:
                              c === maxHourly && c > 0
                                ? theme.colors.accent.amber
                                : theme.colors.brand.soft,
                            borderColor: theme.colors.brand.primary,
                          },
                        ]}
                      />
                    </View>
                  );
                })}
              </View>
              <View style={styles.histLabels}>
                {HISTOGRAM_LABEL_HOURS.map((hr) => {
                  const leftPct = (hr / 24) * 100;
                  const label =
                    hr === 0 ? '12a' : hr === 6 ? '6a' : hr === 12 ? '12p' : '6p';
                  return (
                    <Text
                      key={hr}
                      style={[
                        styles.histLabel,
                        {
                          color: theme.colors.text.tertiary,
                          left: `${leftPct}%`,
                        },
                      ]}
                    >
                      {label}
                    </Text>
                  );
                })}
              </View>
            </View>
          </View>

          <View style={styles.block}>
            <SectionTitle>Most memorable moments</SectionTitle>
            <SectionSubtitle>Swipe through your standout moments and tap any card to open the full memory</SectionSubtitle>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.highlightsRow}
              snapToInterval={HIGHLIGHT_CARD_WIDTH + HIGHLIGHT_CARD_GAP}
              decelerationRate="fast"
              disableIntervalMomentum
              onMomentumScrollEnd={onHighlightsMomentumEnd}
            >
              {topMemories.map((m) => {
                const score = Math.min(1, Math.max(0, m.importanceScore));
                return (
                  <TouchableOpacity
                    key={m.id}
                    style={[
                      styles.highlightCard,
                      {
                        borderColor: theme.colors.border.subtle,
                        backgroundColor: theme.colors.bg.elevated,
                      },
                    ]}
                    onPress={() => {
                      setDetailMemory(m);
                      setDetailOpen(true);
                    }}
                    activeOpacity={0.9}
                  >
                    <Svg width={220} height={132} style={StyleSheet.absoluteFill}>
                      <Defs>
                        <RadialGradient id={`g-${m.id}`} cx="78%" cy="22%" r="58%">
                          <Stop offset="0%" stopColor={theme.colors.accent.amber} stopOpacity={0.22 + score * 0.28} />
                          <Stop offset="100%" stopColor={theme.colors.accent.teal} stopOpacity={0} />
                        </RadialGradient>
                      </Defs>
                      <Rect width="100%" height="100%" fill={`url(#g-${m.id})`} />
                    </Svg>
                    <View style={styles.highlightInner}>
                      <Text style={[styles.highlightPlace, { color: theme.colors.text.primary }]} numberOfLines={2}>
                        {m.placeName}
                      </Text>
                      <Text style={[styles.highlightTime, { color: theme.colors.text.tertiary }]}>
                        {formatMemoryDateTime(m.timestamp)}
                      </Text>
                      {m.note ? (
                        <Text style={[styles.highlightNote, { color: theme.colors.text.secondary }]} numberOfLines={3}>
                          {m.note}
                        </Text>
                      ) : null}
                      <View style={styles.scorePill}>
                        <Text style={[styles.scoreText, { color: theme.colors.accent.amber }]}>
                          {Math.round(score * 100)}% resonance
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            {activeHighlight ? (
              <View
                style={[
                  styles.highlightMetaCard,
                  {
                    backgroundColor: theme.colors.bg.surface,
                    borderColor: theme.colors.border.subtle,
                  },
                ]}
              >
                <View style={styles.highlightDots}>
                  {topMemories.map((memory, index) => (
                    <View
                      key={memory.id}
                      style={[
                        styles.highlightDot,
                        {
                          backgroundColor:
                            index === activeHighlightIndex
                              ? theme.colors.brand.primary
                              : theme.colors.border.subtle,
                        },
                      ]}
                    />
                  ))}
                </View>
                <Text style={[styles.highlightMetaTitle, { color: theme.colors.text.primary }]}>
                  {`Viewing #${activeHighlightIndex + 1} of ${topMemories.length}: ${activeHighlight.placeName}`}
                </Text>
                <Text style={[styles.highlightMetaBody, { color: theme.colors.text.secondary }]}>
                  {`Saved ${formatMemoryDateTime(activeHighlight.timestamp)} with ${Math.round(
                    Math.min(1, Math.max(0, activeHighlight.importanceScore)) * 100
                  )}% resonance.`}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={[styles.block, { marginBottom: 32 }]}>
            <SectionTitle>Places over time</SectionTitle>
            <SectionSubtitle>Tap a bar to inspect how many first-time places were logged that week</SectionSubtitle>
            <View style={[styles.card, { backgroundColor: theme.colors.bg.surface, borderColor: theme.colors.border.subtle }]}>
              <View style={styles.weekChart} onLayout={onWeekChartLayout}>
                {weeklyNew.map((w, i) => {
                  const targetH = weekChartWidth > 0 ? (w.newPlaceCount / maxWeeklyNew) * 120 : 0;
                  const anim = weekColAnims[i] ?? new Animated.Value(1);
                  const colH = anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, Math.max(6, targetH)],
                  });
                  const colW = weekChartWidth > 0 ? weekChartWidth / 8 - 6 : 8;
                  const isSelected = selectedWeekBucket?.weekStart === w.weekStart;
                  return (
                    <TouchableOpacity
                      key={`${w.weekStart}`}
                      style={[styles.weekCol, { width: Math.max(10, colW) }]}
                      onPress={() => setSelectedWeekStart(w.weekStart)}
                      activeOpacity={0.85}
                    >
                      <Text
                        style={[
                          styles.weekValue,
                          {
                            color: isSelected ? theme.colors.text.primary : theme.colors.text.tertiary,
                          },
                        ]}
                      >
                        {w.newPlaceCount}
                      </Text>
                      <Animated.View
                        style={[
                          styles.weekBar,
                          {
                            height: colH,
                            backgroundColor: isSelected ? theme.colors.accent.amber : theme.colors.accent.teal,
                            borderColor: isSelected ? theme.colors.accent.amber : theme.colors.accent.teal,
                            opacity: isSelected ? 1 : 0.82,
                          },
                        ]}
                      />
                      <Text style={[styles.weekLabel, { color: theme.colors.text.tertiary }]} numberOfLines={1}>
                        {w.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {selectedWeekBucket ? (
                <View
                  style={[
                    styles.weekInsightCard,
                    {
                      backgroundColor: theme.colors.bg.elevated,
                      borderColor: theme.colors.border.subtle,
                    },
                  ]}
                >
                  <Text style={[styles.weekInsightTitle, { color: theme.colors.text.primary }]}>
                    {`${selectedWeekBucket.newPlaceCount} new place${
                      selectedWeekBucket.newPlaceCount === 1 ? '' : 's'
                    } during the week of ${format(new Date(selectedWeekBucket.weekStart), 'MMM d')}`}
                  </Text>
                  <Text style={[styles.weekInsightBody, { color: theme.colors.text.secondary }]}>
                    {`${format(new Date(selectedWeekBucket.weekStart), 'MMM d')} to ${format(
                      new Date(selectedWeekBucket.weekEnd),
                      'MMM d'
                    )} tracked first-time visits in your memory stream.`}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </ScrollView>
      )}

      <MemoryDetailSheet
        visible={detailOpen}
        memory={detailMemory}
        onClose={() => setDetailOpen(false)}
        onMemoryChanged={load}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 64,
  },
  scroll: {
    paddingHorizontal: 24,
    paddingBottom: 160,
  },
  block: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  cardWrap: {
    width: '100%',
  },
  card: {
    borderRadius: 16,
    borderWidth: 0.5,
    padding: 16,
  },
  muted: {
    fontSize: 14,
    lineHeight: 21,
  },
  placeBars: {
    gap: 12,
  },
  placeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  placeLabel: {
    width: 88,
    fontSize: 12,
    fontWeight: '500',
  },
  barTrack: {
    flex: 1,
    height: 10,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: 'rgba(128,128,128,0.12)',
  },
  barFill: {
    height: '100%',
    borderRadius: 999,
  },
  placeCount: {
    width: 22,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'right',
  },
  histogram: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 120,
    paddingTop: 8,
    gap: 1,
  },
  histCol: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  histBar: {
    width: '100%',
    borderRadius: 3,
    borderWidth: 0.5,
    minHeight: 2,
  },
  histLabels: {
    marginTop: 10,
    height: 16,
    position: 'relative',
  },
  histLabel: {
    position: 'absolute',
    fontSize: 10,
    fontWeight: '500',
    transform: [{ translateX: -8 }],
  },
  highlightsRow: {
    gap: 12,
    paddingVertical: 4,
    paddingRight: 24,
  },
  highlightCard: {
    width: HIGHLIGHT_CARD_WIDTH,
    minHeight: 132,
    borderRadius: 16,
    borderWidth: 0.5,
    overflow: 'hidden',
  },
  highlightInner: {
    padding: 14,
    gap: 6,
    flex: 1,
  },
  highlightPlace: {
    fontSize: 15,
    fontWeight: '600',
  },
  highlightTime: {
    fontSize: 11,
  },
  highlightNote: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  scorePill: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  scoreText: {
    fontSize: 11,
    fontWeight: '600',
  },
  highlightMetaCard: {
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 0.5,
    padding: 14,
    gap: 8,
  },
  highlightDots: {
    flexDirection: 'row',
    gap: 6,
  },
  highlightDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  highlightMetaTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  highlightMetaBody: {
    fontSize: 13,
    lineHeight: 19,
  },
  weekChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 164,
    paddingTop: 8,
  },
  weekCol: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  weekValue: {
    minHeight: 16,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  weekBar: {
    width: '100%',
    borderRadius: 6,
    borderWidth: 0.5,
    minHeight: 2,
  },
  weekLabel: {
    fontSize: 9,
    fontWeight: '500',
    textAlign: 'center',
  },
  weekInsightCard: {
    marginTop: 16,
    borderRadius: 14,
    borderWidth: 0.5,
    padding: 14,
    gap: 6,
  },
  weekInsightTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  weekInsightBody: {
    fontSize: 13,
    lineHeight: 19,
  },
});
