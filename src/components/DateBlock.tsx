import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/typography';

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

// Boards 02 and 05: a sand date block (day over month) in place of the old
// numbered circles. Device local time.
// outlined: a bordered block on the page surface (the Events list).
export function DateBlock({ iso, size = 'md', outlined }: { iso: string; size?: 'sm' | 'md'; outlined?: boolean }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const date = new Date(iso);
  const valid = !Number.isNaN(date.getTime());
  const small = size === 'sm';
  return (
    <View style={[styles.block, small && styles.blockSm, outlined && styles.outlined]} accessibilityLabel={valid ? date.toDateString() : undefined}>
      <Text style={[styles.day, small && styles.daySm]}>{valid ? date.getDate() : '–'}</Text>
      <Text style={styles.month}>{valid ? MONTHS[date.getMonth()] : ''}</Text>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    block: {
      width: 54,
      height: 58,
      borderRadius: 14,
      backgroundColor: colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    blockSm: { width: 46, height: 50, borderRadius: 12 },
    outlined: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
    day: { fontFamily: fonts.headingExtraBold, fontSize: 18, fontWeight: '800', color: colors.text, lineHeight: 21 },
    daySm: { fontSize: 16, lineHeight: 19 },
    month: { fontFamily: fonts.monoBold, fontSize: 10, letterSpacing: 1, fontWeight: '700', color: colors.muted },
  });
