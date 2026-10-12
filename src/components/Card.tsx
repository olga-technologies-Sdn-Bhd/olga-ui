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
  const { colors, scheme } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        base: {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          padding: 16,
          // A soft lift on the light ground; a hairline on the dark one, where
          // shadows don't show.
          ...(scheme === 'dark'
            ? { borderWidth: 1, borderColor: colors.line }
            : {
                shadowColor: colors.charcoal,
                shadowOpacity: 0.08,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 4 },
                elevation: 2,
              }),
        },
        soft: { backgroundColor: colors.accentSoft, borderWidth: 0, shadowOpacity: 0, elevation: 0 },
      }),
    [colors, scheme]
  );

  return <View style={[styles.base, soft && styles.soft, style]}>{children}</View>;
}
