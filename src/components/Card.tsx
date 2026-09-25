import { useMemo } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { radius } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';

type Props = {
  children: React.ReactNode;
  soft?: boolean;
  style?: ViewStyle;
};

export function Card({ children, soft, style }: Props) {
  const { colors, gradient } = useTheme();
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
        soft: { borderWidth: 0, overflow: 'hidden' },
      }),
    [colors]
  );

  if (soft) {
    return (
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.base, styles.soft, style]}
      >
        {children}
      </LinearGradient>
    );
  }

  return <View style={[styles.base, style]}>{children}</View>;
}
