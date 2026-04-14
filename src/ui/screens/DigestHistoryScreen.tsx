import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { format, formatDistanceToNow } from 'date-fns';
import ScreenHeader from '../components/ScreenHeader';
import EmptyState from '../components/EmptyState';
import ProviderBadge from '../components/timeline/ProviderBadge';
import { useTheme } from '../theme';
import { DigestHistoryEntry, getDigestHistoryEntries } from '../../storage/database';

type ArchiveGroupMode = 'flat' | 'day';
type ArchiveListItem =
  | { type: 'group'; key: string; dayKey: string; title: string; count: number }
  | { type: 'entry'; key: string; item: DigestHistoryEntry; index: number; dayKey: string };

export default function DigestHistoryScreen() {
  const { theme } = useTheme();
  const [entries, setEntries] = useState<DigestHistoryEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [groupMode, setGroupMode] = useState<ArchiveGroupMode>('flat');
  const [expandedEntryIds, setExpandedEntryIds] = useState<Record<string, boolean>>({});
  const [collapsedDays, setCollapsedDays] = useState<Record<string, boolean>>({});

  const loadEntries = useCallback(async () => {
    const nextEntries = await getDigestHistoryEntries();
    setEntries(nextEntries);
  }, []);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadEntries();
    setRefreshing(false);
  };

  const archiveSummary = useMemo(() => {
    const latest = entries[0];
    return {
      total: entries.length,
      provider: latest?.provider || 'fallback',
      latestPlace: latest?.placeName || 'No archived places yet',
    };
  }, [entries]);

  const groupedEntries = useMemo(() => {
    return entries.reduce<Array<{ dayKey: string; title: string; items: DigestHistoryEntry[] }>>((groups, entry) => {
      const dayKey = format(new Date(entry.createdAt), 'yyyy-MM-dd');
      const existing = groups.find((group) => group.dayKey === dayKey);
      if (existing) {
        existing.items.push(entry);
        return groups;
      }
      groups.push({
        dayKey,
        title: format(new Date(entry.createdAt), 'EEEE, MMM d'),
        items: [entry],
      });
      return groups;
    }, []);
  }, [entries]);

  const visibleItems = useMemo<ArchiveListItem[]>(() => {
    if (groupMode === 'flat') {
      return entries.map((item, index) => ({
        type: 'entry',
        key: item.id,
        item,
        index,
        dayKey: format(new Date(item.createdAt), 'yyyy-MM-dd'),
      }));
    }

    return groupedEntries.flatMap((group) => {
      const items: ArchiveListItem[] = [
        {
          type: 'group',
          key: `group-${group.dayKey}`,
          dayKey: group.dayKey,
          title: group.title,
          count: group.items.length,
        },
      ];

      if (collapsedDays[group.dayKey]) {
        return items;
      }

      return items.concat(
        group.items.map((item, index) => ({
          type: 'entry',
          key: item.id,
          item,
          index,
          dayKey: group.dayKey,
        }))
      );
    });
  }, [collapsedDays, entries, groupMode, groupedEntries]);

  const allExpanded = entries.length > 0 && entries.every((entry) => expandedEntryIds[entry.id]);

  const toggleEntryExpanded = useCallback((entryId: string) => {
    setExpandedEntryIds((current) => ({
      ...current,
      [entryId]: !current[entryId],
    }));
  }, []);

  const setAllExpanded = useCallback((expanded: boolean) => {
    setExpandedEntryIds(
      expanded ? Object.fromEntries(entries.map((entry) => [entry.id, true])) : {}
    );
  }, [entries]);

  const toggleDayCollapsed = useCallback((dayKey: string) => {
    setCollapsedDays((current) => ({
      ...current,
      [dayKey]: !current[dayKey],
    }));
  }, []);

  const setAllDaysCollapsed = useCallback((collapsed: boolean) => {
    setCollapsedDays(
      collapsed ? Object.fromEntries(groupedEntries.map((group) => [group.dayKey, true])) : {}
    );
  }, [groupedEntries]);

  const isEntryExpanded = useCallback(
    (entryId: string) => {
      return allExpanded || !!expandedEntryIds[entryId];
    },
    [allExpanded, expandedEntryIds]
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg.base }]}>
      <FlatList
        data={visibleItems}
        keyExtractor={(item) => item.key}
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
          entries.length === 0 ? styles.listContentEmpty : undefined,
        ]}
        ListHeaderComponent={
          <View style={styles.headerWrap}>
            <ScreenHeader dateLabel={format(new Date(), 'EEEE, MMM d')} title="Archive" />

            <View
              style={[
                styles.heroCard,
                {
                  backgroundColor: theme.colors.bg.elevated,
                  borderColor: theme.colors.border.subtle,
                  shadowColor: theme.colors.shadow.strong,
                },
              ]}
            >
              <View
                style={[
                  styles.heroGlow,
                  { backgroundColor: theme.isDark ? theme.colors.brand.soft : theme.colors.brand.glow },
                ]}
              />
              <Text style={[styles.heroEyebrow, { color: theme.colors.brand.primary }]}>
                DIGEST ARCHIVE
              </Text>
              <Text style={[styles.heroTitle, { color: theme.colors.text.primary }]}>
                Revisit every generated reflection.
              </Text>
              <Text style={[styles.heroDescription, { color: theme.colors.text.secondary }]}>
                Each archive entry captures the generated summary, its provider, and the place tied to
                that moment.
              </Text>

              <View style={styles.heroStatsRow}>
                <View
                  style={[
                    styles.heroStatCard,
                    { backgroundColor: theme.colors.bg.surface, borderColor: theme.colors.border.subtle },
                  ]}
                >
                  <Text style={[styles.heroStatLabel, { color: theme.colors.text.tertiary }]}>ENTRIES</Text>
                  <Text style={[styles.heroStatValue, { color: theme.colors.text.primary }]}>
                    {archiveSummary.total}
                  </Text>
                </View>
                <View
                  style={[
                    styles.heroStatCard,
                    { backgroundColor: theme.colors.bg.surface, borderColor: theme.colors.border.subtle },
                  ]}
                >
                  <Text style={[styles.heroStatLabel, { color: theme.colors.text.tertiary }]}>LATEST PLACE</Text>
                  <Text style={[styles.heroStatValueCompact, { color: theme.colors.text.primary }]} numberOfLines={2}>
                    {archiveSummary.latestPlace}
                  </Text>
                </View>
              </View>

              <View style={styles.heroFooter}>
                <ProviderBadge provider={archiveSummary.provider as 'gemini' | 'ollama' | 'fallback'} />
                <Text style={[styles.heroFooterText, { color: theme.colors.text.tertiary }]}>
                  Updated {entries[0] ? formatDistanceToNow(new Date(entries[0].createdAt), { addSuffix: true }) : 'when a new digest is generated'}
                </Text>
              </View>
            </View>

            {entries.length > 0 ? (
              <View style={styles.controlsWrap}>
                <View style={styles.segmentRow}>
                  <TouchableOpacity
                    style={[
                      styles.segmentButton,
                      {
                        backgroundColor: groupMode === 'flat' ? theme.colors.brand.primary : theme.colors.bg.surface,
                        borderColor: theme.colors.border.subtle,
                      },
                    ]}
                    onPress={() => setGroupMode('flat')}
                    activeOpacity={0.85}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        {
                          color:
                            groupMode === 'flat' ? theme.colors.text.inverse : theme.colors.text.secondary,
                        },
                      ]}
                    >
                      All reflections
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.segmentButton,
                      {
                        backgroundColor: groupMode === 'day' ? theme.colors.brand.primary : theme.colors.bg.surface,
                        borderColor: theme.colors.border.subtle,
                      },
                    ]}
                    onPress={() => setGroupMode('day')}
                    activeOpacity={0.85}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        {
                          color:
                            groupMode === 'day' ? theme.colors.text.inverse : theme.colors.text.secondary,
                        },
                      ]}
                    >
                      Group by day
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.controlPillsRow}>
                  <TouchableOpacity
                    style={[
                      styles.controlPill,
                      { backgroundColor: theme.colors.bg.surface, borderColor: theme.colors.border.subtle },
                    ]}
                    onPress={() => setAllExpanded(true)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.controlPillText, { color: theme.colors.text.primary }]}>Expand all</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.controlPill,
                      { backgroundColor: theme.colors.bg.surface, borderColor: theme.colors.border.subtle },
                    ]}
                    onPress={() => setAllExpanded(false)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.controlPillText, { color: theme.colors.text.primary }]}>Compact all</Text>
                  </TouchableOpacity>
                  {groupMode === 'day' ? (
                    <TouchableOpacity
                      style={[
                        styles.controlPill,
                        { backgroundColor: theme.colors.bg.surface, borderColor: theme.colors.border.subtle },
                      ]}
                      onPress={() => setAllDaysCollapsed(false)}
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.controlPillText, { color: theme.colors.text.primary }]}>
                        Expand days
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                  {groupMode === 'day' ? (
                    <TouchableOpacity
                      style={[
                        styles.controlPill,
                        { backgroundColor: theme.colors.bg.surface, borderColor: theme.colors.border.subtle },
                      ]}
                      onPress={() => setAllDaysCollapsed(true)}
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.controlPillText, { color: theme.colors.text.primary }]}>
                        Compact days
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title="No digest archive yet"
            description="A new archive entry will appear whenever a fresh daily digest is generated after the cache window expires or you manually refresh it."
          />
        }
        renderItem={({ item }) => {
          if (item.type === 'group') {
            const collapsed = !!collapsedDays[item.dayKey];
            return (
              <TouchableOpacity
                style={[
                  styles.groupCard,
                  {
                    backgroundColor: theme.colors.bg.surface,
                    borderColor: theme.colors.border.subtle,
                  },
                ]}
                onPress={() => toggleDayCollapsed(item.dayKey)}
                activeOpacity={0.85}
              >
                <View>
                  <Text style={[styles.groupTitle, { color: theme.colors.text.primary }]}>{item.title}</Text>
                  <Text style={[styles.groupMeta, { color: theme.colors.text.secondary }]}>
                    {`${item.count} reflection${item.count === 1 ? '' : 's'}`}
                  </Text>
                </View>
                <Text style={[styles.groupChevron, { color: theme.colors.text.tertiary }]}>
                  {collapsed ? 'Expand' : 'Collapse'}
                </Text>
              </TouchableOpacity>
            );
          }

          const entry = item.item;
          const expanded = isEntryExpanded(entry.id);
          const overallIndex = entries.findIndex((candidate) => candidate.id === entry.id);

          return (
            <TouchableOpacity
              style={[
                styles.entryCard,
                {
                  backgroundColor: theme.colors.bg.elevated,
                  borderColor: theme.colors.border.subtle,
                },
              ]}
              onPress={() => toggleEntryExpanded(entry.id)}
              activeOpacity={0.9}
            >
              <View
                style={[
                  styles.entryAccent,
                  {
                    backgroundColor:
                      entry.provider === 'gemini'
                        ? theme.colors.accent.teal
                        : entry.provider === 'ollama'
                          ? theme.colors.brand.primary
                          : theme.colors.accent.amber,
                  },
                ]}
              />
              <View style={styles.entryTopRow}>
                <View style={styles.entryTopMeta}>
                  <Text style={[styles.entryDate, { color: theme.colors.text.tertiary }]}>
                    {format(new Date(entry.createdAt), 'MMM d, yyyy · h:mm a')}
                  </Text>
                  <Text style={[styles.entryPlace, { color: theme.colors.text.primary }]}>{entry.placeName}</Text>
                </View>
                <ProviderBadge provider={entry.provider as 'gemini' | 'ollama' | 'fallback'} />
              </View>

              <Text
                style={[styles.entrySummary, { color: theme.colors.text.primary }]}
                numberOfLines={expanded ? undefined : 3}
              >
                {entry.summary}
              </Text>

              <View style={[styles.entryBottomRow, { borderTopColor: theme.colors.border.subtle }]}>
                <Text style={[styles.entryIndex, { color: theme.colors.text.tertiary }]}>
                  #{String(entries.length - overallIndex).padStart(2, '0')}
                </Text>
                <Text style={[styles.entryRelativeTime, { color: theme.colors.text.secondary }]}>
                  {expanded ? 'Tap to compact' : 'Tap to expand'}
                </Text>
              </View>
            </TouchableOpacity>
          );
        }}
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
    paddingBottom: 160,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  headerWrap: {
    paddingBottom: 20,
  },
  controlsWrap: {
    marginTop: 18,
    paddingHorizontal: 24,
    gap: 12,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 10,
  },
  segmentButton: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 0.5,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
  },
  controlPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  controlPill: {
    borderRadius: 999,
    borderWidth: 0.5,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  controlPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  heroCard: {
    marginHorizontal: 24,
    borderRadius: 24,
    borderWidth: 0.5,
    padding: 22,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 8,
  },
  heroGlow: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 999,
    top: -120,
    right: -60,
    opacity: 0.16,
  },
  heroEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '700',
    maxWidth: '90%',
  },
  heroDescription: {
    marginTop: 12,
    fontSize: 14,
    lineHeight: 22,
    maxWidth: '92%',
  },
  heroStatsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  heroStatCard: {
    flex: 1,
    minHeight: 92,
    borderRadius: 18,
    borderWidth: 0.5,
    padding: 14,
    justifyContent: 'space-between',
  },
  heroStatLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  heroStatValue: {
    fontSize: 30,
    fontWeight: '700',
  },
  heroStatValueCompact: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
  },
  heroFooter: {
    marginTop: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  heroFooterText: {
    flex: 1,
    textAlign: 'right',
    fontSize: 12,
  },
  groupCard: {
    marginHorizontal: 24,
    marginBottom: 10,
    borderRadius: 16,
    borderWidth: 0.5,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  groupTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  groupMeta: {
    marginTop: 4,
    fontSize: 12,
  },
  groupChevron: {
    fontSize: 12,
    fontWeight: '600',
  },
  entryCard: {
    marginHorizontal: 24,
    marginBottom: 12,
    borderRadius: 18,
    borderWidth: 0.5,
    padding: 18,
    overflow: 'hidden',
  },
  entryAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
  entryTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  entryTopMeta: {
    flex: 1,
  },
  entryDate: {
    fontSize: 12,
    marginBottom: 6,
  },
  entryPlace: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
  },
  entrySummary: {
    marginTop: 18,
    fontSize: 15,
    lineHeight: 24,
  },
  entryBottomRow: {
    marginTop: 18,
    paddingTop: 12,
    borderTopWidth: 0.5,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  entryIndex: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  entryRelativeTime: {
    fontSize: 12,
  },
});
