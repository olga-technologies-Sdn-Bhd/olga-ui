import { StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useTheme } from '../theme/ThemeContext';

// The warm sunrise wash from Home's hero, softened, behind the top of the other
// tab screens so they share its look. Put it first inside the header area.
export function TopGlow({ height }: { height?: number }) {
  const { colors } = useTheme();
  return (
    <LinearGradient
      pointerEvents="none"
      colors={[colors.glowTop, colors.glowTopClear]}
      style={[styles.glow, height ? { height, bottom: undefined } : null]}
    />
  );
}

const styles = StyleSheet.create({
  glow: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
});
