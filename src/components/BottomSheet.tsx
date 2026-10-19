import { Check } from 'lucide-react-native';
import { Children, Fragment, isValidElement, useMemo } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { fonts, semibold } from '../theme/typography';

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

// One slim row in a sheet's option group (actions, mute options). Put rows in
// a SheetGroup so they sit together like the report reasons.
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

// A sheet's options as one rounded group with hairline dividers, the same
// look as SheetChoices.
export function SheetGroup({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const rows = Children.toArray(children).filter(isValidElement);
  return (
    <View style={styles.choices}>
      {rows.map((row, i) => (
        <Fragment key={row.key ?? i}>
          {i > 0 && <View style={styles.groupDivider} />}
          {row}
        </Fragment>
      ))}
    </View>
  );
}

// A compact pick-one list (e.g. report reasons): slim rows in one group,
// hairline dividers, and only a red tick on the chosen one.
export function SheetChoices<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (value: T) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.choices}>
      {options.map((o, i) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={({ pressed }) => [styles.choice, i > 0 && styles.choiceDivider, pressed && styles.optionPressed]}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
          >
            <Text style={styles.choiceText}>{o.label}</Text>
            {selected && <Check size={18} color={colors.danger} strokeWidth={2.6} />}
          </Pressable>
        );
      })}
    </View>
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
    handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line, marginBottom: 10 },
    title: { fontFamily: fonts.headingExtraBold, fontSize: 19, fontWeight: semibold, color: colors.text },
    subtitle: { fontSize: 13.5, lineHeight: 19, color: colors.muted, marginTop: 3 },
    body: { marginTop: 12, gap: 8 },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: 42,
      paddingHorizontal: 14,
      backgroundColor: colors.surface,
    },
    // Selected: no fill, just the red tick.
    optionSelected: {},
    optionPressed: { backgroundColor: colors.surface2 },
    optionText: { fontSize: 14.5, color: colors.text },
    optionDanger: { color: colors.danger },
    check: { fontSize: 15, fontWeight: semibold, color: colors.danger },
    choices: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, overflow: 'hidden' },
    choice: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 42, paddingHorizontal: 14 },
    groupDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
    choiceDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
    choiceText: { fontSize: 14.5, color: colors.text },
  });
