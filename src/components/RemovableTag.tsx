import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

type Props = {
  label: string;
  onRemove: () => void;
};

// Matches the prototype's `.user-tag` pill with a remove (×) button.
export function RemovableTag({ label, onRemove }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <Pressable onPress={onRemove} hitSlop={6}>
        <Text style={styles.remove}>×</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: '#f7f4ff',
    borderWidth: 1,
    borderColor: '#ddd2ff',
  },
  label: { fontSize: 12, fontWeight: '700', color: colors.brand },
  remove: { fontSize: 14, color: colors.brand, lineHeight: 14 },
});
