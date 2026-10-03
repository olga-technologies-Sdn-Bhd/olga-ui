import { useMemo } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/typography';

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
};

// Bottom sheet in the prototype's card style (same backdrop as
// ComingSoonModal). The prototype has no sheets of its own.
export function BottomSheet({ visible, onClose, title, subtitle, children }: Props) {
  const { colors } = useTheme();
  const { bottom } = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      {/* The modal window doesn't resize for the keyboard, so lift the sheet
          itself above it (e.g. the report note). */}
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable style={[styles.sheet, { paddingBottom: 20 + bottom }]} onPress={() => {}}>
            <View style={styles.handle} />
            {title && <Text style={styles.title}>{title}</Text>}
            {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
            <View style={styles.body}>{children}</View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

type OptionProps = {
  label: string;
  onPress: () => void;
  danger?: boolean;
  selected?: boolean;
};

// One full-width row in a sheet (actions, mute options, report categories).
export function SheetOption({ label, onPress, danger, selected }: OptionProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.optionPressed]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <Text style={[styles.optionText, danger && styles.optionDanger]}>{label}</Text>
      {selected && <Text style={styles.check}>✓</Text>}
    </Pressable>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    flex: { flex: 1 },
    backdrop: { flex: 1, backgroundColor: 'rgba(15,12,20,0.5)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      paddingHorizontal: 20,
      paddingTop: 10,
    },
    handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line, marginBottom: 14 },
    title: { fontFamily: fonts.headingExtraBold, fontSize: 19, fontWeight: '800', color: colors.text },
    subtitle: { fontSize: 14, lineHeight: 20, color: colors.muted, marginTop: 6 },
    body: { marginTop: 14, gap: 8 },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: radius.md,
      paddingVertical: 14,
      paddingHorizontal: 16,
      backgroundColor: colors.surface,
    },
    optionSelected: { backgroundColor: colors.brandSoft, borderColor: colors.brandSoft },
    optionPressed: { backgroundColor: colors.surface2 },
    optionText: { fontSize: 15, fontWeight: '600', color: colors.text },
    optionDanger: { color: colors.danger },
    check: { fontSize: 15, fontWeight: '800', color: colors.text },
  });
