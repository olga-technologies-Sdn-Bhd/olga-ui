import { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/typography';

// charcoal: Commit / Accept (soft charcoal #3A3531, white text in both themes).
type Variant = 'primary' | 'secondary' | 'ghost' | 'charcoal';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  small?: boolean;
  style?: ViewStyle;
  // For a ghost/secondary button placed on a dark/gradient card, where the
  // normal blue-on-blue text+border would be unreadable — forces white.
  onDark?: boolean;
};

export function Button({ label, onPress, variant = 'primary', loading, disabled, small, style, onDark }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        // Pill, per spec: buttons are pills, 44–48px tall.
        base: {
          borderRadius: 999,
          paddingVertical: 15,
          paddingHorizontal: 18,
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 48,
        },
        primary: { backgroundColor: colors.brand },
        charcoal: { backgroundColor: colors.charcoal },
        secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
        ghost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.brand2 },
        ghostOnDark: { backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' },
        small: { paddingVertical: 10, paddingHorizontal: 14, minHeight: 44, borderRadius: 999 },
        disabled: { opacity: 0.5 },
        pressed: { opacity: 0.85 },
        label: { fontFamily: fonts.bodyBold, fontWeight: '700', fontSize: 15 },
        labelPrimary: { color: colors.onBrand },
        labelCharcoal: { color: colors.white },
        labelSecondary: { color: colors.text },
        labelGhost: { color: colors.brand },
        labelOnDark: { color: colors.white },
        labelSmall: { fontSize: 13 },
      }),
    [colors]
  );

  const ghostStyle = onDark ? styles.ghostOnDark : styles.ghost;
  const ghostLabelStyle = onDark ? styles.labelOnDark : styles.labelGhost;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'charcoal' && styles.charcoal,
        variant === 'secondary' && styles.secondary,
        variant === 'ghost' && ghostStyle,
        small && styles.small,
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.onBrand : variant === 'charcoal' ? colors.white : colors.brand} />
      ) : (
        <Text
          style={[
            styles.label,
            variant === 'primary' && styles.labelPrimary,
            variant === 'charcoal' && styles.labelCharcoal,
            variant === 'secondary' && styles.labelSecondary,
            variant === 'ghost' && ghostLabelStyle,
            small && styles.labelSmall,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}
