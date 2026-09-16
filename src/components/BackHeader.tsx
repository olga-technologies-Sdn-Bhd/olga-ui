import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

type Props = {
  onBack: () => void;
  right?: React.ReactNode;
  rightLabel?: string;
};

// Matches the prototype's `.back` circular button + right-side slot pattern
// used in the topline of most secondary screens.
export function BackHeader({ onBack, right, rightLabel }: Props) {
  return (
    <View style={styles.row}>
      <Pressable onPress={onBack} style={styles.back}>
        <Text style={styles.backText}>←</Text>
      </Pressable>
      {right}
      {rightLabel && <Text style={styles.rightLabel}>{rightLabel}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  back: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: { fontSize: 16, color: colors.text },
  rightLabel: { fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.muted, fontWeight: '700' },
});
