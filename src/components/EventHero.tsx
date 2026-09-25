import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useTheme } from '../theme/ThemeContext';

type Props = {
  topLeft?: React.ReactNode;
  topRight?: React.ReactNode;
  title: string;
  subtitle?: string;
  minHeight?: number;
  children?: React.ReactNode;
  style?: ViewStyle;
};

// Same rich accent gradient as the Home "Your intent" banner, so featured
// events read as the same design system instead of a separate color.
export function EventHero({ topLeft, topRight, title, subtitle, minHeight = 210, children, style }: Props) {
  const { gradient } = useTheme();
  return (
    <View style={[styles.base, { minHeight }, style]}>
      <LinearGradient
        colors={gradient}
        start={{ x: 0.2, y: 0.15 }}
        end={{ x: 0.85, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
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
    overflow: 'hidden',
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { color: '#ffffff', fontSize: 24, fontWeight: '800', marginTop: 8 },
  subtitle: { color: 'rgba(255,255,255,0.85)', marginTop: 4, fontSize: 13 },
});
