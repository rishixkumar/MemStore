import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { THEME } from '../theme';

type ScreenHeaderProps = {
  dateLabel: string;
  title: string;
  right?: React.ReactNode;
};

export default function ScreenHeader({ dateLabel, title, right }: ScreenHeaderProps) {
  return (
    <View style={styles.row}>
      <View>
        <Text style={styles.dateLabel}>{dateLabel}</Text>
        <Text style={styles.title}>{title}</Text>
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
    paddingHorizontal: THEME.spacing.xl,
    marginBottom: THEME.spacing.lg,
  },
  dateLabel: {
    fontSize: THEME.font.sizes.sm,
    color: THEME.colors.text.tertiary,
    marginBottom: THEME.spacing.sm,
  },
  title: {
    fontSize: THEME.font.sizes.xxxl,
    color: THEME.colors.text.primary,
    fontWeight: THEME.font.weights.bold,
  },
});
