import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors } from '../theme/colors';

type Props = {
  topLeft?: React.ReactNode;
  topRight?: React.ReactNode;
  title: string;
  subtitle?: string;
  minHeight?: number;
  children?: React.ReactNode;
  style?: ViewStyle;
};

// Matches the prototype's `.hero-event` — a dark gradient card used for
// featured events (olga_interactive_prototype_mobile_v10.html).
export function EventHero({ topLeft, topRight, title, subtitle, minHeight = 210, children, style }: Props) {
  return (
    <View style={[styles.base, { minHeight }, style]}>
      {(topLeft || topRight) && (
        <View style={styles.topRow}>
          {topLeft}
          {topRight}
        </View>
      )}
      <View style={{ flex: 1 }} />
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 24,
    padding: 18,
    backgroundColor: '#3a2e5c',
    // Approximates the prototype's radial-gradient purple hero background.
    overflow: 'hidden',
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { color: colors.white, fontSize: 24, fontWeight: '800', marginTop: 8 },
  subtitle: { color: 'rgba(255,255,255,0.85)', marginTop: 4, fontSize: 13 },
});
