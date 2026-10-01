import { useMemo } from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/typography';

type Props = {
  topLeft?: React.ReactNode;
  topRight?: React.ReactNode;
  title: string;
  subtitle?: string;
  minHeight?: number;
  children?: React.ReactNode;
  style?: ViewStyle;
};

// Flat sand surface — same as the Home "Your intent" banner, so featured
// events read as the same design system instead of a separate (gradient)
// treatment.
export function EventHero({ topLeft, topRight, title, subtitle, minHeight = 210, children, style }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={[styles.base, { minHeight }, style]}>
      {(topLeft || topRight) && (
        <View style={styles.topRow}>
          {topLeft}
          {topRight}
        </View>
      )}
      <View style={styles.spacer} />
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      {children}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    base: {
      borderRadius: 24,
      padding: 18,
      overflow: 'hidden',
      backgroundColor: colors.accentSoft,
    },
    topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    spacer: { flex: 1 },
    title: { fontFamily: fonts.headingExtraBold, color: colors.text, fontSize: 24, fontWeight: '800', marginTop: 8 },
    subtitle: { color: colors.muted, marginTop: 4, fontSize: 13 },
  });
