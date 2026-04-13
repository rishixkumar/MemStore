import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { format, formatDistanceToNow } from 'date-fns';
import ScreenHeader from '../components/ScreenHeader';
import EmptyState from '../components/EmptyState';
import ProviderBadge from '../components/timeline/ProviderBadge';
import { useTheme } from '../theme';
import { DigestHistoryEntry, getDigestHistoryEntries } from '../../storage/database';

export default function DigestHistoryScreen() {
  const { theme } = useTheme();
  const [entries, setEntries] = useState<DigestHistoryEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);

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

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg.base }]}>
      <FlatList
        data={entries}
        keyExtractor={(item) => item.id}
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
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title="No digest archive yet"
            description="A new archive entry will appear whenever a fresh daily digest is generated after the cache window expires or you manually refresh it."
          />
        }
        renderItem={({ item, index }) => (
          <View
            style={[
              styles.entryCard,
              {
                backgroundColor: theme.colors.bg.elevated,
                borderColor: theme.colors.border.subtle,
              },
            ]}
          >
            <View
              style={[
                styles.entryAccent,
                {
                  backgroundColor:
                    item.provider === 'gemini'
                      ? theme.colors.accent.teal
                      : item.provider === 'ollama'
                        ? theme.colors.brand.primary
                        : theme.colors.accent.amber,
                },
              ]}
            />
            <View style={styles.entryTopRow}>
              <View style={styles.entryTopMeta}>
                <Text style={[styles.entryDate, { color: theme.colors.text.tertiary }]}>
                  {format(new Date(item.createdAt), 'MMM d, yyyy · h:mm a')}
                </Text>
                <Text style={[styles.entryPlace, { color: theme.colors.text.primary }]}>{item.placeName}</Text>
              </View>
              <ProviderBadge provider={item.provider as 'gemini' | 'ollama' | 'fallback'} />
            </View>

            <Text style={[styles.entrySummary, { color: theme.colors.text.primary }]}>{item.summary}</Text>

            <View style={[styles.entryBottomRow, { borderTopColor: theme.colors.border.subtle }]}>
              <Text style={[styles.entryIndex, { color: theme.colors.text.tertiary }]}>
                #{String(entries.length - index).padStart(2, '0')}
              </Text>
              <Text style={[styles.entryRelativeTime, { color: theme.colors.text.secondary }]}>
                {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
              </Text>
            </View>
          </View>
        )}
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
