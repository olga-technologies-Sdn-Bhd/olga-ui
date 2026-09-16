import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { colors, radius } from '../theme/colors';

type Variant = 'primary' | 'secondary' | 'ghost';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  small?: boolean;
  style?: ViewStyle;
};

export function Button({ label, onPress, variant = 'primary', loading, disabled, small, style }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'ghost' && styles.ghost,
        small && styles.small,
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.white : colors.brand} />
      ) : (
        <Text
          style={[
            styles.label,
            variant === 'primary' && styles.labelPrimary,
            variant === 'secondary' && styles.labelSecondary,
            variant === 'ghost' && styles.labelGhost,
            small && styles.labelSmall,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    paddingVertical: 15,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  primary: { backgroundColor: colors.brand },
  secondary: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  ghost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(109,74,255,0.22)' },
  small: { paddingVertical: 10, paddingHorizontal: 14, minHeight: 40, borderRadius: radius.sm },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
  label: { fontWeight: '700', fontSize: 15 },
  labelPrimary: { color: colors.white },
  labelSecondary: { color: colors.text },
  labelGhost: { color: colors.brand },
  labelSmall: { fontSize: 13 },
});
