import { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { fonts, semibold } from '../theme/typography';

// charcoal: Commit / Accept (navy, white text in both themes).
// danger: an action that can't be undone (Delete account).
type Variant = 'primary' | 'secondary' | 'ghost' | 'charcoal' | 'danger';

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
  // Overrides the label colour (e.g. red text on an outlined destructive button).
  labelColor?: string;
};

export function Button({ label, onPress, variant = 'primary', loading, disabled, small, style, onDark, labelColor }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        // Pill, per spec: buttons are pills, 44–48px tall.
        base: {
          borderRadius: 999,
          paddingVertical: 12,
          paddingHorizontal: 18,
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 48,
        },
        primary: { backgroundColor: colors.brand },
        charcoal: { backgroundColor: colors.charcoal },
        danger: { backgroundColor: colors.danger },
        secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
        ghost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.brand2 },
        ghostOnDark: { backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' },
        small: { paddingVertical: 10, paddingHorizontal: 14, minHeight: 44, borderRadius: 999 },
        disabled: { opacity: 0.5 },
        // A gentle press-in, like iOS buttons.
        pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
        label: { fontFamily: fonts.bodyBold, fontWeight: semibold, fontSize: 14 },
        labelPrimary: { color: colors.onBrand },
        labelCharcoal: { color: colors.white },
        labelSecondary: { color: colors.text },
        labelGhost: { color: colors.brand },
        labelOnDark: { color: colors.white },
        labelSmall: { fontSize: 12 },
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
        variant === 'danger' && styles.danger,
        variant === 'secondary' && styles.secondary,
        variant === 'ghost' && ghostStyle,
        small && styles.small,
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.onBrand : variant === 'charcoal' || variant === 'danger' ? colors.white : colors.brand} />
      ) : (
        <Text
          style={[
            styles.label,
            variant === 'primary' && styles.labelPrimary,
            (variant === 'charcoal' || variant === 'danger') && styles.labelCharcoal,
            variant === 'secondary' && styles.labelSecondary,
            variant === 'ghost' && ghostLabelStyle,
            small && styles.labelSmall,
            !!labelColor && { color: labelColor },
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}
