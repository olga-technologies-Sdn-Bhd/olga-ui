import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';

type Props = {
  label: string;
  onRemove: () => void;
};

// Matches the prototype's `.user-tag` pill with a remove (×) button.
export function RemovableTag({ label, onRemove }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <Pressable onPress={onRemove} hitSlop={6}>
        <Text style={styles.remove}>×</Text>
      </Pressable>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: colors.tint,
    borderWidth: 1,
    borderColor: '#ddd2ff',
  },
  label: { fontSize: 12, fontWeight: '700', color: colors.brand },
  remove: { fontSize: 14, color: colors.brand, lineHeight: 14 },
});
