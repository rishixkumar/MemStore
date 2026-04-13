import { StyleSheet } from 'react-native';
import { AppTheme } from './theme';

export function createThemedStyles<T extends StyleSheet.NamedStyles<T>>(
  factory: (theme: AppTheme) => T
) {
  return factory;
}
