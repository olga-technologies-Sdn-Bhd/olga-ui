import { useMemo } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { radius } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';

type Props = {
  children: React.ReactNode;
  // Sand surface (intent card, date blocks) instead of the default card —
  // a flat warm fill, never a gradient.
  soft?: boolean;
  style?: ViewStyle;
};

export function Card({ children, soft, style }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        base: {
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.line,
          borderRadius: radius.lg,
          padding: 16,
        },
        soft: { backgroundColor: colors.accentSoft, borderWidth: 0 },
      }),
    [colors]
  );

  return <View style={[styles.base, soft && styles.soft, style]}>{children}</View>;
}
