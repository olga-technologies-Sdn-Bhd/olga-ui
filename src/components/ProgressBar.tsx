import { StyleSheet, View } from 'react-native';
import { colors } from '../theme/colors';

type Props = { percent: number };

// Matches the prototype's `.progress` / `.progress span` bar.
export function ProgressBar({ percent }: Props) {
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${Math.max(0, Math.min(100, percent))}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 7, backgroundColor: '#eeeaf0', borderRadius: 99, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 99, backgroundColor: colors.brand },
});
