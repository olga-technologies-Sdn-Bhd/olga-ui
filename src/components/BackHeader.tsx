import { ArrowLeft } from 'lucide-react-native';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { fonts, semibold } from '../theme/typography';

type Props = {
  onBack: () => void;
  // Screen title, on the left beside the arrow.
  title?: string;
  right?: React.ReactNode;
};

// The back arrow (just the arrow, no circle), an optional title beside it, and a right-side
// slot, used in the topline of most secondary screens.
export function BackHeader({ onBack, title, right }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.row}>
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Back"
        hitSlop={8}
        style={({ pressed }) => [styles.back, pressed && styles.pressed]}
      >
        <ArrowLeft size={24} color={colors.text} strokeWidth={2} />
      </Pressable>
      {title ? (
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      ) : (
        <View style={styles.fill} />
      )}
      {right}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  fill: { flex: 1 },
  title: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 17, fontWeight: semibold, color: colors.text },
  // The arrow sits flush left with the content; the tap area stays 38 x 38.
  back: { width: 38, height: 38, marginLeft: -7, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.5 },
});
