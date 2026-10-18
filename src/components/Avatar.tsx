import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { fonts, semibold } from '../theme/typography';

type Size = 'sm' | 'md' | 'lg';

type Props = {
  initials: string;
  size?: Size;
  // Charcoal fill with light text: the account button in screen headers.
  dark?: boolean;
};

const SIZES: Record<Size, number> = { sm: 34, md: 42, lg: 58 };
const FONT_SIZES: Record<Size, number> = { sm: 12, md: 15, lg: 18 };

export function Avatar({ initials, size = 'md', dark }: Props) {
  const dimension = SIZES[size];
  const { colors } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        base: {
          // Initials on a soft brand tint, like iOS contacts.
          backgroundColor: colors.accentFill,
          alignItems: 'center',
          justifyContent: 'center',
        },
        text: {
          fontFamily: fonts.bodyBold,
          fontWeight: semibold,
          color: colors.accent,
        },
        dark: { backgroundColor: colors.charcoal },
        textDark: { color: colors.white },
      }),
    [colors]
  );

  return (
    <View style={[styles.base, dark && styles.dark, { width: dimension, height: dimension, borderRadius: dimension / 2 }]}>
      <Text style={[styles.text, dark && styles.textDark, { fontSize: FONT_SIZES[size] }]}>{initials}</Text>
    </View>
  );
}
