import { Children, Fragment, isValidElement, useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { radius, ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { fonts, semibold } from '../theme/typography';

// The app's standard list: one rounded group per section, compact rows,
// hairline dividers that start after the row's leading element (as in iOS
// Settings or WhatsApp). Use it for lists of people, meetings and the like;
// Card stays for single blocks with actions.

const LEAD = 42; // the leading avatar/silhouette size rows are laid out for
const PAD = 14;
const GAP = 12;
const ROW_H = 66;
const ROW_H_TALL = 82;

export function ListGroup({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const rows = Children.toArray(children).filter(isValidElement);
  return (
    <View style={styles.group}>
      {rows.map((row, i) => (
        <Fragment key={row.key ?? i}>
          {i > 0 && <View style={styles.divider} />}
          {row}
        </Fragment>
      ))}
    </View>
  );
}

// Rows in a list are all the same height. Two-line rows: title + subtitle.
// Three-line rows (threeLines): title + subtitle + detail (e.g. a plan with an
// icon). The height is fixed per kind and the text is centred in it, so a
// row with a missing line is the same size, without a gap.
type RowProps = {
  leading?: React.ReactNode;
  title: string;
  subtitle?: string | null;
  detail?: React.ReactNode;
  threeLines?: boolean;
  trailing?: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
};

export function ListRow({ leading, title, subtitle, detail, threeLines, trailing, onPress, disabled, accessibilityLabel }: RowProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      android_ripple={onPress ? { color: colors.accentFill } : undefined}
      style={({ pressed }) => [styles.row, threeLines && styles.rowTall, pressed && Platform.OS === 'ios' && styles.pressed]}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
    >
      {leading}
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {!!subtitle && (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
        {threeLines && detail}
      </View>
      {/* Centred, whatever it is (a time, a status pill). */}
      {trailing != null && <View style={styles.trailing}>{trailing}</View>}
    </Pressable>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    group: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.line,
      overflow: 'hidden',
    },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line, marginLeft: PAD + LEAD + GAP },
    // A fixed height, so every row in every list is the same size.
    row: { flexDirection: 'row', alignItems: 'center', gap: GAP, paddingHorizontal: PAD, height: ROW_H },
    rowTall: { height: ROW_H_TALL },
    pressed: { backgroundColor: colors.accentFill },
    body: { flex: 1, gap: 2, justifyContent: 'center' },
    trailing: { alignSelf: 'center', alignItems: 'flex-end' },
    title: { fontFamily: fonts.bodyBold, fontSize: 15, fontWeight: semibold, color: colors.text },
    subtitle: { fontSize: 13, color: colors.muted },
  });
