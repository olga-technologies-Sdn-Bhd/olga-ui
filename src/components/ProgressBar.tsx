import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';

type Props = { percent: number };

// Matches the prototype's `.progress` / `.progress span` bar.
export function ProgressBar({ percent }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${Math.max(0, Math.min(100, percent))}%` }]} />
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  track: { height: 7, backgroundColor: colors.progressTrack, borderRadius: 99, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 99, backgroundColor: colors.brand },
});
