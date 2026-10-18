import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/typography';

type Size = 'sm' | 'md' | 'list' | 'lg';

type Props = {
  initials: string;
  size?: Size;
  // Charcoal fill with light text: the account button in screen headers.
  dark?: boolean;
  // White fill: stands out on a tinted ground (a conversation header).
  light?: boolean;
};

// list: a row in the Chats list (WhatsApp-sized).
const SIZES: Record<Size, number> = { sm: 34, md: 42, list: 50, lg: 58 };
const FONT_SIZES: Record<Size, number> = { sm: 12, md: 15, list: 16, lg: 18 };

export function Avatar({ initials, size = 'md', dark, light }: Props) {
  const dimension = SIZES[size];
  const { colors } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        base: {
          backgroundColor: colors.accentSoft,
          alignItems: 'center',
          justifyContent: 'center',
        },
        text: {
          fontFamily: fonts.bodyBold,
          fontWeight: '800',
          color: colors.brand,
        },
        dark: { backgroundColor: colors.charcoal },
        light: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
        textDark: { color: colors.white },
      }),
    [colors]
  );

  return (
    <View style={[styles.base, dark && styles.dark, light && styles.light, { width: dimension, height: dimension, borderRadius: dimension / 2 }]}>
      <Text style={[styles.text, dark && styles.textDark, { fontSize: FONT_SIZES[size] }]}>{initials}</Text>
    </View>
  );
}
