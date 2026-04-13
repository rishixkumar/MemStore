import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';

type ScreenHeaderProps = {
  dateLabel: string;
  title: string;
  right?: React.ReactNode;
};

export default function ScreenHeader({ dateLabel, title, right }: ScreenHeaderProps) {
  const { theme } = useTheme();

  return (
    <View style={styles.row}>
      <View>
        <Text style={[styles.dateLabel, { color: theme.colors.text.tertiary }]}>{dateLabel}</Text>
        <Text style={[styles.title, { color: theme.colors.text.primary }]}>{title}</Text>
      </View>
      {right ? <View>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  dateLabel: {
    fontSize: 12,
    marginBottom: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
  },
});
