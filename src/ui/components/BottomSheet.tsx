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
  return <View style={[styles.handle, { width }]} />;
}

export function SheetHeader({
  title,
  subtitle,
  onClose,
  left,
  titleNumberOfLines = 1,
}: SheetHeaderProps) {
  return (
    <View style={styles.headerRow}>
      <View style={styles.headerContent}>
        <View style={styles.headerTitleRow}>
          {left}
          <Text style={styles.headerTitle} numberOfLines={titleNumberOfLines}>
            {title}
          </Text>
        </View>
        {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
      </View>
      <TouchableOpacity onPress={onClose}>
        <Text style={styles.closeText}>Close</Text>
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
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {avoidKeyboard ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.overlay}
        >
          <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
          <View style={[styles.sheet, panelStyle]}>
            {!hideHandle ? <SheetHandle width={handleWidth} /> : null}
            {children}
          </View>
        </KeyboardAvoidingView>
      ) : (
        <View style={styles.overlay}>
          <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
          <View style={[styles.sheet, panelStyle]}>
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
    backgroundColor: THEME.colors.border.medium,
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
    color: THEME.colors.text.primary,
  },
  headerSubtitle: {
    marginTop: THEME.spacing.xs,
    fontSize: THEME.font.sizes.md,
    color: THEME.colors.text.secondary,
  },
  closeText: {
    fontSize: THEME.font.sizes.md,
    color: THEME.colors.brand.primary,
  },
});
