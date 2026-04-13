import React from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { THEME } from '../theme';
import { useTheme } from '../theme';

type BottomSheetModalProps = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  avoidKeyboard?: boolean;
  panelStyle?: StyleProp<ViewStyle>;
  handleWidth?: number;
  hideHandle?: boolean;
};

type SheetHeaderProps = {
  title: string;
  subtitle?: string;
  onClose: () => void;
  left?: React.ReactNode;
  titleNumberOfLines?: number;
};

export function SheetHandle({ width = 36 }: { width?: number }) {
  const { theme } = useTheme();
  return <View style={[styles.handle, { width, backgroundColor: theme.colors.border.medium }]} />;
}

export function SheetHeader({
  title,
  subtitle,
  onClose,
  left,
  titleNumberOfLines = 1,
}: SheetHeaderProps) {
  const { theme } = useTheme();

  return (
    <View style={styles.headerRow}>
      <View style={styles.headerContent}>
        <View style={styles.headerTitleRow}>
          {left}
          <Text
            style={[styles.headerTitle, { color: theme.colors.text.primary }]}
            numberOfLines={titleNumberOfLines}
          >
            {title}
          </Text>
        </View>
        {subtitle ? (
          <Text style={[styles.headerSubtitle, { color: theme.colors.text.secondary }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <TouchableOpacity onPress={onClose}>
        <Text style={[styles.closeText, { color: theme.colors.brand.primary }]}>Close</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function BottomSheetModal({
  visible,
  onClose,
  children,
  avoidKeyboard = false,
  panelStyle,
  handleWidth = 36,
  hideHandle = false,
}: BottomSheetModalProps) {
  const { theme } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {avoidKeyboard ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.overlay}
        >
          <TouchableOpacity
            style={[styles.backdrop, { backgroundColor: theme.colors.shadow.overlay }]}
            activeOpacity={1}
            onPress={onClose}
          />
          <View style={[styles.sheet, { backgroundColor: theme.colors.bg.elevated }, panelStyle]}>
            {!hideHandle ? <SheetHandle width={handleWidth} /> : null}
            {children}
          </View>
        </KeyboardAvoidingView>
      ) : (
        <View style={styles.overlay}>
          <TouchableOpacity
            style={[styles.backdrop, { backgroundColor: theme.colors.shadow.overlay }]}
            activeOpacity={1}
            onPress={onClose}
          />
          <View style={[styles.sheet, { backgroundColor: theme.colors.bg.elevated }, panelStyle]}>
            {!hideHandle ? <SheetHandle width={handleWidth} /> : null}
            {children}
          </View>
        </View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: THEME.colors.shadow.overlay,
  },
  sheet: {
    backgroundColor: THEME.colors.bg.elevated,
    borderTopLeftRadius: THEME.radius.xl,
    borderTopRightRadius: THEME.radius.xl,
    padding: THEME.spacing.xl,
    paddingBottom: THEME.spacing.xxxl,
  },
  handle: {
    height: 4,
    borderRadius: THEME.radius.full,
    alignSelf: 'center',
    marginBottom: THEME.spacing.xl,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: THEME.spacing.md,
    marginBottom: THEME.spacing.lg,
  },
  headerContent: {
    flex: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.sm,
  },
  headerTitle: {
    flex: 1,
    fontSize: THEME.font.sizes.xl,
    fontWeight: THEME.font.weights.bold,
  },
  headerSubtitle: {
    marginTop: THEME.spacing.xs,
    fontSize: THEME.font.sizes.md,
  },
  closeText: {
    fontSize: THEME.font.sizes.md,
  },
});
